import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import journalRoutes from './modules/journal/journalRoutes.js';
import projectRoutes from './modules/project/projectRoutes.js';
import adminRoutes from './modules/admindashboard/adminRoutes.js';
import authRoutes from './modules/auth/authRoutes.js';
import userDashboardRoutes from './modules/userdashboard/userDashboardRoutes.js';
import formOptionsRoutes from './modules/formOptions/formOptionsRoutes.js';
import editRequestRoutes from './modules/editRequest/editRequestRoutes.js';
import eventRoutes from './modules/events/events/eventRoutes.js';
import preEventRoutes from './modules/events/preevents/preEventRoutes.js';
import financeRoutes from './modules/events/finance/financeRoutes.js';
import updatesRoutes from './modules/events/updates/updatesRoutes.js';
import documentsRoutes from './modules/events/documents/documentsRoutes.js';
import { errorHandler } from './middleware/errorMiddleware.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import swaggerUi from 'swagger-ui-express';
import specs from './config/swagger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

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

dotenv.config();

app.get('/api/debug/config', (req, res) => {
  res.json({
    googleClientIdLength: process.env.GOOGLE_CLIENT_ID?.length || 0,
    jwtSecretSet: !!process.env.JWT_SECRET,
    nodeEnv: process.env.NODE_ENV,
    frontendUrl: process.env.FRONTEND_URL,
  });
});

app.use(cors(corsOptions));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
// app.use(express.json());

if (process.env.NODE_ENV !== 'production') {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
  console.log('Swagger UI available at /api-docs');
}

// Debug middleware for all requests
// app.use((req, res, next) => {
//     console.log(`${req.method} ${req.path}`, {
//         headers: req.headers.authorization ? 'Token present' : 'No token',
//         body: req.body
//     });
//     next();
// });

// API Routes
console.log(
  'Attempting to serve static files from:',
  path.join(__dirname, '..', 'uploads')
);
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Ensure upload directories exist
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

// Call this before setting up routes
createUploadDirectories();

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', userDashboardRoutes);
app.use('/api/form-options', formOptionsRoutes); // Make sure this is before generic routes
app.use('/api', journalRoutes);
app.use('/api', projectRoutes);
// Use the edit request routes
app.use('/api', editRequestRoutes);

app.use('/api/events', eventRoutes);
app.use('/api/pre-events', preEventRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/updates', updatesRoutes);
app.use('/api/documents', documentsRoutes);

// Add 404 handler
app.use((req, res) => {
  // console.log(`404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    method: req.method,
  });
});

app.use(errorHandler);

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  // console.log('Available routes:');
  // console.log('- /api/auth/google (POST)');
  // console.log('- /api/journal/*');
  // console.log('- /api/project/*');
  // console.log('- /api/admin/*');
  console.log('- /api-docs (Swagger API docs)');
});
