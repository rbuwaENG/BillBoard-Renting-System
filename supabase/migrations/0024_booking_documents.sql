create table public.booking_documents (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  storage_path text not null,
  file_name text not null,
  file_size bigint not null,
  kind text not null default 'other' check (kind in ('creative','brief','logo','other')),
  created_at timestamptz not null default now()
);

create index booking_documents_booking_id_idx on public.booking_documents(booking_id);

alter table public.booking_documents enable row level security;

create policy booking_documents_select_participants on public.booking_documents
  for select using (exists (
    select 1 from public.bookings b
    where b.id = booking_id and (b.renter_id = auth.uid() or b.owner_id = auth.uid() or public.is_admin())
  ));

-- No insert/delete policy for clients — writes go through the security-definer
-- RPCs below so booking status and ownership are enforced server-side.

-- Storage insert policy for this bucket already exists (0005); add delete so
-- a renter can remove/replace a document they uploaded.
create policy "booking creatives renter delete" on storage.objects
  for delete using (
    bucket_id = 'booking-creatives'
    and exists (
      select 1 from public.bookings b
      where b.id::text = (storage.foldername(name))[1]
        and b.renter_id = auth.uid()
    )
  );

create or replace function public.add_booking_document(
  p_booking_id uuid,
  p_storage_path text,
  p_file_name text,
  p_file_size bigint,
  p_kind text default 'other'
)
returns public.booking_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_doc public.booking_documents;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then
    raise exception 'Booking not found';
  end if;
  if v_booking.renter_id <> auth.uid() then
    raise exception 'Not authorized';
  end if;
  if v_booking.status in ('rejected','cancelled','completed') then
    raise exception 'This booking can no longer accept documents';
  end if;

  insert into public.booking_documents (booking_id, uploaded_by, storage_path, file_name, file_size, kind)
  values (p_booking_id, auth.uid(), p_storage_path, p_file_name, p_file_size, p_kind)
  returning * into v_doc;

  insert into public.booking_events (booking_id, event_type, actor_id, message)
  values (p_booking_id, 'document_uploaded', auth.uid(), p_file_name);

  return v_doc;
end;
$$;

revoke all on function public.add_booking_document(uuid, text, text, bigint, text) from public;
grant execute on function public.add_booking_document(uuid, text, text, bigint, text) to authenticated;

create or replace function public.remove_booking_document(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc public.booking_documents;
begin
  select * into v_doc from public.booking_documents where id = p_document_id;
  if not found then
    raise exception 'Document not found';
  end if;
  if v_doc.uploaded_by <> auth.uid() then
    raise exception 'Not authorized';
  end if;

  delete from public.booking_documents where id = p_document_id;
end;
$$;

revoke all on function public.remove_booking_document(uuid) from public;
grant execute on function public.remove_booking_document(uuid) to authenticated;

create or replace function public.request_booking_documents(p_booking_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then
    raise exception 'Booking not found';
  end if;
  if v_booking.owner_id <> auth.uid() then
    raise exception 'Not authorized';
  end if;
  if v_booking.status not in ('pending_owner_review','payment_pending') then
    raise exception 'Documents can only be requested before the booking is confirmed';
  end if;

  insert into public.booking_events (booking_id, event_type, actor_id, message)
  values (p_booking_id, 'document_requested', auth.uid(), p_note);

  perform public.notify(
    v_booking.renter_id,
    'documents_requested',
    coalesce('The owner requested documents: ' || p_note, 'The owner requested additional documents.'),
    p_booking_id
  );
end;
$$;

revoke all on function public.request_booking_documents(uuid, text) from public;
grant execute on function public.request_booking_documents(uuid, text) to authenticated;
