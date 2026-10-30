import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  asAnon,
  asService,
  asUser,
  createBillboard,
  createBooking,
  createDb,
  createUser,
  listMigrations,
  rewriteMigration,
  rpc,
  type Db,
} from './harness'

describe('db harness smoke', () => {
  let db: Db

  beforeAll(async () => {
    db = await createDb()
  })
  afterAll(async () => {
    await db?.close()
  })

  it('discovers every migration in filename order', () => {
    const names = listMigrations().map((m) => m.name)
    expect(names[0]).toBe('0001_init_schema.sql')
    expect(names.length).toBeGreaterThanOrEqual(28)
    expect([...names].sort()).toEqual(names)
  })

  it('only rewrites create extension for stubbed extensions', () => {
    const sql =
      'create extension if not exists pg_cron;\ncreate extension if not exists postgis;'
    const out = rewriteMigration(sql)
    expect(out).toContain('-- [pglite harness] skipped, pg_cron')
    expect(out).toContain('\ncreate extension if not exists postgis;')
  })

  it('applies all migrations (key tables exist)', async () => {
    const { rows } = await db.query<{ table_name: string }>(
      `select table_name from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE'`,
    )
    const tables = rows.map((r) => r.table_name)
    for (const t of [
      'profiles',
      'billboards',
      'bookings',
      'payments',
      'reviews',
      'notifications',
      'chat_threads',
      'chat_messages',
      'campaigns',
      'payouts',
      'booking_events',
      'booking_documents',
    ]) {
      expect(tables).toContain(t)
    }
  })

  it('has RLS enabled on every app table in public', async () => {
    const { rows } = await db.query<{ relname: string }>(
      `select c.relname from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
          -- created by PostGIS itself (same on Supabase when postgis lives in public)
          and c.relname <> 'spatial_ref_sys'`,
    )
    expect(rows.map((r) => r.relname)).toEqual([])
  })

  it('uses real PostGIS (billboards_near finds a board within radius)', async () => {
    const owner = await createUser(db, { role: 'rentor' })
    const bb = await createBillboard(db, owner.id, {
      lat: 6.9271,
      lng: 79.8612,
    })
    const near = await asAnon(db, (tx) =>
      rpc<{ id: string }>(tx, 'billboards_near', {
        p_lat: 6.93,
        p_lng: 79.86,
        p_radius_km: 2,
      }),
    )
    expect(near.map((r) => r.id)).toContain(bb.id)
    const far = await asAnon(db, (tx) =>
      rpc<{ id: string }>(tx, 'billboards_near', {
        p_lat: 7.29,
        p_lng: 80.63,
        p_radius_km: 2,
      }),
    )
    expect(far.map((r) => r.id)).not.toContain(bb.id)
  })

  it('creates profiles via the auth trigger and switches roles', async () => {
    const renter = await createUser(db, { role: 'renter' })
    const admin = await createUser(db, { role: 'admin' })
    const roles = await db.query<{ id: string; role: string }>(
      `select id, role from public.profiles where id = any($1)`,
      [[renter.id, admin.id]],
    )
    expect(Object.fromEntries(roles.rows.map((r) => [r.id, r.role]))).toEqual({
      [renter.id]: 'renter',
      [admin.id]: 'admin',
    })

    const who = await asUser(db, renter.id, (tx) =>
      tx.query<{ uid: string; role: string }>(
        `select auth.uid() as uid, current_user as role`,
      ),
    )
    expect(who.rows[0]).toEqual({ uid: renter.id, role: 'authenticated' })

    const anon = await asAnon(db, (tx) =>
      tx.query<{ uid: string | null; role: string }>(
        `select auth.uid() as uid, current_user as role`,
      ),
    )
    expect(anon.rows[0]).toEqual({ uid: null, role: 'anon' })

    // Role/claims are transaction-local: back to the superuser afterwards.
    const after = await db.query<{ uid: string | null; role: string }>(
      `select auth.uid() as uid, current_user as role`,
    )
    expect(after.rows[0]).toEqual({ uid: null, role: 'postgres' })
  })

  it('enforces RLS for authenticated users and bypasses it for service_role', async () => {
    const a = await createUser(db)
    const b = await createUser(db)
    const seenByA = await asUser(db, a.id, (tx) =>
      tx.query<{ id: string }>(
        `select id from public.profiles where id = any($1)`,
        [[a.id, b.id]],
      ),
    )
    expect(seenByA.rows.map((r) => r.id)).toEqual([a.id])

    const seenByService = await asService(db, (tx) =>
      tx.query<{ id: string }>(
        `select id from public.profiles where id = any($1)`,
        [[a.id, b.id]],
      ),
    )
    expect(seenByService.rows).toHaveLength(2)
  })

  it('surfaces permission errors with their SQLSTATE', async () => {
    await expect(
      asAnon(db, (tx) => tx.query(`select * from auth.users`)),
    ).rejects.toMatchObject({
      code: '42501',
    })
  })

  it('runs the real request_booking RPC and rolls back failed calls', async () => {
    const owner = await createUser(db, { role: 'rentor' })
    const renter = await createUser(db)
    const bb = await createBillboard(db, owner.id, { price_per_day: 500 })
    const booking = await createBooking(db, renter.id, bb.id)
    expect(booking.status).toBe('pending_owner_review')
    expect(Number(booking.price_quoted)).toBe(1500)

    await expect(createBooking(db, renter.id, bb.id)).rejects.toThrow(
      'Selected dates overlap an existing booking',
    )
  })

  it('stubs storage, cron, net and vault', async () => {
    const buckets = await db.query<{ id: string }>(
      `select id from storage.buckets order by id`,
    )
    expect(buckets.rows.map((r) => r.id)).toEqual([
      'billboard-images',
      'booking-creatives',
      'chat-attachments',
      'site-assets',
    ])
    expect(
      (
        await db.query<{ f: string[] }>(
          `select storage.foldername('a/b/c.png') as f`,
        )
      ).rows[0].f,
    ).toEqual(['a', 'b'])
    const jobs = await db.query<{ jobname: string }>(
      `select jobname from cron.job`,
    )
    expect(jobs.rows.map((r) => r.jobname)).toContain('run-scheduled-jobs')
    const pub = await db.query<{ tablename: string }>(
      `select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1`,
    )
    expect(pub.rows.map((r) => r.tablename)).toEqual([
      'booking_events',
      'chat_messages',
      'notifications',
    ])
  })

  it('supports btree_gist exclusion constraints', async () => {
    const scratch = await createDb()
    try {
      await scratch.exec(`
        create extension if not exists btree_gist;
        create table t (room uuid, during daterange,
          exclude using gist (room with =, during with &&));
        insert into t values ('00000000-0000-0000-0000-000000000001', '[2030-01-01,2030-01-05]');
      `)
      await expect(
        scratch.query(
          `insert into t values ('00000000-0000-0000-0000-000000000001', '[2030-01-03,2030-01-08]')`,
        ),
      ).rejects.toMatchObject({ code: '23P01' })
    } finally {
      await scratch.close()
    }
  })
})
