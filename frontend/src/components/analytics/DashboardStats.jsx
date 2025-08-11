import { 
  DocumentTextIcon,
  ClockIcon,
  CheckCircleIcon,
  HeartIcon,
  UserGroupIcon,
  CursorArrowRaysIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useDashboardStats } from '../../hooks/useAnalytics';
import StatCard from '../common/StatCard';
import ErrorMessage from '../common/ErrorMessage';

function DashboardStats({ timeRange = '7d' }) {
  const { stats, loading, error } = useDashboardStats(timeRange);

  if (error) {
    return (
      <ErrorMessage 
        title="Failed to load dashboard stats"
        message={error}
      />
    );
  }

  const statCards = [
    {
      title: 'Total Posts',
      value: stats.totalPosts?.current || 0,
      previousValue: stats.totalPosts?.previous || null,
      icon: DocumentTextIcon,
    },
    {
      title: 'Scheduled Posts',
      value: stats.scheduledPosts || 0,
      icon: ClockIcon,
    },
    {
      title: 'Published Posts',
      value: stats.publishedPosts?.current || 0,
      previousValue: stats.publishedPosts?.previous || null,
      icon: CheckCircleIcon,
    },
    {
      title: 'Failed Posts',
      value: stats.failedPosts || 0,
      icon: ExclamationTriangleIcon,
    },
    {
      title: 'Total Engagements',
      value: stats.totalEngagements?.current || 0,
      previousValue: stats.totalEngagements?.previous || null,
      icon: HeartIcon,
      format: 'compact',
    },
    {
      title: 'Click-through Rate',
      value: stats.clickThroughRate?.current || 0,
      previousValue: stats.clickThroughRate?.previous || null,
      icon: CursorArrowRaysIcon,
      format: 'percentage',
    },
    {
      title: 'Active Platforms',
      value: stats.activePlatforms || 0,
      icon: UserGroupIcon,
    },
    {
      title: 'Queue Health',
      value: stats.queueHealth || 0,
      icon: CheckCircleIcon,
      format: 'percentage',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {statCards.map((card, index) => (
        <StatCard
          key={index}
          title={card.title}
          value={card.value}
          previousValue={card.previousValue}
          icon={card.icon}
          format={card.format}
          loading={loading}
        />
      ))}
    </div>
  );
}

export default DashboardStats;