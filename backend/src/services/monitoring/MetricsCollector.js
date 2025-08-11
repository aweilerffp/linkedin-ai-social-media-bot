import os from 'os';
import { logger } from '../../utils/logger.js';
import { getRedisClient } from '../../config/redis.js';
import { query } from '../../config/database.js';

/**
 * Advanced metrics collection service for monitoring application health,
 * performance, and business metrics in real-time
 */
export class MetricsCollector {
  constructor() {
    this.metrics = new Map();
    this.gauges = new Map();
    this.counters = new Map();
    this.histograms = new Map();
    this.startTime = Date.now();
    this.collectionInterval = null;
    
    // Initialize metric collection
    this.startCollection();
  }

  /**
   * Start automatic metric collection
   */
  startCollection() {
    // Collect system metrics every 30 seconds
    this.collectionInterval = setInterval(() => {
      this.collectSystemMetrics();
      this.collectDatabaseMetrics();
      this.collectRedisMetrics();
      this.collectBusinessMetrics();
      this.cleanupOldMetrics();
    }, 30000);

    logger.info('Metrics collection started');
  }

  /**
   * Stop metric collection
   */
  stopCollection() {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
      logger.info('Metrics collection stopped');
    }
  }

  /**
   * Increment a counter metric
   */
  incrementCounter(name, value = 1, labels = {}) {
    const key = this.createMetricKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
    
    logger.debug('Counter incremented:', { name, value, labels, total: current + value });
    
    return current + value;
  }

  /**
   * Set a gauge metric (current value)
   */
  setGauge(name, value, labels = {}) {
    const key = this.createMetricKey(name, labels);
    this.gauges.set(key, {
      value,
      timestamp: Date.now(),
      labels
    });
    
    logger.debug('Gauge set:', { name, value, labels });
    
    return value;
  }

  /**
   * Record a histogram value (for measuring distributions)
   */
  recordHistogram(name, value, labels = {}) {
    const key = this.createMetricKey(name, labels);
    
    if (!this.histograms.has(key)) {
      this.histograms.set(key, {
        values: [],
        labels,
        count: 0,
        sum: 0,
      });
    }
    
    const histogram = this.histograms.get(key);
    histogram.values.push({
      value,
      timestamp: Date.now()
    });
    histogram.count++;
    histogram.sum += value;
    
    // Keep only last 1000 values per histogram
    if (histogram.values.length > 1000) {
      const removedValue = histogram.values.shift();
      histogram.sum -= removedValue.value;
      histogram.count = histogram.values.length;
    }
    
    logger.debug('Histogram recorded:', { name, value, labels, count: histogram.count });
    
    return histogram;
  }

  /**
   * Create a unique key for metric with labels
   */
  createMetricKey(name, labels = {}) {
    const labelString = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}="${value}"`)
      .join(',');
    
    return labelString ? `${name}{${labelString}}` : name;
  }

  /**
   * Collect system-level metrics
   */
  async collectSystemMetrics() {
    try {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      const loadAvg = os.loadavg();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const uptime = process.uptime();
      
      // Memory metrics
      this.setGauge('node_memory_heap_used_bytes', memUsage.heapUsed);
      this.setGauge('node_memory_heap_total_bytes', memUsage.heapTotal);
      this.setGauge('node_memory_external_bytes', memUsage.external);
      this.setGauge('node_memory_rss_bytes', memUsage.rss);
      
      // CPU metrics
      this.setGauge('node_cpu_user_microseconds', cpuUsage.user);
      this.setGauge('node_cpu_system_microseconds', cpuUsage.system);
      
      // System metrics
      this.setGauge('system_memory_total_bytes', totalMem);
      this.setGauge('system_memory_free_bytes', freeMem);
      this.setGauge('system_memory_used_bytes', totalMem - freeMem);
      this.setGauge('system_load_average_1m', loadAvg[0]);
      this.setGauge('system_load_average_5m', loadAvg[1]);
      this.setGauge('system_load_average_15m', loadAvg[2]);
      
      // Process metrics
      this.setGauge('node_process_uptime_seconds', uptime);
      this.setGauge('node_process_start_time_seconds', (Date.now() - uptime * 1000) / 1000);
      
      // Calculate memory usage percentage
      const memUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
      const systemMemUsagePercent = ((totalMem - freeMem) / totalMem) * 100;
      
      this.setGauge('node_memory_usage_percent', memUsagePercent);
      this.setGauge('system_memory_usage_percent', systemMemUsagePercent);
      
      logger.debug('System metrics collected', {
        memUsagePercent: memUsagePercent.toFixed(2),
        systemMemUsagePercent: systemMemUsagePercent.toFixed(2),
        loadAvg: loadAvg[0].toFixed(2)
      });
      
    } catch (error) {
      logger.error('Failed to collect system metrics:', error);
    }
  }

  /**
   * Collect database metrics
   */
  async collectDatabaseMetrics() {
    try {
      const startTime = Date.now();
      
      // Test database connection and measure response time
      const result = await query('SELECT 1 as health_check');
      const responseTime = Date.now() - startTime;
      
      this.setGauge('database_connection_active', 1);
      this.recordHistogram('database_query_duration_ms', responseTime, { type: 'health_check' });
      
      // Get database statistics
      const statsQuery = `
        SELECT 
          schemaname,
          tablename,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          n_live_tup as live_tuples,
          n_dead_tup as dead_tuples
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC
        LIMIT 10
      `;
      
      const stats = await query(statsQuery);
      
      if (stats.rows && stats.rows.length > 0) {
        for (const table of stats.rows) {
          this.setGauge('database_table_inserts_total', table.inserts, { 
            schema: table.schemaname, 
            table: table.tablename 
          });
          this.setGauge('database_table_updates_total', table.updates, { 
            schema: table.schemaname, 
            table: table.tablename 
          });
          this.setGauge('database_table_deletes_total', table.deletes, { 
            schema: table.schemaname, 
            table: table.tablename 
          });
          this.setGauge('database_table_live_tuples', table.live_tuples, { 
            schema: table.schemaname, 
            table: table.tablename 
          });
          this.setGauge('database_table_dead_tuples', table.dead_tuples, { 
            schema: table.schemaname, 
            table: table.tablename 
          });
        }
      }
      
      // Database size information
      const sizeQuery = `
        SELECT 
          pg_database_size(current_database()) as database_size,
          count(*) as connection_count
        FROM pg_stat_activity
        WHERE datname = current_database()
      `;
      
      const sizeResult = await query(sizeQuery);
      if (sizeResult.rows && sizeResult.rows[0]) {
        this.setGauge('database_size_bytes', parseInt(sizeResult.rows[0].database_size));
        this.setGauge('database_connections_active', parseInt(sizeResult.rows[0].connection_count));
      }
      
      logger.debug('Database metrics collected', {
        responseTime,
        tablesMonitored: stats.rows?.length || 0
      });
      
    } catch (error) {
      logger.error('Failed to collect database metrics:', error);
      this.setGauge('database_connection_active', 0);
      this.incrementCounter('database_errors_total', 1, { type: 'metrics_collection' });
    }
  }

  /**
   * Collect Redis metrics
   */
  async collectRedisMetrics() {
    try {
      const redis = getRedisClient();
      const startTime = Date.now();
      
      // Test Redis connection
      const pingResult = await redis.ping();
      const responseTime = Date.now() - startTime;
      
      this.setGauge('redis_connection_active', pingResult === 'PONG' ? 1 : 0);
      this.recordHistogram('redis_command_duration_ms', responseTime, { command: 'ping' });
      
      // Get Redis info
      const info = await redis.info();
      const infoLines = info.split('\r\n');
      const redisStats = {};
      
      for (const line of infoLines) {
        if (line.includes(':') && !line.startsWith('#')) {
          const [key, value] = line.split(':');
          redisStats[key] = value;
        }
      }
      
      // Memory metrics
      if (redisStats.used_memory) {
        this.setGauge('redis_memory_used_bytes', parseInt(redisStats.used_memory));
      }
      if (redisStats.used_memory_peak) {
        this.setGauge('redis_memory_peak_bytes', parseInt(redisStats.used_memory_peak));
      }
      if (redisStats.maxmemory && parseInt(redisStats.maxmemory) > 0) {
        this.setGauge('redis_memory_max_bytes', parseInt(redisStats.maxmemory));
        const usagePercent = (parseInt(redisStats.used_memory) / parseInt(redisStats.maxmemory)) * 100;
        this.setGauge('redis_memory_usage_percent', usagePercent);
      }
      
      // Connection metrics
      if (redisStats.connected_clients) {
        this.setGauge('redis_connected_clients', parseInt(redisStats.connected_clients));
      }
      if (redisStats.rejected_connections) {
        this.setGauge('redis_rejected_connections_total', parseInt(redisStats.rejected_connections));
      }
      
      // Commands metrics
      if (redisStats.total_commands_processed) {
        this.setGauge('redis_commands_processed_total', parseInt(redisStats.total_commands_processed));
      }
      if (redisStats.instantaneous_ops_per_sec) {
        this.setGauge('redis_operations_per_second', parseInt(redisStats.instantaneous_ops_per_sec));
      }
      
      // Keyspace metrics
      if (redisStats.db0) {
        const match = redisStats.db0.match(/keys=(\d+),expires=(\d+)/);
        if (match) {
          this.setGauge('redis_keys_total', parseInt(match[1]), { db: '0' });
          this.setGauge('redis_keys_expiring', parseInt(match[2]), { db: '0' });
        }
      }
      
      logger.debug('Redis metrics collected', {
        responseTime,
        memoryUsed: redisStats.used_memory,
        connectedClients: redisStats.connected_clients
      });
      
    } catch (error) {
      logger.error('Failed to collect Redis metrics:', error);
      this.setGauge('redis_connection_active', 0);
      this.incrementCounter('redis_errors_total', 1, { type: 'metrics_collection' });
    }
  }

  /**
   * Collect business metrics
   */
  async collectBusinessMetrics() {
    try {
      // Posts metrics
      const postsQuery = `
        SELECT 
          status,
          COUNT(*) as count,
          DATE_TRUNC('hour', created_at) as hour
        FROM posts 
        WHERE created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY status, hour
        ORDER BY hour DESC
      `;
      
      const postsResult = await query(postsQuery);
      
      if (postsResult.rows) {
        for (const row of postsResult.rows) {
          this.setGauge('posts_total', parseInt(row.count), { 
            status: row.status,
            period: 'last_24h'
          });
        }
      }
      
      // Platform metrics
      const platformQuery = `
        SELECT 
          platform,
          success,
          COUNT(*) as count
        FROM platform_results 
        WHERE created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY platform, success
      `;
      
      const platformResult = await query(platformQuery);
      
      if (platformResult.rows) {
        for (const row of platformResult.rows) {
          this.setGauge('platform_posts_total', parseInt(row.count), { 
            platform: row.platform,
            success: row.success.toString(),
            period: 'last_24h'
          });
        }
      }
      
      // User activity metrics
      const usersQuery = `
        SELECT 
          COUNT(*) as total_users,
          COUNT(*) FILTER (WHERE last_login_at >= NOW() - INTERVAL '24 hours') as active_users_24h,
          COUNT(*) FILTER (WHERE last_login_at >= NOW() - INTERVAL '7 days') as active_users_7d,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as new_users_24h
        FROM users 
        WHERE is_active = true
      `;
      
      const usersResult = await query(usersQuery);
      
      if (usersResult.rows && usersResult.rows[0]) {
        const userStats = usersResult.rows[0];
        this.setGauge('users_total', parseInt(userStats.total_users));
        this.setGauge('users_active_24h', parseInt(userStats.active_users_24h));
        this.setGauge('users_active_7d', parseInt(userStats.active_users_7d));
        this.setGauge('users_new_24h', parseInt(userStats.new_users_24h));
      }
      
      // Queue metrics (if Bull queue is available)
      try {
        const redis = getRedisClient();
        const queueKeys = await redis.keys('bull:*');
        
        for (const key of queueKeys) {
          if (key.includes(':waiting')) {
            const waitingCount = await redis.llen(key);
            const queueName = key.split(':')[1];
            this.setGauge('queue_jobs_waiting', waitingCount, { queue: queueName });
          }
          if (key.includes(':active')) {
            const activeCount = await redis.llen(key);
            const queueName = key.split(':')[1];
            this.setGauge('queue_jobs_active', activeCount, { queue: queueName });
          }
          if (key.includes(':completed')) {
            const completedCount = await redis.llen(key);
            const queueName = key.split(':')[1];
            this.setGauge('queue_jobs_completed', completedCount, { queue: queueName });
          }
          if (key.includes(':failed')) {
            const failedCount = await redis.llen(key);
            const queueName = key.split(':')[1];
            this.setGauge('queue_jobs_failed', failedCount, { queue: queueName });
          }
        }
      } catch (queueError) {
        logger.debug('Queue metrics collection error:', queueError.message);
      }
      
      logger.debug('Business metrics collected');
      
    } catch (error) {
      logger.error('Failed to collect business metrics:', error);
      this.incrementCounter('business_metrics_errors_total', 1);
    }
  }

  /**
   * Get all metrics in Prometheus format
   */
  getMetricsPrometheus() {
    const lines = [];
    
    // Add counters
    for (const [key, value] of this.counters.entries()) {
      const metricName = key.split('{')[0];
      lines.push(`# TYPE ${metricName} counter`);
      lines.push(`${key} ${value}`);
    }
    
    // Add gauges
    for (const [key, data] of this.gauges.entries()) {
      const metricName = key.split('{')[0];
      lines.push(`# TYPE ${metricName} gauge`);
      lines.push(`${key} ${data.value}`);
    }
    
    // Add histograms
    for (const [key, histogram] of this.histograms.entries()) {
      const metricName = key.split('{')[0];
      const baseKey = key.replace('}', ',');
      
      lines.push(`# TYPE ${metricName} histogram`);
      
      // Calculate percentiles
      const sortedValues = [...histogram.values].sort((a, b) => a.value - b.value);
      const p50 = this.calculatePercentile(sortedValues, 0.5);
      const p90 = this.calculatePercentile(sortedValues, 0.9);
      const p95 = this.calculatePercentile(sortedValues, 0.95);
      const p99 = this.calculatePercentile(sortedValues, 0.99);
      
      lines.push(`${baseKey}quantile="0.5"} ${p50}`);
      lines.push(`${baseKey}quantile="0.9"} ${p90}`);
      lines.push(`${baseKey}quantile="0.95"} ${p95}`);
      lines.push(`${baseKey}quantile="0.99"} ${p99}`);
      lines.push(`${baseKey.replace(',', '_sum,')} ${histogram.sum}`);
      lines.push(`${baseKey.replace(',', '_count,')} ${histogram.count}`);
    }
    
    return lines.join('\n');
  }

  /**
   * Get metrics as JSON
   */
  getMetricsJSON() {
    const metrics = {
      timestamp: new Date().toISOString(),
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(
        Array.from(this.gauges.entries()).map(([key, data]) => [key, data.value])
      ),
      histograms: {}
    };
    
    // Process histograms
    for (const [key, histogram] of this.histograms.entries()) {
      const sortedValues = [...histogram.values].sort((a, b) => a.value - b.value);
      
      metrics.histograms[key] = {
        count: histogram.count,
        sum: histogram.sum,
        avg: histogram.count > 0 ? histogram.sum / histogram.count : 0,
        min: sortedValues.length > 0 ? sortedValues[0].value : 0,
        max: sortedValues.length > 0 ? sortedValues[sortedValues.length - 1].value : 0,
        p50: this.calculatePercentile(sortedValues, 0.5),
        p90: this.calculatePercentile(sortedValues, 0.9),
        p95: this.calculatePercentile(sortedValues, 0.95),
        p99: this.calculatePercentile(sortedValues, 0.99),
      };
    }
    
    return metrics;
  }

  /**
   * Calculate percentile from sorted values
   */
  calculatePercentile(sortedValues, percentile) {
    if (sortedValues.length === 0) return 0;
    
    const index = Math.ceil(sortedValues.length * percentile) - 1;
    return sortedValues[Math.max(0, index)]?.value || 0;
  }

  /**
   * Get health status based on metrics
   */
  getHealthStatus() {
    const status = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {},
      summary: {}
    };
    
    // Check database connection
    const dbConnected = this.gauges.get('database_connection_active')?.value === 1;
    status.checks.database = {
      status: dbConnected ? 'healthy' : 'unhealthy',
      message: dbConnected ? 'Database connection active' : 'Database connection failed'
    };
    
    // Check Redis connection
    const redisConnected = this.gauges.get('redis_connection_active')?.value === 1;
    status.checks.redis = {
      status: redisConnected ? 'healthy' : 'unhealthy',
      message: redisConnected ? 'Redis connection active' : 'Redis connection failed'
    };
    
    // Check memory usage
    const memUsage = this.gauges.get('node_memory_usage_percent')?.value || 0;
    status.checks.memory = {
      status: memUsage < 90 ? 'healthy' : 'warning',
      message: `Memory usage: ${memUsage.toFixed(2)}%`,
      value: memUsage
    };
    
    // Check system load
    const loadAvg = this.gauges.get('system_load_average_1m')?.value || 0;
    const cpuCount = os.cpus().length;
    const loadPercent = (loadAvg / cpuCount) * 100;
    
    status.checks.load = {
      status: loadPercent < 80 ? 'healthy' : 'warning',
      message: `Load average: ${loadAvg.toFixed(2)} (${loadPercent.toFixed(2)}% of ${cpuCount} CPUs)`,
      value: loadAvg
    };
    
    // Overall status
    const unhealthyChecks = Object.values(status.checks).filter(check => check.status === 'unhealthy');
    const warningChecks = Object.values(status.checks).filter(check => check.status === 'warning');
    
    if (unhealthyChecks.length > 0) {
      status.status = 'unhealthy';
    } else if (warningChecks.length > 0) {
      status.status = 'degraded';
    }
    
    // Summary
    status.summary = {
      uptime: process.uptime(),
      memoryUsage: memUsage,
      loadAverage: loadAvg,
      databaseConnected: dbConnected,
      redisConnected: redisConnected,
    };
    
    return status;
  }

  /**
   * Clean up old metrics to prevent memory leaks
   */
  cleanupOldMetrics() {
    const oneHour = 60 * 60 * 1000;
    const cutoff = Date.now() - oneHour;
    
    // Clean up old gauge values
    for (const [key, data] of this.gauges.entries()) {
      if (data.timestamp < cutoff) {
        this.gauges.delete(key);
      }
    }
    
    // Clean up histogram values
    for (const [key, histogram] of this.histograms.entries()) {
      histogram.values = histogram.values.filter(v => v.timestamp > cutoff);
      
      // Recalculate sum and count
      histogram.sum = histogram.values.reduce((sum, v) => sum + v.value, 0);
      histogram.count = histogram.values.length;
      
      // Remove empty histograms
      if (histogram.values.length === 0) {
        this.histograms.delete(key);
      }
    }
    
    logger.debug('Old metrics cleaned up');
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    logger.info('All metrics reset');
  }

  /**
   * Get metric by name and labels
   */
  getMetric(name, labels = {}) {
    const key = this.createMetricKey(name, labels);
    
    return {
      counter: this.counters.get(key),
      gauge: this.gauges.get(key),
      histogram: this.histograms.get(key)
    };
  }
}

// Export singleton instance
export const metricsCollector = new MetricsCollector();