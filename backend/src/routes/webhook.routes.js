import express from 'express';
import { WebhookController } from '../controllers/WebhookController.js';
import { authenticate, requireTeam, requireRole, auditLog } from '../middleware/authentication.js';
import { validateRequest } from '../middleware/validation.js';
import { rateLimit } from '../middleware/rateLimiting.js';
import Joi from 'joi';

const router = express.Router();

// Validation schemas
const createWebhookSchema = {
  body: Joi.object({
    url: Joi.string().uri({ scheme: ['http', 'https'] }).required(),
    events: Joi.array()
      .items(
        Joi.string().valid(
          'post.published',
          'post.failed',
          'post.scheduled',
          'user.invited',
          'platform.connected',
          'platform.disconnected',
          'webhook.test'
        )
      )
      .min(1)
      .required(),
    secret: Joi.string().min(8).optional(),
    name: Joi.string().min(1).max(100).optional(),
    description: Joi.string().max(500).optional(),
    isActive: Joi.boolean().default(true),
  }),
};

const updateWebhookSchema = {
  body: Joi.object({
    url: Joi.string().uri({ scheme: ['http', 'https'] }).optional(),
    events: Joi.array()
      .items(
        Joi.string().valid(
          'post.published',
          'post.failed',
          'post.scheduled',
          'user.invited',
          'platform.connected',
          'platform.disconnected',
          'webhook.test'
        )
      )
      .min(1)
      .optional(),
    secret: Joi.string().min(8).optional(),
    name: Joi.string().min(1).max(100).optional(),
    description: Joi.string().max(500).optional(),
    isActive: Joi.boolean().optional(),
  }).min(1),
};

const triggerWebhookSchema = {
  body: Joi.object({
    event: Joi.string()
      .valid(
        'post.published',
        'post.failed',
        'post.scheduled',
        'user.invited',
        'platform.connected',
        'platform.disconnected',
        'webhook.test'
      )
      .required(),
    data: Joi.object().required(),
  }),
};

const verifySignatureSchema = {
  body: Joi.object({
    payload: Joi.object().required(),
    signature: Joi.string().required(),
    secret: Joi.string().optional(),
  }),
};

const getDeliveriesSchema = {
  query: Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(50),
    offset: Joi.number().integer().min(0).default(0),
    status: Joi.string().valid('success', 'failed', 'pending').optional(),
    event: Joi.string().optional(),
  }),
};

// Meeting recorder webhook (public endpoint - no auth required)
router.post('/meeting-recorder', WebhookController.handleMeetingRecorderWebhook);

// Webhook testing proxy (public endpoint - no auth required)
router.post('/test-proxy', WebhookController.testWebhookProxy);

// All other routes require authentication and team membership
router.use(authenticate);
router.use(requireTeam);

// Public webhook info (no rate limiting needed)
router.get('/events', WebhookController.getWebhookEvents);

// Webhook configuration routes
router.post(
  '/',
  validateRequest(createWebhookSchema),
  rateLimit('webhook.create', { maxRequests: 10, windowMs: 60 * 60 * 1000 }),
  auditLog('create-webhook'),
  WebhookController.createWebhook
);

router.get(
  '/',
  rateLimit('webhook.list', { maxRequests: 100, windowMs: 15 * 60 * 1000 }),
  WebhookController.getWebhooks
);

router.get(
  '/stats',
  rateLimit('webhook.stats', { maxRequests: 50, windowMs: 15 * 60 * 1000 }),
  WebhookController.getWebhookStats
);

router.get(
  '/:webhookId',
  rateLimit('webhook.get', { maxRequests: 100, windowMs: 15 * 60 * 1000 }),
  WebhookController.getWebhook
);

router.put(
  '/:webhookId',
  validateRequest(updateWebhookSchema),
  rateLimit('webhook.update', { maxRequests: 20, windowMs: 60 * 60 * 1000 }),
  auditLog('update-webhook'),
  WebhookController.updateWebhook
);

router.delete(
  '/:webhookId',
  rateLimit('webhook.delete', { maxRequests: 10, windowMs: 60 * 60 * 1000 }),
  auditLog('delete-webhook'),
  WebhookController.deleteWebhook
);

// Webhook testing
router.post(
  '/:webhookId/test',
  rateLimit('webhook.test', { maxRequests: 10, windowMs: 15 * 60 * 1000 }),
  auditLog('test-webhook'),
  WebhookController.testWebhook
);

// Webhook delivery history
router.get(
  '/:webhookId/deliveries',
  validateRequest(getDeliveriesSchema),
  rateLimit('webhook.deliveries', { maxRequests: 50, windowMs: 15 * 60 * 1000 }),
  WebhookController.getWebhookDeliveries
);

router.get(
  '/:webhookId/stats',
  rateLimit('webhook.stats', { maxRequests: 50, windowMs: 15 * 60 * 1000 }),
  WebhookController.getWebhookStats
);

// Manual webhook triggering (manager+ only)
router.post(
  '/trigger',
  requireRole('manager'),
  validateRequest(triggerWebhookSchema),
  rateLimit('webhook.trigger', { maxRequests: 20, windowMs: 60 * 60 * 1000 }),
  auditLog('trigger-webhook'),
  WebhookController.triggerWebhook
);

// Webhook status
router.get(
  '/status/:webhookId',
  rateLimit('webhook.status', { maxRequests: 100, windowMs: 15 * 60 * 1000 }),
  WebhookController.getWebhookStatus
);

// Utility endpoints
router.post(
  '/verify-signature',
  validateRequest(verifySignatureSchema),
  rateLimit('webhook.verify', { maxRequests: 50, windowMs: 15 * 60 * 1000 }),
  WebhookController.verifyWebhookSignature
);

export default router;