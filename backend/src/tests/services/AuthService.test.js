import { jest } from '@jest/globals';
import { AuthService } from '../../services/auth/AuthService.js';
import { TestUtils } from '../helpers/testUtils.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('../../config/database.js', () => ({
  query: jest.fn(),
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(),
}));

jest.mock('../../utils/logger.js', () => ({
  logger: TestUtils.createMockLogger(),
}));

import { query } from '../../config/database.js';

describe('AuthService', () => {
  let authService;

  beforeEach(() => {
    authService = new AuthService();
    jest.clearAllMocks();
  });

  describe('register', () => {
    const mockUserData = {
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
      teamName: 'Test Team',
    };

    it('should register a new user successfully', async () => {
      const hashedPassword = 'hashed-password';
      const mockUser = TestUtils.createMockUser({
        email: mockUserData.email,
        name: mockUserData.name,
        passwordHash: hashedPassword,
      });
      const mockTeam = TestUtils.createMockTeam({ name: mockUserData.teamName });

      bcrypt.hash.mockResolvedValue(hashedPassword);
      query
        .mockResolvedValueOnce(TestUtils.createMockQueryResult([mockTeam])) // Create team
        .mockResolvedValueOnce(TestUtils.createMockQueryResult([mockUser])); // Create user

      jwt.sign.mockReturnValue('mock-token');

      const result = await authService.register(mockUserData);

      expect(bcrypt.hash).toHaveBeenCalledWith(mockUserData.password, 10);
      expect(query).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        user: mockUser,
        accessToken: 'mock-token',
        refreshToken: 'mock-token',
      });
    });

    it('should throw error if user already exists', async () => {
      const mockError = { code: '23505' }; // Unique constraint violation
      query.mockRejectedValue(mockError);

      await expect(authService.register(mockUserData)).rejects.toThrow();
    });

    it('should throw error for invalid email', async () => {
      const invalidData = { ...mockUserData, email: 'invalid-email' };

      await expect(authService.register(invalidData)).rejects.toThrow();
    });

    it('should throw error for short password', async () => {
      const invalidData = { ...mockUserData, password: '123' };

      await expect(authService.register(invalidData)).rejects.toThrow();
    });
  });

  describe('login', () => {
    const loginData = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should login user successfully', async () => {
      const mockUser = TestUtils.createMockUser({
        email: loginData.email,
        passwordHash: 'hashed-password',
      });

      query.mockResolvedValue(TestUtils.createMockQueryResult([mockUser]));
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('mock-token');

      const result = await authService.login(loginData);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [loginData.email.toLowerCase()]
      );
      expect(bcrypt.compare).toHaveBeenCalledWith(loginData.password, mockUser.passwordHash);
      expect(result).toEqual({
        user: expect.objectContaining({
          id: mockUser.id,
          email: mockUser.email,
        }),
        accessToken: 'mock-token',
        refreshToken: 'mock-token',
      });
    });

    it('should throw error for invalid credentials', async () => {
      query.mockResolvedValue(TestUtils.createMockQueryResult([]));

      await expect(authService.login(loginData)).rejects.toThrow('Invalid credentials');
    });

    it('should throw error for wrong password', async () => {
      const mockUser = TestUtils.createMockUser({
        email: loginData.email,
        passwordHash: 'hashed-password',
      });

      query.mockResolvedValue(TestUtils.createMockQueryResult([mockUser]));
      bcrypt.compare.mockResolvedValue(false);

      await expect(authService.login(loginData)).rejects.toThrow('Invalid credentials');
    });

    it('should throw error for inactive user', async () => {
      const mockUser = TestUtils.createMockUser({
        email: loginData.email,
        passwordHash: 'hashed-password',
        isActive: false,
      });

      query.mockResolvedValue(TestUtils.createMockQueryResult([mockUser]));
      bcrypt.compare.mockResolvedValue(true);

      await expect(authService.login(loginData)).rejects.toThrow('Account is deactivated');
    });
  });

  describe('refreshTokens', () => {
    it('should refresh tokens successfully', async () => {
      const refreshToken = 'valid-refresh-token';
      const mockPayload = {
        userId: 'test-user-id',
        email: 'test@example.com',
        tokenType: 'refresh',
      };

      jwt.verify.mockReturnValue(mockPayload);
      jwt.sign.mockReturnValue('new-token');

      const result = await authService.refreshTokens(refreshToken);

      expect(jwt.verify).toHaveBeenCalledWith(refreshToken, process.env.JWT_REFRESH_SECRET);
      expect(result).toEqual({
        accessToken: 'new-token',
        refreshToken: 'new-token',
      });
    });

    it('should throw error for invalid refresh token', async () => {
      const refreshToken = 'invalid-token';
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(authService.refreshTokens(refreshToken)).rejects.toThrow();
    });

    it('should throw error for access token used as refresh token', async () => {
      const refreshToken = 'access-token';
      const mockPayload = {
        userId: 'test-user-id',
        email: 'test@example.com',
        tokenType: 'access',
      };

      jwt.verify.mockReturnValue(mockPayload);

      await expect(authService.refreshTokens(refreshToken)).rejects.toThrow('Invalid refresh token');
    });
  });

  describe('getUserProfile', () => {
    it('should get user profile successfully', async () => {
      const userId = 'test-user-id';
      const mockUser = TestUtils.createMockUser({ id: userId });

      query.mockResolvedValue(TestUtils.createMockQueryResult([mockUser]));

      const result = await authService.getUserProfile(userId);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [userId]
      );
      expect(result).toEqual(expect.objectContaining({
        id: userId,
        email: mockUser.email,
      }));
    });

    it('should throw error if user not found', async () => {
      const userId = 'non-existent-user';
      query.mockResolvedValue(TestUtils.createMockQueryResult([]));

      await expect(authService.getUserProfile(userId)).rejects.toThrow('User not found');
    });
  });

  describe('changePassword', () => {
    const userId = 'test-user-id';
    const passwordData = {
      currentPassword: 'oldpassword',
      newPassword: 'newpassword123',
    };

    it('should change password successfully', async () => {
      const mockUser = TestUtils.createMockUser({
        id: userId,
        passwordHash: 'hashed-old-password',
      });
      const newHashedPassword = 'hashed-new-password';

      query.mockResolvedValue(TestUtils.createMockQueryResult([mockUser]));
      bcrypt.compare.mockResolvedValue(true);
      bcrypt.hash.mockResolvedValue(newHashedPassword);

      const result = await authService.changePassword(userId, passwordData);

      expect(bcrypt.compare).toHaveBeenCalledWith(
        passwordData.currentPassword,
        mockUser.passwordHash
      );
      expect(bcrypt.hash).toHaveBeenCalledWith(passwordData.newPassword, 10);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        [newHashedPassword, userId]
      );
      expect(result.success).toBe(true);
    });

    it('should throw error for wrong current password', async () => {
      const mockUser = TestUtils.createMockUser({
        id: userId,
        passwordHash: 'hashed-old-password',
      });

      query.mockResolvedValue(TestUtils.createMockQueryResult([mockUser]));
      bcrypt.compare.mockResolvedValue(false);

      await expect(authService.changePassword(userId, passwordData))
        .rejects.toThrow('Current password is incorrect');
    });

    it('should throw error for short new password', async () => {
      const invalidData = { ...passwordData, newPassword: '123' };

      await expect(authService.changePassword(userId, invalidData))
        .rejects.toThrow('New password must be at least 8 characters');
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify access token successfully', () => {
      const token = 'valid-access-token';
      const mockPayload = {
        userId: 'test-user-id',
        email: 'test@example.com',
        tokenType: 'access',
      };

      jwt.verify.mockReturnValue(mockPayload);

      const result = authService.verifyAccessToken(token);

      expect(jwt.verify).toHaveBeenCalledWith(token, process.env.JWT_SECRET);
      expect(result).toEqual(mockPayload);
    });

    it('should throw error for invalid token', () => {
      const token = 'invalid-token';
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      expect(() => authService.verifyAccessToken(token)).toThrow();
    });

    it('should throw error for refresh token used as access token', () => {
      const token = 'refresh-token';
      const mockPayload = {
        userId: 'test-user-id',
        email: 'test@example.com',
        tokenType: 'refresh',
      };

      jwt.verify.mockReturnValue(mockPayload);

      expect(() => authService.verifyAccessToken(token))
        .toThrow('Invalid access token');
    });
  });

  describe('inviteUserToTeam', () => {
    const inviterId = 'inviter-id';
    const inviteData = {
      email: 'newuser@example.com',
      name: 'New User',
      role: 'member',
    };

    it('should invite user to team successfully', async () => {
      const mockInviter = TestUtils.createMockUser({
        id: inviterId,
        role: 'manager',
        teamId: 'test-team-id',
      });
      const mockInvitation = {
        id: 'invitation-id',
        ...inviteData,
        teamId: mockInviter.teamId,
        invitedBy: inviterId,
      };

      query
        .mockResolvedValueOnce(TestUtils.createMockQueryResult([mockInviter])) // Get inviter
        .mockResolvedValueOnce(TestUtils.createMockQueryResult([])) // Check existing user
        .mockResolvedValueOnce(TestUtils.createMockQueryResult([mockInvitation])); // Create invitation

      const result = await authService.inviteUserToTeam(inviterId, inviteData);

      expect(result).toEqual({
        success: true,
        invitation: mockInvitation,
      });
    });

    it('should throw error if inviter lacks permission', async () => {
      const mockInviter = TestUtils.createMockUser({
        id: inviterId,
        role: 'member', // Not manager
        teamId: 'test-team-id',
      });

      query.mockResolvedValue(TestUtils.createMockQueryResult([mockInviter]));

      await expect(authService.inviteUserToTeam(inviterId, inviteData))
        .rejects.toThrow('Insufficient permissions');
    });

    it('should throw error if user already exists', async () => {
      const mockInviter = TestUtils.createMockUser({
        id: inviterId,
        role: 'manager',
        teamId: 'test-team-id',
      });
      const mockExistingUser = TestUtils.createMockUser({
        email: inviteData.email,
      });

      query
        .mockResolvedValueOnce(TestUtils.createMockQueryResult([mockInviter]))
        .mockResolvedValueOnce(TestUtils.createMockQueryResult([mockExistingUser]));

      await expect(authService.inviteUserToTeam(inviterId, inviteData))
        .rejects.toThrow('User already exists');
    });
  });
});