import { jest } from '@jest/globals';
import { TestUtils } from '../helpers/testUtils.js';

// Mock dependencies
jest.mock('../../config/database.js', () => ({
  query: jest.fn(),
}));

jest.mock('../../config/redis.js', () => ({
  getRedisClient: jest.fn(() => TestUtils.createMockRedisClient()),
}));

jest.mock('../../utils/logger.js', () => ({
  logger: TestUtils.createMockLogger(),
}));

jest.mock('../../services/platforms/PlatformFactory.js', () => ({
  PlatformFactory: {
    create: jest.fn(),
  },
}));

jest.mock('../../services/webhook/WebhookService.js', () => ({
  WebhookService: jest.fn().mockImplementation(() => ({
    queueWebhook: jest.fn(),
  })),
}));

import { QueueService } from '../../services/queue/QueueService.js';
import { PostProcessor } from '../../services/queue/PostProcessor.js';
import { SchedulerService } from '../../services/scheduler/SchedulerService.js';
import { query } from '../../config/database.js';
import { PlatformFactory } from '../../services/platforms/PlatformFactory.js';
import { logger } from '../../utils/logger.js';

describe('Queue Integration Tests', () => {
  let queueService;
  let postProcessor;
  let schedulerService;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    queueService = new QueueService('test-post-queue');
    postProcessor = new PostProcessor();
    schedulerService = new SchedulerService();
  });

  afterEach(async () => {
    if (queueService) {
      await queueService.close();
    }
  });

  describe('Post Processing Workflow', () => {
    it('should process a scheduled post end-to-end', async () => {
      const mockPost = TestUtils.createMockPost({
        content: 'Test post for integration',
        platforms: ['linkedin'],
        status: 'scheduled',
      });

      const mockJob = {
        id: 'test-job-123',
        data: {
          postId: mockPost.id,
          content: mockPost.content,
          platforms: mockPost.platforms,
          userId: mockPost.userId,
          teamId: mockPost.teamId,
          scheduledAt: mockPost.scheduledAt,
        },
        progress: jest.fn(),
      };

      const mockPlatform = {
        publishPost: jest.fn().mockResolvedValue({
          success: true,
          platformPostId: 'linkedin-123',
          url: 'https://linkedin.com/post/123',
        }),
      };

      // Setup mocks
      query
        .mockResolvedValueOnce(TestUtils.createMockQueryResult([mockPost])) // Get post
        .mockResolvedValueOnce(TestUtils.createMockQueryResult([{ ...mockPost, status: 'published' }])) // Update status
        .mockResolvedValue(TestUtils.createMockQueryResult([])); // Store platform results

      PlatformFactory.create.mockReturnValue(mockPlatform);

      // Process the job
      const result = await postProcessor.processJob(mockJob);

      // Verify the results
      expect(result.success).toBe(true);
      expect(result.postId).toBe(mockPost.id);
      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toEqual({
        platform: 'linkedin',
        success: true,
        platformPostId: 'linkedin-123',
        url: 'https://linkedin.com/post/123',
      });

      // Verify database calls
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [mockPost.id]
      );
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        ['published', mockPost.id]
      );

      // Verify platform was called
      expect(mockPlatform.publishPost).toHaveBeenCalledWith({
        content: mockPost.content,
        userId: mockPost.userId,
        teamId: mockPost.teamId,
        scheduledAt: mockPost.scheduledAt,
      });
    });

    it('should handle multi-platform posting with mixed results', async () => {
      const mockPost = TestUtils.createMockPost({
        content: 'Multi-platform test post',
        platforms: ['linkedin', 'twitter'],
        status: 'scheduled',
      });

      const mockJob = {
        id: 'test-job-multi',
        data: {
          postId: mockPost.id,
          content: mockPost.content,
          platforms: mockPost.platforms,
          userId: mockPost.userId,
          teamId: mockPost.teamId,
        },
        progress: jest.fn(),
      };

      const mockLinkedInPlatform = {
        publishPost: jest.fn().mockResolvedValue({
          success: true,
          platformPostId: 'linkedin-456',
          url: 'https://linkedin.com/post/456',
        }),
      };

      const mockTwitterPlatform = {
        publishPost: jest.fn().mockRejectedValue(new Error('Twitter API rate limit')),
      };

      // Setup mocks
      query
        .mockResolvedValueOnce(TestUtils.createMockQueryResult([mockPost]))
        .mockResolvedValue(TestUtils.createMockQueryResult([]));

      PlatformFactory.create
        .mockReturnValueOnce(mockLinkedInPlatform)
        .mockReturnValueOnce(mockTwitterPlatform);

      // Process the job
      const result = await postProcessor.processJob(mockJob);

      // Verify partial success
      expect(result.success).toBe(false); // Overall failed due to Twitter
      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(true);  // LinkedIn succeeded
      expect(result.results[1].success).toBe(false); // Twitter failed
      expect(result.results[1].error).toBe('Twitter API rate limit');

      // Verify both platforms were attempted
      expect(mockLinkedInPlatform.publishPost).toHaveBeenCalled();
      expect(mockTwitterPlatform.publishPost).toHaveBeenCalled();
    });

    it('should handle job failure and update post status', async () => {
      const mockPost = TestUtils.createMockPost({ status: 'scheduled' });
      const mockJob = {
        id: 'failing-job',
        data: { postId: mockPost.id, userId: mockPost.userId },
      };
      const mockError = new Error('Post not found');

      // Setup mock to simulate post not found
      query.mockResolvedValue(TestUtils.createMockQueryResult([]));

      // Process job failure
      await postProcessor.onJobFailed(mockJob, mockError);

      // Verify post status updated to failed
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        ['failed', mockPost.id]
      );

      expect(logger.error).toHaveBeenCalledWith(
        'Post processing failed',
        expect.objectContaining({
          jobId: mockJob.id,
          postId: mockPost.id,
          error: mockError.message,
        })
      );
    });
  });

  describe('Scheduling Integration', () => {
    it('should schedule a post and add it to queue', async () => {
      const postData = {
        content: 'Scheduled post test',
        platforms: ['linkedin'],
        scheduledAt: new Date(Date.now() + 3600000), // 1 hour from now
        userId: 'user-123',
        teamId: 'team-123',
      };

      const mockPost = TestUtils.createMockPost({
        ...postData,
        status: 'scheduled',
      });

      const mockQueueJob = {
        id: 'queue-job-123',
        data: {
          postId: mockPost.id,
          content: postData.content,
          platforms: postData.platforms,
        },
      };

      // Setup mocks
      query.mockResolvedValue(TestUtils.createMockQueryResult([mockPost]));
      
      // Mock the queue service add job method
      jest.spyOn(queueService, 'addJob').mockResolvedValue(mockQueueJob);

      // Schedule the post
      const result = await schedulerService.schedulePost(postData);

      // Verify post was created and queued
      expect(result.id).toBe(mockPost.id);
      expect(result.status).toBe('scheduled');

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
    });

    it('should cancel scheduled post and remove from queue', async () => {
      const postId = 'scheduled-post-123';
      const mockPost = TestUtils.createMockPost({
        id: postId,
        status: 'scheduled',
        queueJobId: 'queue-job-456',
      });

      // Setup mocks
      query
        .mockResolvedValueOnce(TestUtils.createMockQueryResult([mockPost])) // Get post
        .mockResolvedValueOnce(TestUtils.createMockQueryResult([{ ...mockPost, status: 'cancelled' }])); // Update post

      jest.spyOn(queueService, 'removeJob').mockResolvedValue(true);

      // Cancel the post
      const result = await schedulerService.cancelScheduledPost(postId);

      // Verify cancellation
      expect(result.success).toBe(true);
      
      expect(queueService.removeJob).toHaveBeenCalledWith('queue-job-456');
      
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        ['cancelled', postId]
      );
    });

    it('should reschedule post with new timing', async () => {
      const postId = 'reschedule-post-123';
      const newScheduledAt = new Date(Date.now() + 7200000); // 2 hours from now
      
      const mockPost = TestUtils.createMockPost({
        id: postId,
        status: 'scheduled',
        queueJobId: 'old-job-789',
      });

      const mockNewJob = {
        id: 'new-job-987',
        data: { postId },
      };

      // Setup mocks
      query
        .mockResolvedValueOnce(TestUtils.createMockQueryResult([mockPost])) // Get post
        .mockResolvedValueOnce(TestUtils.createMockQueryResult([{ ...mockPost, scheduledAt: newScheduledAt }])); // Update post

      jest.spyOn(queueService, 'removeJob').mockResolvedValue(true);
      jest.spyOn(queueService, 'addJob').mockResolvedValue(mockNewJob);

      // Reschedule the post
      const result = await schedulerService.reschedulePost(postId, newScheduledAt);

      // Verify rescheduling
      expect(result.success).toBe(true);
      
      expect(queueService.removeJob).toHaveBeenCalledWith('old-job-789');
      expect(queueService.addJob).toHaveBeenCalled();
      
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        [newScheduledAt, 'new-job-987', postId]
      );
    });
  });

  describe('Queue Health and Monitoring', () => {
    it('should get accurate queue statistics', async () => {
      const mockCounts = {
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        delayed: 8,
      };

      jest.spyOn(queueService, 'getJobCounts').mockResolvedValue(mockCounts);

      const stats = await schedulerService.getQueueStats();

      expect(stats).toEqual(mockCounts);
      expect(queueService.getJobCounts).toHaveBeenCalled();
    });

    it('should handle queue errors gracefully', async () => {
      jest.spyOn(queueService, 'getJobCounts').mockRejectedValue(new Error('Redis connection lost'));

      const stats = await schedulerService.getQueueStats();

      expect(stats).toEqual({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        error: 'Failed to get queue stats',
      });
    });

    it('should retry failed jobs', async () => {
      const jobId = 'failed-job-retry';
      const mockJob = {
        id: jobId,
        retry: jest.fn().mockResolvedValue(),
        opts: { attempts: 3 },
        attemptsMade: 1,
      };

      jest.spyOn(queueService, 'getJob').mockResolvedValue(mockJob);

      const result = await queueService.retryJob(jobId);

      expect(result).toBe(true);
      expect(mockJob.retry).toHaveBeenCalled();
    });

    it('should not retry jobs that exceeded max attempts', async () => {
      const jobId = 'exhausted-job';
      const mockJob = {
        id: jobId,
        retry: jest.fn(),
        opts: { attempts: 3 },
        attemptsMade: 3, // Already at max
      };

      jest.spyOn(queueService, 'getJob').mockResolvedValue(mockJob);

      const result = await queueService.retryJob(jobId);

      expect(result).toBe(false);
      expect(mockJob.retry).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        `Job ${jobId} has exceeded maximum retry attempts`
      );
    });
  });

  describe('Queue Cleanup', () => {
    it('should clean completed jobs', async () => {
      const grace = 24 * 60 * 60 * 1000; // 24 hours
      jest.spyOn(queueService, 'clean').mockResolvedValue(15);

      const cleanedCount = await queueService.clean('completed', grace);

      expect(cleanedCount).toBe(15);
      expect(queueService.clean).toHaveBeenCalledWith('completed', grace);
    });

    it('should clean failed jobs with default grace period', async () => {
      jest.spyOn(queueService, 'clean').mockResolvedValue(5);

      const cleanedCount = await queueService.clean('failed');

      expect(cleanedCount).toBe(5);
      expect(queueService.clean).toHaveBeenCalledWith('failed', 5000);
    });
  });

  describe('Error Recovery', () => {
    it('should handle Redis connection failures during job processing', async () => {
      const mockPost = TestUtils.createMockPost({ status: 'scheduled' });
      const mockJob = {
        id: 'redis-fail-job',
        data: {
          postId: mockPost.id,
          content: mockPost.content,
          platforms: ['linkedin'],
        },
        progress: jest.fn(),
      };

      // Setup database success but Redis failure
      query.mockResolvedValue(TestUtils.createMockQueryResult([mockPost]));
      
      const mockPlatform = {
        publishPost: jest.fn().mockResolvedValue({
          success: true,
          platformPostId: 'platform-123',
        }),
      };
      
      PlatformFactory.create.mockReturnValue(mockPlatform);

      // Simulate Redis failure during platform result storage
      query
        .mockResolvedValueOnce(TestUtils.createMockQueryResult([mockPost])) // Get post works
        .mockResolvedValueOnce(TestUtils.createMockQueryResult([])) // Update status works
        .mockRejectedValue(new Error('Redis connection lost')); // Storage fails

      // Process should still succeed for the platform publishing
      const result = await postProcessor.processJob(mockJob);

      expect(result.success).toBe(true);
      expect(mockPlatform.publishPost).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to store platform result:',
        expect.any(Error)
      );
    });

    it('should handle platform service failures gracefully', async () => {
      const mockPost = TestUtils.createMockPost({ status: 'scheduled' });
      const mockJob = {
        id: 'platform-fail-job',
        data: {
          postId: mockPost.id,
          content: mockPost.content,
          platforms: ['unsupported-platform'],
        },
        progress: jest.fn(),
      };

      query.mockResolvedValue(TestUtils.createMockQueryResult([mockPost]));
      PlatformFactory.create.mockReturnValue(null); // No platform adapter

      const result = await postProcessor.processJob(mockJob);

      expect(result.success).toBe(false);
      expect(result.results[0]).toEqual({
        platform: 'unsupported-platform',
        success: false,
        error: 'Platform not supported',
      });
    });
  });
});