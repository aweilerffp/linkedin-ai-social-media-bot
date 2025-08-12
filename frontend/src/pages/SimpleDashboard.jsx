import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import { companyProfileService } from '../services/companyProfileService';
import OnboardingFlow from './OnboardingFlow';
import AIContentDashboard from '../components/AIContentDashboard';

function SimpleDashboard() {
  const { user } = useAuth();
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

  // Show AI Content Dashboard if onboarding is complete
  return <AIContentDashboard teamId={user?.teamId || 'default'} />;
}

export default SimpleDashboard;