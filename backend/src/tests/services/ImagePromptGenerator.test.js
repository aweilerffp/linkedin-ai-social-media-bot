import { jest } from '@jest/globals';
import { ImagePromptGenerator } from '../../services/ai/ImagePromptGenerator.js';

// Mock dependencies
const mockOpenAI = {
  chat: {
    completions: {
      create: jest.fn()
    }
  },
  images: {
    generate: jest.fn()
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

describe('ImagePromptGenerator', () => {
  let generator;
  let mockLinkedInPosts;
  let mockCompanyProfile;
  let mockVisualStyleGuide;

  beforeEach(() => {
    jest.clearAllMocks();
    generator = new ImagePromptGenerator();

    mockLinkedInPosts = [
      {
        hookId: 'test-hook-1',
        post: 'Amazon sellers waste 20+ hours weekly on manual catalog updates. Here\'s how automation saves time and prevents errors in your e-commerce operations.',
        metadata: {
          characterCount: 1650,
          contentPillar: 'E-commerce Automation'
        }
      }
    ];

    mockCompanyProfile = {
      id: 'test-company-id',
      company_name: 'EcommercePro',
      industry: 'ecommerce',
      brand_voice: {
        keywords: ['Amazon', 'e-commerce', 'automation', 'sellers']
      }
    };

    mockVisualStyleGuide = {
      id: 'style-guide-1',
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
        common_elements: ['dashboards', 'product grids', 'analytics charts', 'e-commerce interfaces']
      },
      restrictions: ['no text in images', 'generous white padding', 'professional style']
    };
  });

  describe('generateImagePrompts', () => {
    it('should generate image prompts for LinkedIn posts', async () => {
      const result = await generator.generateImagePrompts(
        mockLinkedInPosts,
        mockCompanyProfile,
        mockVisualStyleGuide
      );

      expect(result.imagePrompts).toHaveLength(1);
      expect(result.imagePrompts[0]).toHaveProperty('hookId', 'test-hook-1');
      expect(result.imagePrompts[0]).toHaveProperty('imagePrompt');
      expect(result.imagePrompts[0]).toHaveProperty('altText');
      expect(result.imagePrompts[0]).toHaveProperty('metadata');
    });

    it('should include processing metadata', async () => {
      const result = await generator.generateImagePrompts(
        mockLinkedInPosts,
        mockCompanyProfile,
        mockVisualStyleGuide
      );

      expect(result.generationMetadata).toHaveProperty('processing_time_ms');
      expect(result.generationMetadata).toHaveProperty('prompts_generated', 1);
      expect(result.generationMetadata).toHaveProperty('posts_processed', 1);
      expect(result.generationMetadata).toHaveProperty('generation_timestamp');
    });

    it('should handle multiple posts', async () => {
      const multiplePosts = [
        mockLinkedInPosts[0],
        {
          hookId: 'test-hook-2',
          post: 'Another LinkedIn post about business automation and productivity improvements.',
          metadata: { characterCount: 1500 }
        }
      ];

      const result = await generator.generateImagePrompts(
        multiplePosts,
        mockCompanyProfile,
        mockVisualStyleGuide
      );

      expect(result.imagePrompts).toHaveLength(2);
      expect(result.generationMetadata.posts_processed).toBe(2);
    });

    it('should continue processing even if one post fails', async () => {
      const multiplePosts = [
        mockLinkedInPosts[0],
        { hookId: 'invalid-post' } // Missing required fields
      ];

      // Mock successful processing for first post
      jest.spyOn(generator, 'createSingleImagePrompt')
        .mockResolvedValueOnce({
          hookId: 'test-hook-1',
          imagePrompt: 'Generated prompt',
          altText: 'Generated alt text'
        })
        .mockRejectedValueOnce(new Error('Invalid post data'));

      const result = await generator.generateImagePrompts(
        multiplePosts,
        mockCompanyProfile,
        mockVisualStyleGuide
      );

      expect(result.imagePrompts).toHaveLength(1);
      expect(result.imagePrompts[0].hookId).toBe('test-hook-1');
    });
  });

  describe('createSingleImagePrompt', () => {
    it('should create a properly formatted DALL-E prompt', async () => {
      const prompt = await generator.createSingleImagePrompt(
        mockLinkedInPosts[0],
        mockCompanyProfile,
        mockVisualStyleGuide
      );

      expect(prompt.imagePrompt).toContain('EcommercePro');
      expect(prompt.imagePrompt).toContain('isometric');
      expect(prompt.imagePrompt).toContain('#FF6B35');
      expect(prompt.imagePrompt).toContain('no text in images');
    });

    it('should generate appropriate alt text', async () => {
      const prompt = await generator.createSingleImagePrompt(
        mockLinkedInPosts[0],
        mockCompanyProfile,
        mockVisualStyleGuide
      );

      expect(prompt.altText.length).toBeLessThanOrEqual(120);
      expect(prompt.altText).toContain('illustration');
      expect(prompt.metadata.altTextLength).toBeLessThanOrEqual(120);
    });

    it('should include metadata about the prompt', async () => {
      const prompt = await generator.createSingleImagePrompt(
        mockLinkedInPosts[0],
        mockCompanyProfile,
        mockVisualStyleGuide
      );

      expect(prompt.metadata).toHaveProperty('promptLength');
      expect(prompt.metadata).toHaveProperty('primaryColor', '#FF6B35');
      expect(prompt.metadata).toHaveProperty('visualStyle', 'isometric');
      expect(prompt.metadata).toHaveProperty('visualConcept');
    });

    it('should handle missing visual style guide', async () => {
      const prompt = await generator.createSingleImagePrompt(
        mockLinkedInPosts[0],
        mockCompanyProfile,
        null
      );

      expect(prompt.imagePrompt).toContain('EcommercePro');
      expect(prompt.metadata.primaryColor).toBe('#1A73E8'); // Default color
    });
  });

  describe('extractVisualConcepts', () => {
    beforeEach(() => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              concepts: ['e-commerce dashboard', 'product catalog', 'automation interface']
            })
          }
        }]
      });
    });

    it('should extract visual concepts using AI', async () => {
      const concepts = await generator.extractVisualConcepts(
        mockLinkedInPosts[0].post,
        'ecommerce'
      );

      expect(concepts).toContain('e-commerce dashboard');
      expect(concepts).toContain('product catalog');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: generator.defaultModel,
          response_format: { type: 'json_object' }
        })
      );
    });

    it('should fall back to defaults on AI failure', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('AI service down'));

      const concepts = await generator.extractVisualConcepts(
        mockLinkedInPosts[0].post,
        'ecommerce'
      );

      expect(concepts).toContain('product catalog interface');
      expect(concepts.length).toBeGreaterThan(0);
    });

    it('should handle invalid JSON responses', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: 'Invalid JSON response'
          }
        }]
      });

      const concepts = await generator.extractVisualConcepts(
        mockLinkedInPosts[0].post,
        'ecommerce'
      );

      expect(concepts).toEqual(['product catalog interface']);
    });
  });

  describe('generateSceneDescription', () => {
    it('should generate appropriate scene descriptions', async () => {
      const scene1 = await generator.generateSceneDescription(
        'dashboard interface',
        { common_elements: ['analytics', 'charts', 'data'] },
        'saas'
      );

      expect(scene1).toContain('analytics');
      expect(typeof scene1).toBe('string');
      expect(scene1.length).toBeGreaterThan(10);
    });

    it('should adapt to different concepts', async () => {
      const dashboardScene = await generator.generateSceneDescription(
        'dashboard',
        { common_elements: ['metrics', 'graphs'] },
        'saas'
      );

      const dataScene = await generator.generateSceneDescription(
        'data analytics',
        { common_elements: ['charts', 'reports'] },
        'saas'
      );

      expect(dashboardScene).toContain('dashboard');
      expect(dataScene).toContain('charts');
    });
  });

  describe('buildColorDescription', () => {
    it('should build color description from hex codes', () => {
      const colors = {
        primary: '#FF6B35',
        secondary: '#F7931E',
        accent: '#2E86AB'
      };

      const description = generator.buildColorDescription(colors);

      expect(description).toContain('primary #FF6B35');
      expect(description).toContain('secondary #F7931E');
      expect(description).toContain('accent #2E86AB');
    });

    it('should handle missing colors gracefully', () => {
      const colors = { primary: '#FF6B35' };

      const description = generator.buildColorDescription(colors);

      expect(description).toContain('primary #FF6B35');
      expect(description).not.toContain('secondary');
    });

    it('should provide fallback for empty colors', () => {
      const description = generator.buildColorDescription({});

      expect(description).toBe('professional blue and gray tones');
    });
  });

  describe('optimizePromptLength', () => {
    it('should keep prompts within optimal length', () => {
      const longPrompt = 'word '.repeat(60) + '—no text in images';
      const optimized = generator.optimizePromptLength(longPrompt);

      const wordCount = optimized.split(' ').length;
      expect(wordCount).toBeLessThanOrEqual(generator.promptLengthMax);
      expect(optimized).toContain('—');
    });

    it('should preserve short prompts unchanged', () => {
      const shortPrompt = 'Simple clean interface design in modern style.—no text';
      const optimized = generator.optimizePromptLength(shortPrompt);

      expect(optimized).toBe(shortPrompt);
    });

    it('should always preserve restrictions suffix', () => {
      const longPrompt = 'word '.repeat(60) + '—no text in images, professional style';
      const optimized = generator.optimizePromptLength(longPrompt);

      expect(optimized).toContain('—');
      expect(optimized.split('—').length).toBe(2);
    });
  });

  describe('generateAltText', () => {
    it('should generate accessibility-compliant alt text', () => {
      const concept = 'e-commerce dashboard';
      const visualElements = { common_elements: ['product grid', 'analytics'] };
      const colors = { primary: '#FF6B35' };

      const altText = generator.generateAltText(concept, visualElements, colors);

      expect(altText.length).toBeLessThanOrEqual(120);
      expect(altText).toContain('illustration');
      expect(altText).toContain('e-commerce dashboard');
    });

    it('should handle long descriptions by truncating', () => {
      const longConcept = 'very detailed complex e-commerce dashboard interface with multiple components';
      const altText = generator.generateAltText(longConcept, {}, {});

      expect(altText.length).toBeLessThanOrEqual(120);
      if (altText.length === 120) {
        expect(altText).toEndWith('...');
      }
    });
  });

  describe('getColorName', () => {
    it('should convert known hex colors to names', () => {
      expect(generator.getColorName('#5d48f6')).toBe('purple');
      expect(generator.getColorName('#1A73E8')).toBe('blue');
      expect(generator.getColorName('#34A853')).toBe('green');
    });

    it('should default to blue for unknown colors', () => {
      expect(generator.getColorName('#123456')).toBe('blue');
      expect(generator.getColorName('invalid')).toBe('blue');
    });
  });

  describe('getDefaultElements', () => {
    it('should return industry-specific elements', () => {
      const ecommerceElements = generator.getDefaultElements('ecommerce');
      expect(ecommerceElements.industry).toBe('e-commerce');
      expect(ecommerceElements.common_elements).toContain('product listings');

      const saasElements = generator.getDefaultElements('saas');
      expect(saasElements.industry).toBe('software');
      expect(saasElements.common_elements).toContain('software interfaces');
    });

    it('should fall back to saas for unknown industries', () => {
      const unknownElements = generator.getDefaultElements('unknown-industry');
      expect(unknownElements.industry).toBe('software');
    });
  });

  describe('generateImages', () => {
    beforeEach(() => {
      mockOpenAI.images.generate.mockResolvedValue({
        data: [{
          url: 'https://dalle-generated-image.com/test-image.png'
        }]
      });
    });

    it('should generate images using DALL-E 3', async () => {
      const imagePrompts = [
        {
          hookId: 'test-hook',
          imagePrompt: 'Test prompt for image generation',
          altText: 'Test alt text',
          metadata: { promptLength: 8 }
        }
      ];

      const result = await generator.generateImages(imagePrompts);

      expect(mockOpenAI.images.generate).toHaveBeenCalledWith({
        model: generator.dalleModel,
        prompt: 'Test prompt for image generation',
        size: generator.imageSize,
        quality: generator.imageQuality,
        n: 1
      });

      expect(result.images).toHaveLength(1);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.totalCost).toBe(0.04);
    });

    it('should handle image generation failures', async () => {
      mockOpenAI.images.generate.mockRejectedValue(new Error('DALL-E service unavailable'));

      const imagePrompts = [{
        hookId: 'test-hook',
        imagePrompt: 'Test prompt',
        altText: 'Test alt text'
      }];

      const result = await generator.generateImages(imagePrompts);

      expect(result.successful).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.images[0]).toHaveProperty('error');
      expect(result.images[0].error).toContain('DALL-E service unavailable');
    });

    it('should process multiple prompts', async () => {
      const imagePrompts = [
        { hookId: 'hook-1', imagePrompt: 'Prompt 1', altText: 'Alt 1' },
        { hookId: 'hook-2', imagePrompt: 'Prompt 2', altText: 'Alt 2' }
      ];

      const result = await generator.generateImages(imagePrompts);

      expect(mockOpenAI.images.generate).toHaveBeenCalledTimes(2);
      expect(result.images).toHaveLength(2);
      expect(result.totalCost).toBe(0.08); // 2 images × $0.04
    });

    it('should include generation metadata', async () => {
      const imagePrompts = [{
        hookId: 'test-hook',
        imagePrompt: 'Test prompt',
        altText: 'Test alt text',
        metadata: { visualStyle: 'isometric' }
      }];

      const result = await generator.generateImages(imagePrompts);

      const generatedImage = result.images[0];
      expect(generatedImage.metadata).toHaveProperty('dalle_model', 'dall-e-3');
      expect(generatedImage.metadata).toHaveProperty('image_size', '1792x1024');
      expect(generatedImage.metadata).toHaveProperty('generation_cost', 0.04);
      expect(generatedImage.metadata).toHaveProperty('generated_at');
    });
  });

  describe('testPromptGeneration', () => {
    it('should run test prompt generation successfully', async () => {
      const result = await generator.testPromptGeneration();

      expect(result.imagePrompts).toHaveLength(1);
      expect(result.imagePrompts[0].hookId).toBe('test-hook-1');
      expect(result.imagePrompts[0]).toHaveProperty('imagePrompt');
      expect(result.imagePrompts[0]).toHaveProperty('altText');
    });

    it('should use test data for validation', async () => {
      const result = await generator.testPromptGeneration();

      const prompt = result.imagePrompts[0];
      expect(prompt.imagePrompt).toContain('FlatFilePro');
      expect(prompt.imagePrompt).toContain('isometric');
      expect(prompt.altText).toContain('illustration');
    });
  });

  describe('error handling', () => {
    it('should handle OpenAI API errors gracefully', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('OpenAI API down'));

      // Should fall back to defaults instead of throwing
      const concepts = await generator.extractVisualConcepts('test content', 'saas');
      expect(concepts).toEqual(['professional interface']);
    });

    it('should handle missing required environment variables', () => {
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      expect(() => {
        new ImagePromptGenerator();
      }).toThrow('OPENAI_API_KEY environment variable is required');

      process.env.OPENAI_API_KEY = originalKey;
    });

    it('should validate prompt structure', async () => {
      const invalidPost = { hookId: 'test' }; // Missing required fields

      await expect(
        generator.createSingleImagePrompt(invalidPost, mockCompanyProfile, mockVisualStyleGuide)
      ).resolves.toBeDefined(); // Should handle gracefully, not throw
    });
  });

  describe('industry-specific behavior', () => {
    it('should adapt prompts to different industries', async () => {
      const healthcareProfile = {
        ...mockCompanyProfile,
        industry: 'healthcare',
        company_name: 'HealthTech Solutions'
      };

      const prompt = await generator.createSingleImagePrompt(
        mockLinkedInPosts[0],
        healthcareProfile,
        mockVisualStyleGuide
      );

      expect(prompt.imagePrompt).toContain('HealthTech Solutions');
    });

    it('should use appropriate visual elements for each industry', () => {
      const financeElements = generator.getDefaultElements('finance');
      expect(financeElements.common_elements).toContain('financial charts');

      const educationElements = generator.getDefaultElements('education');
      expect(educationElements.common_elements).toContain('learning interfaces');
    });
  });

  describe('performance and optimization', () => {
    it('should process prompts within reasonable time', async () => {
      const startTime = Date.now();

      await generator.generateImagePrompts(
        mockLinkedInPosts,
        mockCompanyProfile,
        mockVisualStyleGuide
      );

      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds for mocked responses
    });

    it('should optimize prompt length for DALL-E constraints', () => {
      const longPrompt = 'word '.repeat(100);
      const optimized = generator.optimizePromptLength(longPrompt);
      
      const wordCount = optimized.split(' ').length;
      expect(wordCount).toBeLessThanOrEqual(generator.promptLengthMax);
    });

    it('should generate alt text within accessibility limits', () => {
      const altText = generator.generateAltText('complex concept', {}, {});
      expect(altText.length).toBeLessThanOrEqual(generator.altTextMaxLength);
    });
  });
});