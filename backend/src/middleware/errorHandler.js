import { logger } from '../utils/logger.js';

class ApiError extends Error {
  constructor(statusCode, message, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export { ApiError };

export const errorHandler = (err, req, res, next) => {
  let { statusCode, message } = err;

  if (!err.isOperational) {
    statusCode = 500;
    message = 'Something went wrong!';
  }

  const response = {
    error: {
      status: statusCode,
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
    success: false,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method,
  };

  logger.error('Error handled:', {
    error: err.message,
    statusCode,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    ...(err.stack && { stack: err.stack }),
  });

  res.status(statusCode).json(response);
};