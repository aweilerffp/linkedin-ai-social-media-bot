import { jest } from '@jest/globals';
import { PostProcessor } from '../../services/queue/PostProcessor.js';
import { TestUtils } from '../helpers/testUtils.js';

// Mock dependencies
jest.mock('../../config/database.js', () => ({
  query: jest.fn(),
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

jest.mock('../../utils/logger.js', () => ({
  logger: TestUtils.createMockLogger(),
}));

jest.mock('../../config/redis.js', () => ({
  getRedisClient: jest.fn(() => TestUtils.createMockRedisClient()),
}));

import { query } from '../../config/database.js';
import { PlatformFactory } from '../../services/platforms/PlatformFactory.js';
import { WebhookService } from '../../services/webhook/WebhookService.js';
import { logger } from '../../utils/logger.js';

describe('PostProcessor', () => {
  let postProcessor;
  let mockWebhookService;

  beforeEach(() => {
    mockWebhookService = {
      queueWebhook: jest.fn(),
    };
    WebhookService.mockImplementation(() => mockWebhookService);
    
    postProcessor = new PostProcessor();
    jest.clearAllMocks();
  });

  describe('processJob', () => {
    const mockJob = {
      id: 'job-123',
      data: {
        postId: 'post-123',
        content: 'Test post content',
        platforms: ['linkedin', 'twitter'],
        userId: 'user-123',
        teamId: 'team-123',
        scheduledAt: new Date(),
      },
      progress: jest.fn(),
    };

    it('should process job successfully', async () => {
      const mockPost = TestUtils.createMockPost({
        id: mockJob.data.postId,
        status: 'scheduled',
      });

      const mockLinkedInPlatform = {
        publishPost: jest.fn().mockResolvedValue({
          success: true,
          platformPostId: 'linkedin-123',
          url: 'https://linkedin.com/post/123',
        }),
      };

      const mockTwitterPlatform = {
        publishPost: jest.fn().mockResolvedValue({
          success: true,
          platformPostId: 'twitter-123',
          url: 'https://twitter.com/post/123',
        }),
      };

      query
        .mockResolvedValueOnce(TestUtils.createMockQueryResult([mockPost])) // Get post
        .mockResolvedValueOnce(TestUtils.createMockQueryResult([mockPost])) // Update status
        .mockResolvedValue(TestUtils.createMockQueryResult([])); // Insert platform results

      PlatformFactory.create
        .mockReturnValueOnce(mockLinkedInPlatform)
        .mockReturnValueOnce(mockTwitterPlatform);

      const result = await postProcessor.processJob(mockJob);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [mockJob.data.postId]
      );
      expect(mockLinkedInPlatform.publishPost).toHaveBeenCalledWith({
        content: mockJob.data.content,
        userId: mockJob.data.userId,
        teamId: mockJob.data.teamId,
        scheduledAt: mockJob.data.scheduledAt,
      });
      expect(mockTwitterPlatform.publishPost).toHaveBeenCalledWith({
        content: mockJob.data.content,
        userId: mockJob.data.userId,
        teamId: mockJob.data.teamId,
        scheduledAt: mockJob.data.scheduledAt,
      });

      expect(mockJob.progress).toHaveBeenCalledWith(50);
      expect(mockJob.progress).toHaveBeenCalledWith(100);

      expect(result).toEqual({
        success: true,
        postId: mockJob.data.postId,
        results: expect.arrayContaining([
          expect.objectContaining({
            platform: 'linkedin',
            success: true,
            platformPostId: 'linkedin-123',
          }),
          expect.objectContaining({
            platform: 'twitter',
            success: true,
            platformPostId: 'twitter-123',
          }),
        ]),
      });
    });

    it('should handle partial failures', async () => {
      const mockPost = TestUtils.createMockPost({
        id: mockJob.data.postId,
        status: 'scheduled',
      });

      const mockLinkedInPlatform = {
        publishPost: jest.fn().mockResolvedValue({
          success: true,
          platformPostId: 'linkedin-123',
        }),
      };

      const mockTwitterPlatform = {
        publishPost: jest.fn().mockRejectedValue(new Error('Twitter API error')),
      };

      query
        .mockResolvedValueOnce(TestUtils.createMockQueryResult([mockPost]))
        .mockResolvedValue(TestUtils.createMockQueryResult([]));

      PlatformFactory.create
        .mockReturnValueOnce(mockLinkedInPlatform)
        .mockReturnValueOnce(mockTwitterPlatform);

      const result = await postProcessor.processJob(mockJob);

      expect(result.success).toBe(false);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(false);
      expect(result.results[1].error).toBe('Twitter API error');
    });

    it('should handle post not found', async () => {
      query.mockResolvedValue(TestUtils.createMockQueryResult([]));

      await expect(postProcessor.processJob(mockJob))
        .rejects.toThrow('Post not found: post-123');
    });

    it('should handle post not in scheduled status', async () => {
      const mockPost = TestUtils.createMockPost({
        id: mockJob.data.postId,
        status: 'published',
      });

      query.mockResolvedValue(TestUtils.createMockQueryResult([mockPost]));

      await expect(postProcessor.processJob(mockJob))
        .rejects.toThrow('Post post-123 is not in scheduled status');
    });

    it('should send webhook notifications on completion', async () => {
      const mockPost = TestUtils.createMockPost({
        id: mockJob.data.postId,
        status: 'scheduled',
      });

      const mockPlatform = {
        publishPost: jest.fn().mockResolvedValue({
          success: true,
          platformPostId: 'platform-123',
        }),
      };

      query
        .mockResolvedValueOnce(TestUtils.createMockQueryResult([mockPost]))
        .mockResolvedValue(TestUtils.createMockQueryResult([]));

      PlatformFactory.create.mockReturnValue(mockPlatform);

      await postProcessor.processJob({ ...mockJob, data: { ...mockJob.data, platforms: ['linkedin'] } });

      expect(mockWebhookService.queueWebhook).toHaveBeenCalledWith(
        expect.any(Array),
        'post.published',
        expect.objectContaining({
          postId: mockJob.data.postId,
          success: true,
        }),
        {
          userId: mockJob.data.userId,
          teamId: mockJob.data.teamId,
        }
      );
    });
  });

  describe('onJobCompleted', () => {
    const mockJob = {
      id: 'job-123',
      data: {
        postId: 'post-123',
        userId: 'user-123',
        teamId: 'team-123',
      },
    };
    const mockResult = {
      success: true,
      results: [{ platform: 'linkedin', success: true }],
    };

    it('should handle job completion', async () => {
      await postProcessor.onJobCompleted(mockJob, mockResult);

      expect(logger.info).toHaveBeenCalledWith(
        'Post processing completed successfully',
        {
          jobId: mockJob.id,
          postId: mockJob.data.postId,
          success: true,
        }
      );
    });
  });

  describe('onJobFailed', () => {
    const mockJob = {
      id: 'job-123',
      data: {
        postId: 'post-123',
        userId: 'user-123',
      },
    };
    const mockError = new Error('Processing failed');

    it('should handle job failure', async () => {
      query.mockResolvedValue(TestUtils.createMockQueryResult([]));

      await postProcessor.onJobFailed(mockJob, mockError);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        ['failed', mockJob.data.postId]
      );

      expect(mockWebhookService.queueWebhook).toHaveBeenCalledWith(
        expect.any(Array),
        'post.failed',
        expect.objectContaining({
          postId: mockJob.data.postId,
          error: 'Processing failed',
        }),
        expect.any(Object)
      );

      expect(logger.error).toHaveBeenCalledWith(
        'Post processing failed',
        {
          jobId: mockJob.id,
          postId: mockJob.data.postId,
          error: mockError.message,
        }
      );
    });

    it('should handle database update failure gracefully', async () => {
      query.mockRejectedValue(new Error('Database error'));

      await postProcessor.onJobFailed(mockJob, mockError);

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to update post status to failed:',
        expect.any(Error)
      );
    });
  });

  describe('publishToAllPlatforms', () => {
    const postData = {
      content: 'Test content',
      userId: 'user-123',
      teamId: 'team-123',
    };
    const platforms = ['linkedin', 'twitter'];
    const mockJob = { progress: jest.fn() };

    it('should publish to all platforms successfully', async () => {
      const mockLinkedIn = {
        publishPost: jest.fn().mockResolvedValue({
          success: true,
          platformPostId: 'linkedin-123',
        }),
      };
      const mockTwitter = {
        publishPost: jest.fn().mockResolvedValue({
          success: true,
          platformPostId: 'twitter-123',
        }),
      };

      PlatformFactory.create
        .mockReturnValueOnce(mockLinkedIn)
        .mockReturnValueOnce(mockTwitter);

      const results = await postProcessor.publishToAllPlatforms(
        postData,
        platforms,
        mockJob
      );

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        platform: 'linkedin',
        success: true,
        platformPostId: 'linkedin-123',
      });
      expect(results[1]).toEqual({
        platform: 'twitter',
        success: true,
        platformPostId: 'twitter-123',
      });
      expect(mockJob.progress).toHaveBeenCalledWith(50);
      expect(mockJob.progress).toHaveBeenCalledWith(100);
    });

    it('should handle platform errors gracefully', async () => {
      const mockLinkedIn = {
        publishPost: jest.fn().mockRejectedValue(new Error('LinkedIn error')),
      };
      const mockTwitter = {
        publishPost: jest.fn().mockResolvedValue({
          success: true,
          platformPostId: 'twitter-123',
        }),
      };

      PlatformFactory.create
        .mockReturnValueOnce(mockLinkedIn)
        .mockReturnValueOnce(mockTwitter);

      const results = await postProcessor.publishToAllPlatforms(
        postData,
        platforms,
        mockJob
      );

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        platform: 'linkedin',
        success: false,
        error: 'LinkedIn error',
      });
      expect(results[1]).toEqual({
        platform: 'twitter',
        success: true,
        platformPostId: 'twitter-123',
      });
    });

    it('should handle unsupported platforms', async () => {
      PlatformFactory.create.mockReturnValue(null);

      const results = await postProcessor.publishToAllPlatforms(
        postData,
        ['unsupported'],
        mockJob
      );

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        platform: 'unsupported',
        success: false,
        error: 'Platform not supported',
      });
    });
  });

  describe('updatePostStatus', () => {
    const postId = 'post-123';

    it('should update post status to published', async () => {
      const results = [
        { platform: 'linkedin', success: true },
        { platform: 'twitter', success: true },
      ];

      query.mockResolvedValue(TestUtils.createMockQueryResult([]));

      await postProcessor.updatePostStatus(postId, results);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        ['published', postId]
      );
    });

    it('should update post status to partially_failed', async () => {
      const results = [
        { platform: 'linkedin', success: true },
        { platform: 'twitter', success: false },
      ];

      query.mockResolvedValue(TestUtils.createMockQueryResult([]));

      await postProcessor.updatePostStatus(postId, results);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        ['partially_failed', postId]
      );
    });

    it('should update post status to failed when all platforms fail', async () => {
      const results = [
        { platform: 'linkedin', success: false },
        { platform: 'twitter', success: false },
      ];

      query.mockResolvedValue(TestUtils.createMockQueryResult([]));

      await postProcessor.updatePostStatus(postId, results);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        ['failed', postId]
      );
    });
  });

  describe('storePlatformResults', () => {
    const postId = 'post-123';
    const results = [
      {
        platform: 'linkedin',
        success: true,
        platformPostId: 'linkedin-123',
        url: 'https://linkedin.com/post/123',
      },
      {
        platform: 'twitter',
        success: false,
        error: 'API error',
      },
    ];

    it('should store platform results', async () => {
      query.mockResolvedValue(TestUtils.createMockQueryResult([]));

      await postProcessor.storePlatformResults(postId, results);

      expect(query).toHaveBeenCalledTimes(2);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT'),
        [
          postId,
          'linkedin',
          true,
          'linkedin-123',
          'https://linkedin.com/post/123',
          null,
          expect.any(Date),
        ]
      );
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT'),
        [
          postId,
          'twitter',
          false,
          null,
          null,
          'API error',
          expect.any(Date),
        ]
      );
    });

    it('should handle storage errors gracefully', async () => {
      query.mockRejectedValue(new Error('Database error'));

      await postProcessor.storePlatformResults(postId, results);

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to store platform result:',
        expect.any(Error)
      );
    });
  });

  describe('determineOverallStatus', () => {
    it('should return published when all platforms succeed', () => {
      const results = [
        { platform: 'linkedin', success: true },
        { platform: 'twitter', success: true },
      ];

      const status = postProcessor.determineOverallStatus(results);

      expect(status).toBe('published');
    });

    it('should return partially_failed when some platforms fail', () => {
      const results = [
        { platform: 'linkedin', success: true },
        { platform: 'twitter', success: false },
      ];

      const status = postProcessor.determineOverallStatus(results);

      expect(status).toBe('partially_failed');
    });

    it('should return failed when all platforms fail', () => {
      const results = [
        { platform: 'linkedin', success: false },
        { platform: 'twitter', success: false },
      ];

      const status = postProcessor.determineOverallStatus(results);

      expect(status).toBe('failed');
    });

    it('should return failed for empty results', () => {
      const status = postProcessor.determineOverallStatus([]);

      expect(status).toBe('failed');
    });
  });
});