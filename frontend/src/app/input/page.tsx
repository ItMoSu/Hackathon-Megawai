"use client";

import { useEffect, useState } from "react";
import SalesForm from "@/components/SalesForm";
import Navbar from "@/components/ui/Navbar"; 
import { FolderOpen } from "lucide-react"; 

interface Product {
  id: string;
  name: string;
  [key: string]: any; 
}

export default function InputPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchProducts = async () => {
            setIsLoading(true);
            try {
                const token = localStorage.getItem("token");
                const res = await fetch("http://localhost:5000/api/products", {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const result = await res.json();
                
                if (result.success && Array.isArray(result.data)) {
                    setProducts(result.data);
                }
            } catch (err) {
                console.error("Gagal load produk", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProducts();
    }, []); 

    return (
            <main className="min-h-screen bg-white text-black selection:bg-[#DC2626] selection:text-white">
                <Navbar />
                    <div className="min-h-screen w-full flex items-center justify-center bg-surface p-4 sm:p-6 font-sans">
                        <div className="w-full max-w-xl bg-white rounded-xl border border-border shadow-sm overflow-hidden">
                            <div className="px-8 pt-8 pb-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-red-50 rounded-lg">
                                            <FolderOpen className="text-[#DC2626]" size={24} />
                                        </div>
                                        <div>
                                            <h1 className="text-xl font-bold text-black tracking-tight">
                                                Input Data Stok
                                            </h1>
                                            <p className="text-gray-500 text-sm">
                                                Manajemen Penjualan Harian
                                            </p>
                                        </div>
                                    </div>
                                    <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-surface border border-border rounded-full">
                                        <span className="w-2 h-2 rounded-full bg-[#DC2626] animate-pulse"></span>
                                        <span className="text-xs font-medium text-black">Live System</span>
                                    </div>
                                </div>
                                <hr className="mt-4 border-border" />
                            </div>
                            <div className="px-8 py-6">
                                {isLoading ? (
                                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                                        <div className="w-8 h-8 border-2 border-gray-200 border-t-[#DC2626] rounded-full animate-spin"></div>
                                        <p className="text-gray-500 text-sm font-medium">
                                            Sinkronisasi katalog produk...
                                        </p>
                                    </div>
                                ) : (
                                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <SalesForm 
                                            products={products} 
                                            onSuccess={() => console.log("Refresh data...")} 
                                        />
                                    </div>
                                )}
                            </div>
                            <div className="bg-surface px-8 py-4 border-t border-border flex justify-between items-center">
                                <p className="text-xs text-gray-400">
                                    Sistem v1.0.2
                                </p>
                                <p className="text-xs text-gray-500 font-medium">
                                    Secure Connection
                                </p>
                            </div>
                        </div>
                    </div>
            </main>
    );
}