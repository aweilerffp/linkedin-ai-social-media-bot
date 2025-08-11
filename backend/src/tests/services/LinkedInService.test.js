import { jest } from '@jest/globals';
import { LinkedInService } from '../../services/platforms/LinkedInService.js';
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

describe('LinkedInService', () => {
  let linkedInService;

  beforeEach(() => {
    linkedInService = new LinkedInService();
    jest.clearAllMocks();
  });

  describe('publishPost', () => {
    const mockTokens = {
      access_token: 'linkedin-access-token',
      profile_id: 'linkedin-profile-123',
    };
    const postData = {
      content: 'Test LinkedIn post content',
      userId: 'user-123',
      teamId: 'team-123',
    };

    it('should publish text post successfully', async () => {
      const mockUser = TestUtils.createMockUser({
        id: postData.userId,
        linkedinTokens: mockTokens,
      });

      const mockResponse = {
        status: 201,
        data: {
          id: 'linkedin-post-123',
          shareUrl: 'https://linkedin.com/feed/update/linkedin-post-123',
        },
      };

      query.mockResolvedValue(TestUtils.createMockQueryResult([mockUser]));
      axios.post.mockResolvedValue(mockResponse);

      const result = await linkedInService.publishPost(postData);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [postData.userId]
      );

      expect(axios.post).toHaveBeenCalledWith(
        'https://api.linkedin.com/v2/ugcPosts',
        expect.objectContaining({
          author: `urn:li:person:${mockTokens.profile_id}`,
          lifecycleState: 'PUBLISHED',
          specificContent: {
            'com.linkedin.ugc.ShareContent': {
              shareCommentary: {
                text: postData.content,
              },
              shareMediaCategory: 'NONE',
            },
          },
          visibility: {
            'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
          },
        }),
        {
          headers: {
            'Authorization': `Bearer ${mockTokens.access_token}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
          },
        }
      );

      expect(result).toEqual({
        success: true,
        platformPostId: 'linkedin-post-123',
        url: 'https://linkedin.com/feed/update/linkedin-post-123',
        platform: 'linkedin',
      });
    });

    it('should publish post with image successfully', async () => {
      const postDataWithImage = {
        ...postData,
        imageUrl: 'https://example.com/image.jpg',
      };

      const mockUser = TestUtils.createMockUser({
        id: postData.userId,
        linkedinTokens: mockTokens,
      });

      const mockUploadResponse = {
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

      const mockImageResponse = {
        data: Buffer.from('fake-image-data'),
        headers: { 'content-type': 'image/jpeg' },
      };

      const mockPublishResponse = {
        status: 201,
        data: {
          id: 'linkedin-post-123',
          shareUrl: 'https://linkedin.com/feed/update/linkedin-post-123',
        },
      };

      query.mockResolvedValue(TestUtils.createMockQueryResult([mockUser]));
      axios.post
        .mockResolvedValueOnce(mockUploadResponse) // Initialize upload
        .mockResolvedValueOnce({ status: 201 }) // Upload image
        .mockResolvedValueOnce(mockPublishResponse); // Publish post
      
      axios.get.mockResolvedValue(mockImageResponse); // Download image
      axios.put.mockResolvedValue({ status: 201 }); // Upload to LinkedIn

      const result = await linkedInService.publishPost(postDataWithImage);

      expect(result.success).toBe(true);
      expect(result.platformPostId).toBe('linkedin-post-123');
    });

    it('should handle user not found', async () => {
      query.mockResolvedValue(TestUtils.createMockQueryResult([]));

      const result = await linkedInService.publishPost(postData);

      expect(result).toEqual({
        success: false,
        error: 'User not found',
        platform: 'linkedin',
      });
    });

    it('should handle missing LinkedIn tokens', async () => {
      const mockUser = TestUtils.createMockUser({
        id: postData.userId,
        linkedinTokens: null,
      });

      query.mockResolvedValue(TestUtils.createMockQueryResult([mockUser]));

      const result = await linkedInService.publishPost(postData);

      expect(result).toEqual({
        success: false,
        error: 'LinkedIn account not connected',
        platform: 'linkedin',
      });
    });

    it('should handle API errors', async () => {
      const mockUser = TestUtils.createMockUser({
        id: postData.userId,
        linkedinTokens: mockTokens,
      });

      const mockError = {
        response: {
          status: 401,
          data: {
            message: 'Unauthorized',
          },
        },
      };

      query.mockResolvedValue(TestUtils.createMockQueryResult([mockUser]));
      axios.post.mockRejectedValue(mockError);

      const result = await linkedInService.publishPost(postData);

      expect(result).toEqual({
        success: false,
        error: 'LinkedIn API error: Unauthorized',
        statusCode: 401,
        platform: 'linkedin',
      });
    });

    it('should handle network errors', async () => {
      const mockUser = TestUtils.createMockUser({
        id: postData.userId,
        linkedinTokens: mockTokens,
      });

      const mockError = {
        code: 'ECONNREFUSED',
        message: 'Connection refused',
      };

      query.mockResolvedValue(TestUtils.createMockQueryResult([mockUser]));
      axios.post.mockRejectedValue(mockError);

      const result = await linkedInService.publishPost(postData);

      expect(result).toEqual({
        success: false,
        error: 'Connection refused',
        platform: 'linkedin',
      });
    });
  });

  describe('uploadImage', () => {
    const mockTokens = {
      access_token: 'linkedin-access-token',
      profile_id: 'linkedin-profile-123',
    };
    const imageUrl = 'https://example.com/image.jpg';

    it('should upload image successfully', async () => {
      const mockInitResponse = {
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

      const mockImageResponse = {
        data: Buffer.from('fake-image-data'),
        headers: { 'content-type': 'image/jpeg' },
      };

      axios.post.mockResolvedValue(mockInitResponse);
      axios.get.mockResolvedValue(mockImageResponse);
      axios.put.mockResolvedValue({ status: 201 });

      const result = await linkedInService.uploadImage(imageUrl, mockTokens.access_token, mockTokens.profile_id);

      expect(axios.post).toHaveBeenCalledWith(
        'https://api.linkedin.com/v2/assets?action=registerUpload',
        expect.objectContaining({
          registerUploadRequest: {
            recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
            owner: `urn:li:person:${mockTokens.profile_id}`,
            serviceRelationships: [{
              relationshipType: 'OWNER',
              identifier: 'urn:li:userGeneratedContent',
            }],
          },
        }),
        expect.any(Object)
      );

      expect(axios.get).toHaveBeenCalledWith(imageUrl, { responseType: 'arraybuffer' });
      expect(axios.put).toHaveBeenCalledWith(
        'https://linkedin-upload-url',
        expect.any(Buffer),
        expect.any(Object)
      );

      expect(result).toBe('urn:li:digitalmediaAsset:linkedin-asset-123');
    });

    it('should handle upload initialization failure', async () => {
      const mockError = {
        response: { status: 400 },
        message: 'Bad request',
      };

      axios.post.mockRejectedValue(mockError);

      await expect(linkedInService.uploadImage(imageUrl, mockTokens.access_token, mockTokens.profile_id))
        .rejects.toThrow('Failed to initialize LinkedIn image upload');
    });

    it('should handle image download failure', async () => {
      const mockInitResponse = {
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

      axios.post.mockResolvedValue(mockInitResponse);
      axios.get.mockRejectedValue(new Error('Failed to download image'));

      await expect(linkedInService.uploadImage(imageUrl, mockTokens.access_token, mockTokens.profile_id))
        .rejects.toThrow('Failed to download image from URL');
    });
  });

  describe('validatePost', () => {
    it('should validate valid post data', () => {
      const validData = {
        content: 'Valid LinkedIn post content',
        userId: 'user-123',
      };

      expect(() => linkedInService.validatePost(validData)).not.toThrow();
    });

    it('should throw error for missing content', () => {
      const invalidData = {
        userId: 'user-123',
      };

      expect(() => linkedInService.validatePost(invalidData))
        .toThrow('Content is required');
    });

    it('should throw error for empty content', () => {
      const invalidData = {
        content: '',
        userId: 'user-123',
      };

      expect(() => linkedInService.validatePost(invalidData))
        .toThrow('Content cannot be empty');
    });

    it('should throw error for content too long', () => {
      const invalidData = {
        content: 'x'.repeat(3001), // LinkedIn limit is 3000
        userId: 'user-123',
      };

      expect(() => linkedInService.validatePost(invalidData))
        .toThrow('Content exceeds maximum length of 3000 characters');
    });

    it('should throw error for missing userId', () => {
      const invalidData = {
        content: 'Valid content',
      };

      expect(() => linkedInService.validatePost(invalidData))
        .toThrow('User ID is required');
    });
  });

  describe('formatError', () => {
    it('should format API error with response', () => {
      const error = {
        response: {
          status: 400,
          data: {
            message: 'Invalid request',
            serviceErrorCode: 100,
          },
        },
      };

      const result = linkedInService.formatError(error);

      expect(result).toEqual({
        success: false,
        error: 'LinkedIn API error: Invalid request',
        statusCode: 400,
        platform: 'linkedin',
      });
    });

    it('should format network error', () => {
      const error = {
        code: 'ECONNABORTED',
        message: 'Request timeout',
      };

      const result = linkedInService.formatError(error);

      expect(result).toEqual({
        success: false,
        error: 'Request timeout',
        platform: 'linkedin',
      });
    });

    it('should format unknown error', () => {
      const error = {
        message: 'Unknown error',
      };

      const result = linkedInService.formatError(error);

      expect(result).toEqual({
        success: false,
        error: 'Unknown error',
        platform: 'linkedin',
      });
    });

    it('should handle error without message', () => {
      const error = {};

      const result = linkedInService.formatError(error);

      expect(result).toEqual({
        success: false,
        error: 'Unknown LinkedIn error',
        platform: 'linkedin',
      });
    });
  });

  describe('refreshToken', () => {
    it('should refresh access token', async () => {
      const refreshToken = 'refresh-token-123';
      const mockResponse = {
        status: 200,
        data: {
          access_token: 'new-access-token',
          expires_in: 5184000,
        },
      };

      axios.post.mockResolvedValue(mockResponse);

      const result = await linkedInService.refreshToken(refreshToken);

      expect(axios.post).toHaveBeenCalledWith(
        'https://www.linkedin.com/oauth/v2/accessToken',
        expect.any(URLSearchParams),
        expect.any(Object)
      );

      expect(result).toEqual({
        access_token: 'new-access-token',
        expires_in: 5184000,
      });
    });

    it('should handle refresh token failure', async () => {
      const refreshToken = 'invalid-refresh-token';
      const mockError = {
        response: {
          status: 400,
          data: {
            error: 'invalid_grant',
            error_description: 'Invalid refresh token',
          },
        },
      };

      axios.post.mockRejectedValue(mockError);

      await expect(linkedInService.refreshToken(refreshToken))
        .rejects.toThrow('Failed to refresh LinkedIn token');
    });
  });
});