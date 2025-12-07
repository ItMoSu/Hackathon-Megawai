"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { AlertTriangle, Trophy, Calendar, TrendingUp, TrendingDown, DollarSign, Package, Lightbulb, BarChart3, ArrowUpRight, ArrowDownRight, Minus, RefreshCcw } from 'lucide-react';
import { fetchWithAuth, API_URL } from '@/lib/api';
import { logger } from '@/lib/logger';
import Navbar from '@/components/ui/Navbar';

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
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/reports/weekly`);
      const data = await res.json();
      if (data.success) {
        setReport(data.data);
      } else {
        setError(data.error || 'Gagal memuat data');
      }
    } catch (err) {
      logger.error('Reports fetch error:', err);
      setError('Gagal menghubungi server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatRupiah = (num: number) => {
    if (!num && num !== 0) return 'Rp 0';
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num);
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('id-ID', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      });
    } catch {
      return dateStr;
    }
  };

  const getMomentumIcon = (momentum?: string) => {
    if (!momentum) return <Minus className="w-4 h-4 text-gray-400" />;
    switch (momentum) {
      case 'TRENDING_UP':
      case 'GROWING':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'FALLING':
      case 'DECLINING':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  const getMomentumBadge = (momentum?: string, value?: number) => {
    if (!momentum) return <Badge className="bg-gray-100 text-gray-600">➡️ Stabil</Badge>;
    const pct = ((value || 0) * 100).toFixed(1);
    switch (momentum) {
      case 'TRENDING_UP':
        return <Badge className="bg-green-100 text-green-700">📈 +{pct}%</Badge>;
      case 'GROWING':
        return <Badge className="bg-emerald-50 text-emerald-600">↗ +{pct}%</Badge>;
      case 'FALLING':
        return <Badge className="bg-red-100 text-red-700">📉 {pct}%</Badge>;
      case 'DECLINING':
        return <Badge className="bg-orange-100 text-orange-700">↘ {pct}%</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-600">➡️ Stabil</Badge>;
    }
  };

  const getPriorityBadge = (priority?: string, status?: string) => {
    const displayStatus = status || 'Unknown';
    switch (priority) {
      case 'critical':
        return <Badge className="bg-red-500 text-white animate-pulse">🔥 {displayStatus}</Badge>;
      case 'high':
        return <Badge className="bg-orange-500 text-white">⚡ {displayStatus}</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-700">⚠️ {displayStatus}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
          <span className="ml-3 text-gray-600">Menyiapkan laporan...</span>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-5xl mx-auto px-4 py-8 text-center">
          <div className="bg-white rounded-lg shadow p-8">
            <AlertTriangle className="w-12 h-12 text-orange-500 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">{error || 'Gagal memuat laporan.'}</p>
            <Button onClick={loadData}>Coba Lagi</Button>
          </div>
        </div>
      </div>
    );
  }

  // Safe defaults
  const statusCounts = report.statusCounts || { trending_up: 0, growing: 0, stable: 0, declining: 0, falling: 0 };
  const totalStatusCount = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const dailyData = report.dailyData || [];
  const insights = report.insights || [];
  const quantityChange = report.summary.quantityChange ?? 0;
  const revenueChange = report.summary.revenueChange ?? 0;

  return (
    <div className="min-h-screen bg-gray-50 text-slate-900 selection:bg-red-600 selection:text-white">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Laporan Mingguan</h1>
            <div className="flex items-center gap-2 text-gray-500 mt-1">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">
                Periode: {formatDate(report.dateRange.start)} - {formatDate(report.dateRange.end)}
              </span>
            </div>
          </div>
          <Button variant="outline" onClick={loadData} className="flex items-center gap-2">
            <RefreshCcw className="w-4 h-4" />
            Refresh
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-200 rounded-full text-blue-700">
                  <Package className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 font-medium">Total Terjual</p>
                  <p className="text-2xl font-bold text-gray-900">{report.summary.totalQuantity || 0}</p>
                  {quantityChange !== 0 && (
                    <div className={`flex items-center text-xs mt-1 ${quantityChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {quantityChange >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      <span>{Math.abs(quantityChange)}% vs minggu lalu</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-200 rounded-full text-green-700">
                  <DollarSign className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 font-medium">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">{formatRupiah(report.summary.totalRevenue || 0)}</p>
                  {revenueChange !== 0 && (
                    <div className={`flex items-center text-xs mt-1 ${revenueChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {revenueChange >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      <span>{Math.abs(revenueChange)}% vs minggu lalu</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-200 rounded-full text-purple-700">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 font-medium">Produk Naik</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {statusCounts.trending_up + statusCounts.growing}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">dari {totalStatusCount} produk</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-orange-200 rounded-full text-orange-700">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 font-medium">Perlu Perhatian</p>
                  <p className="text-2xl font-bold text-gray-900">{report.attentionNeeded?.length || 0}</p>
                  <p className="text-xs text-gray-500 mt-1">produk butuh aksi</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* AI Insights */}
        {insights.length > 0 && (
          <Card className="border-l-4 border-l-yellow-500">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                <h3 className="text-lg font-bold text-gray-900">AI Insights</h3>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {insights.map((insight, idx) => (
                  <div key={idx} className="p-3 bg-yellow-50 rounded-lg text-sm text-gray-700">
                    {insight}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Sales - Simple Bar Visual */}
          <Card>
            <CardHeader className="pb-2 border-b">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-gray-500" />
                <h3 className="font-bold text-gray-900">Penjualan Harian</h3>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {dailyData.length > 0 ? (
                <div className="space-y-3">
                  {dailyData.map((day, idx) => {
                    const maxQty = Math.max(...dailyData.map(d => d.quantity), 1);
                    const pct = (day.quantity / maxQty) * 100;
                    return (
                      <div key={idx}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">{formatDate(day.date)}</span>
                          <span className="font-medium text-gray-900">{day.quantity} item</span>
                        </div>
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-red-500 transition-all duration-500 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <BarChart3 className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>Belum ada data harian</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status Distribution */}
          <Card>
            <CardHeader className="pb-2 border-b">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-gray-500" />
                <h3 className="font-bold text-gray-900">Distribusi Status Produk</h3>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-4">
                {[
                  { label: 'Trending Up', count: statusCounts.trending_up, color: 'bg-green-500', emoji: '📈' },
                  { label: 'Growing', count: statusCounts.growing, color: 'bg-emerald-400', emoji: '↗' },
                  { label: 'Stable', count: statusCounts.stable, color: 'bg-gray-400', emoji: '➡️' },
                  { label: 'Declining', count: statusCounts.declining, color: 'bg-orange-400', emoji: '↘' },
                  { label: 'Falling', count: statusCounts.falling, color: 'bg-red-500', emoji: '📉' },
                ].map((item) => {
                  const pct = totalStatusCount > 0 ? (item.count / totalStatusCount) * 100 : 0;
                  
                  return (
                    <div key={item.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">{item.emoji} {item.label}</span>
                        <span className="font-medium text-gray-900">{item.count} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${item.color} transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Two Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Top Performers */}
          <Card>
            <CardHeader className="pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                <h3 className="text-lg font-bold text-gray-900">Top Performers</h3>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {!report.topPerformers || report.topPerformers.length === 0 ? (
                <div className="text-center py-8">
                  <Trophy className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p className="text-gray-500 text-sm">Belum ada data penjualan.</p>
                </div>
              ) : (
                report.topPerformers.slice(0, 5).map((prod, idx) => (
                  <div key={prod.id || idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                        idx === 0 ? 'bg-yellow-100 text-yellow-700' : 
                        idx === 1 ? 'bg-gray-200 text-gray-700' : 
                        idx === 2 ? 'bg-orange-100 text-orange-700' : 
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {idx + 1}
                      </span>
                      <div>
                        <span className="font-medium text-gray-800">{prod.name}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          {getMomentumIcon(prod.momentum)}
                          <span className="text-xs text-gray-500">{prod.quantity} terjual</span>
                        </div>
                      </div>
                    </div>
                    {getMomentumBadge(prod.momentum, prod.momentumValue)}
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
            <CardContent className="pt-4 space-y-3">
              {!report.attentionNeeded || report.attentionNeeded.length === 0 ? (
                <div className="text-center py-6">
                  <div className="text-4xl mb-2">✨</div>
                  <p className="text-green-600 font-medium text-sm">Semua produk aman!</p>
                  <p className="text-gray-400 text-xs">Tidak ada anomali atau penurunan drastis.</p>
                </div>
              ) : (
                report.attentionNeeded.map((item, idx) => (
                  <div key={idx} className={`p-3 rounded-lg border ${
                    item.priority === 'critical' ? 'bg-red-50 border-red-200' :
                    item.priority === 'high' ? 'bg-orange-50 border-orange-200' :
                    'bg-yellow-50 border-yellow-200'
                  }`}>
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-bold text-gray-900">{item.name}</span>
                      {getPriorityBadge(item.priority, item.status)}
                    </div>
                    <p className="text-sm text-gray-600">{item.detail}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

        </div>

        {/* Full Product Breakdown */}
        {report.topPerformers && report.topPerformers.length > 0 && (
          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-gray-500" />
                  <h3 className="font-bold text-gray-900">Detail Produk Minggu Ini</h3>
                </div>
                <Badge variant="secondary">{report.topPerformers.length} produk</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produk</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {report.topPerformers.map((prod, idx) => (
                      <tr key={prod.id || idx} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-500">{idx + 1}</td>
                        <td className="px-6 py-4">
                          <span className="font-medium text-gray-900">{prod.name}</span>
                        </td>
                        <td className="px-6 py-4 text-sm text-right font-medium text-gray-900">
                          {prod.quantity}
                        </td>
                        <td className="px-6 py-4 text-sm text-right text-gray-600">
                          {formatRupiah(prod.revenue || 0)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {getMomentumBadge(prod.momentum, prod.momentumValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
