"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, TrendingUp, Zap, ShieldCheck, BarChart3, Brain, Clock } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { getToken } from "@/lib/auth";

export function HeroSection() {
  const { theme } = useTheme();
  const router = useRouter();

  const handleDashboardClick = () => {
    const token = getToken();
    router.push(token ? "/dashboard" : "/login");
  };
  
  return (
    <section 
      className={`relative pt-28 pb-16 lg:pt-40 lg:pb-28 overflow-hidden transition-colors duration-300 ${theme === "dark" ? "bg-gray-900" : "bg-white"}`}
      aria-label="Hero - Pengenalan Megaw AI"
    >
      {/* Background Pattern - decorative */}
      <div 
        className={`absolute inset-0 -z-10 h-full w-full ${theme === "dark" ? "bg-gray-900 bg-[radial-gradient(#374151_1px,transparent_1px)]" : "bg-white bg-[radial-gradient(#e5e7eb_1px,transparent_1px)]"} [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]`} 
        aria-hidden="true"
      />
      
      {/* Floating Elements - decorative */}
      <motion.div
        className={`absolute top-20 left-10 w-20 h-20 rounded-full opacity-50 blur-xl ${theme === "dark" ? "bg-red-900" : "bg-red-100"}`}
        animate={{ y: [0, 20, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden="true"
      />
      <motion.div
        className={`absolute bottom-20 right-10 w-32 h-32 rounded-full opacity-50 blur-xl ${theme === "dark" ? "bg-blue-900" : "bg-blue-100"}`}
        animate={{ y: [0, -20, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span 
            className={`inline-flex items-center gap-2 py-1.5 px-4 rounded-full text-[#DC2626] text-sm font-bold tracking-wide mb-6 ${theme === "dark" ? "bg-red-900/30 border border-red-800" : "bg-red-50 border border-red-100"}`}
            role="status"
          >
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            Gratis untuk UMKM Indonesia
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className={`text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight mb-6 ${theme === "dark" ? "text-white" : "text-gray-900"}`}
        >
          Kelola Penjualan<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#DC2626] to-red-800">
            dengan AI Cerdas
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className={`mt-4 text-lg sm:text-xl max-w-2xl mx-auto mb-8 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
        >
          Megaw AI membantu UMKM mencatat, menganalisa, dan memprediksi penjualan. 
          <strong className={theme === "dark" ? "text-gray-200" : "text-gray-800"}> Simpel, Cepat, dan Akurat.</strong>
        </motion.p>

        <motion.nav
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          aria-label="Aksi utama"
        >
          <Link href="/login?mode=register">
            <motion.button 
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="px-8 py-4 bg-[#DC2626] text-white rounded-full font-bold text-lg shadow-lg shadow-red-200 hover:bg-red-700 transition-colors flex items-center gap-2"
            >
              Mulai Gratis <ArrowRight size={20} aria-hidden="true" />
            </motion.button>
          </Link>

          <motion.button 
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleDashboardClick}
            className={`px-8 py-4 border-2 rounded-full font-bold text-lg transition-all ${
              theme === "dark" 
                ? "bg-gray-800 text-gray-200 border-gray-700 hover:border-gray-500 hover:bg-gray-700" 
                : "bg-white text-gray-800 border-gray-200 hover:border-gray-400 hover:bg-gray-50"
            }`}
          >
            Lihat Dashboard
          </motion.button>
        </motion.nav>

        {/* Stats Row */}
        <motion.aside
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-12 flex flex-wrap justify-center gap-8 text-center"
          aria-label="Statistik pencapaian"
        >
          {[
            { value: "500+", label: "UMKM Terbantu" },
            { value: "1jt+", label: "Data Diproses" },
            { value: "95%", label: "Akurasi Prediksi" },
          ].map((stat, i) => (
            <article key={i} className="px-4">
              <p className={`text-2xl sm:text-3xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`} aria-label={`${stat.value} ${stat.label}`}>
                {stat.value}
              </p>
              <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                {stat.label}
              </p>
            </article>
          ))}
        </motion.aside>
      </div>
    </section>
  );
}

export function FeaturesSection() {
  const { theme } = useTheme();
  
  const features = [
    {
      icon: BarChart3,
      title: "Analitik Real-time",
      description: "Pantau performa penjualan secara langsung dengan grafik yang mudah dipahami.",
      iconBg: "bg-red-100",
      iconColor: "text-[#DC2626]",
    },
    {
      icon: Brain,
      title: "Prediksi AI",
      description: "Dapatkan prediksi penjualan akurat dan rekomendasi bisnis dari AI cerdas.",
      iconBg: "bg-gray-900",
      iconColor: "text-white",
    },
    {
      icon: Clock,
      title: "Hemat Waktu",
      description: "Input data cepat dari Excel/CSV. Laporan otomatis tanpa ribet.",
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
    },
    {
      icon: TrendingUp,
      title: "Deteksi Tren",
      description: "Ketahui produk mana yang naik atau turun sebelum terlambat.",
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
    },
    {
      icon: Zap,
      title: "Burst Alert",
      description: "Notifikasi instan saat ada lonjakan penjualan tidak biasa.",
      iconBg: "bg-orange-100",
      iconColor: "text-orange-600",
    },
    {
      icon: ShieldCheck,
      title: "Data Aman",
      description: "Data tersimpan aman dengan enkripsi. Fokus jualan, sisanya kami yang urus.",
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
    },
  ];

  return (
    <section 
      className={`py-16 lg:py-24 transition-colors duration-300 ${theme === "dark" ? "bg-gray-950" : "bg-gray-50"}`}
      aria-labelledby="features-heading"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.header
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 
            id="features-heading"
            className={`text-3xl sm:text-4xl font-bold mb-4 ${theme === "dark" ? "text-white" : "text-gray-900"}`}
          >
            Fitur yang Membantu Bisnismu
          </h2>
          <p className={`text-lg max-w-2xl mx-auto ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
            Semua yang kamu butuhkan untuk mengelola dan mengembangkan bisnis UMKM
          </p>
        </motion.header>

        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 list-none p-0" role="list">
          {features.map((feature, index) => (
            <motion.li
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.4, delay: index * 0.08 }}
              whileHover={{ y: -4, boxShadow: theme === "dark" ? "0 12px 40px rgba(255,255,255,0.2)" : "0 12px 40px rgba(0,0,0,0.08)" }}
            >
              <article 
                className={`h-full p-6 rounded-2xl shadow-sm border transition-all duration-300 ${
                  theme === "dark" 
                    ? "bg-gray-900 border-gray-700 hover:border-gray-600" 
                    : "bg-white border-gray-100"
                }`}
              >
                <figure 
                  className={`w-12 h-12 ${feature.iconBg} rounded-xl flex items-center justify-center ${feature.iconColor} mb-4`}
                  aria-hidden="true"
                >
                  <feature.icon size={24} />
                </figure>
                <h3 className={`text-lg font-bold mb-2 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                  {feature.title}
                </h3>
                <p className={`text-sm leading-relaxed ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                  {feature.description}
                </p>
              </article>
            </motion.li>
          ))}
        </ul>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <Link href="/login?mode=register">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              className={`px-8 py-4 rounded-full font-bold text-lg transition-colors ${
                theme === "dark"
                  ? "bg-white text-gray-900 hover:bg-gray-100"
                  : "bg-gray-900 text-white hover:bg-gray-800"
              }`}
            >
              Coba Sekarang - Gratis!
            </motion.button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
