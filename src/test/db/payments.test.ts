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

// Owned by DB-M (0031_payment_flow.sql). Contract 1: renter submits a
// payment (pending), admin confirms (succeeded + booking confirmed) or
// rejects it (failed, renter may resubmit). Payouts only count
// admin-confirmed payments.

interface PaymentRow {
  id: string
  booking_id: string
  status: string
  amount: string
  currency: string
  reference: string | null
  confirmed_by: string | null
  rejection_reason: string | null
}

interface PayoutRow {
  id: string
  status: string
  amount: string
  gross_amount: string
}

let seq = 0
/** A fresh approved (payment_pending) booking on its own date range. */
async function approvedBooking(
  db: Db,
  s: Awaited<ReturnType<typeof seedMarketplace>>,
) {
  seq += 1
  const start = 10 + seq * 5
  const booking = await createBooking(db, s.renter.id, s.billboard.id, {
    startDate: daysFromNow(start),
    endDate: daysFromNow(start + 2),
  })
  await respondToBooking(db, s.owner.id, booking.id, true)
  return booking
}

function submit(db: Db, userId: string, bookingId: string, reference?: string) {
  return asUser(db, userId, (tx) =>
    rpc<PaymentRow>(tx, 'renter_submit_payment', {
      p_booking_id: bookingId,
      p_reference: reference ?? null,
    }),
  ).then((rows) => rows[0])
}

async function bookingStatus(db: Db, id: string) {
  const { rows } = await db.query<{ status: string; payment_id: string | null }>(
    `select status, payment_id from public.bookings where id = $1`,
    [id],
  )
  return rows[0]
}

describe('0031: renter_pay_booking is gone', () => {
  let db: Db
  beforeAll(async () => {
    db = await createDb()
  })
  afterAll(async () => {
    await db?.close()
  })

  it('no longer exists', async () => {
    const { rows } = await db.query(
      `select 1 from pg_proc where proname = 'renter_pay_booking'`,
    )
    expect(rows).toHaveLength(0)
  })

  it('renter can no longer self-confirm: a submission is only pending', async () => {
    const s = await seedMarketplace(db)
    const booking = await approvedBooking(db, s)
    const payment = await submit(db, s.renter.id, booking.id)
    expect(payment.status).toBe('pending')
    expect(payment.confirmed_by).toBeNull()
    expect((await bookingStatus(db, booking.id)).status).toBe('payment_pending')
  })
})

