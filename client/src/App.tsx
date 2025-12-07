import 'bootstrap/dist/css/bootstrap.min.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './home/home';
import Login from './login/login';
import EventPage from './Eventpage/components/EventPage';
import PreEvent from './Eventpage/components/PreEvent';
import FinanceSection from './Eventpage/components/FinanceSection';
import EventUpdates from './Eventpage/components/EventUpdates';
import Documents from './Eventpage/components/Documents';

import Journalform from './journalform/journalform';
import Projectform from './projectform/projectform';
import Dashboard from './admin/admindashboard';
import JournalManagement from './admin/formManagement/JournalFormOptions';
import UserDashboard from './userdashboard/userdashboard';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute';
import { MsalProvider } from './components/MsalProvider';
import ProjectFormOptions from './admin/formManagement/ProjectFormOptions';
import EventDashboard from './Eventpage/components/EventDashboard';
import EventEntry from './Eventpage/components/EventEntry';
import PublicationsPage from './pages/PublicationsPage';
import ProjectsPage from './pages/ProjectsPage';

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
              <Route path="/pre-event" element={<PreEvent />} />
              <Route path="/finance-section" element={<FinanceSection />} />
              <Route path="/event-updates" element={<EventUpdates />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/" element={<Navigate to="/home" />} />

              <Route path="/eventdashboard" element={<EventDashboard />} />
              <Route path="/event-entry" element={<EventEntry />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </GoogleOAuthProvider>
    </MsalProvider>
  );
}

export default App;
