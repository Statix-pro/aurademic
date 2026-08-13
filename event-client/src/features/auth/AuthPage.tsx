import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Github } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import './AuthPage.css';

type Mode = 'login' | 'signup' | 'forgot';

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async () => {
    setError('');
    if (!email) {
      setError('Email is required');
      return;
    }

    if (mode === 'forgot') {
      setLoading(true);
      await new Promise((r) => setTimeout(r, 1000));
      setForgotSent(true);
      setLoading(false);
      return;
    }

    if (!password) {
      setError('Password is required');
      return;
    }
    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      navigate('/register');
    } catch {
      setError('Authentication failed. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="auth-page-1">
      <div className="auth-page-2">
        {/* Logo */}
        <div className="auth-page-3">
          <div className="auth-page-4">
            <span className="auth-page-5">EP</span>
          </div>
          <h1 className="auth-page-6">EventPro</h1>
          <p className="auth-page-7">Event Management System</p>
        </div>

        {/* Card */}
        <div className="auth-page-8">
          {/* Tabs */}
          {mode !== 'forgot' && (
            <div className="auth-page-9">
              <button
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === 'login'
                    ? 'bg-white dark:bg-slate-800 text-blue-700 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Login
              </button>
              <button
                onClick={() => {
                  setMode('signup');
                  setError('');
                }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === 'signup'
                    ? 'bg-white dark:bg-slate-800 text-blue-700 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Sign Up
              </button>
            </div>
          )}

          {mode === 'forgot' && (
            <div className="auth-page-10">
              <h2 className="auth-page-11">Reset Password</h2>
              <p className="auth-page-12">Enter your email to receive reset instructions.</p>
            </div>
          )}

          {forgotSent ? (
            <div className="auth-page-13">
              <div className="auth-page-14">📧</div>
              <p className="auth-page-15">Check your inbox</p>
              <p className="auth-page-16">
                Reset link sent to <strong>{email}</strong>
              </p>
              <button
                onClick={() => {
                  setMode('login');
                  setForgotSent(false);
                }}
                className="auth-page-17"
              >
                Back to Login
              </button>
            </div>
          ) : (
            <div className="auth-page-18">
              {mode === 'signup' && (
                <div>
                  <label className="auth-page-19">Full Name</label>
                  <input
                    className="auth-page-20"
                    placeholder="Your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              )}

              <div>
                <label className="auth-page-21">Email Address</label>
                <input
                  type="email"
                  className="auth-page-22"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                />
              </div>

              {mode !== 'forgot' && (
                <div>
                  <label className="auth-page-23">Password</label>
                  <div className="auth-page-24">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      className="auth-page-25"
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(!showPwd)}
                      className="auth-page-26"
                    >
                      {showPwd ? (
                        <EyeOff className="auth-page-27" />
                      ) : (
                        <Eye className="auth-page-28" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {mode === 'signup' && (
                <div>
                  <label className="auth-page-29">Confirm Password</label>
                  <input
                    type={showPwd ? 'text' : 'password'}
                    className="auth-page-30"
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              )}

              {error && <p className="auth-page-31">{error}</p>}

              <button onClick={handleSubmit} disabled={loading} className="auth-page-32">
                {loading
                  ? 'Please wait...'
                  : mode === 'login'
                    ? 'Sign In'
                    : mode === 'signup'
                      ? 'Create Account'
                      : 'Send Reset Link'}
              </button>

              {mode === 'login' && (
                <button
                  onClick={() => {
                    setMode('forgot');
                    setError('');
                  }}
                  className="auth-page-33"
                >
                  Forgot Password?
                </button>
              )}

              {mode === 'forgot' && (
                <button
                  onClick={() => {
                    setMode('login');
                    setError('');
                  }}
                  className="auth-page-34"
                >
                  ← Back to Login
                </button>
              )}

              {/* Divider */}
              {mode !== 'forgot' && (
                <>
                  <div className="auth-page-35">
                    <div className="auth-page-36" />
                    <span className="auth-page-37">or continue with</span>
                    <div className="auth-page-38" />
                  </div>

                  {/* OAuth buttons */}
                  <div className="auth-page-39">
                    <button className="auth-page-40">
                      <svg className="auth-page-41" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      Google
                    </button>
                    <button className="auth-page-42">
                      <Github className="auth-page-43" />
                      GitHub
                    </button>
                    <button className="auth-page-44">
                      <svg className="auth-page-45" viewBox="0 0 24 24" fill="#00A4EF">
                        <path d="M0 0h11.5v11.5H0zm12.5 0H24v11.5H12.5zM0 12.5h11.5V24H0zm12.5 0H24V24H12.5z" />
                      </svg>
                      Microsoft
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <p className="auth-page-46">© 2026 EventPro · KSR College of Engineering</p>
      </div>
    </div>
  );
}
