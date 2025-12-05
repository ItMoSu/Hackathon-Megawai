"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { AlertTriangle, Trophy, Calendar, TrendingUp, DollarSign } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api';
import Navbar from '@/components/ui/Navbar';

export default function ReportsPage() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetchWithAuth('http://localhost:5000/api/reports/weekly');
        const data = await res.json();
        if (data.success) {
          setReport(data.data);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) return <div className="p-8 text-center">Menyiapkan laporan...</div>;
  if (!report) return <div className="p-8 text-center">Gagal memuat laporan.</div>;

  return (
<div className="min-h-screen bg-gray-50 text-slate-900 selection:bg-red-600 selection:text-white">    <Navbar />
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Weekly Report</h1>
            <div className="flex items-center gap-2 text-gray-500 mt-1">
                <Calendar className="h-4 w-4" />
                <span className="text-sm">Periode: {report.dateRange.start} s/d {report.dateRange.end}</span>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-6 flex items-center gap-4">
                    <div className="p-3 bg-blue-100 rounded-full text-blue-600">
                        <TrendingUp className="h-8 w-8" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-600 font-medium">Total Terjual</p>
                        <p className="text-3xl font-bold text-gray-900">{report.summary.totalQuantity} <span className="text-base font-normal text-gray-500">items</span></p>
                    </div>
                </CardContent>
            </Card>
            <Card className="bg-green-50 border-green-200">
                <CardContent className="p-6 flex items-center gap-4">
                    <div className="p-3 bg-green-100 rounded-full text-green-600">
                        <DollarSign className="h-8 w-8" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-600 font-medium">Estimasi Revenue</p>
                        <p className="text-3xl font-bold text-gray-900">Rp {report.summary.totalRevenue.toLocaleString('id-ID')}</p>
                    </div>
                </CardContent>
            </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Top Performers */}
            <Card>
                <CardHeader className="pb-3 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-yellow-500" />
                        <h3 className="text-lg font-bold text-gray-900">Produk Terlaris</h3>
                    </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                    {report.topPerformers.length === 0 ? (
                        <p className="text-gray-500 text-sm">Belum ada data penjualan.</p>
                    ) : (
                        report.topPerformers.map((prod: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${idx === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                                        {idx + 1}
                                    </span>
                                    <span className="font-medium text-gray-800">{prod.name}</span>
                                </div>
                                <Badge variant="secondary" className="font-mono">
                                    {prod.quantity} sold
                                </Badge>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>

            {/* Attention Needed */}
            <Card className="border-l-4 border-l-red-500">
                <CardHeader className="pb-3 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                        <h3 className="text-lg font-bold text-gray-900">Perlu Perhatian</h3>
                    </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                    {report.attentionNeeded.length === 0 ? (
                        <div className="text-center py-4">
                            <p className="text-green-600 font-medium text-sm">✨ Semua produk aman!</p>
                            <p className="text-gray-400 text-xs">Tidak ada anomali atau penurunan drastis.</p>
                        </div>
                    ) : (
                        report.attentionNeeded.map((item: any, idx: number) => (
                            <div key={idx} className="bg-red-50 p-3 rounded-lg border border-red-100">
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-bold text-gray-900">{item.name}</span>
                                    <Badge className={item.status === 'VIRAL SPIKE' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}>
                                        {item.status}
                                    </Badge>
                                </div>
                                <p className="text-sm text-gray-600">{item.detail}</p>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>

        </div>
      </div>
    </div>
  );
}