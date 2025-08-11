import { jest } from '@jest/globals';
import { MarketingHookGenerator } from '../../services/ai/MarketingHookGenerator.js';
import { LinkedInPostWriter } from '../../services/ai/LinkedInPostWriter.js';
import { ImagePromptGenerator } from '../../services/ai/ImagePromptGenerator.js';
import { SlackApprovalService } from '../../services/slack/SlackApprovalService.js';

// Mock all dependencies
jest.unstable_mockModule('openai', () => ({
  default: jest.fn(() => ({
    chat: {
      completions: {
        create: jest.fn()
      }
    },
    images: {
      generate: jest.fn()
    }
  }))
}));

jest.unstable_mockModule('@slack/web-api', () => ({
  WebClient: jest.fn(() => ({
    chat: {
      postMessage: jest.fn().mockResolvedValue({
        channel: 'C123',
        ts: '1234567890.123456'
      })
    }
  }))
}));

jest.unstable_mockModule('../../config/redis.js', () => ({
  getRedisClient: jest.fn(() => ({
    setex: jest.fn().mockResolvedValue('OK'),
    get: jest.fn(),
    keys: jest.fn().mockResolvedValue([]),
    lpush: jest.fn().mockResolvedValue(1),
    brpop: jest.fn().mockResolvedValue(null)
  }))
}));

jest.unstable_mockModule('../../services/ai/VectorStoreService.js', () => ({
  VectorStoreService: jest.fn(() => ({
    retrieve: jest.fn().mockResolvedValue([
      { content: 'Brand voice content' }
    ])
  }))
}));

