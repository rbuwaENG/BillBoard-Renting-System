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

// Owned by F1 (0033_proof_of_posting.sql). Contract 7: owners add
// proof-of-posting photos while a booking is confirmed/active; the renter is
// notified and a 'proof_posted' booking event drives the timeline.

type Market = Awaited<ReturnType<typeof seedMarketplace>>

interface DocRow {
  id: string
  booking_id: string
  uploaded_by: string
  storage_path: string
  file_name: string
  kind: string
}

let seq = 0
async function bookingIn(
  db: Db,
  s: Market,
  stage: 'pending' | 'payment_pending' | 'confirmed',
) {
  seq += 1
  const start = 10 + seq * 5
  const booking = await createBooking(db, s.renter.id, s.billboard.id, {
    startDate: daysFromNow(start),
    endDate: daysFromNow(start + 2),
  })
  if (stage === 'pending') return booking
  await respondToBooking(db, s.owner.id, booking.id, true)
  if (stage === 'payment_pending') return booking
  await confirmPayment(db, s.admin.id, booking.id)
  return booking
}

function addProof(
  db: Db,
  userId: string,
  bookingId: string,
  overrides: Partial<{
    p_path: string
    p_name: string
    p_size: number
    p_mime: string
  }> = {},
) {
  const name = overrides.p_name ?? `photo-${Math.random().toString(36).slice(2, 7)}.jpg`
  return asUser(db, userId, (tx) =>
    rpc<DocRow>(tx, 'add_proof_of_posting', {
      p_booking_id: bookingId,
      p_path: `${bookingId}/proof/${crypto.randomUUID()}-${name}`,
      p_name: name,
      p_size: 2048,
      p_mime: 'image/jpeg',
      ...overrides,
    }),
  ).then((rows) => rows[0])
}

