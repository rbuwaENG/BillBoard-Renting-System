create or replace function public.notify(
  p_user_id uuid,
  p_type text,
  p_message text,
  p_ref_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, message, ref_id)
  values (p_user_id, p_type, p_message, p_ref_id);
end;
$$;

revoke all on function public.notify(uuid, text, text, uuid) from public;

create or replace function public.trg_booking_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.notify(
      new.owner_id,
      'booking_requested',
      'New booking request received for your billboard.',
      new.id
    );
    return new;
  end if;

  if new.status = old.status then
    return new;
  end if;

  if new.status = 'payment_pending' then
    perform public.notify(new.renter_id, 'booking_approved', 'Your booking request was approved — payment is now due.', new.id);
  elsif new.status = 'rejected' then
    perform public.notify(new.renter_id, 'booking_rejected', coalesce('Your booking request was rejected: ' || new.rejection_reason, 'Your booking request was rejected.'), new.id);
  elsif new.status = 'confirmed' then
    perform public.notify(new.renter_id, 'payment_confirmed', 'Your payment was confirmed — booking is now confirmed.', new.id);
  elsif new.status = 'completed' then
    perform public.notify(new.renter_id, 'booking_completed', 'Your booking is complete — leave a review for the billboard.', new.id);
    perform public.notify(new.owner_id, 'booking_completed', 'A booking on your billboard is now complete.', new.id);
  elsif new.status = 'cancelled' then
    perform public.notify(new.renter_id, 'booking_cancelled', 'Your booking was cancelled.', new.id);
    perform public.notify(new.owner_id, 'booking_cancelled', 'A booking on your billboard was cancelled.', new.id);
  end if;

  return new;
end;
$$;

create trigger bookings_notify
  after insert or update on public.bookings
  for each row execute function public.trg_booking_notify();

create or replace function public.trg_review_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
begin
  select owner_id into v_owner_id from public.billboards where id = new.billboard_id;
  if v_owner_id is not null then
    perform public.notify(v_owner_id, 'review_received', 'Your billboard received a new review.', new.id);
  end if;
  return new;
end;
$$;

create trigger reviews_notify
  after insert on public.reviews
  for each row execute function public.trg_review_notify();

alter publication supabase_realtime add table public.notifications;
