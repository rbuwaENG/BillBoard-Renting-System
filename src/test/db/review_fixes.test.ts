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
  listMigrations,
  respondToBooking,
  rpc,
  seedMarketplace,
  type Db,
  type TestUser,
} from './harness'

// Owned by DB-F (0035_review_fixes.sql): fixes from the independent review.

type Market = Awaited<ReturnType<typeof seedMarketplace>>

let seq = 0
/** A fresh booking on its own date range (pending_owner_review). */
function freshBooking(db: Db, s: Market, billboardId = s.billboard.id) {
  seq += 1
  const start = 5 + seq * 4
  return createBooking(db, s.renter.id, billboardId, {
    startDate: daysFromNow(start),
    endDate: daysFromNow(start + 1),
  })
}

async function approvedBooking(db: Db, s: Market) {
  const b = await freshBooking(db, s)
  await respondToBooking(db, s.owner.id, b.id, true)
  return b
}

async function bookingRow(db: Db, id: string) {
  const { rows } = await db.query<{
    status: string
    payment_id: string | null
    payment_rejected_at: Date | null
  }>(
    `select status, payment_id, payment_rejected_at from public.bookings where id = $1`,
    [id],
  )
  return rows[0]
}

function submitPayment(db: Db, renterId: string, bookingId: string) {
  return asUser(db, renterId, (tx) =>
    rpc<{ id: string }>(tx, 'renter_submit_payment', {
      p_booking_id: bookingId,
    }),
  ).then((r) => r[0])
}

async function paymentFor(db: Db, bookingId: string) {
  const { rows } = await db.query<{
    id: string
    status: string
    confirmed_by: string | null
  }>(
    `select id, status, confirmed_by from public.payments
      where booking_id = $1 and status = 'succeeded'`,
    [bookingId],
  )
  return rows[0]
}

/** Strips the admin verification, like 0031 did for self-confirmed payments. */
async function unverify(db: Db, bookingId: string) {
  await db.query(
    `update public.payments set confirmed_by = null, confirmed_at = null
      where booking_id = $1 and status = 'succeeded'`,
    [bookingId],
  )
}

function createPayout(db: Db, s: Market, bookingIds: string[], date: string) {
  return asUser(db, s.admin.id, (tx) =>
    rpc<{ id: string; status: string }>(tx, 'admin_create_payout', {
      p_owner_id: s.owner.id,
      p_booking_ids: bookingIds,
      p_scheduled_release_date: date,
    }),
  ).then((r) => r[0])
}

async function payoutStatus(db: Db, id: string) {
  const { rows } = await db.query<{ status: string; items: number }>(
    `select status,
            (select count(*)::int from public.payout_items where payout_id = $1) as items
       from public.payouts where id = $1`,
    [id],
  )
  return rows[0]
}

