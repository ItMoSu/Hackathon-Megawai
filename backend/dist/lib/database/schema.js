"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.warmupConnection = warmupConnection;
exports.checkConnection = checkConnection;
const client_1 = require("@prisma/client");
const globalForPrisma = globalThis;
// Optimized Prisma client for serverless (Vercel)
const prisma = globalForPrisma.prisma ?? new client_1.PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
});
exports.prisma = prisma;
// Keep prisma instance in global scope to reuse connections across requests
globalForPrisma.prisma = prisma;
// Warm up database connection (call once on startup)
async function warmupConnection() {
    if (globalForPrisma.isConnected)
        return true;
    try {
        await prisma.$queryRaw `SELECT 1`;
        globalForPrisma.isConnected = true;
        console.log('[DB] Connection warmed up successfully');
        return true;
    }
    catch (error) {
        console.error('[DB] Connection warmup failed:', error);
        globalForPrisma.isConnected = false;
        return false;
    }
}
// Check if database is reachable
async function checkConnection() {
    const start = Date.now();
    try {
        await prisma.$queryRaw `SELECT 1`;
        return { ok: true, latency: Date.now() - start };
    }
    catch (error) {
        return { ok: false, error: error.message };
    }
}
