// Mock authentication service for demo purposes
export const mockAuthService = {
  // Mock user data
  mockUsers: {
    'alice@example.com': {
      id: 'user-123',
      email: 'alice@example.com',
      name: 'Alice Johnson',
      teamId: 'team-456',
      role: 'admin',
      createdAt: '2024-01-01T00:00:00Z'
    },
    'bob@example.com': {
      id: 'user-789',
      email: 'bob@example.com',
      name: 'Bob Smith',
      teamId: 'team-456',
      role: 'member',
      createdAt: '2024-01-02T00:00:00Z'
    }
  },

  mockPasswords: {
    'alice@example.com': 'testpass123',
    'bob@example.com': 'testpass456'
  },

  // Simulate network delay
  async delay(ms = 500) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  async login(email, password) {
    await this.delay();
    
    const user = this.mockUsers[email];
    const correctPassword = this.mockPasswords[email];
    
    if (!user || password !== correctPassword) {
      throw new Error('Invalid email or password');
    }
    
    const accessToken = 'mock_access_token_' + Date.now();
    const refreshToken = 'mock_refresh_token_' + Date.now();
    
    // Store in localStorage like the real auth service
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    
    return {
      success: true,
      data: {
        user,
        accessToken,
        refreshToken
      }
    };
  },

  async register(userData) {
    await this.delay();
    
    const { email, password, name, teamName } = userData;
    
    if (this.mockUsers[email]) {
      throw new Error('User already exists');
    }
    
    const newUser = {
      id: 'user-' + Date.now(),
      email: email.toLowerCase(),
      name,
      teamId: 'team-' + Date.now(),
      role: 'admin',
      createdAt: new Date().toISOString()
    };
    
    // Add to mock database
    this.mockUsers[email] = newUser;
    this.mockPasswords[email] = password;
    
    const accessToken = 'mock_access_token_' + Date.now();
    const refreshToken = 'mock_refresh_token_' + Date.now();
    
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    
    return {
      success: true,
      data: {
        user: newUser,
        accessToken,
        refreshToken
      }
    };
  },

  async logout() {
    await this.delay(200);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  },

  async refreshToken() {
    await this.delay();
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken || !refreshToken.startsWith('mock_refresh_token_')) {
      throw new Error('Invalid refresh token');
    }
    
    const newAccessToken = 'mock_access_token_' + Date.now();
    const newRefreshToken = 'mock_refresh_token_' + Date.now();
    
    localStorage.setItem('accessToken', newAccessToken);
    localStorage.setItem('refreshToken', newRefreshToken);
    
    return {
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      }
    };
  },

  async getProfile() {
    await this.delay();
    const user = this.getCurrentUser();
    if (!user) {
      throw new Error('Not authenticated');
    }
    
    return {
      success: true,
      data: user
    };
  },

  async changePassword(currentPassword, newPassword) {
    await this.delay();
    const user = this.getCurrentUser();
    if (!user) {
      throw new Error('Not authenticated');
    }
    
    const storedPassword = this.mockPasswords[user.email];
    if (currentPassword !== storedPassword) {
      throw new Error('Current password is incorrect');
    }
    
    this.mockPasswords[user.email] = newPassword;
    
    return {
      success: true,
      message: 'Password changed successfully'
    };
  },

  async requestPasswordReset(email) {
    await this.delay();
    const user = this.mockUsers[email];
    if (!user) {
      throw new Error('User not found');
    }
    
    return {
      success: true,
      message: 'Password reset email sent (mock)'
    };
  },

  async resetPassword(token, newPassword) {
    await this.delay();
    // In a real implementation, you'd validate the token
    return {
      success: true,
      message: 'Password reset successfully (mock)'
    };
  },

  // Platform management (mock)
  async getPlatforms() {
    await this.delay();
    return {
      success: true,
      data: []
    };
  },

  async disconnectPlatform(platform) {
    await this.delay();
    return {
      success: true,
      message: `${platform} disconnected (mock)`
    };
  },

  async testConnection(platform) {
    await this.delay();
    return {
      success: true,
      data: { connected: false, message: 'Mock connection test' }
    };
  },

  // Utility methods
  isAuthenticated() {
    const token = localStorage.getItem('accessToken');
    return !!(token && token.startsWith('mock_access_token_'));
  },

  getCurrentUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  getAccessToken() {
    return localStorage.getItem('accessToken');
  },

  // OAuth (mock)
  async startOAuth(platform) {
    await this.delay();
    return {
      success: true,
      data: {
        authUrl: `https://mock-oauth.example.com/${platform}`,
        state: 'mock_state_' + Date.now()
      }
    };
  },

  async handleOAuthCallback(platform, code, state, oauthVerifier) {
    await this.delay();
    return {
      success: true,
      data: {
        platform,
        connected: true,
        profile: {
          id: 'mock_profile_id',
          name: 'Mock Profile',
          username: 'mockuser'
        }
      }
    };
  },

  async inviteUser(userData) {
    await this.delay();
    return {
      success: true,
      data: {
        invitationId: 'mock_invitation_' + Date.now(),
        email: userData.email,
        status: 'pending'
      }
    };
  }
};