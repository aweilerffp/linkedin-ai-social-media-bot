import { WebClient } from '@slack/web-api';
import crypto from 'crypto';
import { logger } from '../../utils/logger.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { getRedisClient } from '../../config/redis.js';

export class SlackApprovalService {
  constructor() {
    this.slackToken = process.env.SLACK_BOT_TOKEN;
    this.slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
    this.appUrl = process.env.APP_URL || 'http://localhost:3001';
    
    if (!this.slackToken) {
      throw new Error('SLACK_BOT_TOKEN environment variable is required');
    }
    
    this.slack = new WebClient(this.slackToken);
    this.approvalTimeout = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Send LinkedIn post for approval in Slack
   */
  async sendPostForApproval(linkedInPost, imageData, companyProfile, userInfo) {
    try {
      const { 
        team_id: teamId,
        slack_channel: channel = '#social-media',
        slack_approvers: approvers = []
      } = companyProfile;

      if (!channel) {
        throw new ApiError('Slack channel not configured for company', 400);
      }

      // Create approval ID for tracking
      const approvalId = crypto.randomUUID();
      
      // Store approval data in Redis
      await this.storeApprovalData(approvalId, {
        linkedInPost,
        imageData,
        companyProfile,
        userInfo,
        status: 'pending',
        created_at: new Date().toISOString()
      });

      // Build Slack message
      const message = await this.buildApprovalMessage(
        linkedInPost, 
        imageData, 
        companyProfile, 
        approvalId
      );

      // Send to Slack
      const result = await this.slack.chat.postMessage({
        channel: channel,
        text: '🎯 New LinkedIn Post Ready for Review',
        blocks: message.blocks,
        attachments: message.attachments
      });

      // Store Slack message info for updates
      await this.storeSlackMessageInfo(approvalId, {
        channel: result.channel,
        ts: result.ts,
        permalink: `https://slack.com/archives/${result.channel}/p${result.ts.replace('.', '')}`
      });

      // Notify approvers if specified
      if (approvers.length > 0) {
        await this.notifyApprovers(approvers, channel, result.ts, companyProfile.company_name);
      }

      logger.info('LinkedIn post sent for Slack approval', {
        approvalId,
        companyId: companyProfile.id,
        channel,
        messageTs: result.ts
      });

      return {
        approvalId,
        slackChannel: result.channel,
        slackMessageTs: result.ts,
        status: 'pending'
      };

    } catch (error) {
      logger.error('Failed to send post for Slack approval', {
        error: error.message,
        companyId: companyProfile.id
      });
      throw error;
    }
  }

  /**
   * Build interactive Slack message for post approval
   */
  async buildApprovalMessage(linkedInPost, imageData, companyProfile, approvalId) {
    const { post, metadata } = linkedInPost;
    const charCount = metadata?.characterCount || post.length;
    const readingLevel = metadata?.estimatedReadingLevel || 'N/A';

    // Truncate post for preview
    const postPreview = post.length > 500 
      ? post.substring(0, 500) + '...' 
      : post;

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🎯 LinkedIn Post Ready for Review'
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Company:* ${companyProfile.company_name}`
          },
          {
            type: 'mrkdwn',
            text: `*Character Count:* ${charCount}/2200`
          },
          {
            type: 'mrkdwn',
            text: `*Reading Level:* Grade ${readingLevel}`
          },
          {
            type: 'mrkdwn',
            text: `*Content Pillar:* ${metadata?.contentPillar || 'N/A'}`
          }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Post Content:*\n\`\`\`${postPreview}\`\`\``
        }
      }
    ];

    // Add image if available
    if (imageData?.imageUrl) {
      blocks.push({
        type: 'image',
        image_url: imageData.imageUrl,
        alt_text: imageData.altText || 'Generated post image'
      });
      
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Image Alt-Text: ${imageData.altText || 'Generated post image'}`
          }
        ]
      });
    }

    // Add action buttons
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '✅ Approve & Queue'
          },
          style: 'primary',
          action_id: 'approve_post',
          value: approvalId
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '✏️ Request Edit'
          },
          action_id: 'request_edit',
          value: approvalId
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '❌ Reject'
          },
          style: 'danger',
          action_id: 'reject_post',
          value: approvalId
        }
      ]
    });

    // Add metadata context
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Generated from: ${metadata?.sourceTranscript || 'Meeting transcript'} | Approval ID: ${approvalId}`
        }
      ]
    });

    return {
      blocks,
      attachments: []
    };
  }

  /**
   * Handle Slack interactive button clicks
   */
  async handleInteraction(payload) {
    try {
      const { actions, user, channel, message } = payload;
      const action = actions[0];
      const approvalId = action.value;

      // Verify signature if needed (in production)
      // this.verifySlackSignature(payload);

      logger.info('Slack interaction received', {
        action: action.action_id,
        approvalId,
        user: user.id
      });

      switch (action.action_id) {
        case 'approve_post':
          return await this.handleApproval(approvalId, user, channel, message);
          
        case 'request_edit':
          return await this.handleEditRequest(approvalId, user, channel, message);
          
        case 'reject_post':
          return await this.handleRejection(approvalId, user, channel, message);
          
        default:
          throw new ApiError(`Unknown action: ${action.action_id}`, 400);
      }

    } catch (error) {
      logger.error('Failed to handle Slack interaction', {
        error: error.message,
        payload: JSON.stringify(payload).substring(0, 500)
      });
      throw error;
    }
  }

  /**
   * Handle post approval
   */
  async handleApproval(approvalId, user, channel, message) {
    try {
      // Get approval data
      const approvalData = await this.getApprovalData(approvalId);
      if (!approvalData) {
        throw new ApiError('Approval data not found', 404);
      }

      // Update approval status
      approvalData.status = 'approved';
      approvalData.approved_by = user.id;
      approvalData.approved_at = new Date().toISOString();
      
      await this.storeApprovalData(approvalId, approvalData);

      // Update Slack message
      const updatedMessage = await this.buildApprovedMessage(approvalData, user);
      
      await this.slack.chat.update({
        channel: channel.id,
        ts: message.ts,
        text: '✅ LinkedIn Post Approved',
        blocks: updatedMessage.blocks
      });

      // Add to posting queue (this would integrate with your existing queue system)
      await this.addToPostingQueue(approvalData);

      // Send confirmation
      await this.slack.chat.postEphemeral({
        channel: channel.id,
        user: user.id,
        text: '✅ Post approved and added to publishing queue!'
      });

      logger.info('Post approved via Slack', {
        approvalId,
        approvedBy: user.id,
        companyId: approvalData.companyProfile.id
      });

      return { status: 'approved', message: 'Post approved and queued for publishing' };

    } catch (error) {
      logger.error('Failed to handle approval', {
        approvalId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Handle edit request
   */
  async handleEditRequest(approvalId, user, channel, message) {
    try {
      // Show modal for edit feedback
      const modal = this.buildEditRequestModal(approvalId);
      
      await this.slack.views.open({
        trigger_id: message.trigger_id, // This would come from the interaction payload
        view: modal
      });

      logger.info('Edit request modal opened', {
        approvalId,
        requestedBy: user.id
      });

      return { status: 'edit_requested', message: 'Edit request modal opened' };

    } catch (error) {
      logger.error('Failed to handle edit request', {
        approvalId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Handle post rejection
   */
  async handleRejection(approvalId, user, channel, message) {
    try {
      // Get approval data
      const approvalData = await this.getApprovalData(approvalId);
      if (!approvalData) {
        throw new ApiError('Approval data not found', 404);
      }

      // Update approval status
      approvalData.status = 'rejected';
      approvalData.rejected_by = user.id;
      approvalData.rejected_at = new Date().toISOString();
      
      await this.storeApprovalData(approvalId, approvalData);

      // Update Slack message
      const updatedMessage = await this.buildRejectedMessage(approvalData, user);
      
      await this.slack.chat.update({
        channel: channel.id,
        ts: message.ts,
        text: '❌ LinkedIn Post Rejected',
        blocks: updatedMessage.blocks
      });

      logger.info('Post rejected via Slack', {
        approvalId,
        rejectedBy: user.id,
        companyId: approvalData.companyProfile.id
      });

      return { status: 'rejected', message: 'Post rejected' };

    } catch (error) {
      logger.error('Failed to handle rejection', {
        approvalId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Build edit request modal
   */
  buildEditRequestModal(approvalId) {
    return {
      type: 'modal',
      callback_id: 'edit_request_modal',
      title: {
        type: 'plain_text',
        text: 'Request Post Edit'
      },
      submit: {
        type: 'plain_text',
        text: 'Submit Feedback'
      },
      close: {
        type: 'plain_text',
        text: 'Cancel'
      },
      private_metadata: approvalId,
      blocks: [
        {
          type: 'input',
          element: {
            type: 'plain_text_input',
            multiline: true,
            action_id: 'edit_feedback'
          },
          label: {
            type: 'plain_text',
            text: 'What changes would you like to see?'
          }
        },
        {
          type: 'input',
          element: {
            type: 'checkboxes',
            options: [
              {
                text: {
                  type: 'plain_text',
                  text: 'Tone adjustment'
                },
                value: 'tone'
              },
              {
                text: {
                  type: 'plain_text',
                  text: 'Content length'
                },
                value: 'length'
              },
              {
                text: {
                  type: 'plain_text',
                  text: 'Call-to-action'
                },
                value: 'cta'
              },
              {
                text: {
                  type: 'plain_text',
                  text: 'Keywords/messaging'
                },
                value: 'keywords'
              }
            ],
            action_id: 'edit_categories'
          },
          label: {
            type: 'plain_text',
            text: 'Areas needing attention:'
          },
          optional: true
        }
      ]
    };
  }

  /**
   * Build approved message
   */
  async buildApprovedMessage(approvalData, approver) {
    const { linkedInPost, companyProfile } = approvalData;
    
    return {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '✅ LinkedIn Post Approved'
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Company:* ${companyProfile.company_name}`
            },
            {
              type: 'mrkdwn',
              text: `*Approved by:* <@${approver.id}>`
            },
            {
              type: 'mrkdwn',
              text: `*Status:* Queued for publishing`
            },
            {
              type: 'mrkdwn',
              text: `*Next action:* Will publish according to schedule`
            }
          ]
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Approved at ${new Date().toLocaleString()} | Approval ID: ${approvalData.approvalId}`
            }
          ]
        }
      ]
    };
  }

  /**
   * Build rejected message
   */
  async buildRejectedMessage(approvalData, rejecter) {
    const { linkedInPost, companyProfile } = approvalData;
    
    return {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '❌ LinkedIn Post Rejected'
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Company:* ${companyProfile.company_name}`
            },
            {
              type: 'mrkdwn',
              text: `*Rejected by:* <@${rejecter.id}>`
            },
            {
              type: 'mrkdwn',
              text: `*Status:* Not published`
            }
          ]
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Rejected at ${new Date().toLocaleString()} | Approval ID: ${approvalData.approvalId}`
            }
          ]
        }
      ]
    };
  }

  /**
   * Store approval data in Redis
   */
  async storeApprovalData(approvalId, data) {
    try {
      const redisClient = getRedisClient();
      const key = `approval:${approvalId}`;
      await redisClient.setex(key, this.approvalTimeout / 1000, JSON.stringify(data));
    } catch (error) {
      logger.error('Failed to store approval data', {
        approvalId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get approval data from Redis
   */
  async getApprovalData(approvalId) {
    try {
      const redisClient = getRedisClient();
      const key = `approval:${approvalId}`;
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Failed to get approval data', {
        approvalId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Store Slack message info
   */
  async storeSlackMessageInfo(approvalId, messageInfo) {
    try {
      const redisClient = getRedisClient();
      const key = `slack_msg:${approvalId}`;
      await redisClient.setex(key, this.approvalTimeout / 1000, JSON.stringify(messageInfo));
    } catch (error) {
      logger.error('Failed to store Slack message info', {
        approvalId,
        error: error.message
      });
    }
  }

  /**
   * Notify specific approvers
   */
  async notifyApprovers(approvers, channel, messageTs, companyName) {
    try {
      const approverMentions = approvers.map(id => `<@${id}>`).join(', ');
      
      await this.slack.chat.postMessage({
        channel: channel,
        thread_ts: messageTs,
        text: `${approverMentions} - New ${companyName} LinkedIn post is ready for your review!`
      });
    } catch (error) {
      logger.error('Failed to notify approvers', {
        error: error.message,
        approvers,
        channel
      });
    }
  }

  /**
   * Add approved post to publishing queue
   */
  async addToPostingQueue(approvalData) {
    try {
      // This would integrate with your existing queue system
      // For now, just log that it should be queued
      logger.info('Post should be added to publishing queue', {
        approvalId: approvalData.approvalId,
        companyId: approvalData.companyProfile.id,
        postContent: approvalData.linkedInPost.post.substring(0, 100)
      });

      // In a real implementation, you would:
      // 1. Add to your existing posts table with status 'approved'
      // 2. Add to queue_schedule table with appropriate timing
      // 3. Trigger your existing queue processing
      
      return { queued: true };
    } catch (error) {
      logger.error('Failed to add to posting queue', {
        approvalId: approvalData.approvalId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Verify Slack signature for security
   */
  verifySlackSignature(payload, signature, timestamp) {
    if (!this.slackSigningSecret) {
      logger.warn('Slack signing secret not configured');
      return true; // Skip verification in development
    }

    const hmac = crypto.createHmac('sha256', this.slackSigningSecret);
    hmac.update(`v0:${timestamp}:${payload}`);
    const computedSignature = `v0=${hmac.digest('hex')}`;

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(computedSignature)
    );
  }

  /**
   * Get approval statistics
   */
  async getApprovalStats(companyId, dateRange = 30) {
    try {
      const redisClient = getRedisClient();
      const pattern = `approval:*`;
      const keys = await redisClient.keys(pattern);
      
      const stats = {
        total: 0,
        approved: 0,
        rejected: 0,
        pending: 0,
        edit_requested: 0,
        by_company: {}
      };

      for (const key of keys) {
        try {
          const data = await redisClient.get(key);
          if (data) {
            const approval = JSON.parse(data);
            if (approval.companyProfile.id === companyId) {
              stats.total++;
              stats[approval.status]++;
            }
          }
        } catch (parseError) {
          // Skip invalid entries
        }
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get approval stats', {
        error: error.message,
        companyId
      });
      return { error: error.message };
    }
  }

  /**
   * Test Slack connection
   */
  async testConnection() {
    try {
      const result = await this.slack.auth.test();
      return {
        connected: true,
        botId: result.user_id,
        teamId: result.team_id,
        teamName: result.team
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
export const slackApprovalService = new SlackApprovalService();