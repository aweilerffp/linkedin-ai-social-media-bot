import * as Sentry from '@sentry/node';
import { logger } from '../../utils/logger.js';

/**
 * Enhanced error tracking service with Sentry integration and custom analytics
 * Provides comprehensive error monitoring, alerting, and performance tracking
 */
export class ErrorTracker {
  constructor() {
    this.isInitialized = false;
    this.errorCounts = new Map();
    this.performanceMetrics = new Map();
    this.alertThresholds = {
      errorRate: 0.05, // 5% error rate threshold
      responseTime: 5000, // 5 second response time threshold
      memoryUsage: 0.85, // 85% memory usage threshold
    };
    
    this.init();
  }

  /**
   * Initialize error tracking with Sentry and custom monitoring
   */
  init() {
    try {
      if (process.env.SENTRY_DSN) {
        Sentry.init({
          dsn: process.env.SENTRY_DSN,
          environment: process.env.NODE_ENV || 'development',
          release: process.env.APP_VERSION || '1.0.0',
          
          // Performance monitoring
          tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
          profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
          
          // Error filtering
          beforeSend: ((event, hint) => {
            const error = hint.originalException;
            
            // Filter out known non-critical errors
            if (this.shouldIgnoreError(error)) {
              return null;
            }
            
            // Add custom context
            event.contexts = {
              ...event.contexts,
              custom: {
                errorCategory: this.categorizeError(error),
                severity: this.calculateSeverity(error),
                userImpact: this.assessUserImpact(error),
              }
            };
            
            return event;
          }).bind(this),
          
          // Custom integrations
          integrations: [
            new Sentry.Integrations.Http({ tracing: true }),
            new Sentry.Integrations.Express({ app: null }), // Will be set later
            new Sentry.Integrations.Postgres(),
            new Sentry.Integrations.Redis(),
          ],
        });
        
        this.isInitialized = true;
        logger.info('Error tracking initialized with Sentry');
      } else {
        logger.warn('Sentry DSN not configured, using fallback error tracking');
        this.isInitialized = false;
      }
    } catch (error) {
      logger.error('Failed to initialize error tracking:', error);
      this.isInitialized = false;
    }
  }

  /**
   * Configure Express app with Sentry middleware
   */
  configureExpress(app) {
    if (this.isInitialized) {
      // Request handler middleware (must be first)
      app.use(Sentry.Handlers.requestHandler());
      
      // Tracing middleware
      app.use(Sentry.Handlers.tracingHandler());
      
      logger.info('Express app configured with Sentry middleware');
    }
  }

  /**
   * Add error handler middleware (must be added after all routes)
   */
  addErrorHandler(app) {
    if (this.isInitialized) {
      app.use(Sentry.Handlers.errorHandler({
        shouldHandleError(error) {
          // Only send errors that we want to track
          return error.status >= 500 || !error.status;
        }
      }));
    }
  }

  /**
   * Track application errors with context
   */
  captureError(error, context = {}) {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      statusCode: error.statusCode || error.status,
      timestamp: new Date().toISOString(),
      category: this.categorizeError(error),
      severity: this.calculateSeverity(error),
      userImpact: this.assessUserImpact(error),
      ...context
    };

