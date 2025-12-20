"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ShoppingBag, User, LogOut, Sun, Moon } from "lucide-react";
import { getToken, getUserName, clearAuth, ensureDisplayName } from "@/lib/auth";
import { useTheme } from "@/lib/theme-context";

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
  const [userName, setUserName] = useState<string | null>(null);

  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const shouldAnimate = !hasAnimated && pathname === "/";

useEffect(() => {
    const timer = setTimeout(() => {
      setIsMounted(true);
      
      const token = getToken();
      setIsLoggedIn(!!token);
      const storedName = getUserName() || ensureDisplayName();
      if (storedName) setUserName(storedName);
    }, 0);

  hasAnimated = true; 

  const handleScroll = () => {
    setScrolled(window.scrollY > 20);
  };
  
  window.addEventListener("scroll", handleScroll, { passive: true });

  return () => {
    clearTimeout(timer); 
    window.removeEventListener("scroll", handleScroll);
  };
}, []);

  const displayName = userName || "Pengguna";

  return (
    <>
      <motion.nav
        initial={{ y: shouldAnimate ? -100 : 0 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className={`fixed w-full z-50 transition-all duration-300 ${
          scrolled
            ? theme === "dark" 
              ? "bg-gray-900/95 backdrop-blur-md shadow-md py-3 border-b border-gray-800"
              : "bg-white/90 backdrop-blur-md shadow-md py-3"
            : theme === "dark"
              ? "bg-gray-900 py-5"
              : "bg-white py-5"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            
            {/* LOGO */}
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-9 h-9 bg-[#DC2626] rounded-xl flex items-center justify-center text-white transform group-hover:rotate-12 transition-transform duration-300">
                <ShoppingBag size={18} />
              </div>
                <span className={`text-xl font-bold ${theme === "dark" ? "text-white" : "text-black"}`}>
                  MEGAW <span className="text-[#DC2626] ml-1">AI</span>
                </span>
            </Link>

            {/* DESKTOP MENU */}
            <div className="hidden md:flex items-center space-x-8">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`relative text-sm font-medium transition-colors pb-1 ${
                    pathname === link.href
                      ? "text-[#DC2626]"
                      : theme === "dark" 
                        ? "text-gray-300 hover:text-[#DC2626]" 
                        : "text-black/70 hover:text-[#DC2626]"
                  }`}
                >
                  {link.name}
                  {pathname === link.href && (
                    <motion.div
                      layoutId="navbar-underline"
                      className="absolute left-0 bottom-0 w-full h-0.5 bg-[#DC2626] rounded-full"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                </Link>
              ))}
            </div>

            {/* AUTH BUTTONS */}
            <div className="hidden md:flex items-center gap-4">
              {/* Dark Mode Toggle */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleTheme}
                className={`p-2 rounded-full transition-colors ${
                  theme === "dark"
                    ? "bg-gray-800 text-yellow-400 hover:bg-gray-700"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                title={theme === "dark" ? "Mode Terang" : "Mode Gelap"}
              >
                {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
              </motion.button>

              {isLoggedIn === null ? (
                <div className={`w-24 h-9 rounded-full animate-pulse ${theme === "dark" ? "bg-gray-800" : "bg-gray-100"}`} />
              ) : isLoggedIn ? (
                <div className="flex items-center gap-4">
                    <div className={`flex items-center gap-2 pr-4 border-r ${theme === "dark" ? "border-gray-700" : "border-gray-300"}`}>
                        <div className="text-right hidden lg:block">
                            <p className={`text-sm font-bold leading-none ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}>{displayName}</p>
                            <p className={`text-[10px] ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>UMKM</p>
                        </div>
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center border cursor-pointer transition ${
                          theme === "dark" 
                            ? "bg-gray-800 border-gray-700 hover:bg-gray-700" 
                            : "bg-gray-100 border-gray-200 hover:bg-gray-200"
                        }`}>
                            <User size={18} className={theme === "dark" ? "text-gray-300" : "text-gray-600"}/>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                          clearAuth();
                          setIsLoggedIn(false);
                          setUserName(null);
                          router.push("/");
                        }}
                        className={`transition-colors ${theme === "dark" ? "text-gray-400 hover:text-[#DC2626]" : "text-gray-500 hover:text-[#DC2626]"}`} 
                        title="Keluar">
                        <LogOut size={20} />
                    </button>
                </div>
              ) : (
                <>
                  <Link
                    href="/login"
                    className={`text-sm font-semibold transition-colors ${theme === "dark" ? "text-gray-300 hover:text-[#DC2626]" : "text-black hover:text-[#DC2626]"}`}
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
            <div className="md:hidden flex items-center gap-3">
              {/* Mobile Dark Mode Toggle */}
              <button
                onClick={toggleTheme}
                className={`p-2 rounded-full transition-colors ${
                  theme === "dark"
                    ? "bg-gray-800 text-yellow-400"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button
                onClick={() => setIsOpen(!isOpen)}
                className={`transition-colors ${theme === "dark" ? "text-white hover:text-[#DC2626]" : "text-black hover:text-[#DC2626]"}`}
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
              className={`md:hidden overflow-hidden shadow-xl ${
                theme === "dark" 
                  ? "bg-gray-900 border-t border-gray-800" 
                  : "bg-white border-t border-gray-100"
              }`}
            >
              <div className="px-4 pt-4 pb-6 space-y-2 flex flex-col">
                {navLinks.map((link) => (
                  <Link
                    key={link.name}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className={`block px-3 py-3 rounded-md text-base font-medium ${
                      pathname === link.href
                        ? theme === "dark" 
                          ? "bg-red-900/30 text-[#DC2626] border-l-4 border-[#DC2626]" 
                          : "bg-red-50 text-[#DC2626] border-l-4 border-[#DC2626]"
                        : theme === "dark"
                          ? "text-gray-300 hover:bg-gray-800 hover:text-[#DC2626]"
                          : "text-gray-700 hover:bg-gray-50 hover:text-[#DC2626]"
                    }`}
                  >
                    {link.name}
                  </Link>
                ))}

                <div className={`my-2 pt-2 space-y-2 ${theme === "dark" ? "border-t border-gray-800" : "border-t border-gray-100"}`}>
                  {isLoggedIn === null ? (
                    <div className="px-3 py-3">
                      <div className={`w-full h-10 rounded-lg animate-pulse ${theme === "dark" ? "bg-gray-800" : "bg-gray-100"}`} />
                    </div>
                  ) : isLoggedIn ? (
                    <>
                      <div className={`flex items-center gap-3 px-3 py-2 rounded-lg ${theme === "dark" ? "bg-gray-800" : "bg-gray-50"}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${
                          theme === "dark" ? "bg-gray-700 border-gray-600" : "bg-white border-gray-200"
                        }`}>
                          <User size={16} className={theme === "dark" ? "text-gray-300" : "text-gray-600"}/>
                        </div>
                        <div className="flex flex-col">
                          <span className={`text-sm font-bold ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}>{displayName} UMKM</span>
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
                        className={`w-full flex items-center gap-2 px-3 py-3 text-red-500 font-medium rounded-lg ${
                          theme === "dark" ? "hover:bg-red-900/30" : "hover:bg-red-50"
                        }`}
                      >
                        <LogOut size={18} /> Keluar
                      </button>
                    </>
                  ) : (
                    <>
                      <Link href="/login" onClick={() => setIsOpen(false)}>
                        <button className={`w-full text-left px-3 py-3 font-medium hover:text-[#DC2626] ${
                          theme === "dark" ? "text-gray-300" : "text-gray-700"
                        }`}>
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
