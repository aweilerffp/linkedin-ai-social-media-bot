import { jest } from '@jest/globals';
import { QueueService } from '../../services/queue/QueueService.js';
import { TestUtils } from '../helpers/testUtils.js';

// Mock dependencies
jest.mock('bull', () => {
  const mockQueue = {
    add: jest.fn(),
    process: jest.fn(),
    on: jest.fn(),
    getJob: jest.fn(),
    removeJobs: jest.fn(),
    getJobCounts: jest.fn(),
    clean: jest.fn(),
    close: jest.fn(),
  };
  
  return jest.fn(() => mockQueue);
});

jest.mock('../../config/redis.js', () => ({
  getRedisClient: jest.fn(() => TestUtils.createMockRedisClient()),
}));

jest.mock('../../utils/logger.js', () => ({
  logger: TestUtils.createMockLogger(),
}));

import Bull from 'bull';
import { getRedisClient } from '../../config/redis.js';
import { logger } from '../../utils/logger.js';

describe('QueueService', () => {
  let queueService;
  let mockQueue;
  let mockRedisClient;

  beforeEach(() => {
    mockQueue = {
      add: jest.fn(),
      process: jest.fn(),
      on: jest.fn(),
      getJob: jest.fn(),
      removeJobs: jest.fn(),
      getJobCounts: jest.fn(),
      clean: jest.fn(),
      close: jest.fn(),
    };
    Bull.mockReturnValue(mockQueue);
    
    mockRedisClient = TestUtils.createMockRedisClient();
    getRedisClient.mockReturnValue(mockRedisClient);
    
    queueService = new QueueService('test-queue');
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create queue with default options', () => {
      new QueueService('test-queue');
      
      expect(Bull).toHaveBeenCalledWith('test-queue', {
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT) || 6379,
          password: process.env.REDIS_PASSWORD || undefined,
          db: parseInt(process.env.REDIS_DB) || 0,
        },
        defaultJobOptions: {
          removeOnComplete: 10,
          removeOnFail: 5,
          attempts: 3,
          backoff: 'exponential',
        },
      });
    });

    it('should create queue with custom options', () => {
      const customOptions = {
        attempts: 5,
        removeOnComplete: 20,
      };
      
      new QueueService('test-queue', customOptions);
      
      expect(Bull).toHaveBeenCalledWith('test-queue', expect.objectContaining({
        defaultJobOptions: expect.objectContaining(customOptions),
      }));
    });

    it('should set up error handlers', () => {
      new QueueService('test-queue');
      
      expect(mockQueue.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('failed', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('completed', expect.any(Function));
    });
  });

  describe('addJob', () => {
    const jobName = 'test-job';
    const jobData = { id: 'test', content: 'test content' };
    const jobOptions = { delay: 1000, priority: 5 };

    it('should add job successfully', async () => {
      const mockJob = { id: 'job-123', data: jobData };
      mockQueue.add.mockResolvedValue(mockJob);

      const result = await queueService.addJob(jobName, jobData, jobOptions);

      expect(mockQueue.add).toHaveBeenCalledWith(jobName, jobData, jobOptions);
      expect(result).toBe(mockJob);
    });

    it('should handle job addition errors', async () => {
      const error = new Error('Queue error');
      mockQueue.add.mockRejectedValue(error);

      await expect(queueService.addJob(jobName, jobData))
        .rejects.toThrow('Queue error');
      
      expect(logger.error).toHaveBeenCalledWith('Failed to add job test-job:', error);
    });

    it('should add job with default options when none provided', async () => {
      const mockJob = { id: 'job-123', data: jobData };
      mockQueue.add.mockResolvedValue(mockJob);

      await queueService.addJob(jobName, jobData);

      expect(mockQueue.add).toHaveBeenCalledWith(jobName, jobData, {});
    });
  });

  describe('process', () => {
    const processorFunction = jest.fn();

    it('should set up job processor', () => {
      queueService.process('test-job', processorFunction);

      expect(mockQueue.process).toHaveBeenCalledWith('test-job', processorFunction);
    });

    it('should set up processor with concurrency', () => {
      const concurrency = 5;
      
      queueService.process('test-job', concurrency, processorFunction);

      expect(mockQueue.process).toHaveBeenCalledWith('test-job', concurrency, processorFunction);
    });

    it('should set up generic processor when no job name provided', () => {
      queueService.process(processorFunction);

      expect(mockQueue.process).toHaveBeenCalledWith(processorFunction);
    });
  });

  describe('getJob', () => {
    const jobId = 'test-job-id';

    it('should get job by ID', async () => {
      const mockJob = { id: jobId, data: { test: 'data' } };
      mockQueue.getJob.mockResolvedValue(mockJob);

      const result = await queueService.getJob(jobId);

      expect(mockQueue.getJob).toHaveBeenCalledWith(jobId);
      expect(result).toBe(mockJob);
    });

    it('should return null if job not found', async () => {
      mockQueue.getJob.mockResolvedValue(null);

      const result = await queueService.getJob(jobId);

      expect(result).toBeNull();
    });

    it('should handle get job errors', async () => {
      const error = new Error('Job not found');
      mockQueue.getJob.mockRejectedValue(error);

      await expect(queueService.getJob(jobId))
        .rejects.toThrow('Job not found');
    });
  });

  describe('removeJob', () => {
    const jobId = 'test-job-id';

    it('should remove job successfully', async () => {
      const mockJob = {
        id: jobId,
        remove: jest.fn().mockResolvedValue(true),
      };
      mockQueue.getJob.mockResolvedValue(mockJob);

      const result = await queueService.removeJob(jobId);

      expect(mockQueue.getJob).toHaveBeenCalledWith(jobId);
      expect(mockJob.remove).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false if job not found', async () => {
      mockQueue.getJob.mockResolvedValue(null);

      const result = await queueService.removeJob(jobId);

      expect(result).toBe(false);
    });

    it('should handle remove job errors', async () => {
      const mockJob = {
        id: jobId,
        remove: jest.fn().mockRejectedValue(new Error('Remove failed')),
      };
      mockQueue.getJob.mockResolvedValue(mockJob);

      await expect(queueService.removeJob(jobId))
        .rejects.toThrow('Remove failed');
    });
  });

  describe('getJobCounts', () => {
    it('should get job counts successfully', async () => {
      const mockCounts = {
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        delayed: 10,
      };
      mockQueue.getJobCounts.mockResolvedValue(mockCounts);

      const result = await queueService.getJobCounts();

      expect(mockQueue.getJobCounts).toHaveBeenCalled();
      expect(result).toBe(mockCounts);
    });

    it('should handle get counts errors', async () => {
      const error = new Error('Redis error');
      mockQueue.getJobCounts.mockRejectedValue(error);

      await expect(queueService.getJobCounts())
        .rejects.toThrow('Redis error');
    });
  });

  describe('clean', () => {
    it('should clean completed jobs', async () => {
      const grace = 24 * 60 * 60 * 1000; // 24 hours
      mockQueue.clean.mockResolvedValue(5);

      const result = await queueService.clean('completed', grace);

      expect(mockQueue.clean).toHaveBeenCalledWith(grace, 'completed');
      expect(result).toBe(5);
    });

    it('should clean failed jobs with default grace period', async () => {
      mockQueue.clean.mockResolvedValue(3);

      const result = await queueService.clean('failed');

      expect(mockQueue.clean).toHaveBeenCalledWith(5000, 'failed');
      expect(result).toBe(3);
    });

    it('should handle clean errors', async () => {
      const error = new Error('Clean failed');
      mockQueue.clean.mockRejectedValue(error);

      await expect(queueService.clean('completed'))
        .rejects.toThrow('Clean failed');
    });
  });

  describe('pause', () => {
    it('should pause queue', async () => {
      mockQueue.pause = jest.fn().mockResolvedValue();

      await queueService.pause();

      expect(mockQueue.pause).toHaveBeenCalled();
    });

    it('should pause queue globally', async () => {
      mockQueue.pause = jest.fn().mockResolvedValue();

      await queueService.pause(true);

      expect(mockQueue.pause).toHaveBeenCalledWith(true);
    });
  });

  describe('resume', () => {
    it('should resume queue', async () => {
      mockQueue.resume = jest.fn().mockResolvedValue();

      await queueService.resume();

      expect(mockQueue.resume).toHaveBeenCalled();
    });

    it('should resume queue globally', async () => {
      mockQueue.resume = jest.fn().mockResolvedValue();

      await queueService.resume(true);

      expect(mockQueue.resume).toHaveBeenCalledWith(true);
    });
  });

  describe('close', () => {
    it('should close queue gracefully', async () => {
      mockQueue.close.mockResolvedValue();

      await queueService.close();

      expect(mockQueue.close).toHaveBeenCalled();
    });

    it('should handle close errors', async () => {
      const error = new Error('Close failed');
      mockQueue.close.mockRejectedValue(error);

      await expect(queueService.close())
        .rejects.toThrow('Close failed');
    });
  });

  describe('event handlers', () => {
    let errorHandler, failedHandler, completedHandler;

    beforeEach(() => {
      // Get the event handlers that were registered
      const onCalls = mockQueue.on.mock.calls;
      errorHandler = onCalls.find(call => call[0] === 'error')[1];
      failedHandler = onCalls.find(call => call[0] === 'failed')[1];
      completedHandler = onCalls.find(call => call[0] === 'completed')[1];
    });

    it('should handle queue errors', () => {
      const error = new Error('Queue error');
      
      errorHandler(error);

      expect(logger.error).toHaveBeenCalledWith('Queue error:', error);
    });

    it('should handle job failures', () => {
      const job = { id: 'job-123', data: { test: 'data' } };
      const error = new Error('Job failed');
      
      failedHandler(job, error);

      expect(logger.error).toHaveBeenCalledWith(
        'Job job-123 failed:',
        error,
        { jobData: job.data }
      );
    });

    it('should handle job completion', () => {
      const job = { id: 'job-123', data: { test: 'data' } };
      const result = { success: true };
      
      completedHandler(job, result);

      expect(logger.info).toHaveBeenCalledWith(
        'Job job-123 completed',
        { jobData: job.data, result }
      );
    });
  });

  describe('getQueueStats', () => {
    it('should get comprehensive queue statistics', async () => {
      const mockCounts = {
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        delayed: 10,
      };
      mockQueue.getJobCounts.mockResolvedValue(mockCounts);

      const stats = await queueService.getQueueStats();

      expect(stats).toEqual({
        name: 'test-queue',
        counts: mockCounts,
        total: 120,
        processingRate: {
          successRate: expect.any(Number),
          failureRate: expect.any(Number),
        },
      });
    });

    it('should handle zero jobs gracefully', async () => {
      const mockCounts = {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      };
      mockQueue.getJobCounts.mockResolvedValue(mockCounts);

      const stats = await queueService.getQueueStats();

      expect(stats.processingRate.successRate).toBe(0);
      expect(stats.processingRate.failureRate).toBe(0);
    });
  });

  describe('retry job', () => {
    it('should retry failed job', async () => {
      const jobId = 'failed-job-id';
      const mockJob = {
        id: jobId,
        retry: jest.fn().mockResolvedValue(),
        opts: { attempts: 3 },
        attemptsMade: 2,
      };
      mockQueue.getJob.mockResolvedValue(mockJob);

      const result = await queueService.retryJob(jobId);

      expect(mockJob.retry).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should not retry job that exceeded max attempts', async () => {
      const jobId = 'failed-job-id';
      const mockJob = {
        id: jobId,
        retry: jest.fn(),
        opts: { attempts: 3 },
        attemptsMade: 3,
      };
      mockQueue.getJob.mockResolvedValue(mockJob);

      const result = await queueService.retryJob(jobId);

      expect(mockJob.retry).not.toHaveBeenCalled();
      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        `Job ${jobId} has exceeded maximum retry attempts`
      );
    });
  });
});