describe('0035 · 1: payouts only release admin-verified payments', () => {
  let db: Db
  let s: Market

  beforeAll(async () => {
    db = await createDb()
    s = await seedMarketplace(db)
  })
  afterAll(async () => {
    await db?.close()
  })

  async function paidBooking() {
    const b = await approvedBooking(db, s)
    await confirmPayment(db, s.admin.id, b.id)
    return b
  }

  it('the migration cancels approved payouts that contain unverified payments', async () => {
    const legacy = await paidBooking()
    const ok = await paidBooking()
    const bad = await createPayout(db, s, [legacy.id], daysFromNow(30))
    const good = await createPayout(db, s, [ok.id], daysFromNow(30))
    await unverify(db, legacy.id)

    // Re-run the data fix from 0035 (it ran on an empty DB at build time).
    const sql = listMigrations().find((m) => m.name.startsWith('0035_'))!.sql
    const block = /do \$\$[\s\S]*?end \$\$;/.exec(sql)![0]
    expect(block).toContain('payout_cancelled')
    await db.exec(block)

    expect(await payoutStatus(db, bad.id)).toEqual({
      status: 'cancelled',
      items: 0,
    })
    expect(await payoutStatus(db, good.id)).toEqual({
      status: 'approved',
      items: 1,
    })
    const { rows } = await db.query(
      `select 1 from public.notifications
        where user_id = $1 and type = 'payout_cancelled' and ref_id = $2`,
      [s.owner.id, bad.id],
    )
    expect(rows).toHaveLength(1)
  })

  it('admin_release_payout refuses a payout with an unverified payment', async () => {
    const b = await paidBooking()
    const payout = await createPayout(db, s, [b.id], daysFromNow(1))
    await unverify(db, b.id)
    await expect(
      asUser(db, s.admin.id, (tx) =>
        rpc(tx, 'admin_release_payout', { p_payout_id: payout.id }),
      ),
    ).rejects.toThrow(
      'This payout includes bookings without a verified payment',
    )
    expect((await payoutStatus(db, payout.id)).status).toBe('approved')
  })

  it('release_due_payouts skips unverified payouts and releases verified ones', async () => {
    const unverified = await paidBooking()
    const verified = await paidBooking()
    const p1 = await createPayout(db, s, [unverified.id], daysFromNow(-1))
    const p2 = await createPayout(db, s, [verified.id], daysFromNow(-1))
    await unverify(db, unverified.id)

    await db.query(`select public.release_due_payouts()`)

    expect((await payoutStatus(db, p1.id)).status).toBe('approved')
    expect((await payoutStatus(db, p2.id)).status).toBe('paid')
  })

  it('admin_verify_payment verifies a legacy payment, which then pays out', async () => {
    const b = await paidBooking()
    await unverify(db, b.id)
    const payment = await paymentFor(db, b.id)

    // Not payable while unverified.
    await expect(createPayout(db, s, [b.id], daysFromNow(1))).rejects.toThrow(
      'One or more selected bookings are not eligible for payout',
    )

    // Admin only.
    await expect(
      asUser(db, s.owner.id, (tx) =>
        rpc(tx, 'admin_verify_payment', { p_payment_id: payment.id }),
      ),
    ).rejects.toThrow('Only an admin can verify a payment')

    const [verified] = await asUser(db, s.admin.id, (tx) =>
      rpc<{ confirmed_by: string; confirmed_at: Date | null }>(
        tx,
        'admin_verify_payment',
        { p_payment_id: payment.id },
      ),
    )
    expect(verified.confirmed_by).toBe(s.admin.id)
    expect(verified.confirmed_at).not.toBeNull()

    // Audited (0034 only audits status; 0035 adds confirmed_by-only changes).
    const { rows: audit } = await db.query(
      `select actor_id, action, before, after from public.admin_audit_log
        where entity = 'payment' and entity_id = $1 and actor_id is not null
          and action = 'confirmed_by_changed'`,
      [payment.id],
    )
    expect(audit).toEqual([
      {
        actor_id: s.admin.id,
        action: 'confirmed_by_changed',
        before: { confirmed_by: null },
        after: { confirmed_by: s.admin.id },
      },
    ])

    // Twice is an error.
    await expect(
      asUser(db, s.admin.id, (tx) =>
        rpc(tx, 'admin_verify_payment', { p_payment_id: payment.id }),
      ),
    ).rejects.toThrow('Only an unverified succeeded payment can be verified')

    const payout = await createPayout(db, s, [b.id], daysFromNow(1))
    const [released] = await asUser(db, s.admin.id, (tx) =>
      rpc<{ status: string }>(tx, 'admin_release_payout', {
        p_payout_id: payout.id,
      }),
    )
    expect(released.status).toBe('paid')
  })

  it('admin_verify_payment refuses pending payments', async () => {
    const b = await approvedBooking(db, s)
    const pending = await submitPayment(db, s.renter.id, b.id)
    await expect(
      asUser(db, s.admin.id, (tx) =>
        rpc(tx, 'admin_verify_payment', { p_payment_id: pending.id }),
      ),
    ).rejects.toThrow('Only an unverified succeeded payment can be verified')
  })

  it('a normal confirmation still logs a single status_changed row', async () => {
    const b = await approvedBooking(db, s)
    const pending = await submitPayment(db, s.renter.id, b.id)
    await confirmPayment(db, s.admin.id, b.id)
    const { rows } = await db.query<{ action: string }>(
      `select action from public.admin_audit_log where entity_id = $1`,
      [pending.id],
    )
    expect(rows.map((r) => r.action)).toEqual(['status_changed'])
  })
})

