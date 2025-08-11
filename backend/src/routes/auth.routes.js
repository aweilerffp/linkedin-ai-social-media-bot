import express from 'express';
import { AuthController } from '../controllers/AuthController.js';
import { authenticate, requireRole, auditLog } from '../middleware/authentication.js';
import { validateRequest } from '../middleware/validation.js';
import { 
  authLoginLimit, 
  authRegisterLimit, 
  authPasswordResetLimit,
  authRefreshLimit,
  oauthConnectLimit,
  oauthCallbackLimit,
  ipRateLimit
} from '../middleware/rateLimiting.js';
import Joi from 'joi';

const router = express.Router();

// Validation schemas
const registerSchema = {
  body: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    name: Joi.string().min(1).max(100).required(),
    teamName: Joi.string().min(1).max(100).optional(),
  }),
  query: Joi.object({}),
  params: Joi.object({}),
};

const loginSchema = {
  body: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),
  query: Joi.object({}),
  params: Joi.object({}),
};

const refreshTokenSchema = {
  body: Joi.object({
    refreshToken: Joi.string().required(),
  }),
};

const changePasswordSchema = {
  body: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).required(),
  }),
};

const resetPasswordSchema = {
  body: Joi.object({
    token: Joi.string().required(),
    newPassword: Joi.string().min(8).required(),
  }),
};

const inviteUserSchema = {
  body: Joi.object({
    email: Joi.string().email().required(),
    name: Joi.string().min(1).max(100).required(),
    role: Joi.string().valid('member', 'manager').default('member'),
  }),
};

// Public routes (no authentication required)
router.post('/register', authRegisterLimit, validateRequest(registerSchema), AuthController.register);
router.post('/login', authLoginLimit, validateRequest(loginSchema), AuthController.login);
router.post('/refresh', authRefreshLimit, validateRequest(refreshTokenSchema), AuthController.refreshToken);
router.post('/request-reset', authPasswordResetLimit, AuthController.requestPasswordReset);
router.post('/reset-password', authPasswordResetLimit, validateRequest(resetPasswordSchema), AuthController.resetPassword);

// OAuth routes
router.get('/oauth/:platform', authenticate, oauthConnectLimit, AuthController.startOAuth);
router.get('/oauth/:platform/callback', oauthCallbackLimit, AuthController.handleOAuthCallback);

// Protected routes (authentication required)
router.use(authenticate);

router.get('/profile', AuthController.getProfile);
router.post('/logout', auditLog('logout'), AuthController.logout);
router.post('/change-password', 
  validateRequest(changePasswordSchema), 
  auditLog('change-password'), 
  AuthController.changePassword
);

// Platform management
router.get('/platforms', AuthController.getPlatformCredentials);
router.delete('/platforms/:platform', 
  auditLog('disconnect-platform'), 
  AuthController.disconnectPlatform
);
router.get('/platforms/:platform/test', AuthController.testConnection);
router.post('/platforms/:platform/refresh', AuthController.refreshPlatformCredentials);

// Team management routes (manager+ required)
router.post('/invite', 
  requireRole('manager'),
  validateRequest(inviteUserSchema),
  auditLog('invite-user'),
  AuthController.inviteUser
);

export default router;