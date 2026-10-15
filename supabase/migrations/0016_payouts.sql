create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  amount numeric not null check (amount >= 0),
  currency text not null,
  status text not null default 'approved' check (status in ('approved', 'paid', 'cancelled')),
  scheduled_release_date date not null,
  approved_by uuid not null references public.profiles(id),
  approved_at timestamptz not null default now(),
  released_at timestamptz,
  created_at timestamptz not null default now()
);
create index payouts_owner_idx on public.payouts (owner_id, status);

create table public.payout_items (
  payout_id uuid not null references public.payouts(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) unique,
  primary key (payout_id, booking_id)
);

alter table public.payouts enable row level security;
alter table public.payout_items enable row level security;

create policy payouts_select_own on public.payouts
  for select using (owner_id = auth.uid() or public.is_admin());

create policy payout_items_select_own on public.payout_items
  for select using (
    exists (
      select 1 from public.payouts p
      where p.id = payout_id and (p.owner_id = auth.uid() or public.is_admin())
    )
  );

create or replace function public.admin_create_payout(
  p_owner_id uuid,
  p_booking_ids uuid[],
  p_scheduled_release_date date
)
returns public.payouts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric;
  v_currency text;
  v_payout public.payouts;
  v_booking_id uuid;
  v_invalid_count integer;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can create a payout';
  end if;
  if p_booking_ids is null or array_length(p_booking_ids, 1) is null then
    raise exception 'Select at least one booking to pay out';
  end if;

  select count(*) into v_invalid_count
  from public.bookings b
  where b.id = any(p_booking_ids)
    and (
      b.owner_id <> p_owner_id
      or b.status not in ('confirmed', 'active', 'completed')
      or exists (select 1 from public.payout_items pi where pi.booking_id = b.id)
    );
  if v_invalid_count > 0 then
    raise exception 'One or more selected bookings are not eligible for payout';
  end if;
  if (select count(*) from public.bookings where id = any(p_booking_ids)) <> array_length(p_booking_ids, 1) then
    raise exception 'One or more selected bookings do not exist';
  end if;

  select sum(price_quoted) into v_total from public.bookings where id = any(p_booking_ids);
  select currency into v_currency from public.platform_settings;

  insert into public.payouts (owner_id, amount, currency, status, scheduled_release_date, approved_by)
  values (p_owner_id, v_total, coalesce(v_currency, 'USD'), 'approved', p_scheduled_release_date, auth.uid())
  returning * into v_payout;

  foreach v_booking_id in array p_booking_ids loop
    insert into public.payout_items (payout_id, booking_id) values (v_payout.id, v_booking_id);
  end loop;

  perform public.notify(
    p_owner_id,
    'payout_scheduled',
    'A payout of ' || v_total || ' ' || coalesce(v_currency, 'USD') || ' is scheduled for ' || p_scheduled_release_date,
    v_payout.id
  );

  return v_payout;
end;
$$;

revoke all on function public.admin_create_payout(uuid, uuid[], date) from public;
grant execute on function public.admin_create_payout(uuid, uuid[], date) to authenticated;

create or replace function public.admin_release_payout(p_payout_id uuid)
returns public.payouts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payout public.payouts;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can release a payout';
  end if;

  select * into v_payout from public.payouts where id = p_payout_id;
  if not found then
    raise exception 'Payout not found';
  end if;
  if v_payout.status <> 'approved' then
    raise exception 'Only an approved payout can be released';
  end if;

  update public.payouts
  set status = 'paid', released_at = now()
  where id = p_payout_id
  returning * into v_payout;

  perform public.notify(v_payout.owner_id, 'payout_released', 'Your payout of ' || v_payout.amount || ' ' || v_payout.currency || ' has been released.', v_payout.id);

  return v_payout;
end;
$$;

revoke all on function public.admin_release_payout(uuid) from public;
grant execute on function public.admin_release_payout(uuid) to authenticated;

create or replace function public.release_due_payouts()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payout record;
begin
  for v_payout in
    select * from public.payouts where status = 'approved' and scheduled_release_date <= current_date
  loop
    update public.payouts set status = 'paid', released_at = now() where id = v_payout.id;
    perform public.notify(v_payout.owner_id, 'payout_released', 'Your payout of ' || v_payout.amount || ' ' || v_payout.currency || ' has been released.', v_payout.id);
  end loop;
end;
$$;

revoke all on function public.release_due_payouts() from public;

create or replace function public.run_scheduled_jobs()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.advance_booking_lifecycle();
  perform public.release_due_payouts();
end;
$$;

revoke all on function public.run_scheduled_jobs() from public;

create extension if not exists pg_cron;

select cron.schedule(
  'run-scheduled-jobs',
  '*/15 * * * *',
  $$select public.run_scheduled_jobs();$$
);
