import Bull from 'bull';
import { logger } from '../../utils/logger.js';
import { PostProcessor } from './PostProcessor.js';
import { RetryHandler } from './RetryHandler.js';

const queues = {};
let postProcessor;
let retryHandler;

export async function initializeQueue() {
  const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: process.env.REDIS_DB || 0,
  };

  // Initialize processors
  postProcessor = new PostProcessor();
  retryHandler = new RetryHandler();

  // Create post queue
  queues.postQueue = new Bull('post-queue', {
    redis: redisConfig,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  });

  // Create schedule queue
  queues.scheduleQueue = new Bull('schedule-queue', {
    redis: redisConfig,
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: 50,
    },
  });

  // Create retry queue
  queues.retryQueue = new Bull('retry-queue', {
    redis: redisConfig,
    defaultJobOptions: {
      attempts: 1, // Retries have only one attempt
      removeOnComplete: 200,
      removeOnFail: 1000,
    },
  });

  // Set up job processors
  queues.postQueue.process('post', 5, async (job) => {
    return await postProcessor.processPost(job);
  });

  queues.postQueue.process('bulk-post', 1, async (job) => {
    return await postProcessor.processBulkPosts(job);
  });

  queues.retryQueue.process('retry-post', 3, async (job) => {
    return await postProcessor.processRetry(job);
  });

  queues.scheduleQueue.process('check-scheduled', 1, async (job) => {
    return await checkScheduledPosts(job);
  });

  // Set up event listeners
  Object.entries(queues).forEach(([name, queue]) => {
    queue.on('completed', (job, result) => {
      logger.info(`Job completed in ${name}:`, { 
        jobId: job.id, 
        jobType: job.name,
        processingTime: Date.now() - job.processedOn
      });
      
      if (name === 'postQueue') {
        postProcessor.onJobComplete(job, result);
      }
    });

    queue.on('failed', (job, err) => {
      logger.error(`Job failed in ${name}:`, { 
        jobId: job.id, 
        jobType: job.name,
        error: err.message,
        attempts: job.attemptsMade 
      });

      if (name === 'postQueue') {
        postProcessor.onJobFailed(job, err);
        
        // Schedule retry if eligible
        const retryJobData = retryHandler.createRetryJobData(job.data, err, job.attemptsMade);
        if (retryJobData) {
          scheduleRetry(retryJobData);
        } else {
          retryHandler.markForManualReview(job.data.postId, job.data.platform, err);
        }
      }
    });

    queue.on('stalled', (job) => {
      logger.warn(`Job stalled in ${name}:`, { jobId: job.id, jobType: job.name });
    });

    queue.on('progress', (job, progress) => {
      logger.debug(`Job progress in ${name}:`, { jobId: job.id, progress });
    });
  });

  // Start scheduled job checker
  await startScheduledJobChecker();

  logger.info('Queue system initialized');
  return queues;
}

/**
 * Schedule a post for immediate processing
 */
export async function schedulePost(postData) {
  const job = await queues.postQueue.add('post', postData, {
    priority: postData.priority || 0,
    delay: postData.delay || 0,
  });

  logger.info('Post scheduled for processing', { 
    jobId: job.id, 
    postId: postData.postId,
    platforms: postData.platforms 
  });

  return job;
}

/**
 * Schedule a retry for a failed post
 */
export async function scheduleRetry(retryData) {
  const job = await queues.retryQueue.add('retry-post', retryData, {
    delay: retryData.delay,
    priority: 1, // Higher priority for retries
  });

  retryHandler.logRetryAttempt(retryData, { message: 'Retry scheduled' }, retryData.retryAttempt);

  return job;
}

/**
 * Check for scheduled posts that are ready to be processed
 */
async function checkScheduledPosts() {
  try {
    const { Post } = await import('../../models/Post.js');
    const scheduledPosts = await Post.findScheduled();

    logger.info('Checking scheduled posts', { count: scheduledPosts.length });

    for (const post of scheduledPosts) {
      // Schedule the post for processing
      await schedulePost({
        postId: post.id,
        platforms: post.platforms,
        teamId: post.teamId,
        scheduledProcessing: true,
      });

      logger.info('Scheduled post queued for processing', { 
        postId: post.id,
        scheduledAt: post.scheduledAt 
      });
    }

    return { processedCount: scheduledPosts.length };
  } catch (error) {
    logger.error('Error checking scheduled posts:', error);
    throw error;
  }
}

/**
 * Start the scheduled job checker
 */
async function startScheduledJobChecker() {
  // Check for scheduled posts every minute
  await queues.scheduleQueue.add('check-scheduled', {}, {
    repeat: { cron: '* * * * *' }, // Every minute
    removeOnComplete: 1,
    removeOnFail: 1,
  });

  logger.info('Scheduled job checker started');
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  const stats = {};

  for (const [name, queue] of Object.entries(queues)) {
    stats[name] = {
      waiting: await queue.getWaiting().then(jobs => jobs.length),
      active: await queue.getActive().then(jobs => jobs.length),
      completed: await queue.getCompleted().then(jobs => jobs.length),
      failed: await queue.getFailed().then(jobs => jobs.length),
      delayed: await queue.getDelayed().then(jobs => jobs.length),
    };
  }

  // Add processing stats
  if (postProcessor) {
    stats.processing = postProcessor.getProcessingStats();
  }

  return stats;
}

export function getQueue(queueName) {
  if (!queues[queueName]) {
    throw new Error(`Queue ${queueName} not found`);
  }
  return queues[queueName];
}

export function getAllQueues() {
  return queues;
}

export { postProcessor, retryHandler };