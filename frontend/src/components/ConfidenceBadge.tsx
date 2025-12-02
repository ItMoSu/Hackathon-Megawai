"use client";

import { CheckCircle2, AlertTriangle, Info } from "lucide-react";

type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW" | string;

const styles: Record<
  ConfidenceLevel,
  { bg: string; text: string; Icon: typeof CheckCircle2 }
> = {
  HIGH: {
    bg: "bg-green-100 text-green-700 border-green-200",
    text: "HIGH",
    Icon: CheckCircle2,
  },
  MEDIUM: {
    bg: "bg-yellow-100 text-yellow-700 border-yellow-200",
    text: "MEDIUM",
    Icon: AlertTriangle,
  },
  LOW: {
    bg: "bg-red-100 text-red-700 border-red-200",
    text: "LOW",
    Icon: Info,
  },
};

export function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const normalized = (level || "MEDIUM").toUpperCase() as ConfidenceLevel;
  const style = styles[normalized] || styles.MEDIUM;
  const Icon = style.Icon;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${style.bg}`}
    >
      <Icon className="h-4 w-4" />
      {style.text}
    </span>
  );
}