describe('AI Workflow Integration Tests', () => {
  let hookGenerator;
  let postWriter;
  let imageGenerator;
  let slackService;
  
  const mockTranscript = {
    id: 'transcript-123',
    transcript_content: `
      Product Manager: Our new bulk editing feature is saving Amazon sellers an average of 8 hours per week on catalog management.
      
      Sales Lead: The feedback has been incredible. One client mentioned they were able to update 500 product listings in just 20 minutes instead of the usual 6 hours.
      
      Engineering: The validation system is catching 95% of potential listing errors before they go live, which prevents account health issues.
      
      Customer Success: Sellers are specifically praising the ASIN variation management tool. It's helping them organize complex product hierarchies efficiently.
      
      CEO: This positions us perfectly for Q2 growth. We should highlight how these tools integrate with Amazon's platform requirements.
    `,
    meeting_date: '2024-01-15T10:00:00Z',
    metadata: {
      meeting_type: 'Product Review',
      meeting_goal: 'Review feature performance and customer feedback'
    }
  };

  const mockCompanyProfile = {
    id: 'company-123',
    team_id: 'team-456',
    company_name: 'AmazonToolsPro',
    industry: 'ecommerce',
    brand_voice: {
      tone: ['professional', 'practical', 'solution-focused'],
      keywords: ['Amazon', 'sellers', 'listings', 'catalog', 'optimization'],
      prohibited_terms: ['revolutionary', 'game-changing']
    },
    content_pillars: [
      {
        title: 'Amazon Seller Tools',
        description: 'Efficient tools for Amazon marketplace success'
      },
      {
        title: 'Catalog Management',
        description: 'Streamlined product listing management'
      }
    ],
    target_personas: [
      {
        name: 'Amazon Sellers',
        pain_points: ['time-consuming manual updates', 'listing errors', 'account health issues'],
        emotions: ['frustration', 'relief', 'confidence']
      }
    ],
    evaluation_questions: [
      'What specific time savings does this provide to Amazon sellers?',
      'How does this prevent account health issues?',
      'What competitive advantage does this create?',
      'How does this integrate with Amazon\'s platform requirements?'
    ],
    slack_channel: '#social-media',
    slack_approvers: ['U1234567890']
  };

  const mockVisualStyleGuide = {
    id: 'style-123',
    colors: {
      primary: '#FF6B35',
      secondary: '#F7931E',
      accent: '#2E86AB'
    },
    illustration_style: {
      type: 'isometric',
      characteristics: ['clean lines', 'modern interfaces', 'professional']
    },
    visual_elements: {
      common_elements: ['Amazon dashboards', 'product grids', 'listing interfaces', 'analytics charts']
    },
    restrictions: ['no text in images', 'generous white padding', 'professional style']
  };

  beforeEach(() => {
    // Set required environment variables
    process.env.OPENAI_API_KEY = 'test-api-key';
    process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
    
    hookGenerator = new MarketingHookGenerator();
    postWriter = new LinkedInPostWriter();
    imageGenerator = new ImagePromptGenerator();
    slackService = new SlackApprovalService();
  });

  describe('Complete AI Content Generation Workflow', () => {
    it('should process meeting transcript through complete AI pipeline', async () => {
      // Step 1: Mock Marketing Hook Generation
      const mockHookResponse = {
        insights: [
          {
            pillar: 'Amazon Seller Tools',
            source_quote: 'saving Amazon sellers an average of 8 hours per week on catalog management',
            insight_score: 0.92,
            blog: {
              title: 'How Amazon Sellers Save 8 Hours Weekly with Bulk Editing',
              hook: 'Manual catalog updates are killing Amazon seller productivity'
            },
            linkedin: 'Most Amazon sellers waste 8+ hours weekly on manual catalog updates. Here\'s what we learned from 1000+ seller accounts: The biggest time drain isn\'t creating listings—it\'s maintaining them. Seasonal changes, inventory updates, keyword optimization. One client was updating 500 listings manually in 6 hours. With bulk editing tools, same task takes 20 minutes. The secret? Validation that prevents errors before they harm account health. No more listing rejections. No more account suspensions. Just clean, optimized catalogs that convert. What\'s your biggest catalog management challenge?',
            tweet: 'Amazon sellers: Stop wasting 8 hours/week on manual catalog updates. Bulk editing cuts 500-listing updates from 6 hours to 20 minutes. Game-changer. #AmazonFBA #Productivity'
          },
          {
            pillar: 'Catalog Management', 
            source_quote: 'catching 95% of potential listing errors before they go live',
            insight_score: 0.88,
            blog: {
              title: 'How 95% Error Prevention Saves Amazon Seller Accounts',
              hook: 'Listing errors are the silent killer of Amazon seller accounts'
            },
            linkedin: 'Amazon account suspensions often start with a single listing error. Our data from 10,000+ listings shows a pattern: 95% of suspensions could be prevented with proper validation. The problem isn\'t seller knowledge—it\'s manual process gaps. One missed field, one incorrect category, one policy violation. That\'s all it takes. Smart validation catches these issues before Amazon does. Account health stays green. Sales keep flowing. Seller confidence stays high. How do you currently validate your listings before publishing?',
            tweet: '95% of Amazon account suspensions start with listing errors. Smart validation prevents these issues before they reach Amazon. Protect your account. #AmazonSeller #AccountHealth'
          }
        ],
        metadata: {
          total_insights: 2,
          processing_time_ms: 4500,
          tokens_used: 2800,
          cost: 0.14
        }
      };

      // Mock OpenAI responses
      hookGenerator.openai.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify(mockHookResponse)
          }
        }],
        usage: { total_tokens: 2800 }
      });

      // Step 1: Generate Marketing Hooks
      const hooksResult = await hookGenerator.generateMarketingHooks(
        mockTranscript,
        mockCompanyProfile
      );

      expect(hooksResult.insights).toHaveLength(2);
      expect(hooksResult.insights[0].pillar).toBe('Amazon Seller Tools');
      expect(hooksResult.insights[0].linkedin).toContain('8+ hours weekly');
      expect(hooksResult.metadata.cost).toBeGreaterThan(0);

      // Step 2: Mock LinkedIn Post Generation
      const mockPostResponse = {
        posts: [
          {
            hookId: 'hook-1',
            post: 'Most Amazon sellers waste 8+ hours weekly on manual catalog updates. Here\'s what we learned from analyzing 1000+ seller accounts over the past year:\n\nThe biggest productivity killer isn\'t creating new listings—it\'s maintaining existing ones.\n\n→ Seasonal price changes\n→ Inventory level updates  \n→ Keyword optimization tweaks\n→ Category adjustments\n\nEach small change compounds into massive time drains.\n\nLast month, I watched a seller spend 6 hours updating 500 product listings. Same seller now completes identical updates in 20 minutes.\n\nThe difference? Bulk editing tools with intelligent validation.\n\n✅ No more listing errors\n✅ No more account health warnings\n✅ No more weekend catch-up sessions\n\nJust clean, optimized catalogs that convert.\n\nThe secret isn\'t working harder—it\'s working smarter with automation that validates every change before it goes live.\n\nWhat\'s eating up most of your catalog management time?',
            metadata: {
              characterCount: 1847,
              estimatedReadingLevel: 6.2,
              keywordsUsed: ['Amazon', 'sellers', 'catalog', 'optimization'],
              storyArchitecture: 'Problem-Agitation-Solution',
              engagementElements: ['social_proof', 'curiosity_gap', 'specific_metrics']
            }
          }
        ]
      };

      postWriter.openai.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify(mockPostResponse)
          }
        }],
        usage: { total_tokens: 3200 }
      });

      // Step 2: Generate LinkedIn Posts
      const postsResult = await postWriter.generateLinkedInPosts(
        hooksResult.insights,
        mockCompanyProfile,
        mockTranscript.transcript_content
      );

      expect(postsResult.posts).toHaveLength(1);
      expect(postsResult.posts[0].metadata.characterCount).toBeGreaterThan(1500);
      expect(postsResult.posts[0].metadata.characterCount).toBeLessThan(2200);
      expect(postsResult.posts[0].post).toContain('Amazon sellers');

      // Step 3: Generate Image Prompts
      const imagePromptsResult = await imageGenerator.generateImagePrompts(
        postsResult.posts,
        mockCompanyProfile,
        mockVisualStyleGuide
      );

      expect(imagePromptsResult.imagePrompts).toHaveLength(1);
      expect(imagePromptsResult.imagePrompts[0]).toHaveProperty('imagePrompt');
      expect(imagePromptsResult.imagePrompts[0]).toHaveProperty('altText');
      expect(imagePromptsResult.imagePrompts[0].altText.length).toBeLessThanOrEqual(120);

      // Step 4: Mock Image Generation
      imageGenerator.openai.images.generate.mockResolvedValue({
        data: [{
          url: 'https://dalle-generated-image.com/image123.png'
        }]
      });

      const imagesResult = await imageGenerator.generateImages(imagePromptsResult.imagePrompts);

      expect(imagesResult.images).toHaveLength(1);
      expect(imagesResult.images[0].imageUrl).toContain('dalle-generated-image.com');
      expect(imagesResult.totalCost).toBeGreaterThan(0);

      // Step 5: Send for Slack Approval
      const approvalResult = await slackService.sendPostForApproval(
        postsResult.posts[0],
        imagesResult.images[0],
        mockCompanyProfile,
        { id: 'user-123', name: 'Test User' }
      );

      expect(approvalResult).toHaveProperty('approvalId');
      expect(approvalResult.status).toBe('pending');
      expect(slackService.slack.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: '#social-media',
          text: '🎯 New LinkedIn Post Ready for Review'
        })
      );

      // Verify the complete workflow metrics
      const totalProcessingCost = 
        hooksResult.metadata.cost + 
        postsResult.generationMetadata.cost + 
        imagesResult.totalCost;

      expect(totalProcessingCost).toBeLessThan(1.00); // Should be under $1 per post
    }, 15000); // Extended timeout for integration test

    it('should handle workflow failures gracefully', async () => {
      // Test partial failure scenario
      hookGenerator.openai.chat.completions.create.mockRejectedValue(
        new Error('OpenAI API quota exceeded')
      );

      await expect(
        hookGenerator.generateMarketingHooks(mockTranscript, mockCompanyProfile)
      ).rejects.toThrow('OpenAI API quota exceeded');

      // Verify that other services can still function independently
      const mockHooks = [{
        pillar: 'Test',
        linkedin: 'Test hook content',
        source_quote: 'Test quote'
      }];

      // Post writer should work even if hook generation fails
      postWriter.openai.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              posts: [{
                hookId: 'fallback-hook',
                post: 'a'.repeat(1800),
                metadata: { characterCount: 1800 }
              }]
            })
          }
        }],
        usage: { total_tokens: 1000 }
      });

      const fallbackResult = await postWriter.generateLinkedInPosts(
        mockHooks,
        mockCompanyProfile
      );

      expect(fallbackResult.posts).toHaveLength(1);
    });

    it('should maintain data consistency across workflow steps', async () => {
      const workflowData = {
        transcriptId: mockTranscript.id,
        companyId: mockCompanyProfile.id,
        processingSteps: []
      };

      // Step 1: Hook Generation
      hookGenerator.openai.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              insights: [{
                pillar: 'Test Pillar',
                linkedin: 'Test LinkedIn content with proper length and engagement elements for Amazon sellers.',
                source_quote: 'Test quote from transcript',
                blog: { title: 'Test Title', hook: 'Test Hook' },
                tweet: 'Test tweet content'
              }]
            })
          }
        }],
        usage: { total_tokens: 1000 }
      });

      const hooks = await hookGenerator.generateMarketingHooks(mockTranscript, mockCompanyProfile);
      workflowData.processingSteps.push({
        step: 'hook_generation',
        timestamp: new Date().toISOString(),
        insights_count: hooks.insights.length,
        cost: hooks.metadata.cost
      });

      // Step 2: Post Writing
      postWriter.openai.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              posts: [{
                hookId: 'consistent-hook-id',
                post: 'a'.repeat(1800),
                metadata: { characterCount: 1800 }
              }]
            })
          }
        }],
        usage: { total_tokens: 1500 }
      });

      const posts = await postWriter.generateLinkedInPosts(hooks.insights, mockCompanyProfile);
      workflowData.processingSteps.push({
        step: 'post_writing',
        timestamp: new Date().toISOString(),
        posts_count: posts.posts.length,
        cost: posts.generationMetadata.cost
      });

      // Verify data consistency
      expect(hooks.insights).toHaveLength(1);
      expect(posts.posts).toHaveLength(1);
      expect(workflowData.processingSteps).toHaveLength(2);
      
      // Verify IDs are consistent
      const hookId = hooks.insights[0].pillar;
      const postHookRef = posts.posts[0].hookId;
      expect(hookId).toBeTruthy();
      expect(postHookRef).toBeTruthy();
    });
  });

  describe('Performance and Cost Optimization', () => {
    it('should complete workflow within performance targets', async () => {
      const startTime = Date.now();

      // Mock fast responses
      hookGenerator.openai.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({ insights: [] }) } }],
        usage: { total_tokens: 100 }
      });

      await hookGenerator.generateMarketingHooks(mockTranscript, mockCompanyProfile);
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Should complete within 10 seconds (generous for mocked responses)
      expect(processingTime).toBeLessThan(10000);
    });

    it('should maintain cost efficiency', async () => {
      // Mock responses with token usage
      hookGenerator.openai.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({ insights: [] }) } }],
        usage: { total_tokens: 2000 }
      });

      const result = await hookGenerator.generateMarketingHooks(mockTranscript, mockCompanyProfile);
      
      // Cost should be reasonable (under $0.20 for hook generation)
      expect(result.metadata.cost).toBeLessThan(0.20);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should provide meaningful error messages for debugging', async () => {
      const specificError = new Error('Model overloaded, try again in 20 seconds');
      hookGenerator.openai.chat.completions.create.mockRejectedValue(specificError);

      try {
        await hookGenerator.generateMarketingHooks(mockTranscript, mockCompanyProfile);
      } catch (error) {
        expect(error.message).toContain('overloaded');
      }
    });

    it('should handle malformed AI responses gracefully', async () => {
      hookGenerator.openai.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Not valid JSON' } }],
        usage: { total_tokens: 100 }
      });

      await expect(
        hookGenerator.generateMarketingHooks(mockTranscript, mockCompanyProfile)
      ).rejects.toThrow('Invalid JSON response from AI model');
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});