describe('add_proof_of_posting (0033)', () => {
  let db: Db
  let s: Market

  beforeAll(async () => {
    db = await createDb()
    s = await seedMarketplace(db)
  })
  afterAll(async () => {
    await db?.close()
  })

  it('is callable by authenticated only', async () => {
    const sig = 'public.add_proof_of_posting(uuid, text, text, bigint, text)'
    const { rows } = await db.query<{ anon: boolean; auth: boolean }>(
      `select has_function_privilege('anon', $1, 'execute') as anon,
              has_function_privilege('authenticated', $1, 'execute') as auth`,
      [sig],
    )
    expect(rows[0]).toEqual({ anon: false, auth: true })
    const booking = await bookingIn(db, s, 'confirmed')
    await expect(
      asAnon(db, (tx) =>
        rpc(tx, 'add_proof_of_posting', {
          p_booking_id: booking.id,
          p_path: `${booking.id}/proof/a.jpg`,
          p_name: 'a.jpg',
          p_size: 1,
          p_mime: 'image/jpeg',
        }),
      ),
    ).rejects.toMatchObject({ code: '42501' })
  })

  it('lets the owner add proof to a confirmed booking: document, event, one notification', async () => {
    const booking = await bookingIn(db, s, 'confirmed')
    const doc = await addProof(db, s.owner.id, booking.id, { p_name: 'front.jpg' })
    expect(doc).toMatchObject({
      booking_id: booking.id,
      uploaded_by: s.owner.id,
      kind: 'proof_of_posting',
      file_name: 'front.jpg',
    })

    const events = await db.query<{ actor_id: string; message: string }>(
      `select actor_id, message from public.booking_events
        where booking_id = $1 and event_type = 'proof_posted'`,
      [booking.id],
    )
    expect(events.rows).toEqual([{ actor_id: s.owner.id, message: 'front.jpg' }])

    // A second photo in the same batch doesn't notify again while unread...
    await addProof(db, s.owner.id, booking.id)
    const notes = () =>
      db.query<{ user_id: string }>(
        `select user_id from public.notifications
          where type = 'proof_of_posting' and ref_id = $1`,
        [booking.id],
      )
    expect((await notes()).rows).toEqual([{ user_id: s.renter.id }])

    // ...but does once the renter has read it.
    await db.query(
      `update public.notifications set read = true where type = 'proof_of_posting' and ref_id = $1`,
      [booking.id],
    )
    await addProof(db, s.owner.id, booking.id)
    expect((await notes()).rows).toHaveLength(2)
  })

  it('works while the booking is active', async () => {
    const booking = await bookingIn(db, s, 'confirmed')
    await db.query(`update public.bookings set status = 'active' where id = $1`, [
      booking.id,
    ])
    expect((await addProof(db, s.owner.id, booking.id)).kind).toBe('proof_of_posting')
  })

  it('rejects bookings that are not confirmed or active', async () => {
    for (const stage of ['pending', 'payment_pending'] as const) {
      const booking = await bookingIn(db, s, stage)
      await expect(addProof(db, s.owner.id, booking.id)).rejects.toThrow(
        'Proof of posting can only be added while the booking is confirmed or active',
      )
    }
    const done = await bookingIn(db, s, 'confirmed')
    await db.query(`update public.bookings set status = 'completed' where id = $1`, [
      done.id,
    ])
    await expect(addProof(db, s.owner.id, done.id)).rejects.toThrow(
      'confirmed or active',
    )
  })

  it('only the booking owner may add proof', async () => {
    const booking = await bookingIn(db, s, 'confirmed')
    const otherOwner = await createUser(db, { role: 'rentor' })
    for (const userId of [s.renter.id, otherOwner.id, s.admin.id]) {
      await expect(addProof(db, userId, booking.id)).rejects.toMatchObject({
        code: '42501',
      })
    }
    await expect(
      addProof(db, s.owner.id, '00000000-0000-0000-0000-000000000000'),
    ).rejects.toThrow('Booking not found')
  })

  it('renters cannot file a document as proof of posting', async () => {
    const booking = await bookingIn(db, s, 'confirmed')
    await expect(
      asUser(db, s.renter.id, (tx) =>
        rpc(tx, 'add_booking_document', {
          p_booking_id: booking.id,
          p_storage_path: `${booking.id}/x.jpg`,
          p_file_name: 'x.jpg',
          p_file_size: 10,
          p_kind: 'proof_of_posting',
        }),
      ),
    ).rejects.toMatchObject({ code: '42501' })
    // The renter path itself is unchanged.
    const [doc] = await asUser(db, s.renter.id, (tx) =>
      rpc<DocRow>(tx, 'add_booking_document', {
        p_booking_id: booking.id,
        p_storage_path: `${booking.id}/brief.pdf`,
        p_file_name: 'brief.pdf',
        p_file_size: 10,
        p_kind: 'brief',
      }),
    )
    expect(doc.kind).toBe('brief')
  })

  it('validates MIME type, path, size and name', async () => {
    const booking = await bookingIn(db, s, 'confirmed')
    await expect(
      addProof(db, s.owner.id, booking.id, { p_mime: 'application/pdf' }),
    ).rejects.toThrow('must be an image')
    await expect(
      addProof(db, s.owner.id, booking.id, { p_mime: 'video/mp4' }),
    ).rejects.toThrow('must be an image')
    await expect(
      addProof(db, s.owner.id, booking.id, { p_path: `${booking.id}/a.jpg` }),
    ).rejects.toThrow('Invalid storage path')
    await expect(
      addProof(db, s.owner.id, booking.id, {
        p_path: `${crypto.randomUUID()}/proof/a.jpg`,
      }),
    ).rejects.toThrow('Invalid storage path')
    await expect(
      addProof(db, s.owner.id, booking.id, { p_size: 0 }),
    ).rejects.toThrow('between 1 byte and 10 MB')
    await expect(
      addProof(db, s.owner.id, booking.id, { p_name: '   ' }),
    ).rejects.toThrow('Invalid file name')
  })

  it('caps proof photos at 10 per booking', async () => {
    const booking = await bookingIn(db, s, 'confirmed')
    for (let i = 0; i < 10; i++) await addProof(db, s.owner.id, booking.id)
    await expect(addProof(db, s.owner.id, booking.id)).rejects.toThrow(
      'at most 10 proof-of-posting photos',
    )
  })

  it('suspended owners cannot add proof', async () => {
    const owner = await createUser(db, { role: 'rentor' })
    const billboard = await createBillboard(db, owner.id)
    const booking = await createBooking(db, s.renter.id, billboard.id)
    await respondToBooking(db, owner.id, booking.id, true)
    await confirmPayment(db, s.admin.id, booking.id)
    await db.query(`update public.profiles set status = 'suspended' where id = $1`, [
      owner.id,
    ])
    await expect(addProof(db, owner.id, booking.id)).rejects.toThrow(
      'Account suspended',
    )
  })

  it('proof is part of the record: the owner cannot remove it', async () => {
    const booking = await bookingIn(db, s, 'confirmed')
    const doc = await addProof(db, s.owner.id, booking.id)
    await expect(
      asUser(db, s.owner.id, (tx) =>
        rpc(tx, 'remove_booking_document', { p_document_id: doc.id }),
      ),
    ).rejects.toThrow('can no longer be removed')
  })

  it('participants and admins can read the proof rows; others cannot', async () => {
    const booking = await bookingIn(db, s, 'confirmed')
    await addProof(db, s.owner.id, booking.id)
    const outsider = await createUser(db, { role: 'renter' })
    const count = (userId: string) =>
      asUser(db, userId, (tx) =>
        tx.query(
          `select 1 from public.booking_documents where booking_id = $1 and kind = 'proof_of_posting'`,
          [booking.id],
        ),
      ).then((r) => r.rows.length)
    expect(await count(s.renter.id)).toBe(1)
    expect(await count(s.owner.id)).toBe(1)
    expect(await count(s.admin.id)).toBe(1)
    expect(await count(outsider.id)).toBe(0)
  })
})

