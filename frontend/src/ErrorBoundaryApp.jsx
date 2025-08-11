import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', background: '#fee', color: '#c00' }}>
          <h1>Something went wrong!</h1>
          <pre>{this.state.error?.toString()}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}

function ErrorBoundaryApp() {
  console.log('ErrorBoundaryApp rendering');
  
  return (
    <ErrorBoundary>
      <div style={{ padding: '20px', background: '#efe', minHeight: '100vh' }}>
        <h1>✅ App is rendering!</h1>
        <p>React version: {React.version}</p>
        <p>Current time: {new Date().toLocaleTimeString()}</p>
      </div>
    </ErrorBoundary>
  );
}

export default ErrorBoundaryApp;