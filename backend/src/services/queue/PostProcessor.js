import { PlatformFactory } from '../platforms/PlatformFactory.js';
import { Post } from '../../models/Post.js';
import { logger } from '../../utils/logger.js';
import { query } from '../../config/database.js';
import { io } from '../../../server.js';
import { notifyWebhooks } from '../../controllers/WebhookController.js';

export class PostProcessor {
  constructor() {
    this.processingStatus = new Map();
  }

  /**
   * Process a scheduled post
   */
  async processPost(job) {
    const { postId, platforms, teamId } = job.data;
    
    logger.info('Processing post job', { postId, platforms, teamId, jobId: job.id });

    try {
      // Get post from database
      const post = await Post.findById(postId);
      if (!post) {
        throw new Error(`Post ${postId} not found`);
      }

      // Check if post is still eligible for posting
      if (!this.isPostEligible(post)) {
        logger.warn('Post not eligible for processing', { 
          postId, 
          status: post.status,
          scheduledAt: post.scheduledAt 
        });
        return { success: false, reason: 'Post not eligible' };
      }

      // Get platform credentials
      const credentials = await this.getPlatformCredentials(teamId, platforms);
      if (credentials.length === 0) {
        throw new Error('No platform credentials found');
      }

      // Update post status to posting
      await post.update({ status: 'posting' });
      
      // Notify frontend of status change
      await this.notifyStatusChange(teamId, postId, 'posting');

      const results = [];
      const errors = [];

      // Process each platform
      for (const platform of platforms) {
        try {
          const platformCreds = credentials.find(c => c.platform === platform);
          if (!platformCreds) {
            throw new Error(`No credentials found for platform: ${platform}`);
          }

          const result = await this.postToPlatform(post, platform, platformCreds);
          results.push(result);

          // Mark platform as posted
          await post.markAsPosted(platform, result.platformPostId);
          
          logger.info('Successfully posted to platform', { 
            postId, 
            platform, 
            platformPostId: result.platformPostId 
          });

        } catch (error) {
          logger.error('Failed to post to platform', { 
            postId, 
            platform, 
            error: error.message 
          });
          
          errors.push({ platform, error: error.message });
          await post.markAsFailed(platform, error);
        }
      }

      // Determine final status
      const finalStatus = errors.length === 0 ? 'posted' : 
                         results.length > 0 ? 'posted' : 'failed';

      await post.update({ 
        status: finalStatus,
        postedAt: finalStatus === 'posted' ? new Date() : post.postedAt
      });

      // Notify frontend of completion
      await this.notifyStatusChange(teamId, postId, finalStatus, { results, errors });

      return {
        success: errors.length < platforms.length,
        results,
        errors,
        finalStatus
      };

    } catch (error) {
      logger.error('Post processing failed', { postId, error: error.message });
      
      // Update post status to failed
      try {
        const post = await Post.findById(postId);
        if (post) {
          await post.update({ 
            status: 'failed',
            errorLog: { general: error.message }
          });
          await this.notifyStatusChange(teamId, postId, 'failed', { error: error.message });
        }
      } catch (updateError) {
        logger.error('Failed to update post status', { postId, error: updateError.message });
      }

      throw error;
    }
  }

