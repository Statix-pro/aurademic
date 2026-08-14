import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { GOOGLE_CLIENT_ID } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';
import './AuthPage.css';

export default function AuthPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleGoogleSuccess = async (response: CredentialResponse) => {
    setError('');

    if (!response.credential) {
      setError('Google did not return a credential. Please try again.');
      return;
    }

    setLoading(true);

    try {
      await loginWithGoogle(response.credential);
      navigate('/home', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-1">
      <div className="auth-page-2">
        <div className="auth-page-3">
          <div className="auth-page-4">
            <span className="auth-page-5">EP</span>
          </div>
          <h1 className="auth-page-6">EventPro</h1>
          <p className="auth-page-7">Event Management System</p>
        </div>

        <div className="auth-page-8">
          <div className="auth-page-10">
            <h2 className="auth-page-11">Sign in to continue</h2>
            <p className="auth-page-12">Use any Google account to browse events and register.</p>
          </div>

          {error && (
            <p className="auth-page-error" role="alert">
              {error}
            </p>
          )}

          <div className="auth-page-google">
            {GOOGLE_CLIENT_ID ? (
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Could not connect to Google. Please try again.')}
                width="320"
              />
            ) : (
              <p className="auth-page-12">
                Google sign-in is not configured. Set <code>VITE_GOOGLE_CLIENT_ID</code> in the
                environment file.
              </p>
            )}
          </div>

          {loading && <p className="auth-page-12">Signing you in…</p>}

          <p className="auth-page-note">
            By continuing you agree to your name and email being shared with the event organisers.
          </p>
        </div>
      </div>
    </div>
  );
}
