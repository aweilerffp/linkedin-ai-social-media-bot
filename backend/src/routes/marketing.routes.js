import { Router } from 'express';
import { MarketingHooksController } from '../controllers/MarketingHooksController.js';
import { authenticate } from '../middleware/authentication.js';
import { validate } from '../middleware/validation.js';
import { body, param, query } from 'express-validator';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/marketing/dashboard/:teamId
 * @desc    Get AI content dashboard data
 * @access  Private
 */
router.get('/dashboard/:teamId', 
  MarketingHooksController.getDashboardData
);

/**
 * @route   GET /api/marketing/transcripts/:transcriptId/hooks
 * @desc    Get marketing hooks for a specific transcript
 * @access  Private
 */
router.get('/transcripts/:transcriptId/hooks',
  param('transcriptId').isUUID(),
  validate,
  MarketingHooksController.getTranscriptHooks
);

/**
 * @route   PUT /api/marketing/hooks/:hookId/status
 * @desc    Update hook status (approve/reject/publish)
 * @access  Private
 */
router.put('/hooks/:hookId/status',
  param('hookId').isUUID(),
  body('status').isIn(['approved', 'rejected', 'published']),
  body('reason').optional().isString(),
  validate,
  MarketingHooksController.updateHookStatus
);

/**
 * @route   GET /api/marketing/webhook-events
 * @desc    Get webhook events history
 * @access  Private
 */
router.get('/webhook-events',
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  query('status').optional().isIn(['received', 'processing', 'processed', 'failed']),
  query('event_type').optional().isString(),
  validate,
  MarketingHooksController.getWebhookEvents
);

/**
 * @route   POST /api/marketing/transcripts/:transcriptId/reprocess
 * @desc    Reprocess a transcript to generate new hooks
 * @access  Private
 */
router.post('/transcripts/:transcriptId/reprocess',
  param('transcriptId').isUUID(),
  body('regenerate_all').optional().isBoolean(),
  validate,
  MarketingHooksController.reprocessTranscript
);

/**
 * @route   GET /api/marketing/company-insights
 * @desc    Get company insights with RAG-enhanced context
 * @access  Private
 */
router.get('/company-insights',
  MarketingHooksController.getCompanyInsights
);

export default router;