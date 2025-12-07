"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IntelligenceDashboard } from "@/components/IntelligenceDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import Navbar from '@/components/ui/Navbar';
import { ArrowUpRight, ArrowDownRight, AlertTriangle, TrendingUp, RefreshCcw } from "lucide-react";
import { API_URL } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { logger } from "@/lib/logger";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } }
};

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

  const fetchProducts = async () => {
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/api/products`, {
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });
      const data = await res.json();
      if (data.success) {
        setProducts(data.data || []);
        if (!selectedId && data.data?.length > 0) setSelectedId(data.data[0].id);
      }
    } catch (err) {
      logger.error("Gagal load produk:", err);
    }
  };

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/api/analytics/summary`, {
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });
      const data = await res.json();
      
      if (data.success) {
        setSummary(data.summary);
      }
    } catch (err) {
      logger.error("Gagal load summary:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Parallel fetch for faster loading
    Promise.all([fetchProducts(), fetchSummary()]);
    
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
      <motion.main 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
      >
        <div className="flex flex-col gap-8">
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
          >
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard Overview</h1>
              <p className="text-sm text-gray-500 mt-1">
                Pantau performa harian & deteksi anomali penjualan.
              </p>
            </div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button onClick={fetchSummary} variant="outline" size="sm" className="bg-white shadow-sm flex items-center gap-2">
                <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </motion.div>
          </motion.div>

          {/* --- KPI SUMMARY CARDS --- */}
          {summary && (
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              <motion.div variants={itemVariants}>
                <Card className="hover:shadow-md transition-shadow">
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
              </motion.div>

              <motion.div variants={itemVariants}>
                <Card className="hover:shadow-md transition-shadow">
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
              </motion.div>

              <motion.div variants={itemVariants}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Transaksi</CardTitle>
                    <span className="text-gray-500 font-bold text-xs">TRX</span>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{summary.today.sales_count}</div>
                    <p className="text-xs text-gray-500 mt-1">Transaksi berhasil hari ini</p>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
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
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start"
          >
            {/* Sidebar List Produk */}
            <Card className="lg:col-span-2 lg:sticky lg:top-6 shadow-sm">
              <CardHeader className="pb-3 border-b border-gray-100">
                <h3 className="text-base font-semibold text-gray-900">Daftar Produk</h3>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[600px] overflow-y-auto p-2 space-y-1">
                  {products.map((p, idx) => (
                    <motion.button
                      key={p.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      onClick={() => setSelectedId(p.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all duration-150 truncate ${
                        selectedId === p.id
                          ? "bg-red-50 text-red-700 font-medium border border-red-200 shadow-sm"
                          : "hover:bg-gray-100 text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      {p.name}
                    </motion.button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Intelligence Dashboard View */}
            <div className="lg:col-span-10">
              <AnimatePresence mode="wait">
                {selectedId ? (
                  <motion.div
                    key={selectedId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <IntelligenceDashboard productId={selectedId} />
                  </motion.div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex h-[400px] items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 text-center"
                  >
                    <div className="flex flex-col items-center">
                      <div className="p-4 bg-white rounded-full shadow-sm mb-4">
                        <TrendingUp className="h-8 w-8 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">Pilih Produk</h3>
                      <p className="text-sm text-gray-500 mt-1">Klik produk dari sidebar untuk melihat analisa.</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </motion.main>
    </div>
  );
}