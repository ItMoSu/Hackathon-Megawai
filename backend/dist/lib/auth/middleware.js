"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.optionalAuth = optionalAuth;
const jwt_service_1 = require("./jwt.service");
// Ekstraksi token dari header Authorization
function extractBearerToken(authHeader) {
    if (!authHeader)
        return null;
    const match = authHeader.match(/^[Bb]earer\s+(.+)$/);
    return match ? match[1].trim() : null;
}
async function requireAuth(req, res, next) {
    try {
        const token = extractBearerToken(req.headers.authorization);
        if (!token) {
            res.status(401).json({ error: 'Authorization header dengan Bearer token diperlukan' });
            return;
        }
        const payload = await (0, jwt_service_1.verifyToken)(token);
        req.user = payload;
        req.token = token;
        next();
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unauthorized';
        res.status(401).json({ error: message });
    }
}
async function optionalAuth(req, res, next) {
    try {
        const token = extractBearerToken(req.headers.authorization);
        if (!token) {
            return next();
        }
        const payload = await (0, jwt_service_1.verifyToken)(token);
        req.user = payload;
        req.token = token;
        next();
    }
    catch (error) {
        // Untuk optional auth, jika token tidak valid tetap lanjut tanpa user
        next();
    }
}
