# Research Portal (GEMINI Project)

Last updated: Sat Jun 06 2026

This document outlines the architecture, setup, and deployment procedures for the Research Portal application (`aurademic`).

## 1. Project Overview

The Research Portal is a full-stack web application designed to manage academic research activities, including:

- **Journal Publications:** Tracking and management of research papers.
- **Projects:** Monitoring funded projects, proposals, and grants.
- **Events:** Management of academic events, finances, and pre-event planning.
- **Budget & Finance:** Budget proposals, finance requests, and expenditure tracking.
- **User Dashboard:** Personalized views for faculty and students.
- **Admin Dashboard:** Centralized control for administrators.

## 2. Technology Stack

### Client (Frontend)

- **Framework:** React 18
- **Build Tool:** Vite
- **Language:** TypeScript
- **UI Library:** Bootstrap 5, React Bootstrap
- **Routing:** React Router DOM
- **Icons:** Lucide React
- **HTTP Client:** Axios
- **Authentication:** Azure MSAL (Microsoft), Google OAuth (@react-oauth/google)
- **Authorization:** CASL (@casl/ability, @casl/react)
- **Calendar:** FullCalendar
- **PDF:** jspdf, pdf-lib

### Server (Backend)

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MySQL (via `mysql2`)
- **Auth:** jsonwebtoken, google-auth-library
- **API Documentation:** Swagger UI
- **File Handling:** Multer
- **Testing:** Vitest + Supertest
- **Module System:** ES Modules (`import`/`export`)

## 3. Directory Structure

```
aurademic/
├── client/                 # React (Vite + TypeScript) Application
│   ├── src/
│   │   ├── app/            # App.tsx (routing tree + providers)
│   │   ├── config/         # Azure MSAL auth config
│   │   ├── contexts/       # React Context (AuthContext, etc.)
│   │   ├── features/       # Feature pages (one dir per domain)
│   │   │   ├── admin/      # Admin dashboard modules
│   │   │   ├── budget/     # Budget proposals
│   │   │   ├── events/     # Event management
│   │   │   ├── expenditure/# Expenditure requests
│   │   │   ├── finance/    # Finance requests
│   │   │   ├── journals/   # Research publications
│   │   │   ├── projects/   # Funded projects
│   │   │   └── user-dashboard/ # User-facing cards
│   │   ├── shared/         # Shared utilities & components
│   │   │   ├── casl/       # CASL ability setup
│   │   │   ├── components/ # ProtectedRoute, layout, UI components
│   │   │   ├── hooks/      # Shared React hooks
│   │   │   ├── pages/      # Shared page components (workflow)
│   │   │   ├── styles/     # Global CSS styles
│   │   │   ├── types/      # Shared TypeScript types
│   │   │   └── utils/      # authenticityUtility, permissionUtils
│   │   ├── types/          # Top-level TS interfaces (User, Author, etc.)
│   │   └── main.tsx        # Entry Point
│   ├── .env.development    # Local development config
│   ├── .env.production     # Production build config
│   ├── package.json
│   └── vite.config.ts
├── server/                 # Node.js Express Application
│   ├── config/             # DB connections & Swagger setup
│   ├── middleware/         # Auth & Error handling middleware
│   ├── modules/            # Feature-based modules (Controller/Routes/Models)
│   ├── schema/             # SQL schema, migrations, seed data
│   ├── scripts/            # Utility scripts, cleanup guides
│   ├── tests/              # Vitest test suite
│   ├── uploads/            # File upload storage
│   ├── .env.development    # Local environment config
│   ├── .env.production     # Production environment config
│   ├── iisnode-start.cjs   # Entry point for IISNode
│   ├── server.js           # Main Express App entry
│   └── package.json
├── web.config              # IIS Configuration for the root
├── CLAUDE.md               # AI instructions (Claude)
└── GEMINI.md               # This documentation
```

## 4. Configuration & Environment

The project uses **Split Environment Configuration** to support seamless transitions between local development and production.

### Client Configuration (`client/`)

- **`.env.development`** (Loaded via `npm run dev`)

  ```ini
  VITE_API_URL=http://localhost:5000/api
  VITE_GOOGLE_CLIENT_ID=...
  VITE_MICROSOFT_CLIENT_ID=...
  VITE_MICROSOFT_TENANT_ID=...
  ```

- **`.env.production`** (Loaded via `npm run build`)
  ```ini
  VITE_API_URL=https://research.ksrct.ac.in/api
  VITE_GOOGLE_CLIENT_ID=...
  VITE_MICROSOFT_CLIENT_ID=...
  VITE_MICROSOFT_TENANT_ID=...
  ```

### Server Configuration (`server/`)

