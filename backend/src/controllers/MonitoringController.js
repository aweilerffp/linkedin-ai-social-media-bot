import { errorTracker } from '../services/monitoring/ErrorTracker.js';
import { metricsCollector } from '../services/monitoring/MetricsCollector.js';
import { logger } from '../utils/logger.js';

/**
 * Controller for monitoring endpoints including health checks,
 * metrics collection, and error tracking
 */
export class MonitoringController {
  
  /**
   * Health check endpoint
   */
  static async getHealth(req, res) {
    try {
      const healthStatus = metricsCollector.getHealthStatus();
      
      // Add additional health information
      const health = {
        ...healthStatus,
        version: process.env.APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        pid: process.pid,
      };
      
      // Return appropriate HTTP status based on health
      const statusCode = health.status === 'healthy' ? 200 : 
                        health.status === 'degraded' ? 200 : 503;
      
      res.status(statusCode).json({
        success: health.status !== 'unhealthy',
        data: health
      });
      
    } catch (error) {
      logger.error('Health check failed:', error);
      errorTracker.captureError(error, { context: 'health_check' });
      
      res.status(503).json({
        success: false,
        error: 'Health check failed',
        status: 'unhealthy',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Detailed health check with component status
   */
  static async getHealthDetailed(req, res) {
    try {
      const health = metricsCollector.getHealthStatus();
      const errorStats = errorTracker.getErrorStats();
      const performanceStats = errorTracker.getPerformanceStats();
      
      const detailed = {
        ...health,
        version: process.env.APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        
        // System information
        system: {
          node_version: process.version,
          platform: process.platform,
          arch: process.arch,
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          pid: process.pid,
        },
        
        // Error tracking stats
        errors: {
          total: errorStats.totalErrors,
          unique: errorStats.uniqueErrors,
          recent: errorStats.recentErrors,
          topErrors: errorStats.topErrors.slice(0, 5), // Top 5 errors only
        },
        
        // Performance stats
        performance: {
          averageResponseTime: performanceStats.averageResponseTime,
          totalOperations: performanceStats.totalOperations,
          slowestOperations: performanceStats.slowestOperations.slice(0, 5),
        },
        
        // Feature flags and configuration
        features: {
          errorTracking: errorTracker.isInitialized,
          metricsCollection: !!metricsCollector,
          webhooks: process.env.WEBHOOK_ENABLED !== 'false',
          rateLimiting: process.env.RATE_LIMIT_ENABLED !== 'false',
        }
      };
      
      // Return appropriate HTTP status
      const statusCode = health.status === 'healthy' ? 200 : 
                        health.status === 'degraded' ? 200 : 503;
      
      res.status(statusCode).json({
        success: health.status !== 'unhealthy',
        data: detailed
      });
      
    } catch (error) {
      logger.error('Detailed health check failed:', error);
      errorTracker.captureError(error, { context: 'detailed_health_check' });
      
      res.status(503).json({
        success: false,
        error: 'Detailed health check failed',
        status: 'unhealthy',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get application metrics in JSON format
   */
  static async getMetrics(req, res) {
    try {
      const timer = errorTracker.createTimer('metrics_collection');
      
      const metrics = metricsCollector.getMetricsJSON();
      const errorStats = errorTracker.getErrorStats();
      const performanceStats = errorTracker.getPerformanceStats();
      
      const response = {
        metrics,
        errors: errorStats,
        performance: performanceStats,
        collector: {
          startTime: metricsCollector.startTime,
          uptime: Date.now() - metricsCollector.startTime,
        }
      };
      
      timer.end({ type: 'json_metrics' });
      
      res.json({
        success: true,
        data: response
      });
      
    } catch (error) {
      logger.error('Failed to get metrics:', error);
      errorTracker.captureError(error, { context: 'metrics_endpoint' });
      
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve metrics'
      });
    }
  }

  /**
   * Get metrics in Prometheus format
   */
  static async getMetricsPrometheus(req, res) {
    try {
      const timer = errorTracker.createTimer('prometheus_metrics');
      
      const prometheusMetrics = metricsCollector.getMetricsPrometheus();
      
      timer.end({ type: 'prometheus_metrics' });
      
      res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.send(prometheusMetrics);
      
    } catch (error) {
      logger.error('Failed to get Prometheus metrics:', error);
      errorTracker.captureError(error, { context: 'prometheus_endpoint' });
      
      res.status(500).send('# Failed to retrieve metrics\n');
    }
  }

  /**
   * Get error statistics and tracking information
   */
  static async getErrorStats(req, res) {
    try {
      const errorStats = errorTracker.getErrorStats();
      const performanceStats = errorTracker.getPerformanceStats();
      
      const response = {
        errors: errorStats,
        performance: performanceStats,
        tracking: {
          initialized: errorTracker.isInitialized,
          environment: process.env.NODE_ENV,
          sentryConfigured: !!process.env.SENTRY_DSN,
        }
      };
      
      res.json({
        success: true,
        data: response
      });
      
    } catch (error) {
      logger.error('Failed to get error stats:', error);
      errorTracker.captureError(error, { context: 'error_stats_endpoint' });
      
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve error statistics'
      });
    }
  }

  /**
   * Get system information and diagnostics
   */
  static async getSystemInfo(req, res) {
    try {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      const systemInfo = {
        process: {
          pid: process.pid,
          version: process.version,
          platform: process.platform,
          arch: process.arch,
          uptime: process.uptime(),
          cwd: process.cwd(),
          memory: {
            rss: memUsage.rss,
            heapTotal: memUsage.heapTotal,
            heapUsed: memUsage.heapUsed,
            external: memUsage.external,
            arrayBuffers: memUsage.arrayBuffers,
          },
          cpu: {
            user: cpuUsage.user,
            system: cpuUsage.system,
          }
        },
        environment: {
          nodeEnv: process.env.NODE_ENV,
          port: process.env.PORT,
          version: process.env.APP_VERSION || '1.0.0',
        },
        features: {
          database: {
            type: 'PostgreSQL',
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            name: process.env.DB_NAME,
          },
          redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            configured: !!process.env.REDIS_HOST,
          },
          monitoring: {
            errorTracking: errorTracker.isInitialized,
            metricsCollection: true,
            sentry: !!process.env.SENTRY_DSN,
          },
          platforms: {
            linkedin: !!process.env.LINKEDIN_CLIENT_ID,
            twitter: !!process.env.TWITTER_CLIENT_ID,
          }
        },
        timestamp: new Date().toISOString(),
      };
      
      res.json({
        success: true,
        data: systemInfo
      });
      
    } catch (error) {
      logger.error('Failed to get system info:', error);
      errorTracker.captureError(error, { context: 'system_info_endpoint' });
      
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve system information'
      });
    }
  }

  /**
   * Manual garbage collection trigger (development/testing)
   */
  static async triggerGC(req, res) {
    try {
      // Only allow in development or with special header
      if (process.env.NODE_ENV === 'production' && 
          req.headers['x-admin-secret'] !== process.env.ADMIN_SECRET) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: GC trigger not allowed'
        });
      }
      
