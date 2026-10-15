create or replace function public.advance_booking_lifecycle()
returns void
language sql
security definer
set search_path = public
as $$
  update public.bookings set status = 'active', updated_at = now()
    where status = 'confirmed' and start_date <= current_date;

  update public.bookings set status = 'completed', updated_at = now()
    where status = 'active' and end_date < current_date;
$$;

revoke all on function public.advance_booking_lifecycle() from public;
grant execute on function public.advance_booking_lifecycle() to authenticated;
