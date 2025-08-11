import express from 'express';
import { PostController } from '../controllers/PostController.js';
import { authenticate, requireTeam, auditLog } from '../middleware/authentication.js';
import { validateRequest } from '../middleware/validation.js';
import { postCreateLimit, postScheduleLimit, postListLimit } from '../middleware/rateLimiting.js';
import Joi from 'joi';

const router = express.Router();

// Validation schemas
const createPostSchema = {
  body: Joi.object({
    content: Joi.string().min(1).max(10000).required(),
    mediaUrls: Joi.array().items(Joi.string().uri()).max(4).optional(),
    platforms: Joi.array().items(Joi.string().valid('linkedin', 'twitter')).min(1).required(),
    scheduledAt: Joi.date().greater('now').optional(),
    timezone: Joi.string().default('UTC'),
    metadata: Joi.object().optional(),
  }),
};

const updatePostSchema = {
  body: Joi.object({
    content: Joi.string().min(1).max(10000).optional(),
    mediaUrls: Joi.array().items(Joi.string().uri()).max(4).optional(),
    platforms: Joi.array().items(Joi.string().valid('linkedin', 'twitter')).min(1).optional(),
    scheduledAt: Joi.date().greater('now').optional(),
    timezone: Joi.string().optional(),
    metadata: Joi.object().optional(),
    status: Joi.string().valid('draft', 'scheduled').optional(),
  }),
};

const scheduleOptimalSchema = {
  body: Joi.object({
    date: Joi.date().greater('now').required(),
    timezone: Joi.string().default('UTC'),
    platform: Joi.string().valid('linkedin', 'twitter').optional(),
  }),
};

const checkConflictsSchema = {
  body: Joi.object({
    scheduledTime: Joi.date().required(),
    platforms: Joi.array().items(Joi.string().valid('linkedin', 'twitter')).min(1).required(),
    excludePostId: Joi.string().uuid().optional(),
  }),
};

const retryPostSchema = {
  body: Joi.object({
    platform: Joi.string().valid('linkedin', 'twitter').optional(),
  }),
};

// All routes require authentication and team membership
router.use(authenticate);
router.use(requireTeam);

// Posts CRUD
router.post('/', 
  validateRequest(createPostSchema),
  postCreateLimit,
  auditLog('create-post'),
  PostController.createPost
);

router.get('/', postListLimit, PostController.getPosts);
router.get('/scheduled', PostController.getScheduledPosts);

router.get('/:postId', PostController.getPost);
router.put('/:postId', 
  validateRequest(updatePostSchema),
  auditLog('update-post'),
  PostController.updatePost
);
router.delete('/:postId', 
  auditLog('delete-post'),
  PostController.deletePost
);

// Post actions
router.post('/:postId/post-now', 
  postCreateLimit,
  auditLog('post-now'),
  PostController.postNow
);

router.post('/:postId/schedule-optimal', 
  validateRequest(scheduleOptimalSchema),
  postScheduleLimit,
  auditLog('schedule-optimal'),
  PostController.scheduleOptimal
);

router.post('/:postId/cancel-scheduled', 
  auditLog('cancel-scheduled'),
  PostController.cancelScheduled
);

router.post('/:postId/retry', 
  validateRequest(retryPostSchema),
  postCreateLimit,
  auditLog('retry-post'),
  PostController.retryPost
);

// Scheduling utilities
router.get('/schedule/stats', PostController.getScheduleStats);
router.get('/schedule/optimal-times', PostController.getOptimalTimes);
router.post('/schedule/check-conflicts', 
  validateRequest(checkConflictsSchema),
  PostController.checkConflicts
);

export default router;