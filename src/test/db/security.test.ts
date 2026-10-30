import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  asAnon,
  asService,
  asUser,
  createBillboard,
  createBooking,
  createDb,
  createUser,
  daysFromNow,
  respondToBooking,
  rpc,
  seedMarketplace,
  type Db,
  type Queryable,
} from './harness'

// Owned by DB-S (0029_security_hardening.sql).

type Market = Awaited<ReturnType<typeof seedMarketplace>>

async function bookingStatus(db: Db, id: string): Promise<string> {
  const { rows } = await db.query<{ status: string }>(
    `select status from public.bookings where id = $1`,
    [id],
  )
  return rows[0].status
}

async function setBookingStatus(db: Db, id: string, status: string) {
  await db.query(`update public.bookings set status = $2 where id = $1`, [
    id,
    status,
  ])
}

async function suspend(db: Db, userId: string) {
  await db.query(
    `update public.profiles set status = 'suspended' where id = $1`,
    [userId],
  )
}

function canExecute(q: Queryable, role: string, fn: string) {
  return q
    .query<{ ok: boolean }>(
      `select has_function_privilege($1, $2, 'execute') as ok`,
      [role, fn],
    )
    .then((r) => r.rows[0].ok)
}

// Functions the API roles may call; everything else in public (outside
// extensions) is owner/service_role only.
const ANON_FUNCTIONS = [
  'billboards_near(double precision,double precision,double precision)',
  'current_profile_role()',
  'is_active_user()',
  'is_admin()',
]
const AUTHENTICATED_FUNCTIONS = [
  ...ANON_FUNCTIONS,
  'add_booking_document(uuid,text,text,bigint,text)',
  'admin_confirm_payment(uuid,numeric,text,text)',
  'admin_create_payout(uuid,uuid[],date)',
  'admin_release_payout(uuid)',
  'admin_set_billboard_status(uuid,text,text)',
  'advance_booking_lifecycle()',
  'assert_active_user()',
  'attach_booking_creative(uuid,text)',
  'cancel_booking(uuid)',
  'create_campaign(text,date,date,uuid[])',
  'get_or_create_chat_thread(uuid)',
  'remove_booking_document(uuid)',
  'renter_pay_booking(uuid)',
  'request_booking(uuid,date,date,text)',
  'request_booking_documents(uuid,text)',
  'respond_to_booking(uuid,boolean,text)',
  'submit_review(uuid,integer,text)',
]

async function executableBy(db: Db, role: string): Promise<string[]> {
  const { rows } = await db.query<{ sig: string }>(
    `select regexp_replace(p.oid::regprocedure::text, '^public\\.', '') as sig
       from pg_proc p
      where p.pronamespace = 'public'::regnamespace
        and not exists (select 1 from pg_depend d
                         where d.classid = 'pg_proc'::regclass
                           and d.objid = p.oid and d.deptype = 'e')
        and has_function_privilege($1, p.oid, 'execute')
      order by 1`,
    [role],
  )
  return rows.map((r) => r.sig.replace(/, /g, ','))
}

