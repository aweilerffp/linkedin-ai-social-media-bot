function TestApp() {
  return (
    <div style={{ padding: '20px', background: '#f0f0f0', minHeight: '100vh' }}>
      <h1 style={{ color: '#333' }}>🎉 React is Working!</h1>
      <p>If you can see this, React is rendering properly.</p>
      <button 
        onClick={() => alert('Button clicked!')}
        style={{ 
          background: '#3b82f6', 
          color: 'white', 
          padding: '10px 20px',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        Click Me
      </button>
    </div>
  );
}

export default TestApp;