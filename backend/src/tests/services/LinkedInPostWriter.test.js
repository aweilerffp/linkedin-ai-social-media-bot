import { jest } from '@jest/globals';
import { LinkedInPostWriter } from '../../services/ai/LinkedInPostWriter.js';

// Mock dependencies
const mockOpenAI = {
  chat: {
    completions: {
      create: jest.fn()
    }
  }
};

const mockVectorStore = {
  retrieve: jest.fn()
};

jest.unstable_mockModule('openai', () => ({
  default: jest.fn(() => mockOpenAI)
}));

jest.unstable_mockModule('../../services/ai/VectorStoreService.js', () => ({
  VectorStoreService: jest.fn(() => mockVectorStore)
}));

describe('LinkedInPostWriter', () => {
  let writer;
  let mockCompanyProfile;
  let mockHooks;

  beforeEach(() => {
    jest.clearAllMocks();
    writer = new LinkedInPostWriter();
    
    mockCompanyProfile = {
      id: 'test-company-id',
      company_name: 'TestCorp',
      industry: 'saas',
      brand_voice: {
        tone: ['professional', 'friendly'],
        keywords: ['software', 'automation', 'productivity']
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
          pain_points: ['manual processes', 'time waste']
        }
      ]
    };

    mockHooks = [
      {
        pillar: 'Software Solutions',
        source_quote: 'automation saves 10 hours weekly',
        linkedin: 'Manual processes waste time. Automation saves 10 hours weekly for busy professionals.',
        blog: {
          title: 'How Automation Saves 10 Hours Weekly'
        }
      }
    ];
  });

  describe('generateWriterPrompt', () => {
    it('should generate company-specific LinkedIn writer prompt', async () => {
      const knowledgeStores = [
        { name: 'Brand Voice', query_key: 'brand voice', retrieval_count: 1 },
        { name: 'Top Posts', query_key: 'top posts', retrieval_count: 3 }
      ];

      const prompt = await writer.generateWriterPrompt(mockCompanyProfile, knowledgeStores);
      
      expect(prompt).toContain('TestCorp\'s senior copywriter');
      expect(prompt).toContain('Business Managers');
      expect(prompt).toContain('1500-2200 characters');
      expect(prompt).toContain('software, automation, productivity');
    });

    it('should include character constraints', async () => {
      const prompt = await writer.generateWriterPrompt(mockCompanyProfile, []);
      
      expect(prompt).toContain(`${writer.minCharacters}-${writer.maxCharacters} characters`);
      expect(prompt).toContain(`${writer.targetReadingLevel}th grade reading level`);
    });

    it('should include quality checkpoints', async () => {
      const prompt = await writer.generateWriterPrompt(mockCompanyProfile, []);
      
      expect(prompt).toContain('QUALITY CHECKPOINTS');
      expect(prompt).toContain('Would Business Managers stop scrolling');
      expect(prompt).toContain('TestCorp connection natural');
    });
  });

  describe('retrieveKnowledge', () => {
    beforeEach(() => {
      mockVectorStore.retrieve
        .mockResolvedValueOnce([
          { type: 'brand_voice', content: 'Professional, friendly tone' }
        ])
        .mockResolvedValueOnce([
          { type: 'top_posts', content: 'Top performing LinkedIn post content' }
        ])
        .mockResolvedValueOnce([
          { type: 'frameworks', content: 'Problem-solution framework' }
        ]);
    });

    it('should retrieve knowledge from vector store', async () => {
      const knowledge = await writer.retrieveKnowledge(mockCompanyProfile, mockHooks);
      
      expect(mockVectorStore.retrieve).toHaveBeenCalledTimes(3);
      expect(knowledge).toHaveProperty('brand_voice');
      expect(knowledge).toHaveProperty('top_posts');
      expect(knowledge).toHaveProperty('frameworks');
    });

    it('should handle retrieval failures gracefully', async () => {
      mockVectorStore.retrieve.mockRejectedValue(new Error('Retrieval failed'));

      const knowledge = await writer.retrieveKnowledge(mockCompanyProfile, mockHooks);
      
      expect(knowledge.brand_voice).toEqual([]);
      expect(knowledge.top_posts).toEqual([]);
      expect(knowledge.frameworks).toEqual([]);
    });
  });

  describe('generateLinkedInPosts', () => {
    beforeEach(() => {
      mockVectorStore.retrieve.mockResolvedValue([
        { type: 'brand_voice', content: 'Professional tone, focus on results' }
      ]);

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              posts: [
                {
                  hookId: 'hook-123',
                  post: 'Most businesses waste 20+ hours weekly on manual processes. Here\'s what we learned from analyzing 1000+ companies: The biggest productivity killer isn\'t complex workflows—it\'s repetitive tasks. One client was spending 40 hours monthly on data entry. With smart automation, same work now takes 4 hours. The secret? Intelligent workflow design that eliminates bottlenecks. No more midnight catch-up sessions. No more weekend work just to stay current. Just streamlined operations that actually scale. What\'s eating up most of your team\'s productive time?',
                  metadata: {
                    characterCount: 1847,
                    estimatedReadingLevel: 6.2,
                    keywordsUsed: ['automation', 'productivity'],
                    storyArchitecture: 'Problem-Agitation-Solution'
                  }
                }
              ]
            })
          }
        }],
        usage: {
          total_tokens: 2500
        }
      });
    });

    it('should generate LinkedIn posts successfully', async () => {
      const result = await writer.generateLinkedInPosts(mockHooks, mockCompanyProfile);

      expect(result.posts).toHaveLength(1);
      expect(result.posts[0]).toHaveProperty('hookId');
      expect(result.posts[0]).toHaveProperty('post');
      expect(result.posts[0]).toHaveProperty('metadata');
    });

    it('should include generation metadata', async () => {
      const result = await writer.generateLinkedInPosts(mockHooks, mockCompanyProfile);

      expect(result.generationMetadata).toHaveProperty('processing_time_ms');
      expect(result.generationMetadata).toHaveProperty('tokens_used');
      expect(result.generationMetadata).toHaveProperty('cost');
      expect(result.generationMetadata).toHaveProperty('model_used');
    });

    it('should validate post character count', async () => {
      const shortPost = {
        posts: [
          {
            hookId: 'short-post',
            post: 'Too short',
            metadata: {}
          }
        ]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(shortPost) } }],
        usage: { total_tokens: 100 }
      });

      const result = await writer.generateLinkedInPosts(mockHooks, mockCompanyProfile);
      
      expect(result.posts).toHaveLength(0); // Should filter out invalid posts
    });

    it('should handle transcript context', async () => {
      const transcriptContext = 'Meeting about product features and customer feedback';
      
      await writer.generateLinkedInPosts(mockHooks, mockCompanyProfile, transcriptContext);
      
      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
      expect(callArgs.messages[1].content).toContain(transcriptContext.substring(0, 1000));
    });
  });

  describe('validatePost', () => {
    it('should validate posts within character limits', () => {
      const validPost = {
        hookId: 'test-hook',
        post: 'a'.repeat(1800) // Valid length
      };

      expect(writer.validatePost(validPost)).toBe(true);
    });

    it('should reject posts that are too short', () => {
      const shortPost = {
        hookId: 'test-hook',
        post: 'Too short'
      };

      expect(writer.validatePost(shortPost)).toBe(false);
    });

    it('should reject posts that are too long', () => {
      const longPost = {
        hookId: 'test-hook',
        post: 'a'.repeat(3000) // Too long
      };

      expect(writer.validatePost(longPost)).toBe(false);
    });

    it('should reject posts missing required fields', () => {
      const incompletePost = {
        hookId: 'test-hook'
        // Missing post content
      };

      expect(writer.validatePost(incompletePost)).toBe(false);
    });

    it('should warn about em dashes but not reject', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const postWithEmDash = {
        hookId: 'test-hook',
        post: 'a'.repeat(1800) + '—'
      };

      const result = writer.validatePost(postWithEmDash);
      expect(result).toBe(true); // Should not reject
      
      consoleSpy.mockRestore();
    });
  });

  describe('enhancePostMetadata', () => {
    it('should calculate post metadata correctly', () => {
      const post = {
        hookId: 'test-hook',
        post: 'This is a test post with multiple sentences. It contains some keywords. Does it have questions?',
        metadata: {}
      };

      const enhanced = writer.enhancePostMetadata(post, mockCompanyProfile);

      expect(enhanced.metadata.characterCount).toBe(post.post.length);
      expect(enhanced.metadata.wordCount).toBeGreaterThan(0);
      expect(enhanced.metadata.estimatedReadingLevel).toBeGreaterThan(0);
      expect(enhanced.metadata.hasEngagementQuestion).toBe(true);
      expect(enhanced.metadata.sentenceCount).toBeGreaterThan(0);
    });

    it('should identify company mentions', () => {
      const post = {
        hookId: 'test-hook',
        post: `TestCorp's solution helps businesses save time and money through automation.`,
        metadata: {}
      };

      const enhanced = writer.enhancePostMetadata(post, mockCompanyProfile);
      expect(enhanced.metadata.companyMentioned).toBe(true);
    });

    it('should identify used keywords', () => {
      const post = {
        hookId: 'test-hook',
        post: 'Software automation improves productivity for modern businesses.',
        metadata: {}
      };

      const enhanced = writer.enhancePostMetadata(post, mockCompanyProfile);
      expect(enhanced.metadata.keywordsUsed).toContain('software');
      expect(enhanced.metadata.keywordsUsed).toContain('automation');
      expect(enhanced.metadata.keywordsUsed).toContain('productivity');
    });
  });

  describe('countSyllables', () => {
    it('should count syllables correctly', () => {
      expect(writer.countSyllables('hello')).toBe(2);
      expect(writer.countSyllables('automation')).toBe(4);
      expect(writer.countSyllables('the')).toBe(1);
    });

    it('should handle empty strings', () => {
      expect(writer.countSyllables('')).toBe(0);
    });

    it('should handle non-alphabetic characters', () => {
      expect(writer.countSyllables('hello123!')).toBe(2);
    });
  });

  describe('calculateCost', () => {
    it('should calculate cost based on token usage', () => {
      const cost = writer.calculateCost(1000);
      expect(cost).toBeGreaterThan(0);
      expect(typeof cost).toBe('number');
    });

    it('should return 0 for 0 tokens', () => {
      const cost = writer.calculateCost(0);
      expect(cost).toBe(0);
    });
  });

  describe('getKnowledgeStores', () => {
    it('should return default knowledge store configuration', async () => {
      const stores = await writer.getKnowledgeStores('test-company-id');
      
      expect(stores).toHaveLength(3);
      expect(stores[0].name).toBe('Brand Voice Guide');
      expect(stores[1].name).toBe('Top-Performing LinkedIn Posts');
      expect(stores[2].name).toBe('High-Converting Frameworks');
    });
  });

  describe('testPostGeneration', () => {
    beforeEach(() => {
      mockVectorStore.retrieve.mockResolvedValue([
        { content: 'Test knowledge content' }
      ]);

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              posts: [
                {
                  hookId: 'hook-1',
                  post: 'a'.repeat(1800),
                  metadata: {
                    characterCount: 1800,
                    estimatedReadingLevel: 6.0
                  }
                }
              ]
            })
          }
        }],
        usage: { total_tokens: 2000 }
      });
    });

    it('should run test post generation successfully', async () => {
      const result = await writer.testPostGeneration();
      
      expect(result.posts).toHaveLength(1);
      expect(result.generationMetadata).toHaveProperty('cost');
    });

    it('should accept custom hooks for testing', async () => {
      const customHooks = [
        {
          pillar: 'Custom Pillar',
          linkedin: 'Custom LinkedIn hook content',
          source_quote: 'Custom source quote'
        }
      ];

      const result = await writer.testPostGeneration(customHooks);
      expect(result.posts).toHaveLength(1);
    });
  });

  describe('error handling', () => {
    it('should handle OpenAI API errors', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(
        new Error('API Error')
      );

      await expect(
        writer.generateLinkedInPosts(mockHooks, mockCompanyProfile)
      ).rejects.toThrow('API Error');
    });

    it('should handle invalid JSON responses', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: 'Invalid JSON'
          }
        }],
        usage: { total_tokens: 100 }
      });

      await expect(
        writer.generateLinkedInPosts(mockHooks, mockCompanyProfile)
      ).rejects.toThrow('Invalid JSON response from AI model');
    });

    it('should handle missing posts array in response', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({ notPosts: [] })
          }
        }],
        usage: { total_tokens: 100 }
      });

      await expect(
        writer.generateLinkedInPosts(mockHooks, mockCompanyProfile)
      ).rejects.toThrow('Invalid posts structure in AI response');
    });

    it('should handle quota exceeded errors', async () => {
      const quotaError = new Error('Quota exceeded');
      quotaError.code = 'insufficient_quota';
      mockOpenAI.chat.completions.create.mockRejectedValue(quotaError);

      await expect(
        writer.generateLinkedInPosts(mockHooks, mockCompanyProfile)
      ).rejects.toThrow('OpenAI API quota exceeded');
    });

    it('should handle rate limit errors', async () => {
      const rateLimitError = new Error('Rate limited');
      rateLimitError.code = 'rate_limit_exceeded';
      mockOpenAI.chat.completions.create.mockRejectedValue(rateLimitError);

      await expect(
        writer.generateLinkedInPosts(mockHooks, mockCompanyProfile)
      ).rejects.toThrow('OpenAI API rate limit exceeded');
    });
  });
});