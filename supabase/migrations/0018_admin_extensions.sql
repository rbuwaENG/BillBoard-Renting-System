alter table public.platform_settings
  add column site_name text not null default 'Billboard Renting System',
  add column site_logo_url text,
  add column platform_fee_percent numeric not null default 0 check (platform_fee_percent between 0 and 100),
  add column notification_sender_email text;

create table public.payment_gateway_settings (
  id boolean primary key default true check (id),
  provider text,
  public_key text,
  secret_key text,
  is_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.payment_gateway_settings (id) values (true);

alter table public.payment_gateway_settings enable row level security;

create policy payment_gateway_settings_admin_select on public.payment_gateway_settings
  for select using (public.is_admin());

create policy payment_gateway_settings_admin_update on public.payment_gateway_settings
  for update using (public.is_admin()) with check (public.is_admin());

alter table public.payouts
  add column gross_amount numeric not null default 0,
  add column fee_amount numeric not null default 0;

create or replace function public.admin_create_payout(
  p_owner_id uuid,
  p_booking_ids uuid[],
  p_scheduled_release_date date
)
returns public.payouts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gross numeric;
  v_fee_percent numeric;
  v_fee numeric;
  v_net numeric;
  v_currency text;
  v_payout public.payouts;
  v_booking_id uuid;
  v_invalid_count integer;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can create a payout';
  end if;
  if p_booking_ids is null or array_length(p_booking_ids, 1) is null then
    raise exception 'Select at least one booking to pay out';
  end if;

  select count(*) into v_invalid_count
  from public.bookings b
  where b.id = any(p_booking_ids)
    and (
      b.owner_id <> p_owner_id
      or b.status not in ('confirmed', 'active', 'completed')
      or exists (select 1 from public.payout_items pi where pi.booking_id = b.id)
    );
  if v_invalid_count > 0 then
    raise exception 'One or more selected bookings are not eligible for payout';
  end if;
  if (select count(*) from public.bookings where id = any(p_booking_ids)) <> array_length(p_booking_ids, 1) then
    raise exception 'One or more selected bookings do not exist';
  end if;

  select sum(price_quoted) into v_gross from public.bookings where id = any(p_booking_ids);
  select currency, platform_fee_percent into v_currency, v_fee_percent from public.platform_settings;

  v_fee := round(v_gross * coalesce(v_fee_percent, 0) / 100, 2);
  v_net := v_gross - v_fee;

  insert into public.payouts (owner_id, amount, gross_amount, fee_amount, currency, status, scheduled_release_date, approved_by)
  values (p_owner_id, v_net, v_gross, v_fee, coalesce(v_currency, 'USD'), 'approved', p_scheduled_release_date, auth.uid())
  returning * into v_payout;

  foreach v_booking_id in array p_booking_ids loop
    insert into public.payout_items (payout_id, booking_id) values (v_payout.id, v_booking_id);
  end loop;

  perform public.notify(
    p_owner_id,
    'payout_scheduled',
    'A payout of ' || v_net || ' ' || coalesce(v_currency, 'USD') || ' (after a ' || coalesce(v_fee_percent, 0) || '% service fee) is scheduled for ' || p_scheduled_release_date,
    v_payout.id
  );

  return v_payout;
end;
$$;

revoke all on function public.admin_create_payout(uuid, uuid[], date) from public;
grant execute on function public.admin_create_payout(uuid, uuid[], date) to authenticated;

insert into storage.buckets (id, name, public) values
  ('site-assets', 'site-assets', true);

create policy "site assets public read" on storage.objects
  for select using (bucket_id = 'site-assets');

create policy "site assets admin write" on storage.objects
  for insert with check (bucket_id = 'site-assets' and public.is_admin());

create policy "site assets admin update" on storage.objects
  for update using (bucket_id = 'site-assets' and public.is_admin());

create policy "site assets admin delete" on storage.objects
  for delete using (bucket_id = 'site-assets' and public.is_admin());

create extension if not exists pg_net;

create or replace function public.notify_role_promotion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_sender text;
  v_site_name text;
begin
  begin
    select decrypted_secret into v_key from vault.decrypted_secrets where name = 'brevo_api_key';
    select notification_sender_email, site_name into v_sender, v_site_name from public.platform_settings;

    if v_key is null or v_sender is null then
      return new;
    end if;

    perform net.http_post(
      url := 'https://api.brevo.com/v3/smtp/email',
      headers := jsonb_build_object('api-key', v_key, 'content-type', 'application/json'),
      body := jsonb_build_object(
        'sender', jsonb_build_object('name', coalesce(v_site_name, 'Billboard Renting System'), 'email', v_sender),
        'to', jsonb_build_array(jsonb_build_object('email', new.email, 'name', new.display_name)),
        'subject', 'You now have admin access',
        'htmlContent', '<p>Hi ' || coalesce(new.display_name, 'there') || ', your account now has admin access on ' || coalesce(v_site_name, 'Billboard Renting System') || '.</p>'
      )
    );
  exception when others then
    null;
  end;
  return new;
end;
$$;

create trigger profiles_notify_role_promotion
  after update on public.profiles
  for each row
  when (new.role = 'admin' and old.role is distinct from 'admin')
  execute function public.notify_role_promotion();
