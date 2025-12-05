"use client";
import { useState } from "react";

const CalendarIcon = () => (
<svg className="w-5 h-5 text-gray-400 absolute left-3 top-3.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
</svg>
);

const ChevronDownIcon = () => (
<svg className="w-5 h-5 text-gray-500 absolute right-3 top-3.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
</svg>
);

interface Product {
id: string;
name: string;
unit?: string;
}

interface SalesFormProps {
products: Product[];
onSuccess?: () => void;
}

export default function SalesForm({ products, onSuccess }: SalesFormProps) {
const [loading, setLoading] = useState(false);
const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

const [formData, setFormData] = useState({
    product_id: "",
    product_name: "",
    quantity: "" as unknown as number, 
    sale_date: new Date().toISOString().split("T")[0],
});

// --- Logic ---
const handleProductChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const selectedProduct = products.find((p) => p.id === selectedId);
    setFormData({
    ...formData,
    product_id: selectedId,
    product_name: selectedProduct ? selectedProduct.name : "",
    });
};

const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const token = localStorage.getItem("token");
    if (!token) {
    setMessage({ type: 'error', text: "Session habis. Login ulang dulu!" });
    setLoading(false);
    return;
    }

    if (!formData.product_id) {
    setMessage({ type: 'error', text: "Pilih produk dulu!" });
    setLoading(false);
    return;
    }

    if (!formData.quantity || Number(formData.quantity) <= 0) {
    setMessage({ type: 'error', text: "Jumlah barang minimal 1!" });
    setLoading(false);
    return;
    }

    try {
    const res = await fetch("http://localhost:5000/api/sales", {
        method: "POST",
        headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
            ...formData,
            quantity: Number(formData.quantity) 
        }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Gagal simpan");

    setMessage({ type: 'success', text: "Transaksi berhasil disimpan!" });
    
    // Reset form (kecuali tanggal biar input cepet)
    setFormData((prev) => ({ ...prev, quantity: "" as unknown as number, product_id: "", product_name: "" }));
    
    if (onSuccess) onSuccess();

    } catch (err) {
    const errorMessage = (err as Error).message || "Terjadi kesalahan";
    setMessage({ type: 'error', text: errorMessage });
    } finally {
    setLoading(false);
    }
};

return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
    
    {/* Header Kecil di Component */}
    <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
        <h3 className="font-bold text-gray-700">Form Transaksi</h3>
        <span className="text-xs text-gray-400 font-mono">NEW ENTRY</span>
    </div>

    <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Alert Message */}
        {message && (
            <div className={`p-4 rounded-xl text-sm font-medium flex items-center animate-fade-in ${
            message.type === "error" ? "bg-red-50 text-red-600 border border-red-100" : "bg-green-50 text-green-600 border border-green-100"
            }`}>
            {message.type === 'error' ? '⚠️ ' : '✅ '} {message.text}
            </div>
        )}

        {/* 1. TANGGAL */}
        <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide ml-1">Tanggal</label>
            <div className="relative group">
            <CalendarIcon />
            <input
                type="date"
                value={formData.sale_date}
                onChange={(e) => setFormData({ ...formData, sale_date: e.target.value })}
                required
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all text-gray-700 font-medium group-hover:bg-white"
            />
            </div>
        </div>

        {/* 2. PRODUK (Native Select tapi Gacor Style) */}
        <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide ml-1">Produk</label>
            <div className="relative group">
            <select
                className="w-full pl-4 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl appearance-none focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all text-gray-700 font-medium cursor-pointer group-hover:bg-white"
                value={formData.product_id}
                onChange={handleProductChange}
                required
            >
                <option value="" disabled>-- Pilih Barang --</option>
                {products.length > 0 ? (
                products.map((p) => (
                    <option key={p.id} value={p.id} className="text-gray-900 py-2">
                    {p.name} {p.unit ? `(${p.unit})` : ''}
                    </option>
                ))
                ) : (
                <option value="" disabled>Memuat data...</option>
                )}
            </select>
            <ChevronDownIcon />
            </div>
        </div>

        {/* 3. QUANTITY (Clean Input, No Arrows, No Buttons) */}
        <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide ml-1">Jumlah (Qty)</label>
            <div className="relative">
            <input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                required
                placeholder="0"
                className="w-full py-4 px-4 bg-gray-50 border border-gray-200 rounded-xl text-center text-3xl font-bold text-gray-800 placeholder-gray-300 focus:ring-2 focus:ring-red-500 focus:border-transparent focus:bg-white outline-none transition-all 
                [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium pointer-events-none">
                PCS
            </span>
            </div>
        </div>

        {/* BUTTON SUBMIT */}
        <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transform transition-all active:scale-[0.98] ${
            loading
                ? "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none"
                : "bg-gradient-to-br from-red-600 to-red-700 text-white shadow-red-500/30 hover:shadow-red-600/40 hover:to-red-600"
            }`}
        >
            {loading ? (
            <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Menyimpan...
            </span>
            ) : (
            "Simpan Transaksi"
            )}
        </button>

        </form>
    </div>
    </div>
);
}