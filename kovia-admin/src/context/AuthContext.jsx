import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getCurrentAdmin, loginAdmin, logoutAdmin } from '../lib/admin/auth';

const AuthContext = createContext(null);

function isUnauthorized(error) {
  return Number(error?.status || 0) === 401;
}

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const refreshSession = useCallback(async () => {
    setStatus('loading');
    setErrorMessage('');

    try {
      const currentUser = await getCurrentAdmin();
      setUser(currentUser);
      setStatus('authenticated');
      return currentUser;
    } catch (error) {
      if (isUnauthorized(error)) {
        setUser(null);
        setStatus('unauthenticated');
        return null;
      }

      setUser(null);
      setStatus('error');
      setErrorMessage(error?.message || 'No se pudo validar la sesión actual.');
      return null;
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const signIn = useCallback(async (credentials) => {
    setErrorMessage('');
    await loginAdmin(credentials);
    return refreshSession();
  }, [refreshSession]);

  const signOut = useCallback(async () => {
    try {
      await logoutAdmin();
    } catch {
      // Nothing to do. Session cleanup still continues client-side.
    }

    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const value = useMemo(() => ({
    status,
    user,
    errorMessage,
    refreshSession,
    signIn,
    signOut,
  }), [status, user, errorMessage, refreshSession, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }

  return context;
}
