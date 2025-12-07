import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Input Penjualan",
  description: "Catat penjualan harian dengan cepat dan mudah. Data otomatis tersinkron untuk analisis AI.",
  openGraph: {
    title: "Input Penjualan - Megaw AI",
    description: "Catat penjualan harian dengan mudah",
    type: "website",
  },
};

export default function InputLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
