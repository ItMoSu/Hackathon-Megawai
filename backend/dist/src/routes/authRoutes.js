"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const authController_1 = require("../controllers/authController");
const router = express_1.default.Router();
// Rate limiting for auth endpoints - prevent brute force attacks
const authRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts per 15 minutes
    message: {
        success: false,
        error: 'Terlalu banyak percobaan. Silakan coba lagi dalam 15 menit.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});
// Stricter rate limit for registration
const registerRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 registrations per hour per IP
    message: {
        success: false,
        error: 'Batas registrasi tercapai. Silakan coba lagi dalam 1 jam.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});
// Email check rate limit (less strict for UX)
const checkEmailRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 20, // 20 checks per 5 minutes
    message: {
        success: false,
        error: 'Terlalu banyak permintaan. Silakan coba lagi.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});
router.post('/check-email', checkEmailRateLimiter, authController_1.checkEmail);
router.post('/register', registerRateLimiter, authController_1.register);
router.post('/login', authRateLimiter, authController_1.login);
exports.default = router;
