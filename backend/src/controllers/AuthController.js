import { AuthService } from '../services/auth/AuthService.js';
import { OAuthService } from '../services/auth/OAuthService.js';
import { ApiError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { notifyWebhooks } from './WebhookController.js';

let authService;
let oauthService;

function getAuthService() {
  if (!authService) {
    authService = new AuthService();
  }
  return authService;
}

function getOAuthService() {
  if (!oauthService) {
    oauthService = new OAuthService();
  }
  return oauthService;
}

export class AuthController {
  /**
   * Register new user
   */
  static async register(req, res, next) {
    try {
      const { email, password, name, teamName } = req.body;

      if (!email || !password || !name) {
        throw new ApiError(400, 'Email, password, and name are required');
      }

      const result = await getAuthService().register({
        email: email.toLowerCase().trim(),
        password,
        name: name.trim(),
        teamName: teamName?.trim(),
      });

      res.status(201).json({
        success: true,
        data: result,
        message: 'User registered successfully',
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Login user
   */
  static async login(req, res, next) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        throw new ApiError(400, 'Email and password are required');
      }

      const result = await getAuthService().login({
        email: email.toLowerCase().trim(),
        password,
      });

      res.json({
        success: true,
        data: result,
        message: 'Login successful',
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Refresh access token
   */
  static async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        throw new ApiError(400, 'Refresh token is required');
      }

      const result = await getAuthService().refreshTokens(refreshToken);

      res.json({
        success: true,
        data: result,
        message: 'Tokens refreshed successfully',
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user profile
   */
  static async getProfile(req, res, next) {
    try {
      const profile = await getAuthService().getUserProfile(req.user.id);

      res.json({
        success: true,
        data: profile,
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Change password
   */
  static async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        throw new ApiError(400, 'Current password and new password are required');
      }

      if (newPassword.length < 8) {
        throw new ApiError(400, 'New password must be at least 8 characters long');
      }

      const result = await getAuthService().changePassword(req.user.id, {
        currentPassword,
        newPassword,
      });

      res.json({
        success: true,
        data: result,
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Request password reset
   */
  static async requestPasswordReset(req, res, next) {
    try {
      const { email } = req.body;

      if (!email) {
        throw new ApiError(400, 'Email is required');
      }

      const result = await getAuthService().requestPasswordReset(email.toLowerCase().trim());

      res.json({
        success: true,
        data: result,
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Reset password with token
   */
  static async resetPassword(req, res, next) {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        throw new ApiError(400, 'Reset token and new password are required');
      }

      if (newPassword.length < 8) {
        throw new ApiError(400, 'New password must be at least 8 characters long');
      }

      const result = await getAuthService().resetPassword(token, newPassword);

      res.json({
        success: true,
        data: result,
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Invite user to team
   */
  static async inviteUser(req, res, next) {
    try {
      const { email, name, role = 'member' } = req.body;
      const { teamId, id: inviterId } = req.user;

      if (!email || !name) {
        throw new ApiError(400, 'Email and name are required');
      }

      const result = await getAuthService().inviteUserToTeam(req.user.id, {
        email: email.toLowerCase().trim(),
        name: name.trim(),
        role,
      });

      // Send webhook notification for user invitation
      if (result.success) {
        await notifyWebhooks(teamId, 'user.invited', {
          invitationId: result.invitation?.id,
          email: email.toLowerCase().trim(),
          name: name.trim(),
          role,
          invitedBy: inviterId,
          invitedAt: new Date().toISOString(),
        }, inviterId);
      }

      res.status(201).json({
        success: true,
        data: result,
        message: 'User invited successfully',
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Start OAuth flow
   */
  static async startOAuth(req, res, next) {
    try {
      const { platform } = req.params;
      const { teamId } = req.user;

      const callbackUrl = `${process.env.FRONTEND_URL}/oauth/callback/${platform}`;
      
      const result = await getOAuthService().generateAuthUrl(platform, teamId, callbackUrl);

      res.json({
        success: true,
        data: result,
        message: 'OAuth URL generated successfully',
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Handle OAuth callback
   */
  static async handleOAuthCallback(req, res, next) {
    try {
      const { platform } = req.params;
      const { code, state, oauth_verifier } = req.query;

      if (!code || !state) {
        throw new ApiError(400, 'Missing OAuth parameters');
      }

      const result = await getOAuthService().handleCallback(
        platform, 
        code, 
        state, 
        oauth_verifier
      );

      // Send webhook notification for successful platform connection
      if (result.success && result.teamId && result.userId) {
        await notifyWebhooks(result.teamId, 'platform.connected', {
          platform,
          profileData: {
            id: result.profileData?.id,
            name: result.profileData?.name,
            username: result.profileData?.username,
          },
          connectedAt: new Date().toISOString(),
        }, result.userId);
      }

      res.json({
        success: true,
        data: result,
        message: 'OAuth completed successfully',
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get platform credentials
   */
  static async getPlatformCredentials(req, res, next) {
    try {
      const { teamId } = req.user;
      const { platform } = req.query;

      const credentials = await getOAuthService().getPlatformCredentials(teamId, platform);

      // Remove sensitive data
      const safeCredentials = credentials.map(cred => ({
        id: cred.id,
        platform: cred.platform,
        isActive: cred.is_active,
        profileData: cred.profile_data,
        createdAt: cred.created_at,
        expiresAt: cred.expires_at,
      }));

      res.json({
        success: true,
        data: safeCredentials,
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Disconnect platform
   */
  static async disconnectPlatform(req, res, next) {
    try {
      const { platform } = req.params;
      const { teamId, id: userId } = req.user;

      const result = await getOAuthService().disconnectPlatform(teamId, platform);

      // Send webhook notification for platform disconnection
      if (result.success) {
        await notifyWebhooks(teamId, 'platform.disconnected', {
          platform,
          disconnectedAt: new Date().toISOString(),
        }, userId);
      }

      res.json({
        success: true,
        data: result,
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Test platform connection
   */
  static async testConnection(req, res, next) {
    try {
      const { platform } = req.params;
      const { teamId } = req.user;

      const result = await getOAuthService().testPlatformConnection(teamId, platform);

      res.json({
        success: true,
        data: result,
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Refresh platform credentials
   */
  static async refreshPlatformCredentials(req, res, next) {
    try {
      const { platform } = req.params;
      const { teamId } = req.user;

      const result = await getOAuthService().refreshPlatformCredentials(teamId, platform);

      res.json({
        success: true,
        data: result,
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Logout (client-side token invalidation)
   */
  static async logout(req, res, next) {
    try {
      // In a real-world scenario, you might want to blacklist the token
      // For now, we'll just return success and let the client handle token removal
      
      logger.info('User logged out', {
        userId: req.user.id,
        email: req.user.email,
      });

      res.json({
        success: true,
        message: 'Logged out successfully',
      });

    } catch (error) {
      next(error);
    }
  }
}