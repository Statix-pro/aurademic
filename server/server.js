import './config/env.js';
import express from 'express';
import rateLimit from 'express-rate-limit';
import cors from 'cors';

// Existing routes
import journalRoutes from './modules/journal/journalRoutes.js';
import projectRoutes from './modules/project/projectRoutes.js';
import adminRoutes from './modules/admindashboard/adminRoutes.js';
import authRoutes from './modules/auth/authRoutes.js';
import userDashboardRoutes from './modules/userdashboard/userDashboardRoutes.js';
import formOptionsRoutes from './modules/formOptions/formOptionsRoutes.js';
import editRequestRoutes from './modules/editRequest/editRequestRoutes.js';
// Budget (NEW)
import budgetRoutes from './modules/budget/budgetRoutes.js';


// Events
import eventRoutes from './modules/events/events/eventRoutes.js';
import preEventRoutes from './modules/events/preevents/preEventRoutes.js';
import financeRoutes from './modules/events/finance/financeRoutes.js';
import updatesRoutes from './modules/events/updates/updatesRoutes.js';
import documentsRoutes from './modules/events/documents/documentsRoutes.js';
import accessControlRoutes from './modules/accessControl/accessControlRoutes.js';

// Finance page (existing)
import financePageRoutes from './modules/finance/financeRoutes.js';

// ✅ NEW: FinanceCard routes
// import financeCardRoutes from './modules/financeCard/financeCardRoutes.js';
// import guesthouseRoutes from './modules/guesthouse/guesthouseRoutes.js';

import { errorHandler } from './middleware/errorMiddleware.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import swaggerUi from 'swagger-ui-express';
import specs from './config/swagger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

/* ================= CORS ================= */

const corsOptions = {
  origin:
    process.env.NODE_ENV === 'production'
      ? process.env.FRONTEND_URL
      : ['http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Authorization'],
};

/* ================= MIDDLEWARE ================= */

app.use(cors(corsOptions));

// Global Rate Limiter: 3000 requests per 15 minutes
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3000,
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

/* ================= SWAGGER ================= */

if (process.env.NODE_ENV !== 'production') {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
  console.log('Swagger UI available at /api-docs');
}

/* ================= STATIC FILES ================= */

console.log(
  'Attempting to serve static files from:',
  path.join(__dirname, '..', 'uploads')
);

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

// ✅ NEW: Budget routes
app.use('/api/budget', budgetRoutes);

// ✅ NEW: FinanceCard API
// app.use('/api/finance-dashboard', financeCardRoutes);
// app.use('/api/guesthouse', guesthouseRoutes);

// Updates & documents
app.use('/api/updates', updatesRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/access-control', accessControlRoutes);

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

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log('- /api/finance-cards (FinanceCard API)');
  console.log('- /api-docs (Swagger API docs)');
});
