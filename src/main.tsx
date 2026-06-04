import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { inject } from '@vercel/analytics';
import App from './App.tsx';
import { ensureLatestAppVersion } from './version.ts';
import './index.css';

// Initialize Vercel Web Analytics
inject();

void ensureLatestAppVersion();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
