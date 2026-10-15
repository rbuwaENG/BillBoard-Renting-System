create or replace function public.renter_pay_booking(p_booking_id uuid)
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
  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then
    raise exception 'Booking not found';
  end if;
  if v_booking.renter_id <> auth.uid() then
    raise exception 'Not authorized to pay for this booking';
  end if;
  if v_booking.status <> 'payment_pending' then
    raise exception 'Booking is not awaiting payment';
  end if;

  select currency into v_currency from public.platform_settings;

  insert into public.payments (booking_id, renter_id, owner_id, amount, currency, status, reference, confirmed_by, confirmed_at)
  values (
    p_booking_id,
    v_booking.renter_id,
    v_booking.owner_id,
    v_booking.price_quoted,
    coalesce(v_currency, 'USD'),
    'succeeded',
    'Self-service payment (no live gateway configured yet)',
    auth.uid(),
    now()
  )
  returning * into v_payment;

  update public.bookings
  set status = 'confirmed', payment_id = v_payment.id
  where id = p_booking_id;

  return v_payment;
end;
$$;

revoke all on function public.renter_pay_booking(uuid) from public;
grant execute on function public.renter_pay_booking(uuid) to authenticated;
