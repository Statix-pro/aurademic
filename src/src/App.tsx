import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ProfileProvider } from './context/ProfileContext';
import { EventsProvider } from './context/EventsContext';
import AppLayout from './components/layout/AppLayout';
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import RegistrationPage from './pages/RegistrationPage';
import EventRegistrationPage from './pages/EventRegistrationPage';
import RegistrationsPage from './pages/RegistrationsPage';
import ProfilePage from './pages/ProfilePage';
import PaymentPage from './pages/PaymentPage';
import AccommodationPage from './pages/registration/Accommodation';
import FeedbackPage from './pages/FeedbackPage';
import CertificatesPage from './pages/CertificatesPage';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function AppProviders({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const key = user ? user.email : 'guest';
  return (
    <ProfileProvider key={`profile-${key}`}>
      <EventsProvider key={`events-${key}`}>{children}</EventsProvider>
    </ProfileProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppProviders>
          <Routes>
            <Route path="/login" element={<AuthPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/home" element={<HomePage />} />
              <Route path="/event-register" element={<EventRegistrationPage />} />
              <Route path="/accommodation" element={<AccommodationPage />} />
              <Route path="/register" element={<RegistrationPage />} />
              <Route path="/payment" element={<PaymentPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/registrations" element={<RegistrationsPage />} />
              <Route path="/feedback" element={<FeedbackPage />} />
              <Route path="/certificates" element={<CertificatesPage />} />
              <Route path="/" element={<Navigate to="/home" replace />} />
            </Route>
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </AppProviders>
      </AuthProvider>
    </BrowserRouter>
  );
}
