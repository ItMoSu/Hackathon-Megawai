"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select'; 
import { Badge } from '@/components/ui/Badge';
import { TrendChart } from '@/components/TrendChart';
import Navbar from '@/components/ui/Navbar';
import { Package, Plus, TrendingUp, PackageOpen } from "lucide-react";

const UNIT_OPTIONS = [
  { value: 'pcs', label: 'Pcs' },
  { value: 'porsi', label: 'Porsi' },
  { value: 'cup', label: 'Cup' },
  { value: 'botol', label: 'Botol' },
  { value: 'bungkus', label: 'Bungkus' },
  { value: 'kg', label: 'Kg' },
  { value: 'box', label: 'Box' },
];

interface Product {
  id: string;
  name: string;
  unit: string;
}

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [name, setName] = useState('');
  const [unit, setUnit] = useState(''); 
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

        // --- TAMBAHAN PENTING ---
        if (!token || !userId) {
          console.warn("Belum ada token, redirect ke login...");
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
          setProducts(data.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError("Nama produk tidak boleh kosong");
      return;
    }

    if (!unit) {
      setError("Silakan pilih satuan unit");
      return;
    }

  setIsSubmitting(true);
    try {
      const userId = localStorage.getItem('user_id'); 

      const res = await fetch('http://localhost:5000/api/products', {
        method: 'POST',
        headers: getAuthHeaders(), 
        body: JSON.stringify({
          user_id: userId,
          name: name,
          unit: unit
        })
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Gagal menyimpan");
      }

      setName('');
      setUnit(''); 
      fetchProducts();
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
  <div className="min-h-screen bg-gray-50 text-slate-900 selection:bg-red-600 selection:text-white">
    {/* 1. Navbar */}
    <Navbar />
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Manajemen Produk</h1>
            <p className="text-sm text-gray-500 mt-1">
              Kelola katalog menu, harga, dan satuan unit.
            </p>
          </div>
          <Badge variant="outline" className="w-fit px-4 py-2 text-sm font-medium bg-white shadow-sm border-gray-200">
            <Package className="w-4 h-4 mr-2 text-red-600" />
            Total: <span className="ml-1 font-bold text-gray-900">{products.length} Item</span>
          </Badge>
        </div>
        <Card className="border-none shadow-sm ring-1 ring-gray-200">
          <CardHeader className="pb-2 border-b border-gray-100">
            <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-gray-500" />
                <h3 className="font-semibold text-gray-700">Tren Penambahan Produk</h3>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <TrendChart />
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
          <div className="lg:col-span-4">
            <Card className="sticky top-8 border-t-4 border-t-red-600 shadow-md">
              <CardHeader>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Plus className="w-5 h-5 text-red-600" />
                  Tambah Baru
                </h2>
                <p className="text-sm text-gray-500">Daftarkan menu jualanmu di sini.</p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <Input 
                    label="Nama Produk" 
                    placeholder="Contoh: Ayam Bakar Madu"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    error={!name && error ? error : ''}
                    className="focus:ring-red-500" // Optional styling
                  />
                  <Select 
                    label="Satuan (Unit)" 
                    options={UNIT_OPTIONS}
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    error={!unit && error ? "Pilih satuan unit" : ''}
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
          <div className="lg:col-span-8">
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
                  Katalogmu masih kosong. Mulai tambahkan produk pertamamu melalui formulir di sebelah kiri.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {products.map((product) => (
                  <Card 
                    key={product.id} 
                    className="group relative overflow-hidden transition-all duration-200 hover:shadow-md hover:border-red-200 cursor-pointer bg-white"
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gray-200 group-hover:bg-red-500 transition-colors" />
                    
                    <CardContent className="p-5 pl-7 flex justify-between items-start">
                      <div className="space-y-1">
                        <h3 className="font-bold text-gray-800 group-hover:text-red-700 transition-colors line-clamp-1">
                          {product.name}
                        </h3>
                        <p className="text-[10px] font-mono text-gray-400 uppercase tracking-wider bg-gray-50 w-fit px-1 rounded">
                          ID: {product.id.split('-')[0]}
                        </p>
                      </div>
                      <Badge variant="secondary" className="bg-gray-100 text-gray-600 border border-gray-200 group-hover:bg-white">
                        {product.unit}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  </div>
);
}
