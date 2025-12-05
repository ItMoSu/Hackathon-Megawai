"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import Navbar from '@/components/ui/Navbar';
import { useRouter } from 'next/navigation';
import { Check, ShoppingCart, Calendar, Loader2, AlertCircle, Package, Minus, Plus } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  unit: string;
}

export default function InputSalesPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [salesInputs, setSalesInputs] = useState<Map<string, number>>(new Map());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

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
        const initialInputs = new Map<string, number>();
        (data.data || []).forEach((p: Product) => {
          initialInputs.set(p.id, 0);
        });
        setSalesInputs(initialInputs);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      showToast('Gagal memuat produk', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleQuantityChange = (productId: string, quantity: number) => {
    const newInputs = new Map(salesInputs);
    newInputs.set(productId, Math.max(0, quantity));
    setSalesInputs(newInputs);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const salesData = products
      .filter(p => (salesInputs.get(p.id) || 0) > 0)
      .map(p => ({
        product_id: p.id,
        product_name: p.name,
        quantity: salesInputs.get(p.id) || 0,
        sale_date: saleDate
      }));

    if (salesData.length === 0) {
      showToast('Masukkan minimal 1 produk dengan quantity > 0', 'error');
      return;
    }

    setSubmitting(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const sale of salesData) {
        try {
          const res = await fetch('http://localhost:5000/api/sales', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(sale)
          });

          if (res.ok) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch {
          errorCount++;
        }
      }

      if (successCount > 0) {
        showToast(`${successCount} data berhasil disimpan!`, 'success');
        const resetInputs = new Map<string, number>();
        products.forEach(p => resetInputs.set(p.id, 0));
        setSalesInputs(resetInputs);
      }

      if (errorCount > 0) {
        showToast(`${errorCount} data gagal disimpan`, 'error');
      }

    } catch (err) {
      showToast('Terjadi kesalahan', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const totalItems = Array.from(salesInputs.values()).filter(v => v > 0).length;
  const totalQuantity = Array.from(salesInputs.values()).reduce((a, b) => a + b, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-red-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      {/* Toast */}
      {toast && (
        <div className={`fixed top-24 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-lg ${
          toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
            <ShoppingCart className="w-7 h-7 text-red-500" />
            Input Penjualan
          </h1>
          <p className="text-gray-500 mt-1">Catat penjualan harian produk Anda</p>
        </div>

        {products.length === 0 ? (
          <Card className="p-8 text-center">
            <Package className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Belum ada produk</h3>
            <p className="text-gray-500 mb-4">Tambahkan produk terlebih dahulu</p>
            <Button onClick={() => router.push('/products')}>Tambah Produk</Button>
          </Card>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Date Picker */}
            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Tanggal:</span>
                  </div>
                  <Input
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="max-w-[200px]"
                  />
                  <Badge variant="outline" className="text-xs self-start sm:self-auto">
                    {new Date(saleDate).toLocaleDateString('id-ID', { 
                      weekday: 'long', 
                      day: 'numeric',
                      month: 'short'
                    })}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Products List */}
            <Card className="mb-6">
              <CardHeader className="pb-2 border-b">
                <div className="flex justify-between items-center">
                  <h2 className="font-semibold text-gray-900">Daftar Produk</h2>
                  <Badge variant="secondary">{products.length} produk</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-100">
                  {products.map((product) => {
                    const qty = salesInputs.get(product.id) || 0;
                    return (
                      <div
                        key={product.id}
                        className={`flex items-center justify-between p-4 transition ${
                          qty > 0 ? 'bg-green-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${
                            qty > 0 ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'
                          }`}>
                            {qty > 0 ? <Check className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{product.name}</p>
                            <p className="text-xs text-gray-400 uppercase">{product.unit}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(product.id, qty - 1)}
                            className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition"
                          >
                            <Minus className="w-4 h-4 text-gray-600" />
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={qty}
                            onChange={(e) => handleQuantityChange(product.id, parseInt(e.target.value) || 0)}
                            className="w-16 h-8 text-center border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-red-500 focus:border-red-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(product.id, qty + 1)}
                            className="w-8 h-8 rounded-lg bg-red-500 hover:bg-red-600 flex items-center justify-center transition"
                          >
                            <Plus className="w-4 h-4 text-white" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Submit Section */}
            <Card className="bg-gray-900 text-white border-0">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <p className="text-gray-400 text-sm">Ringkasan</p>
                    <p className="text-lg font-bold">{totalItems} Produk • {totalQuantity} Item</p>
                  </div>
                  <Button 
                    type="submit" 
                    variant="secondary"
                    className="bg-white text-gray-900 hover:bg-gray-100"
                    isLoading={submitting}
                    disabled={totalItems === 0}
                  >
                    Simpan Penjualan
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        )}
      </main>
    </div>
  );
}