describe('0035 · 2: booking bounds and open-request cap', () => {
  let db: Db
  let s: Market

  beforeAll(async () => {
    db = await createDb()
    s = await seedMarketplace(db)
  })
  afterAll(async () => {
    await db?.close()
  })

  it('rejects bookings longer than 365 days; 365 is fine', async () => {
    await expect(
      createBooking(db, s.renter.id, s.billboard.id, {
        startDate: daysFromNow(2),
        endDate: daysFromNow(2 + 365),
      }),
    ).rejects.toThrow('Bookings can be at most 365 days long')
    const ok = await createBooking(db, s.renter.id, s.billboard.id, {
      startDate: daysFromNow(2),
      endDate: daysFromNow(2 + 364),
    })
    expect(ok.status).toBe('pending_owner_review')
    await asUser(db, s.renter.id, (tx) =>
      rpc(tx, 'cancel_booking', { p_booking_id: ok.id }),
    )
  })

  it('rejects bookings starting more than 365 days ahead', async () => {
    await expect(
      createBooking(db, s.renter.id, s.billboard.id, {
        startDate: daysFromNow(367),
        endDate: daysFromNow(368),
      }),
    ).rejects.toThrow('Bookings can start at most 365 days ahead')
    const ok = await createBooking(db, s.renter.id, s.billboard.id, {
      startDate: daysFromNow(363),
      endDate: daysFromNow(364),
    })
    expect(ok.status).toBe('pending_owner_review')
    await asUser(db, s.renter.id, (tx) =>
      rpc(tx, 'cancel_booking', { p_booking_id: ok.id }),
    )
  })

  it('create_campaign applies the same date bounds', async () => {
    await expect(
      asUser(db, s.renter.id, (tx) =>
        rpc(tx, 'create_campaign', {
          p_name: 'Too long',
          p_start_date: daysFromNow(2),
          p_end_date: daysFromNow(400),
          p_billboard_ids: [s.billboard.id],
        }),
      ),
    ).rejects.toThrow('Bookings can be at most 365 days long')
  })

  it('caps open requests at 25 per renter; campaign items fail per item', async () => {
    const renter = await createUser(db, { role: 'renter' })
    const ids: string[] = []
    for (let i = 0; i < 25; i++) {
      const b = await createBooking(db, renter.id, s.billboard.id, {
        startDate: daysFromNow(20 + i * 2),
        endDate: daysFromNow(20 + i * 2),
      })
      ids.push(b.id)
    }
    await expect(
      createBooking(db, renter.id, s.billboard.id, {
        startDate: daysFromNow(200),
        endDate: daysFromNow(200),
      }),
    ).rejects.toThrow(
      'You have too many pending requests; wait for owners to respond',
    )

    const other = await createBillboard(db, s.owner.id, { title: 'Other' })
    const [campaign] = await asUser(db, renter.id, (tx) =>
      rpc<{ id: string }>(tx, 'create_campaign', {
        p_name: 'Capped',
        p_start_date: daysFromNow(210),
        p_end_date: daysFromNow(211),
        p_billboard_ids: [s.billboard.id, other.id],
      }),
    )
    const { rows: items } = await db.query<{
      status: string
      failure_reason: string
    }>(
      `select status, failure_reason from public.campaign_items where campaign_id = $1`,
      [campaign.id],
    )
    expect(items).toHaveLength(2)
    for (const item of items) {
      expect(item).toEqual({
        status: 'failed',
        failure_reason:
          'You have too many pending requests; wait for owners to respond',
      })
    }

    // Once an owner responds, the renter is under the cap again.
    await respondToBooking(db, s.owner.id, ids[0], false, 'No')
    const next = await createBooking(db, renter.id, s.billboard.id, {
      startDate: daysFromNow(200),
      endDate: daysFromNow(200),
    })
    expect(next.status).toBe('pending_owner_review')
  })
})

