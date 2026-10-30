import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  asAnon,
  asUser,
  confirmPayment,
  createBillboard,
  createBooking,
  createDb,
  createUser,
  daysFromNow,
  respondToBooking,
  rpc,
  seedMarketplace,
  type Db,
} from './harness'

// Owned by DB-M (0032_booking_integrity.sql). Contracts 3 (bookings) and 4
// (availability).
//
// Note: the harness is a single connection, so two truly concurrent
// request_booking calls can't be reproduced. The pre-check in request_booking
// gives the friendly message for sequential requests; the `bookings_no_overlap`
// exclusion constraint (asserted directly below) is what makes concurrent
// requests safe, and request_booking translates its 23P01 to the same message.

type Seed = Awaited<ReturnType<typeof seedMarketplace>>

const BLOCKING_INSERT = `
  insert into public.bookings
    (billboard_id, owner_id, renter_id, start_date, end_date, price_quoted, status, created_at)
  values ($1, $2, $3, $4, $5, 100, $6, coalesce($7::timestamptz, now()))
  returning id`

async function insertBooking(
  db: Db,
  s: Seed,
  start: string,
  end: string,
  status: string,
  createdAt: string | null = null,
) {
  const { rows } = await db.query<{ id: string }>(BLOCKING_INSERT, [
    s.billboard.id,
    s.owner.id,
    s.renter.id,
    start,
    end,
    status,
    createdAt,
  ])
  return rows[0].id
}

function request(db: Db, userId: string, billboardId: string, start: string, end: string) {
  return asUser(db, userId, (tx) =>
    rpc(tx, 'request_booking', {
      p_billboard_id: billboardId,
      p_start_date: start,
      p_end_date: end,
    }),
  )
}

async function statusOf(db: Db, id: string) {
  const { rows } = await db.query<{ status: string; rejection_reason: string | null }>(
    `select status, rejection_reason from public.bookings where id = $1`,
    [id],
  )
  return rows[0]
}

describe('0032: request_booking rules', () => {
  let db: Db
  let s: Seed

  beforeAll(async () => {
    db = await createDb()
    s = await seedMarketplace(db)
  })
  afterAll(async () => {
    await db?.close()
  })

  it('accepts a valid request and keeps the pricing', async () => {
    const b = await createBooking(db, s.renter.id, s.billboard.id, {
      startDate: daysFromNow(1),
      endDate: daysFromNow(3),
    })
    expect(b.status).toBe('pending_owner_review')
    expect(Number(b.price_quoted)).toBe(3000)
  })

  it('rejects a start date in the past', async () => {
    await expect(
      request(db, s.renter.id, s.billboard.id, daysFromNow(-1), daysFromNow(2)),
    ).rejects.toThrow('Start date cannot be in the past')
  })

  it('rejects end before start', async () => {
    await expect(
      request(db, s.renter.id, s.billboard.id, daysFromNow(20), daysFromNow(19)),
    ).rejects.toThrow('End date must be on or after the start date')
  })

  it('rejects booking your own billboard', async () => {
    // A renter-role account that owns a board (e.g. demoted owner).
    const ownBoard = await createBillboard(db, s.renter.id)
    await expect(
      request(db, s.renter.id, ownBoard.id, daysFromNow(5), daysFromNow(6)),
    ).rejects.toThrow('You cannot book your own billboard')
  })

  it('rejects non-renter roles', async () => {
    for (const uid of [s.owner.id, s.admin.id]) {
      await expect(
        request(db, uid, s.billboard.id, daysFromNow(40), daysFromNow(41)),
      ).rejects.toThrow('Only renter accounts can request bookings')
    }
  })

  it('rejects anon and suspended users', async () => {
    await expect(
      asAnon(db, (tx) =>
        rpc(tx, 'request_booking', {
          p_billboard_id: s.billboard.id,
          p_start_date: daysFromNow(40),
          p_end_date: daysFromNow(41),
        }),
      ),
    ).rejects.toThrow()
    const suspended = await createUser(db, { role: 'renter', status: 'suspended' })
    await expect(
      request(db, suspended.id, s.billboard.id, daysFromNow(40), daysFromNow(41)),
    ).rejects.toThrow('Account suspended')
  })

  it('rejects inactive billboards', async () => {
    const inactive = await createBillboard(db, s.owner.id, { status: 'inactive' })
    await expect(
      request(db, s.renter.id, inactive.id, daysFromNow(5), daysFromNow(6)),
    ).rejects.toThrow('Billboard is not available for booking')
  })

  it('rejects overlapping requests with the contract message', async () => {
    await createBooking(db, s.renter.id, s.billboard.id, {
      startDate: daysFromNow(50),
      endDate: daysFromNow(55),
    })
    const other = await createUser(db, { role: 'renter' })
    await expect(
      request(db, other.id, s.billboard.id, daysFromNow(55), daysFromNow(58)),
    ).rejects.toThrow('Selected dates overlap an existing booking')
    // Adjacent range is fine (inclusive end).
    await request(db, other.id, s.billboard.id, daysFromNow(56), daysFromNow(58))
  })

  it('the exclusion constraint rejects overlaps written past the RPC (23P01)', async () => {
    await insertBooking(db, s, daysFromNow(70), daysFromNow(72), 'confirmed')
    await expect(
      insertBooking(db, s, daysFromNow(72), daysFromNow(74), 'pending_owner_review'),
    ).rejects.toMatchObject({ code: '23P01' })
  })

  it('rejected, cancelled and expired bookings do not block', async () => {
    for (const [i, status] of ['rejected', 'cancelled', 'expired', 'completed'].entries()) {
      const start = daysFromNow(100 + i * 10)
      const end = daysFromNow(102 + i * 10)
      await insertBooking(db, s, start, end, status)
      const [row] = await request(db, s.renter.id, s.billboard.id, start, end)
      expect(row.status).toBe('pending_owner_review')
    }
  })
})

