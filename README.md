# Billboard Renting System

A GIS-based billboard rental marketplace with a **React + Firebase** stack —
Renter (advertiser), Rentor (billboard owner), and Admin roles. See
[`PLAN.md`](./PLAN.md) for the full architecture and delivery-phase plan.

This is currently **Phase 1 (project scaffold)**: tooling, routing, and stub
pages are in place; no Firebase project is connected yet and no
auth/billboard/booking logic has been implemented.

## Prerequisites

- Node.js 20+
- npm 10+
- A Firebase project (for later phases — not required to run the scaffold)

## Setup

```bash
npm install
cp .env.example .env.local   # fill in Firebase config once a project exists
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

See `PLAN.md` section 6 for the intended frontend/functions structure. In
short: `src/app` (router, layout, route guards), `src/features/*` (one folder
per role/domain area), `src/components` (shared UI), `src/hooks`, `src/lib`
(Firebase client, query client, utils), `src/types` (Firestore schema types),
and `functions/` (Cloud Functions, separate Node project).

## Firebase (follow-up phase)

No real Firebase project is wired up yet. Once one exists:

1. `firebase login` and `firebase use --add` to point `.firebaserc` at the
   real project id (replace the `your-firebase-project-id` placeholder).
2. Fill in `.env.local` from `.env.example` with the web app's SDK config.
3. `cd functions && npm install` to install the Cloud Functions dependencies.
4. `firebase emulators:start` to run Auth/Firestore/Storage/Functions
   locally against `firestore.rules` / `storage.rules`.

`firestore.rules` and `storage.rules` are currently deny-by-default
skeletons — see the TODO comments in each file and PLAN.md section 4 for the
real rules to implement alongside each feature phase.
