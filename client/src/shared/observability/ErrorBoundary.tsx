import React, { Component, type ErrorInfo, type ReactNode } from 'react';

import { reportClientError } from './telemetry';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// Top-level React error boundary: reports render crashes to the backend
// observability endpoint and shows a recoverable fallback instead of a
// white screen.
class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    reportClientError({
      source: 'react-error-boundary',
      message: error.message,
      stack: `${error.stack || ''}\n\nComponent stack:${errorInfo.componentStack || ''}`,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="d-flex flex-column align-items-center justify-content-center vh-100 text-center p-4">
          <h4>Something went wrong</h4>
          <p className="text-muted">
            The error has been reported automatically. Please reload the page and try again.
          </p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
