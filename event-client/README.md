# event-client — participant-facing event site

The public event website, deployed as its own subdomain (e.g. `event.ksrct.ac.in`)
and served by IIS alongside the staff portal. It shares the same Node backend in
[`server/`](../server) but is a **separate build** from [`client/`](../client), so
that staff-only code never reaches a bundle the public can download.

## Commands

Run from the repo root:

```bash
npm run dev              # backend + staff client + event client together
npm run dev:public       # backend + event client only
npm run dev:event        # event client only, on :3001 (strict: fails if taken)
npm run build:event      # tsc + vite build → event-client/dist/
npm run typecheck:event
npm run lint:event
```

Or from this directory: `npm run dev`, `npm run build`, `npm run typecheck`.

## Structure

Grouped by feature, flat inside each feature. A component and its stylesheet sit
side by side, so `import './HomePage.css'` is always the file next to it.

```
src/
├── main.tsx                    # entry point
├── App.tsx                     # routing tree + provider composition
├── index.css                   # Tailwind v4 entry + shared utility classes
├── config/api.ts               # API base URL + OAuth client ID from env
├── contexts/                   # AuthContext, EventsContext, ProfileContext
├── features/<domain>/          # one dir per domain: components + their CSS
│   ├── auth/                   # sign-in
│   ├── home/                   # personalised dashboard + event grid
│   ├── events/                 # EventCard, event detail, event register page
│   ├── registration/           # registration form, team members, accommodation
│   ├── my-registrations/       # registrations the participant already made
│   ├── payment/                # payment summary, UPI QR, proof upload
│   ├── profile/                # personal + profession details
│   ├── feedback/               # post-event feedback
│   └── certificates/           # certificate download
├── shared/
│   ├── components/             # AppLayout, Header, FormElements (+ their CSS)
│   └── utils.ts                # cn(), age calculation
└── types/index.ts              # shared TypeScript interfaces
```

### Conventions

- **A feature owns its files.** Component, stylesheet, and later its `api.ts` and
  hooks all live in the same directory. Nothing about a feature is spread across
  the tree, so a feature can be read, moved, or deleted in one place.
- **Add subdirectories only when a feature earns them.** If one grows past roughly
  eight files, split it locally (`features/registration/team/`). No feature needs
  that today, and pre-splitting one-file features buys nothing.
- **`shared/` is for things used by two or more features.** Used by exactly one?
  It belongs in that feature.
- Feature CSS starts with `@reference "../../index.css"` so Tailwind v4 resolves
  the shared theme; shared-component CSS uses the same path.
- Cross-feature imports are relative (`../events/EventCard`). Frequent ones are a
  signal the thing belongs in `shared/`.

## Configuration

`.env.development` is committed; copy `.env.example` when adding variables.

| Variable                | Purpose                                                    |
| ----------------------- | ---------------------------------------------------------- |
| `VITE_API_URL`          | API base path. `/api` — proxied to `:5000` in dev by Vite. |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client for public participant sign-in.        |

`VITE_API_URL` is a **path**, not a host: in production IIS rewrites `/api` on the
event subdomain to the shared backend, so the app stays same-origin and needs no
CORS entry. `.env.production` is managed on the deployment host, as with `client/`.

## State of the app

### Wired to the backend

- **Sign-in is real.** Google OAuth against `POST /api/participant-auth/google`,
  which verifies the Google ID token and issues a participant JWT. Any Google
  account works — this site is public, unlike the staff portal.
- Participants live in `event_participants`, **not** `users`. They hold no roles
  or permissions, and their tokens are rejected by every staff route.
- **Events come from the API.** `GET /api/events/public` returns events whose
  admin workflow reached `completed`; drafts and in-review events are invisible.

### Still on localStorage

- Registrations, team members, accommodation, payments and feedback all persist
  to `localStorage`, including uploaded files as base64 data URLs — which will
  exceed the ~5 MB quota. These need the participant endpoints, with files going
  through Multer to `server/uploads/`.
- Payment status is set **client-side**; a participant can currently mark
  themselves paid. The schema is ready for the correct flow
  (`event_payments.verified_by` / `verified_at`, gated by `event.verify_payment`).
- `contexts/EventsContext.tsx` still matches hardcoded event names
  (`isAiHackathon`, `Build Battle`, `Idea Pitch`) to decide review state; that
  belongs to `event_registrations.review_status`.
- The registration feature still hardcodes accommodation room types and prices.
  The API now serves them per event via `accommodationRoomTypes`.
