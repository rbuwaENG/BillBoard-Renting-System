-- 0029 security hardening (access control).
--
--  1. Function privileges: Supabase grants EXECUTE on every function in
--     `public` to anon/authenticated by default, so `revoke ... from public`
--     never stopped anon. Revoke everything, then grant explicitly (section 9,
--     at the end, so it also covers the functions defined below).
--  2. Null-safe auth guards (`x <> auth.uid()` is NULL, i.e. passes, for anon)
--     + `assert_active_user()` in the user-facing RPCs owned here.
--  3. Suspension helpers (contract 6) and `is_active_user()` in write policies.
--  4. Billboard protection (contract 2): 'archived', protect trigger,
--     admin_set_billboard_status().
--  5. Delete safety: no cascade-deleting bookings / payments / audit rows.
--  6. Storage bucket limits and tighter write policies.
--  7. One review per booking.
--  8. Missing indexes.
--
-- Every function below is redefined from its LATEST definition (0004, 0010,
-- 0012, 0014, 0024, 0025); only the guards changed. request_booking,
-- renter_pay_booking, admin_confirm_payment, admin_create_payout, the payout
-- release functions, create_campaign and advance_booking_lifecycle are
-- redefined by 0031/0032 and are only re-granted here.

-- ---------------------------------------------------------------------------
-- 3. Suspension helpers (contract 6 — keep byte-identical with 0031)
-- ---------------------------------------------------------------------------
create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'active')
$$;
create or replace function public.assert_active_user() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  if not public.is_active_user() then raise exception 'Account suspended' using errcode = '42501'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Null-safe auth guards
-- ---------------------------------------------------------------------------

