-- ---------------------------------------------------------------------------
-- PGlite bootstrap: the minimum slice of a Supabase project that the
-- migrations in supabase/migrations/ depend on. Runs once, as the PGlite
-- superuser `postgres` (which plays the role of Supabase's `postgres` owner
-- role), before migration 0001.
--
-- Everything here is a STUB of a Supabase-managed object. It mirrors the real
-- object's name, signature and — where it matters for security tests — its
-- grants, but not its implementation (no GoTrue, no storage API, no cron
-- worker, no HTTP). See src/test/db/README.md for the fidelity limits.
-- ---------------------------------------------------------------------------

-- Roles --------------------------------------------------------------------
-- Supabase's API roles. PostgREST switches into one of these per request
-- (`set local role ...`), which is exactly what the asAnon/asUser/asService
-- helpers do. service_role has BYPASSRLS on Supabase.
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

-- Schemas ------------------------------------------------------------------
create schema if not exists extensions;
create schema if not exists auth;
create schema if not exists storage;
create schema if not exists cron;
create schema if not exists net;
create schema if not exists vault;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema extensions to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema storage to anon, authenticated, service_role;

-- Supabase's real default privileges (set for the `postgres` role in every
-- project): anything postgres creates in `public` is granted to all three API
-- roles. This is why `revoke all on function f from public` alone does NOT
-- stop anon from calling f — anon holds its own explicit EXECUTE grant.
-- Migrations here run as `postgres`, so these defaults apply to them.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- auth ---------------------------------------------------------------------
-- A trimmed auth.users with the columns GoTrue writes that app code/triggers
-- might read. Only service_role / postgres can touch it, as on Supabase.
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid,
  aud text default 'authenticated',
  role text default 'authenticated',
  email text unique,
  encrypted_password text,
  email_confirmed_at timestamptz default now(),
  phone text unique,
  raw_app_meta_data jsonb not null default '{}'::jsonb,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  is_anonymous boolean not null default false,
  banned_until timestamptz,
  last_sign_in_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant all on auth.users to service_role;

-- Same lookup order as Supabase's auth.uid()/auth.role(): legacy per-claim
-- GUC first, then the full claims JSON. The helpers set both.
create function auth.uid() returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create function auth.role() returns text
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

create function auth.email() returns text
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;

create function auth.jwt() returns jsonb
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;

-- storage ------------------------------------------------------------------
create table storage.buckets (
  id text primary key,
  name text not null unique,
  owner uuid,
  public boolean default false,
  avif_autodetection boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  owner_id text,
  metadata jsonb,
  user_metadata jsonb,
  version text,
  path_tokens text[] generated always as (string_to_array(name, '/')) stored,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_accessed_at timestamptz default now(),
  unique (bucket_id, name)
);

alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;
grant all on storage.buckets, storage.objects to anon, authenticated, service_role;

-- Verbatim logic of Supabase's storage helpers.
create function storage.foldername(name text) returns text[]
language plpgsql immutable
as $$
declare
  _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1:array_length(_parts, 1) - 1];
end
$$;

create function storage.filename(name text) returns text
language plpgsql immutable
as $$
declare
  _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[array_length(_parts, 1)];
end
$$;

create function storage.extension(name text) returns text
language plpgsql immutable
as $$
declare
  _parts text[];
  _filename text;
begin
  select string_to_array(name, '/') into _parts;
  select _parts[array_length(_parts, 1)] into _filename;
  return reverse(split_part(reverse(_filename), '.', 1));
end
$$;

-- pg_cron stub ---------------------------------------------------------------
-- `create extension pg_cron` is skipped by the migration loader; schedule()
-- just records the job so tests can assert what got scheduled. Nothing runs.
create table cron.job (
  jobid bigserial primary key,
  schedule text not null,
  command text not null,
  jobname text unique,
  active boolean not null default true
);

create function cron.schedule(job_name text, schedule text, command text) returns bigint
language plpgsql
as $$
declare
  v_id bigint;
begin
  insert into cron.job (jobname, schedule, command) values (job_name, schedule, command)
  on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command
  returning jobid into v_id;
  return v_id;
end
$$;

create function cron.schedule(schedule text, command text) returns bigint
language sql
as $$
  insert into cron.job (schedule, command) values (schedule, command) returning jobid
$$;

create function cron.unschedule(job_name text) returns boolean
language plpgsql
as $$
begin
  delete from cron.job where jobname = job_name;
  return found;
end
$$;

create function cron.unschedule(job_id bigint) returns boolean
language plpgsql
as $$
begin
  delete from cron.job where jobid = job_id;
  return found;
end
$$;

-- pg_net stub ----------------------------------------------------------------
-- `create extension pg_net` is skipped by the loader; http_post() records the
-- request in net.http_request_queue (as the real extension queues it) and
-- returns its id. No request is ever sent.
create table net.http_request_queue (
  id bigserial primary key,
  method text not null,
  url text not null,
  headers jsonb,
  body jsonb,
  timeout_milliseconds integer,
  created_at timestamptz not null default now()
);

create function net.http_post(
  url text,
  body jsonb default '{}'::jsonb,
  params jsonb default '{}'::jsonb,
  headers jsonb default '{"Content-Type": "application/json"}'::jsonb,
  timeout_milliseconds integer default 5000
) returns bigint
language sql
as $$
  insert into net.http_request_queue (method, url, headers, body, timeout_milliseconds)
  values ('POST', url, headers, body, timeout_milliseconds)
  returning id
$$;

-- vault stub -----------------------------------------------------------------
-- Secrets are stored in plain text; decrypted_secrets is a plain view.
create table vault.secrets (
  id uuid primary key default gen_random_uuid(),
  name text unique,
  description text not null default '',
  secret text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create view vault.decrypted_secrets as
  select id, name, description, secret, secret as decrypted_secret, created_at, updated_at
  from vault.secrets;

-- Realtime -----------------------------------------------------------------
-- Supabase creates this (empty) publication in every project; migrations
-- `alter publication supabase_realtime add table ...`.
create publication supabase_realtime;
