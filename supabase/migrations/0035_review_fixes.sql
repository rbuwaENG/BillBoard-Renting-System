-- 0035 · Fixes from the independent review of 0029–0034
--
--  1. Unverified legacy payments: approved payouts that contain a booking
--     without an admin-verified payment (0031 stripped renter self-confirmed
--     ones) are cancelled; both release paths re-check every item;
--     admin_verify_payment() lets an admin verify such a payment.
--  2. Calendar lock: request_booking / create_campaign cap the duration
--     (365 days), how far ahead a booking may start (365 days) and the number
--     of open requests per renter (25 pending_owner_review).
--  3. A rejected payment submission restarts the 72h payment window
--     (bookings.payment_rejected_at).
--  4. cancel_booking refuses while a submitted payment awaits confirmation.
--  5. Admin moderation can't be undone by the owner
--     (billboards.status_locked_by_admin + delete guard).
--  6. Suspension: suspended users can't edit their profile; billboards of
--     suspended owners are neither listed publicly nor bookable.
--  7. Renter creative uploads only while the booking is still open.
--  8. respond_to_booking uses platform_today().
--  9. Explicit MIME allow-lists for every bucket (no SVG).
--
-- Every function below is redefined from its LATEST definition (noted per
-- function). 0029 revoked default EXECUTE, so each one restates its grants.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Is this user's profile active? Used by RLS policies (evaluated with the
-- caller's privileges, so anon needs EXECUTE) and by request_booking.
-- SECURITY DEFINER so policies on billboards don't recurse through the
-- profiles policies (0006 reads billboards).
create or replace function public.is_profile_active(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = p_user_id and status = 'active')
$$;

revoke all on function public.is_profile_active(uuid) from public, anon, authenticated;
grant execute on function public.is_profile_active(uuid) to anon, authenticated;

-- Internal: does every item of the payout have an admin-verified payment?
-- (A payout with no items at all is not releasable either.)
create or replace function public.payout_is_releasable(p_payout_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.payout_items where payout_id = p_payout_id)
     and not exists (
       select 1
         from public.payout_items pi
        where pi.payout_id = p_payout_id
          and not exists (
            select 1 from public.payments p
             where p.booking_id = pi.booking_id
               and p.status = 'succeeded'
               and p.confirmed_by is not null
          )
     )
$$;

