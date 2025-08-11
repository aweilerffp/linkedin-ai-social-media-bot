import { useState, useEffect, createContext, useContext } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      if (authService.isAuthenticated()) {
        const userData = authService.getCurrentUser();
        if (userData) {
          setUser(userData);
          setIsAuthenticated(true);
          
          // Verify token is still valid by getting profile
          try {
            const profile = await Promise.race([
              authService.getProfile(),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
              )
            ]);
            setUser(profile.data);
          } catch (error) {
            console.warn('Profile verification failed:', error.message);
            // Don't logout immediately - the cached user data might still be valid
            // Just continue with cached data
          }
        }
      }
    } catch (error) {
      console.error('Auth check error:', error);
      // Don't logout on initial check errors - just proceed as unauthenticated
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email, password) => {
    setIsLoading(true);
    try {
      const response = await authService.login(email, password);
      setIsAuthenticated(true);
      setUser(response.data.user);
      return { success: true, data: response.data };
    } catch (error) {
      const message = error.response?.data?.error || error.message || 'Login failed';
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData) => {
    setIsLoading(true);
    try {
      const response = await authService.register(userData);
      setIsAuthenticated(true);
      setUser(response.data.user);
      return { success: true, data: response.data };
    } catch (error) {
      const message = error.response?.data?.error || error.message || 'Registration failed';
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.warn('Logout error:', error);
    } finally {
      setIsAuthenticated(false);
      setUser(null);
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      await authService.changePassword(currentPassword, newPassword);
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.error || error.message || 'Password change failed';
      return { success: false, error: message };
    }
  };

  const updateProfile = async (profileData) => {
    try {
      // This would need to be implemented in the backend
      // For now, just update local state
      setUser({ ...user, ...profileData });
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.error || error.message || 'Profile update failed';
      return { success: false, error: message };
    }
  };

  const value = {
    isAuthenticated,
    isLoading,
    user,
    login,
    register,
    logout,
    changePassword,
    updateProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}