describe('function privileges (0029)', () => {
  let db: Db
  let s: Market

  beforeAll(async () => {
    db = await createDb()
    s = await seedMarketplace(db)
  })
  afterAll(async () => {
    await db?.close()
  })

  it('anon can execute only the browsing helpers', async () => {
    expect(await executableBy(db, 'anon')).toEqual([...ANON_FUNCTIONS].sort())
  })

  it('authenticated can execute only the user-facing RPCs and policy helpers', async () => {
    expect(await executableBy(db, 'authenticated')).toEqual(
      [...AUTHENTICATED_FUNCTIONS].sort(),
    )
  })

  it('internal helpers are service_role only', async () => {
    for (const fn of [
      'public.notify(uuid, text, text, uuid)',
      'public.release_due_payouts()',
      'public.send_booking_reminders()',
      'public.run_scheduled_jobs()',
      'public.trg_booking_notify()',
      'public.recalc_billboard_rating()',
      'public.protect_billboard_fields()',
    ]) {
      expect(await canExecute(db, 'anon', fn)).toBe(false)
      expect(await canExecute(db, 'authenticated', fn)).toBe(false)
      expect(await canExecute(db, 'service_role', fn)).toBe(true)
    }
  })

  it('functions created by later migrations are not executable by default', async () => {
    await db.exec(
      `create function public.zz_probe() returns int language sql as 'select 1'`,
    )
    expect(await canExecute(db, 'anon', 'public.zz_probe()')).toBe(false)
    expect(await canExecute(db, 'authenticated', 'public.zz_probe()')).toBe(
      false,
    )
    expect(await canExecute(db, 'service_role', 'public.zz_probe()')).toBe(true)
    await db.exec(`drop function public.zz_probe()`)
  })

  it('anon cannot call respond_to_booking (booking unchanged)', async () => {
    const booking = await createBooking(db, s.renter.id, s.billboard.id)
    await expect(
      asAnon(db, (tx) =>
        rpc(tx, 'respond_to_booking', {
          p_booking_id: booking.id,
          p_approve: true,
        }),
      ),
    ).rejects.toMatchObject({ code: '42501' })
    expect(await bookingStatus(db, booking.id)).toBe('pending_owner_review')
  })

  it('anon cannot call notify, cancel_booking or other mutating RPCs', async () => {
    const booking = await createBooking(db, s.renter.id, s.billboard.id, {
      startDate: daysFromNow(20),
      endDate: daysFromNow(21),
    })
    const calls: [string, Record<string, unknown>][] = [
      [
        'notify',
        { p_user_id: s.renter.id, p_type: 'spoofed', p_message: 'Refund!' },
      ],
      ['cancel_booking', { p_booking_id: booking.id }],
      [
        'attach_booking_creative',
        { p_booking_id: booking.id, p_creative_path: 'x' },
      ],
      ['request_booking_documents', { p_booking_id: booking.id, p_note: 'x' }],
      ['get_or_create_chat_thread', { p_billboard_id: s.billboard.id }],
      [
        'admin_set_billboard_status',
        { p_billboard_id: s.billboard.id, p_status: 'flagged' },
      ],
      ['advance_booking_lifecycle', {}],
      ['release_due_payouts', {}],
      ['send_booking_reminders', {}],
    ]
    for (const [fn, args] of calls) {
      await expect(
        asAnon(db, (tx) => rpc(tx, fn, args)),
        fn,
      ).rejects.toMatchObject({ code: '42501' })
    }
    const { rows } = await db.query(
      `select 1 from public.notifications where type = 'spoofed'`,
    )
    expect(rows).toHaveLength(0)
    expect(await bookingStatus(db, booking.id)).toBe('pending_owner_review')
  })

  it('authenticated users cannot call notify directly', async () => {
    await expect(
      asUser(db, s.renter.id, (tx) =>
        rpc(tx, 'notify', {
          p_user_id: s.owner.id,
          p_type: 'spoofed',
          p_message: 'x',
        }),
      ),
    ).rejects.toMatchObject({ code: '42501' })
    await asService(db, (tx) =>
      rpc(tx, 'notify', {
        p_user_id: s.owner.id,
        p_type: 'system',
        p_message: 'ok',
      }),
    )
  })

  it('anon holds no write privilege on any public table; nobody can TRUNCATE', async () => {
    const { rows } = await db.query<{ t: string; role: string }>(
      `select c.relname as t, r.role
         from pg_class c
         cross join (values ('anon'), ('authenticated')) r(role)
        where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
          and (
            (r.role = 'anon' and (has_table_privilege('anon', c.oid, 'insert')
                               or has_table_privilege('anon', c.oid, 'update')
                               or has_table_privilege('anon', c.oid, 'delete')))
            or has_table_privilege(r.role, c.oid, 'truncate')
          )`,
    )
    expect(rows).toEqual([])
  })
})

