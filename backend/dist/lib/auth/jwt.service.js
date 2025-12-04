"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = verifyToken;
const jose_1 = require("jose");
const jwtSecret = process.env.SUPABASE_JWT_SECRET;
if (!jwtSecret) {
    throw new Error('SUPABASE_JWT_SECRET wajib ada di .env');
}
const secretKey = new TextEncoder().encode(jwtSecret);
async function verifyToken(token) {
    if (!token) {
        throw new Error('Token tidak ditemukan');
    }
    try {
        const { payload } = await (0, jose_1.jwtVerify)(token, secretKey);
        if (!payload?.sub) {
            throw new Error('Payload token tidak memiliki sub');
        }
        return payload;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Token tidak valid';
        console.error("JWT Verify Error:", message);
        throw new Error(`Verifikasi token gagal: ${message}`);
    }
}
