import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

const AIContentDashboard = ({ teamId }) => {
  const [dashboardData, setDashboardData] = useState({
    company_profile: null,
    recent_transcripts: [],
    content_pipeline: [],
    queue_status: [],
    performance_metrics: {}
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pipeline');

  useEffect(() => {
    loadDashboardData();
  }, [teamId]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      // Use the new marketing endpoints
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/marketing/dashboard/${teamId || 'default'}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setDashboardData(result.data);
        }
      } else {
        // If marketing endpoint fails, try fallback to AI endpoint
        const fallbackResponse = await fetch(`${apiUrl}/api/ai/dashboard/${teamId || 'default'}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (fallbackResponse.ok) {
          const data = await fallbackResponse.json();
          setDashboardData(data);
        }
      }
    } catch (error) {
      toast.error('Failed to load dashboard data');
      console.error('Dashboard load error:', error);
      
      // Load mock data if API fails
      setDashboardData({
        company_profile: {
          company_name: 'Demo Company',
          industry: 'Technology'
        },
        recent_transcripts: [],
        content_pipeline: [],
        queue_status: [],
        performance_metrics: {
          total_transcripts: 0,
          total_insights: 0,
          total_posts: 0,
          queued_posts: 0,
          published_posts: 0,
          avg_engagement_rate: 0,
          pillar_performance: []
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'approved': 'bg-green-100 text-green-800',
      'rejected': 'bg-red-100 text-red-800',
      'queued': 'bg-blue-100 text-blue-800',
      'posted': 'bg-purple-100 text-purple-800',
      'failed': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const renderPipelineView = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
          <h3 className="text-lg font-semibold text-gray-900">Transcripts</h3>
          <p className="text-2xl font-bold text-blue-600">
            {dashboardData.performance_metrics.total_transcripts || 0}
          </p>
          <p className="text-sm text-gray-600">This month</p>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
          <h3 className="text-lg font-semibold text-gray-900">Insights</h3>
          <p className="text-2xl font-bold text-green-600">
            {dashboardData.performance_metrics.total_insights || 0}
          </p>
          <p className="text-sm text-gray-600">Generated</p>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-purple-500">
          <h3 className="text-lg font-semibold text-gray-900">Posts</h3>
          <p className="text-2xl font-bold text-purple-600">
            {dashboardData.performance_metrics.total_posts || 0}
          </p>
          <p className="text-sm text-gray-600">Created</p>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-yellow-500">
          <h3 className="text-lg font-semibold text-gray-900">In Queue</h3>
          <p className="text-2xl font-bold text-yellow-600">
            {dashboardData.performance_metrics.queued_posts || 0}
          </p>
          <p className="text-sm text-gray-600">Pending</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Content Pipeline</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Meeting
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Insights
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Posts
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {dashboardData.content_pipeline.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {item.meeting_title || 'Untitled Meeting'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {formatDate(item.meeting_date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {item.insights_count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {item.posts_count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex space-x-2">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor('approved')}`}>
                        {item.approved_posts} approved
                      </span>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor('posted')}`}>
                        {item.published_posts} posted
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderQueueView = () => (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">Publishing Queue</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Post Preview
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Scheduled
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Priority
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {dashboardData.queue_status.map((post, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900 max-w-xs truncate">
                    {post.content_preview || 'Post content preview...'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {post.character_count} characters
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {formatDate(post.scheduled_time)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full mr-2 bg-yellow-400"></div>
                    <span className="text-sm text-gray-600">{post.priority || 5}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(post.status)}`}>
                    {post.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button className="text-blue-600 hover:text-blue-900 mr-3">
                    Edit
                  </button>
                  <button className="text-red-600 hover:text-red-900">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderInsightsView = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Recent Marketing Insights</h2>
        </div>
        <div className="p-6">
          {dashboardData.recent_transcripts.map((transcript, index) => (
            <div key={index} className="mb-6 last:mb-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-medium text-gray-900">
                  {transcript.title || 'Meeting Transcript'}
                </h3>
                <span className="text-sm text-gray-500">
                  {formatDate(transcript.created_at)}
                </span>
              </div>
              
              {transcript.insights && transcript.insights.map((insight, insightIndex) => (
                <div key={insightIndex} className="border-l-4 border-blue-500 pl-4 mb-4">
                  <div className="flex items-center mb-2">
                    <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded">
                      {insight.pillar}
                    </span>
                    <span className="ml-2 text-sm text-gray-500">
                      Score: {(insight.insight_score * 100).toFixed(0)}%
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-700 mb-2">
                    <strong>LinkedIn Hook:</strong> {insight.linkedin.substring(0, 200)}...
                  </p>
                  
                  <p className="text-xs text-gray-600 italic">
                    Source: "{insight.source_quote}"
                  </p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderAnalyticsView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Metrics</h3>
        <div className="space-y-4">
          <div className="flex justify-between">
            <span className="text-gray-600">Avg. Processing Time</span>
            <span className="font-medium">2.3 minutes</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Approval Rate</span>
            <span className="font-medium text-green-600">87%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Posts Published</span>
            <span className="font-medium">{dashboardData.performance_metrics.published_posts || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Avg. Engagement</span>
            <span className="font-medium text-blue-600">
              {dashboardData.performance_metrics.avg_engagement_rate || 0}%
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Content Pillars Performance</h3>
        <div className="space-y-3">
          {dashboardData.performance_metrics.pillar_performance?.map((pillar, index) => (
            <div key={index} className="flex items-center">
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">{pillar.name}</span>
                  <span className="text-gray-900">{pillar.posts_count} posts</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full" 
                    style={{ width: `${(pillar.engagement_rate || 0) * 10}%` }}
                  ></div>
                </div>
              </div>
            </div>
          )) || []}
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: 'pipeline', name: 'Content Pipeline', icon: '🔄' },
    { id: 'queue', name: 'Publishing Queue', icon: '📅' },
    { id: 'insights', name: 'Insights', icon: '💡' },
    { id: 'analytics', name: 'Analytics', icon: '📊' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading dashboard...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">AI Content Dashboard</h1>
        {dashboardData.company_profile && (
          <p className="text-gray-600">
            {dashboardData.company_profile.company_name} • {dashboardData.company_profile.industry}
          </p>
        )}
      </div>

      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      <div className="min-h-96">
        {activeTab === 'pipeline' && renderPipelineView()}
        {activeTab === 'queue' && renderQueueView()}
        {activeTab === 'insights' && renderInsightsView()}
        {activeTab === 'analytics' && renderAnalyticsView()}
      </div>
    </div>
  );
};

export default AIContentDashboard;