describe('anon browsing still works (0029)', () => {
  let db: Db
  let s: Market

  beforeAll(async () => {
    db = await createDb()
    s = await seedMarketplace(db)
    await createBillboard(db, s.owner.id, {
      title: 'Hidden',
      status: 'inactive',
    })
    await db.query(
      `insert into public.billboard_pricing_tiers (billboard_id, min_days, price_per_day) values ($1, 7, 800)`,
      [s.billboard.id],
    )
    await db.query(
      `insert into storage.objects (bucket_id, name) values ('billboard-images', $1)`,
      [`${s.owner.id}/a.png`],
    )
  })
  afterAll(async () => {
    await db?.close()
  })

  it('billboards_near and select on active billboards', async () => {
    const near = await asAnon(db, (tx) =>
      rpc<{ id: string }>(tx, 'billboards_near', {
        p_lat: 6.93,
        p_lng: 79.86,
        p_radius_km: 5,
      }),
    )
    expect(near.map((r) => r.id)).toContain(s.billboard.id)
    const { rows } = await asAnon(db, (tx) =>
      tx.query<{ title: string }>(`select title from public.billboards`),
    )
    expect(rows.map((r) => r.title)).toContain('Test billboard')
    expect(rows.map((r) => r.title)).not.toContain('Hidden')
  })

  it('taxonomy, reviews, tiers, settings, districts and public images', async () => {
    await asAnon(db, async (tx) => {
      for (const [table, min] of [
        ['categories', 1],
        ['sizes', 1],
        ['reviews', 0],
        ['billboard_pricing_tiers', 1],
        ['platform_settings', 1],
        ['district_profiles', 1],
      ] as const) {
        const { rows } = await tx.query(`select * from public.${table}`)
        expect(rows.length, table).toBeGreaterThanOrEqual(min)
      }
      const imgs = await tx.query(
        `select name from storage.objects where bucket_id = 'billboard-images'`,
      )
      expect(imgs.rows).toHaveLength(1)
    })
  })

  it('anon cannot write tables', async () => {
    await expect(
      asAnon(db, (tx) => tx.query(`update public.billboards set title = 'x'`)),
    ).rejects.toMatchObject({ code: '42501' })
    await expect(
      asAnon(db, (tx) =>
        tx.query(`insert into public.categories (name) values ('x')`),
      ),
    ).rejects.toMatchObject({ code: '42501' })
  })
})

