import { ApiError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import pool from '../config/database.js';

export class MarketingHooksController {
  /**
   * Get dashboard data for AI content
   */
  static async getDashboardData(req, res, next) {
    try {
      const { teamId } = req.user;
      
      // Get company profile
      const companyProfileQuery = `
        SELECT 
          id, company_name, industry, brand_voice, 
          content_pillars, target_personas, evaluation_questions
        FROM company_profiles 
        WHERE team_id = $1
      `;
      const companyProfile = await pool.query(companyProfileQuery, [teamId]);
      
      // Get recent transcripts with hook counts
      const transcriptsQuery = `
        SELECT 
          mt.id, mt.meeting_id, mt.title, mt.meeting_date,
          mt.duration, mt.source, mt.created_at,
          COUNT(DISTINCT mh.id) as hooks_count,
          COUNT(DISTINCT CASE WHEN mh.status = 'approved' THEN mh.id END) as approved_hooks,
          COUNT(DISTINCT CASE WHEN mh.status = 'published' THEN mh.id END) as published_hooks
        FROM meeting_transcripts mt
        LEFT JOIN marketing_hooks mh ON mt.id = mh.meeting_transcript_id
        WHERE mt.team_id = $1
        GROUP BY mt.id
        ORDER BY mt.meeting_date DESC
        LIMIT 10
      `;
      const transcripts = await pool.query(transcriptsQuery, [teamId]);
      
      // Get content pipeline (transcripts → hooks → posts)
      const pipelineQuery = `
        SELECT 
          mt.id as transcript_id,
          mt.title as meeting_title,
          mt.meeting_date,
          COUNT(DISTINCT mh.id) as insights_count,
          COUNT(DISTINCT CASE WHEN mh.status = 'approved' THEN mh.id END) as approved_posts,
          COUNT(DISTINCT CASE WHEN mh.status = 'published' THEN mh.id END) as published_posts,
          MAX(mh.created_at) as last_activity
        FROM meeting_transcripts mt
        LEFT JOIN marketing_hooks mh ON mt.id = mh.meeting_transcript_id
        WHERE mt.team_id = $1
        GROUP BY mt.id
        ORDER BY mt.meeting_date DESC
        LIMIT 20
      `;
      const pipeline = await pool.query(pipelineQuery, [teamId]);
      
      // Get queue status (hooks awaiting approval/publishing)
      const queueQuery = `
        SELECT 
          id, pillar, source_quote, linkedin_post as content_preview,
          insight_score, status, created_at as scheduled_time,
          CHAR_LENGTH(linkedin_post) as character_count,
          5 as priority
        FROM marketing_hooks
        WHERE team_id = $1 AND status IN ('generated', 'approved')
        ORDER BY insight_score DESC, created_at DESC
        LIMIT 10
      `;
      const queue = await pool.query(queueQuery, [teamId]);
      
      // Get performance metrics
      const metricsQuery = `
        SELECT 
          COUNT(DISTINCT mt.id) as total_transcripts,
          COUNT(DISTINCT mh.id) as total_insights,
          COUNT(DISTINCT CASE WHEN mh.status = 'published' THEN mh.id END) as total_posts,
          COUNT(DISTINCT CASE WHEN mh.status IN ('generated', 'approved') THEN mh.id END) as queued_posts,
          COUNT(DISTINCT CASE WHEN mh.status = 'published' THEN mh.id END) as published_posts,
          AVG(CASE WHEN hp.engagement_rate IS NOT NULL THEN hp.engagement_rate ELSE 0 END) as avg_engagement_rate
        FROM meeting_transcripts mt
        LEFT JOIN marketing_hooks mh ON mt.id = mh.meeting_transcript_id
        LEFT JOIN hook_performance hp ON mh.id = hp.marketing_hook_id
        WHERE mt.team_id = $1
      `;
      const metrics = await pool.query(metricsQuery, [teamId]);
      
      // Get pillar performance
      const pillarPerformanceQuery = `
        SELECT 
          pillar as name,
          COUNT(*) as posts_count,
          AVG(insight_score) as avg_score,
          AVG(COALESCE(hp.engagement_rate, 0)) as engagement_rate
        FROM marketing_hooks mh
        LEFT JOIN hook_performance hp ON mh.id = hp.marketing_hook_id
        WHERE mh.team_id = $1
        GROUP BY pillar
        ORDER BY posts_count DESC
        LIMIT 5
      `;
      const pillarPerformance = await pool.query(pillarPerformanceQuery, [teamId]);
      
      res.json({
        success: true,
        data: {
          company_profile: companyProfile.rows[0] || null,
          recent_transcripts: transcripts.rows,
          content_pipeline: pipeline.rows.map(row => ({
            ...row,
            posts_count: row.insights_count // Alias for compatibility
          })),
          queue_status: queue.rows,
          performance_metrics: {
            ...metrics.rows[0],
            pillar_performance: pillarPerformance.rows
          }
        }
      });
      
    } catch (error) {
      logger.error('Error fetching dashboard data:', error);
      next(error);
    }
  }
  
  /**
   * Get marketing hooks for a specific transcript
   */
  static async getTranscriptHooks(req, res, next) {
    try {
      const { teamId } = req.user;
      const { transcriptId } = req.params;
      
      // Verify transcript belongs to team
      const transcriptCheck = await pool.query(
        'SELECT id FROM meeting_transcripts WHERE id = $1 AND team_id = $2',
        [transcriptId, teamId]
      );
      
      if (transcriptCheck.rows.length === 0) {
        throw new ApiError(404, 'Transcript not found');
      }
      
      // Get all hooks for this transcript
      const hooksQuery = `
        SELECT 
          id, pillar, source_quote, insight_score,
          linkedin_post as linkedin, blog_title, blog_hook,
          tweet, status, approved_by, approved_at,
          published_at, model_used, tokens_used,
          processing_cost, generation_timestamp,
          created_at, updated_at
        FROM marketing_hooks
        WHERE meeting_transcript_id = $1
        ORDER BY insight_score DESC, created_at DESC
      `;
      
      const hooks = await pool.query(hooksQuery, [transcriptId]);
      
      // Get transcript details
      const transcriptQuery = `
        SELECT 
          id, meeting_id, title, meeting_date,
          duration, participants, summary, source,
          created_at
        FROM meeting_transcripts
        WHERE id = $1
      `;
      
      const transcript = await pool.query(transcriptQuery, [transcriptId]);
      
      res.json({
        success: true,
        data: {
          transcript: transcript.rows[0],
          insights: hooks.rows.map(hook => ({
            ...hook,
            blog: {
              title: hook.blog_title,
              hook: hook.blog_hook
            }
          })),
          metadata: {
            total_insights: hooks.rows.length,
            approved_count: hooks.rows.filter(h => h.status === 'approved').length,
            published_count: hooks.rows.filter(h => h.status === 'published').length
          }
        }
      });
      
    } catch (error) {
      logger.error('Error fetching transcript hooks:', error);
      next(error);
    }
  }
  
  /**
   * Update hook status (approve/reject/publish)
   */
  static async updateHookStatus(req, res, next) {
    try {
      const { teamId, id: userId } = req.user;
      const { hookId } = req.params;
      const { status, reason } = req.body;
      
      const validStatuses = ['approved', 'rejected', 'published'];
      if (!validStatuses.includes(status)) {
        throw new ApiError(400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }
      
      // Verify hook belongs to team
      const hookCheck = await pool.query(
        'SELECT id FROM marketing_hooks WHERE id = $1 AND team_id = $2',
        [hookId, teamId]
      );
      
      if (hookCheck.rows.length === 0) {
        throw new ApiError(404, 'Marketing hook not found');
      }
      
      // Update hook status
      const updateQuery = `
        UPDATE marketing_hooks
        SET 
          status = $1,
          approved_by = CASE WHEN $1 IN ('approved', 'rejected') THEN $2 ELSE approved_by END,
          approved_at = CASE WHEN $1 IN ('approved', 'rejected') THEN CURRENT_TIMESTAMP ELSE approved_at END,
          published_at = CASE WHEN $1 = 'published' THEN CURRENT_TIMESTAMP ELSE published_at END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `;
      
      const result = await pool.query(updateQuery, [status, userId, hookId]);
      
      logger.info('Marketing hook status updated', {
        hookId,
        status,
        userId,
        teamId
      });
      
      res.json({
        success: true,
        data: result.rows[0],
        message: `Hook ${status} successfully`
      });
      
    } catch (error) {
      logger.error('Error updating hook status:', error);
      next(error);
    }
  }
  
  /**
   * Get webhook events history
   */
  static async getWebhookEvents(req, res, next) {
    try {
      const { teamId } = req.user;
      const { limit = 50, offset = 0, status, event_type } = req.query;
      
      let query = `
        SELECT 
          we.id, we.webhook_id, we.event_type, we.status,
          we.processing_time_ms, we.error_message, we.retry_count,
          we.created_at, we.processing_completed_at,
          mt.title as meeting_title, mt.meeting_id,
          COUNT(mh.id) as hooks_generated
        FROM webhook_events we
        LEFT JOIN meeting_transcripts mt ON we.meeting_transcript_id = mt.id
        LEFT JOIN marketing_hooks mh ON mt.id = mh.meeting_transcript_id
        WHERE we.team_id = $1
      `;
      
      const params = [teamId];
      let paramIndex = 2;
      
      if (status) {
        query += ` AND we.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }
      
      if (event_type) {
        query += ` AND we.event_type = $${paramIndex}`;
        params.push(event_type);
        paramIndex++;
      }
      
      query += `
        GROUP BY we.id, mt.title, mt.meeting_id
        ORDER BY we.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      params.push(limit, offset);
      
      const events = await pool.query(query, params);
      
      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM webhook_events
        WHERE team_id = $1
        ${status ? `AND status = $2` : ''}
        ${event_type ? `AND event_type = $${status ? 3 : 2}` : ''}
      `;
      
      const countParams = [teamId];
      if (status) countParams.push(status);
      if (event_type) countParams.push(event_type);
      
      const count = await pool.query(countQuery, countParams);
      
      res.json({
        success: true,
        data: {
          events: events.rows,
          pagination: {
            total: parseInt(count.rows[0].total),
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: parseInt(offset) + events.rows.length < parseInt(count.rows[0].total)
          }
        }
      });
      
    } catch (error) {
      logger.error('Error fetching webhook events:', error);
      next(error);
    }
  }
  
  /**
   * Reprocess a transcript to generate new hooks
   */
  static async reprocessTranscript(req, res, next) {
    try {
      const { teamId } = req.user;
      const { transcriptId } = req.params;
      const { regenerate_all = false } = req.body;
      
      // Verify transcript belongs to team
      const transcript = await pool.query(
        'SELECT * FROM meeting_transcripts WHERE id = $1 AND team_id = $2',
        [transcriptId, teamId]
      );
      
      if (transcript.rows.length === 0) {
        throw new ApiError(404, 'Transcript not found');
      }
      
      // Get company profile
      const companyProfile = await pool.query(
        'SELECT * FROM company_profiles WHERE team_id = $1',
        [teamId]
      );
      
      if (companyProfile.rows.length === 0) {
        throw new ApiError(400, 'Company profile not found. Please complete onboarding first.');
      }
      
      // Queue for reprocessing
      const queueEntry = await pool.query(
        `INSERT INTO marketing_processing_queue 
         (webhook_event_id, status, priority, scheduled_at)
         VALUES (null, 'pending', 1, CURRENT_TIMESTAMP)
         RETURNING id`,
        []
      );
      
      logger.info('Transcript queued for reprocessing', {
        transcriptId,
        teamId,
        queueId: queueEntry.rows[0].id
      });
      
      res.json({
        success: true,
        data: {
          queue_id: queueEntry.rows[0].id,
          transcript_id: transcriptId,
          status: 'queued'
        },
        message: 'Transcript queued for reprocessing. New marketing hooks will be generated shortly.'
      });
      
    } catch (error) {
      logger.error('Error reprocessing transcript:', error);
      next(error);
    }
  }
  
  /**
   * Get company insights (RAG-enhanced context)
   */
  static async getCompanyInsights(req, res, next) {
    try {
      const { teamId } = req.user;
      
      // Get company profile
      const companyProfile = await pool.query(
        'SELECT * FROM company_profiles WHERE team_id = $1',
        [teamId]
      );
      
      if (companyProfile.rows.length === 0) {
        throw new ApiError(404, 'Company profile not found');
      }
      
      // Get hook performance statistics
      const performanceStats = await pool.query(
        `SELECT 
          pillar,
          COUNT(*) as total_hooks,
          AVG(insight_score) as avg_score,
          COUNT(CASE WHEN status = 'published' THEN 1 END) as published_count,
          AVG(COALESCE(hp.engagement_rate, 0)) as avg_engagement
        FROM marketing_hooks mh
        LEFT JOIN hook_performance hp ON mh.id = hp.marketing_hook_id
        WHERE mh.team_id = $1
        GROUP BY pillar
        ORDER BY avg_score DESC`,
        [teamId]
      );
      
      // Get top performing hooks
      const topHooks = await pool.query(
        `SELECT 
          mh.id, mh.pillar, mh.linkedin_post, mh.insight_score,
          hp.engagement_rate, hp.views, hp.likes
        FROM marketing_hooks mh
        LEFT JOIN hook_performance hp ON mh.id = hp.marketing_hook_id
        WHERE mh.team_id = $1 AND mh.status = 'published'
        ORDER BY COALESCE(hp.engagement_rate, 0) DESC
        LIMIT 5`,
        [teamId]
      );
      
      res.json({
        success: true,
        data: {
          company_profile: companyProfile.rows[0],
          performance_insights: {
            pillar_stats: performanceStats.rows,
            top_performing_hooks: topHooks.rows,
            recommendations: [
              'Focus on high-scoring pillars for better engagement',
              'Review and learn from top-performing hooks',
              'Consider adjusting content pillars based on performance data'
            ]
          }
        }
      });
      
    } catch (error) {
      logger.error('Error fetching company insights:', error);
      next(error);
    }
  }
}

export default MarketingHooksController;