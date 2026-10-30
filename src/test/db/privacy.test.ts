import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  asAnon,
  asRole,
  asUser,
  createBillboard,
  createBooking,
  createDb,
  createUser,
  rpc,
  seedMarketplace,
  type Db,
  type Tx,
} from './harness'

// Owned by DB-P (0030_profile_privacy.sql).
//
// 0030 replaces table-level SELECT on profiles with column-level SELECT on the
// public columns, so the row policies (0006 / 0007 / 0020) no longer leak
// email/phone. Private columns come from SECURITY DEFINER RPCs.

const PUBLIC_COLS = 'id, display_name, photo_url, role, status, created_at'
const OWNER_PHONE = '+94 77 000 0000'

type Seed = Awaited<ReturnType<typeof seedMarketplace>>

function selectAs(
  db: Db,
  who: 'anon' | string,
  sql: string,
  params: unknown[] = [],
) {
  const run = (tx: Tx) => tx.query(sql, params)
  return who === 'anon' ? asAnon(db, run) : asUser(db, who, run)
}

async function setBookingStatus(db: Db, bookingId: string, status: string) {
  await db.query(`update public.bookings set status = $2 where id = $1`, [
    bookingId,
    status,
  ])
}

describe('0030: profile PII is not readable through the table', () => {
  let db: Db
  let s: Seed
  let stranger: { id: string }
  let renterWithBooking: { id: string }

  beforeAll(async () => {
    db = await createDb()
    s = await seedMarketplace(db)
    stranger = await createUser(db, { role: 'renter' })
    renterWithBooking = await createUser(db, { role: 'renter' })
    // Makes the owner a booking counterparty of renterWithBooking (0007).
    await createBooking(db, renterWithBooking.id, s.billboard.id)
  })
  afterAll(async () => {
    await db?.close()
  })

  for (const col of ['email', 'phone', '*']) {
    it(`anon gets permission denied for "select ${col}" on an owner with an active billboard`, async () => {
      await expect(
        selectAs(
          db,
          'anon',
          `select ${col} from public.profiles where id = $1`,
          [s.owner.id],
        ),
      ).rejects.toMatchObject({ code: '42501' })
    })

    it(`an unrelated user gets permission denied for "select ${col}"`, async () => {
      await expect(
        selectAs(
          db,
          stranger.id,
          `select ${col} from public.profiles where id = $1`,
          [s.owner.id],
        ),
      ).rejects.toMatchObject({ code: '42501' })
    })

    it(`a booking counterparty gets permission denied for "select ${col}"`, async () => {
      await expect(
        selectAs(
          db,
          renterWithBooking.id,
          `select ${col} from public.profiles where id = $1`,
          [s.owner.id],
        ),
      ).rejects.toMatchObject({ code: '42501' })
    })
  }

  it('a user cannot select their own email through the table either', async () => {
    await expect(
      selectAs(
        db,
        s.renter.id,
        `select email from public.profiles where id = $1`,
        [s.renter.id],
      ),
    ).rejects.toMatchObject({ code: '42501' })
  })

  it('column privileges are exactly the public columns', async () => {
    const { rows } = await db.query<{
      role: string
      column_name: string
      can_select: boolean
    }>(
      `select r.role, c.column_name,
              has_column_privilege(r.role, 'public.profiles', c.column_name, 'select') as can_select
         from (values ('anon'), ('authenticated')) r(role)
        cross join information_schema.columns c
        where c.table_schema = 'public' and c.table_name = 'profiles'
        order by 1, 2`,
    )
    const readable = rows
      .filter((r) => r.can_select)
      .map((r) => `${r.role}.${r.column_name}`)
    const expected = PUBLIC_COLS.split(', ').sort()
    expect(readable).toEqual([
      ...expected.map((c) => `anon.${c}`),
      ...expected.map((c) => `authenticated.${c}`),
    ])
  })

  it('anon still reads the public columns of an owner with an active billboard', async () => {
    const { rows } = await selectAs(
      db,
      'anon',
      `select ${PUBLIC_COLS} from public.profiles where id = $1`,
      [s.owner.id],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: s.owner.id,
      role: 'rentor',
      status: 'active',
    })
  })

  it('the billboard -> owner display_name embed still works for anon', async () => {
    // What PostgREST runs for billboards?select=*,profiles(display_name).
    const { rows } = await selectAs(
      db,
      'anon',
      `select b.id, p.display_name
         from public.billboards b
         left join public.profiles p on p.id = b.owner_id
        where b.id = $1`,
      [s.billboard.id],
    )
    expect(rows).toEqual([
      { id: s.billboard.id, display_name: expect.any(String) },
    ])
  })

  it('the counterparty still sees the public columns (0007 row policy kept)', async () => {
    const { rows } = await selectAs(
      db,
      renterWithBooking.id,
      `select id, display_name from public.profiles where id = $1`,
      [s.owner.id],
    )
    expect(rows).toHaveLength(1)
  })

  it('anon and authenticated cannot insert or delete profiles', async () => {
    await expect(
      selectAs(db, stranger.id, `delete from public.profiles where id = $1`, [
        stranger.id,
      ]),
    ).rejects.toMatchObject({ code: '42501' })
    await expect(
      selectAs(
        db,
        'anon',
        `insert into public.profiles (id, display_name, email) values (gen_random_uuid(), 'x', 'x@x')`,
      ),
    ).rejects.toMatchObject({ code: '42501' })
  })
})