describe('null-safe guards in booking RPCs (0029)', () => {
  let db: Db
  let s: Market

  beforeAll(async () => {
    db = await createDb()
    s = await seedMarketplace(db)
  })
  afterAll(async () => {
    await db?.close()
  })

  it('a logged-in non-owner cannot respond', async () => {
    const other = await createUser(db, { role: 'rentor' })
    const booking = await createBooking(db, s.renter.id, s.billboard.id)
    await expect(
      respondToBooking(db, other.id, booking.id, true),
    ).rejects.toMatchObject({ code: '42501' })
    await expect(
      respondToBooking(db, s.renter.id, booking.id, true),
    ).rejects.toThrow('Not authorized to respond to this booking')
    expect(await bookingStatus(db, booking.id)).toBe('pending_owner_review')
  })

  it('approving after the start date fails; rejecting a stale request still works', async () => {
    const booking = await createBooking(db, s.renter.id, s.billboard.id, {
      startDate: daysFromNow(30),
      endDate: daysFromNow(31),
    })
    await db.query(
      `update public.bookings set start_date = current_date where id = $1`,
      [booking.id],
    )
    await expect(
      respondToBooking(db, s.owner.id, booking.id, true),
    ).rejects.toThrow('This booking has already started')
    const row = await respondToBooking(
      db,
      s.owner.id,
      booking.id,
      false,
      'late',
    )
    expect(row.status).toBe('rejected')
  })

  it('only the renter can cancel / attach / add documents; only the owner requests documents', async () => {
    const stranger = await createUser(db)
    const booking = await createBooking(db, s.renter.id, s.billboard.id, {
      startDate: daysFromNow(40),
      endDate: daysFromNow(41),
    })
    const attempts: [string, Record<string, unknown>, string][] = [
      ['cancel_booking', { p_booking_id: booking.id }, stranger.id],
      [
        'attach_booking_creative',
        { p_booking_id: booking.id, p_creative_path: 'x' },
        stranger.id,
      ],
      [
        'add_booking_document',
        {
          p_booking_id: booking.id,
          p_storage_path: 'x',
          p_file_name: 'x',
          p_file_size: 1,
        },
        s.owner.id,
      ],
      [
        'request_booking_documents',
        { p_booking_id: booking.id, p_note: 'x' },
        s.renter.id,
      ],
    ]
    for (const [fn, args, user] of attempts) {
      await expect(
        asUser(db, user, (tx) => rpc(tx, fn, args)),
        fn,
      ).rejects.toMatchObject({ code: '42501' })
    }
    const [cancelled] = await asUser(db, s.renter.id, (tx) =>
      rpc<{ status: string }>(tx, 'cancel_booking', {
        p_booking_id: booking.id,
      }),
    )
    expect(cancelled.status).toBe('cancelled')
  })

  it('documents cannot be removed once the booking is confirmed', async () => {
    const booking = await createBooking(db, s.renter.id, s.billboard.id, {
      startDate: daysFromNow(50),
      endDate: daysFromNow(51),
    })
    const add = () =>
      asUser(db, s.renter.id, (tx) =>
        rpc<{ id: string }>(tx, 'add_booking_document', {
          p_booking_id: booking.id,
          p_storage_path: `${booking.id}/brief.pdf`,
          p_file_name: 'brief.pdf',
          p_file_size: 10,
        }),
      )
    const [first] = await add()
    await asUser(db, s.renter.id, (tx) =>
      rpc(tx, 'remove_booking_document', { p_document_id: first.id }),
    )
    const [second] = await add()
    await setBookingStatus(db, booking.id, 'confirmed')
    await expect(
      asUser(db, s.renter.id, (tx) =>
        rpc(tx, 'remove_booking_document', { p_document_id: second.id }),
      ),
    ).rejects.toThrow('Documents can no longer be removed')
  })
})

describe('suspended users cannot act (0029)', () => {
  let db: Db
  let s: Market

  beforeAll(async () => {
    db = await createDb()
    s = await seedMarketplace(db)
  })
  afterAll(async () => {
    await db?.close()
  })

  // request_booking / create_campaign suspension is DB-M's (0031/0032).

  it('assert_active_user distinguishes anon and suspended callers', async () => {
    const u = await createUser(db, { status: 'suspended' })
    await expect(
      asUser(db, u.id, (tx) => rpc(tx, 'assert_active_user')),
    ).rejects.toMatchObject({ code: '42501', message: 'Account suspended' })
    const active = await createUser(db)
    await asUser(db, active.id, (tx) => rpc(tx, 'assert_active_user'))
    const res = await asUser(db, u.id, (tx) =>
      tx.query<{ ok: boolean }>(`select public.is_active_user() as ok`),
    )
    expect(res.rows[0].ok).toBe(false)
  })

  it('suspended renter cannot cancel, chat or review', async () => {
    const renter = await createUser(db)
    const booking = await createBooking(db, renter.id, s.billboard.id)
    const done = await createBooking(db, renter.id, s.billboard.id, {
      startDate: daysFromNow(60),
      endDate: daysFromNow(61),
    })
    await setBookingStatus(db, done.id, 'completed')
    const [thread] = await asUser(db, renter.id, (tx) =>
      rpc<{ id: string }>(tx, 'get_or_create_chat_thread', {
        p_billboard_id: s.billboard.id,
      }),
    )
    await suspend(db, renter.id)

    for (const [fn, args] of [
      ['cancel_booking', { p_booking_id: booking.id }],
      ['get_or_create_chat_thread', { p_billboard_id: s.billboard.id }],
      ['submit_review', { p_booking_id: done.id, p_rating: 5 }],
    ] as const) {
      await expect(
        asUser(db, renter.id, (tx) => rpc(tx, fn, args)),
        fn,
      ).rejects.toThrow('Account suspended')
    }
    await expect(
      asUser(db, renter.id, (tx) =>
        tx.query(
          `insert into public.chat_messages (thread_id, sender_id, body) values ($1, $2, 'hi')`,
          [thread.id, renter.id],
        ),
      ),
    ).rejects.toMatchObject({ code: '42501' })
    expect(await bookingStatus(db, booking.id)).toBe('pending_owner_review')
  })

  it('suspended owner cannot respond or edit billboards', async () => {
    const owner = await createUser(db, { role: 'rentor' })
    const bb = await createBillboard(db, owner.id)
    const booking = await createBooking(db, s.renter.id, bb.id)
    await suspend(db, owner.id)
    await expect(
      respondToBooking(db, owner.id, booking.id, true),
    ).rejects.toThrow('Account suspended')
    const res = await asUser(db, owner.id, (tx) =>
      tx.query(`update public.billboards set title = 'x' where id = $1`, [
        bb.id,
      ]),
    )
    expect(res.affectedRows).toBe(0)
  })
})

