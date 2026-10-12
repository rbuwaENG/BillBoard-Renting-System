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

  v_price := v_billboard.price_per_day * ((p_end_date - p_start_date) + 1);

  insert into public.bookings (billboard_id, owner_id, renter_id, start_date, end_date, creative_url, price_quoted, status)
  values (p_billboard_id, v_billboard.owner_id, auth.uid(), p_start_date, p_end_date, p_creative_url, v_price, 'pending_owner_review')
  returning * into v_booking;

  return v_booking;
end;
$$;

revoke all on function public.request_booking(uuid, date, date, text) from public;
grant execute on function public.request_booking(uuid, date, date, text) to authenticated;

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
  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then
    raise exception 'Booking not found';
  end if;
  if v_booking.owner_id <> auth.uid() then
    raise exception 'Not authorized to respond to this booking';
  end if;
  if v_booking.status <> 'pending_owner_review' then
    raise exception 'Booking is not pending review';
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

revoke all on function public.respond_to_booking(uuid, boolean, text) from public;
grant execute on function public.respond_to_booking(uuid, boolean, text) to authenticated;

create or replace function public.billboards_near(
  p_lat double precision,
  p_lng double precision,
  p_radius_km double precision
)
returns setof public.billboards
language sql
stable
as $$
  select *
  from public.billboards
  where status = 'active'
    and st_dwithin(geom, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_radius_km * 1000)
$$;

revoke all on function public.billboards_near(double precision, double precision, double precision) from public;
grant execute on function public.billboards_near(double precision, double precision, double precision) to authenticated, anon;
