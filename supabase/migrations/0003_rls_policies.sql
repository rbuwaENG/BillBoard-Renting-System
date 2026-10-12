alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.sizes enable row level security;
alter table public.billboards enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.reviews enable row level security;
alter table public.notifications enable row level security;

create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_admin());

create policy profiles_update_own on public.profiles
  for update using (id = auth.uid() or public.is_admin());

create policy profiles_insert_self on public.profiles
  for insert with check (id = auth.uid());

create policy categories_select_public on public.categories
  for select using (true);
create policy categories_admin_write on public.categories
  for all using (public.is_admin()) with check (public.is_admin());

create policy sizes_select_public on public.sizes
  for select using (true);
create policy sizes_admin_write on public.sizes
  for all using (public.is_admin()) with check (public.is_admin());

create policy billboards_select_public on public.billboards
  for select using (status = 'active' or owner_id = auth.uid() or public.is_admin());
create policy billboards_insert_owner on public.billboards
  for insert with check (owner_id = auth.uid() and public.current_profile_role() = 'rentor');
create policy billboards_update_owner on public.billboards
  for update using (owner_id = auth.uid() or public.is_admin());
create policy billboards_delete_owner on public.billboards
  for delete using (owner_id = auth.uid() or public.is_admin());

create policy bookings_select_participants on public.bookings
  for select using (renter_id = auth.uid() or owner_id = auth.uid() or public.is_admin());

create policy payments_select_participants on public.payments
  for select using (renter_id = auth.uid() or owner_id = auth.uid() or public.is_admin());

create policy reviews_select_public on public.reviews
  for select using (true);

create policy notifications_select_own on public.notifications
  for select using (user_id = auth.uid());
create policy notifications_update_own on public.notifications
  for update using (user_id = auth.uid());