describe('billboard protection (0029, contract 2)', () => {
  let db: Db
  let s: Market

  const ownerUpdate = (id: string, set: string, params: unknown[] = []) =>
    asUser(db, s.owner.id, (tx) =>
      tx.query<{ status: string }>(
        `update public.billboards set ${set} where id = $1 returning status`,
        [id, ...params],
      ),
    )

  beforeAll(async () => {
    db = await createDb()
    s = await seedMarketplace(db)
  })
  afterAll(async () => {
    await db?.close()
  })

  it('owner cannot un-flag their own billboard', async () => {
    const bb = await createBillboard(db, s.owner.id, { status: 'flagged' })
    for (const status of ['active', 'inactive', 'archived']) {
      await expect(
        ownerUpdate(bb.id, 'status = $2', [status]),
      ).rejects.toMatchObject({ code: '42501' })
    }
    await expect(
      ownerUpdate(s.billboard.id, `status = 'flagged'`),
    ).rejects.toThrow('Only an admin can flag a billboard')
  })

  it('owner cannot set override, ratings or owner_id', async () => {
    const other = await createUser(db, { role: 'rentor' })
    for (const [set, params] of [
      ['admin_price_override_per_day = 1', []],
      ['rating_avg = 5', []],
      ['rating_count = 99', []],
      ['owner_id = $2', [other.id]],
    ] as const) {
      await expect(
        ownerUpdate(s.billboard.id, set, [...params]),
        set,
      ).rejects.toMatchObject({ code: '42501' })
    }
  })

  it('owner can edit normal fields and archive / unarchive', async () => {
    const bb = await createBillboard(db, s.owner.id)
    expect((await ownerUpdate(bb.id, `title = 'New title'`)).rows).toHaveLength(
      1,
    )
    expect((await ownerUpdate(bb.id, `status = 'archived'`)).rows).toEqual([
      { status: 'archived' },
    ])
    const seen = await asAnon(db, (tx) =>
      tx.query(`select 1 from public.billboards where id = $1`, [bb.id]),
    )
    expect(seen.rows).toHaveLength(0)
    expect((await ownerUpdate(bb.id, `status = 'inactive'`)).rows).toEqual([
      { status: 'inactive' },
    ])
    expect((await ownerUpdate(bb.id, `status = 'active'`)).rows).toEqual([
      { status: 'active' },
    ])
  })

  it('owner inserts work, but not with admin-only fields', async () => {
    const insert = (extra: string, value: string) =>
      asUser(db, s.owner.id, (tx) =>
        tx.query(
          `insert into public.billboards (owner_id, title, lat, lng, price_per_day${extra})
           values ($1, 'Mine', 6.9, 79.86, 100${value}) returning id`,
          [s.owner.id],
        ),
      )
    expect((await insert('', '')).rows).toHaveLength(1)
    await expect(
      insert(', admin_price_override_per_day', ', 1'),
    ).rejects.toMatchObject({ code: '42501' })
    await expect(insert(', rating_count', ', 10')).rejects.toMatchObject({
      code: '42501',
    })
    await expect(insert(', status', `, 'flagged'`)).rejects.toMatchObject({
      code: '42501',
    })
    // renters can't list billboards at all
    await expect(
      asUser(db, s.renter.id, (tx) =>
        tx.query(
          `insert into public.billboards (owner_id, title, lat, lng, price_per_day)
           values ($1, 'x', 6.9, 79.86, 100)`,
          [s.renter.id],
        ),
      ),
    ).rejects.toMatchObject({ code: '42501' })
  })

  it('admin can set the price override directly', async () => {
    const res = await asUser(db, s.admin.id, (tx) =>
      tx.query<{ admin_price_override_per_day: string }>(
        `update public.billboards set admin_price_override_per_day = 750 where id = $1
         returning admin_price_override_per_day`,
        [s.billboard.id],
      ),
    )
    expect(Number(res.rows[0].admin_price_override_per_day)).toBe(750)
  })

  it('admin_set_billboard_status moderates and notifies the owner', async () => {
    const bb = await createBillboard(db, s.owner.id, { title: 'Moderate me' })
    const [row] = await asUser(db, s.admin.id, (tx) =>
      rpc<{ status: string }>(tx, 'admin_set_billboard_status', {
        p_billboard_id: bb.id,
        p_status: 'flagged',
        p_reason: 'Misleading photos',
      }),
    )
    expect(row.status).toBe('flagged')
    const { rows } = await db.query<{ message: string }>(
      `select message from public.notifications
        where user_id = $1 and type = 'billboard_moderated' and ref_id = $2`,
      [s.owner.id, bb.id],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].message).toContain('flagged')
    expect(rows[0].message).toContain('Misleading photos')

    await asUser(db, s.admin.id, (tx) =>
      rpc(tx, 'admin_set_billboard_status', {
        p_billboard_id: bb.id,
        p_status: 'active',
      }),
    )
    expect(
      (
        await db.query<{ status: string }>(
          `select status from public.billboards where id = $1`,
          [bb.id],
        )
      ).rows[0].status,
    ).toBe('active')

    await expect(
      asUser(db, s.owner.id, (tx) =>
        rpc(tx, 'admin_set_billboard_status', {
          p_billboard_id: bb.id,
          p_status: 'active',
        }),
      ),
    ).rejects.toMatchObject({ code: '42501' })
    await expect(
      asUser(db, s.admin.id, (tx) =>
        rpc(tx, 'admin_set_billboard_status', {
          p_billboard_id: bb.id,
          p_status: 'deleted',
        }),
      ),
    ).rejects.toThrow('Invalid billboard status')
  })

  it('rating trigger still updates ratings after a review', async () => {
    const bb = await createBillboard(db, s.owner.id)
    const booking = await createBooking(db, s.renter.id, bb.id)
    await setBookingStatus(db, booking.id, 'completed')
    await asUser(db, s.renter.id, (tx) =>
      rpc(tx, 'submit_review', { p_booking_id: booking.id, p_rating: 4 }),
    )
    const { rows } = await db.query<{
      rating_avg: string
      rating_count: number
    }>(`select rating_avg, rating_count from public.billboards where id = $1`, [
      bb.id,
    ])
    expect(Number(rows[0].rating_avg)).toBe(4)
    expect(rows[0].rating_count).toBe(1)

    // one review per booking, even bypassing the RPC
    await expect(
      db.query(
        `insert into public.reviews (booking_id, billboard_id, renter_id, rating)
         values ($1, $2, $3, 1)`,
        [booking.id, bb.id, s.renter.id],
      ),
    ).rejects.toMatchObject({ code: '23505' })
  })
})

