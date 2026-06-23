import './config/env.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import cors from 'cors';
import express from 'express';
// import rateLimit from 'express-rate-limit';

// Multi-tenant middleware
import { tenantResolver } from './middleware/tenantResolver.js';

// routes
import swaggerUi from 'swagger-ui-express';

import specs from './config/swagger.js';
import { errorHandler } from './middleware/errorMiddleware.js';
import accessControlRoutes from './modules/accessControl/accessControlRoutes.js';
import accountOptionsRoutes from './modules/accountOptions/accountOptionsRoutes.js';
import adminBudgetRoutes from './modules/adminbudget/adminBudgetRoutes.js';
import adminRoutes from './modules/admindashboard/adminRoutes.js';
import authRoutes from './modules/auth/authRoutes.js';
import budgetRoutes from './modules/budget/budgetRoutes.js';

// Events routes
import updatesRoutes from './modules/events/updates/updatesRoutes.js';
import documentsRoutes from './modules/events/documents/documentsRoutes.js';
import masterDataRoutes from './modules/masterData/masterDataRoutes.js';
import budgetCatalogRoutes from './modules/budgetCatalog/budgetCatalogRoutes.js';
import editRequestRoutes from './modules/editRequest/editRequestRoutes.js';
import eventRoutes from './modules/events/events/eventRoutes.js';
import financeRoutes from './modules/events/finance/financeRoutes.js';
import preEventRoutes from './modules/events/preevents/preEventRoutes.js';
import expenditureRoutes from './modules/expenditure/expenditureRoutes.js';
import expenditureUserDashboardRoutes from './modules/expenditure/expenditureUserDashboardRoutes.js';

// Finance page
import financePageRoutes from './modules/finance/financeRoutes.js';
import formOptionsRoutes from './modules/formOptions/formOptionsRoutes.js';
import journalRoutes from './modules/journal/journalRoutes.js';
import projectRoutes from './modules/project/projectRoutes.js';
import userDashboardRoutes from './modules/userdashboard/userDashboardRoutes.js';

// Tenant metadata
import tenantRoutes from './modules/tenant/tenantRoutes.js';

// FinanceCard routes
// import financeCardRoutes from './modules/financeCard/financeCardRoutes.js';
// import guesthouseRoutes from './modules/guesthouse/guesthouseRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

/* ================= CORS ================= */

/**
 * Multi-origin CORS configuration.
 * In production, reads ALLOWED_ORIGINS (comma-separated list of URLs)
 * with a fallback to FRONTEND_URL for backward compatibility.
 * In development, allows http://localhost:3000.
 */
const buildAllowedOrigins = () => {
  if (process.env.NODE_ENV !== 'production') {
    return ['http://localhost:3000'];
  }
  if (process.env.ALLOWED_ORIGINS) {
    return process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
  }
  return process.env.FRONTEND_URL ? [process.env.FRONTEND_URL.trim()] : [];
};

const allowedOrigins = buildAllowedOrigins();

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    // Normalize trailing slashes for comparison
    const normalized = origin.replace(/\/$/, '').toLowerCase();
    const isAllowed = allowedOrigins.some(
      (allowed) => allowed.replace(/\/$/, '').toLowerCase() === normalized,
    );
    return callback(null, isAllowed || process.env.NODE_ENV !== 'production');
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Authorization'],
};

/* ================= MIDDLEWARE ================= */

app.use(cors(corsOptions));

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

/* ================= TENANT RESOLVER ================= */

// Must be applied after body parsers and before API routes.
// Sets up AsyncLocalStorage context so db queries route to the correct tenant.
app.use(tenantResolver);

/* ================= SWAGGER ================= */

if (process.env.NODE_ENV !== 'production') {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
  console.log('Swagger UI available at /api-docs');
}

/* ================= STATIC FILES ================= */

console.log('Attempting to serve static files from:', path.join(__dirname, '..', 'uploads'));

// Tenant-aware static file serving: looks for files in uploads/{tenant-slug}/
// Falls back to the flat uploads/ directory for backward compatibility.
app.use('/uploads', (req, res, next) => {
  const tenantSlug = req.tenant?.dbName || 'default';
  const tenantUploadPath = path.join(process.cwd(), 'uploads', tenantSlug);
  // Try tenant-specific path first, then fall back to root uploads
  express.static(tenantUploadPath)(req, res, () => {
    express.static(path.join(process.cwd(), 'uploads'))(req, res, next);
  });
});

/* ================= ENSURE UPLOAD DIRS ================= */

/** Upload subdirectory names shared by all tenants. */
const UPLOAD_SUBDIRS = [
  'temp',
  'sanctionOrder',
  'sanctionLetter',
  'ucAndSoE',
  'utilizationCertificate',
  'statementOfExpenditure',
  'projectReport',
  'bankStatement',
  'journal-article',
  'finance-principal-documents',
];

/**
 * Ensures the upload directory tree exists for a given tenant slug.
 * Called once at startup for the default tenant, and lazily for new tenants.
 *
 * @param {string} [tenantSlug] - Tenant database name / slug. If omitted,
 *   creates the flat root uploads/ structure for backward compatibility.
 */
export const ensureUploadDirectories = (tenantSlug) => {
  const base = tenantSlug
    ? path.join(process.cwd(), 'uploads', tenantSlug)
    : path.join(process.cwd(), 'uploads');

  const dirs = [base, ...UPLOAD_SUBDIRS.map((sub) => path.join(base, sub))];

  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

// Create default upload directories at startup (backward compatible)
ensureUploadDirectories();

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

// FinanceCard API
// app.use('/api/finance-dashboard', financeCardRoutes);
// app.use('/api/guesthouse', guesthouseRoutes);

// Updates & documents
app.use('/api/updates', updatesRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/access-control', accessControlRoutes);
app.use('/api/master-data', masterDataRoutes);
app.use('/api/budget-catalog', budgetCatalogRoutes);
app.use('/api/account-options', accountOptionsRoutes);

// Tenant metadata (public, no auth)
app.use('/api/tenant', tenantRoutes);

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

export const startServer = (port = process.env.PORT || 5000) =>
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log('- /api/finance-cards (FinanceCard API)');
    console.log('- /api-docs (Swagger API docs)');
  });

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer();
}

export default app;
