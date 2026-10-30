-- 0031 · Payment flow (shared contract 1)
--
-- Replaces the self-confirming `renter_pay_booking` (0021) with a two-step
-- flow: the renter *submits* a payment (status 'pending', booking stays
-- payment_pending) and an admin *confirms* (→ succeeded, booking confirmed) or
-- *rejects* it (→ failed, renter may resubmit). Payouts only count bookings
-- whose payment was confirmed by an admin. Adds admin_cancel_payout.

-- Suspension helpers (contract 6). Byte-identical to the block in 0029 so the
-- two migrations can be applied in either state.
create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'active')
$$;
create or replace function public.assert_active_user() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  if not public.is_active_user() then raise exception 'Account suspended' using errcode = '42501'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

drop function if exists public.renter_pay_booking(uuid);

alter table public.payments
  add column if not exists rejection_reason text;

-- Legacy data: payments created by renter_pay_booking were "confirmed" by the
-- renter themself. They are not admin-verified, so strip the confirmation —
-- they stay 'succeeded' (the booking is already confirmed) but are no longer
-- payable to the owner until an admin verifies them manually.
do $$
declare
  v_count integer;
begin
  update public.payments
     set confirmed_by = null, confirmed_at = null
   where confirmed_by is not null
     and confirmed_by = renter_id;
  get diagnostics v_count = row_count;
  if v_count > 0 then
    raise notice '0031: % self-confirmed payment(s) marked as unverified (not payable until an admin sets confirmed_by)', v_count;
  end if;

  if exists (
    select 1 from public.payments
    where status in ('pending', 'succeeded')
    group by booking_id having count(*) > 1
  ) then
    raise exception '0031: some bookings have more than one pending/succeeded payment; resolve them manually before applying this migration (select booking_id from payments where status in (''pending'',''succeeded'') group by 1 having count(*) > 1)';
  end if;
end $$;

-- At most one open (pending or succeeded) payment per booking.
create unique index if not exists payments_one_open_per_booking
  on public.payments (booking_id)
  where status in ('pending', 'succeeded');

create index if not exists payments_status_idx on public.payments (status, created_at);

-- ---------------------------------------------------------------------------
-- renter_submit_payment
-- ---------------------------------------------------------------------------

create or replace function public.renter_submit_payment(
  p_booking_id uuid,
  p_reference text default null
)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_title text;
  v_currency text;
  v_reference text;
  v_payment public.payments;
  v_admin record;
begin
  perform public.assert_active_user();

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found';
  end if;
  if v_booking.renter_id is distinct from auth.uid() then
    raise exception 'Not authorized to pay for this booking';
  end if;
  if v_booking.status <> 'payment_pending' then
    raise exception 'Booking is not awaiting payment';
  end if;
  if exists (
    select 1 from public.payments
    where booking_id = p_booking_id and status in ('pending', 'succeeded')
  ) then
    raise exception 'A payment has already been submitted for this booking';
  end if;

  v_reference := nullif(btrim(p_reference), '');
  if length(v_reference) > 200 then
    raise exception 'Payment reference is too long';
  end if;

  select currency into v_currency from public.platform_settings;

  begin
    insert into public.payments (booking_id, renter_id, owner_id, amount, currency, status, reference)
    values (
      p_booking_id,
      v_booking.renter_id,
      v_booking.owner_id,
      v_booking.price_quoted,
      coalesce(v_currency, 'USD'),
      'pending',
      v_reference
    )
    returning * into v_payment;
  exception when unique_violation then
    raise exception 'A payment has already been submitted for this booking';
  end;

  update public.bookings set payment_id = v_payment.id where id = p_booking_id;

  select title into v_title from public.billboards where id = v_booking.billboard_id;
  for v_admin in
    select id from public.profiles where role = 'admin' and status = 'active'
  loop
    perform public.notify(
      v_admin.id,
      'payment_submitted',
      'A payment of ' || v_payment.amount || ' ' || v_payment.currency || ' for "'
        || coalesce(v_title, 'a billboard') || '" is awaiting confirmation.',
      p_booking_id
    );
  end loop;

  return v_payment;