describe('0030: get_my_profile', () => {
  let db: Db
  let s: Seed

  beforeAll(async () => {
    db = await createDb()
    s = await seedMarketplace(db)
  })
  afterAll(async () => {
    await db?.close()
  })

  it('returns the full row of the caller, including email and phone', async () => {
    const rows = await asUser(db, s.owner.id, (tx) => rpc(tx, 'get_my_profile'))
    expect(rows).toEqual([
      expect.objectContaining({
        id: s.owner.id,
        email: s.owner.email,
        phone: OWNER_PHONE,
        role: 'rentor',
        status: 'active',
      }),
    ])
  })

  it('is not executable by anon', async () => {
    await expect(
      asAnon(db, (tx) => rpc(tx, 'get_my_profile')),
    ).rejects.toMatchObject({ code: '42501' })
  })

  it('raises "Not authenticated" for an authenticated role without a subject', async () => {
    await expect(
      asRole(db, 'authenticated', { role: 'authenticated' }, (tx) =>
        rpc(tx, 'get_my_profile'),
      ),
    ).rejects.toThrow(/Not authenticated/)
  })

  it('only authenticated may execute the new functions', async () => {
    const fns = [
      'public.get_my_profile()',
      'public.admin_list_users(text, integer, integer)',
      'public.admin_count_users(text)',
      'public.get_booking_contact(uuid)',
    ]
    for (const fn of fns) {
      const { rows } = await db.query<{ anon: boolean; authed: boolean }>(
        `select has_function_privilege('anon', $1, 'execute') as anon,
                has_function_privilege('authenticated', $1, 'execute') as authed`,
        [fn],
      )
      expect({ fn, ...rows[0] }).toEqual({ fn, anon: false, authed: true })
    }
  })
})

