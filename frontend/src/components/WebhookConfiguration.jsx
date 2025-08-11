import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

const WebhookConfiguration = () => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookEvents, setWebhookEvents] = useState([]);

  useEffect(() => {
    loadWebhookConfiguration();
    loadWebhookEvents();
  }, []);

  const loadWebhookConfiguration = async () => {
    try {
      // Check if we have stored webhook config
      const savedConfig = localStorage.getItem('webhook_config');
      if (savedConfig) {
        const config = JSON.parse(savedConfig);
        setWebhookUrl(config.webhook_url || '');
        setIsEnabled(config.enabled || false);
      }
    } catch (error) {
      console.error('Error loading webhook configuration:', error);
    }
  };

  const loadWebhookEvents = () => {
    // Load recent webhook events from localStorage for demo
    const events = JSON.parse(localStorage.getItem('webhook_events') || '[]');
    setWebhookEvents(events.slice(0, 5)); // Show last 5 events
  };

  const generateWebhookUrl = () => {
    // Use HTTPS Vercel backend for frontend testing (avoids HTTPS→HTTP mixed content issues)
    // Use HTTP Hetzner server for actual meeting recorder services
    const currentHost = window.location.host;
    
    let baseUrl;
    if (currentHost.includes('vercel.app') || currentHost.includes('localhost:5173')) {
      // For frontend testing from HTTPS, use Vercel backend
      baseUrl = 'https://linkedin-ai-social-media-bot-backend.vercel.app';
    } else {
      // For meeting recorder services, use Hetzner server
      baseUrl = 'http://5.78.46.19:3002';
    }
    
    const generatedUrl = `${baseUrl}/api/webhooks/meeting-recorder`;
    setWebhookUrl(generatedUrl);
    
    // Log for debugging
    console.log('Generated webhook URL:', generatedUrl);
  };

  const saveWebhookConfiguration = async () => {
    setIsSaving(true);
    try {
      const config = {
        webhook_url: webhookUrl,
        enabled: isEnabled,
        updated_at: new Date().toISOString()
      };

      // In a real app, this would save to the backend
      localStorage.setItem('webhook_config', JSON.stringify(config));
      
      // Also save to backend API (when available)
      // await apiClient.post('/api/settings/webhooks', config);
      
      toast.success('Webhook configuration saved successfully!');
    } catch (error) {
      toast.error('Failed to save webhook configuration');
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const testWebhook = async () => {
    if (!webhookUrl) {
      toast.error('Please enter a webhook URL first');
      return;
    }

    setTestingWebhook(true);
    try {
      // Create test payload
      const testPayload = {
        event_type: 'meeting.completed',
        timestamp: new Date().toISOString(),
        data: {
          meeting_id: 'test_' + Date.now(),
          transcript: 'This is a test transcript from the meeting recorder webhook. We discussed our new product features and how to improve user engagement through better onboarding experiences.',
          duration: 1800, // 30 minutes
          participants: ['test@example.com'],
          title: 'Test Meeting - Product Strategy'
        }
      };

      console.log('Testing webhook:', webhookUrl, testPayload);

      // Make actual API call to test the webhook
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload)
      });

      let responseData;
      const responseText = await response.text();
      
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        responseData = { message: responseText };
      }

      console.log('Webhook response:', response.status, responseData);

      // Add test event to local events
      const newEvent = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        event_type: 'meeting.completed',
        status: response.ok ? 'success' : 'failed',
        test: true,
        response_status: response.status,
        response_data: responseData
      };

      const events = JSON.parse(localStorage.getItem('webhook_events') || '[]');
      events.unshift(newEvent);
      localStorage.setItem('webhook_events', JSON.stringify(events.slice(0, 10)));
      loadWebhookEvents();

      if (response.ok) {
        toast.success(`Webhook test successful! Generated ${responseData?.data?.marketing_hooks?.length || 0} marketing hooks.`);
      } else {
        toast.error(`Webhook test failed: ${responseData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Test error:', error);
      
      // Add failed event to local events
      const newEvent = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        event_type: 'meeting.completed',
        status: 'failed',
        test: true,
        error: error.message
      };

      const events = JSON.parse(localStorage.getItem('webhook_events') || '[]');
      events.unshift(newEvent);
      localStorage.setItem('webhook_events', JSON.stringify(events.slice(0, 10)));
      loadWebhookEvents();

      toast.error(`Webhook test failed: ${error.message}`);
    } finally {
      setTestingWebhook(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Meeting Recorder Webhook</h2>
          <p className="text-gray-600 mt-2">
            Configure your meeting recorder to send transcripts to this webhook endpoint. Test button is now enabled!
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Webhook URL Configuration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Webhook URL
            </label>
            <div className="flex gap-3">
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://your-backend-domain.com/api/webhooks/meeting-recorder"
              />
              <button
                onClick={generateWebhookUrl}
                className="px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
              >
                Auto-Generate
              </button>
            </div>
            <div className="mt-2 text-sm text-orange-600">
              ⚠️ Please update this URL to point to your deployed backend API endpoint
            </div>
            <p className="text-sm text-gray-500 mt-2">
              This is the URL your meeting recorder should POST transcript data to
            </p>
          </div>

          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Enable Webhook</h3>
              <p className="text-sm text-gray-600">
                Allow your meeting recorder to send transcripts to this endpoint
              </p>
            </div>
            <button
              onClick={() => setIsEnabled(!isEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isEnabled ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Backend Deployment Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-lg font-medium text-blue-900 mb-2">🚀 Dual Webhook Setup</h3>
            <p className="text-sm text-blue-800 mb-3">
              This app uses two webhook endpoints for optimal compatibility:
            </p>
            <div className="space-y-2 text-sm text-blue-800">
              <div>• <strong>Frontend Testing:</strong> Uses HTTPS Vercel backend (avoids mixed content issues)</div>
              <div>• <strong>Meeting Recorders:</strong> Use HTTP Hetzner server at <code>http://5.78.46.19:3002/api/webhooks/meeting-recorder</code></div>
              <div>• <strong>Auto-Generate:</strong> Automatically selects the right endpoint based on your current location</div>
            </div>
          </div>

          {/* Expected Payload Format */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Expected Payload Format</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <pre className="text-sm text-gray-800 overflow-x-auto">
{`{
  "event_type": "meeting.completed",
  "timestamp": "2025-08-11T21:00:00Z",
  "data": {
    "meeting_id": "meeting_123",
    "transcript": "Full meeting transcript here...",
    "title": "Weekly Team Meeting",
    "duration": 3600,
    "participants": ["user1@company.com", "user2@company.com"],
    "recording_url": "https://recorder.com/recording/123"
  }
}`}
              </pre>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-6 border-t border-gray-200">
            <button
              onClick={saveWebhookConfiguration}
              disabled={isSaving || !webhookUrl}
              className={`px-6 py-2 rounded-md font-medium ${
                isSaving || !webhookUrl
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isSaving ? 'Saving...' : 'Save Configuration'}
            </button>
            
            <button
              onClick={testWebhook}
              disabled={testingWebhook || !webhookUrl}
              className={`px-6 py-2 rounded-md font-medium border ${
                testingWebhook || !webhookUrl
                  ? 'border-gray-300 text-gray-500 cursor-not-allowed'
                  : 'border-green-300 text-green-700 hover:bg-green-50'
              }`}
            >
              {testingWebhook ? 'Testing...' : 'Test Webhook'}
            </button>
          </div>
        </div>

        {/* Recent Webhook Events */}
        {webhookEvents.length > 0 && (
          <div className="p-6 border-t border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Webhook Events</h3>
            <div className="space-y-3">
              {webhookEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        event.status === 'success' ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {event.event_type}
                        {event.test && (
                          <span className="ml-2 px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                            TEST
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(event.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`text-sm font-medium ${
                      event.status === 'success' ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {event.status === 'success' ? 'SUCCESS' : 'FAILED'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WebhookConfiguration;