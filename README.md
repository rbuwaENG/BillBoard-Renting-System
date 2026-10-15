# Billboard Renting System

A GIS-based billboard rental marketplace with a **React + Supabase** stack —
Renter (advertiser), Rentor (billboard owner), and Admin roles. See
[`PLAN.md`](./PLAN.md) for the full architecture and delivery-phase plan.

The core marketplace flows run against a real Supabase backend: auth +
roles, billboard browse, Rentor billboard CRUD, booking request + owner
approve/reject, the Admin panel (users/taxonomy/moderation/analytics/
payments/payouts), reviews, in-app notifications, real chat, campaigns, and
booking lifecycle automation. Payments and payouts are an admin-operated
manual workflow (no live payment gateway) — see PLAN.md section 8 for what's
still open.

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

| Command           | Description                              |
| ------------------ | ----------------------------------------- |
| `npm run dev`      | Start the Vite dev server                 |
| `npm run build`    | Type-check and build for production        |
| `npm run lint`     | Run ESLint                                 |
| `npm run test`     | Run the Vitest test suite                  |
| `npm run format`   | Format the codebase with Prettier          |

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

Admin accounts are not self-service — promote a `profiles.role` to `'admin'`
via SQL after that user has signed up normally as a renter/rentor.