describe('0031: renter_submit_payment', () => {
  let db: Db
  let s: Awaited<ReturnType<typeof seedMarketplace>>

  beforeAll(async () => {
    db = await createDb()
    s = await seedMarketplace(db)
  })
  afterAll(async () => {
    await db?.close()
  })

  it('creates a pending payment for the quoted amount and notifies admins', async () => {
    const booking = await approvedBooking(db, s)
    const payment = await submit(db, s.renter.id, booking.id, '  BANK-123 ')
    expect(payment).toMatchObject({
      booking_id: booking.id,
      status: 'pending',
      amount: booking.price_quoted,
      currency: 'LKR',
      reference: 'BANK-123',
      confirmed_by: null,
    })
    const b = await bookingStatus(db, booking.id)
    expect(b).toEqual({ status: 'payment_pending', payment_id: payment.id })

    const { rows } = await db.query<{ user_id: string; ref_id: string }>(
      `select user_id, ref_id from public.notifications where type = 'payment_submitted' and ref_id = $1`,
      [booking.id],
    )
    expect(rows.map((r) => r.user_id)).toEqual([s.admin.id])
  })

  it('rejects a second submission while one is open', async () => {
    const booking = await approvedBooking(db, s)
    await submit(db, s.renter.id, booking.id)
    await expect(submit(db, s.renter.id, booking.id)).rejects.toThrow(
      'A payment has already been submitted for this booking',
    )
  })

  it('enforces one open payment per booking at the table level', async () => {
    const booking = await approvedBooking(db, s)
    await submit(db, s.renter.id, booking.id)
    await expect(
      db.query(
        `insert into public.payments (booking_id, renter_id, owner_id, amount, status)
         values ($1, $2, $3, 1, 'succeeded')`,
        [booking.id, s.renter.id, s.owner.id],
      ),
    ).rejects.toMatchObject({ code: '23505' })
  })

  it('only the renter can submit, only while payment is due', async () => {
    const booking = await approvedBooking(db, s)
    const other = await createUser(db, { role: 'renter' })
    await expect(submit(db, other.id, booking.id)).rejects.toThrow(
      'Not authorized to pay for this booking',
    )
    await expect(submit(db, s.owner.id, booking.id)).rejects.toThrow(
      'Not authorized to pay for this booking',
    )
    await expect(
      asAnon(db, (tx) =>
        rpc(tx, 'renter_submit_payment', { p_booking_id: booking.id }),
      ),
    ).rejects.toThrow()

    const pendingReview = await createBooking(db, s.renter.id, s.billboard.id, {
      startDate: daysFromNow(300),
      endDate: daysFromNow(301),
    })
    await expect(submit(db, s.renter.id, pendingReview.id)).rejects.toThrow(
      'Booking is not awaiting payment',
    )
  })

  it('anon has no EXECUTE on the payment RPCs', async () => {
    for (const sig of [
      'public.renter_submit_payment(uuid, text)',
      'public.admin_confirm_payment(uuid, numeric, text, text)',
      'public.admin_reject_payment(uuid, text)',
      'public.admin_create_payout(uuid, uuid[], date)',
      'public.admin_cancel_payout(uuid)',
    ]) {
      const { rows } = await db.query<{ anon: boolean; auth: boolean }>(
        `select has_function_privilege('anon', $1, 'execute') as anon,
                has_function_privilege('authenticated', $1, 'execute') as auth`,
        [sig],
      )
      expect(rows[0], sig).toEqual({ anon: false, auth: true })
    }
  })

  it('a suspended renter cannot submit', async () => {
    const booking = await approvedBooking(db, s)
    await db.query(`update public.profiles set status = 'suspended' where id = $1`, [
      s.renter.id,
    ])
    try {
      await expect(submit(db, s.renter.id, booking.id)).rejects.toThrow(
        'Account suspended',
      )
    } finally {
      await db.query(`update public.profiles set status = 'active' where id = $1`, [
        s.renter.id,
      ])
    }
  })
})

