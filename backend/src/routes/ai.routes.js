import express from 'express';
import { AIController } from '../controllers/AIController.js';
import { authenticate as authMiddleware } from '../middleware/authentication.js';
import { validateRequest } from '../middleware/validation.js';
import Joi from 'joi';

const router = express.Router();
const aiController = new AIController();

// Validation schemas
const companyProfileSchema = Joi.object({
  company_name: Joi.string().required().min(1).max(255),
  industry: Joi.string().required().valid(
    'ecommerce', 'saas', 'consulting', 'healthcare', 'finance', 
    'education', 'manufacturing', 'retail', 'technology', 'marketing'
  ),
  brand_voice: Joi.object({
    tone: Joi.array().items(Joi.string()).min(1).max(10),
    keywords: Joi.array().items(Joi.string()).max(20),
    prohibited_terms: Joi.array().items(Joi.string()).max(20)
  }).required(),
  content_pillars: Joi.array().items(
    Joi.object({
      title: Joi.string().required().max(255),
      description: Joi.string().max(500),
      keywords: Joi.array().items(Joi.string()).max(10)
    })
  ).min(1).max(5),
  target_personas: Joi.array().items(
    Joi.object({
      name: Joi.string().required().max(100),
      pain_points: Joi.array().items(Joi.string()).max(10),
      emotions: Joi.array().items(Joi.string()).max(10)
    })
  ).min(1).max(5),
  evaluation_questions: Joi.array().items(Joi.string()).min(3).max(10),
  visual_style: Joi.object({
    colors: Joi.object({
      primary: Joi.string().pattern(/^#[0-9A-F]{6}$/i),
      secondary: Joi.string().pattern(/^#[0-9A-F]{6}$/i),
      accent: Joi.string().pattern(/^#[0-9A-F]{6}$/i)
    }),
    illustration_style: Joi.object({
      type: Joi.string().valid('isometric', 'flat', 'modern', 'corporate', 'tech', 'hand-drawn'),
      characteristics: Joi.array().items(Joi.string()).max(10)
    }),
    visual_elements: Joi.object({
      common_elements: Joi.array().items(Joi.string()).max(20)
    }),
    restrictions: Joi.array().items(Joi.string()).max(10)
  }),
  slack_config: Joi.object({
    channel: Joi.string().pattern(/^#[a-z0-9-_]+$/),
    approvers: Joi.array().items(Joi.string()).max(10)
  })
});

const transcriptSchema = Joi.object({
  webhook_source: Joi.string().required(),
  meeting_id: Joi.string(),
  title: Joi.string().max(500),
  transcript_content: Joi.string().required().min(100),
  participants: Joi.array().items(Joi.string()),
  duration_minutes: Joi.number().min(1).max(480),
  meeting_date: Joi.date().iso(),
  metadata: Joi.object()
});

const knowledgeStoreSchema = Joi.object({
  name: Joi.string().required().max(255),
  type: Joi.string().required().valid('brand_voice', 'top_posts', 'frameworks', 'company_info'),
  query_key: Joi.string().required().max(100),
  content: Joi.string().required().min(10),
  retrieval_count: Joi.number().min(1).max(10).default(1)
});

// Company Profile Routes
router.post('/company-profile', 
  authMiddleware, 
  validateRequest(companyProfileSchema),
  aiController.createCompanyProfile.bind(aiController)
);

router.get('/company-profile', 
  authMiddleware,
  aiController.getCompanyProfile.bind(aiController)
);

router.put('/company-profile/:id', 
  authMiddleware,
  validateRequest(companyProfileSchema),
  aiController.updateCompanyProfile.bind(aiController)
);

// Knowledge Management Routes
router.post('/knowledge-stores',
  authMiddleware,
  validateRequest(knowledgeStoreSchema),
  aiController.createKnowledgeStore.bind(aiController)
);

router.get('/knowledge-stores',
  authMiddleware,
  aiController.getKnowledgeStores.bind(aiController)
);

router.put('/knowledge-stores/:id',
  authMiddleware,
  validateRequest(knowledgeStoreSchema),
  aiController.updateKnowledgeStore.bind(aiController)
);

router.delete('/knowledge-stores/:id',
  authMiddleware,
  aiController.deleteKnowledgeStore.bind(aiController)
);

// Transcript Processing Routes
router.post('/transcripts',
  authMiddleware,
  validateRequest(transcriptSchema),
  aiController.processTranscript.bind(aiController)
);

router.get('/transcripts',
  authMiddleware,
  aiController.getTranscripts.bind(aiController)
);

router.get('/transcripts/:id',
  authMiddleware,
  aiController.getTranscript.bind(aiController)
);

// Marketing Hook Generation
router.post('/transcripts/:id/generate-hooks',
  authMiddleware,
  aiController.generateMarketingHooks.bind(aiController)
);

router.get('/transcripts/:id/hooks',
  authMiddleware,
  aiController.getMarketingHooks.bind(aiController)
);

// LinkedIn Post Generation
router.post('/hooks/generate-posts',
  authMiddleware,
  aiController.generateLinkedInPosts.bind(aiController)
);

router.get('/posts/linkedin',
  authMiddleware,
  aiController.getLinkedInPosts.bind(aiController)
);

router.get('/posts/linkedin/:id',
  authMiddleware,
  aiController.getLinkedInPost.bind(aiController)
);

// Image Generation Routes
router.post('/posts/:id/generate-images',
  authMiddleware,
  aiController.generateImages.bind(aiController)
);

router.get('/posts/:id/images',
  authMiddleware,
  aiController.getPostImages.bind(aiController)
);

// Slack Approval Routes
router.post('/posts/:id/send-for-approval',
  authMiddleware,
  aiController.sendForSlackApproval.bind(aiController)
);

router.post('/slack/interactions',
  aiController.handleSlackInteraction.bind(aiController)
);

router.get('/approvals/:id/status',
  authMiddleware,
  aiController.getApprovalStatus.bind(aiController)
);

// Queue Management Routes
router.get('/queue',
  authMiddleware,
  aiController.getPublishingQueue.bind(aiController)
);

router.post('/queue/:postId/schedule',
  authMiddleware,
  aiController.schedulePost.bind(aiController)
);

router.put('/queue/:postId/priority',
  authMiddleware,
  aiController.updatePostPriority.bind(aiController)
);

router.delete('/queue/:postId',
  authMiddleware,
  aiController.removeFromQueue.bind(aiController)
);

// Dashboard and Analytics Routes
router.get('/dashboard',
  authMiddleware,
  aiController.getDashboardData.bind(aiController)
);

router.get('/analytics/performance',
  authMiddleware,
  aiController.getPerformanceAnalytics.bind(aiController)
);

router.get('/analytics/costs',
  authMiddleware,
  aiController.getCostAnalytics.bind(aiController)
);

// Test and Health Check Routes
router.post('/test/hook-generation',
  authMiddleware,
  aiController.testHookGeneration.bind(aiController)
);

router.post('/test/post-generation',
  authMiddleware,
  aiController.testPostGeneration.bind(aiController)
);

router.post('/test/slack-connection',
  authMiddleware,
  aiController.testSlackConnection.bind(aiController)
);

router.get('/health',
  aiController.healthCheck.bind(aiController)
);

// Webhook endpoint for meeting recorders (public, but with webhook validation)
router.post('/webhook/transcript',
  aiController.receiveTranscriptWebhook.bind(aiController)
);

export default router;