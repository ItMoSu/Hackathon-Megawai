"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase'; 
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('test@admin.com'); // Default biar cepat
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Login ke Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.session) {
        // 2. SIMPAN TOKEN (PENTING!)
        // Token inilah yang nanti dikirim ke Backend agar tidak 401
        localStorage.setItem('token', data.session.access_token);
        localStorage.setItem('user_id', data.user.id);

        console.log("Login Sukses! Token:", data.session.access_token);
        router.push('/products'); // Pindah ke halaman produk
      }
    } catch (err: any) {
      setError(err.message || "Login gagal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md p-6">
        <CardHeader>
          <h2 className="text-2xl font-bold text-center">Login Market Pulse</h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
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
          </form>
        </CardContent>
      </Card>
    </div>
  );
}