describe('0031: admin_confirm_payment / admin_reject_payment', () => {
  let db: Db
  let s: Awaited<ReturnType<typeof seedMarketplace>>

  beforeAll(async () => {
    db = await createDb()
    s = await seedMarketplace(db)
  })
  afterAll(async () => {
    await db?.close()
  })

  it('rejects an amount that differs from the quote', async () => {
    const booking = await approvedBooking(db, s)
    await submit(db, s.renter.id, booking.id)
    await expect(
      confirmPayment(db, s.admin.id, booking.id, Number(booking.price_quoted) - 1),
    ).rejects.toThrow('Amount does not match quoted price')
    expect((await bookingStatus(db, booking.id)).status).toBe('payment_pending')
  })

  it('promotes the pending payment and confirms the booking', async () => {
    const booking = await approvedBooking(db, s)
    const pending = await submit(db, s.renter.id, booking.id, 'RENTER-REF')
    const confirmed = (await confirmPayment(db, s.admin.id, booking.id)) as unknown as PaymentRow
    expect(confirmed).toMatchObject({
      id: pending.id,
      status: 'succeeded',
      reference: 'RENTER-REF',
      confirmed_by: s.admin.id,
    })
    expect(await bookingStatus(db, booking.id)).toEqual({
      status: 'confirmed',
      payment_id: pending.id,
    })
    const { rows } = await db.query<{ user_id: string }>(
      `select user_id from public.notifications where type = 'payment_confirmed' and ref_id = $1`,
      [booking.id],
    )
    expect(rows.map((r) => r.user_id).sort()).toEqual(
      [s.renter.id, s.owner.id].sort(),
    )
  })

  it('inserts a succeeded payment when nothing was submitted', async () => {
    const booking = await approvedBooking(db, s)
    const [payment] = await asUser(db, s.admin.id, (tx) =>
      rpc<PaymentRow>(tx, 'admin_confirm_payment', {
        p_booking_id: booking.id,
        p_amount: booking.price_quoted,
        p_reference: 'CASH',
      }),
    )
    expect(payment).toMatchObject({ status: 'succeeded', reference: 'CASH' })
    expect((await bookingStatus(db, booking.id)).status).toBe('confirmed')
  })

  it('non-admins and anon cannot confirm or reject', async () => {
    const booking = await approvedBooking(db, s)
    const payment = await submit(db, s.renter.id, booking.id)
    for (const uid of [s.renter.id, s.owner.id]) {
      await expect(confirmPayment(db, uid, booking.id)).rejects.toThrow(
        'Only an admin can confirm a payment',
      )
      await expect(
        asUser(db, uid, (tx) =>
          rpc(tx, 'admin_reject_payment', { p_payment_id: payment.id, p_reason: 'x' }),
        ),
      ).rejects.toThrow('Only an admin can reject a payment')
    }
    await expect(
      asAnon(db, (tx) =>
        rpc(tx, 'admin_confirm_payment', {
          p_booking_id: booking.id,
          p_amount: booking.price_quoted,
        }),
      ),
    ).rejects.toThrow()
    await expect(
      asAnon(db, (tx) =>
        rpc(tx, 'admin_reject_payment', { p_payment_id: payment.id, p_reason: 'x' }),
      ),
    ).rejects.toThrow()
    const { rows } = await db.query<{ status: string }>(
      `select status from public.payments where id = $1`,
      [payment.id],
    )
    expect(rows[0].status).toBe('pending')
  })

  it('reject → failed, booking still due, renter notified and can resubmit', async () => {
    const booking = await approvedBooking(db, s)
    const payment = await submit(db, s.renter.id, booking.id)
    const [rejected] = await asUser(db, s.admin.id, (tx) =>
      rpc<PaymentRow>(tx, 'admin_reject_payment', {
        p_payment_id: payment.id,
        p_reason: 'No transfer found',
      }),
    )
    expect(rejected).toMatchObject({
      status: 'failed',
      rejection_reason: 'No transfer found',
    })
    expect(await bookingStatus(db, booking.id)).toEqual({
      status: 'payment_pending',
      payment_id: null,
    })
    const { rows } = await db.query<{ user_id: string; message: string }>(
      `select user_id, message from public.notifications where type = 'payment_rejected' and ref_id = $1`,
      [booking.id],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].user_id).toBe(s.renter.id)
    expect(rows[0].message).toContain('No transfer found')

    // Only pending payments can be rejected.
    await expect(
      asUser(db, s.admin.id, (tx) =>
        rpc(tx, 'admin_reject_payment', { p_payment_id: payment.id, p_reason: 'again' }),
      ),
    ).rejects.toThrow('Only a pending payment can be rejected')

    const again = await submit(db, s.renter.id, booking.id)
    expect(again.status).toBe('pending')
    expect(again.id).not.toBe(payment.id)
  })
})

