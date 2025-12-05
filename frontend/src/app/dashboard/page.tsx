"use client";

import { useEffect, useState } from "react";
import { IntelligenceDashboard } from "@/components/IntelligenceDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"; // Pastikan ada CardTitle
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import Navbar from '@/components/ui/Navbar';
import { ArrowUpRight, ArrowDownRight, AlertTriangle, TrendingUp } from "lucide-react"; // Install lucide-react jika belum

// --- Tipe Data Sesuai Response API [1] ---
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

export default function DashboardPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 1. Fetch List Produk (Untuk Sidebar Kiri)
  const fetchProducts = async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const res = await fetch("http://localhost:5000/api/products", {
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });
      const data = await res.json();
      if (data.success) {
        setProducts(data.data || []);
        // Auto-select produk pertama jika belum ada yang dipilih
        if (!selectedId && data.data?.length > 0) setSelectedId(data.data[0].id);
      }
    } catch (err) {
      console.error("Gagal load produk:", err);
    }
  };

  // 2. Fetch Summary (API [1] - INI KUNCINYA)
  const fetchSummary = async () => {
    setLoading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      // KITA GUNAKAN ENDPOINT SUMMARY KARENA DATANYA LENGKAP
      const res = await fetch("http://localhost:5000/api/analytics/summary", {
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });
      const data = await res.json();
      
      if (data.success) {
        setSummary(data.summary);
      }
    } catch (err) {
      console.error("Gagal load summary:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchSummary();
    
    // Refresh setiap 5 menit
    const interval = setInterval(fetchSummary, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Helper untuk format Rupiah
  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(num);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-slate-900 selection:bg-red-600 selection:text-white">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard Overview</h1>
              <p className="text-sm text-gray-500 mt-1">
                Pantau performa harian & deteksi anomali penjualan.
              </p>
            </div>
            <Button onClick={fetchSummary} variant="outline" size="sm" className="bg-white shadow-sm">
              Refresh Data
            </Button>
          </div>

          {/* --- KPI SUMMARY CARDS --- */}
          {summary && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Pendapatan</CardTitle>
                  <span className="text-gray-500 font-bold text-xs">IDR</span>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatRupiah(summary.today.total_revenue)}</div>
                  <p className={`text-xs flex items-center mt-1 font-medium ${summary.changes.revenue_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {summary.changes.revenue_change >= 0 ? <ArrowUpRight className="h-4 w-4 mr-1" /> : <ArrowDownRight className="h-4 w-4 mr-1" />}
                    {Math.abs(summary.changes.revenue_change).toFixed(1)}% dari kemarin
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Item Terjual</CardTitle>
                  <span className="text-gray-500 font-bold text-xs">QTY</span>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary.today.total_quantity} pcs</div>
                  <p className={`text-xs flex items-center mt-1 font-medium ${summary.changes.quantity_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {summary.changes.quantity_change >= 0 ? <ArrowUpRight className="h-4 w-4 mr-1" /> : <ArrowDownRight className="h-4 w-4 mr-1" />}
                    {Math.abs(summary.changes.quantity_change).toFixed(1)}% dari kemarin
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Transaksi</CardTitle>
                  <span className="text-gray-500 font-bold text-xs">TRX</span>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary.today.sales_count}</div>
                  <p className="text-xs text-gray-500 mt-1">Transaksi berhasil hari ini</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* --- BURST ALERT SECTION --- */}
          {summary?.burst_alerts && summary.burst_alerts.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 shadow-sm animate-pulse">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-red-900">BURST ALERT DETECTED!</h3>
                  <div className="mt-2 flex flex-col gap-2">
                    {summary.burst_alerts.map((alert) => (
                      <div key={alert.product_id} className="flex flex-wrap items-center justify-between gap-2 text-sm bg-white/60 p-2 rounded border border-red-100">
                        <span className="text-red-800">
                          Produk <strong>{alert.product_name}</strong> mengalami lonjakan (Level: {alert.burst_level})
                        </span>
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-red-600 hover:bg-red-700 text-white border-0"
                          onClick={() => setSelectedId(alert.product_id)}
                        >
                          Lihat Analisa
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* --- MAIN CONTENT GRID (SIDEBAR + CHART) --- */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
            
            {/* Sidebar List Produk */}
            <Card className="lg:col-span-3 lg:sticky lg:top-6 shadow-sm">
              <CardHeader className="pb-3 border-b border-gray-100">
                <h3 className="text-base font-semibold text-gray-900">List Produk</h3>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[600px] overflow-y-auto p-4 space-y-4">
                  
                  {/* Quick Ranking */}
                  {summary?.top_products && (
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Top 3 Hari Ini</p>
                      <div className="space-y-2">
                        {summary.top_products.slice(0, 3).map((top, idx) => (
                          <div key={top.product_id} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded border border-gray-100">
                            <span className="font-medium text-gray-700 truncate w-32">
                              #{idx + 1} {top.product_name}
                            </span>
                            <Badge variant="secondary" className="text-xs font-normal">
                              {top.quantity} sold
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* All Products */}
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Semua Produk</p>
                    <div className="space-y-1">
                      {products.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedId(p.id)}
                          className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all duration-200 ${
                            selectedId === p.id
                              ? "bg-red-50 text-red-700 font-medium border border-red-200 shadow-sm"
                              : "hover:bg-gray-100 text-gray-600 hover:text-gray-900"
                          }`}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Intelligence Dashboard View */}
            <div className="lg:col-span-9">
              {selectedId ? (
                <IntelligenceDashboard productId={selectedId} />
              ) : (
                <div className="flex h-[400px] items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 text-center">
                  <div className="flex flex-col items-center">
                    <TrendingUp className="h-10 w-10 text-gray-300 mb-3" />
                    <h3 className="text-lg font-medium text-gray-900">Belum ada produk dipilih</h3>
                    <p className="text-sm text-gray-500">Pilih produk dari sidebar untuk melihat detail analisa.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}