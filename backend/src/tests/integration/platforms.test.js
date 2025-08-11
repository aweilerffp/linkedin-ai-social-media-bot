import { jest } from '@jest/globals';
import axios from 'axios';
import { TestUtils } from '../helpers/testUtils.js';

// Mock dependencies
jest.mock('axios');
jest.mock('../../config/database.js', () => ({
  query: jest.fn(),
}));
jest.mock('../../utils/logger.js', () => ({
  logger: TestUtils.createMockLogger(),
}));

import { LinkedInService } from '../../services/platforms/LinkedInService.js';
import { XService } from '../../services/platforms/XService.js';
import { PlatformFactory } from '../../services/platforms/PlatformFactory.js';
import { query } from '../../config/database.js';

describe('Platform Integration Tests', () => {
  let linkedInService;
  let xService;

  beforeEach(() => {
    linkedInService = new LinkedInService();
    xService = new XService();
    jest.clearAllMocks();
  });

  describe('Platform Factory', () => {
    it('should create LinkedIn service instance', () => {
      const platform = PlatformFactory.create('linkedin');
      expect(platform).toBeInstanceOf(LinkedInService);
    });

    it('should create X/Twitter service instance', () => {
      const platform = PlatformFactory.create('twitter');
      expect(platform).toBeInstanceOf(XService);
    });

    it('should return null for unsupported platform', () => {
      const platform = PlatformFactory.create('unsupported');
      expect(platform).toBeNull();
    });

    it('should handle case insensitive platform names', () => {
      expect(PlatformFactory.create('LinkedIn')).toBeInstanceOf(LinkedInService);
      expect(PlatformFactory.create('TWITTER')).toBeInstanceOf(XService);
      expect(PlatformFactory.create('X')).toBeInstanceOf(XService);
    });
  });

  describe('LinkedIn Platform Integration', () => {
    const mockTokens = {
      access_token: 'linkedin-access-token',
      profile_id: 'linkedin-profile-123',
    };

    const mockUser = TestUtils.createMockUser({
      linkedinTokens: mockTokens,
    });

    describe('Text Post Publishing', () => {
      it('should publish text post to LinkedIn successfully', async () => {
        const postData = {
          content: 'LinkedIn integration test post',
          userId: mockUser.id,
        };

        const mockResponse = {
          status: 201,
          data: {
            id: 'urn:li:share:linkedin-post-123',
            shareUrl: 'https://linkedin.com/feed/update/linkedin-post-123',
          },
        };

        query.mockResolvedValue(TestUtils.createMockQueryResult([mockUser]));
        axios.post.mockResolvedValue(mockResponse);

        const result = await linkedInService.publishPost(postData);

        expect(result).toEqual({
          success: true,
          platformPostId: 'urn:li:share:linkedin-post-123',
          url: 'https://linkedin.com/feed/update/linkedin-post-123',
          platform: 'linkedin',
        });

        expect(axios.post).toHaveBeenCalledWith(
          'https://api.linkedin.com/v2/ugcPosts',
          expect.objectContaining({
            author: `urn:li:person:${mockTokens.profile_id}`,
            lifecycleState: 'PUBLISHED',
            specificContent: {
              'com.linkedin.ugc.ShareContent': {
                shareCommentary: { text: postData.content },
                shareMediaCategory: 'NONE',
              },
            },
          }),
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': `Bearer ${mockTokens.access_token}`,
            }),
          })
        );
      });

      it('should handle LinkedIn API errors', async () => {
        const postData = {
          content: 'Test post',
          userId: mockUser.id,
        };

        const mockError = {
          response: {
            status: 401,
            data: {
              message: 'Token expired',
              serviceErrorCode: 401,
            },
          },
        };

        query.mockResolvedValue(TestUtils.createMockQueryResult([mockUser]));
        axios.post.mockRejectedValue(mockError);

        const result = await linkedInService.publishPost(postData);

        expect(result).toEqual({
          success: false,
          error: 'LinkedIn API error: Token expired',
          statusCode: 401,
          platform: 'linkedin',
        });
      });
    });

    describe('Image Post Publishing', () => {
      it('should publish post with image to LinkedIn', async () => {
        const postData = {
          content: 'LinkedIn post with image',
          imageUrl: 'https://example.com/test-image.jpg',
          userId: mockUser.id,
        };

        const mockImageData = Buffer.from('fake-image-data');
        const mockImageResponse = {
          data: mockImageData,
          headers: { 'content-type': 'image/jpeg' },
        };

        const mockUploadInitResponse = {
          status: 200,
          data: {
            value: {
              uploadMechanism: {
                'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
                  uploadUrl: 'https://linkedin-upload-url',
                  headers: {},
                },
              },
              asset: 'urn:li:digitalmediaAsset:linkedin-asset-123',
            },
          },
        };

        const mockPublishResponse = {
          status: 201,
          data: {
            id: 'linkedin-post-with-image-123',
            shareUrl: 'https://linkedin.com/feed/update/linkedin-post-with-image-123',
          },
        };

        query.mockResolvedValue(TestUtils.createMockQueryResult([mockUser]));
        axios.get.mockResolvedValue(mockImageResponse);
        axios.post
          .mockResolvedValueOnce(mockUploadInitResponse) // Initialize upload
          .mockResolvedValueOnce(mockPublishResponse); // Publish post
        axios.put.mockResolvedValue({ status: 201 }); // Upload image

        const result = await linkedInService.publishPost(postData);

        expect(result.success).toBe(true);
        expect(result.platformPostId).toBe('linkedin-post-with-image-123');

        // Verify image upload workflow
        expect(axios.get).toHaveBeenCalledWith(postData.imageUrl, {
          responseType: 'arraybuffer',
        });
        expect(axios.post).toHaveBeenCalledWith(
          'https://api.linkedin.com/v2/assets?action=registerUpload',
          expect.objectContaining({
            registerUploadRequest: expect.objectContaining({
              recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
            }),
          }),
          expect.any(Object)
        );
        expect(axios.put).toHaveBeenCalledWith(
          'https://linkedin-upload-url',
          mockImageData,
          expect.any(Object)
        );
      });

      it('should handle image upload failures', async () => {
        const postData = {
          content: 'Post with failing image',
          imageUrl: 'https://example.com/broken-image.jpg',
          userId: mockUser.id,
        };

        query.mockResolvedValue(TestUtils.createMockQueryResult([mockUser]));
        axios.get.mockRejectedValue(new Error('Image not found'));

        const result = await linkedInService.publishPost(postData);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Failed to download image from URL');
      });
    });

    describe('Token Management', () => {
      it('should refresh expired LinkedIn tokens', async () => {
        const refreshToken = 'refresh-token-123';
        const mockRefreshResponse = {
          status: 200,
          data: {
            access_token: 'new-access-token',
            expires_in: 5184000,
          },
        };

        axios.post.mockResolvedValue(mockRefreshResponse);

        const result = await linkedInService.refreshToken(refreshToken);

        expect(result).toEqual({
          access_token: 'new-access-token',
          expires_in: 5184000,
        });

        expect(axios.post).toHaveBeenCalledWith(
          'https://www.linkedin.com/oauth/v2/accessToken',
          expect.any(URLSearchParams),
          expect.objectContaining({
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          })
        );
      });
    });
  });

  describe('X/Twitter Platform Integration', () => {
    const mockTokens = {
      access_token: 'twitter-access-token',
      access_token_secret: 'twitter-token-secret',
      user_id: 'twitter-user-123',
    };

    const mockUser = TestUtils.createMockUser({
      twitterTokens: mockTokens,
    });

    describe('Text Tweet Publishing', () => {
      it('should publish text tweet to X/Twitter successfully', async () => {
        const postData = {
          content: 'Twitter integration test tweet',
          userId: mockUser.id,
        };

        const mockResponse = {
          status: 201,
          data: {
            data: {
              id: 'twitter-tweet-123',
              text: postData.content,
            },
          },
        };

        query.mockResolvedValue(TestUtils.createMockQueryResult([mockUser]));
        axios.post.mockResolvedValue(mockResponse);

        const result = await xService.publishPost(postData);

        expect(result).toEqual({
          success: true,
          platformPostId: 'twitter-tweet-123',
          url: 'https://twitter.com/i/web/status/twitter-tweet-123',
          platform: 'twitter',
        });

        expect(axios.post).toHaveBeenCalledWith(
          'https://api.twitter.com/2/tweets',
          { text: postData.content },
          expect.objectContaining({
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              'Authorization': expect.stringContaining('OAuth'),
            }),
          })
        );
      });

      it('should handle Twitter API errors', async () => {
        const postData = {
          content: 'Duplicate tweet test',
          userId: mockUser.id,
        };

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
    });

    describe('Tweet with Media', () => {
      it('should publish tweet with image to X/Twitter', async () => {
        const postData = {
          content: 'Twitter post with image',
          imageUrl: 'https://example.com/twitter-image.jpg',
          userId: mockUser.id,
        };

        const mockImageData = Buffer.from('fake-twitter-image-data');
        const mockImageResponse = {
          data: mockImageData,
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

        const mockTweetResponse = {
          status: 201,
          data: {
            data: {
              id: 'twitter-tweet-with-media-123',
              text: postData.content,
            },
          },
        };

        query.mockResolvedValue(TestUtils.createMockQueryResult([mockUser]));
        axios.get.mockResolvedValue(mockImageResponse);
        axios.post
          .mockResolvedValueOnce(mockUploadResponse) // Upload media
          .mockResolvedValueOnce(mockTweetResponse); // Post tweet

        const result = await xService.publishPost(postData);

        expect(result.success).toBe(true);
        expect(result.platformPostId).toBe('twitter-tweet-with-media-123');

        // Verify media upload
        expect(axios.post).toHaveBeenCalledWith(
          'https://upload.twitter.com/1.1/media/upload.json',
          expect.any(FormData),
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': expect.stringContaining('OAuth'),
            }),
          })
        );

        // Verify tweet with media
        expect(axios.post).toHaveBeenCalledWith(
          'https://api.twitter.com/2/tweets',
          {
            text: postData.content,
            media: {
              media_ids: ['twitter-media-123'],
            },
          },
          expect.any(Object)
        );
      });
    });

    describe('OAuth 1.0a Authentication', () => {
      it('should generate valid OAuth header', () => {
        const method = 'POST';
        const url = 'https://api.twitter.com/2/tweets';
        const params = { text: 'Test tweet' };

        const header = xService.generateOAuthHeader(method, url, params, mockTokens);

        expect(header).toMatch(/^OAuth /);
        expect(header).toContain('oauth_consumer_key=');
        expect(header).toContain('oauth_token=');
        expect(header).toContain('oauth_signature_method="HMAC-SHA1"');
        expect(header).toContain('oauth_signature=');
      });

      it('should generate consistent signatures for identical requests', () => {
        const method = 'POST';
        const url = 'https://api.twitter.com/2/tweets';
        const params = { text: 'Consistent tweet' };
        
        // Mock timestamp and nonce for consistency
        jest.spyOn(Date, 'now').mockReturnValue(1234567890000);
        jest.spyOn(xService, 'generateNonce').mockReturnValue('fixed-nonce');

        const header1 = xService.generateOAuthHeader(method, url, params, mockTokens);
        const header2 = xService.generateOAuthHeader(method, url, params, mockTokens);

        expect(header1).toBe(header2);

        // Restore mocks
        Date.now.mockRestore();
        xService.generateNonce.mockRestore();
      });
    });
  });

  describe('Cross-Platform Publishing', () => {
    it('should publish to multiple platforms simultaneously', async () => {
      const postData = {
        content: 'Cross-platform test post',
        userId: 'user-123',
        platforms: ['linkedin', 'twitter'],
      };

      const mockLinkedInUser = TestUtils.createMockUser({
        id: postData.userId,
        linkedinTokens: {
          access_token: 'linkedin-token',
          profile_id: 'linkedin-profile',
        },
      });

      const mockTwitterUser = TestUtils.createMockUser({
        id: postData.userId,
        twitterTokens: {
          access_token: 'twitter-token',
          access_token_secret: 'twitter-secret',
        },
      });

      const mockLinkedInResponse = {
        status: 201,
        data: {
          id: 'linkedin-cross-post-123',
          shareUrl: 'https://linkedin.com/post/123',
        },
      };

      const mockTwitterResponse = {
        status: 201,
        data: {
          data: {
            id: 'twitter-cross-post-123',
            text: postData.content,
          },
        },
      };

      // Setup user queries for both platforms
      query
        .mockResolvedValueOnce(TestUtils.createMockQueryResult([mockLinkedInUser])) // LinkedIn user lookup
        .mockResolvedValueOnce(TestUtils.createMockQueryResult([mockTwitterUser])); // Twitter user lookup

      // Setup platform API responses
      axios.post
        .mockResolvedValueOnce(mockLinkedInResponse) // LinkedIn publish
        .mockResolvedValueOnce(mockTwitterResponse); // Twitter publish

      // Publish to both platforms
      const linkedInResult = await linkedInService.publishPost(postData);
      const twitterResult = await xService.publishPost(postData);

      // Verify both succeeded
      expect(linkedInResult.success).toBe(true);
      expect(linkedInResult.platformPostId).toBe('linkedin-cross-post-123');

      expect(twitterResult.success).toBe(true);
      expect(twitterResult.platformPostId).toBe('twitter-cross-post-123');

      // Verify both platforms were called
      expect(axios.post).toHaveBeenCalledWith(
        'https://api.linkedin.com/v2/ugcPosts',
        expect.any(Object),
        expect.any(Object)
      );
      expect(axios.post).toHaveBeenCalledWith(
        'https://api.twitter.com/2/tweets',
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should handle mixed success and failure across platforms', async () => {
      const postData = {
        content: 'Mixed result test post',
        userId: 'user-123',
      };

      const mockUser = TestUtils.createMockUser({
        id: postData.userId,
        linkedinTokens: { access_token: 'linkedin-token', profile_id: 'profile' },
        twitterTokens: { access_token: 'twitter-token', access_token_secret: 'secret' },
      });

      const mockLinkedInSuccess = {
        status: 201,
        data: { id: 'linkedin-success-123' },
      };

      const mockTwitterError = {
        response: {
          status: 429,
          data: { errors: [{ message: 'Rate limit exceeded' }] },
        },
      };

      query.mockResolvedValue(TestUtils.createMockQueryResult([mockUser]));

      axios.post
        .mockResolvedValueOnce(mockLinkedInSuccess) // LinkedIn succeeds
        .mockRejectedValueOnce(mockTwitterError); // Twitter fails

      const linkedInResult = await linkedInService.publishPost(postData);
      const twitterResult = await xService.publishPost(postData);

      expect(linkedInResult.success).toBe(true);
      expect(twitterResult.success).toBe(false);
      expect(twitterResult.error).toContain('Rate limit exceeded');
    });
  });

  describe('Platform Validation', () => {
    it('should validate content length for each platform', () => {
      const shortContent = 'Short post';
      const longLinkedInContent = 'x'.repeat(3001); // Exceeds LinkedIn limit
      const longTwitterContent = 'x'.repeat(281); // Exceeds Twitter limit

      // Valid content should pass for both
      expect(() => linkedInService.validatePost({ content: shortContent, userId: 'user' }))
        .not.toThrow();
      expect(() => xService.validatePost({ content: shortContent, userId: 'user' }))
        .not.toThrow();

      // LinkedIn long content should fail
      expect(() => linkedInService.validatePost({ content: longLinkedInContent, userId: 'user' }))
        .toThrow('exceeds maximum length');

      // Twitter long content should fail
      expect(() => xService.validatePost({ content: longTwitterContent, userId: 'user' }))
        .toThrow('exceeds maximum length');
    });

    it('should validate required fields for both platforms', () => {
      // Missing content
      expect(() => linkedInService.validatePost({ userId: 'user' }))
        .toThrow('Content is required');
      expect(() => xService.validatePost({ userId: 'user' }))
        .toThrow('Content is required');

      // Missing userId
      expect(() => linkedInService.validatePost({ content: 'test' }))
        .toThrow('User ID is required');
      expect(() => xService.validatePost({ content: 'test' }))
        .toThrow('User ID is required');

      // Empty content
      expect(() => linkedInService.validatePost({ content: '', userId: 'user' }))
        .toThrow('Content cannot be empty');
      expect(() => xService.validatePost({ content: '', userId: 'user' }))
        .toThrow('Content cannot be empty');
    });
  });
});