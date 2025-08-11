import { rateLimitService } from '../services/RateLimitService.js';
import { ApiError } from './errorHandler.js';
import { logger } from '../utils/logger.js';

/**
 * Rate limiting configurations for different endpoints
 */
const RATE_LIMITS = {
  // Authentication endpoints
  'auth.login': { maxRequests: 5, windowMs: 15 * 60 * 1000 }, // 5 attempts per 15 minutes
  'auth.register': { maxRequests: 3, windowMs: 60 * 60 * 1000 }, // 3 attempts per hour
  'auth.password-reset': { maxRequests: 3, windowMs: 60 * 60 * 1000 }, // 3 attempts per hour
  'auth.refresh': { maxRequests: 50, windowMs: 15 * 60 * 1000 }, // 50 refreshes per 15 minutes

  // Post endpoints
  'posts.create': { maxRequests: 100, windowMs: 60 * 60 * 1000 }, // 100 posts per hour
  'posts.schedule': { maxRequests: 200, windowMs: 60 * 60 * 1000 }, // 200 schedules per hour
  'posts.list': { maxRequests: 1000, windowMs: 15 * 60 * 1000 }, // 1000 requests per 15 minutes

  // OAuth endpoints
  'oauth.connect': { maxRequests: 10, windowMs: 15 * 60 * 1000 }, // 10 connects per 15 minutes
  'oauth.callback': { maxRequests: 20, windowMs: 15 * 60 * 1000 }, // 20 callbacks per 15 minutes

  // Upload endpoints
  'upload.media': { maxRequests: 50, windowMs: 60 * 60 * 1000 }, // 50 uploads per hour

  // General API
  'api.general': { maxRequests: 1000, windowMs: 15 * 60 * 1000 }, // 1000 requests per 15 minutes
};

/**
 * User tier configurations
 */
const USER_TIER_MULTIPLIERS = {
  'free': 1,
  'pro': 3,
  'enterprise': 10,
};

/**
 * Get rate limit config for endpoint and user tier
 */
function getRateLimitConfig(endpoint, userTier = 'free') {
  const baseConfig = RATE_LIMITS[endpoint] || RATE_LIMITS['api.general'];
  const multiplier = USER_TIER_MULTIPLIERS[userTier] || 1;

  return {
    ...baseConfig,
    maxRequests: Math.floor(baseConfig.maxRequests * multiplier),
  };
}

/**
 * Generic rate limiting middleware
 */
export function rateLimit(endpoint, options = {}) {
  return async (req, res, next) => {
    try {
      // Determine user tier
      const userTier = req.user?.tier || 'free';
      
      // Get rate limit configuration
      const config = getRateLimitConfig(endpoint, userTier);
      const finalConfig = { ...config, ...options };

      // Generate key based on user or IP
      const baseKey = req.user ? `user:${req.user.id}` : `ip:${req.ip}`;
      const key = `${baseKey}:${endpoint}`;

      // Check if blocked
      if (await rateLimitService.isBlocked(key)) {
        logger.warn('Rate limit blocked request', {
          key,
          endpoint,
          userTier,
          ip: req.ip,
          userId: req.user?.id,
        });

        const error = new ApiError(429, 'Rate limit exceeded. Please try again later.');
        return next(error);
      }

      // Check rate limit
      const result = await rateLimitService.isAllowed(key, finalConfig);

      // Set headers
      res.set({
        'RateLimit-Limit': finalConfig.maxRequests,
        'RateLimit-Remaining': result.remaining,
        'RateLimit-Reset': new Date(result.resetTime).toISOString(),
        'RateLimit-Policy': `${finalConfig.maxRequests};w=${Math.floor(finalConfig.windowMs / 1000)}`,
      });

      if (!result.allowed) {
        logger.warn('Rate limit exceeded', {
          key,
          endpoint,
          userTier,
          totalHits: result.totalHits,
          limit: finalConfig.maxRequests,
          ip: req.ip,
          userId: req.user?.id,
        });

        res.set('Retry-After', Math.ceil(result.retryAfter / 1000));
        
        const error = new ApiError(
          429, 
          `Rate limit exceeded for ${endpoint}. Please try again later.`
        );
        return next(error);
      }

      // Consume token
      await rateLimitService.consume(key, finalConfig);

      // Log successful rate limit check
      if (result.remaining < 10) {
        logger.info('Rate limit warning', {
          key,
          endpoint,
          remaining: result.remaining,
          userTier,
        });
      }

      next();
    } catch (error) {
      logger.error('Rate limiting middleware error:', error);
      // Fail open - allow request if rate limiting fails
      next();
    }
  };
}

/**
 * Specific rate limiting middlewares for common endpoints
 */

