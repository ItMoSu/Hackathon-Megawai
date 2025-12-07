"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, TrendingUp, Zap, ShieldCheck, BarChart3, Brain, Clock } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative pt-28 pb-16 lg:pt-40 lg:pb-28 overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 -z-10 h-full w-full bg-white bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
      
      {/* Floating Elements */}
      <motion.div
        className="absolute top-20 left-10 w-20 h-20 bg-red-100 rounded-full opacity-50 blur-xl"
        animate={{ y: [0, 20, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-20 right-10 w-32 h-32 bg-blue-100 rounded-full opacity-50 blur-xl"
        animate={{ y: [0, -20, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span className="inline-flex items-center gap-2 py-1.5 px-4 rounded-full bg-red-50 text-[#DC2626] text-sm font-bold tracking-wide mb-6 border border-red-100">
            <span className="relative flex h-2 w-2">
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
          className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight text-gray-900 mb-6"
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
          className="mt-4 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto mb-8"
        >
          Megaw AI membantu UMKM mencatat, menganalisa, dan memprediksi penjualan. 
          <span className="font-semibold text-gray-800"> Simpel, Cepat, dan Akurat.</span>
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <Link href="/login?mode=register">
            <motion.button 
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="px-8 py-4 bg-[#DC2626] text-white rounded-full font-bold text-lg shadow-lg shadow-red-200 hover:bg-red-700 transition-colors flex items-center gap-2"
            >
              Mulai Gratis <ArrowRight size={20} />
            </motion.button>
          </Link>

          <Link href="/dashboard">
            <motion.button 
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              className="px-8 py-4 bg-white text-gray-800 border-2 border-gray-200 rounded-full font-bold text-lg hover:border-gray-400 hover:bg-gray-50 transition-all"
            >
              Lihat Dashboard
            </motion.button>
          </Link>
        </motion.div>

        {/* Stats Row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-12 flex flex-wrap justify-center gap-8 text-center"
        >
          {[
            { value: "500+", label: "UMKM Terbantu" },
            { value: "10jt+", label: "Data Diproses" },
            { value: "95%", label: "Akurasi Prediksi" },
          ].map((stat, i) => (
            <div key={i} className="px-4">
              <div className="text-2xl sm:text-3xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-sm text-gray-500">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

export function FeaturesSection() {
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
    <section className="py-16 lg:py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Fitur yang Membantu Bisnismu
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Semua yang kamu butuhkan untuk mengelola dan mengembangkan bisnis UMKM
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.4, delay: index * 0.08 }}
              whileHover={{ y: -4, boxShadow: "0 12px 40px rgba(0,0,0,0.08)" }}
              className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 transition-shadow"
            >
              <div className={`w-12 h-12 ${feature.iconBg} rounded-xl flex items-center justify-center ${feature.iconColor} mb-4`}>
                <feature.icon size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>

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
              className="px-8 py-4 bg-gray-900 text-white rounded-full font-bold text-lg hover:bg-gray-800 transition-colors"
            >
              Coba Sekarang - Gratis!
            </motion.button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
