import apiClient from './apiClient';
import { mockAuthService } from './mockAuthService';

// Check if we should use mock mode (when backend is not available)
const shouldUseMockMode = () => {
  const apiUrl = import.meta.env.VITE_API_URL;
  return !apiUrl || apiUrl.includes('vercel.app') || import.meta.env.VITE_USE_MOCK_AUTH === 'true';
};

export const authService = {
  // Authentication
  async login(email, password) {
    if (shouldUseMockMode()) {
      return await mockAuthService.login(email, password);
    }
    
    const response = await apiClient.post('/auth/login', { email, password });
    const { accessToken, refreshToken, user } = response.data.data;
    
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    
    return response.data;
  },

  async register(userData) {
    if (shouldUseMockMode()) {
      return await mockAuthService.register(userData);
    }
    
    const response = await apiClient.post('/auth/register', userData);
    const { accessToken, refreshToken, user } = response.data.data;
    
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    
    return response.data;
  },

  async logout() {
    if (shouldUseMockMode()) {
      return await mockAuthService.logout();
    }
    
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      console.warn('Logout request failed:', error);
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    }
  },

  async refreshToken() {
    if (shouldUseMockMode()) {
      return await mockAuthService.refreshToken();
    }
    
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) throw new Error('No refresh token available');

    const response = await apiClient.post('/auth/refresh', { refreshToken });
    const { accessToken, refreshToken: newRefreshToken } = response.data.data;
    
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', newRefreshToken);
    
    return response.data;
  },

  // Profile management
  async getProfile() {
    if (shouldUseMockMode()) {
      return await mockAuthService.getProfile();
    }
    
    const response = await apiClient.get('/auth/profile');
    return response.data;
  },

  async changePassword(currentPassword, newPassword) {
    const response = await apiClient.post('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    return response.data;
  },

  async requestPasswordReset(email) {
    const response = await apiClient.post('/auth/request-reset', { email });
    return response.data;
  },

  async resetPassword(token, newPassword) {
    const response = await apiClient.post('/auth/reset-password', {
      token,
      newPassword,
    });
    return response.data;
  },

  // OAuth
  async startOAuth(platform) {
    const response = await apiClient.get(`/auth/oauth/${platform}`);
    return response.data;
  },

  async handleOAuthCallback(platform, code, state, oauthVerifier) {
    const params = { code, state };
    if (oauthVerifier) params.oauth_verifier = oauthVerifier;
    
    const response = await apiClient.get(`/auth/oauth/${platform}/callback`, { params });
    return response.data;
  },

  // Platform management
  async getPlatforms() {
    const response = await apiClient.get('/auth/platforms');
    return response.data;
  },

  async disconnectPlatform(platform) {
    const response = await apiClient.delete(`/auth/platforms/${platform}`);
    return response.data;
  },

  async testConnection(platform) {
    const response = await apiClient.get(`/auth/platforms/${platform}/test`);
    return response.data;
  },

  async refreshPlatformCredentials(platform) {
    const response = await apiClient.post(`/auth/platforms/${platform}/refresh`);
    return response.data;
  },

  // Team management
  async inviteUser(userData) {
    const response = await apiClient.post('/auth/invite', userData);
    return response.data;
  },

  // Utility methods
  isAuthenticated() {
    if (shouldUseMockMode()) {
      return mockAuthService.isAuthenticated();
    }
    // Check both possible token names
    return !!localStorage.getItem('accessToken') || !!localStorage.getItem('token');
  },

  getCurrentUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  getAccessToken() {
    return localStorage.getItem('accessToken');
  },
};