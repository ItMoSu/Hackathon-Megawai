"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { 
  AlertTriangle, 
  Trophy, 
  Calendar, 
  TrendingUp, 
  TrendingDown,
  DollarSign, 
  Package,
  RefreshCcw,
  Loader2,
  ChevronRight
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/api';
import Navbar from '@/components/ui/Navbar';
import { useRouter } from 'next/navigation';

interface TopPerformer {
  id: string;
  name: string;
  quantity: number;
}

interface AttentionItem {
  name: string;
  date: string;
  status: string;
  detail: string;
}

interface WeeklyReport {
  dateRange: { start: string; end: string };
  summary: { totalQuantity: number; totalRevenue: number };
  topPerformers: TopPerformer[];
  attentionNeeded: AttentionItem[];
}

interface ReportData {
  dateRange: {
    start: string;
    end: string;
  };
  summary: {
    totalQuantity: number;
    totalRevenue: number;
    quantityChange?: number;
    revenueChange?: number;
  };
  dailyData?: Array<{
    date: string;
    quantity: number;
    revenue: number;
  }>;
  topPerformers: Array<{
    id?: string;
    name: string;
    quantity: number;
    revenue?: number;
    momentum?: string;
    momentumValue?: number;
  }>;
  attentionNeeded: Array<{
    id?: string;
    name: string;
    date?: string;
    status: string;
    detail: string;
    priority?: string;
  }>;
  insights?: string[];
  statusCounts?: {
    trending_up: number;
    growing: number;
    stable: number;
    declining: number;
    falling: number;
  };
}

export default function ReportsPage() {
  const router = useRouter();
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth('http://localhost:5000/api/reports/weekly');
      const data = await res.json();
      if (data.success) {
        setReport(data.data);
      } else {
        setError(data.error || 'Gagal memuat laporan');
      }
    } catch (err) {
      setError('Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

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

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
          <p className="text-gray-700 mb-4">{error}</p>
          <Button onClick={loadReport}>Coba Lagi</Button>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <Package className="w-12 h-12 text-gray-300 mb-4" />
          <p className="text-gray-500">Belum ada data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Weekly Report</h1>
            <div className="flex items-center gap-2 text-gray-500 mt-1">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">
                {formatDate(report.dateRange.start)} - {formatDate(report.dateRange.end)}
              </span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={loadReport}>
            <RefreshCcw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-full">
                  <Package className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Terjual</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {report.summary.totalQuantity.toLocaleString('id-ID')} 
                    <span className="text-sm font-normal text-gray-500 ml-1">items</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-full">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(report.summary.totalRevenue)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Performers */}
          <Card>
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                <h3 className="font-semibold text-gray-900">Produk Terlaris</h3>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {report.topPerformers.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                  <p className="text-gray-500 text-sm">Belum ada data</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {report.topPerformers.map((prod, idx) => (
                    <div 
                      key={prod.id}
                      className="flex items-center justify-between p-4 hover:bg-gray-50 cursor-pointer transition"
                      onClick={() => router.push(`/dashboard?product=${prod.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                          idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                          idx === 1 ? 'bg-gray-100 text-gray-600' :
                          idx === 2 ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-50 text-gray-400'
                        }`}>
                          {idx + 1}
                        </span>
                        <span className="font-medium text-gray-900">{prod.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{prod.quantity} sold</Badge>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Attention Needed */}
          <Card className="border-l-4 border-l-red-500">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <h3 className="font-semibold text-gray-900">Perlu Perhatian</h3>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {report.attentionNeeded.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-xl">✨</span>
                  </div>
                  <p className="text-green-600 font-medium">Semua aman!</p>
                  <p className="text-gray-400 text-sm mt-1">Tidak ada masalah</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {report.attentionNeeded.map((item, idx) => (
                    <div key={idx} className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <span className="font-medium text-gray-900">{item.name}</span>
                        <Badge className={
                          item.status === 'VIRAL SPIKE' 
                            ? 'bg-orange-100 text-orange-700' 
                            : 'bg-red-100 text-red-700'
                        }>
                          {item.status === 'VIRAL SPIKE' ? (
                            <><TrendingUp className="w-3 h-3 mr-1" /> Lonjakan</>
                          ) : (
                            <><TrendingDown className="w-3 h-3 mr-1" /> Menurun</>
                          )}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">{item.detail}</p>
                      <p className="text-xs text-gray-400 mt-1">{formatDate(item.date)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="mt-8 bg-gray-900 text-white border-0">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="font-semibold mb-1">Lihat analisis lebih detail</h3>
                <p className="text-gray-400 text-sm">Dashboard AI untuk prediksi dan rekomendasi</p>
              </div>
              <div className="flex gap-3">
                <Button 
                  variant="secondary"
                  className="bg-white text-gray-900 hover:bg-gray-100"
                  onClick={() => router.push('/dashboard')}
                >
                  Dashboard
                </Button>
                <Button 
                  variant="outline"
                  className="border-gray-600 text-white hover:bg-gray-800"
                  onClick={() => router.push('/ranking')}
                >
                  Ranking
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
