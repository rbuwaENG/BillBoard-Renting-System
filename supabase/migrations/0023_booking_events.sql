create table public.booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  event_type text not null check (event_type in ('status_change','document_requested','document_uploaded')),
  actor_id uuid references public.profiles(id),
  from_status text,
  to_status text,
  message text,
  created_at timestamptz not null default now()
);

create index booking_events_booking_id_idx on public.booking_events(booking_id, created_at);

alter table public.booking_events enable row level security;

create policy booking_events_select_participants on public.booking_events
  for select using (exists (
    select 1 from public.bookings b
    where b.id = booking_id and (b.renter_id = auth.uid() or b.owner_id = auth.uid() or public.is_admin())
  ));

-- No insert policy for clients — rows are only ever written by the
-- security-definer trigger/functions below, never directly by a client.

create or replace function public.trg_booking_log_status_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.booking_events (booking_id, event_type, actor_id, to_status)
    values (new.id, 'status_change', new.renter_id, new.status);
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.booking_events (booking_id, event_type, actor_id, from_status, to_status)
    values (new.id, 'status_change', auth.uid(), old.status, new.status);
  end if;

  return new;
end;
$$;

create trigger bookings_log_status_event
  after insert or update on public.bookings
  for each row execute function public.trg_booking_log_status_event();

alter publication supabase_realtime add table public.booking_events;
