# EventPro — Event Management Frontend

A React + TypeScript + Tailwind CSS event management system.

## Project Structure

```
src/
├── App.tsx                         # Route definitions
├── main.tsx                        # React entry point
├── index.css                       # Tailwind + custom classes
├── types/
│   └── index.ts                    # All TypeScript interfaces
├── hooks/
│   └── useAuth.tsx                 # Auth context (persists to localStorage)
├── context/
│   ├── ProfileContext.tsx          # Personal + Profession details (persists to localStorage)
│   └── EventsContext.tsx           # Events list + registrations (persists to localStorage)
├── components/
│   ├── events/
│   │   ├── EventCard.tsx           # ★ THE reusable event box function (call per event)
│   │   ├── EventDetailModal.tsx    # Modal shown on "View Details"
│   │   └── PaymentSection.tsx      # Payment summary sidebar
│   ├── layout/
│   │   ├── AppLayout.tsx           # Sidebar + header wrapper
│   │   └── Header.tsx              # Top navigation bar
│   └── ui/
│       └── FormElements.tsx        # Input, Select, RadioGroup primitives
└── pages/
    ├── AuthPage.tsx                # Login / Register page
    ├── HomePage.tsx                # ★ Event grid (Screenshot 1 style)
    ├── RegistrationPage.tsx        # ★ Event list + team forms + payment (Screenshot 2/3)
    ├── ProfilePage.tsx             # ★ Personal + Profession details only
    └── PaymentPage.tsx             # Payment confirmation page
```

## Key Design Decisions

### EventCard — Single Box Function
`EventCard.tsx` is the **only** place the event card UI is written.  
Every new event from the backend automatically uses this same structure.  
To add a new category colour, add one entry to `CATEGORY_COLORS` in `EventCard.tsx`.

### Adding Events (web2 admin)
Call `addEvent()` from `EventsContext`:
```ts
const { addEvent } = useEvents()
addEvent({
  eventName: 'New Event',
  category: 'TECHNICAL',   // or any new string
  description: '...',
  date: '01 Sep 2026',
  venue: 'Room X',
  participation: 'Team',
  teamSize: '2 – 5 Members',
  fees: 400,
  feesUnit: 'Team',
  status: 'Open',
})
```

### Profile Persistence
Profile data is saved to `localStorage` on every field change.  
Keys: `ep_profile_v1` (personal + profession), `ep_auth` (user).

### Registration Flow
1. User clicks **Register Now** on any event card → goes to `/register`
2. On `/register` they see Screenshot-2 list view, select events, fill team details
3. Payment summary appears on the right side automatically when events are selected
4. **Proceed to Payment** is enabled only when:
   - Profile (personal + profession) is complete
   - All selected team events have full team member details
5. Payment page at `/payment` completes the flow

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Tech Stack
- React 18 + TypeScript
- React Router v6
- Tailwind CSS v3
- Lucide React icons
- Vite build tool
