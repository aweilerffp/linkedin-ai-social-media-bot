import axios from 'axios';
import { BasePlatform } from './BasePlatform.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { logger } from '../../utils/logger.js';

export class LinkedInService extends BasePlatform {
  constructor(credentials) {
    super(credentials);
    this.baseURL = 'https://api.linkedin.com/v2';
    this.maxContentLength = 3000;
    
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.credentials.access_token}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });
  }

  async authenticate() {
    try {
      await this.ensureValidToken();
      const profile = await this.getProfile();
      
      logger.info('LinkedIn authentication successful', {
        profileId: profile.id,
        name: `${profile.localizedFirstName} ${profile.localizedLastName}`,
      });
      
      return true;
    } catch (error) {
      return this.handleApiError(error, 'authentication');
    }
  }

  async refreshToken() {
    if (!this.credentials.refresh_token) {
      throw new ApiError(401, 'No refresh token available for LinkedIn');
    }

    try {
      const response = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', {
        grant_type: 'refresh_token',
        refresh_token: this.credentials.refresh_token,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET,
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      this.credentials.access_token = response.data.access_token;
      this.credentials.expires_at = new Date(Date.now() + response.data.expires_in * 1000);
      
      // Update authorization header
      this.client.defaults.headers['Authorization'] = `Bearer ${this.credentials.access_token}`;
      
      logger.info('LinkedIn token refreshed successfully');
      return this.credentials;
    } catch (error) {
      return this.handleApiError(error, 'token refresh');
    }
  }

  async validateCredentials() {
    try {
      await this.getProfile();
      return true;
    } catch (error) {
      logger.warn('LinkedIn credentials validation failed:', error.message);
      return false;
    }
  }

  async getProfile() {
    try {
      const response = await this.client.get('/people/~:(id,localizedFirstName,localizedLastName,profilePicture(displayImage~:playableStreams))');
      return response.data;
    } catch (error) {
      return this.handleApiError(error, 'get profile');
    }
  }

  async post(content, options = {}) {
    this.validatePostContent(content, options.mediaUrls);
    
    try {
      await this.ensureValidToken();
      
      const formattedContent = this.formatContent(content, this.maxContentLength);
      const profile = await this.getProfile();
      const authorUrn = `urn:li:person:${profile.id}`;

      let postData = {
        author: authorUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: formattedContent,
            },
            shareMediaCategory: options.mediaUrls?.length > 0 ? 'IMAGE' : 'NONE',
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
        },
      };

      // Handle media if provided
      if (options.mediaUrls?.length > 0) {
        const mediaAssets = await Promise.all(
          options.mediaUrls.map(url => this.uploadMediaFromUrl(url))
        );
        
        postData.specificContent['com.linkedin.ugc.ShareContent'].media = mediaAssets.map(asset => ({
          status: 'READY',
          description: {
            text: formattedContent,
          },
          media: asset.mediaUrn,
        }));
      }

      const response = await this.retryWithBackoff(async () => {
        return await this.client.post('/ugcPosts', postData);
      });

      const postId = this.extractPostIdFromUrn(response.data.id);
      
      await this.logPostAttempt(postId, true);
      
      return {
        platform: 'linkedin',
        platformPostId: postId,
        url: `https://linkedin.com/feed/update/${postId}`,
        postedAt: new Date().toISOString(),
      };
    } catch (error) {
      await this.logPostAttempt(null, false, error);
      return this.handleApiError(error, 'create post');
    }
  }

  async uploadMediaFromUrl(mediaUrl) {
    try {
      // First, register the media upload
      const profile = await this.getProfile();
      const authorUrn = `urn:li:person:${profile.id}`;
      
      const registerResponse = await this.client.post('/assets?action=registerUpload', {
        registerUploadRequest: {
          recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
          owner: authorUrn,
          serviceRelationships: [
            {
              relationshipType: 'OWNER',
              identifier: 'urn:li:userGeneratedContent',
            },
          ],
        },
      });

      const uploadUrl = registerResponse.data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
      const mediaUrn = registerResponse.data.value.asset;

      // Download the media
      const mediaResponse = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
      
      // Upload to LinkedIn
      await axios.put(uploadUrl, mediaResponse.data, {
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      });

      return { mediaUrn };
    } catch (error) {
      return this.handleApiError(error, 'media upload');
    }
  }

  async uploadMedia(mediaBuffer, mimeType) {
    this.validateMediaType(mimeType);
    
    if (mediaBuffer.length > this.getMaxImageSize()) {
      throw new ApiError(400, 'Media file too large');
    }

    try {
      const profile = await this.getProfile();
      const authorUrn = `urn:li:person:${profile.id}`;
      
      const registerResponse = await this.client.post('/assets?action=registerUpload', {
        registerUploadRequest: {
          recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
          owner: authorUrn,
          serviceRelationships: [
            {
              relationshipType: 'OWNER',
              identifier: 'urn:li:userGeneratedContent',
            },
          ],
        },
      });

      const uploadUrl = registerResponse.data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
      const mediaUrn = registerResponse.data.value.asset;

      await axios.put(uploadUrl, mediaBuffer, {
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      });

      return mediaUrn;
    } catch (error) {
      return this.handleApiError(error, 'media upload');
    }
  }

  async deletePost(postId) {
    try {
      await this.ensureValidToken();
      
      const urn = `urn:li:share:${postId}`;
      await this.client.delete(`/shares/${urn}`);
      
      logger.info('LinkedIn post deleted successfully', { postId });
      return true;
    } catch (error) {
      return this.handleApiError(error, 'delete post');
    }
  }

  extractPostIdFromUrn(urn) {
    // LinkedIn URNs are in format: urn:li:share:1234567890
    const matches = urn.match(/urn:li:share:(.+)/);
    return matches ? matches[1] : urn;
  }

  getRateLimitInfo() {
    return {
      requests: 500,
      window: '24h',
      burst: 100,
      postsPerDay: 150,
    };
  }

  getSupportedImageTypes() {
    return ['image/jpeg', 'image/png', 'image/gif'];
  }

  getSupportedVideoTypes() {
    return ['video/mp4'];
  }

  getMaxImageSize() {
    return 100 * 1024 * 1024; // 100MB for LinkedIn
  }

  async getPostAnalytics(postId) {
    try {
      await this.ensureValidToken();
      
      const urn = `urn:li:share:${postId}`;
      const response = await this.client.get(`/socialMetadata/${urn}`);
      
      return {
        platform: 'linkedin',
        postId,
        impressions: response.data.totalShareStatistics?.impressionCount || 0,
        engagements: response.data.totalShareStatistics?.shareCount || 0,
        likes: response.data.totalShareStatistics?.likeCount || 0,
        comments: response.data.totalShareStatistics?.commentCount || 0,
        clicks: response.data.totalShareStatistics?.clickCount || 0,
        shares: response.data.totalShareStatistics?.shareCount || 0,
      };
    } catch (error) {
      return this.handleApiError(error, 'get analytics');
    }
  }

  async getCompanyPages() {
    try {
      await this.ensureValidToken();
      
      const response = await this.client.get('/organizationAcls?q=roleAssignee&projection=(elements*(organizationalTarget~(id,localizedName,logoV2)))');
      
      return response.data.elements.map(element => ({
        id: element['organizationalTarget~'].id,
        name: element['organizationalTarget~'].localizedName,
        logo: element['organizationalTarget~'].logoV2,
      }));
    } catch (error) {
      logger.warn('Failed to fetch LinkedIn company pages:', error.message);
      return [];
    }
  }
}