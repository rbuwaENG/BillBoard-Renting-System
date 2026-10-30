-- 0034 · Admin audit log (shared contract 8) + suspended-admin fix
--
--  1. public.admin_audit_log: one row per meaningful change to
--       profiles   role, status
--       billboards status, admin_price_override_per_day
--       payments   status
--       payouts    status
--     written by AFTER UPDATE triggers. before/after hold only the changed
--     columns. actor_id = auth.uid(), or null for system/cron writes (no JWT,
--     or `app.system_actor = on` as set by the lifecycle job, see 0032).
--     Admin-only SELECT; no client can insert, update or delete rows.
--
--     Noise rule: an owner switching their own billboard between active /
--     inactive / archived is routine listing management, not an admin
--     action, so it is NOT logged. Any billboard status change made by an
--     admin, by the system, or involving 'flagged' is logged, as is every
--     price-override change (only admins can make one, see 0029).
--
--  2. is_admin() now also requires status = 'active', so a suspended admin
--     loses every admin capability (RLS policies and admin RPCs).
--     Like the 0002 definition it returns NULL when there is no caller
--     profile (anon, service_role, SQL editor, cron): protect_profile_role_status
--     (0002) relies on `if not is_admin()` being NULL there so trusted
--     server-side writes to role/status still go through. Signature, language,
--     security definer and the anon + authenticated EXECUTE grants (0029) are
--     unchanged.

-- ---------------------------------------------------------------------------
-- 2. Suspended admins are not admins (latest definition: 0002)
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (p.role = 'admin' and p.status = 'active')
    from public.profiles p
   where p.id = auth.uid();
$$;

-- create or replace keeps the existing grants; restated for clarity.
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. Audit log
-- ---------------------------------------------------------------------------

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index admin_audit_log_created_at_idx on public.admin_audit_log (created_at desc);
create index admin_audit_log_entity_idx on public.admin_audit_log (entity, entity_id);
create index admin_audit_log_actor_idx on public.admin_audit_log (actor_id);

alter table public.admin_audit_log enable row level security;

create policy admin_audit_log_select_admin on public.admin_audit_log
  for select using (public.is_admin());

-- Read-only for the API: rows are only written by the trigger below.
revoke all on public.admin_audit_log from public, anon, authenticated;
grant select on public.admin_audit_log to authenticated;

-- Generic trigger: TG_ARGV[0] = entity name, TG_ARGV[1..] = audited columns.
create or replace function public.trg_admin_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb := to_jsonb(old);
  v_new jsonb := to_jsonb(new);
  v_before jsonb := '{}'::jsonb;
  v_after jsonb := '{}'::jsonb;
  v_changed text[] := '{}';
  v_col text;
  v_actor uuid;
  v_system boolean := coalesce(current_setting('app.system_actor', true), '') = 'on';
  i integer;
begin
  for i in 1 .. tg_nargs - 1 loop
    v_col := tg_argv[i];
    if (v_old -> v_col) is distinct from (v_new -> v_col) then
      v_before := v_before || jsonb_build_object(v_col, v_old -> v_col);
      v_after := v_after || jsonb_build_object(v_col, v_new -> v_col);
      v_changed := v_changed || v_col;
    end if;
  end loop;

  if cardinality(v_changed) = 0 then
    return null;
  end if;

  v_actor := case when v_system then null else auth.uid() end;
  -- A JWT subject without a profile (e.g. a deleted user) is logged as system.
  if v_actor is not null and not exists (select 1 from public.profiles where id = v_actor) then
    v_actor := null;
  end if;

  -- Owner self-service on billboard status (see header): not logged.
  if tg_table_name = 'billboards'
     and v_changed = array['status']
     and v_actor is not null
     and v_actor = (v_old ->> 'owner_id')::uuid
     and not public.is_admin()
     and (v_old ->> 'status') in ('active','inactive','archived')
     and (v_new ->> 'status') in ('active','inactive','archived') then
    return null;
  end if;

  insert into public.admin_audit_log (actor_id, action, entity, entity_id, before, after)
  values (
    v_actor,
    array_to_string(
      array(select c || '_changed' from unnest(v_changed) as c),
      ','
    ),
    tg_argv[0],
    (v_new ->> 'id')::uuid,
    v_before,
    v_after
  );

  return null;
end;
$$;

revoke all on function public.trg_admin_audit() from public, anon, authenticated;

create trigger profiles_admin_audit
  after update of role, status on public.profiles
  for each row execute function public.trg_admin_audit('profile', 'role', 'status');

create trigger billboards_admin_audit
  after update of status, admin_price_override_per_day on public.billboards
  for each row execute function public.trg_admin_audit('billboard', 'status', 'admin_price_override_per_day');

create trigger payments_admin_audit
  after update of status on public.payments
  for each row execute function public.trg_admin_audit('payment', 'status');

create trigger payouts_admin_audit
  after update of status on public.payouts
  for each row execute function public.trg_admin_audit('payout', 'status');
