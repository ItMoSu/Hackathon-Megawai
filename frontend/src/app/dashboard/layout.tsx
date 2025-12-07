import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Dashboard analisis penjualan Megaw AI. Pantau performa bisnis, prediksi penjualan, dan rekomendasi AI real-time.",
  openGraph: {
    title: "Dashboard - Megaw AI",
    description: "Pantau performa bisnis dengan analisis AI",
    type: "website",
  },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
