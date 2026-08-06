import { useState, useEffect, useRef } from 'react';
import { LogOut, Globe } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useEvents } from '../../context/EventsContext';
import '../../styles/Header.css';

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuth();
  const { apiUrl, updateApiUrl, isApiOnline } = useEvents();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [tempUrl, setTempUrl] = useState(apiUrl);

  const configRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const configButtonRef = useRef<HTMLButtonElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        showConfig &&
        configRef.current &&
        !configRef.current.contains(target) &&
        configButtonRef.current &&
        !configButtonRef.current.contains(target)
      ) {
        setShowConfig(false);
      }
      if (
        showMenu &&
        menuRef.current &&
        !menuRef.current.contains(target) &&
        menuButtonRef.current &&
        !menuButtonRef.current.contains(target)
      ) {
        setShowMenu(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setShowConfig(false);
        setShowMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showConfig, showMenu]);

  useEffect(() => {
    setTempUrl(apiUrl);
  }, [apiUrl]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="header-1">
      <div className="header-2">
        <div className="header-3">
          <button onClick={() => navigate('/home')} className="header-4">
            <div className="header-5">
              <span className="header-6">K</span>
            </div>
            <span className="header-7">K.S.RANGASAMY COLLEGE OF TECHNOLOGY</span>
          </button>
        </div>

        <div className="header-8">
          {/* Connection Status Widget */}
          <div className="header-9">
            <button
              ref={configButtonRef}
              onClick={() => {
                setShowConfig(!showConfig);
                setShowMenu(false);
              }}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-all duration-200 ${
                isApiOnline
                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20 animate-pulse'
              }`}
              title="Click to configure backend IP / Port"
            >
              <span className="header-10">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isApiOnline ? 'bg-emerald-400' : 'bg-rose-400'
                  }`}
                ></span>
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isApiOnline ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                ></span>
              </span>
              <span className="header-11">
                {isApiOnline ? 'Backend Online' : 'Backend Offline'}
              </span>
            </button>

            {showConfig && (
              <div ref={configRef} className="header-12">
                <div className="header-13">
                  <h4 className="header-14">
                    <Globe className="header-15" />
                    Server Connectivity
                  </h4>
                  <p className="header-16">
                    If your friend's IP address changes, enter the new IPv4 or localhost address
                    below to reconnect.
                  </p>
                </div>
                <div className="header-17">
                  <div>
                    <label className="header-18">API Server URL:</label>
                    <input
                      type="text"
                      className="header-19"
                      value={tempUrl}
                      onChange={(e) => setTempUrl(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      placeholder="e.g. 10.40.242.123:5000"
                    />
                  </div>
                  <div className="header-20">
                    <button
                      onClick={() => {
                        updateApiUrl(tempUrl);
                        setShowConfig(false);
                      }}
                      className="header-21"
                    >
                      Connect
                    </button>
                    <button
                      onClick={() => {
                        setTempUrl(apiUrl);
                        setShowConfig(false);
                      }}
                      className="header-22"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <span className="header-23">Welcome, {user?.name || 'User'}</span>
          <button
            ref={menuButtonRef}
            onClick={() => {
              setShowMenu(!showMenu);
              setShowConfig(false);
            }}
            className="header-24"
            aria-label="Open user menu"
          >
            <span className="header-25">{(user?.name?.[0] || 'S').toUpperCase()}</span>
          </button>

          {showMenu && (
            <div ref={menuRef} className="header-26">
              <div className="header-27">
                <p className="header-28">Signed in as</p>
                <p className="header-29">{user?.email}</p>
              </div>
              <button onClick={handleLogout} className="header-30">
                <LogOut className="header-31" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
