import { useMsal } from '@azure/msal-react';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import React, { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { useLocation } from 'react-router-dom';

import { loginRequest } from '../../../config/authConfig';
import { useAuth } from '../../../contexts/AuthContext';
import authenticityUtility from '../../../shared/utils/authenticityUtility';
import { User } from '../../../types/index';
import './login.css';
import KSRCTLogo from '../../../shared/assets/images/ksrct_logo.png';

interface AuthResponse {
  token: string;
  user: User;
}

const Login: React.FC = () => {
  const location = useLocation();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [, setDebugInfo] = useState<unknown>(null);
  const { setUser } = useAuth();
  const { instance } = useMsal();

  const [typedText, setTypedText] = useState('');
  const fullText = 'Welcome to KSRCT';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('token');
      if (token && location.pathname === '/login') {
        window.location.replace('/publications');
      }
    };
    const timeoutId = setTimeout(checkAuth, 100);
    return () => clearTimeout(timeoutId);
  }, [location.pathname]);

  useEffect(() => {
    let index = 0;
    setTypedText('');
    const interval = setInterval(() => {
      setTypedText(fullText.slice(0, index + 1));
      index++;
      if (index === fullText.length) {
        clearInterval(interval);
        setTimeout(() => {
          const element = document.querySelector('.typing-text .cursor') as HTMLElement;
          if (element) element.style.display = 'none';
        }, 500);
      }
    }, 70);
    return () => clearInterval(interval);
  }, []);

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    setIsLoading(true);
    setError('');
    setDebugInfo(null);

    try {
      if (!credentialResponse?.credential) {
        throw new Error('No credentials received from Google');
      }

      const response = (await authenticityUtility.post('/auth/google', {
        credential: credentialResponse.credential,
      })) as AuthResponse;

      if (!response?.token || !response?.user || typeof response.user !== 'object') {
        console.error('Invalid server response:', response);
        throw new Error('Invalid server response - missing token or user data');
      }

      localStorage.setItem('token', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));

      setUser(response.user);
      window.location.replace('/publications');
    } catch (err: unknown) {
      console.error('Login error:', err);
      const error = err as { response?: { data?: { details?: string } }; message?: string };
      setError(error.response?.data?.details || error.message || 'Authentication failed.');
      setDebugInfo({
        timestamp: new Date().toISOString(),
        errorDetails: String(err),
        responseData: error.response?.data,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleError = () => {
    console.error('Google Login Error');
    setError('Failed to connect with Google. Please try again.');
  };

  const handleMicrosoftLogin = async () => {
    setIsLoading(true);
    setError('');
    setDebugInfo(null);

    try {
      const msalResponse = await instance.loginPopup(loginRequest);

      if (!msalResponse?.accessToken) {
        throw new Error('No access token received from Microsoft');
      }

      const response = (await authenticityUtility.post('/auth/microsoft', {
        accessToken: msalResponse.accessToken,
      })) as AuthResponse;

      if (!response?.token || !response?.user || typeof response.user !== 'object') {
        console.error('Invalid server response:', response);
        throw new Error('Invalid server response - missing token or user data');
      }

      localStorage.setItem('token', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));

      setUser(response.user);
      window.location.replace('/publications');
    } catch (err: unknown) {
      console.error('Microsoft login failed:', err);
      const error = err as { response?: { data?: { details?: string } }; message?: string };
      setError(
        error.response?.data?.details ||
          error.message ||
          'Failed to connect with Microsoft. Please try again.',
      );
      setDebugInfo({
        timestamp: new Date().toISOString(),
        errorDetails: String(err),
        responseData: error.response?.data,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('Username/Password login is not configured yet.');
  };

  return (
    <div className="login-body">
      <div className="login-wrapper">
        <div className="left-panel">
          <div className="left-panel-content">
            <img src={KSRCTLogo} alt="KSRCT Logo" className="college-logo" />
            <h2>K.S.RANGASAMY COLLEGE OF TECHNOLOGY</h2>
            <h4>(Autonomous)</h4>

            <div className="college-website-left">
              <a href="https://www.ksrct.ac.in" target="_blank" rel="noopener noreferrer">
                www.ksrct.ac.in
              </a>
            </div>
          </div>
        </div>

        <div className="right-panel">
          <div className="right-panel-content">
            <h3 className="typing-text">
              {typedText}
              <span className="cursor">|</span>
            </h3>

            {error && <div className="login-error-msg">{error}</div>}
            {isLoading && <div className="login-loading-msg">Authenticating...</div>}

            <form onSubmit={handleFormSubmit}>
              <div className="input-group">
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                />
              </div>
              <button type="submit" className="login-btn" disabled={isLoading}>
                Login
              </button>

              <div className="forgot-password">
                <a href="#">Forgot Password?</a>
              </div>

              <div className="or-divider">
                <span>or continue with</span>
              </div>

              <div className="social-login">
                <div className="google-btn-wrapper">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={handleGoogleError}
                    theme="outline"
                    size="large"
                    width="100%"
                    text="signin_with"
                    shape="rectangular"
                  />
                </div>

                <button
                  type="button"
                  className="social-btn microsoft-btn"
                  onClick={handleMicrosoftLogin}
                  disabled={isLoading}
                >
                  <img
                    src="data:image/svg+xml;utf8,<svg width='20' height='20' xmlns='http://www.w3.org/2000/svg'><rect width='9' height='9' x='1' y='1' fill='%23F25022'/><rect width='9' height='9' x='10' y='1' fill='%2372B5F8'/><rect width='9' height='9' x='1' y='10' fill='%237BCC2F'/><rect width='9' height='9' x='10' y='10' fill='%23FFD500'/></svg>"
                    alt="Microsoft"
                  />
                  <span>Microsoft</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
