import { clearSession, getRefreshToken, getSession, setRefreshToken, setSession } from '../auth/session';

const API_BASE = '/api/v1';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface RequestOptions extends RequestInit {
  /** Attach the access token as a Bearer header. Defaults to true. */
  auth?: boolean;
  /** Skip the 401 refresh-and-retry cycle (used by the refresh call itself). */
  skipRefresh?: boolean;
}

async function extractErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(', ');
    if (typeof body.message === 'string') return body.message;
  } catch {
    // response body wasn't JSON; fall through to the generic message
  }
  return `Request failed with status ${res.status}`;
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  // De-dupe concurrent 401s into a single refresh call so parallel requests
  // don't each rotate the refresh token and invalidate one another.
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (!res.ok) {
          clearSession();
          return null;
        }
        const data = (await res.json()) as { accessToken: string; refreshToken: string };
        setRefreshToken(data.refreshToken);
        setSession({ accessToken: data.accessToken });
        return data.accessToken;
      } catch {
        clearSession();
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = true, skipRefresh = false, headers, ...rest } = options;

  const doFetch = async () => {
    const accessToken = getSession().accessToken;
    const finalHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      ...headers,
      ...(auth && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    };
    return fetch(`${API_BASE}${path}`, { ...rest, headers: finalHeaders });
  };

  let res = await doFetch();

  if (res.status === 401 && auth && !skipRefresh) {
    const newToken = await refreshAccessToken();
    if (newToken) res = await doFetch();
  }

  if (!res.ok) {
    throw new ApiError(res.status, await extractErrorMessage(res));
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
