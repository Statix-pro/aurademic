import { Outlet, Navigate, NavLink, useLocation } from 'react-router-dom'
import Header from './Header'
import { Home, User, ClipboardList } from 'lucide-react'
import '../../styles/AppLayout.css'

const NAV_ITEMS = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/profile', label: 'My Profile', icon: User },
  { to: '/registrations', label: 'My Registrations', icon: ClipboardList },
]

const HEADER_HEIGHT = 48
const RAIL_WIDTH = 64

export default function AppLayout() {
  const location = useLocation()

  if (location.pathname === '/') return <Navigate to="/home" replace />

  return (
    <div className="app-layout-1">
      <Header />

      <main
        className="app-layout-2"
        style={{ paddingLeft: 0, paddingTop: HEADER_HEIGHT }}
      >
        <Outlet />
      </main>
    </div>
  )
}
