// Centralized auth utilities untuk menghindari redundant localStorage calls

const TOKEN_KEY = 'token';
const USER_ID_KEY = 'user_id';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUserId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(USER_ID_KEY);
}

export function setAuth(token: string, userId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_ID_KEY, userId);
}

export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_ID_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken() && !!getUserId();
}

export function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

/**
 * Handle authentication errors (401/403) - clear auth and redirect to landing page
 * Returns true if it was an auth error and handled
 */
export function handleAuthError(status: number, router?: { push: (url: string) => void }): boolean {
  if (status === 401 || status === 403) {
    clearAuth();
    if (router) {
      router.push('/');
    } else if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
    return true;
  }
  return false;
}

/**
 * Check auth and redirect to landing if not authenticated
 * Use this at the start of protected pages
 */
export function requireAuth(router: { push: (url: string) => void }): boolean {
  const token = getToken();
  const userId = getUserId();
  
  if (!token || !userId) {
    router.push('/');
    return false;
  }
  return true;
}
