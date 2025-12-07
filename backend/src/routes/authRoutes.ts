import express from 'express';
import { checkEmail, login, register } from '../controllers/authController';

const router = express.Router();

// No rate limiting - Supabase handles duplicate email validation
router.post('/check-email', checkEmail);
router.post('/register', register);
router.post('/login', login);

export default router;