The server determines the environment via the `NODE_ENV` variable.

- **`.env.development`** (Loaded when `NODE_ENV` is missing or 'development')
  ```ini
  PORT=5000
  DB_HOST=localhost
  DB_USER=...
  DB_PASSWORD=...
  DB_NAME=research
  DB_PORT=3306
  GOOGLE_CLIENT_ID=...
  JWT_SECRET=...
  FRONTEND_URL=http://localhost:3000
  NODE_ENV=development
  ```

## 5. Development Setup (Local)

1.  **Prerequisites:** Node.js (v18+), MySQL.
2.  **Database:** Import the schema from `server/schema` into your local MySQL instance.

### Running the Server

```bash
cd server
npm install
npm run dev
```

- Server runs on: `http://localhost:5000`
- Swagger Docs: `http://localhost:5000/api-docs`

### Running the Client

```bash
cd client
npm install
npm run dev
```

- Client runs on: `http://localhost:3000`

## 6. Key Utilities

### Authenticity Utility (`authenticityUtility.ts`)

Located in `client/src/shared/utils/`. An Axios instance wrapper that handles API requests, JWT token management, and auto-logout.

- **Base URL:** Resolved from `VITE_API_URL` env var
- **Development:** `http://localhost:5000/api`
- **Production:** `https://research.ksrct.ac.in/api`
- **Features:** Auto-attaches JWT bearer token, checks token expiry, handles 401 auto-logout, provides `postFile()` for multipart uploads.

## 7. Quality Assurance

Code quality is tracked using ESLint, Prettier, and Husky pre-commit hooks.

```bash
# From repo root
npm run lint           # ESLint check
npm run lint:fix       # ESLint auto-fix
npm run format         # Prettier format
npm run format:check   # Prettier check
npm run test:server    # Run backend Vitest test suite
```

## 8. Database Schema

MySQL 8.x. Schema files live in `server/schema/` (includes `migrations/`, `scripts/`, `developer_seed.sql`).

Key table groups:

| Group       | Tables                                                                                                                                          |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth & RBAC | `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `user_entity_roles`                                                          |
| Master data | `master_departments`, `master_employees`, `master_entities`, `master_entity_types`, `master_entity_contacts`                                    |
| Budget      | `budget_proposals`, `budget_proposal_lines`, `budget_catalog`, `budget_sub_catalog`                                                             |
| Finance     | `finance_requests`, `finance_request_budget_rows`, `finance_request_income_rows`, `finance_request_annexures`, `finance_request_status_updates` |
| Expenditure | `expenditure_requests`, `expenditure_advance_rows`, `expenditure_line_rows`, `expenditure_settlement_rows`, `expenditure_request_refs`          |
| Research    | `journals`, `projects`, `journal_authors`, `project_investigators`                                                                              |
| Events      | `events`, `pre_events`, `event_finance`                                                                                                         |
| Workflow    | `workflow_instances`, `workflow_stage_logs`                                                                                                     |

## 9. Legacy Code Conventions

When adding backward-compatibility code (fallbacks for old data, old field names, missing columns, etc.), **always** follow these naming rules so the code is easy to find and clean up later:

### Naming Rules

| Element                | Convention                                 | Example                                                       |
| ---------------------- | ------------------------------------------ | ------------------------------------------------------------- |
| Variables              | Prefix with `legacy` or `fallback`         | `legacyIsAdmin`, `fallbackPermissions`, `legacyPayeeName`     |
| Functions              | Include `Legacy` or `Fallback` in the name | `createExpenditureLegacy()`, `deriveLegacyAnchorRequestIds()` |
| SQL aliases            | Prefix with `legacy_`                      | `legacy_totals`, `legacy_match_clause`                        |
| Comments               | Start with `// LEGACY:` or `// FALLBACK:`  | `// LEGACY: text-match when budget_head_id IS NULL`           |
| Constants              | Include `LEGACY` or `FALLBACK` in the name | `LEGACY_ADMIN_PERMISSION_KEYS`, `FALLBACK_TAG_OPTIONS`        |
| Option values (client) | Prefix with `legacy-`                      | `legacy-head::`, `legacy-sub::`                               |

### Comment Format

Every legacy block **must** have a comment explaining:

1. **What** old behavior it supports
2. **When** it can be removed (e.g., "after all rows have `budget_head_id` populated")

```js
// LEGACY: old expenditure requests store head/sub_head as flat columns.
// Remove after migrating all rows to expenditure_advance_rows table.
const legacyAmount = row.amount ?? 0;
```

### Reference

See `server/scripts/FRESH_DEPLOY_CLEANUP.md` for the full audit of existing legacy code.
