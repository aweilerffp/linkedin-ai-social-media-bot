import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

/**
 * Test utilities for creating mock data and JWT tokens
 */
export class TestUtils {
  /**
   * Generate a test JWT token
   */
  static generateTestToken(payload = {}) {
    const defaultPayload = {
      userId: 'test-user-id',
      email: 'test@example.com',
      role: 'member',
      teamId: 'test-team-id',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour
    };

    return jwt.sign(
      { ...defaultPayload, ...payload },
      process.env.JWT_SECRET || 'test-secret'
    );
  }

  /**
   * Generate test user data
   */
  static createMockUser(overrides = {}) {
    return {
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      role: 'member',
      teamId: 'test-team-id',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
  }

  /**
   * Generate test team data
   */
  static createMockTeam(overrides = {}) {
    return {
      id: 'test-team-id',
      name: 'Test Team',
      plan: 'free',
      quotaLimit: 100,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
  }

  /**
   * Generate test post data
   */
  static createMockPost(overrides = {}) {
    return {
      id: 'test-post-id',
      teamId: 'test-team-id',
      userId: 'test-user-id',
      content: 'This is a test post content',
      mediaUrls: [],
      platforms: ['linkedin', 'twitter'],
      status: 'draft',
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
  }

  /**
   * Generate test webhook config data
   */
  static createMockWebhook(overrides = {}) {
    return {
      id: 'test-webhook-id',
      teamId: 'test-team-id',
      url: 'https://example.com/webhook',
      events: ['post.published', 'post.failed'],
      secret: 'webhook-secret',
      name: 'Test Webhook',
      description: 'Test webhook description',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
  }

  /**
   * Generate test platform credentials
   */
  static createMockPlatformCredentials(overrides = {}) {
    return {
      id: 'test-cred-id',
      teamId: 'test-team-id',
      platform: 'linkedin',
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      profileData: {
        id: 'platform-user-id',
        name: 'Test User',
        username: 'testuser',
      },
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
  }

  /**
   * Hash a password for testing
   */
  static async hashPassword(password) {
    return await bcrypt.hash(password, 10);
  }

  /**
   * Create mock Express request object
   */
  static createMockRequest(overrides = {}) {
    return {
      body: {},
      params: {},
      query: {},
      headers: {},
      user: null,
      ...overrides,
    };
  }

  /**
   * Create mock Express response object
   */
  static createMockResponse() {
    const res = {
      status: jest.fn(() => res),
      json: jest.fn(() => res),
      send: jest.fn(() => res),
      set: jest.fn(() => res),
      cookie: jest.fn(() => res),
      clearCookie: jest.fn(() => res),
    };
    return res;
  }

  /**
   * Create mock Express next function
   */
  static createMockNext() {
    return jest.fn();
  }

  /**
   * Wait for a specified amount of time
   */
  static async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate random string for testing
   */
  static generateRandomString(length = 10) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Generate random email for testing
   */
  static generateRandomEmail() {
    const username = this.generateRandomString(8);
    const domain = this.generateRandomString(6);
    return `${username}@${domain}.com`;
  }

  /**
   * Create mock database query result
   */
  static createMockQueryResult(rows = [], rowCount = null) {
    return {
      rows,
      rowCount: rowCount !== null ? rowCount : rows.length,
      command: 'SELECT',
      oid: null,
      fields: [],
    };
  }

  /**
   * Create mock Redis client
   */
  static createMockRedisClient() {
    return {
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      expire: jest.fn(),
      multi: jest.fn(() => ({
        get: jest.fn(),
        incr: jest.fn(),
        expire: jest.fn(),
        exec: jest.fn(() => Promise.resolve([0, 0])),
      })),
      keys: jest.fn(),
      lpush: jest.fn(),
      brpop: jest.fn(),
      ping: jest.fn(() => Promise.resolve('PONG')),
    };
  }

  /**
   * Create mock logger
   */
  static createMockLogger() {
    return {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
  }
}