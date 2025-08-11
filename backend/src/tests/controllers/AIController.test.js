import { jest } from '@jest/globals';
import { AIController } from '../../controllers/AIController.js';

// Mock all the AI services
const mockMarketingHookGenerator = {
  generateMarketingHooks: jest.fn(),
  testGeneration: jest.fn(),
  validateConfiguration: jest.fn()
};

const mockLinkedInPostWriter = {
  generateLinkedInPosts: jest.fn(),
  testPostGeneration: jest.fn()
};

const mockImagePromptGenerator = {
  generateImagePrompts: jest.fn(),
  generateImages: jest.fn()
};

const mockSlackApprovalService = {
  sendPostForApproval: jest.fn(),
  handleInteraction: jest.fn(),
  getApprovalData: jest.fn(),
  testConnection: jest.fn()
};

const mockVectorStoreService = {
  storeKnowledge: jest.fn(),
  getKnowledgeStats: jest.fn(),
  syncKnowledgeStores: jest.fn()
};

const mockRedisClient = {
  setex: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
  ping: jest.fn()
};

// Mock imports
jest.unstable_mockModule('../../services/ai/MarketingHookGenerator.js', () => ({
  marketingHookGenerator: mockMarketingHookGenerator
}));

jest.unstable_mockModule('../../services/ai/LinkedInPostWriter.js', () => ({
  linkedInPostWriter: mockLinkedInPostWriter
}));

jest.unstable_mockModule('../../services/ai/ImagePromptGenerator.js', () => ({
  imagePromptGenerator: mockImagePromptGenerator
}));

jest.unstable_mockModule('../../services/slack/SlackApprovalService.js', () => ({
  slackApprovalService: mockSlackApprovalService
}));

jest.unstable_mockModule('../../services/ai/VectorStoreService.js', () => ({
  vectorStoreService: mockVectorStoreService
}));

jest.unstable_mockModule('../../config/redis.js', () => ({
  getRedisClient: jest.fn(() => mockRedisClient)
}));

