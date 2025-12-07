"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import Navbar from '@/components/ui/Navbar';
import { 
  Plus, 
  Package, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Zap,
  RefreshCcw,
  Loader2,
  Eye,
  X
} from 'lucide-react';

const UNIT_OPTIONS = [
  { value: 'pcs', label: 'Pcs' },
  { value: 'porsi', label: 'Porsi' },
  { value: 'cup', label: 'Cup' },
  { value: 'botol', label: 'Botol' },
  { value: 'bungkus', label: 'Bungkus' },
  { value: 'kg', label: 'Kg' },
  { value: 'box', label: 'Box' },
];

interface ProductWithAnalytics {
  id: string;
  name: string;
  unit: string;
  price?: number;
  momentum?: { combined: number; status: string };
  burst?: { score: number; level: string };
  avgQuantity?: number;
}

type ViewMode = 'grid' | 'ranking';

const ITEMS_PER_PAGE = 10;

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [price, setPrice] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Pagination logic
  const totalPages = Math.ceil(products.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentProducts = products.slice(startIndex, endIndex);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('user_id');

      if (!token || !userId) {
        router.push('/login');
        return;
      }
      
      const res = await fetch(`http://localhost:5000/api/products?user_id=${userId}`, {
        headers: getAuthHeaders() 
      });

      if (res.status === 401) {
        localStorage.removeItem('token'); 
        router.push('/login'); 
        return;
      }

      const data = await res.json();
      if (data.success) {
        setProducts(data.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const res = await fetch('http://localhost:5000/api/analytics/ranking', {
        headers: getAuthHeaders()
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.rankings) {
          setProducts(prev => prev.map(p => {
            const analytics = data.rankings.find((r: any) => r.productId === p.id);
            if (analytics) {
              return {
                ...p,
                momentum: analytics.momentum,
                burst: analytics.burst,
                avgQuantity: analytics.avgQuantity
              };
            }
            return p;
          }));
        }
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const validatePrice = (value: string): string | null => {
    if (!value) return null; // Price is optional
    
    const numPrice = parseFloat(value);
    
    if (isNaN(numPrice)) {
      return "Harga harus berupa angka";
    }
    
    if (numPrice < 0) {
      return "Harga tidak boleh negatif";
    }
    
    if (numPrice > 999999999) {
      return "Harga terlalu besar";
    }
    
    return null;
  };

  useEffect(() => {
    if (products.length > 0) {
      fetchAnalytics();
    }
  }, [products.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError("Nama produk wajib diisi");
      return;
    }

    setIsSubmitting(true);
    try {
      const userId = getUserId(); 
      const sanitizedName = sanitizeProductName(name);

      const res = await fetch(`${API_URL}/api/products`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          user_id: userId,
          name: name.trim(),
          unit: unit,
          price: price ? parseFloat(price) : null
        })
      });

      const result = await res.json();

      if (!res.ok) {
        if (result.error?.includes('sudah ada') || result.error?.includes('already exist')) {
          setError(`Produk "${name.trim()}" sudah ada! Gunakan nama lain.`);
        } else {
          setError(result.error || "Gagal menyimpan");
        }
        return;
      }

      // Optimistic update - langsung tambah ke UI
      if (result.data) {
        addProduct({
          ...result.data,
          analytics: null,
          sparkline: [],
          totalSales7d: 0
        });
      }

      setName('');
      setUnit('pcs');
      setPrice('');
      setShowForm(false);
      fetchProducts();
      
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status?: string) => {
    if (!status) return null;
    
    const config: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
      'TRENDING_UP': { color: 'bg-green-100 text-green-700', icon: <TrendingUp className="w-3 h-3" />, text: 'Trending' },
      'GROWING': { color: 'bg-emerald-100 text-emerald-700', icon: <TrendingUp className="w-3 h-3" />, text: 'Growing' },
      'STABLE': { color: 'bg-gray-100 text-gray-600', icon: <Minus className="w-3 h-3" />, text: 'Stable' },
      'DECLINING': { color: 'bg-orange-100 text-orange-700', icon: <TrendingDown className="w-3 h-3" />, text: 'Declining' },
      'FALLING': { color: 'bg-red-100 text-red-700', icon: <TrendingDown className="w-3 h-3" />, text: 'Falling' },
    };

    const cfg = config[status] || config['STABLE'];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
        {cfg.icon}
        {cfg.text}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Manajemen Produk</h1>
            <p className="text-gray-500 mt-1">Kelola semua produk Anda</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline">{products.length} Produk</Badge>
            <Button 
              variant="outline"
              size="sm"
              onClick={() => { fetchProducts(); fetchAnalytics(); }}
            >
              <RefreshCcw className={`w-4 h-4 mr-2 ${loadingAnalytics ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setShowForm(!showForm)}>
              <Plus className="w-4 h-4 mr-2" />
              Tambah
            </Button>
          </div>
        </div>

        {/* Add Product Form */}
        {showForm && (
          <Card className="mb-8 border-2 border-dashed border-red-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <h2 className="text-lg font-semibold">Tambah Produk Baru</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Input 
                    label="Nama Produk *" 
                    placeholder="Contoh: Nasi Goreng"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <Select 
                    label="Satuan" 
                    options={UNIT_OPTIONS}
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                  />
                </div>
                <div>
                  <Input 
                    label="Harga (opsional)" 
                    type="number"
                    placeholder="15000"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button type="submit" className="w-full" isLoading={isSubmitting}>
                    Simpan
                  </Button>
                </div>
              </form>
              {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
            </CardContent>
          </Card>
        )}

        {/* Products Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-red-500" />
          </div>
        ) : products.length === 0 ? (
          <Card className="p-12 text-center">
            <Package className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Belum ada produk</h3>
            <p className="text-gray-500 mb-4">Tambahkan produk untuk mulai tracking</p>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Tambah Produk
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.map((product) => (
              <Card 
                key={product.id}
                className="hover:shadow-md transition cursor-pointer group border-l-4 border-l-red-500"
                onClick={() => router.push(`/dashboard?product=${product.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate group-hover:text-red-600 transition">
                        {product.name}
                      </h3>
                      <p className="text-xs text-gray-400 uppercase mt-0.5">{product.unit}</p>
                    </div>
                    <Eye className="w-4 h-4 text-gray-300 group-hover:text-red-500 transition flex-shrink-0 ml-2" />
                  </div>

                  {/* Status Badges */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {product.momentum?.status && getStatusBadge(product.momentum.status)}
                    {product.burst && product.burst.level !== 'NORMAL' && product.burst.score > 1.5 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-orange-500 text-white">
                        <Zap className="w-3 h-3" />
                        Burst
                      </span>
                    )}
                  </div>

                  {/* Stats */}
                  {product.momentum && (
                    <div className="pt-3 border-t border-gray-100 space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Momentum</span>
                        <span className={`font-medium ${
                          product.momentum.combined > 1 ? 'text-green-600' :
                          product.momentum.combined < 1 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {product.momentum.combined > 1 ? '+' : ''}
                          {((product.momentum.combined - 1) * 100).toFixed(0)}%
                        </span>
                      </div>
                      {product.avgQuantity !== undefined && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Avg/hari</span>
                          <span className="font-medium text-gray-700">{product.avgQuantity}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {product.price && (
                    <div className="flex items-center justify-between text-sm mt-2">
                      <span className="text-gray-500">Harga</span>
                      <span className="font-medium text-gray-700">
                        Rp {product.price.toLocaleString('id-ID')}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
