import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
import advancedFormat from 'dayjs/plugin/advancedFormat.js';
import { schedulePost } from '../queue/QueueService.js';
import { Post } from '../../models/Post.js';
import { logger } from '../../utils/logger.js';
import { query } from '../../config/database.js';

// Initialize dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(advancedFormat);

export class SchedulerService {
  constructor() {
    this.supportedTimezones = [
      'America/New_York',
      'America/Chicago', 
      'America/Denver',
      'America/Los_Angeles',
      'Europe/London',
      'Europe/Paris',
      'Europe/Berlin',
      'Asia/Tokyo',
      'Asia/Shanghai',
      'Asia/Kolkata',
      'Australia/Sydney',
      'UTC',
    ];

    this.optimalPostingTimes = {
      linkedin: {
        weekday: ['08:00', '09:00', '12:00', '17:00', '18:00'],
        weekend: ['09:00', '11:00', '14:00'],
      },
      twitter: {
        weekday: ['09:00', '12:00', '15:00', '18:00', '21:00'],
        weekend: ['10:00', '13:00', '16:00', '19:00'],
      },
    };
  }

  /**
   * Schedule a post for a specific time
   */
  async schedulePostAt(postData, scheduledTime, timezone = 'UTC') {
    try {
      // Validate timezone
      if (!this.isValidTimezone(timezone)) {
        throw new Error(`Invalid timezone: ${timezone}`);
      }

      // Parse and validate scheduled time
      const scheduledAt = this.parseScheduledTime(scheduledTime, timezone);
      
      if (scheduledAt.isBefore(dayjs())) {
        throw new Error('Cannot schedule posts in the past');
      }

      // Create post in database with scheduled status
      const post = await Post.create({
        ...postData,
        scheduledAt: scheduledAt.toDate(),
        status: 'scheduled',
      });

      logger.info('Post scheduled successfully', {
        postId: post.id,
        scheduledAt: scheduledAt.format(),
        timezone,
        platforms: postData.platforms,
      });

      return {
        post,
        scheduledAt: scheduledAt.format(),
        timezone,
        delayMs: scheduledAt.diff(dayjs()),
      };

    } catch (error) {
      logger.error('Failed to schedule post:', error);
      throw error;
    }
  }

