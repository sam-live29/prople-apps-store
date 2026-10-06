import React from 'react';
import { useInstall } from '../context/InstallContext';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isNavVisible?: boolean;
}

/**
 * Pixel-accurate, authentic Google Play Store bottom navigation icons.
 * Zero animations, instantaneous native-feel state transitions.
 */

// 1. Games: Exact Play Store outlined controller with left D-pad '+' and right 4-dot diamond
function GamesIcon({ isActive }: { isActive: boolean }) {
  if (isActive) {
    return (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M6 6.5h12c1.93 0 3.5 1.57 3.5 3.5v4.5c0 2.2-1.78 3.98-3.98 3.98-.95 0-1.84-.36-2.52-1.02L13.6 16a2 2 0 0 0-1.6-.8h-.4a2 2 0 0 0-1.6.8l-1.4 1.46c-.68.66-1.57 1.02-2.52 1.02C5.28 18.48 3.5 16.7 3.5 14.5V10c0-1.93 1.57-3.5 3.5-3.5zm2.75 6.25H10v-1.5H8.75V10h-1.5v1.25H6v1.5h1.25V14h1.5v-1.25zm7.75-1.95a.85.85 0 1 0 0-1.7.85.85 0 0 0 0 1.7zm2 2a.85.85 0 1 0 0-1.7.85.85 0 0 0 0 1.7zm-2 2a.85.85 0 1 0 0-1.7.85.85 0 0 0 0 1.7zm-2-2a.85.85 0 1 0 0-1.7.85.85 0 0 0 0 1.7z"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 7h12c1.66 0 3 1.34 3 3v4.5c0 1.93-1.57 3.5-3.5 3.5-.8 0-1.54-.3-2.1-.85L13.8 15.6a2 2 0 0 0-1.6-.6h-.4a2 2 0 0 0-1.6.6l-1.6 1.55c-.56.55-1.3.85-2.1.85C4.57 18 3 16.43 3 14.5V10c0-1.66 1.34-3 3-3z" />
      <path d="M8 10v4M6 12h4" strokeWidth="2" />
      <circle cx="16.5" cy="9.5" r="0.85" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="11.5" r="0.85" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="13.5" r="0.85" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="11.5" r="0.85" fill="currentColor" stroke="none" />
    </svg>
  );
}

// 2. Apps: Exact Play Store 4 rounded squares in 2x2 grid
function AppsIcon({ isActive }: { isActive: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
      <rect x="4" y="4" width="6.5" height="6.5" rx="2" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="2" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="2" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="2" />
    </svg>
  );
}

// 3. Search: Exact Play Store clean outlined magnifying glass
function SearchIcon({ isActive }: { isActive: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={isActive ? '2.4' : '2'}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="6" />
      <path d="m15.5 15.5 4.5 4.5" />
    </svg>
  );
}

// 4. You: Exact Play Store user profile silhouette
function YouIcon({ isActive }: { isActive: boolean }) {
  if (isActive) {
    return (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <circle cx="12" cy="8" r="4" />
        <path d="M12 14c-3.87 0-7 2.13-7 5v1h14v-1c0-2.87-3.13-5-7-5z" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M5 20c0-3.87 3.13-7 7-7s7 3.13 7 7" />
    </svg>
  );
}

const NAV_ITEMS = [
  { id: 'games', label: 'Games', component: GamesIcon },
  { id: 'apps', label: 'Apps', component: AppsIcon },
  { id: 'search', label: 'Search', component: SearchIcon },
  { id: 'you', label: 'You', component: YouIcon },
] as const;

export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const { unreadNotificationsCount, updatesAvailableCount } = useInstall();
  const hasAlerts = unreadNotificationsCount + updatesAvailableCount > 0;

  return (
    <nav
      className="w-full h-[66px] bg-theme-nav border-t border-theme-border/20 grid grid-cols-4 items-center px-1 z-40 shrink-0 pb-[env(safe-area-inset-bottom,0px)] box-content select-none"
      role="navigation"
      aria-label="Main navigation"
    >
      {NAV_ITEMS.map((item) => {
        const isActive = activeTab === item.id;
        const IconComponent = item.component;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onTabChange(item.id)}
            className="relative flex flex-col items-center justify-center min-h-[52px] cursor-pointer focus:outline-hidden"
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
          >
            {/* Pill Container: Stadium oval pill in active state */}
            <div
              className={`relative w-16 h-8 rounded-full flex items-center justify-center ${
                isActive
                  ? 'bg-[#c2e7ff] dark:bg-[#004a77] text-[#001d35] dark:text-[#c2e7ff]'
                  : 'bg-transparent text-[#444746] dark:text-[#c4c7c5]'
              }`}
            >
              <IconComponent isActive={isActive} />

              {/* Notification Badge for 'You' */}
              {item.id === 'you' && hasAlerts && (
                <span className="absolute top-1 right-3.5 w-2 h-2 rounded-full bg-[#0b57d0] dark:bg-[#8ab4f8] ring-1.5 ring-theme-nav" />
              )}
            </div>

            {/* Label below pill */}
            <span
              className={`text-[12px] leading-none tracking-normal font-google-sans-text mt-1 ${
                isActive
                  ? 'text-[#001d35] dark:text-[#c2e7ff] font-medium'
                  : 'text-[#444746] dark:text-[#c4c7c5] font-medium'
              }`}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
