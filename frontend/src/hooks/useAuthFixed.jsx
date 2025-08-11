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
    console.log('[Auth] Checking authentication status...');
    
    try {
      // Set a maximum time for auth check
      const authCheckTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Auth check timeout')), 3000)
      );
      
      const authCheck = async () => {
        if (authService.isAuthenticated()) {
          console.log('[Auth] Token found, getting user data...');
          const userData = authService.getCurrentUser();
          console.log('[Auth] Current user from localStorage:', userData);
          if (userData) {
            setUser(userData);
            setIsAuthenticated(true);
            console.log('[Auth] User authenticated:', userData.email);
            
            // Try to verify token, but don't hang on it
            try {
              const profile = await Promise.race([
                authService.getProfile(),
                new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Profile fetch timeout')), 2000)
                )
              ]);
              setUser(profile.data);
              console.log('[Auth] Profile verified');
            } catch (error) {
              console.warn('[Auth] Profile verification failed, using cached data:', error.message);
              // Continue with cached user data
            }
          }
        } else {
          console.log('[Auth] No valid token found');
        }
      };
      
      await Promise.race([authCheck(), authCheckTimeout]);
      
    } catch (error) {
      console.error('[Auth] Auth check error:', error.message);
      // On any error, just proceed as unauthenticated
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
      console.log('[Auth] Auth check complete');
    }
  };

  const login = async (email, password) => {
    console.log('[Auth] Attempting login...');
    setIsLoading(true);
    try {
      const response = await authService.login(email, password);
      console.log('[Auth] Login response:', response);
      
      // AuthService returns response.data, which has structure: { data: { user, accessToken, refreshToken } }
      const userData = response.data.user;
      console.log('[Auth] User data from login:', userData);
      
      if (userData) {
        setUser(userData);
        setIsAuthenticated(true);
        console.log('[Auth] Login successful, user set:', userData.email);
      } else {
        console.error('[Auth] Login response missing user data');
        throw new Error('Login response missing user data');
      }
      
      return response;
    } catch (error) {
      console.error('[Auth] Login failed:', error);
      setIsAuthenticated(false);
      setUser(null);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    console.log('[Auth] Logging out...');
    authService.logout();
    setUser(null);
    setIsAuthenticated(false);
  };

  const value = {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
  };

  console.log('[Auth] Rendering AuthProvider, isLoading:', isLoading, 'isAuthenticated:', isAuthenticated);
  
  // ALWAYS render children, never return null or hang
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