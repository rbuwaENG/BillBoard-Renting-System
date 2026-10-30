import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  asAnon,
  asUser,
  confirmPayment,
  createBooking,
  createDb,
  createUser,
  daysFromNow,
  respondToBooking,
  rpc,
  seedMarketplace,
  type Db,
} from './harness'

// Owned by F1 (0034_admin_audit_log.sql). Contract 8: admin_audit_log rows
// for profiles(role,status), billboards(status, override), payments(status),
// payouts(status); admin-only SELECT. Plus: suspended admins aren't admins.

type Market = Awaited<ReturnType<typeof seedMarketplace>>

interface AuditRow {
  actor_id: string | null
  action: string
  entity: string
  entity_id: string
  before: Record<string, unknown>
  after: Record<string, unknown>
}

async function auditFor(db: Db, entityId: string): Promise<AuditRow[]> {
  const { rows } = await db.query<AuditRow>(
    `select actor_id, action, entity, entity_id, before, after
       from public.admin_audit_log where entity_id = $1
      order by created_at, id`,
    [entityId],
  )
  return rows
}

let seq = 0
async function approvedBooking(db: Db, s: Market) {
  seq += 1
  const start = 10 + seq * 5
  const booking = await createBooking(db, s.renter.id, s.billboard.id, {
    startDate: daysFromNow(start),
    endDate: daysFromNow(start + 2),
  })
  await respondToBooking(db, s.owner.id, booking.id, true)
  return booking
}

