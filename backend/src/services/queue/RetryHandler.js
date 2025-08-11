import { logger } from '../../utils/logger.js';
import { Post } from '../../models/Post.js';
import { query } from '../../config/database.js';

export class RetryHandler {
  constructor() {
    this.retryStrategies = {
      exponential: this.exponentialBackoff,
      linear: this.linearBackoff,
      immediate: this.immediateRetry,
    };

    this.platformRetryConfigs = {
      linkedin: {
        maxRetries: 3,
        strategy: 'exponential',
        baseDelay: 60000, // 1 minute
        maxDelay: 900000, // 15 minutes
        retryableErrors: [429, 500, 502, 503, 504],
      },
      twitter: {
        maxRetries: 5,
        strategy: 'exponential', 
        baseDelay: 30000, // 30 seconds
        maxDelay: 600000, // 10 minutes
        retryableErrors: [429, 500, 502, 503, 504],
      },
    };
  }

  /**
   * Determine if an error should trigger a retry
   */
  shouldRetry(error, platform, attemptCount) {
    const config = this.platformRetryConfigs[platform];
    if (!config) return false;

    // Check if we've exceeded max retries
    if (attemptCount >= config.maxRetries) {
      logger.info('Max retries exceeded', { platform, attemptCount, maxRetries: config.maxRetries });
      return false;
    }

    // Check if error is retryable
    if (error.statusCode && !config.retryableErrors.includes(error.statusCode)) {
      logger.info('Non-retryable error', { platform, statusCode: error.statusCode });
      return false;
    }

    // Check for specific error patterns that should not be retried
    const nonRetryablePatterns = [
      /invalid.*token/i,
      /unauthorized/i,
      /forbidden/i,
      /duplicate/i,
      /already.*exists/i,
    ];

    if (nonRetryablePatterns.some(pattern => pattern.test(error.message))) {
      logger.info('Non-retryable error pattern detected', { platform, error: error.message });
      return false;
    }

    return true;
  }

  /**
   * Calculate retry delay based on strategy
   */
  calculateRetryDelay(platform, attemptCount) {
    const config = this.platformRetryConfigs[platform];
    if (!config) return 60000; // Default 1 minute

    const strategy = this.retryStrategies[config.strategy] || this.exponentialBackoff;
    const delay = strategy(config.baseDelay, attemptCount);
    
    return Math.min(delay, config.maxDelay);
  }

  /**
   * Exponential backoff strategy
   */
  exponentialBackoff(baseDelay, attemptCount) {
    const jitter = Math.random() * 0.1 * baseDelay; // Add 10% jitter
    return baseDelay * Math.pow(2, attemptCount - 1) + jitter;
  }

  /**
   * Linear backoff strategy
   */
  linearBackoff(baseDelay, attemptCount) {
    const jitter = Math.random() * 0.1 * baseDelay;
    return baseDelay * attemptCount + jitter;
  }

  /**
   * Immediate retry (no delay)
   */
  immediateRetry() {
    return 0;
  }

  /**
   * Handle rate limiting with adaptive delays
   */
  handleRateLimit(error, platform) {
    // Check for rate limit headers
    const retryAfter = this.extractRetryAfter(error);
    if (retryAfter) {
      logger.info('Rate limit detected, using Retry-After header', { 
        platform, 
        retryAfter: retryAfter + 's' 
      });
      return retryAfter * 1000; // Convert to milliseconds
    }

    // Use platform-specific rate limit delays
    const rateLimitDelays = {
      linkedin: 900000, // 15 minutes
      twitter: 300000,  // 5 minutes
    };

    return rateLimitDelays[platform] || 600000; // Default 10 minutes
  }

  /**
   * Extract retry-after value from error response
   */
  extractRetryAfter(error) {
    if (error.response && error.response.headers) {
      const retryAfter = error.response.headers['retry-after'] || 
                        error.response.headers['Retry-After'];
      
      if (retryAfter) {
        const seconds = parseInt(retryAfter, 10);
        return isNaN(seconds) ? null : seconds;
      }
    }

    // Check error message for rate limit info
    const rateLimitMatch = error.message.match(/try again in (\d+) seconds/i);
    if (rateLimitMatch) {
      return parseInt(rateLimitMatch[1], 10);
    }

    return null;
  }

  /**
   * Get retry configuration for a platform
   */
  getRetryConfig(platform) {
    return this.platformRetryConfigs[platform] || {
      maxRetries: 3,
      strategy: 'exponential',
      baseDelay: 60000,
      maxDelay: 600000,
      retryableErrors: [429, 500, 502, 503, 504],
    };
  }

