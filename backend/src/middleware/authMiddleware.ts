import { requireAuth, optionalAuth } from '../../lib/auth/middleware';

// Route-level guard that enforces authenticated access
export const authenticateToken = requireAuth;

export { requireAuth, optionalAuth };