    // Track error counts
    const errorKey = `${error.name}:${error.message}`;
    this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);

    // Log error locally
    logger.error('Application error captured:', errorInfo);

    // Send to Sentry if available
    if (this.isInitialized) {
      Sentry.withScope((scope) => {
        // Add user context
        if (context.user) {
          scope.setUser({
            id: context.user.id,
            email: context.user.email,
            teamId: context.user.teamId,
          });
        }

        // Add tags for filtering
        scope.setTag('errorCategory', errorInfo.category);
        scope.setTag('severity', errorInfo.severity);
        scope.setTag('userImpact', errorInfo.userImpact);
        
        if (context.platform) {
          scope.setTag('platform', context.platform);
        }

        // Add extra context
        scope.setContext('error_details', {
          category: errorInfo.category,
          severity: errorInfo.severity,
          userImpact: errorInfo.userImpact,
          errorCount: this.errorCounts.get(errorKey),
        });

        if (context.request) {
          scope.setContext('request', {
            method: context.request.method,
            url: context.request.url,
            userAgent: context.request.get('User-Agent'),
            ip: context.request.ip,
          });
        }

        if (context.job) {
          scope.setContext('job', {
            id: context.job.id,
            name: context.job.name,
            data: context.job.data,
            attempts: context.job.attemptsMade,
          });
        }

        Sentry.captureException(error);
      });
    }

    // Check if we should trigger alerts
    this.checkAlertThresholds(errorInfo);

    return errorInfo;
  }

  /**
   * Track custom events and metrics
   */
  captureEvent(eventName, data = {}, level = 'info') {
    const eventData = {
      eventName,
      timestamp: new Date().toISOString(),
      level,
      ...data
    };

    logger.info('Custom event captured:', eventData);

    if (this.isInitialized) {
      Sentry.addBreadcrumb({
        message: eventName,
        level,
        data: eventData,
        category: 'custom_event',
      });
    }

    return eventData;
  }

  /**
   * Track performance metrics
   */
  trackPerformance(operation, duration, metadata = {}) {
    const performanceData = {
      operation,
      duration,
      timestamp: new Date().toISOString(),
      ...metadata
    };

    // Store performance metrics
    if (!this.performanceMetrics.has(operation)) {
      this.performanceMetrics.set(operation, []);
    }
    
    const metrics = this.performanceMetrics.get(operation);
    metrics.push(performanceData);
    
    // Keep only last 1000 metrics per operation
    if (metrics.length > 1000) {
      metrics.shift();
    }

    logger.debug('Performance tracked:', performanceData);

    // Send to Sentry as transaction if available
    if (this.isInitialized && duration > this.alertThresholds.responseTime) {
      Sentry.addBreadcrumb({
        message: `Slow ${operation}`,
        level: 'warning',
        data: performanceData,
        category: 'performance',
      });
    }

    // Check performance thresholds
    if (duration > this.alertThresholds.responseTime) {
      this.captureEvent('slow_operation', {
        operation,
        duration,
        threshold: this.alertThresholds.responseTime,
        ...metadata
      }, 'warning');
    }

    return performanceData;
  }

  /**
   * Track user activity and errors
   */
  captureUserAction(userId, action, context = {}) {
    const actionData = {
      userId,
      action,
      timestamp: new Date().toISOString(),
      ...context
    };

    if (this.isInitialized) {
      Sentry.addBreadcrumb({
        message: `User ${action}`,
        level: 'info',
        data: actionData,
        category: 'user_action',
      });
    }

    logger.debug('User action tracked:', actionData);
    return actionData;
  }

  /**
   * Get error statistics and metrics
   */
  getErrorStats() {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    const stats = {
      totalErrors: 0,
      uniqueErrors: this.errorCounts.size,
      topErrors: [],
      errorsByCategory: {},
      errorsBySeverity: {},
      recentErrors: 0,
      averageResponseTime: this.calculateAverageResponseTime(),
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };

    // Calculate total errors and top errors
    for (const [errorKey, count] of this.errorCounts.entries()) {
      stats.totalErrors += count;
      stats.topErrors.push({ error: errorKey, count });
    }

    // Sort top errors by count
    stats.topErrors.sort((a, b) => b.count - a.count);
    stats.topErrors = stats.topErrors.slice(0, 10);

    return stats;
  }

  /**
   * Get performance metrics
   */
  getPerformanceStats() {
    const stats = {
      operations: {},
      totalOperations: 0,
      averageResponseTime: 0,
      slowestOperations: [],
      timestamp: new Date().toISOString(),
    };

    for (const [operation, metrics] of this.performanceMetrics.entries()) {
      const durations = metrics.map(m => m.duration);
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const maxDuration = Math.max(...durations);
      const minDuration = Math.min(...durations);
      
      stats.operations[operation] = {
        count: metrics.length,
        averageDuration: Math.round(avgDuration),
        maxDuration,
        minDuration,
        recent: metrics.slice(-10), // Last 10 operations
      };

      stats.totalOperations += metrics.length;
      stats.slowestOperations.push({
        operation,
        averageDuration: Math.round(avgDuration),
        maxDuration,
      });
    }

    // Sort slowest operations
    stats.slowestOperations.sort((a, b) => b.averageDuration - a.averageDuration);
    stats.slowestOperations = stats.slowestOperations.slice(0, 10);

    // Calculate overall average response time
    if (stats.totalOperations > 0) {
      const allDurations = Array.from(this.performanceMetrics.values())
        .flat()
        .map(m => m.duration);
      stats.averageResponseTime = Math.round(
        allDurations.reduce((a, b) => a + b, 0) / allDurations.length
      );
    }

    return stats;
  }

  /**
   * Categorize error for better organization
   */
  categorizeError(error) {
    if (!error) return 'unknown';

    const message = error.message?.toLowerCase() || '';
    const name = error.name?.toLowerCase() || '';
    const code = error.code?.toLowerCase() || '';

    // Database errors
    if (name.includes('sequelize') || code.includes('connection') || message.includes('database')) {
      return 'database';
    }

    // Network/API errors
    if (name.includes('fetch') || message.includes('network') || code.includes('econnrefused')) {
      return 'network';
    }

    // Authentication errors
    if (message.includes('unauthorized') || message.includes('token') || message.includes('auth')) {
      return 'authentication';
    }

    // Validation errors
    if (name.includes('validation') || message.includes('required') || message.includes('invalid')) {
      return 'validation';
    }

    // Platform API errors
    if (message.includes('linkedin') || message.includes('twitter') || message.includes('platform')) {
      return 'platform_api';
    }

    // Queue/Job errors
    if (message.includes('job') || message.includes('queue') || message.includes('bull')) {
      return 'queue';
    }

    // File/Upload errors
    if (message.includes('file') || message.includes('upload') || message.includes('multer')) {
      return 'file_upload';
    }

    // Rate limiting errors
    if (message.includes('rate limit') || message.includes('too many requests')) {
      return 'rate_limiting';
    }

    return 'application';
  }

  /**
   * Calculate error severity
   */
  calculateSeverity(error) {
    if (!error) return 'low';

    const statusCode = error.statusCode || error.status || 500;
    const message = error.message?.toLowerCase() || '';

    // Critical errors
    if (statusCode >= 500 || message.includes('crash') || message.includes('fatal')) {
      return 'critical';
    }

    // High severity
    if (statusCode >= 400 || message.includes('fail') || message.includes('error')) {
      return 'high';
    }

    // Medium severity
    if (statusCode >= 300 || message.includes('warn')) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Assess user impact of error
   */
  assessUserImpact(error) {
    const category = this.categorizeError(error);
    const severity = this.calculateSeverity(error);

    // High impact errors
    if (category === 'authentication' || category === 'database' || severity === 'critical') {
      return 'high';
    }

    // Medium impact errors
    if (category === 'platform_api' || category === 'queue' || severity === 'high') {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Check if error should be ignored
   */
  shouldIgnoreError(error) {
    if (!error) return true;

    const message = error.message?.toLowerCase() || '';
    const statusCode = error.statusCode || error.status;

    // Ignore client errors (4xx except 401, 403)
    if (statusCode >= 400 && statusCode < 500 && statusCode !== 401 && statusCode !== 403) {
      return true;
    }

    // Ignore specific known non-critical messages
    const ignoredMessages = [
      'favicon.ico',
      'robots.txt',
      'manifest.json',
      'service-worker',
      'aborted',
      'cancelled',
      'timeout',
    ];

    return ignoredMessages.some(ignored => message.includes(ignored));
  }

  /**
   * Check alert thresholds and trigger alerts if needed
   */
  checkAlertThresholds(errorInfo) {
    const stats = this.getErrorStats();
    const perfStats = this.getPerformanceStats();

    // Check error rate threshold
    const errorRate = stats.totalErrors / (stats.totalErrors + perfStats.totalOperations || 1);
    if (errorRate > this.alertThresholds.errorRate) {
      this.triggerAlert('high_error_rate', {
        currentRate: errorRate,
        threshold: this.alertThresholds.errorRate,
        stats,
      });
    }

    // Check memory usage
    const memoryUsage = stats.memoryUsage.heapUsed / stats.memoryUsage.heapTotal;
    if (memoryUsage > this.alertThresholds.memoryUsage) {
      this.triggerAlert('high_memory_usage', {
        currentUsage: memoryUsage,
        threshold: this.alertThresholds.memoryUsage,
        memoryStats: stats.memoryUsage,
      });
    }
  }

  /**
   * Trigger alert for critical issues
   */
  triggerAlert(alertType, data) {
    const alert = {
      type: alertType,
      timestamp: new Date().toISOString(),
      data,
      environment: process.env.NODE_ENV,
      version: process.env.APP_VERSION || '1.0.0',
    };

    logger.error('ALERT TRIGGERED:', alert);

    // Send to Sentry as error if available
    if (this.isInitialized) {
      Sentry.captureMessage(`Alert: ${alertType}`, 'error', (scope) => {
        scope.setTag('alert_type', alertType);
        scope.setContext('alert_data', data);
        return scope;
      });
    }

    // In production, you might want to send this to:
    // - Slack/Discord webhook
    // - PagerDuty
    // - Email alerts
    // - SMS alerts
    
    return alert;
  }

  /**
   * Calculate average response time
   */
  calculateAverageResponseTime() {
    const allMetrics = Array.from(this.performanceMetrics.values()).flat();
    if (allMetrics.length === 0) return 0;
    
    const totalTime = allMetrics.reduce((sum, metric) => sum + metric.duration, 0);
    return Math.round(totalTime / allMetrics.length);
  }

  /**
   * Clear old metrics to prevent memory leaks
   */
  cleanup() {
    const oneHour = 60 * 60 * 1000;
    const cutoff = Date.now() - oneHour;

    // Clear old performance metrics
    for (const [operation, metrics] of this.performanceMetrics.entries()) {
      const recentMetrics = metrics.filter(m => 
        new Date(m.timestamp).getTime() > cutoff
      );
      this.performanceMetrics.set(operation, recentMetrics);
    }

    // Clear old error counts (keep them longer - 24 hours)
    const twentyFourHours = 24 * 60 * 60 * 1000;
    const errorCutoff = Date.now() - twentyFourHours;
    
    // This is a simplified cleanup - in a real scenario, you'd want to track
    // when each error occurred to clean them up properly
    if (this.errorCounts.size > 1000) {
      // Keep only top 500 errors
      const sortedErrors = Array.from(this.errorCounts.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 500);
      
      this.errorCounts.clear();
      for (const [key, count] of sortedErrors) {
        this.errorCounts.set(key, count);
      }
    }

    logger.debug('Error tracking metrics cleaned up');
  }

  /**
   * Create performance timing wrapper
   */
  createTimer(operation) {
    const start = process.hrtime.bigint();
    
    return {
      end: (metadata = {}) => {
        const end = process.hrtime.bigint();
        const duration = Number(end - start) / 1000000; // Convert to milliseconds
        
        return this.trackPerformance(operation, duration, metadata);
      }
    };
  }

  /**
   * Middleware for tracking request performance
   */
  createPerformanceMiddleware() {
    return (req, res, next) => {
      const timer = this.createTimer(`${req.method} ${req.route?.path || req.path}`);
      
      res.on('finish', () => {
        timer.end({
          statusCode: res.statusCode,
          method: req.method,
          path: req.route?.path || req.path,
          userAgent: req.get('User-Agent'),
          contentLength: res.get('Content-Length'),
        });
      });
      
      next();
    };
  }
}

// Export singleton instance
export const errorTracker = new ErrorTracker();