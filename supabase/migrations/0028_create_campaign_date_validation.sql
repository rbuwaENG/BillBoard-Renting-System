-- create_campaign previously relied on the bare `campaigns_end_date_check`
-- constraint to reject an inverted date range, surfacing a raw Postgres
-- constraint-violation message to the user instead of a clear one. Validate
-- up front, matching the pattern already used in request_booking.
create or replace function public.create_campaign(
  p_name text,
  p_start_date date,
  p_end_date date,
  p_billboard_ids uuid[]
)
returns public.campaigns
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign public.campaigns;
  v_billboard_id uuid;
  v_booking public.bookings;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_billboard_ids is null or array_length(p_billboard_ids, 1) is null then
    raise exception 'Select at least one billboard for the campaign';
  end if;
  if p_end_date < p_start_date then
    raise exception 'End date must be on or after start date';
  end if;

  insert into public.campaigns (renter_id, name, start_date, end_date)
  values (auth.uid(), p_name, p_start_date, p_end_date)
  returning * into v_campaign;

  foreach v_billboard_id in array p_billboard_ids loop
    begin
      select * into v_booking from public.request_booking(v_billboard_id, p_start_date, p_end_date, null);
      insert into public.campaign_items (campaign_id, billboard_id, booking_id, status)
      values (v_campaign.id, v_billboard_id, v_booking.id, 'booked');
    exception when others then
      insert into public.campaign_items (campaign_id, billboard_id, status, failure_reason)
      values (v_campaign.id, v_billboard_id, 'failed', sqlerrm);
    end;
  end loop;

  return v_campaign;
end;
$$;

revoke all on function public.create_campaign(text, date, date, uuid[]) from public;
grant execute on function public.create_campaign(text, date, date, uuid[]) to authenticated;