// Authentication rate limits
export const authLoginLimit = rateLimit('auth.login');
export const authRegisterLimit = rateLimit('auth.register');
export const authPasswordResetLimit = rateLimit('auth.password-reset');
export const authRefreshLimit = rateLimit('auth.refresh');

// Post rate limits
export const postCreateLimit = rateLimit('posts.create');
export const postScheduleLimit = rateLimit('posts.schedule');
export const postListLimit = rateLimit('posts.list');

// OAuth rate limits
export const oauthConnectLimit = rateLimit('oauth.connect');
export const oauthCallbackLimit = rateLimit('oauth.callback');

// Upload rate limits
export const uploadMediaLimit = rateLimit('upload.media');

// General API rate limit
export const generalApiLimit = rateLimit('api.general');

/**
 * Global rate limiting middleware
 */
export function globalRateLimit(options = {}) {
  const {
    maxRequests = 1000,
    windowMs = 15 * 60 * 1000,
    keyGenerator = (req) => req.user ? `user:${req.user.id}` : `ip:${req.ip}`,
  } = options;

  return rateLimitService.createMiddleware({
    keyGenerator,
    maxRequests,
    windowMs,
    message: 'Too many requests. Please try again later.',
    standardHeaders: true,
    onLimitReached: (req, res) => {
      logger.warn('Global rate limit exceeded', {
        ip: req.ip,
        userId: req.user?.id,
        userAgent: req.get('User-Agent'),
        path: req.path,
      });
    },
  });
}

/**
 * IP-based rate limiting for public endpoints
 */
export function ipRateLimit(options = {}) {
  const {
    maxRequests = 100,
    windowMs = 15 * 60 * 1000,
  } = options;

  return rateLimitService.createMiddleware({
    keyGenerator: (req) => `ip:${req.ip}`,
    maxRequests,
    windowMs,
    message: 'Too many requests from your IP address.',
    standardHeaders: true,
    blockDuration: 60 * 60 * 1000, // 1 hour block after limit exceeded
  });
}

/**
 * Middleware to check rate limit status without consuming
 */
export function rateLimitStatus(endpoint) {
  return async (req, res, next) => {
    try {
      const userTier = req.user?.tier || 'free';
      const config = getRateLimitConfig(endpoint, userTier);
      const baseKey = req.user ? `user:${req.user.id}` : `ip:${req.ip}`;
      const key = `${baseKey}:${endpoint}`;

      const status = await rateLimitService.getStatus(key, config);
      
      // Add rate limit info to request for use in response
      req.rateLimitStatus = {
        endpoint,
        ...status,
        userTier,
      };

      next();
    } catch (error) {
      logger.error('Rate limit status middleware error:', error);
      next();
    }
  };
}

/**
 * Middleware to reset rate limits (admin only)
 */
export function rateLimitReset() {
  return async (req, res, next) => {
    try {
      const { key } = req.body;
      
      if (!req.user || req.user.role !== 'admin') {
        return next(new ApiError(403, 'Admin access required'));
      }

      if (!key) {
        return next(new ApiError(400, 'Key is required'));
      }

      await rateLimitService.reset(key);
      
      logger.info('Rate limit reset by admin', {
        key,
        adminId: req.user.id,
        adminEmail: req.user.email,
      });

      res.json({
        success: true,
        message: `Rate limit reset for key: ${key}`,
      });
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Adaptive rate limiting based on system load
 */
export function adaptiveRateLimit(baseConfig = {}) {
  return async (req, res, next) => {
    try {
      // Get system metrics (simplified example)
      const systemLoad = process.cpuUsage();
      const memoryUsage = process.memoryUsage();
      
      // Calculate load factor (0.5 to 2.0)
      const loadFactor = Math.min(2.0, Math.max(0.5, 
        1 + (memoryUsage.heapUsed / memoryUsage.heapTotal - 0.5)
      ));

      // Adjust rate limits based on load
      const adjustedConfig = {
        maxRequests: Math.floor((baseConfig.maxRequests || 100) / loadFactor),
        windowMs: baseConfig.windowMs || 15 * 60 * 1000,
      };

      const key = req.user ? `user:${req.user.id}` : `ip:${req.ip}`;
      const result = await rateLimitService.isAllowed(key, adjustedConfig);

      if (!result.allowed) {
        logger.warn('Adaptive rate limit exceeded', {
          key,
          loadFactor,
          adjustedLimit: adjustedConfig.maxRequests,
          originalLimit: baseConfig.maxRequests,
        });

        return next(new ApiError(429, 'Service temporarily overloaded. Please try again later.'));
      }

      await rateLimitService.consume(key, adjustedConfig);
      next();
    } catch (error) {
      logger.error('Adaptive rate limiting error:', error);
      next();
    }
  };
}

/**
 * Export rate limit configurations for monitoring
 */
export { RATE_LIMITS, USER_TIER_MULTIPLIERS };