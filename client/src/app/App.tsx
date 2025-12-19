import 'bootstrap/dist/css/bootstrap.min.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from '../features/home/home';
import Login from '../features/auth/login/login';
import EventPage from '../features/events/components/EventPage';

import Journalform from '../features/journals/journalform';
import Projectform from '../features/projects/projectform';
import Dashboard from '../features/admin/admindashboard';
import JournalManagement from '../features/admin/formManagement/JournalFormOptions';
import UserDashboard from '../features/user-dashboard/userdashboard';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from '../contexts/AuthContext';
import { ProtectedRoute, AdminRoute } from '../shared/components/ProtectedRoute';
import { MsalProvider } from '../shared/components/MsalProvider';
import ProjectFormOptions from '../features/admin/formManagement/ProjectFormOptions';
import EventDashboard from '../features/events/components/EventDashboard';
import EventEntry from '../features/events/components/EventEntry';
import PublicationsPage from '../features/publications/pages/PublicationsPage';
import ProjectsPage from '../features/publications/pages/ProjectsPage';
import Storybook from '../features/storybook/Storybook';

function App() {
  return (
    <MsalProvider>
      <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID || ''}>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/events"
                element={
                  <ProtectedRoute>
                    <EventDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/event/:eventId"
                element={
                  <ProtectedRoute>
                    <EventPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/home"
                element={
                  <ProtectedRoute>
                    <Home />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/project"
                element={
                  <ProtectedRoute>
                    <Projectform />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/project/:id"
                element={
                  <ProtectedRoute>
                    <Projectform />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <UserDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/journal"
                element={
                  <ProtectedRoute>
                    <Journalform />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/journal/conference"
                element={
                  <ProtectedRoute>
                    <Journalform />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/journal/book"
                element={
                  <ProtectedRoute>
                    <Journalform />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/journal/book-chapter"
                element={
                  <ProtectedRoute>
                    <Journalform />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/journal/:journalId"
                element={
                  <ProtectedRoute>
                    <Journalform />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/publications"
                element={
                  <ProtectedRoute>
                    <PublicationsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/projects"
                element={
                  <ProtectedRoute>
                    <ProjectsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin-dashboard"
                element={
                  <AdminRoute>
                    <Dashboard />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/journals"
                element={
                  <AdminRoute>
                    {' '}
                    <JournalManagement />{' '}
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/form-management/project-options"
                element={
                  <AdminRoute>
                    <ProjectFormOptions />
                  </AdminRoute>
                }
              />
              <Route path="/" element={<Navigate to="/home" />} />
              <Route
                path="/eventdashboard"
                element={
                  <ProtectedRoute>
                    <EventDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/event-entry"
                element={
                  <ProtectedRoute>
                    <EventEntry />
                  </ProtectedRoute>
                }
              />
              <Route path="/storybook" element={<Storybook />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </GoogleOAuthProvider>
    </MsalProvider>
  );
}

export default App;
