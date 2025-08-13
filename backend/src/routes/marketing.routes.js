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
 * @route   POST /api/marketing/company-profile
 * @desc    Save company profile to database
 * @access  Private
 */
router.post('/company-profile',
  body('company_name').notEmpty().withMessage('Company name is required'),
  body('industry').optional().isString(),
  body('brand_voice').optional().isObject(),
  body('content_pillars').optional().isArray(),
  body('target_personas').optional().isArray(),
  body('evaluation_questions').optional().isArray(),
  body('visual_style').optional().isObject(),
  body('slack_config').optional().isObject(),
  validate,
  MarketingHooksController.saveCompanyProfile
);

/**
 * @route   GET /api/marketing/company-profile
 * @desc    Get company profile from database
 * @access  Private
 */
router.get('/company-profile',
  MarketingHooksController.getCompanyProfile
);

/**
 * @route   GET /api/marketing/company-insights
 * @desc    Get company insights with RAG-enhanced context
 * @access  Private
 */
router.get('/company-insights',
  MarketingHooksController.getCompanyInsights
);

/**
 * @route   POST /api/marketing/generate-post
 * @desc    Generate LinkedIn post from marketing hook
 * @access  Private
 */
router.post('/generate-post',
  body('hook_id').isUUID().withMessage('Valid hook ID is required'),
  body('post_length').optional().isIn(['short', 'medium', 'long']),
  body('include_hashtags').optional().isBoolean(),
  body('include_emojis').optional().isBoolean(),
  body('call_to_action').optional().isIn(['engage', 'visit', 'contact', 'learn']),
  validate,
  MarketingHooksController.generateLinkedInPost
);

/**
 * @route   POST /api/marketing/generate-variations
 * @desc    Generate multiple post variations from a hook
 * @access  Private
 */
router.post('/generate-variations',
  body('hook_id').isUUID().withMessage('Valid hook ID is required'),
  body('variation_count').optional().isInt({ min: 1, max: 5 }),
  validate,
  MarketingHooksController.generatePostVariations
);

/**
 * @route   POST /api/marketing/enhance-post
 * @desc    Enhance an existing post with better formatting
 * @access  Private
 */
router.post('/enhance-post',
  body('post_content').notEmpty().withMessage('Post content is required'),
  validate,
  MarketingHooksController.enhancePost
);

/**
 * @route   POST /api/marketing/content-calendar
 * @desc    Generate content calendar from hooks
 * @access  Private
 */
router.post('/content-calendar',
  body('hook_ids').isArray().withMessage('Hook IDs array is required'),
  body('posts_per_week').optional().isInt({ min: 1, max: 7 }),
  body('weeks').optional().isInt({ min: 1, max: 8 }),
  body('start_date').optional().isISO8601(),
  validate,
  MarketingHooksController.generateContentCalendar
);

export default router;