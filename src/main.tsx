import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { inject } from '@vercel/analytics';
import AppBoot from './components/AppBoot.tsx';
import './index.css';

// Initialize Vercel Web Analytics
inject();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppBoot />
  </StrictMode>,
);
