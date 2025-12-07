import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Manajemen Produk",
  description: "Kelola katalog produk, lihat ranking performa, dan analisis penjualan dengan Megaw AI.",
  openGraph: {
    title: "Manajemen Produk - Megaw AI",
    description: "Kelola katalog dan analisis performa produk",
    type: "website",
  },
};

export default function ProductsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
