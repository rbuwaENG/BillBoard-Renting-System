create table public.platform_settings (
  id boolean primary key default true check (id),
  currency text not null default 'LKR',
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (id, currency) values (true, 'LKR');

alter table public.platform_settings enable row level security;

create policy platform_settings_select_public on public.platform_settings
  for select using (true);

create policy platform_settings_update_admin on public.platform_settings
  for update using (public.is_admin()) with check (public.is_admin());
