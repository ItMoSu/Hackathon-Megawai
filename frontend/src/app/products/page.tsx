"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import Navbar from '@/components/ui/Navbar';
import { Package, Plus, TrendingUp, TrendingDown, Minus, PackageOpen, BarChart3, List, ChevronRight, Sparkles, Trash2, ChevronLeft } from "lucide-react";
import { API_URL } from "@/lib/api";
import { getToken, getUserId, clearAuth, getAuthHeaders, handleAuthError, requireAuth } from "@/lib/auth";
import { sanitizeProductName, sanitizeNumber } from "@/lib/sanitize";
import { logger } from "@/lib/logger";

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

type ViewMode = 'grid' | 'ranking';

const ITEMS_PER_PAGE = 10;

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<ProductWithAnalytics[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('ranking');
  const [currentPage, setCurrentPage] = useState(1);
  
  const [name, setName] = useState('');
  const [unit, setUnit] = useState(''); 
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Pagination logic
  const totalPages = Math.ceil(products.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentProducts = products.slice(startIndex, endIndex);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      if (!requireAuth(router)) return;
      
      const res = await fetch(`${API_URL}/api/products/ranking`, {
        headers: getAuthHeaders()
      });

      if (handleAuthError(res.status, router)) return;

      if (!res.ok) {
        // Check if response is HTML (404 page)
        const contentType = res.headers.get('content-type');
        if (contentType?.includes('text/html')) {
          throw new Error(`Route tidak ditemukan (404). Backend mungkin perlu restart.`);
        }
        const errorText = await res.text();
        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(errorJson.error || `HTTP ${res.status}`);
        } catch {
          throw new Error(`HTTP ${res.status}: ${errorText.substring(0, 100)}`);
        }
      }

      const data = await res.json();
      if (data.success) {
        setProducts(data.data || []);
      }
    } catch (err) {
      logger.error('Fetch products error:', err);
      // Fallback to regular endpoint
      try {
        const res = await fetch(`${API_URL}/api/products`, {
          headers: getAuthHeaders()
        });
        const data = await res.json();
        if (data.success) {
          setProducts((data.data || []).map((p: any) => ({
            ...p,
            analytics: null,
            sparkline: [],
            totalSales7d: 0
          })));
        }
      } catch (e) {
        logger.error('Fallback fetch error:', e);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Validation regex patterns
  const PRODUCT_NAME_REGEX = /^[a-zA-Z0-9\s\-\_\.\,]+$/;
  const PRODUCT_NAME_MIN_LENGTH = 2;
  const PRODUCT_NAME_MAX_LENGTH = 100;

  const validateProductName = (value: string): string | null => {
    const trimmed = value.trim();
    
    if (!trimmed) {
      return "Nama produk tidak boleh kosong";
    }
    
    if (trimmed.length < PRODUCT_NAME_MIN_LENGTH) {
      return `Nama produk minimal ${PRODUCT_NAME_MIN_LENGTH} karakter`;
    }
    
    if (trimmed.length > PRODUCT_NAME_MAX_LENGTH) {
      return `Nama produk maksimal ${PRODUCT_NAME_MAX_LENGTH} karakter`;
    }
    
    if (!PRODUCT_NAME_REGEX.test(trimmed)) {
      return "Nama produk hanya boleh huruf, angka, spasi, dan tanda (-_.,)";
    }
    
    return null;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate product name with regex
    const nameError = validateProductName(name);
    if (nameError) {
      setError(nameError);
      return;
    }

    if (!unit) {
      setError("Silakan pilih satuan unit");
      return;
    }

    // Validate price
    const priceError = validatePrice(price);
    if (priceError) {
      setError(priceError);
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
          name: sanitizedName,
          unit: unit,
          price: price ? sanitizeNumber(price) : null
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
        setProducts(prev => [{
          ...result.data,
          analytics: null,
          sparkline: [],
          totalSales7d: 0
        }, ...prev]);
      }

      setName('');
      setUnit(''); 
      setPrice('');
      
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (productId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId(productId);
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId(null);
  };

  const handleConfirmDelete = async (productId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(productId);
    setError('');
    
    const previousProducts = [...products];
    setProducts(prev => prev.filter(p => p.id !== productId));
    
    try {
      if (!requireAuth(router)) {
        setProducts(previousProducts);
        return;
      }

      const res = await fetch(`${API_URL}/api/products/${productId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (handleAuthError(res.status, router)) {
        setProducts(previousProducts);
        return;
      }

      if (!res.ok) {
        setProducts(previousProducts); // Rollback on error
        const contentType = res.headers.get('content-type');
        if (contentType?.includes('text/html')) {
          throw new Error('Route tidak ditemukan (404). Backend mungkin perlu restart.');
        }
        const errorText = await res.text();
        let errorMessage = `HTTP ${res.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorMessage;
        } catch {
          errorMessage = errorText.substring(0, 100);
        }
        setError(errorMessage);
        return;
      }

      const result = await res.json();
      
      if (!result.success) {
        setProducts(previousProducts); // Rollback on error
        setError(result.error || 'Gagal menghapus produk');
      }
      // Success - UI sudah terupdate
    } catch (err: any) {
      logger.error('Delete error:', err);
      setProducts(previousProducts);
      setError(`Gagal menghapus: ${err.message || 'Network error'}`);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const getMomentumIcon = (label: string | undefined) => {
    if (!label) return <Minus className="w-4 h-4 text-gray-400" />;
    
    switch (label) {
      case 'TRENDING_UP':
      case 'GROWING':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'FALLING':
      case 'DECLINING':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  const getMomentumBadge = (label: string | undefined, momentum: number | undefined) => {
    if (!label) return null;
    
    const pct = ((momentum || 0) * 100).toFixed(1);
    
    switch (label) {
      case 'TRENDING_UP':
        return <Badge className="bg-green-100 text-green-700 border-green-200">📈 +{pct}%</Badge>;
      case 'GROWING':
        return <Badge className="bg-emerald-50 text-emerald-600 border-emerald-200">↗ +{pct}%</Badge>;
      case 'FALLING':
        return <Badge className="bg-red-100 text-red-700 border-red-200">📉 {pct}%</Badge>;
      case 'DECLINING':
        return <Badge className="bg-orange-100 text-orange-700 border-orange-200">↘ {pct}%</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-600 border-gray-200">➡️ Stabil</Badge>;
    }
  };

  const getBurstBadge = (level: string | undefined) => {
    if (!level || level === 'NORMAL') return null;
    
    switch (level) {
      case 'CRITICAL':
        return <Badge className="bg-red-500 text-white animate-pulse">🔥 VIRAL</Badge>;
      case 'HIGH':
        return <Badge className="bg-orange-500 text-white">⚡ Burst</Badge>;
      case 'MEDIUM':
        return <Badge className="bg-yellow-100 text-yellow-700">📊 Naik</Badge>;
      default:
        return null;
    }
  };

  const formatRupiah = (num: number | null) => {
    if (!num) return '-';
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num);
  };

  // Mini sparkline component
  const Sparkline = ({ data }: { data: number[] }) => {
    if (!data || data.length === 0) return <span className="text-gray-400 text-xs">No data</span>;
    
    const max = Math.max(...data, 1);
    const width = 60;
    const height = 20;
    const points = data.map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - (v / max) * height;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg width={width} height={height} className="inline-block">
        <polyline
          fill="none"
          stroke="#DC2626"
          strokeWidth="1.5"
          points={points}
        />
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 text-slate-900 selection:bg-red-600 selection:text-white">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">Manajemen Produk</h1>
              <p className="text-sm text-gray-500 mt-1">
                Kelola katalog, lihat performa & ranking produk.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* View Toggle */}
              <div className="flex bg-white rounded-lg border border-gray-200 p-1 shadow-sm">
                <button
                  onClick={() => setViewMode('ranking')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
                    viewMode === 'ranking' 
                      ? 'bg-red-600 text-white shadow-sm' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Ranking
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
                    viewMode === 'grid' 
                      ? 'bg-red-600 text-white shadow-sm' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <List className="w-4 h-4" />
                  Grid
                </button>
              </div>
              <Badge variant="outline" className="px-4 py-2 text-sm font-medium bg-white shadow-sm border-gray-200">
                <Package className="w-4 h-4 mr-2 text-red-600" />
                Total: <span className="ml-1 font-bold text-gray-900">{products.length} Item</span>
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
            {/* Form Add Product */}
            <div className="lg:col-span-3">
              <Card className="sticky top-8 border-t-4 border-t-red-600 shadow-md">
                <CardHeader>
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Plus className="w-5 h-5 text-red-600" />
                    Tambah Produk Baru
                  </h2>
                  <p className="text-sm text-gray-500">Daftarkan menu jualanmu di sini.</p>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-5">
                    {error && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                        ⚠️ {error}
                      </div>
                    )}
                    <Input 
                      label="Nama Produk" 
                      placeholder="Contoh: Ayam Bakar Madu"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="focus:ring-red-500"
                    />
                    <Select 
                      label="Satuan (Unit)" 
                      options={UNIT_OPTIONS}
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                    />
                    <Input 
                      label="Harga (Optional)" 
                      placeholder="Contoh: 25000"
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="focus:ring-red-500"
                    />
                    <Button 
                      type="submit" 
                      className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 shadow-sm transition-all" 
                      isLoading={isSubmitting}
                    >
                      + Simpan Produk
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Products List */}
            <div className="lg:col-span-9">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-lg border border-gray-200">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mb-4"></div>
                  <p className="text-gray-500 text-sm">Sedang memuat data katalog...</p>
                </div>
              ) : products.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50/50 p-12 text-center">
                  <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                    <PackageOpen className="h-10 w-10 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Belum ada produk</h3>
                  <p className="text-sm text-gray-500 max-w-sm mt-1 mb-6">
                    Katalogmu masih kosong. Mulai tambahkan produk pertamamu.
                  </p>
                </div>
              ) : viewMode === 'ranking' ? (
                /* RANKING VIEW */
                <Card className="overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-red-50 to-orange-50 border-b">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-red-600" />
                        <h3 className="font-bold text-gray-900">Product Ranking</h3>
                      </div>
                      <div className="flex items-center gap-2 sm:ml-auto">
                        <Badge variant="secondary" className="text-xs">
                          Halaman {currentPage}/{totalPages || 1}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {products.length} produk
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <div className="divide-y divide-gray-100">
                    {currentProducts.map((product, index) => (
                      <div 
                        key={product.id} 
                        className="p-4 hover:bg-gray-50 transition-colors cursor-pointer group"
                        onClick={() => router.push(`/products/${product.id}`)}
                      >
                        <div className="flex items-center gap-3 sm:gap-4">
                          {/* Rank Number */}
                          <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-sm sm:text-lg flex-shrink-0 ${
                            startIndex + index === 0 ? 'bg-yellow-100 text-yellow-700' :
                            startIndex + index === 1 ? 'bg-gray-200 text-gray-700' :
                            startIndex + index === 2 ? 'bg-orange-100 text-orange-700' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                            {startIndex + index + 1}
                          </div>

                          {/* Product Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-1">
                              <h4 className="font-bold text-gray-900 truncate group-hover:text-red-600 transition-colors text-sm sm:text-base">
                                {product.name}
                              </h4>
                              {getBurstBadge(product.analytics?.burst_level)}
                            </div>
                            <div className="flex flex-wrap items-center gap-1 sm:gap-3 text-xs sm:text-sm text-gray-500">
                              <span>{formatRupiah(product.price)}/{product.unit}</span>
                              <span className="hidden sm:inline">•</span>
                              <span className="font-medium text-gray-700">
                                {product.totalSales7d} terjual
                              </span>
                            </div>
                          </div>

                          {/* Sparkline - hidden on mobile */}
                          <div className="hidden md:block">
                            <Sparkline data={product.sparkline} />
                          </div>

                          {/* Momentum Badge - simplified on mobile */}
                          <div className="hidden sm:flex items-center gap-2">
                            {getMomentumIcon(product.analytics?.momentum_label)}
                            {getMomentumBadge(product.analytics?.momentum_label, product.analytics?.momentum_combined)}
                          </div>
                          <div className="flex sm:hidden items-center">
                            {getMomentumIcon(product.analytics?.momentum_label)}
                          </div>

                          {/* Delete Button */}
                          {confirmDeleteId === product.id ? (
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              {deletingId === product.id ? (
                                <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <>
                                  <button
                                    onClick={(e) => handleConfirmDelete(product.id, e)}
                                    className="px-2 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
                                  >
                                    Hapus
                                  </button>
                                  <button
                                    onClick={handleCancelDelete}
                                    className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                                  >
                                    Batal
                                  </button>
                                </>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={(e) => handleDeleteClick(product.id, e)}
                              className="p-1.5 sm:p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors sm:opacity-0 group-hover:opacity-100"
                              title="Hapus produk"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}

                          {/* Arrow */}
                          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-red-600 transition-colors flex-shrink-0" />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span className="hidden sm:inline">Sebelumnya</span>
                      </button>
                      
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter(page => {
                            // Show first, last, and pages around current
                            return page === 1 || 
                                   page === totalPages || 
                                   Math.abs(page - currentPage) <= 1;
                          })
                          .map((page, idx, arr) => (
                            <React.Fragment key={page}>
                              {idx > 0 && arr[idx - 1] !== page - 1 && (
                                <span className="px-1 text-gray-400">...</span>
                              )}
                              <button
                                onClick={() => setCurrentPage(page)}
                                className={`w-8 h-8 text-sm font-medium rounded-lg transition-colors ${
                                  currentPage === page 
                                    ? 'bg-red-600 text-white' 
                                    : 'bg-white border hover:bg-gray-50'
                                }`}
                              >
                                {page}
                              </button>
                            </React.Fragment>
                          ))
                        }
                      </div>
                      
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                      >
                        <span className="hidden sm:inline">Selanjutnya</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </Card>
              ) : (
                /* GRID VIEW */
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs">
                      Halaman {currentPage}/{totalPages || 1} • {products.length} produk
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {currentProducts.map((product) => (
                    <Card 
                      key={product.id} 
                      className="group relative overflow-hidden transition-all duration-200 hover:shadow-md hover:border-red-200 cursor-pointer bg-white"
                      onClick={() => router.push(`/products/${product.id}`)}
                    >
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gray-200 group-hover:bg-red-500 transition-colors" />
                      
                      <CardContent className="p-5 pl-7">
                        <div className="flex justify-between items-start mb-3">
                          <div className="space-y-1">
                            <h3 className="font-bold text-gray-800 group-hover:text-red-700 transition-colors line-clamp-1">
                              {product.name}
                            </h3>
                            <p className="text-sm text-gray-500">
                              {formatRupiah(product.price)} / {product.unit}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {getBurstBadge(product.analytics?.burst_level)}
                            {confirmDeleteId === product.id ? (
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                {deletingId === product.id ? (
                                  <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <>
                                    <button
                                      onClick={(e) => handleConfirmDelete(product.id, e)}
                                      className="px-2 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
                                    >
                                      Hapus
                                    </button>
                                    <button
                                      onClick={handleCancelDelete}
                                      className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                                    >
                                      Batal
                                    </button>
                                  </>
                                )}
                              </div>
                            ) : (
                              <button
                                onClick={(e) => handleDeleteClick(product.id, e)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                title="Hapus produk"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getMomentumIcon(product.analytics?.momentum_label)}
                            <span className="text-sm text-gray-600">
                              {product.totalSales7d} sold (7d)
                            </span>
                          </div>
                          {getMomentumBadge(product.analytics?.momentum_label, product.analytics?.momentum_combined)}
                        </div>

                        {product.sparkline.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <Sparkline data={product.sparkline} />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  </div>

                  {/* Pagination Controls for Grid */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-6">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg border bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Prev
                      </button>
                      
                      <span className="px-4 py-2 text-sm text-gray-600">
                        {currentPage} / {totalPages}
                      </span>
                      
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg border bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                      >
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
