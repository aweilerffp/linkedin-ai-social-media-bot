import { marketingHookGenerator } from '../services/ai/MarketingHookGenerator.js';
import { linkedInPostWriter } from '../services/ai/LinkedInPostWriter.js';
import { imagePromptGenerator } from '../services/ai/ImagePromptGenerator.js';
import { slackApprovalService } from '../services/slack/SlackApprovalService.js';
import { vectorStoreService } from '../services/ai/VectorStoreService.js';
import { logger } from '../utils/logger.js';
import { ApiError } from '../middleware/errorHandler.js';
import { getRedisClient } from '../config/redis.js';
import crypto from 'crypto';

export class AIController {
  constructor() {
    this.redisClient = getRedisClient();
  }

  // Company Profile Management
  async createCompanyProfile(req, res) {
    try {
      const { user } = req;
      const profileData = req.body;
      
      // In a real implementation, this would save to database
      // For now, we'll store in Redis for demo purposes
      const profileId = crypto.randomUUID();
      const profile = {
        id: profileId,
        team_id: user.teamId,
        created_by: user.id,
        created_at: new Date().toISOString(),
        ...profileData
      };

      await this.redisClient.setex(
        `company_profile:${user.teamId}`,
        86400 * 7, // 1 week
        JSON.stringify(profile)
      );

      // Initialize knowledge stores in vector database
      if (profileData.reference_posts) {
        await this.initializeKnowledgeStores(profileId, profileData);
      }

      logger.info('Company profile created', {
        profileId,
        teamId: user.teamId,
        companyName: profileData.company_name
      });

      res.status(201).json({
        success: true,
        data: profile
      });
    } catch (error) {
      logger.error('Failed to create company profile', { error: error.message });
      throw new ApiError('Failed to create company profile', 500);
    }
  }

  async getCompanyProfile(req, res) {
    try {
      const { user } = req;
      
      const profileData = await this.redisClient.get(`company_profile:${user.teamId}`);
      
      if (!profileData) {
        return res.status(404).json({
          success: false,
          message: 'Company profile not found'
        });
      }

      const profile = JSON.parse(profileData);
      
      res.json({
        success: true,
        data: profile
      });
    } catch (error) {
      logger.error('Failed to get company profile', { error: error.message });
      throw new ApiError('Failed to get company profile', 500);
    }
  }

  async updateCompanyProfile(req, res) {
    try {
      const { user } = req;
      const { id } = req.params;
      const updates = req.body;

      const existingData = await this.redisClient.get(`company_profile:${user.teamId}`);
      
      if (!existingData) {
        throw new ApiError('Company profile not found', 404);
      }

      const profile = JSON.parse(existingData);
      const updatedProfile = {
        ...profile,
        ...updates,
        updated_at: new Date().toISOString(),
        updated_by: user.id
      };

      await this.redisClient.setex(
        `company_profile:${user.teamId}`,
        86400 * 7,
        JSON.stringify(updatedProfile)
      );

      logger.info('Company profile updated', {
        profileId: id,
        teamId: user.teamId
      });

      res.json({
        success: true,
        data: updatedProfile
      });
    } catch (error) {
      logger.error('Failed to update company profile', { error: error.message });
      throw error;
    }
  }

  // Knowledge Store Management
  async createKnowledgeStore(req, res) {
    try {
      const { user } = req;
      const knowledgeData = req.body;

      const profile = await this.getProfileForUser(user.teamId);
      if (!profile) {
        throw new ApiError('Company profile not found', 404);
      }

      const knowledgeStore = {
        id: crypto.randomUUID(),
        company_profile_id: profile.id,
        created_at: new Date().toISOString(),
        ...knowledgeData
      };

      // Store in vector database
      await vectorStoreService.storeKnowledge(profile.id, knowledgeStore);

      // Cache in Redis
      const cacheKey = `knowledge_store:${knowledgeStore.id}`;
      await this.redisClient.setex(cacheKey, 86400, JSON.stringify(knowledgeStore));

      logger.info('Knowledge store created', {
        storeId: knowledgeStore.id,
        type: knowledgeStore.type,
        companyId: profile.id
      });

      res.status(201).json({
        success: true,
        data: knowledgeStore
      });
    } catch (error) {
      logger.error('Failed to create knowledge store', { error: error.message });
      throw new ApiError('Failed to create knowledge store', 500);
    }
  }

