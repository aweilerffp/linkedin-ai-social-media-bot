import OpenAI from 'openai';
import { logger } from '../../utils/logger.js';
import { ApiError } from '../../middleware/errorHandler.js';

export class MarketingHookGenerator {
  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    this.defaultModel = process.env.OPENAI_MODEL || 'gpt-4';
    this.maxTokens = 4000;
    this.temperature = 0.7;
  }

  /**
   * Generate company-specific prompt based on company profile
   */
  async generatePromptTemplate(companyProfile) {
    const {
      company_name: companyName,
      industry,
      brand_voice,
      content_pillars,
      target_personas,
      evaluation_questions
    } = companyProfile;

    const basePrompt = `ROLE: You are ${companyName}'s senior content strategist.

### Brand Voice
- Tone: ${brand_voice.tone?.join(', ') || 'professional, informative'}
- Keywords: ${brand_voice.keywords?.join(', ') || 'industry-specific terms'}
- Avoid: ${brand_voice.prohibited_terms?.join(', ') || 'buzzwords, jargon'}

### Content Pillars (ranked)
${content_pillars.map((pillar, index) => 
  `${index + 1}. ${pillar.title}${pillar.description ? `: ${pillar.description}` : ''}`
).join('\n')}

### Target Personas
${target_personas.map(persona => 
  `- ${persona.name}: ${persona.pain_points?.join(', ')} (emotions: ${persona.emotions?.join(', ')})`
).join('\n')}

### Meeting Metadata
- Date: {DATE}
- Type: {MEETING_TYPE}
- Goal: {MEETING_GOAL}

### Evaluation Questions
${evaluation_questions.map((q, i) => `${i + 1}. "${q}"`).join('\n')}

### Transcript
"""
{TRANSCRIPT_CONTENT}
"""

### Tasks
1. Extract up to 10 distinct insights that map to content pillars and answer evaluation questions
2. Each insight must include source quote from transcript
3. Generate blog angle, LinkedIn hook (150 words max), and tweet for each
4. Output as structured JSON only

### Output Format (JSON only, no additional text):
{
  "insights": [
    {
      "pillar": "Content pillar name",
      "source_quote": "Exact quote from transcript supporting this insight",
      "insight_score": 0.85,
      "blog": {
        "title": "SEO-optimized blog title",
        "hook": "25-word compelling blog opening"
      },
      "linkedin": "150-word LinkedIn post ending with engagement question that naturally leads to discussion about ${companyName}'s solutions",
      "tweet": "280-char tweet with max 1 relevant hashtag"
    }
  ],
  "metadata": {
    "total_insights": 10,
    "pillars_covered": ["pillar1", "pillar2"],
    "confidence_score": 0.9,
    "processing_notes": "Brief summary of analysis approach"
  }
}`;

    return basePrompt;
  }

  /**
   * Process meeting transcript and extract marketing insights
   */
  async generateMarketingHooks(transcriptData, companyProfile) {
    try {
      const startTime = Date.now();
      
      // Generate company-specific prompt
      const promptTemplate = await this.generatePromptTemplate(companyProfile);
      
      // Substitute template variables
      const prompt = promptTemplate
        .replace('{DATE}', transcriptData.meeting_date || new Date().toISOString().split('T')[0])
        .replace('{MEETING_TYPE}', transcriptData.metadata?.meeting_type || 'Meeting')
        .replace('{MEETING_GOAL}', transcriptData.metadata?.meeting_goal || 'Team discussion')
        .replace('{TRANSCRIPT_CONTENT}', transcriptData.transcript_content);

      logger.info('Generating marketing hooks', {
        transcriptId: transcriptData.id,
        companyId: companyProfile.id,
        transcriptLength: transcriptData.transcript_content?.length,
        model: this.defaultModel
      });

      // Call OpenAI API
      const response = await this.openai.chat.completions.create({
        model: this.defaultModel,
        messages: [
          {
            role: 'system',
            content: 'You are an expert marketing content strategist. Analyze meeting transcripts and extract actionable marketing insights. Respond ONLY with valid JSON, no additional text or formatting.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        response_format: { type: 'json_object' }
      });

      const processingTime = Date.now() - startTime;
      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw new ApiError('No content generated from OpenAI', 500);
      }

      // Parse and validate JSON response
      let insights;
      try {
        insights = JSON.parse(content);
      } catch (parseError) {
        logger.error('Failed to parse OpenAI response as JSON', {
          error: parseError.message,
          content: content.substring(0, 500)
        });
        throw new ApiError('Invalid JSON response from AI model', 500);
      }

      // Validate response structure
      if (!insights.insights || !Array.isArray(insights.insights)) {
        throw new ApiError('Invalid insights structure in AI response', 500);
      }

      // Validate each insight
      const validatedInsights = insights.insights
        .filter(insight => this.validateInsight(insight))
        .slice(0, 10); // Limit to 10 insights

      const result = {
        insights: validatedInsights,
        metadata: {
          ...insights.metadata,
          total_insights: validatedInsights.length,
          processing_time_ms: processingTime,
          model_used: this.defaultModel,
          tokens_used: response.usage?.total_tokens || 0,
          cost: this.calculateCost(response.usage?.total_tokens || 0),
          generation_timestamp: new Date().toISOString()
        }
      };

      logger.info('Marketing hooks generated successfully', {
        transcriptId: transcriptData.id,
        companyId: companyProfile.id,
        insightsCount: validatedInsights.length,
        processingTimeMs: processingTime,
        tokensUsed: response.usage?.total_tokens
      });

      return result;

    } catch (error) {
      logger.error('Failed to generate marketing hooks', {
        error: error.message,
        transcriptId: transcriptData.id,
        companyId: companyProfile.id
      });

      if (error.code === 'insufficient_quota') {
        throw new ApiError('OpenAI API quota exceeded', 429);
      }
      if (error.code === 'rate_limit_exceeded') {
        throw new ApiError('OpenAI API rate limit exceeded', 429);
      }
      
      throw error;
    }
  }

  /**
   * Validate individual insight structure
   */
  validateInsight(insight) {
    const required = ['pillar', 'source_quote', 'linkedin', 'blog', 'tweet'];
    const hasRequired = required.every(field => insight[field]);
    
    if (!hasRequired) {
      return false;
    }

    // Validate LinkedIn hook length (150 words max)
    const wordCount = insight.linkedin.split(/\s+/).length;
    if (wordCount > 150) {
      logger.warn('LinkedIn hook exceeds 150 words', {
        wordCount,
        content: insight.linkedin.substring(0, 100)
      });
      return false;
    }

    // Validate tweet length (280 chars max)
    if (insight.tweet.length > 280) {
      logger.warn('Tweet exceeds 280 characters', {
        length: insight.tweet.length,
        content: insight.tweet.substring(0, 100)
      });
      return false;
    }

    // Validate blog structure
    if (!insight.blog.title || !insight.blog.hook) {
      return false;
    }

    return true;
  }

  /**
   * Calculate approximate cost based on tokens
   */
  calculateCost(tokens) {
    // GPT-4 pricing (approximate): $0.03/1K tokens for input, $0.06/1K tokens for output
    // Assume 70% input, 30% output for cost estimation
    const inputTokens = Math.floor(tokens * 0.7);
    const outputTokens = Math.floor(tokens * 0.3);
    
    const inputCost = (inputTokens / 1000) * 0.03;
    const outputCost = (outputTokens / 1000) * 0.06;
    
    return Math.round((inputCost + outputCost) * 10000) / 10000; // Round to 4 decimal places
  }

  /**
   * Generate custom prompt for specific industry
   */
  async generateIndustryPrompt(industry, companyName, useCase) {
    const industryPrompts = {
      'ecommerce': {
        focus: 'product management, customer experience, conversion optimization',
        keywords: ['listings', 'catalog', 'inventory', 'optimization', 'marketplace'],
        frameworks: ['customer journey', 'conversion funnel', 'product-market fit']
      },
      'saas': {
        focus: 'user experience, product development, customer success',
        keywords: ['platform', 'integration', 'automation', 'workflow', 'efficiency'],
        frameworks: ['user adoption', 'feature adoption', 'customer lifecycle']
      },
      'consulting': {
        focus: 'client success, industry expertise, thought leadership',
        keywords: ['strategy', 'implementation', 'best practices', 'transformation'],
        frameworks: ['case study', 'methodology', 'results-driven']
      }
    };

    const config = industryPrompts[industry.toLowerCase()] || industryPrompts.saas;
    
    return {
      focus_areas: config.focus,
      preferred_keywords: config.keywords,
      content_frameworks: config.frameworks,
      industry_context: `${companyName} operates in ${industry} with focus on ${config.focus}`
    };
  }

  /**
   * Test hook generation with sample data
   */
  async testGeneration(sampleTranscript = null) {
    const testTranscript = sampleTranscript || {
      id: 'test-transcript-id',
      transcript_content: `Product Manager: We've been seeing some interesting trends in our Amazon seller data. The bulk editing feature is saving clients an average of 4 hours per week on catalog management.

Sales Lead: That's huge. One client mentioned they were able to update 500 product listings in just 30 minutes instead of the usual 8 hours.

Engineering: The new validation system is catching 95% of potential listing errors before they go live. This is preventing account suspensions and improving seller health scores.

Customer Success: Clients are specifically mentioning the ASIN variation management tool. It's helping them organize complex product hierarchies that were previously impossible to manage efficiently.

CEO: This positions us perfectly for the Amazon Brand Registry expansion. We should highlight how our tools integrate with Amazon's evolving platform requirements.`,
      meeting_date: new Date().toISOString(),
      metadata: {
        meeting_type: 'Product Review',
        meeting_goal: 'Review feature performance and customer feedback'
      }
    };

    const testCompanyProfile = {
      id: 'test-company-id',
      company_name: 'FlatFilePro',
      industry: 'ecommerce',
      brand_voice: {
        tone: ['confident', 'practical', 'solution-focused'],
        keywords: ['Amazon', 'listings', 'catalog', 'ASIN', 'optimization'],
        prohibited_terms: ['revolutionary', 'game-changing', 'paradigm']
      },
      content_pillars: [
        {
          title: 'Amazon listing management & optimization',
          description: 'Tools and techniques for better product listings'
        },
        {
          title: 'Catalog efficiency & seller operations',
          description: 'Streamlining e-commerce operations'
        }
      ],
      target_personas: [
        {
          name: 'Amazon Sellers',
          pain_points: ['time-consuming manual updates', 'listing errors', 'account suspensions'],
          emotions: ['frustration', 'relief', 'confidence']
        }
      ],
      evaluation_questions: [
        'What specific problem does this solve for Amazon sellers?',
        'How does this save time or reduce errors?',
        'What competitive advantage does this provide?',
        'How does this integrate with Amazon\'s platform?'
      ]
    };

    try {
      const result = await this.generateMarketingHooks(testTranscript, testCompanyProfile);
      logger.info('Test generation completed successfully', {
        insightsGenerated: result.insights.length,
        totalCost: result.metadata.cost
      });
      return result;
    } catch (error) {
      logger.error('Test generation failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Validate API connection and configuration
   */
  async validateConfiguration() {
    try {
      const response = await this.openai.models.list();
      const availableModels = response.data.map(model => model.id);
      
      return {
        status: 'connected',
        available_models: availableModels,
        configured_model: this.defaultModel,
        model_available: availableModels.includes(this.defaultModel)
      };
    } catch (error) {
      logger.error('OpenAI configuration validation failed', { error: error.message });
      return {
        status: 'error',
        error: error.message
      };
    }
  }
}

// Export singleton instance
export const marketingHookGenerator = new MarketingHookGenerator();