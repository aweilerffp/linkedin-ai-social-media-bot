import apiClient from './apiClient';

export const postsService = {
  // Posts CRUD
  async createPost(postData) {
    const response = await apiClient.post('/posts', postData);
    return response.data;
  },

  async getPosts(params = {}) {
    const response = await apiClient.get('/posts', { params });
    return response.data;
  },

  async getPost(postId) {
    const response = await apiClient.get(`/posts/${postId}`);
    return response.data;
  },

  async updatePost(postId, updates) {
    const response = await apiClient.put(`/posts/${postId}`, updates);
    return response.data;
  },

  async deletePost(postId) {
    const response = await apiClient.delete(`/posts/${postId}`);
    return response.data;
  },

  // Post actions
  async postNow(postId) {
    const response = await apiClient.post(`/posts/${postId}/post-now`);
    return response.data;
  },

  async scheduleOptimal(postId, scheduleData) {
    const response = await apiClient.post(`/posts/${postId}/schedule-optimal`, scheduleData);
    return response.data;
  },

  async cancelScheduled(postId) {
    const response = await apiClient.post(`/posts/${postId}/cancel-scheduled`);
    return response.data;
  },

  async retryPost(postId, platform = null) {
    const payload = platform ? { platform } : {};
    const response = await apiClient.post(`/posts/${postId}/retry`, payload);
    return response.data;
  },

  // Scheduling utilities
  async getScheduledPosts() {
    const response = await apiClient.get('/posts/scheduled');
    return response.data;
  },

  async getScheduleStats() {
    const response = await apiClient.get('/posts/schedule/stats');
    return response.data;
  },

  async getOptimalTimes(platform = null) {
    const params = platform ? { platform } : {};
    const response = await apiClient.get('/posts/schedule/optimal-times', { params });
    return response.data;
  },

  async checkConflicts(scheduledTime, platforms, excludePostId = null) {
    const response = await apiClient.post('/posts/schedule/check-conflicts', {
      scheduledTime,
      platforms,
      excludePostId,
    });
    return response.data;
  },

  // Media upload (placeholder - would need actual implementation)
  async uploadMedia(files) {
    const formData = new FormData();
    files.forEach((file, index) => {
      formData.append(`media_${index}`, file);
    });

    const response = await apiClient.post('/media/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Real-time updates helper
  subscribeToUpdates(callback) {
    // This would be implemented with WebSocket connection
    // For now, return a cleanup function
    return () => {
      // Cleanup subscription
    };
  },
};