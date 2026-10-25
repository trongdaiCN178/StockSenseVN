import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/index.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const clearSession = () => { if (active) setUser(null); };
    window.addEventListener('stocksense:unauthorized', clearSession);
    // Only a 401 means "signed out". Rate limiting (429), network or server errors are retried with
    // backoff so a valid session is not mistaken for a logged-out one.
    const loadSession = async () => {
      for (let attempt = 0; ; attempt += 1) {
        try {
          const session = await api.auth.me();
          return session?.user ?? null;
        } catch (error) {
          if (error.status === 401 || attempt >= 4) return null;
          await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
        }
      }
    };
    loadSession()
      .then((sessionUser) => { if (active) setUser(sessionUser); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; window.removeEventListener('stocksense:unauthorized', clearSession); };
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    async login(credentials) {
      const session = await api.auth.login(credentials);
      setUser(session.user);
      return session.user;
    },
    async changePassword(credentials) {
      const session = await api.auth.changePassword(credentials);
      setUser(session.user);
      return session.user;
    },
    async logout() {
      await api.auth.logout();
      setUser(null);
    },
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