describe('0035 · 3+4: payment window after rejection, cancel with pending payment', () => {
  let db: Db
  let s: Market

  beforeAll(async () => {
    db = await createDb()
    s = await seedMarketplace(db)
  })
  afterAll(async () => {
    await db?.close()
  })

  const advance = () =>
    asUser(db, s.renter.id, (tx) => rpc(tx, 'advance_booking_lifecycle'))

  it('a late rejection gives the renter a fresh 72h window', async () => {
    const b = await approvedBooking(db, s)
    const payment = await submitPayment(db, s.renter.id, b.id)
    // Approved long ago; the submission sat in the admin queue.
    await db.query(
      `update public.bookings set decision_at = now() - interval '100 hours' where id = $1`,
      [b.id],
    )
    await asUser(db, s.admin.id, (tx) =>
      rpc(tx, 'admin_reject_payment', {
        p_payment_id: payment.id,
        p_reason: 'Not received',
      }),
    )
    const afterReject = await bookingRow(db, b.id)
    expect(afterReject.payment_id).toBeNull()
    expect(afterReject.payment_rejected_at).not.toBeNull()

    await advance()
    expect((await bookingRow(db, b.id)).status).toBe('payment_pending')

    // 72h after the rejection it expires.
    await db.query(
      `update public.bookings set payment_rejected_at = now() - interval '73 hours' where id = $1`,
      [b.id],
    )
    await advance()
    expect((await bookingRow(db, b.id)).status).toBe('expired')
  })

  it('an unpaid approval with no rejection still expires after 72h', async () => {
    const b = await approvedBooking(db, s)
    await db.query(
      `update public.bookings set decision_at = now() - interval '73 hours' where id = $1`,
      [b.id],
    )
    await advance()
    expect((await bookingRow(db, b.id)).status).toBe('expired')
  })

  it('cancel_booking refuses while a payment awaits confirmation', async () => {
    const b = await approvedBooking(db, s)
    const payment = await submitPayment(db, s.renter.id, b.id)
    await expect(
      asUser(db, s.renter.id, (tx) =>
        rpc(tx, 'cancel_booking', { p_booking_id: b.id }),
      ),
    ).rejects.toThrow(
      'A payment is awaiting confirmation; contact support to cancel',
    )
    expect((await bookingRow(db, b.id)).status).toBe('payment_pending')

    // After a rejection the renter may cancel.
    await asUser(db, s.admin.id, (tx) =>
      rpc(tx, 'admin_reject_payment', {
        p_payment_id: payment.id,
        p_reason: 'Not received',
      }),
    )
    const [cancelled] = await asUser(db, s.renter.id, (tx) =>
      rpc<{ status: string }>(tx, 'cancel_booking', { p_booking_id: b.id }),
    )
    expect(cancelled.status).toBe('cancelled')
  })

  it('a payment_pending booking with no submission can be cancelled', async () => {
    const b = await approvedBooking(db, s)
    const [cancelled] = await asUser(db, s.renter.id, (tx) =>
      rpc<{ status: string }>(tx, 'cancel_booking', { p_booking_id: b.id }),
    )
    expect(cancelled.status).toBe('cancelled')
  })
})

