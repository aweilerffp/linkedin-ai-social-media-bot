import React from 'react';
import ReactDOM from 'react-dom/client';
import AppNoAuth from './AppNoAuth';
import './index.css';

console.log('[MainNoAuth] Starting app initialization...');

function initApp() {
  console.log('[MainNoAuth] initApp called');
  const root = document.getElementById('root');
  
  if (!root) {
    console.error('[MainNoAuth] Root element not found!');
    document.body.innerHTML = '<h1 style="color:red">Error: Root element not found</h1>';
    return;
  }
  
  console.log('[MainNoAuth] Root element found, rendering app...');
  
  try {
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <AppNoAuth />
      </React.StrictMode>
    );
    console.log('[MainNoAuth] App rendered successfully');
  } catch (error) {
    console.error('[MainNoAuth] Error rendering app:', error);
    root.innerHTML = `<div style="color:red; padding:20px;">
      <h1>Error rendering application</h1>
      <pre>${error.stack}</pre>
    </div>`;
  }
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  console.log('[MainNoAuth] DOM loading, waiting for DOMContentLoaded...');
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  console.log('[MainNoAuth] DOM ready, initializing immediately...');
  initApp();
}