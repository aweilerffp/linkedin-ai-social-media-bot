#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize OpenAI client for real AI processing
let openai = null;
let aiEnabled = false;

try {
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    aiEnabled = true;
    console.log('✅ OpenAI API integration enabled');
  } else {
    console.log('⚠️  OPENAI_API_KEY not found, using mock marketing hooks');
  }
} catch (error) {
  console.log('⚠️  OpenAI initialization failed, using mock marketing hooks:', error.message);
}

// AI Marketing Hook Generator class
class SimpleMarketingHookGenerator {
  constructor(openaiClient) {
    this.openai = openaiClient;
    this.defaultModel = process.env.OPENAI_MODEL || 'gpt-4';
    this.maxTokens = 4000;
    this.temperature = 0.7;
  }

  async generateMarketingHooks(transcriptData, companyProfile) {
    if (!this.openai) {
      return this.generateMockHooks(transcriptData, companyProfile);
    }

    try {
      const startTime = Date.now();
      
      // Generate company-specific prompt
      const prompt = this.buildPrompt(transcriptData, companyProfile);
      
      console.log('🤖 Generating marketing hooks with AI...', {
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
        throw new Error('No content generated from OpenAI');
      }

      // Parse and validate JSON response
      let insights;
      try {
        insights = JSON.parse(content);
      } catch (parseError) {
        console.error('Failed to parse OpenAI response as JSON:', parseError.message);
        return this.generateMockHooks(transcriptData, companyProfile);
      }

      // Validate response structure
      if (!insights.insights || !Array.isArray(insights.insights)) {
        console.error('Invalid insights structure in AI response');
        return this.generateMockHooks(transcriptData, companyProfile);
      }

      // Validate and clean insights
      const validatedInsights = insights.insights
        .filter(insight => this.validateInsight(insight))
        .slice(0, 10); // Limit to 10 insights

      console.log('✅ AI marketing hooks generated:', {
        insightsCount: validatedInsights.length,
        processingTimeMs: processingTime,
        tokensUsed: response.usage?.total_tokens
      });

      return {
        insights: validatedInsights,
        metadata: {
          ...insights.metadata,
          total_insights: validatedInsights.length,
          processing_time_ms: processingTime,
          model_used: this.defaultModel,
          tokens_used: response.usage?.total_tokens || 0,
          generation_timestamp: new Date().toISOString(),
          source: 'openai_api'
        }
      };

    } catch (error) {
      console.error('AI hook generation failed:', error.message);
      return this.generateMockHooks(transcriptData, companyProfile);
    }
  }

  buildPrompt(transcriptData, companyProfile) {
    const {
      company_name: companyName,
      industry,
      brand_voice,
      content_pillars,
      target_personas,
      evaluation_questions
    } = companyProfile;

    return `ROLE: You are ${companyName}'s senior content strategist.

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
- Date: ${transcriptData.meeting_date || new Date().toISOString().split('T')[0]}
- Type: ${transcriptData.metadata?.meeting_type || 'Meeting'}
- Goal: ${transcriptData.metadata?.meeting_goal || 'Team discussion'}

### Evaluation Questions
${evaluation_questions.map((q, i) => `${i + 1}. "${q}"`).join('\n')}

### Transcript
"""
${transcriptData.transcript_content}
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
  }

  validateInsight(insight) {
    const required = ['pillar', 'source_quote', 'linkedin', 'blog', 'tweet'];
    const hasRequired = required.every(field => insight[field]);
    
    if (!hasRequired) return false;

    // Validate LinkedIn hook length (150 words max)
    const wordCount = insight.linkedin.split(/\s+/).length;
    if (wordCount > 150) return false;

    // Validate tweet length (280 chars max)  
    if (insight.tweet.length > 280) return false;

    // Validate blog structure
    if (!insight.blog.title || !insight.blog.hook) return false;

    return true;
  }

  generateMockHooks(transcriptData, companyProfile) {
    const mockInsights = [
      {
        pillar: companyProfile.content_pillars[0]?.title || "Team Collaboration",
        source_quote: transcriptData.transcript_content?.substring(0, 100) + "..." || "Meeting discussion about team efficiency",
        insight_score: 0.92,
        blog: {
          title: `Transform your ${transcriptData.metadata?.meeting_type || 'meeting'} insights into compelling content`,
          hook: "Meeting discussions reveal authentic business challenges and solutions that resonate with audiences"
        },
        linkedin: `Transform your ${transcriptData.metadata?.meeting_type || 'meeting'} insights into compelling content. Meeting discussions reveal authentic business challenges and solutions that teams face every day. What insights from your team meetings could become valuable content for your audience?`,
        tweet: `Turn strategic conversations into thought leadership content. Your team meetings contain valuable insights that could help others in your industry. #BusinessInsights`
      },
      {
        pillar: companyProfile.content_pillars[1]?.title || "Business Strategy",
        source_quote: "Strategic meetings contain valuable industry perspectives and decision-making processes",
        insight_score: 0.87,
        blog: {
          title: "Turn strategic conversations into thought leadership",
          hook: "Behind-the-scenes decision-making processes offer unique value to business communities"
        },
        linkedin: "Turn strategic conversations into thought leadership. Strategic meetings contain valuable industry perspectives that your audience wants to learn from. Share the 'behind-the-scenes' decision-making process that could help other business leaders navigate similar challenges. What strategic insights from your meetings could benefit your network?",
        tweet: "Share the 'behind-the-scenes' decision-making process from your team meetings. Audiences appreciate transparency in business processes. #Leadership"
      },
      {
        pillar: companyProfile.content_pillars[2]?.title || "Process Optimization",
        source_quote: "Process improvements and efficiency gains discussed in team meetings",
        insight_score: 0.84,
        blog: {
          title: "Share the 'behind-the-scenes' decision-making process",
          hook: "Transparency in business processes builds trust and provides educational value"
        },
        linkedin: "Share the 'behind-the-scenes' decision-making process that leads to business improvements. Audiences appreciate transparency in how decisions are made and processes are optimized. What process improvements from your recent meetings could help others in your industry work more efficiently?",
        tweet: "Audiences appreciate transparency in business processes. Share how your team makes decisions and optimizes workflows. #ProcessImprovement"
      }
    ];

