import './config/env.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
// import rateLimit from 'express-rate-limit';

// routes
import db from './config/connection.js';
import { errorHandler } from './middleware/errorMiddleware.js';
import accessControlRoutes from './modules/accessControl/accessControlRoutes.js';
import accountOptionsRoutes from './modules/accountOptions/accountOptionsRoutes.js';
import adminBudgetRoutes from './modules/adminbudget/adminBudgetRoutes.js';
import adminRoutes from './modules/admindashboard/adminRoutes.js';
import authRoutes from './modules/auth/authRoutes.js';
import budgetRoutes from './modules/budget/budgetRoutes.js';

// Events routes
import budgetCatalogRoutes from './modules/budgetCatalog/budgetCatalogRoutes.js';
import directoryOptionsRoutes from './modules/directoryOptions/directoryOptionsRoutes.js';
import editRequestRoutes from './modules/editRequest/editRequestRoutes.js';
import documentsRoutes from './modules/events/documents/documentsRoutes.js';
import eventRoutes from './modules/events/events/eventRoutes.js';
import financeRoutes from './modules/events/finance/financeRoutes.js';
import preEventRoutes from './modules/events/preevents/preEventRoutes.js';
import updatesRoutes from './modules/events/updates/updatesRoutes.js';
import expenditureRoutes from './modules/expenditure/expenditureRoutes.js';
import expenditureUserDashboardRoutes from './modules/expenditure/expenditureUserDashboardRoutes.js';
import expenditureReportRoutes from './modules/expenditureReport/expenditureReportRoutes.js';

// Finance page
import financePageRoutes from './modules/finance/financeRoutes.js';
import formOptionsRoutes from './modules/formOptions/formOptionsRoutes.js';
import journalRoutes from './modules/journal/journalRoutes.js';
import masterDataRoutes from './modules/masterData/masterDataRoutes.js';
import { startDispatcher, stopDispatcher } from './modules/notification/notificationDispatcher.js';
import notificationRoutes from './modules/notification/notificationRoutes.js';
import organizationDirectoryRoutes from './modules/organizationDirectory/organizationDirectoryRoutes.js';
import projectRoutes from './modules/project/projectRoutes.js';
import resourcepersonDirectoryRoutes from './modules/resourcepersonDirectory/resourcepersonDirectoryRoutes.js';
import userDashboardRoutes from './modules/userdashboard/userDashboardRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Behind IIS / a reverse proxy the client address and scheme only arrive in
// X-Forwarded-*, so req.ip and the HTTPS check below need this to be true.
app.set('trust proxy', true);

/* ================= CORS ================= */

const corsOptions = {
  origin:
    process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL : ['http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Authorization'],
};

/* ================= MIDDLEWARE ================= */

app.use(helmet());
app.use(cors(corsOptions));

// Registered before the body parsers so a plain-HTTP upload is bounced on its
// headers rather than read to 50mb first and only then told to retry over TLS.
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(`https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// const globalLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 3000,
//   message: 'Too many requests from this IP, please try again after 15 minutes',
//   standardHeaders: true,
//   legacyHeaders: false,
// });
// app.use(globalLimiter);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} from ${req.ip}`);
  next();
});

/* ================= SWAGGER ================= */

/**
 * Loaded on demand rather than at the top of the file. Swagger never mounts in
 * production, so importing it there only means `swagger-ui-express` and
 * `swagger-jsdoc` have to be installed on the production box to satisfy an
 * import whose result is thrown away.
 *
 * Deliberately `.then()` and not `await`. A top-level await anywhere in this
 * file — even inside a branch that production never enters — makes the whole
 * module async, and iisnode loads this file through `require()`, which refuses
 * an ESM graph containing one: ERR_REQUIRE_ASYNC_MODULE, before a single route
 * is reachable. Mounting /api-docs a tick later costs nothing.
 */
if (process.env.NODE_ENV !== 'production') {
  Promise.all([import('swagger-ui-express'), import('./config/swagger.js')])
    .then(([{ default: swaggerUi }, { default: specs }]) => {
      app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
      console.log('Swagger UI available at /api-docs');
    })
    .catch((error) => console.error('Swagger UI failed to load.', error));
}

/* ================= STATIC FILES ================= */

console.log('Attempting to serve static files from:', path.join(__dirname, '..', 'uploads'));

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

/* ================= ENSURE UPLOAD DIRS ================= */

const createUploadDirectories = () => {
  const directories = [
    'uploads',
    'uploads/sanctionOrder',
    'uploads/sanctionLetter',
    'uploads/ucAndSoE',
    'uploads/utilizationCertificate',
    'uploads/statementOfExpenditure',
    'uploads/projectReport',
    'uploads/bankStatement',
    'uploads/journal-article',
    'uploads/finance-principal-documents',
  ];

  directories.forEach((dir) => {
    const fullPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  });
};

createUploadDirectories();

/* ================= API ROUTES ================= */

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', userDashboardRoutes);
app.use('/api/form-options', formOptionsRoutes);

