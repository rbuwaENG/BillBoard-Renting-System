alter table public.billboards
  add column sale_price_per_day numeric check (sale_price_per_day >= 0),
  add column admin_price_override_per_day numeric check (admin_price_override_per_day >= 0);

create table public.billboard_pricing_tiers (
  id uuid primary key default gen_random_uuid(),
  billboard_id uuid not null references public.billboards(id) on delete cascade,
  min_days integer not null check (min_days >= 1),
  max_days integer check (max_days is null or max_days >= min_days),
  price_per_day numeric not null check (price_per_day >= 0),
  created_at timestamptz not null default now()
);
create index billboard_pricing_tiers_billboard_idx on public.billboard_pricing_tiers (billboard_id);

alter table public.billboard_pricing_tiers enable row level security;

create policy billboard_pricing_tiers_select_public on public.billboard_pricing_tiers
  for select using (true);

create policy billboard_pricing_tiers_owner_write on public.billboard_pricing_tiers
  for all using (
    exists (
      select 1 from public.billboards b
      where b.id = billboard_id and (b.owner_id = auth.uid() or public.is_admin())
    )
  ) with check (
    exists (
      select 1 from public.billboards b
      where b.id = billboard_id and (b.owner_id = auth.uid() or public.is_admin())
    )
  );

create or replace function public.request_booking(
  p_billboard_id uuid,
  p_start_date date,
  p_end_date date,
  p_creative_url text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_billboard public.billboards;
  v_days integer;
  v_rate numeric;
  v_tier_rate numeric;
  v_price numeric;
  v_booking public.bookings;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_billboard from public.billboards where id = p_billboard_id;
  if not found then
    raise exception 'Billboard not found';
  end if;
  if v_billboard.status <> 'active' then
    raise exception 'Billboard is not available for booking';
  end if;
  if p_end_date < p_start_date then
    raise exception 'End date must be on or after start date';
  end if;

  if exists (
    select 1 from public.bookings
    where billboard_id = p_billboard_id
      and status not in ('rejected','cancelled','completed')
      and daterange(start_date, end_date, '[]') && daterange(p_start_date, p_end_date, '[]')
  ) then
    raise exception 'Selected dates overlap an existing booking';
  end if;

  v_days := (p_end_date - p_start_date) + 1;

  if v_billboard.admin_price_override_per_day is not null then
    v_rate := v_billboard.admin_price_override_per_day;
  else
    select price_per_day into v_tier_rate
    from public.billboard_pricing_tiers
    where billboard_id = p_billboard_id
      and min_days <= v_days
      and (max_days is null or v_days <= max_days)
    order by min_days desc
    limit 1;

    if v_tier_rate is not null then
      v_rate := v_tier_rate;
    elsif v_billboard.sale_price_per_day is not null and v_billboard.sale_price_per_day < v_billboard.price_per_day then
      v_rate := v_billboard.sale_price_per_day;
    else
      v_rate := v_billboard.price_per_day;
    end if;
  end if;

  v_price := v_rate * v_days;

  insert into public.bookings (billboard_id, owner_id, renter_id, start_date, end_date, creative_url, price_quoted, status)
  values (p_billboard_id, v_billboard.owner_id, auth.uid(), p_start_date, p_end_date, p_creative_url, v_price, 'pending_owner_review')
  returning * into v_booking;

  return v_booking;
end;
$$;

revoke all on function public.request_booking(uuid, date, date, text) from public;
grant execute on function public.request_booking(uuid, date, date, text) to authenticated;
