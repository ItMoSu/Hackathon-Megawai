"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import Navbar from '@/components/ui/Navbar';
import { useRouter } from 'next/navigation';
import { 
  Trophy, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Zap,
  RefreshCcw,
  Loader2,
  Crown,
  Medal,
  Award,
  BarChart3,
  AlertTriangle,
  ChevronRight
} from 'lucide-react';

interface RankedProduct {
  productId: string;
  productName: string;
  priorityScore: number;
  momentum: { combined: number; status: string };
  burst: { score: number; level: string };
  avgQuantity: number;
}

export default function RankingPage() {
  const router = useRouter();
  const [rankings, setRankings] = useState<RankedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  const fetchRankings = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const res = await fetch('http://localhost:5000/api/analytics/ranking', {
        headers: getAuthHeaders()
      });

      if (res.status === 401) {
        router.push('/login');
        return;
      }

      const data = await res.json();
      if (data.success) {
        const rankedProducts: RankedProduct[] = (data.rankings || []).map((item: any) => ({
          productId: item.productId || item.product_id,
          productName: item.productName || item.product_name || 'Product',
          priorityScore: item.priorityScore || item.priority_score || 0,
          momentum: item.momentum || { combined: 1, status: 'STABLE' },
          burst: item.burst || { score: 0, level: 'NORMAL' },
          avgQuantity: item.avgQuantity || item.avg_quantity || 0,
        }));

        rankedProducts.sort((a, b) => b.priorityScore - a.priorityScore);
        setRankings(rankedProducts);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Error fetching rankings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRankings();
  }, []);

  const getStatusBadge = (status: string) => {
    const config: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
      'TRENDING_UP': { color: 'bg-green-100 text-green-700', text: 'Trending', icon: <TrendingUp className="w-3 h-3" /> },
      'GROWING': { color: 'bg-emerald-100 text-emerald-700', text: 'Growing', icon: <TrendingUp className="w-3 h-3" /> },
      'STABLE': { color: 'bg-gray-100 text-gray-600', text: 'Stable', icon: <Minus className="w-3 h-3" /> },
      'DECLINING': { color: 'bg-orange-100 text-orange-700', text: 'Declining', icon: <TrendingDown className="w-3 h-3" /> },
      'FALLING': { color: 'bg-red-100 text-red-700', text: 'Falling', icon: <TrendingDown className="w-3 h-3" /> },
    };

    const cfg = config[status] || config['STABLE'];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
        {cfg.icon}
        {cfg.text}
      </span>
    );
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Award className="w-5 h-5 text-amber-600" />;
    return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-gray-400">{rank}</span>;
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Trophy className="w-7 h-7 text-yellow-500" />
              Product Ranking
            </h1>
            <p className="text-gray-500 mt-1">Ranking berdasarkan AI priority score</p>
            {lastUpdated && (
              <p className="text-xs text-gray-400 mt-1">
                Update: {lastUpdated.toLocaleTimeString('id-ID')}
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={fetchRankings}>
            <RefreshCcw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {rankings.length === 0 ? (
          <Card className="p-8 text-center">
            <BarChart3 className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Belum ada data</h3>
            <p className="text-gray-500 mb-4">Tambahkan produk dan data penjualan</p>
            <Button onClick={() => router.push('/products')}>Tambah Produk</Button>
          </Card>
        ) : (
          <>
            {/* Top 3 Cards */}
            {rankings.length >= 3 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                {rankings.slice(0, 3).map((product, index) => (
                  <Card 
                    key={product.productId}
                    className={`cursor-pointer hover:shadow-md transition ${
                      index === 0 ? 'border-2 border-yellow-400 bg-yellow-50' :
                      index === 1 ? 'border-2 border-gray-300 bg-gray-50' :
                      'border-2 border-amber-400 bg-amber-50'
                    }`}
                    onClick={() => router.push(`/dashboard?product=${product.productId}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        {getRankIcon(index + 1)}
                        {getStatusBadge(product.momentum.status)}
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-2 truncate">{product.productName}</h3>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-gray-500 text-xs">Priority</p>
                          <p className="font-bold text-red-600">{(product.priorityScore * 100).toFixed(0)}%</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Momentum</p>
                          <p className={`font-bold ${
                            product.momentum.combined > 1 ? 'text-green-600' : 
                            product.momentum.combined < 1 ? 'text-red-600' : 'text-gray-600'
                          }`}>
                            {((product.momentum.combined - 1) * 100).toFixed(0)}%
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Full Table */}
            <Card>
              <CardHeader className="border-b pb-3">
                <h2 className="font-semibold text-gray-900">Ranking Lengkap</h2>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-16">#</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Produk</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Momentum</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Priority</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-16">Alert</th>
                        <th className="px-4 py-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rankings.map((product, index) => (
                        <tr
                          key={product.productId}
                          className="hover:bg-gray-50 cursor-pointer transition"
                          onClick={() => router.push(`/dashboard?product=${product.productId}`)}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center">
                              {getRankIcon(index + 1)}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{product.productName}</p>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {getStatusBadge(product.momentum.status)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`font-medium ${
                              product.momentum.combined > 1 ? 'text-green-600' : 
                              product.momentum.combined < 1 ? 'text-red-600' : 'text-gray-600'
                            }`}>
                              {product.momentum.combined > 1 ? '+' : ''}
                              {((product.momentum.combined - 1) * 100).toFixed(0)}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-red-500 rounded-full"
                                  style={{ width: `${Math.min(product.priorityScore * 100, 100)}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium text-gray-600 w-8">
                                {(product.priorityScore * 100).toFixed(0)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {product.burst.level !== 'NORMAL' && product.burst.score > 1.5 ? (
                              <AlertTriangle className="w-4 h-4 text-orange-500 mx-auto" />
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Legend */}
            <div className="mt-6 flex flex-wrap gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                <span>Trending/Growing</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-gray-400"></span>
                <span>Stable</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                <span>Declining</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                <span>Burst Alert</span>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
