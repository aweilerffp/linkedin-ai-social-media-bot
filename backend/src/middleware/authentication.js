import { AuthService } from '../services/auth/AuthService.js';
import { ApiError } from './errorHandler.js';
import { logger } from '../utils/logger.js';

let authService;

function getAuthService() {
  if (!authService) {
    authService = new AuthService();
  }
  return authService;
}

/**
 * Middleware to authenticate requests using JWT
 */
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      throw new ApiError(401, 'Authorization header required');
    }

    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    if (!token) {
      throw new ApiError(401, 'Access token required');
    }

    // Verify the token
    const payload = getAuthService().verifyAccessToken(token);
    
    // Add user info to request
    req.user = {
      id: payload.userId,
      email: payload.email,
      role: payload.role,
      teamId: payload.teamId,
    };

    next();
  } catch (error) {
    if (error instanceof ApiError) {
      return next(error);
    }

    logger.error('Authentication middleware error:', error);
    next(new ApiError(401, 'Authentication failed'));
  }
};

/**
 * Middleware to require specific role
 */
export const requireRole = (requiredRole) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new ApiError(401, 'Authentication required');
      }

      const roleHierarchy = { member: 1, manager: 2, admin: 3 };
      const userRoleLevel = roleHierarchy[req.user.role] || 0;
      const requiredRoleLevel = roleHierarchy[requiredRole] || 999;

      if (userRoleLevel < requiredRoleLevel) {
        throw new ApiError(403, `Insufficient permissions. ${requiredRole} role required`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware to require team membership
 */
export const requireTeam = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }

    if (!req.user.teamId) {
      throw new ApiError(403, 'Team membership required');
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to validate team access
 */
export const validateTeamAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }

    const teamId = req.params.teamId || req.body.teamId;
    
    if (!teamId) {
      throw new ApiError(400, 'Team ID required');
    }

    // Admins can access any team, others can only access their own team
    if (req.user.role !== 'admin' && req.user.teamId !== teamId) {
      throw new ApiError(403, 'Access denied to this team');
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Optional authentication - doesn't fail if no token provided
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return next();
    }

    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    if (!token) {
      return next();
    }

    try {
      const payload = getAuthService().verifyAccessToken(token);
      req.user = {
        id: payload.userId,
        email: payload.email,
        role: payload.role,
        teamId: payload.teamId,
      };
    } catch (error) {
      // Token invalid, but don't fail - just continue without user
      logger.debug('Optional auth token invalid:', error.message);
    }

    next();
  } catch (error) {
    logger.error('Optional authentication middleware error:', error);
    next(); // Continue without authentication
  }
};

/**
 * Rate limiting by user
 */
export const rateLimitByUser = (options = {}) => {
  const { maxRequests = 100, windowMs = 15 * 60 * 1000 } = options;
  const userRequests = new Map();

  return (req, res, next) => {
    if (!req.user) {
      return next();
    }

    const userId = req.user.id;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean up old entries
    if (Math.random() < 0.01) { // 1% chance to clean up
      for (const [key, requests] of userRequests.entries()) {
        const filtered = requests.filter(time => time > windowStart);
        if (filtered.length === 0) {
          userRequests.delete(key);
        } else {
          userRequests.set(key, filtered);
        }
      }
    }

    // Get user's recent requests
    const requests = userRequests.get(userId) || [];
    const recentRequests = requests.filter(time => time > windowStart);

    if (recentRequests.length >= maxRequests) {
      return next(new ApiError(429, 'Too many requests. Please try again later.'));
    }

    // Add current request
    recentRequests.push(now);
    userRequests.set(userId, recentRequests);

    // Add headers
    res.set({
      'X-RateLimit-Limit': maxRequests,
      'X-RateLimit-Remaining': Math.max(0, maxRequests - recentRequests.length),
      'X-RateLimit-Reset': new Date(now + windowMs).toISOString(),
    });

    next();
  };
};

/**
 * Middleware to log user actions
 */
export const auditLog = (action) => {
  return (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Log the action
      if (req.user && res.statusCode < 400) {
        logger.info('User action audit', {
          userId: req.user.id,
          teamId: req.user.teamId,
          action,
          method: req.method,
          url: req.originalUrl,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          statusCode: res.statusCode,
        });
      }

      originalSend.call(this, data);
    };

    next();
  };
};