describe('0030: admin_list_users / admin_count_users', () => {
  let db: Db
  let s: Seed
  let alice: { id: string; email: string }

  beforeAll(async () => {
    db = await createDb()
    s = await seedMarketplace(db)
    alice = await createUser(db, {
      role: 'renter',
      displayName: 'Alice Wonder',
      email: 'alice.wonder@example.test',
    })
  })
  afterAll(async () => {
    await db?.close()
  })

  it('is admin-only', async () => {
    await expect(
      asUser(db, s.renter.id, (tx) => rpc(tx, 'admin_list_users')),
    ).rejects.toThrow(/Only admins/)
    await expect(
      asUser(db, s.owner.id, (tx) => rpc(tx, 'admin_count_users')),
    ).rejects.toThrow(/Only admins/)
    await expect(
      asAnon(db, (tx) => rpc(tx, 'admin_list_users')),
    ).rejects.toMatchObject({ code: '42501' })
  })

  it('lists every user with email/phone, newest first', async () => {
    const rows = await asUser(db, s.admin.id, (tx) =>
      rpc<{
        id: string
        email: string
        phone: string | null
        created_at: Date
      }>(tx, 'admin_list_users', { p_limit: 1000 }),
    )
    expect(rows.map((r) => r.id).sort()).toEqual(
      [s.owner.id, s.renter.id, s.admin.id, alice.id].sort(),
    )
    expect(rows.find((r) => r.id === s.owner.id)).toMatchObject({
      email: s.owner.email,
      phone: OWNER_PHONE,
    })
    const times = rows.map((r) => new Date(r.created_at).getTime())
    expect(times).toEqual([...times].sort((a, b) => b - a))
  })

  it('searches display_name and email case-insensitively', async () => {
    const byName = await asUser(db, s.admin.id, (tx) =>
      rpc<{ id: string }>(tx, 'admin_list_users', { p_search: 'WONDER' }),
    )
    expect(byName.map((r) => r.id)).toEqual([alice.id])

    const byEmail = await asUser(db, s.admin.id, (tx) =>
      rpc<{ id: string }>(tx, 'admin_list_users', { p_search: s.owner.email }),
    )
    expect(byEmail.map((r) => r.id)).toEqual([s.owner.id])

    const wildcard = await asUser(db, s.admin.id, (tx) =>
      rpc<{ id: string }>(tx, 'admin_list_users', { p_search: '%' }),
    )
    expect(wildcard).toEqual([])
  })

  it('pages with limit/offset and counts with the same filter', async () => {
    const page1 = await asUser(db, s.admin.id, (tx) =>
      rpc<{ id: string }>(tx, 'admin_list_users', { p_limit: 2, p_offset: 0 }),
    )
    const page2 = await asUser(db, s.admin.id, (tx) =>
      rpc<{ id: string }>(tx, 'admin_list_users', { p_limit: 2, p_offset: 2 }),
    )
    expect(page1).toHaveLength(2)
    expect(page2).toHaveLength(2)
    expect(new Set([...page1, ...page2].map((r) => r.id)).size).toBe(4)

    const [all] = await asUser(db, s.admin.id, (tx) =>
      rpc<{ admin_count_users: string }>(tx, 'admin_count_users'),
    )
    expect(Number(all.admin_count_users)).toBe(4)
    const [some] = await asUser(db, s.admin.id, (tx) =>
      rpc<{ admin_count_users: string }>(tx, 'admin_count_users', {
        p_search: 'alice',
      }),
    )
    expect(Number(some.admin_count_users)).toBe(1)
  })
})

