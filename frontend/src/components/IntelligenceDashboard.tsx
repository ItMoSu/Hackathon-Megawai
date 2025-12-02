"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Line,
} from "recharts";
import { format, parseISO } from "date-fns";
import { Activity, AlertTriangle, Download, RefreshCcw, Sparkles, HelpCircle } from "lucide-react";
import { Card, CardContent, CardHeader } from "./ui/Card";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { ProductIntelligence, ForecastPrediction } from "@/types/intelligence";
import { InfoTooltip } from "./InfoTooltip";
import { OnboardingModal } from "./OnboardingModal";
import { ActionCard } from "./ActionCard";
import { AlertCard } from "./AlertCard";

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

export function IntelligenceDashboard({ productId }: IntelligenceDashboardProps) {
  const [intelligence, setIntelligence] = useState<ProductIntelligence | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  const [alertDismissed, setAlertDismissed] = useState(false); 

  const fetchData = async () => {
    if (!productId) return;
    setLoading(true);
    setError(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const res = await fetch(
        `http://localhost:5000/api/intelligence/analyze/${productId}`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
        },
      );
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Gagal memuat intelijen produk");
      }
      setIntelligence(data.data);
      setLastUpdated(new Date());
    } catch (err: any) {
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
  }, [productId]);

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

  const peak = bandData.reduce(
    (acc, cur) => (cur && acc && cur.predicted_quantity > acc.predicted_quantity ? cur : acc),
    bandData[0] || null,
  );

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
  const isViral = burst?.severity === "CRITICAL" || burst?.severity === "HIGH";

  const peakStrategy =
    intelligence?.recommendations?.[0]?.type === "PEAK_STRATEGY"
      ? (intelligence.recommendations[0] as any)
      : null;

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
            <p className="text-sm font-semibold">Gagal memuat intelijen.</p>
          </div>
          <p className="text-sm text-gray-600">{error}</p>
          <Button onClick={fetchData} className="w-fit">
            Coba lagi
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!intelligence) return null;

  return (
    <div className="space-y-6">
      {/* ALERT COMPONENT  */}
      {intelligence.realtime.burst.score > 2.5 && !alertDismissed && (
        <AlertCard 
          productName={intelligence.productName || "Produk"}
          score={intelligence.realtime.burst.score}
          level={intelligence.realtime.burst.severity}
          onDismiss={() => setAlertDismissed(true)}
        />
      )}

      {/* HEADER DASHBOARD */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-gray-900">
              Intelligence: {intelligence.productName || "Produk"}
            </h2>
            <button
              onClick={() => setShowOnboarding(true)}
              className="rounded-full border border-gray-200 bg-white p-1 text-gray-500 hover:bg-gray-50"
            >
              <HelpCircle className="h-5 w-5" />
            </button>
          </div>
          <p className="text-sm text-gray-500">
            Bahasa santai + aksi cepat. {lastUpdated ? `Update ${lastUpdated.toLocaleTimeString()}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ConfidenceBadge level={intelligence.confidence.overall} />
          <Badge variant="outline" className="text-xs">
            Data: ~{dataQualityDays} hari
          </Badge>
          <Badge variant="secondary" className="text-xs">
            Akurasi +/-{friendlyConf.pct}%
          </Badge>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              className="flex items-center gap-2"
            >
              <RefreshCcw className="h-4 w-4" /> Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>
        </div>
      </div>

      {/* METRICS CARDS */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Status Penjualan */}
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-gray-400">Status Penjualan</p>
              <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900">
                {pctChange < -5 ? "📉 Penjualan Menurun" : pctChange > 5 ? "📈 Penjualan Naik" : "⚖️ Penjualan Stabil"}
                <InfoTooltip message="Kami bandingkan penjualan 7 hari terakhir vs 14 hari sebelumnya." />
              </h3>
              <p className="text-sm text-gray-600">
                {pctChange < 0
                  ? `Dibanding 2 minggu lalu, penjualan turun ${Math.abs(pctChange)}%.`
                  : pctChange > 0
                  ? `Naik ${pctChange}% dibanding 2 minggu lalu.`
                  : "Sama seperti 2 minggu lalu."}
              </p>
            </div>
            <Activity className="h-8 w-8 text-blue-500" />
          </CardHeader>
        </Card>

        {/* Deteksi Lonjakan */}
        <Card className={`border-l-4 ${isViral ? "border-l-red-500" : "border-l-emerald-500"}`}>
          <CardHeader className="flex flex-row items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-gray-400">Deteksi Lonjakan</p>
              <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900">
                {isViral ? "🚨 Viral Alert" : "✅ Penjualan Normal"}
                <InfoTooltip message="Kami cek apakah ada viral spike atau lonjakan tiba-tiba." />
              </h3>
              {isViral ? (
                <div className="space-y-2">
                  <p className="text-sm text-red-700">
                    Penjualan hari ini {burst?.score}x lebih tinggi dari biasanya.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-600">Tidak ada lonjakan mendadak. Semuanya terkendali.</p>
              )}
            </div>
            <AlertTriangle className={`h-8 w-8 ${isViral ? "text-red-500" : "text-emerald-500"}`} />
          </CardHeader>
        </Card>

        {/* Tingkat Kepercayaan */}
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-gray-400">Tingkat Kepercayaan</p>
              <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900">
                {friendlyConf.pct >= 75 ? "Prediksi Akurat" : friendlyConf.pct >= 60 ? "Cukup Akurat" : "Perlu Hati-hati"}
                <InfoTooltip message="Semakin lama Anda pakai sistem ini, semakin akurat." />
              </h3>
              <p className="text-sm text-gray-600">
                Data {dataQualityDays} hari → akurasi ~{friendlyConf.pct}%.
              </p>
            </div>
            <Sparkles className="h-8 w-8 text-purple-500" />
          </CardHeader>
        </Card>
      </div>

      {/* CHART FORECAST */}
      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              📊 Prediksi 7 Hari ke Depan
            </h3>
            <p className="text-sm text-gray-500">Bahasa sederhana, langsung bisa dipakai.</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            💡 Cara baca: Garis biru = prediksi paling mungkin. Area hijau muda = rentang naik-turun.
          </div>
          <div className="h-80 w-full">
            {bandData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={bandData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
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
                  {peakStrategy && (
                    <ReferenceLine
                      x={peakStrategy.peak_info.date}
                      stroke="#ef4444"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      label={{ value: "⚠️ PEAK", position: "top", fill: "#ef4444", fontSize: 11 }}
                    />
                  )}
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => numberFormatter.format(v as number)} />
                  <Tooltip />
                  <Area type="monotone" dataKey="upper" stroke="none" baseLine={(d: any) => d?.lower} fill="url(#band)" fillOpacity={0.3} />
                  <Line type="monotone" dataKey="predicted_quantity" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-gray-500">Tidak ada data forecast.</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* RECOMMENDATIONS */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">📈 Ringkasan Prediksi</h3>
            <ConfidenceBadge level={intelligence.confidence.overall} />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-gray-50 px-4 py-3">
              <p className="text-xs uppercase text-gray-500">Total 7 hari</p>
              <p className="text-3xl font-bold text-gray-900">📦 {numberFormatter.format(Math.round(total7d))} porsi</p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Tren</span>
              <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                {trend}
              </span>
            </div>
            <Button className="w-full">Buat Rencana Stok</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">🎯 Saran untuk Anda</h3>
            <Badge variant="secondary" className="text-xs">
              {intelligence.recommendations.length} item
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {!intelligence.recommendations.length ? (
              <p className="text-sm text-gray-500">Belum ada rekomendasi.</p>
            ) : (
              intelligence.recommendations.map((rec, idx) => (
                <ActionCard key={`${rec.type}-${idx}`} rec={rec} />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <OnboardingModal open={showOnboarding} onClose={() => setShowOnboarding(false)} />
    </div>
  );
}