#!/usr/bin/env node

/**
 * Test script for the meeting recorder webhook
 * 
 * Usage: node webhook-test.js [webhook-url]
 * Default URL: http://localhost:3001/api/webhooks/meeting-recorder
 */

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// Sample meeting transcript for testing
const sampleMeetingData = {
  event_type: "meeting.completed",
  timestamp: new Date().toISOString(),
  data: {
    meeting_id: "test_meeting_" + Date.now(),
    title: "Weekly Product Strategy Meeting",
    transcript: `Product Manager: Good morning everyone. Let's dive into our Q4 product roadmap discussion. I've been analyzing our user feedback and I'm seeing some interesting patterns.

Sales Director: Before we start, I wanted to share some insights from last week's client calls. Three different prospects mentioned they're struggling with data integration across their existing tools.

Engineering Lead: That's actually perfect timing. We've been working on our API connectivity framework and it's almost ready for beta testing. The early results show we can reduce integration time from weeks to days.

Product Manager: That's a game-changer. What we're seeing is that 78% of our users spend more than 10 hours per week on manual data transfers. If we can automate that...

Sales Director: The ROI calculation becomes really compelling. One client told me they have two full-time employees just managing data between systems.

Customer Success: I can confirm that. Our support tickets around data sync issues have increased 40% over the last quarter. But when clients get it working, their engagement scores jump significantly.

Engineering Lead: Here's what's exciting - our new integration hub can connect to over 200 popular business tools out of the box. And we're using AI to suggest optimal data flow patterns.

Product Manager: This positions us perfectly for the enterprise market push. We should definitely prioritize this for the October release.

Sales Director: Agreed. I have three enterprise deals in the pipeline that are specifically waiting for better integration capabilities.

Customer Success: From a user experience perspective, we should also focus on the onboarding flow. The current setup process is too complex for non-technical users.

Product Manager: Great point. Let's make sure we build a guided setup wizard that can configure common integrations in under 5 minutes.

Engineering Lead: I'll work on that. We can use smart defaults based on the user's industry and company size.

Product Manager: Perfect. So our key priorities for Q4 are: 1) Launch the integration hub, 2) Streamline onboarding, and 3) Target enterprise clients. This could really accelerate our growth trajectory.`,
    duration: 1800, // 30 minutes
    participants: [
      "sarah.product@company.com",
      "mike.sales@company.com", 
      "alex.engineering@company.com",
      "lisa.success@company.com"
    ],
    recording_url: "https://example-recorder.com/recording/123"
  }
};

async function testWebhook(webhookUrl = 'http://localhost:3001/api/webhooks/meeting-recorder') {
  console.log('🎯 Testing Meeting Recorder Webhook');
  console.log('📍 Target URL:', webhookUrl);
  console.log('📝 Sample meeting data prepared');
  console.log('');

  try {
    console.log('🚀 Sending webhook request...');
    
    const startTime = Date.now();
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Company-ID': 'test-company-123'
      },
      body: JSON.stringify(sampleMeetingData)
    });

    const processingTime = Date.now() - startTime;
    const responseData = await response.json();

    console.log('📊 Response Status:', response.status);
    console.log('⏱️  Processing Time:', processingTime + 'ms');
    console.log('');

    if (response.ok) {
      console.log('✅ Webhook processed successfully!');
      console.log('📈 Marketing Hooks Generated:', responseData.data.hooks_generated);
      console.log('🤖 AI Processing Time:', responseData.data.processing_time + 'ms');
      console.log('');

      if (responseData.data.marketing_hooks && responseData.data.marketing_hooks.length > 0) {
        console.log('🎨 Sample Marketing Hooks:');
        console.log('================================');
        
        responseData.data.marketing_hooks.slice(0, 3).forEach((hook, index) => {
          console.log(`\n${index + 1}. ${hook.pillar || hook.type?.toUpperCase()}`);
          console.log(`   LinkedIn: ${hook.linkedin || hook.hook}`);
          if (hook.blog && hook.blog.title) {
            console.log(`   Blog: ${hook.blog.title}`);
          }
          if (hook.tweet) {
            console.log(`   Tweet: ${hook.tweet}`);
          }
        });
      }

      console.log('\n📋 Full Response:');
      console.log(JSON.stringify(responseData, null, 2));

    } else {
      console.log('❌ Webhook failed with status:', response.status);
      console.log('📋 Error Response:');
      console.log(JSON.stringify(responseData, null, 2));
    }

  } catch (error) {
    console.log('💥 Request failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('🔧 Make sure the backend server is running on port 3001');
      console.log('   Try: cd backend && npm start');
    }
  }
}

// Get webhook URL from command line argument or use default
const webhookUrl = process.argv[2];
testWebhook(webhookUrl);