describe('admin_audit_log triggers (0034)', () => {
  let db: Db
  let s: Market

  beforeAll(async () => {
    db = await createDb()
    s = await seedMarketplace(db)
  })
  afterAll(async () => {
    await db?.close()
  })

  it('logs admin role and status changes on profiles (changed columns only)', async () => {
    const user = await createUser(db, { role: 'renter' })
    await asUser(db, s.admin.id, (tx) =>
      tx.query(
        `update public.profiles set status = 'suspended' where id = $1`,
        [user.id],
      ),
    )
    await asUser(db, s.admin.id, (tx) =>
      tx.query(
        `update public.profiles set role = 'rentor', status = 'active' where id = $1`,
        [user.id],
      ),
    )
    expect(await auditFor(db, user.id)).toEqual([
      {
        actor_id: s.admin.id,
        action: 'status_changed',
        entity: 'profile',
        entity_id: user.id,
        before: { status: 'active' },
        after: { status: 'suspended' },
      },
      {
        actor_id: s.admin.id,
        action: 'role_changed,status_changed',
        entity: 'profile',
        entity_id: user.id,
        before: { role: 'renter', status: 'suspended' },
        after: { role: 'rentor', status: 'active' },
      },
    ])
  })

  it('ignores no-op updates and unaudited columns', async () => {
    const user = await createUser(db, { role: 'renter' })
    await asUser(db, s.admin.id, (tx) =>
      tx.query(
        `update public.profiles set status = 'active', display_name = 'Renamed' where id = $1`,
        [user.id],
      ),
    )
    await asUser(db, user.id, (tx) =>
      tx.query(`update public.profiles set display_name = 'Me' where id = $1`, [
        user.id,
      ]),
    )
    expect(await auditFor(db, user.id)).toEqual([])
  })

  it('logs admin billboard moderation and price overrides', async () => {
    await asUser(db, s.admin.id, (tx) =>
      rpc(tx, 'admin_set_billboard_status', {
        p_billboard_id: s.billboard.id,
        p_status: 'flagged',
        p_reason: 'Misleading photos',
      }),
    )
    await asUser(db, s.admin.id, (tx) =>
      tx.query(
        `update public.billboards set admin_price_override_per_day = 750 where id = $1`,
        [s.billboard.id],
      ),
    )
    await asUser(db, s.admin.id, (tx) =>
      rpc(tx, 'admin_set_billboard_status', {
        p_billboard_id: s.billboard.id,
        p_status: 'active',
      }),
    )
    expect(await auditFor(db, s.billboard.id)).toEqual([
      expect.objectContaining({
        actor_id: s.admin.id,
        action: 'status_changed',
        entity: 'billboard',
        before: { status: 'active' },
        after: { status: 'flagged' },
      }),
      expect.objectContaining({
        action: 'admin_price_override_per_day_changed',
        before: { admin_price_override_per_day: null },
        after: { admin_price_override_per_day: 750 },
      }),
      expect.objectContaining({
        action: 'status_changed',
        before: { status: 'flagged' },
        after: { status: 'active' },
      }),
    ])
  })

  it('does not log owner self-service between active / inactive / archived', async () => {
    const owner = await createUser(db, { role: 'rentor' })
    const { rows } = await db.query<{ id: string }>(
      `insert into public.billboards (owner_id, title, price_per_day, lat, lng, city, district)
       values ($1, 'Own board', 500, 6.9, 79.8, 'Colombo', 'Colombo') returning id`,
      [owner.id],
    )
    const id = rows[0].id
    for (const status of ['inactive', 'active', 'archived']) {
      await asUser(db, owner.id, (tx) =>
        tx.query(`update public.billboards set status = $2 where id = $1`, [
          id,
          status,
        ]),
      )
    }
    expect(await auditFor(db, id)).toEqual([])
    // ...but the same change made by an admin is logged.
    await asUser(db, s.admin.id, (tx) =>
      tx.query(
        `update public.billboards set status = 'inactive' where id = $1`,
        [id],
      ),
    )
    expect(await auditFor(db, id)).toEqual([
      expect.objectContaining({
        actor_id: s.admin.id,
        before: { status: 'archived' },
        after: { status: 'inactive' },
      }),
    ])
  })

  it('logs payment confirmation and rejection', async () => {
    const a = await approvedBooking(db, s)
    const [submitted] = await asUser(db, s.renter.id, (tx) =>
      rpc<{ id: string }>(tx, 'renter_submit_payment', { p_booking_id: a.id }),
    )
    await confirmPayment(db, s.admin.id, a.id)
    expect(await auditFor(db, submitted.id)).toEqual([
      {
        actor_id: s.admin.id,
        action: 'status_changed',
        entity: 'payment',
        entity_id: submitted.id,
        before: { status: 'pending' },
        after: { status: 'succeeded' },
      },
    ])

    const b = await approvedBooking(db, s)
    const [pending] = await asUser(db, s.renter.id, (tx) =>
      rpc<{ id: string }>(tx, 'renter_submit_payment', { p_booking_id: b.id }),
    )
    await asUser(db, s.admin.id, (tx) =>
      rpc(tx, 'admin_reject_payment', {
        p_payment_id: pending.id,
        p_reason: 'Not received',
      }),
    )
    expect(await auditFor(db, pending.id)).toEqual([
      expect.objectContaining({
        actor_id: s.admin.id,
        before: { status: 'pending' },
        after: { status: 'failed' },
      }),
    ])
  })

  it('logs payout status changes; system (no JWT) writes have a null actor', async () => {
    const booking = await approvedBooking(db, s)
    await confirmPayment(db, s.admin.id, booking.id)
    const [payout] = await asUser(db, s.admin.id, (tx) =>
      rpc<{ id: string }>(tx, 'admin_create_payout', {
        p_owner_id: s.owner.id,
        p_booking_ids: [booking.id],
        p_scheduled_release_date: daysFromNow(3),
      }),
    )
    await asUser(db, s.admin.id, (tx) =>
      rpc(tx, 'admin_release_payout', { p_payout_id: payout.id }),
    )
    // A cron/system write (superuser, no auth.uid()).
    await db.query(
      `update public.payouts set status = 'cancelled' where id = $1`,
      [payout.id],
    )
    expect(await auditFor(db, payout.id)).toEqual([
      expect.objectContaining({
        actor_id: s.admin.id,
        entity: 'payout',
        before: { status: 'approved' },
        after: { status: 'paid' },
      }),
      expect.objectContaining({
        actor_id: null,
        before: { status: 'paid' },
        after: { status: 'cancelled' },
      }),
    ])
  })
})