describe('0032: advance_booking_lifecycle expiry', () => {
  let db: Db
  let s: Seed

  beforeAll(async () => {
    db = await createDb()
    s = await seedMarketplace(db)
  })
  afterAll(async () => {
    await db?.close()
  })

  async function advanceAs(userId: string) {
    await asUser(db, userId, (tx) => rpc(tx, 'advance_booking_lifecycle'))
  }

  it('expires owner-review requests older than 72h, notifies both, logs a system event', async () => {
    const stale = await createBooking(db, s.renter.id, s.billboard.id, {
      startDate: daysFromNow(10),
      endDate: daysFromNow(11),
    })
    const fresh = await createBooking(db, s.renter.id, s.billboard.id, {
      startDate: daysFromNow(12),
      endDate: daysFromNow(13),
    })
    await db.query(
      `update public.bookings set created_at = now() - interval '73 hours' where id = $1`,
      [stale.id],
    )
    await db.query(
      `update public.bookings set created_at = now() - interval '71 hours' where id = $1`,
      [fresh.id],
    )

    // Any authenticated user may trigger it (client fallback) — an unrelated one here.
    const bystander = await createUser(db, { role: 'renter' })
    await advanceAs(bystander.id)
    await advanceAs(bystander.id) // idempotent

    expect((await statusOf(db, stale.id)).status).toBe('expired')
    expect((await statusOf(db, fresh.id)).status).toBe('pending_owner_review')

    const notes = await db.query<{ user_id: string }>(
      `select user_id from public.notifications where type = 'booking_expired' and ref_id = $1`,
      [stale.id],
    )
    expect(notes.rows.map((r) => r.user_id).sort()).toEqual(
      [s.renter.id, s.owner.id].sort(),
    )
    const events = await db.query<{ actor_id: string | null; from_status: string }>(
      `select actor_id, from_status from public.booking_events
        where booking_id = $1 and to_status = 'expired'`,
      [stale.id],
    )
    expect(events.rows).toEqual([{ actor_id: null, from_status: 'pending_owner_review' }])

    // The expired request no longer blocks its dates.
    await createBooking(db, s.renter.id, s.billboard.id, {
      startDate: daysFromNow(10),
      endDate: daysFromNow(11),
    })
  })

  it('expires unpaid approvals 72h after the decision, unless a payment was submitted', async () => {
    const unpaid = await createBooking(db, s.renter.id, s.billboard.id, {
      startDate: daysFromNow(20),
      endDate: daysFromNow(21),
    })
    const submitted = await createBooking(db, s.renter.id, s.billboard.id, {
      startDate: daysFromNow(22),
      endDate: daysFromNow(23),
    })
    const recent = await createBooking(db, s.renter.id, s.billboard.id, {
      startDate: daysFromNow(24),
      endDate: daysFromNow(25),
    })
    for (const b of [unpaid, submitted, recent]) {
      await respondToBooking(db, s.owner.id, b.id, true)
    }
    await asUser(db, s.renter.id, (tx) =>
      rpc(tx, 'renter_submit_payment', { p_booking_id: submitted.id }),
    )
    await db.query(
      `update public.bookings set decision_at = now() - interval '73 hours', created_at = now() - interval '100 hours'
        where id = any($1)`,
      [[unpaid.id, submitted.id]],
    )
    await db.query(
      `update public.bookings set decision_at = now() - interval '71 hours', created_at = now() - interval '100 hours'
        where id = $1`,
      [recent.id],
    )

    await advanceAs(s.owner.id)

    expect((await statusOf(db, unpaid.id)).status).toBe('expired')
    expect((await statusOf(db, submitted.id)).status).toBe('payment_pending')
    expect((await statusOf(db, recent.id)).status).toBe('payment_pending')

    // Expired bookings can't be paid.
    await expect(
      asUser(db, s.renter.id, (tx) =>
        rpc(tx, 'renter_submit_payment', { p_booking_id: unpaid.id }),
      ),
    ).rejects.toThrow('Booking is not awaiting payment')
  })

  it('still moves confirmed → active → completed by the platform date', async () => {
    const b = await createBooking(db, s.renter.id, s.billboard.id, {
      startDate: daysFromNow(30),
      endDate: daysFromNow(31),
    })
    await respondToBooking(db, s.owner.id, b.id, true)
    await confirmPayment(db, s.admin.id, b.id)
    await db.query(
      `update public.bookings set start_date = $2, end_date = $3 where id = $1`,
      [b.id, daysFromNow(-3), daysFromNow(-2)],
    )
    await advanceAs(s.renter.id)
    expect((await statusOf(db, b.id)).status).toBe('completed')
  })

  it('uses platform_settings.timezone (validated)', async () => {
    const { rows } = await db.query<{ ok: boolean }>(
      `select public.platform_today() = (now() at time zone 'Asia/Colombo')::date as ok`,
    )
    expect(rows[0].ok).toBe(true)
    await expect(
      db.query(`update public.platform_settings set timezone = 'Mars/Olympus'`),
    ).rejects.toThrow('Unknown time zone')
    await db.query(`update public.platform_settings set timezone = 'UTC'`)
    const utc = await db.query<{ ok: boolean }>(
      `select public.platform_today() = (now() at time zone 'UTC')::date as ok`,
    )
    expect(utc.rows[0].ok).toBe(true)
    await db.query(`update public.platform_settings set timezone = 'Asia/Colombo'`)
  })

  it('anon cannot run it', async () => {
    const { rows } = await db.query<{ anon: boolean; auth: boolean }>(
      `select has_function_privilege('anon', 'public.advance_booking_lifecycle()', 'execute') as anon,
              has_function_privilege('authenticated', 'public.advance_booking_lifecycle()', 'execute') as auth`,
    )
    expect(rows[0]).toEqual({ anon: false, auth: true })
  })
})

