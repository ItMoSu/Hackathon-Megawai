"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select'; 
import { Badge } from '@/components/ui/Badge';

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
        // ------------------------

        // Gunakan Backticks (`) bukan single quote (') agar variable ${userId} terbaca!
        const res = await fetch(`http://localhost:5000/api/products?user_id=${userId}`, {
          headers: getAuthHeaders() 
        });

        if (res.status === 401) {
          // Token expired atau tidak valid
          localStorage.removeItem('token'); // Bersihkan token rusak
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
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Manajemen Produk</h1>
          <Badge variant="outline" className="text-sm px-3 py-1">
            Total: {products.length} Produk
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-1">
            <Card className="sticky top-8">
              <CardHeader>
                <h2 className="text-xl font-bold">Tambah Baru</h2>
                <p className="text-sm text-gray-500">Daftarkan menu jualanmu di sini.</p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  
                  <Input 
                    label="Nama Produk" 
                    placeholder="Contoh: Ayam Bakar Madu"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    error={!name && error ? error : ''}
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
                    className="w-full mt-2" 
                    isLoading={isSubmitting}
                  >
                    + Simpan Produk
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            {loading ? (
              <div className="text-center py-10 text-gray-500">Memuat data...</div>
            ) : products.length === 0 ? (
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center bg-white">
                <p className="text-gray-500 mb-2">Belum ada produk tersimpan.</p>
                <p className="text-sm text-gray-400">Yuk tambah produk pertamamu di form sebelah kiri!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {products.map((product) => (
                  <Card key={product.id} className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-primary">
                    <CardContent className="p-5 flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-lg text-gray-800">{product.name}</h3>
                        <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider">
                          ID: {product.id.split('-')[0]}...
                        </p>
                      </div>
                      <Badge variant="secondary" className="uppercase text-xs">
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
    </div>
  );
}