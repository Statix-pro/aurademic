import React, { createContext, useContext, useState } from 'react'

interface AuthUser { email: string; name: string }
interface AuthContextType {
  user: AuthUser | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem('ep_auth')
      return stored ? JSON.parse(stored) : null
    } catch { return null }
  })

  const login = async (email: string, _password: string) => {
    await new Promise(r => setTimeout(r, 600))
    const u = { email, name: email.split('@')[0] }
    setUser(u)
    localStorage.setItem('ep_auth', JSON.stringify(u))
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('ep_auth')
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
