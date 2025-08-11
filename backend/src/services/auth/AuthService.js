import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { User } from '../../models/User.js';
import { Team } from '../../models/Team.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { logger } from '../../utils/logger.js';

export class AuthService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET;
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
    this.jwtExpire = process.env.JWT_EXPIRE || '15m';
    this.jwtRefreshExpire = process.env.JWT_REFRESH_EXPIRE || '7d';

    if (!this.jwtSecret || !this.jwtRefreshSecret) {
      throw new Error('JWT secrets must be configured');
    }
  }

  /**
   * Generate JWT access token
   */
  generateAccessToken(user) {
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        teamId: user.teamId,
      },
      this.jwtSecret,
      {
        expiresIn: this.jwtExpire,
        issuer: 'social-media-poster',
        audience: 'social-media-poster-users',
      }
    );
  }

  /**
   * Generate JWT refresh token
   */
  generateRefreshToken(user) {
    return jwt.sign(
      {
        userId: user.id,
        tokenType: 'refresh',
      },
      this.jwtRefreshSecret,
      {
        expiresIn: this.jwtRefreshExpire,
        issuer: 'social-media-poster',
        audience: 'social-media-poster-users',
      }
    );
  }

  /**
   * Generate both access and refresh tokens
   */
  generateTokenPair(user) {
    return {
      accessToken: this.generateAccessToken(user),
      refreshToken: this.generateRefreshToken(user),
      expiresIn: this.jwtExpire,
    };
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret, {
        issuer: 'social-media-poster',
        audience: 'social-media-poster-users',
      });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new ApiError(401, 'Access token expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new ApiError(401, 'Invalid access token');
      }
      throw new ApiError(401, 'Token verification failed');
    }
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token) {
    try {
      const payload = jwt.verify(token, this.jwtRefreshSecret, {
        issuer: 'social-media-poster',
        audience: 'social-media-poster-users',
      });

      if (payload.tokenType !== 'refresh') {
        throw new ApiError(401, 'Invalid refresh token type');
      }

      return payload;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new ApiError(401, 'Refresh token expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new ApiError(401, 'Invalid refresh token');
      }
      throw new ApiError(401, 'Refresh token verification failed');
    }
  }

  /**
   * Register a new user
   */
  async register({ email, password, name, teamName = null }) {
    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      throw new ApiError(400, 'User already exists with this email');
    }

    // Create team if provided
    let team = null;
    if (teamName) {
      team = await Team.create({ name: teamName });
    }

    // Create user
    const user = await User.create({
      email,
      password,
      name,
      role: team ? 'admin' : 'member', // First user in team is admin
      teamId: team?.id,
    });

    logger.info('User registered successfully', {
      userId: user.id,
      email: user.email,
      teamId: team?.id,
    });

    const tokens = this.generateTokenPair(user);

    return {
      user: user.toSafeJSON(),
      team: team?.toJSON(),
      ...tokens,
    };
  }

  /**
   * Login user
   */
  async login({ email, password }) {
    const user = await User.findByEmail(email);
    if (!user) {
      throw new ApiError(401, 'Invalid email or password');
    }

    if (!user.isActive) {
      throw new ApiError(401, 'Account is deactivated');
    }

    const isValidPassword = await user.validatePassword(password);
    if (!isValidPassword) {
      throw new ApiError(401, 'Invalid email or password');
    }

    // Update last login
    await user.updateLastLogin();

    // Get team info if user belongs to a team
    const team = user.teamId ? await Team.findById(user.teamId) : null;

    const tokens = this.generateTokenPair(user);

    logger.info('User logged in successfully', {
      userId: user.id,
      email: user.email,
      teamId: user.teamId,
    });

    return {
      user: user.toSafeJSON(),
      team: team?.toJSON(),
      ...tokens,
    };
  }

  /**
   * Refresh access token
   */
  async refreshTokens(refreshToken) {
    const payload = this.verifyRefreshToken(refreshToken);
    
    const user = await User.findById(payload.userId);
    if (!user || !user.isActive) {
      throw new ApiError(401, 'User not found or inactive');
    }

    const tokens = this.generateTokenPair(user);

    logger.info('Tokens refreshed successfully', {
      userId: user.id,
      email: user.email,
    });

    return tokens;
  }

  /**
   * Change user password
   */
  async changePassword(userId, { currentPassword, newPassword }) {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const isValidPassword = await user.validatePassword(currentPassword);
    if (!isValidPassword) {
      throw new ApiError(400, 'Current password is incorrect');
    }

    await user.updatePassword(newPassword);

    logger.info('Password changed successfully', {
      userId: user.id,
      email: user.email,
    });

    return { message: 'Password changed successfully' };
  }

  /**
   * Request password reset (placeholder - would integrate with email service)
   */
  async requestPasswordReset(email) {
    const user = await User.findByEmail(email);
    if (!user) {
      // Don't reveal whether email exists
      return { message: 'If the email exists, a reset link has been sent' };
    }

    // Generate reset token
    const resetToken = jwt.sign(
      { userId: user.id, purpose: 'password-reset' },
      this.jwtSecret,
      { expiresIn: '1h' }
    );

    // TODO: Send email with reset link
    // For now, just log it
    logger.info('Password reset requested', {
      userId: user.id,
      email: user.email,
      resetToken, // In production, this would be sent via email
    });

    return { message: 'If the email exists, a reset link has been sent' };
  }

  /**
   * Reset password using reset token
   */
  async resetPassword(resetToken, newPassword) {
    try {
      const payload = jwt.verify(resetToken, this.jwtSecret);
      
      if (payload.purpose !== 'password-reset') {
        throw new ApiError(400, 'Invalid reset token');
      }

      const user = await User.findById(payload.userId);
      if (!user) {
        throw new ApiError(400, 'Invalid reset token');
      }

      await user.updatePassword(newPassword);

      logger.info('Password reset successfully', {
        userId: user.id,
        email: user.email,
      });

      return { message: 'Password reset successfully' };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new ApiError(400, 'Reset token has expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new ApiError(400, 'Invalid reset token');
      }
      throw error;
    }
  }

  /**
   * Validate user permissions
   */
  async validatePermissions(userId, requiredRole = 'member') {
    const user = await User.findById(userId);
    if (!user || !user.isActive) {
      throw new ApiError(401, 'User not found or inactive');
    }

    if (!user.hasPermission(requiredRole)) {
      throw new ApiError(403, 'Insufficient permissions');
    }

    return user;
  }

  /**
   * Invite user to team
   */
  async inviteUserToTeam(inviterId, { email, name, role = 'member' }) {
    const inviter = await User.findById(inviterId);
    if (!inviter || !inviter.hasPermission('manager')) {
      throw new ApiError(403, 'Only managers can invite users');
    }

    if (!inviter.teamId) {
      throw new ApiError(400, 'Inviter must belong to a team');
    }

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      throw new ApiError(400, 'User already exists with this email');
    }

    // Generate temporary password
    const tempPassword = this.generateRandomPassword();

    // Create user
    const user = await User.create({
      email,
      password: tempPassword,
      name,
      role,
      teamId: inviter.teamId,
    });

    // TODO: Send invitation email with temporary password
    // For now, just log it
    logger.info('User invited to team', {
      inviterId,
      newUserId: user.id,
      email: user.email,
      teamId: inviter.teamId,
      tempPassword, // In production, this would be sent via email
    });

    return {
      user: user.toSafeJSON(),
      tempPassword, // Remove this in production
      message: 'User invited successfully',
    };
  }

  /**
   * Generate random password for invitations
   */
  generateRandomPassword(length = 12) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  /**
   * Get user profile with team info
   */
  async getUserProfile(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const team = user.teamId ? await Team.findById(user.teamId) : null;

    return {
      user: user.toSafeJSON(),
      team: team?.toJSON(),
    };
  }
}