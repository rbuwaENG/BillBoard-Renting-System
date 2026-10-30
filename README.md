# Billboard Renting System

A GIS-based billboard rental marketplace with a **React + Supabase** stack —
Renter (advertiser), Rentor (billboard owner), and Admin roles. See
[`PLAN.md`](./PLAN.md) for the full architecture and delivery-phase plan.

The core marketplace flows run against a real Supabase backend: auth +
roles, billboard browse, Rentor billboard CRUD, booking request + owner
approve/reject, the Admin panel (users/taxonomy/moderation/analytics/
payments/payouts), reviews, in-app notifications, real chat, campaigns, and
booking lifecycle automation, proof of posting and an admin audit log.
Payments are a manual workflow with no live gateway: the renter marks a
booking as paid (optionally with a bank-transfer reference), an admin confirms
the amount in Admin → Payments, and only admin-confirmed payments become
payable to owners. See PLAN.md section 8 for what's still open.

## Prerequisites

- Node.js 20+
- npm 10+
- A Supabase project (project settings -> API, for the URL + anon key)

## Setup

```bash
npm install
cp .env.example .env.local   # fill in Supabase URL + anon key
npm run dev
```

The app runs at `http://localhost:5173`.

## Scripts

| Command           | Description                                                                       |
| ----------------- | --------------------------------------------------------------------------------- |
| `npm run dev`     | Start the Vite dev server                                                         |
| `npm run build`   | Type-check and build for production                                               |
| `npm run lint`    | Run ESLint                                                                        |
| `npm run test`    | Run the Vitest unit/component suite (offline, no env needed)                      |
| `npm run test:db` | Apply all migrations to an in-process Postgres (PGlite) and run the RLS/RPC tests |
| `npm run format`  | Format the codebase with Prettier                                                 |

## Project layout

See `PLAN.md` section 6 for the intended frontend structure. In short:
`src/app` (router, layout, route guards), `src/features/*` (one folder per
role/domain area), `src/components` (shared UI), `src/hooks`, `src/lib`
(Supabase client, query client, utils), `src/types` (schema types matching
the Postgres tables), and `supabase/migrations/` (SQL schema + RLS history).

## Supabase

The Postgres schema, RLS policies, and RPC functions (`request_booking`,
`respond_to_booking`, `billboards_near`) are defined in
`supabase/migrations/`. Storage buckets `billboard-images` (public read,
owner-write) and `booking-creatives` (participant-scoped) hold uploads.

**Applying migrations:** apply new files in `supabase/migrations/` to the
project (`supabase db push`, or paste them in order into the SQL editor)
**before** deploying a frontend that depends on them — e.g. 0031 replaces the
old `renter_pay_booking` RPC with `renter_submit_payment`. `npm run test:db`
checks that the whole migration chain applies cleanly; see
`src/test/db/README.md` for the harness and its fidelity limits.

Admin accounts are not self-service — promote a `profiles.role` to `'admin'`
via SQL after that user has signed up normally as a renter/rentor.
