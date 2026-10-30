import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  asAnon,
  asUser,
  createBooking,
  createDb,
  rpc,
  seedMarketplace,
  type Db,
} from './harness'

// Owned by DB-S (0029_security_hardening.sql) from wave 2 on.
//
// Everything under "KNOWN HOLE" asserts today's INSECURE behaviour so the
// harness is proven to reproduce it. When 0029 lands, invert each block
// (assert the call is rejected / row unchanged) and drop the KNOWN HOLE label.

describe('KNOWN HOLE (fixed in 0029): anon can execute mutating RPCs', () => {
  let db: Db
  let s: Awaited<ReturnType<typeof seedMarketplace>>

  beforeAll(async () => {
    db = await createDb()
    s = await seedMarketplace(db)
  })
  afterAll(async () => {
    await db?.close()
  })

  it('anon holds EXECUTE on respond_to_booking and notify despite `revoke ... from public`', async () => {
    const { rows } = await db.query<{ respond: boolean; notify: boolean }>(
      `select has_function_privilege('anon', 'public.respond_to_booking(uuid, boolean, text)', 'execute') as respond,
              has_function_privilege('anon', 'public.notify(uuid, text, text, uuid)', 'execute') as notify`,
    )
    expect(rows[0]).toEqual({ respond: true, notify: true })
  })

  it('anon can approve someone else’s booking via respond_to_booking (`owner_id <> null` is null)', async () => {
    const booking = await createBooking(db, s.renter.id, s.billboard.id)
    const [row] = await asAnon(db, (tx) =>
      rpc<{ status: string }>(tx, 'respond_to_booking', {
        p_booking_id: booking.id,
        p_approve: true,
      }),
    )
    expect(row.status).toBe('payment_pending')
  })

  it('anon can send arbitrary notifications via notify', async () => {
    await asAnon(db, (tx) =>
      rpc(tx, 'notify', {
        p_user_id: s.renter.id,
        p_type: 'spoofed',
        p_message: 'Click here to claim your refund',
      }),
    )
    const { rows } = await db.query(
      `select 1 from public.notifications where user_id = $1 and type = 'spoofed'`,
      [s.renter.id],
    )
    expect(rows).toHaveLength(1)
  })
})

describe('KNOWN HOLE (fixed in 0029): owner can un-flag their own billboard', () => {
  let db: Db

  beforeAll(async () => {
    db = await createDb()
  })
  afterAll(async () => {
    await db?.close()
  })

  it('owner updates status flagged -> active', async () => {
    const s = await seedMarketplace(db)
    await db.query(
      `update public.billboards set status = 'flagged' where id = $1`,
      [s.billboard.id],
    )

    const res = await asUser(db, s.owner.id, (tx) =>
      tx.query<{ status: string }>(
        `update public.billboards set status = 'active' where id = $1 returning status`,
        [s.billboard.id],
      ),
    )
    expect(res.rows).toEqual([{ status: 'active' }])
  })
})
