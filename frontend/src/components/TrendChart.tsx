"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader } from "./ui/Card";
import { Select } from "./ui/Select";
import { API_URL } from "@/lib/api";

type TimeRange = "7d" | "14d" | "30d" | "60d" | "90d";

type ProductOption = { id: string; name: string };

type TrendPoint = { date: string; sales: number };

type TrendResponse = {
  productName: string;
  data: TrendPoint[];
};

const RANGE_OPTIONS: { label: string; value: TimeRange; days: number }[] = [
  { label: "7 Hari Terakhir", value: "7d", days: 7 },
  { label: "14 Hari Terakhir", value: "14d", days: 14 },
  { label: "30 Hari Terakhir", value: "30d", days: 30 },
  { label: "60 Hari Terakhir", value: "60d", days: 60 },
  { label: "90 Hari Terakhir", value: "90d", days: 90 },
];

const numberFormatter = new Intl.NumberFormat("id-ID");

export function TrendChart() {
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [selectedProduct, setSelectedProduct] = useState<string>("all");
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [trend, setTrend] = useState<TrendResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [error, setError] = useState<string>("");

  const selectedDays = useMemo(
    () => RANGE_OPTIONS.find((r) => r.value === timeRange)?.days ?? 30,
    [timeRange]
  );

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoadingProducts(true);
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/api/products`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
        });

        const data = await res.json();
        if (!res.ok || !data?.success) {
          throw new Error(data?.error || "Gagal memuat produk");
        }

        setProducts(data.data || []);
      } catch (err: any) {
        setError(err.message || "Gagal memuat produk");
      } finally {
        setLoadingProducts(false);
      }
    };

    fetchProducts();
  }, []);

  useEffect(() => {
    const fetchTrend = async () => {
      try {
        setLoading(true);
        setError("");
        const token = localStorage.getItem("token");

        const params = new URLSearchParams();
        params.set("days", String(selectedDays));
        if (selectedProduct !== "all") {
          params.set("productId", selectedProduct);
        }

        const res = await fetch(
          `${API_URL}/api/products/trend?${params.toString()}`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: token ? `Bearer ${token}` : "",
            },
          }
        );

        const data = await res.json();
        if (!res.ok || !data?.success) {
          throw new Error(data?.error || "Gagal memuat data trend");
        }

        setTrend(data.data);
      } catch (err: any) {
        setError(err.message || "Gagal memuat data trend");
        setTrend(null);
      } finally {
        setLoading(false);
      }
    };

    fetchTrend();
  }, [selectedProduct, selectedDays]);

  const chartData = useMemo(() => {
    if (!trend?.data) return [];

    return trend.data.map((point) => ({
      ...point,
      label: format(parseISO(point.date), "d MMM"),
    }));
  }, [trend]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Trend Penjualan</h2>
            <p className="text-sm text-gray-500">
              Pantau performa penjualan berdasarkan rentang waktu.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 md:flex-row md:items-center md:justify-start">
            <div className="w-full md:w-[200px]">
              <Select
                label="Rentang Waktu"
                options={RANGE_OPTIONS.map((range) => ({
                  label: range.label,
                  value: range.value,
                }))}
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as TimeRange)}
              />
            </div>

            <div className="w-full md:w-[250px]">
              <Select
                label="Produk"
                options={[
                  { label: "Semua Produk", value: "all" },
                  ...products.map((p) => ({ label: p.name, value: p.id })),
                ]}
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                disabled={loadingProducts}
              />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {error && (
          <p className="mb-4 text-sm text-red-500">
            {error}
          </p>
        )}

        {loading ? (
          <div className="py-10 text-center text-gray-500">Memuat data...</div>
        ) : chartData.length === 0 ? (
          <div className="py-10 text-center text-gray-500">
            Belum ada data untuk rentang ini.
          </div>
        ) : (
          <div className="h-80 w-full rounded-lg border border-gray-200 bg-white/70 p-4 shadow-sm">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => numberFormatter.format(value as number)}
                />
                <Tooltip
                  formatter={(value) => numberFormatter.format(value as number)}
                  labelFormatter={(label, payload) => {
                    const item = payload?.[0]?.payload as TrendPoint & { label: string };
                    return `${item?.label || label} • ${trend?.productName || ""}`;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="sales"
                  stroke="#2563eb"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
