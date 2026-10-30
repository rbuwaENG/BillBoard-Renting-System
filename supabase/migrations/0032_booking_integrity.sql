-- 0032 · Booking integrity (shared contracts 3, 4)
--
-- * Platform-local "today" (platform_settings.timezone, default Asia/Colombo)
--   used by every date rule: request validation, lifecycle, reminders, payouts.
-- * Bookings status gains 'expired'; advance_booking_lifecycle expires stale
--   requests (owner silent > 72h) and unpaid approvals (> 72h after decision).
-- * Double booking is made impossible by an exclusion constraint over the
--   blocking statuses. Existing overlaps are cleaned up first (see
--   cleanup_overlapping_bookings below for the rules).
-- * request_booking / create_campaign enforce role, ownership, date rules.
-- * get_billboard_booked_ranges: public availability without renter details.

-- ---------------------------------------------------------------------------
-- Platform time zone + local today
-- ---------------------------------------------------------------------------

alter table public.platform_settings
  add column if not exists timezone text not null default 'Asia/Colombo';

create or replace function public.trg_platform_settings_validate_timezone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Unknown time zone: %', new.timezone;
  end if;
  return new;
end;
$$;

revoke all on function public.trg_platform_settings_validate_timezone() from public, anon, authenticated;

drop trigger if exists platform_settings_validate_timezone on public.platform_settings;
create trigger platform_settings_validate_timezone
  before insert or update of timezone on public.platform_settings
  for each row execute function public.trg_platform_settings_validate_timezone();

-- Internal helper (used inside security-definer functions only): no grants.
create or replace function public.platform_today()
returns date
language sql
stable
security definer
set search_path = public
as $$
  select (now() at time zone coalesce(
    (select timezone from public.platform_settings limit 1),
    'Asia/Colombo'
  ))::date
$$;

revoke all on function public.platform_today() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Status 'expired'
-- ---------------------------------------------------------------------------

alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check check (status in (
  'pending_owner_review','approved','rejected','payment_pending',
  'confirmed','active','completed','cancelled','expired'
));

-- ---------------------------------------------------------------------------
-- Booking event actor: system transitions (lifecycle/expiry) are logged with
-- actor_id = null, never with the id of whichever user happened to trigger
-- advance_booking_lifecycle from the client fallback.
-- ---------------------------------------------------------------------------

create or replace function public.trg_booking_log_status_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.booking_events (booking_id, event_type, actor_id, to_status)
    values (new.id, 'status_change', new.renter_id, new.status);
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.booking_events (booking_id, event_type, actor_id, from_status, to_status)
    values (
      new.id,
      'status_change',
      case when coalesce(current_setting('app.system_actor', true), '') = 'on' then null else auth.uid() end,
      old.status,
      new.status
    );
  end if;

  return new;
end;
$$;

revoke all on function public.trg_booking_log_status_event() from public, anon, authenticated;

-- Latest definition: 0011. Adds the 'expired' notifications.
create or replace function public.trg_booking_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.notify(
      new.owner_id,
      'booking_requested',
      'New booking request received for your billboard.',
      new.id
    );
    return new;
  end if;

  if new.status = old.status then
    return new;
  end if;

  if new.status = 'payment_pending' then
    perform public.notify(new.renter_id, 'booking_approved', 'Your booking request was approved — payment is now due.', new.id);
  elsif new.status = 'rejected' then
    perform public.notify(new.renter_id, 'booking_rejected', coalesce('Your booking request was rejected: ' || new.rejection_reason, 'Your booking request was rejected.'), new.id);
  elsif new.status = 'confirmed' then
    perform public.notify(new.renter_id, 'payment_confirmed', 'Your payment was confirmed — booking is now confirmed.', new.id);
  elsif new.status = 'completed' then
    perform public.notify(new.renter_id, 'booking_completed', 'Your booking is complete — leave a review for the billboard.', new.id);
    perform public.notify(new.owner_id, 'booking_completed', 'A booking on your billboard is now complete.', new.id);
  elsif new.status = 'cancelled' then
    perform public.notify(new.renter_id, 'booking_cancelled', 'Your booking was cancelled.', new.id);
    perform public.notify(new.owner_id, 'booking_cancelled', 'A booking on your billboard was cancelled.', new.id);
  elsif new.status = 'expired' then
    if old.status = 'pending_owner_review' then
      perform public.notify(new.renter_id, 'booking_expired', 'Your booking request expired — the owner did not respond within 72 hours.', new.id);
      perform public.notify(new.owner_id, 'booking_expired', 'A booking request on your billboard expired without a response.', new.id);
    else
      perform public.notify(new.renter_id, 'booking_expired', 'Your booking expired — payment was not received within 72 hours of approval.', new.id);
      perform public.notify(new.owner_id, 'booking_expired', 'A booking on your billboard expired — payment was not received in time.', new.id);
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.trg_booking_notify() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Overlap cleanup + exclusion constraint
-- ---------------------------------------------------------------------------

