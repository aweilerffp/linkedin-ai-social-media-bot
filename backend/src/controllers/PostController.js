import { Post } from '../models/Post.js';
import { SchedulerService } from '../services/scheduler/SchedulerService.js';
import { schedulePost } from '../services/queue/QueueService.js';
import { ApiError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { notifyWebhooks } from './WebhookController.js';

const schedulerService = new SchedulerService();

export class PostController {
  /**
   * Create a new post
   */
  static async createPost(req, res, next) {
    try {
      const { content, mediaUrls, platforms, scheduledAt, metadata } = req.body;
      const { teamId } = req.user;

      const postData = {
        teamId,
        userId: req.user.id,
        content,
        mediaUrls: mediaUrls || [],
        platforms: platforms || [],
        metadata: metadata || {},
      };

      let post;
      if (scheduledAt) {
        // Schedule the post
        const result = await schedulerService.schedulePostAt(
          postData, 
          scheduledAt, 
          req.body.timezone || 'UTC'
        );
        post = result.post;

        // Send webhook notification for scheduled post
        await notifyWebhooks(teamId, 'post.scheduled', {
          postId: post.id,
          content: post.content,
          platforms: post.platforms,
          scheduledAt: post.scheduled_at,
        }, req.user.id);
      } else {
        // Create as draft
        post = await Post.create(postData);
      }

      res.status(201).json({
        success: true,
        data: post.toJSON(),
        message: scheduledAt ? 'Post scheduled successfully' : 'Post created successfully',
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get posts for team
   */
  static async getPosts(req, res, next) {
    try {
      const { teamId } = req.user;
      const { limit = 50, offset = 0, status } = req.query;

      const posts = await Post.findByTeamId(teamId, {
        limit: parseInt(limit),
        offset: parseInt(offset),
        status,
      });

      res.json({
        success: true,
        data: posts.map(post => post.toJSON()),
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
        },
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single post
   */
  static async getPost(req, res, next) {
    try {
      const { postId } = req.params;
      const { teamId } = req.user;

      const post = await Post.findById(postId);
      if (!post) {
        throw new ApiError(404, 'Post not found');
      }

      if (post.teamId !== teamId && req.user.role !== 'admin') {
        throw new ApiError(403, 'Access denied');
      }

      res.json({
        success: true,
        data: post.toJSON(),
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Update post
   */
  static async updatePost(req, res, next) {
    try {
      const { postId } = req.params;
      const { teamId } = req.user;
      const updates = req.body;

      const post = await Post.findById(postId);
      if (!post) {
        throw new ApiError(404, 'Post not found');
      }

      if (post.teamId !== teamId && req.user.role !== 'admin') {
        throw new ApiError(403, 'Access denied');
      }

      // Handle scheduling updates
      if (updates.scheduledAt && post.status === 'scheduled') {
        await schedulerService.reschedulePost(
          postId, 
          updates.scheduledAt, 
          updates.timezone || 'UTC'
        );
        delete updates.scheduledAt; // Handled by scheduler
      }

      await post.update(updates);

      res.json({
        success: true,
        data: post.toJSON(),
        message: 'Post updated successfully',
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete post
   */
  static async deletePost(req, res, next) {
    try {
      const { postId } = req.params;
      const { teamId } = req.user;

      const post = await Post.findById(postId);
      if (!post) {
        throw new ApiError(404, 'Post not found');
      }

      if (post.teamId !== teamId && req.user.role !== 'admin') {
        throw new ApiError(403, 'Access denied');
      }

      await post.delete();

      res.json({
        success: true,
        message: 'Post deleted successfully',
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Post immediately
   */
  static async postNow(req, res, next) {
    try {
      const { postId } = req.params;
      const { teamId } = req.user;

      const post = await Post.findById(postId);
      if (!post) {
        throw new ApiError(404, 'Post not found');
      }

      if (post.teamId !== teamId) {
        throw new ApiError(403, 'Access denied');
      }

      if (!['draft', 'failed'].includes(post.status)) {
        throw new ApiError(400, 'Post cannot be posted in current status');
      }

      // Update post to queued and schedule for immediate processing
      await post.update({ status: 'queued' });

      const job = await schedulePost({
        postId: post.id,
        platforms: post.platforms,
        teamId: post.teamId,
        priority: 10, // High priority for immediate posts
      });

      res.json({
        success: true,
        data: {
          post: post.toJSON(),
          jobId: job.id,
        },
        message: 'Post queued for immediate processing',
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Schedule post for optimal time
   */
  static async scheduleOptimal(req, res, next) {
    try {
      const { postId } = req.params;
      const { date, timezone = 'UTC', platform } = req.body;
      const { teamId } = req.user;

      const post = await Post.findById(postId);
      if (!post) {
        throw new ApiError(404, 'Post not found');
      }

      if (post.teamId !== teamId) {
        throw new ApiError(403, 'Access denied');
      }

      const result = await schedulerService.schedulePostOptimal(
        post.toJSON(), 
        date, 
        timezone, 
        platform
      );

      res.json({
        success: true,
        data: result,
        message: 'Post scheduled for optimal time',
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get scheduled posts
   */
  static async getScheduledPosts(req, res, next) {
    try {
      const { teamId } = req.user;
      const { from, to, platform, limit, offset } = req.query;

      const posts = await schedulerService.getScheduledPosts(teamId, {
        from,
        to,
        platform,
        limit: parseInt(limit) || 50,
        offset: parseInt(offset) || 0,
      });

      res.json({
        success: true,
        data: posts.map(post => post.toJSON()),
        pagination: {
          limit: parseInt(limit) || 50,
          offset: parseInt(offset) || 0,
        },
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Cancel scheduled post
   */
  static async cancelScheduled(req, res, next) {
    try {
      const { postId } = req.params;
      const { teamId } = req.user;

      const post = await Post.findById(postId);
      if (!post) {
        throw new ApiError(404, 'Post not found');
      }

      if (post.teamId !== teamId) {
        throw new ApiError(403, 'Access denied');
      }

      await schedulerService.cancelScheduledPost(postId);

      res.json({
        success: true,
        data: post.toJSON(),
        message: 'Scheduled post cancelled',
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get schedule statistics
   */
  static async getScheduleStats(req, res, next) {
    try {
      const { teamId } = req.user;
      const { timezone = 'UTC' } = req.query;

      const stats = await schedulerService.getScheduleStats(teamId, timezone);

      res.json({
        success: true,
        data: stats,
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get optimal times suggestions
   */
  static async getOptimalTimes(req, res, next) {
    try {
      const { teamId } = req.user;
      const { platform, timezone = 'UTC' } = req.query;

      if (!platform) {
        throw new ApiError(400, 'Platform parameter required');
      }

      const suggestions = await schedulerService.suggestOptimalTimes(teamId, platform, timezone);

      res.json({
        success: true,
        data: suggestions,
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Check schedule conflicts
   */
  static async checkConflicts(req, res, next) {
    try {
      const { teamId } = req.user;
      const { scheduledTime, platforms, excludePostId } = req.body;

      const conflicts = await schedulerService.checkScheduleConflicts(
        teamId,
        scheduledTime,
        platforms,
        excludePostId
      );

      res.json({
        success: true,
        data: {
          hasConflicts: conflicts.length > 0,
          conflicts,
        },
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Retry failed post
   */
  static async retryPost(req, res, next) {
    try {
      const { postId } = req.params;
      const { teamId } = req.user;
      const { platform } = req.body;

      const post = await Post.findById(postId);
      if (!post) {
        throw new ApiError(404, 'Post not found');
      }

      if (post.teamId !== teamId) {
        throw new ApiError(403, 'Access denied');
      }

      if (!post.canRetry()) {
        throw new ApiError(400, 'Post cannot be retried');
      }

      // Schedule retry
      const job = await scheduleRetry({
        postId: post.id,
        platform: platform || post.platforms[0],
        teamId: post.teamId,
        retryAttempt: post.retryCount + 1,
        delay: 1000, // 1 second delay
      });

      res.json({
        success: true,
        data: {
          post: post.toJSON(),
          jobId: job.id,
        },
        message: 'Post retry scheduled',
      });

    } catch (error) {
      next(error);
    }
  }
}