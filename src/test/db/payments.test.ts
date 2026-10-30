import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  asUser,
  createBooking,
  createDb,
  respondToBooking,
  rpc,
  seedMarketplace,
  type Db,
} from './harness'

// Owned by DB-M (0031_payment_flow.sql) from wave 2 on.
//
// "KNOWN HOLE" asserts today's INSECURE behaviour. 0031 drops
// renter_pay_booking (contract 1): replace this block with a test that the
// function no longer exists and that renter_submit_payment creates a
// `pending` payment, then drop the KNOWN HOLE label.

describe('KNOWN HOLE (fixed in 0031): renter can self-confirm a payment', () => {
  let db: Db

  beforeAll(async () => {
    db = await createDb()
  })
  afterAll(async () => {
    await db?.close()
  })

  it('renter_pay_booking creates a succeeded payment and confirms the booking', async () => {
    const s = await seedMarketplace(db)
    const booking = await createBooking(db, s.renter.id, s.billboard.id)
    await respondToBooking(db, s.owner.id, booking.id, true)

    const [payment] = await asUser(db, s.renter.id, (tx) =>
      rpc<{ status: string; amount: string; confirmed_by: string }>(
        tx,
        'renter_pay_booking',
        {
          p_booking_id: booking.id,
        },
      ),
    )
    expect(payment.status).toBe('succeeded')
    expect(payment.amount).toBe(booking.price_quoted)
    // The renter "confirms" their own payment — no admin involved.
    expect(payment.confirmed_by).toBe(s.renter.id)

    const { rows } = await db.query<{ status: string }>(
      `select status from public.bookings where id = $1`,
      [booking.id],
    )
    expect(rows[0].status).toBe('confirmed')
  })
})
