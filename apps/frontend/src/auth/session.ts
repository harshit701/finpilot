import type { AuthenticatedUser } from '../types/auth';

interface SessionState {
  accessToken: string | null;
  user: AuthenticatedUser | null;
}

type Listener = () => void;

let state: SessionState = { accessToken: null, user: null };
const listeners = new Set<Listener>();

export function getSession(): SessionState {
  return state;
}

export function setSession(next: Partial<SessionState>): void {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const REFRESH_TOKEN_KEY = 'finpilot.refreshToken';

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function clearRefreshToken(): void {
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function clearSession(): void {
  clearRefreshToken();
  setSession({ accessToken: null, user: null });
}
