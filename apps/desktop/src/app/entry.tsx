import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../shared/i18n';

import { App } from './App';
import './global.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Missing renderer root element.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