  /**
   * Post content to a specific platform
   */
  async postToPlatform(post, platform, credentials) {
    const service = PlatformFactory.createService(platform, credentials);
    
    // Validate and refresh credentials if needed
    await service.ensureValidToken();

    const options = {
      mediaUrls: post.mediaUrls,
      metadata: post.metadata,
    };

    const result = await service.post(post.content, options);
    
    return {
      ...result,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Check if post is eligible for processing
   */
  isPostEligible(post) {
    // Must be in scheduled status
    if (post.status !== 'scheduled') {
      return false;
    }

    // Must have scheduled time in the past
    if (!post.scheduledAt || new Date(post.scheduledAt) > new Date()) {
      return false;
    }

    // Must have platforms to post to
    if (!post.platforms || post.platforms.length === 0) {
      return false;
    }

    return true;
  }

  /**
   * Get platform credentials for team
   */
  async getPlatformCredentials(teamId, platforms) {
    try {
      const result = await query(
        `SELECT * FROM platform_credentials 
         WHERE team_id = $1 AND platform = ANY($2) AND is_active = true`,
        [teamId, platforms]
      );
      return result.rows;
    } catch (error) {
      logger.error('Failed to get platform credentials', { teamId, platforms, error });
      return [];
    }
  }

  /**
   * Notify frontend of status changes via WebSocket and webhooks
   */
  async notifyStatusChange(teamId, postId, status, data = {}) {
    try {
      // Send WebSocket notification
      io.to(`team-${teamId}`).emit('post-status-update', {
        postId,
        status,
        timestamp: new Date().toISOString(),
        ...data,
      });

      // Send webhook notifications for relevant status changes
      if (postId && (status === 'posted' || status === 'failed')) {
        const post = await Post.findById(postId);
        if (post) {
          if (status === 'posted') {
            await notifyWebhooks(teamId, 'post.published', {
              postId: post.id,
              content: post.content,
              platforms: post.platforms,
              publishedAt: new Date().toISOString(),
              status: 'published',
            });
          } else if (status === 'failed') {
            await notifyWebhooks(teamId, 'post.failed', {
              postId: post.id,
              content: post.content,
              platforms: post.platforms,
              error: data.error || 'Unknown error',
              failedAt: new Date().toISOString(),
            });
          }
        }
      }
    } catch (error) {
      logger.error('Failed to send status notification', { teamId, postId, error });
    }
  }

  /**
   * Process retry for failed posts
   */
  async processRetry(job) {
    const { postId, platform, teamId } = job.data;
    
    logger.info('Processing retry job', { postId, platform, teamId, jobId: job.id });

    try {
      const post = await Post.findById(postId);
      if (!post || !post.canRetry()) {
        throw new Error('Post not eligible for retry');
      }

      const credentials = await this.getPlatformCredentials(teamId, [platform]);
      if (credentials.length === 0) {
        throw new Error(`No credentials found for platform: ${platform}`);
      }

      const platformCreds = credentials[0];
      const result = await this.postToPlatform(post, platform, platformCreds);

      await post.markAsPosted(platform, result.platformPostId);
      await this.notifyStatusChange(teamId, postId, 'posted', { platform, result });

      return { success: true, result };

    } catch (error) {
      logger.error('Retry processing failed', { postId, platform, error: error.message });
      
      const post = await Post.findById(postId);
      if (post) {
        await post.markAsFailed(platform, error);
      }

      throw error;
    }
  }

  /**
   * Bulk process multiple posts
   */
  async processBulkPosts(job) {
    const { postIds, teamId } = job.data;
    
    logger.info('Processing bulk posts job', { postCount: postIds.length, teamId });

    const results = [];
    
    for (const postId of postIds) {
      try {
        const post = await Post.findById(postId);
        if (post && this.isPostEligible(post)) {
          const result = await this.processPost({ 
            data: { 
              postId, 
              platforms: post.platforms, 
              teamId 
            } 
          });
          results.push({ postId, ...result });
        } else {
          results.push({ 
            postId, 
            success: false, 
            reason: 'Post not eligible' 
          });
        }
      } catch (error) {
        results.push({ 
          postId, 
          success: false, 
          error: error.message 
        });
      }

      // Small delay between posts to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await this.notifyStatusChange(teamId, null, 'bulk-complete', { results });
    
    return { results };
  }

  /**
   * Handle job completion
   */
  onJobComplete(job, result) {
    logger.info('Job completed successfully', { 
      jobId: job.id, 
      jobType: job.name,
      processingTime: Date.now() - job.processedOn 
    });

    // Clean up processing status
    if (this.processingStatus.has(job.id)) {
      this.processingStatus.delete(job.id);
    }
  }

  /**
   * Handle job failure
   */
  async onJobFailed(job, error) {
    logger.error('Job failed', { 
      jobId: job.id,
      jobType: job.name,
      attempts: job.attemptsMade,
      error: error.message 
    });

    // Clean up processing status
    if (this.processingStatus.has(job.id)) {
      this.processingStatus.delete(job.id);
    }

    // Notify about job failure if it's the final attempt
    if (job.attemptsMade >= job.opts.attempts) {
      const { teamId, postId } = job.data;
      await this.notifyStatusChange(teamId, postId, 'failed', { 
        error: error.message,
        finalFailure: true 
      });
    }
  }

  /**
   * Get processing statistics
   */
  getProcessingStats() {
    return {
      activeJobs: this.processingStatus.size,
      processingJobs: Array.from(this.processingStatus.entries()).map(([jobId, data]) => ({
        jobId,
        ...data,
        processingTime: Date.now() - data.startTime
      }))
    };
  }
}