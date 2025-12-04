"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expectedAudience = exports.expectedIssuer = exports.jwksUri = exports.supabaseUrl = void 0;
// Konfigurasi dasar untuk verifikasi JWT Supabase
const rawSupabaseUrl = process.env.SUPABASE_URL;
if (!rawSupabaseUrl) {
    throw new Error('SUPABASE_URL diperlukan untuk konfigurasi JWT Supabase');
}
// Normalize untuk menghindari double slash
exports.supabaseUrl = rawSupabaseUrl.replace(/\/+$/, '');
exports.jwksUri = `${exports.supabaseUrl}/auth/v1/.well-known/jwks.json`;
exports.expectedIssuer = `${exports.supabaseUrl}/auth/v1`;
exports.expectedAudience = process.env.SUPABASE_JWT_AUDIENCE || 'authenticated';
