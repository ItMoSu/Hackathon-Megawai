import type { Metadata } from "next";
import nextDynamic from "next/dynamic";
import Navbar from "@/components/ui/Navbar";

// Dynamic import untuk client components (code splitting)
const HeroSection = nextDynamic(
  () => import("@/components/landing/HeroSection").then((mod) => mod.HeroSection),
  { ssr: true }
);

const FeaturesSection = nextDynamic(
  () => import("@/components/landing/HeroSection").then((mod) => mod.FeaturesSection),
  { ssr: true }
);

// SEO Metadata - Static Generation
export const metadata: Metadata = {
  title: "Megaw AI - AI Sales Intelligence untuk UMKM Indonesia",
  description:
    "Platform AI untuk prediksi penjualan, analisis tren, dan rekomendasi bisnis cerdas. Tingkatkan omzet UMKM dengan teknologi Machine Learning.",
  keywords: [
    "prediksi penjualan",
    "AI UMKM",
    "analisis bisnis",
    "sales forecast",
    "machine learning Indonesia",
  ],
  openGraph: {
    title: "Megaw AI - AI Sales Intelligence untuk UMKM",
    description:
      "Platform AI untuk prediksi penjualan dan analisis bisnis cerdas",
    type: "website",
    url: "/",
  },
  alternates: {
    canonical: "/",
  },
};

// JSON-LD Structured Data
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Megaw AI",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "AI-Powered Sales Intelligence untuk UMKM Indonesia. Prediksi penjualan, analisis tren, dan rekomendasi bisnis cerdas.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "IDR",
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.8",
    ratingCount: "150",
  },
};

// Force Static Generation
export const dynamic = "force-static";
export const revalidate = 3600; // Revalidate setiap 1 jam

export default function HomePage() {
  return (
    <>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="min-h-screen bg-white text-black selection:bg-[#DC2626] selection:text-white">
        <Navbar />
        <HeroSection />
        <FeaturesSection />

        <footer className="py-8 bg-white border-t border-gray-100 text-center">
          <p className="text-gray-500">
            © {new Date().getFullYear()} Megaw AI. All rights reserved.
          </p>
        </footer>
      </main>
    </>
  );
}
