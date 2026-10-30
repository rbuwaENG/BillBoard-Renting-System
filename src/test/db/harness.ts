/**
 * In-process Postgres test harness (PGlite = real Postgres compiled to WASM).
 *
 * createDb() gives a fresh database with src/test/db/bootstrap.sql (Supabase
 * stubs) and every file in supabase/migrations/ applied in filename order.
 * The migrated state is built once per test file and cached as a data-dir
 * snapshot, so each createDb() after the first only restores the snapshot.
 *
 * Queries run as the PGlite superuser `postgres` unless wrapped in
 * asAnon / asUser / asService, which open a transaction, `set local role`
 * and set the JWT claim GUCs exactly like PostgREST does per request.
 *
 * See README.md in this folder for usage and fidelity limits.
 */
import { createHash } from 'node:crypto'
import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'
import { PGlite, type Transaction } from '@electric-sql/pglite'
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist'
import { postgis } from '@electric-sql/pglite-postgis'
import bootstrapSql from './bootstrap.sql?raw'

export type Db = PGlite
export type Tx = Transaction
/** Anything that can run a query: a Db or a Tx from one of the as* helpers. */
export type Queryable = Pick<Transaction, 'query' | 'exec'>

const extensions = { postgis, btree_gist }

// ---------------------------------------------------------------------------
// Migrations
// ---------------------------------------------------------------------------

// Vite resolves this glob at transform time, so new migration files are
// picked up automatically (filename order = apply order).
const migrationFiles = import.meta.glob<string>('/supabase/migrations/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
})

export interface Migration {
  name: string
  sql: string
}

/**
 * Extensions the migrations create that PGlite can't load. Their objects are
 * stubbed in bootstrap.sql instead, so the `create extension` statement is
 * commented out by the loader (the only rewrite it performs — the migration
 * files themselves are never modified).
 * postgis and btree_gist are NOT here: they are real PGlite extensions.
 */
const STUBBED_EXTENSIONS = ['pg_cron', 'pg_net', 'supabase_vault', 'pgsodium']

const stubbedExtensionRe = new RegExp(
  String.raw`^[ \t]*create\s+extension\s+(?:if\s+not\s+exists\s+)?"?(${STUBBED_EXTENSIONS.join('|')})"?[^;]*;`,
  'gim',
)

/** Applies the loader rewrites (see STUBBED_EXTENSIONS) to one migration. */
export function rewriteMigration(sql: string): string {
  return sql.replace(
    stubbedExtensionRe,
    (stmt, ext: string) =>
      `-- [pglite harness] skipped, ${ext} is stubbed in bootstrap.sql: ${stmt.replace(/\s+/g, ' ')}`,
  )
}

