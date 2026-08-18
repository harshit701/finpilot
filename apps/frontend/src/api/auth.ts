import { apiFetch } from './client';
import type { AuthenticatedUser } from '../types/auth';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export function registerUser(input: RegisterInput) {
  return apiFetch<{ message: string }>('/auth/register', {
    method: 'POST',
    auth: false,
    body: JSON.stringify(input),
  });
}

export function loginUser(input: LoginInput) {
  return apiFetch<AuthTokens>('/auth/login', {
    method: 'POST',
    auth: false,
    body: JSON.stringify(input),
  });
}

export function refreshTokens(refresh_token: string) {
  return apiFetch<AuthTokens>('/auth/refresh', {
    method: 'POST',
    auth: false,
    skipRefresh: true,
    body: JSON.stringify({ refresh_token }),
  });
}

export function fetchMe() {
  return apiFetch<{ user: AuthenticatedUser }>('/auth/me');
}

export function logoutUser() {
  return apiFetch<{ message: string }>('/auth/logout', { method: 'POST' });
}
