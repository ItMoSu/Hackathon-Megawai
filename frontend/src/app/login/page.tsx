"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { motion, AnimatePresence } from "framer-motion";
import { API_URL } from "@/lib/api";
import { setAuth } from "@/lib/auth";
import { sanitizeEmail } from "@/lib/sanitize";
import { CheckCircle, Mail } from "lucide-react";
import { useTheme } from "@/lib/theme-context";

const translateErrorMessage = (message: string): string => {
  const errorMap: Record<string, string> = {
    "Invalid login credentials": "Email atau kata sandi yang Anda masukkan salah",
    "Invalid credentials": "Email atau kata sandi yang Anda masukkan salah",
    "invalid login credentials": "Email atau kata sandi yang Anda masukkan salah",
    "User not found": "Akun dengan email tersebut tidak ditemukan",
    "user not found": "Akun dengan email tersebut tidak ditemukan",
    "Email not verified": "Email Anda belum diverifikasi. Silakan cek inbox email Anda",
    "email not verified": "Email Anda belum diverifikasi. Silakan cek inbox email Anda",
    "Invalid password": "Kata sandi yang Anda masukkan salah",
    "Wrong password": "Kata sandi yang Anda masukkan salah",
    "Password incorrect": "Kata sandi yang Anda masukkan salah",
    "Email already exists": "Email sudah terdaftar. Silakan gunakan email lain atau masuk",
    "Email already registered": "Email sudah terdaftar. Silakan gunakan email lain atau masuk",
    "User already exists": "Email sudah terdaftar. Silakan gunakan email lain atau masuk",
    "Password too short": "Kata sandi minimal 6 karakter",
    "Password too weak": "Kata sandi terlalu lemah. Gunakan kombinasi huruf dan angka",
    "Invalid email": "Format email tidak valid",
    "Invalid email format": "Format email tidak valid",
    "Network error": "Koneksi terputus. Periksa jaringan internet Anda",
    "Server error": "Terjadi kesalahan pada server. Silakan coba lagi nanti",
    "Too many requests": "Terlalu banyak percobaan. Silakan tunggu beberapa saat",
    "Rate limit exceeded": "Terlalu banyak percobaan. Silakan tunggu beberapa saat",
    "Login gagal": "Gagal masuk. Periksa kembali email dan kata sandi Anda",
    "Register gagal": "Gagal mendaftar. Silakan coba lagi",
  };

  const lowerMessage = message.toLowerCase();
  
  for (const [key, value] of Object.entries(errorMap)) {
    if (lowerMessage.includes(key.toLowerCase())) {
      return value;
    }
  }
  
  return message;
};

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme } = useTheme();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [showVerificationSent, setShowVerificationSent] = useState(false);

  // Check URL params for mode and verification status
  useEffect(() => {
    if (searchParams.get("verified") === "true") {
      setSuccessMessage("Email berhasil diverifikasi! Silakan login.");
    }
    if (searchParams.get("mode") === "register") {
      setMode("register");
    }
  }, [searchParams]);

  // =====================
  // LOGIN
  // =====================
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const sanitizedEmail = sanitizeEmail(email);
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: sanitizedEmail, password }),
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || data?.message || "Login gagal");
      }

      const accessToken = data?.data?.access_token;
      const userId = data?.data?.user?.id;
      const userEmail = data?.data?.user?.email;

      if (accessToken && userId) {
        setAuth(accessToken, userId, userEmail);
      }

      router.push("/products");
    } catch (err: any) {
      setError(translateErrorMessage(err.message || "Login gagal"));
    } finally {
      setLoading(false);
    }
  };

  // =====================
  // REGISTER
  // =====================
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const sanitizedEmail = sanitizeEmail(email);
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: sanitizedEmail, password }),
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || data?.message || "Register gagal");
      }

      // Check if email verification is required
      if (data?.data?.requires_verification) {
        setShowVerificationSent(true);
        return;
      }

      // No verification needed - login directly
      const accessToken = data?.data?.access_token;
      const userId = data?.data?.user?.id;
      const userEmail = data?.data?.user?.email;

      if (accessToken && userId) {
        setAuth(accessToken, userId, userEmail);
        router.push("/products");
      }
    } catch (err: unknown) {
      setError(translateErrorMessage(err instanceof Error ? err.message : "Register gagal"));
    } finally {
      setLoading(false);
    }
  };

  // Show verification sent screen
  if (showVerificationSent) {
    return (
      <div className={`min-h-screen flex items-center justify-center overflow-hidden transition-colors duration-300 ${
        theme === "dark" ? "bg-gray-900" : "bg-gray-50"
      }`}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <Card className="p-6">
            <CardContent className="text-center py-8">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                theme === "dark" ? "bg-green-900/30" : "bg-green-100"
              }`}>
                <Mail className="w-8 h-8 text-green-600" />
              </div>
              <h2 className={`text-2xl font-bold mb-2 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Cek Email Anda</h2>
              <p className={`mb-6 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                Kami telah mengirim link verifikasi ke <strong>{email}</strong>. 
                Klik link tersebut untuk mengaktifkan akun Anda.
              </p>
              <Button
                onClick={() => {
                  setShowVerificationSent(false);
                  setMode("login");
                }}
                className="w-full"
              >
                Kembali ke Login
              </Button>
              <p className={`text-sm mt-4 ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
                Tidak menerima email? Cek folder spam atau{" "}
                <span 
                  className="text-blue-500 cursor-pointer hover:text-blue-400"
                  onClick={() => setShowVerificationSent(false)}
                >
                  daftar ulang
                </span>
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex items-center justify-center overflow-hidden transition-colors duration-300 ${
      theme === "dark" ? "bg-gray-900" : "bg-gray-50"
    }`}>
      <motion.div
        layout
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="w-full max-w-md"
      >
        <Card className="p-6">
          <CardHeader>
            <motion.h2
              key={mode}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={`text-2xl font-bold text-center ${theme === "dark" ? "text-white" : "text-gray-900"}`}
            >
              {mode === "login" ? "Masuk ke Megaw AI" : "Daftar Akun Baru"}
            </motion.h2>
          </CardHeader>

          <CardContent>
            {/* Success message (e.g., after email verification) */}
            {successMessage && (
              <div className={`mb-4 p-3 border rounded-lg flex items-center gap-2 ${
                theme === "dark" ? "bg-green-900/30 border-green-800" : "bg-green-50 border-green-200"
              }`}>
                <CheckCircle className="w-5 h-5 text-green-600" />
                <p className={`text-sm ${theme === "dark" ? "text-green-400" : "text-green-700"}`}>{successMessage}</p>
              </div>
            )}

            <AnimatePresence mode="wait">
              {mode === "login" ? (
                <motion.form
                  key="login-form"
                  onSubmit={handleLogin}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-4"
                >
                  <Input
                    label="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />

                  <Input
                    label="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />

                  {error && <p className="text-red-500 text-sm">{error}</p>}

                  <Button type="submit" className="w-full" isLoading={loading}>
                    Masuk
                  </Button>

                  <p className={`text-center text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                    Belum punya akun?{" "}
                    <span
                      onClick={() => setMode("register")}
                      className="text-blue-500 cursor-pointer hover:text-blue-400"
                    >
                      Daftar sekarang
                    </span>
                  </p>
                </motion.form>
              ) : (
                <motion.form
                  key="register-form"
                  onSubmit={handleRegister}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-4"
                >
                  <Input
                    label="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />

                  <Input
                    label="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />

                  {error && <p className="text-red-500 text-sm">{error}</p>}

                  <Button type="submit" className="w-full" isLoading={loading}>
                    Buat Akun
                  </Button>

                  <p className={`text-center text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                    Sudah punya akun?{" "}
                    <span
                      onClick={() => setMode("login")}
                      className="text-blue-500 cursor-pointer hover:text-blue-400"
                    >
                      Masuk
                    </span>
                  </p>
                </motion.form>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
