alter table public.payments
  add column reference text,
  add column confirmed_by uuid references public.profiles(id),
  add column confirmed_at timestamptz;

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
  v_payment public.payments;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can confirm a payment';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then
    raise exception 'Booking not found';
  end if;
  if v_booking.status <> 'payment_pending' then
    raise exception 'Booking is not awaiting payment';
  end if;

  if p_currency is not null then
    v_currency := p_currency;
  else
    select currency into v_currency from public.platform_settings;
  end if;

  insert into public.payments (booking_id, renter_id, owner_id, amount, currency, status, reference, confirmed_by, confirmed_at)
  values (p_booking_id, v_booking.renter_id, v_booking.owner_id, p_amount, coalesce(v_currency, 'USD'), 'succeeded', p_reference, auth.uid(), now())
  returning * into v_payment;

  update public.bookings
  set status = 'confirmed', payment_id = v_payment.id
  where id = p_booking_id;

  return v_payment;
end;
$$;

revoke all on function public.admin_confirm_payment(uuid, numeric, text, text) from public;
grant execute on function public.admin_confirm_payment(uuid, numeric, text, text) to authenticated;