  /**
   * Schedule a post for optimal time based on platform
   */
  async schedulePostOptimal(postData, date, timezone = 'UTC', platform = null) {
    try {
      const targetDate = dayjs(date).tz(timezone);
      const isWeekend = targetDate.day() === 0 || targetDate.day() === 6;
      
      // Determine the primary platform for optimal timing
      const primaryPlatform = platform || postData.platforms[0];
      
      if (!this.optimalPostingTimes[primaryPlatform]) {
        throw new Error(`No optimal times defined for platform: ${primaryPlatform}`);
      }

      const optimalTimes = this.optimalPostingTimes[primaryPlatform][
        isWeekend ? 'weekend' : 'weekday'
      ];

      // Find the next available optimal time
      let bestTime = null;
      for (const timeStr of optimalTimes) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const candidateTime = targetDate.hour(hours).minute(minutes).second(0);
        
        if (candidateTime.isAfter(dayjs())) {
          bestTime = candidateTime;
          break;
        }
      }

      // If no time today works, use the first optimal time tomorrow
      if (!bestTime) {
        const [hours, minutes] = optimalTimes[0].split(':').map(Number);
        bestTime = targetDate.add(1, 'day').hour(hours).minute(minutes).second(0);
      }

      return await this.schedulePostAt(postData, bestTime.toDate(), timezone);

    } catch (error) {
      logger.error('Failed to schedule optimal post:', error);
      throw error;
    }
  }

  /**
   * Schedule recurring posts
   */
  async scheduleRecurringPosts(postData, schedule) {
    try {
      const {
        frequency, // 'daily', 'weekly', 'monthly'
        interval = 1, // Every N frequency units
        daysOfWeek = [], // For weekly: [1, 3, 5] (Mon, Wed, Fri)
        times = ['09:00'], // Times to post each day
        startDate,
        endDate = null,
        timezone = 'UTC',
      } = schedule;

      const posts = [];
      const start = dayjs(startDate).tz(timezone);
      const end = endDate ? dayjs(endDate).tz(timezone) : start.add(1, 'year');

      let current = start;
      let count = 0;
      const maxPosts = 100; // Safety limit

      while (current.isBefore(end) && count < maxPosts) {
        let shouldPost = false;

        switch (frequency) {
          case 'daily':
            shouldPost = true;
            break;
          case 'weekly':
            shouldPost = daysOfWeek.length === 0 || daysOfWeek.includes(current.day());
            break;
          case 'monthly':
            shouldPost = current.date() === start.date();
            break;
        }

        if (shouldPost) {
          for (const timeStr of times) {
            const [hours, minutes] = timeStr.split(':').map(Number);
            const scheduledTime = current.hour(hours).minute(minutes).second(0);

            if (scheduledTime.isAfter(dayjs())) {
              const post = await Post.create({
                ...postData,
                scheduledAt: scheduledTime.toDate(),
                status: 'scheduled',
                metadata: {
                  ...postData.metadata,
                  recurring: true,
                  scheduleId: schedule.id,
                },
              });

              posts.push(post);
              count++;
            }
          }
        }

        // Move to next interval
        current = current.add(interval, frequency === 'monthly' ? 'month' : 'day');
      }

      logger.info('Recurring posts scheduled', {
        count: posts.length,
        frequency,
        interval,
        timezone,
      });

      return posts;

    } catch (error) {
      logger.error('Failed to schedule recurring posts:', error);
      throw error;
    }
  }

  /**
   * Update scheduled post time
   */
  async reschedulePost(postId, newTime, timezone = 'UTC') {
    try {
      const post = await Post.findById(postId);
      if (!post) {
        throw new Error('Post not found');
      }

      if (post.status !== 'scheduled') {
        throw new Error('Can only reschedule posts with scheduled status');
      }

      const scheduledAt = this.parseScheduledTime(newTime, timezone);
      
      if (scheduledAt.isBefore(dayjs())) {
        throw new Error('Cannot reschedule to past time');
      }

      await post.update({ 
        scheduledAt: scheduledAt.toDate(),
        metadata: {
          ...post.metadata,
          rescheduled: true,
          originalScheduledAt: post.scheduledAt,
        },
      });

      logger.info('Post rescheduled', {
        postId,
        oldTime: post.scheduledAt,
        newTime: scheduledAt.format(),
        timezone,
      });

      return post;

    } catch (error) {
      logger.error('Failed to reschedule post:', error);
      throw error;
    }
  }

  /**
   * Cancel scheduled post
   */
  async cancelScheduledPost(postId) {
    try {
      const post = await Post.findById(postId);
      if (!post) {
        throw new Error('Post not found');
      }

      if (post.status !== 'scheduled') {
        throw new Error('Can only cancel scheduled posts');
      }

      await post.update({ 
        status: 'draft',
        scheduledAt: null,
        metadata: {
          ...post.metadata,
          cancelled: true,
          cancelledAt: new Date().toISOString(),
        },
      });

      logger.info('Scheduled post cancelled', { postId });

      return post;

    } catch (error) {
      logger.error('Failed to cancel scheduled post:', error);
      throw error;
    }
  }

  /**
   * Get scheduled posts for a team
   */
  async getScheduledPosts(teamId, options = {}) {
    try {
      const {
        from = dayjs().format(),
        to = dayjs().add(30, 'days').format(),
        platform = null,
        limit = 100,
        offset = 0,
      } = options;

      let queryText = `
        SELECT * FROM posts 
        WHERE team_id = $1 
          AND status = 'scheduled'
          AND scheduled_at >= $2 
          AND scheduled_at <= $3
      `;
      
      const params = [teamId, from, to];

      if (platform) {
        queryText += ' AND $4 = ANY(platforms)';
        params.push(platform);
      }

      queryText += ' ORDER BY scheduled_at ASC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
      params.push(limit, offset);

      const result = await query(queryText, params);
      return result.rows.map(row => new Post(row));

    } catch (error) {
      logger.error('Failed to get scheduled posts:', error);
      throw error;
    }
  }

  /**
   * Get posting schedule statistics
   */
  async getScheduleStats(teamId, timezone = 'UTC') {
    try {
      const now = dayjs().tz(timezone);
      const startOfWeek = now.startOf('week');
      const endOfWeek = now.endOf('week');

      const result = await query(`
        SELECT 
          DATE_TRUNC('hour', scheduled_at AT TIME ZONE $2) as hour_slot,
          COUNT(*) as post_count,
          ARRAY_AGG(DISTINCT unnest(platforms)) as platforms
        FROM posts 
        WHERE team_id = $1 
          AND status = 'scheduled'
          AND scheduled_at >= $3 
          AND scheduled_at <= $4
        GROUP BY hour_slot
        ORDER BY hour_slot
      `, [teamId, timezone, startOfWeek.toDate(), endOfWeek.toDate()]);

      return {
        timezone,
        period: {
          start: startOfWeek.format(),
          end: endOfWeek.format(),
        },
        hourlyDistribution: result.rows.map(row => ({
          hour: dayjs(row.hour_slot).format('YYYY-MM-DD HH:00'),
          postCount: parseInt(row.post_count),
          platforms: row.platforms,
        })),
      };

    } catch (error) {
      logger.error('Failed to get schedule stats:', error);
      throw error;
    }
  }

  /**
   * Suggest optimal posting times based on historical performance
   */
  async suggestOptimalTimes(teamId, platform, timezone = 'UTC') {
    try {
      // Get historical post performance
      const result = await query(`
        SELECT 
          EXTRACT(hour FROM posted_at AT TIME ZONE $3) as hour,
          EXTRACT(dow FROM posted_at AT TIME ZONE $3) as day_of_week,
          AVG(COALESCE((metadata->>'engagements')::int, 0)) as avg_engagements,
          COUNT(*) as post_count
        FROM posts 
        WHERE team_id = $1 
          AND $2 = ANY(platforms)
          AND status = 'posted'
          AND posted_at > NOW() - INTERVAL '90 days'
        GROUP BY hour, day_of_week
        HAVING COUNT(*) >= 5
        ORDER BY avg_engagements DESC
        LIMIT 20
      `, [teamId, platform, timezone]);

      const suggestions = result.rows.map(row => ({
        hour: parseInt(row.hour),
        dayOfWeek: parseInt(row.day_of_week),
        avgEngagements: parseFloat(row.avg_engagements),
        postCount: parseInt(row.post_count),
        confidence: this.calculateConfidence(parseInt(row.post_count)),
      }));

      return {
        platform,
        timezone,
        suggestions,
        fallback: this.optimalPostingTimes[platform] || this.optimalPostingTimes.twitter,
      };

    } catch (error) {
      logger.error('Failed to suggest optimal times:', error);
      return {
        platform,
        timezone,
        suggestions: [],
        fallback: this.optimalPostingTimes[platform] || this.optimalPostingTimes.twitter,
      };
    }
  }

  /**
   * Parse scheduled time with timezone support
   */
  parseScheduledTime(timeInput, timezone) {
    let parsed;

    if (typeof timeInput === 'string') {
      // Handle various string formats
      if (timeInput.includes('T') || timeInput.includes(' ')) {
        // Full datetime
        parsed = dayjs(timeInput).tz(timezone);
      } else {
        // Time only, assume today
        parsed = dayjs().tz(timezone).format(`YYYY-MM-DD ${timeInput}`);
        parsed = dayjs(parsed).tz(timezone);
      }
    } else {
      // Date object
      parsed = dayjs(timeInput).tz(timezone);
    }

    if (!parsed.isValid()) {
      throw new Error(`Invalid time format: ${timeInput}`);
    }

    return parsed;
  }

  /**
   * Validate timezone
   */
  isValidTimezone(timezone) {
    try {
      dayjs().tz(timezone);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Calculate confidence score for suggestions
   */
  calculateConfidence(postCount) {
    if (postCount >= 20) return 'high';
    if (postCount >= 10) return 'medium';
    return 'low';
  }

  /**
   * Get supported timezones
   */
  getSupportedTimezones() {
    return this.supportedTimezones.map(tz => ({
      value: tz,
      label: tz.replace('_', ' '),
      offset: dayjs().tz(tz).format('Z'),
    }));
  }

  /**
   * Convert time between timezones
   */
  convertTimezone(time, fromTz, toTz) {
    return dayjs(time).tz(fromTz).tz(toTz);
  }

  /**
   * Check if time conflicts with existing scheduled posts
   */
  async checkScheduleConflicts(teamId, scheduledTime, platforms, excludePostId = null) {
    try {
      const buffer = 5; // 5 minute buffer
      const startTime = dayjs(scheduledTime).subtract(buffer, 'minutes');
      const endTime = dayjs(scheduledTime).add(buffer, 'minutes');

      let queryText = `
        SELECT id, scheduled_at, platforms 
        FROM posts 
        WHERE team_id = $1 
          AND status = 'scheduled'
          AND scheduled_at >= $2 
          AND scheduled_at <= $3
          AND platforms && $4
      `;

      const params = [teamId, startTime.toDate(), endTime.toDate(), platforms];

      if (excludePostId) {
        queryText += ' AND id != $5';
        params.push(excludePostId);
      }

      const result = await query(queryText, params);

      return result.rows.map(row => ({
        postId: row.id,
        scheduledAt: row.scheduled_at,
        conflictingPlatforms: row.platforms.filter(p => platforms.includes(p)),
      }));

    } catch (error) {
      logger.error('Failed to check schedule conflicts:', error);
      return [];
    }
  }
}