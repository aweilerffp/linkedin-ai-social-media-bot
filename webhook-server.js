#!/usr/bin/env node

import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;

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
    server: 'hetzner-webhook-server'
  });
});

// Meeting recorder webhook endpoint
app.post('/api/webhooks/meeting-recorder', async (req, res) => {
  try {
    console.log('📞 Meeting recorder webhook received:', {
      timestamp: new Date().toISOString(),
      headers: req.headers,
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

    // Mock response for now (since we don't have OpenAI configured)
    const mockMarketingHooks = [
      {
        hook: "Turn meeting insights into actionable business strategies",
        confidence: 0.9,
        reasoning: "Based on meeting transcript analysis"
      },
      {
        hook: "Transform collaboration into competitive advantage", 
        confidence: 0.8,
        reasoning: "Derived from team discussion patterns"
      }
    ];

    const response = {
      webhook_id: `wh_${Date.now()}`,
      processed_at: new Date().toISOString(),
      event_type,
      status: 'processed',
      data: {
        meeting_id: data.meeting_id,
        title: data.title,
        transcript_length: data.transcript?.length || 0,
        marketing_hooks: mockMarketingHooks,
        next_steps: [
          'Review generated marketing hooks',
          'Select hooks for content creation',
          'Schedule content approval workflow'
        ]
      }
    };

    console.log('✅ Webhook processed successfully:', response);
    
    res.json(response);

  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Catch-all for webhook paths
app.all('/api/webhooks/*', (req, res) => {
  res.status(404).json({
    error: 'Webhook endpoint not found',
    available_endpoints: ['/api/webhooks/meeting-recorder'],
    method: req.method,
    path: req.path
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  const serverUrl = `http://5.78.46.19:${PORT}`;
  console.log(`🚀 Webhook server running on ${serverUrl}`);
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