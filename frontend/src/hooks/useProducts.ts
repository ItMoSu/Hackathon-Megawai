import useSWR from 'swr';
import { API_URL } from '@/lib/api';
import { getAuthHeaders } from '@/lib/auth';

interface ProductWithAnalytics {
  id: string;
  name: string;
  unit: string;
  price: number | null;
  analytics: {
    momentum_combined: number;
    momentum_label: string;
    burst_score: number;
    burst_level: string;
    priority_score: number;
    priority_rank: number | null;
  } | null;
  sparkline: number[];
  totalSales7d: number;
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch');
  const data = await res.json();
  return data.data || [];
};

export function useProducts() {
  const { data, error, isLoading, mutate } = useSWR<ProductWithAnalytics[]>(
    `${API_URL}/api/products/ranking`,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 30000, // 30 seconds
      keepPreviousData: true,
    }
  );

  return {
    products: data || [],
    isLoading,
    error,
    refresh: mutate,
    // Optimistic update helpers
    addProduct: (newProduct: ProductWithAnalytics) => {
      mutate((current) => [newProduct, ...(current || [])], false);
    },
    removeProduct: (productId: string) => {
      mutate((current) => (current || []).filter(p => p.id !== productId), false);
    },
  };
}

export function useProductDetail(productId: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    productId ? `${API_URL}/api/products/${productId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 1 minute
    }
  );

  return { product: data, isLoading, error, refresh: mutate };
}
