import { useAuth } from '../hooks/useAuthFixed';

function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Welcome back, {user?.name || user?.email}! 👋
        </h1>
        <p className="text-gray-600">
          Your Social Media Poster dashboard
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
              📝
            </div>
            <div>
              <h3 className="font-medium">Create Post</h3>
              <p className="text-sm text-gray-600">Write and publish content</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
              📅
            </div>
            <div>
              <h3 className="font-medium">Schedule Post</h3>
              <p className="text-sm text-gray-600">Plan your content calendar</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
              📊
            </div>
            <div>
              <h3 className="font-medium">View Analytics</h3>
              <p className="text-sm text-gray-600">Track performance metrics</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;