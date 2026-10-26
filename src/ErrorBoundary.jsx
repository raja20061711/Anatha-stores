import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '32px', fontFamily: 'sans-serif', backgroundColor: '#F3F6FA', minHeight: '100vh' }}>
          <div style={{ maxWidth: '800px', margin: '0 auto', background: '#FFFFFF', padding: '24px', borderRadius: '12px', border: '1px solid #D9E2EF', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
            <h1 style={{ color: '#DC2626', fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>
              ANANTHA STORE — UI Error
            </h1>
            <p style={{ color: '#64748B', fontSize: '14px', marginBottom: '16px' }}>
              The application encountered an unexpected error:
            </p>
            <pre style={{ backgroundColor: '#FEF2F2', color: '#991B1B', padding: '16px', borderRadius: '8px', fontSize: '13px', overflowX: 'auto', marginBottom: '16px' }}>
              {this.state.error?.toString()}
            </pre>
            <button
              onClick={() => window.location.reload()}
              style={{ backgroundColor: '#F97316', color: 'white', padding: '10px 20px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Reload Interface
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
