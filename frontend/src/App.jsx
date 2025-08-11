import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Layout from './components/common/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/SimpleDashboard';
import PostsPage from './pages/PostsPage';
import SchedulePage from './pages/SchedulePage';
import TeamsPage from './pages/TeamsPage';
import SettingsPage from './pages/SettingsPage';
import PrivateRoute from './components/common/PrivateRoute';

function App() {
  const { isAuthenticated, isLoading } = useAuth();
  
  useEffect(() => {
    console.log('App render - isAuthenticated:', isAuthenticated, 'isLoading:', isLoading);
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/dashboard" />} />
      
      <Route element={<PrivateRoute />}>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/posts" element={<PostsPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
      
      <Route path="/" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}

export default App;