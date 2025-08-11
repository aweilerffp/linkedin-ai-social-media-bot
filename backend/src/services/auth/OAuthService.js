import axios from 'axios';
import crypto from 'crypto';
import OAuth from 'oauth-1.0a';
import { query } from '../../config/database.js';
import { PlatformFactory } from '../platforms/PlatformFactory.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { logger } from '../../utils/logger.js';

export class OAuthService {
  constructor() {
    this.oauthStates = new Map(); // In production, use Redis for this
    this.twitterOAuth = OAuth({
      consumer: {
        key: process.env.TWITTER_CLIENT_ID,
        secret: process.env.TWITTER_CLIENT_SECRET,
      },
      signature_method: 'HMAC-SHA1',
      hash_function(base_string, key) {
        return crypto
          .createHmac('sha1', key)
          .update(base_string)
          .digest('base64');
      },
    });
  }

  /**
   * Generate OAuth authorization URL
   */
  async generateAuthUrl(platform, teamId, callbackUrl) {
    const state = this.generateState();
    this.oauthStates.set(state, { platform, teamId, timestamp: Date.now() });

    // Clean up old states (older than 10 minutes)
    this.cleanupOldStates();

    const normalizedPlatform = platform.toLowerCase();

    switch (normalizedPlatform) {
      case 'linkedin':
        return this.generateLinkedInAuthUrl(state, callbackUrl);
      case 'twitter':
      case 'x':
        return await this.generateTwitterAuthUrl(state, callbackUrl);
      default:
        throw new ApiError(400, `Unsupported platform: ${platform}`);
    }
  }

