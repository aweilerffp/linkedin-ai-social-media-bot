import { createClient } from 'redis';
import { logger } from '../utils/logger.js';

let redisClient;

export async function initializeRedis() {
  const redisUrl = process.env.REDIS_URL || 
    `redis://${process.env.REDIS_PASSWORD ? `:${process.env.REDIS_PASSWORD}@` : ''}${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}/${process.env.REDIS_DB || 0}`;

  redisClient = createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          logger.error('Redis reconnection failed after 10 attempts');
          return new Error('Too many retries');
        }
        const delay = Math.min(retries * 100, 3000);
        logger.info(`Retrying Redis connection in ${delay}ms...`);
        return delay;
      },
    },
  });

  redisClient.on('error', (err) => {
    logger.error('Redis Client Error:', err);
  });

  redisClient.on('connect', () => {
    logger.info('Redis client connected');
  });

  redisClient.on('ready', () => {
    logger.info('Redis client ready');
  });

  redisClient.on('reconnecting', () => {
    logger.warn('Redis client reconnecting');
  });

  await redisClient.connect();
  
  // Test the connection
  await redisClient.ping();
  
  return redisClient;
}

export function getRedisClient() {
  if (!redisClient) {
    throw new Error('Redis not initialized. Call initializeRedis first.');
  }
  return redisClient;
}

export async function closeRedis() {
  if (redisClient) {
    await redisClient.quit();
    logger.info('Redis connection closed');
  }
}