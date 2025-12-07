import type { Request, Response } from 'express';
import { supabaseAdmin } from '../../lib/auth/supabaseAdmin';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email?: string): boolean {
  return !!email && emailRegex.test(email);
}

function validatePassword(password?: string): boolean {
  return !!password && password.length >= 6;
}

async function findUserByEmail(email: string) {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers();

  if (error) {
    throw new Error(error.message);
  }

  return data?.users.find(
    (u) => u.email && u.email.toLowerCase() === email.toLowerCase(),
  );
}

export async function checkEmail(req: Request, res: Response) {
  try {
    const { email } = req.body;

    if (!validateEmail(email)) {
      return res.status(400).json({ success: false, error: 'Email tidak valid' });
    }

    const user = await findUserByEmail(email);

    return res.json({
      success: true,
      data: { exists: Boolean(user) },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan';
    return res.status(500).json({ success: false, error: message });
  }
}

export async function register(req: Request, res: Response) {
  try {
    const { email, password, name } = req.body;

    if (!validateEmail(email)) {
      return res.status(400).json({ success: false, error: 'Email tidak valid' });
    }

    if (!validatePassword(password)) {
      return res
        .status(400)
        .json({ success: false, error: 'Password minimal 6 karakter' });
    }

    const existing = await findUserByEmail(email);

    if (existing) {
      return res.status(400).json({ success: false, error: 'Email sudah terdaftar' });
    }

    // Use signUp instead of admin.createUser to trigger email verification
    const { data: signUpData, error: signUpError } =
      await supabaseAdmin.auth.signUp({
        email,
        password,
        options: {
          data: name ? { full_name: name } : {},
          emailRedirectTo: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?verified=true`,
        },
      });

    if (signUpError || !signUpData?.user) {
      const message = signUpError?.message || 'Gagal membuat akun';
      return res.status(500).json({ success: false, error: message });
    }

    // Check if email confirmation is required
    if (signUpData.session) {
      // Email confirm disabled in Supabase settings - user logged in immediately
      const { access_token, refresh_token } = signUpData.session;
      return res.status(201).json({
        success: true,
        data: {
          access_token,
          refresh_token,
          user: {
            id: signUpData.user.id,
            email: signUpData.user.email,
          },
        },
      });
    } else {
      // Email confirmation required - tell user to check email
      return res.status(201).json({
        success: true,
        message: 'Registrasi berhasil! Silakan cek email Anda untuk verifikasi.',
        data: {
          user: {
            id: signUpData.user.id,
            email: signUpData.user.email,
          },
          requires_verification: true,
        },
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan';
    return res.status(500).json({ success: false, error: message });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if (!validateEmail(email)) {
      return res.status(400).json({ success: false, error: 'Email tidak valid' });
    }

    if (!validatePassword(password)) {
      return res
        .status(400)
        .json({ success: false, error: 'Password minimal 6 karakter' });
    }

    const existing = await findUserByEmail(email);

    if (!existing) {
      return res.status(400).json({ success: false, error: 'Email belum terdaftar' });
    }

    const { data: sessionData, error: signInError } =
      await supabaseAdmin.auth.signInWithPassword({ email, password });

    if (signInError || !sessionData.session) {
      const message = signInError?.message || 'Email atau password salah';
      return res.status(401).json({ success: false, error: message });
    }

    const { access_token, refresh_token, user } = sessionData.session;

    return res.json({
      success: true,
      data: {
        access_token,
        refresh_token,
        user: {
          id: user.id,
          email: user.email,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan';
    return res.status(500).json({ success: false, error: message });
  }
}