      const before = process.memoryUsage();
      
      if (global.gc) {
        global.gc();
        const after = process.memoryUsage();
        
        const freed = {
          rss: before.rss - after.rss,
          heapTotal: before.heapTotal - after.heapTotal,
          heapUsed: before.heapUsed - after.heapUsed,
          external: before.external - after.external,
        };
        
        logger.info('Manual GC triggered', { before, after, freed });
        
        res.json({
          success: true,
          message: 'Garbage collection triggered',
          data: {
            before,
            after,
            freed
          }
        });
      } else {
        res.status(501).json({
          success: false,
          error: 'Garbage collection not available (start with --expose-gc)',
        });
      }
      
    } catch (error) {
      logger.error('Failed to trigger GC:', error);
      errorTracker.captureError(error, { context: 'gc_trigger' });
      
      res.status(500).json({
        success: false,
        error: 'Failed to trigger garbage collection'
      });
    }
  }

  /**
   * Reset metrics and error tracking (admin only)
   */
  static async resetMetrics(req, res) {
    try {
      // Only allow with admin secret
      if (req.headers['x-admin-secret'] !== process.env.ADMIN_SECRET) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Admin access required'
        });
      }
      
      const beforeStats = {
        metrics: Object.keys(metricsCollector.getMetricsJSON()).length,
        errors: errorTracker.getErrorStats().totalErrors,
      };
      
      // Reset metrics
      metricsCollector.reset();
      errorTracker.errorCounts.clear();
      errorTracker.performanceMetrics.clear();
      
      logger.info('Metrics and error tracking reset', { beforeStats });
      
      res.json({
        success: true,
        message: 'Metrics and error tracking reset',
        data: {
          resetAt: new Date().toISOString(),
          beforeStats,
        }
      });
      
    } catch (error) {
      logger.error('Failed to reset metrics:', error);
      errorTracker.captureError(error, { context: 'metrics_reset' });
      
      res.status(500).json({
        success: false,
        error: 'Failed to reset metrics'
      });
    }
  }

  /**
   * Test error tracking by generating a sample error
   */
  static async testError(req, res) {
    try {
      // Only allow in development or with admin secret
      if (process.env.NODE_ENV === 'production' && 
          req.headers['x-admin-secret'] !== process.env.ADMIN_SECRET) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Error testing not allowed in production'
        });
      }
      
      const errorType = req.query.type || 'generic';
      
      // Generate different types of test errors
      switch (errorType) {
        case 'database':
          throw new Error('Test database connection error');
          
        case 'network':
          const networkError = new Error('Test network timeout');
          networkError.code = 'ECONNREFUSED';
          throw networkError;
          
        case 'validation':
          const validationError = new Error('Test validation error');
          validationError.name = 'ValidationError';
          throw validationError;
          
        case 'platform':
          const platformError = new Error('Test LinkedIn API error');
          platformError.statusCode = 429;
          throw platformError;
          
        default:
          throw new Error('Test generic application error');
      }
      
    } catch (error) {
      // This is intentional - we want to track the error
      const errorInfo = errorTracker.captureError(error, {
        context: 'error_test',
        user: req.user,
        request: req,
        testError: true,
        errorType: req.query.type,
      });
      
      res.status(500).json({
        success: false,
        error: 'Test error generated successfully',
        data: {
          message: 'This error was generated for testing purposes',
          errorInfo: {
            category: errorInfo.category,
            severity: errorInfo.severity,
            userImpact: errorInfo.userImpact,
            tracked: true,
          }
        }
      });
    }
  }

  /**
   * Get monitoring dashboard data
   */
  static async getDashboard(req, res) {
    try {
      const timer = errorTracker.createTimer('dashboard_data');
      
      const health = metricsCollector.getHealthStatus();
      const metrics = metricsCollector.getMetricsJSON();
      const errorStats = errorTracker.getErrorStats();
      const performanceStats = errorTracker.getPerformanceStats();
      
      const dashboard = {
        status: health.status,
        timestamp: new Date().toISOString(),
        
        // Key metrics
        overview: {
          uptime: process.uptime(),
          memoryUsage: health.summary.memoryUsage,
          loadAverage: health.summary.loadAverage,
          errorRate: errorStats.totalErrors / (errorStats.totalErrors + performanceStats.totalOperations || 1),
          averageResponseTime: performanceStats.averageResponseTime,
        },
        
        // Component health
        components: health.checks,
        
        // Recent activity
        activity: {
          recentErrors: errorStats.topErrors.slice(0, 3),
          slowOperations: performanceStats.slowestOperations.slice(0, 3),
          totalRequests: performanceStats.totalOperations,
          errorCount: errorStats.totalErrors,
        },
        
        // System resources
        resources: {
          memory: {
            used: metrics.gauges['node_memory_heap_used_bytes'],
            total: metrics.gauges['node_memory_heap_total_bytes'],
            percent: metrics.gauges['node_memory_usage_percent'],
          },
          database: {
            connected: metrics.gauges['database_connection_active'] === 1,
            connections: metrics.gauges['database_connections_active'],
          },
          redis: {
            connected: metrics.gauges['redis_connection_active'] === 1,
            memory: metrics.gauges['redis_memory_used_bytes'],
          },
        },
        
        // Alerts and warnings
        alerts: health.status !== 'healthy' ? [
          {
            type: 'warning',
            message: `System status is ${health.status}`,
            timestamp: new Date().toISOString(),
          }
        ] : [],
      };
      
      timer.end({ type: 'dashboard' });
      
      res.json({
        success: true,
        data: dashboard
      });
      
    } catch (error) {
      logger.error('Failed to get dashboard data:', error);
      errorTracker.captureError(error, { context: 'dashboard_endpoint' });
      
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve dashboard data'
      });
    }
  }
}