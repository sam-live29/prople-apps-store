import React from 'react';

/**
 * SearchResultRowSkeleton
 * Sized identically to renderAppRow in SearchResultsPage.tsx
 * Eliminates layout shifts when new apps append during pagination.
 */
export default function SearchResultRowSkeleton() {
  return (
    <div className="w-full flex items-center gap-3 py-2.5 select-none bg-transparent animate-pulse pointer-events-none">
      {/* App List Icon Placeholder (56px mobile, 64px sm) */}
      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden shrink-0 bg-theme-hover/90 dark:bg-white/[0.06] shadow-xs" />

      {/* Middle App Information Placeholder */}
      <div className="flex-1 min-w-0 flex flex-col justify-center space-y-1.5">
        <div className="w-36 sm:w-44 h-4 rounded bg-theme-border/60" />
        <div className="w-24 sm:w-32 h-3 rounded bg-theme-border/40" />
        <div className="flex items-center gap-2">
          <div className="w-10 h-3 rounded bg-theme-border/50" />
          <div className="w-1.5 h-1.5 rounded-full bg-theme-border/40" />
          <div className="w-12 h-3 rounded bg-theme-border/40" />
          <div className="w-1.5 h-1.5 rounded-full bg-theme-border/40" />
          <div className="w-14 h-3 rounded bg-theme-border/30" />
        </div>
      </div>

      {/* Dropdown Chevron Toggle Placeholder */}
      <div className="shrink-0">
        <div className="w-8 h-8 rounded-full bg-theme-hover/70" />
      </div>
    </div>
  );
}
