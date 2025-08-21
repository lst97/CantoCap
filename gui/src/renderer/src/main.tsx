import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/App.css';
import { createComponentLogger } from './utils/logger';

const logger = createComponentLogger('Main');

// Debug logging for React mounting
logger.info('🔄 Starting React application mount...');

const root = document.getElementById('root');
if (!root) {
  logger.error('❌ Root element not found');
  throw new Error('Root element not found');
}

logger.info('✅ Root element found, creating React root...');

// First try a minimal React component to isolate the issue
function MinimalTest() {
  logger.info('✅ MinimalTest component rendering');
  return React.createElement(
    'div',
    {
      style: {
        padding: '20px',
        background: '#e8f5e8',
        color: '#2d5016',
        fontFamily: 'monospace',
        border: '2px solid #4caf50',
      },
    },
    '✅ REACT MOUNTED SUCCESSFULLY - Minimal test component working!'
  );
}

try {
  logger.info('🔄 Creating React root...');
  const reactRoot = ReactDOM.createRoot(root);
  logger.info('✅ React root created successfully');

  logger.info('🔄 Testing minimal React component first...');
  reactRoot.render(React.createElement(MinimalTest));
  logger.info('✅ Minimal React component rendered');

  // Wait 2 seconds then try full App
  setTimeout(() => {
    logger.info('🔄 Now attempting full App component render...');
    try {
      reactRoot.render(React.createElement(React.StrictMode, null, React.createElement(App)));
      logger.info('✅ Full App component render initiated');
    } catch (appError) {
      logger.error('❌ Error rendering full App component:', {
        error: appError instanceof Error ? appError.message : String(appError),
      });

      // Show App error but keep minimal component visible
      root.innerHTML += `
        <div style="padding: 20px; font-family: monospace; background: #fee; color: #c00; margin-top: 10px; border: 2px solid #f44336;">
          <h3>App Component Error</h3>
          <p>Minimal React works, but full App failed:</p>
          <pre>${appError instanceof Error ? appError.message : String(appError)}</pre>
          <pre>${appError instanceof Error ? appError.stack : ''}</pre>
        </div>
      `;
    }
  }, 2000);
} catch (error) {
  logger.error('❌ Fatal error during React root creation:', {
    error: error instanceof Error ? error.message : String(error),
  });

  // Fallback error display
  root.innerHTML = `
    <div style="padding: 20px; font-family: monospace; background: #fee; color: #c00;">
      <h3>React Root Creation Error</h3>
      <p>Failed to create React root.</p>
      <pre>${error instanceof Error ? error.message : String(error)}</pre>
      <pre>${error instanceof Error ? error.stack : ''}</pre>
      <p>Check the console for more details.</p>
    </div>
  `;
}