describe('0030: get_booking_contact', () => {
  let db: Db
  let s: Seed
  let stranger: { id: string }
  let bookingId: string

  beforeAll(async () => {
    db = await createDb()
    s = await seedMarketplace(db)
    await db.query(
      `update public.profiles set phone = '+94 71 111 1111' where id = $1`,
      [s.renter.id],
    )
    stranger = await createUser(db, { role: 'renter' })
    bookingId = (await createBooking(db, s.renter.id, s.billboard.id)).id
  })
  afterAll(async () => {
    await db?.close()
  })

  const contact = (userId: string) =>
    asUser(db, userId, (tx) =>
      rpc<{ email: string; phone: string | null; display_name: string }>(
        tx,
        'get_booking_contact',
        { p_booking_id: bookingId },
      ),
    )

  it('denies participants while the booking is pending', async () => {
    await expect(contact(s.renter.id)).rejects.toThrow(
      'Contact details are shared once the booking is confirmed',
    )
    await expect(contact(s.owner.id)).rejects.toThrow(
      'Contact details are shared once the booking is confirmed',
    )
  })

  it('denies payment_pending bookings too', async () => {
    await setBookingStatus(db, bookingId, 'payment_pending')
    await expect(contact(s.renter.id)).rejects.toThrow(
      /shared once the booking is confirmed/,
    )
  })

  it('returns the counterparty (not the caller) once confirmed / active / completed', async () => {
    for (const status of ['confirmed', 'active', 'completed']) {
      await setBookingStatus(db, bookingId, status)
      expect(await contact(s.renter.id)).toEqual([
        {
          email: s.owner.email,
          phone: OWNER_PHONE,
          display_name: expect.any(String),
        },
      ])
      expect(await contact(s.owner.id)).toEqual([
        {
          email: s.renter.email,
          phone: '+94 71 111 1111',
          display_name: expect.any(String),
        },
      ])
    }
  })

  it('denies non-participants, including admins', async () => {
    await setBookingStatus(db, bookingId, 'confirmed')
    await expect(contact(stranger.id)).rejects.toThrow(/Booking not found/)
    await expect(contact(s.admin.id)).rejects.toThrow(/Booking not found/)
  })

  it('denies an unknown booking and anon', async () => {
    await expect(
      asUser(db, s.renter.id, (tx) =>
        rpc(tx, 'get_booking_contact', {
          p_booking_id: '00000000-0000-0000-0000-000000000000',
        }),
      ),
    ).rejects.toThrow(/Booking not found/)
    await expect(
      asAnon(db, (tx) =>
        rpc(tx, 'get_booking_contact', { p_booking_id: bookingId }),
      ),
    ).rejects.toMatchObject({ code: '42501' })
  })
})

describe('0030: profile updates', () => {
  let db: Db
  let s: Seed

  beforeAll(async () => {
    db = await createDb()
    s = await seedMarketplace(db)
  })
  afterAll(async () => {
    await db?.close()
  })

  it('a user updates their own display_name, phone and photo_url (no RETURNING)', async () => {
    const res = await asUser(db, s.renter.id, (tx) =>
      tx.query(
        `update public.profiles
            set display_name = 'New Name', phone = '+94 70 123 4567', photo_url = 'https://x.test/p.png'
          where id = $1`,
        [s.renter.id],
      ),
    )
    expect(res.affectedRows).toBe(1)
    const [me] = await asUser(db, s.renter.id, (tx) =>
      rpc<{ display_name: string; phone: string; photo_url: string }>(
        tx,
        'get_my_profile',
      ),
    )
    expect(me).toMatchObject({
      display_name: 'New Name',
      phone: '+94 70 123 4567',
      photo_url: 'https://x.test/p.png',
    })
  })

  it('can clear the phone number', async () => {
    await asUser(db, s.renter.id, (tx) =>
      tx.query(`update public.profiles set phone = null where id = $1`, [
        s.renter.id,
      ]),
    )
    const [me] = await asUser(db, s.renter.id, (tx) =>
      rpc<{ phone: string | null }>(tx, 'get_my_profile'),
    )
    expect(me.phone).toBeNull()
  })

  it('RETURNING public columns works; RETURNING email is denied', async () => {
    const { rows } = await asUser(db, s.renter.id, (tx) =>
      tx.query(
        `update public.profiles set display_name = 'Again' where id = $1 returning ${PUBLIC_COLS}`,
        [s.renter.id],
      ),
    )
    expect(rows).toHaveLength(1)
    await expect(
      asUser(db, s.renter.id, (tx) =>
        tx.query(
          `update public.profiles set display_name = 'X' where id = $1 returning email`,
          [s.renter.id],
        ),
      ),
    ).rejects.toMatchObject({ code: '42501' })
  })

  it('a user cannot change their email column', async () => {
    await expect(
      asUser(db, s.renter.id, (tx) =>
        tx.query(
          `update public.profiles set email = 'evil@x.test' where id = $1`,
          [s.renter.id],
        ),
      ),
    ).rejects.toMatchObject({ code: '42501' })
  })

  it('a non-admin cannot change their own role/status (trigger resets them)', async () => {
    await asUser(db, s.renter.id, (tx) =>
      tx.query(
        `update public.profiles set role = 'admin', status = 'active' where id = $1`,
        [s.renter.id],
      ),
    )
    const { rows } = await db.query<{ role: string }>(
      `select role from public.profiles where id = $1`,
      [s.renter.id],
    )
    expect(rows[0].role).toBe('renter')
  })

  it('a user cannot update the profile of another user', async () => {
    const res = await asUser(db, s.renter.id, (tx) =>
      tx.query(
        `update public.profiles set display_name = 'Hacked' where id = $1`,
        [s.owner.id],
      ),
    )
    expect(res.affectedRows).toBe(0)
  })

  it('an admin can promote, demote and suspend another user', async () => {
    const target = await createUser(db, { role: 'renter' })
    const upd = (set: string) =>
      asUser(db, s.admin.id, (tx) =>
        tx.query(`update public.profiles set ${set} where id = $1`, [
          target.id,
        ]),
      )
    expect((await upd(`role = 'admin'`)).affectedRows).toBe(1)
    expect((await upd(`role = 'renter'`)).affectedRows).toBe(1)
    expect((await upd(`status = 'suspended'`)).affectedRows).toBe(1)
    const { rows } = await db.query<{ role: string; status: string }>(
      `select role, status from public.profiles where id = $1`,
      [target.id],
    )
    expect(rows[0]).toEqual({ role: 'renter', status: 'suspended' })
  })
})

