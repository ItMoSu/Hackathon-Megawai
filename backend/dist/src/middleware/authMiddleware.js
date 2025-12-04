"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuth = exports.requireAuth = exports.authenticateToken = void 0;
const middleware_1 = require("../../lib/auth/middleware");
Object.defineProperty(exports, "requireAuth", { enumerable: true, get: function () { return middleware_1.requireAuth; } });
Object.defineProperty(exports, "optionalAuth", { enumerable: true, get: function () { return middleware_1.optionalAuth; } });
// Route-level guard that enforces authenticated access
exports.authenticateToken = middleware_1.requireAuth;
