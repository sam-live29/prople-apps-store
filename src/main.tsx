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

  // Purge any stale preserved claimed name if it is a personal/generic placeholder
  const preservedName = localStorage.getItem('prople_preserved_claimed_name');
  if (preservedName && ['sam', 'sammy', 'undefined', 'null'].includes(preservedName.trim().toLowerCase())) {
    localStorage.removeItem('prople_preserved_claimed_name');
  }

  // Sanitize stored unauthenticated user profile if it had 'sam' or 'sammy'
  const rawUser = localStorage.getItem('appmarket_user_profile');
  if (rawUser) {
    try {
      const parsed = JSON.parse(rawUser);
      if (parsed && typeof parsed === 'object') {
        const dName = (parsed.displayName || '').trim().toLowerCase();
        const pName = (parsed.publisherName || '').trim().toLowerCase();
        if (dName === 'sam' || dName === 'sammy' || pName === 'sam' || pName === 'sammy') {
          if (!parsed.email) {
            localStorage.removeItem('appmarket_user_profile');
          } else {
            parsed.displayName = 'User';
            parsed.publisherName = 'User';
            localStorage.setItem('appmarket_user_profile', JSON.stringify(parsed));
          }
        }
      }
    } catch {}
  }
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

const rootElement = document.getElementById('root');
if (rootElement) {
  // Clear any pre-rendered crawler shell markup before React client mounts
  if (rootElement.hasChildNodes()) {
    rootElement.innerHTML = '';
  }
  createRoot(rootElement).render(
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
}
