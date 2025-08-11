import OpenAI from 'openai';
import { logger } from '../../utils/logger.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { VectorStoreService } from './VectorStoreService.js';

export class LinkedInPostWriter {
  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    this.vectorStore = new VectorStoreService();
    this.defaultModel = process.env.OPENAI_MODEL || 'gpt-4';
    this.maxTokens = 2000;
    this.temperature = 0.8; // Higher creativity for engaging content
    
    // LinkedIn post constraints
    this.minCharacters = 1500;
    this.maxCharacters = 2200;
    this.targetReadingLevel = 6; // Grade level for accessibility
  }

  /**
   * Generate company-specific LinkedIn writer prompt
   */
  async generateWriterPrompt(companyProfile, knowledgeStores) {
    const {
      company_name: companyName,
      industry,
      brand_voice,
      content_pillars,
      target_personas
    } = companyProfile;

    // Get target audience description
    const primaryAudience = target_personas[0]?.name || 'business professionals';
    const audiencePainPoints = target_personas[0]?.pain_points || ['operational challenges'];
    const keywordList = brand_voice.keywords?.slice(0, 5).join(', ') || 'industry terms';

    const prompt = `## SYSTEM
You are ${companyName}'s senior copywriter specializing in high-converting LinkedIn content for ${primaryAudience}.

## KNOWLEDGE SOURCES AVAILABLE
${knowledgeStores.map(store => `• "${store.name}" - query: "${store.query_key}" (retrieve k=${store.retrieval_count})`).join('\n')}

## CONTENT REQUIREMENTS
**HARD CONSTRAINTS:**
- Each post: ${this.minCharacters}-${this.maxCharacters} characters (optimal for LinkedIn algorithm)
- Write at ${this.targetReadingLevel}th grade reading level
- No em dashes (use periods, commas, or short sentences instead)
- Include 1-2 ${industry} keywords naturally (${keywordList})
- Focus on ${primaryAudience} pain points: ${audiencePainPoints.join(', ')}

## CONTENT STRATEGY

### 1. HOOK MASTERY
- **Pattern Interrupt:** Start with a contrarian statement about ${industry}
- **Curiosity Gap:** Create immediate intrigue within 8-12 words
- **Emotional Trigger:** Connect to ${audiencePainPoints.join(' or ')}
- **Specificity:** Use exact numbers, timeframes, or ${industry} scenarios

### 2. STORY ARCHITECTURE OPTIONS
**A) Problem-Agitation-Solution:**
- Hook: Controversial statement about common ${industry} practice
- Body: Amplify pain point → Show what's at stake → Reveal solution
- CTA: Ask about their experience with the problem

**B) Case Study Format:**
- Hook: Surprising result or transformation
- Body: Situation → Challenge → Solution → Specific results
- CTA: Ask if they've faced similar challenges

**C) Industry Insight:**
- Hook: Surprising statistic or trend observation
- Body: Analysis → Implications → Expert perspective
- CTA: Ask for their take on the trend

### 3. ENGAGEMENT AMPLIFIERS
- **Social Proof:** Specific ${primaryAudience} results and metrics
- **Insider Knowledge:** ${industry} secrets or little-known facts
- **Trend Connections:** Link to current ${industry} changes
- **Personal Stakes:** What happens when problems aren't solved
- **Future Casting:** Where ${industry} is heading

### 4. CONVERSION PSYCHOLOGY
- **Scarcity:** Time-sensitive elements or limited opportunities
- **Authority:** Reference ${companyName}'s expertise in ${content_pillars.map(p => p.title).join(' and ')}
- **Community:** Create sense of shared experience
- **Loss Aversion:** Cost of maintaining status quo

### 5. BRAND VOICE COMPLIANCE
- Tone: ${brand_voice.tone?.join(', ') || 'professional'}
- Natural keyword usage: ${keywordList}
- Avoid: ${brand_voice.prohibited_terms?.join(', ') || 'buzzwords'}
- Company mention: Natural integration of ${companyName} solutions

## QUALITY CHECKPOINTS
Before finalizing each post, verify:
- [ ] Would ${primaryAudience} stop scrolling for this hook?
- [ ] Does it teach something valuable about ${content_pillars[0]?.title || 'the topic'} in 60 seconds?
- [ ] Is the ${companyName} connection natural, not forced?
- [ ] Does the question genuinely invite ${primaryAudience} discussion?
- [ ] Is every sentence earning its place for busy ${primaryAudience}?
- [ ] Character count within ${this.minCharacters}-${this.maxCharacters} range?

## OUTPUT FORMAT
Return clean JSON array named "posts" with no additional formatting or explanation:
{
  "posts": [
    {
      "hookId": "hook-identifier-from-input",
      "post": "Complete LinkedIn post text with natural flow and strong engagement elements",
      "metadata": {
        "characterCount": 1847,
        "estimatedReadingLevel": 6.2,
        "keywordsUsed": ["keyword1", "keyword2"],
        "storyArchitecture": "Case Study Format",
        "engagementElements": ["social_proof", "curiosity_gap"],
        "knowledgeSourcesUsed": ["brand_voice", "top_posts"]
      }
    }
  ]
}

## INSTRUCTIONS
1. For each hook provided, first retrieve relevant brand voice and reference posts
2. Choose most appropriate story architecture for the hook's content
3. Craft posts that feel like peer-to-peer advice, not corporate marketing
4. Prioritize value delivery over word count targets  
5. End with questions that spark genuine ${industry} discussions
6. Skip hooks that don't naturally connect to ${companyName}'s value proposition
7. Focus on solving real ${audiencePainPoints.join(' and ')} problems`;

    return prompt;
  }

  /**
   * Retrieve relevant knowledge for post writing
   */
  async retrieveKnowledge(companyProfile, hooks) {
    try {
      const knowledgeQueries = [
        { type: 'brand_voice', query: 'brand voice snapshot', k: 1 },
        { type: 'top_posts', query: 'reference linkedin post', k: 3 },
        { type: 'frameworks', query: 'engagement frameworks', k: 2 }
      ];

      const knowledgeResults = {};
      
      for (const queryConfig of knowledgeQueries) {
        try {
          const results = await this.vectorStore.retrieve(
            companyProfile.id,
            queryConfig.query,
            queryConfig.k
          );
          knowledgeResults[queryConfig.type] = results;
        } catch (error) {
          logger.warn(`Failed to retrieve ${queryConfig.type} knowledge`, {
            error: error.message,
            companyId: companyProfile.id
          });
          knowledgeResults[queryConfig.type] = [];
        }
      }

      return knowledgeResults;
    } catch (error) {
      logger.error('Knowledge retrieval failed', {
        error: error.message,
        companyId: companyProfile.id
      });
      return { brand_voice: [], top_posts: [], frameworks: [] };
    }
  }

  /**
   * Generate LinkedIn posts from marketing hooks
   */
  async generateLinkedInPosts(hooks, companyProfile, transcriptContext = '') {
    try {
      const startTime = Date.now();

      // Retrieve knowledge for context
      const knowledge = await this.retrieveKnowledge(companyProfile, hooks);
      
      // Get knowledge stores configuration
      const knowledgeStores = await this.getKnowledgeStores(companyProfile.id);
      
      // Generate writer prompt
      const writerPrompt = await this.generateWriterPrompt(companyProfile, knowledgeStores);
      
      // Prepare hooks input
      const hooksInput = hooks.map(hook => ({
        hookId: `hook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        pillar: hook.pillar,
        linkedinHook: hook.linkedin,
        sourceQuote: hook.source_quote,
        blogAngle: hook.blog?.title || ''
      }));

      const fullPrompt = `${writerPrompt}

## RETRIEVED KNOWLEDGE

### Brand Voice Guide:
${knowledge.brand_voice.map(item => item.content).join('\n\n')}

### Top-Performing Reference Posts:
${knowledge.top_posts.map((post, i) => `**Post ${i + 1}:**\n${post.content}`).join('\n\n')}

### Engagement Frameworks:
${knowledge.frameworks.map(framework => framework.content).join('\n\n')}

## HOOKS TO EXPAND
${JSON.stringify(hooksInput, null, 2)}

## TRANSCRIPT CONTEXT (for reference only)
${transcriptContext.substring(0, 1000)}...

Generate full LinkedIn posts for each hook following all requirements.`;

      logger.info('Generating LinkedIn posts', {
        companyId: companyProfile.id,
        hooksCount: hooks.length,
        knowledgeRetrieved: Object.keys(knowledge).length,
        model: this.defaultModel
      });

      const response = await this.openai.chat.completions.create({
        model: this.defaultModel,
        messages: [
          {
            role: 'system',
            content: 'You are an expert LinkedIn copywriter. Create engaging, valuable posts that drive discussion and showcase expertise. Respond ONLY with valid JSON, no additional text.'
          },
          {
            role: 'user',
            content: fullPrompt
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
      let result;
      try {
        result = JSON.parse(content);
      } catch (parseError) {
        logger.error('Failed to parse LinkedIn posts JSON', {
          error: parseError.message,
          content: content.substring(0, 500)
        });
        throw new ApiError('Invalid JSON response from AI model', 500);
      }

      if (!result.posts || !Array.isArray(result.posts)) {
        throw new ApiError('Invalid posts structure in AI response', 500);
      }

      // Validate and enhance each post
      const validatedPosts = result.posts
        .filter(post => this.validatePost(post))
        .map(post => this.enhancePostMetadata(post, companyProfile));

      const finalResult = {
        posts: validatedPosts,
        generationMetadata: {
          processing_time_ms: processingTime,
          model_used: this.defaultModel,
          tokens_used: response.usage?.total_tokens || 0,
          cost: this.calculateCost(response.usage?.total_tokens || 0),
          knowledge_versions: {
            brand_voice: knowledge.brand_voice.length > 0 ? 'retrieved' : 'none',
            top_posts: knowledge.top_posts.length > 0 ? 'retrieved' : 'none', 
            frameworks: knowledge.frameworks.length > 0 ? 'retrieved' : 'none'
          },
          generation_timestamp: new Date().toISOString()
        }
      };

      logger.info('LinkedIn posts generated successfully', {
        companyId: companyProfile.id,
        postsGenerated: validatedPosts.length,
        processingTimeMs: processingTime,
        tokensUsed: response.usage?.total_tokens
      });

      return finalResult;

    } catch (error) {
      logger.error('Failed to generate LinkedIn posts', {
        error: error.message,
        companyId: companyProfile.id,
        hooksCount: hooks.length
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
   * Validate post structure and constraints
   */
  validatePost(post) {
    if (!post.post || !post.hookId) {
      return false;
    }

    const charCount = post.post.length;
    if (charCount < this.minCharacters || charCount > this.maxCharacters) {
      logger.warn('Post character count outside acceptable range', {
        hookId: post.hookId,
        charCount,
        minRequired: this.minCharacters,
        maxAllowed: this.maxCharacters
      });
      return false;
    }

    // Check for em dashes (should be avoided)
    if (post.post.includes('—')) {
      logger.warn('Post contains em dashes', {
        hookId: post.hookId
      });
      // Don't reject, but log for improvement
    }

    return true;
  }

  /**
   * Enhance post with calculated metadata
   */
  enhancePostMetadata(post, companyProfile) {
    const content = post.post;
    const charCount = content.length;
    const wordCount = content.split(/\s+/).length;
    
    // Estimate reading level (simplified Flesch-Kincaid)
    const avgSentenceLength = wordCount / (content.split(/[.!?]+/).length - 1);
    const estimatedReadingLevel = Math.max(1, Math.min(12, 
      0.39 * avgSentenceLength + 11.8 * (this.countSyllables(content) / wordCount) - 15.59
    ));

    // Check for keywords
    const brandKeywords = companyProfile.brand_voice?.keywords || [];
    const keywordsUsed = brandKeywords.filter(keyword => 
      content.toLowerCase().includes(keyword.toLowerCase())
    );

    return {
      ...post,
      metadata: {
        ...post.metadata,
        characterCount: charCount,
        wordCount: wordCount,
        estimatedReadingLevel: Math.round(estimatedReadingLevel * 10) / 10,
        keywordsUsed: keywordsUsed,
        companyMentioned: content.toLowerCase().includes(companyProfile.company_name.toLowerCase()),
        hasEngagementQuestion: content.includes('?'),
        sentenceCount: content.split(/[.!?]+/).length - 1
      }
    };
  }

  /**
   * Simple syllable counting for reading level estimation
   */
  countSyllables(text) {
    return text.toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(/\s+/)
      .reduce((count, word) => {
        const syllables = word.match(/[aeiouy]+/g)?.length || 1;
        return count + Math.max(1, syllables);
      }, 0);
  }

  /**
   * Get knowledge stores configuration for a company
   */
  async getKnowledgeStores(companyProfileId) {
    // This would typically query the database
    // For now, return default configuration
    return [
      {
        name: 'Brand Voice Guide',
        query_key: 'brand voice snapshot',
        retrieval_count: 1,
        type: 'brand_voice'
      },
      {
        name: 'Top-Performing LinkedIn Posts',
        query_key: 'reference linkedin post',
        retrieval_count: 3,
        type: 'top_posts'
      },
      {
        name: 'High-Converting Frameworks',
        query_key: 'engagement frameworks',
        retrieval_count: 2,
        type: 'frameworks'
      }
    ];
  }

  /**
   * Calculate approximate cost based on tokens
   */
  calculateCost(tokens) {
    // GPT-4 pricing (approximate)
    const inputTokens = Math.floor(tokens * 0.6);
    const outputTokens = Math.floor(tokens * 0.4);
    
    const inputCost = (inputTokens / 1000) * 0.03;
    const outputCost = (outputTokens / 1000) * 0.06;
    
    return Math.round((inputCost + outputCost) * 10000) / 10000;
  }

  /**
   * Test post generation with sample data
   */
  async testPostGeneration(sampleHooks = null) {
    const testHooks = sampleHooks || [
      {
        pillar: 'Amazon listing management & optimization',
        source_quote: 'The bulk editing feature is saving clients an average of 4 hours per week on catalog management.',
        linkedin: 'Most Amazon sellers waste 20+ hours weekly on manual listing updates. Here\'s what we learned from analyzing 500+ seller accounts: The biggest time sink isn\'t creating listings—it\'s maintaining them. Seasonal price changes, inventory updates, keyword optimization. Each small change compounds into massive time drains. One client was spending 8 hours updating 500 listings. With bulk editing tools, same task now takes 30 minutes. The secret? Automation that validates changes before they go live. No more listing errors. No more account health issues. Just clean, optimized catalogs that convert. What\'s your biggest catalog management time drain?',
        blog: {
          title: 'How Amazon Sellers Save 20+ Hours Weekly on Listing Management',
          hook: 'Manual listing updates are killing seller productivity and profits.'
        },
        tweet: 'Amazon sellers: Stop wasting 20+ hours/week on manual updates. Bulk editing tools cut 500-listing updates from 8 hours to 30 minutes. Game-changer for catalog management. #AmazonFBA'
      }
    ];

    const testCompanyProfile = {
      id: 'test-company-id',
      company_name: 'FlatFilePro',
      industry: 'ecommerce',
      brand_voice: {
        tone: ['confident', 'practical', 'solution-focused'],
        keywords: ['Amazon', 'listings', 'catalog', 'ASIN', 'optimization', 'sellers'],
        prohibited_terms: ['revolutionary', 'game-changing']
      },
      content_pillars: [
        {
          title: 'Amazon listing management & optimization',
          description: 'Tools and techniques for better product listings'
        }
      ],
      target_personas: [
        {
          name: 'Amazon Sellers',
          pain_points: ['time-consuming manual updates', 'listing errors'],
          emotions: ['frustration', 'relief']
        }
      ]
    };

    try {
      const result = await this.generateLinkedInPosts(testHooks, testCompanyProfile, 'Sample transcript context');
      logger.info('Test post generation completed successfully', {
        postsGenerated: result.posts.length,
        totalCost: result.generationMetadata.cost
      });
      return result;
    } catch (error) {
      logger.error('Test post generation failed', { error: error.message });
      throw error;
    }
  }
}

// Export singleton instance
export const linkedInPostWriter = new LinkedInPostWriter();