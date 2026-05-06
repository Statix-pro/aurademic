# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# From repo root
npm run dev            # Run both servers concurrently (client :3000, server :5000)
npm run dev:client     # Frontend only
npm run dev:server     # Backend only
npm install            # Installs dependencies for both client and server

# From client/
npm run build          # tsc + vite build → client/dist/
npm run preview        # Preview production build

# From server/
npm start              # node server.js (production)
npm run dev            # nodemon server.js (development)
```

No automated test suite exists. Use Swagger UI at `http://localhost:5000/api-docs` for API testing.

## Architecture

Full-stack monorepo: React/TypeScript frontend (Vite, port 3000) + Express.js backend (Node.js ES modules, port 5000) + MySQL 8.x database.

### Directory layout

```
aurademic/
├── client/src/
│   ├── app/App.tsx              # Routing tree + provider composition
│   ├── contexts/AuthContext.tsx # Auth state (JWT, user, roles)
│   ├── config/authConfig.ts     # Azure MSAL config
│   ├── features/                # Feature pages (one dir per domain)
│   ├── shared/
│   │   ├── casl/                # CASL ability setup & AbilityContext
│   │   ├── components/
│   │   │   ├── ProtectedRoute.tsx   # Route guards (role/permission variants)
│   │   │   └── layout/              # MainLayout, sidebar, navbar
│   │   ├── types/               # Shared TypeScript types
│   │   └── utils/               # API service helpers
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

| Component | Guards by |
|-----------|-----------|
| `ProtectedRoute` | Any authenticated user |
| `AdminRoute` | Admin role |
| `SuperAdminRoute` | Super-admin role |
| `BudgetApprovalRoute` | Budget approval permission |
| `FinanceWorkflowRoute` | Finance workflow permission |
| `ExpenditureApprovalRoute` | Expenditure approval permission |
| `ModuleWorkflowRoute` | General module workflow permission |

### API structure

- Dev: `http://localhost:5000/api`
- Prod: `https://research.ksrct.ac.in/api`

All endpoints return `{ success: boolean, data?: T, message?: string, error?: string }`.

Key prefixes: `/api/auth`, `/api/dashboard`, `/api/journals`, `/api/projects`, `/api/events`, `/api/pre-events`, `/api/finance`, `/api/finance-requests`, `/api/budget`, `/api/adminbudget`, `/api/expenditure`, `/api/access-control`, `/api/master-data`, `/api/form-options`.

### File uploads

Multer saves files to `server/uploads/[category]/` and Express serves the directory statically at `/uploads`. Upload categories include `sanctionOrder`, `sanctionLetter`, `ucAndSoE`, `utilizationCertificate`, `projectReport`, `bankStatement`, `journal-article`, `finance-principal-documents`.

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

## Database

MySQL 8.x. Schema files live in `server/schema/`. Utility scripts in `server/scripts/` handle employee imports and entity migrations. The connection pool is configured in `server/config/connection.js` with a limit of 10 connections.

All queries use parameterized statements (`mysql2`). Typical usage in a model:
```javascript
import db from '../config/connection.js';
const connection = await db.getConnection();
const [rows] = await connection.query('SELECT * FROM table WHERE id = ?', [id]);
connection.release();
```
