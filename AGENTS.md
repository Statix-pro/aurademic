# AGENTS.md - Research MAC Codebase Guide

## Build, Lint & Test Commands

**Client (React):**
- `npm start` - Start dev server (port 3000)
- `npm run build` - Production build
- `npm test` - Run Jest tests (interactive watch mode)
- `npm test -- --watchAll=false` - Run tests once

**Server (Express/Node.js):**
- `npm start` - Run production server
- `npm run dev` - Run dev server with nodemon (watches file changes)
- No tests configured yet

## Architecture & Structure

**Client** - React 18 with Bootstrap & React Router:
- `/client/src/admin/` - Admin dashboard components
- `/client/src/journalform/` - Journal/publication submission forms
- `/client/src/projectform/` - Project submission forms
- `/client/src/Eventpage/` - Event management UI
- `/client/src/userdashboard/` - User dashboard
- `/client/src/pages/` - PublicationsPage, ProjectsPage
- `/client/src/context/` - AuthContext for state management
- `/client/src/utility/authenticityUtility.js` - Axios wrapper with JWT auth

**Server** - Express.js ES6 modules with MySQL:
- `/server/modules/` - Feature modules (journal, project, auth, admin, events, etc.)
- `/server/middleware/` - errorHandler middleware
- `/server/config/` - Configuration files
- `/server/schema/` - MySQL schema files (auth.sql, journals.sql, project.sql, events.sql)
- Port: 5000 (dev) | Env var: `PORT`
- Base URL: `REACT_APP_API_URL` (default: http://localhost:5000/api)

**Database:** MySQL (configured in .env)

**Auth:** JWT tokens + Google OAuth + Azure MSAL

## Code Style Guidelines

**Imports & Conventions:**
- Client: ES6 imports with `.jsx` extensions
- Server: ES6 modules (`import`/`export`)
- CSS: Separate `.css` files colocated with components
- Use relative imports from utility/context (`import authenticityUtility from '../../utility/authenticityUtility.js'`)

**Components:**
- Functional components with React Hooks (useState, useEffect, useCallback)
- Bootstrap for UI components (Button, Modal, Form, Badge, Alert, Table)
- FontAwesome icons via `@fortawesome/react-fontawesome`
- PropTypes or no formal typing (no TypeScript)

**Naming:**
- camelCase for functions/variables
- PascalCase for components/classes
- snake_case for database columns (e.g., `admin_reply`, `journal_title`)

**HTTP Client:**
- Use `authenticityUtility` (Axios wrapper) for all API calls
- Automatically includes JWT bearer token from localStorage
- Response interceptor handles 401 token expiration (redirects to /login)
- Methods: `.get()`, `.post()`, `.patch()`, `.postFile()`

**Error Handling:**
- try/catch blocks with console.error logging
- Set error state in components for user feedback
- Use Alert component for displaying errors to users
- Always include finally block to reset loading states

**API Response Format:**
- Success responses return data directly via interceptor
- Token validation: Check 401 + `message === 'Token expired'`
- Paginated responses include `total` field

## Environment Variables

**.env required (both client & server):**
- Server: `PORT`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `NODE_ENV`, `FRONTEND_URL`, `DB_*` (MySQL)
- Client: `REACT_APP_API_URL`, `REACT_APP_GOOGLE_CLIENT_ID`
