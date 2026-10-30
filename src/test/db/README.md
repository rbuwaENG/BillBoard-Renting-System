# Database tests (PGlite harness)

`npm run test:db` runs `src/test/db/**/*.test.ts` against a real Postgres 18
compiled to WASM ([PGlite](https://pglite.dev)) — no Docker, Supabase CLI or
network needed. Config: `vitest.db.config.ts` (node environment, one fork,
long timeouts). The app suite (`npm test`, jsdom) must exclude this folder.

## What a database contains

`createDb()` returns a fresh database with:

1. `bootstrap.sql` — stubs of the Supabase-managed objects the migrations use
   (below), run as the superuser `postgres`.
2. Every `supabase/migrations/*.sql`, in filename order, each in its own
   transaction. New migration files are picked up automatically
   (`import.meta.glob`). A failing migration throws `Migration <file> failed: …`.

The migrated data dir is built once and cached — in memory per test file and on
disk in `node_modules/.cache/pglite-harness/`, keyed by a hash of the bootstrap,
all migrations and the PGlite versions. First build ≈ 10 s; every
`createDb()` afterwards restores the snapshot in ≈ 3 s, so prefer one DB per
`describe` (`beforeAll`) over one per test. `PGLITE_NO_CACHE=1` forces a rebuild.

## API (`harness.ts`)

| Helper                                                               | What it does                                                                                                                   |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `createDb()`                                                         | Fresh migrated DB. `await db.close()` in `afterAll`. Bare `db.query()` runs as superuser (no RLS, `auth.uid()` null).          |
| `asAnon(db, tx => …)`                                                | Transaction with `set local role anon`, no JWT subject.                                                                        |
| `asUser(db, userId, tx => …)`                                        | `set local role authenticated` + `request.jwt.claim.sub` / `request.jwt.claims` = userId, like PostgREST.                      |
| `asService(db, tx => …)`                                             | `service_role` (BYPASSRLS).                                                                                                    |
| `asRole(db, role, claims, fn)`                                       | The general form (custom claims for `auth.jwt()`).                                                                             |
| `rpc(q, 'fn_name', { p_arg: … })`                                    | `select * from public.fn_name(p_arg => $1, …)`, like `supabase.rpc`. Returns rows.                                             |
| `createUser(db, { role, email?, displayName?, phone?, status? })`    | Inserts `auth.users`; the real `on_auth_user_created` trigger makes the profile; admin/status/phone set by a superuser update. |
| `createBillboard(db, ownerId, overrides?)`                           | Superuser insert, defaults: active, Colombo, 1000/day.                                                                         |
| `createBooking(db, renterId, billboardId, { startDate?, endDate? })` | Real `request_booking` RPC as the renter. Default dates today+7..+9.                                                           |
| `respondToBooking(db, ownerId, bookingId, approve?, reason?)`        | Real `respond_to_booking` as the owner.                                                                                        |
| `confirmPayment(db, adminId, bookingId, amount?)`                    | Real `admin_confirm_payment` (amount defaults to `price_quoted`).                                                              |
| `seedMarketplace(db)`                                                | `{ owner (rentor, with phone), renter, admin, billboard }`.                                                                    |
| `daysFromNow(n)`                                                     | `'YYYY-MM-DD'` (UTC; PGlite's `current_date` is UTC too).                                                                      |

`as*` helpers commit when the callback resolves and roll back + rethrow when it
rejects, so `await expect(asAnon(db, tx => rpc(tx, 'x'))).rejects.toThrow(/…/)`
works and leaves no partial writes. Postgres errors carry `.code` (SQLSTATE):
`rejects.toMatchObject({ code: '42501' })` for permission denied, `'23503'` FK,
`'23P01'` exclusion violation. Check grants directly with
`has_function_privilege('anon', 'public.f(uuid)', 'execute')` /
`has_column_privilege(...)`.

## KNOWN HOLE tests

`security.test.ts`, `privacy.test.ts` and `payments.test.ts` start with
`describe('KNOWN HOLE (fixed in 00xx) …')` blocks that assert today's insecure
behaviour (proving the harness reproduces it). The wave-2 agent that owns the
file inverts each block when its migration fixes the hole.

## Stubs (bootstrap.sql) and loader rewrites

- **Roles** `anon`, `authenticated`, `service_role` (bypassrls), with Supabase's
  real grants: `usage` on public/auth/storage/extensions, and
  `alter default privileges in schema public grant all on tables / functions /
sequences to anon, authenticated, service_role`. So `revoke … from public`
  does **not** remove anon's EXECUTE — exactly as on Supabase.
- **auth**: `auth.users` (trimmed column set), `auth.uid()`, `auth.role()`,
  `auth.email()`, `auth.jwt()` reading `request.jwt.claim.*` / `request.jwt.claims`.
- **storage**: `storage.buckets` (incl. `file_size_limit`, `allowed_mime_types`),
  `storage.objects` (RLS on), `storage.foldername/filename/extension` (Supabase's
  own logic). Policies can be tested by inserting into `storage.objects` as a user.
- **pg_cron**: `cron.job` table + `cron.schedule/unschedule` that only record jobs.
- **pg_net**: `net.http_post` records into `net.http_request_queue`, sends nothing.
- **vault**: `vault.secrets` (plain text) + `vault.decrypted_secrets` view.
- **Realtime**: an empty `supabase_realtime` publication.
- **PostGIS and btree_gist are real** (`@electric-sql/pglite-postgis`,
  `@electric-sql/pglite/contrib/btree_gist`); migrations' `create extension`
  for them runs unchanged.
- **Only loader rewrite**: `create extension [if not exists] pg_cron | pg_net |
supabase_vault | pgsodium …;` is commented out (`STUBBED_EXTENSIONS` in
  `harness.ts`). Migration files are never modified.

## Fidelity limits vs real Supabase

- No PostgREST: tests call SQL/RPCs directly. PostgREST-only behaviour (schema
  exposure, `Prefer` headers, embedded selects, error JSON shape) is not covered.
- No GoTrue, Storage API, Realtime, cron worker or HTTP: the stubs only record.
  Storage size/MIME limits on `storage.buckets` are enforced by the Storage API,
  not Postgres — assert the column values, not upload rejection.
- PGlite's superuser `postgres` runs migrations; on Supabase `postgres` is not a
  superuser (but owns the tables and bypasses RLS the same way). Something that
  needs superuser would pass here and fail on Supabase.
- Single connection: no real concurrency. Race conditions (e.g. two parallel
  `request_booking`s) can't be reproduced; test constraints (exclusion, unique)
  rather than interleavings.
- Postgres 18 (PGlite 0.5.10) + PGlite's PostGIS build; your Supabase project may run an older major (check `select version()`).
- `auth.users` is a subset of the real table; Supabase-internal schemas
  (`auth.sessions`, `storage.migrations`, …) don't exist.
