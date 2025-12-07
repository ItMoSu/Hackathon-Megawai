'use client';

import { SWRConfig } from 'swr';
import { ReactNode } from 'react';
import { API_URL } from './api';
import { getAuthHeaders } from './auth';

const fetcher = async (url: string) => {
  const fullUrl = url.startsWith('http') ? url : `${API_URL}${url}`;
  const res = await fetch(fullUrl, { headers: getAuthHeaders() });
  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.');
    throw error;
  }
  const data = await res.json();
  return data.data ?? data;
};

export function SWRProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        revalidateOnFocus: false,
        revalidateIfStale: false,
        dedupingInterval: 30000,
        errorRetryCount: 2,
        keepPreviousData: true,
      }}
    >
      {children}
    </SWRConfig>
  );
}
