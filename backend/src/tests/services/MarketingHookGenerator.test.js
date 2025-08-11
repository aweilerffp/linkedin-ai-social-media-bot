import { jest } from '@jest/globals';
import { MarketingHookGenerator } from '../../services/ai/MarketingHookGenerator.js';

// Mock OpenAI
const mockOpenAI = {
  chat: {
    completions: {
      create: jest.fn()
    }
  },
  models: {
    list: jest.fn()
  }
};

jest.unstable_mockModule('openai', () => ({
  default: jest.fn(() => mockOpenAI)
}));

describe('MarketingHookGenerator', () => {
  let generator;
  let mockCompanyProfile;
  let mockTranscriptData;

  beforeEach(() => {
    jest.clearAllMocks();
    generator = new MarketingHookGenerator();
    
    mockCompanyProfile = {
      id: 'test-company-id',
      company_name: 'TestCorp',
      industry: 'saas',
      brand_voice: {
        tone: ['professional', 'friendly'],
        keywords: ['software', 'automation', 'efficiency'],
        prohibited_terms: ['revolutionary', 'disruptive']
      },
      content_pillars: [
        {
          title: 'Software Solutions',
          description: 'Innovative software products'
        }
      ],
      target_personas: [
        {
          name: 'Business Managers',
          pain_points: ['manual processes', 'inefficiency'],
          emotions: ['frustration', 'relief']
        }
      ],
      evaluation_questions: [
        'What problem does this solve?',
        'How does it save time?'
      ]
    };

    mockTranscriptData = {
      id: 'test-transcript-id',
      transcript_content: 'We discussed our new automation features that save users 10 hours per week. The feedback has been overwhelmingly positive.',
      meeting_date: '2024-01-15',
      metadata: {
        meeting_type: 'Product Review',
        meeting_goal: 'Review feature performance'
      }
    };
  });

  describe('generatePromptTemplate', () => {
    it('should generate a company-specific prompt template', async () => {
      const template = await generator.generatePromptTemplate(mockCompanyProfile);
      
      expect(template).toContain('TestCorp\'s senior content strategist');
      expect(template).toContain('professional, friendly');
      expect(template).toContain('software, automation, efficiency');
      expect(template).toContain('Software Solutions');
      expect(template).toContain('Business Managers');
    });

    it('should include all evaluation questions', async () => {
      const template = await generator.generatePromptTemplate(mockCompanyProfile);
      
      expect(template).toContain('What problem does this solve?');
      expect(template).toContain('How does it save time?');
    });

    it('should handle missing optional fields gracefully', async () => {
      const minimalProfile = {
        company_name: 'TestCorp',
        industry: 'saas',
        brand_voice: {},
        content_pillars: [],
        target_personas: [],
        evaluation_questions: []
      };

      const template = await generator.generatePromptTemplate(minimalProfile);
      expect(template).toContain('TestCorp');
      expect(template).not.toThrow();
    });
  });

  describe('generateMarketingHooks', () => {
    beforeEach(() => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              insights: [
                {
                  pillar: 'Software Solutions',
                  source_quote: 'save users 10 hours per week',
                  insight_score: 0.9,
                  blog: {
                    title: 'How Automation Saves 10 Hours Weekly',
                    hook: 'Manual processes are killing productivity'
                  },
                  linkedin: 'Most businesses waste 10+ hours weekly on manual tasks. Here\'s how automation changed everything for our users...',
                  tweet: 'Automation saves 10 hours/week for busy professionals. #productivity'
                }
              ],
              metadata: {
                total_insights: 1,
                confidence_score: 0.9
              }
            })
          }
        }],
        usage: {
          total_tokens: 1500
        }
      });
    });

    it('should generate marketing hooks successfully', async () => {
      const result = await generator.generateMarketingHooks(mockTranscriptData, mockCompanyProfile);

      expect(result.insights).toHaveLength(1);
      expect(result.insights[0]).toHaveProperty('pillar');
      expect(result.insights[0]).toHaveProperty('source_quote');
      expect(result.insights[0]).toHaveProperty('linkedin');
      expect(result.insights[0]).toHaveProperty('blog');
      expect(result.insights[0]).toHaveProperty('tweet');
    });

    it('should include processing metadata', async () => {
      const result = await generator.generateMarketingHooks(mockTranscriptData, mockCompanyProfile);

      expect(result.metadata).toHaveProperty('processing_time_ms');
      expect(result.metadata).toHaveProperty('tokens_used');
      expect(result.metadata).toHaveProperty('cost');
      expect(result.metadata).toHaveProperty('generation_timestamp');
    });

    it('should handle OpenAI API errors gracefully', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(
        new Error('API quota exceeded')
      );

      await expect(
        generator.generateMarketingHooks(mockTranscriptData, mockCompanyProfile)
      ).rejects.toThrow('API quota exceeded');
    });

    it('should handle invalid JSON response', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: 'Invalid JSON response'
          }
        }],
        usage: { total_tokens: 100 }
      });

      await expect(
        generator.generateMarketingHooks(mockTranscriptData, mockCompanyProfile)
      ).rejects.toThrow('Invalid JSON response from AI model');
    });

    it('should validate insight structure', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              insights: [
                {
                  pillar: 'Test',
                  // Missing required fields
                }
              ]
            })
          }
        }],
        usage: { total_tokens: 100 }
      });

      const result = await generator.generateMarketingHooks(mockTranscriptData, mockCompanyProfile);
      expect(result.insights).toHaveLength(0); // Should filter out invalid insights
    });
  });

  describe('validateInsight', () => {
    it('should validate complete insight structure', () => {
      const validInsight = {
        pillar: 'Test Pillar',
        source_quote: 'Test quote',
        linkedin: 'Test LinkedIn post content',
        blog: {
          title: 'Test Title',
          hook: 'Test Hook'
        },
        tweet: 'Test tweet'
      };

      expect(generator.validateInsight(validInsight)).toBe(true);
    });

    it('should reject insight with missing required fields', () => {
      const invalidInsight = {
        pillar: 'Test Pillar',
        // Missing other required fields
      };

      expect(generator.validateInsight(invalidInsight)).toBe(false);
    });

    it('should reject LinkedIn hook exceeding 150 words', () => {
      const longLinkedInPost = 'word '.repeat(151);
      const insight = {
        pillar: 'Test',
        source_quote: 'Quote',
        linkedin: longLinkedInPost,
        blog: { title: 'Title', hook: 'Hook' },
        tweet: 'Tweet'
      };

      expect(generator.validateInsight(insight)).toBe(false);
    });

    it('should reject tweet exceeding 280 characters', () => {
      const longTweet = 'a'.repeat(281);
      const insight = {
        pillar: 'Test',
        source_quote: 'Quote',
        linkedin: 'LinkedIn post',
        blog: { title: 'Title', hook: 'Hook' },
        tweet: longTweet
      };

      expect(generator.validateInsight(insight)).toBe(false);
    });
  });

  describe('calculateCost', () => {
    it('should calculate cost correctly for given tokens', () => {
      const tokens = 1000;
      const cost = generator.calculateCost(tokens);
      
      expect(cost).toBeGreaterThan(0);
      expect(typeof cost).toBe('number');
    });

    it('should return 0 for 0 tokens', () => {
      const cost = generator.calculateCost(0);
      expect(cost).toBe(0);
    });
  });

  describe('generateIndustryPrompt', () => {
    it('should generate industry-specific configuration', async () => {
      const config = await generator.generateIndustryPrompt('ecommerce', 'TestStore', 'product management');
      
      expect(config).toHaveProperty('focus_areas');
      expect(config).toHaveProperty('preferred_keywords');
      expect(config).toHaveProperty('content_frameworks');
      expect(config.preferred_keywords).toContain('listings');
    });

    it('should fallback to SaaS config for unknown industry', async () => {
      const config = await generator.generateIndustryPrompt('unknown-industry', 'TestCorp', 'general');
      
      expect(config).toHaveProperty('focus_areas');
      expect(config.preferred_keywords).toContain('platform');
    });
  });

  describe('validateConfiguration', () => {
    it('should validate successful API connection', async () => {
      mockOpenAI.models.list.mockResolvedValue({
        data: [
          { id: 'gpt-4' },
          { id: 'gpt-3.5-turbo' }
        ]
      });

      const result = await generator.validateConfiguration();
      
      expect(result.status).toBe('connected');
      expect(result.available_models).toContain('gpt-4');
      expect(result.model_available).toBe(true);
    });

    it('should handle API connection errors', async () => {
      mockOpenAI.models.list.mockRejectedValue(new Error('Connection failed'));

      const result = await generator.validateConfiguration();
      
      expect(result.status).toBe('error');
      expect(result.error).toContain('Connection failed');
    });
  });

  describe('testGeneration', () => {
    beforeEach(() => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              insights: [
                {
                  pillar: 'Amazon listing management',
                  source_quote: 'saving clients an average of 4 hours per week',
                  insight_score: 0.95,
                  blog: {
                    title: 'How to Save 4 Hours Weekly on Amazon Listings',
                    hook: 'Manual listing updates are draining your productivity'
                  },
                  linkedin: 'Amazon sellers waste hours on manual updates. Here\'s how automation changed everything...',
                  tweet: 'Amazon sellers: Stop wasting time on manual updates. Automation saves 4+ hours weekly. #AmazonFBA'
                }
              ],
              metadata: {
                total_insights: 1,
                confidence_score: 0.95
              }
            })
          }
        }],
        usage: { total_tokens: 2000 }
      });
    });

    it('should successfully run test generation', async () => {
      const result = await generator.testGeneration();
      
      expect(result.insights).toHaveLength(1);
      expect(result.insights[0].pillar).toBe('Amazon listing management');
      expect(result.metadata).toHaveProperty('total_cost');
    });

    it('should accept custom test transcript', async () => {
      const customTranscript = {
        id: 'custom-test',
        transcript_content: 'Custom test content about our product features.',
        meeting_date: '2024-01-20',
        metadata: { meeting_type: 'Custom Test' }
      };

      const result = await generator.testGeneration(customTranscript);
      expect(result.insights).toHaveLength(1);
    });
  });

  describe('error handling', () => {
    it('should handle quota exceeded error', async () => {
      const quotaError = new Error('Quota exceeded');
      quotaError.code = 'insufficient_quota';
      mockOpenAI.chat.completions.create.mockRejectedValue(quotaError);

      await expect(
        generator.generateMarketingHooks(mockTranscriptData, mockCompanyProfile)
      ).rejects.toThrow('OpenAI API quota exceeded');
    });

    it('should handle rate limit error', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.code = 'rate_limit_exceeded';
      mockOpenAI.chat.completions.create.mockRejectedValue(rateLimitError);

      await expect(
        generator.generateMarketingHooks(mockTranscriptData, mockCompanyProfile)
      ).rejects.toThrow('OpenAI API rate limit exceeded');
    });
  });
});