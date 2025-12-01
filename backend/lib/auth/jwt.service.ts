import { jwtVerify } from 'jose';
import type { VerifiedToken } from './types';

const jwtSecret = process.env.SUPABASE_JWT_SECRET;

if (!jwtSecret) {
  throw new Error('SUPABASE_JWT_SECRET wajib ada di .env');
}

const secretKey = new TextEncoder().encode(jwtSecret);

export async function verifyToken(token: string): Promise<VerifiedToken> {
  if (!token) {
    throw new Error('Token tidak ditemukan');
  }

  try {
    const { payload } = await jwtVerify(token, secretKey);

    if (!payload?.sub) {
      throw new Error('Payload token tidak memiliki sub');
    }

    return payload as VerifiedToken;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Token tidak valid';
    console.error("JWT Verify Error:", message); 
    
    throw new Error(`Verifikasi token gagal: ${message}`);
  }
}