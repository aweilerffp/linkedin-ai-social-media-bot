import apiClient from './apiClient';

export const analyticsService = {
  // Dashboard analytics
  async getDashboardStats(timeRange = '7d') {
    const response = await apiClient.get('/analytics/dashboard', {
      params: { timeRange },
    });
    return response.data;
  },

  async getPostAnalytics(timeRange = '30d', platform = null) {
    const params = { timeRange };
    if (platform) params.platform = platform;
    
    const response = await apiClient.get('/analytics/posts', { params });
    return response.data;
  },

  async getPlatformAnalytics(timeRange = '30d') {
    const response = await apiClient.get('/analytics/platforms', {
      params: { timeRange },
    });
    return response.data;
  },

  async getScheduleAnalytics(timeRange = '30d') {
    const response = await apiClient.get('/analytics/schedule', {
      params: { timeRange },
    });
    return response.data;
  },

  async getEngagementMetrics(postId, platform = null) {
    const params = platform ? { platform } : {};
    const response = await apiClient.get(`/analytics/posts/${postId}/engagement`, { params });
    return response.data;
  },

  // Team analytics
  async getTeamPerformance(timeRange = '30d') {
    const response = await apiClient.get('/analytics/team', {
      params: { timeRange },
    });
    return response.data;
  },

  async getUserActivity(userId = null, timeRange = '30d') {
    const params = { timeRange };
    if (userId) params.userId = userId;
    
    const response = await apiClient.get('/analytics/users', { params });
    return response.data;
  },

  // Queue and system analytics
  async getQueueStats() {
    const response = await apiClient.get('/queue-stats');
    return response.data;
  },

  async getSystemHealth() {
    const response = await apiClient.get('/health');
    return response.data;
  },

  // Export functionality
  async exportAnalytics(type, timeRange = '30d', format = 'csv') {
    const response = await apiClient.get(`/analytics/export/${type}`, {
      params: { timeRange, format },
      responseType: 'blob',
    });
    return response.data;
  },

  // Utility functions
  formatTimeRange(range) {
    const ranges = {
      '1d': 'Last 24 hours',
      '7d': 'Last 7 days',
      '30d': 'Last 30 days',
      '90d': 'Last 90 days',
      '1y': 'Last year',
    };
    return ranges[range] || range;
  },

  formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  },

  calculateGrowthRate(current, previous) {
    if (!previous || previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  },
};