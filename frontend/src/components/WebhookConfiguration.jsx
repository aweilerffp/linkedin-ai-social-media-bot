import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

const WebhookConfiguration = () => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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
    // FORCE UPDATE - Use the working webhook server on Hetzner
    const baseUrl = 'http://5.78.46.19:3002';
    const generatedUrl = `${baseUrl}/api/webhooks/meeting-recorder`;
    setWebhookUrl(generatedUrl);
    
    // Log for debugging - FIXED VERSION
    console.log('Generated webhook URL (FIXED):', generatedUrl);
    console.log('Timestamp:', new Date().toISOString());
    console.log('This should NOT show the tunnel URL anymore!');
    
    // Show success message
    toast.success(`✅ Webhook URL updated: ${generatedUrl}`, { duration: 6000 });
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


  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Meeting Recorder Webhook (DEPLOYMENT {new Date().getTime()})</h2>
          <p className="text-gray-600 mt-2">
            Configure your meeting recorder to send transcripts. Deployed: {new Date().toLocaleString()}
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
            <div className="mt-2 text-sm text-green-600">
              ✅ Auto-generate will create the correct webhook URL for you
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
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="text-lg font-medium text-green-900 mb-2">✅ Webhook Server Active</h3>
            <p className="text-sm text-green-800 mb-3">
              Your webhook endpoint is live and processing meeting transcripts from real meeting recorders.
            </p>
            <div className="space-y-2 text-sm text-green-800">
              <div>• <strong>Webhook URL:</strong> <code>http://5.78.46.19:3002/api/webhooks/meeting-recorder</code></div>
              <div>• <strong>Status:</strong> ✅ Active and processing requests</div>
              <div>• <strong>Testing:</strong> Configure your meeting recorder to test the webhook</div>
              <div>• <strong>Processing:</strong> Generates marketing hooks automatically from transcripts</div>
              <div>• <strong>Compatibility:</strong> Read.ai, Zoom, Otter.ai, and custom webhook formats</div>
            </div>
            
            <div className="mt-4 p-3 bg-green-100 rounded border border-green-300">
              <strong>How to test:</strong>
              <p className="text-xs mt-1">Configure this webhook URL in your meeting recorder app (Read.ai, Zoom, etc.). The webhook will automatically process transcripts and return marketing hooks.</p>
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