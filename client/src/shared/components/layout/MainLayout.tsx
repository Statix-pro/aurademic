import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import Sidebar from './navbar/navbar';
import { useAuth } from '../../../contexts/AuthContext';
import KSRCTLogo from '../../assets/images/ksrct_logo.png';
import './MainLayout.css';

const getNameInitial = (name?: string): string => {
  if (!name) return 'U';
  const salutations = ['dr.', 'mr.', 'mrs.', 'ms.', 'prof.', 'er.'];
  const parts = name.trim().split(/\s+/);
  const firstWord = parts[0].toLowerCase();
  if (salutations.includes(firstWord) && parts.length > 1) {
    return parts[1].charAt(0).toUpperCase();
  }
  return parts[0].charAt(0).toUpperCase();
};

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(true);
  const { user } = useAuth();
  const location = useLocation();

  const isPreviewMode = new URLSearchParams(location.search).get('preview') === 'true';

  if (isPreviewMode) {
    return (
      <main className="guesthouse-print-preview-layout" style={{ width: '100%', height: '100vh', overflowY: 'auto', background: '#fff' }}>
        <Outlet />
      </main>
    );
  }

  const userInitial = getNameInitial(user?.name);

  return (
    <div className="app-layout">
      {/* Top Bar */}
      <header className="topbar">
        <div className="topbar-left">
          <button
            className="topbar-toggle"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? 'Expand menu' : 'Collapse menu'}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <img src={KSRCTLogo} alt="KSRCT" className="topbar-logo" />
          <span className="topbar-title">K.S.RANGASAMY COLLEGE OF TECHNOLOGY</span>
        </div>
        <div className="topbar-right">
          <span className="topbar-welcome">
            Welcome, <strong>{user?.name || 'User'}</strong>
          </span>
          <div className="topbar-avatar">{userInitial}</div>
        </div>
      </header>

      {/* Sidebar */}
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />

      {/* Overlay backdrop */}
      <div
        className={`sidebar-overlay ${!collapsed ? 'visible' : ''}`}
        onClick={() => setCollapsed(true)}
      />

      {/* Main Content */}
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;
