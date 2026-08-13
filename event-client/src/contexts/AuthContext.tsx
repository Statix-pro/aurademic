import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';

import { apiFetch, clearStoredToken, setStoredToken, getStoredToken } from '../config/api';
import { clearAppStorage } from '../shared/storage';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  picture: string | null;
  profileComplete: boolean;
  personalComplete: boolean;
  professionComplete: boolean;
}

interface LoginResponse {
  token: string;
  participant: AuthUser;
}

interface AuthContextType {
  user: AuthUser | null;
  /** True while an existing token is being revalidated on first load. */
  initializing: boolean;
  /** Exchanges a Google ID token for a participant session. */
  loginWithGoogle: (credential: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initializing, setInitializing] = useState(Boolean(getStoredToken()));

  // A stored token is not trusted: the server revalidates it, so a blocked or
  // deleted account cannot keep a stale session alive.
  useEffect(() => {
    if (!getStoredToken()) {
      setInitializing(false);
      return;
    }

    let cancelled = false;

    apiFetch<{ participant: AuthUser }>('/participant-auth/me')
      .then((data) => {
        if (!cancelled) setUser(data.participant);
      })
      .catch(() => {
        clearStoredToken();
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setInitializing(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const loginWithGoogle = useCallback(async (credential: string) => {
    const data = await apiFetch<LoginResponse>('/participant-auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    });

    setStoredToken(data.token);
    setUser(data.participant);
  }, []);

  const refresh = useCallback(async () => {
    if (!getStoredToken()) return;
    const data = await apiFetch<{ participant: AuthUser }>('/participant-auth/me');
    setUser(data.participant);
  }, []);

  const logout = useCallback(() => {
    clearStoredToken();
    // Wipes the cached registrations, profile and feedback too. On a shared
    // machine, signing out has to leave nothing behind for the next person.
    clearAppStorage();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, initializing, loginWithGoogle, logout, refresh }),
    [user, initializing, loginWithGoogle, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