end;
$$;

revoke all on function public.renter_submit_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.renter_submit_payment(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- admin_confirm_payment (signature unchanged from 0017)
-- ---------------------------------------------------------------------------

create or replace function public.admin_confirm_payment(
  p_booking_id uuid,
  p_amount numeric,
  p_currency text default null,
  p_reference text default null
)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_currency text;
  v_reference text;
  v_title text;
  v_payment public.payments;
begin
  perform public.assert_active_user();
  if not coalesce(public.is_admin(), false) then
    raise exception 'Only an admin can confirm a payment';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found';
  end if;
  if v_booking.status <> 'payment_pending' then
    raise exception 'Booking is not awaiting payment';
  end if;
  if p_amount is null or p_amount <> v_booking.price_quoted then
    raise exception 'Amount does not match quoted price';
  end if;
  if exists (
    select 1 from public.payments
    where booking_id = p_booking_id and status = 'succeeded'
  ) then
    raise exception 'A payment has already been confirmed for this booking';
  end if;

  v_currency := nullif(btrim(p_currency), '');
  if v_currency is null then
    select currency into v_currency from public.platform_settings;
  end if;
  v_reference := nullif(btrim(p_reference), '');

  select * into v_payment
  from public.payments
  where booking_id = p_booking_id and status = 'pending'
  for update;

  if found then
    update public.payments
       set status = 'succeeded',
           amount = p_amount,
           currency = coalesce(v_currency, currency),
           reference = coalesce(v_reference, reference),
           confirmed_by = auth.uid(),
           confirmed_at = now()
     where id = v_payment.id
    returning * into v_payment;
  else
    insert into public.payments (booking_id, renter_id, owner_id, amount, currency, status, reference, confirmed_by, confirmed_at)
    values (p_booking_id, v_booking.renter_id, v_booking.owner_id, p_amount, coalesce(v_currency, 'USD'),
            'succeeded', v_reference, auth.uid(), now())
    returning * into v_payment;
  end if;

  -- The status change is logged to booking_events and the renter is notified
  -- ('payment_confirmed') by the bookings triggers (0023, 0011).
  update public.bookings
     set status = 'confirmed', payment_id = v_payment.id
   where id = p_booking_id;

  select title into v_title from public.billboards where id = v_booking.billboard_id;
  perform public.notify(
    v_booking.owner_id,
    'payment_confirmed',
    'Payment received — the booking for "' || coalesce(v_title, 'your billboard') || '" is confirmed.',
    p_booking_id
  );

  return v_payment;
end;
$$;

revoke all on function public.admin_confirm_payment(uuid, numeric, text, text) from public, anon, authenticated;
grant execute on function public.admin_confirm_payment(uuid, numeric, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- admin_reject_payment
-- ---------------------------------------------------------------------------

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

  update public.bookings
     set payment_id = null
   where id = v_booking_id and payment_id = p_payment_id;

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

-- ---------------------------------------------------------------------------
-- Payouts: eligibility = admin-confirmed succeeded payment; amount = payment
-- ---------------------------------------------------------------------------

create or replace function public.admin_create_payout(
  p_owner_id uuid,
  p_booking_ids uuid[],
  p_scheduled_release_date date
)
returns public.payouts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
  v_gross numeric;
  v_fee_percent numeric;
  v_fee numeric;
  v_net numeric;
  v_currency text;
  v_payout public.payouts;
  v_booking_id uuid;
  v_invalid_count integer;
begin
  perform public.assert_active_user();
  if not coalesce(public.is_admin(), false) then
    raise exception 'Only an admin can create a payout';
  end if;
  if p_booking_ids is null or array_length(p_booking_ids, 1) is null then
    raise exception 'Select at least one booking to pay out';
  end if;
  if p_scheduled_release_date is null then
    raise exception 'Select a release date for the payout';
  end if;

  select array_agg(distinct x) into v_ids from unnest(p_booking_ids) as x where x is not null;
  if v_ids is null then
    raise exception 'Select at least one booking to pay out';
  end if;

  -- Lock the bookings so two concurrent payouts can't both pass the checks.
  perform 1 from public.bookings where id = any(v_ids) order by id for update;

  if (select count(*) from public.bookings where id = any(v_ids)) <> coalesce(array_length(v_ids, 1), 0) then
    raise exception 'One or more selected bookings do not exist';
  end if;

  select count(*) into v_invalid_count
  from public.bookings b
  where b.id = any(v_ids)
    and (
      b.owner_id is distinct from p_owner_id
      or b.status not in ('confirmed', 'active', 'completed')
      or not exists (
        select 1 from public.payments p
        where p.booking_id = b.id
          and p.status = 'succeeded'
          and p.confirmed_by is not null
      )
      or exists (select 1 from public.payout_items pi where pi.booking_id = b.id)
    );
  if v_invalid_count > 0 then
    raise exception 'One or more selected bookings are not eligible for payout';
  end if;

  select sum(p.amount) into v_gross
  from public.payments p
  where p.booking_id = any(v_ids)
    and p.status = 'succeeded'
    and p.confirmed_by is not null;
  select currency, platform_fee_percent into v_currency, v_fee_percent from public.platform_settings;

  v_fee := round(v_gross * coalesce(v_fee_percent, 0) / 100, 2);
  v_net := v_gross - v_fee;

  insert into public.payouts (owner_id, amount, gross_amount, fee_amount, currency, status, scheduled_release_date, approved_by)
  values (p_owner_id, v_net, v_gross, v_fee, coalesce(v_currency, 'USD'), 'approved', p_scheduled_release_date, auth.uid())
  returning * into v_payout;

  foreach v_booking_id in array v_ids loop
    insert into public.payout_items (payout_id, booking_id) values (v_payout.id, v_booking_id);
  end loop;

  perform public.notify(
    p_owner_id,
    'payout_scheduled',
    'A payout of ' || v_net || ' ' || coalesce(v_currency, 'USD') || ' (after a ' || coalesce(v_fee_percent, 0) || '% service fee) is scheduled for ' || p_scheduled_release_date,
    v_payout.id
  );

  return v_payout;
end;
$$;

revoke all on function public.admin_create_payout(uuid, uuid[], date) from public, anon, authenticated;
grant execute on function public.admin_create_payout(uuid, uuid[], date) to authenticated;

create or replace function public.admin_cancel_payout(p_payout_id uuid)
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
    raise exception 'Only an admin can cancel a payout';
  end if;

  select * into v_payout from public.payouts where id = p_payout_id for update;
  if not found then
    raise exception 'Payout not found';
  end if;
  if v_payout.status <> 'approved' then
    raise exception 'Only a scheduled payout can be cancelled';
  end if;

  -- payout_items.booking_id is unique and admin_create_payout rejects bookings
  -- that still have an item, so deleting the items frees the bookings.
  delete from public.payout_items where payout_id = p_payout_id;

  update public.payouts
     set status = 'cancelled'
   where id = p_payout_id
  returning * into v_payout;

  perform public.notify(
    v_payout.owner_id,
    'payout_cancelled',
    'Your scheduled payout of ' || v_payout.amount || ' ' || v_payout.currency || ' was cancelled.',
    v_payout.id
  );

  return v_payout;
end;
$$;

revoke all on function public.admin_cancel_payout(uuid) from public, anon, authenticated;
grant execute on function public.admin_cancel_payout(uuid) to authenticated;

-- Release re-checks the status under a row lock so a payout cancelled
-- concurrently is never released (release_due_payouts: see 0032).
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
