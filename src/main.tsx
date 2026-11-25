import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { installAuthNavigationDiagnostics } from './lib/authDiagnostics';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

installAuthNavigationDiagnostics();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
