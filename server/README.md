# Aurademic Server

A Node.js and Express-based REST API for managing academic research data, including journals, projects, events, and user authentication.

## 🚀 Tech Stack

| Technology     | Purpose                         |
| -------------- | ------------------------------- |
| **Node.js**    | JavaScript runtime              |
| **Express.js** | Web framework                   |
| **MySQL**      | Relational database             |
| **mysql2**     | MySQL driver                    |
| **JWT**        | Authentication tokens           |
| **Multer**     | File upload handling            |
| **Swagger**    | API documentation               |
| **CORS**       | Cross-origin resource sharing   |
| **dotenv**     | Environment variable management |

## 📁 Directory Structure

```
server/
├── config/               # Configuration files
│   ├── connection.js     # Main database connection
│   ├── connection.js # Events database connection
│   ├── env.js            # Environment loader
│   └── swagger.js        # Swagger configuration
├── docs/                 # API documentation
├── middleware/           # Express middleware
│   ├── authMiddleware.js # JWT authentication
│   ├── errorMiddleware.js # Error handling
│   └── uploadMiddleware.js # File upload handling
├── modules/              # Feature modules
│   ├── admindashboard/   # Admin dashboard routes & logic
│   ├── auth/             # Authentication (Google OAuth, JWT)
│   ├── editRequest/      # Edit request management
│   ├── events/           # Event management
│   │   ├── events/       # Core event routes
│   │   ├── preevents/    # Pre-event routes
│   │   ├── finance/      # Event finance routes
│   │   ├── documents/    # Event documents routes
│   │   └── updates/      # Event updates routes
│   ├── formOptions/      # Form dropdown options
│   ├── journal/          # Journal management
│   ├── project/          # Project management
│   └── userdashboard/    # User dashboard routes
├── schema/               # Database schema files
│   ├── README.md         # Schema documentation guide
│   ├── dump/             # Full database backups (use for setup)
│   ├── migrations/       # Incremental schema changes
│   └── legacy/           # Old individual schema files (reference)
├── uploads/              # File storage directory
├── server.js             # Application entry point
├── web.config            # IIS configuration (for Azure)
└── package.json          # Dependencies & scripts
```

## 🛠️ Getting Started

### Prerequisites

- **Node.js** >= 18.x
- **npm** >= 9.x
- **MySQL** >= 8.0

### Installation

```bash
# Navigate to the server directory
cd server

# Install dependencies
npm install
```

### Environment Variables

Create a `.env.development` file with the following variables:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name

# Authentication
JWT_SECRET=your_jwt_secret
GOOGLE_CLIENT_ID=your_google_client_id₹

# Frontend
FRONTEND_URL=http://localhost:3000
```

### Database Setup

```bash
# 1. Create database
mysql -u your_user -p -e "CREATE DATABASE your_db_name;"

# 2. Load the schema (no rows — see schema/README.md)
mysql -u your_user -p your_db_name < schema/structure.sql

# 3. Apply every migration dated after it, in date order
mysql -u your_user -p your_db_name < schema/migrations/YYYYMMDD_description.sql

# 4. Seed enough rows to log in
mysql -u your_user -p your_db_name < schema/developer_seed.sql
```

> 📖 See `schema/README.md` for detailed documentation on migrations and best practices.

### Running the Application

#### Development Mode (with hot reload)

```bash
npm run dev
```

This will start the server with `nodemon` for automatic restarts on file changes.

#### Production Mode

```bash
npm start
```

The server will run on `http://localhost:5000` (or the port specified in `.env`).

## 📜 Available Scripts

| Script        | Description                            |
| ------------- | -------------------------------------- |
| `npm run dev` | Start server with nodemon (hot reload) |
| `npm start`   | Start server in production mode        |
| `npm test`    | Run the Vitest test suite              |

## 📡 API Endpoints

### Authentication

| Method | Endpoint            | Description        |
| ------ | ------------------- | ------------------ |
| POST   | `/api/auth/google`  | Google OAuth login |
| POST   | `/api/auth/refresh` | Refresh JWT token  |

### Admin Dashboard

