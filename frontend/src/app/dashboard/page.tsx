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
    <div className="min-h-screen bg-gray-50 p-6">
      <Navbar />
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        
        {/* Header */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>
            <p className="text-sm text-gray-500">Pantau performa harian & deteksi anomali.</p>
          </div>
          <Button onClick={fetchSummary} variant="outline" size="sm">Refresh Data</Button>
        </div>

        {/* --- BAGIAN 1: SUMMARY CARDS (Revenue, Sales, Comparison) --- */}
        {summary && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Pendapatan (Hari Ini)</CardTitle>
                <span className="text-gray-500 font-bold">Rp</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatRupiah(summary.today.total_revenue)}</div>
                <p className={`text-xs flex items-center mt-1 ${summary.changes.revenue_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {summary.changes.revenue_change >= 0 ? <ArrowUpRight className="h-4 w-4 mr-1"/> : <ArrowDownRight className="h-4 w-4 mr-1"/>}
                  {Math.abs(summary.changes.revenue_change).toFixed(1)}% dari kemarin
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Item Terjual</CardTitle>
                <span className="text-gray-500 font-bold">Qty</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.today.total_quantity} pcs</div>
                <p className={`text-xs flex items-center mt-1 ${summary.changes.quantity_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {summary.changes.quantity_change >= 0 ? <ArrowUpRight className="h-4 w-4 mr-1"/> : <ArrowDownRight className="h-4 w-4 mr-1"/>}
                  {Math.abs(summary.changes.quantity_change).toFixed(1)}% dari kemarin
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Transaksi</CardTitle>
                <span className="text-gray-500 font-bold">#</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.today.sales_count}</div>
                <p className="text-xs text-gray-500 mt-1">Transaksi berhasil hari ini</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* --- BAGIAN 2: BURST ALERT (MERAH) --- */}
        {summary?.burst_alerts && summary.burst_alerts.length > 0 && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md shadow-sm animate-pulse">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div className="ml-3 w-full">
                <h3 className="text-sm font-medium text-red-800">
                  BURST ALERT DETECTED!
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  {summary.burst_alerts.map((alert) => (
                    <div key={alert.product_id} className="flex justify-between items-center mb-1">
                      <span>
                        Produk <strong>{alert.product_name}</strong> mengalami lonjakan permintaan (Level: {alert.burst_level})!
                      </span>
                      <Button 
                        size="sm" 
                        variant="primary" 
                        className="h-7 text-xs"
                        onClick={() => setSelectedId(alert.product_id)} // Klik alert langsung buka detail
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

        <div className="grid grid-cols-12 gap-6">
          {/* List Produk (Sidebar) */}
          <Card className="col-span-12 md:col-span-3 h-fit">
            <CardHeader>
              <h3 className="text-lg font-semibold">Semua Produk</h3>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
               {/* --- BAGIAN 3: QUICK RANKING (Dari Summary API) --- */}
               {summary?.top_products && (
                <div className="mb-4 pb-4 border-b border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase mb-2">Top 3 Hari Ini</p>
                  {summary.top_products.slice(0, 3).map((top, idx) => (
                    <div key={top.product_id} className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700 font-medium">#{idx+1} {top.product_name}</span>
                      <span className="text-gray-500">{top.quantity} sold</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Full List */}
              <p className="text-xs font-bold text-gray-400 uppercase mb-2">Daftar Lengkap</p>
              {products.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition ${
                    selectedId === p.id 
                      ? "bg-blue-50 text-blue-700 font-medium border border-blue-200" 
                      : "hover:bg-gray-100 text-gray-700"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Main Intelligence View */}
          <div className="col-span-12 md:col-span-9">
            {selectedId ? (
              <IntelligenceDashboard productId={selectedId} />
            ) : (
              <Card className="h-full flex items-center justify-center p-10">
                <p className="text-gray-400">Pilih produk untuk melihat detail.</p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}