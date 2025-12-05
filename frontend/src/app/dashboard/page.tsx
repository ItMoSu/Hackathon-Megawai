"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { IntelligenceDashboard } from "@/components/IntelligenceDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import Navbar from '@/components/ui/Navbar';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  AlertTriangle, 
  TrendingUp,
  Package,
  DollarSign,
  ShoppingCart,
  RefreshCcw,
  Loader2,
  Crown,
  Zap,
  ChevronRight
} from "lucide-react";

type DashboardSummary = {
  today: {
    total_quantity: number;
    total_revenue: number;
    sales_count: number;
  };
  changes: {
    quantity_change: number;
    revenue_change: number;
  };
  burst_alerts: Array<{
    product_id: string;
    product_name: string;
    burst_score: number;
    burst_level: string;
  }>;
  top_products: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
  }>;
};

type Product = { id: string; name: string; unit?: string };

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  useEffect(() => {
    const productParam = searchParams.get('product');
    if (productParam) {
      setSelectedId(productParam);
    }
  }, [searchParams]);

  const getAuthHeaders = () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    };
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/products", {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setProducts(data.data || []);
        if (!selectedId && data.data?.length > 0 && !searchParams.get('product')) {
          setSelectedId(data.data[0].id);
        }
      }
    } catch (err) {
      console.error("Gagal load produk:", err);
    }
  };

  const fetchSummary = async () => {
    setLoadingSummary(true);
    try {
      const res = await fetch("http://localhost:5000/api/analytics/summary", {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setSummary(data.summary);
      }
    } catch (err) {
      console.error("Gagal load summary:", err);
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchSummary();
    const interval = setInterval(fetchSummary, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleProductSelect = (productId: string) => {
    setSelectedId(productId);
    const url = new URL(window.location.href);
    url.searchParams.set('product', productId);
    window.history.pushState({}, '', url);
  };

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat("id-ID", { 
      style: "currency", 
      currency: "IDR", 
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-500 mt-1">Pantau performa penjualan & analisis AI</p>
          </div>
          <Button 
            onClick={() => { fetchSummary(); fetchProducts(); }} 
            variant="outline" 
            size="sm"
            className="self-start sm:self-auto"
          >
            <RefreshCcw className={`w-4 h-4 mr-2 ${loadingSummary ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {loadingSummary ? (
            [1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-1/2 mb-3"></div>
                    <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : summary && (
            <>
              <Card className="border-l-4 border-l-green-500">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Total Pendapatan</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">
                        {formatRupiah(summary.today.total_revenue)}
                      </p>
                      <div className={`flex items-center mt-2 text-sm ${
                        summary.changes.revenue_change >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {summary.changes.revenue_change >= 0 
                          ? <ArrowUpRight className="w-4 h-4 mr-1" /> 
                          : <ArrowDownRight className="w-4 h-4 mr-1" />
                        }
                        <span>{Math.abs(summary.changes.revenue_change).toFixed(1)}% dari kemarin</span>
                      </div>
                    </div>
                    <div className="p-3 bg-green-100 rounded-full">
                      <DollarSign className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-blue-500">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Item Terjual</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">
                        {summary.today.total_quantity} <span className="text-base font-normal text-gray-500">pcs</span>
                      </p>
                      <div className={`flex items-center mt-2 text-sm ${
                        summary.changes.quantity_change >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {summary.changes.quantity_change >= 0 
                          ? <ArrowUpRight className="w-4 h-4 mr-1" /> 
                          : <ArrowDownRight className="w-4 h-4 mr-1" />
                        }
                        <span>{Math.abs(summary.changes.quantity_change).toFixed(1)}% dari kemarin</span>
                      </div>
                    </div>
                    <div className="p-3 bg-blue-100 rounded-full">
                      <Package className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-purple-500">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Transaksi</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">
                        {summary.today.sales_count}
                      </p>
                      <p className="text-sm text-gray-500 mt-2">Transaksi hari ini</p>
                    </div>
                    <div className="p-3 bg-purple-100 rounded-full">
                      <ShoppingCart className="w-6 h-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Burst Alert */}
        {summary?.burst_alerts && summary.burst_alerts.length > 0 && (
          <Card className="mb-8 border-l-4 border-l-red-500 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-red-100 rounded-full flex-shrink-0">
                  <Zap className="w-5 h-5 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-red-800 mb-2">🚨 Burst Alert</h3>
                  <div className="space-y-2">
                    {summary.burst_alerts.map((alert) => (
                      <div 
                        key={alert.product_id} 
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-white p-3 rounded-lg"
                      >
                        <div>
                          <span className="font-medium text-gray-900">{alert.product_name}</span>
                          <span className="text-gray-600 ml-2">mengalami lonjakan!</span>
                          <Badge variant="secondary" className="ml-2 text-xs">{alert.burst_level}</Badge>
                        </div>
                        <Button 
                          size="sm" 
                          variant="primary"
                          onClick={() => handleProductSelect(alert.product_id)}
                        >
                          Lihat Analisa
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader className="pb-3 border-b">
                <h3 className="font-semibold text-gray-900">Produk</h3>
              </CardHeader>
              <CardContent className="p-0">
                {/* Top 3 */}
                {summary?.top_products && summary.top_products.length > 0 && (
                  <div className="p-4 border-b bg-gray-50">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1">
                      <Crown className="w-3 h-3 text-yellow-500" />
                      Top 3 Hari Ini
                    </p>
                    <div className="space-y-2">
                      {summary.top_products.slice(0, 3).map((top, idx) => (
                        <button
                          key={top.product_id}
                          onClick={() => handleProductSelect(top.product_id)}
                          className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-white transition text-left"
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                              idx === 1 ? 'bg-gray-200 text-gray-600' :
                              'bg-amber-100 text-amber-700'
                            }`}>
                              {idx + 1}
                            </span>
                            <span className="text-sm font-medium text-gray-700 truncate max-w-[120px]">
                              {top.product_name}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">{top.quantity}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* All Products */}
                <div className="p-4 max-h-[300px] overflow-y-auto">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Semua Produk
                  </p>
                  {products.length === 0 ? (
                    <div className="text-center py-6">
                      <Package className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                      <p className="text-sm text-gray-500 mb-3">Belum ada produk</p>
                      <Button size="sm" variant="outline" onClick={() => router.push('/products')}>
                        Tambah Produk
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {products.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => handleProductSelect(p.id)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition flex items-center justify-between group ${
                            selectedId === p.id 
                              ? "bg-red-50 text-red-700 font-medium" 
                              : "hover:bg-gray-100 text-gray-700"
                          }`}
                        >
                          <span className="truncate">{p.name}</span>
                          <ChevronRight className={`w-4 h-4 opacity-0 group-hover:opacity-100 transition ${
                            selectedId === p.id ? 'opacity-100 text-red-500' : 'text-gray-400'
                          }`} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {selectedId ? (
              <IntelligenceDashboard productId={selectedId} />
            ) : (
              <Card className="h-[400px] flex items-center justify-center">
                <div className="text-center">
                  <TrendingUp className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-700 mb-2">Pilih Produk</h3>
                  <p className="text-gray-500 text-sm">Pilih produk untuk melihat analisis AI</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