-- Rows that a paid (confirmed/active) booking conflicts with and that cannot
-- be cancelled automatically are flagged instead and left out of the
-- exclusion constraint (request_booking still checks them explicitly).
alter table public.bookings
  add column if not exists overlap_grandfathered boolean not null default false;

-- Deterministic cleanup, per billboard, over the blocking statuses. Bookings
-- are visited in priority order: paid (confirmed/active) first, then by
-- created_at, then id. A booking that overlaps one already kept is
--   * cancelled with rejection_reason 'Overlapping booking cleaned up' if it is
--     not paid (pending_owner_review / payment_pending), or
--   * left untouched but flagged overlap_grandfathered (+ raise notice) if it
--     is paid — two paid overlapping bookings need a human (refund/move), we
--     never change money-backed bookings silently.
-- Internal (migration/maintenance only): no grants. Returns the number of
-- bookings cancelled.
create or replace function public.cleanup_overlapping_bookings()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_b record;
  v_kept uuid[] := '{}';
  v_cancelled integer := 0;
begin
  for v_b in
    select id, billboard_id, start_date, end_date, status
    from public.bookings
    where status in ('pending_owner_review','payment_pending','confirmed','active')
      and not overlap_grandfathered
    order by billboard_id,
             (status in ('confirmed','active')) desc,
             created_at,
             id
  loop
    if exists (
      select 1 from public.bookings k
      where k.id = any(v_kept)
        and k.billboard_id = v_b.billboard_id
        and daterange(k.start_date, k.end_date, '[]') && daterange(v_b.start_date, v_b.end_date, '[]')
    ) then
      if v_b.status in ('confirmed','active') then
        update public.bookings set overlap_grandfathered = true where id = v_b.id;
        raise notice 'Booking % (%) overlaps another paid booking on billboard %; left unchanged and flagged overlap_grandfathered — resolve manually',
          v_b.id, v_b.status, v_b.billboard_id;
      else
        update public.bookings
           set status = 'cancelled',
               rejection_reason = 'Overlapping booking cleaned up'
         where id = v_b.id;
        v_cancelled := v_cancelled + 1;
      end if;
    else
      v_kept := v_kept || v_b.id;
    end if;
  end loop;

  return v_cancelled;
end;
$$;

revoke all on function public.cleanup_overlapping_bookings() from public, anon, authenticated;

do $$
declare
  v_n integer;
begin
  v_n := public.cleanup_overlapping_bookings();
  if v_n > 0 then
    raise notice '0032: cancelled % overlapping booking(s)', v_n;
  end if;
end $$;

create extension if not exists btree_gist with schema extensions;

alter table public.bookings
  add constraint bookings_no_overlap
  exclude using gist (
    billboard_id with =,
    daterange(start_date, end_date, '[]') with &&
  )
  where (
    status in ('pending_owner_review','payment_pending','confirmed','active')
    and not overlap_grandfathered
  );

-- ---------------------------------------------------------------------------
-- request_booking (latest: 0019) — pricing logic unchanged
-- ---------------------------------------------------------------------------

