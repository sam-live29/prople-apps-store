import React from 'react';

export function HeroSpotlightSkeleton({ isGames = false }: { isGames?: boolean }) {
  return (
    <div className="w-full pt-1 pb-1 relative group select-none">
      <div className="flex gap-2.5 sm:gap-4 overflow-x-auto scrollbar-hide px-2.5 sm:px-4 md:px-6 py-2 sm:py-3 overscroll-x-contain">
        {[1, 2].map((idx) => (
          <div
            key={idx}
            className="group relative w-[calc(100vw-28px)] sm:w-[500px] md:w-[560px] lg:w-[620px] shrink-0 border-0 border-none bg-transparent shadow-none flex flex-col select-none"
          >
            {/* Top Banner Graphic (16:9 Aspect Ratio with rounded corners) */}
            <div className="relative z-10 aspect-[16/9] w-full rounded-[24px] sm:rounded-[26px] overflow-hidden bg-neutral-200 dark:bg-neutral-800/80 shrink-0">
              {/* Top Spotlight Badge Pill placeholder */}
              <div className="absolute top-3 left-3 sm:top-3.5 sm:left-3.5 z-20">
                <div className="h-6 w-20 sm:w-24 rounded-full bg-white/70 dark:bg-white/20 backdrop-blur-md shadow-xs" />
              </div>

              {/* Bottom Headline Text overlay */}
              <div className="absolute inset-x-0 bottom-0 pb-3.5 px-3.5 sm:px-4 z-20 flex flex-col justify-end gap-1.5">
                <div className="h-4 sm:h-[18px] w-4/5 rounded-md bg-white/60 dark:bg-white/30" />
                <div className="h-3.5 sm:h-4 w-1/2 rounded-md bg-white/40 dark:bg-white/20" />
              </div>
            </div>

            {/* Connected Bottom App Identity & Action Card */}
            <div className="relative z-0 -mt-3.5 sm:-mt-4 pt-5.5 sm:pt-6 pb-3 sm:pb-3.5 px-3.5 sm:px-4 w-full rounded-b-[24px] sm:rounded-b-[26px] rounded-t-none overflow-hidden flex items-center justify-between gap-3 bg-[#e8eaed] dark:bg-[#1e1f23] border-0 border-none shadow-none min-w-0">
              {/* Left: App Icon & Details */}
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-[15px] sm:rounded-[16px] bg-neutral-300 dark:bg-neutral-700/70 shrink-0 shadow-xs" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="h-4 w-32 sm:w-40 rounded bg-neutral-300 dark:bg-neutral-700/80" />
                  <div className="h-3 w-20 sm:w-28 rounded bg-neutral-300/80 dark:bg-neutral-700/50" />
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="h-3 w-8 rounded bg-neutral-300/80 dark:bg-neutral-700/50" />
                    <div className="h-1.5 w-1.5 rounded-full bg-neutral-300/60 dark:bg-neutral-700/40" />
                    <div className="h-3 w-12 rounded bg-neutral-300/70 dark:bg-neutral-700/45" />
                    <div className="h-1.5 w-1.5 rounded-full bg-neutral-300/60 dark:bg-neutral-700/40" />
                    <div className="h-3 w-10 rounded bg-neutral-300/60 dark:bg-neutral-700/40" />
                  </div>
                </div>
              </div>

              {/* Right: Install Action Button */}
              <div className="min-w-[82px] sm:min-w-[88px] h-8 sm:h-8.5 rounded-full bg-[#0b57d0]/25 dark:bg-[#a8c7fa]/25 shrink-0" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ColumnStackSkeleton({ title }: { title?: string }) {
  return (
    <section className="w-full py-2">
      {/* Section Header */}
      <div className="flex justify-between items-start mb-3 px-2.5 sm:px-4 md:px-6">
        <div className="flex flex-col space-y-1">
          <div className="h-[20px] sm:h-[22px] w-48 sm:w-56 rounded-md bg-theme-hover">
            {title && <span className="sr-only">{title}</span>}
          </div>
          <div className="h-3 w-32 sm:w-40 rounded-md bg-theme-hover/70" />
        </div>
        <div className="w-8 h-8 rounded-full bg-theme-hover/60 shrink-0 mt-0.5" />
      </div>

      {/* Horizontal Carousel with 3-Row Columns */}
      <div className="flex gap-3.5 sm:gap-4 overflow-x-auto scrollbar-hide pb-2 px-2.5 sm:px-4 md:px-6 items-start w-full">
        {[1, 2, 3].map((colIdx) => (
          <div
            key={colIdx}
            className="w-[calc(100vw-32px)] max-w-[340px] sm:w-[340px] md:w-[360px] shrink-0 space-y-3.5"
          >
            {[1, 2, 3].map((rowIdx) => (
              <div
                key={rowIdx}
                className="flex items-center gap-3.5 py-1.5 pr-2.5 pl-0 rounded-xl"
              >
                {/* Squircle App Icon */}
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-[18px] bg-theme-hover shrink-0 shadow-xs border-0" />
                {/* Details Column */}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="h-4 w-36 sm:w-44 rounded bg-theme-hover" />
                  <div className="h-3 w-48 sm:w-56 rounded bg-theme-hover/70" />
                  {/* Clean Metadata Row (Rating, Size, Platform format) */}
                  <div className="flex items-center gap-1.5">
                    <div className="h-3 w-10 rounded bg-theme-hover/80" />
                    <div className="h-1.5 w-1.5 rounded-full bg-theme-hover/50" />
                    <div className="h-3 w-12 rounded bg-theme-hover/60" />
                    <div className="h-1.5 w-1.5 rounded-full bg-theme-hover/50" />
                    <div className="h-3 w-8 rounded bg-theme-hover/60" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

export function LandscapeCardsSkeleton({ 
  title, 
  isVideoMode = false 
}: { 
  title?: string;
  isVideoMode?: boolean;
}) {
  return (
    <section className="w-full py-2">
      {/* Section Header */}
      <div className="flex justify-between items-start mb-3 px-2.5 sm:px-4 md:px-6">
        <div className="flex flex-col space-y-1">
          <div className="h-[20px] sm:h-[22px] w-44 sm:w-52 rounded-md bg-theme-hover">
            {title && <span className="sr-only">{title}</span>}
          </div>
          <div className="h-3 w-36 sm:w-44 rounded-md bg-theme-hover/70" />
        </div>
        <div className="w-8 h-8 rounded-full bg-theme-hover/60 shrink-0 mt-0.5" />
      </div>

      {/* Horizontal Carousel */}
      <div className="flex gap-3.5 sm:gap-4 overflow-x-auto scrollbar-hide pb-2 px-2.5 sm:px-4 md:px-6 items-start w-full">
        {[1, 2, 3].map((idx) => (
          <div
            key={idx}
            className="w-[calc(100vw-32px)] sm:w-[320px] md:w-[340px] shrink-0 flex flex-col"
          >
            {/* 16:9 Landscape / Video Thumbnail */}
            <div className="relative aspect-video w-full rounded-2xl bg-theme-hover shadow-xs mb-2.5 overflow-hidden flex items-center justify-center">
              {isVideoMode && (
                <div className="w-12 h-12 rounded-full bg-black/25 dark:bg-black/35 backdrop-blur-xs flex items-center justify-center shadow-sm">
                  <div className="w-4 h-4 rounded-xs bg-white/40 ml-0.5" />
                </div>
              )}
            </div>

            {/* App Info Row */}
            <div className="flex items-center gap-3 px-0.5">
              <div className="w-12 h-12 rounded-[14px] bg-theme-hover shrink-0 shadow-xs" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-4 w-32 sm:w-40 rounded bg-theme-hover" />
                <div className="h-3 w-20 sm:w-28 rounded bg-theme-hover/70" />
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-8 rounded bg-theme-hover/80" />
                  <div className="h-1.5 w-1.5 rounded-full bg-theme-hover/50" />
                  <div className="h-3 w-14 rounded bg-theme-hover/60" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SquircleRowSkeleton({ title, isTopRatedMode = false }: { title?: string; isTopRatedMode?: boolean }) {
  return (
    <section className="w-full py-2">
      {/* Section Header */}
      <div className="flex justify-between items-start mb-3 px-2.5 sm:px-4 md:px-6">
        <div className="flex flex-col space-y-1">
          <div className="h-[20px] sm:h-[22px] w-40 sm:w-48 rounded-md bg-theme-hover">
            {title && <span className="sr-only">{title}</span>}
          </div>
          <div className="h-3 w-28 sm:w-36 rounded-md bg-theme-hover/70" />
        </div>
        <div className="w-8 h-8 rounded-full bg-theme-hover/60 shrink-0 mt-0.5" />
      </div>

      {/* Horizontal Slider of Squircle App Icons */}
      <div className="flex gap-3.5 sm:gap-4 overflow-x-auto scrollbar-hide pb-2 px-2.5 sm:px-4 md:px-6 items-start w-full">
        {[1, 2, 3, 4, 5, 6].map((idx) => (
          <div
            key={idx}
            className="w-[92px] sm:w-[100px] md:w-[104px] shrink-0 flex flex-col items-start"
          >
            {/* Native Android Squircle App Icon (rounded-[22px]) */}
            <div className="w-[92px] h-[92px] sm:w-[100px] sm:h-[100px] md:w-[104px] md:h-[104px] rounded-[22px] bg-theme-hover shadow-xs mb-2 shrink-0" />
            {/* Title (1 line) */}
            <div className="h-3.5 w-20 sm:w-22 rounded bg-theme-hover mb-1" />
            {/* Subtitle with Rating or Size & Downloads */}
            <div className="flex items-center gap-1 w-full">
              <div className="h-3 w-8 rounded bg-theme-hover/80" />
              <div className="h-1.5 w-1.5 rounded-full bg-theme-hover/50" />
              <div className="h-3 w-10 rounded bg-theme-hover/60" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function EditorialCardSkeleton({ title }: { title?: string }) {
  return (
    <section className="w-full py-2">
      {/* Section Header */}
      <div className="flex justify-between items-start mb-3 px-2.5 sm:px-4 md:px-6">
        <div className="flex flex-col space-y-1">
          <div className="h-[20px] sm:h-[22px] w-52 sm:w-64 rounded-md bg-theme-hover">
            {title && <span className="sr-only">{title}</span>}
          </div>
          <div className="h-3 w-32 sm:w-40 rounded-md bg-theme-hover/70" />
        </div>
      </div>

      {/* Editorial Card Hero */}
      <div className="flex gap-3.5 sm:gap-4 overflow-x-auto scrollbar-hide pb-2 px-2.5 sm:px-4 md:px-6 items-start w-full">
        {[1, 2].map((idx) => (
          <div
            key={idx}
            className="w-[calc(100vw-28px)] sm:w-[480px] md:w-[540px] shrink-0 flex flex-col"
          >
            {/* 16:9 Banner Graphic */}
            <div className="aspect-[16/9] w-full rounded-[24px] sm:rounded-[26px] bg-theme-hover shadow-xs shrink-0 overflow-hidden" />

            {/* Connected Bottom App Info Card */}
            <div className="-mt-3.5 sm:-mt-4 pt-5.5 sm:pt-6 pb-3 sm:pb-3.5 px-3.5 sm:px-4 w-full rounded-b-[24px] sm:rounded-b-[26px] bg-[#e8eaed] dark:bg-[#1e1f23] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-[15px] sm:rounded-[16px] bg-neutral-300 dark:bg-neutral-700/70 shrink-0 shadow-xs" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="h-4 w-32 sm:w-40 rounded bg-neutral-300 dark:bg-neutral-700/80" />
                  <div className="h-3 w-24 sm:w-32 rounded bg-neutral-300/80 dark:bg-neutral-700/50" />
                  <div className="flex items-center gap-1.5">
                    <div className="h-3 w-8 rounded bg-neutral-300/80 dark:bg-neutral-700/50" />
                    <div className="h-1.5 w-1.5 rounded-full bg-neutral-300/60 dark:bg-neutral-700/40" />
                    <div className="h-3 w-10 rounded bg-neutral-300/70 dark:bg-neutral-700/45" />
                  </div>
                </div>
              </div>
              <div className="min-w-[82px] sm:min-w-[88px] h-8 sm:h-8.5 rounded-full bg-[#0b57d0]/25 dark:bg-[#a8c7fa]/25 shrink-0" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SearchSuggestionsSkeleton({ isGames = false }: { isGames?: boolean }) {
  const widthsRow1 = isGames 
    ? [140, 120, 160, 130, 150, 170] 
    : [130, 150, 120, 140, 160, 135];
  const widthsRow2 = isGames 
    ? [125, 155, 135, 145, 120, 165] 
    : [145, 125, 155, 130, 150, 140];

  return (
    <section className="w-full py-1">
      <div className="flex justify-between items-center mb-3 px-4 sm:px-6 md:px-8">
        <div className="h-5 w-48 rounded-md bg-theme-hover" />
        <div className="h-4 w-16 rounded-md bg-theme-hover/60" />
      </div>

      <div className="flex flex-col gap-2.5 overflow-x-auto scrollbar-hide py-1 px-4 sm:px-6 md:px-8 w-full">
        {/* Row 1 */}
        <div className="flex gap-2.5 shrink-0 items-center">
          {widthsRow1.map((w, idx) => (
            <div
              key={idx}
              style={{ width: `${w}px` }}
              className="h-8 sm:h-9 rounded-full bg-theme-card flex items-center px-3.5 gap-2 shrink-0 shadow-xs"
            >
              <div className="w-3.5 h-3.5 rounded-full bg-theme-hover shrink-0" />
              <div className="h-3 w-full rounded bg-theme-hover/70" />
            </div>
          ))}
        </div>
        {/* Row 2 */}
        <div className="flex gap-2.5 shrink-0 items-center">
          {widthsRow2.map((w, idx) => (
            <div
              key={idx}
              style={{ width: `${w}px` }}
              className="h-8 sm:h-9 rounded-full bg-theme-card flex items-center px-3.5 gap-2 shrink-0 shadow-xs"
            >
              <div className="w-3.5 h-3.5 rounded-full bg-theme-hover shrink-0" />
              <div className="h-3 w-full rounded bg-theme-hover/70" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function RelatedTopicsSkeleton() {
  return (
    <section className="w-full py-1">
      <div className="flex justify-between items-center mb-3 px-4 sm:px-6 md:px-8">
        <div className="h-5 w-56 rounded-md bg-theme-hover" />
      </div>

      <div className="flex gap-2.5 overflow-x-auto scrollbar-hide py-1 px-4 sm:px-6 md:px-8">
        {[130, 160, 140, 120, 150].map((w, idx) => (
          <div
            key={idx}
            style={{ width: `${w}px` }}
            className="h-8 sm:h-9 rounded-full bg-theme-card flex items-center px-3.5 gap-2 shrink-0 shadow-xs"
          >
            <div className="w-3.5 h-3.5 rounded-full bg-theme-hover shrink-0" />
            <div className="h-3 w-full rounded bg-theme-hover/70" />
          </div>
        ))}
      </div>
    </section>
  );
}

interface HomeSkeletonProps {
  hasSpotlight?: boolean;
  hasSuggested?: boolean;
  hasFantasy?: boolean;
  hasOffline?: boolean;
  hasSearchSuggestions?: boolean;
  hasWebapps?: boolean;
  hasTopRated?: boolean;
  hasRelatedTopics?: boolean;
  isGames?: boolean;
}

export default function HomeSkeleton({
  hasSpotlight = true,
  hasSuggested = true,
  hasFantasy = true,
  hasOffline = true,
  hasSearchSuggestions = true,
  hasWebapps = true,
  hasTopRated = true,
  hasRelatedTopics = true,
  isGames = false,
}: HomeSkeletonProps) {
  return (
    <div className="flex flex-col bg-theme-bg min-h-[100dvh] w-full font-sans overflow-x-hidden animate-pulse select-none">
      {hasSpotlight && <HeroSpotlightSkeleton isGames={isGames} />}

      <div className="py-3 flex flex-col gap-6 sm:gap-7 w-full overflow-x-hidden">
        {hasSuggested && <ColumnStackSkeleton />}
        {hasOffline && <LandscapeCardsSkeleton isVideoMode={isGames} />}
        {hasFantasy && <SquircleRowSkeleton />}
        {hasSearchSuggestions && <SearchSuggestionsSkeleton isGames={isGames} />}
        {hasWebapps && <EditorialCardSkeleton />}
        {hasTopRated && <SquircleRowSkeleton isTopRatedMode={true} />}
        {hasRelatedTopics && <RelatedTopicsSkeleton />}
      </div>
    </div>
  );
}
