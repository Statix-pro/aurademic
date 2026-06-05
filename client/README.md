# Aurademic Client

A modern React-based single-page application for managing academic research, including journals, projects, and events.

## 🚀 Tech Stack

| Technology            | Purpose                           |
| --------------------- | --------------------------------- |
| **React 18**          | UI Framework                      |
| **TypeScript**        | Type-safe JavaScript              |
| **Vite**              | Build tool & dev server           |
| **React Router DOM**  | Client-side routing               |
| **Axios**             | HTTP client                       |
| **React Bootstrap**   | UI component library              |
| **Lucide React**      | Icon library                      |
| **MSAL React**        | Microsoft Azure AD authentication |
| **Google OAuth**      | Google authentication             |
| **FullCalendar**      | Calendar/event management         |
| **@hello-pangea/dnd** | Drag and drop functionality       |

## 📁 Directory Structure

```
client/
├── public/               # Static assets
├── src/
│   ├── app/              # App-level components (layout, routing)
│   ├── config/           # App configuration
│   ├── contexts/         # React context providers
│   ├── features/         # Feature modules
│   │   ├── admin/        # Admin dashboard
│   │   ├── auth/         # Authentication
│   │   ├── events/       # Event management
│   │   ├── home/         # Home page
│   │   ├── journals/     # Journal management
│   │   ├── projects/     # Project management
│   │   ├── publications/ # Publications management
│   │   ├── storybook/    # UI component showcase
│   │   └── user-dashboard/ # User dashboard
│   ├── shared/           # Shared components & utilities
│   ├── types/            # TypeScript type definitions
│   └── main.tsx          # Application entry point
├── .env.development      # Development environment variables
├── .env.production       # Production environment variables
├── index.html            # HTML entry point
├── package.json          # Dependencies & scripts
├── tsconfig.json         # TypeScript configuration
└── vite.config.ts        # Vite configuration
```

## 🛠️ Getting Started

### Prerequisites

- **Node.js** >= 18.x
- **npm** >= 9.x

### Installation

```bash
# Navigate to the client directory
cd client

# Install dependencies
npm install
```

### Environment Variables

Create a `.env.development` file with the following variables:

```env
VITE_API_URL=http://localhost:5000/api
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_AZURE_CLIENT_ID=your_azure_client_id
```

### Running the Application

#### Development Mode

```bash
npm run dev
```

This will start the Vite dev server at `http://localhost:3000`.

#### Production Build

```bash
npm run build
```

The production-ready files will be generated in the `dist/` directory.

#### Preview Production Build

```bash
npm run preview
```

## 📜 Available Scripts

| Script            | Description                              |
| ----------------- | ---------------------------------------- |
| `npm run dev`     | Start development server                 |
| `npm run build`   | Build for production (TypeScript + Vite) |
| `npm run preview` | Preview production build locally         |

## 🔐 Authentication

The application supports multiple authentication methods:

- **Microsoft Azure AD** - Using `@azure/msal-react`
- **Google OAuth** - Using `@react-oauth/google`

Authentication state is managed via React Context and JWT tokens stored in localStorage.

## 🔗 API Integration

The client communicates with the backend API via `authenticityUtility`, a pre-configured Axios instance that handles:

- JWT token injection in headers
- Automatic session expiry handling
- File upload support

```typescript
// Import the utility
import authenticityUtility from '@/shared/utils/authenticityUtility';

// GET request
const data = await authenticityUtility.get('/journals');

// POST request
const result = await authenticityUtility.post('/journals', { title: 'New Journal' });

// File upload
const formData = new FormData();
formData.append('file', file);
await authenticityUtility.postFile('/upload', formData);

// Get base URL (without /api)
const baseUrl = authenticityUtility.getBaseURL();
```

## 📦 Dependencies

### Production Dependencies

- `react` & `react-dom` - UI framework
- `react-router-dom` - Routing
- `axios` - HTTP client
- `@azure/msal-browser` & `@azure/msal-react` - Microsoft authentication
- `@react-oauth/google` - Google authentication
- `react-bootstrap` & `bootstrap` - UI components
- `lucide-react` - Icon library
- `@fullcalendar/*` - Calendar components
- `@hello-pangea/dnd` - Drag and drop
- `react-select` - Advanced select inputs
- `jwt-decode` - JWT token parsing
- `lodash.debounce` - Debounce utility
- `uuid` - Unique ID generation

### Dev Dependencies

- `typescript` - Type checking
- `vite` - Build tool
- `@vitejs/plugin-react` - React plugin for Vite
- `@types/*` - TypeScript type definitions

## 🤝 Contributing

1. Create a new branch for your feature
2. Make your changes following the existing code style
3. Ensure TypeScript compilation passes (`npm run build`)
4. Submit a pull request with a detailed description