describe('delete safety (0029)', () => {
  let db: Db
  let s: Market

  beforeAll(async () => {
    db = await createDb()
    s = await seedMarketplace(db)
  })
  afterAll(async () => {
    await db?.close()
  })

  it('deleting a billboard with bookings fails with 23503; without bookings it works', async () => {
    await createBooking(db, s.renter.id, s.billboard.id)
    await expect(
      asUser(db, s.owner.id, (tx) =>
        tx.query(`delete from public.billboards where id = $1`, [
          s.billboard.id,
        ]),
      ),
    ).rejects.toMatchObject({ code: '23503' })

    const empty = await createBillboard(db, s.owner.id)
    const res = await asUser(db, s.owner.id, (tx) =>
      tx.query(`delete from public.billboards where id = $1`, [empty.id]),
    )
    expect(res.affectedRows).toBe(1)
  })

  it('bookings with payments / events cannot be deleted (no cascading audit rows)', async () => {
    const bb = await createBillboard(db, s.owner.id)
    const booking = await createBooking(db, s.renter.id, bb.id)
    await db.query(
      `insert into public.payments (booking_id, renter_id, owner_id, amount) values ($1, $2, $3, 1)`,
      [booking.id, s.renter.id, s.owner.id],
    )
    await expect(
      db.query(`delete from public.bookings where id = $1`, [booking.id]),
    ).rejects.toMatchObject({ code: '23503' })
  })

  it('keeps the original FK names (client embeds use them) with ON DELETE NO ACTION', async () => {
    const { rows } = await db.query<{ conname: string; confdeltype: string }>(
      `select conname, confdeltype from pg_constraint
        where conname = any($1) order by conname`,
      [
        [
          'booking_documents_booking_id_fkey',
          'booking_events_booking_id_fkey',
          'bookings_billboard_id_fkey',
          'payments_booking_id_fkey',
          'reviews_billboard_id_fkey',
          'reviews_booking_id_fkey',
        ],
      ],
    )
    expect(rows).toHaveLength(6)
    expect(rows.every((r) => r.confdeltype === 'a')).toBe(true)
  })
})