describe('0032: create_campaign', () => {
  let db: Db
  let s: Seed

  beforeAll(async () => {
    db = await createDb()
    s = await seedMarketplace(db)
  })
  afterAll(async () => {
    await db?.close()
  })

  function campaign(userId: string, ids: string[], start = daysFromNow(10), end = daysFromNow(12)) {
    return asUser(db, userId, (tx) =>
      rpc<{ id: string }>(tx, 'create_campaign', {
        p_name: 'Launch',
        p_start_date: start,
        p_end_date: end,
        p_billboard_ids: ids,
      }),
    ).then((r) => r[0])
  }

  it('caps a campaign at 20 billboards', async () => {
    const ids: string[] = []
    for (let i = 0; i < 21; i++) ids.push((await createBillboard(db, s.owner.id)).id)
    await expect(campaign(s.renter.id, ids)).rejects.toThrow(
      'A campaign can include at most 20 billboards',
    )
    const ok = await campaign(s.renter.id, ids.slice(0, 20))
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from public.campaign_items where campaign_id = $1 and status = 'booked'`,
      [ok.id],
    )
    expect(rows[0].n).toBe(20)
  })

  it('applies the request_booking rules up front and per item', async () => {
    await expect(
      campaign(s.renter.id, [s.billboard.id], daysFromNow(-1), daysFromNow(2)),
    ).rejects.toThrow('Start date cannot be in the past')
    await expect(
      campaign(s.renter.id, [s.billboard.id], daysFromNow(5), daysFromNow(4)),
    ).rejects.toThrow('End date must be on or after the start date')
    await expect(campaign(s.owner.id, [s.billboard.id])).rejects.toThrow(
      'Only renter accounts can request bookings',
    )

    const inactive = await createBillboard(db, s.owner.id, { status: 'inactive' })
    const free = await createBillboard(db, s.owner.id)
    // Duplicate ids are collapsed instead of failing the whole campaign.
    const c = await campaign(
      s.renter.id,
      [free.id, inactive.id, free.id],
      daysFromNow(60),
      daysFromNow(61),
    )
    const { rows } = await db.query<{ billboard_id: string; status: string; failure_reason: string | null }>(
      `select billboard_id, status, failure_reason from public.campaign_items where campaign_id = $1`,
      [c.id],
    )
    expect(rows).toHaveLength(2)
    const byId = Object.fromEntries(rows.map((r) => [r.billboard_id, r]))
    expect(byId[free.id].status).toBe('booked')
    expect(byId[inactive.id]).toMatchObject({
      status: 'failed',
      failure_reason: 'Billboard is not available for booking',
    })
  })
})

describe('0032: get_billboard_booked_ranges', () => {
  let db: Db
  let s: Seed

  beforeAll(async () => {
    db = await createDb()
    s = await seedMarketplace(db)
  })
  afterAll(async () => {
    await db?.close()
  })

  it('anon sees only blocking, current/future ranges, ordered, without renter info', async () => {
    await insertBooking(db, s, daysFromNow(30), daysFromNow(32), 'confirmed')
    await insertBooking(db, s, daysFromNow(10), daysFromNow(12), 'pending_owner_review')
    await insertBooking(db, s, daysFromNow(20), daysFromNow(21), 'payment_pending')
    await insertBooking(db, s, daysFromNow(-1), daysFromNow(2), 'active')
    await insertBooking(db, s, daysFromNow(-10), daysFromNow(-5), 'completed')
    await insertBooking(db, s, daysFromNow(-10), daysFromNow(-8), 'active') // stale, already ended
    await insertBooking(db, s, daysFromNow(40), daysFromNow(41), 'rejected')
    await insertBooking(db, s, daysFromNow(42), daysFromNow(43), 'cancelled')
    await insertBooking(db, s, daysFromNow(44), daysFromNow(45), 'expired')

    const res = await asAnon(db, (tx) =>
      tx.query<{ start_date: Date; end_date: Date }>(
        `select * from public.get_billboard_booked_ranges($1)`,
        [s.billboard.id],
      ),
    )
    expect(res.fields.map((f) => f.name)).toEqual(['start_date', 'end_date'])
    const iso = (d: Date) => d.toISOString().slice(0, 10)
    expect(res.rows.map((r) => [iso(r.start_date), iso(r.end_date)])).toEqual([
      [daysFromNow(-1), daysFromNow(2)],
      [daysFromNow(10), daysFromNow(12)],
      [daysFromNow(20), daysFromNow(21)],
      [daysFromNow(30), daysFromNow(32)],
    ])

    const authed = await asUser(db, s.renter.id, (tx) =>
      rpc(tx, 'get_billboard_booked_ranges', { p_billboard_id: s.billboard.id }),
    )
    expect(authed).toHaveLength(4)
  })

  it('reveals nothing for a billboard the caller cannot see', async () => {
    const hidden = await createBillboard(db, s.owner.id, { status: 'inactive' })
    await db.query(BLOCKING_INSERT, [
      hidden.id,
      s.owner.id,
      s.renter.id,
      daysFromNow(5),
      daysFromNow(6),
      'confirmed',
      null,
    ])
    const anon = await asAnon(db, (tx) =>
      rpc(tx, 'get_billboard_booked_ranges', { p_billboard_id: hidden.id }),
    )
    expect(anon).toHaveLength(0)
    const owner = await asUser(db, s.owner.id, (tx) =>
      rpc(tx, 'get_billboard_booked_ranges', { p_billboard_id: hidden.id }),
    )
    expect(owner).toHaveLength(1)
  })
})

describe('0032: overlap cleanup on existing data', () => {
  let db: Db
  let s: Seed
  // Same definition as the migration.
  const ADD_CONSTRAINT = `
    alter table public.bookings add constraint bookings_no_overlap
    exclude using gist (billboard_id with =, daterange(start_date, end_date, '[]') with &&)
    where (status in ('pending_owner_review','payment_pending','confirmed','active') and not overlap_grandfathered)`

  beforeAll(async () => {
    db = await createDb()
    s = await seedMarketplace(db)
    // Simulate pre-0032 data: drop the constraint and write overlaps directly.
    await db.query(`alter table public.bookings drop constraint bookings_no_overlap`)
  })
  afterAll(async () => {
    await db?.close()
  })

  it('keeps paid then earliest bookings, cancels the rest, flags paid-vs-paid', async () => {
    const t = (h: number) => new Date(Date.now() - h * 3600_000).toISOString()
    // Group 1: earliest pending wins over a later pending and a later payment_pending.
    const p1 = await insertBooking(db, s, daysFromNow(10), daysFromNow(15), 'pending_owner_review', t(50))
    const p2 = await insertBooking(db, s, daysFromNow(12), daysFromNow(13), 'pending_owner_review', t(40))
    const p3 = await insertBooking(db, s, daysFromNow(15), daysFromNow(18), 'payment_pending', t(30))
    // Group 2: a later confirmed booking beats an earlier pending one.
    const g2pending = await insertBooking(db, s, daysFromNow(30), daysFromNow(32), 'pending_owner_review', t(50))
    const g2paid = await insertBooking(db, s, daysFromNow(31), daysFromNow(33), 'confirmed', t(10))
    // Group 3: two paid bookings overlap — neither is changed, the later one is flagged.
    const g3a = await insertBooking(db, s, daysFromNow(50), daysFromNow(52), 'confirmed', t(50))
    const g3b = await insertBooking(db, s, daysFromNow(51), daysFromNow(53), 'active', t(40))
    // Non-overlapping and non-blocking rows are untouched.
    const lone = await insertBooking(db, s, daysFromNow(70), daysFromNow(71), 'pending_owner_review', t(5))
    const oldRejected = await insertBooking(db, s, daysFromNow(10), daysFromNow(15), 'rejected', t(60))

    const { rows } = await db.query<{ n: number }>(
      `select public.cleanup_overlapping_bookings() as n`,
    )
    expect(rows[0].n).toBe(3)

    expect(await statusOf(db, p1)).toEqual({ status: 'pending_owner_review', rejection_reason: null })
    for (const id of [p2, p3, g2pending]) {
      expect(await statusOf(db, id)).toEqual({
        status: 'cancelled',
        rejection_reason: 'Overlapping booking cleaned up',
      })
    }
    expect((await statusOf(db, g2paid)).status).toBe('confirmed')
    expect((await statusOf(db, g3a)).status).toBe('confirmed')
    expect((await statusOf(db, g3b)).status).toBe('active')
    expect((await statusOf(db, lone)).status).toBe('pending_owner_review')
    expect((await statusOf(db, oldRejected)).status).toBe('rejected')

    const flags = await db.query<{ id: string }>(
      `select id from public.bookings where overlap_grandfathered`,
    )
    expect(flags.rows.map((r) => r.id)).toEqual([g3b])

    // Deterministic + idempotent: a second run changes nothing.
    const again = await db.query<{ n: number }>(
      `select public.cleanup_overlapping_bookings() as n`,
    )
    expect(again.rows[0].n).toBe(0)

    // The constraint can now be created, and request_booking still refuses
    // dates covered only by the grandfathered booking.
    await db.query(ADD_CONSTRAINT)
    await expect(
      request(db, s.renter.id, s.billboard.id, daysFromNow(53), daysFromNow(53)),
    ).rejects.toThrow('Selected dates overlap an existing booking')
  })
})
