"use client";

import { useEffect, useState } from "react";
import { IntelligenceDashboard } from "@/components/IntelligenceDashboard";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import Navbar from '@/components/ui/Navbar';

type Product = { id: string; name: string; unit?: string };
type TrendingProduct = { productId: string; productName: string; burstScore: number; severity: string; lastUpdated: string };

export default function DashboardPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trendingProducts, setTrendingProducts] = useState<TrendingProduct[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [trendingError, setTrendingError] = useState<string | null>(null);

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const res = await fetch("http://localhost:5000/api/products", {
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Gagal memuat produk");
      }
      setProducts(data.data || []);
      if (!selectedId && data.data?.length) {
        setSelectedId(data.data[0].id);
      }
    } catch (err: any) {
      setError(err?.message || "Gagal memuat produk");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrendingProducts = async () => {
    setTrendingLoading(true);
    setTrendingError(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const res = await fetch("http://localhost:5000/api/intelligence/trending", {
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Gagal memuat produk trending");
      }
      setTrendingProducts(data.data || []);
    } catch (err: any) {
      setTrendingError(err?.message || "Gagal memuat produk trending");
      setTrendingProducts([]);
    } finally {
      setTrendingLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchTrendingProducts();

    // Real-time polling every 5 minutes
    const interval = setInterval(fetchTrendingProducts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <Navbar />
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-blue-600">Intelligence</p>
            <h1 className="text-3xl font-bold text-gray-900">AI Insights Dashboard</h1>
            <p className="text-sm text-gray-500">
              Prediksi cerdas dan rekomendasi bisnis untuk UMKM, lengkap dengan deteksi lonjakan real-time.
            </p>
          </div>
          <Badge variant="secondary" className="text-xs">
            {products.length} produk
          </Badge>
        </div>

        {/* Trending Notifications Section */}
        <Card className="col-span-12">
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900">Pemberitahuan Barang Naik Daun Hari Ini</h2>
            <p className="text-sm text-gray-500">Barang yang sedang populer dan mengalami lonjakan permintaan hari ini.</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {trendingLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800"
                    />
                  ))}
                </div>
              ) : trendingError ? (
                <p className="text-sm text-red-600">{trendingError}</p>
              ) : !trendingProducts.length ? (
                <p className="text-sm text-gray-500">Tidak ada produk trending saat ini.</p>
              ) : (
                trendingProducts.map((product) => (
                  <div key={product.productId} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
                    <div className="flex items-center space-x-3">
                      <Badge variant={product.severity === 'CRITICAL' ? 'default' : 'secondary'} className="text-xs">
                        {product.severity === 'CRITICAL' ? 'Critical' : 'High'}
                      </Badge>
                      <div>
                        <p className="font-medium text-gray-900">{product.productName}</p>
                        <p className="text-sm text-gray-500">Burst Score: {product.burstScore.toFixed(2)}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedId(product.productId)}
                    >
                      Lihat Detail
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-12 gap-6">
          <Card className="col-span-12 md:col-span-4 lg:col-span-3">
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Produk</h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={fetchProducts}
                  className="text-xs"
                  disabled={loading}
                >
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800"
                    />
                  ))}
                </div>
              ) : error ? (
                <p className="text-sm text-red-600">{error}</p>
              ) : !products.length ? (
                <p className="text-sm text-gray-500">Belum ada produk.</p>
              ) : (
                <div className="space-y-2">
                  {products.map((p) => {
                    const isActive = selectedId === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelectedId(p.id)}
                        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition hover:border-blue-400 hover:bg-blue-50 ${
                          isActive ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white"
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-900">{p.name}</span>
                          <span className="text-xs text-gray-500">ID: {p.id.slice(0, 8)}...</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {p.unit || "pcs"}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="col-span-12 md:col-span-8 lg:col-span-9">
            {selectedId ? (
              <IntelligenceDashboard productId={selectedId} />
            ) : (
              <Card className="h-full">
                <CardContent className="flex h-full items-center justify-center text-sm text-gray-500">
                  Pilih produk untuk melihat intelijen AI.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