describe('chat threads (0029)', () => {
  let db: Db
  let s: Market

  beforeAll(async () => {
    db = await createDb()
    s = await seedMarketplace(db)
  })
  afterAll(async () => {
    await db?.close()
  })

  it('cannot open a thread on your own billboard', async () => {
    await expect(
      asUser(db, s.owner.id, (tx) =>
        rpc(tx, 'get_or_create_chat_thread', {
          p_billboard_id: s.billboard.id,
        }),
      ),
    ).rejects.toThrow('cannot start an inquiry thread on their own billboard')
  })

  it('new threads only on active billboards; existing threads stay reachable', async () => {
    const inactive = await createBillboard(db, s.owner.id, {
      status: 'inactive',
    })
    await expect(
      asUser(db, s.renter.id, (tx) =>
        rpc(tx, 'get_or_create_chat_thread', { p_billboard_id: inactive.id }),
      ),
    ).rejects.toThrow('not available for inquiries')

    const [thread] = await asUser(db, s.renter.id, (tx) =>
      rpc<{ id: string }>(tx, 'get_or_create_chat_thread', {
        p_billboard_id: s.billboard.id,
      }),
    )
    await db.query(
      `update public.billboards set status = 'inactive' where id = $1`,
      [s.billboard.id],
    )
    const [again] = await asUser(db, s.renter.id, (tx) =>
      rpc<{ id: string }>(tx, 'get_or_create_chat_thread', {
        p_billboard_id: s.billboard.id,
      }),
    )
    expect(again.id).toBe(thread.id)

    // sending still fires the (now service-only) notify trigger
    await asUser(db, s.renter.id, (tx) =>
      tx.query(
        `insert into public.chat_messages (thread_id, sender_id, body) values ($1, $2, 'hello')`,
        [thread.id, s.renter.id],
      ),
    )
    const { rows } = await db.query(
      `select 1 from public.notifications where user_id = $1 and type = 'new_message'`,
      [s.owner.id],
    )
    expect(rows).toHaveLength(1)
  })
})

