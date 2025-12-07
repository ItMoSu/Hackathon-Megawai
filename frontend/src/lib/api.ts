// frontend/src/lib/api.ts

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Helper untuk mendapatkan token
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

// Helper untuk mendapatkan user ID
export function getUserId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('user_id');
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
  return !!getAuthToken() && !!getUserId();
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

  // Jika token expired (401), redirect ke login
  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user_id');
      // Optional: redirect to login
      // window.location.href = '/login';
    }
    console.warn("Unauthorized: Token mungkin expired atau tidak valid");
  }

  return res;
}

// API Helper Functions
export const api = {
  // Products
  getProducts: () => fetchWithAuth(`${API_BASE_URL}/api/products`),
  createProduct: (data: { name: string; unit: string; price?: number }) => 
    fetchWithAuth(`${API_BASE_URL}/api/products`, {
      method: 'POST',
      body: JSON.stringify({ ...data, user_id: getUserId() }),
    }),
  
  // Sales
  createSale: (data: { product_id: string; product_name: string; quantity: number; sale_date: string }) =>
    fetchWithAuth(`${API_BASE_URL}/api/sales`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getSales: (productId?: string) => {
    const params = new URLSearchParams();
    if (productId) params.set('product_id', productId);
    return fetchWithAuth(`${API_BASE_URL}/api/sales?${params}`);
  },

  // Analytics
  getDashboardSummary: () => fetchWithAuth(`${API_BASE_URL}/api/analytics/summary`),
  getProductRanking: (limit = 50) => fetchWithAuth(`${API_BASE_URL}/api/analytics/ranking?limit=${limit}`),
  getProductForecast: (productId: string) => fetchWithAuth(`${API_BASE_URL}/api/analytics/products/${productId}/forecast`),
  getProductInsights: (productId: string) => fetchWithAuth(`${API_BASE_URL}/api/analytics/products/${productId}/insights`),
  getTrendingProducts: () => fetchWithAuth(`${API_BASE_URL}/api/analytics/trending`),
  
  // Intelligence
  analyzeProduct: (productId: string) => fetchWithAuth(`${API_BASE_URL}/api/intelligence/analyze/${productId}`),
  
  // Reports  
  getWeeklyReport: () => fetchWithAuth(`${API_BASE_URL}/api/reports/weekly`),
};

export default api;