/** All migrations in apply order, with loader rewrites applied. */
export function listMigrations(): Migration[] {
  return Object.entries(migrationFiles)
    .map(([path, sql]) => ({
      name: path.split('/').pop()!,
      sql: rewriteMigration(sql),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

async function buildMigratedDb(): Promise<Db> {
  const db = await PGlite.create({ extensions })
  await db.exec(bootstrapSql)
  for (const m of listMigrations()) {
    try {
      // Supabase CLI applies each migration file in its own transaction.
      await db.transaction((tx) => tx.exec(m.sql))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      throw new Error(`Migration ${m.name} failed: ${message}`, { cause: err })
    }
  }
  return db
}

// The migrated data dir is cached in memory (per test file) and on disk under
// node_modules/.cache, keyed by a hash of the bootstrap, every migration and
// the PGlite versions, so only the first test file of a run (or the first run
// after a migration changes) pays for building it. Delete the folder or set
// PGLITE_NO_CACHE=1 to force a rebuild.
const CACHE_DIR = path.resolve('node_modules/.cache/pglite-harness')

async function snapshotKey(): Promise<string> {
  const h = createHash('sha256')
  // A data dir is only valid for the Postgres/extension build that wrote it.
  for (const pkg of ['@electric-sql/pglite', '@electric-sql/pglite-postgis']) {
    try {
      const { version } = JSON.parse(
        await readFile(`node_modules/${pkg}/package.json`, 'utf8'),
      )
      h.update(`${pkg}@${version}\0`)
    } catch {
      h.update(`${pkg}@unknown\0`)
    }
  }
  h.update(bootstrapSql)
  for (const m of listMigrations())
    h.update('\0').update(m.name).update('\0').update(m.sql)
  return h.digest('hex').slice(0, 16)
}

async function loadOrBuildSnapshot(): Promise<Blob> {
  const useDisk = !process.env.PGLITE_NO_CACHE
  const file = path.join(CACHE_DIR, `migrated-${await snapshotKey()}.tar`)
  if (useDisk) {
    try {
      return new Blob([await readFile(file)])
    } catch {
      // cache miss, build below
    }
  }
  const db = await buildMigratedDb()
  const dump = await db.dumpDataDir('none')
  await db.close()
  if (useDisk) {
    try {
      await mkdir(CACHE_DIR, { recursive: true })
      const tmp = `${file}.${process.pid}.tmp`
      await writeFile(tmp, Buffer.from(await dump.arrayBuffer()))
      await rename(tmp, file)
      // Drop snapshots for older migration sets (~65 MB each).
      for (const f of await readdir(CACHE_DIR)) {
        if (f.startsWith('migrated-') && f !== path.basename(file)) {
          await rm(path.join(CACHE_DIR, f), { force: true })
        }
      }
    } catch {
      // read-only FS etc. — the in-memory snapshot still works
    }
  }
  return dump
}

let snapshot: Promise<Blob> | undefined

function migratedSnapshot(): Promise<Blob> {
  snapshot ??= loadOrBuildSnapshot()
  return snapshot
}

/** A fresh, fully migrated database. Close it with `db.close()` when done. */
export async function createDb(): Promise<Db> {
  return PGlite.create({ extensions, loadDataDir: await migratedSnapshot() })
}

// ---------------------------------------------------------------------------
// Running SQL as a Supabase role
// ---------------------------------------------------------------------------

export type ApiRole = 'anon' | 'authenticated' | 'service_role'

/**
 * Runs `fn` inside a transaction as `role` with the given JWT claims, the
 * way PostgREST handles one request. Commits if `fn` resolves, rolls back
 * (and rethrows) if it rejects.
 */
export async function asRole<T>(
  db: Db,
  role: ApiRole,
  claims: Record<string, unknown>,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query(
      `select set_config('request.jwt.claims', $1, true),
              set_config('request.jwt.claim.sub', $2, true),
              set_config('request.jwt.claim.role', $3, true)`,
      [JSON.stringify(claims), String(claims.sub ?? ''), role],
    )
    // role is a closed union, safe to inline (SET doesn't take parameters).
    await tx.exec(`set local role ${role}`)
    return fn(tx)
  })
}

/** As the `anon` role with no JWT subject (auth.uid() is null). */
export function asAnon<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return asRole(db, 'anon', { role: 'anon' }, fn)
}

/** As `authenticated` with auth.uid() = userId. */
export function asUser<T>(
  db: Db,
  userId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return asRole(
    db,
    'authenticated',
    { sub: userId, role: 'authenticated', aud: 'authenticated' },
    fn,
  )
}

/** As `service_role` (BYPASSRLS, like the service key / edge functions). */
export function asService<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return asRole(db, 'service_role', { role: 'service_role' }, fn)
}

/**
 * Calls a public function with named arguments, like supabase-js
 * `.rpc(name, args)`. Returns the result rows (`select * from fn(...)`).
 */
export async function rpc<T = Record<string, unknown>>(
  q: Queryable,
  fn: string,
  args: Record<string, unknown> = {},
): Promise<T[]> {
  if (!/^[a-z_][a-z0-9_]*$/.test(fn))
    throw new Error(`Invalid function name: ${fn}`)
  const names = Object.keys(args)
  for (const n of names) {
    if (!/^[a-z_][a-z0-9_]*$/.test(n))
      throw new Error(`Invalid argument name: ${n}`)
  }
  const list = names.map((n, i) => `${n} => $${i + 1}`).join(', ')
  const res = await q.query<T>(
    `select * from public.${fn}(${list})`,
    Object.values(args),
  )
  return res.rows
}

// ---------------------------------------------------------------------------
// Fixtures (written as the superuser, i.e. bypassing RLS, unless noted)
// ---------------------------------------------------------------------------

