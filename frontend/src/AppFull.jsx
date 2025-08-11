import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuthFixed';
import LoginForm from './components/LoginForm';
import OnboardingFlow from './pages/OnboardingFlow';
import DashboardPage from './pages/DashboardPage';
import PostsPage from './pages/PostsPage';
import SchedulePage from './pages/SchedulePage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';
import Layout from './components/common/Layout';
import PrivateRoute from './components/common/PrivateRoute';

function AppFull() {
  const { isAuthenticated, isLoading, user } = useAuth();
  
  console.log('[App] Rendering with auth state:', { isAuthenticated, isLoading, user: user?.email });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  // Check if user needs onboarding - check if user has completed setup
  // Look for completion marker in localStorage for now, later this should come from backend
  const onboardingComplete = localStorage.getItem('onboarding_complete');
  const needsOnboarding = !onboardingComplete;
  
  if (needsOnboarding) {
    return <OnboardingFlow />;
  }

  return (
    <Routes>
      <Route element={<PrivateRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/posts" element={<PostsPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
      
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}

export default AppFull;