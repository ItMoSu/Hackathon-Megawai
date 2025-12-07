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

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

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

      if (accessToken && userId) {
        setAuth(accessToken, userId);
      }

      router.push("/products");
    } catch (err: any) {
      setError(err.message || "Login gagal");
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

      if (accessToken && userId) {
        setAuth(accessToken, userId);
        router.push("/products");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Register gagal");
    } finally {
      setLoading(false);
    }
  };

  // Show verification sent screen
  if (showVerificationSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <Card className="p-6">
            <CardContent className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Cek Email Anda</h2>
              <p className="text-gray-600 mb-6">
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
              <p className="text-sm text-gray-500 mt-4">
                Tidak menerima email? Cek folder spam atau{" "}
                <span 
                  className="text-blue-600 cursor-pointer"
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 overflow-hidden">
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
              className="text-2xl font-bold text-center"
            >
              {mode === "login" ? "Masuk ke Megaw AI" : "Daftar Akun Baru"}
            </motion.h2>
          </CardHeader>

          <CardContent>
            {/* Success message (e.g., after email verification) */}
            {successMessage && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <p className="text-green-700 text-sm">{successMessage}</p>
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

                  <p className="text-center text-sm">
                    Belum punya akun?{" "}
                    <span
                      onClick={() => setMode("register")}
                      className="text-blue-600 cursor-pointer"
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

                  <p className="text-center text-sm">
                    Sudah punya akun?{" "}
                    <span
                      onClick={() => setMode("login")}
                      className="text-blue-600 cursor-pointer"
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