/** 'YYYY-MM-DD' for today (UTC) + n days. */
export function daysFromNow(n: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export type ProfileRole = 'renter' | 'rentor' | 'admin'

export interface TestUser {
  id: string
  email: string
  role: ProfileRole
}

let userSeq = 0

/**
 * Inserts an auth.users row (the 0002 `on_auth_user_created` trigger creates
 * the profile from raw_user_meta_data, like a real sign-up), then promotes to
 * admin / suspends with a superuser update when asked.
 */
export async function createUser(
  db: Db,
  opts: {
    role?: ProfileRole
    email?: string
    displayName?: string
    phone?: string
    status?: 'active' | 'suspended'
  } = {},
): Promise<TestUser> {
  const role = opts.role ?? 'renter'
  userSeq += 1
  const email =
    opts.email ??
    `${role}${userSeq}-${Math.random().toString(36).slice(2, 8)}@example.test`
  const meta = {
    display_name: opts.displayName ?? `${role} ${userSeq}`,
    // handle_new_user only honours renter/rentor; admin is set below.
    role: role === 'admin' ? 'renter' : role,
  }
  const { rows } = await db.query<{ id: string }>(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
    [email, JSON.stringify(meta)],
  )
  const id = rows[0].id
  if (role === 'admin' || opts.status || opts.phone) {
    await db.query(
      `update public.profiles
          set role = $2,
              status = coalesce($3, status),
              phone = coalesce($4, phone)
        where id = $1`,
      [id, role, opts.status ?? null, opts.phone ?? null],
    )
  }
  return { id, email, role }
}

export interface BillboardRow {
  id: string
  owner_id: string
  title: string
  status: string
  price_per_day: string
  [col: string]: unknown
}

/** Inserts a billboard directly (superuser). Defaults: active, Colombo, 1000/day. */
export async function createBillboard(
  db: Db,
  ownerId: string,
  overrides: Partial<{
    title: string
    status: string
    price_per_day: number
    sale_price_per_day: number | null
    admin_price_override_per_day: number | null
    lat: number
    lng: number
    city: string
    district: string
  }> = {},
): Promise<BillboardRow> {
  const values: Record<string, unknown> = {
    title: 'Test billboard',
    status: 'active',
    price_per_day: 1000,
    lat: 6.9271,
    lng: 79.8612,
    city: 'Colombo',
    district: 'Colombo',
    ...overrides,
    owner_id: ownerId,
  }
  const cols = Object.keys(values)
  const { rows } = await db.query<BillboardRow>(
    `insert into public.billboards (${cols.join(', ')})
     values (${cols.map((_, i) => `$${i + 1}`).join(', ')})
     returning *`,
    Object.values(values),
  )
  return rows[0]
}

export interface BookingRow {
  id: string
  billboard_id: string
  owner_id: string
  renter_id: string
  status: string
  price_quoted: string
  start_date: Date
  end_date: Date
  [col: string]: unknown
}

/** Requests a booking through the real `request_booking` RPC, as the renter. */
export async function createBooking(
  db: Db,
  renterId: string,
  billboardId: string,
  opts: {
    startDate?: string
    endDate?: string
    creativeUrl?: string | null
  } = {},
): Promise<BookingRow> {
  const startDate = opts.startDate ?? daysFromNow(7)
  const endDate = opts.endDate ?? daysFromNow(9)
  const [row] = await asUser(db, renterId, (tx) =>
    rpc<BookingRow>(tx, 'request_booking', {
      p_billboard_id: billboardId,
      p_start_date: startDate,
      p_end_date: endDate,
      p_creative_url: opts.creativeUrl ?? null,
    }),
  )
  return row
}

/** Owner approves (or rejects) via `respond_to_booking`. */
export async function respondToBooking(
  db: Db,
  ownerId: string,
  bookingId: string,
  approve = true,
  reason: string | null = null,
): Promise<BookingRow> {
  const [row] = await asUser(db, ownerId, (tx) =>
    rpc<BookingRow>(tx, 'respond_to_booking', {
      p_booking_id: bookingId,
      p_approve: approve,
      p_reason: reason,
    }),
  )
  return row
}

/** Admin confirms payment via `admin_confirm_payment` (amount defaults to price_quoted). */
export async function confirmPayment(
  db: Db,
  adminId: string,
  bookingId: string,
  amount?: number | string,
): Promise<Record<string, unknown>> {
  const amt =
    amount ??
    (
      await db.query<{ price_quoted: string }>(
        `select price_quoted from public.bookings where id = $1`,
        [bookingId],
      )
    ).rows[0].price_quoted
  const [row] = await asUser(db, adminId, (tx) =>
    rpc(tx, 'admin_confirm_payment', {
      p_booking_id: bookingId,
      p_amount: amt,
    }),
  )
  return row
}

/**
 * Convenience scenario: an owner (rentor) with an active billboard and a
 * renter, plus an admin.
 */
export async function seedMarketplace(db: Db) {
  const owner = await createUser(db, {
    role: 'rentor',
    phone: '+94 77 000 0000',
  })
  const renter = await createUser(db, { role: 'renter' })
  const admin = await createUser(db, { role: 'admin' })
  const billboard = await createBillboard(db, owner.id)
  return { owner, renter, admin, billboard }
}
