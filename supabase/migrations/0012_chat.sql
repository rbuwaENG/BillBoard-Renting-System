create table public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  billboard_id uuid not null references public.billboards(id) on delete cascade,
  renter_id uuid not null references public.profiles(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (billboard_id, renter_id)
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);
create index chat_messages_thread_idx on public.chat_messages (thread_id, created_at);

alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;

create policy chat_threads_select_participants on public.chat_threads
  for select using (renter_id = auth.uid() or owner_id = auth.uid() or public.is_admin());

create policy chat_messages_select_participants on public.chat_messages
  for select using (
    exists (
      select 1 from public.chat_threads t
      where t.id = thread_id
        and (t.renter_id = auth.uid() or t.owner_id = auth.uid() or public.is_admin())
    )
  );

create policy chat_messages_insert_participants on public.chat_messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.chat_threads t
      where t.id = thread_id
        and (t.renter_id = auth.uid() or t.owner_id = auth.uid())
    )
  );

create or replace function public.get_or_create_chat_thread(p_billboard_id uuid)
returns public.chat_threads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_thread public.chat_threads;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select owner_id into v_owner_id from public.billboards where id = p_billboard_id;
  if v_owner_id is null then
    raise exception 'Billboard not found';
  end if;
  if v_owner_id = auth.uid() then
    raise exception 'Billboard owners cannot start an inquiry thread on their own billboard';
  end if;

  insert into public.chat_threads (billboard_id, renter_id, owner_id)
  values (p_billboard_id, auth.uid(), v_owner_id)
  on conflict (billboard_id, renter_id) do nothing;

  select * into v_thread from public.chat_threads
  where billboard_id = p_billboard_id and renter_id = auth.uid();

  return v_thread;
end;
$$;

revoke all on function public.get_or_create_chat_thread(uuid) from public;
grant execute on function public.get_or_create_chat_thread(uuid) to authenticated;

alter publication supabase_realtime add table public.chat_messages;
