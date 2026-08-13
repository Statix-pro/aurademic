import { GoogleOAuthProvider } from '@react-oauth/google';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { GOOGLE_CLIENT_ID } from './config/api';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { EventsProvider } from './contexts/EventsContext';
import { ProfileProvider } from './contexts/ProfileContext';
import AuthPage from './features/auth/AuthPage';
import CertificatesPage from './features/certificates/CertificatesPage';
import EventRegistrationPage from './features/events/EventRegistrationPage';
import FeedbackPage from './features/feedback/FeedbackPage';
import HomePage from './features/home/HomePage';
import RegistrationsPage from './features/my-registrations/RegistrationsPage';
import PaymentPage from './features/payment/PaymentPage';
import ProfilePage from './features/profile/ProfilePage';
import AccommodationPage from './features/registration/Accommodation';
import RegistrationPage from './features/registration/RegistrationPage';
import AppLayout from './shared/components/AppLayout';

import type { ReactNode } from 'react';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, initializing } = useAuth();

  // Without this, a page refresh bounces a signed-in user to /login while the
  // stored token is still being revalidated.
  if (initializing) {
    return <div className="app-booting">Loading…</div>;
  }

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
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
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
    </GoogleOAuthProvider>
  );
}
