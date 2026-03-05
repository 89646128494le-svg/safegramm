import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      const isDesktop = typeof window !== 'undefined' && !!(window as any).electronAPI;
      const handleRetry = () => {
        if (isDesktop && this.props.onRetry) this.props.onRetry();
        else window.location.reload();
      };
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            background: 'var(--bg-primary, #0f172a)',
            color: 'var(--text-primary, #e2e8f0)',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <h1 style={{ fontSize: 20, marginBottom: 12 }}>Что-то пошло не так</h1>
          <p style={{ color: 'var(--text-secondary, #94a3b8)', marginBottom: 24, textAlign: 'center' }}>
            {isDesktop ? 'Вернитесь на экран входа.' : 'Обновите страницу или вернитесь назад.'}
          </p>
          <button type="button" onClick={handleRetry} style={{ padding: '10px 20px', background: 'var(--accent, #3b82f6)', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 14 }}>
            {isDesktop ? 'На экран входа' : 'Обновить страницу'}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
