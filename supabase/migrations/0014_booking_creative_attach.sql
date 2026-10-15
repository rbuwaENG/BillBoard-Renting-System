create or replace function public.attach_booking_creative(
  p_booking_id uuid,
  p_creative_path text
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then
    raise exception 'Booking not found';
  end if;
  if v_booking.renter_id <> auth.uid() then
    raise exception 'Not authorized to update this booking';
  end if;
  if v_booking.status <> 'pending_owner_review' then
    raise exception 'Creative can only be attached while the booking is pending review';
  end if;

  update public.bookings
  set creative_url = p_creative_path
  where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

revoke all on function public.attach_booking_creative(uuid, text) from public;
grant execute on function public.attach_booking_creative(uuid, text) to authenticated;
