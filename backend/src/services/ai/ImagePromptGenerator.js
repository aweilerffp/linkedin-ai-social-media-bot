import OpenAI from 'openai';
import { logger } from '../../utils/logger.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { VectorStoreService } from './VectorStoreService.js';

export class ImagePromptGenerator {
  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    this.vectorStore = new VectorStoreService();
    this.defaultModel = process.env.OPENAI_MODEL || 'gpt-4';
    
    // DALL-E 3 optimal specifications
    this.promptLengthMin = 35;
    this.promptLengthMax = 50;
    this.altTextMaxLength = 120;
    this.imageSize = '1792x1024'; // LinkedIn optimal aspect ratio
    this.dalleModel = 'dall-e-3';
    this.imageQuality = 'standard'; // or 'hd'
  }

  /**
   * Generate DALL-E prompts for LinkedIn posts
   */
  async generateImagePrompts(linkedInPosts, companyProfile, visualStyleGuide) {
    try {
      const startTime = Date.now();
      
      const imagePrompts = [];
      
      for (const post of linkedInPosts) {
        try {
          const prompt = await this.createSingleImagePrompt(post, companyProfile, visualStyleGuide);
          imagePrompts.push(prompt);
        } catch (error) {
          logger.error('Failed to generate prompt for post', {
            postId: post.hookId,
            error: error.message
          });
          // Continue with other posts instead of failing entirely
        }
      }

      const processingTime = Date.now() - startTime;

      const result = {
        imagePrompts,
        generationMetadata: {
          processing_time_ms: processingTime,
          prompts_generated: imagePrompts.length,
          posts_processed: linkedInPosts.length,
          style_guide_version: visualStyleGuide?.id || 'default',
          generation_timestamp: new Date().toISOString()
        }
      };

      logger.info('Image prompts generated successfully', {
        companyId: companyProfile.id,
        promptsGenerated: imagePrompts.length,
        processingTimeMs: processingTime
      });

      return result;

    } catch (error) {
      logger.error('Failed to generate image prompts', {
        error: error.message,
        companyId: companyProfile.id
      });
      throw error;
    }
  }

  /**
   * Create a single image prompt for a LinkedIn post
   */
  async createSingleImagePrompt(post, companyProfile, visualStyleGuide) {
    const { 
      company_name: companyName,
      industry,
      brand_voice 
    } = companyProfile;

    // Extract visual elements from style guide
    const colors = visualStyleGuide?.colors || this.getDefaultColors();
    const illustrationStyle = visualStyleGuide?.illustration_style || this.getDefaultStyle();
    const visualElements = visualStyleGuide?.visual_elements || this.getDefaultElements(industry);
    const restrictions = visualStyleGuide?.restrictions || this.getDefaultRestrictions();

    // Analyze post content for visual concepts
    const visualConcepts = await this.extractVisualConcepts(post.post, industry);
    
    // Select primary visual concept
    const primaryConcept = visualConcepts[0] || 'professional business interface';
    
    // Build color description
    const colorDescription = this.buildColorDescription(colors);
    
    // Generate industry-specific scene
    const sceneDescription = await this.generateSceneDescription(
      primaryConcept, 
      visualElements, 
      industry
    );

    // Construct DALL-E prompt
    const dallePrompt = `${primaryConcept} featuring ${this.getIndustryElements(industry, visualElements)} in ${companyName}'s signature ${illustrationStyle.type || 'modern'} style. Use exact brand colors: ${colorDescription}. Show ${sceneDescription}. Style: ${this.buildStyleCharacteristics(illustrationStyle)}.—${restrictions.join(', ')}`;

    // Validate prompt length and adjust if needed
    const optimizedPrompt = this.optimizePromptLength(dallePrompt);
    
    // Generate accessibility alt-text
    const altText = this.generateAltText(primaryConcept, visualElements, colors);

    return {
      hookId: post.hookId,
      imagePrompt: optimizedPrompt,
      altText: altText,
      metadata: {
        promptLength: optimizedPrompt.split(' ').length,
        altTextLength: altText.length,
        primaryColor: colors.primary || '#000000',
        visualStyle: illustrationStyle.type || 'modern',
        visualConcept: primaryConcept,
        industryElements: this.getIndustryElements(industry, visualElements)
      }
    };
  }

  /**
   * Extract visual concepts from post content using AI
   */
  async extractVisualConcepts(postContent, industry) {
    const prompt = `Analyze this LinkedIn post content and extract 3-5 visual concepts that could be illustrated for ${industry}:

"${postContent}"

Return only the visual concepts as a JSON array of strings, focusing on concrete, visualizable elements that would work well in professional illustrations.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.defaultModel,
        messages: [
          {
            role: 'system',
            content: 'You are a visual design expert. Extract concrete visual concepts from text that can be illustrated professionally. Respond with JSON array only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 200,
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{"concepts": []}');
      return result.concepts || ['professional interface'];
    } catch (error) {
      logger.warn('Failed to extract visual concepts, using defaults', {
        error: error.message
      });
      return this.getDefaultVisualConcepts(industry);
    }
  }

  /**
   * Generate scene description based on concept and elements
   */
  async generateSceneDescription(concept, visualElements, industry) {
    const elementsList = visualElements.common_elements || this.getDefaultElements(industry).common_elements;
    const selectedElements = elementsList.slice(0, 2); // Use top 2 elements
    
    const scenes = [
      `${selectedElements[0]} with ${selectedElements[1]} in background`,
      `modern ${concept} with clean ${selectedElements[0]}`,
      `isometric view of ${selectedElements[0]} and ${selectedElements[1]}`,
      `dashboard showing ${selectedElements.join(' and ')}`
    ];

    // Select scene based on concept
    if (concept.includes('dashboard') || concept.includes('interface')) {
      return scenes[3];
    } else if (concept.includes('data') || concept.includes('analytics')) {
      return scenes[0];
    } else {
      return scenes[1];
    }
  }

  /**
   * Build color description string
   */
  buildColorDescription(colors) {
    const descriptions = [];
    
    if (colors.primary) {
      descriptions.push(`primary ${colors.primary}`);
    }
    if (colors.secondary) {
      descriptions.push(`secondary ${colors.secondary}`);
    }
    if (colors.accent) {
      descriptions.push(`accent ${colors.accent}`);
    }

    return descriptions.join(', ') || 'professional blue and gray tones';
  }

  /**
   * Build style characteristics string
   */
  buildStyleCharacteristics(illustrationStyle) {
    const characteristics = illustrationStyle.characteristics || ['clean lines', 'modern'];
    return characteristics.join(', ');
  }

  /**
   * Get industry-specific visual elements
   */
  getIndustryElements(industry, visualElements) {
    const elements = visualElements.common_elements || this.getDefaultElements(industry).common_elements;
    return elements.slice(0, 3).join(', ');
  }

  /**
   * Optimize prompt length to meet DALL-E requirements
   */
  optimizePromptLength(prompt) {
    const words = prompt.split(' ');
    const basePrompt = words.slice(0, -1).join(' '); // Remove restrictions suffix
    const restrictions = words[words.length - 1]; // Get restrictions
    
    const baseWords = basePrompt.split(' ');
    
    if (baseWords.length <= this.promptLengthMax) {
      return prompt;
    }

    // Trim to max length while preserving key elements
    const trimmedBase = baseWords.slice(0, this.promptLengthMax - 3).join(' ');
    return `${trimmedBase}.—${restrictions}`;
  }

  /**
   * Generate accessibility-friendly alt-text
   */
  generateAltText(concept, visualElements, colors) {
    const primaryColor = colors.primary ? this.getColorName(colors.primary) : 'blue';
    const elements = visualElements.common_elements || ['interface'];
    const element = elements[0] || 'interface';
    
    const altText = `${illustrationStyle.type || 'Modern'} illustration of ${concept.toLowerCase()} with ${primaryColor} ${element.toLowerCase()}`;
    
    // Ensure under character limit
    return altText.length <= this.altTextMaxLength 
      ? altText 
      : altText.substring(0, this.altTextMaxLength - 3) + '...';
  }

  /**
   * Convert hex color to readable name
   */
  getColorName(hexColor) {
    const colorMap = {
      '#5d48f6': 'purple',
      '#CABFFC': 'light purple', 
      '#23201F': 'charcoal',
      '#1A73E8': 'blue',
      '#34A853': 'green',
      '#EA4335': 'red',
      '#FBBC04': 'yellow'
    };

    return colorMap[hexColor] || 'blue';
  }

  /**
   * Get default colors for fallback
   */
  getDefaultColors() {
    return {
      primary: '#1A73E8',
      secondary: '#34A853',
      accent: '#FBBC04',
      background: '#FFFFFF'
    };
  }

  /**
   * Get default visual style for fallback
   */
  getDefaultStyle() {
    return {
      type: 'isometric',
      characteristics: ['clean lines', 'modern interface mockups', 'subtle gradients']
    };
  }

  /**
   * Get default visual elements by industry
   */
  getDefaultElements(industry) {
    const elementsByIndustry = {
      'ecommerce': {
        industry: 'e-commerce',
        common_elements: [
          'product listings',
          'shopping interfaces', 
          'catalog dashboards',
          'inventory grids',
          'order management'
        ]
      },
      'saas': {
        industry: 'software',
        common_elements: [
          'software interfaces',
          'dashboard screens',
          'data visualizations',
          'workflow diagrams',
          'integration points'
        ]
      },
      'consulting': {
        industry: 'professional services',
        common_elements: [
          'strategy frameworks',
          'process diagrams',
          'data analytics',
          'presentation screens',
          'collaboration tools'
        ]
      }
    };

    return elementsByIndustry[industry.toLowerCase()] || elementsByIndustry.saas;
  }

  /**
   * Get default restrictions
   */
  getDefaultRestrictions() {
    return [
      'no text in images',
      'generous white background padding',
      'no human faces',
      'professional style'
    ];
  }

  /**
   * Get default visual concepts by industry
   */
  getDefaultVisualConcepts(industry) {
    const conceptsByIndustry = {
      'ecommerce': ['product catalog interface', 'e-commerce dashboard', 'inventory management'],
      'saas': ['software dashboard', 'data visualization', 'workflow interface'],
      'consulting': ['strategy framework', 'business process', 'analytics dashboard']
    };

    return conceptsByIndustry[industry.toLowerCase()] || ['professional interface'];
  }

  /**
   * Generate actual images using DALL-E 3
   */
  async generateImages(imagePrompts) {
    const images = [];
    const costPerImage = 0.04; // DALL-E 3 standard cost
    
    for (const promptData of imagePrompts) {
      try {
        logger.info('Generating image with DALL-E 3', {
          hookId: promptData.hookId,
          promptLength: promptData.metadata.promptLength
        });

        const response = await this.openai.images.generate({
          model: this.dalleModel,
          prompt: promptData.imagePrompt,
          size: this.imageSize,
          quality: this.imageQuality,
          n: 1
        });

        const imageUrl = response.data[0]?.url;
        
        if (imageUrl) {
          images.push({
            hookId: promptData.hookId,
            imageUrl: imageUrl,
            altText: promptData.altText,
            prompt: promptData.imagePrompt,
            metadata: {
              ...promptData.metadata,
              dalle_model: this.dalleModel,
              image_size: this.imageSize,
              quality: this.imageQuality,
              generation_cost: costPerImage,
              generated_at: new Date().toISOString()
            }
          });

          logger.info('Image generated successfully', {
            hookId: promptData.hookId,
            cost: costPerImage
          });
        }
      } catch (error) {
        logger.error('Failed to generate image', {
          hookId: promptData.hookId,
          error: error.message
        });
        
        // Add failed entry for tracking
        images.push({
          hookId: promptData.hookId,
          error: error.message,
          prompt: promptData.imagePrompt,
          metadata: { ...promptData.metadata, failed: true }
        });
      }
    }

    const totalCost = images.filter(img => !img.error).length * costPerImage;
    
    return {
      images,
      totalCost,
      successful: images.filter(img => !img.error).length,
      failed: images.filter(img => img.error).length
    };
  }

  /**
   * Test image prompt generation
   */
  async testPromptGeneration() {
    const testPost = {
      hookId: 'test-hook-1',
      post: 'Amazon sellers waste 20+ hours weekly on manual listing updates. Our bulk editing tools cut 500-listing updates from 8 hours to 30 minutes. The automation validates changes before they go live, preventing listing errors and account health issues. What\'s your biggest catalog management challenge?'
    };

    const testCompanyProfile = {
      id: 'test-company',
      company_name: 'FlatFilePro',
      industry: 'ecommerce',
      brand_voice: {
        keywords: ['Amazon', 'listings', 'catalog', 'sellers']
      }
    };

    const testStyleGuide = {
      id: 'test-style-1',
      colors: {
        primary: '#5d48f6',
        secondary: '#CABFFC',
        accent: '#23201F'
      },
      illustration_style: {
        type: 'isometric',
        characteristics: ['clean lines', 'modern interface mockups']
      },
      visual_elements: {
        common_elements: ['listing dashboards', 'ASIN grids', 'bulk edit interfaces']
      },
      restrictions: ['no text in images', 'generous white padding']
    };

    try {
      const result = await this.generateImagePrompts([testPost], testCompanyProfile, testStyleGuide);
      logger.info('Test prompt generation completed', {
        promptsGenerated: result.imagePrompts.length
      });
      return result;
    } catch (error) {
      logger.error('Test prompt generation failed', { error: error.message });
      throw error;
    }
  }
}

// Export singleton instance
export const imagePromptGenerator = new ImagePromptGenerator();