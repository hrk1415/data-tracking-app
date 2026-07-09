import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Intercept and silence MetaMask or other extension-related unhandled exceptions
if (typeof window !== 'undefined') {
  const isMetaMaskOrExtensionError = (message: any, stack: any): boolean => {
    const msgStr = typeof message === 'string' ? message.toLowerCase() : '';
    const stackStr = typeof stack === 'string' ? stack.toLowerCase() : '';
    return (
      msgStr.includes('metamask') ||
      msgStr.includes('ethereum') ||
      msgStr.includes('wallet') ||
      msgStr.includes('provider') ||
      msgStr.includes('rpc') ||
      msgStr.includes('failed to connect') ||
      stackStr.includes('chrome-extension') ||
      stackStr.includes('moz-extension')
    );
  };

  window.addEventListener('error', (event) => {
    const message = event.message || (event.error && event.error.message) || '';
    const stack = (event.error && event.error.stack) || '';
    if (isMetaMaskOrExtensionError(message, stack)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason || {};
    const message = reason.message || (typeof reason === 'string' ? reason : '');
    const stack = reason.stack || '';
    if (isMetaMaskOrExtensionError(message, stack)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