  /**
   * Generate LinkedIn OAuth URL
   */
  generateLinkedInAuthUrl(state, callbackUrl) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.LINKEDIN_CLIENT_ID,
      redirect_uri: callbackUrl,
      state,
      scope: 'r_liteprofile r_emailaddress w_member_social',
    });

    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;

    return {
      authUrl,
      state,
      platform: 'linkedin',
    };
  }

  /**
   * Generate Twitter OAuth URL (OAuth 1.0a)
   */
  async generateTwitterAuthUrl(state, callbackUrl) {
    try {
      // Step 1: Get request token
      const requestTokenUrl = 'https://api.twitter.com/oauth/request_token';
      
      const requestData = {
        url: requestTokenUrl,
        method: 'POST',
        data: {
          oauth_callback: callbackUrl,
        },
      };

      const response = await axios.post(requestTokenUrl, new URLSearchParams({
        oauth_callback: callbackUrl,
      }), {
        headers: {
          ...this.twitterOAuth.toHeader(this.twitterOAuth.authorize(requestData)),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const responseParams = new URLSearchParams(response.data);
      const oauthToken = responseParams.get('oauth_token');
      const oauthTokenSecret = responseParams.get('oauth_token_secret');

      if (!oauthToken || !oauthTokenSecret) {
        throw new ApiError(500, 'Failed to get Twitter request token');
      }

      // Store token secret for later use
      this.oauthStates.set(state, {
        platform: 'twitter',
        oauthToken,
        oauthTokenSecret,
        timestamp: Date.now(),
      });

      const authUrl = `https://api.twitter.com/oauth/authenticate?oauth_token=${oauthToken}&state=${state}`;

      return {
        authUrl,
        state,
        platform: 'twitter',
        oauthToken,
      };
    } catch (error) {
      logger.error('Twitter OAuth request token error:', error);
      throw new ApiError(500, 'Failed to generate Twitter auth URL');
    }
  }

  /**
   * Handle OAuth callback
   */
  async handleCallback(platform, code, state, verifier = null) {
    const stateData = this.oauthStates.get(state);
    if (!stateData) {
      throw new ApiError(400, 'Invalid or expired OAuth state');
    }

    this.oauthStates.delete(state);

    const normalizedPlatform = platform.toLowerCase();

    switch (normalizedPlatform) {
      case 'linkedin':
        return await this.handleLinkedInCallback(code, stateData);
      case 'twitter':
      case 'x':
        return await this.handleTwitterCallback(code, verifier, stateData);
      default:
        throw new ApiError(400, `Unsupported platform: ${platform}`);
    }
  }

  /**
   * Handle LinkedIn OAuth callback
   */
  async handleLinkedInCallback(code, stateData) {
    try {
      // Exchange code for access token
      const tokenResponse = await axios.post(
        'https://www.linkedin.com/oauth/v2/accessToken',
        new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: process.env.LINKEDIN_CLIENT_ID,
          client_secret: process.env.LINKEDIN_CLIENT_SECRET,
          redirect_uri: process.env.LINKEDIN_CALLBACK_URL,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const { access_token, expires_in, refresh_token } = tokenResponse.data;

      // Get user profile
      const profileResponse = await axios.get(
        'https://api.linkedin.com/v2/people/~:(id,localizedFirstName,localizedLastName,profilePicture(displayImage~:playableStreams))',
        {
          headers: {
            Authorization: `Bearer ${access_token}`,
          },
        }
      );

      const profile = profileResponse.data;

      const credentials = {
        access_token,
        refresh_token,
        expires_at: new Date(Date.now() + expires_in * 1000),
        profile_data: profile,
      };

      // Store credentials in database
      await this.storePlatformCredentials('linkedin', stateData.teamId, credentials);

      logger.info('LinkedIn OAuth completed successfully', {
        teamId: stateData.teamId,
        profileId: profile.id,
      });

      return {
        platform: 'linkedin',
        profile,
        success: true,
      };
    } catch (error) {
      logger.error('LinkedIn OAuth callback error:', error);
      throw new ApiError(500, 'LinkedIn OAuth failed');
    }
  }

  /**
   * Handle Twitter OAuth callback (OAuth 1.0a)
   */
  async handleTwitterCallback(oauthToken, oauthVerifier, stateData) {
    try {
      // Exchange request token for access token
      const accessTokenUrl = 'https://api.twitter.com/oauth/access_token';
      
      const response = await axios.post(
        accessTokenUrl,
        new URLSearchParams({
          oauth_token: oauthToken,
          oauth_verifier: oauthVerifier,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const responseParams = new URLSearchParams(response.data);
      const accessToken = responseParams.get('oauth_token');
      const tokenSecret = responseParams.get('oauth_token_secret');
      const userId = responseParams.get('user_id');
      const screenName = responseParams.get('screen_name');

      if (!accessToken || !tokenSecret) {
        throw new ApiError(500, 'Failed to get Twitter access token');
      }

      // Get user profile
      const userResponse = await axios.get(
        `https://api.twitter.com/2/users/${userId}?user.fields=id,name,username,profile_image_url,public_metrics`,
        {
          headers: {
            Authorization: `Bearer ${process.env.TWITTER_BEARER_TOKEN}`,
          },
        }
      );

      const profile = userResponse.data.data;

      const credentials = {
        access_token: accessToken,
        token_secret: tokenSecret,
        user_id: userId,
        screen_name: screenName,
        profile_data: profile,
      };

      // Store credentials in database
      await this.storePlatformCredentials('twitter', stateData.teamId, credentials);

      logger.info('Twitter OAuth completed successfully', {
        teamId: stateData.teamId,
        userId,
        screenName,
      });

      return {
        platform: 'twitter',
        profile,
        success: true,
      };
    } catch (error) {
      logger.error('Twitter OAuth callback error:', error);
      throw new ApiError(500, 'Twitter OAuth failed');
    }
  }

  /**
   * Store platform credentials in database
   */
  async storePlatformCredentials(platform, teamId, credentials) {
    try {
      // Check if credentials already exist for this team and platform
      const existingResult = await query(
        'SELECT id FROM platform_credentials WHERE team_id = $1 AND platform = $2',
        [teamId, platform]
      );

      if (existingResult.rows.length > 0) {
        // Update existing credentials
        await query(
          `UPDATE platform_credentials 
           SET access_token = $1, refresh_token = $2, expires_at = $3, 
               profile_data = $4, is_active = true, updated_at = NOW()
           WHERE team_id = $5 AND platform = $6`,
          [
            credentials.access_token,
            credentials.refresh_token || credentials.token_secret,
            credentials.expires_at || null,
            JSON.stringify(credentials.profile_data),
            teamId,
            platform,
          ]
        );
      } else {
        // Insert new credentials
        await query(
          `INSERT INTO platform_credentials 
           (team_id, platform, access_token, refresh_token, expires_at, profile_data, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, true)`,
          [
            teamId,
            platform,
            credentials.access_token,
            credentials.refresh_token || credentials.token_secret,
            credentials.expires_at || null,
            JSON.stringify(credentials.profile_data),
          ]
        );
      }

      logger.info('Platform credentials stored successfully', {
        platform,
        teamId,
      });
    } catch (error) {
      logger.error('Failed to store platform credentials:', error);
      throw new ApiError(500, 'Failed to store platform credentials');
    }
  }

  /**
   * Get platform credentials for a team
   */
  async getPlatformCredentials(teamId, platform = null) {
    try {
      let queryText = 'SELECT * FROM platform_credentials WHERE team_id = $1 AND is_active = true';
      const params = [teamId];

      if (platform) {
        queryText += ' AND platform = $2';
        params.push(platform);
      }

      const result = await query(queryText, params);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get platform credentials:', error);
      throw new ApiError(500, 'Failed to retrieve platform credentials');
    }
  }

  /**
   * Disconnect platform
   */
  async disconnectPlatform(teamId, platform) {
    try {
      const result = await query(
        'UPDATE platform_credentials SET is_active = false WHERE team_id = $1 AND platform = $2 RETURNING *',
        [teamId, platform]
      );

      if (result.rows.length === 0) {
        throw new ApiError(404, 'Platform connection not found');
      }

      logger.info('Platform disconnected successfully', {
        platform,
        teamId,
      });

      return { message: 'Platform disconnected successfully' };
    } catch (error) {
      logger.error('Failed to disconnect platform:', error);
      throw new ApiError(500, 'Failed to disconnect platform');
    }
  }

  /**
   * Refresh platform credentials
   */
  async refreshPlatformCredentials(teamId, platform) {
    try {
      const credentials = await this.getPlatformCredentials(teamId, platform);
      if (credentials.length === 0) {
        throw new ApiError(404, 'Platform credentials not found');
      }

      const creds = credentials[0];
      const service = PlatformFactory.createService(platform, creds);
      
      const refreshedCreds = await service.refreshToken();
      
      await query(
        `UPDATE platform_credentials 
         SET access_token = $1, refresh_token = $2, expires_at = $3, updated_at = NOW()
         WHERE team_id = $4 AND platform = $5`,
        [
          refreshedCreds.access_token,
          refreshedCreds.refresh_token,
          refreshedCreds.expires_at,
          teamId,
          platform,
        ]
      );

      logger.info('Platform credentials refreshed successfully', {
        platform,
        teamId,
      });

      return { message: 'Credentials refreshed successfully' };
    } catch (error) {
      logger.error('Failed to refresh platform credentials:', error);
      throw new ApiError(500, 'Failed to refresh credentials');
    }
  }

  /**
   * Generate random state for OAuth
   */
  generateState() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Clean up old OAuth states
   */
  cleanupOldStates() {
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    
    for (const [state, data] of this.oauthStates.entries()) {
      if (data.timestamp < tenMinutesAgo) {
        this.oauthStates.delete(state);
      }
    }
  }

  /**
   * Test platform connection
   */
  async testPlatformConnection(teamId, platform) {
    try {
      const credentials = await this.getPlatformCredentials(teamId, platform);
      if (credentials.length === 0) {
        throw new ApiError(404, 'Platform not connected');
      }

      const service = PlatformFactory.createService(platform, credentials[0]);
      const isValid = await service.validateCredentials();

      return {
        platform,
        connected: isValid,
        profile: credentials[0].profile_data,
      };
    } catch (error) {
      logger.error('Platform connection test failed:', error);
      return {
        platform,
        connected: false,
        error: error.message,
      };
    }
  }
}