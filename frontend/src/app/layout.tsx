import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { SWRProvider } from "@/lib/swr-config";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

const siteConfig = {
  name: "Megaw AI",
  description: "AI-Powered Sales Intelligence untuk UMKM Indonesia. Prediksi penjualan, analisis tren, dan rekomendasi bisnis cerdas.",
  url: "https://megawai.id",
  ogImage: "/og-image.png",
  keywords: [
    "UMKM",
    "sales intelligence",
    "prediksi penjualan",
    "AI bisnis",
    "analisis penjualan",
    "UMKM Indonesia",
    "forecast penjualan",
    "machine learning UMKM",
  ],
};

export const metadata: Metadata = {
  title: "Market Pulse - AI-Powered Sales Analytics",
  description: "Platform analisis penjualan berbasis AI untuk UMKM. Pantau performa, prediksi tren, dan optimalkan bisnis Anda.",
  keywords: ["sales analytics", "UMKM", "AI", "business intelligence", "forecasting"],
  authors: [{ name: "Market Pulse Team" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
