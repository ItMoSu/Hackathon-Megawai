"use client";

import { AlertTriangle, X, TrendingUp } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type AlertLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | string;

interface AlertCardProps {
  productName: string;
  score: number;
  level: AlertLevel;
  onDismiss: () => void;
}

export function AlertCard({ productName, score, level, onDismiss }: AlertCardProps) {
  // Tentukan warna berdasarkan level severity
  const isCritical = level === "CRITICAL" || score >= 3.5;
  
  const styles = isCritical
    ? "bg-red-50 border-red-200 text-red-900"
    : "bg-orange-50 border-orange-200 text-orange-900";

  const iconColor = isCritical ? "text-red-600" : "text-orange-600";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`relative w-full rounded-xl border p-4 shadow-sm mb-6 ${styles}`}
      >
        <div className="flex items-start gap-4">
          <div className={`mt-1 rounded-full bg-white p-2 shadow-sm ${iconColor}`}>
            <AlertTriangle className="h-6 w-6" />
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white ${iconColor} border border-current`}>
                {isCritical ? "Critical Anomaly" : "High Alert"}
              </span>
              <span className="text-xs font-medium opacity-75">
                Burst Score: {score.toFixed(2)}
              </span>
            </div>
            
            <h4 className="font-bold text-lg">
              Ada Lonjakan Product: {productName}
            </h4>
            
            <p className="text-sm mt-1 opacity-90 leading-relaxed">
              Terdeteksi aktivitas penjualan <strong>{score.toFixed(1)}x lipat</strong> dari biasanya. 
              Sistem merekomendasikan cek stok segera untuk menghindari kehabisan barang (stockout).
            </p>
          </div>

          <button 
            onClick={onDismiss}
            className="p-1 rounded-lg hover:bg-black/5 transition-colors"
          >
            <X className="h-5 w-5 opacity-50" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}