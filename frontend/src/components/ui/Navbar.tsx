"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ShoppingBag, LayoutDashboard, User } from "lucide-react";

const navLinks = [
{ name: "Home", href: "/" },
{ name: "Products", href: "/products" },
{ name: "Dashboard", href: "/dashboard" },
{ name: "Input Data", href: "/input" },
];

export default function Navbar() {
const [isOpen, setIsOpen] = useState(false);
const [scrolled, setScrolled] = useState(false);
const pathname = usePathname();

    useEffect(() => {
        const handleScroll = () => {
        setScrolled(window.scrollY > 20);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <>
        <motion.nav
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.3 }}
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

                {/* DESKTOP MENU (CENTER) */}
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

                {/* AUTH BUTTONS (RIGHT) */}
                <div className="hidden md:flex items-center gap-4">
                <Link
                    href="/login"
                    className="text-sm font-semibold text-black hover:text-[#DC2626] transition-colors"
                >
                    Log In
                </Link>
                <Link href="/login">
                    <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-5 py-2 bg-[#DC2626] text-white text-sm font-bold rounded-full shadow-lg hover:bg-primary-hover transition-colors flex items-center gap-2"
                    >
                    Sign Up
                    </motion.button>
                </Link>
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

            {/* MOBILE MENU DROPDOWN */}
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
                    <motion.div
                        key={link.name}
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: i * 0.1 }}
                    >
                        <Link
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
                    </motion.div>
                    ))}
                    
                    <div className="border-t border-gray-100 my-2 pt-2 space-y-2">
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
                    </div>
                </div>
                </motion.div>
            )}
            </AnimatePresence>
        </motion.nav>
        
        <div className="h-20" /> 
        </>
    );
}