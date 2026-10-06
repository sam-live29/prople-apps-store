import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext';
import { InstallProvider } from './context/InstallContext';
import { StoreConfigProvider } from './context/StoreConfigContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { ReviewProvider } from './context/ReviewContext';
import { NavigationProvider } from './context/NavigationContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';
import './firebase';

// Early theme initialization from stored preference
try {
  const saved = localStorage.getItem('app-theme');
  const isDark = saved === 'light' ? false : true;
  const docEl = document.documentElement;
  if (isDark) {
    docEl.classList.add('dark');
    docEl.classList.remove('light');
    docEl.style.backgroundColor = '#131314';
    docEl.style.colorScheme = 'dark';
    const meta = document.getElementById('theme-color-meta');
    if (meta) meta.setAttribute('content', '#131314');
  } else {
    docEl.classList.remove('dark');
    docEl.classList.add('light');
    docEl.style.backgroundColor = '#ffffff';
    docEl.style.colorScheme = 'light';
    const meta = document.getElementById('theme-color-meta');
    if (meta) meta.setAttribute('content', '#ffffff');
  }
} catch {
  // Graceful fallback if localStorage is restricted
}

// Purge stale client-side caches to guarantee instant UI updates across code pushes
try {
  const staleStorageKeys = [
    'appmarket_published_apps_cache',
    'appmarket_custom_banners',
    'appmarket_custom_sections'
  ];
  staleStorageKeys.forEach((key) => {
    try { localStorage.removeItem(key); } catch {}
  });
} catch {}

// Purge any stale Workbox/PWA precaches in CacheStorage
if (typeof window !== 'undefined' && 'caches' in window) {
  caches.keys().then((names) => {
    names.forEach((name) => {
      if (name.includes('precache') || name.includes('workbox') || name.includes('app-cache')) {
        caches.delete(name);
      }
    });
  }).catch(() => {});
}

// Progressive Web App Service Worker registration
if ('serviceWorker' in navigator && typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((reg) => {
        reg.update().catch(() => {});
      })
      .catch((err) => {
        console.warn('Prople SW registration warning:', err);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <StoreConfigProvider>
              <NavigationProvider>
                <InstallProvider>
                  <ReviewProvider>
                    <App />
                  </ReviewProvider>
                </InstallProvider>
              </NavigationProvider>
            </StoreConfigProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);
