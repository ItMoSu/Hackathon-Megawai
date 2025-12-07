"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Line,
} from "recharts";
import { format, parseISO } from "date-fns";
import { Download, RefreshCcw, HelpCircle, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "./ui/Card";
import { Button } from "./ui/Button";
import { ProductIntelligence, ForecastPrediction } from "@/types/intelligence";
import { OnboardingModal } from "./OnboardingModal";
import { AlertCard } from "./AlertCard";
import { API_URL } from "@/lib/api";
import { getToken, handleAuthError, clearAuth } from "@/lib/auth";
import { logger } from "@/lib/logger";

type IntelligenceDashboardProps = {
  productId: string;
};

const numberFormatter = new Intl.NumberFormat("id-ID");

function formatDateLabel(dateStr: string) {
  try {
    return format(parseISO(dateStr), "EEE, d MMM");
  } catch {
    return dateStr;
  }
}

function buildBandData(predictions: ForecastPrediction[]) {
  return predictions.map((p) => {
    const lower =
      p.lower_bound !== undefined && p.lower_bound !== null
        ? p.lower_bound
        : p.predicted_quantity * 0.9;
    const upper =
      p.upper_bound !== undefined && p.upper_bound !== null
        ? p.upper_bound
        : p.predicted_quantity * 1.1;
    const d = new Date(p.date);
    const day = d.getDay();
    const isWeekend = day === 0 || day === 6;
    const dayOfMonth = d.getDate();
    const isPayday = dayOfMonth >= 25 || dayOfMonth <= 5;

    return {
      ...p,
      label: formatDateLabel(p.date),
      lower,
      upper,
      isWeekend,
      isPayday,
    };
  });
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
        ))}
      </div>
    </div>
  );
}

function friendlyConfidence(confidence: ProductIntelligence["confidence"]) {
  const overall = confidence?.overall || "MEDIUM";
  const pct = Math.round(
    ((confidence?.dataQuality || 0.6) * 0.6 + (confidence?.modelAgreement || 0.5) * 0.4) * 100,
  );
  return { overall, pct };
}

type ForecastDays = 7 | 14 | 30;

