import { useState, useEffect } from 'react'
import { LogOut, Globe } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { useEvents } from '../../context/EventsContext'

interface HeaderProps {
  onMenuClick?: () => void
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuth()
  const { apiUrl, updateApiUrl, isApiOnline } = useEvents()
  const navigate = useNavigate()
  const [showMenu, setShowMenu] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [tempUrl, setTempUrl] = useState(apiUrl)

  useEffect(() => {
    setTempUrl(apiUrl)
  }, [apiUrl])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-[48px] border-b border-[#083965] bg-[#064675] px-3 shadow-[0_1px_0_rgba(255,255,255,0.12)]">
      <div className="flex h-full items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={() => navigate('/home')}
            className="flex min-w-0 items-center gap-2 text-left"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/35 bg-white/15 shadow-sm">
              <span className="text-[10px] font-bold leading-none text-white">K</span>
            </div>
            <span className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-white sm:text-sm">
              K.S.RANGASAMY COLLEGE OF TECHNOLOGY
            </span>
          </button>
        </div>

        <div className="relative flex items-center gap-3">
          {/* Connection Status Widget */}
          <div className="relative">
            <button
              onClick={() => {
                setShowConfig(!showConfig)
                setShowMenu(false)
              }}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-all duration-200 ${
                isApiOnline
                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20 animate-pulse'
              }`}
              title="Click to configure backend IP / Port"
            >
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isApiOnline ? 'bg-emerald-400' : 'bg-rose-400'
                }`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${
                  isApiOnline ? 'bg-emerald-500' : 'bg-rose-500'
                }`}></span>
              </span>
              <span className="hidden sm:inline">
                {isApiOnline ? 'Backend Online' : 'Backend Offline'}
              </span>
            </button>

            {showConfig && (
              <div className="absolute right-0 top-[38px] z-50 w-[280px] rounded-xl border border-slate-200 bg-white p-4 shadow-xl text-slate-800">
                <div className="mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-blue-500" />
                    Server Connectivity
                  </h4>
                  <p className="mt-1 text-[11px] text-slate-400">
                    If your friend's IP address changes, enter the new IPv4 or localhost address below to reconnect.
                  </p>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      API Server URL:
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                      value={tempUrl}
                      onChange={(e) => setTempUrl(e.target.value)}
                      placeholder="e.g. 10.40.242.123:5000"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        updateApiUrl(tempUrl)
                        setShowConfig(false)
                      }}
                      className="flex-1 rounded-lg bg-blue-600 py-1.5 text-center text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
                    >
                      Connect
                    </button>
                    <button
                      onClick={() => {
                        setTempUrl(apiUrl)
                        setShowConfig(false)
                      }}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-center text-xs font-semibold hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <span className="hidden text-[11px] font-medium text-white/90 sm:block">
            Welcome, {user?.name || 'User'}
          </span>
          <button
            onClick={() => {
              setShowMenu(!showMenu)
              setShowConfig(false)
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Open user menu"
          >
            <span className="text-[10px] font-bold uppercase">
              {(user?.name?.[0] || 'S').toUpperCase()}
            </span>
          </button>

          {showMenu && (
            <div className="absolute right-0 top-[44px] z-50 min-w-[180px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
              <div className="border-b border-slate-100 px-3 py-2">
                <p className="text-xs text-slate-500">Signed in as</p>
                <p className="truncate text-sm font-medium text-slate-700">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
