import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register Service Worker for true offline caching & updates
if ('serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log('New PVT Analysis System update available.');
    },
    onOfflineReady() {
      console.log('PVT Analysis System is fully cached and ready for offline use.');
    },
  });
}

createRoot(document.getElementById('root')!).render(<App />);

