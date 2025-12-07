// frontend/src/lib/api.ts

// API Base URL - gunakan environment variable untuk production
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Helper untuk mendapatkan token
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

// Wrapper Fetch yang otomatis menyisipkan Token
export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = getAuthToken();
  
  // Set default headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>,
  };

  // Sisipkan token jika ada
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  // Jika token expired (401), bisa tambahkan logic redirect ke login di sini
  if (res.status === 401) {
    // Opsional: window.location.href = '/login';
    console.warn("Unauthorized: Token mungkin expired atau tidak valid");
  }

  return res;
}