import OpenAI from 'openai';
import { logger } from '../../utils/logger.js';
import { ApiError } from '../../middleware/errorHandler.js';

export class LinkedInPostGenerator {
  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    this.defaultModel = process.env.OPENAI_MODEL || 'gpt-4';
    this.maxTokens = 2000;
    this.temperature = 0.8;
  }

  /**
   * Generate a full LinkedIn post from a marketing hook
   */
  async generatePost(hook, companyProfile, options = {}) {
    try {
      const {
        postLength = 'medium', // short (500-800), medium (800-1500), long (1500-2200)
        includeHashtags = true,
        includeEmojis = true,
        callToAction = 'engage' // engage, visit, contact, learn
      } = options;

      const lengthGuide = {
        short: '500-800 characters',
        medium: '800-1500 characters',
        long: '1500-2200 characters'
      };

      const prompt = this.buildPostPrompt(hook, companyProfile, {
        lengthGuide: lengthGuide[postLength],
        includeHashtags,
        includeEmojis,
        callToAction
      });

      logger.info('Generating LinkedIn post', {
        hookId: hook.id,
        companyId: companyProfile.id,
        postLength,
        model: this.defaultModel
      });

      const response = await this.openai.chat.completions.create({
        model: this.defaultModel,
        messages: [
          {
            role: 'system',
            content: 'You are an expert LinkedIn content creator who writes engaging, professional posts that drive meaningful business conversations.'
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

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new ApiError('No content generated from OpenAI', 500);
      }

      const result = JSON.parse(content);
      
      // Validate and enhance the result
      const enhancedResult = {
        ...result,
        metadata: {
          generated_at: new Date().toISOString(),
          model_used: this.defaultModel,
          tokens_used: response.usage?.total_tokens || 0,
          character_count: result.post?.length || 0,
          word_count: result.post?.split(/\s+/).length || 0,
          hashtag_count: (result.hashtags?.match(/#/g) || []).length,
          emoji_count: (result.post?.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length
        }
      };

      logger.info('LinkedIn post generated successfully', {
        hookId: hook.id,
        characterCount: enhancedResult.metadata.character_count,
        wordCount: enhancedResult.metadata.word_count
      });

      return enhancedResult;

    } catch (error) {
      logger.error('Failed to generate LinkedIn post', {
        error: error.message,
        hookId: hook.id
      });
      throw error;
    }
  }

  /**
   * Build the prompt for post generation
   */
  buildPostPrompt(hook, companyProfile, options) {
    const {
      company_name,
      industry,
      brand_voice,
      content_pillars,
      target_personas
    } = companyProfile;

    const {
      lengthGuide,
      includeHashtags,
      includeEmojis,
      callToAction
    } = options;

    const ctaTemplates = {
      engage: 'Ask a thought-provoking question that encourages comments',
      visit: `Include a soft call to visit ${company_name}'s website or solution`,
      contact: 'Invite readers to connect or reach out for more information',
      learn: 'Encourage readers to share their experiences or insights'
    };

    return `ROLE: You are ${company_name}'s LinkedIn content strategist.

### Company Context
- Company: ${company_name}
- Industry: ${industry}
- Brand Voice: ${brand_voice?.tone?.join(', ') || 'professional'}
- Keywords: ${brand_voice?.keywords?.join(', ') || ''}

### Content Pillar
${hook.pillar}

### Source Insight
"${hook.source_quote}"

### Hook to Expand
${hook.linkedin}

### Target Audience
${target_personas?.map(p => `- ${p.name}: ${p.pain_points?.join(', ')}`).join('\n')}

### Post Requirements
1. Length: ${lengthGuide}
2. Structure:
   - Opening hook (attention-grabbing first line)
   - Context/Story (expand on the insight)
   - Value proposition (what readers gain)
   - Call to action: ${ctaTemplates[callToAction]}
3. Style:
   ${includeEmojis ? '- Use 3-5 relevant emojis strategically' : '- No emojis'}
   ${includeHashtags ? '- Include 3-5 relevant hashtags at the end' : '- No hashtags'}
   - Use line breaks for readability
   - Write in first person plural (we/our) or second person (you)
4. Tone: ${brand_voice?.tone?.join(', ') || 'professional, engaging'}

### Output Format (JSON):
{
  "post": "The complete LinkedIn post with proper formatting",
  "hashtags": "${includeHashtags ? '#relevant #hashtags #here' : ''}",
  "first_comment": "Optional first comment to boost engagement (50-100 chars)",
  "variations": [
    {
      "type": "shorter",
      "content": "A shorter version of the post (if applicable)"
    }
  ]
}`;
  }

  /**
   * Generate multiple post variations
   */
  async generateVariations(hook, companyProfile, count = 3) {
    try {
      const variations = [];
      const lengths = ['short', 'medium', 'long'];
      const ctas = ['engage', 'visit', 'learn'];

      for (let i = 0; i < Math.min(count, 3); i++) {
        const variation = await this.generatePost(hook, companyProfile, {
          postLength: lengths[i],
          callToAction: ctas[i],
          includeHashtags: true,
          includeEmojis: i > 0 // First variation without emojis for formal option
        });

        variations.push({
          ...variation,
          variation_type: `${lengths[i]}_${ctas[i]}`
        });
      }

      return {
        hook_id: hook.id,
        variations,
        metadata: {
          total_variations: variations.length,
          generated_at: new Date().toISOString()
        }
      };

    } catch (error) {
      logger.error('Failed to generate post variations', {
        error: error.message,
        hookId: hook.id
      });
      throw error;
    }
  }

  /**
   * Enhance an existing post with better formatting
   */
  async enhancePost(postContent, companyProfile) {
    try {
      const prompt = `Enhance this LinkedIn post for ${companyProfile.company_name}:

Original Post:
"${postContent}"

Enhancement Requirements:
1. Improve line breaks and spacing for readability
2. Add 2-3 strategic emojis if missing
3. Ensure strong opening hook
4. Add relevant hashtags if missing (3-5)
5. Strengthen call-to-action
6. Maintain original message and length
7. Keep brand voice: ${companyProfile.brand_voice?.tone?.join(', ')}

Output Format (JSON):
{
  "enhanced_post": "The enhanced version",
  "changes_made": ["list", "of", "improvements"],
  "readability_score": 0.85
}`;

      const response = await this.openai.chat.completions.create({
        model: this.defaultModel,
        messages: [
          {
            role: 'system',
            content: 'You are an expert at optimizing LinkedIn posts for maximum engagement.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1500,
        temperature: 0.7,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      return {
        original: postContent,
        enhanced: result.enhanced_post,
        improvements: result.changes_made || [],
        metadata: {
          readability_score: result.readability_score || 0,
          enhanced_at: new Date().toISOString()
        }
      };

    } catch (error) {
      logger.error('Failed to enhance post', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate a content calendar from multiple hooks
   */
  async generateContentCalendar(hooks, companyProfile, options = {}) {
    const {
      postsPerWeek = 3,
      weeks = 2,
      startDate = new Date()
    } = options;

    try {
      const calendar = [];
      const totalPosts = postsPerWeek * weeks;
      const selectedHooks = hooks.slice(0, totalPosts);

      // Best posting times for LinkedIn (in UTC)
      const postingSlots = [
        { day: 'Tuesday', time: '10:00' },
        { day: 'Wednesday', time: '12:00' },
        { day: 'Thursday', time: '10:00' },
        { day: 'Tuesday', time: '17:00' },
        { day: 'Wednesday', time: '10:00' }
      ];

      for (let i = 0; i < selectedHooks.length; i++) {
        const hook = selectedHooks[i];
        const slot = postingSlots[i % postingSlots.length];
        
        // Calculate actual date
        const weekNumber = Math.floor(i / postsPerWeek);
        const scheduledDate = new Date(startDate);
        scheduledDate.setDate(scheduledDate.getDate() + (weekNumber * 7));

        // Generate post for this hook
        const post = await this.generatePost(hook, companyProfile, {
          postLength: i % 3 === 0 ? 'long' : 'medium',
          callToAction: i % 2 === 0 ? 'engage' : 'learn'
        });

        calendar.push({
          hook_id: hook.id,
          pillar: hook.pillar,
          scheduled_date: scheduledDate.toISOString(),
          scheduled_time: slot.time,
          day_of_week: slot.day,
          post_content: post.post,
          hashtags: post.hashtags,
          status: 'scheduled',
          week_number: weekNumber + 1
        });
      }

      return {
        calendar,
        metadata: {
          total_posts: calendar.length,
          weeks_covered: weeks,
          posts_per_week: postsPerWeek,
          start_date: startDate.toISOString(),
          pillars_covered: [...new Set(calendar.map(c => c.pillar))]
        }
      };

    } catch (error) {
      logger.error('Failed to generate content calendar', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate LinkedIn article from meeting insights
   */
  async generateArticle(hooks, companyProfile, title) {
    try {
      const topHooks = hooks
        .sort((a, b) => b.insight_score - a.insight_score)
        .slice(0, 5);

      const prompt = `Write a LinkedIn article for ${companyProfile.company_name} titled "${title}"

Key Insights to Include:
${topHooks.map((h, i) => `${i + 1}. ${h.pillar}: "${h.source_quote}"`).join('\n')}

Article Requirements:
1. Length: 800-1200 words
2. Structure:
   - Compelling introduction
   - 3-5 main sections with subheadings
   - Practical takeaways
   - Strong conclusion with CTA
3. Include all provided insights naturally
4. Brand voice: ${companyProfile.brand_voice?.tone?.join(', ')}
5. Target audience: ${companyProfile.target_personas?.map(p => p.name).join(', ')}

Output Format (JSON):
{
  "title": "Article title",
  "subtitle": "Article subtitle",
  "introduction": "Opening paragraph",
  "sections": [
    {
      "heading": "Section heading",
      "content": "Section content"
    }
  ],
  "conclusion": "Closing paragraph with CTA",
  "key_takeaways": ["takeaway1", "takeaway2"],
  "tags": ["tag1", "tag2"]
}`;

      const response = await this.openai.chat.completions.create({
        model: this.defaultModel,
        messages: [
          {
            role: 'system',
            content: 'You are an expert business writer creating thought leadership content for LinkedIn.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 3000,
        temperature: 0.7,
        response_format: { type: 'json_object' }
      });

      const article = JSON.parse(response.choices[0]?.message?.content || '{}');

      return {
        ...article,
        metadata: {
          hooks_used: topHooks.length,
          word_count: article.sections?.reduce((acc, s) => acc + s.content.split(/\s+/).length, 0) || 0,
          generated_at: new Date().toISOString()
        }
      };

    } catch (error) {
      logger.error('Failed to generate article', { error: error.message });
      throw error;
    }
  }

  /**
   * Test post generation with sample data
   */
  async testGeneration() {
    const sampleHook = {
      id: 'test-hook-1',
      pillar: 'Product Innovation',
      source_quote: 'Our bulk editing feature is saving clients an average of 4 hours per week on catalog management.',
      linkedin: 'Just discovered our bulk editing feature is transforming how sellers manage catalogs - 4 hours saved weekly per client. This isn\'t just about efficiency; it\'s about giving sellers their time back to focus on growth.',
      insight_score: 0.92
    };

    const sampleProfile = {
      id: 'test-company',
      company_name: 'TechCorp Solutions',
      industry: 'SaaS',
      brand_voice: {
        tone: ['professional', 'innovative', 'customer-focused'],
        keywords: ['efficiency', 'automation', 'growth', 'productivity']
      },
      content_pillars: [
        { title: 'Product Innovation', description: 'Latest features and updates' }
      ],
      target_personas: [
        {
          name: 'E-commerce Managers',
          pain_points: ['time management', 'catalog complexity', 'scaling operations']
        }
      ]
    };

    try {
      const result = await this.generatePost(sampleHook, sampleProfile, {
        postLength: 'medium',
        includeHashtags: true,
        includeEmojis: true,
        callToAction: 'engage'
      });

      logger.info('Test generation completed', {
        characterCount: result.metadata.character_count,
        wordCount: result.metadata.word_count
      });

      return result;
    } catch (error) {
      logger.error('Test generation failed', { error: error.message });
      throw error;
    }
  }
}

// Export singleton instance
export const linkedInPostGenerator = new LinkedInPostGenerator();