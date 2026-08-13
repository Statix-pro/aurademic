import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProfileProvider } from './contexts/ProfileContext';
import { EventsProvider } from './contexts/EventsContext';
import AppLayout from './shared/components/AppLayout';
import AuthPage from './features/auth/AuthPage';
import HomePage from './features/home/HomePage';
import RegistrationPage from './features/registration/RegistrationPage';
import EventRegistrationPage from './features/events/EventRegistrationPage';
import RegistrationsPage from './features/my-registrations/RegistrationsPage';
import ProfilePage from './features/profile/ProfilePage';
import PaymentPage from './features/payment/PaymentPage';
import AccommodationPage from './features/registration/Accommodation';
import FeedbackPage from './features/feedback/FeedbackPage';
import CertificatesPage from './features/certificates/CertificatesPage';

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
