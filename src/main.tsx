import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register Service Worker for offline map tiles & assets
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('UENR Nav ServiceWorker active:', reg.scope);
      })
      .catch((err) => {
        console.warn('UENR Nav ServiceWorker notice:', err);
      });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