    return {
      insights: mockInsights,
      metadata: {
        total_insights: mockInsights.length,
        processing_time_ms: Math.floor(Math.random() * 500) + 100,
        model_used: 'mock_generator',
        generation_timestamp: new Date().toISOString(),
        source: 'mock_data',
        processing_notes: 'Generated using mock data due to AI unavailability'
      }
    };
  }
}

// Initialize the AI generator
const aiGenerator = aiEnabled ? new SimpleMarketingHookGenerator(openai) : new SimpleMarketingHookGenerator(null);

// Company profile function - in production this would query database
function getCompanyProfile(companyId = 'default') {
  // Simulate different company profiles based on industry
  const profiles = {
    'ecommerce': {
      id: companyId,
      company_name: 'FlatFilePro',
      industry: 'ecommerce',
      brand_voice: {
        tone: ['confident', 'practical', 'solution-focused'],
        keywords: ['Amazon', 'listings', 'catalog', 'ASIN', 'optimization', 'seller tools'],
        prohibited_terms: ['revolutionary', 'game-changing', 'paradigm shift']
      },
      content_pillars: [
        {
          title: 'Amazon listing management & optimization',
          description: 'Tools and techniques for better product listings'
        },
        {
          title: 'Catalog efficiency & seller operations',
          description: 'Streamlining e-commerce operations'
        },
        {
          title: 'Marketplace compliance & best practices',
          description: 'Staying compliant with platform policies'
        }
      ],
      target_personas: [
        {
          name: 'Amazon Sellers',
          pain_points: ['time-consuming manual updates', 'listing errors', 'account suspensions', 'inventory management'],
          emotions: ['frustration', 'relief', 'confidence', 'efficiency']
        },
        {
          name: 'E-commerce Managers',
          pain_points: ['scaling operations', 'data accuracy', 'team coordination'],
          emotions: ['responsibility', 'achievement', 'growth']
        }
      ],
      evaluation_questions: [
        'What specific problem does this solve for Amazon sellers?',
        'How does this save time or reduce errors?',
        'What competitive advantage does this provide?',
        'How does this integrate with Amazon\'s platform?',
        'What ROI can sellers expect from this insight?'
      ]
    },
    'saas': {
      id: companyId,
      company_name: 'TeamSync Pro',
      industry: 'saas',
      brand_voice: {
        tone: ['innovative', 'collaborative', 'data-driven'],
        keywords: ['productivity', 'automation', 'integration', 'workflow', 'efficiency'],
        prohibited_terms: ['disruptive', 'revolutionary', 'groundbreaking']
      },
      content_pillars: [
        {
          title: 'Team productivity & collaboration',
          description: 'Tools and strategies for better team performance'
        },
        {
          title: 'Workflow automation & efficiency',
          description: 'Streamlining business processes'
        },
        {
          title: 'Data-driven decision making',
          description: 'Using analytics to guide business strategy'
        }
      ],
      target_personas: [
        {
          name: 'Team Leaders',
          pain_points: ['team coordination', 'project tracking', 'communication gaps'],
          emotions: ['responsibility', 'achievement', 'collaboration']
        },
        {
          name: 'Operations Managers',
          pain_points: ['process inefficiencies', 'data silos', 'scalability'],
          emotions: ['optimization', 'growth', 'control']
        }
      ],
      evaluation_questions: [
        'How does this improve team collaboration?',
        'What measurable impact could this have on productivity?',
        'How can teams implement this insight immediately?',
        'What barriers might prevent adoption?',
        'How does this scale across different team sizes?'
      ]
    }
  };

  // Default to a general business profile if no specific industry match
  return profiles[companyId] || profiles['saas'] || {
    id: companyId,
    company_name: 'Business Insights Co',
    industry: 'Technology',
    brand_voice: {
      tone: ['professional', 'informative', 'helpful'],
      keywords: ['business', 'strategy', 'efficiency', 'growth', 'innovation'],
      prohibited_terms: ['revolutionary', 'disruptive', 'game-changing']
    },
    content_pillars: [
      {
        title: 'Business Strategy & Growth',
        description: 'Strategic insights for business development'
      },
      {
        title: 'Team Collaboration & Leadership',
        description: 'Building effective teams and leadership practices'
      },
      {
        title: 'Process Optimization & Efficiency',
        description: 'Improving business operations and workflows'
      }
    ],
    target_personas: [
      {
        name: 'Business Leaders',
        pain_points: ['strategic planning', 'team alignment', 'growth challenges'],
        emotions: ['ambition', 'responsibility', 'confidence']
      }
    ],
    evaluation_questions: [
      'What specific business problem does this address?',
      'How can this insight drive measurable results?',
      'What implementation challenges should be considered?',
      'How does this align with business objectives?'
    ]
  };
}