  async getKnowledgeStores(req, res) {
    try {
      const { user } = req;
      const profile = await this.getProfileForUser(user.teamId);
      
      if (!profile) {
        throw new ApiError('Company profile not found', 404);
      }

      const stats = await vectorStoreService.getKnowledgeStats(profile.id);

      res.json({
        success: true,
        data: {
          stats,
          stores: [] // In real implementation, fetch from database
        }
      });
    } catch (error) {
      logger.error('Failed to get knowledge stores', { error: error.message });
      throw error;
    }
  }

  // Transcript Processing
  async processTranscript(req, res) {
    try {
      const { user } = req;
      const transcriptData = req.body;

      const transcript = {
        id: crypto.randomUUID(),
        team_id: user.teamId,
        processed: false,
        created_at: new Date().toISOString(),
        ...transcriptData
      };

      // Store transcript
      const transcriptKey = `transcript:${transcript.id}`;
      await this.redisClient.setex(transcriptKey, 86400 * 30, JSON.stringify(transcript));

      logger.info('Transcript processed', {
        transcriptId: transcript.id,
        source: transcript.webhook_source,
        teamId: user.teamId
      });

      res.status(201).json({
        success: true,
        data: transcript
      });
    } catch (error) {
      logger.error('Failed to process transcript', { error: error.message });
      throw new ApiError('Failed to process transcript', 500);
    }
  }

  async getTranscripts(req, res) {
    try {
      const { user } = req;
      const { limit = 20, offset = 0 } = req.query;

      // In real implementation, query database with pagination
      // For demo, return empty array
      res.json({
        success: true,
        data: {
          transcripts: [],
          pagination: {
            limit: parseInt(limit),
            offset: parseInt(offset),
            total: 0
          }
        }
      });
    } catch (error) {
      logger.error('Failed to get transcripts', { error: error.message });
      throw error;
    }
  }

  async getTranscript(req, res) {
    try {
      const { id } = req.params;
      
      const transcriptData = await this.redisClient.get(`transcript:${id}`);
      
      if (!transcriptData) {
        throw new ApiError('Transcript not found', 404);
      }

      res.json({
        success: true,
        data: JSON.parse(transcriptData)
      });
    } catch (error) {
      logger.error('Failed to get transcript', { error: error.message });
      throw error;
    }
  }

