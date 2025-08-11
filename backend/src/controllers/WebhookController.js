import { webhookConfigService } from '../services/webhook/WebhookConfigService.js';
import { webhookService } from '../services/webhook/WebhookService.js';
import { ApiError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

export class WebhookController {
  /**
   * Create webhook configuration
   */
  static async createWebhook(req, res, next) {
    try {
      const { teamId } = req.user;
      const webhookConfig = await webhookConfigService.createWebhookConfig(teamId, req.body);

      res.status(201).json({
        success: true,
        data: webhookConfig,
        message: 'Webhook configuration created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get webhook configurations
   */
  static async getWebhooks(req, res, next) {
    try {
      const { teamId } = req.user;
      const webhooks = await webhookConfigService.getWebhookConfigs(teamId);

      res.json({
        success: true,
        data: webhooks,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get webhook configuration by ID
   */
  static async getWebhook(req, res, next) {
    try {
      const { teamId } = req.user;
      const { webhookId } = req.params;
      
      const webhook = await webhookConfigService.getWebhookConfig(webhookId, teamId);

      res.json({
        success: true,
        data: webhook,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update webhook configuration
   */
  static async updateWebhook(req, res, next) {
    try {
      const { teamId } = req.user;
      const { webhookId } = req.params;
      
      const webhook = await webhookConfigService.updateWebhookConfig(
        webhookId,
        teamId,
        req.body
      );

      res.json({
        success: true,
        data: webhook,
        message: 'Webhook configuration updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete webhook configuration
   */
  static async deleteWebhook(req, res, next) {
    try {
      const { teamId } = req.user;
      const { webhookId } = req.params;
      
      await webhookConfigService.deleteWebhookConfig(webhookId, teamId);

      res.json({
        success: true,
        message: 'Webhook configuration deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Test webhook configuration
   */
  static async testWebhook(req, res, next) {
    try {
      const { teamId } = req.user;
      const { webhookId } = req.params;
      
      const result = await webhookConfigService.testWebhookConfig(webhookId, teamId);

      res.json({
        success: true,
        data: result,
        message: result.success ? 'Webhook test successful' : 'Webhook test failed',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get webhook delivery history
   */
  static async getWebhookDeliveries(req, res, next) {
    try {
      const { teamId } = req.user;
      const { webhookId } = req.params;
      const { limit, offset, status, event } = req.query;

      // Verify webhook belongs to team
      await webhookConfigService.getWebhookConfig(webhookId, teamId);
      
      const deliveries = await webhookConfigService.getWebhookDeliveries(webhookId, {
        limit: parseInt(limit) || 50,
        offset: parseInt(offset) || 0,
        status,
        event,
      });

      res.json({
        success: true,
        data: deliveries,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get webhook statistics
   */
  static async getWebhookStats(req, res, next) {
    try {
      const { teamId } = req.user;
      const { webhookId } = req.params;

      let stats;
      if (webhookId) {
        // Verify webhook belongs to team
        await webhookConfigService.getWebhookConfig(webhookId, teamId);
        stats = await webhookConfigService.getWebhookStats(teamId, webhookId);
      } else {
        stats = await webhookConfigService.getWebhookStats(teamId);
      }

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Manual webhook trigger (admin/testing)
   */
  static async triggerWebhook(req, res, next) {
    try {
      const { teamId, id: userId } = req.user;
      const { event, data } = req.body;

      if (!event || !data) {
        throw new ApiError(400, 'Event and data are required');
      }

      // Get active webhooks for this team and event
      const webhookConfigs = await webhookConfigService.getActiveWebhookUrls(teamId, event);
      
      if (webhookConfigs.length === 0) {
        return res.json({
          success: true,
          message: 'No active webhooks found for this event',
          data: { sent: 0 },
        });
      }

      const webhookUrls = webhookConfigs.map(config => config.url);
      const webhookId = await webhookService.queueWebhook(webhookUrls, event, data, {
        teamId,
        userId,
        manual: true,
      });

      logger.info('Manual webhook triggered', {
        webhookId,
        event,
        urls: webhookUrls.length,
        teamId,
        userId,
      });

      res.json({
        success: true,
        data: {
          webhookId,
          sent: webhookUrls.length,
          event,
        },
        message: `Webhook queued for ${webhookUrls.length} endpoint(s)`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get webhook status by ID
   */
  static async getWebhookStatus(req, res, next) {
    try {
      const { webhookId } = req.params;
      const status = await webhookService.getWebhookStatus(webhookId);

      if (!status) {
        throw new ApiError(404, 'Webhook status not found');
      }

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify webhook signature (utility endpoint)
   */
  static async verifyWebhookSignature(req, res, next) {
    try {
      const { payload, signature, secret } = req.body;

      if (!payload || !signature) {
        throw new ApiError(400, 'Payload and signature are required');
      }

      const isValid = webhookService.verifySignature(
        payload,
        signature.replace('sha256=', ''),
        secret || process.env.WEBHOOK_SECRET
      );

      res.json({
        success: true,
        data: {
          valid: isValid,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get supported webhook events
   */
  static async getWebhookEvents(req, res, next) {
    try {
      const events = [
        {
          event: 'post.published',
          description: 'Fired when a post is successfully published to a platform',
          example_data: {
            postId: 'uuid',
            content: 'Post content',
            platforms: ['linkedin', 'twitter'],
            publishedAt: '2024-01-01T00:00:00Z',
            status: 'published',
          },
        },
        {
          event: 'post.failed',
          description: 'Fired when a post fails to publish',
          example_data: {
            postId: 'uuid',
            content: 'Post content',
            platforms: ['linkedin', 'twitter'],
            error: 'Error message',
            failedAt: '2024-01-01T00:00:00Z',
          },
        },
        {
          event: 'post.scheduled',
          description: 'Fired when a post is scheduled',
          example_data: {
            postId: 'uuid',
            content: 'Post content',
            platforms: ['linkedin', 'twitter'],
            scheduledAt: '2024-01-01T00:00:00Z',
          },
        },
        {
          event: 'user.invited',
          description: 'Fired when a user is invited to a team',
          example_data: {
            invitationId: 'uuid',
            email: 'user@example.com',
            name: 'User Name',
            role: 'member',
            invitedBy: 'inviter-uuid',
            invitedAt: '2024-01-01T00:00:00Z',
          },
        },
        {
          event: 'platform.connected',
          description: 'Fired when a social media platform is connected',
          example_data: {
            platform: 'linkedin',
            profileData: {
              id: 'platform-user-id',
              name: 'Profile Name',
              username: 'username',
            },
            connectedAt: '2024-01-01T00:00:00Z',
          },
        },
        {
          event: 'platform.disconnected',
          description: 'Fired when a social media platform is disconnected',
          example_data: {
            platform: 'linkedin',
            disconnectedAt: '2024-01-01T00:00:00Z',
          },
        },
        {
          event: 'webhook.test',
          description: 'Test event for webhook validation',
          example_data: {
            message: 'This is a test webhook',
            timestamp: '2024-01-01T00:00:00Z',
          },
        },
      ];

      res.json({
        success: true,
        data: events,
      });
    } catch (error) {
      next(error);
    }
  }
}

// Helper function to notify webhooks about events
export async function notifyWebhooks(teamId, event, data, userId = null) {
  try {
    const webhookConfigs = await webhookConfigService.getActiveWebhookUrls(teamId, event);
    
    if (webhookConfigs.length === 0) {
      return;
    }

    const webhookUrls = webhookConfigs.map(config => config.url);
    await webhookService.queueWebhook(webhookUrls, event, data, {
      teamId,
      userId,
    });

    logger.info('Webhooks notified', {
      event,
      teamId,
      webhookCount: webhookUrls.length,
    });
  } catch (error) {
    logger.error('Error notifying webhooks:', error);
  }
}