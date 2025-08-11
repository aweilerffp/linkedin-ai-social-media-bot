import { useAuth } from './hooks/useAuthFixed';
import LoginForm from './components/LoginForm';

function AppWithAuth() {
  const { isAuthenticated, isLoading, user, login, logout } = useAuth();
  
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                Social Media Poster
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome, {user?.name || user?.email}!
              </span>
              <button 
                onClick={logout}
                className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              🎉 Welcome to your Dashboard!
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-medium text-green-900 mb-2">✅ Working Features:</h3>
                <ul className="text-green-700 space-y-1">
                  <li>• User authentication</li>
                  <li>• React rendering</li>
                  <li>• Tailwind styling</li>
                  <li>• Login/logout flow</li>
                </ul>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2">👤 User Info:</h3>
                <ul className="text-blue-700 space-y-1">
                  <li>• Name: {user?.name || 'Not set'}</li>
                  <li>• Email: {user?.email}</li>
                  <li>• Role: {user?.role || 'user'}</li>
                  <li>• Status: Authenticated ✅</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                📝 Create Post
              </button>
              <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
                📅 Schedule Post  
              </button>
              <button className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
                📊 View Analytics
              </button>
            </div>
          </div>
          
          <div className="text-center text-gray-600">
            <p>🚀 Your Social Media Poster is fully functional!</p>
            <p className="text-sm mt-2">Ready for the next features: routing, post creation, scheduling, and more.</p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default AppWithAuth;