describe('0035 · 5: owners cannot undo admin moderation', () => {
  let db: Db
  let s: Market

  beforeAll(async () => {
    db = await createDb()
    s = await seedMarketplace(db)
  })
  afterAll(async () => {
    await db?.close()
  })

  const setStatusAsOwner = (id: string, status: string) =>
    asUser(db, s.owner.id, (tx) =>
      tx.query(`update public.billboards set status = $2 where id = $1`, [
        id,
        status,
      ]),
    )
  const deleteAsOwner = (id: string) =>
    asUser(db, s.owner.id, (tx) =>
      tx.query(`delete from public.billboards where id = $1`, [id]),
    )
  const adminSet = (id: string, status: string) =>
    asUser(db, s.admin.id, (tx) =>
      rpc<{ status: string; status_locked_by_admin: boolean }>(
        tx,
        'admin_set_billboard_status',
        { p_billboard_id: id, p_status: status, p_reason: 'Policy' },
      ),
    ).then((r) => r[0])
  async function board(id: string) {
    const { rows } = await db.query<{
      status: string
      status_locked_by_admin: boolean
    }>(
      `select status, status_locked_by_admin from public.billboards where id = $1`,
      [id],
    )
    return rows[0]
  }

  it('owners still toggle their own unlocked listings', async () => {
    const b = await createBillboard(db, s.owner.id)
    await setStatusAsOwner(b.id, 'inactive')
    await setStatusAsOwner(b.id, 'archived')
    await setStatusAsOwner(b.id, 'active')
    expect(await board(b.id)).toEqual({
      status: 'active',
      status_locked_by_admin: false,
    })
  })

  it('an admin-deactivated / archived listing stays down until an admin restores it', async () => {
    const b = await createBillboard(db, s.owner.id)
    for (const status of ['inactive', 'archived']) {
      expect(await adminSet(b.id, status)).toMatchObject({
        status,
        status_locked_by_admin: true,
      })
      await expect(setStatusAsOwner(b.id, 'active')).rejects.toThrow(
        "This billboard's status was set by an admin and can only be changed by an admin",
      )
      await expect(deleteAsOwner(b.id)).rejects.toThrow(
        'This billboard was moderated by an admin and cannot be deleted',
      )
    }
    // Other edits are still allowed.
    await asUser(db, s.owner.id, (tx) =>
      tx.query(`update public.billboards set title = 'Renamed' where id = $1`, [
        b.id,
      ]),
    )
    expect(await adminSet(b.id, 'active')).toMatchObject({
      status: 'active',
      status_locked_by_admin: false,
    })
    await setStatusAsOwner(b.id, 'inactive')
    expect((await board(b.id)).status).toBe('inactive')
  })

  it('owners cannot set or clear the lock themselves', async () => {
    const b = await createBillboard(db, s.owner.id)
    await expect(
      asUser(db, s.owner.id, (tx) =>
        tx.query(
          `update public.billboards set status_locked_by_admin = true where id = $1`,
          [b.id],
        ),
      ),
    ).rejects.toMatchObject({ code: '42501' })
    await adminSet(b.id, 'inactive')
    await expect(
      asUser(db, s.owner.id, (tx) =>
        tx.query(
          `update public.billboards set status_locked_by_admin = false, status = 'active' where id = $1`,
          [b.id],
        ),
      ),
    ).rejects.toMatchObject({ code: '42501' })
  })

  it('owners cannot delete a flagged listing; unlocked ones still delete', async () => {
    const flagged = await createBillboard(db, s.owner.id)
    await adminSet(flagged.id, 'flagged')
    await expect(deleteAsOwner(flagged.id)).rejects.toThrow(
      'This billboard was moderated by an admin and cannot be deleted',
    )
    const free = await createBillboard(db, s.owner.id)
    await deleteAsOwner(free.id)
    expect(await board(free.id)).toBeUndefined()
  })

  it('a direct admin UPDATE (UI fallback) also maintains the lock', async () => {
    const b = await createBillboard(db, s.owner.id)
    await asUser(db, s.admin.id, (tx) =>
      tx.query(
        `update public.billboards set status = 'inactive' where id = $1`,
        [b.id],
      ),
    )
    expect((await board(b.id)).status_locked_by_admin).toBe(true)
    await expect(setStatusAsOwner(b.id, 'active')).rejects.toMatchObject({
      code: '42501',
    })
  })
})

