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
  if p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be between 1 and 5';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then
    raise exception 'Booking not found';
  end if;
  if v_booking.renter_id <> auth.uid() then
    raise exception 'Not authorized to review this booking';
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

revoke all on function public.submit_review(uuid, integer, text) from public;
grant execute on function public.submit_review(uuid, integer, text) to authenticated;

create or replace function public.recalc_billboard_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.billboards
  set rating_avg = coalesce((select avg(rating) from public.reviews where billboard_id = new.billboard_id), 0),
      rating_count = (select count(*) from public.reviews where billboard_id = new.billboard_id)
  where id = new.billboard_id;
  return new;
end;
$$;

create trigger reviews_recalc_billboard_rating
  after insert on public.reviews
  for each row execute function public.recalc_billboard_rating();
