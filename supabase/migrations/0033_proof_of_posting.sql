-- 0033 · Proof of posting (shared contract 7)
--
-- Once a booking is confirmed (or running), the billboard owner uploads photos
-- of the installed creative. They are stored as booking_documents with kind
-- 'proof_of_posting', the renter is notified, and a 'proof_posted' booking
-- event drives the "Posted" step of the booking timeline on both sides.
--
-- Design choices:
--  * A dedicated RPC, add_proof_of_posting(), instead of an owner branch in
--    add_booking_document(): the renter RPC keeps its exact signature and
--    behaviour, except that it now refuses kind 'proof_of_posting' (only the
--    owner may post proof).
--  * Storage path convention: `<booking_id>/proof/<uuid>-<file name>` in the
--    existing private `booking-creatives` bucket. The owner may only write
--    into that `proof/` sub-folder, and only while the booking is confirmed or
--    active. Reads are covered by "booking creatives participants read"
--    (0005: renter, owner, admin).
--  * Proof photos are part of the booking record: remove_booking_document()
--    (0029) already refuses removals once the booking is confirmed, and there
--    is no owner delete policy on storage.
--  * Images only (by the client-reported MIME type, the bucket enforces its
--    own list), at most 10 per booking (counted under a booking row lock).
--  * One renter notification per batch: a new one is only sent when the renter
--    has no unread proof_of_posting notification for this booking already.

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

alter table public.booking_documents drop constraint if exists booking_documents_kind_check;
alter table public.booking_documents add constraint booking_documents_kind_check
  check (kind in ('creative','brief','logo','other','proof_of_posting'));

alter table public.booking_events drop constraint if exists booking_events_event_type_check;
alter table public.booking_events add constraint booking_events_event_type_check
  check (event_type in ('status_change','document_requested','document_uploaded','proof_posted'));

create index if not exists booking_documents_booking_kind_idx
  on public.booking_documents (booking_id, kind);

-- ---------------------------------------------------------------------------
-- add_booking_document (latest: 0029) — renter only, same signature. New:
-- a renter can no longer file a document as proof of posting, the storage
-- path must be inside `<booking_id>/` and the file size must be > 0.
-- ---------------------------------------------------------------------------

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
  perform public.assert_active_user();

  if p_kind is not distinct from 'proof_of_posting' then
    raise exception 'Only the billboard owner can add proof of posting' using errcode = '42501';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then
    raise exception 'Booking not found';
  end if;
  if v_booking.renter_id is distinct from auth.uid() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if v_booking.status in ('rejected','cancelled','completed') then
    raise exception 'This booking can no longer accept documents';
  end if;
  -- The file must live in this booking's folder (the storage policies key
  -- access off the first path segment) and be non-empty.
  if p_storage_path is null
     or left(p_storage_path, length(p_booking_id::text) + 1) <> p_booking_id::text || '/'
     or length(p_storage_path) <= length(p_booking_id::text) + 1
     or position('..' in p_storage_path) > 0 then
    raise exception 'Invalid storage path for this booking';
  end if;
  if p_file_size is null or p_file_size <= 0 then
    raise exception 'File size must be greater than zero';
  end if;

  insert into public.booking_documents (booking_id, uploaded_by, storage_path, file_name, file_size, kind)
  values (p_booking_id, auth.uid(), p_storage_path, p_file_name, p_file_size, p_kind)
  returning * into v_doc;

  insert into public.booking_events (booking_id, event_type, actor_id, message)
  values (p_booking_id, 'document_uploaded', auth.uid(), p_file_name);

  return v_doc;
end;
$$;

revoke all on function public.add_booking_document(uuid, text, text, bigint, text) from public, anon, authenticated;
grant execute on function public.add_booking_document(uuid, text, text, bigint, text) to authenticated;

-- ---------------------------------------------------------------------------
-- add_proof_of_posting — owner only, booking confirmed/active, images only,
-- max 10 per booking.
-- ---------------------------------------------------------------------------

create or replace function public.add_proof_of_posting(
  p_booking_id uuid,
  p_path text,
  p_name text,
  p_size bigint,
  p_mime text
)
returns public.booking_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_doc public.booking_documents;
  v_name text := nullif(btrim(p_name), '');
  v_count integer;
  v_title text;
begin
  perform public.assert_active_user();

  -- Lock the booking so concurrent uploads can't overshoot the cap.
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found';
  end if;
  if v_booking.owner_id is distinct from auth.uid() then
    raise exception 'Only the billboard owner can add proof of posting' using errcode = '42501';
  end if;
  if v_booking.status not in ('confirmed','active') then
    raise exception 'Proof of posting can only be added while the booking is confirmed or active';
  end if;

  if p_path is null or left(p_path, length(p_booking_id::text || '/proof/')) <> p_booking_id::text || '/proof/'
     or length(p_path) <= length(p_booking_id::text || '/proof/')
     or position('..' in p_path) > 0 then
    raise exception 'Invalid storage path for proof of posting';
  end if;
  if v_name is null or length(v_name) > 255 then
    raise exception 'Invalid file name';
  end if;
  if p_size is null or p_size <= 0 or p_size > 10485760 then
    raise exception 'Proof photos must be between 1 byte and 10 MB';
  end if;
  if p_mime is null or lower(p_mime) not like 'image/%' then
    raise exception 'Proof of posting must be an image';
  end if;

  select count(*) into v_count
    from public.booking_documents
   where booking_id = p_booking_id and kind = 'proof_of_posting';
  if v_count >= 10 then
    raise exception 'A booking can have at most 10 proof-of-posting photos';
  end if;

  insert into public.booking_documents (booking_id, uploaded_by, storage_path, file_name, file_size, kind)
  values (p_booking_id, auth.uid(), p_path, v_name, p_size, 'proof_of_posting')
  returning * into v_doc;

  insert into public.booking_events (booking_id, event_type, actor_id, message)
  values (p_booking_id, 'proof_posted', auth.uid(), v_name);

  if not exists (
    select 1 from public.notifications
     where user_id = v_booking.renter_id
       and type = 'proof_of_posting'
       and ref_id = p_booking_id
       and not read
  ) then
    select title into v_title from public.billboards where id = v_booking.billboard_id;
    perform public.notify(
      v_booking.renter_id,
      'proof_of_posting',
      'Your ad is up! The owner shared proof of posting for "' || coalesce(v_title, 'your billboard') || '".',
      p_booking_id
    );
  end if;

  return v_doc;
end;
$$;

revoke all on function public.add_proof_of_posting(uuid, text, text, bigint, text) from public, anon, authenticated;
grant execute on function public.add_proof_of_posting(uuid, text, text, bigint, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: the owner may upload into `<booking_id>/proof/` of
-- booking-creatives while the booking is confirmed or active. Reads are
-- already granted to both participants and admins (0005).
-- ---------------------------------------------------------------------------

create policy "booking creatives owner proof insert" on storage.objects
  for insert with check (
    bucket_id = 'booking-creatives'
    and (storage.foldername(name))[2] = 'proof'
    and public.is_active_user()
    and exists (
      select 1 from public.bookings b
      where b.id::text = (storage.foldername(name))[1]
        and b.owner_id = auth.uid()
        and b.status in ('confirmed', 'active')
    )
  );
