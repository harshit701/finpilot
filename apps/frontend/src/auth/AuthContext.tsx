import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchMe, loginUser, logoutUser, refreshTokens, registerUser, type RegisterInput } from '../api/auth';
import type { AuthenticatedUser } from '../types/auth';
import { clearSession, getRefreshToken, getSession, setRefreshToken, setSession, subscribe } from './session';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  user: AuthenticatedUser | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<string>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setLocalSession] = useState(getSession());
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => subscribe(() => setLocalSession(getSession())), []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const existingRefreshToken = getRefreshToken();
      if (!existingRefreshToken) {
        setStatus('unauthenticated');
        return;
      }
      try {
        const tokens = await refreshTokens(existingRefreshToken);
        setRefreshToken(tokens.refreshToken);
        setSession({ accessToken: tokens.accessToken });
        const { user } = await fetchMe();
        if (!cancelled) {
          setSession({ user });
          setStatus('authenticated');
        }
      } catch {
        if (!cancelled) {
          clearSession();
          setStatus('unauthenticated');
        }
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  async function login(email: string, password: string) {
    const tokens = await loginUser({ email, password });
    setRefreshToken(tokens.refreshToken);
    setSession({ accessToken: tokens.accessToken });
    const { user } = await fetchMe();
    setSession({ user });
    setStatus('authenticated');
  }

  async function register(input: RegisterInput) {
    const result = await registerUser(input);
    return result.message;
  }

  async function logout() {
    try {
      await logoutUser();
    } catch {
      // best-effort: local session is cleared regardless of API outcome
    } finally {
      clearSession();
      setStatus('unauthenticated');
    }
  }

  return (
    <AuthContext.Provider value={{ user: session.user, status, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
