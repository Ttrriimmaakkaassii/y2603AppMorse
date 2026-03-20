import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(err) {
    return { error: err };
  }

  componentDidCatch(err, info) {
    console.error('[ErrorBoundary] Caught render error:', err);
    console.error('[ErrorBoundary] Component stack:', info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: '24px 16px', textAlign: 'center',
          color: '#f87171', fontFamily: 'Courier New, monospace',
          background: '#1a0a0a', borderRadius: 12,
          border: '1px solid #4a2020', margin: 16,
        }}>
          <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>⚠ Component Error</div>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: 16,
            wordBreak: 'break-all', maxWidth: 400, margin: '0 auto 16px' }}>
            {this.state.error?.message || String(this.state.error)}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              background: '#3a1a1a', border: '1px solid #f87171', color: '#f87171',
              borderRadius: 8, padding: '8px 20px', cursor: 'pointer',
              fontFamily: 'Courier New, monospace',
            }}
          >
            ↺ Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