describe('0035 · 6: suspension gaps', () => {
  let db: Db
  let s: Market
  let suspendedOwner: TestUser
  let hidden: Awaited<ReturnType<typeof createBillboard>>

  beforeAll(async () => {
    db = await createDb()
    s = await seedMarketplace(db)
    suspendedOwner = await createUser(db, { role: 'rentor' })
    hidden = await createBillboard(db, suspendedOwner.id, { title: 'Hidden' })
    await db.query(
      `update public.profiles set status = 'suspended' where id = $1`,
      [suspendedOwner.id],
    )
  })
  afterAll(async () => {
    await db?.close()
  })

  it('a suspended user cannot edit their profile', async () => {
    const user = await createUser(db, {
      role: 'renter',
      displayName: 'Before',
      status: 'suspended',
    })
    await asUser(db, user.id, (tx) =>
      tx.query(
        `update public.profiles set display_name = 'After' where id = $1`,
        [user.id],
      ),
    )
    const { rows } = await db.query<{ display_name: string }>(
      `select display_name from public.profiles where id = $1`,
      [user.id],
    )
    expect(rows[0].display_name).toBe('Before')

    // Active users still can.
    await asUser(db, s.renter.id, (tx) =>
      tx.query(
        `update public.profiles set display_name = 'Renamed' where id = $1`,
        [s.renter.id],
      ),
    )
    const { rows: own } = await db.query<{ display_name: string }>(
      `select display_name from public.profiles where id = $1`,
      [s.renter.id],
    )
    expect(own[0].display_name).toBe('Renamed')
  })

  it('billboards of suspended owners are not publicly listed', async () => {
    const anonIds = await asAnon(db, (tx) =>
      tx.query<{ id: string }>(`select id from public.billboards`),
    ).then((r) => r.rows.map((x) => x.id))
    expect(anonIds).toContain(s.billboard.id)
    expect(anonIds).not.toContain(hidden.id)

    const renterIds = await asUser(db, s.renter.id, (tx) =>
      tx.query<{ id: string }>(`select id from public.billboards`),
    ).then((r) => r.rows.map((x) => x.id))
    expect(renterIds).not.toContain(hidden.id)

    const near = await asAnon(db, (tx) =>
      rpc<{ id: string }>(tx, 'billboards_near', {
        p_lat: 6.9271,
        p_lng: 79.8612,
        p_radius_km: 10,
      }),
    ).then((r) => r.map((x) => x.id))
    expect(near).toContain(s.billboard.id)
    expect(near).not.toContain(hidden.id)

    // The owner and admins still see it.
    const ownerIds = await asUser(db, suspendedOwner.id, (tx) =>
      tx.query<{ id: string }>(`select id from public.billboards`),
    ).then((r) => r.rows.map((x) => x.id))
    expect(ownerIds).toContain(hidden.id)
    const adminIds = await asUser(db, s.admin.id, (tx) =>
      tx.query<{ id: string }>(`select id from public.billboards`),
    ).then((r) => r.rows.map((x) => x.id))
    expect(adminIds).toContain(hidden.id)
  })

  it('billboards of suspended owners are not bookable', async () => {
    await expect(createBooking(db, s.renter.id, hidden.id)).rejects.toThrow(
      'Billboard is not available for booking',
    )
    // Reactivated owner: bookable again.
    await db.query(
      `update public.profiles set status = 'active' where id = $1`,
      [suspendedOwner.id],
    )
    const b = await createBooking(db, s.renter.id, hidden.id)
    expect(b.status).toBe('pending_owner_review')
    await db.query(
      `update public.profiles set status = 'suspended' where id = $1`,
      [suspendedOwner.id],
    )
  })
})