describe('AIController', () => {
  let controller;
  let mockReq;
  let mockRes;
  let mockUser;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AIController();

    mockUser = {
      id: 'user-123',
      teamId: 'team-456',
      name: 'Test User'
    };

    mockReq = {
      user: mockUser,
      body: {},
      params: {},
      query: {}
    };

    mockRes = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    };

    // Default Redis mocks
    mockRedisClient.setex.mockResolvedValue('OK');
    mockRedisClient.get.mockResolvedValue(null);
    mockRedisClient.ping.mockResolvedValue('PONG');
  });

  describe('createCompanyProfile', () => {
    it('should create a new company profile successfully', async () => {
      const profileData = {
        company_name: 'TestCorp',
        industry: 'saas',
        brand_voice: {
          tone: ['professional', 'friendly'],
          keywords: ['software', 'automation']
        },
        content_pillars: [{
          title: 'Product Innovation',
          description: 'Latest features and updates'
        }]
      };

      mockReq.body = profileData;

      await controller.createCompanyProfile(mockReq, mockRes);

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        `company_profile:${mockUser.teamId}`,
        604800, // 1 week
        expect.stringContaining('TestCorp')
      );

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          company_name: 'TestCorp',
          team_id: mockUser.teamId,
          created_by: mockUser.id
        })
      });
    });

    it('should handle profile creation errors', async () => {
      mockRedisClient.setex.mockRejectedValue(new Error('Redis connection failed'));
      mockReq.body = { company_name: 'TestCorp', industry: 'saas' };

      await expect(
        controller.createCompanyProfile(mockReq, mockRes)
      ).rejects.toThrow('Failed to create company profile');
    });
  });

  describe('getCompanyProfile', () => {
    it('should retrieve existing company profile', async () => {
      const profileData = {
        id: 'profile-123',
        company_name: 'TestCorp',
        team_id: mockUser.teamId
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(profileData));

      await controller.getCompanyProfile(mockReq, mockRes);

      expect(mockRedisClient.get).toHaveBeenCalledWith(`company_profile:${mockUser.teamId}`);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: profileData
      });
    });

    it('should return 404 for non-existent profile', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      await controller.getCompanyProfile(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Company profile not found'
      });
    });
  });

  describe('updateCompanyProfile', () => {
    it('should update existing company profile', async () => {
      const existingProfile = {
        id: 'profile-123',
        company_name: 'TestCorp',
        team_id: mockUser.teamId
      };

      const updates = {
        company_name: 'UpdatedCorp',
        industry: 'fintech'
      };

      mockReq.params = { id: 'profile-123' };
      mockReq.body = updates;
      mockRedisClient.get.mockResolvedValue(JSON.stringify(existingProfile));

      await controller.updateCompanyProfile(mockReq, mockRes);

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        `company_profile:${mockUser.teamId}`,
        604800,
        expect.stringContaining('UpdatedCorp')
      );

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          company_name: 'UpdatedCorp',
          industry: 'fintech',
          updated_by: mockUser.id
        })
      });
    });

    it('should handle missing profile for update', async () => {
      mockReq.params = { id: 'nonexistent' };
      mockReq.body = { company_name: 'Test' };
      mockRedisClient.get.mockResolvedValue(null);

      await expect(
        controller.updateCompanyProfile(mockReq, mockRes)
      ).rejects.toThrow('Company profile not found');
    });
  });

  describe('processTranscript', () => {
    it('should process and store transcript successfully', async () => {
      const transcriptData = {
        webhook_source: 'otter.ai',
        title: 'Product Planning Meeting',
        transcript_content: 'Meeting transcript content here...',
        participants: ['user1', 'user2'],
        duration_minutes: 60,
        meeting_date: '2024-01-15T10:00:00Z'
      };

      mockReq.body = transcriptData;

      await controller.processTranscript(mockReq, mockRes);

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        expect.stringMatching(/^transcript:/),
        2592000, // 30 days
        expect.stringContaining('Product Planning Meeting')
      );

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          webhook_source: 'otter.ai',
          title: 'Product Planning Meeting',
          team_id: mockUser.teamId,
          processed: false
        })
      });
    });
  });

  describe('generateMarketingHooks', () => {
    it('should generate marketing hooks from transcript', async () => {
      const transcriptId = 'transcript-123';
      const transcript = {
        id: transcriptId,
        transcript_content: 'Meeting content...',
        processed: false
      };

      const companyProfile = {
        id: 'company-123',
        company_name: 'TestCorp'
      };

      const hookResult = {
        insights: [
          {
            pillar: 'Product Innovation',
            source_quote: 'New features are game-changing',
            linkedin: 'LinkedIn post content...',
            blog: { title: 'Blog Title', hook: 'Blog hook' },
            tweet: 'Tweet content'
          }
        ],
        metadata: {
          cost: 0.15,
          tokens_used: 1500
        }
      };

      mockReq.params = { id: transcriptId };
      mockRedisClient.get
        .mockResolvedValueOnce(JSON.stringify(transcript))
        .mockResolvedValueOnce(JSON.stringify(companyProfile));
      
      mockMarketingHookGenerator.generateMarketingHooks.mockResolvedValue(hookResult);

      await controller.generateMarketingHooks(mockReq, mockRes);

      expect(mockMarketingHookGenerator.generateMarketingHooks).toHaveBeenCalledWith(
        transcript,
        companyProfile
      );

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        `hooks:${transcriptId}`,
        604800, // 1 week
        JSON.stringify(hookResult)
      );

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: hookResult
      });
    });

    it('should handle missing company profile', async () => {
      mockReq.params = { id: 'transcript-123' };
      mockRedisClient.get
        .mockResolvedValueOnce(JSON.stringify({ id: 'transcript-123' }))
        .mockResolvedValueOnce(null); // No company profile

      await expect(
        controller.generateMarketingHooks(mockReq, mockRes)
      ).rejects.toThrow('Company profile not found');
    });
  });

  describe('generateLinkedInPosts', () => {
    it('should generate LinkedIn posts from hooks', async () => {
      const hooks = [
        {
          pillar: 'Innovation',
          linkedin: 'Hook content...',
          source_quote: 'Quote from meeting'
        }
      ];

      const companyProfile = {
        id: 'company-123',
        company_name: 'TestCorp'
      };

      const postResult = {
        posts: [
          {
            hookId: 'hook-1',
            post: 'Full LinkedIn post content here...',
            metadata: { characterCount: 1800 }
          }
        ],
        generationMetadata: {
          cost: 0.25,
          tokens_used: 2000
        }
      };

      mockReq.body = { hooks, transcript_context: 'Meeting context' };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(companyProfile));
      mockLinkedInPostWriter.generateLinkedInPosts.mockResolvedValue(postResult);

      await controller.generateLinkedInPosts(mockReq, mockRes);

      expect(mockLinkedInPostWriter.generateLinkedInPosts).toHaveBeenCalledWith(
        hooks,
        companyProfile,
        'Meeting context'
      );

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'linkedin_post:hook-1',
        604800,
        expect.stringContaining('Full LinkedIn post')
      );

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: postResult
      });
    });
  });

  describe('generateImages', () => {
    it('should generate images for LinkedIn post', async () => {
      const postId = 'post-123';
      const post = {
        hookId: postId,
        post: 'LinkedIn post content...'
      };

      const companyProfile = {
        id: 'company-123',
        visual_style: { colors: { primary: '#1234FF' } }
      };

      const promptsResult = {
        imagePrompts: [
          {
            hookId: postId,
            imagePrompt: 'DALL-E prompt...',
            altText: 'Alt text description'
          }
        ]
      };

      const imagesResult = {
        images: [
          {
            hookId: postId,
            imageUrl: 'https://generated-image.com/image.png'
          }
        ],
        successful: 1,
        totalCost: 0.04
      };

      mockReq.params = { id: postId };
      mockRedisClient.get
        .mockResolvedValueOnce(JSON.stringify(post))
        .mockResolvedValueOnce(JSON.stringify(companyProfile));
      
      mockImagePromptGenerator.generateImagePrompts.mockResolvedValue(promptsResult);
      mockImagePromptGenerator.generateImages.mockResolvedValue(imagesResult);

      await controller.generateImages(mockReq, mockRes);

      expect(mockImagePromptGenerator.generateImagePrompts).toHaveBeenCalledWith(
        [post],
        companyProfile,
        companyProfile.visual_style
      );

      expect(mockImagePromptGenerator.generateImages).toHaveBeenCalledWith(
        promptsResult.imagePrompts
      );

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          prompts: promptsResult,
          images: imagesResult
        }
      });
    });
  });

  describe('sendForSlackApproval', () => {
    it('should send post for Slack approval', async () => {
      const postId = 'post-123';
      const post = {
        hookId: postId,
        post: 'LinkedIn post content...'
      };

      const companyProfile = {
        id: 'company-123',
        slack_channel: '#social-media'
      };

      const imageData = {
        imageUrl: 'https://image.com/generated.png',
        altText: 'Generated image'
      };

      const approvalResult = {
        approvalId: 'approval-123',
        slackChannel: 'C1234567890',
        status: 'pending'
      };

      mockReq.params = { id: postId };
      mockRedisClient.get
        .mockResolvedValueOnce(JSON.stringify(post))
        .mockResolvedValueOnce(JSON.stringify(companyProfile))
        .mockResolvedValueOnce(JSON.stringify(imageData));

      mockSlackApprovalService.sendPostForApproval.mockResolvedValue(approvalResult);

      await controller.sendForSlackApproval(mockReq, mockRes);

      expect(mockSlackApprovalService.sendPostForApproval).toHaveBeenCalledWith(
        post,
        imageData,
        companyProfile,
        mockUser
      );

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: approvalResult
      });
    });

    it('should work without associated image', async () => {
      const postId = 'post-123';
      const post = { hookId: postId, post: 'Content...' };
      const companyProfile = { id: 'company-123' };

      mockReq.params = { id: postId };
      mockRedisClient.get
        .mockResolvedValueOnce(JSON.stringify(post))
        .mockResolvedValueOnce(JSON.stringify(companyProfile))
        .mockResolvedValueOnce(null); // No image data

      mockSlackApprovalService.sendPostForApproval.mockResolvedValue({
        approvalId: 'approval-123'
      });

      await controller.sendForSlackApproval(mockReq, mockRes);

      expect(mockSlackApprovalService.sendPostForApproval).toHaveBeenCalledWith(
        post,
        null, // No image data
        companyProfile,
        mockUser
      );
    });
  });

  describe('handleSlackInteraction', () => {
    it('should handle Slack interaction successfully', async () => {
      const payload = {
        actions: [{ action_id: 'approve_post', value: 'approval-123' }],
        user: { id: 'U123456789' }
      };

      const interactionResult = {
        status: 'approved',
        message: 'Post approved successfully'
      };

      mockReq.body = payload;
      mockSlackApprovalService.handleInteraction.mockResolvedValue(interactionResult);

      await controller.handleSlackInteraction(mockReq, mockRes);

      expect(mockSlackApprovalService.handleInteraction).toHaveBeenCalledWith(payload);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: interactionResult
      });
    });

    it('should handle interaction errors gracefully', async () => {
      mockReq.body = { invalid: 'payload' };
      mockSlackApprovalService.handleInteraction.mockRejectedValue(new Error('Invalid payload'));

      await controller.handleSlackInteraction(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({ success: false });
    });
  });

  describe('getDashboardData', () => {
    it('should return dashboard data with company profile', async () => {
      const companyProfile = {
        id: 'company-123',
        company_name: 'TestCorp'
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(companyProfile));

      await controller.getDashboardData(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          company_profile: companyProfile,
          recent_transcripts: [],
          content_pipeline: [],
          queue_status: [],
          performance_metrics: expect.any(Object)
        })
      });
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when all services are working', async () => {
      mockMarketingHookGenerator.validateConfiguration.mockResolvedValue({
        status: 'connected'
      });
      mockSlackApprovalService.testConnection.mockResolvedValue({
        status: 'connected'
      });
      mockVectorStoreService.getKnowledgeStats.mockResolvedValue({
        total_items: 5
      });

      await controller.healthCheck(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          status: 'healthy',
          services: expect.objectContaining({
            openai: { status: 'connected' },
            slack: { status: 'connected' },
            vector_store: { total_items: 5 }
          })
        })
      });
    });

    it('should return unhealthy status when services fail', async () => {
      mockMarketingHookGenerator.validateConfiguration.mockRejectedValue(
        new Error('OpenAI connection failed')
      );

      await controller.healthCheck(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Service unhealthy',
        error: expect.any(String)
      });
    });
  });

  describe('receiveTranscriptWebhook', () => {
    it('should process webhook transcript successfully', async () => {
      const webhookPayload = {
        meeting_id: 'meeting-123',
        title: 'Product Meeting',
        transcript: 'Meeting transcript content...',
        participants: ['user1@example.com', 'user2@example.com'],
        duration: 45,
        date: '2024-01-15T10:00:00Z'
      };

      mockReq.body = webhookPayload;
      mockReq.headers = { 'x-webhook-source': 'otter.ai' };

      await controller.receiveTranscriptWebhook(mockReq, mockRes);

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        expect.stringMatching(/^transcript:/),
        2592000, // 30 days
        expect.stringContaining('Product Meeting')
      );

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          transcript_id: expect.any(String),
          status: 'received'
        })
      });
    });

    it('should handle webhook processing errors', async () => {
      mockReq.body = { invalid: 'payload' };
      mockRedisClient.setex.mockRejectedValue(new Error('Storage failed'));

      await controller.receiveTranscriptWebhook(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to process webhook'
      });
    });
  });

  describe('test endpoints', () => {
    it('should run hook generation test', async () => {
      const testResult = {
        insights: [{ pillar: 'Test', linkedin: 'Test hook' }],
        metadata: { cost: 0.10 }
      };

      mockMarketingHookGenerator.testGeneration.mockResolvedValue(testResult);

      await controller.testHookGeneration(mockReq, mockRes);

      expect(mockMarketingHookGenerator.testGeneration).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: testResult,
        message: 'Hook generation test completed successfully'
      });
    });

    it('should run post generation test', async () => {
      const testResult = {
        posts: [{ hookId: 'test', post: 'Test post content' }],
        generationMetadata: { cost: 0.20 }
      };

      mockLinkedInPostWriter.testPostGeneration.mockResolvedValue(testResult);

      await controller.testPostGeneration(mockReq, mockRes);

      expect(mockLinkedInPostWriter.testPostGeneration).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: testResult,
        message: 'Post generation test completed successfully'
      });
    });

    it('should test Slack connection', async () => {
      const connectionResult = {
        connected: true,
        botId: 'B123456789'
      };

      mockSlackApprovalService.testConnection.mockResolvedValue(connectionResult);

      await controller.testSlackConnection(mockReq, mockRes);

      expect(mockSlackApprovalService.testConnection).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: connectionResult,
        message: 'Slack connection successful'
      });
    });
  });

  describe('helper methods', () => {
    it('should get profile for user', async () => {
      const profileData = { id: 'profile-123', company_name: 'TestCorp' };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(profileData));

      const result = await controller.getProfileForUser('team-456');

      expect(result).toEqual(profileData);
      expect(mockRedisClient.get).toHaveBeenCalledWith('company_profile:team-456');
    });

    it('should handle missing profile gracefully', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await controller.getProfileForUser('nonexistent-team');

      expect(result).toBeNull();
    });

    it('should test Redis connection', async () => {
      const result = await controller.testRedisConnection();

      expect(mockRedisClient.ping).toHaveBeenCalled();
      expect(result.status).toBe('connected');
    });

    it('should handle Redis connection failure', async () => {
      mockRedisClient.ping.mockRejectedValue(new Error('Connection failed'));

      const result = await controller.testRedisConnection();

      expect(result.status).toBe('error');
      expect(result.error).toBe('Connection failed');
    });
  });

  describe('error handling', () => {
    it('should handle Redis errors in company profile operations', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));

      await expect(
        controller.getCompanyProfile(mockReq, mockRes)
      ).rejects.toThrow('Failed to get company profile');
    });

    it('should handle missing transcript in hook generation', async () => {
      mockReq.params = { id: 'nonexistent-transcript' };
      mockRedisClient.get.mockResolvedValue(null);

      await expect(
        controller.generateMarketingHooks(mockReq, mockRes)
      ).rejects.toThrow('Transcript not found');
    });

    it('should handle missing LinkedIn post in image generation', async () => {
      mockReq.params = { id: 'nonexistent-post' };
      mockRedisClient.get.mockResolvedValue(null);

      await expect(
        controller.generateImages(mockReq, mockRes)
      ).rejects.toThrow('LinkedIn post not found');
    });
  });

  describe('knowledge store operations', () => {
    it('should create knowledge store successfully', async () => {
      const knowledgeData = {
        name: 'Brand Voice Guide',
        type: 'brand_voice',
        content: 'Brand voice content...',
        query_key: 'brand voice'
      };

      const companyProfile = { id: 'company-123' };

      mockReq.body = knowledgeData;
      mockRedisClient.get.mockResolvedValue(JSON.stringify(companyProfile));
      mockVectorStoreService.storeKnowledge.mockResolvedValue({ success: true });

      await controller.createKnowledgeStore(mockReq, mockRes);

      expect(mockVectorStoreService.storeKnowledge).toHaveBeenCalledWith(
        companyProfile.id,
        expect.objectContaining({
          name: 'Brand Voice Guide',
          type: 'brand_voice'
        })
      );

      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it('should get knowledge stores with stats', async () => {
      const companyProfile = { id: 'company-123' };
      const stats = { total_items: 5, by_type: { brand_voice: 2 } };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(companyProfile));
      mockVectorStoreService.getKnowledgeStats.mockResolvedValue(stats);

      await controller.getKnowledgeStores(mockReq, mockRes);

      expect(mockVectorStoreService.getKnowledgeStats).toHaveBeenCalledWith(companyProfile.id);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { stats, stores: [] }
      });
    });
  });

  describe('queue management', () => {
    it('should get publishing queue', async () => {
      await controller.getPublishingQueue(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          queue: [],
          summary: expect.objectContaining({
            total: 0,
            pending: 0,
            approved: 0,
            scheduled: 0
          })
        })
      });
    });

    it('should schedule post successfully', async () => {
      mockReq.params = { postId: 'post-123' };
      mockReq.body = {
        scheduled_time: '2024-01-16T10:00:00Z',
        priority: 7
      };

      await controller.schedulePost(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Post scheduled successfully'
      });
    });
  });

  describe('analytics endpoints', () => {
    it('should return performance analytics', async () => {
      await controller.getPerformanceAnalytics(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          processing_metrics: expect.any(Object),
          cost_metrics: expect.any(Object),
          engagement_metrics: expect.any(Object)
        })
      });
    });

    it('should handle analytics query parameters', async () => {
      mockReq.query = { date_range: 60 };

      await controller.getPerformanceAnalytics(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalled();
    });
  });
});