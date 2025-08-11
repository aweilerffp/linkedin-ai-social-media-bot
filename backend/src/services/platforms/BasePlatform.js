import { ApiError } from '../../middleware/errorHandler.js';
import { logger } from '../../utils/logger.js';

export class BasePlatform {
  constructor(credentials) {
    this.credentials = credentials;
    this.platformName = this.constructor.name.replace('Service', '').toLowerCase();
  }

  /**
   * Abstract methods that must be implemented by platform-specific services
   */
  
  async authenticate() {
    throw new Error('authenticate() must be implemented by platform service');
  }

  async refreshToken() {
    throw new Error('refreshToken() must be implemented by platform service');
  }

  async validateCredentials() {
    throw new Error('validateCredentials() must be implemented by platform service');
  }

  async post(content, options = {}) {
    throw new Error('post() must be implemented by platform service');
  }

  async uploadMedia(mediaBuffer, mimeType) {
    throw new Error('uploadMedia() must be implemented by platform service');
  }

  async getProfile() {
    throw new Error('getProfile() must be implemented by platform service');
  }

  async deletePost(postId) {
    throw new Error('deletePost() must be implemented by platform service');
  }

  /**
   * Common utility methods available to all platforms
   */

  isTokenExpired() {
    if (!this.credentials.expires_at) {
      return false; // Token doesn't expire
    }
    return new Date() >= new Date(this.credentials.expires_at);
  }

  async ensureValidToken() {
    if (this.isTokenExpired()) {
      logger.info(`Token expired for ${this.platformName}, refreshing...`);
      await this.refreshToken();
    }
  }

  formatContent(content, maxLength = null) {
    if (!maxLength) return content;
    
    if (content.length <= maxLength) {
      return content;
    }
    
    // Truncate and add ellipsis, but try to break at word boundaries
    const truncated = content.substring(0, maxLength - 3);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > maxLength * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    }
    
    return truncated + '...';
  }

  extractHashtags(content) {
    const hashtags = content.match(/#[\w]+/g);
    return hashtags ? hashtags.map(tag => tag.replace('#', '')) : [];
  }

  extractMentions(content) {
    const mentions = content.match(/@[\w]+/g);
    return mentions ? mentions.map(mention => mention.replace('@', '')) : [];
  }

  async handleApiError(error, operation) {
    logger.error(`${this.platformName} API error during ${operation}:`, {
      error: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
    });

    // Map platform-specific errors to our standard errors
    if (error.response) {
      const status = error.response.status;
      
      switch (status) {
        case 401:
          throw new ApiError(401, `Authentication failed for ${this.platformName}`);
        case 403:
          throw new ApiError(403, `Access forbidden for ${this.platformName}`);
        case 429:
          throw new ApiError(429, `Rate limit exceeded for ${this.platformName}`);
        case 500:
        case 502:
        case 503:
        case 504:
          throw new ApiError(503, `${this.platformName} service temporarily unavailable`);
        default:
          throw new ApiError(400, `${this.platformName} API error: ${error.message}`);
      }
    }

    throw new ApiError(500, `Unexpected error with ${this.platformName}: ${error.message}`);
  }

  async retryWithBackoff(operation, maxRetries = 3, baseDelay = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }

        // Don't retry certain error types
        if (error.statusCode && [400, 401, 403, 404].includes(error.statusCode)) {
          throw error;
        }

        const delay = baseDelay * Math.pow(2, attempt - 1);
        logger.warn(`${this.platformName} operation failed, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  validatePostContent(content, mediaUrls = []) {
    if (!content && (!mediaUrls || mediaUrls.length === 0)) {
      throw new ApiError(400, 'Post must contain either content or media');
    }

    if (content && typeof content !== 'string') {
      throw new ApiError(400, 'Post content must be a string');
    }

    if (mediaUrls && !Array.isArray(mediaUrls)) {
      throw new ApiError(400, 'Media URLs must be an array');
    }
  }

  async logPostAttempt(postId, success, error = null) {
    const logData = {
      platform: this.platformName,
      postId,
      success,
      timestamp: new Date().toISOString(),
    };

    if (error) {
      logData.error = error.message;
      logData.stack = error.stack;
    }

    if (success) {
      logger.info(`Successfully posted to ${this.platformName}`, logData);
    } else {
      logger.error(`Failed to post to ${this.platformName}`, logData);
    }
  }

  // Rate limiting helpers
  getRateLimitInfo() {
    // Each platform should override this to return platform-specific rate limits
    return {
      requests: 100,
      window: '15min',
      burst: 10,
    };
  }

  async checkRateLimit() {
    // This would integrate with our rate limiting service
    // For now, just a placeholder
    return true;
  }

  // Media processing helpers
  getMaxImageSize() {
    // Default max image size (10MB)
    return 10 * 1024 * 1024;
  }

  getSupportedImageTypes() {
    return ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  }

  getSupportedVideoTypes() {
    return ['video/mp4', 'video/quicktime', 'video/avi'];
  }

  validateMediaType(mimeType) {
    const supportedTypes = [
      ...this.getSupportedImageTypes(),
      ...this.getSupportedVideoTypes(),
    ];
    
    if (!supportedTypes.includes(mimeType)) {
      throw new ApiError(400, `Unsupported media type: ${mimeType}`);
    }
  }

  async processImage(imageBuffer, options = {}) {
    // This would integrate with our image processing service (Sharp)
    // For now, just return the buffer
    return imageBuffer;
  }
}