describe('admin_audit_log access (0034)', () => {
  let db: Db
  let s: Market

  beforeAll(async () => {
    db = await createDb()
    s = await seedMarketplace(db)
    const user = await createUser(db, { role: 'renter' })
    await asUser(db, s.admin.id, (tx) =>
      tx.query(
        `update public.profiles set status = 'suspended' where id = $1`,
        [user.id],
      ),
    )
  })
  afterAll(async () => {
    await db?.close()
  })

  const countAs = (userId: string) =>
    asUser(db, userId, (tx) =>
      tx.query(`select 1 from public.admin_audit_log`),
    ).then((r) => r.rows.length)

  it('admins read the log; owners and renters see nothing', async () => {
    expect(await countAs(s.admin.id)).toBeGreaterThan(0)
    expect(await countAs(s.owner.id)).toBe(0)
    expect(await countAs(s.renter.id)).toBe(0)
  })

  it('anon has no access at all', async () => {
    await expect(
      asAnon(db, (tx) => tx.query(`select 1 from public.admin_audit_log`)),
    ).rejects.toMatchObject({ code: '42501' })
  })

  it('no client can write, edit or delete log rows (not even admins)', async () => {
    for (const sql of [
      `insert into public.admin_audit_log (action, entity) values ('x', 'y')`,
      `update public.admin_audit_log set action = 'x'`,
      `delete from public.admin_audit_log`,
    ]) {
      await expect(
        asUser(db, s.admin.id, (tx) => tx.query(sql)),
      ).rejects.toMatchObject({ code: '42501' })
    }
  })

  it('the trigger function is not callable by the API roles', async () => {
    const { rows } = await db.query<{ anon: boolean; auth: boolean }>(
      `select has_function_privilege('anon', 'public.trg_admin_audit()', 'execute') as anon,
              has_function_privilege('authenticated', 'public.trg_admin_audit()', 'execute') as auth`,
    )
    expect(rows[0]).toEqual({ anon: false, auth: false })
  })
})

describe('suspended admins (0034 is_admin fix)', () => {
  let db: Db
  let s: Market
  let suspendedAdmin: string

  beforeAll(async () => {
    db = await createDb()
    s = await seedMarketplace(db)
    suspendedAdmin = (
      await createUser(db, { role: 'admin', status: 'suspended' })
    ).id
  })
  afterAll(async () => {
    await db?.close()
  })

  it('is_admin() is true only for active admins (null without a profile, as before)', async () => {
    const isAdmin = (userId: string) =>
      asUser(db, userId, (tx) =>
        tx.query<{ v: boolean | null }>(`select public.is_admin() as v`),
      ).then((r) => r.rows[0].v)
    expect(await isAdmin(s.admin.id)).toBe(true)
    expect(await isAdmin(suspendedAdmin)).toBe(false)
    expect(await isAdmin(s.renter.id)).toBe(false)
    const anon = await asAnon(db, (tx) =>
      tx.query<{ v: boolean | null }>(`select public.is_admin() as v`),
    )
    expect(anon.rows[0].v).toBeNull()
  })

  it('keeps the anon + authenticated EXECUTE grants', async () => {
    const { rows } = await db.query<{ anon: boolean; auth: boolean }>(
      `select has_function_privilege('anon', 'public.is_admin()', 'execute') as anon,
              has_function_privilege('authenticated', 'public.is_admin()', 'execute') as auth`,
    )
    expect(rows[0]).toEqual({ anon: true, auth: true })
  })

  it('cannot confirm payments', async () => {
    const booking = await createBooking(db, s.renter.id, s.billboard.id)
    await respondToBooking(db, s.owner.id, booking.id, true)
    await expect(
      confirmPayment(db, suspendedAdmin, booking.id),
    ).rejects.toThrow()
    const { rows } = await db.query<{ status: string }>(
      `select status from public.bookings where id = $1`,
      [booking.id],
    )
    expect(rows[0].status).toBe('payment_pending')
  })

  it('cannot list users or read other profiles', async () => {
    await expect(
      asUser(db, suspendedAdmin, (tx) => rpc(tx, 'admin_list_users')),
    ).rejects.toMatchObject({ code: '42501' })
    const { rows } = await asUser(db, suspendedAdmin, (tx) =>
      tx.query(`select id from public.profiles where id = $1`, [s.renter.id]),
    )
    // profiles_select (self or admin) — other rows are only visible through
    // the narrower counterparty/owner policies, which don't apply here.
    expect(rows).toEqual([])
  })

  it('cannot change other users or read the audit log', async () => {
    const res = await asUser(db, suspendedAdmin, (tx) =>
      tx.query(
        `update public.profiles set status = 'suspended' where id = $1`,
        [s.renter.id],
      ),
    )
    expect(res.affectedRows).toBe(0)
    const log = await asUser(db, suspendedAdmin, (tx) =>
      tx.query(`select 1 from public.admin_audit_log`),
    )
    expect(log.rows).toEqual([])
  })
})
