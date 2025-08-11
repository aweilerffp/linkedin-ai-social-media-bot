import { useEffect } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';

function SimpleDashboard() {
  const { user } = useAuth();
  
  useEffect(() => {
    console.log('SimpleDashboard rendered, user:', user);
  }, [user]);

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">
        Welcome to Social Media Poster!
      </h1>
      
      {user ? (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Hello, {user.name}! 👋</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-medium text-blue-900">Account Info</h3>
              <p className="text-blue-700">Email: {user.email}</p>
              <p className="text-blue-700">Role: {user.role}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-medium text-green-900">Status</h3>
              <p className="text-green-700">✅ Authentication Working</p>
              <p className="text-green-700">✅ Dashboard Loading</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-red-50 p-4 rounded-lg">
          <p className="text-red-700">No user data available</p>
        </div>
      )}
      
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
      
      <div className="mt-6 text-center">
        <p className="text-gray-600">
          🎉 Congratulations! Your Social Media Poster is working perfectly!
        </p>
        <p className="text-sm text-gray-500 mt-2">
          This is a simplified dashboard. The full dashboard with analytics will be available soon.
        </p>
      </div>
    </div>
  );
}

export default SimpleDashboard;