import { jest } from '@jest/globals';
import { RateLimitService } from '../../services/RateLimitService.js';
import { TestUtils } from '../helpers/testUtils.js';

// Mock dependencies
jest.mock('../../config/redis.js', () => ({
  getRedisClient: jest.fn(() => TestUtils.createMockRedisClient()),
}));

jest.mock('../../utils/logger.js', () => ({
  logger: TestUtils.createMockLogger(),
}));

import { getRedisClient } from '../../config/redis.js';
import { logger } from '../../utils/logger.js';

describe('RateLimitService', () => {
  let rateLimitService;
  let mockRedisClient;

  beforeEach(() => {
    rateLimitService = new RateLimitService();
    mockRedisClient = TestUtils.createMockRedisClient();
    getRedisClient.mockReturnValue(mockRedisClient);
    jest.clearAllMocks();
  });

  describe('isAllowed', () => {
    const key = 'test-key';
    const options = {
      maxRequests: 5,
      windowMs: 60000, // 1 minute
    };

    it('should allow request when under limit', async () => {
      const mockMulti = {
        get: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([2]), // Current count: 2
      };
      mockRedisClient.multi.mockReturnValue(mockMulti);

      const result = await rateLimitService.isAllowed(key, options);

      expect(result).toEqual({
        allowed: true,
        remaining: 2, // 5 - 2 - 1 = 2
        resetTime: expect.any(Number),
        totalHits: 2,
      });
    });

    it('should deny request when over limit', async () => {
      const mockMulti = {
        get: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([5]), // Current count: 5 (at limit)
      };
      mockRedisClient.multi.mockReturnValue(mockMulti);

      const result = await rateLimitService.isAllowed(key, options);

      expect(result).toEqual({
        allowed: false,
        remaining: 0,
        resetTime: expect.any(Number),
        retryAfter: expect.any(Number),
      });
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisClient.multi.mockImplementation(() => {
        throw new Error('Redis connection error');
      });

      const result = await rateLimitService.isAllowed(key, options);

      expect(result.allowed).toBe(true);
      expect(logger.error).toHaveBeenCalledWith(
        'Rate limit check error:',
        expect.any(Error)
      );
    });

    it('should set block when blockDuration is specified', async () => {
      const mockMulti = {
        get: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([10]), // Over limit
      };
      mockRedisClient.multi.mockReturnValue(mockMulti);
      mockRedisClient.setex.mockResolvedValue('OK');

      const optionsWithBlock = {
        ...options,
        blockDuration: 300000, // 5 minutes
      };

      const result = await rateLimitService.isAllowed(key, optionsWithBlock);

      expect(result.allowed).toBe(false);
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'ratelimit:test-key:block',
        300, // 5 minutes in seconds
        '1'
      );
    });
  });

  describe('consume', () => {
    const key = 'test-key';
    const options = {
      maxRequests: 5,
      windowMs: 60000,
    };

    it('should consume rate limit token successfully', async () => {
      const mockMulti = {
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([3]), // New count: 3
      };
      mockRedisClient.multi.mockReturnValue(mockMulti);

      const result = await rateLimitService.consume(key, options);

      expect(mockMulti.incr).toHaveBeenCalledWith('ratelimit:test-key:' + expect.any(Number));
      expect(result).toEqual({
        totalHits: 3,
        remaining: 2, // 5 - 3 = 2
        resetTime: expect.any(Number),
      });
    });

    it('should handle Redis errors', async () => {
      mockRedisClient.multi.mockImplementation(() => {
        throw new Error('Redis connection error');
      });

      await expect(rateLimitService.consume(key, options)).rejects.toThrow('Redis connection error');
    });
  });

  describe('isBlocked', () => {
    const key = 'test-key';

    it('should return true when key is blocked', async () => {
      mockRedisClient.get.mockResolvedValue('1');

      const result = await rateLimitService.isBlocked(key);

      expect(mockRedisClient.get).toHaveBeenCalledWith('ratelimit:test-key:block');
      expect(result).toBe(true);
    });

    it('should return false when key is not blocked', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await rateLimitService.isBlocked(key);

      expect(result).toBe(false);
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));

      const result = await rateLimitService.isBlocked(key);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'Rate limit block check error:',
        expect.any(Error)
      );
    });
  });

  describe('reset', () => {
    const key = 'test-key';

    it('should reset rate limit for key', async () => {
      const keys = ['ratelimit:test-key:123', 'ratelimit:test-key:124'];
      mockRedisClient.keys.mockResolvedValue(keys);
      mockRedisClient.del.mockResolvedValue(2);

      await rateLimitService.reset(key);

      expect(mockRedisClient.keys).toHaveBeenCalledWith('ratelimit:test-key*');
      expect(mockRedisClient.del).toHaveBeenCalledWith(...keys);
      expect(logger.info).toHaveBeenCalledWith('Rate limit reset for key: test-key');
    });

    it('should handle no keys to delete', async () => {
      mockRedisClient.keys.mockResolvedValue([]);

      await rateLimitService.reset(key);

      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });

    it('should handle Redis errors', async () => {
      mockRedisClient.keys.mockRejectedValue(new Error('Redis error'));

      await expect(rateLimitService.reset(key)).rejects.toThrow('Redis error');
    });
  });

  describe('getStatus', () => {
    const key = 'test-key';
    const options = {
      maxRequests: 10,
      windowMs: 60000,
    };

    it('should return status for key', async () => {
      mockRedisClient.get.mockResolvedValueOnce('5'); // Current count
      mockRedisClient.get.mockResolvedValueOnce(null); // Not blocked

      const result = await rateLimitService.getStatus(key, options);

      expect(result).toEqual({
        key,
        totalHits: 5,
        remaining: 5,
        resetTime: expect.any(Number),
        blocked: false,
        limit: 10,
        windowMs: 60000,
      });
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));

      const result = await rateLimitService.getStatus(key, options);

      expect(result).toEqual({
        key,
        totalHits: 0,
        remaining: 10,
        resetTime: expect.any(Number),
        blocked: false,
        limit: 10,
        windowMs: 60000,
      });
    });
  });

  describe('createMiddleware', () => {
    it('should create middleware that allows request', async () => {
      const mockReq = TestUtils.createMockRequest();
      const mockRes = TestUtils.createMockResponse();
      const mockNext = TestUtils.createMockNext();

      // Mock isAllowed to return allowed
      jest.spyOn(rateLimitService, 'isAllowed').mockResolvedValue({
        allowed: true,
        remaining: 5,
        resetTime: Date.now() + 60000,
      });
      jest.spyOn(rateLimitService, 'consume').mockResolvedValue({});
      jest.spyOn(rateLimitService, 'isBlocked').mockResolvedValue(false);

      const middleware = rateLimitService.createMiddleware({
        maxRequests: 10,
        windowMs: 60000,
      });

      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'RateLimit-Limit': 10,
          'RateLimit-Remaining': 5,
        })
      );
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should create middleware that blocks request', async () => {
      const mockReq = TestUtils.createMockRequest();
      const mockRes = TestUtils.createMockResponse();
      const mockNext = TestUtils.createMockNext();

      jest.spyOn(rateLimitService, 'isBlocked').mockResolvedValue(false);
      jest.spyOn(rateLimitService, 'isAllowed').mockResolvedValue({
        allowed: false,
        remaining: 0,
        retryAfter: 60000,
      });

      const middleware = rateLimitService.createMiddleware({
        maxRequests: 10,
        windowMs: 60000,
      });

      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.set).toHaveBeenCalledWith('Retry-After', 60);
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle blocked requests', async () => {
      const mockReq = TestUtils.createMockRequest();
      const mockRes = TestUtils.createMockResponse();
      const mockNext = TestUtils.createMockNext();

      jest.spyOn(rateLimitService, 'isBlocked').mockResolvedValue(true);

      const middleware = rateLimitService.createMiddleware({
        maxRequests: 10,
        windowMs: 60000,
      });

      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should use custom key generator', async () => {
      const mockReq = TestUtils.createMockRequest({
        user: { id: 'user-123' },
      });
      const mockRes = TestUtils.createMockResponse();
      const mockNext = TestUtils.createMockNext();

      jest.spyOn(rateLimitService, 'isBlocked').mockResolvedValue(false);
      jest.spyOn(rateLimitService, 'isAllowed').mockResolvedValue({
        allowed: true,
        remaining: 5,
      });
      jest.spyOn(rateLimitService, 'consume').mockResolvedValue({});

      const keyGenerator = (req) => `user:${req.user.id}`;
      const middleware = rateLimitService.createMiddleware({
        keyGenerator,
        maxRequests: 10,
      });

      await middleware(mockReq, mockRes, mockNext);

      expect(rateLimitService.isAllowed).toHaveBeenCalledWith(
        'user:user-123',
        expect.any(Object)
      );
    });

    it('should skip when no key generated', async () => {
      const mockReq = TestUtils.createMockRequest();
      const mockRes = TestUtils.createMockResponse();
      const mockNext = TestUtils.createMockNext();

      const keyGenerator = () => null;
      const middleware = rateLimitService.createMiddleware({ keyGenerator });

      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('createUserMiddleware', () => {
    it('should create user-specific middleware', async () => {
      const mockReq = TestUtils.createMockRequest({
        user: { id: 'user-123' },
      });
      const mockRes = TestUtils.createMockResponse();
      const mockNext = TestUtils.createMockNext();

      jest.spyOn(rateLimitService, 'createMiddleware').mockReturnValue((req, res, next) => next());

      const middleware = rateLimitService.createUserMiddleware({
        maxRequests: 500,
      });

      await middleware(mockReq, mockRes, mockNext);

      expect(rateLimitService.createMiddleware).toHaveBeenCalledWith(
        expect.objectContaining({
          maxRequests: 500,
          keyGenerator: expect.any(Function),
        })
      );
    });

    it('should fallback to IP when no user', () => {
      const mockReq = { ip: '127.0.0.1' };
      
      const middleware = rateLimitService.createUserMiddleware();
      const keyGenerator = rateLimitService.createMiddleware.mock.calls[0][0].keyGenerator;

      const key = keyGenerator(mockReq);
      expect(key).toBe('127.0.0.1');
    });
  });

  describe('createTeamMiddleware', () => {
    it('should create team-specific middleware', () => {
      const mockReq = TestUtils.createMockRequest({
        user: { teamId: 'team-123' },
      });

      jest.spyOn(rateLimitService, 'createMiddleware').mockReturnValue(() => {});

      rateLimitService.createTeamMiddleware({ maxRequests: 2000 });

      expect(rateLimitService.createMiddleware).toHaveBeenCalledWith(
        expect.objectContaining({
          maxRequests: 2000,
          keyGenerator: expect.any(Function),
        })
      );

      const keyGenerator = rateLimitService.createMiddleware.mock.calls[0][0].keyGenerator;
      const key = keyGenerator(mockReq);
      expect(key).toBe('team:team-123');
    });
  });

  describe('createEndpointMiddleware', () => {
    it('should create endpoint-specific middleware', () => {
      const endpoint = 'auth.login';
      const mockReq = TestUtils.createMockRequest({
        user: { id: 'user-123' },
      });

      jest.spyOn(rateLimitService, 'createMiddleware').mockReturnValue(() => {});

      rateLimitService.createEndpointMiddleware(endpoint, { maxRequests: 25 });

      expect(rateLimitService.createMiddleware).toHaveBeenCalledWith(
        expect.objectContaining({
          maxRequests: 25,
          keyGenerator: expect.any(Function),
          message: 'Too many requests to auth.login',
        })
      );

      const keyGenerator = rateLimitService.createMiddleware.mock.calls[0][0].keyGenerator;
      const key = keyGenerator(mockReq);
      expect(key).toBe('user:user-123:auth.login');
    });
  });
});