# GEMINI.md

This document provides a comprehensive overview of the research-mac project, its architecture, and instructions for development.

## Project Overview

The project is a full-stack web application designed for managing academic research, including journals and projects. It features a client-server architecture:

*   **Client:** A React-based single-page application for the user interface.
*   **Server:** A Node.js and Express-based REST API for handling business logic and data persistence.
*   **Database:** A MySQL database for storing all application data.

## Key Technologies

### Client

*   **Framework:** React
*   **Routing:** `react-router-dom`
*   **HTTP Client:** `axios`
*   **Authentication:** `@azure/msal-react`
*   **UI Components:** `react-bootstrap`, `@mui/material`

### Server

*   **Framework:** Express.js
*   **Database:** MySQL (`mysql2` driver)
*   **Authentication:** `jsonwebtoken`
*   **File Uploads:** `multer`
*   **Module System:** ES Modules

## Directory Structure

```
/
├── client/         # React client application
│   ├── src/
│   │   ├── components/ # Reusable components
│   │   ├── pages/      # Application pages
│   │   ├── App.js      # Main application component
│   │   └── index.js    # Entry point
│   └── package.json
├── server/         # Node.js server application
│   ├── config/     # Configuration files
│   ├── middleware/ # Express middleware
│   ├── modules/    # Application modules (features)
│   ├── schema/     # Database schema
│   ├── server.js   # Server entry point
│   └── package.json
└── GEMINI.md       # This file
```

## Available Scripts

### Client

*   `npm start`: Runs the app in the development mode.
*   `npm test`: Launches the test runner in the interactive watch mode.
*   `npm run build`: Builds the app for production to the `build` folder.
*   `npm run eject`: Removes the single dependency and copies all the configuration files and transitive dependencies (webpack, Babel, ESLint, etc.) right into your project.

### Server

*   `npm start`: Runs the server.
*   `npm run dev`: Runs the server in development mode with `nodemon`.

## Building and Running

### Client

To run the client application in development mode:

```bash
cd client
npm install
npm start
```

This will start the development server on `http://localhost:3000`.

To build the client application for production:

```bash
cd client
npm install
npm run build
```

The production-ready files will be generated in the `client/build` directory.

### Server

To run the server application in development mode:

```bash
cd server
npm install
npm run dev
```

This will start the server on `http://localhost:8080` (or as configured in your environment) and automatically restart it when changes are detected.

To run the server in production:

```bash
cd server
npm install
npm start
```

## API Endpoints

The server exposes the following main API endpoints:

*   `/api/auth`: Authentication routes
*   `/api/admin`: Admin dashboard routes
*   `/api/dashboard`: User dashboard routes
*   `/api/form-options`: Form options routes
*   `/api/journal`: Journal routes
*   `/api/project`: Project routes
*   `/api/events`: Event routes

## Development Conventions

*   **Database Schema:** The database schema is defined in the `server/schema` directory. Any changes to the database schema should be reflected in these SQL files.
*   **Environment Variables:** The application uses environment variables for configuration. A `.env` file should be created in both the `client` and `server` directories based on the provided `.env.example` files (if available).
*   **API Routes:** The server's API routes are organized by module in the `server/modules` directory. Each module has its own routes, controller, and model.
*   **React Components:** React components are organized in the `client/src` directory. Reusable components are placed in the `client/src/components` directory.
*   **Styling:** The project uses a combination of CSS files and UI libraries like `react-bootstrap` and `@mui/material` for styling.

## Contributing

We welcome contributions to this project. Please follow these guidelines:

*   **Branching:** Create a new branch for each feature or bug fix.
*   **Commits:** Write clear and concise commit messages.
*   **Pull Requests:** Open a pull request with a detailed description of your changes.
*   **Code Style:** Follow the existing code style and conventions.

## License

This project is licensed under the MIT License.

## Acknowledgements

This project was created by the Gemini team.

## OAuth Configuration

The project uses Microsoft and Google for OAuth. The configuration for these can be found at the a
following links:

*   **Microsoft OAuth:** [maheshwaran325](https://portal.azure.com/#view/Microsoft_AAD_UsersAndTenants/UserManagementMenuBlade/~/AllUsers)
*   **Google OAuth:** [gingfreecss325](https://console.cloud.google.com/apis/credentials?authuser=2&project=sonorous-seat-426510-q0)

## Database Schema

The database schema is defined in the `server/schema` directory. Here are the definitions for the main tables:

### `journals`

```sql
CREATE TABLE journals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,
  journal_options_id INT NOT NULL,
  quartile VARCHAR(2),
  impact_factor DECIMAL(10,3),
  cite_score DECIMAL(10,3),
  anna_university_listed BOOLEAN,
  anna_university_annexure_no VARCHAR(50),
  acknowledgement JSON,
  author_affiliation JSON,
  driven_by ENUM('faculty','student') DEFAULT 'faculty',
  date_of_submission DATE,
  status VARCHAR(50) DEFAULT 'waiting',
  volume VARCHAR(50),
  issue VARCHAR(50),
  issue_type VARCHAR(50),
  pages_from INT,
  pages_to INT,
  article_number VARCHAR(50),
  abstract TEXT,
  keywords TEXT,
  sdgs JSON,
  doi VARCHAR(255),
  credit_to VARCHAR(255),
  reference_number VARCHAR(255),
  accepted_date DATE,
  available_online_date DATE,
  file_path VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### `projects`

```sql
CREATE TABLE projects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  s_no VARCHAR(255) NOT NULL,
  proposal_id VARCHAR(255),
  project_title TEXT NOT NULL,
  project_type_id INT,
  funding_agency_id INT,
  duration_months INT,
  total_funding_sanctioned DECIMAL(15, 2),
  start_date DATE,
  end_date DATE,
  project_status_id INT,
  team_members JSON,
  publications_details JSON,
  patents_details JSON,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_type_id) REFERENCES project_types(id),
  FOREIGN KEY (funding_agency_id) REFERENCES funding_agencies(id),
  FOREIGN KEY (project_status_id) REFERENCES project_statuses(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
```
