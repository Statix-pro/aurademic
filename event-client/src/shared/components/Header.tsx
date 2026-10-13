import { LogOut } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useEvents } from '../../contexts/EventsContext';
import './Header.css';

export default function Header() {
  const { user, logout } = useAuth();
  const { isApiOnline } = useEvents();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
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
        setShowMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showMenu]);

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
          {/* Backend reachability indicator. Read-only: the API host comes from
              build-time env config, never from user input. */}
          <div className="header-9">
            <span
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                isApiOnline
                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
              }`}
              role="status"
            >
              <span className="header-10">
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isApiOnline ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                ></span>
              </span>
              <span className="header-11">{isApiOnline ? 'Online' : 'Offline'}</span>
            </span>
          </div>

          <span className="header-23">Welcome, {user?.name || 'User'}</span>
          <button
            ref={menuButtonRef}
            onClick={() => setShowMenu(!showMenu)}
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
