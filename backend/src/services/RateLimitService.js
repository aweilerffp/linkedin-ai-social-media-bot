import { ApiError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { getRedisClient } from '../config/redis.js';

export class RateLimitService {
  constructor() {
    this.prefix = 'ratelimit:';
  }

  /**
   * Check if request is within rate limit
   */
  async isAllowed(key, options = {}) {
    const {
      maxRequests = 100,
      windowMs = 15 * 60 * 1000, // 15 minutes
      skipSuccessfulRequests = false,
      skipFailedRequests = false,
      blockDuration = null,
    } = options;

    const redisKey = `${this.prefix}${key}`;
    const window = Math.floor(Date.now() / windowMs);
    const windowKey = `${redisKey}:${window}`;

    try {
      // Use Redis multi for atomic operations
      const redisClient = getRedisClient();
      const pipeline = redisClient.multi();
      
      // Get current count
      pipeline.get(windowKey);
      
      // Set expiration for the window
      pipeline.expire(windowKey, Math.ceil(windowMs / 1000));
      
      const results = await pipeline.exec();
      const currentCount = parseInt(results[0] || '0', 10);

      if (currentCount >= maxRequests) {
        // Check if there's a block in place
        if (blockDuration) {
          const blockKey = `${redisKey}:block`;
          await redisClient.setex(blockKey, Math.ceil(blockDuration / 1000), '1');
        }

        return {
          allowed: false,
          remaining: 0,
          resetTime: (window + 1) * windowMs,
          retryAfter: blockDuration || windowMs,
        };
      }

      return {
        allowed: true,
        remaining: Math.max(0, maxRequests - currentCount - 1),
        resetTime: (window + 1) * windowMs,
        totalHits: currentCount,
      };
    } catch (error) {
      logger.error('Rate limit check error:', error);
      // Fail open - allow request if Redis is unavailable
      return {
        allowed: true,
        remaining: maxRequests,
        resetTime: Date.now() + windowMs,
      };
    }
  }

  /**
   * Consume a rate limit token
   */
  async consume(key, options = {}) {
    const {
      maxRequests = 100,
      windowMs = 15 * 60 * 1000,
    } = options;

    const redisKey = `${this.prefix}${key}`;
    const window = Math.floor(Date.now() / windowMs);
    const windowKey = `${redisKey}:${window}`;

    try {
      // Increment counter atomically
      const redisClient = getRedisClient();
      const pipeline = redisClient.multi();
      pipeline.incr(windowKey);
      pipeline.expire(windowKey, Math.ceil(windowMs / 1000));
      
      const results = await pipeline.exec();
      const currentCount = parseInt(results[0], 10);

      return {
        totalHits: currentCount,
        remaining: Math.max(0, maxRequests - currentCount),
        resetTime: (window + 1) * windowMs,
      };
    } catch (error) {
      logger.error('Rate limit consume error:', error);
      throw error;
    }
  }

  /**
   * Check if key is currently blocked
   */
  async isBlocked(key) {
    const blockKey = `${this.prefix}${key}:block`;
    
    try {
      const redisClient = getRedisClient();
      const blocked = await redisClient.get(blockKey);
      return !!blocked;
    } catch (error) {
      logger.error('Rate limit block check error:', error);
      return false;
    }
  }

  /**
   * Remove rate limit for a key
   */
  async reset(key) {
    const pattern = `${this.prefix}${key}*`;
    
    try {
      const redisClient = getRedisClient();
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
      
      logger.info(`Rate limit reset for key: ${key}`);
    } catch (error) {
      logger.error('Rate limit reset error:', error);
      throw error;
    }
  }

  /**
   * Get rate limit status
   */
  async getStatus(key, options = {}) {
    const {
      maxRequests = 100,
      windowMs = 15 * 60 * 1000,
    } = options;

    const redisKey = `${this.prefix}${key}`;
    const window = Math.floor(Date.now() / windowMs);
    const windowKey = `${redisKey}:${window}`;

    try {
      const redisClient = getRedisClient();
      const currentCount = parseInt(await redisClient.get(windowKey) || '0', 10);
      const blocked = await this.isBlocked(key);

      return {
        key,
        totalHits: currentCount,
        remaining: Math.max(0, maxRequests - currentCount),
        resetTime: (window + 1) * windowMs,
        blocked,
        limit: maxRequests,
        windowMs,
      };
    } catch (error) {
      logger.error('Rate limit status error:', error);
      return {
        key,
        totalHits: 0,
        remaining: maxRequests,
        resetTime: Date.now() + windowMs,
        blocked: false,
        limit: maxRequests,
        windowMs,
      };
    }
  }

  /**
   * Create Express middleware for rate limiting
   */
  createMiddleware(options = {}) {
    const {
      keyGenerator = (req) => req.ip,
      maxRequests = 100,
      windowMs = 15 * 60 * 1000,
      message = 'Too many requests',
      standardHeaders = true,
      legacyHeaders = false,
      skipSuccessfulRequests = false,
      skipFailedRequests = false,
      onLimitReached = null,
      blockDuration = null,
    } = options;

    return async (req, res, next) => {
      try {
        const key = typeof keyGenerator === 'function' 
          ? keyGenerator(req) 
          : keyGenerator;

        if (!key) {
          return next();
        }

        // Check if blocked
        if (await this.isBlocked(key)) {
          const error = new ApiError(429, 'Rate limit exceeded. Please try again later.');
          return next(error);
        }

        // Check rate limit
        const result = await this.isAllowed(key, {
          maxRequests,
          windowMs,
          skipSuccessfulRequests,
          skipFailedRequests,
          blockDuration,
        });

        // Set headers
        if (standardHeaders) {
          res.set({
            'RateLimit-Limit': maxRequests,
            'RateLimit-Remaining': result.remaining,
            'RateLimit-Reset': new Date(result.resetTime).toISOString(),
          });
        }

        if (legacyHeaders) {
          res.set({
            'X-RateLimit-Limit': maxRequests,
            'X-RateLimit-Remaining': result.remaining,
            'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000),
          });
        }

        if (!result.allowed) {
          if (onLimitReached) {
            onLimitReached(req, res);
          }

          res.set('Retry-After', Math.ceil(result.retryAfter / 1000));
          
          const error = new ApiError(429, message);
          return next(error);
        }

        // Consume token
        await this.consume(key, { maxRequests, windowMs });

        next();
      } catch (error) {
        logger.error('Rate limiting middleware error:', error);
        // Fail open
        next();
      }
    };
  }

  /**
   * Create user-specific rate limiting middleware
   */
  createUserMiddleware(options = {}) {
    return this.createMiddleware({
      keyGenerator: (req) => req.user ? `user:${req.user.id}` : req.ip,
      maxRequests: 1000, // Higher limit for authenticated users
      windowMs: 15 * 60 * 1000,
      ...options,
    });
  }

  /**
   * Create team-specific rate limiting middleware
   */
  createTeamMiddleware(options = {}) {
    return this.createMiddleware({
      keyGenerator: (req) => req.user && req.user.teamId 
        ? `team:${req.user.teamId}` 
        : req.ip,
      maxRequests: 5000, // Higher limit for teams
      windowMs: 15 * 60 * 1000,
      ...options,
    });
  }

  /**
   * Create API endpoint rate limiting middleware
   */
  createEndpointMiddleware(endpoint, options = {}) {
    return this.createMiddleware({
      keyGenerator: (req) => {
        const baseKey = req.user ? `user:${req.user.id}` : req.ip;
        return `${baseKey}:${endpoint}`;
      },
      maxRequests: 50,
      windowMs: 15 * 60 * 1000,
      message: `Too many requests to ${endpoint}`,
      ...options,
    });
  }
}

// Export singleton instance
export const rateLimitService = new RateLimitService();