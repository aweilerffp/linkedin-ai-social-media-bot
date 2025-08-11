import React from 'react';
import ReactDOM from 'react-dom/client';

console.log('main-simple.jsx loading...');

function SimpleApp() {
  console.log('SimpleApp rendering');
  return (
    <div style={{ padding: '20px', background: '#f0f9ff', minHeight: '100vh', fontFamily: 'Arial' }}>
      <h1 style={{ color: '#1e40af' }}>✅ React is Working!</h1>
      <p>If you can see this, the app is rendering correctly.</p>
      <p>Time: {new Date().toLocaleTimeString()}</p>
      <button 
        onClick={() => {
          alert('Button clicked!');
          console.log('Button was clicked');
        }}
        style={{
          background: '#3b82f6',
          color: 'white',
          padding: '10px 20px',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        Test Button
      </button>
    </div>
  );
}

console.log('About to render SimpleApp...');

// Ensure DOM is loaded
function init() {
  console.log('Init function called');
  const root = document.getElementById('root');
  if (root) {
    console.log('Root element found:', root);
    try {
      ReactDOM.createRoot(root).render(
        <React.StrictMode>
          <SimpleApp />
        </React.StrictMode>
      );
      console.log('Render called successfully');
    } catch (error) {
      console.error('Error during render:', error);
      root.innerHTML = `<div style="color:red">Error: ${error.message}</div>`;
    }
  } else {
    console.error('Root element not found!');
    document.body.innerHTML += '<div style="color:red">Root element not found!</div>';
  }
}

// Wait for DOM
if (document.readyState === 'loading') {
  console.log('DOM not ready, waiting...');
  document.addEventListener('DOMContentLoaded', init);
} else {
  console.log('DOM ready, initializing...');
  init();
}