const app = express();
const PORT = 3002; // Use different port

// Middleware
app.use(cors({
  origin: true, // Allow all origins for testing
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    server: 'simple-webhook-server',
    port: PORT
  });
});

// Meeting recorder webhook endpoint
app.post('/api/webhooks/meeting-recorder', async (req, res) => {
  try {
    console.log('📞 Meeting recorder webhook received:', {
      timestamp: new Date().toISOString(),
      headers: {
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent'],
        origin: req.headers.origin
      },
      body: req.body
    });

    const { event_type, timestamp, data, session_id, trigger, title, transcript } = req.body;

    // Handle different webhook formats
    let meetingData;
    if (event_type && data) {
      // Frontend test format
      meetingData = data;
    } else if (session_id && trigger) {
      // Read.ai format
      meetingData = {
        meeting_id: session_id,
        title: title || 'Meeting',
        transcript: transcript,
        trigger: trigger
      };
    } else {
      return res.status(400).json({
        error: 'Missing required fields',
        required: 'Either (event_type + data) or (session_id + trigger)',
        received: Object.keys(req.body)
      });
    }

    // Get company profile from header or use default
    const companyId = req.headers['x-company-id'] || 'saas';
    const companyProfile = getCompanyProfile(companyId);
    
    console.log('🏢 Using company profile:', {
      company_name: companyProfile.company_name,
      industry: companyProfile.industry,
      pillars: companyProfile.content_pillars.length
    });

    // Extract transcript content from meeting data
    let transcriptContent = '';
    
    if (meetingData.transcript) {
      // Handle Read.ai format with speaker blocks
      if (meetingData.transcript.speaker_blocks) {
        transcriptContent = meetingData.transcript.speaker_blocks
          .map(block => `${block.speaker}: ${block.text}`)
          .join('\n\n');
      } else if (typeof meetingData.transcript === 'string') {
        transcriptContent = meetingData.transcript;
      }
    } else if (typeof meetingData.transcript === 'string') {
      transcriptContent = meetingData.transcript;
    }

    // Fallback if no transcript found
    if (!transcriptContent) {
      transcriptContent = meetingData.summary || 
                         meetingData.title || 
                         'Meeting discussion content not available';
    }

    // Format transcript data for AI processing
    const transcriptData = {
      id: meetingData.meeting_id,
      transcript_content: transcriptContent,
      meeting_date: new Date().toISOString().split('T')[0],
      metadata: {
        meeting_type: meetingData.title || 'Meeting',
        meeting_goal: 'Extract marketing insights from team discussion',
        duration: meetingData.duration,
        participants: meetingData.participants
      }
    };

    console.log('📝 Processing transcript:', {
      meeting_id: transcriptData.id,
      transcript_length: transcriptContent.length,
      company: companyProfile.company_name
    });

    // Generate marketing hooks using AI
    const aiResult = await aiGenerator.generateMarketingHooks(transcriptData, companyProfile);

    const response = {
      success: true,
      webhook_id: `wh_${Date.now()}`,
      processed_at: new Date().toISOString(),
      event_type: event_type || trigger,
      status: 'processed',
      processing_time_ms: aiResult.metadata.processing_time_ms,
      data: {
        meeting_id: meetingData.meeting_id,
        title: meetingData.title || 'Untitled Meeting',
        transcript_length: transcriptContent.length,
        transcript_preview: transcriptContent.substring(0, 150) + '...',
        marketing_hooks_generated: aiResult.insights.length,
        marketing_hooks: aiResult.insights,
        company_context: {
          applied: true,
          company_name: companyProfile.company_name,
          industry: companyProfile.industry,
          source: aiResult.metadata.source || 'company_profile',
          pillars_used: companyProfile.content_pillars.map(p => p.title),
          note: `Company profile and brand voice applied to hook generation using ${aiResult.metadata.model_used || 'AI processing'}`
        },
        ai_metadata: {
          model_used: aiResult.metadata.model_used,
          tokens_used: aiResult.metadata.tokens_used,
          processing_source: aiResult.metadata.source,
          confidence_scores: aiResult.insights.map(i => i.insight_score || 0.85),
          pillars_covered: [...new Set(aiResult.insights.map(i => i.pillar))],
          generation_timestamp: aiResult.metadata.generation_timestamp
        },
        next_steps: [
          'Review generated marketing hooks in dashboard',
          'Select preferred hooks for content creation',
          'Customize hooks based on brand voice',
          'Schedule content approval workflow',
          'Track performance of published content'
        ]
      }
    };

    console.log('✅ Webhook processed successfully:', {
      meeting_id: meetingData.meeting_id,
      hooks_generated: aiResult.insights.length,
      processing_time: response.processing_time_ms + 'ms',
      company: companyProfile.company_name,
      ai_source: aiResult.metadata.source
    });
    
    res.json(response);

  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Catch-all for other webhook paths
app.all('/api/webhooks/*', (req, res) => {
  res.status(404).json({
    error: 'Webhook endpoint not found',
    available_endpoints: ['/api/webhooks/meeting-recorder'],
    method: req.method,
    path: req.path
  });
});

// Root path
app.get('/', (req, res) => {
  res.json({
    message: 'Simple Webhook Server',
    endpoints: {
      health: '/health',
      webhook: '/api/webhooks/meeting-recorder'
    },
    server_ip: '5.78.46.19',
    port: PORT
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  const serverUrl = `http://5.78.46.19:${PORT}`;
  console.log(`🚀 Simple Webhook server running on ${serverUrl}`);
  console.log(`📋 Health check: ${serverUrl}/health`);  
  console.log(`🎤 Meeting webhook: ${serverUrl}/api/webhooks/meeting-recorder`);
  console.log(`⚡ Ready to receive webhooks!`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  process.exit(0);
});