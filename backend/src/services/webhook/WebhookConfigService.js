import { query } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { webhookService } from './WebhookService.js';

export class WebhookConfigService {
  /**
   * Create webhook configuration
   */
  async createWebhookConfig(teamId, data) {
    const { url, events, secret, isActive = true, name, description } = data;

    // Validate webhook URL
    if (!webhookService.isValidWebhookUrl(url)) {
      throw new ApiError(400, 'Invalid webhook URL');
    }

    // Validate events array
    const validEvents = [
      'post.published',
      'post.failed',
      'post.scheduled',
      'user.invited',
      'platform.connected',
      'platform.disconnected',
      'webhook.test',
    ];

    if (!Array.isArray(events) || events.length === 0) {
      throw new ApiError(400, 'Events array is required');
    }

    const invalidEvents = events.filter(event => !validEvents.includes(event));
    if (invalidEvents.length > 0) {
      throw new ApiError(400, `Invalid events: ${invalidEvents.join(', ')}`);
    }

    try {
      const result = await query(`
        INSERT INTO webhook_configs (team_id, url, events, secret, is_active, name, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [teamId, url, JSON.stringify(events), secret, isActive, name, description]);

      const webhookConfig = result.rows[0];

      logger.info('Webhook configuration created', {
        webhookId: webhookConfig.id,
        teamId,
        url: webhookConfig.url,
        events: events.length,
      });

      return {
        ...webhookConfig,
        events: JSON.parse(webhookConfig.events),
      };
    } catch (error) {
      if (error.code === '23505') { // Unique constraint violation
        throw new ApiError(409, 'Webhook URL already exists for this team');
      }
      throw error;
    }
  }

  /**
   * Get webhook configurations for team
   */
  async getWebhookConfigs(teamId) {
    try {
      const result = await query(`
        SELECT * FROM webhook_configs 
        WHERE team_id = $1 
        ORDER BY created_at DESC
      `, [teamId]);

      return result.rows.map(config => ({
        ...config,
        events: JSON.parse(config.events),
        // Don't expose secret in response
        secret: undefined,
      }));
    } catch (error) {
      logger.error('Error fetching webhook configs:', error);
      throw error;
    }
  }

  /**
   * Get webhook configuration by ID
   */
  async getWebhookConfig(id, teamId) {
    try {
      const result = await query(`
        SELECT * FROM webhook_configs 
        WHERE id = $1 AND team_id = $2
      `, [id, teamId]);

      if (result.rows.length === 0) {
        throw new ApiError(404, 'Webhook configuration not found');
      }

      const config = result.rows[0];
      return {
        ...config,
        events: JSON.parse(config.events),
        // Don't expose secret in response
        secret: undefined,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Error fetching webhook config:', error);
      throw error;
    }
  }

  /**
   * Update webhook configuration
   */
  async updateWebhookConfig(id, teamId, data) {
    const { url, events, secret, isActive, name, description } = data;
    const updates = [];
    const values = [];
    let paramCount = 0;

    if (url !== undefined) {
      if (!webhookService.isValidWebhookUrl(url)) {
        throw new ApiError(400, 'Invalid webhook URL');
      }
      updates.push(`url = $${++paramCount}`);
      values.push(url);
    }

    if (events !== undefined) {
      const validEvents = [
        'post.published',
        'post.failed',
        'post.scheduled',
        'user.invited',
        'platform.connected',
        'platform.disconnected',
        'webhook.test',
      ];

      if (!Array.isArray(events) || events.length === 0) {
        throw new ApiError(400, 'Events array is required');
      }

      const invalidEvents = events.filter(event => !validEvents.includes(event));
      if (invalidEvents.length > 0) {
        throw new ApiError(400, `Invalid events: ${invalidEvents.join(', ')}`);
      }

      updates.push(`events = $${++paramCount}`);
      values.push(JSON.stringify(events));
    }

    if (secret !== undefined) {
      updates.push(`secret = $${++paramCount}`);
      values.push(secret);
    }

    if (isActive !== undefined) {
      updates.push(`is_active = $${++paramCount}`);
      values.push(isActive);
    }

    if (name !== undefined) {
      updates.push(`name = $${++paramCount}`);
      values.push(name);
    }

    if (description !== undefined) {
      updates.push(`description = $${++paramCount}`);
      values.push(description);
    }

    if (updates.length === 0) {
      throw new ApiError(400, 'No fields to update');
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id, teamId);

    try {
      const result = await query(`
        UPDATE webhook_configs 
        SET ${updates.join(', ')}
        WHERE id = $${paramCount + 1} AND team_id = $${paramCount + 2}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        throw new ApiError(404, 'Webhook configuration not found');
      }

      const config = result.rows[0];

      logger.info('Webhook configuration updated', {
        webhookId: id,
        teamId,
        updatedFields: Object.keys(data),
      });

      return {
        ...config,
        events: JSON.parse(config.events),
        secret: undefined,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      if (error.code === '23505') {
        throw new ApiError(409, 'Webhook URL already exists for this team');
      }
      throw error;
    }
  }

  /**
   * Delete webhook configuration
   */
  async deleteWebhookConfig(id, teamId) {
    try {
      const result = await query(`
        DELETE FROM webhook_configs 
        WHERE id = $1 AND team_id = $2
        RETURNING id
      `, [id, teamId]);

      if (result.rows.length === 0) {
        throw new ApiError(404, 'Webhook configuration not found');
      }

      logger.info('Webhook configuration deleted', {
        webhookId: id,
        teamId,
      });

      return { success: true };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Error deleting webhook config:', error);
      throw error;
    }
  }

  /**
   * Test webhook configuration
   */
  async testWebhookConfig(id, teamId) {
    try {
      const result = await query(`
        SELECT url, secret FROM webhook_configs 
        WHERE id = $1 AND team_id = $2 AND is_active = true
      `, [id, teamId]);

      if (result.rows.length === 0) {
        throw new ApiError(404, 'Active webhook configuration not found');
      }

      const { url, secret } = result.rows[0];
      const testResult = await webhookService.testWebhook(url, secret);

      // Log test attempt
      await query(`
        INSERT INTO webhook_deliveries (
          webhook_config_id, event, status, response_code, response_body, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        id,
        'webhook.test',
        testResult.success ? 'success' : 'failed',
        testResult.statusCode || null,
        JSON.stringify(testResult),
        JSON.stringify({ test: true, teamId })
      ]);

      return testResult;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Error testing webhook config:', error);
      throw error;
    }
  }

  /**
   * Get active webhook URLs for team and event
   */
  async getActiveWebhookUrls(teamId, event) {
    try {
      const result = await query(`
        SELECT url, secret 
        FROM webhook_configs 
        WHERE team_id = $1 
          AND is_active = true 
          AND events::jsonb ? $2
      `, [teamId, event]);

      return result.rows;
    } catch (error) {
      logger.error('Error fetching active webhook URLs:', error);
      return [];
    }
  }

  /**
   * Record webhook delivery
   */
  async recordWebhookDelivery(webhookConfigId, event, status, responseCode, responseBody, metadata = {}) {
    try {
      await query(`
        INSERT INTO webhook_deliveries (
          webhook_config_id, event, status, response_code, response_body, metadata, delivered_at
        ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      `, [
        webhookConfigId,
        event,
        status,
        responseCode,
        JSON.stringify(responseBody),
        JSON.stringify(metadata)
      ]);
    } catch (error) {
      logger.error('Error recording webhook delivery:', error);
    }
  }

  /**
   * Get webhook delivery history
   */
  async getWebhookDeliveries(webhookConfigId, options = {}) {
    const { limit = 50, offset = 0, status, event } = options;
    
    let whereClause = 'webhook_config_id = $1';
    const values = [webhookConfigId];
    let paramCount = 1;

    if (status) {
      whereClause += ` AND status = $${++paramCount}`;
      values.push(status);
    }

    if (event) {
      whereClause += ` AND event = $${++paramCount}`;
      values.push(event);
    }

    try {
      const result = await query(`
        SELECT id, event, status, response_code, response_body, metadata, delivered_at, created_at
        FROM webhook_deliveries 
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${++paramCount} OFFSET $${++paramCount}
      `, [...values, limit, offset]);

      return result.rows.map(delivery => ({
        ...delivery,
        response_body: JSON.parse(delivery.response_body || '{}'),
        metadata: JSON.parse(delivery.metadata || '{}'),
      }));
    } catch (error) {
      logger.error('Error fetching webhook deliveries:', error);
      throw error;
    }
  }

  /**
   * Get webhook statistics
   */
  async getWebhookStats(teamId, webhookConfigId = null) {
    try {
      let query_text, values;

      if (webhookConfigId) {
        query_text = `
          SELECT 
            event,
            status,
            COUNT(*) as count,
            AVG(CASE WHEN response_code IS NOT NULL THEN response_code END) as avg_response_code
          FROM webhook_deliveries wd
          JOIN webhook_configs wc ON wd.webhook_config_id = wc.id
          WHERE wc.team_id = $1 AND wd.webhook_config_id = $2
          GROUP BY event, status
          ORDER BY event, status
        `;
        values = [teamId, webhookConfigId];
      } else {
        query_text = `
          SELECT 
            event,
            status,
            COUNT(*) as count,
            AVG(CASE WHEN response_code IS NOT NULL THEN response_code END) as avg_response_code
          FROM webhook_deliveries wd
          JOIN webhook_configs wc ON wd.webhook_config_id = wc.id
          WHERE wc.team_id = $1
          GROUP BY event, status
          ORDER BY event, status
        `;
        values = [teamId];
      }

      const result = await query(query_text, values);
      
      // Group by event
      const stats = {};
      result.rows.forEach(row => {
        if (!stats[row.event]) {
          stats[row.event] = {
            total: 0,
            success: 0,
            failed: 0,
            pending: 0,
          };
        }
        
        stats[row.event].total += parseInt(row.count);
        stats[row.event][row.status] = parseInt(row.count);
      });

      return stats;
    } catch (error) {
      logger.error('Error fetching webhook stats:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const webhookConfigService = new WebhookConfigService();