import type { Metadata } from "next";
import ProductDetailClient from "./ProductDetailClient";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  
  return {
    title: `Detail Produk`,
    description: `Lihat analisis penjualan, prediksi AI, dan rekomendasi untuk produk ini.`,
    openGraph: {
      title: `Detail Produk - Megaw AI`,
      description: `Analisis penjualan dengan AI untuk UMKM Indonesia`,
      type: "website",
    },
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const { id } = await params;
  
  return <ProductDetailClient productId={id} />;
}

