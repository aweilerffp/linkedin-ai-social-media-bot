import crypto from 'crypto';
import axios from 'axios';
import { logger } from '../../utils/logger.js';
import { getRedisClient } from '../../config/redis.js';
import { ApiError } from '../../middleware/errorHandler.js';

export class WebhookService {
  constructor() {
    this.secret = process.env.WEBHOOK_SECRET || 'default-webhook-secret';
    this.maxRetries = 3;
    this.retryDelays = [1000, 5000, 30000]; // 1s, 5s, 30s
    this.timeoutMs = 30000; // 30 seconds
  }

  /**
   * Generate webhook signature
   */
  generateSignature(payload, secret = this.secret) {
    return crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload, signature, secret = this.secret) {
    const expectedSignature = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  /**
   * Send webhook notification
   */
  async sendWebhook(webhookUrl, event, data, options = {}) {
    const {
      secret = this.secret,
      retry = true,
      teamId,
      userId,
      metadata = {},
    } = options;

    const payload = {
      event,
      data,
      timestamp: new Date().toISOString(),
      teamId,
      userId,
      metadata,
    };

    const signature = this.generateSignature(payload, secret);

    const headers = {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': `sha256=${signature}`,
      'X-Webhook-Event': event,
      'X-Webhook-Timestamp': payload.timestamp,
      'User-Agent': 'SocialMediaPoster-Webhook/1.0',
    };

    let lastError = null;
    const maxAttempts = retry ? this.maxRetries + 1 : 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await axios.post(webhookUrl, payload, {
          headers,
          timeout: this.timeoutMs,
          validateStatus: (status) => status >= 200 && status < 300,
        });

        logger.info('Webhook sent successfully', {
          event,
          webhookUrl,
          attempt: attempt + 1,
          statusCode: response.status,
          teamId,
          userId,
        });

        return {
          success: true,
          statusCode: response.status,
          attempt: attempt + 1,
          response: response.data,
        };
      } catch (error) {
        lastError = error;
        
        logger.warn('Webhook delivery failed', {
          event,
          webhookUrl,
          attempt: attempt + 1,
          error: error.message,
          statusCode: error.response?.status,
          teamId,
          userId,
        });

        // Don't retry on certain status codes
        if (error.response?.status && [400, 401, 403, 404, 410, 422].includes(error.response.status)) {
          break;
        }

        // Wait before retry (except for last attempt)
        if (attempt < maxAttempts - 1 && retry) {
          const delay = this.retryDelays[Math.min(attempt, this.retryDelays.length - 1)];
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All attempts failed
    logger.error('Webhook delivery failed after all attempts', {
      event,
      webhookUrl,
      attempts: maxAttempts,
      lastError: lastError.message,
      statusCode: lastError.response?.status,
      teamId,
      userId,
    });

    return {
      success: false,
      error: lastError.message,
      statusCode: lastError.response?.status,
      attempts: maxAttempts,
    };
  }

  /**
   * Send webhook to multiple URLs
   */
  async sendWebhookToMultiple(webhookUrls, event, data, options = {}) {
    const results = await Promise.allSettled(
      webhookUrls.map(url => this.sendWebhook(url, event, data, options))
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;

    logger.info('Bulk webhook delivery completed', {
      event,
      total: results.length,
      successful,
      failed,
      teamId: options.teamId,
      userId: options.userId,
    });

    return {
      total: results.length,
      successful,
      failed,
      results: results.map((result, index) => ({
        url: webhookUrls[index],
        success: result.status === 'fulfilled' && result.value.success,
        result: result.status === 'fulfilled' ? result.value : { error: result.reason?.message },
      })),
    };
  }

  /**
   * Queue webhook for background processing
   */
  async queueWebhook(webhookUrls, event, data, options = {}) {
    const redisClient = getRedisClient();
    const webhookId = crypto.randomUUID();
    
    const webhookJob = {
      id: webhookId,
      webhookUrls: Array.isArray(webhookUrls) ? webhookUrls : [webhookUrls],
      event,
      data,
      options,
      createdAt: new Date().toISOString(),
      attempts: 0,
    };

    const queueKey = 'webhook:queue';
    await redisClient.lpush(queueKey, JSON.stringify(webhookJob));

    logger.info('Webhook queued for processing', {
      webhookId,
      event,
      urls: webhookJob.webhookUrls.length,
      teamId: options.teamId,
      userId: options.userId,
    });

    return webhookId;
  }

  /**
   * Process webhook queue (called by background worker)
   */
  async processWebhookQueue() {
    const redisClient = getRedisClient();
    const queueKey = 'webhook:queue';
    
    try {
      const jobData = await redisClient.brpop(queueKey, 1); // Block for 1 second
      
      if (!jobData) {
        return null; // No jobs in queue
      }

      const job = JSON.parse(jobData[1]);
      
      logger.info('Processing webhook job', {
        webhookId: job.id,
        event: job.event,
        urls: job.webhookUrls.length,
      });

      const result = await this.sendWebhookToMultiple(
        job.webhookUrls,
        job.event,
        job.data,
        job.options
      );

      // Store result for monitoring
      const resultKey = `webhook:result:${job.id}`;
      await redisClient.setex(resultKey, 86400, JSON.stringify({
        ...job,
        result,
        completedAt: new Date().toISOString(),
      }));

      return result;
    } catch (error) {
      logger.error('Webhook queue processing error:', error);
      throw error;
    }
  }

  /**
   * Start webhook processing worker
   */
  async startWebhookWorker() {
    logger.info('Starting webhook worker');
    
    const processLoop = async () => {
      while (true) {
        try {
          await this.processWebhookQueue();
        } catch (error) {
          logger.error('Webhook worker error:', error);
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    };

    // Start processing loop
    processLoop().catch(error => {
      logger.error('Webhook worker crashed:', error);
    });
  }

  /**
   * Get webhook delivery status
   */
  async getWebhookStatus(webhookId) {
    const redisClient = getRedisClient();
    const resultKey = `webhook:result:${webhookId}`;
    
    try {
      const result = await redisClient.get(resultKey);
      return result ? JSON.parse(result) : null;
    } catch (error) {
      logger.error('Error getting webhook status:', error);
      return null;
    }
  }

  /**
   * Validate webhook URL
   */
  isValidWebhookUrl(url) {
    try {
      const parsedUrl = new URL(url);
      return ['http:', 'https:'].includes(parsedUrl.protocol);
    } catch {
      return false;
    }
  }

  /**
   * Test webhook endpoint
   */
  async testWebhook(webhookUrl, secret = this.secret) {
    const testPayload = {
      event: 'webhook.test',
      data: {
        message: 'This is a test webhook from Social Media Poster',
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };

    try {
      const result = await this.sendWebhook(webhookUrl, 'webhook.test', testPayload.data, {
        secret,
        retry: false,
      });

      return {
        success: result.success,
        statusCode: result.statusCode,
        message: result.success ? 'Webhook test successful' : 'Webhook test failed',
        details: result,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Webhook test failed',
        error: error.message,
      };
    }
  }

  /**
   * Create webhook event helpers
   */
  async notifyPostPublished(post, teamId, userId, webhookUrls) {
    return this.queueWebhook(webhookUrls, 'post.published', {
      postId: post.id,
      content: post.content,
      platforms: post.platforms,
      publishedAt: post.published_at,
      status: post.status,
    }, { teamId, userId });
  }

  async notifyPostFailed(post, error, teamId, userId, webhookUrls) {
    return this.queueWebhook(webhookUrls, 'post.failed', {
      postId: post.id,
      content: post.content,
      platforms: post.platforms,
      error: error.message,
      failedAt: new Date().toISOString(),
    }, { teamId, userId });
  }

  async notifyPostScheduled(post, teamId, userId, webhookUrls) {
    return this.queueWebhook(webhookUrls, 'post.scheduled', {
      postId: post.id,
      content: post.content,
      platforms: post.platforms,
      scheduledAt: post.scheduled_at,
    }, { teamId, userId });
  }

  async notifyUserInvited(invitation, teamId, inviterId, webhookUrls) {
    return this.queueWebhook(webhookUrls, 'user.invited', {
      invitationId: invitation.id,
      email: invitation.email,
      name: invitation.name,
      role: invitation.role,
      invitedBy: inviterId,
      invitedAt: invitation.created_at,
    }, { teamId, userId: inviterId });
  }

  async notifyPlatformConnected(platform, profileData, teamId, userId, webhookUrls) {
    return this.queueWebhook(webhookUrls, 'platform.connected', {
      platform,
      profileData: {
        id: profileData.id,
        name: profileData.name,
        username: profileData.username,
      },
      connectedAt: new Date().toISOString(),
    }, { teamId, userId });
  }

  async notifyPlatformDisconnected(platform, teamId, userId, webhookUrls) {
    return this.queueWebhook(webhookUrls, 'platform.disconnected', {
      platform,
      disconnectedAt: new Date().toISOString(),
    }, { teamId, userId });
  }
}

// Export singleton instance
export const webhookService = new WebhookService();