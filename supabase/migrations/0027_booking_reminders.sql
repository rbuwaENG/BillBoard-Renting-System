create or replace function public.send_booking_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, message, ref_id)
  select b.renter_id, 'payment_reminder',
    'Your booking for "' || bb.title || '" is still awaiting payment.', b.id
  from public.bookings b
  join public.billboards bb on bb.id = b.billboard_id
  where b.status = 'payment_pending'
    and b.decision_at <= now() - interval '24 hours'
    and not exists (
      select 1 from public.notifications n
      where n.ref_id = b.id and n.type = 'payment_reminder' and n.created_at > b.decision_at
    );

  insert into public.notifications (user_id, type, message, ref_id)
  select b.renter_id, 'rental_starting_soon',
    'Your rental for "' || bb.title || '" starts tomorrow.', b.id
  from public.bookings b
  join public.billboards bb on bb.id = b.billboard_id
  where b.status = 'confirmed'
    and b.start_date = current_date + 1
    and not exists (
      select 1 from public.notifications n
      where n.ref_id = b.id and n.type = 'rental_starting_soon'
    );
end;
$$;

revoke all on function public.send_booking_reminders() from public;

create or replace function public.run_scheduled_jobs()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.advance_booking_lifecycle();
  perform public.release_due_payouts();
  perform public.send_booking_reminders();
end;
$$;

revoke all on function public.run_scheduled_jobs() from public;
