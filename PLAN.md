# Billboard Renting System — Project Plan

Reference inspiration: [sapta28/QGIS_Backend_Project](https://github.com/sapta28/QGIS_Backend_Project) (Laravel + React + GIS billboard rental app). This project reimplements the same domain — GIS-based billboard rental marketplace — on a **React + Supabase** stack instead of Laravel, and introduces a dedicated **Rentor** (billboard owner) role alongside Renter and Admin.

---

## 1. Roles & Marketplace Model

Three roles, stored as a `role` column on the `profiles` table (Postgres), checked in Row Level Security policies and RPC functions via a `current_role()` helper (no separate auth claim — the table is the single source of truth):

| Role       | Who                                 | Core capabilities                                                                                                                                                                              |
| ---------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Renter** | Advertiser looking to rent ad space | Browse/search billboards on map & list, view details, submit booking requests, upload creative/design, pay, track booking status, rate a completed booking                                     |
| **Rentor** | Billboard owner                     | Add/edit/deactivate their own billboards (location, size, price, images, availability), review & approve/reject booking requests made against _their_ billboards, view earnings/payout history |
| **Admin**  | Platform operator                   | Manage categories/sizes/pricing tiers, manage users (suspend/ban), moderate flagged billboards, view platform-wide analytics & revenue, resolve disputes                                       |

**Approval model (per clarified requirements):**

- Billboard listing CRUD by a Rentor is **instant-publish** — no admin approval queue for creating/editing a billboard.
- **Booking requests are the thing that queues**: when a Renter requests a booking, it lands in a `pending` queue scoped to that billboard's **owning Rentor**, who approves or rejects it (not a global Admin queue). This mirrors "each owner approves their own" from the requirements.
- Admin has override/moderation powers (can unpublish/flag a billboard, or step into a dispute) but is not in the critical path of every listing or booking.

---

## 2. Tech Stack

### Frontend

- **React 19** + **Vite** + **TypeScript**
- **React Router v6** — routing, with role-gated route guards
- **TanStack Query** — server-state caching over Firestore/Functions calls
- **Zustand** (or React Context) — light client state (auth session, UI state)
- **Tailwind CSS v4** — styling, matching the reference project's design system (primary blue `#2563EB`, success green, error red)
- **React Leaflet + OpenStreetMap** tiles — interactive map browsing & a lat/lng map-picker for Rentors (no API key/cost, swappable for Google Maps later)
- **React Hook Form + Zod** — form state & validation
- **shadcn/ui or Radix primitives** — accessible component base

### Backend (Supabase)

- **Supabase Auth** — email/password (+ Google sign-in later); role lives in the `profiles` table, set on signup via a `handle_new_user` trigger
- **Postgres (Supabase)** — primary database, with **PostGIS** for native geo queries (radius search via `ST_DWithin`, no geohash workaround needed)
- **Supabase Storage** — billboard images, booking creative/design uploads
- **Postgres RPC functions (`security definer`)** — privileged writes/state transitions: `request_booking`, `respond_to_booking`
- **Row Level Security (RLS)** — per-table policies enforce the security model directly in Postgres
- **Supabase Edge Functions** _(future, payments phase)_ — Stripe Checkout session creation + webhook handling
- **Stripe** (via Edge Functions + Webhooks) — payment processing
- **Supabase Realtime** _(optional, notifications/chat phase)_ — push updates on booking status change / messages

### Tooling

- **Vitest + React Testing Library** — unit/component tests
- **Supabase CLI / local dev stack** _(optional)_ — local Postgres/Auth/Storage for offline development
- **ESLint + Prettier** — lint/format
- **GitHub Actions** — CI (lint, test, build) + CD (deploy static build to hosting of choice on merge to `main`)

---

## 3. Data Model (Postgres, Supabase project `BBMS`)

```
profiles (id = auth.users.id)
  display_name, email, phone, photo_url
  role: 'renter' | 'rentor' | 'admin'
  status: 'active' | 'suspended'
  created_at

billboards
  owner_id -> profiles.id (Rentor)
  title, description
  category_id -> categories.id
  size_id -> sizes.id              // e.g. 4x8, 10x20
  lat, lng, geom (geography(Point,4326), generated from lat/lng), address, city
  price_per_day: numeric
  images: text[]                    // Storage paths
  status: 'active' | 'inactive' | 'flagged'   // Rentor/Admin controlled, no approval gate
  rating_avg, rating_count
  created_at, updated_at

bookings
  billboard_id, owner_id (denormalized), renter_id
  start_date, end_date
  creative_url: text                 // uploaded design/artwork
  price_quoted: numeric
  status: 'pending_owner_review' | 'approved' | 'rejected'
          | 'payment_pending' | 'confirmed' | 'active'
          | 'completed' | 'cancelled'
  payment_id -> payments.id
  rejection_reason
  created_at, updated_at, decision_at

payments
  booking_id, renter_id, owner_id
  stripe_payment_intent_id
  amount, currency, status: 'pending' | 'succeeded' | 'failed' | 'refunded'
  created_at

categories        // Admin-managed
  name, description

sizes             // Admin-managed
  label, width, height

reviews
  booking_id, billboard_id, renter_id, rating, comment, created_at

notifications
  user_id, type, message, read, ref_id, created_at
```

**Indexes**: GIST index on `billboards.geom`; btree on `billboards(status, category_id)`, `bookings(owner_id, status)`, `bookings(renter_id, status)`.

**Geo queries**: `billboards.geom` is a generated `geography(Point,4326)` column; radius search uses the `billboards_near(lat, lng, radius_km)` RPC (`ST_DWithin`) — native PostGIS, no geohash workaround needed.

---

## 4. Security Model

- **Row Level Security (RLS)**, enabled per table, e.g.:
  - `billboards`: insert/update/delete only if `current_role() = 'rentor' and owner_id = auth.uid()`; public `select` for `status = 'active'` (owner/admin can also select their own regardless of status).
  - `bookings`: `select` restricted to participants (`renter_id`/`owner_id`) or admin; **no direct insert/update policies** — approve/reject/create transitions happen via **`security definer` RPC functions** (not direct client writes) so business rules (ownership check, valid state transition) are enforced server-side.
  - `profiles`: a user can read/update only their own row (admin can read all); `role`/`status` columns are **not** client-writable (reverted by a `before update` trigger unless the caller is admin).
- **Role storage**: `role` lives only in `profiles.role` — no separate auth claim. RLS/RPCs check it via a `security definer` helper function `current_role()` to avoid self-referential RLS recursion. Role is set once at signup (via `handle_new_user` trigger reading `raw_user_meta_data`, limited to `renter`/`rentor`) and only changed afterward by direct admin SQL (no self-service admin signup).
- **Storage policies**: billboard images writable only by the owning Rentor (path-prefixed by `owner_id`); booking creatives writable only by the requesting Renter; both readable per the same participant rules as above.
- **RPC functions** are the single source of truth for state transitions:
  - `request_booking` — validates the billboard is active and dates don't overlap an existing non-terminal booking, creates booking as `pending_owner_review`.
  - `respond_to_booking` (Rentor-only, ownership-checked) — approve → `payment_pending`, or reject → `rejected` with `rejection_reason`.
  - `create_checkout_session` _(future, payments phase)_ — Renter pays after approval; creates Stripe session via an Edge Function.
  - `stripe-webhook` _(future, Edge Function)_ — on `payment_intent.succeeded`, marks booking `confirmed` and payment `succeeded`.
  - `on_booking_status_change` _(future, trigger)_ — writes a notification row for the affected user(s).

---

## 5. Booking State Machine

```
pending_owner_review --(rentor rejects)--> rejected
pending_owner_review --(rentor approves, before start date)--> payment_pending
pending_owner_review --(no response within 72h)--> expired
payment_pending --(renter submits "I've paid" -> payment 'pending')--> payment_pending
payment_pending --(admin confirms payment, amount = price_quoted)--> confirmed
payment_pending --(admin rejects payment)--> payment_pending   [renter resubmits]
payment_pending --(no payment within 72h of approval/rejection)--> expired
confirmed --(startDate reached, platform timezone)--> active      [pg_cron + on-demand RPC]
active --(owner uploads proof of posting)--> "Posted" timeline step
active --(endDate passed)--> completed --> (renter can leave review)
pending/payment_pending without a submitted payment --(renter cancels)--> cancelled
```

Overlapping bookings for the same billboard are rejected by an exclusion
constraint over `pending_owner_review`/`payment_pending`/`confirmed`/`active`
(0032). Only bookings with an **admin-confirmed** succeeded payment are payable
to owners.

---

## 6. Frontend Structure

```
src/
├── app/                     # router, providers, role-gated route guards
├── components/              # shared UI (Button, MapView, ImageUploader, ...)
├── features/
│   ├── auth/                 # login, signup, role-aware redirect
│   ├── billboards/           # public browse (map + filters), billboard detail
│   ├── rentor/                # Rentor dashboard: my billboards CRUD, booking inbox, earnings
│   ├── renter/                # Renter dashboard: my bookings, booking wizard, reviews
│   ├── admin/                 # categories/sizes management, user management, moderation, analytics
│   ├── bookings/              # shared booking components (status badge, timeline)
│   └── payments/              # Stripe checkout redirect/embed, payment status
├── hooks/                     # useAuth, useBillboards, useBookings (TanStack Query hooks)
├── lib/                       # supabase.ts, queryClient.ts, geohash.ts
├── types/                     # shared TS types/interfaces mirroring the Postgres schema
└── main.tsx

supabase/
└── migrations/                # schema, RLS policies, RPC functions (request_booking, respond_to_booking, billboards_near)
```

---

## 7. Delivery Phases

1. **Project scaffold** — Vite React-TS app, Supabase project, schema/RLS/Storage init, CI skeleton. ✅ done (migrated from an earlier Firebase scaffold).
2. **Auth & roles** — signup/login, role selection at signup (Renter/Rentor), admin role set via direct SQL, route guards per role. ✅ done.
3. **Rentor: billboard CRUD** — add/edit/deactivate billboard with map-picker for lat/lng, image upload, pricing/size/category selection.
4. **Public browse & map** — map + list view with filters (category, size, price, location radius via `billboards_near`), billboard detail page. ✅ done.
5. **Booking flow (Renter)** — request-booking dialog (dates, optional creative URL), `request_booking` RPC, status tracking in "My bookings". ✅ done.
6. **Rentor booking inbox** — pending requests list, `respond_to_booking` RPC (approve/reject) with reason. ✅ done.
7. **Payments** — admin-operated manual confirmation (no Stripe account; admin marks a `payment_pending` booking as paid via `admin_confirm_payment`, Admin → Payments tab). ✅ done.
8. **Notifications** — in-app notification bell, written by Postgres triggers on booking/review events and payout RPCs, live via Supabase Realtime. ✅ done.
9. **Admin panel** — categories/sizes management, user management (suspend), billboard moderation (flag/unpublish), platform analytics dashboard, payments confirmation, payouts. ✅ done.
10. **Reviews & polish** — post-completion review/rating (`submit_review` RPC, renter "Leave a review" dialog, billboard rating auto-recalculated by trigger). ✅ done.
11. **Testing & hardening** — Vitest coverage on the new hooks/components (reviews, payments, payouts, chat, campaigns, creative upload, booking inbox) via a reusable Supabase client mock. _(RLS/pgTAP-level DB tests still not attempted — see Open Items)_
12. **CI/CD & deploy** — GitHub Actions pipeline (lint/test/build), deployed to Vercel.

13. **Hardening round 1** — security/integrity migrations 0029–0035 (function privileges, null-safe auth checks, billboard field protection, profile PII column grants, renter-submits/admin-confirms payments, exclusion constraint + expiry, proof of posting, admin audit log, review fixes), an in-process Postgres test harness (`npm run test:db`, PGlite) with RLS/RPC tests, route code-splitting + error boundaries, offline unit tests, and renter/owner/admin UX fixes (gallery, availability calendar, password reset, shareable billboard pages). ✅ done.

Additionally, beyond the original 12 phases: **booking lifecycle automation** (`confirmed`→`active`→`completed` via a `pg_cron` job + on-demand RPC fallback) and a **payout mechanism** (admin approves + schedules a release date per rentor; `payouts`/`payout_items` tables; auto-release on the scheduled date via the same cron job, or a manual "Release now") are both done — see `supabase/migrations/0015_lifecycle_automation.sql` and `0016_payouts.sql`.

---

## 8. Open Items to Revisit Later

- Real payment gateway (Stripe or similar) to replace the renter-submits / admin-confirms manual flow, if/when actual card processing is needed — the `payments` table already has the legacy `stripe_payment_intent_id` column reserved for this. The gateway secret currently lives in `payment_gateway_settings` (admin-only) and should move to Vault / Edge Function secrets before a gateway goes live.
- Stripe Connect (or similar) as an alternative to the current manual admin-scheduled payout model, if automated bank transfers become necessary.
- Availability: bookings are protected by an exclusion constraint and renters see booked days in a calendar; the browse "Available between" filter checks only the first 50 results client-side — a bulk `billboards_available_between(from, to)` RPC would remove that cap.
- Server-side aggregation/paging RPCs for admin analytics and large tables (lists page with `.range()`, but analytics still reads whole tables).
- Generated Supabase types (`supabase gen types typescript`) to replace the hand-written row types — needs the Supabase CLI against the project.
- Chat unread tracking (needs per-participant `last_read_at` columns), invoices/receipts, disputes/refunds (`refunded` status exists but has no flow), and cleanup of orphaned storage objects when images are removed from a listing.
- The PGlite harness is close to, but not exactly, Supabase (no PostgREST/GoTrue/Storage API, single connection, migrations run as superuser) — verify key flows on a Supabase dev project after applying migrations.
