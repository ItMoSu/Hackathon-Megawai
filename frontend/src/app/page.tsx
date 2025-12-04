"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, TrendingUp, Zap, ShieldCheck } from "lucide-react";
import Navbar from "@/components/ui/Navbar"; 

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-black selection:bg-[#DC2626] selection:text-white">
      <Navbar />

      {/* HERO SECTION */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="absolute inset-0 -z-10 h-full w-full bg-white bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] bg-size-[16px_px] mask-[radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,)transparent_100%]"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-block py-1 px-3 rounded-full bg-red-50 text-[#DC2626] text-sm font-bold tracking-wide mb-6 border border-red-100">
              🚀 Boost Your Business Growth
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl md:text-7xl font-extrabold tracking-tight text-gray-900 mb-6"
          >
            Manage Sales like a <br />
            <span className="text-transparent bg-clip-text bg-linear-to-r from-[#DC2626] to-black">
              Pro Professional
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-4 text-xl text-gray-600 max-w-2xl mx-auto mb-10"
          >
            Market Pulse membantu kamu mencatat, menganalisa, dan memprediksi penjualan dengan kekuatan AI. Simpel, Cepat, dan Akurat.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Link href="/dashboard">
              <button className="px-8 py-4 bg-[#DC2626] text-white rounded-full font-bold text-lg shadow-lg hover:bg-primary-hover hover:shadow-xl transition-all transform hover:-translate-y-1 flex items-center gap-2">
                Go to Dashboard <ArrowRight size={20} />
              </button>
            </Link>
            
            <Link href="/products">
              <button className="px-8 py-4 bg-white text-black border-2 border-gray-200 rounded-full font-bold text-lg hover:border-black hover:bg-gray-50 transition-all">
                View Products
              </button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            <motion.div 
              whileHover={{ y: -5 }}
              className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100"
            >
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center text-[#DC2626] mb-6">
                <TrendingUp size={24} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Real-time Analytics</h3>
              <p className="text-gray-500">
                Pantau performa penjualanmu secara langsung dengan grafik yang mudah dipahami.
              </p>
            </motion.div>

            <motion.div 
              whileHover={{ y: -5 }}
              className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100"
            >
              <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center text-white mb-6">
                <Zap size={24} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">AI Powered</h3>
              <p className="text-gray-500">
                Dapatkan insight otomatis dari AI untuk menentukan strategi penjualan terbaikmu.
              </p>
            </motion.div>

            <motion.div 
              whileHover={{ y: -5 }}
              className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100"
            >
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center text-[#DC2626] mb-6">
                <ShieldCheck size={24} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Secure & Reliable</h3>
              <p className="text-gray-500">
                Data kamu tersimpan aman dengan enkripsi tingkat tinggi. Fokus jualan aja!
              </p>
            </motion.div>

          </div>
        </div>
      </section>

      <footer className="py-8 bg-white border-t border-gray-100 text-center">
        <p className="text-gray-500">
          © 2024 Market Pulse. All rights reserved.
        </p>
      </footer>
    </main>
  );
}