import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './app/App';
import ErrorBoundary from './shared/observability/ErrorBoundary';
import { initTelemetry } from './shared/observability/telemetry';
import './shared/styles/index.css';

initTelemetry();

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
