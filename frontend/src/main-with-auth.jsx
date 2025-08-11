import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './hooks/useAuthFixed';
import AppWithAuth from './AppWithAuth';
import './index.css';

console.log('[MainAuth] Starting app with authentication...');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      cacheTime: 1000 * 60 * 10, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function initApp() {
  console.log('[MainAuth] initApp called');
  const root = document.getElementById('root');
  
  if (!root) {
    console.error('[MainAuth] Root element not found!');
    document.body.innerHTML = '<h1 style="color:red">Error: Root element not found</h1>';
    return;
  }
  
  console.log('[MainAuth] Root element found, rendering app with auth...');
  
  try {
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <AppWithAuth />
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#363636',
                  color: '#fff',
                },
                success: {
                  duration: 3000,
                  iconTheme: {
                    primary: '#10b981',
                    secondary: '#fff',
                  },
                },
                error: {
                  duration: 5000,
                  iconTheme: {
                    primary: '#ef4444',
                    secondary: '#fff',
                  },
                },
              }}
            />
          </AuthProvider>
        </QueryClientProvider>
      </React.StrictMode>
    );
    console.log('[MainAuth] App with authentication rendered successfully');
  } catch (error) {
    console.error('[MainAuth] Error rendering app:', error);
    root.innerHTML = `<div style="color:red; padding:20px;">
      <h1>Error rendering application</h1>
      <pre>${error.stack}</pre>
    </div>`;
  }
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  console.log('[MainAuth] DOM loading, waiting for DOMContentLoaded...');
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  console.log('[MainAuth] DOM ready, initializing immediately...');
  initApp();
}