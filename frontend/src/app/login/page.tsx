"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { motion, AnimatePresence } from "framer-motion";

export default function AuthPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // =====================
  // LOGIN
  // =====================
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || data?.message || "Login gagal");
      }

      const accessToken = data?.data?.access_token;
      const userId = data?.data?.user?.id;

      if (accessToken && userId) {
        localStorage.setItem("token", accessToken);
        localStorage.setItem("user_id", userId);
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
      const res = await fetch("http://localhost:5000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || data?.message || "Register gagal");
      }

      const accessToken = data?.data?.access_token;
      const userId = data?.data?.user?.id;

      if (accessToken && userId) {
        localStorage.setItem("token", accessToken);
        localStorage.setItem("user_id", userId);
      }

      router.push("/products");
    } catch (err: any) {
      setError(err.message || "Register gagal");
    } finally {
      setLoading(false);
    }
  };

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
              {mode === "login" ? "Login Market Pulse" : "Daftar Akun Baru"}
            </motion.h2>
          </CardHeader>

          <CardContent>
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
                      Login
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
