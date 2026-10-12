create policy profiles_select_public_billboard_owners on public.profiles
  for select using (
    exists (
      select 1 from public.billboards b
      where b.owner_id = profiles.id and b.status = 'active'
    )
  );
