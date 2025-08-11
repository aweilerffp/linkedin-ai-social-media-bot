#!/usr/bin/env node

import express from 'express';
import cors from 'cors';

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

    // Mock processing with realistic marketing hooks
    const mockMarketingHooks = [
      {
        hook: `Transform your ${meetingData.title || 'meeting'} insights into compelling content`,
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
      event_type: event_type || trigger,
      status: 'processed',
      processing_time_ms: Math.floor(Math.random() * 500) + 100,
      data: {
        meeting_id: meetingData.meeting_id,
        title: meetingData.title || 'Untitled Meeting',
        transcript_length: meetingData.transcript?.length || 0,
        transcript_preview: meetingData.transcript?.substring ? 
          meetingData.transcript.substring(0, 100) + '...' : 
          'Transcript available',
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

    console.log('✅ Webhook processed successfully:', {
      meeting_id: meetingData.meeting_id,
      hooks_generated: mockMarketingHooks.length,
      processing_time: response.processing_time_ms + 'ms'
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