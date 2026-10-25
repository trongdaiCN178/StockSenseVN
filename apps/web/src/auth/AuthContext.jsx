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
    api.auth.me()
      .then((session) => { if (active) setUser(session?.user ?? null); })
      .catch(() => { if (active) setUser(null); })
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
