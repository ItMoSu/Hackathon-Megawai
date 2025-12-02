"use client";

import { HelpCircle } from "lucide-react";
import React from "react";

type InfoTooltipProps = {
  message: string;
  className?: string;
};

export function InfoTooltip({ message, className = "" }: InfoTooltipProps) {
  return (
    <span className={`group relative inline-flex items-center ${className}`}>
      <HelpCircle className="h-4 w-4 text-gray-400 hover:text-gray-600" />
      <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-64 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white shadow-lg transition group-hover:block">
        {message}
      </span>
    </span>
  );
}
