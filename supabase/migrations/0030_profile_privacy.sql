-- 0030: profile privacy (contract 5).
--
-- RLS is row-level: policies 0006 / 0007 / 0020 let anon and counterparties
-- read whole profile rows, including email and phone. Column privileges close
-- that: the API roles may only read the public columns. Private columns are
-- served by SECURITY DEFINER functions with their own checks:
--   get_my_profile()            -> the caller's own full row
--   admin_list_users(...)       -> admins only
--   admin_count_users(...)      -> admins only
--   get_booking_contact(id)     -> the counterparty's contact, once the booking
--                                  is confirmed / active / completed
--
-- Row policies stay as they are (they now only expose public columns).
-- Existing SECURITY DEFINER code (handle_new_user, is_admin,
-- current_profile_role, notify_role_promotion, notify helpers, ...) runs as the
-- table owner and is unaffected by these grants.

-- ---------------------------------------------------------------------------
-- Table / column privileges
-- ---------------------------------------------------------------------------

-- Drops the table-level grants Supabase hands out by default (select, insert,
-- update, delete, truncate, references, trigger).
revoke all on public.profiles from anon, authenticated;

grant select (id, display_name, photo_url, role, status, created_at)
  on public.profiles to anon, authenticated;

-- Own-profile edits (display_name, phone, photo_url) and admin role/status
-- changes. profiles_update_own still limits rows to self-or-admin, and the
-- profiles_protect_role_status trigger still resets role/status for
-- non-admins. email mirrors auth.users and is not client-writable; id and
-- created_at are immutable.
-- Note: an UPDATE must not RETURN private columns (supabase-js: no
-- `.select()` after `.update()`, or select public columns only).
grant update (display_name, phone, photo_url, role, status)
  on public.profiles to authenticated;

-- No client inserts or deletes: profiles are created by the
-- on_auth_user_created trigger (SECURITY DEFINER) and removed by the
-- auth.users cascade. profiles_insert_self is left in place but is inert now
-- that INSERT is not granted.

-- ---------------------------------------------------------------------------
-- get_my_profile(): the caller's full row
-- ---------------------------------------------------------------------------

create or replace function public.get_my_profile()
returns public.profiles
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.profiles;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select * into v_row from public.profiles where id = v_uid;
  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;

revoke all on function public.get_my_profile() from public, anon;
grant execute on function public.get_my_profile() to authenticated;

-- ---------------------------------------------------------------------------
-- admin_list_users / admin_count_users
-- ---------------------------------------------------------------------------

-- Case-insensitive substring match on display_name or email. position() is
-- used instead of ILIKE so `%` / `_` in the search are literal.
create or replace function public.admin_list_users(
  p_search text default null,
  p_limit int default 50,
  p_offset int default 0
)
returns setof public.profiles
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_search text := nullif(lower(btrim(coalesce(p_search, ''))), '');
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if not coalesce(public.is_admin(), false) then
    raise exception 'Only admins can list users' using errcode = '42501';
  end if;

  return query
    select p.*
      from public.profiles p
     where v_search is null
        or position(v_search in lower(p.display_name)) > 0
        or position(v_search in lower(p.email)) > 0
     order by p.created_at desc, p.id
     limit least(greatest(coalesce(p_limit, 50), 1), 1000)
    offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.admin_list_users(text, int, int) from public, anon;
grant execute on function public.admin_list_users(text, int, int) to authenticated;

create or replace function public.admin_count_users(p_search text default null)
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_search text := nullif(lower(btrim(coalesce(p_search, ''))), '');
  v_count bigint;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if not coalesce(public.is_admin(), false) then
    raise exception 'Only admins can list users' using errcode = '42501';
  end if;

  select count(*) into v_count
    from public.profiles p
   where v_search is null
      or position(v_search in lower(p.display_name)) > 0
      or position(v_search in lower(p.email)) > 0;

  return v_count;
end;
$$;

revoke all on function public.admin_count_users(text) from public, anon;
grant execute on function public.admin_count_users(text) to authenticated;

-- ---------------------------------------------------------------------------
-- get_booking_contact(): counterparty contact for a confirmed booking
-- ---------------------------------------------------------------------------

create or replace function public.get_booking_contact(p_booking_id uuid)
returns table (email text, phone text, display_name text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings;
  v_other uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id;
  if not found
     or (v_booking.renter_id is distinct from v_uid
         and v_booking.owner_id is distinct from v_uid) then
    raise exception 'Booking not found' using errcode = '42501';
  end if;

  if v_booking.status not in ('confirmed', 'active', 'completed') then
    raise exception 'Contact details are shared once the booking is confirmed'
      using errcode = '42501';
  end if;

  v_other := case when v_booking.renter_id = v_uid
                  then v_booking.owner_id
                  else v_booking.renter_id end;

  return query
    select p.email, p.phone, p.display_name
      from public.profiles p
     where p.id = v_other;
end;
$$;

revoke all on function public.get_booking_contact(uuid) from public, anon;
grant execute on function public.get_booking_contact(uuid) to authenticated;
