import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Laporan Mingguan",
  description: "Laporan analisis penjualan mingguan dengan insights AI. Lihat tren, produk terlaris, dan rekomendasi bisnis.",
  openGraph: {
    title: "Laporan Mingguan - Megaw AI",
    description: "Analisis penjualan mingguan dengan insights AI",
    type: "website",
  },
};

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
