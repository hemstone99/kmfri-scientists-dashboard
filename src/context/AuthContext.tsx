import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import { BootstrapData } from '../types.ts';

export interface AuthenticatedIdentity {
  uid: string;
  email: string | null;
  displayName?: string | null;
}

interface AuthContextValue {
  firebaseUser: AuthenticatedIdentity | null;
  authLoading: boolean;
  dataLoading: boolean;
  error: string | null;
  data: BootstrapData | null;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  resetScientistPassword: (
    email: string,
    verificationIdentifier: string,
    newPassword: string
  ) => Promise<string>;
  logout: () => Promise<void>;
  refreshData: () => Promise<void>;
  apiFetch: <T = any>(path: string, options?: RequestInit) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(
  /\/$/,
  ''
);
const resolveApiUrl = (path: string) =>
  path.startsWith('http') ? path : `${API_BASE_URL}${path}`;

const STORAGE_TOKEN_KEY = 'kmfri_session_token';
const STORAGE_USER_KEY = 'kmfri_session_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [sessionUser, setSessionUser] = useState<AuthenticatedIdentity | null>(
    null
  );
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BootstrapData | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = window.localStorage.getItem('kmfri_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {
      // ignore
    }
    return 'light';
  });

  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      window.localStorage.setItem('kmfri_theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const clearStoredSession = useCallback(() => {
    tokenRef.current = null;
    setSessionUser(null);
    setData(null);
    try {
      window.localStorage.removeItem(STORAGE_TOKEN_KEY);
      window.localStorage.removeItem(STORAGE_USER_KEY);
    } catch {
      // ignore
    }
  }, []);

  const apiFetch = useCallback(
    async <T = any>(path: string, options: RequestInit = {}): Promise<T> => {
      const token = tokenRef.current;

      if (!token) {
        throw new Error('Authentication session required.');
      }

      const headers = new Headers(options.headers || {});
      headers.set('Authorization', `Bearer ${token}`);
      if (!headers.has('Content-Type') && options.body) {
        headers.set('Content-Type', 'application/json');
      }

      const response = await fetch(resolveApiUrl(path), {
        ...options,
        headers,
      });

      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) {
        clearStoredSession();
      }
      if (!response.ok) {
        throw new Error(
          payload.error || `Request failed with status ${response.status}`
        );
      }
      return payload as T;
    },
    [clearStoredSession]
  );

  const refreshData = useCallback(async () => {
    if (!tokenRef.current) return;
    setDataLoading(true);
    setError(null);
    try {
      const bootstrap = await apiFetch<BootstrapData>('/api/bootstrap');
      setData(bootstrap);
    } catch (err: any) {
      console.error('Failed to load bootstrap data:', err);
      setError(err.message || 'Unable to synchronize with KMFRI database.');
    } finally {
      setDataLoading(false);
    }
  }, [apiFetch]);

  // Restore saved session on mount
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const savedToken = window.localStorage.getItem(STORAGE_TOKEN_KEY);
        const savedUserRaw = window.localStorage.getItem(STORAGE_USER_KEY);
        if (savedToken && savedToken.startsWith('kmfri.') && savedUserRaw) {
          const parsedUser = JSON.parse(savedUserRaw) as AuthenticatedIdentity;
          tokenRef.current = savedToken;
          if (active) {
            setSessionUser(parsedUser);
            setAuthLoading(false);
          }
          await refreshData();
          return;
        }
      } catch {
        clearStoredSession();
      }
      if (active) {
        setAuthLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [refreshData, clearStoredSession]);

  const signInWithEmail = async (email: string, password: string) => {
    setError(null);
    setDataLoading(true);
    try {
      const res = await fetch(resolveApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          payload.error || 'Invalid email or password credentials.'
        );
      }
      tokenRef.current = payload.token;
      setSessionUser(payload.user);
      try {
        window.localStorage.setItem(STORAGE_TOKEN_KEY, payload.token);
        window.localStorage.setItem(
          STORAGE_USER_KEY,
          JSON.stringify(payload.user)
        );
      } catch {
        // ignore storage errors
      }
      await refreshData();
    } catch (err: any) {
      setError(err.message || 'Sign-in failed.');
      throw err;
    } finally {
      setDataLoading(false);
    }
  };

  const resetScientistPassword = async (
    email: string,
    verificationIdentifier: string,
    newPassword: string
  ): Promise<string> => {
    setError(null);
    const res = await fetch(resolveApiUrl('/api/auth/reset-password'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, verificationIdentifier, newPassword }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        payload.error || 'Unable to reset password. Check your details.';
      setError(msg);
      throw new Error(msg);
    }
    return (
      payload.message ||
      'Password reset successful. You can now sign in with your new password.'
    );
  };

  const logout = async () => {
    clearStoredSession();
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser: sessionUser,
        authLoading,
        dataLoading,
        error,
        data,
        theme,
        toggleTheme,
        signInWithEmail,
        resetScientistPassword,
        logout,
        refreshData,
        apiFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
