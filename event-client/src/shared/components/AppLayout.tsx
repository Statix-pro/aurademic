import { Outlet, Navigate, useLocation } from 'react-router-dom';

import Header from './Header';
import './AppLayout.css';

const HEADER_HEIGHT = 48;

export default function AppLayout() {
  const location = useLocation();

  if (location.pathname === '/') return <Navigate to="/home" replace />;

  return (
    <div className="app-layout-1">
      <Header />

      <main className="app-layout-2" style={{ paddingLeft: 0, paddingTop: HEADER_HEIGHT }}>
        <Outlet />
      </main>
    </div>
  );
}
