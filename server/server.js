import './config/env.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import cors from 'cors';
import express from 'express';
// import rateLimit from 'express-rate-limit';

// routes
import swaggerUi from 'swagger-ui-express';

import specs from './config/swagger.js';
import { errorHandler } from './middleware/errorMiddleware.js';
import { PARTICIPANT_UPLOAD_DIRS } from './middleware/participantUploadMiddleware.js';
import accessControlRoutes from './modules/accessControl/accessControlRoutes.js';
import accountOptionsRoutes from './modules/accountOptions/accountOptionsRoutes.js';
import adminBudgetRoutes from './modules/adminbudget/adminBudgetRoutes.js';
import adminRoutes from './modules/admindashboard/adminRoutes.js';
import authRoutes from './modules/auth/authRoutes.js';
import budgetRoutes from './modules/budget/budgetRoutes.js';

// Events routes
import budgetCatalogRoutes from './modules/budgetCatalog/budgetCatalogRoutes.js';
import editRequestRoutes from './modules/editRequest/editRequestRoutes.js';
import documentsRoutes from './modules/events/documents/documentsRoutes.js';
import eventRoutes from './modules/events/events/eventRoutes.js';
import financeRoutes from './modules/events/finance/financeRoutes.js';
import preEventRoutes from './modules/events/preevents/preEventRoutes.js';
import publicEventsRoutes from './modules/events/public/publicEventsRoutes.js';
import updatesRoutes from './modules/events/updates/updatesRoutes.js';
import expenditureRoutes from './modules/expenditure/expenditureRoutes.js';
import expenditureUserDashboardRoutes from './modules/expenditure/expenditureUserDashboardRoutes.js';
import expenditureReportRoutes from './modules/expenditureReport/expenditureReportRoutes.js';

// Finance page
import financePageRoutes from './modules/finance/financeRoutes.js';
import formOptionsRoutes from './modules/formOptions/formOptionsRoutes.js';
import journalRoutes from './modules/journal/journalRoutes.js';
import masterDataRoutes from './modules/masterData/masterDataRoutes.js';
import participantAuthRoutes from './modules/participantAuth/participantAuthRoutes.js';
import participantRegistrationRoutes from './modules/participantRegistration/participantRegistrationRoutes.js';
import projectRoutes from './modules/project/projectRoutes.js';
import userDashboardRoutes from './modules/userdashboard/userDashboardRoutes.js';
import workorderRoutes from './modules/workorder/workorderRoutes.js';
import './modules/workorder/workorderWorkflowAdapter.js';

// FinanceCard routes
// import financeCardRoutes from './modules/financeCard/financeCardRoutes.js';
// import guesthouseRoutes from './modules/guesthouse/guesthouseRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

/* ================= CORS ================= */

// FRONTEND_URL accepts a comma-separated list so the staff portal and the event
// subdomain can both be allowed. In practice the event site is same-origin (IIS
// rewrites /api on its subdomain), so this only matters if that changes.
const allowedOrigins = (
  process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL || ''
    : 'http://localhost:3000,http://localhost:3001'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin: allowedOrigins,
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

/* ================= SWAGGER ================= */

if (process.env.NODE_ENV !== 'production') {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
  console.log('Swagger UI available at /api-docs');
}

/* ================= STATIC FILES ================= */

console.log('Attempting to serve static files from:', path.join(__dirname, '..', 'uploads'));

app.use(
  '/uploads',
  express.static(path.join(process.cwd(), 'uploads'), {
    setHeaders: (res, filePath) => {
      // Never let a browser second-guess the declared type.
      res.setHeader('X-Content-Type-Options', 'nosniff');

      // Participant uploads come from the public internet. Forcing a download on
      // navigation means that even if a disallowed type ever reaches disk, it
      // cannot execute as a document on this origin — which is shared with the
      // staff portal. Subresource loads (<img src>) ignore this header, so the
      // staff UI still renders participant photos and proofs inline.
      const dir = path.basename(path.dirname(filePath));

      if (PARTICIPANT_UPLOAD_DIRS.has(dir)) {
        res.setHeader('Content-Disposition', 'attachment');
      }
    },
  }),
);

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

/* --- Public endpoints (no authentication) ---
   These must be mounted before `app.use('/api', journalRoutes)` below: that
   router applies authMiddleware to everything under /api, so anything mounted
   after it would demand a staff token. */

app.use('/api/auth', authRoutes);
// Public event participants sign in here (any Google account, not just @ksrct.ac.in).
app.use('/api/participant-auth', participantAuthRoutes);
// What the participant-facing event site reads.
app.use('/api/events/public', publicEventsRoutes);
// Participant-owned writes (registrations, profile, payments). Authenticated by
// participantAuthMiddleware inside the router, not by authMiddleware.
app.use('/api/participant', participantRegistrationRoutes);
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
app.use('/api/workorders', workorderRoutes);

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
