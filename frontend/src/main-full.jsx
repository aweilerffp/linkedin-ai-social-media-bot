import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './hooks/useAuthFixed';
import AppFull from './AppFull';
import './index.css';

console.log('[MainFull] Starting full application with routing...');

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
  console.log('[MainFull] initApp called');
  const root = document.getElementById('root');
  
  if (!root) {
    console.error('[MainFull] Root element not found!');
    document.body.innerHTML = '<h1 style="color:red">Error: Root element not found</h1>';
    return;
  }
  
  console.log('[MainFull] Root element found, rendering full app...');
  
  try {
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <BrowserRouter>
              <AppFull />
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
            </BrowserRouter>
          </AuthProvider>
        </QueryClientProvider>
      </React.StrictMode>
    );
    console.log('[MainFull] Full application rendered successfully');
  } catch (error) {
    console.error('[MainFull] Error rendering app:', error);
    root.innerHTML = `<div style="color:red; padding:20px;">
      <h1>Error rendering application</h1>
      <pre>${error.stack}</pre>
    </div>`;
  }
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  console.log('[MainFull] DOM loading, waiting for DOMContentLoaded...');
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  console.log('[MainFull] DOM ready, initializing immediately...');
  initApp();
}