| Method | Endpoint       | Description            |
| ------ | -------------- | ---------------------- |
| GET    | `/api/admin/*` | Admin dashboard routes |

### User Dashboard

| Method | Endpoint           | Description           |
| ------ | ------------------ | --------------------- |
| GET    | `/api/dashboard/*` | User dashboard routes |

### Journals

| Method | Endpoint           | Description        |
| ------ | ------------------ | ------------------ |
| GET    | `/api/journal`     | Get all journals   |
| GET    | `/api/journal/:id` | Get journal by ID  |
| POST   | `/api/journal`     | Create new journal |
| PUT    | `/api/journal/:id` | Update journal     |
| DELETE | `/api/journal/:id` | Delete journal     |

### Projects

| Method | Endpoint           | Description        |
| ------ | ------------------ | ------------------ |
| GET    | `/api/project`     | Get all projects   |
| GET    | `/api/project/:id` | Get project by ID  |
| POST   | `/api/project`     | Create new project |
| PUT    | `/api/project/:id` | Update project     |
| DELETE | `/api/project/:id` | Delete project     |

### Events

| Method | Endpoint            | Description          |
| ------ | ------------------- | -------------------- |
| GET    | `/api/events/*`     | Event management     |
| GET    | `/api/pre-events/*` | Pre-event management |
| GET    | `/api/finance/*`    | Event finance        |
| GET    | `/api/updates/*`    | Event updates        |
| GET    | `/api/documents/*`  | Event documents      |

### Edit Requests

| Method         | Endpoint               | Description             |
| -------------- | ---------------------- | ----------------------- |
| GET/POST/PATCH | `/api/edit-requests/*` | Edit request management |

### Form Options

| Method | Endpoint              | Description          |
| ------ | --------------------- | -------------------- |
| GET    | `/api/form-options/*` | Get dropdown options |

## 📚 API Documentation (Swagger)

In development mode, Swagger UI is available at:

```
http://localhost:5000/api-docs
```

## 🔐 Authentication

The server uses **JWT (JSON Web Tokens)** for authentication:

1. Users authenticate via Google OAuth
2. Server validates the Google token using `google-auth-library`
3. Server issues a JWT token for subsequent requests
4. Protected routes use `authMiddleware.js` to validate tokens

### Protected Routes

Add the auth middleware to protect routes:

```javascript
import { authMiddleware } from '../middleware/authMiddleware.js';

router.get('/protected', authMiddleware, (req, res) => {
  // req.user contains the authenticated user
});
```

## 📤 File Uploads

File uploads are handled by **Multer** with configurable storage:

### Upload Directories

- `/uploads/journal-article` - Journal article PDFs
- `/uploads/sanctionOrder` - Project sanction orders
- `/uploads/sanctionLetter` - Project sanction letters
- `/uploads/ucAndSoE` - Utilization certificates
- `/uploads/projectReport` - Project reports
- `/uploads/bankStatement` - Bank statements

### File Access

Uploaded files are served statically at:

```
http://localhost:5000/uploads/<directory>/<filename>
```

## 🗄️ Database Schema

```
schema/
├── dump/          → Full database backups (use for new developer setup)
├── migrations/    → Incremental changes (new columns, tables, etc.)
└── legacy/        → Original schema files (reference only)
```

> 📖 See `schema/README.md` for complete documentation on migrations and best practices.

## 📦 Dependencies

### Production Dependencies

- `express` - Web framework
- `mysql2` - MySQL driver with Promise support
- `jsonwebtoken` - JWT generation and verification
- `google-auth-library` - Google OAuth verification
- `multer` - File upload handling
- `cors` - Cross-origin requests
- `body-parser` - Request body parsing
- `dotenv` - Environment variables
- `swagger-ui-express` & `swagger-jsdoc` - API documentation

### Dev Dependencies

- `nodemon` - Development server with hot reload

## 🤝 Contributing

1. Create a new branch for your feature
2. Follow ES Module syntax (`import`/`export`)
3. Add Swagger documentation for new endpoints
4. Test your changes locally
5. Submit a pull request with a detailed description
