import { useState } from 'react';
import { 
  CheckCircleIcon, 
  ClockIcon, 
  XCircleIcon,
  DocumentTextIcon,
  UserIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';
import { usePosts } from '../../hooks/usePosts';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';

function RecentActivity({ limit = 10 }) {
  const { posts, loading, error } = usePosts({ 
    limit, 
    sort: 'created_at',
    order: 'desc' 
  });

  const getActivityIcon = (status, type = 'post') => {
    const iconProps = { className: 'w-5 h-5' };
    
    switch (status) {
      case 'published':
      case 'posted':
        return <CheckCircleIcon {...iconProps} className="w-5 h-5 text-green-500" />;
      case 'scheduled':
        return <ClockIcon {...iconProps} className="w-5 h-5 text-blue-500" />;
      case 'failed':
        return <XCircleIcon {...iconProps} className="w-5 h-5 text-red-500" />;
      case 'draft':
        return <DocumentTextIcon {...iconProps} className="w-5 h-5 text-gray-500" />;
      case 'queued':
      case 'posting':
        return <BoltIcon {...iconProps} className="w-5 h-5 text-yellow-500" />;
      default:
        return <DocumentTextIcon {...iconProps} className="w-5 h-5 text-gray-500" />;
    }
  };

  const getActivityColor = (status) => {
    switch (status) {
      case 'published':
      case 'posted':
        return 'bg-green-100 border-green-300';
      case 'scheduled':
        return 'bg-blue-100 border-blue-300';
      case 'failed':
        return 'bg-red-100 border-red-300';
      case 'draft':
        return 'bg-gray-100 border-gray-300';
      case 'queued':
      case 'posting':
        return 'bg-yellow-100 border-yellow-300';
      default:
        return 'bg-gray-100 border-gray-300';
    }
  };

  const getActivityDescription = (post) => {
    const platformsText = post.platforms?.join(', ') || 'Unknown platforms';
    const contentPreview = post.content?.substring(0, 60) + (post.content?.length > 60 ? '...' : '');
    
    switch (post.status) {
      case 'published':
      case 'posted':
        return `Posted to ${platformsText}: "${contentPreview}"`;
      case 'scheduled':
        const scheduledDate = new Date(post.scheduled_at).toLocaleString();
        return `Scheduled for ${platformsText} on ${scheduledDate}`;
      case 'failed':
        return `Failed to post to ${platformsText}: "${contentPreview}"`;
      case 'draft':
        return `Draft saved: "${contentPreview}"`;
      case 'queued':
        return `Queued for ${platformsText}: "${contentPreview}"`;
      case 'posting':
        return `Publishing to ${platformsText}: "${contentPreview}"`;
      default:
        return `${post.status} - "${contentPreview}"`;
    }
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return date.toLocaleDateString();
  };

  if (error) {
    return (
      <ErrorMessage 
        title="Failed to load recent activity"
        message={error}
      />
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
        <button className="text-sm text-indigo-600 hover:text-indigo-500 font-medium">
          View all
        </button>
      </div>

      {loading ? (
        <LoadingSpinner text="Loading recent activity..." />
      ) : posts.length === 0 ? (
        <div className="text-center py-8">
          <DocumentTextIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No recent activity</p>
          <p className="text-sm text-gray-400 mt-1">
            Create your first post to see activity here
          </p>
        </div>
      ) : (
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {posts.map((post) => (
            <div 
              key={post.id}
              className={`flex items-start space-x-4 p-3 rounded-lg border-l-4 ${getActivityColor(post.status)}`}
            >
              <div className="flex-shrink-0 mt-1">
                {getActivityIcon(post.status)}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 font-medium mb-1">
                  {getActivityDescription(post)}
                </p>
                
                <div className="flex items-center text-xs text-gray-500 space-x-4">
                  <span>{formatTimeAgo(post.created_at)}</span>
                  {post.user && (
                    <div className="flex items-center">
                      <UserIcon className="w-3 h-3 mr-1" />
                      {post.user.name || post.user.email}
                    </div>
                  )}
                  <span className="capitalize bg-gray-100 px-2 py-1 rounded-full">
                    {post.status}
                  </span>
                </div>
              </div>

              {post.scheduled_at && post.status === 'scheduled' && (
                <div className="flex-shrink-0 text-xs text-gray-400 mt-1">
                  {new Date(post.scheduled_at).toLocaleDateString()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default RecentActivity;