export function IntelligenceDashboard({ productId }: IntelligenceDashboardProps) {
  const [intelligence, setIntelligence] = useState<ProductIntelligence | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [forecastDays, setForecastDays] = useState<ForecastDays>(7);

  const fetchData = async () => {
    if (!productId) return;
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      if (!token) {
        throw new Error("Token tidak ditemukan. Silakan login ulang.");
      }

      const res = await fetch(
        `${API_URL}/api/intelligence/analyze/${productId}?days=${forecastDays}`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (res.status === 401 || res.status === 403) {
        clearAuth();
        if (typeof window !== 'undefined') {
          window.location.href = '/';
        }
        return;
      }

      if (!res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType?.includes('text/html')) {
          throw new Error("Route tidak ditemukan (404). Backend mungkin perlu restart.");
        }
        const errorText = await res.text();
        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(errorJson.error || `HTTP ${res.status}`);
        } catch {
          throw new Error(`HTTP ${res.status}: ${errorText.substring(0, 100)}`);
        }
      }

      const data = await res.json();
      if (!data?.success) {
        throw new Error(data?.error || "Gagal memuat intelijen produk");
      }
      setIntelligence(data.data);
      setLastUpdated(new Date());
    } catch (err: any) {
      logger.error('IntelligenceDashboard fetch error:', err);
      setError(err?.message || "Gagal memuat intelijen produk");
      setIntelligence(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setAlertDismissed(false);
  }, [productId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [productId, forecastDays]);

  const predictions = intelligence?.forecast?.predictions || [];
  const bandData = useMemo(() => buildBandData(predictions), [predictions]);

  const weekendAreas = useMemo(() => {
    const areas: { x1: string; x2: string }[] = [];
    bandData.forEach((item, idx) => {
      if (item.isWeekend) {
        const next = bandData[idx + 1];
        if (next) {
          areas.push({ x1: item.label, x2: next.label });
        }
      }
    });
    return areas;
  }, [bandData]);

  const dataQualityDays = Math.round((intelligence?.confidence?.dataQuality || 0) * 90);
  const friendlyConf = friendlyConfidence(
    intelligence?.confidence || { overall: "MEDIUM", dataQuality: 0.5, modelAgreement: 0.5 },
  );

  const total7d = intelligence?.forecast?.totalForecast7d || 0;
  const perDay = predictions.length ? total7d / predictions.length : total7d / 7;
  const trend = intelligence?.forecast?.trend || "STABLE";

  const pctChange = (() => {
    if (!intelligence?.realtime?.momentum) return 0;
    const ratio = intelligence.realtime.momentum.combined || 1;
    return Math.round((ratio - 1) * 100);
  })();

  const burst = intelligence?.realtime?.burst;

  const peakStrategy =
    intelligence?.recommendations?.[0]?.type === "PEAK_STRATEGY"
      ? (intelligence.recommendations[0] as any)
      : null;

  const recommendations = intelligence?.recommendations || [];
  const totalPrediction = Math.round(total7d);
  const avgPerDay = Math.round(perDay);
  const momentum = pctChange;
  const status = momentum <= -5 ? "MENURUN" : momentum >= 5 ? "NAIK" : "STABIL";
  const burstLevel = (burst?.severity || "NORMAL").toUpperCase();
  const burstScore = burst?.score || 0;
  const confidenceScore = Math.min(Math.max(friendlyConf.pct / 100, 0), 1);
  const chartData = bandData;
  const trendLabel =
    trend === "DECREASING"
      ? "📉 Menurun"
      : trend === "INCREASING"
      ? "📈 Meningkat"
      : "➡️ Stabil";
  const momentumText =
    momentum >= 0
      ? `Naik ${Math.abs(momentum).toFixed(0)}% vs 2 minggu lalu`
      : `Turun ${Math.abs(momentum).toFixed(0)}% vs 2 minggu lalu`;
  const isCriticalBurst = burstLevel === "CRITICAL" || burstLevel === "HIGH";
  const priority = isCriticalBurst || status === "MENURUN" ? "HIGH" : "NORMAL";
  const primaryRecommendation = recommendations[0];
  const getEmoji = (type?: string) => {
    if (!type) return "💡";
    if (type.includes("STOCK")) return "📦";
    if (type.includes("MARKETING")) return "📣";
    if (type.includes("PEAK")) return "⚡";
    return "💡";
  };

  const handleExportCSV = () => {
    if (!bandData.length) return;
    const rows = [
      ["date", "lower_bound", "predicted_quantity", "upper_bound", "confidence"].join(","),
      ...bandData.map((p) =>
        [
          p.date,
          p.lower?.toFixed(2),
          p.predicted_quantity?.toFixed(2),
          p.upper?.toFixed(2),
          p.confidence || "",
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `forecast_${productId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading && !intelligence) {
    return <Skeleton />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            <p className="text-base font-semibold">Gagal memuat intelijen.</p>
          </div>
          <p className="text-base text-gray-600">{error}</p>
          <Button onClick={fetchData} className="w-fit">
            Coba lagi
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!intelligence) return null;

  return (
    <div className="space-y-8">
      {(intelligence.realtime?.burst?.score || 0) > 2.5 && !alertDismissed && (
        <AlertCard
          productName={intelligence.productName || "Produk"}
          score={intelligence.realtime.burst.score}
          level={intelligence.realtime.burst.severity}
          onDismiss={() => setAlertDismissed(true)}
        />
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-black text-gray-900">
              Dashboard UMKM: {intelligence.productName || "Produk"}
            </h2>
            <button
              onClick={() => setShowOnboarding(true)}
              className="rounded-full border border-gray-200 bg-white p-2 text-gray-600 shadow-sm hover:bg-gray-50"
            >
              <HelpCircle className="h-6 w-6" />
            </button>
          </div>
          <p className="text-lg text-gray-700">
            Prediksi cerdas + rekomendasi bisnis untuk UMKM. {lastUpdated ? `Update ${lastUpdated.toLocaleTimeString("id-ID")}` : ""}
          </p>
          <p className="text-base text-gray-700">
            Data {dataQualityDays} hari | Akurasi ~{friendlyConf.pct}% | Kepercayaan {friendlyConf.overall}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={fetchData}
            className="flex items-center gap-2 rounded-full px-4 py-3 text-lg"
          >
            <RefreshCcw className="h-5 w-5" />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={handleExportCSV}
            className="flex items-center gap-2 rounded-full px-4 py-3 text-lg"
          >
            <Download className="h-5 w-5" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl shadow-md p-6 border-l-4 border-red-500">
          <div className="flex items-center gap-4">
            <div className="text-5xl">{status === "MENURUN" ? "📉" : status === "NAIK" ? "📈" : "➡️"}</div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-700 mb-1">Penjualan Anda</h3>
              <div
                className="text-3xl font-black"
                style={{
                  color: status === "MENURUN" ? "#DC2626" : status === "NAIK" ? "#16A34A" : "#374151",
                }}
              >
                {status === "MENURUN" ? "TURUN" : status === "NAIK" ? "NAIK" : "STABIL"}
              </div>
              <p className="text-sm text-gray-700 mt-1">{momentumText}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-md p-6 border-l-4 border-blue-500">
          <div className="flex items-center gap-4">
            <div className="text-5xl">{isCriticalBurst ? "🚨" : "✅"}</div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-700 mb-1">
                {isCriticalBurst ? "Viral Alert" : "Penjualan Normal"}
              </h3>
              <div className="text-3xl font-black text-blue-700">
                {isCriticalBurst ? `Lonjakan ${burstScore.toFixed(1)}x` : "Stabil"}
              </div>
              <p className="text-sm text-gray-700 mt-1">
                {isCriticalBurst ? "Penjualan hari ini jauh lebih tinggi dari biasanya." : "Tidak ada lonjakan mendadak."}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-md p-6 border-l-4 border-green-500">
          <div className="flex items-center gap-4">
            <div className="text-5xl">🎯</div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-700 mb-1">Tingkat Kepercayaan</h3>
              <div className="flex items-center gap-2 mb-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="w-3.5 h-3.5 rounded-full"
                    style={{
                      background: i <= Math.ceil(confidenceScore * 5) ? "#10B981" : "#D1D5DB",
                    }}
                  />
                ))}
              </div>
              <p className="text-2xl font-bold text-green-700">
                {confidenceScore > 0.8 ? "Sangat Akurat" : confidenceScore > 0.6 ? "Cukup Akurat" : "Perlu Data Lagi"}
              </p>
              <p className="text-sm text-gray-700">Berdasarkan {dataQualityDays} hari data</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-4">
          <div className="flex items-center gap-4">
            <h3 className="text-xl font-bold text-gray-900">📊 Prediksi {forecastDays} Hari ke Depan</h3>
            <div className="flex gap-1">
              {([7, 14, 30] as ForecastDays[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setForecastDays(d)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    forecastDays === d
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {d}H
                </button>
              ))}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Total Prediksi</p>
            <p className="text-2xl font-bold text-blue-600">{numberFormatter.format(totalPrediction)} porsi</p>
          </div>
        </div>
        <div className="h-[400px] w-full">
          {chartData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="band" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                {weekendAreas.map((area, idx) => (
                  <ReferenceArea
                    key={`${area.x1}-${idx}`}
                    x1={area.x1}
                    x2={area.x2}
                    fill="#fef3c7"
                    strokeOpacity={0}
                    fillOpacity={0.4}
                  />
                ))}
                {peakStrategy?.peak_info?.date && (
                  <ReferenceLine
                    x={peakStrategy.peak_info.date}
                    stroke="#ef4444"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    label={{ value: "PEAK", position: "top", fill: "#ef4444", fontSize: 14 }}
                  />
                )}
                <XAxis dataKey="label" tick={{ fontSize: 14, fontWeight: "bold" }} />
                <YAxis
                  tick={{ fontSize: 14, fontWeight: "bold" }}
                  tickFormatter={(v) => numberFormatter.format(v as number)}
                />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="lower"
                  stroke="none"
                  fill="#ffffff"
                  fillOpacity={1}
                />
                <Area
                  type="monotone"
                  dataKey="upper"
                  stroke="none"
                  fill="url(#band)"
                  fillOpacity={0.3}
                />
                <Line type="monotone" dataKey="predicted_quantity" stroke="#2563eb" strokeWidth={4} dot={{ r: 6 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-lg font-semibold text-gray-500">
              Tidak ada data forecast.
            </div>
          )}
        </div>
        <div className="mt-6 flex justify-center gap-6 text-lg">
          <div className="flex items-center gap-2">
            <div className="w-6 h-1 bg-blue-500" />
            <span className="font-semibold">Prediksi</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">📦 Ringkasan Prediksi</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4 text-center">
              <p className="text-sm text-gray-600 mb-1">Total 7 Hari</p>
              <p className="text-3xl font-bold text-blue-600">{numberFormatter.format(totalPrediction)}</p>
              <p className="text-xs text-gray-500 mt-1">porsi</p>
            </div>
            <div className="bg-white rounded-lg p-4 text-center">
              <p className="text-sm text-gray-600 mb-1">Rata-rata/Hari</p>
              <p className="text-3xl font-bold text-green-600">{numberFormatter.format(avgPerDay)}</p>
              <p className="text-xs text-gray-500 mt-1">porsi</p>
            </div>
            <div className="bg-white rounded-lg p-4 text-center">
              <p className="text-sm text-gray-600 mb-1">Trend</p>
              <p className="text-2xl font-bold" style={{ color: trend === "DECREASING" ? "#DC2626" : "#16A34A" }}>
                {trend === "DECREASING" ? "📉 Turun" : trend === "INCREASING" ? "📈 Naik" : "➡️ Stabil"}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span
              className="px-3 py-1 rounded-full text-sm font-semibold"
              style={{
                background: priority === "HIGH" ? "#FEE2E2" : "#DBEAFE",
                color: priority === "HIGH" ? "#DC2626" : "#2563EB",
              }}
            >
              Priority: {priority}
            </span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">🎯 Saran untuk Anda</h3>
          {primaryRecommendation ? (
            <div className="bg-white rounded-lg p-5">
              <div className="flex items-start gap-3 mb-3">
                <span className="text-3xl">{getEmoji(primaryRecommendation.type)}</span>
                <div className="flex-1">
                  <h4 className="text-lg font-bold text-purple-700 mb-2">{primaryRecommendation.message}</h4>
                  <ul className="space-y-2">
                    {(primaryRecommendation.suggestions || primaryRecommendation.details)?.map((item: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-green-600 font-bold">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg p-5">
              <p className="text-base font-semibold text-gray-700 mb-3">
                {trend === "DECREASING"
                  ? "⚠️ Penjualan menurun, tingkatkan aktivitas promosi"
                  : "✅ Penjualan stabil, pertahankan kualitas"}
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                {trend === "DECREASING" ? (
                  <>
                    <li>• Buat promo bundling atau diskon terbatas</li>
                    <li>• Aktif posting di media sosial</li>
                    <li>• Cek harga kompetitor</li>
                  </>
                ) : (
                  <>
                    <li>• Jaga konsistensi kualitas produk</li>
                    <li>• Pastikan stok selalu tersedia</li>
                    <li>• Tingkatkan layanan pelanggan</li>
                  </>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>

      <OnboardingModal open={showOnboarding} onClose={() => setShowOnboarding(false)} />
    </div>
  );
}
