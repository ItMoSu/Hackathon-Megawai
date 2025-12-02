"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function SalesForm() {
const [loading, setLoading] = useState(false);
const [message, setMessage] = useState("");
const [isError, setIsError] = useState(false);

    const [formData, setFormData] = useState({
    product_name: "Baranglu", 
    quantity: 0,
    sale_date: new Date().toISOString().split("T")[0],
});

const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}` 
    };
};

const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setIsError(false);

    const token = localStorage.getItem("token");
    if (!token) {
        setMessage("❌ Anda belum login! Token tidak ditemukan.");
        setIsError(true);
        setLoading(false);
        return;
    }

    if (formData.quantity < 0) {
        setMessage("Quantity tidak boleh negatif, Bang!");
        setIsError(true);
        setLoading(false);
        return;
    }

    try {
        const res = await fetch("http://localhost:5000/api/sales", {
        method: "POST",
        headers: getAuthHeaders(), 
        body: JSON.stringify(formData),
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.error || "Gagal simpan");
        setMessage("✅ Data berhasil disimpan!");
        setFormData({ ...formData, quantity: 0, product_name: "" });

    } catch (err) {
        const errorMessage = (err as Error).message || "Terjadi kesalahan";
        setMessage("❌ Error: " + errorMessage);
        setIsError(true);
    } finally {
        setLoading(false);
    }
};

    return (
        <Card className="p-4 shadow-lg">
        <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
            {message && (
                <div className={`p-3 rounded text-sm ${isError ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                {message}
                </div>
            )}

            <div>
                <label className="block text-sm font-medium mb-1">Tanggal</label>
                <Input
                type="date"
                value={formData.sale_date}
                onChange={(e) => setFormData({ ...formData, sale_date: e.target.value })}
                required
                />
            </div>
            <div>
                <label className="block text-sm font-medium mb-1">Nama Produk</label>
                <Input
                type="text"
                placeholder="Contoh: Kopi Susu"
                value={formData.product_name}
                onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                required
                />
            </div>
            <div>
                <label className="block text-sm font-medium mb-1">Quantity</label>
                <Input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                required
                />
            </div>

            <Button type="submit" className="w-full" isLoading={loading}>
                Simpan Data
            </Button>
            </form>
        </CardContent>
        </Card>
    );
}