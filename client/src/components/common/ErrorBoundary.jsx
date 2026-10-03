import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px 20px',
          maxWidth: '700px',
          margin: '40px auto',
          textAlign: 'center',
          backgroundColor: '#FFFFFF',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          border: '1px solid var(--danger-border)'
        }}>
          <div style={{
            width: 50,
            height: 50,
            borderRadius: '50%',
            backgroundColor: 'var(--danger-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            color: 'var(--danger)'
          }}>
            <AlertTriangle size={28} />
          </div>
          <h2 style={{ color: 'var(--danger)', fontSize: '1.25rem', marginBottom: '8px' }}>
            {this.props.fallbackTitle || 'A display error occurred while loading this section.'}
          </h2>
          <div style={{
            backgroundColor: 'var(--bg-subtle, #F8FAFC)',
            border: '1px solid var(--danger-border, #FECACA)',
            borderRadius: 'var(--radius-sm, 6px)',
            padding: '12px',
            margin: '0 auto 20px',
            textAlign: 'left',
            fontFamily: 'monospace',
            fontSize: '0.82rem',
            color: 'var(--danger, #DC2626)',
            wordBreak: 'break-word',
            maxHeight: '160px',
            overflowY: 'auto'
          }}>
            {this.state.error?.message || String(this.state.error) || 'An unexpected rendering exception was caught.'}
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              className="btn btn-secondary"
              onClick={() => {
                this.setState({ hasError: false, error: null });
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <span>Dismiss & Retry</span>
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <RefreshCw size={15} />
              <span>Reload Page</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
