import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './ui/App';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { registerServiceWorker } from './registerServiceWorker';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary
      fallbackTitle="Error en CadCat"
      fallbackDescription="Ocurrió un problema inesperado al renderizar la aplicación. Tus proyectos y catálogos siguen guardados en IndexedDB."
    >
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);

void registerServiceWorker();
