import express from 'express';
import { MonitoringController } from '../controllers/MonitoringController.js';
import { authenticate, optionalAuth } from '../middleware/authentication.js';
import { rateLimit } from '../middleware/rateLimiting.js';

const router = express.Router();

// Rate limiting for monitoring endpoints
const monitoringRateLimit = rateLimit('monitoring.general', {
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
});

const adminRateLimit = rateLimit('monitoring.admin', {
  windowMs: 60 * 1000, // 1 minute  
  max: 10, // 10 requests per minute for admin endpoints
});

// Public health check endpoints (no authentication required)
router.get('/health', monitoringRateLimit, MonitoringController.getHealth);
router.get('/health/detailed', monitoringRateLimit, MonitoringController.getHealthDetailed);

// Metrics endpoints (Prometheus format for monitoring tools, JSON for API consumers)
router.get('/metrics', monitoringRateLimit, MonitoringController.getMetricsPrometheus);
router.get('/metrics/json', monitoringRateLimit, MonitoringController.getMetrics);

// Error tracking and diagnostics (optional auth - more details with auth)
router.get('/errors', optionalAuth, monitoringRateLimit, MonitoringController.getErrorStats);
router.get('/system', optionalAuth, monitoringRateLimit, MonitoringController.getSystemInfo);

// Dashboard endpoint (requires authentication)
router.get('/dashboard', authenticate, monitoringRateLimit, MonitoringController.getDashboard);

// Admin-only endpoints (require admin secret header)
router.post('/gc', adminRateLimit, MonitoringController.triggerGC);
router.post('/reset', adminRateLimit, MonitoringController.resetMetrics);
router.post('/test-error', adminRateLimit, MonitoringController.testError);

export { router as monitoringRoutes };