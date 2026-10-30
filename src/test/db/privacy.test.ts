import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asAnon, createDb, seedMarketplace, type Db } from './harness'

// Owned by DB-P (0030_profile_privacy.sql) from wave 2 on.
//
// "KNOWN HOLE" asserts today's INSECURE behaviour. When 0030 lands, invert it
// (anon must get a permission error on email/phone, or no PII columns) and
// drop the KNOWN HOLE label.

describe('KNOWN HOLE (fixed in 0030): anon can read owner PII', () => {
  let db: Db

  beforeAll(async () => {
    db = await createDb()
  })
  afterAll(async () => {
    await db?.close()
  })

  it('anon selects email and phone of an owner with an active billboard', async () => {
    const s = await seedMarketplace(db)
    const { rows } = await asAnon(db, (tx) =>
      tx.query<{ email: string; phone: string }>(
        `select email, phone from public.profiles where id = $1`,
        [s.owner.id],
      ),
    )
    expect(rows).toEqual([{ email: s.owner.email, phone: '+94 77 000 0000' }])
  })
})
