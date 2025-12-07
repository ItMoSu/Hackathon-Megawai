"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, CheckCircle2, AlarmClock, Flame, AlertTriangle } from "lucide-react";
import { Recommendation } from "@/types/intelligence";
import { Button } from "./ui/Button";

const PRIORITY_LABEL: Record<Recommendation["priority"], { label: string; color: string; icon: React.ReactNode }> = {
  URGENT: { label: "TINDAKAN SEGERA", color: "bg-red-100 text-red-700 border-red-200", icon: <Flame className="h-5 w-5 text-red-600" /> },
  HIGH: { label: "PENTING", color: "bg-orange-100 text-orange-700 border-orange-200", icon: <AlertTriangle className="h-5 w-5 text-orange-600" /> },
  MEDIUM: { label: "LAKUKAN 2-3 HARI", color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: <AlarmClock className="h-5 w-5 text-yellow-600" /> },
  LOW: { label: "OPSIONAL", color: "bg-blue-100 text-blue-700 border-blue-200", icon: <CheckCircle2 className="h-5 w-5 text-blue-600" /> },
};

const cn = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");

export function ActionCard({ rec }: { rec: Recommendation }) {
  const [expanded, setExpanded] = useState(false);
  const meta = PRIORITY_LABEL[rec.priority] || PRIORITY_LABEL.MEDIUM;

  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-white/90 p-4 shadow-sm transition hover:shadow-md ${rec.priority === "URGENT" ? "border-red-300 animate-pulse" : "border-gray-200"}`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-1">{meta.icon}</div>
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${meta.color}`}>
              {meta.label}
            </span>
            <span className="text-sm font-semibold text-gray-900">{rec.type}</span>
          </div>
          <p className="text-sm text-gray-700">{rec.message}</p>
          {rec.details?.length ? (
            <ul className="space-y-1 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700">
              {rec.details.map((d, idx) => (
                <li key={idx} className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-gray-400" />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="primary" className="text-xs">
              Saya Siap Jalankan
            </Button>
            <Button size="sm" variant="outline" className="text-xs">
              Ingatkan Besok
            </Button>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              {expanded ? (
                <span className="inline-flex items-center gap-1">
                  Sembunyikan alasan <ChevronUp className="h-3 w-3" />
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  Kenapa ini penting? <ChevronDown className="h-3 w-3" />
                </span>
              )}
            </button>
          </div>
          {rec.type === "PEAK_STRATEGY" && (rec as any).phases ? (
            <div className="space-y-4 mt-4">
              <div className="rounded border-l-4 border-blue-500 bg-blue-50 p-3">
                <p className="text-sm font-semibold text-blue-900">💡 Rekomendasi Cerdas</p>
                <p className="mt-1 text-xs text-blue-700">
                  Kami deteksi peak diikuti penurunan. Gunakan strategi bertahap untuk hindari overstock dan waste.
                </p>
              </div>

              {(rec as any).phases.map((phase: any, idx: number) => (
                <div
                  key={idx}
                  className={cn(
                    "rounded-lg border-2 p-4",
                    idx === 0 ? "border-green-400 bg-green-50" : "border-orange-400 bg-orange-50",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{phase.icon}</span>
                    <div className="flex-1">
                      <h4 className="mb-1 text-sm font-bold text-gray-900">{phase.phase_name}</h4>
                      <p className="mb-2 text-sm text-gray-700">{phase.advice}</p>
                      <div className="mb-2 rounded bg-white p-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Total stok:</span>
                          <span className="font-bold text-gray-900">{phase.stock_needed} porsi</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-gray-600">Rata-rata/hari:</span>
                          <span className="font-semibold text-gray-700">~{phase.daily_avg} porsi</span>
                        </div>
                      </div>
                      {phase.warning ? (
                        <div className="mt-2 rounded border border-red-300 bg-red-50 p-2">
                          <p className="flex items-start gap-1 text-xs font-medium text-red-800">
                            <span>⚠️</span>
                            <span>{phase.warning}</span>
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}

              {(rec as any).savings ? (
                <div className="rounded-lg border border-green-300 bg-gradient-to-r from-green-50 to-emerald-50 p-4">
                  <h4 className="mb-3 text-sm font-bold text-gray-900">💰 Efisiensi Strategi 2 Fase</h4>
                  <div className="mb-3 grid grid-cols-2 gap-3">
                    <div className="rounded bg-white p-3 text-center">
                      <p className="mb-1 text-xs text-gray-600">Produksi Flat</p>
                      <p className="text-xl font-bold text-gray-400 line-through">
                        {(rec as any).savings.total_naive}
                      </p>
                      <p className="text-xs text-gray-500">porsi</p>
                    </div>
                    <div className="rounded bg-white p-3 text-center">
                      <p className="mb-1 text-xs text-gray-600">Strategi 2 Fase</p>
                      <p className="text-xl font-bold text-green-600">
                        {(rec as any).savings.total_smart}
                      </p>
                      <p className="text-xs text-gray-500">porsi</p>
                    </div>
                  </div>
                  <div className="rounded bg-white p-3 text-center">
                    <p className="mb-1 text-xs text-gray-600">Penghematan</p>
                    <p className="text-2xl font-bold text-green-600">{(rec as any).savings.amount} porsi</p>
                    <p className="mt-1 text-xs font-medium text-green-700">
                      Hemat {(rec as any).savings.percentage}% modal
                    </p>
                  </div>
                </div>
              ) : null}

              {expanded && (rec as any).reasoning ? (
                <div className="mt-2 border-t pt-3">
                  <p className="mb-2 text-xs font-semibold text-gray-700">Kenapa strategi ini?</p>
                  <ul className="space-y-1">
                    {(rec as any).reasoning.map((reason: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                        <span className="text-green-600 mt-0.5">✓</span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              {rec.action ? <p className="text-sm text-gray-700">{rec.action}</p> : null}
              {rec.suggestions ? (
                <ul className="mt-2 space-y-1">
                  {rec.suggestions.map((suggestion, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-blue-500">•</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {expanded && rec.reasoning ? (
                <div className="mt-3 border-t pt-2">
                  <p className="mb-1 text-xs font-semibold text-gray-700">Alasan:</p>
                  <ul className="space-y-1">
                    {rec.reasoning.map((reason, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                        <span className="text-green-600">✓</span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
          {rec.type !== "PEAK_STRATEGY" && !expanded && (
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
              Prediksi disusun dari pola 7 hari terakhir, hari gajian, dan tren akhir pekan.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
