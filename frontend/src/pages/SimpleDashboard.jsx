import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import { companyProfileService } from '../services/companyProfileService';
import OnboardingFlow from './OnboardingFlow';
import AIContentDashboard from '../components/AIContentDashboard';
import WebhookConfiguration from '../components/WebhookConfiguration';
import { Cog6ToothIcon, ChartBarIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

function SimpleDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [onboardingStatus, setOnboardingStatus] = useState({ 
    checked: false, 
    completed: false, 
    loading: true 
  });

  useEffect(() => {
    console.log('SimpleDashboard rendered, user:', user);
    checkOnboardingStatus();
  }, [user]);

  const checkOnboardingStatus = async () => {
    try {
      console.log('Checking onboarding status...');
      const status = await companyProfileService.checkOnboardingStatus();
      console.log('Onboarding status result:', status);
      
      setOnboardingStatus({
        checked: true,
        completed: status.completed,
        loading: false,
        profile: status.profile,
        reason: status.reason
      });
      
      // Debug localStorage state
      console.log('localStorage debug:', {
        onboarding_complete: localStorage.getItem('onboarding_complete'),
        company_profile: localStorage.getItem('company_profile') ? 'exists' : 'missing',
        token: localStorage.getItem('token') ? 'exists' : 'missing'
      });
      
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      setOnboardingStatus({
        checked: true,
        completed: false,
        loading: false,
        error: error.message
      });
    }
  };

  // Show loading while checking onboarding status
  if (onboardingStatus.loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking your profile...</p>
        </div>
      </div>
    );
  }

  // Show onboarding if not completed
  if (!onboardingStatus.completed) {
    return <OnboardingFlow />;
  }

  const redoOnboarding = () => {
    localStorage.removeItem('onboarding_complete');
    localStorage.removeItem('company_profile');
    setOnboardingStatus({
      checked: true,
      completed: false,
      loading: false
    });
  };

  const tabs = [
    { id: 'dashboard', name: 'Dashboard', icon: ChartBarIcon },
    { id: 'settings', name: 'Settings', icon: Cog6ToothIcon }
  ];

  // Show main dashboard with navigation if onboarding is complete
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-semibold text-gray-900">AI Content Dashboard</h1>
              </div>
              <div className="hidden sm:-my-px sm:ml-6 sm:flex sm:space-x-8">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`${
                        activeTab === tab.id
                          ? 'border-blue-500 text-gray-900'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center`}
                    >
                      <Icon className="h-5 w-5 mr-2" />
                      {tab.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {activeTab === 'dashboard' && (
          <AIContentDashboard teamId={user?.teamId || 'default'} />
        )}
        
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Company Profile</h2>
              <p className="text-sm text-gray-600 mb-4">
                Update your company information or redo the onboarding process.
              </p>
              <button
                onClick={redoOnboarding}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <ArrowPathIcon className="h-4 w-4 mr-2" />
                Redo Onboarding
              </button>
            </div>
            
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Webhook Configuration</h2>
              <WebhookConfiguration />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SimpleDashboard;