describe('0031: payouts', () => {
  let db: Db
  let s: Awaited<ReturnType<typeof seedMarketplace>>

  beforeAll(async () => {
    db = await createDb()
    s = await seedMarketplace(db)
  })
  afterAll(async () => {
    await db?.close()
  })

  function createPayout(bookingIds: string[]) {
    return asUser(db, s.admin.id, (tx) =>
      rpc<PayoutRow>(tx, 'admin_create_payout', {
        p_owner_id: s.owner.id,
        p_booking_ids: bookingIds,
        p_scheduled_release_date: daysFromNow(30),
      }),
    ).then((r) => r[0])
  }

  it('a submitted-but-unconfirmed payment is not payable', async () => {
    const booking = await approvedBooking(db, s)
    await submit(db, s.renter.id, booking.id)
    await expect(createPayout([booking.id])).rejects.toThrow(
      'One or more selected bookings are not eligible for payout',
    )
  })

  it('a confirmed booking whose payment was not admin-confirmed is not payable', async () => {
    // e.g. a legacy renter_pay_booking row, whose confirmation 0031 strips.
    const booking = await approvedBooking(db, s)
    await confirmPayment(db, s.admin.id, booking.id)
    await db.query(
      `update public.payments set confirmed_by = null where booking_id = $1`,
      [booking.id],
    )
    await expect(createPayout([booking.id])).rejects.toThrow(
      'One or more selected bookings are not eligible for payout',
    )
  })

  it('pays out admin-confirmed payments using the payment amount', async () => {
    const a = await approvedBooking(db, s)
    const b = await approvedBooking(db, s)
    await submit(db, s.renter.id, a.id)
    await confirmPayment(db, s.admin.id, a.id)
    await confirmPayment(db, s.admin.id, b.id)
    const payout = await createPayout([a.id, b.id])
    expect(payout.status).toBe('approved')
    expect(Number(payout.gross_amount)).toBe(
      Number(a.price_quoted) + Number(b.price_quoted),
    )
    // Can't be paid out twice.
    await expect(createPayout([a.id])).rejects.toThrow(
      'One or more selected bookings are not eligible for payout',
    )
  })

  it('admin_cancel_payout frees the bookings and notifies the owner', async () => {
    const booking = await approvedBooking(db, s)
    await confirmPayment(db, s.admin.id, booking.id)
    const payout = await createPayout([booking.id])

    await expect(
      asUser(db, s.owner.id, (tx) =>
        rpc(tx, 'admin_cancel_payout', { p_payout_id: payout.id }),
      ),
    ).rejects.toThrow('Only an admin can cancel a payout')

    const [cancelled] = await asUser(db, s.admin.id, (tx) =>
      rpc<PayoutRow>(tx, 'admin_cancel_payout', { p_payout_id: payout.id }),
    )
    expect(cancelled.status).toBe('cancelled')
    const items = await db.query(
      `select 1 from public.payout_items where payout_id = $1`,
      [payout.id],
    )
    expect(items.rows).toHaveLength(0)
    const notes = await db.query<{ user_id: string }>(
      `select user_id from public.notifications where type = 'payout_cancelled' and ref_id = $1`,
      [payout.id],
    )
    expect(notes.rows.map((r) => r.user_id)).toEqual([s.owner.id])

    // Cancelled twice / released after cancel: rejected.
    await expect(
      asUser(db, s.admin.id, (tx) =>
        rpc(tx, 'admin_cancel_payout', { p_payout_id: payout.id }),
      ),
    ).rejects.toThrow('Only a scheduled payout can be cancelled')
    await expect(
      asUser(db, s.admin.id, (tx) =>
        rpc(tx, 'admin_release_payout', { p_payout_id: payout.id }),
      ),
    ).rejects.toThrow('Only an approved payout can be released')

    // The booking can be paid out again.
    const again = await createPayout([booking.id])
    expect(again.status).toBe('approved')
  })

  it('a paid payout cannot be cancelled', async () => {
    const booking = await approvedBooking(db, s)
    await confirmPayment(db, s.admin.id, booking.id)
    const payout = await createPayout([booking.id])
    await asUser(db, s.admin.id, (tx) =>
      rpc(tx, 'admin_release_payout', { p_payout_id: payout.id }),
    )
    await expect(
      asUser(db, s.admin.id, (tx) =>
        rpc(tx, 'admin_cancel_payout', { p_payout_id: payout.id }),
      ),
    ).rejects.toThrow('Only a scheduled payout can be cancelled')
  })

  it("rejects another owner's bookings", async () => {
    const owner2 = await createUser(db, { role: 'rentor' })
    const bb2 = await createBillboard(db, owner2.id)
    const booking = await createBooking(db, s.renter.id, bb2.id)
    await respondToBooking(db, owner2.id, booking.id, true)
    await confirmPayment(db, s.admin.id, booking.id)
    await expect(createPayout([booking.id])).rejects.toThrow(
      'One or more selected bookings are not eligible for payout',
    )
  })
})
