import { useState } from 'react';
import { useAuth } from '../hooks/useAuthFixed';

const STEPS = {
  COMPANY_INFO: 'company_info',
  CONNECT_PLATFORMS: 'connect_platforms',
  COMPLETE: 'complete'
};

function OnboardingFlow() {
  const { user, logout } = useAuth();
  const [currentStep, setCurrentStep] = useState(STEPS.COMPANY_INFO);
  const [companyData, setCompanyData] = useState({
    companyName: '',
    industry: '',
    website: '',
    description: '',
    teamSize: ''
  });
  const [connectedPlatforms, setConnectedPlatforms] = useState([]);

  const handleCompanySubmit = (e) => {
    e.preventDefault();
    // In a real app, this would save to backend
    console.log('Company data:', companyData);
    setCurrentStep(STEPS.CONNECT_PLATFORMS);
  };

  const handlePlatformConnect = (platform) => {
    // In a real app, this would initiate OAuth flow
    setConnectedPlatforms([...connectedPlatforms, platform]);
  };

  const handleSkipPlatforms = () => {
    setCurrentStep(STEPS.COMPLETE);
  };

  const handleComplete = () => {
    // Mark onboarding as complete
    localStorage.setItem('onboarding_complete', 'true');
    localStorage.setItem('company_data', JSON.stringify(companyData));
    localStorage.setItem('connected_platforms', JSON.stringify(connectedPlatforms));
    
    // In a real app, this would save to backend via API
    console.log('Onboarding completed:', { companyData, connectedPlatforms });
    
    // Reload to trigger app state change
    window.location.reload();
  };

  const renderCompanyInfo = () => (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Social Media Poster!</h1>
        <p className="text-gray-600">Let's get your company set up in just a few steps</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-6">Company Information</h2>
        
        <form onSubmit={handleCompanySubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Company Name *
            </label>
            <input
              type="text"
              required
              value={companyData.companyName}
              onChange={(e) => setCompanyData({...companyData, companyName: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your company name"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Industry
              </label>
              <select
                value={companyData.industry}
                onChange={(e) => setCompanyData({...companyData, industry: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select industry</option>
                <option value="technology">Technology</option>
                <option value="healthcare">Healthcare</option>
                <option value="finance">Finance</option>
                <option value="retail">Retail</option>
                <option value="manufacturing">Manufacturing</option>
                <option value="education">Education</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Team Size
              </label>
              <select
                value={companyData.teamSize}
                onChange={(e) => setCompanyData({...companyData, teamSize: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select size</option>
                <option value="1-5">1-5 people</option>
                <option value="6-20">6-20 people</option>
                <option value="21-50">21-50 people</option>
                <option value="51-200">51-200 people</option>
                <option value="200+">200+ people</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Website
            </label>
            <input
              type="url"
              value={companyData.website}
              onChange={(e) => setCompanyData({...companyData, website: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://yourcompany.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Company Description
            </label>
            <textarea
              rows="3"
              value={companyData.description}
              onChange={(e) => setCompanyData({...companyData, description: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Brief description of your company..."
            />
          </div>

          <div className="flex justify-between pt-6">
            <button
              type="button"
              onClick={logout}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              Logout
            </button>
            <button
              type="submit"
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Continue
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const renderConnectPlatforms = () => (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Connect Your Platforms</h1>
        <p className="text-gray-600">Connect your social media accounts to start posting</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-6">Available Platforms</h2>
        
        <div className="space-y-4">
          {[
            { id: 'linkedin', name: 'LinkedIn', color: 'bg-blue-700', icon: '💼' },
            { id: 'twitter', name: 'Twitter/X', color: 'bg-black', icon: '🐦' },
            { id: 'facebook', name: 'Facebook', color: 'bg-blue-600', icon: '👥' },
            { id: 'instagram', name: 'Instagram', color: 'bg-pink-600', icon: '📷' }
          ].map(platform => (
            <div key={platform.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center">
                <div className={`w-10 h-10 ${platform.color} rounded-lg flex items-center justify-center text-white mr-3`}>
                  {platform.icon}
                </div>
                <div>
                  <h3 className="font-medium">{platform.name}</h3>
                  <p className="text-sm text-gray-500">
                    {connectedPlatforms.includes(platform.id) ? 'Connected' : 'Not connected'}
                  </p>
                </div>
              </div>
              
              {connectedPlatforms.includes(platform.id) ? (
                <span className="text-green-600 font-medium">✓ Connected</span>
              ) : (
                <button
                  onClick={() => handlePlatformConnect(platform.id)}
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Connect
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-between pt-6">
          <button
            onClick={handleSkipPlatforms}
            className="text-gray-500 hover:text-gray-700"
          >
            Skip for now
          </button>
          <button
            onClick={() => setCurrentStep(STEPS.COMPLETE)}
            disabled={connectedPlatforms.length === 0}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );

  const renderComplete = () => (
    <div className="max-w-2xl mx-auto text-center">
      <div className="bg-white rounded-lg shadow p-8">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Setup Complete!</h1>
        <p className="text-gray-600 mb-6">
          Your Social Media Poster account is ready to go. You can now create posts, schedule content, and track your social media performance.
        </p>
        
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <h3 className="font-semibold mb-2">What's Next?</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Create your first social media post</li>
            <li>• Set up a posting schedule</li>
            <li>• Explore analytics and insights</li>
            <li>• Invite team members</li>
          </ul>
        </div>
        
        <button
          onClick={handleComplete}
          className="bg-blue-600 text-white px-8 py-3 rounded-md hover:bg-blue-700 transition-colors text-lg font-medium"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="mb-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-center space-x-4">
            {Object.values(STEPS).map((step, index) => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep === step ? 'bg-blue-600 text-white' :
                  Object.values(STEPS).indexOf(currentStep) > index ? 'bg-green-500 text-white' :
                  'bg-gray-200 text-gray-600'
                }`}>
                  {Object.values(STEPS).indexOf(currentStep) > index ? '✓' : index + 1}
                </div>
                {index < Object.values(STEPS).length - 1 && (
                  <div className={`w-12 h-0.5 mx-2 ${
                    Object.values(STEPS).indexOf(currentStep) > index ? 'bg-green-500' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {currentStep === STEPS.COMPANY_INFO && renderCompanyInfo()}
      {currentStep === STEPS.CONNECT_PLATFORMS && renderConnectPlatforms()}
      {currentStep === STEPS.COMPLETE && renderComplete()}
    </div>
  );
}

export default OnboardingFlow;