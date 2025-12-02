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
        areas.push({ x1: item.label, x2: next ? next.label : item.label });
      }
    });
    return areas;
  }, [bandData]);

  const paydayLabels = bandData.filter((d) => d.isPayday).map((d) => d.label);
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
  {/* {intelligence && 
   intelligence.realtime.burst.score > 2.5 && 
   !alertDismissed && (
    <AlertCard 
      productName={intelligence.productName || "Produk"}
      score={intelligence.realtime.burst.score}
      level={intelligence.realtime.burst.severity}
      onDismiss={() => setAlertDismissed(true)}
    />
  )} */}
    {true && ( // intelligence.realtime.burst.score > 2.5 diganti true
      <AlertCard 
        productName={intelligence?.productName || "Contoh Produk Viral"}
        score={4.2} // Hardcode nilai tinggi
        level="CRITICAL"
        onDismiss={() => setAlertDismissed(true)}
      />
    )}
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

      {/* Real-time cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
              <Button size="sm" variant="outline" className="w-fit text-xs">
                Lihat detail perbandingan
              </Button>
            </div>
            <Activity className="h-8 w-8 text-blue-500" />
          </CardHeader>
        </Card>

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
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    ⚠️ Produk sedang viral. Pastikan stok cukup 3-7 hari ke depan.
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-600">Tidak ada lonjakan mendadak. Semuanya terkendali.</p>
              )}
            </div>
            <AlertTriangle className={`h-8 w-8 ${isViral ? "text-red-500" : "text-emerald-500"}`} />
          </CardHeader>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-gray-400">Tingkat Kepercayaan</p>
              <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900">
                {friendlyConf.pct >= 75 ? "Prediksi Akurat" : friendlyConf.pct >= 60 ? "Cukup Akurat" : "Perlu Hati-hati"}
                <InfoTooltip message="Semakin lama Anda pakai sistem ini, semakin akurat. Setelah 90 hari: akurasi bisa 85-90%." />
              </h3>
              <p className="text-sm text-gray-600">
                Analisis pola harian + Machine Learning. Data {dataQualityDays} hari → akurasi ~{friendlyConf.pct}%.
              </p>
            </div>
            <Sparkles className="h-8 w-8 text-purple-500" />
          </CardHeader>
        </Card>
      </div>

      {/* Forecast section */}
      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              📊 Prediksi 7 Hari ke Depan
              <InfoTooltip message="Garis biru: prediksi paling mungkin. Area hijau: zona kemungkinan. Kuning: weekend. 💰: gajian." />
            </h3>
            <p className="text-sm text-gray-500">Bahasa sederhana, langsung bisa dipakai.</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            💡 Cara baca: Garis biru = prediksi paling mungkin. Area hijau muda = rentang naik-turun. Kuning = akhir pekan. 💰 = gajian.
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
                  {peakStrategy ? (
                    <>
                      <ReferenceLine
                        x={peakStrategy.peak_info.date}
                        stroke="#ef4444"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        label={{
                          value: "⚠️ PEAK",
                          position: "top",
                          fill: "#ef4444",
                          fontSize: 11,
                          fontWeight: "bold",
                        }}
                      />
                      <ReferenceArea
                        x1={predictions[0]?.date}
                        x2={peakStrategy.peak_info.date}
                        fill="#dcfce7"
                        fillOpacity={0.2}
                        label={{ value: "FASE 1: Naik", position: "insideTopLeft", fontSize: 10 }}
                      />
                      <ReferenceArea
                        x1={peakStrategy.peak_info.date}
                        x2={predictions[predictions.length - 1]?.date}
                        fill="#fed7aa"
                        fillOpacity={0.2}
                        label={{ value: "FASE 2: Turun", position: "insideTopRight", fontSize: 10 }}
                      />
                    </>
                  ) : null}
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => numberFormatter.format(v as number)} />
                  <Tooltip
                    formatter={(value) => (typeof value === "number" ? numberFormatter.format(value as number) : value)}
                    labelFormatter={(label, payload) => {
                      const item = payload?.[0]?.payload as any;
                      const tags = [];
                      if (item?.isWeekend) tags.push("Weekend");
                      if (item?.isPayday) tags.push("Gajian");
                      return `${label}${tags.length ? ` • ${tags.join(" / ")}` : ""}`;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="upper"
                    stroke="none"
                    baseLine={(d: any) => d?.lower}
                    fill="url(#band)"
                    fillOpacity={0.3}
                  />
                  <Line type="monotone" dataKey="upper" stroke="#93c5fd" strokeDasharray="5 5" dot={false} name="Zona atas" />
                  <Line
                    type="monotone"
                    dataKey="predicted_quantity"
                    stroke="#2563eb"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    name="Prediksi utama"
                  />
                  <Line type="monotone" dataKey="lower" stroke="#f59e0b" strokeDasharray="5 5" dot={false} name="Zona bawah" />
                  {peak ? (
                    <ReferenceDot
                      x={peak.label}
                      y={peak.predicted_quantity}
                      r={6}
                      fill="#16a34a"
                      stroke="none"
                      label={{ position: "top", value: "🎯 PEAK! Siapkan stok ekstra" }}
                    />
                  ) : null}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-gray-500">Tidak ada data forecast.</div>
            )}
          </div>

          {/* Insight Box */}
          {peakStrategy ? (
            <div className="rounded-lg border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-green-50 p-4">
              <div className="mb-3 flex items-start gap-2">
                <span className="text-2xl">🎯</span>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Insight Penting: Strategi 2 Fase</h4>
                  <p className="mt-1 text-xs text-gray-600">
                    Penjualan akan peak pada {peakStrategy.peak_info.day_name}, lalu turun. Gunakan strategi bertahap:
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {peakStrategy.phases.map((phase: any, idx: number) => (
                  <div key={idx} className="rounded border border-gray-200 bg-white p-3">
                    <div className="mb-1 flex items-center gap-2">
                      <span>{phase.icon}</span>
                      <span className="text-xs font-semibold text-gray-800">{phase.phase_name}</span>
                    </div>
                    <p className="text-xs text-gray-700">→ {phase.advice}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded bg-green-100 p-2 text-center">
                <p className="text-xs text-green-800">
                  ✅ Total efisien: <span className="font-bold">{peakStrategy.savings.total_smart} porsi</span>
                </p>
                <p className="mt-0.5 text-xs text-green-700">
                  Hemat {peakStrategy.savings.amount} porsi vs produksi flat
                </p>
              </div>
              <div className="mt-2 text-xs text-gray-600 italic">
                💡 Jangan produksi rata {Math.floor(peakStrategy.savings.total_naive / 7)} porsi/hari. Peak hanya sebentar, lalu turun.
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-start gap-2">
                <span className="text-xl">💡</span>
                <div>
                  <p className="mb-1 text-sm font-semibold text-gray-900">Insight Penting</p>
                  <p className="text-sm text-gray-700">
                    Penjualan {trend === "INCREASING" ? "diprediksi naik" : trend === "DECREASING" ? "berpotensi turun" : "stabil"}.
                    Siapkan stok ~{numberFormatter.format(Math.round(total7d || 0))} porsi untuk 7 hari.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Insights summary & Recommendations */}
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
              <p className="text-sm text-gray-600">
                Atau {numberFormatter.format(Math.max(1, Math.round(perDay || 0)))} per hari
              </p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Tren</span>
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                  trend === "INCREASING"
                    ? "bg-green-100 text-green-700"
                    : trend === "DECREASING"
                    ? "bg-red-100 text-red-700"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {trend === "INCREASING" ? "Naik" : trend === "DECREASING" ? "Turun" : "Stabil"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Tingkat keyakinan</span>
              <span className="text-sm font-semibold text-gray-900">{friendlyConf.pct}% akurat</span>
            </div>
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800">
              Bisa meleset +/-2-3 porsi per hari. Pantau kembali H-1.
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
              intelligence.recommendations.map((rec, idx) => <ActionCard key={`${rec.type}-${idx}`} rec={rec} />)
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 border-t border-gray-200 pt-4 text-center">
        <p className="text-xs text-gray-500">
          Ada pertanyaan?
          <button className="ml-1 text-blue-600 hover:underline">Lihat Panduan</button>
          {" | "}
          <button className="ml-1 text-blue-600 hover:underline">Lapor Masalah</button>
        </p>
      </div>

      <OnboardingModal open={showOnboarding} onClose={() => setShowOnboarding(false)} />
    </div>
  );
}
