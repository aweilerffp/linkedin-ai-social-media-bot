import { jest } from '@jest/globals';
import { WebhookService } from '../../services/webhook/WebhookService.js';
import { TestUtils } from '../helpers/testUtils.js';
import axios from 'axios';
import crypto from 'crypto';

// Mock dependencies
jest.mock('axios');
jest.mock('../../config/redis.js', () => ({
  getRedisClient: jest.fn(() => TestUtils.createMockRedisClient()),
}));
jest.mock('../../utils/logger.js', () => ({
  logger: TestUtils.createMockLogger(),
}));

import { getRedisClient } from '../../config/redis.js';
import { logger } from '../../utils/logger.js';

describe('WebhookService', () => {
  let webhookService;
  let mockRedisClient;

  beforeEach(() => {
    webhookService = new WebhookService();
    mockRedisClient = TestUtils.createMockRedisClient();
    getRedisClient.mockReturnValue(mockRedisClient);
    jest.clearAllMocks();
  });

  describe('generateSignature', () => {
    it('should generate consistent signatures for same payload', () => {
      const payload = { test: 'data' };
      const secret = 'test-secret';

      const signature1 = webhookService.generateSignature(payload, secret);
      const signature2 = webhookService.generateSignature(payload, secret);

      expect(signature1).toBe(signature2);
      expect(signature1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex string
    });

    it('should generate different signatures for different payloads', () => {
      const payload1 = { test: 'data1' };
      const payload2 = { test: 'data2' };
      const secret = 'test-secret';

      const signature1 = webhookService.generateSignature(payload1, secret);
      const signature2 = webhookService.generateSignature(payload2, secret);

      expect(signature1).not.toBe(signature2);
    });

    it('should generate different signatures for different secrets', () => {
      const payload = { test: 'data' };
      const secret1 = 'secret1';
      const secret2 = 'secret2';

      const signature1 = webhookService.generateSignature(payload, secret1);
      const signature2 = webhookService.generateSignature(payload, secret2);

      expect(signature1).not.toBe(signature2);
    });
  });

  describe('verifySignature', () => {
    it('should verify valid signature', () => {
      const payload = { test: 'data' };
      const secret = 'test-secret';
      const validSignature = webhookService.generateSignature(payload, secret);

      const isValid = webhookService.verifySignature(payload, validSignature, secret);

      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const payload = { test: 'data' };
      const secret = 'test-secret';
      const invalidSignature = 'invalid-signature';

      const isValid = webhookService.verifySignature(payload, invalidSignature, secret);

      expect(isValid).toBe(false);
    });

    it('should reject signature with wrong secret', () => {
      const payload = { test: 'data' };
      const secret = 'test-secret';
      const wrongSecret = 'wrong-secret';
      const signature = webhookService.generateSignature(payload, secret);

      const isValid = webhookService.verifySignature(payload, signature, wrongSecret);

      expect(isValid).toBe(false);
    });
  });

  describe('sendWebhook', () => {
    const webhookUrl = 'https://example.com/webhook';
    const event = 'post.published';
    const data = { postId: 'test-post-id' };

    it('should send webhook successfully', async () => {
      const mockResponse = {
        status: 200,
        data: { success: true },
      };
      axios.post.mockResolvedValue(mockResponse);

      const result = await webhookService.sendWebhook(webhookUrl, event, data, {
        teamId: 'test-team-id',
        userId: 'test-user-id',
      });

      expect(axios.post).toHaveBeenCalledWith(
        webhookUrl,
        expect.objectContaining({
          event,
          data,
          teamId: 'test-team-id',
          userId: 'test-user-id',
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Webhook-Signature': expect.stringMatching(/^sha256=[a-f0-9]{64}$/),
            'X-Webhook-Event': event,
            'User-Agent': 'SocialMediaPoster-Webhook/1.0',
          }),
          timeout: 30000,
        })
      );

      expect(result).toEqual({
        success: true,
        statusCode: 200,
        attempt: 1,
        response: { success: true },
      });
    });

    it('should retry on temporary failure', async () => {
      const mockError = {
        response: { status: 503 },
        message: 'Service Unavailable',
      };
      const mockSuccess = {
        status: 200,
        data: { success: true },
      };

      axios.post
        .mockRejectedValueOnce(mockError)
        .mockResolvedValueOnce(mockSuccess);

      const result = await webhookService.sendWebhook(webhookUrl, event, data, {
        retry: true,
        teamId: 'test-team-id',
      });

      expect(axios.post).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        success: true,
        statusCode: 200,
        attempt: 2,
        response: { success: true },
      });
    });

    it('should not retry on permanent failure', async () => {
      const mockError = {
        response: { status: 404 },
        message: 'Not Found',
      };

      axios.post.mockRejectedValue(mockError);

      const result = await webhookService.sendWebhook(webhookUrl, event, data, {
        retry: true,
        teamId: 'test-team-id',
      });

      expect(axios.post).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        success: false,
        error: 'Not Found',
        statusCode: 404,
        attempts: 1,
      });
    });

    it('should respect retry limit', async () => {
      const mockError = {
        response: { status: 503 },
        message: 'Service Unavailable',
      };

      axios.post.mockRejectedValue(mockError);

      const result = await webhookService.sendWebhook(webhookUrl, event, data, {
        retry: true,
        teamId: 'test-team-id',
      });

      expect(axios.post).toHaveBeenCalledTimes(4); // Initial + 3 retries
      expect(result).toEqual({
        success: false,
        error: 'Service Unavailable',
        statusCode: 503,
        attempts: 4,
      });
    });

    it('should handle timeout errors', async () => {
      const mockError = {
        code: 'ECONNABORTED',
        message: 'Request timeout',
      };

      axios.post.mockRejectedValue(mockError);

      const result = await webhookService.sendWebhook(webhookUrl, event, data);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Request timeout');
    });
  });

  describe('sendWebhookToMultiple', () => {
    const webhookUrls = [
      'https://example1.com/webhook',
      'https://example2.com/webhook',
      'https://example3.com/webhook',
    ];
    const event = 'post.published';
    const data = { postId: 'test-post-id' };

    it('should send to multiple URLs successfully', async () => {
      const mockResponse = {
        status: 200,
        data: { success: true },
      };
      axios.post.mockResolvedValue(mockResponse);

      const result = await webhookService.sendWebhookToMultiple(webhookUrls, event, data);

      expect(axios.post).toHaveBeenCalledTimes(3);
      expect(result).toEqual({
        total: 3,
        successful: 3,
        failed: 0,
        results: expect.arrayContaining([
          expect.objectContaining({
            success: true,
            result: expect.objectContaining({ success: true }),
          }),
        ]),
      });
    });

    it('should handle mixed success and failure', async () => {
      const mockSuccess = {
        status: 200,
        data: { success: true },
      };
      const mockError = {
        response: { status: 404 },
        message: 'Not Found',
      };

      axios.post
        .mockResolvedValueOnce(mockSuccess)
        .mockRejectedValueOnce(mockError)
        .mockResolvedValueOnce(mockSuccess);

      const result = await webhookService.sendWebhookToMultiple(webhookUrls, event, data);

      expect(result).toEqual({
        total: 3,
        successful: 2,
        failed: 1,
        results: expect.arrayContaining([
          expect.objectContaining({ success: true }),
          expect.objectContaining({ success: false }),
          expect.objectContaining({ success: true }),
        ]),
      });
    });
  });

  describe('queueWebhook', () => {
    const webhookUrls = ['https://example.com/webhook'];
    const event = 'post.published';
    const data = { postId: 'test-post-id' };

    it('should queue webhook for processing', async () => {
      const mockWebhookId = 'webhook-job-id';
      jest.spyOn(crypto, 'randomUUID').mockReturnValue(mockWebhookId);
      mockRedisClient.lpush.mockResolvedValue(1);

      const result = await webhookService.queueWebhook(webhookUrls, event, data, {
        teamId: 'test-team-id',
        userId: 'test-user-id',
      });

      expect(mockRedisClient.lpush).toHaveBeenCalledWith(
        'webhook:queue',
        expect.stringContaining(mockWebhookId)
      );
      expect(result).toBe(mockWebhookId);
    });

    it('should handle single URL as string', async () => {
      const singleUrl = 'https://example.com/webhook';
      const mockWebhookId = 'webhook-job-id';
      jest.spyOn(crypto, 'randomUUID').mockReturnValue(mockWebhookId);
      mockRedisClient.lpush.mockResolvedValue(1);

      const result = await webhookService.queueWebhook(singleUrl, event, data);

      expect(mockRedisClient.lpush).toHaveBeenCalled();
      expect(result).toBe(mockWebhookId);

      const queuedJob = JSON.parse(mockRedisClient.lpush.mock.calls[0][1]);
      expect(queuedJob.webhookUrls).toEqual([singleUrl]);
    });
  });

  describe('processWebhookQueue', () => {
    it('should process queued webhook job', async () => {
      const mockJob = {
        id: 'webhook-job-id',
        webhookUrls: ['https://example.com/webhook'],
        event: 'post.published',
        data: { postId: 'test-post-id' },
        options: { teamId: 'test-team-id' },
      };

      mockRedisClient.brpop.mockResolvedValue(['webhook:queue', JSON.stringify(mockJob)]);
      mockRedisClient.setex.mockResolvedValue('OK');

      const mockResponse = {
        status: 200,
        data: { success: true },
      };
      axios.post.mockResolvedValue(mockResponse);

      const result = await webhookService.processWebhookQueue();

      expect(mockRedisClient.brpop).toHaveBeenCalledWith('webhook:queue', 1);
      expect(axios.post).toHaveBeenCalledTimes(1);
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        `webhook:result:${mockJob.id}`,
        86400,
        expect.stringContaining(mockJob.id)
      );
      expect(result).toBeDefined();
    });

    it('should return null when queue is empty', async () => {
      mockRedisClient.brpop.mockResolvedValue(null);

      const result = await webhookService.processWebhookQueue();

      expect(result).toBeNull();
    });

    it('should handle processing errors', async () => {
      const mockJob = {
        id: 'webhook-job-id',
        webhookUrls: ['https://example.com/webhook'],
        event: 'post.published',
        data: { postId: 'test-post-id' },
      };

      mockRedisClient.brpop.mockResolvedValue(['webhook:queue', JSON.stringify(mockJob)]);
      axios.post.mockRejectedValue(new Error('Network error'));

      await expect(webhookService.processWebhookQueue()).rejects.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getWebhookStatus', () => {
    it('should return webhook status when available', async () => {
      const webhookId = 'webhook-job-id';
      const mockStatus = {
        id: webhookId,
        result: { success: true, successful: 1, failed: 0 },
        completedAt: new Date().toISOString(),
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockStatus));

      const result = await webhookService.getWebhookStatus(webhookId);

      expect(mockRedisClient.get).toHaveBeenCalledWith(`webhook:result:${webhookId}`);
      expect(result).toEqual(mockStatus);
    });

    it('should return null when status not found', async () => {
      const webhookId = 'non-existent-id';
      mockRedisClient.get.mockResolvedValue(null);

      const result = await webhookService.getWebhookStatus(webhookId);

      expect(result).toBeNull();
    });
  });

  describe('isValidWebhookUrl', () => {
    it('should validate HTTP URLs', () => {
      expect(webhookService.isValidWebhookUrl('http://example.com/webhook')).toBe(true);
    });

    it('should validate HTTPS URLs', () => {
      expect(webhookService.isValidWebhookUrl('https://example.com/webhook')).toBe(true);
    });

    it('should reject non-HTTP(S) URLs', () => {
      expect(webhookService.isValidWebhookUrl('ftp://example.com/webhook')).toBe(false);
      expect(webhookService.isValidWebhookUrl('ws://example.com/webhook')).toBe(false);
    });

    it('should reject invalid URLs', () => {
      expect(webhookService.isValidWebhookUrl('not-a-url')).toBe(false);
      expect(webhookService.isValidWebhookUrl('')).toBe(false);
      expect(webhookService.isValidWebhookUrl(null)).toBe(false);
    });
  });

  describe('testWebhook', () => {
    const webhookUrl = 'https://example.com/webhook';

    it('should test webhook successfully', async () => {
      const mockResponse = {
        status: 200,
        data: { success: true },
      };
      axios.post.mockResolvedValue(mockResponse);

      const result = await webhookService.testWebhook(webhookUrl);

      expect(axios.post).toHaveBeenCalledWith(
        webhookUrl,
        expect.objectContaining({
          event: 'webhook.test',
          data: expect.objectContaining({
            message: expect.stringContaining('test webhook'),
          }),
        }),
        expect.any(Object)
      );

      expect(result).toEqual({
        success: true,
        statusCode: 200,
        message: 'Webhook test successful',
        details: expect.objectContaining({ success: true }),
      });
    });

    it('should handle test webhook failure', async () => {
      const mockError = {
        response: { status: 404 },
        message: 'Not Found',
      };
      axios.post.mockRejectedValue(mockError);

      const result = await webhookService.testWebhook(webhookUrl);

      expect(result).toEqual({
        success: false,
        message: 'Webhook test failed',
        details: expect.objectContaining({ success: false }),
      });
    });
  });
});