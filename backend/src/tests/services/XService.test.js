import { jest } from '@jest/globals';
import { XService } from '../../services/platforms/XService.js';
import { TestUtils } from '../helpers/testUtils.js';
import axios from 'axios';

// Mock dependencies
jest.mock('axios');
jest.mock('../../config/database.js', () => ({
  query: jest.fn(),
}));
jest.mock('../../utils/logger.js', () => ({
  logger: TestUtils.createMockLogger(),
}));

import { query } from '../../config/database.js';
import { logger } from '../../utils/logger.js';

describe('XService', () => {
  let xService;

  beforeEach(() => {
    xService = new XService();
    jest.clearAllMocks();
  });

  describe('publishPost', () => {
    const mockTokens = {
      access_token: 'twitter-access-token',
      access_token_secret: 'twitter-token-secret',
      user_id: 'twitter-user-123',
    };
    const postData = {
      content: 'Test X/Twitter post content',
      userId: 'user-123',
      teamId: 'team-123',
    };

    it('should publish text post successfully', async () => {
      const mockUser = TestUtils.createMockUser({
        id: postData.userId,
        twitterTokens: mockTokens,
      });

      const mockResponse = {
        status: 201,
        data: {
          data: {
            id: 'twitter-post-123',
            text: postData.content,
          },
        },
      };

      query.mockResolvedValue(TestUtils.createMockQueryResult([mockUser]));
      axios.post.mockResolvedValue(mockResponse);

      const result = await xService.publishPost(postData);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [postData.userId]
      );

      expect(axios.post).toHaveBeenCalledWith(
        'https://api.twitter.com/2/tweets',
        {
          text: postData.content,
        },
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': expect.stringContaining('OAuth'),
          }),
        })
      );

      expect(result).toEqual({
        success: true,
        platformPostId: 'twitter-post-123',
        url: 'https://twitter.com/i/web/status/twitter-post-123',
        platform: 'twitter',
      });
    });

    it('should publish post with media successfully', async () => {
      const postDataWithImage = {
        ...postData,
        imageUrl: 'https://example.com/image.jpg',
      };

      const mockUser = TestUtils.createMockUser({
        id: postData.userId,
        twitterTokens: mockTokens,
      });

      const mockUploadResponse = {
        status: 200,
        data: {
          media_id_string: 'twitter-media-123',
        },
      };

      const mockImageResponse = {
        data: Buffer.from('fake-image-data'),
        headers: { 'content-type': 'image/jpeg' },
      };

      const mockPublishResponse = {
        status: 201,
        data: {
          data: {
            id: 'twitter-post-123',
            text: postData.content,
          },
        },
      };

      query.mockResolvedValue(TestUtils.createMockQueryResult([mockUser]));
      axios.get.mockResolvedValue(mockImageResponse);
      axios.post
        .mockResolvedValueOnce(mockUploadResponse) // Upload media
        .mockResolvedValueOnce(mockPublishResponse); // Publish tweet

      const result = await xService.publishPost(postDataWithImage);

      expect(result.success).toBe(true);
      expect(result.platformPostId).toBe('twitter-post-123');
    });

    it('should handle user not found', async () => {
      query.mockResolvedValue(TestUtils.createMockQueryResult([]));

      const result = await xService.publishPost(postData);

      expect(result).toEqual({
        success: false,
        error: 'User not found',
        platform: 'twitter',
      });
    });

    it('should handle missing Twitter tokens', async () => {
      const mockUser = TestUtils.createMockUser({
        id: postData.userId,
        twitterTokens: null,
      });

      query.mockResolvedValue(TestUtils.createMockQueryResult([mockUser]));

      const result = await xService.publishPost(postData);

      expect(result).toEqual({
        success: false,
        error: 'Twitter account not connected',
        platform: 'twitter',
      });
    });

    it('should handle API errors', async () => {
      const mockUser = TestUtils.createMockUser({
        id: postData.userId,
        twitterTokens: mockTokens,
      });

      const mockError = {
        response: {
          status: 403,
          data: {
            errors: [
              {
                code: 187,
                message: 'Status is a duplicate',
              },
            ],
          },
        },
      };

      query.mockResolvedValue(TestUtils.createMockQueryResult([mockUser]));
      axios.post.mockRejectedValue(mockError);

      const result = await xService.publishPost(postData);

      expect(result).toEqual({
        success: false,
        error: 'Twitter API error: Status is a duplicate',
        statusCode: 403,
        platform: 'twitter',
      });
    });

    it('should handle network errors', async () => {
      const mockUser = TestUtils.createMockUser({
        id: postData.userId,
        twitterTokens: mockTokens,
      });

      const mockError = {
        code: 'ECONNABORTED',
        message: 'Request timeout',
      };

      query.mockResolvedValue(TestUtils.createMockQueryResult([mockUser]));
      axios.post.mockRejectedValue(mockError);

      const result = await xService.publishPost(postData);

      expect(result).toEqual({
        success: false,
        error: 'Request timeout',
        platform: 'twitter',
      });
    });
  });

  describe('uploadMedia', () => {
    const mockTokens = {
      access_token: 'twitter-access-token',
      access_token_secret: 'twitter-token-secret',
    };
    const imageUrl = 'https://example.com/image.jpg';

    it('should upload media successfully', async () => {
      const mockImageResponse = {
        data: Buffer.from('fake-image-data'),
        headers: { 'content-type': 'image/jpeg' },
      };

      const mockUploadResponse = {
        status: 200,
        data: {
          media_id_string: 'twitter-media-123',
          size: 12345,
          image: {
            image_type: 'image/jpeg',
            w: 800,
            h: 600,
          },
        },
      };

      axios.get.mockResolvedValue(mockImageResponse);
      axios.post.mockResolvedValue(mockUploadResponse);

      const result = await xService.uploadMedia(imageUrl, mockTokens);

      expect(axios.get).toHaveBeenCalledWith(imageUrl, { responseType: 'arraybuffer' });
      expect(axios.post).toHaveBeenCalledWith(
        'https://upload.twitter.com/1.1/media/upload.json',
        expect.any(FormData),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': expect.stringContaining('OAuth'),
          }),
        })
      );

      expect(result).toBe('twitter-media-123');
    });

    it('should handle image download failure', async () => {
      axios.get.mockRejectedValue(new Error('Failed to download image'));

      await expect(xService.uploadMedia(imageUrl, mockTokens))
        .rejects.toThrow('Failed to download image from URL');
    });

    it('should handle upload failure', async () => {
      const mockImageResponse = {
        data: Buffer.from('fake-image-data'),
        headers: { 'content-type': 'image/jpeg' },
      };

      const mockError = {
        response: { status: 400 },
        message: 'Bad request',
      };

      axios.get.mockResolvedValue(mockImageResponse);
      axios.post.mockRejectedValue(mockError);

      await expect(xService.uploadMedia(imageUrl, mockTokens))
        .rejects.toThrow('Failed to upload media to Twitter');
    });
  });

  describe('generateOAuthHeader', () => {
    const method = 'POST';
    const url = 'https://api.twitter.com/2/tweets';
    const params = { text: 'Test tweet' };
    const tokens = {
      access_token: 'access-token',
      access_token_secret: 'token-secret',
    };

    it('should generate valid OAuth header', () => {
      const header = xService.generateOAuthHeader(method, url, params, tokens);

      expect(header).toMatch(/^OAuth /);
      expect(header).toContain('oauth_consumer_key=');
      expect(header).toContain('oauth_token=');
      expect(header).toContain('oauth_signature_method="HMAC-SHA1"');
      expect(header).toContain('oauth_timestamp=');
      expect(header).toContain('oauth_nonce=');
      expect(header).toContain('oauth_version="1.0"');
      expect(header).toContain('oauth_signature=');
    });

    it('should generate different signatures for different requests', () => {
      const header1 = xService.generateOAuthHeader(method, url, params, tokens);
      const header2 = xService.generateOAuthHeader('GET', url, {}, tokens);

      // Extract signatures
      const sig1 = header1.match(/oauth_signature="([^"]+)"/)[1];
      const sig2 = header2.match(/oauth_signature="([^"]+)"/)[1];

      expect(sig1).not.toBe(sig2);
    });
  });

  describe('validatePost', () => {
    it('should validate valid post data', () => {
      const validData = {
        content: 'Valid Twitter post content',
        userId: 'user-123',
      };

      expect(() => xService.validatePost(validData)).not.toThrow();
    });

    it('should throw error for missing content', () => {
      const invalidData = {
        userId: 'user-123',
      };

      expect(() => xService.validatePost(invalidData))
        .toThrow('Content is required');
    });

    it('should throw error for empty content', () => {
      const invalidData = {
        content: '',
        userId: 'user-123',
      };

      expect(() => xService.validatePost(invalidData))
        .toThrow('Content cannot be empty');
    });

    it('should throw error for content too long', () => {
      const invalidData = {
        content: 'x'.repeat(281), // Twitter limit is 280
        userId: 'user-123',
      };

      expect(() => xService.validatePost(invalidData))
        .toThrow('Content exceeds maximum length of 280 characters');
    });

    it('should throw error for missing userId', () => {
      const invalidData = {
        content: 'Valid content',
      };

      expect(() => xService.validatePost(invalidData))
        .toThrow('User ID is required');
    });
  });

  describe('formatError', () => {
    it('should format API error with Twitter errors array', () => {
      const error = {
        response: {
          status: 400,
          data: {
            errors: [
              {
                code: 187,
                message: 'Status is a duplicate',
              },
            ],
          },
        },
      };

      const result = xService.formatError(error);

      expect(result).toEqual({
        success: false,
        error: 'Twitter API error: Status is a duplicate',
        statusCode: 400,
        platform: 'twitter',
      });
    });

    it('should format API error with detail field', () => {
      const error = {
        response: {
          status: 401,
          data: {
            detail: 'Unauthorized',
          },
        },
      };

      const result = xService.formatError(error);

      expect(result).toEqual({
        success: false,
        error: 'Twitter API error: Unauthorized',
        statusCode: 401,
        platform: 'twitter',
      });
    });

    it('should format network error', () => {
      const error = {
        code: 'ECONNREFUSED',
        message: 'Connection refused',
      };

      const result = xService.formatError(error);

      expect(result).toEqual({
        success: false,
        error: 'Connection refused',
        platform: 'twitter',
      });
    });

    it('should format unknown error', () => {
      const error = {
        message: 'Unknown error',
      };

      const result = xService.formatError(error);

      expect(result).toEqual({
        success: false,
        error: 'Unknown error',
        platform: 'twitter',
      });
    });

    it('should handle error without message', () => {
      const error = {};

      const result = xService.formatError(error);

      expect(result).toEqual({
        success: false,
        error: 'Unknown Twitter error',
        platform: 'twitter',
      });
    });
  });

  describe('generateNonce', () => {
    it('should generate random nonce', () => {
      const nonce1 = xService.generateNonce();
      const nonce2 = xService.generateNonce();

      expect(nonce1).toMatch(/^[a-zA-Z0-9]+$/);
      expect(nonce2).toMatch(/^[a-zA-Z0-9]+$/);
      expect(nonce1).not.toBe(nonce2);
      expect(nonce1.length).toBe(32);
    });
  });

  describe('percentEncode', () => {
    it('should encode special characters', () => {
      expect(xService.percentEncode('hello world')).toBe('hello%20world');
      expect(xService.percentEncode('hello@world')).toBe('hello%40world');
      expect(xService.percentEncode('hello!world')).toBe('hello%21world');
    });

    it('should not encode unreserved characters', () => {
      expect(xService.percentEncode('hello123')).toBe('hello123');
      expect(xService.percentEncode('HELLO123')).toBe('HELLO123');
      expect(xService.percentEncode('hello-world_123')).toBe('hello-world_123');
    });

    it('should handle empty string', () => {
      expect(xService.percentEncode('')).toBe('');
    });
  });

  describe('createSignatureBaseString', () => {
    it('should create proper signature base string', () => {
      const method = 'POST';
      const url = 'https://api.twitter.com/2/tweets';
      const params = {
        oauth_consumer_key: 'consumer-key',
        oauth_token: 'access-token',
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: '1234567890',
        oauth_nonce: 'random-nonce',
        oauth_version: '1.0',
        text: 'Hello world',
      };

      const baseString = xService.createSignatureBaseString(method, url, params);

      expect(baseString).toContain('POST&');
      expect(baseString).toContain('https%3A%2F%2Fapi.twitter.com%2F2%2Ftweets&');
      expect(baseString).toContain('oauth_consumer_key%3Dconsumer-key');
      expect(baseString).toContain('text%3DHello%2520world');
    });
  });

  describe('createSigningKey', () => {
    it('should create proper signing key', () => {
      const consumerSecret = 'consumer-secret';
      const tokenSecret = 'token-secret';

      const signingKey = xService.createSigningKey(consumerSecret, tokenSecret);

      expect(signingKey).toBe('consumer-secret&token-secret');
    });

    it('should handle missing token secret', () => {
      const consumerSecret = 'consumer-secret';

      const signingKey = xService.createSigningKey(consumerSecret);

      expect(signingKey).toBe('consumer-secret&');
    });
  });
});