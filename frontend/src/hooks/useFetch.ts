// Custom hook untuk fetch dengan auth, error handling, dan loading state

import { useState, useCallback } from 'react';
import { API_URL } from '@/lib/api';
import { getAuthHeaders, clearAuth } from '@/lib/auth';
import { logger } from '@/lib/logger';

type FetchState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

type FetchOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  onUnauthorized?: () => void;
};

export function useFetch<T>() {
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: false,
    error: null
  });

  const execute = useCallback(async (
    endpoint: string,
    options: FetchOptions = {}
  ): Promise<T | null> => {
    const { method = 'GET', body, onUnauthorized } = options;
    
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
      
      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        ...(body ? { body: JSON.stringify(body) } : {})
      });

      // Handle unauthorized
      if (res.status === 401 || res.status === 403) {
        clearAuth();
        onUnauthorized?.();
        throw new Error('Session habis. Silakan login ulang.');
      }

      // Handle HTML response (404 page)
      const contentType = res.headers.get('content-type');
      if (contentType?.includes('text/html')) {
        throw new Error('Route tidak ditemukan. Backend mungkin perlu restart.');
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
      }

      if (data?.success === false) {
        throw new Error(data?.error || 'Request gagal');
      }

      setState({ data: data?.data ?? data, loading: false, error: null });
      return data?.data ?? data;

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan';
      logger.error('Fetch error:', message);
      setState({ data: null, loading: false, error: message });
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return {
    ...state,
    execute,
    reset
  };
}

// Simplified version for one-off fetches
export async function fetchApi<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<{ data: T | null; error: string | null }> {
  const { method = 'GET', body, onUnauthorized } = options;

  try {
    const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
    
    const res = await fetch(url, {
      method,
      headers: getAuthHeaders(),
      ...(body ? { body: JSON.stringify(body) } : {})
    });

    if (res.status === 401 || res.status === 403) {
      clearAuth();
      onUnauthorized?.();
      return { data: null, error: 'Session habis. Silakan login ulang.' };
    }

    const contentType = res.headers.get('content-type');
    if (contentType?.includes('text/html')) {
      return { data: null, error: 'Route tidak ditemukan.' };
    }

    const data = await res.json();

    if (!res.ok || data?.success === false) {
      return { data: null, error: data?.error || `HTTP ${res.status}` };
    }

    return { data: data?.data ?? data, error: null };

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan';
    logger.error('fetchApi error:', message);
    return { data: null, error: message };
  }
}
