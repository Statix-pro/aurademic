import React, { useState, useEffect } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useLocation } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import authenticityUtility from '../utility/authenticityUtility';
import { loginRequest } from '../config/authConfig';
import { useAuth } from '../context/AuthContext';
import './login.css';

const Login = () => {
  // --- Logic from existing code ---
  const location = useLocation();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [, setDebugInfo] = useState(null);
  const { setUser } = useAuth();
  const { instance } = useMsal();

  // --- UI State for design ---
  const [typedText, setTypedText] = useState('');
  const fullText = 'Welcome to KSRCT';
  // Added state for form inputs to make them controlled, even if not sent to backend yet
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // --- Effects ---

  // 1. Auth Check (from existing code)
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

  // 2. Typing animation
  useEffect(() => {
    let index = 0;
    // Reset text first to ensure animation plays on re-renders if needed
    setTypedText('');
    const interval = setInterval(() => {
      setTypedText(fullText.slice(0, index + 1));
      index++;
      if (index === fullText.length) {
        clearInterval(interval);
        // Remove cursor after typing is complete
        setTimeout(() => {
          const element = document.querySelector('.typing-text .cursor');
          if (element) element.style.display = 'none';
        }, 500);
      }
    }, 70); // Adjusted speed slightly for better feel
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Auth Handlers (from existing code) ---

  const handleGoogleSuccess = async (credentialResponse) => {
    setIsLoading(true);
    setError('');
    setDebugInfo(null);

    try {
      if (!credentialResponse?.credential) {
        throw new Error('No credentials received from Google');
      }

      const response = await authenticityUtility.post('/auth/google', {
        credential: credentialResponse.credential,
      });

      if (
        !response?.token ||
        !response?.user ||
        typeof response.user !== 'object'
      ) {
        console.error('Invalid server response:', response);
        throw new Error('Invalid server response - missing token or user data');
      }

      localStorage.setItem('token', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));

      setUser(response.user);
      window.location.replace('/publications');
    } catch (error) {
      console.error('Login error:', error);
      setError(
        error.response?.data?.details ||
          error.message ||
          'Authentication failed.'
      );
      setDebugInfo({
        timestamp: new Date().toISOString(),
        errorDetails: error.toString(),
        responseData: error.response?.data,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleError = (error) => {
    console.error('Google Login Error:', error);
    setError('Failed to connect with Google. Please try again.');
  };

  const handleMicrosoftLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await instance.loginPopup(loginRequest);

      if (response && response.account) {
        const user = {
          id: response.account.localAccountId,
          email: response.account.username,
          name: response.account.name,
          picture: null, // Microsoft graph photo requires extra fetch calls
          is_admin: false, // Defaulting, adjust based on your logic
        };

        localStorage.setItem('user', JSON.stringify(user));
        if (response.accessToken) {
          localStorage.setItem('token', response.accessToken);
        }

        setUser(user);
        window.location.replace('/publications');
      }
    } catch (error) {
      console.error('Microsoft login failed:', error);
      setError('Failed to connect with Microsoft. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Standard form submit handler (currently just prevents default)
  const handleFormSubmit = (e) => {
    e.preventDefault();
    setError('Username/Password login is not configured yet.');
  };

  // --- JSX Implementation (Design structure + Functional integration) ---
  return (
    <div className="login-body">
      {/* Top-right company logo */}
      {/* <img
        className="company-logo"
        src="https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Google_Workspace_Logo.svg/512px-Google_Workspace_Logo.svg.png"
        alt="Company Logo"
      /> */}

      <div className="login-wrapper">
        {/* Left Panel */}
        <div className="left-panel">
          <div className="left-panel-content">
            <img
              src={require('../components/images/ksrct_logo.png')}
              alt="KSRCT Logo"
              className="college-logo"
            />
            <h2>K.S.RANGASAMY COLLEGE OF TECHNOLOGY</h2>
            <h4>(Autonomous)</h4>

            <div className="college-website-left">
              <a
                href="https://www.ksrct.ac.in"
                target="_blank"
                rel="noopener noreferrer"
              >
                www.ksrct.ac.in
              </a>
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="right-panel">
          <div className="right-panel-content">
            <h3 className="typing-text">
              {typedText}
              <span className="cursor">|</span>
            </h3>

            {/* Error message display */}
            {error && <div className="login-error-msg">{error}</div>}
            {isLoading && (
              <div className="login-loading-msg">Authenticating...</div>
            )}

            <form onSubmit={handleFormSubmit}>
              <div className="input-group">
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  // required // removed required to allow testing social buttons easily
                />
              </div>
              <div className="input-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  // required
                />
              </div>
              <button type="submit" className="login-btn" disabled={isLoading}>
                Login
              </button>

              <div className="forgot-password">
                {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                <a href="#">Forgot Password?</a>
              </div>

              <div className="or-divider">
                <span>or continue with</span>
              </div>

              <div className="social-login">
                {/* Google Login Integration */}
                {/* We wrap the official Google button to fit the layout */}
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

                {/* Microsoft Login Integration */}
                {/* Using the custom design div but adding the onClick handler */}
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
