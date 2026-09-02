# CLAUDE.md

Last updated: Sat Jun 06 2026

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# From repo root
npm run dev            # Run both servers concurrently (client :3000, server :5000)
npm run dev:client     # Frontend only
npm run dev:server     # Backend only
npm install            # Installs dependencies for both client and server
npm run test:server    # Run backend Vitest test suite
npm run purge:notifications        # Notification retention (see below)
npm run purge:notifications -- --dry-run

# From client/
npm run build          # tsc + vite build → client/dist/
npm run preview        # Preview production build
npm run lint           # ESLint

# From server/
npm start              # node server.js (production)
npm run dev            # nodemon server.js (development)
npm test               # Run backend tests (Vitest)
```

A backend Vitest test suite is available under `server/tests/`. Run `npm run test:server` from the root or `npm test` from the `server/` directory to run tests. Use Swagger UI at `http://localhost:5000/api-docs` for API testing.

## Architecture

Full-stack monorepo: React/TypeScript frontend (Vite, port 3000) + Express.js backend (Node.js ES modules, port 5000) + MySQL 8.x database.

### Directory layout

```
aurademic/
├── client/src/
│   ├── app/App.tsx              # Routing tree + provider composition
│   ├── config/authConfig.ts     # Azure MSAL config
│   ├── contexts/AuthContext.tsx  # Auth state (JWT, user, roles)
│   ├── features/                # Feature pages (one dir per domain)
│   │   ├── admin/               # Admin dashboard modules
│   │   ├── auth/                # Login / auth pages
│   │   ├── budget/              # Budget proposals
│   │   ├── events/              # Event management
│   │   ├── expenditure/         # Expenditure requests
│   │   ├── finance/             # Finance requests
│   │   ├── journals/            # Research publications
│   │   ├── projects/            # Funded projects
│   │   └── user-dashboard/      # User-facing dashboard cards
│   ├── shared/
│   │   ├── assets/              # Images, icons
│   │   ├── casl/                # CASL ability setup & AbilityContext
│   │   ├── components/
│   │   │   ├── ProtectedRoute.tsx   # Route guards (role/permission variants)
│   │   │   ├── layout/              # MainLayout, sidebar, navbar
│   │   │   └── ui/                  # AlertModal, CustomModal, etc.
│   │   ├── hooks/               # Shared React hooks (budgetCatalogStore, etc.)
│   │   ├── pages/               # Shared page components (workflow approval)
│   │   ├── styles/              # Global CSS styles
│   │   ├── types/               # Shared TypeScript types
│   │   └── utils/               # authenticityUtility, permissionUtils, etc.
│   ├── types/                   # Top-level TypeScript interfaces (User, Author, etc.)
│   └── main.tsx                 # Entry point
├── server/
│   ├── server.js                # Express entry point (port 5000)
│   ├── config/
│   │   ├── connection.js        # mysql2 connection pool
│   │   ├── env.js               # dotenv loader (picks .env.development or .env.production)
│   │   └── swagger.js           # Swagger/OpenAPI setup
│   ├── middleware/
│   │   ├── authMiddleware.js    # JWT verify + enrich user with roles/permissions
│   │   └── uploadMiddleware.js  # Multer file upload config
│   ├── modules/                 # Feature modules (MVC, one dir per domain)
│   ├── schema/                  # SQL schema, migrations, seed data
│   ├── scripts/                 # Utility scripts, migration helpers, cleanup guides
│   ├── tests/                   # Vitest test suite
│   └── uploads/                 # Stored files served at /uploads
└── web.config                   # IIS configuration for deployment
```

### Server module pattern

Every module under `server/modules/` follows the same structure:

```
modules/[name]/
├── [name]Model.js       # DB queries (mysql2 pool)
├── [name]Controller.js  # Request handlers
└── [name]Routes.js      # Express router + middleware wiring
```

The Events domain nests sub-modules: `modules/events/{events,preevents,finance,updates,documents}/`.

### Authentication & authorization flow

1. User authenticates via Google OAuth or Azure MSAL (browser-side)
2. Backend validates the OAuth token and issues a JWT
3. JWT stored in `localStorage`; sent as `Authorization: Bearer <token>` on every request
4. `authMiddleware.js` verifies JWT and enriches `req.user` with roles/permissions fetched from the `access_control` table
5. Route handlers call a permission middleware before business logic
6. Frontend uses CASL (`AbilityContext`) for UI-level permission checks; `ProtectedRoute` variants guard routes

### Protected route variants