  // Marketing Hook Generation
  async generateMarketingHooks(req, res) {
    try {
      const { user } = req;
      const { id } = req.params;

      const transcript = await this.getTranscriptById(id);
      const profile = await this.getProfileForUser(user.teamId);

      if (!profile) {
        throw new ApiError('Company profile not found', 404);
      }

      const result = await marketingHookGenerator.generateMarketingHooks(transcript, profile);

      // Store generated hooks
      const hooksKey = `hooks:${id}`;
      await this.redisClient.setex(hooksKey, 86400 * 7, JSON.stringify(result));

      // Update transcript as processed
      transcript.processed = true;
      transcript.processed_at = new Date().toISOString();
      await this.redisClient.setex(`transcript:${id}`, 86400 * 30, JSON.stringify(transcript));

      logger.info('Marketing hooks generated', {
        transcriptId: id,
        hooksCount: result.insights.length,
        cost: result.metadata.cost
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Failed to generate marketing hooks', { error: error.message });
      throw error;
    }
  }

  async getMarketingHooks(req, res) {
    try {
      const { id } = req.params;

      const hooksData = await this.redisClient.get(`hooks:${id}`);
      
      if (!hooksData) {
        throw new ApiError('Marketing hooks not found', 404);
      }

      res.json({
        success: true,
        data: JSON.parse(hooksData)
      });
    } catch (error) {
      logger.error('Failed to get marketing hooks', { error: error.message });
      throw error;
    }
  }

  // LinkedIn Post Generation
  async generateLinkedInPosts(req, res) {
    try {
      const { user } = req;
      const { hooks, transcript_context = '' } = req.body;

      const profile = await this.getProfileForUser(user.teamId);
      if (!profile) {
        throw new ApiError('Company profile not found', 404);
      }

      const result = await linkedInPostWriter.generateLinkedInPosts(
        hooks,
        profile,
        transcript_context
      );

      // Store generated posts
      for (const post of result.posts) {
        const postKey = `linkedin_post:${post.hookId}`;
        await this.redisClient.setex(postKey, 86400 * 7, JSON.stringify(post));
      }

      logger.info('LinkedIn posts generated', {
        postsCount: result.posts.length,
        cost: result.generationMetadata.cost
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Failed to generate LinkedIn posts', { error: error.message });
      throw error;
    }
  }

  async getLinkedInPosts(req, res) {
    try {
      const { user } = req;
      const { limit = 20, status } = req.query;

      // In real implementation, query database with filters
      res.json({
        success: true,
        data: {
          posts: [],
          pagination: { limit: parseInt(limit), total: 0 }
        }
      });
    } catch (error) {
      logger.error('Failed to get LinkedIn posts', { error: error.message });
      throw error;
    }
  }

  async getLinkedInPost(req, res) {
    try {
      const { id } = req.params;

      const postData = await this.redisClient.get(`linkedin_post:${id}`);
      
      if (!postData) {
        throw new ApiError('LinkedIn post not found', 404);
      }

      res.json({
        success: true,
        data: JSON.parse(postData)
      });
    } catch (error) {
      logger.error('Failed to get LinkedIn post', { error: error.message });
      throw error;
    }
  }

  // Image Generation
  async generateImages(req, res) {
    try {
      const { user } = req;
      const { id } = req.params;

      const post = await this.getLinkedInPostById(id);
      const profile = await this.getProfileForUser(user.teamId);
      
      if (!profile) {
        throw new ApiError('Company profile not found', 404);
      }

      // Get visual style guide
      const visualStyleGuide = profile.visual_style || {};

      const promptsResult = await imagePromptGenerator.generateImagePrompts(
        [post],
        profile,
        visualStyleGuide
      );

      const imagesResult = await imagePromptGenerator.generateImages(promptsResult.imagePrompts);

      // Store generated images
      for (const image of imagesResult.images) {
        const imageKey = `image:${image.hookId}`;
        await this.redisClient.setex(imageKey, 86400 * 7, JSON.stringify(image));
      }

      logger.info('Images generated', {
        postId: id,
        imagesCount: imagesResult.successful,
        totalCost: imagesResult.totalCost
      });

      res.json({
        success: true,
        data: {
          prompts: promptsResult,
          images: imagesResult
        }
      });
    } catch (error) {
      logger.error('Failed to generate images', { error: error.message });
      throw error;
    }
  }

  async getPostImages(req, res) {
    try {
      const { id } = req.params;

      const imageData = await this.redisClient.get(`image:${id}`);
      
      if (!imageData) {
        throw new ApiError('Post images not found', 404);
      }

      res.json({
        success: true,
        data: JSON.parse(imageData)
      });
    } catch (error) {
      logger.error('Failed to get post images', { error: error.message });
      throw error;
    }
  }

  // Slack Approval
  async sendForSlackApproval(req, res) {
    try {
      const { user } = req;
      const { id } = req.params;

      const post = await this.getLinkedInPostById(id);
      const profile = await this.getProfileForUser(user.teamId);
      
      if (!profile) {
        throw new ApiError('Company profile not found', 404);
      }

      // Get associated image if exists
      let imageData = null;
      try {
        const imageJson = await this.redisClient.get(`image:${id}`);
        if (imageJson) {
          imageData = JSON.parse(imageJson);
        }
      } catch (e) {
        // Image optional
      }

      const result = await slackApprovalService.sendPostForApproval(
        post,
        imageData,
        profile,
        user
      );

      logger.info('Post sent for Slack approval', {
        postId: id,
        approvalId: result.approvalId,
        slackChannel: result.slackChannel
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Failed to send for Slack approval', { error: error.message });
      throw error;
    }
  }

  async handleSlackInteraction(req, res) {
    try {
      const payload = req.body;

      // Verify Slack signature in production
      const result = await slackApprovalService.handleInteraction(payload);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Failed to handle Slack interaction', { error: error.message });
      res.status(200).json({ success: false }); // Return 200 to avoid Slack retries
    }
  }

  async getApprovalStatus(req, res) {
    try {
      const { id } = req.params;

      const status = await slackApprovalService.getApprovalData(id);
      
      if (!status) {
        throw new ApiError('Approval not found', 404);
      }

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      logger.error('Failed to get approval status', { error: error.message });
      throw error;
    }
  }

  // Queue Management
  async getPublishingQueue(req, res) {
    try {
      const { user } = req;
      
      // In real implementation, query queue_schedule table
      res.json({
        success: true,
        data: {
          queue: [],
          summary: {
            total: 0,
            pending: 0,
            approved: 0,
            scheduled: 0
          }
        }
      });
    } catch (error) {
      logger.error('Failed to get publishing queue', { error: error.message });
      throw error;
    }
  }

  async schedulePost(req, res) {
    try {
      const { postId } = req.params;
      const { scheduled_time, priority = 5 } = req.body;

      // In real implementation, add to queue_schedule table
      logger.info('Post scheduled', {
        postId,
        scheduledTime: scheduled_time,
        priority
      });

      res.json({
        success: true,
        message: 'Post scheduled successfully'
      });
    } catch (error) {
      logger.error('Failed to schedule post', { error: error.message });
      throw error;
    }
  }

  // Dashboard and Analytics
  async getDashboardData(req, res) {
    try {
      const { user } = req;

      const profile = await this.getProfileForUser(user.teamId);

      // In real implementation, aggregate data from multiple tables
      const dashboardData = {
        company_profile: profile,
        recent_transcripts: [],
        content_pipeline: [],
        queue_status: [],
        performance_metrics: {
          total_transcripts: 0,
          total_insights: 0,
          total_posts: 0,
          queued_posts: 0,
          avg_engagement_rate: 0
        }
      };

      res.json({
        success: true,
        data: dashboardData
      });
    } catch (error) {
      logger.error('Failed to get dashboard data', { error: error.message });
      throw error;
    }
  }

  async getPerformanceAnalytics(req, res) {
    try {
      const { user } = req;
      const { date_range = 30 } = req.query;

      // Mock analytics data
      const analytics = {
        processing_metrics: {
          avg_hook_generation_time: 4500,
          avg_post_generation_time: 8200,
          avg_image_generation_time: 12000,
          success_rate: 0.94
        },
        cost_metrics: {
          total_cost: 45.67,
          avg_cost_per_post: 1.23,
          cost_breakdown: {
            hook_generation: 18.50,
            post_writing: 22.15,
            image_generation: 5.02
          }
        },
        engagement_metrics: {
          avg_likes: 127,
          avg_comments: 23,
          avg_shares: 8,
          avg_engagement_rate: 4.2
        }
      };

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error('Failed to get performance analytics', { error: error.message });
      throw error;
    }
  }

  // Test Endpoints
  async testHookGeneration(req, res) {
    try {
      const result = await marketingHookGenerator.testGeneration();

      res.json({
        success: true,
        data: result,
        message: 'Hook generation test completed successfully'
      });
    } catch (error) {
      logger.error('Hook generation test failed', { error: error.message });
      throw error;
    }
  }

  async testPostGeneration(req, res) {
    try {
      const result = await linkedInPostWriter.testPostGeneration();

      res.json({
        success: true,
        data: result,
        message: 'Post generation test completed successfully'
      });
    } catch (error) {
      logger.error('Post generation test failed', { error: error.message });
      throw error;
    }
  }

  async testSlackConnection(req, res) {
    try {
      const result = await slackApprovalService.testConnection();

      res.json({
        success: true,
        data: result,
        message: result.connected ? 'Slack connection successful' : 'Slack connection failed'
      });
    } catch (error) {
      logger.error('Slack connection test failed', { error: error.message });
      throw error;
    }
  }

  async healthCheck(req, res) {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          openai: await marketingHookGenerator.validateConfiguration(),
          slack: await slackApprovalService.testConnection(),
          redis: await this.testRedisConnection(),
          vector_store: await vectorStoreService.getKnowledgeStats('health-check')
        }
      };

      const allHealthy = Object.values(health.services).every(
        service => service.status === 'connected' || service.total_items >= 0
      );

      res.status(allHealthy ? 200 : 503).json({
        success: allHealthy,
        data: health
      });
    } catch (error) {
      logger.error('Health check failed', { error: error.message });
      res.status(503).json({
        success: false,
        message: 'Service unhealthy',
        error: error.message
      });
    }
  }

  // Webhook endpoint for transcript receipt
  async receiveTranscriptWebhook(req, res) {
    try {
      const payload = req.body;
      const source = req.headers['x-webhook-source'] || 'unknown';

      // Validate webhook signature if configured
      // const signature = req.headers['x-webhook-signature'];
      // this.validateWebhookSignature(payload, signature);

      const transcript = {
        id: crypto.randomUUID(),
        webhook_source: source,
        meeting_id: payload.meeting_id || payload.id,
        title: payload.title || payload.meeting_title,
        transcript_content: payload.transcript || payload.content,
        participants: payload.participants || [],
        duration_minutes: payload.duration || payload.duration_minutes,
        meeting_date: payload.date || payload.meeting_date || new Date().toISOString(),
        metadata: payload.metadata || {},
        received_at: new Date().toISOString(),
        processed: false
      };

      // Store transcript
      const transcriptKey = `transcript:${transcript.id}`;
      await this.redisClient.setex(transcriptKey, 86400 * 30, JSON.stringify(transcript));

      logger.info('Transcript received via webhook', {
        transcriptId: transcript.id,
        source,
        meetingId: transcript.meeting_id
      });

      res.json({
        success: true,
        data: {
          transcript_id: transcript.id,
          status: 'received'
        }
      });
    } catch (error) {
      logger.error('Failed to process transcript webhook', { error: error.message });
      res.status(400).json({
        success: false,
        message: 'Failed to process webhook'
      });
    }
  }

  // Helper methods
  async getProfileForUser(teamId) {
    try {
      const profileData = await this.redisClient.get(`company_profile:${teamId}`);
      return profileData ? JSON.parse(profileData) : null;
    } catch (error) {
      logger.error('Failed to get profile for user', { error: error.message, teamId });
      return null;
    }
  }

  async getTranscriptById(id) {
    const transcriptData = await this.redisClient.get(`transcript:${id}`);
    if (!transcriptData) {
      throw new ApiError('Transcript not found', 404);
    }
    return JSON.parse(transcriptData);
  }

  async getLinkedInPostById(id) {
    const postData = await this.redisClient.get(`linkedin_post:${id}`);
    if (!postData) {
      throw new ApiError('LinkedIn post not found', 404);
    }
    return JSON.parse(postData);
  }

  async testRedisConnection() {
    try {
      await this.redisClient.ping();
      return { status: 'connected' };
    } catch (error) {
      return { status: 'error', error: error.message };
    }
  }

  async initializeKnowledgeStores(profileId, profileData) {
    try {
      const knowledgeStores = [];

      // Brand voice store
      if (profileData.brand_voice) {
        knowledgeStores.push({
          id: crypto.randomUUID(),
          type: 'brand_voice',
          name: 'Brand Voice Guide',
          content: this.buildBrandVoiceContent(profileData.brand_voice, profileData.company_name),
          query_key: 'brand voice snapshot',
          retrieval_count: 1
        });
      }

      // Content frameworks store
      knowledgeStores.push({
        id: crypto.randomUUID(),
        type: 'frameworks',
        name: 'Engagement Frameworks',
        content: this.buildFrameworksContent(profileData.content_pillars),
        query_key: 'engagement frameworks',
        retrieval_count: 2
      });

      // Sync to vector store
      if (knowledgeStores.length > 0) {
        await vectorStoreService.syncKnowledgeStores(profileId, knowledgeStores);
      }

      logger.info('Knowledge stores initialized', {
        profileId,
        storesCount: knowledgeStores.length
      });
    } catch (error) {
      logger.error('Failed to initialize knowledge stores', {
        error: error.message,
        profileId
      });
    }
  }

  buildBrandVoiceContent(brandVoice, companyName) {
    return `${companyName} Brand Voice Guide:

Tone: ${brandVoice.tone?.join(', ') || 'Professional'}
Keywords: ${brandVoice.keywords?.join(', ') || 'Industry terms'}
Avoid: ${brandVoice.prohibited_terms?.join(', ') || 'Buzzwords'}

This brand voice emphasizes ${brandVoice.tone?.[0] || 'professional'} communication while maintaining authenticity and value-driven messaging.`;
  }

  buildFrameworksContent(contentPillars) {
    const pillars = contentPillars || [];
    return `Content Frameworks:

Primary Content Pillars:
${pillars.map((pillar, i) => `${i + 1}. ${pillar.title}: ${pillar.description || ''}`).join('\n')}

Engagement Framework: Problem-Agitation-Solution
- Identify specific pain points
- Amplify the cost of inaction  
- Present clear solution with benefits
- End with engaging question

Case Study Framework:
- Share specific results or transformation
- Explain the situation and challenge
- Detail the solution approach
- Quantify the outcomes achieved`;
  }
}