describe('proof-of-posting storage (0033)', () => {
  let db: Db
  let s: Market

  const putObject = (userId: string, name: string) =>
    asUser(db, userId, (tx) =>
      tx.query(
        `insert into storage.objects (bucket_id, name, owner) values ('booking-creatives', $1, $2)`,
        [name, userId],
      ),
    )
  const canRead = (userId: string, name: string) =>
    asUser(db, userId, (tx) =>
      tx.query(
        `select 1 from storage.objects where bucket_id = 'booking-creatives' and name = $1`,
        [name],
      ),
    ).then((r) => r.rows.length === 1)

  beforeAll(async () => {
    db = await createDb()
    s = await seedMarketplace(db)
  })
  afterAll(async () => {
    await db?.close()
  })

  it('owner uploads into <booking>/proof/ of a confirmed booking; participants + admin read it', async () => {
    const booking = await bookingIn(db, s, 'confirmed')
    const name = `${booking.id}/proof/${crypto.randomUUID()}-front.jpg`
    await putObject(s.owner.id, name)
    expect(await canRead(s.renter.id, name)).toBe(true)
    expect(await canRead(s.owner.id, name)).toBe(true)
    expect(await canRead(s.admin.id, name)).toBe(true)
    const outsider = await createUser(db, { role: 'renter' })
    expect(await canRead(outsider.id, name)).toBe(false)
  })

  it('owner cannot write outside the proof folder', async () => {
    const booking = await bookingIn(db, s, 'confirmed')
    await expect(
      putObject(s.owner.id, `${booking.id}/creative.jpg`),
    ).rejects.toMatchObject({ code: '42501' })
  })

  it('owner cannot upload proof before confirmation, nor for others’ bookings', async () => {
    const booking = await bookingIn(db, s, 'payment_pending')
    await expect(
      putObject(s.owner.id, `${booking.id}/proof/a.jpg`),
    ).rejects.toMatchObject({ code: '42501' })

    const confirmed = await bookingIn(db, s, 'confirmed')
    const otherOwner = await createUser(db, { role: 'rentor' })
    await expect(
      putObject(otherOwner.id, `${confirmed.id}/proof/a.jpg`),
    ).rejects.toMatchObject({ code: '42501' })
  })
})