create or replace function public.request_booking(
  p_billboard_id uuid,
  p_start_date date,
  p_end_date date,
  p_creative_url text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_billboard public.billboards;
  v_days integer;
  v_rate numeric;
  v_tier_rate numeric;
  v_price numeric;
  v_booking public.bookings;
begin
  perform public.assert_active_user();
  if public.current_profile_role() is distinct from 'renter' then
    raise exception 'Only renter accounts can request bookings';
  end if;

  select * into v_billboard from public.billboards where id = p_billboard_id;
  if not found then
    raise exception 'Billboard not found';
  end if;
  if v_billboard.owner_id = auth.uid() then
    raise exception 'You cannot book your own billboard';
  end if;
  if v_billboard.status <> 'active' then
    raise exception 'Billboard is not available for booking';
  end if;
  if p_start_date is null or p_end_date is null then
    raise exception 'Start and end dates are required';
  end if;
  if p_start_date < public.platform_today() then
    raise exception 'Start date cannot be in the past';
  end if;
  if p_end_date < p_start_date then
    raise exception 'End date must be on or after the start date';
  end if;

  -- Friendly pre-check (also covers grandfathered rows, which the exclusion
  -- constraint skips); the constraint is what makes concurrent requests safe.
  if exists (
    select 1 from public.bookings
    where billboard_id = p_billboard_id
      and status in ('pending_owner_review','payment_pending','confirmed','active')
      and daterange(start_date, end_date, '[]') && daterange(p_start_date, p_end_date, '[]')
  ) then
    raise exception 'Selected dates overlap an existing booking';
  end if;

  v_days := (p_end_date - p_start_date) + 1;

  if v_billboard.admin_price_override_per_day is not null then
    v_rate := v_billboard.admin_price_override_per_day;
  else
    select price_per_day into v_tier_rate
    from public.billboard_pricing_tiers
    where billboard_id = p_billboard_id
      and min_days <= v_days
      and (max_days is null or v_days <= max_days)
    order by min_days desc
    limit 1;

    if v_tier_rate is not null then
      v_rate := v_tier_rate;
    elsif v_billboard.sale_price_per_day is not null and v_billboard.sale_price_per_day < v_billboard.price_per_day then
      v_rate := v_billboard.sale_price_per_day;
    else
      v_rate := v_billboard.price_per_day;
    end if;
  end if;

  v_price := v_rate * v_days;

  begin
    insert into public.bookings (billboard_id, owner_id, renter_id, start_date, end_date, creative_url, price_quoted, status)
    values (p_billboard_id, v_billboard.owner_id, auth.uid(), p_start_date, p_end_date, p_creative_url, v_price, 'pending_owner_review')
    returning * into v_booking;
  exception when exclusion_violation then
    raise exception 'Selected dates overlap an existing booking';
  end;

  return v_booking;
end;
$$;

revoke all on function public.request_booking(uuid, date, date, text) from public, anon, authenticated;
grant execute on function public.request_booking(uuid, date, date, text) to authenticated;

-- ---------------------------------------------------------------------------
-- create_campaign (latest: 0028) — per-item failure reporting kept
-- ---------------------------------------------------------------------------

create or replace function public.create_campaign(
  p_name text,
  p_start_date date,
  p_end_date date,
  p_billboard_ids uuid[]
)
returns public.campaigns
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign public.campaigns;
  v_ids uuid[];
  v_billboard_id uuid;
  v_booking public.bookings;
begin
  perform public.assert_active_user();
  if public.current_profile_role() is distinct from 'renter' then
    raise exception 'Only renter accounts can request bookings';
  end if;

  -- Distinct ids, original order kept (duplicates would collide on the
  -- campaign_items primary key).
  select array_agg(id order by ord) into v_ids
  from (
    select id, min(ord) as ord
    from unnest(p_billboard_ids) with ordinality as t(id, ord)
    where id is not null
    group by id
  ) d;

  if v_ids is null then
    raise exception 'Select at least one billboard for the campaign';
  end if;
  if array_length(v_ids, 1) > 20 then
    raise exception 'A campaign can include at most 20 billboards';
  end if;
  if p_start_date is null or p_end_date is null then
    raise exception 'Start and end dates are required';
  end if;
  if p_start_date < public.platform_today() then
    raise exception 'Start date cannot be in the past';
  end if;
  if p_end_date < p_start_date then
    raise exception 'End date must be on or after the start date';
  end if;

  insert into public.campaigns (renter_id, name, start_date, end_date)
  values (auth.uid(), p_name, p_start_date, p_end_date)
  returning * into v_campaign;

  foreach v_billboard_id in array v_ids loop
    begin
      select * into v_booking from public.request_booking(v_billboard_id, p_start_date, p_end_date, null);
      insert into public.campaign_items (campaign_id, billboard_id, booking_id, status)
      values (v_campaign.id, v_billboard_id, v_booking.id, 'booked');
    exception when others then
      insert into public.campaign_items (campaign_id, billboard_id, status, failure_reason)
      values (v_campaign.id, v_billboard_id, 'failed', sqlerrm);
    end;
  end loop;

  return v_campaign;
end;
$$;

revoke all on function public.create_campaign(text, date, date, uuid[]) from public, anon, authenticated;
grant execute on function public.create_campaign(text, date, date, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Lifecycle (latest: 0015). Safe for any authenticated caller (client
-- fallback): returns nothing, idempotent, only applies time-based rules.
-- ---------------------------------------------------------------------------

create or replace function public.advance_booking_lifecycle()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := public.platform_today();
begin
  -- Transitions below are logged with actor_id = null (system).
  perform set_config('app.system_actor', 'on', true);

  update public.bookings set status = 'active'
   where status = 'confirmed' and start_date <= v_today;

  update public.bookings set status = 'completed'
   where status = 'active' and end_date < v_today;

  -- Owner never responded.
  update public.bookings set status = 'expired'
   where status = 'pending_owner_review'
     and created_at <= now() - interval '72 hours';

  -- Approved but not paid. A submitted (pending) payment keeps the booking
  -- alive until an admin confirms or rejects it. payment_id is re-checked on
  -- the locked row, so a submission racing this update is never expired.
  update public.bookings b set status = 'expired'
   where b.status = 'payment_pending'
     and coalesce(b.decision_at, b.created_at) <= now() - interval '72 hours'
     and b.payment_id is null
     and not exists (
       select 1 from public.payments p
       where p.booking_id = b.id and p.status = 'pending'
     );

  perform set_config('app.system_actor', '', true);
end;
$$;

revoke all on function public.advance_booking_lifecycle() from public, anon, authenticated;
grant execute on function public.advance_booking_lifecycle() to authenticated;

-- Latest: 0016 (status recheck added). Internal, cron only: no grants.
create or replace function public.release_due_payouts()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payout record;
begin
  for v_payout in
    update public.payouts
       set status = 'paid', released_at = now()
     where status = 'approved' and scheduled_release_date <= public.platform_today()
    returning *
  loop
    perform public.notify(v_payout.owner_id, 'payout_released', 'Your payout of ' || v_payout.amount || ' ' || v_payout.currency || ' has been released.', v_payout.id);
  end loop;
end;
$$;

revoke all on function public.release_due_payouts() from public, anon, authenticated;

-- Latest: 0027 (only the "tomorrow" date changes). Internal, cron only.
create or replace function public.send_booking_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, message, ref_id)
  select b.renter_id, 'payment_reminder',
    'Your booking for "' || bb.title || '" is still awaiting payment.', b.id
  from public.bookings b
  join public.billboards bb on bb.id = b.billboard_id
  where b.status = 'payment_pending'
    and b.decision_at <= now() - interval '24 hours'
    and not exists (
      select 1 from public.notifications n
      where n.ref_id = b.id and n.type = 'payment_reminder' and n.created_at > b.decision_at
    );

  insert into public.notifications (user_id, type, message, ref_id)
  select b.renter_id, 'rental_starting_soon',
    'Your rental for "' || bb.title || '" starts tomorrow.', b.id
  from public.bookings b
  join public.billboards bb on bb.id = b.billboard_id
  where b.status = 'confirmed'
    and b.start_date = public.platform_today() + 1
    and not exists (
      select 1 from public.notifications n
      where n.ref_id = b.id and n.type = 'rental_starting_soon'
    );
end;
$$;

revoke all on function public.send_booking_reminders() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Availability (contract 4)
-- ---------------------------------------------------------------------------

create or replace function public.get_billboard_booked_ranges(p_billboard_id uuid)
returns table (start_date date, end_date date)
language sql
stable
security definer
set search_path = public
as $$
  select b.start_date, b.end_date
  from public.bookings b
  where b.billboard_id = p_billboard_id
    and b.status in ('pending_owner_review','payment_pending','confirmed','active')
    and b.end_date >= public.platform_today()
    -- Same visibility as billboards_select_public.
    and exists (
      select 1 from public.billboards bb
      where bb.id = p_billboard_id
        and (bb.status = 'active' or bb.owner_id = auth.uid() or coalesce(public.is_admin(), false))
    )
  order by b.start_date, b.end_date
$$;

revoke all on function public.get_billboard_booked_ranges(uuid) from public, anon, authenticated;
grant execute on function public.get_billboard_booked_ranges(uuid) to anon, authenticated;