| Component                  | Guards by                          |
| -------------------------- | ---------------------------------- |
| `ProtectedRoute`           | Any authenticated user             |
| `AdminRoute`               | Admin role                         |
| `SuperAdminRoute`          | Super-admin role                   |
| `BudgetApprovalRoute`      | Budget approval permission         |
| `FinanceWorkflowRoute`     | Finance workflow permission        |
| `ExpenditureApprovalRoute` | Expenditure approval permission    |
| `ModuleWorkflowRoute`      | General module workflow permission |

### API structure

- Dev: `http://localhost:5000/api`
- Prod: `https://research.ksrct.ac.in/api`

All endpoints return `{ success: boolean, data?: T, message?: string, error?: string }`.

Key prefixes: `/api/auth`, `/api/admin`, `/api/dashboard`, `/api/form-options`, `/api/journals`, `/api/projects`, `/api/events`, `/api/pre-events`, `/api/finance` (events), `/api/finance-requests`, `/api/budget`, `/api/adminbudget`, `/api/budget-catalog`, `/api/account-options`, `/api/expenditure`, `/api/expenditure-requests`, `/api/expenditure-dashboard`, `/api/expenditure-report`, `/api/updates`, `/api/documents`, `/api/access-control`, `/api/master-data`, `/api/notifications`.

### File uploads

Multer saves files to `server/uploads/[category]/` and Express serves the directory statically at `/uploads`. Upload categories include `sanctionOrder`, `sanctionLetter`, `ucAndSoE`, `utilizationCertificate`, `statementOfExpenditure`, `projectReport`, `bankStatement`, `project-presentation`, `project-bill-copies`, `journal-article`, `finance-principal-documents`.

### Notifications

One engine every module emits into. `server/modules/notification/`:

| File                        | Role                                                                 |
| --------------------------- | -------------------------------------------------------------------- |
| `notificationService.js`    | `emit()` — the only API other modules call                           |
| `notificationCatalog.js`    | Event-type registry: category, severity, channels, render functions  |
| `notificationDispatcher.js` | Outbox worker: claims events, fans out, dispatches channels, retries |
| `recipientResolver.js`      | Audience descriptors → user ids                                      |
| `audiences.js`              | Reusable audience builders                                           |
| `channels/`                 | `in_app`, `web_push`; add a channel by adding a file here            |

**How to notify from new code.** Describe the audience in intent terms and let
the resolver work out who that is — never look up user ids at the call site:

```js
import notificationService from '../notification/notificationService.js';

await notificationService.emit({
  type: 'finance.stage_advanced', // must exist in notificationCatalog.js
  actorUserId: actor.userId, // excluded from recipients automatically
  subject: { moduleKey: 'finance', recordId },
  audience: [
    { kind: 'user', userId: applicantUserId, recipientRole: 'applicant' },
    {
      kind: 'workflow_stage',
      moduleKey: 'finance',
      stageKey: 'dof',
      departmentId,
      entityId,
      recipientRole: 'approver',
    },
  ],
  data: { stage: 'dof', feedback },
  dedupeKey: `finance:${recordId}:stage:dof`,
  tx: conn, // joins the caller's transaction
});
```

Audience kinds: `user`, `users`, `employee`, `employees`, `role`, `permission`
(supports a trailing `*`), and `workflow_stage` (resolves role + department/entity
scope from `workflow_stage_policies`).

**Two things to know before changing it.**

1. **`emit` writes one row and never throws.** It is called inside the business
   transaction, so it must not be able to roll back an approval. Delivery is the
   dispatcher's job, outside that transaction, with retry. This is also why a
   rolled-back approval correctly takes its notification with it.
2. **`finance` and `expenditure` are already covered.** Both run on the shared
   workflow engine, so `workflowService.js` emits for them at `startWorkflow`,
   `actOnWorkflow` and `logWorkflowResubmission`. Any module registered through
   `registerWorkflowModule()` is notified with no further work. Budget has its
   own older engine and is wired through `shared/budget/budgetNotifications.js`
   instead — note that `shared/budget/budgetApprovalEngine.js` looks like the
   place to hook but is dead code that nothing imports.

**Retention.** `npm run purge:notifications` archives read notifications older
than 90 days and deletes finished outbox events older than 180 days. Nothing
else prunes these tables; schedule it.

**Client.** `client/src/shared/notifications/` — a module-scope store in the
same shape as `shared/hooks/useBudgetCatalog.ts`, plus `notificationsTransport.ts`,
which is the single seam holding the polling implementation. Polling (not SSE or
WebSockets) because production runs behind IIS/iisnode, which buffers responses.
Moving to a push transport means rewriting that one file.

## Environment configuration

**Client** (`.env.development` / `.env.production`):

```
VITE_API_URL=http://localhost:5000/api
VITE_GOOGLE_CLIENT_ID=...
VITE_MICROSOFT_CLIENT_ID=...
VITE_MICROSOFT_TENANT_ID=...
```

