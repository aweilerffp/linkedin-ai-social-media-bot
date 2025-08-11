import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './hooks/useAuth';
import App from './App';
import './index.css';

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

console.log('[Main] Starting app initialization...');

function initApp() {
  console.log('[Main] initApp called');
  const root = document.getElementById('root');
  
  if (!root) {
    console.error('[Main] Root element not found!');
    document.body.innerHTML = '<h1 style="color:red">Error: Root element not found</h1>';
    return;
  }
  
  console.log('[Main] Root element found, rendering app...');
  
  try {
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <BrowserRouter>
              <App />
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
            <ReactQueryDevtools initialIsOpen={false} />
          </AuthProvider>
        </QueryClientProvider>
      </React.StrictMode>
    );
    console.log('[Main] App rendered successfully');
  } catch (error) {
    console.error('[Main] Error rendering app:', error);
    root.innerHTML = `<div style="color:red; padding:20px;">
      <h1>Error rendering application</h1>
      <pre>${error.stack}</pre>
    </div>`;
  }
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  console.log('[Main] DOM loading, waiting for DOMContentLoaded...');
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  console.log('[Main] DOM ready, initializing immediately...');
  initApp();
}