describe('storage (0029)', () => {
  let db: Db
  let s: Market

  const putObject = (userId: string, bucket: string, name: string) =>
    asUser(db, userId, (tx) =>
      tx.query(
        `insert into storage.objects (bucket_id, name, owner) values ($1, $2, $3)`,
        [bucket, name, userId],
      ),
    )
  const deleteObject = (userId: string, bucket: string, name: string) =>
    asUser(db, userId, (tx) =>
      tx.query(
        `delete from storage.objects where bucket_id = $1 and name = $2`,
        [bucket, name],
      ),
    )

  beforeAll(async () => {
    db = await createDb()
    s = await seedMarketplace(db)
  })
  afterAll(async () => {
    await db?.close()
  })

  it('buckets carry size and MIME limits', async () => {
    const { rows } = await db.query<{
      id: string
      file_size_limit: string
      allowed_mime_types: string[]
    }>(
      `select id, file_size_limit, allowed_mime_types from storage.buckets order by id`,
    )
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]))
    expect(Number(byId['billboard-images'].file_size_limit)).toBe(
      5 * 1024 * 1024,
    )
    expect(byId['billboard-images'].allowed_mime_types).toEqual(['image/*'])
    for (const id of ['booking-creatives', 'chat-attachments']) {
      expect(Number(byId[id].file_size_limit)).toBe(10 * 1024 * 1024)
      expect(byId[id].allowed_mime_types).toEqual([
        'image/*',
        'video/*',
        'application/pdf',
      ])
    }
  })

  it('only rentors/admins write billboard-images', async () => {
    await expect(
      putObject(s.renter.id, 'billboard-images', `${s.renter.id}/x.png`),
    ).rejects.toMatchObject({ code: '42501' })
    await putObject(s.owner.id, 'billboard-images', `${s.owner.id}/x.png`)
    await expect(
      putObject(s.owner.id, 'billboard-images', `${s.renter.id}/y.png`),
    ).rejects.toMatchObject({ code: '42501' })
  })

  it('renters cannot delete creatives once the booking is confirmed', async () => {
    const booking = await createBooking(db, s.renter.id, s.billboard.id)
    const a = `${booking.id}/a.pdf`
    const b = `${booking.id}/b.pdf`
    await putObject(s.renter.id, 'booking-creatives', a)
    await putObject(s.renter.id, 'booking-creatives', b)
    expect(
      (await deleteObject(s.renter.id, 'booking-creatives', a)).affectedRows,
    ).toBe(1)
    await setBookingStatus(db, booking.id, 'confirmed')
    expect(
      (await deleteObject(s.renter.id, 'booking-creatives', b)).affectedRows,
    ).toBe(0)
  })
})

describe('integrity and indexes (0029)', () => {
  let db: Db

  beforeAll(async () => {
    db = await createDb()
  })
  afterAll(async () => {
    await db?.close()
  })

  it('has the new indexes', async () => {
    const { rows } = await db.query<{ indexname: string }>(
      `select indexname from pg_indexes where schemaname = 'public'`,
    )
    const names = rows.map((r) => r.indexname)
    for (const i of [
      'reviews_booking_id_key',
      'notifications_user_created_idx',
      'notifications_ref_type_idx',
      'chat_threads_owner_idx',
      'payments_renter_idx',
      'payments_booking_idx',
      'reviews_billboard_idx',
    ]) {
      expect(names).toContain(i)
    }
  })

  it('billboard status accepts archived', async () => {
    const owner = await createUser(db, { role: 'rentor' })
    const bb = await createBillboard(db, owner.id, { status: 'archived' })
    expect(bb.status).toBe('archived')
  })
})