describe('0035 · 7: renter creative uploads need an open booking', () => {
  let db: Db
  let s: Market

  beforeAll(async () => {
    db = await createDb()
    s = await seedMarketplace(db)
  })
  afterAll(async () => {
    await db?.close()
  })

  const put = (bookingId: string) =>
    asUser(db, s.renter.id, (tx) =>
      tx.query(
        `insert into storage.objects (bucket_id, name, owner) values ('booking-creatives', $1, $2)`,
        [`${bookingId}/creative-${Math.random()}.png`, s.renter.id],
      ),
    )

  it('allows uploads while open and refuses them once closed', async () => {
    const open = await freshBooking(db, s)
    await put(open.id)
    for (const status of ['completed', 'cancelled', 'expired', 'rejected']) {
      const b = await freshBooking(db, s)
      await db.query(`update public.bookings set status = $2 where id = $1`, [
        b.id,
        status,
      ])
      await expect(put(b.id)).rejects.toMatchObject({ code: '42501' })
    }
    const confirmed = await approvedBooking(db, s)
    await confirmPayment(db, s.admin.id, confirmed.id)
    await put(confirmed.id)
  })
})

describe('0035 · 8: respond_to_booking uses the platform date', () => {
  let db: Db
  let s: Market

  beforeAll(async () => {
    db = await createDb()
    s = await seedMarketplace(db)
  })
  afterAll(async () => {
    await db?.close()
  })

  it('"already started" follows platform_today(), not current_date', async () => {
    // At any UTC time one of these zones is on a different date than UTC.
    let tz = ''
    let platformToday = ''
    let utcToday = ''
    for (const zone of ['Pacific/Kiritimati', 'Pacific/Pago_Pago']) {
      await db.query(`update public.platform_settings set timezone = $1`, [
        zone,
      ])
      const { rows } = await db.query<{ p: string; c: string }>(
        `select public.platform_today()::text as p, current_date::text as c`,
      )
      if (rows[0].p !== rows[0].c) {
        tz = zone
        platformToday = rows[0].p
        utcToday = rows[0].c
        break
      }
    }
    expect(tz).not.toBe('')

    // A one-day booking on the later of the two dates: it has started by the
    // platform's clock iff platform_today is the later one.
    const start = platformToday > utcToday ? platformToday : utcToday
    const b = await createBooking(db, s.renter.id, s.billboard.id, {
      startDate: start,
      endDate: start,
    })
    const respond = respondToBooking(db, s.owner.id, b.id, true)
    if (platformToday > utcToday) {
      await expect(respond).rejects.toThrow('This booking has already started')
    } else {
      expect((await respond).status).toBe('payment_pending')
    }
  })
})

describe('0035 · 9: bucket MIME allow-lists', () => {
  let db: Db
  beforeAll(async () => {
    db = await createDb()
  })
  afterAll(async () => {
    await db?.close()
  })

  it('no bucket accepts wildcards or SVG', async () => {
    const { rows } = await db.query<{
      id: string
      allowed_mime_types: string[]
    }>(`select id, allowed_mime_types from storage.buckets order by id`)
    expect(rows.map((r) => r.id)).toEqual([
      'billboard-images',
      'booking-creatives',
      'chat-attachments',
      'site-assets',
    ])
    for (const r of rows) {
      expect(r.allowed_mime_types.length).toBeGreaterThan(0)
      for (const mime of r.allowed_mime_types) {
        expect(mime).not.toContain('*')
        expect(mime).not.toContain('svg')
      }
    }
    const publicBuckets = rows.filter((r) =>
      ['billboard-images', 'site-assets'].includes(r.id),
    )
    for (const r of publicBuckets) {
      expect(r.allowed_mime_types).toEqual([
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'image/avif',
      ])
    }
  })
})
