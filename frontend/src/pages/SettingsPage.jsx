import { useState } from 'react';
import OnboardingFlow from './OnboardingFlow';
import WebhookConfiguration from '../components/WebhookConfiguration';

function SettingsPage() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [activeTab, setActiveTab] = useState('company');

  if (showOnboarding) {
    return <OnboardingFlow />;
  }

  const tabs = [
    { id: 'company', name: 'Company Setup', icon: '🏢' },
    { id: 'webhooks', name: 'Meeting Recorder', icon: '🎤' },
    { id: 'platforms', name: 'Platforms', icon: '🔗' },
    { id: 'team', name: 'Team', icon: '👥' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Settings</h1>
          
          {/* Tabs */}
          <div className="flex space-x-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'company' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-2">Company Setup</h2>
                <p className="text-gray-600 mb-4">Configure your company information and connect social media platforms</p>
                
                <div className="space-x-4">
                  <button
                    onClick={() => setShowOnboarding(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Run Company Setup
                  </button>
                  
                  <button
                    onClick={() => {
                      localStorage.removeItem('onboarding_complete');
                      localStorage.removeItem('company_data');
                      localStorage.removeItem('connected_platforms');
                      window.location.reload();
                    }}
                    className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Reset Onboarding (for testing)
                  </button>
                </div>
                
                {/* Show current company data if available */}
                {localStorage.getItem('company_data') && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-medium mb-2">Current Company Data:</h3>
                    <pre className="text-sm text-gray-600">
                      {JSON.stringify(JSON.parse(localStorage.getItem('company_data')), null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'webhooks' && (
            <WebhookConfiguration />
          )}

          {activeTab === 'platforms' && (
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-2">Platform Connections</h2>
              <p className="text-gray-600">Manage your social media platform connections coming soon...</p>
            </div>
          )}

          {activeTab === 'team' && (
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-2">Team Management</h2>
              <p className="text-gray-600">Invite and manage team members coming soon...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;