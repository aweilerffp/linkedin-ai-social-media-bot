import { LinkedInService } from './LinkedInService.js';
import { XService } from './XService.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { logger } from '../../utils/logger.js';

export class PlatformFactory {
  static supportedPlatforms = {
    linkedin: LinkedInService,
    twitter: XService,
    x: XService, // Alias for twitter
  };

  /**
   * Create a platform service instance
   * @param {string} platform - Platform name (linkedin, twitter, x)
   * @param {object} credentials - Platform credentials
   * @returns {BasePlatform} Platform service instance
   */
  static createService(platform, credentials) {
    const normalizedPlatform = platform.toLowerCase();
    
    if (!this.supportedPlatforms[normalizedPlatform]) {
      throw new ApiError(400, `Unsupported platform: ${platform}`);
    }

    if (!credentials) {
      throw new ApiError(400, `Credentials required for platform: ${platform}`);
    }

    try {
      const ServiceClass = this.supportedPlatforms[normalizedPlatform];
      return new ServiceClass(credentials);
    } catch (error) {
      logger.error(`Failed to create ${platform} service:`, error);
      throw new ApiError(500, `Failed to initialize ${platform} service`);
    }
  }

  /**
   * Get list of supported platforms
   * @returns {string[]} Array of supported platform names
   */
  static getSupportedPlatforms() {
    return Object.keys(this.supportedPlatforms).filter(platform => platform !== 'x');
  }

  /**
   * Check if a platform is supported
   * @param {string} platform - Platform name to check
   * @returns {boolean} True if platform is supported
   */
  static isPlatformSupported(platform) {
    return Object.prototype.hasOwnProperty.call(
      this.supportedPlatforms,
      platform.toLowerCase()
    );
  }

  /**
   * Create multiple platform services from credentials array
   * @param {Array} platformCredentials - Array of {platform, credentials} objects
   * @returns {Map} Map of platform name to service instance
   */
  static createMultipleServices(platformCredentials) {
    const services = new Map();
    
    for (const { platform, credentials } of platformCredentials) {
      if (credentials && credentials.is_active) {
        try {
          const service = this.createService(platform, credentials);
          services.set(platform, service);
        } catch (error) {
          logger.warn(`Failed to create service for ${platform}:`, error.message);
        }
      }
    }
    
    return services;
  }

  /**
   * Validate credentials for a platform without creating a service
   * @param {string} platform - Platform name
   * @param {object} credentials - Platform credentials
   * @returns {Promise<boolean>} True if credentials are valid
   */
  static async validateCredentials(platform, credentials) {
    try {
      const service = this.createService(platform, credentials);
      return await service.validateCredentials();
    } catch (error) {
      logger.error(`Credential validation failed for ${platform}:`, error);
      return false;
    }
  }

  /**
   * Get platform-specific configuration
   * @param {string} platform - Platform name
   * @returns {object} Platform configuration
   */
  static getPlatformConfig(platform) {
    const configs = {
      linkedin: {
        displayName: 'LinkedIn',
        color: '#0077b5',
        maxContentLength: 3000,
        supportsMedia: true,
        supportsThreads: false,
        supportsScheduling: true,
        mediaTypes: ['image/jpeg', 'image/png', 'image/gif'],
        maxMediaSize: 100 * 1024 * 1024, // 100MB
        rateLimits: {
          requests: 500,
          window: '24h',
          postsPerDay: 150,
        },
      },
      twitter: {
        displayName: 'X (Twitter)',
        color: '#1da1f2',
        maxContentLength: 280,
        supportsMedia: true,
        supportsThreads: true,
        supportsScheduling: true,
        mediaTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4'],
        maxMediaSize: 5 * 1024 * 1024, // 5MB for images
        rateLimits: {
          requests: 300,
          window: '15min',
          postsPerDay: 2400,
        },
      },
    };

    const normalizedPlatform = platform.toLowerCase() === 'x' ? 'twitter' : platform.toLowerCase();
    return configs[normalizedPlatform] || null;
  }

  /**
   * Get OAuth URLs for platform authentication
   * @param {string} platform - Platform name
   * @param {string} callbackUrl - OAuth callback URL
   * @returns {object} OAuth URLs and configuration
   */
  static getOAuthConfig(platform, callbackUrl) {
    const normalizedPlatform = platform.toLowerCase() === 'x' ? 'twitter' : platform.toLowerCase();
    
    const configs = {
      linkedin: {
        authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
        tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
        scope: 'r_liteprofile r_emailaddress w_member_social',
        responseType: 'code',
        clientId: process.env.LINKEDIN_CLIENT_ID,
      },
      twitter: {
        authUrl: 'https://api.twitter.com/oauth/authenticate',
        tokenUrl: 'https://api.twitter.com/oauth/access_token',
        requestTokenUrl: 'https://api.twitter.com/oauth/request_token',
        clientId: process.env.TWITTER_CLIENT_ID,
        clientSecret: process.env.TWITTER_CLIENT_SECRET,
      },
    };

    const config = configs[normalizedPlatform];
    if (!config) {
      throw new ApiError(400, `OAuth not supported for platform: ${platform}`);
    }

    return {
      ...config,
      callbackUrl,
    };
  }

  /**
   * Get platform-specific posting guidelines
   * @param {string} platform - Platform name
   * @returns {object} Posting guidelines and best practices
   */
  static getPostingGuidelines(platform) {
    const normalizedPlatform = platform.toLowerCase() === 'x' ? 'twitter' : platform.toLowerCase();
    
    const guidelines = {
      linkedin: {
        bestTimes: ['08:00', '09:00', '12:00', '17:00', '18:00'],
        contentTips: [
          'Professional tone works best',
          'Industry insights get high engagement',
          'Questions encourage discussion',
          'Use 1-3 hashtags maximum',
        ],
        imageSpecs: {
          recommended: { width: 1200, height: 627 },
          minimum: { width: 520, height: 272 },
          formats: ['JPG', 'PNG', 'GIF'],
        },
      },
      twitter: {
        bestTimes: ['09:00', '12:00', '15:00', '18:00', '21:00'],
        contentTips: [
          'Keep it concise and engaging',
          'Use relevant hashtags (1-2 per tweet)',
          'Threads work well for longer content',
          'Engage with your audience',
        ],
        imageSpecs: {
          recommended: { width: 1200, height: 675 },
          minimum: { width: 440, height: 220 },
          formats: ['JPG', 'PNG', 'GIF', 'WEBP'],
        },
      },
    };

    return guidelines[normalizedPlatform] || null;
  }
}