app.use('/api', journalRoutes);
app.use('/api', projectRoutes);
app.use('/api', editRequestRoutes);

// Events
app.use('/api/events', eventRoutes);
app.use('/api/pre-events', preEventRoutes);
app.use('/api/finance', financeRoutes);

// Existing finance page
app.use('/api/finance-requests', financePageRoutes);

// Budget routes
app.use('/api/budget', budgetRoutes);
app.use('/api/adminbudget', adminBudgetRoutes);
app.use('/api/expenditure', expenditureRoutes);
app.use('/api/expenditure-requests', expenditureRoutes);
app.use('/api/expenditure-dashboard', expenditureUserDashboardRoutes);
app.use('/api/expenditure-report', expenditureReportRoutes);

// Updates & documents
app.use('/api/updates', updatesRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/access-control', accessControlRoutes);
app.use('/api/master-data', masterDataRoutes);

// Organization and resource person directories
app.use('/api/directory-options', directoryOptionsRoutes);
app.use('/api', organizationDirectoryRoutes);
app.use('/api', resourcepersonDirectoryRoutes);

app.use('/api/budget-catalog', budgetCatalogRoutes);
app.use('/api/account-options', accountOptionsRoutes);
app.use('/api/notifications', notificationRoutes);

/* ================= 404 HANDLER ================= */

// Add 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    method: req.method,
  });
});

/* ================= ERROR HANDLER ================= */

app.use(errorHandler);

/* ================= SERVER ================= */

/**
 * The notification outbox worker. Started with the HTTP listener rather than at
 * import time: the test suite imports `app` directly, and a background timer
 * polling a mocked connection pool there would be both noisy and useless.
 * Set NOTIFICATIONS_DISPATCH_ENABLED=false to run the API with delivery paused —
 * emits keep accumulating harmlessly in the outbox.
 */
const startNotificationDispatcher = () => {
  if (String(process.env.NOTIFICATIONS_DISPATCH_ENABLED || 'true').toLowerCase() === 'false') {
    console.log('Notification dispatcher disabled by NOTIFICATIONS_DISPATCH_ENABLED=false');
    return;
  }
  startDispatcher();
};

/**
 * The RBAC tables `mergeAuthorizationSnapshot` depends on, checked once at boot.
 *
 * Authority is read from the database on every request and no longer falls back
 * to the token's own claims, so if these tables are missing the whole estate
 * degrades at once: `getUserAuthorizationSnapshot` catches the missing-table
 * error, returns a `degraded` snapshot with `isSuperAdmin` false, and every
 * admin screen closes to everybody. That is the right answer for an authority
 * check, but it is a terrible thing to discover from a user's 403. Checked
 * here, it is one line in the boot log instead.
 *
 * Deliberately a warning and not a refusal to start: the API serves plenty that
 * never reaches a permission check, and a half-migrated database should still
 * come up so the migration can be finished against it. Started with the
 * listener, not at import time, for the same reason as the dispatcher above.
 */
const RBAC_TABLES = ['roles', 'permissions', 'role_permissions', 'user_roles', 'user_entity_roles'];

const verifyRbacSchema = async () => {
  try {
    const [rows] = await db.query(
      `SELECT table_name AS name
         FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name IN (?)`,
      [RBAC_TABLES],
    );

    const present = new Set(rows.map((row) => String(row.name).toLowerCase()));
    const missing = RBAC_TABLES.filter((table) => !present.has(table));

    if (missing.length > 0) {
      console.error(
        `RBAC tables missing: ${missing.join(', ')}. ` +
          'Roles and permissions cannot be resolved, so every admin and super-admin ' +
          'screen will be denied until the access-control migrations are applied.',
      );
    }
  } catch (error) {
    console.error('Could not verify the RBAC schema at startup:', error.message);
  }
};

/**
 * iisnode recycles the worker with SIGTERM. Stopping the dispatcher on the way
 * out releases whatever outbox batch it holds a lease on, so the next worker can
 * pick the batch up at once instead of waiting out the stale-claim threshold.
 */
const installShutdownHandlers = (server) => {
  const shutdown = (signal) => {
    console.log(`Received ${signal}, shutting down`);
    stopDispatcher();
    server.close(() => process.exit(0));
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

export const startServer = (port = process.env.PORT || 5000) => {
  const server = app.listen(port, () => {
    startNotificationDispatcher();
    verifyRbacSchema();
    console.log(`Server running on port ${port}`);
  });
  installShutdownHandlers(server);
  return server;
};

/**
 * Start unless a test runner is importing this file for `app`.
 *
 * This deliberately does not test `process.argv[1]` against this module's own
 * URL. Under iisnode the entry point is iisnode's interceptor, which pulls this
 * file in with `require()` — argv[1] is the interceptor, never `server.js`, so
 * an entrypoint check is false in the one environment that most needs the
 * listener. The process would boot, bind nothing, and every request through IIS
 * would fail with nothing in the log to explain it.
 */
const isTestRun = Boolean(process.env.VITEST) || process.env.NODE_ENV === 'test';

if (!isTestRun) {
  startServer();
}

export default app;
