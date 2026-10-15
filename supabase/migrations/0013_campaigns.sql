create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  renter_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  created_at timestamptz not null default now()
);

create table public.campaign_items (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  billboard_id uuid not null references public.billboards(id),
  booking_id uuid references public.bookings(id),
  status text not null default 'pending' check (status in ('pending', 'booked', 'failed')),
  failure_reason text,
  primary key (campaign_id, billboard_id)
);

alter table public.campaigns enable row level security;
alter table public.campaign_items enable row level security;

create policy campaigns_select_own on public.campaigns
  for select using (renter_id = auth.uid() or public.is_admin());

create policy campaign_items_select_own on public.campaign_items
  for select using (
    exists (
      select 1 from public.campaigns c
      where c.id = campaign_id and (c.renter_id = auth.uid() or public.is_admin())
    )
  );

create or replace function public.create_campaign(
  p_name text,
  p_start_date date,
  p_end_date date,
  p_billboard_ids uuid[]
)
returns public.campaigns
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign public.campaigns;
  v_billboard_id uuid;
  v_booking public.bookings;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_billboard_ids is null or array_length(p_billboard_ids, 1) is null then
    raise exception 'Select at least one billboard for the campaign';
  end if;

  insert into public.campaigns (renter_id, name, start_date, end_date)
  values (auth.uid(), p_name, p_start_date, p_end_date)
  returning * into v_campaign;

  foreach v_billboard_id in array p_billboard_ids loop
    begin
      select * into v_booking from public.request_booking(v_billboard_id, p_start_date, p_end_date, null);
      insert into public.campaign_items (campaign_id, billboard_id, booking_id, status)
      values (v_campaign.id, v_billboard_id, v_booking.id, 'booked');
    exception when others then
      insert into public.campaign_items (campaign_id, billboard_id, status, failure_reason)
      values (v_campaign.id, v_billboard_id, 'failed', sqlerrm);
    end;
  end loop;

  return v_campaign;
end;
$$;

revoke all on function public.create_campaign(text, date, date, uuid[]) from public;
grant execute on function public.create_campaign(text, date, date, uuid[]) to authenticated;
