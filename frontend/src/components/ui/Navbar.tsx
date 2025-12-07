"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ShoppingBag, User, LogOut } from "lucide-react";

const navLinks = [
  { name: "Beranda", href: "/" },
  { name: "Produk", href: "/products" },
  { name: "Dashboard", href: "/dashboard" },
  { name: "Input Data", href: "/input" },
  { name: "Laporan", href: "/reports" },
];

let hasAnimated = false;

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  const pathname = usePathname();
  const router = useRouter();

  const shouldAnimate = !hasAnimated && pathname === "/";

  useEffect(() => {
    setIsMounted(true);
    hasAnimated = true;
    
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (isMounted) {
      const token = localStorage.getItem("token");
      setIsLoggedIn(!!token);
    }
  }, [isMounted]);

  return (
    <>
      <motion.nav
        initial={{ y: shouldAnimate ? -100 : 0 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className={`fixed w-full z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white/90 backdrop-blur-md shadow-md py-3"
            : "bg-white py-5"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            
            {/* LOGO */}
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-10 h-10 bg-[#DC2626] rounded-xl flex items-center justify-center text-white transform group-hover:rotate-12 transition-transform duration-300">
                <ShoppingBag size={20} />
              </div>
              <span className="text-2xl font-bold text-black tracking-tighter">
                MEGA<span className="text-[#DC2626]">WAI</span>
              </span>
            </Link>

            {/* DESKTOP MENU */}
            <div className="hidden md:flex items-center space-x-8">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className="relative text-sm font-medium text-black/70 hover:text-[#DC2626] transition-colors"
                >
                  {link.name}
                  {pathname === link.href && (
                    <motion.div
                      layoutId="underline"
                      className="absolute left-0 top-full mt-1 w-full h-0.5 bg-[#DC2626]"
                    />
                  )}
                </Link>
              ))}
            </div>

            {/* AUTH BUTTONS */}
            <div className="hidden md:flex items-center gap-4">
              {isLoggedIn === null ? (
                <div className="w-24 h-9 bg-gray-100 rounded-full animate-pulse" />
              ) : isLoggedIn ? (
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 pr-4 border-r border-gray-300">
                        <div className="text-right hidden lg:block">
                            <p className="text-sm font-bold text-gray-800 leading-none">Pengguna</p>
                            <p className="text-[10px] text-gray-500">UMKM</p>
                        </div>
                        <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center border border-gray-200 cursor-pointer hover:bg-gray-200 transition">
                            <User size={18} className="text-gray-600"/>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                          localStorage.removeItem("token");
                          localStorage.removeItem("user_id");
                          setIsLoggedIn(false);
                          router.push("/");
                        }}
                        className="text-gray-500 hover:text-[#DC2626] transition-colors" title="Keluar">
                        <LogOut size={20} />
                    </button>
                </div>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="text-sm font-semibold text-black hover:text-[#DC2626] transition-colors"
                  >
                    Masuk
                  </Link>
                  <Link href="/login?mode=register">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="px-5 py-2 bg-[#DC2626] text-white text-sm font-bold rounded-full shadow-lg hover:bg-red-700 transition-colors"
                    >
                      Daftar
                    </motion.button>
                  </Link>
                </>
              )}
            </div>

            {/* MOBILE HAMBURGER */}
            <div className="md:hidden">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="text-black hover:text-[#DC2626] transition-colors"
              >
                {isOpen ? <X size={28} /> : <Menu size={28} />}
              </button>
            </div>
          </div>
        </div>

        {/* MOBILE MENU */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-white border-t border-gray-100 overflow-hidden shadow-xl"
            >
              <div className="px-4 pt-4 pb-6 space-y-2 flex flex-col">
                {navLinks.map((link) => (
                  <Link
                    key={link.name}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className={`block px-3 py-3 rounded-md text-base font-medium ${
                      pathname === link.href
                        ? "bg-red-50 text-[#DC2626]"
                        : "text-gray-700 hover:bg-gray-50 hover:text-[#DC2626]"
                    }`}
                  >
                    {link.name}
                  </Link>
                ))}

                <div className="border-t border-gray-100 my-2 pt-2 space-y-2">
                  {isLoggedIn === null ? (
                    <div className="px-3 py-3">
                      <div className="w-full h-10 bg-gray-100 rounded-lg animate-pulse" />
                    </div>
                  ) : isLoggedIn ? (
                    <>
                      <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg">
                        <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center border border-gray-200">
                          <User size={16} className="text-gray-600"/>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-gray-800">Pengguna UMKM</span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          localStorage.removeItem("token");
                          localStorage.removeItem("user_id");
                          setIsLoggedIn(false);
                          setIsOpen(false);
                          router.push("/");
                        }}
                        className="w-full flex items-center gap-2 px-3 py-3 text-red-600 font-medium hover:bg-red-50 rounded-lg"
                      >
                        <LogOut size={18} /> Keluar
                      </button>
                    </>
                  ) : (
                    <>
                      <Link href="/login" onClick={() => setIsOpen(false)}>
                        <button className="w-full text-left px-3 py-3 text-gray-700 font-medium hover:text-[#DC2626]">
                          Masuk
                        </button>
                      </Link>
                      <Link href="/login?mode=register" onClick={() => setIsOpen(false)}>
                        <button className="w-full px-3 py-3 bg-[#DC2626] text-white rounded-lg font-bold shadow-md">
                          Daftar Sekarang
                        </button>
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>
      <div className="h-24" /> 
    </>
  );
}