  /**
   * Create retry job data
   */
  createRetryJobData(originalJobData, error, attemptCount) {
    const platform = originalJobData.platform || originalJobData.platforms?.[0];
    const delay = this.shouldRetry(error, platform, attemptCount) 
      ? this.calculateRetryDelay(platform, attemptCount)
      : null;

    if (delay === null) {
      return null; // Don't retry
    }

    // Handle rate limiting
    if (error.statusCode === 429) {
      const rateLimitDelay = this.handleRateLimit(error, platform);
      return {
        ...originalJobData,
        retryAttempt: attemptCount,
        retryReason: 'rate_limit',
        delay: rateLimitDelay,
      };
    }

    return {
      ...originalJobData,
      retryAttempt: attemptCount,
      retryReason: 'failed_post',
      delay,
    };
  }

  /**
   * Log retry attempt
   */
  logRetryAttempt(jobData, error, attemptCount) {
    const platform = jobData.platform || jobData.platforms?.[0];
    
    logger.warn('Scheduling retry for failed post', {
      postId: jobData.postId,
      platform,
      attemptCount,
      error: error.message,
      delay: jobData.delay,
      retryReason: jobData.retryReason,
    });
  }

  /**
   * Mark post for manual review if retries exhausted
   */
  async markForManualReview(postId, platform, finalError) {
    try {
      const post = await Post.findById(postId);
      if (!post) return;

      const errorLog = post.errorLog || {};
      errorLog[platform] = {
        ...errorLog[platform],
        requiresManualReview: true,
        finalError: finalError.message,
        exhaustedAt: new Date().toISOString(),
      };

      await post.update({
        status: 'failed',
        errorLog,
      });

      logger.error('Post marked for manual review after retry exhaustion', {
        postId,
        platform,
        error: finalError.message,
      });

    } catch (error) {
      logger.error('Failed to mark post for manual review', { postId, error });
    }
  }

  /**
   * Get retry statistics
   */
  async getRetryStats(teamId, timeframe = '24h') {
    const timeframeLookup = {
      '1h': '1 hour',
      '24h': '24 hours', 
      '7d': '7 days',
      '30d': '30 days',
    };

    const interval = timeframeLookup[timeframe] || '24 hours';

    try {
      const result = await query(`
        SELECT 
          platform,
          COUNT(*) as total_retries,
          COUNT(DISTINCT id) as posts_with_retries,
          AVG(retry_count) as avg_retry_count,
          MAX(retry_count) as max_retry_count
        FROM posts 
        WHERE team_id = $1 
          AND retry_count > 0 
          AND created_at > NOW() - INTERVAL '${interval}'
        GROUP BY platform
      `, [teamId]);

      return result.rows.map(row => ({
        platform: row.platform,
        totalRetries: parseInt(row.total_retries),
        postsWithRetries: parseInt(row.posts_with_retries),
        avgRetryCount: parseFloat(row.avg_retry_count),
        maxRetryCount: parseInt(row.max_retry_count),
      }));

    } catch (error) {
      logger.error('Failed to get retry stats', { teamId, error });
      return [];
    }
  }

  /**
   * Clean up old retry data
   */
  async cleanupOldRetries(olderThanDays = 30) {
    try {
      const result = await query(`
        UPDATE posts 
        SET error_log = NULL, retry_count = 0
        WHERE status = 'failed' 
          AND created_at < NOW() - INTERVAL '${olderThanDays} days'
          AND retry_count > 0
      `);

      logger.info('Cleaned up old retry data', { 
        updatedPosts: result.rowCount,
        olderThanDays 
      });

      return result.rowCount;

    } catch (error) {
      logger.error('Failed to cleanup old retries', { error });
      return 0;
    }
  }

  /**
   * Get retry-eligible posts
   */
  async getRetryEligiblePosts(teamId) {
    try {
      const result = await query(`
        SELECT id, platforms, retry_count, error_log, created_at
        FROM posts
        WHERE team_id = $1 
          AND status = 'failed'
          AND retry_count < 5
          AND created_at > NOW() - INTERVAL '7 days'
        ORDER BY created_at DESC
      `, [teamId]);

      return result.rows.filter(post => {
        // Additional filtering logic
        const platforms = Array.isArray(post.platforms) ? post.platforms : [];
        return platforms.some(platform => {
          const config = this.getRetryConfig(platform);
          return post.retry_count < config.maxRetries;
        });
      });

    } catch (error) {
      logger.error('Failed to get retry eligible posts', { teamId, error });
      return [];
    }
  }
}