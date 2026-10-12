insert into storage.buckets (id, name, public) values
  ('billboard-images', 'billboard-images', true),
  ('booking-creatives', 'booking-creatives', false);

create policy "billboard images public read" on storage.objects
  for select using (bucket_id = 'billboard-images');

create policy "billboard images owner insert" on storage.objects
  for insert with check (
    bucket_id = 'billboard-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "billboard images owner update" on storage.objects
  for update using (
    bucket_id = 'billboard-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "billboard images owner delete" on storage.objects
  for delete using (
    bucket_id = 'billboard-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "booking creatives participants read" on storage.objects
  for select using (
    bucket_id = 'booking-creatives'
    and exists (
      select 1 from public.bookings b
      where b.id::text = (storage.foldername(name))[1]
        and (b.renter_id = auth.uid() or b.owner_id = auth.uid() or public.is_admin())
    )
  );

create policy "booking creatives renter insert" on storage.objects
  for insert with check (
    bucket_id = 'booking-creatives'
    and exists (
      select 1 from public.bookings b
      where b.id::text = (storage.foldername(name))[1]
        and b.renter_id = auth.uid()
    )
  );
