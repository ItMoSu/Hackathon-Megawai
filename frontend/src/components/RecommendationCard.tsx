"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Copy, CheckCircle2 } from "lucide-react";
import { Recommendation } from "@/types/intelligence";

const PRIORITY_STYLES: Record<
  Recommendation["priority"],
  { badge: string; text: string }
> = {
  URGENT: { badge: "bg-red-100 text-red-700 border-red-200", text: "URGENT" },
  HIGH: { badge: "bg-orange-100 text-orange-700 border-orange-200", text: "HIGH" },
  MEDIUM: { badge: "bg-yellow-100 text-yellow-700 border-yellow-200", text: "MEDIUM" },
  LOW: { badge: "bg-blue-100 text-blue-700 border-blue-200", text: "LOW" },
};

function toPriorityValue(priority: Recommendation["priority"]) {
  switch (priority) {
    case "URGENT":
      return 0;
    case "HIGH":
      return 1;
    case "MEDIUM":
      return 2;
    default:
      return 3;
  }
}

export function sortRecommendations(recs: Recommendation[]) {
  return [...recs].sort(
    (a, b) => toPriorityValue(a.priority) - toPriorityValue(b.priority),
  );
}

export function RecommendationCard({ rec }: { rec: Recommendation }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const styles = PRIORITY_STYLES[rec.priority] || PRIORITY_STYLES.MEDIUM;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rec.message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (err) {
      setCopied(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white/80 p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${styles.badge}`}
            >
              {styles.text}
            </span>
            <span className="text-sm font-semibold text-gray-800">
              {rec.type || "Recommendation"}
            </span>
          </div>
          <p className="text-sm text-gray-700">{rec.message}</p>
          {rec.actionText && (
            <p className="text-xs font-semibold text-blue-600">{rec.actionText}</p>
          )}
          {expanded && rec.details?.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-gray-600">
              {rec.details.map((d, idx) => (
                <li key={idx}>{d}</li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
          >
            {copied ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy
              </>
            )}
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            {expanded ? (
              <span className="inline-flex items-center gap-1">
                Hide details <ChevronUp className="h-3 w-3" />
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                Show details <ChevronDown className="h-3 w-3" />
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
