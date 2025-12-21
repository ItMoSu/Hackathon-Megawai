"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { IntelligenceDashboard } from "@/components/IntelligenceDashboard";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import Navbar from "@/components/ui/Navbar";
import { ArrowLeft, Package, TrendingUp, TrendingDown, Minus, Edit2, Save, X, Trash2, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { API_URL } from "@/lib/api";
import { getAuthHeaders, handleAuthError } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { useTheme } from "@/lib/theme-context";

const UNIT_OPTIONS = [
  { value: 'pcs', label: 'Pcs' },
  { value: 'porsi', label: 'Porsi' },
  { value: 'cup', label: 'Cup' },
  { value: 'botol', label: 'Botol' },
  { value: 'bungkus', label: 'Bungkus' },
  { value: 'kg', label: 'Kg' },
  { value: 'box', label: 'Box' },
];

interface ProductDetail {
  product: {
    id: string;
    name: string;
    unit: string;
    price: number | null;
    is_active: boolean;
  };
  analytics: {
    momentum_combined: number;
    momentum_label: string;
    burst_score: number;
    burst_level: string;
    priority_score: number;
  } | null;
  salesHistory: Array<{
    date: string;
    quantity: number;
    revenue: number | null;
  }>;
  analyticsHistory: Array<{
    date: string;
    actual: number;
    forecast: number | null;
    momentum: number;
  }>;
}

interface Props {
  productId: string;
}

export default function ProductDetailClient({ productId }: Props) {
  const router = useRouter();
  const { theme } = useTheme();

  const sanitizeNumericInput = (value: string) => value.replace(/[^\d]/g, "");

  const [data, setData] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [saving, setSaving] = useState(false);
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchProductDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/products/${productId}`, {
        headers: getAuthHeaders(),
        cache: 'no-store'
      });

      if (handleAuthError(res.status, router)) return;

      if (!res.ok) {
        throw new Error('Produk tidak ditemukan');
      }

      const result = await res.json();
      if (result.success) {
        setData(result.data);
        setEditName(result.data.product.name);
        setEditUnit(result.data.product.unit);
        setEditPrice(result.data.product.price?.toString() || '');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [productId, router]);

  useEffect(() => {
    if (productId) {
      fetchProductDetail();
    }
  }, [productId, fetchProductDetail]);

  const handleEditPriceChange = (rawValue: string) => {
    const sanitized = sanitizeNumericInput(rawValue);
    setEditPrice(sanitized);
  };

  const blockNonNumericKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const blockedKeys = ["-", "+", "e", "E"];
    if (blockedKeys.includes(e.key)) {
      e.preventDefault();
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/products/${productId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: editName,
          unit: editUnit,
          price: editPrice ? parseFloat(editPrice) : null
        })
      });

      if (res.ok) {
        await fetchProductDetail();
        setIsEditing(false);
      }
    } catch (err) {
      logger.error('Save product error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`${API_URL}/api/products/${productId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      const result = await res.json();

      if (res.ok && result.success) {
        router.push('/products');
      } else {
        alert(result.error || 'Gagal menghapus produk');
      }
    } catch (err) {
      logger.error('Delete product error:', err);
      alert('Gagal menghapus produk');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const getMomentumBadge = (label: string | undefined) => {
    switch (label) {
      case 'TRENDING_UP':
        return <Badge className="bg-green-100 text-green-700">Trending Up</Badge>;
      case 'GROWING':
        return <Badge className="bg-emerald-50 text-emerald-600">Growing</Badge>;
      case 'FALLING':
        return <Badge className="bg-red-100 text-red-700">Falling</Badge>;
      case 'DECLINING':
        return <Badge className="bg-orange-100 text-orange-700">Declining</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-600">Stable</Badge>;
    }
  };

  const formatRupiah = (num: number | null) => {
    if (!num) return '-';
    return new Intl.NumberFormat("id-ID", { 
      style: "currency", 
      currency: "IDR", 
      minimumFractionDigits: 0 
    }).format(num);
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${theme === "dark" ? "bg-gray-900" : "bg-gray-50"}`}>
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={`min-h-screen ${theme === "dark" ? "bg-gray-900" : "bg-gray-50"}`}>
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <Button variant="outline" onClick={() => router.back()} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali
          </Button>
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-red-600 font-medium">{error || 'Produk tidak ditemukan'}</p>
              <Button className="mt-4" onClick={() => router.push('/products')}>
                Ke Halaman Produk
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const { product, analytics, salesHistory } = data;
  const totalSales = salesHistory.reduce((sum, s) => sum + s.quantity, 0);
  const totalRevenue = salesHistory.reduce((sum, s) => sum + (s.revenue || 0), 0);

  return (
    <div className={`min-h-screen ${theme === "dark" ? "bg-gray-900 text-white" : "bg-gray-50 text-slate-900"}`}>
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Button variant="outline" onClick={() => router.back()} className={`mb-4 ${theme === "dark" ? "text-gray-300 hover:bg-gray-700 hover:text-gray-100 border-gray-600" : "text-gray-600 hover:text-gray-900"}`}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali ke Produk
          </Button>

          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <Card className="flex-1">
              <CardContent className="p-6">
                {isEditing ? (
                  <div className="space-y-4">
                    <Input 
                      label="Nama Produk"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                    <Select 
                      label="Unit"
                      options={UNIT_OPTIONS}
                      value={editUnit}
                      onChange={(e) => setEditUnit(e.target.value)}
                    />
                    <Input 
                      label="Harga"
                      type="number"
                      value={editPrice}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      min="0"
                      step={500}
                      onChange={(e) => handleEditPriceChange(e.target.value)}
                      onKeyDown={blockNonNumericKeys}
                    />
                    <div className="flex gap-2">
                      <Button onClick={handleSave} isLoading={saving} className="bg-green-600 hover:bg-green-700 text-white">
                        <Save className="w-4 h-4 mr-2" />
                        Simpan
                      </Button>
                      <Button variant="outline" onClick={() => setIsEditing(false)} className={theme === "dark" ? "border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-gray-100" : ""}>
                        <X className="w-4 h-4 mr-2" />
                        Batal
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className={`p-2 sm:p-3 rounded-xl flex-shrink-0 ${theme === "dark" ? "bg-red-900/50" : "bg-red-100"}`}>
                        <Package className="w-6 h-6 sm:w-8 sm:h-8 text-red-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h1 className={`text-xl sm:text-2xl font-bold truncate ${theme === "dark" ? "text-white" : "text-gray-900"}`}>{product.name}</h1>
                        <p className={`text-sm sm:text-base ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                          {formatRupiah(product.price)} / {product.unit}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {getMomentumBadge(analytics?.momentum_label)}
                      <div className="flex items-center gap-2 ml-auto">
                        <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className={theme === "dark" ? "border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-gray-100" : ""}>
                          <Edit2 className="w-4 h-4 sm:mr-1" />
                          <span className="hidden sm:inline">Edit</span>
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setShowDeleteConfirm(true)}
                          className={`${theme === "dark" ? "text-red-400 border-red-800 hover:bg-red-900/30 hover:text-red-300" : "text-red-600 border-red-200 hover:bg-red-50"}`}
                        >
                          <Trash2 className="w-4 h-4 sm:mr-1" />
                          <span className="hidden sm:inline">Hapus</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className={`w-full max-w-md mx-4 ${theme === "dark" ? "bg-gray-800 border-gray-700" : ""}`}>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-3 rounded-full ${theme === "dark" ? "bg-red-900/50" : "bg-red-100"}`}>
                    <AlertTriangle className={`w-6 h-6 ${theme === "dark" ? "text-red-400" : "text-red-600"}`} />
                  </div>
                  <div>
                    <h3 className={`text-lg font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Hapus Produk?</h3>
                    <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>&quot;{product.name}&quot;</p>
                  </div>
                </div>
                
                <p className={`mb-6 ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}>
                  {salesHistory.length > 0 
                    ? `Produk ini memiliki ${salesHistory.length} data penjualan. Produk akan dinonaktifkan, bukan dihapus permanen.`
                    : 'Produk akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan.'
                  }
                </p>

                <div className="flex gap-3 justify-end">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={deleting}
                    className={theme === "dark" ? "border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-gray-100" : ""}
                  >
                    Batal
                  </Button>
                  <Button 
                    onClick={handleDelete}
                    isLoading={deleting}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {salesHistory.length > 0 ? 'Nonaktifkan' : 'Hapus'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <Card className={`border-l-4 border-l-blue-500 ${theme === "dark" ? "bg-gray-800 border-gray-700" : ""}`}>
            <CardContent className={`p-4 sm:p-6 ${theme === "dark" ? "bg-gray-900" : ""}`}>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <div className={`p-2 rounded-lg w-fit ${theme === "dark" ? "bg-blue-900/50" : "bg-blue-100"}`}>
                  <TrendingUp className={`w-4 h-4 sm:w-5 sm:h-5 ${theme === "dark" ? "text-blue-400" : "text-blue-600"}`} />
                </div>
                <div>
                  <p className={`text-xs sm:text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>Terjual (30h)</p>
                  <p className={`text-lg sm:text-2xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>{totalSales}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`border-l-4 border-l-green-500 ${theme === "dark" ? "bg-gray-800 border-gray-700" : ""}`}>
            <CardContent className={`p-4 sm:p-6 ${theme === "dark" ? "bg-gray-900" : ""}`}>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <div className={`p-2 rounded-lg w-fit ${theme === "dark" ? "bg-green-900/50" : "bg-green-100"}`}>
                  <TrendingUp className={`w-4 h-4 sm:w-5 sm:h-5 ${theme === "dark" ? "text-green-400" : "text-green-600"}`} />
                </div>
                <div>
                  <p className={`text-xs sm:text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>Revenue (30h)</p>
                  <p className={`text-lg sm:text-2xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>{formatRupiah(totalRevenue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`col-span-2 sm:col-span-1 border-l-4 border-l-purple-500 ${theme === "dark" ? "bg-gray-800 border-gray-700" : ""}`}>
            <CardContent className={`p-4 sm:p-6 ${theme === "dark" ? "bg-gray-900" : ""}`}>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <div className={`p-2 rounded-lg w-fit ${theme === "dark" ? "bg-purple-900/50" : "bg-purple-100"}`}>
                  {(analytics?.momentum_combined || 0) > 0 ? 
                    <TrendingUp className={`w-4 h-4 sm:w-5 sm:h-5 ${theme === "dark" ? "text-purple-400" : "text-purple-600"}`} /> :
                    (analytics?.momentum_combined || 0) < 0 ?
                    <TrendingDown className={`w-4 h-4 sm:w-5 sm:h-5 ${theme === "dark" ? "text-purple-400" : "text-purple-600"}`} /> :
                    <Minus className={`w-4 h-4 sm:w-5 sm:h-5 ${theme === "dark" ? "text-purple-400" : "text-purple-600"}`} />
                  }
                </div>
                <div>
                  <p className={`text-xs sm:text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>Momentum</p>
                  <p className={`text-lg sm:text-2xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                    {analytics?.momentum_combined ? 
                      `${(analytics.momentum_combined * 100).toFixed(1)}%` : 
                      '0%'
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <IntelligenceDashboard productId={productId} />

        <Card className={`mt-8 ${theme === "dark" ? "bg-gray-800 border-gray-700" : ""}`}>
          <CardHeader className={`border-b ${theme === "dark" ? "border-gray-700" : ""}`}>
            <h3 className={`font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Riwayat Penjualan (30 Hari Terakhir)</h3>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={theme === "dark" ? "bg-gray-900" : "bg-gray-50"}>
                  <tr>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>Tanggal</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium uppercase ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>Quantity</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium uppercase ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>Revenue</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${theme === "dark" ? "divide-gray-700" : "divide-gray-200"}`}>
                  {salesHistory.length === 0 ? (
                    <tr>
                      <td colSpan={3} className={`px-6 py-8 text-center ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                        Belum ada data penjualan
                      </td>
                    </tr>
                  ) : (
                    salesHistory.slice().reverse().map((sale, idx) => (
                      <tr key={idx} className={theme === "dark" ? "hover:bg-gray-700/50" : "hover:bg-gray-50"}>
                        <td className={`px-6 py-4 text-sm ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                          {new Date(sale.date).toLocaleDateString('id-ID', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </td>
                        <td className={`px-6 py-4 text-sm text-right font-medium ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                          {sale.quantity} {product.unit}
                        </td>
                        <td className={`px-6 py-4 text-sm text-right ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                          {formatRupiah(sale.revenue)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