**Server** (`.env.development` / `.env.production`):

```
PORT=5000
DB_HOST=...
DB_USER=...
DB_PASSWORD=...
DB_NAME=research
DB_PORT=3306
GOOGLE_CLIENT_ID=...
JWT_SECRET=...
FRONTEND_URL=http://localhost:3000
NODE_ENV=development

# Notifications — Web Push (optional; in-app notifications work without these)
# Generate a pair with: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:noreply@ksrct.ac.in
# Set to false to run the API with notification delivery paused. Emits keep
# accumulating harmlessly in the outbox.
NOTIFICATIONS_DISPATCH_ENABLED=true
NOTIFICATIONS_DISPATCH_INTERVAL_MS=10000
```

The client needs no notification configuration: it fetches the VAPID public key
from `GET /api/notifications/push/public-key`, so the keys live in one place.

## Database

MySQL 8.x. Schema files live in `server/schema/` (includes `migrations/`, `scripts/`, `developer_seed.sql`). Utility scripts in `server/scripts/` handle employee imports and entity migrations. The connection pool is configured in `server/config/connection.js` with a limit of 10 connections.

Key table groups:

| Group         | Tables                                                                                                                                                                                                                                                                                                                                                                 |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth & RBAC   | `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `user_entity_roles`                                                                                                                                                                                                                                                                                 |
| Master data   | `master_departments`, `master_employees`, `master_entities`, `master_entity_types`, `master_entity_contacts`                                                                                                                                                                                                                                                           |
| Budget        | `budget_proposals`, `budget_proposal_lines`, `budget_catalog`, `budget_sub_catalog`                                                                                                                                                                                                                                                                                    |
| Finance       | `finance_requests`, `finance_request_budget_rows`, `finance_request_income_rows`, `finance_request_annexures`, `finance_request_status_updates`                                                                                                                                                                                                                        |
| Expenditure   | `expenditure_requests`, `expenditure_advance_rows`, `expenditure_line_rows`, `expenditure_settlement_rows`, `expenditure_request_refs`                                                                                                                                                                                                                                 |
| Research      | `journals`, `journal_authors`, `authors`, `author_students`                                                                                                                                                                                                                                                                                                            |
| Projects      | `research_projects`, `project_investigators`, `project_tags`, `project_collaborators`, `project_finance_rows`, `project_grant_disbursements`, `project_documents`, `project_organizations`, `project_schemes`, `project_requests`, `project_budget_years`, `project_budget_heads`, `project_budget_allotments`, `project_transaction_accounts`, `project_transactions` |
| Events        | `events`, `pre_events`, `event_finance`                                                                                                                                                                                                                                                                                                                                |
| Workflow      | `workflow_actions` (append-only decision log), `workflow_stage_policies` (per-stage scope), `approval_flow_config` (flow definitions). Live state is a `workflow_state` JSON column on each record's own table, not a separate instances table                                                                                                                         |
| Notifications | `notification_events` (transactional outbox), `notifications` (one row per recipient), `notification_deliveries` (per-channel attempts), `notification_preferences`, `push_subscriptions`                                                                                                                                                                              |

All queries use parameterized statements (`mysql2`). Typical usage in a model:

```javascript
import db from '../config/connection.js';
const connection = await db.getConnection();
const [rows] = await connection.query('SELECT * FROM table WHERE id = ?', [id]);
connection.release();
```

## Legacy Code Conventions

When adding backward-compatibility code (fallbacks for old data, old field names, missing columns, etc.), **always** follow these naming rules so the code is easy to find and clean up later:

### Naming rules

| Element                | Convention                                 | Example                                                       |
| ---------------------- | ------------------------------------------ | ------------------------------------------------------------- |
| Variables              | Prefix with `legacy` or `fallback`         | `legacyIsAdmin`, `fallbackPermissions`, `legacyPayeeName`     |
| Functions              | Include `Legacy` or `Fallback` in the name | `createExpenditureLegacy()`, `deriveLegacyAnchorRequestIds()` |
| SQL aliases            | Prefix with `legacy_`                      | `legacy_totals`, `legacy_match_clause`                        |
| Comments               | Start with `// LEGACY:` or `// FALLBACK:`  | `// LEGACY: text-match when budget_head_id IS NULL`           |
| Constants              | Include `LEGACY` or `FALLBACK` in the name | `LEGACY_ADMIN_PERMISSION_KEYS`, `FALLBACK_TAG_OPTIONS`        |
| Option values (client) | Prefix with `legacy-`                      | `legacy-head::`, `legacy-sub::`                               |

### Comment format

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
