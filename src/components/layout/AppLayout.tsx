import { Outlet, Navigate, NavLink, useLocation } from 'react-router-dom'
import Header from './Header'
import { useAuth } from '../../hooks/useAuth'
import { Home, User, ClipboardList } from 'lucide-react'

const NAV_ITEMS = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/profile', label: 'My Profile', icon: User },
  { to: '/registrations', label: 'My Registrations', icon: ClipboardList },
]

const HEADER_HEIGHT = 48
const RAIL_WIDTH = 64

export default function AppLayout() {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) return <Navigate to="/login" replace />
  if (location.pathname === '/') return <Navigate to="/home" replace />

  return (
    <div className="min-h-screen overflow-hidden bg-[#eaf2fb] dark:bg-slate-900">
      <Header />

      <main
        className="min-h-screen overflow-auto bg-[#eaf2fb] dark:bg-slate-900"
        style={{ paddingLeft: 0, paddingTop: HEADER_HEIGHT }}
      >
        <Outlet />
      </main>
    </div>
  )
}