describe('0030: SECURITY DEFINER code that reads profiles still works', () => {
  let db: Db
  let s: Seed

  beforeAll(async () => {
    db = await createDb()
    s = await seedMarketplace(db)
  })
  afterAll(async () => {
    await db?.close()
  })

  it('the auth trigger creates profiles', async () => {
    const u = await createUser(db, {
      role: 'rentor',
      displayName: 'Trigger Test',
    })
    const { rows } = await db.query(
      `select display_name, email, role from public.profiles where id = $1`,
      [u.id],
    )
    expect(rows).toEqual([
      { display_name: 'Trigger Test', email: u.email, role: 'rentor' },
    ])
  })

  it('role-dependent policies (rentor creates a billboard) still work', async () => {
    const { rows } = await asUser(db, s.owner.id, (tx) =>
      tx.query(
        `insert into public.billboards (owner_id, title, lat, lng, price_per_day)
         values ($1, 'Mine', 6.9, 79.8, 500) returning id`,
        [s.owner.id],
      ),
    )
    expect(rows).toHaveLength(1)
  })

  it('booking request, chat thread + message and their notifications still work', async () => {
    const other = await createBillboard(db, s.owner.id, { title: 'Chat board' })
    const booking = await createBooking(db, s.renter.id, other.id)
    expect(booking.status).toBe('pending_owner_review')

    const [thread] = await asUser(db, s.renter.id, (tx) =>
      rpc<{ id: string }>(tx, 'get_or_create_chat_thread', {
        p_billboard_id: other.id,
      }),
    )
    await asUser(db, s.renter.id, (tx) =>
      tx.query(
        `insert into public.chat_messages (thread_id, sender_id, body) values ($1, $2, 'hi')`,
        [thread.id, s.renter.id],
      ),
    )
    const { rows } = await db.query<{ type: string }>(
      `select type from public.notifications where user_id = $1 order by created_at`,
      [s.owner.id],
    )
    expect(rows.map((r) => r.type)).toContain('new_message')
    expect(rows.length).toBeGreaterThanOrEqual(2)
  })
})
