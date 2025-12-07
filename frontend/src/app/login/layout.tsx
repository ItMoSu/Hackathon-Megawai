import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login",
  description: "Masuk ke akun Megaw AI untuk mengelola penjualan dan mendapatkan prediksi AI.",
  robots: {
    index: false, // Don't index login page
    follow: true,
  },
  openGraph: {
    title: "Login - Megaw AI",
    description: "Masuk ke akun Megaw AI",
    type: "website",
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
