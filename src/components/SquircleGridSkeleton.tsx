import React from 'react';

/**
 * SquircleGridSkeleton
 * Used in SimilarAppsPage, Explore, and Category views when loading more apps.
 */
export default function SquircleGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(112px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(124px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(136px,1fr))] gap-x-4 sm:gap-x-6 gap-y-7 justify-items-center w-full animate-pulse pointer-events-none mt-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="w-[96px] sm:w-[112px] md:w-[124px] lg:w-[136px] flex flex-col items-start select-none"
        >
          <div className="w-[96px] h-[96px] sm:w-[112px] sm:h-[112px] md:w-[124px] md:h-[124px] lg:w-[136px] lg:h-[136px] rounded-[22px] sm:rounded-[26px] bg-theme-hover/90 dark:bg-white/[0.06] mb-2 shadow-xs" />
          <div className="w-18 sm:w-20 h-3.5 rounded bg-theme-border/60 mb-1" />
          <div className="w-12 h-3 rounded bg-theme-border/40" />
        </div>
      ))}
    </div>
  );
}
