# Billboard Renting System — Project Plan

Reference inspiration: [sapta28/QGIS_Backend_Project](https://github.com/sapta28/QGIS_Backend_Project) (Laravel + React + GIS billboard rental app). This project reimplements the same domain — GIS-based billboard rental marketplace — on a **React + Firebase** stack instead of Laravel, and introduces a dedicated **Rentor** (billboard owner) role alongside Renter and Admin.

---

## 1. Roles & Marketplace Model

Three roles, stored as a `role` field on the user profile + mirrored into a Firebase Auth **custom claim** (for security rules and callable-function checks):

| Role | Who | Core capabilities |
|---|---|---|
| **Renter** | Advertiser looking to rent ad space | Browse/search billboards on map & list, view details, submit booking requests, upload creative/design, pay, track booking status, rate a completed booking |
| **Rentor** | Billboard owner | Add/edit/deactivate their own billboards (location, size, price, images, availability), review & approve/reject booking requests made against *their* billboards, view earnings/payout history |
| **Admin** | Platform operator | Manage categories/sizes/pricing tiers, manage users (suspend/ban), moderate flagged billboards, view platform-wide analytics & revenue, resolve disputes |

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

### Backend (Firebase)
- **Firebase Auth** — email/password + Google sign-in; custom claims for `role`
- **Cloud Firestore** — primary database
- **Cloud Storage for Firebase** — billboard images, booking creative/design uploads
- **Cloud Functions (2nd gen, TypeScript)** — privileged writes, Stripe integration, notifications, triggers
- **Firebase Hosting** — SPA hosting + CDN
- **Firebase App Check** — abuse protection on Functions/Firestore
- **Stripe** (via Cloud Functions + Webhooks) — payment processing (Firebase has no native payments)
- **Firebase Cloud Messaging (FCM)** *(optional, phase 8)* — push notifications for booking status changes

### Tooling
- **Vitest + React Testing Library** — unit/component tests
- **Firebase Emulator Suite** — local Firestore/Auth/Functions/Storage + rules testing
- **ESLint + Prettier** — lint/format
- **GitHub Actions** — CI (lint, test, build, rules test) + CD (deploy to Firebase Hosting/Functions on merge to `main`)

---

## 3. Data Model (Firestore)

```
users/{uid}
  displayName, email, phone, photoURL
  role: 'renter' | 'rentor' | 'admin'
  status: 'active' | 'suspended'
  createdAt

billboards/{billboardId}
  ownerId: uid (Rentor)
  title, description
  category: ref -> categories/{id}
  size: ref -> sizes/{id}          // e.g. 4x8, 10x20
  location: { lat, lng, address, city }
  pricePerDay: number
  images: string[]                  // Storage paths
  status: 'active' | 'inactive' | 'flagged'   // Rentor/Admin controlled, no approval gate
  availability: subcollection availability/{dateRangeId} OR calendar map
  rating: { avg, count }
  createdAt, updatedAt

  bookings (subcollection or top-level, see below)

bookings/{bookingId}
  billboardId, ownerId (denormalized), renterId
  startDate, endDate
  creativeUrl: string                // uploaded design/artwork
  priceQuoted: number
  status: 'pending_owner_review' | 'approved' | 'rejected'
          | 'payment_pending' | 'confirmed' | 'active'
          | 'completed' | 'cancelled'
  paymentId: ref -> payments/{id}
  createdAt, updatedAt, decisionAt

payments/{paymentId}
  bookingId, renterId, ownerId
  stripePaymentIntentId
  amount, currency, status: 'pending' | 'succeeded' | 'failed' | 'refunded'
  createdAt

categories/{id}        // Admin-managed
  name, description

sizes/{id}             // Admin-managed
  label, width, height

reviews/{reviewId}
  bookingId, billboardId, renterId, rating, comment, createdAt

notifications/{uid}/items/{id}
  type, message, read, refId, createdAt
```

**Indexes**: composite indexes on `billboards(status, category, location geohash)`, `bookings(ownerId, status)`, `bookings(renterId, status)`.

**Geo queries**: store a geohash field on `billboards` (e.g. via `geofire-common`) for radius/bounding-box map queries — Firestore has no native geo-query.

---

## 4. Security Model

- **Firestore Security Rules**: role-based, e.g.
  - `billboards`: create/update/delete only if `request.auth.token.role == 'rentor' && resource.data.ownerId == request.auth.uid`; public `read` for `status == 'active'`.
  - `bookings`: create by any authenticated Renter; `update` (status transitions) restricted — actual approve/reject/payment transitions happen via **Cloud Functions callable** (not direct client writes) so business rules (ownership check, valid state transition, payment verification) are enforced server-side.
  - `users`: a user can read/update only their own profile; role field is **not** client-writable (only settable via an Admin-invoked Cloud Function or Firebase Console/Admin SDK).
- **Custom claims** set via Cloud Function on role assignment (e.g. `setUserRole` callable, Admin-only), synced to Firestore `users/{uid}.role` for querying.
- **Storage Rules**: billboard images writable only by the owning Rentor; booking creatives writable only by the requesting Renter; both public-readable if the parent doc is public.
- **Cloud Functions** are the single source of truth for state transitions:
  - `requestBooking` (callable) — validates dates/availability, creates booking as `pending_owner_review`.
  - `respondToBooking` (callable, Rentor-only, ownership-checked) — approve → `approved`/`payment_pending`, or reject → `rejected`.
  - `createCheckoutSession` (callable) — Renter pays after approval; creates Stripe session.
  - `stripeWebhook` (HTTPS) — on `payment_intent.succeeded`, marks booking `confirmed` and payment `succeeded`.
  - `onBookingStatusChange` (Firestore trigger) — writes a notification doc for the affected user(s).

---

## 5. Booking State Machine

```
pending_owner_review --(rentor rejects)--> rejected
pending_owner_review --(rentor approves)--> payment_pending
payment_pending --(stripe webhook success)--> confirmed
confirmed --(startDate reached)--> active            [scheduled/cron or on-read check]
active --(endDate passed)--> completed --> (renter can leave review)
any non-terminal state --(renter/rentor cancels, per policy)--> cancelled
```

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
├── lib/                       # firebase.ts, queryClient.ts, geohash.ts
├── types/                     # shared TS types/interfaces mirroring Firestore schema
└── main.tsx

functions/
└── src/
    ├── https/                 # requestBooking, respondToBooking, createCheckoutSession, setUserRole
    ├── webhooks/              # stripeWebhook
    ├── triggers/              # onBookingStatusChange, onBillboardWrite (denormalization)
    └── index.ts

firestore.rules
firestore.indexes.json
storage.rules
firebase.json
.firebaserc
```

---

## 7. Delivery Phases

1. **Project scaffold** — Vite React-TS app, Firebase project, Hosting/Firestore/Storage/Functions init, emulator suite wired up, CI skeleton.
2. **Auth & roles** — signup/login, role selection at signup (Renter/Rentor), `setUserRole` admin callable, route guards per role.
3. **Rentor: billboard CRUD** — add/edit/deactivate billboard with map-picker for lat/lng, image upload, pricing/size/category selection.
4. **Public browse & map** — map + list view with filters (category, size, price, location radius), billboard detail page.
5. **Booking flow (Renter)** — booking wizard (dates, creative upload), `requestBooking` callable, status tracking page.
6. **Rentor booking inbox** — pending requests list, `respondToBooking` (approve/reject) with reason.
7. **Payments** — Stripe Checkout session on approval, webhook confirms booking, payment history for both sides.
8. **Notifications** — in-app notification feed via Firestore trigger; optional FCM push.
9. **Admin panel** — categories/sizes management, user management (suspend), billboard moderation (flag/unpublish), platform analytics dashboard.
10. **Reviews & polish** — post-completion review/rating, empty/error/loading states, accessibility pass.
11. **Testing & hardening** — Firestore rules unit tests via emulator, Vitest coverage on hooks/components, Functions tests.
12. **CI/CD & deploy** — GitHub Actions pipeline (lint/test/build → deploy Hosting + Functions on `main`), production Firebase project config, Stripe live keys.

---

## 8. Open Items to Revisit Later

- Payout mechanism to Rentors (manual admin payout vs. Stripe Connect) — start manual, note Stripe Connect as a future enhancement.
- Availability model: simple date-range overlap check vs. full calendar subcollection — start simple (overlap check on `bookings` query), upgrade if needed.
- Geo search: `geofire-common` bounding-box + client-side distance filter is sufficient at billboard-marketplace scale; revisit only if the catalog grows very large.
