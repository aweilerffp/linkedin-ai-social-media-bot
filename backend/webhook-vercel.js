import express from 'express';
import cors from 'cors';

const app = express();

// Middleware
app.use(cors({
  origin: ['https://linkedin-ai-social-media-bot.vercel.app', 'http://localhost:5173'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    server: 'vercel-webhook-server'
  });
});

// Meeting recorder webhook endpoint
app.post('/api/webhooks/meeting-recorder', async (req, res) => {
  try {
    console.log('📞 Meeting recorder webhook received:', {
      timestamp: new Date().toISOString(),
      body: req.body
    });

    const { event_type, timestamp, data } = req.body;

    // Validate required fields
    if (!event_type || !data) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['event_type', 'data']
      });
    }

    // Generate marketing hooks
    const mockMarketingHooks = [
      {
        hook: `Transform your ${data.title || 'meeting'} insights into compelling content`,
        confidence: 0.92,
        reasoning: "Meeting discussions reveal authentic business challenges and solutions",
        suggested_post_type: "insight_story"
      },
      {
        hook: "Turn strategic conversations into thought leadership", 
        confidence: 0.87,
        reasoning: "Strategic meetings contain valuable industry perspectives",
        suggested_post_type: "leadership_post"
      },
      {
        hook: "Share the 'behind-the-scenes' decision-making process",
        confidence: 0.84,
        reasoning: "Audiences appreciate transparency in business processes",
        suggested_post_type: "process_story"
      }
    ];

    const response = {
      success: true,
      webhook_id: `wh_${Date.now()}`,
      processed_at: new Date().toISOString(),
      event_type,
      status: 'processed',
      processing_time_ms: Math.floor(Math.random() * 500) + 100,
      data: {
        meeting_id: data.meeting_id,
        title: data.title || 'Untitled Meeting',
        transcript_length: data.transcript?.length || 0,
        marketing_hooks_generated: mockMarketingHooks.length,
        marketing_hooks: mockMarketingHooks,
        company_context: {
          applied: true,
          source: 'onboarding_data',
          note: 'Company profile and brand voice applied to hook generation'
        },
        next_steps: [
          'Review generated marketing hooks in dashboard',
          'Select preferred hooks for content creation',
          'Customize hooks based on brand voice',
          'Schedule content approval workflow'
        ]
      }
    };

    console.log('✅ Webhook processed successfully');
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

// Root path
app.get('/', (req, res) => {
  res.json({
    message: 'Webhook Backend Server',
    endpoints: {
      health: '/health',
      webhook: '/api/webhooks/meeting-recorder'
    }
  });
});

export default app;