// auth utilities

const TOKEN_KEY = 'token';
const USER_ID_KEY = 'user_id';
const USER_NAME_KEY = 'user_name';

function deriveDisplayName(raw?: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw.trim();
  if (!cleaned) return null;
  const atIndex = cleaned.indexOf('@');
  return atIndex > 0 ? cleaned.slice(0, atIndex) : cleaned;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUserId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(USER_ID_KEY);
}

export function getUserName(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(USER_NAME_KEY);
}

function extractEmailFromToken(token: string | null): string | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(atob(parts[1]));
    if (typeof payload?.email === 'string') return payload.email;
    if (typeof payload?.user_metadata?.email === 'string') return payload.user_metadata.email;
  } catch {
    return null;
  }
  return null;
}

export function setAuth(token: string, userId: string, userEmail?: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_ID_KEY, userId);
  const displayName = deriveDisplayName(userEmail) || deriveDisplayName(extractEmailFromToken(token));
  if (displayName) {
    localStorage.setItem(USER_NAME_KEY, displayName);
  }
}

export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem(USER_NAME_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken() && !!getUserId();
}

// Try to derive and cache display name from existing token if missing
export function ensureDisplayName(): string | null {
  if (typeof window === 'undefined') return null;
  const cached = getUserName();
  if (cached) return cached;
  const token = getToken();
  const email = extractEmailFromToken(token);
  const name = deriveDisplayName(email);
  if (name) {
    localStorage.setItem(USER_NAME_KEY, name);
    return name;
  }
  return null;
}

export function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

// handle error auth (401/403) - hapus token dan redirect ke login
export function handleAuthError(status: number, router?: { push: (url: string) => void }): boolean {
  if (status === 401 || status === 403) {
    clearAuth();
    if (router) {
      router.push('/login');
    } else if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return true;
  }
  return false;
}

// cek auth dan redirect ke login jika belum login
export function requireAuth(router: { push: (url: string) => void }): boolean {
  const token = getToken();
  const userId = getUserId();
  
  if (!token || !userId) {
    router.push('/login');
    return false;
  }
  return true;
}
