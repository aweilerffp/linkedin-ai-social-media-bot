import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuthFixed';
import BrandVoiceAnalyzer from '../components/BrandVoiceAnalyzer';
import { companyProfileService } from '../services/companyProfileService';
import { toast } from 'react-hot-toast';

const STEPS = {
  COMPANY_INFO: 'company_info',
  BRAND_VOICE: 'brand_voice',
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
  const [brandVoiceData, setBrandVoiceData] = useState(null);
  const [connectedPlatforms, setConnectedPlatforms] = useState([]);
  const [saving, setSaving] = useState(false);

  // Check if we should migrate from old localStorage data
  useEffect(() => {
    const checkMigration = async () => {
      try {
        const hasLegacyData = localStorage.getItem('company_data');
        if (hasLegacyData) {
          const migrated = await companyProfileService.migrateFromLocalStorage();
          if (migrated) {
            toast.success('Your profile has been migrated and saved!');
            // Redirect to dashboard
            window.location.reload();
          }
        }
      } catch (error) {
        console.log('Migration not needed or failed:', error.message);
      }
    };
    
    checkMigration();
  }, []);

  const handleCompanySubmit = (e) => {
    e.preventDefault();
    // In a real app, this would save to backend
    console.log('Company data:', companyData);
    setCurrentStep(STEPS.BRAND_VOICE);
  };

  const handleBrandVoiceComplete = (analysisResult) => {
    setBrandVoiceData(analysisResult);
    console.log('Brand voice analysis:', analysisResult);
    setCurrentStep(STEPS.CONNECT_PLATFORMS);
  };

  const handlePlatformConnect = (platform) => {
    // In a real app, this would initiate OAuth flow
    setConnectedPlatforms([...connectedPlatforms, platform]);
  };

  const handleSkipPlatforms = () => {
    setCurrentStep(STEPS.COMPLETE);
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      // Convert to company profile format
      const profileData = {
        company_name: companyData.companyName,
        industry: companyData.industry,
        brand_voice: {
          tone: brandVoiceData?.tone || [],
          keywords: brandVoiceData?.keywords || [],
          prohibited_terms: brandVoiceData?.prohibited_terms || []
        },
        content_pillars: brandVoiceData?.content_pillars || [
          {
            title: 'Industry Expertise',
            description: `Insights and best practices in ${companyData.industry || 'your industry'}`,
            keywords: []
          }
        ],
        target_personas: brandVoiceData?.target_personas || [
          {
            name: 'Business Professionals',
            pain_points: ['efficiency', 'growth', 'strategy'],
            emotions: ['confidence', 'success', 'innovation']
          }
        ],
        evaluation_questions: [
          'What specific problem does this solve?',
          'How does this align with our brand voice?',
          'What action should the reader take?',
          'Does this provide real value to our audience?'
        ],
        visual_style: {
          colors: {
            primary: '#1A73E8',
            secondary: '#34A853',
            accent: '#FBBC04'
          }
        },
        slack_config: {
          channel: '#social-media'
        }
      };

      // Save to database
      await companyProfileService.saveProfile(profileData);
      
      // Clear any old localStorage data (but keep onboarding_complete for fallback)
      localStorage.removeItem('company_data');
      localStorage.removeItem('brand_voice_data');
      localStorage.removeItem('connected_platforms');
      
      // Set completion flag to ensure dashboard shows
      localStorage.setItem('onboarding_complete', 'true');
      
      toast.success('Company profile saved successfully!');
      console.log('Onboarding completed and saved to database');
      
      // Small delay to ensure data is saved before reload
      setTimeout(() => {
        window.location.reload();
      }, 100);
    } catch (error) {
      console.error('Error saving company profile:', error);
      toast.error('Failed to save profile: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const renderBrandVoice = () => (
    <div className="max-w-full">
      <BrandVoiceAnalyzer 
        onAnalysisComplete={handleBrandVoiceComplete}
        initialData={{
          additional_context: {
            industry: companyData.industry,
            company_stage: companyData.teamSize === '1-5' ? 'startup' : 
                          companyData.teamSize === '200+' ? 'established' : 'growth'
          }
        }}
      />
    </div>
  );

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
          Your Social Media Poster account is ready to go. We've analyzed your brand voice and built a comprehensive knowledge base to ensure all generated content matches your unique style.
        </p>
        
        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <h3 className="font-semibold mb-2">✨ Brand Voice Analyzed</h3>
          <p className="text-sm text-gray-700">
            Your content patterns have been extracted and will be used to generate authentic, on-brand social media posts.
          </p>
        </div>
        
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <h3 className="font-semibold mb-2">What's Next?</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Create your first AI-powered social media post</li>
            <li>• Review your brand voice patterns</li>
            <li>• Set up a posting schedule</li>
            <li>• Explore analytics and insights</li>
            <li>• Invite team members</li>
          </ul>
        </div>
        
        <button
          onClick={handleComplete}
          disabled={saving}
          className={`px-8 py-3 rounded-md text-lg font-medium transition-colors ${
            saving 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700'
          } text-white`}
        >
          {saving ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Saving Profile...
            </div>
          ) : (
            'Go to Dashboard'
          )}
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
      {currentStep === STEPS.BRAND_VOICE && renderBrandVoice()}
      {currentStep === STEPS.CONNECT_PLATFORMS && renderConnectPlatforms()}
      {currentStep === STEPS.COMPLETE && renderComplete()}
    </div>
  );
}

export default OnboardingFlow;