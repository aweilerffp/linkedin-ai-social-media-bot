import { jest } from '@jest/globals';
import { SchedulerService } from '../../services/scheduler/SchedulerService.js';
import { TestUtils } from '../helpers/testUtils.js';

// Mock dependencies
jest.mock('../../config/database.js', () => ({
  query: jest.fn(),
}));

jest.mock('../../services/queue/QueueService.js', () => ({
  QueueService: jest.fn().mockImplementation(() => ({
    addJob: jest.fn(),
    getJob: jest.fn(),
    removeJob: jest.fn(),
    getJobCounts: jest.fn(),
  })),
}));

jest.mock('../../utils/logger.js', () => ({
  logger: TestUtils.createMockLogger(),
}));

import { query } from '../../config/database.js';
import { QueueService } from '../../services/queue/QueueService.js';
import { logger } from '../../utils/logger.js';

describe('SchedulerService', () => {
  let schedulerService;
  let mockQueueService;

  beforeEach(() => {
    mockQueueService = {
      addJob: jest.fn(),
      getJob: jest.fn(),
      removeJob: jest.fn(),
      getJobCounts: jest.fn(),
    };
    QueueService.mockImplementation(() => mockQueueService);
    
    schedulerService = new SchedulerService();
    jest.clearAllMocks();
  });

  describe('schedulePost', () => {
    const postData = {
      content: 'Test post content',
      platforms: ['linkedin', 'twitter'],
      scheduledAt: new Date(Date.now() + 3600000), // 1 hour from now
      userId: 'test-user-id',
      teamId: 'test-team-id',
    };

    it('should schedule post successfully', async () => {
      const mockPost = TestUtils.createMockPost({
        ...postData,
        status: 'scheduled',
      });

      query.mockResolvedValue(TestUtils.createMockQueryResult([mockPost]));
      mockQueueService.addJob.mockResolvedValue({
        id: 'job-id',
        data: postData,
      });

      const result = await schedulerService.schedulePost(postData);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT'),
        expect.arrayContaining([
          postData.content,
          JSON.stringify(postData.platforms),
          postData.scheduledAt,
          postData.userId,
          postData.teamId,
        ])
      );
      expect(mockQueueService.addJob).toHaveBeenCalledWith(
        'post-job',
        expect.objectContaining({
          postId: mockPost.id,
          content: postData.content,
          platforms: postData.platforms,
        }),
        {
          delay: expect.any(Number),
          removeOnComplete: 10,
          removeOnFail: 5,
          attempts: 3,
          backoff: 'exponential',
        }
      );
      expect(result).toEqual(mockPost);
    });

    it('should handle immediate posting', async () => {
      const immediatePostData = {
        ...postData,
        scheduledAt: new Date(),
      };
      
      const mockPost = TestUtils.createMockPost({
        ...immediatePostData,
        status: 'scheduled',
      });

      query.mockResolvedValue(TestUtils.createMockQueryResult([mockPost]));
      mockQueueService.addJob.mockResolvedValue({
        id: 'job-id',
        data: immediatePostData,
      });

      const result = await schedulerService.schedulePost(immediatePostData);

      expect(mockQueueService.addJob).toHaveBeenCalledWith(
        'post-job',
        expect.any(Object),
        expect.objectContaining({
          delay: expect.any(Number),
        })
      );
      expect(result).toEqual(mockPost);
    });

    it('should validate required fields', async () => {
      const invalidData = { ...postData };
      delete invalidData.content;

      await expect(schedulerService.schedulePost(invalidData))
        .rejects.toThrow('Content is required');
    });

    it('should validate platforms array', async () => {
      const invalidData = { ...postData, platforms: [] };

      await expect(schedulerService.schedulePost(invalidData))
        .rejects.toThrow('At least one platform is required');
    });

    it('should validate schedule time', async () => {
      const invalidData = { 
        ...postData, 
        scheduledAt: new Date(Date.now() - 3600000) // Past time
      };

      await expect(schedulerService.schedulePost(invalidData))
        .rejects.toThrow('Scheduled time must be in the future');
    });
  });

  describe('cancelScheduledPost', () => {
    const postId = 'test-post-id';

    it('should cancel scheduled post successfully', async () => {
      const mockPost = TestUtils.createMockPost({
        id: postId,
        status: 'scheduled',
        queueJobId: 'job-id',
      });

      query
        .mockResolvedValueOnce(TestUtils.createMockQueryResult([mockPost])) // Get post
        .mockResolvedValueOnce(TestUtils.createMockQueryResult([{ ...mockPost, status: 'cancelled' }])); // Update post

      mockQueueService.removeJob.mockResolvedValue(true);

      const result = await schedulerService.cancelScheduledPost(postId);

      expect(mockQueueService.removeJob).toHaveBeenCalledWith('job-id');
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        ['cancelled', postId]
      );
      expect(result.success).toBe(true);
    });

    it('should throw error if post not found', async () => {
      query.mockResolvedValue(TestUtils.createMockQueryResult([]));

      await expect(schedulerService.cancelScheduledPost(postId))
        .rejects.toThrow('Post not found');
    });

    it('should throw error if post not scheduled', async () => {
      const mockPost = TestUtils.createMockPost({
        id: postId,
        status: 'published',
      });

      query.mockResolvedValue(TestUtils.createMockQueryResult([mockPost]));

      await expect(schedulerService.cancelScheduledPost(postId))
        .rejects.toThrow('Post is not scheduled');
    });

    it('should handle queue job removal failure gracefully', async () => {
      const mockPost = TestUtils.createMockPost({
        id: postId,
        status: 'scheduled',
        queueJobId: 'job-id',
      });

      query
        .mockResolvedValueOnce(TestUtils.createMockQueryResult([mockPost]))
        .mockResolvedValueOnce(TestUtils.createMockQueryResult([{ ...mockPost, status: 'cancelled' }]));

      mockQueueService.removeJob.mockRejectedValue(new Error('Job not found'));

      const result = await schedulerService.cancelScheduledPost(postId);

      expect(result.success).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to remove queue job job-id:',
        expect.any(Error)
      );
    });
  });

  describe('reschedulePost', () => {
    const postId = 'test-post-id';
    const newScheduledAt = new Date(Date.now() + 7200000); // 2 hours from now

    it('should reschedule post successfully', async () => {
      const mockPost = TestUtils.createMockPost({
        id: postId,
        status: 'scheduled',
        queueJobId: 'old-job-id',
      });

      query
        .mockResolvedValueOnce(TestUtils.createMockQueryResult([mockPost]))
        .mockResolvedValueOnce(TestUtils.createMockQueryResult([{ ...mockPost, scheduledAt: newScheduledAt }]));

      mockQueueService.removeJob.mockResolvedValue(true);
      mockQueueService.addJob.mockResolvedValue({
        id: 'new-job-id',
        data: mockPost,
      });

      const result = await schedulerService.reschedulePost(postId, newScheduledAt);

      expect(mockQueueService.removeJob).toHaveBeenCalledWith('old-job-id');
      expect(mockQueueService.addJob).toHaveBeenCalledWith(
        'post-job',
        expect.objectContaining({
          postId,
        }),
        expect.objectContaining({
          delay: expect.any(Number),
        })
      );
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        [newScheduledAt, 'new-job-id', postId]
      );
      expect(result.success).toBe(true);
    });

    it('should validate new schedule time', async () => {
      const pastTime = new Date(Date.now() - 3600000);

      await expect(schedulerService.reschedulePost(postId, pastTime))
        .rejects.toThrow('New scheduled time must be in the future');
    });
  });

  describe('getScheduledPosts', () => {
    const userId = 'test-user-id';

    it('should get scheduled posts for user', async () => {
      const mockPosts = [
        TestUtils.createMockPost({ status: 'scheduled' }),
        TestUtils.createMockPost({ status: 'scheduled' }),
      ];

      query.mockResolvedValue(TestUtils.createMockQueryResult(mockPosts));

      const result = await schedulerService.getScheduledPosts(userId);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [userId, 'scheduled']
      );
      expect(result).toEqual(mockPosts);
    });

    it('should get scheduled posts for team', async () => {
      const teamId = 'test-team-id';
      const mockPosts = [TestUtils.createMockPost({ status: 'scheduled' })];

      query.mockResolvedValue(TestUtils.createMockQueryResult(mockPosts));

      const result = await schedulerService.getScheduledPosts(userId, { teamId });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [teamId, 'scheduled']
      );
      expect(result).toEqual(mockPosts);
    });

    it('should apply date range filter', async () => {
      const startDate = new Date();
      const endDate = new Date(Date.now() + 86400000); // Tomorrow
      const mockPosts = [TestUtils.createMockPost({ status: 'scheduled' })];

      query.mockResolvedValue(TestUtils.createMockQueryResult(mockPosts));

      const result = await schedulerService.getScheduledPosts(userId, {
        startDate,
        endDate,
      });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('scheduled_at BETWEEN'),
        [userId, 'scheduled', startDate, endDate]
      );
      expect(result).toEqual(mockPosts);
    });
  });

  describe('getPostStatus', () => {
    const postId = 'test-post-id';

    it('should get post status with queue info', async () => {
      const mockPost = TestUtils.createMockPost({
        id: postId,
        status: 'scheduled',
        queueJobId: 'job-id',
      });
      const mockJob = {
        id: 'job-id',
        opts: { delay: 3600000 },
        processedOn: null,
        failedReason: null,
      };

      query.mockResolvedValue(TestUtils.createMockQueryResult([mockPost]));
      mockQueueService.getJob.mockResolvedValue(mockJob);

      const result = await schedulerService.getPostStatus(postId);

      expect(result).toEqual({
        ...mockPost,
        queueStatus: {
          jobId: 'job-id',
          delay: 3600000,
          processed: false,
          failed: false,
          failedReason: null,
        },
      });
    });

    it('should handle missing queue job gracefully', async () => {
      const mockPost = TestUtils.createMockPost({
        id: postId,
        status: 'published',
        queueJobId: null,
      });

      query.mockResolvedValue(TestUtils.createMockQueryResult([mockPost]));

      const result = await schedulerService.getPostStatus(postId);

      expect(result).toEqual({
        ...mockPost,
        queueStatus: null,
      });
    });
  });

  describe('getQueueStats', () => {
    it('should get queue statistics', async () => {
      const mockStats = {
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        delayed: 10,
      };

      mockQueueService.getJobCounts.mockResolvedValue(mockStats);

      const result = await schedulerService.getQueueStats();

      expect(mockQueueService.getJobCounts).toHaveBeenCalled();
      expect(result).toEqual(mockStats);
    });

    it('should handle queue service errors', async () => {
      mockQueueService.getJobCounts.mockRejectedValue(new Error('Redis error'));

      const result = await schedulerService.getQueueStats();

      expect(result).toEqual({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        error: 'Failed to get queue stats',
      });
    });
  });

  describe('validatePostData', () => {
    it('should validate valid post data', () => {
      const validData = {
        content: 'Test content',
        platforms: ['linkedin'],
        scheduledAt: new Date(Date.now() + 3600000),
        userId: 'user-id',
        teamId: 'team-id',
      };

      expect(() => schedulerService.validatePostData(validData)).not.toThrow();
    });

    it('should throw for missing content', () => {
      const invalidData = {
        platforms: ['linkedin'],
        scheduledAt: new Date(Date.now() + 3600000),
        userId: 'user-id',
      };

      expect(() => schedulerService.validatePostData(invalidData))
        .toThrow('Content is required');
    });

    it('should throw for empty platforms', () => {
      const invalidData = {
        content: 'Test',
        platforms: [],
        scheduledAt: new Date(Date.now() + 3600000),
        userId: 'user-id',
      };

      expect(() => schedulerService.validatePostData(invalidData))
        .toThrow('At least one platform is required');
    });

    it('should throw for past schedule time', () => {
      const invalidData = {
        content: 'Test',
        platforms: ['linkedin'],
        scheduledAt: new Date(Date.now() - 3600000),
        userId: 'user-id',
      };

      expect(() => schedulerService.validatePostData(invalidData))
        .toThrow('Scheduled time must be in the future');
    });

    it('should throw for missing userId', () => {
      const invalidData = {
        content: 'Test',
        platforms: ['linkedin'],
        scheduledAt: new Date(Date.now() + 3600000),
      };

      expect(() => schedulerService.validatePostData(invalidData))
        .toThrow('User ID is required');
    });
  });

  describe('calculateDelay', () => {
    it('should calculate correct delay for future time', () => {
      const futureTime = new Date(Date.now() + 3600000); // 1 hour from now
      const delay = schedulerService.calculateDelay(futureTime);
      
      expect(delay).toBeGreaterThan(3590000); // Allow for small timing differences
      expect(delay).toBeLessThanOrEqual(3600000);
    });

    it('should return 0 for past time', () => {
      const pastTime = new Date(Date.now() - 3600000);
      const delay = schedulerService.calculateDelay(pastTime);
      
      expect(delay).toBe(0);
    });

    it('should return small delay for immediate time', () => {
      const now = new Date();
      const delay = schedulerService.calculateDelay(now);
      
      expect(delay).toBeLessThanOrEqual(1000);
    });
  });
});