-- from 0004
create or replace function public.respond_to_booking(
  p_booking_id uuid,
  p_approve boolean,
  p_reason text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
begin
  perform public.assert_active_user();

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found';
  end if;
  if v_booking.owner_id is distinct from auth.uid() then
    raise exception 'Not authorized to respond to this booking' using errcode = '42501';
  end if;
  if v_booking.status <> 'pending_owner_review' then
    raise exception 'Booking is not pending review';
  end if;
  -- Approving a booking whose rental window has already begun would leave the
  -- renter paying for days that are gone. Rejecting stays allowed so the owner
  -- can still clear a stale request (and free its dates).
  if p_approve and current_date >= v_booking.start_date then
    raise exception 'This booking has already started';
  end if;

  update public.bookings
  set status = case when p_approve then 'payment_pending' else 'rejected' end,
      rejection_reason = case when p_approve then null else p_reason end,
      decision_at = now()
  where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

-- from 0025
create or replace function public.cancel_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
begin
  perform public.assert_active_user();

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found';
  end if;
  if v_booking.renter_id is distinct from auth.uid() then
    raise exception 'Not authorized to cancel this booking' using errcode = '42501';
  end if;
  if v_booking.status not in ('pending_owner_review','payment_pending') then
    raise exception 'This booking can no longer be cancelled';
  end if;

  update public.bookings
  set status = 'cancelled'
  where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

-- from 0014
create or replace function public.attach_booking_creative(
  p_booking_id uuid,
  p_creative_path text
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
begin
  perform public.assert_active_user();

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found';
  end if;
  if v_booking.renter_id is distinct from auth.uid() then
    raise exception 'Not authorized to update this booking' using errcode = '42501';
  end if;
  if v_booking.status <> 'pending_owner_review' then
    raise exception 'Creative can only be attached while the booking is pending review';
  end if;

  update public.bookings
  set creative_url = p_creative_path
  where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

-- from 0024
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

  insert into public.booking_documents (booking_id, uploaded_by, storage_path, file_name, file_size, kind)
  values (p_booking_id, auth.uid(), p_storage_path, p_file_name, p_file_size, p_kind)
  returning * into v_doc;

  insert into public.booking_events (booking_id, event_type, actor_id, message)
  values (p_booking_id, 'document_uploaded', auth.uid(), p_file_name);

  return v_doc;
end;
$$;

-- from 0024; documents become part of the record once the booking is confirmed
-- (matches the storage delete policy below).
create or replace function public.remove_booking_document(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc public.booking_documents;
  v_status text;
begin
  perform public.assert_active_user();

  select * into v_doc from public.booking_documents where id = p_document_id;
  if not found then
    raise exception 'Document not found';
  end if;
  if v_doc.uploaded_by is distinct from auth.uid() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  select status into v_status from public.bookings where id = v_doc.booking_id;
  if v_status in ('confirmed','active','completed') then
    raise exception 'Documents can no longer be removed once the booking is confirmed';
  end if;

  delete from public.booking_documents where id = p_document_id;
end;
$$;

-- from 0024
create or replace function public.request_booking_documents(p_booking_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
begin
  perform public.assert_active_user();

  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then
    raise exception 'Booking not found';
  end if;
  if v_booking.owner_id is distinct from auth.uid() then
    raise exception 'Not authorized' using errcode = '42501';
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

-- from 0010
create or replace function public.submit_review(
  p_booking_id uuid,
  p_rating integer,
  p_comment text default null
)
returns public.reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_review public.reviews;
begin
  perform public.assert_active_user();

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be between 1 and 5';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then
    raise exception 'Booking not found';
  end if;
  if v_booking.renter_id is distinct from auth.uid() then
    raise exception 'Not authorized to review this booking' using errcode = '42501';
  end if;
  if v_booking.status <> 'completed' then
    raise exception 'Booking must be completed before it can be reviewed';
  end if;
  if exists (select 1 from public.reviews where booking_id = p_booking_id) then
    raise exception 'This booking has already been reviewed';
  end if;

  insert into public.reviews (booking_id, billboard_id, renter_id, rating, comment)
  values (p_booking_id, v_booking.billboard_id, auth.uid(), p_rating, p_comment)
  returning * into v_review;

  return v_review;
end;
$$;

-- from 0012. An existing thread is always returned (so conversations about a
-- billboard that later went inactive stay reachable); a NEW thread can only be
-- opened on an active billboard, and never with yourself.
create or replace function public.get_or_create_chat_thread(p_billboard_id uuid)
returns public.chat_threads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_billboard public.billboards;
  v_thread public.chat_threads;
begin
  perform public.assert_active_user();

  select * into v_billboard from public.billboards where id = p_billboard_id;
  if not found then
    raise exception 'Billboard not found';
  end if;
  if v_billboard.owner_id is not distinct from auth.uid() then
    raise exception 'Billboard owners cannot start an inquiry thread on their own billboard';
  end if;

  select * into v_thread from public.chat_threads
  where billboard_id = p_billboard_id and renter_id = auth.uid();
  if found then
    return v_thread;
  end if;

  if v_billboard.status <> 'active' then
    raise exception 'This billboard is not available for inquiries';
  end if;

  insert into public.chat_threads (billboard_id, renter_id, owner_id)
  values (p_billboard_id, auth.uid(), v_billboard.owner_id)
  on conflict (billboard_id, renter_id) do nothing;

  select * into v_thread from public.chat_threads
  where billboard_id = p_billboard_id and renter_id = auth.uid();

  return v_thread;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Billboard protection (contract 2)
-- ---------------------------------------------------------------------------
alter table public.billboards drop constraint billboards_status_check;
alter table public.billboards add constraint billboards_status_check
  check (status in ('active','inactive','flagged','archived'));

-- SECURITY INVOKER on purpose: current_user is then the role doing the write.
-- Direct API writes (anon/authenticated) are restricted; writes made inside
-- security-definer functions (rating recalculation, admin RPCs) run as the
-- table owner, and service_role/cron are trusted, so those pass through.
create or replace function public.protect_billboard_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.admin_price_override_per_day is not null then
      raise exception 'Only an admin can set a price override' using errcode = '42501';
    end if;
    if new.rating_avg <> 0 or new.rating_count <> 0 then
      raise exception 'Ratings are calculated from reviews' using errcode = '42501';
    end if;
    if new.status = 'flagged' then
      raise exception 'Only an admin can flag a billboard' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.owner_id is distinct from old.owner_id then
    raise exception 'Only an admin can change a billboard''s owner' using errcode = '42501';
  end if;
  if new.admin_price_override_per_day is distinct from old.admin_price_override_per_day then
    raise exception 'Only an admin can set a price override' using errcode = '42501';
  end if;
  if new.rating_avg is distinct from old.rating_avg or new.rating_count is distinct from old.rating_count then
    raise exception 'Ratings are calculated from reviews' using errcode = '42501';
  end if;
  if new.status is distinct from old.status then
    if old.status = 'flagged' then
      raise exception 'This billboard was flagged by an admin and can only be reinstated by an admin' using errcode = '42501';
    end if;
    if new.status = 'flagged' then
      raise exception 'Only an admin can flag a billboard' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger billboards_protect_fields
  before insert or update on public.billboards
  for each row execute function public.protect_billboard_fields();

create or replace function public.admin_set_billboard_status(
  p_billboard_id uuid,
  p_status text,
  p_reason text default null
)
returns public.billboards
language plpgsql
security definer
set search_path = public
as $$
declare
  v_billboard public.billboards;
  v_reason text := nullif(btrim(p_reason), '');
begin
  perform public.assert_active_user();
  if not public.is_admin() then
    raise exception 'Only an admin can moderate billboards' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('active','inactive','flagged','archived') then
    raise exception 'Invalid billboard status: %', coalesce(p_status, 'null');
  end if;

  update public.billboards
  set status = p_status
  where id = p_billboard_id
  returning * into v_billboard;
  if not found then
    raise exception 'Billboard not found';
  end if;

  perform public.notify(
    v_billboard.owner_id,
    'billboard_moderated',
    'Your billboard "' || v_billboard.title || '" was '
      || case p_status
           when 'flagged' then 'flagged by an admin'
           when 'active' then 'reinstated by an admin'
           when 'inactive' then 'deactivated by an admin'
           else 'archived by an admin'
         end
      || coalesce(': ' || v_reason, '.'),
    v_billboard.id
  );

  return v_billboard;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3b. is_active_user() in write policies (suspended users can't write)
-- bookings / reviews / booking_documents / campaigns have no client write
-- policies at all (writes go through the RPCs, which call assert_active_user).
-- ---------------------------------------------------------------------------
drop policy billboards_insert_owner on public.billboards;
create policy billboards_insert_owner on public.billboards
  for insert with check (
    owner_id = auth.uid()
    and public.current_profile_role() = 'rentor'
    and public.is_active_user()
  );

drop policy billboards_update_owner on public.billboards;
create policy billboards_update_owner on public.billboards
  for update
  using ((owner_id = auth.uid() and public.is_active_user()) or public.is_admin())
  with check ((owner_id = auth.uid() and public.is_active_user()) or public.is_admin());

drop policy billboards_delete_owner on public.billboards;
create policy billboards_delete_owner on public.billboards
  for delete using ((owner_id = auth.uid() and public.is_active_user()) or public.is_admin());

drop policy billboard_pricing_tiers_owner_write on public.billboard_pricing_tiers;
create policy billboard_pricing_tiers_owner_write on public.billboard_pricing_tiers
  for all using (
    exists (
      select 1 from public.billboards b
      where b.id = billboard_id
        and ((b.owner_id = auth.uid() and public.is_active_user()) or public.is_admin())
    )
  ) with check (
    exists (
      select 1 from public.billboards b
      where b.id = billboard_id
        and ((b.owner_id = auth.uid() and public.is_active_user()) or public.is_admin())
    )
  );

drop policy chat_messages_insert_participants on public.chat_messages;
create policy chat_messages_insert_participants on public.chat_messages
  for insert with check (
    sender_id = auth.uid()
    and public.is_active_user()
    and exists (
      select 1 from public.chat_threads t
      where t.id = thread_id
        and (t.renter_id = auth.uid() or t.owner_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Delete safety: financial / audit rows never disappear with their parent.
-- NO ACTION (not RESTRICT) so a blocked delete raises 23503 foreign_key_violation
-- as contract 2 specifies; RESTRICT raises 23001. Both block the delete.
-- Owners archive billboards instead of deleting them (contract 2). Pricing
-- tiers, chat threads and campaign items keep their existing behaviour.
-- ---------------------------------------------------------------------------
alter table public.bookings drop constraint bookings_billboard_id_fkey;
alter table public.bookings add constraint bookings_billboard_id_fkey
  foreign key (billboard_id) references public.billboards(id) on delete no action;

alter table public.payments drop constraint payments_booking_id_fkey;
alter table public.payments add constraint payments_booking_id_fkey
  foreign key (booking_id) references public.bookings(id) on delete no action;

alter table public.booking_events drop constraint booking_events_booking_id_fkey;
alter table public.booking_events add constraint booking_events_booking_id_fkey
  foreign key (booking_id) references public.bookings(id) on delete no action;

alter table public.booking_documents drop constraint booking_documents_booking_id_fkey;
alter table public.booking_documents add constraint booking_documents_booking_id_fkey
  foreign key (booking_id) references public.bookings(id) on delete no action;

alter table public.reviews drop constraint reviews_booking_id_fkey;
alter table public.reviews add constraint reviews_booking_id_fkey
  foreign key (booking_id) references public.bookings(id) on delete no action;

alter table public.reviews drop constraint reviews_billboard_id_fkey;
alter table public.reviews add constraint reviews_billboard_id_fkey
  foreign key (billboard_id) references public.billboards(id) on delete no action;

-- ---------------------------------------------------------------------------
-- 6. Storage
-- Limits are enforced by the Storage API (not Postgres). Accept lists match
-- the client: BillboardFormDialog/SettingsPanel `image/*`; BookingDocuments,
-- BillboardDetailDialog and ChatPanel `image/*,video/*,application/pdf`
-- (BookingDocuments caps at 10 MB client-side).
-- ---------------------------------------------------------------------------
update storage.buckets
set file_size_limit = 5242880, allowed_mime_types = array['image/*']
where id in ('billboard-images', 'site-assets');

update storage.buckets
set file_size_limit = 10485760, allowed_mime_types = array['image/*', 'video/*', 'application/pdf']
where id in ('booking-creatives', 'chat-attachments');

-- billboard-images: only active rentors (or admins) write, into their own folder.
drop policy "billboard images owner insert" on storage.objects;
create policy "billboard images owner insert" on storage.objects
  for insert with check (
    bucket_id = 'billboard-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.current_profile_role() in ('rentor', 'admin')
    and public.is_active_user()
  );

drop policy "billboard images owner update" on storage.objects;
create policy "billboard images owner update" on storage.objects
  for update using (
    bucket_id = 'billboard-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.current_profile_role() in ('rentor', 'admin')
    and public.is_active_user()
  ) with check (
    bucket_id = 'billboard-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.current_profile_role() in ('rentor', 'admin')
    and public.is_active_user()
  );

drop policy "billboard images owner delete" on storage.objects;
create policy "billboard images owner delete" on storage.objects
  for delete using (
    bucket_id = 'billboard-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.current_profile_role() in ('rentor', 'admin')
    and public.is_active_user()
  );

drop policy "booking creatives renter insert" on storage.objects;
create policy "booking creatives renter insert" on storage.objects
  for insert with check (
    bucket_id = 'booking-creatives'
    and public.is_active_user()
    and exists (
      select 1 from public.bookings b
      where b.id::text = (storage.foldername(name))[1]
        and b.renter_id = auth.uid()
    )
  );

-- Once a booking is confirmed its creatives/documents are part of the record.
drop policy "booking creatives renter delete" on storage.objects;
create policy "booking creatives renter delete" on storage.objects
  for delete using (
    bucket_id = 'booking-creatives'
    and public.is_active_user()
    and exists (
      select 1 from public.bookings b
      where b.id::text = (storage.foldername(name))[1]
        and b.renter_id = auth.uid()
        and b.status not in ('confirmed', 'active', 'completed')
    )
  );

drop policy "chat attachments participants insert" on storage.objects;
create policy "chat attachments participants insert" on storage.objects
  for insert with check (
    bucket_id = 'chat-attachments'
    and public.is_active_user()
    and exists (
      select 1 from public.chat_threads t
      where t.id::text = (storage.foldername(name))[1]
        and (t.renter_id = auth.uid() or t.owner_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 7. One review per booking (submit_review already checks; this closes the
-- race). Drop any duplicates first (keep the earliest), then resync ratings.
-- ---------------------------------------------------------------------------
delete from public.reviews r
using public.reviews earlier
where r.booking_id = earlier.booking_id
  and (earlier.created_at, earlier.id) < (r.created_at, r.id);

update public.billboards b
set rating_avg = s.avg_rating, rating_count = s.cnt
from (
  select bb.id,
         coalesce((select avg(rating) from public.reviews r where r.billboard_id = bb.id), 0) as avg_rating,
         (select count(*) from public.reviews r where r.billboard_id = bb.id)::integer as cnt
  from public.billboards bb
) s
where s.id = b.id
  and (b.rating_avg is distinct from s.avg_rating or b.rating_count is distinct from s.cnt);

create unique index if not exists reviews_booking_id_key on public.reviews (booking_id);

-- ---------------------------------------------------------------------------
-- 8. Indexes
-- ---------------------------------------------------------------------------
create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_ref_type_idx on public.notifications (ref_id, type);
create index if not exists chat_threads_owner_idx on public.chat_threads (owner_id);
create index if not exists chat_threads_renter_idx on public.chat_threads (renter_id);
create index if not exists payments_renter_idx on public.payments (renter_id);
create index if not exists payments_booking_idx on public.payments (booking_id);
create index if not exists reviews_billboard_idx on public.reviews (billboard_id);

-- ---------------------------------------------------------------------------
-- 9. Privileges
-- ---------------------------------------------------------------------------

-- 9a. Future objects: nothing new in public is callable/writable by the API
-- roles unless a migration grants it. The global PUBLIC default must go too —
-- a per-schema revoke can't remove a globally granted default, and anon and
-- authenticated are members of PUBLIC. (service_role keeps its defaults.)
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema public revoke insert, update, delete, truncate, references, trigger on tables from anon;
alter default privileges in schema public revoke truncate, references, trigger on tables from authenticated;

-- 9b. Existing functions: revoke from everyone but the owner and service_role.
-- Extension-owned functions (PostGIS lives in public) are left alone —
-- billboards_near and the billboards.geom generated column need them.
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prokind in ('f', 'p')
      and not exists (
        select 1 from pg_depend d
        where d.classid = 'pg_proc'::regclass
          and d.objid = p.oid
          and d.deptype = 'e'
      )
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;
end
$$;

-- Helpers referenced by RLS policies. Policies are evaluated with the
-- caller's privileges, so anon needs these to browse (billboards_select_public
-- and the storage read policies call is_admin()). All three only describe
-- the caller and return null/false for anon.
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.current_profile_role() to anon, authenticated;
grant execute on function public.is_active_user() to anon, authenticated;
grant execute on function public.assert_active_user() to authenticated;

-- Public browsing.
grant execute on function public.billboards_near(double precision, double precision, double precision) to anon, authenticated;

-- User-facing RPCs (every one checks auth.uid()/role itself). Exactly the set
-- the client calls via supabase.rpc(), plus admin_set_billboard_status.
grant execute on function public.request_booking(uuid, date, date, text) to authenticated;
grant execute on function public.respond_to_booking(uuid, boolean, text) to authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;
grant execute on function public.attach_booking_creative(uuid, text) to authenticated;
grant execute on function public.add_booking_document(uuid, text, text, bigint, text) to authenticated;
grant execute on function public.remove_booking_document(uuid) to authenticated;
grant execute on function public.request_booking_documents(uuid, text) to authenticated;
grant execute on function public.submit_review(uuid, integer, text) to authenticated;
grant execute on function public.get_or_create_chat_thread(uuid) to authenticated;
grant execute on function public.create_campaign(text, date, date, uuid[]) to authenticated;
grant execute on function public.renter_pay_booking(uuid) to authenticated;
grant execute on function public.admin_confirm_payment(uuid, numeric, text, text) to authenticated;
grant execute on function public.admin_create_payout(uuid, uuid[], date) to authenticated;
grant execute on function public.admin_release_payout(uuid) to authenticated;
grant execute on function public.admin_set_billboard_status(uuid, text, text) to authenticated;
-- Client fallback (useAdvanceBookingLifecycle). Safe for any caller: it only
-- moves bookings along by date, exactly as the cron job would.
grant execute on function public.advance_booking_lifecycle() to authenticated;

-- Not granted to anon/authenticated (owner + service_role only): notify,
-- release_due_payouts, send_booking_reminders, run_scheduled_jobs and every
-- trigger function (triggers don't need the caller to hold EXECUTE).

-- 9c. Tables: anon is read-only everywhere (RLS still decides which rows), and
-- nobody on the API can TRUNCATE (which bypasses RLS). spatial_ref_sys is
-- PostGIS's own table without RLS: read-only for the API roles.
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;
do $$
begin
  if to_regclass('public.spatial_ref_sys') is not null then
    revoke insert, update, delete on table public.spatial_ref_sys from authenticated;
  end if;
end
$$;
