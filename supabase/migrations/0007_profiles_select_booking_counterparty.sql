create policy profiles_select_booking_counterparty on public.profiles
  for select using (
    exists (
      select 1 from public.bookings b
      where (b.renter_id = profiles.id and b.owner_id = auth.uid())
         or (b.owner_id = profiles.id and b.renter_id = auth.uid())
    )
  );
