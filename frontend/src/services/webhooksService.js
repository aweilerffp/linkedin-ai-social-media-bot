import apiClient from './apiClient';

export const webhooksService = {
  // Webhook configuration
  async createWebhook(webhookData) {
    const response = await apiClient.post('/webhooks', webhookData);
    return response.data;
  },

  async getWebhooks() {
    const response = await apiClient.get('/webhooks');
    return response.data;
  },

  async getWebhook(webhookId) {
    const response = await apiClient.get(`/webhooks/${webhookId}`);
    return response.data;
  },

  async updateWebhook(webhookId, updates) {
    const response = await apiClient.put(`/webhooks/${webhookId}`, updates);
    return response.data;
  },

  async deleteWebhook(webhookId) {
    const response = await apiClient.delete(`/webhooks/${webhookId}`);
    return response.data;
  },

  // Webhook testing
  async testWebhook(webhookId) {
    const response = await apiClient.post(`/webhooks/${webhookId}/test`);
    return response.data;
  },

  // Webhook deliveries
  async getWebhookDeliveries(webhookId, params = {}) {
    const response = await apiClient.get(`/webhooks/${webhookId}/deliveries`, { params });
    return response.data;
  },

  async getWebhookStats(webhookId = null) {
    const url = webhookId ? `/webhooks/${webhookId}/stats` : '/webhooks/stats';
    const response = await apiClient.get(url);
    return response.data;
  },

  // Manual webhook triggering (admin/testing)
  async triggerWebhook(event, data) {
    const response = await apiClient.post('/webhooks/trigger', { event, data });
    return response.data;
  },

  // Webhook status
  async getWebhookStatus(webhookId) {
    const response = await apiClient.get(`/webhooks/status/${webhookId}`);
    return response.data;
  },

  // Utility endpoints
  async verifyWebhookSignature(payload, signature, secret = null) {
    const response = await apiClient.post('/webhooks/verify-signature', {
      payload,
      signature,
      secret,
    });
    return response.data;
  },

  async getWebhookEvents() {
    const response = await apiClient.get('/webhooks/events');
    return response.data;
  },
};