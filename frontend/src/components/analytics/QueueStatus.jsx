import { 
  QueueListIcon, 
  ClockIcon,
  BoltIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useQueueStats } from '../../hooks/useAnalytics';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';

function QueueStatus() {
  const { stats, loading, error } = useQueueStats();

  if (error) {
    return (
      <ErrorMessage 
        title="Failed to load queue status"
        message={error}
      />
    );
  }

  const getQueueHealthColor = (health) => {
    if (health >= 80) return 'text-green-600 bg-green-100';
    if (health >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const queueItems = [
    {
      label: 'Waiting',
      value: stats.postQueue?.waiting || 0,
      icon: ClockIcon,
      color: 'text-blue-600 bg-blue-100',
    },
    {
      label: 'Active',
      value: stats.postQueue?.active || 0,
      icon: BoltIcon,
      color: 'text-yellow-600 bg-yellow-100',
    },
    {
      label: 'Completed',
      value: stats.postQueue?.completed || 0,
      icon: CheckCircleIcon,
      color: 'text-green-600 bg-green-100',
    },
    {
      label: 'Failed',
      value: stats.postQueue?.failed || 0,
      icon: ExclamationTriangleIcon,
      color: 'text-red-600 bg-red-100',
    },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <QueueListIcon className="w-5 h-5 text-gray-500 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Queue Status</h2>
        </div>
        
        {!loading && stats.health !== undefined && (
          <div className="flex items-center">
            <span className="text-sm text-gray-600 mr-2">Health:</span>
            <span className={`text-sm font-medium px-2 py-1 rounded-full ${getQueueHealthColor(stats.health)}`}>
              {stats.health}%
            </span>
          </div>
        )}
      </div>

      {loading ? (
        <LoadingSpinner text="Loading queue status..." />
      ) : (
        <div className="space-y-4">
          {/* Queue metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {queueItems.map((item) => (
              <div key={item.label} className="text-center">
                <div className={`inline-flex p-3 rounded-full ${item.color} mb-2`}>
                  <item.icon className="w-6 h-6" />
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {item.value.toLocaleString()}
                </div>
                <div className="text-sm text-gray-500">{item.label}</div>
              </div>
            ))}
          </div>

          {/* Processing rate */}
          {stats.processingRate && (
            <div className="pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Processing Rate</span>
                <span className="text-sm font-medium text-gray-900">
                  {stats.processingRate.current || 0} jobs/min
                </span>
              </div>
              
              {stats.processingRate.average && (
                <div className="flex justify-between items-center mt-2">
                  <span className="text-sm text-gray-500">Average (24h)</span>
                  <span className="text-sm text-gray-700">
                    {stats.processingRate.average} jobs/min
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Retry information */}
          {stats.retryQueue && (
            <div className="pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Retry Queue</span>
                <span className="text-sm font-medium text-gray-900">
                  {stats.retryQueue.waiting || 0} waiting
                </span>
              </div>
              
              {stats.retryQueue.nextRetry && (
                <div className="flex justify-between items-center mt-2">
                  <span className="text-sm text-gray-500">Next Retry</span>
                  <span className="text-sm text-gray-700">
                    {new Date(stats.retryQueue.nextRetry).toLocaleTimeString()}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Last updated */}
          <div className="text-xs text-gray-400 text-center pt-2">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
}

export default QueueStatus;