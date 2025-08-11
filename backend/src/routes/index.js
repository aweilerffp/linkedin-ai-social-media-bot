import express from 'express';
import authRoutes from './auth.routes.js';
import postsRoutes from './posts.routes.js';
import webhookRoutes from './webhook.routes.js';
import { monitoringRoutes } from './monitoring.routes.js';
import aiRoutes from './ai.routes.js';
import { getQueueStats } from '../services/queue/QueueService.js';
import { globalRateLimit, ipRateLimit } from '../middleware/rateLimiting.js';

const router = express.Router();

// Apply global rate limiting
router.use(globalRateLimit());

// Health check route
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// API status
router.get('/status', (req, res) => {
  res.json({
    message: 'Social Media Poster API is running',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  });
});

// Queue statistics (for monitoring)
router.get('/queue-stats', async (req, res) => {
  try {
    const stats = await getQueueStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Mount route modules
router.use('/auth', authRoutes);
router.use('/posts', postsRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/monitoring', monitoringRoutes);
router.use('/ai', aiRoutes);

export default router;