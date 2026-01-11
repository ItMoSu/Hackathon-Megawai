"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import Navbar from "@/components/ui/Navbar";
import { Card, CardContent } from "@/components/ui/Card";
import { useTheme } from "@/lib/theme-context";
import { API_URL } from "@/lib/api";

type SentimentResult = {
  sentiment: string;
  confidence: number;
  emoji: string;
  review?: string;
};

type CsvSummary = {
  positive: number;
  negative: number;
  neutral: number;
  positive_pct: number;
  negative_pct: number;
  neutral_pct: number;
  total: number;
};

type HistoryItem = {
  id: string;
  text: string;
  sentiment: string;
  confidence: number;
  emoji: string;
  timestamp: number;
};

const HISTORY_KEY = "review_history";
const MAX_HISTORY = 5;

function loadHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(items: HistoryItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)));
}

export default function ReviewPage() {
  const { theme } = useTheme();
  const [mode, setMode] = useState<"manual" | "csv">("manual");
  const [text, setText] = useState("");
  const [manualResult, setManualResult] = useState<SentimentResult | null>(null);
  const [csvResults, setCsvResults] = useState<SentimentResult[]>([]);
  const [csvSummary, setCsvSummary] = useState<CsvSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const handleDeleteHistory = (id: string) => {
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    saveHistory(updated);
  };

  const handleClearAllHistory = () => {
    setHistory([]);
    saveHistory([]);
  };

  const handleAnalyzeText = async () => {
    setLoading(true);
    setError(null);
    setManualResult(null);
    try {
      const res = await fetch(`${API_URL}/api/sentiment/analyze-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const raw = await res.text();
      let data: any;
      try {
        data = JSON.parse(raw);
      } catch {
        // Return raw as message if non-JSON (e.g., HTML error)
        throw new Error(raw?.trim() ? raw.slice(0, 200) : "Tidak ada respons dari server (cek layanan ML/API)");
      }
      if (!res.ok) throw new Error(data?.error || "Gagal menganalisa");
      const result = {
        sentiment: data?.result?.sentiment || "N/A",
        confidence: data?.result?.confidence || 0,
        emoji: data?.result?.emoji || "😐",
      };
      setManualResult(result);
      
      // Save to history
      const newItem: HistoryItem = {
        id: Date.now().toString(),
        text: text.trim(),
        sentiment: result.sentiment,
        confidence: result.confidence,
        emoji: result.emoji,
        timestamp: Date.now(),
      };
      const updated = [newItem, ...history.filter(h => h.text !== text.trim())].slice(0, MAX_HISTORY);
      setHistory(updated);
      saveHistory(updated);
      
      setError(null);
    } catch (err: any) {
      setError(err?.message || "Gagal terhubung ke layanan analisa");
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeFile = async (file: File) => {
    setLoading(true);
    setError(null);
    setCsvResults([]);
    setCsvSummary(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_URL}/api/sentiment/analyze-file`, {
        method: "POST",
        body: formData,
      });
      const raw = await res.text();
      let data: any;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(raw?.trim() ? raw.slice(0, 200) : "Tidak ada respons dari server (cek layanan ML/API)");
      }
      if (!res.ok) throw new Error(data?.error || "Gagal menganalisa file");
      setCsvSummary(data?.summary || null);
      setCsvResults(
        (data?.results || []).map((r: any) => ({
          review: r.review,
          sentiment: r.sentiment,
          confidence: r.confidence,
          emoji: r.emoji,
        }))
      );
      setError(null);
    } catch (err: any) {
      setError(err?.message || "Gagal terhubung ke layanan analisa");
    } finally {
      setLoading(false);
    }
  };

  const pieStyle = useMemo(() => {
    if (!csvSummary || csvSummary.total === 0) return {};
    const p = csvSummary.positive_pct || 0;
    const n = csvSummary.negative_pct || 0;
    return {
      backgroundImage: `conic-gradient(#16a34a 0 ${p}%, #dc2626 ${p}% ${p + n}%, #64748b ${p + n}% 100%)`,
    };
  }, [csvSummary]);

  const cardBase =
    theme === "dark"
      ? "bg-gray-800 border-gray-700 text-gray-100"
      : "bg-white border-gray-200 text-gray-900";
  const subText = theme === "dark" ? "text-gray-400" : "text-gray-600";

  return (
    <main
      className={`min-h-screen transition-colors duration-300 ${
        theme === "dark" ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"
      }`}
    >
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl font-bold">Review</h1>
          <p className={`text-sm ${subText}`}>
            Analisis sentimen review secara manual atau batch lewat CSV.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setMode("manual")}
            className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-colors ${
              mode === "manual"
                ? "bg-red-600 text-white border-red-600"
                : theme === "dark"
                  ? "bg-gray-800 border-gray-700 text-gray-200"
                  : "bg-white border-gray-200 text-gray-700"
            }`}
          >
            Input Manual
          </button>
          <button
            onClick={() => setMode("csv")}
            className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-colors ${
              mode === "csv"
                ? "bg-red-600 text-white border-red-600"
                : theme === "dark"
                  ? "bg-gray-800 border-gray-700 text-gray-200"
                  : "bg-white border-gray-200 text-gray-700"
            }`}
          >
            Upload CSV
          </button>
        </div>

        {mode === "manual" && (
          <Card className={`${cardBase} shadow-sm`}>
            <CardContent className="p-4 sm:p-6 space-y-4">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                className={`w-full rounded-lg border px-4 py-3 focus:ring-2 focus:ring-red-500 outline-none ${
                  theme === "dark"
                    ? "bg-gray-900 border-gray-700 text-gray-100"
                      : "bg-white border-gray-300 text-gray-900 placeholder:text-gray-500"
                }`}
                placeholder="Tulis satu review di sini..."
              />
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <button
                  onClick={handleAnalyzeText}
                  disabled={loading || !text.trim()}
                  className={`px-5 py-2 rounded-lg font-semibold text-sm shadow ${
                    loading || !text.trim()
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-red-600 text-white hover:bg-red-700"
                  }`}
                >
                  {loading ? "Memproses..." : "Analisa"}
                </button>
                {error && <span className="text-sm text-red-500">{error}</span>}
              </div>

              {manualResult && (
                <div
                  className={`mt-2 p-4 rounded-lg border ${cardBase} flex items-center gap-3`}
                >
                  <span className="text-2xl">{manualResult.emoji}</span>
                  <div>
                    <p className="font-semibold text-lg">{manualResult.sentiment}</p>
                    <p className={`text-sm ${subText}`}>Keyakinan: {manualResult.confidence}%</p>
                  </div>
                </div>
              )}

              {/* History Section */}
              {history.length > 0 && (
                <div className={`mt-6 pt-4 border-t ${theme === "dark" ? "border-gray-700" : "border-gray-200"}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm">Riwayat Analisis (5 Terbaru)</h3>
                    <button
                      onClick={handleClearAllHistory}
                      className={`text-xs px-2 py-1 rounded transition-colors ${
                        theme === "dark"
                          ? "text-red-400 hover:bg-red-900/30"
                          : "text-red-600 hover:bg-red-50"
                      }`}
                    >
                      Hapus Semua
                    </button>
                  </div>
                  <div className="space-y-2">
                    {history.map((item) => (
                      <div
                        key={item.id}
                        className={`p-3 rounded-lg border flex items-center gap-3 ${
                          theme === "dark"
                            ? "bg-gray-900 border-gray-700"
                            : "bg-gray-50 border-gray-200"
                        }`}
                      >
                        <span className="text-xl flex-shrink-0">{item.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm truncate ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`} title={item.text}>
                            {item.text}
                          </p>
                          <p className={`text-xs ${subText}`}>
                            {item.sentiment} • {item.confidence}%
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteHistory(item.id)}
                          className={`flex-shrink-0 p-1.5 rounded-full transition-colors ${
                            theme === "dark"
                              ? "text-gray-500 hover:text-red-400 hover:bg-red-900/30"
                              : "text-gray-400 hover:text-red-600 hover:bg-red-50"
                          }`}
                          title="Hapus"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {mode === "csv" && (
          <div className="space-y-4">
            <Card
              className={`${cardBase} shadow-sm border-l-4 ${
                theme === "dark" ? "border-l-green-500" : "border-l-green-500"
              }`}
            >
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center text-green-600 ${
                        theme === "dark" ? "bg-green-900/30" : "bg-green-100"
                      }`}
                    >
                      📁
                    </div>
                    <div>
                      <p className="font-semibold text-base">Input Data Review</p>
                      <p className={`text-sm ${subText}`}>
                        Upload CSV untuk analisis sentimen massal.
                      </p>
                      <p className={`text-xs ${subText} mt-1`}>
                        Pastikan file memiliki kolom <strong>Review</strong>.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleAnalyzeFile(f);
                      }}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 rounded-md bg-red-600 text-white font-semibold flex items-center gap-2 shadow hover:bg-red-700"
                    >
                      <span className="text-lg">⏏</span>
                      <span>Pilih File</span>
                    </button>
                  </div>
                </div>
                {error && <span className="text-sm text-red-500 block mt-2">{error}</span>}
              </CardContent>
            </Card>

            {csvSummary && (
              <div className="grid gap-4 md:grid-cols-2">
                <Card className={`${cardBase} shadow-sm`}>
                  <CardContent className="p-4 sm:p-6 space-y-3">
                    <p className="font-semibold">Ringkasan</p>
                  <div className="flex items-center gap-4">
                      <div
                      className="w-48 h-48 rounded-full border-3 border-blue-200 dark:border-blue-300"
                        style={pieStyle}
                        aria-label="Pie summary"
                      />
                      <div className="space-y-1 text-sm">
                        <p className="text-green-600">Positif: {csvSummary.positive} ({csvSummary.positive_pct}%)</p>
                        <p className="text-red-600">Negatif: {csvSummary.negative} ({csvSummary.negative_pct}%)</p>
                        <p className={`${subText}`}>Netral: {csvSummary.neutral} ({csvSummary.neutral_pct}%)</p>
                        <p className={`${subText}`}>Total: {csvSummary.total}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className={`${cardBase} shadow-sm overflow-hidden`}>
                  <CardContent className="p-4 sm:p-6">
                    <p className="font-semibold mb-2">Hasil CSV</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className={`text-left border-b ${theme === "dark" ? "border-gray-700" : "border-gray-200"}`}>
                            <th className="py-2 pr-2">Review</th>
                            <th className="py-2 pr-2">Sentimen</th>
                            <th className="py-2">Keyakinan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {csvResults.map((r, idx) => (
                            <tr
                              key={idx}
                              className={`border-b last:border-0 ${theme === "dark" ? "border-gray-700" : "border-gray-200"}`}
                            >
                              <td className="py-2 pr-2 max-w-[240px] truncate" title={r.review}>{r.review}</td>
                              <td className="py-2 pr-2">{r.emoji} {r.sentiment}</td>
                              <td className="py-2">{r.confidence}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

