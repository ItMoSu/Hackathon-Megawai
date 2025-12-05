"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ShoppingBag, User, LogOut, Settings } from "lucide-react";

const navLinks = [
  { name: "Home", href: "/" },
  { name: "Products", href: "/products" },
  { name: "Dashboard", href: "/dashboard" },
  { name: "Input Data", href: "/input" },
  { name: "Reports", href: "/reports" },
];

// VARIABEL GLOBAL: 
// Disimpan di memori browser selama tab tidak di-refresh.
// Ini mencegah animasi ulang saat navigasi antar halaman.
let hasAnimated = false;

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false); // Simulasi login state

  const pathname = usePathname();

  // LOGIKA ANIMASI:
  // Animasi hanya jalan jika:
  // 1. Ini adalah load pertama (hasAnimated masih false)
  // 2. User berada di halaman Home ("/")
  const shouldAnimate = !hasAnimated && pathname === "/";

  useEffect(() => {
    // Deteksi scroll untuk efek kaca (glassmorphism)
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);

    // Setelah komponen dimount sekali, kita tandai bahwa animasi sudah pernah terjadi.
    hasAnimated = true;

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <motion.nav
        // KUNCI PERUBAHAN DISINI:
        // Jika `shouldAnimate` true, mulai dari -100 (atas).
        // Jika tidak (sudah pernah load atau bukan home), mulai dari 0 (diam).
        initial={{ y: shouldAnimate ? -100 : 0 }}
        animate={{ y: 0 }}
        // Kita set layout prop agar Framer Motion tau ini komponen layout persisten
        layout="position" 
        transition={{ duration: 0.5, ease: "easeOut" }}
        className={`fixed w-full z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white/90 backdrop-blur-md shadow-md py-3"
            : "bg-transparent py-5"
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
                Market<span className="text-[#DC2626]">Pulse</span>
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
                      // layoutId membuat garis bawah 'meluncur' saat pindah menu.
                      // Jika kamu merasa ini juga "jelek" saat pindah page jauh, hapus baris layoutId ini.
                      layoutId="underline"
                      className="absolute left-0 top-full mt-1 w-full h-0.5 bg-[#DC2626]"
                    />
                  )}
                </Link>
              ))}
            </div>

            {/* AUTH BUTTONS */}
            <div className="hidden md:flex items-center gap-4">
              {isLoggedIn ? (
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 pr-4 border-r border-gray-300">
                        <div className="text-right hidden lg:block">
                            <p className="text-sm font-bold text-gray-800 leading-none">Admin</p>
                            <p className="text-[10px] text-gray-500">Super User</p>
                        </div>
                        <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center border border-gray-200 cursor-pointer hover:bg-gray-200 transition">
                            <User size={18} className="text-gray-600"/>
                        </div>
                    </div>
                    <button 
                        onClick={() => setIsLoggedIn(false)} 
                        className="text-gray-500 hover:text-[#DC2626] transition-colors" title="Logout">
                        <LogOut size={20} />
                    </button>
                </div>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={(e) => { e.preventDefault(); setIsLoggedIn(true); }}
                    className="text-sm font-semibold text-black hover:text-[#DC2626] transition-colors"
                  >
                    Log In
                  </Link>
                  <Link href="/register">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="px-5 py-2 bg-[#DC2626] text-white text-sm font-bold rounded-full shadow-lg hover:bg-red-700 transition-colors"
                    >
                      Sign Up
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
                {navLinks.map((link, i) => (
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
                  {isLoggedIn ? (
										<>
                        <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg">
                            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center border border-gray-200">
                                <User size={16} className="text-gray-600"/>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-gray-800">Admin User</span>
                            </div>
                        </div>
                        <button 
                            onClick={() => { setIsLoggedIn(false); setIsOpen(false); }}
                            className="w-full flex items-center gap-2 px-3 py-3 text-red-600 font-medium hover:bg-red-50 rounded-lg"
                        >
                            <LogOut size={18} /> Logout
                        </button>
                     </>
                  ) : (
                    <>
                        <Link href="/login" onClick={() => setIsOpen(false)}>
                            <button className="w-full text-left px-3 py-3 text-gray-700 font-medium hover:text-[#DC2626]">
                            Log In
                            </button>
                        </Link>
                        <Link href="/register" onClick={() => setIsOpen(false)}>
                            <button className="w-full px-3 py-3 bg-[#DC2626] text-white rounded-lg font-bold shadow-md">
                            Sign Up Now
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