revoke all on function public.payout_is_releasable(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. Legacy payouts on unverified payments
-- ---------------------------------------------------------------------------

-- 1a. Cancel approved payouts that would pay out an unverified booking. The
-- items are deleted so the bookings can be paid out again once verified.
do $$
declare
  v_payout public.payouts;
  v_count integer := 0;
begin
  perform set_config('app.system_actor', 'on', true);
  for v_payout in
    select * from public.payouts po
     where po.status = 'approved'
       and not public.payout_is_releasable(po.id)
     order by po.id
     for update
  loop
    delete from public.payout_items where payout_id = v_payout.id;
    update public.payouts set status = 'cancelled' where id = v_payout.id;
    perform public.notify(
      v_payout.owner_id,
      'payout_cancelled',
      'Your scheduled payout of ' || v_payout.amount || ' ' || v_payout.currency
        || ' was cancelled: it included payments that have not been verified yet. It will be rescheduled once they are.',
      v_payout.id
    );
    v_count := v_count + 1;
  end loop;
  perform set_config('app.system_actor', '', true);
  if v_count > 0 then
    raise notice '0035: cancelled % approved payout(s) that included unverified payments', v_count;
  end if;
end $$;

-- 1b. admin_release_payout (latest: 0031) — refuses unverified items.
create or replace function public.admin_release_payout(p_payout_id uuid)
returns public.payouts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payout public.payouts;
begin
  perform public.assert_active_user();
  if not coalesce(public.is_admin(), false) then
    raise exception 'Only an admin can release a payout';
  end if;

  select * into v_payout from public.payouts where id = p_payout_id for update;
  if not found then
    raise exception 'Payout not found';
  end if;
  if v_payout.status <> 'approved' then
    raise exception 'Only an approved payout can be released';
  end if;
  if not public.payout_is_releasable(p_payout_id) then
    raise exception 'This payout includes bookings without a verified payment';
  end if;

  update public.payouts
  set status = 'paid', released_at = now()
  where id = p_payout_id
  returning * into v_payout;

  perform public.notify(v_payout.owner_id, 'payout_released', 'Your payout of ' || v_payout.amount || ' ' || v_payout.currency || ' has been released.', v_payout.id);

  return v_payout;
end;
$$;

revoke all on function public.admin_release_payout(uuid) from public, anon, authenticated;
grant execute on function public.admin_release_payout(uuid) to authenticated;

-- 1c. release_due_payouts (latest: 0032) — skips unverified payouts (they
-- stay 'approved' for an admin to verify or cancel). Internal, cron only.
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
     where status = 'approved'
       and scheduled_release_date <= public.platform_today()
       and public.payout_is_releasable(id)
    returning *
  loop
    perform public.notify(v_payout.owner_id, 'payout_released', 'Your payout of ' || v_payout.amount || ' ' || v_payout.currency || ' has been released.', v_payout.id);
  end loop;
end;
$$;

revoke all on function public.release_due_payouts() from public, anon, authenticated;

-- 1d. admin_verify_payment: an admin vouches for a succeeded payment that
-- has no confirmed_by (legacy renter self-confirmation, see 0031).
create or replace function public.admin_verify_payment(p_payment_id uuid)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
begin
  perform public.assert_active_user();
  if not coalesce(public.is_admin(), false) then
    raise exception 'Only an admin can verify a payment' using errcode = '42501';
  end if;

  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'Payment not found';
  end if;
  if v_payment.status <> 'succeeded' or v_payment.confirmed_by is not null then
    raise exception 'Only an unverified succeeded payment can be verified';
  end if;

  update public.payments
     set confirmed_by = auth.uid(), confirmed_at = now()
   where id = p_payment_id
  returning * into v_payment;

  return v_payment;
end;
$$;

revoke all on function public.admin_verify_payment(uuid) from public, anon, authenticated;
grant execute on function public.admin_verify_payment(uuid) to authenticated;

-- 1e. Audit: 0034 only audits payments.status. A verification changes only
-- confirmed_by, so log confirmed_by changes that happen without a status
-- change (a confirmation already logs its status change).
create trigger payments_admin_audit_verification
  after update of confirmed_by on public.payments
  for each row
  when (old.status is not distinct from new.status)
  execute function public.trg_admin_audit('payment', 'confirmed_by');

-- ---------------------------------------------------------------------------
-- 3. Payment rejection restarts the payment window
-- ---------------------------------------------------------------------------

alter table public.bookings
  add column if not exists payment_rejected_at timestamptz;

-- admin_reject_payment (latest: 0031) — also stamps payment_rejected_at.
create or replace function public.admin_reject_payment(
  p_payment_id uuid,
  p_reason text
)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking_id uuid;
  v_reason text;
  v_payment public.payments;
begin
  perform public.assert_active_user();
  if not coalesce(public.is_admin(), false) then
    raise exception 'Only an admin can reject a payment';
  end if;

  select booking_id into v_booking_id from public.payments where id = p_payment_id;
  if not found then
    raise exception 'Payment not found';
  end if;

  -- Same lock order as admin_confirm_payment / renter_submit_payment:
  -- booking first, then payment.
  perform 1 from public.bookings where id = v_booking_id for update;
  select * into v_payment from public.payments where id = p_payment_id for update;
  if v_payment.status <> 'pending' then
    raise exception 'Only a pending payment can be rejected';
  end if;

  v_reason := nullif(btrim(p_reason), '');

  update public.payments
     set status = 'failed', rejection_reason = v_reason
   where id = p_payment_id
  returning * into v_payment;

  -- The renter gets a fresh 72h window to resubmit (advance_booking_lifecycle).
  update public.bookings
     set payment_id = case when payment_id = p_payment_id then null else payment_id end,
         payment_rejected_at = now()
   where id = v_booking_id;

  perform public.notify(
    v_payment.renter_id,
    'payment_rejected',
    coalesce(
      'Your payment submission could not be confirmed: ' || v_reason || '. Please check and submit it again.',
      'Your payment submission could not be confirmed. Please check and submit it again.'
    ),
    v_booking_id
  );

  return v_payment;
end;
$$;

revoke all on function public.admin_reject_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_reject_payment(uuid, text) to authenticated;

-- advance_booking_lifecycle (latest: 0032) — the unpaid window runs from the
-- later of the approval and the last payment rejection.
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
  -- alive until an admin confirms or rejects it; a rejection restarts the
  -- 72h window (greatest() ignores a null payment_rejected_at). payment_id is
  -- re-checked on the locked row, so a submission racing this update is
  -- never expired.
  update public.bookings b set status = 'expired'
   where b.status = 'payment_pending'
     and greatest(coalesce(b.decision_at, b.created_at), b.payment_rejected_at) <= now() - interval '72 hours'
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

-- ---------------------------------------------------------------------------
-- 2 + 6. request_booking (latest: 0032): bounds, open-request cap, suspended
-- owners. Pricing logic unchanged.
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
  v_open integer;
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
  if v_billboard.status <> 'active' or not public.is_profile_active(v_billboard.owner_id) then
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
  if p_start_date > public.platform_today() + 365 then
    raise exception 'Bookings can start at most 365 days ahead';
  end if;
  if (p_end_date - p_start_date) + 1 > 365 then
    raise exception 'Bookings can be at most 365 days long';
  end if;

  -- Open-request cap. The renter's profile row is locked so concurrent
  -- requests from the same renter are counted one after another.
  perform 1 from public.profiles where id = auth.uid() for update;
  select count(*) into v_open
    from public.bookings
   where renter_id = auth.uid() and status = 'pending_owner_review';
  if v_open >= 25 then
    raise exception 'You have too many pending requests; wait for owners to respond';
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

-- create_campaign (latest: 0032). The date bounds apply to the whole
-- campaign, so they are checked up front; the open-request cap is checked
-- per item by request_booking (items past the cap fail with its message).
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
  if p_start_date > public.platform_today() + 365 then
    raise exception 'Bookings can start at most 365 days ahead';
  end if;
  if (p_end_date - p_start_date) + 1 > 365 then
    raise exception 'Bookings can be at most 365 days long';
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
-- 4. cancel_booking (latest: 0029) — not while a submission awaits review
-- ---------------------------------------------------------------------------

create or replace function public.cancel_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
begin
  perform public.assert_active_user();

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found';
  end if;
  if v_booking.renter_id is distinct from auth.uid() then
    raise exception 'Not authorized to cancel this booking' using errcode = '42501';
  end if;
  if v_booking.status not in ('pending_owner_review','payment_pending') then
    raise exception 'This booking can no longer be cancelled';
  end if;
  -- The booking row lock above serialises with renter_submit_payment /
  -- admin_confirm_payment, which lock the booking first too.
  if exists (
    select 1 from public.payments
     where booking_id = p_booking_id and status = 'pending'
  ) then
    raise exception 'A payment is awaiting confirmation; contact support to cancel';
  end if;

  update public.bookings
  set status = 'cancelled'
  where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

revoke all on function public.cancel_booking(uuid) from public, anon, authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. respond_to_booking (latest: 0029) — platform_today() instead of
-- current_date.
-- ---------------------------------------------------------------------------

create or replace function public.respond_to_booking(
  p_booking_id uuid,
  p_approve boolean,
  p_reason text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
begin
  perform public.assert_active_user();

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found';
  end if;
  if v_booking.owner_id is distinct from auth.uid() then
    raise exception 'Not authorized to respond to this booking' using errcode = '42501';
  end if;
  if v_booking.status <> 'pending_owner_review' then
    raise exception 'Booking is not pending review';
  end if;
  -- Approving a booking whose rental window has already begun would leave the
  -- renter paying for days that are gone. Rejecting stays allowed so the owner
  -- can still clear a stale request (and free its dates).
  if p_approve and public.platform_today() >= v_booking.start_date then
    raise exception 'This booking has already started';
  end if;

  update public.bookings
  set status = case when p_approve then 'payment_pending' else 'rejected' end,
      rejection_reason = case when p_approve then null else p_reason end,
      decision_at = now()
  where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

revoke all on function public.respond_to_booking(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.respond_to_booking(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Admin moderation lock
-- ---------------------------------------------------------------------------

alter table public.billboards
  add column if not exists status_locked_by_admin boolean not null default false;

-- Backfill: flagged listings, and inactive/archived listings whose latest
-- audited status change (0034) was made by an admin.
update public.billboards b
   set status_locked_by_admin = true
 where b.status = 'flagged'
    or (
      b.status in ('inactive', 'archived')
      and exists (
        select 1
          from (
            select distinct on (l.entity_id) l.entity_id, l.actor_id, l.after
              from public.admin_audit_log l
             where l.entity = 'billboard' and l.after ? 'status'
             order by l.entity_id, l.created_at desc, l.id desc
          ) last
          join public.profiles p on p.id = last.actor_id and p.role = 'admin'
         where last.entity_id = b.id
           and last.after ->> 'status' = b.status
      )
    );

-- protect_billboard_fields (latest: 0029). New: status_locked_by_admin is
-- admin-only, and while it is set only an admin can change the status. When
-- an admin changes the status without touching the lock (e.g. the direct
-- UPDATE fallback in the admin UI), the lock follows the new status.
create or replace function public.protect_billboard_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(public.is_admin(), false) then
    if tg_op = 'UPDATE'
       and new.status is distinct from old.status
       and new.status_locked_by_admin is not distinct from old.status_locked_by_admin then
      new.status_locked_by_admin := new.status in ('inactive', 'archived', 'flagged');
    end if;
    return new;
  end if;
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.admin_price_override_per_day is not null then
      raise exception 'Only an admin can set a price override' using errcode = '42501';
    end if;
    if new.rating_avg <> 0 or new.rating_count <> 0 then
      raise exception 'Ratings are calculated from reviews' using errcode = '42501';
    end if;
    if new.status = 'flagged' then
      raise exception 'Only an admin can flag a billboard' using errcode = '42501';
    end if;
    if new.status_locked_by_admin then
      raise exception 'Only an admin can lock a billboard''s status' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.owner_id is distinct from old.owner_id then
    raise exception 'Only an admin can change a billboard''s owner' using errcode = '42501';
  end if;
  if new.admin_price_override_per_day is distinct from old.admin_price_override_per_day then
    raise exception 'Only an admin can set a price override' using errcode = '42501';
  end if;
  if new.rating_avg is distinct from old.rating_avg or new.rating_count is distinct from old.rating_count then
    raise exception 'Ratings are calculated from reviews' using errcode = '42501';
  end if;
  if new.status_locked_by_admin is distinct from old.status_locked_by_admin then
    raise exception 'Only an admin can lock a billboard''s status' using errcode = '42501';
  end if;
  if new.status is distinct from old.status then
    if old.status = 'flagged' then
      raise exception 'This billboard was flagged by an admin and can only be reinstated by an admin' using errcode = '42501';
    end if;
    if new.status = 'flagged' then
      raise exception 'Only an admin can flag a billboard' using errcode = '42501';
    end if;
    if old.status_locked_by_admin then
      raise exception 'This billboard''s status was set by an admin and can only be changed by an admin' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.protect_billboard_fields() from public, anon, authenticated;

-- Owners archive instead of deleting, and can never delete a listing an admin
-- moderated. SECURITY INVOKER like protect_billboard_fields (current_user is
-- the role doing the delete).
create or replace function public.protect_billboard_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(public.is_admin(), false) or current_user not in ('anon', 'authenticated') then
    return old;
  end if;
  if old.status = 'flagged' or old.status_locked_by_admin then
    raise exception 'This billboard was moderated by an admin and cannot be deleted' using errcode = '42501';
  end if;
  return old;
end;
$$;

revoke all on function public.protect_billboard_delete() from public, anon, authenticated;

drop trigger if exists billboards_protect_delete on public.billboards;
create trigger billboards_protect_delete
  before delete on public.billboards
  for each row execute function public.protect_billboard_delete();

-- admin_set_billboard_status (latest: 0029) — sets the lock explicitly.
create or replace function public.admin_set_billboard_status(
  p_billboard_id uuid,
  p_status text,
  p_reason text default null
)
returns public.billboards
language plpgsql
security definer
set search_path = public
as $$
declare
  v_billboard public.billboards;
  v_reason text := nullif(btrim(p_reason), '');
begin
  perform public.assert_active_user();
  if not public.is_admin() then
    raise exception 'Only an admin can moderate billboards' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('active','inactive','flagged','archived') then
    raise exception 'Invalid billboard status: %', coalesce(p_status, 'null');
  end if;

  update public.billboards
  set status = p_status,
      status_locked_by_admin = (p_status <> 'active')
  where id = p_billboard_id
  returning * into v_billboard;
  if not found then
    raise exception 'Billboard not found';
  end if;

  perform public.notify(
    v_billboard.owner_id,
    'billboard_moderated',
    'Your billboard "' || v_billboard.title || '" was '
      || case p_status
           when 'flagged' then 'flagged by an admin'
           when 'active' then 'reinstated by an admin'
           when 'inactive' then 'deactivated by an admin'
           else 'archived by an admin'
         end
      || coalesce(': ' || v_reason, '.'),
    v_billboard.id
  );

  return v_billboard;
end;
$$;

revoke all on function public.admin_set_billboard_status(uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_set_billboard_status(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Suspension gaps
-- ---------------------------------------------------------------------------

-- Latest: 0003. Suspended users can't edit their own profile; admins still can.
drop policy profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update
  using ((id = auth.uid() and public.is_active_user()) or public.is_admin())
  with check ((id = auth.uid() and public.is_active_user()) or public.is_admin());

-- Latest: 0003. A suspended owner's listings drop out of public browsing;
-- the owner and admins still see them.
drop policy billboards_select_public on public.billboards;
create policy billboards_select_public on public.billboards
  for select using (
    (status = 'active' and public.is_profile_active(owner_id))
    or owner_id = auth.uid()
    or public.is_admin()
  );

-- Latest: 0004 (SECURITY INVOKER, so billboards RLS applies as well).
create or replace function public.billboards_near(
  p_lat double precision,
  p_lng double precision,
  p_radius_km double precision
)
returns setof public.billboards
language sql
stable
as $$
  select *
  from public.billboards
  where status = 'active'
    and (public.is_profile_active(owner_id) or owner_id = auth.uid() or coalesce(public.is_admin(), false))
    and st_dwithin(geom, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_radius_km * 1000)
$$;

revoke all on function public.billboards_near(double precision, double precision, double precision) from public, anon, authenticated;
grant execute on function public.billboards_near(double precision, double precision, double precision) to anon, authenticated;

-- Latest: 0032. Same visibility as billboards_select_public.
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
    and exists (
      select 1 from public.billboards bb
      where bb.id = p_billboard_id
        and ((bb.status = 'active' and public.is_profile_active(bb.owner_id))
             or bb.owner_id = auth.uid()
             or coalesce(public.is_admin(), false))
    )
  order by b.start_date, b.end_date
$$;

revoke all on function public.get_billboard_booked_ranges(uuid) from public, anon, authenticated;
grant execute on function public.get_billboard_booked_ranges(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Renter creative uploads only while the booking is open (latest: 0029)
-- ---------------------------------------------------------------------------

drop policy "booking creatives renter insert" on storage.objects;
create policy "booking creatives renter insert" on storage.objects
  for insert with check (
    bucket_id = 'booking-creatives'
    and public.is_active_user()
    and exists (
      select 1 from public.bookings b
      where b.id::text = (storage.foldername(name))[1]
        and b.renter_id = auth.uid()
        and b.status not in ('completed', 'cancelled', 'expired', 'rejected')
    )
  );

-- ---------------------------------------------------------------------------
-- 9. Explicit MIME allow-lists (latest: 0029). No wildcards, so no SVG
-- (scriptable when served from a public bucket).
-- ---------------------------------------------------------------------------

update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
 where id in ('billboard-images', 'site-assets');

update storage.buckets
   set allowed_mime_types = array[
     'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
     'video/mp4', 'video/webm', 'video/quicktime',
     'application/pdf'
   ]
 where id in ('booking-creatives', 'chat-attachments');
