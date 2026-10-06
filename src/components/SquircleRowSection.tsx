import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { ArrowRight, Star } from 'lucide-react';
import AppLazyImage from './AppLazyImage';
import { AppListing, AppDetails } from '../types';
import { getUnifiedAppSize, formatDownloadCount, parseDownloadCount, calculateAppRatingAndReviews } from '../utils/appMetricsAlgorithm';
import { saveSectionScroll, getSectionScroll } from '../services/sectionScrollMemoryService';
import { slugifyAppName } from '../utils/shareUtils';
import { useReviews } from '../context/ReviewContext';

interface SquircleRowSectionProps {
  title: string;
  subtitle?: string;
  apps: AppListing[];
  appsMap?: Record<string, AppDetails>;
  onAppClick: (appId: string) => void;
  onSeeAll?: () => void;
  badge?: string;
  isTopRatedMode?: boolean;
  sectionId?: string;
}

export default function SquircleRowSection({
  title,
  subtitle,
  apps,
  appsMap = {},
  onAppClick,
  onSeeAll,
  badge,
  isTopRatedMode = false,
  sectionId,
}: SquircleRowSectionProps) {
  const activeSectionId = sectionId || title || 'squircle_row_section';
  const { reviewsMap } = useReviews();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasDraggedRef = useRef(false);

  const [displayCount, setDisplayCount] = useState(24);

  // Restore and maintain the exact scroll position across app installs and navigation without jumps
  useLayoutEffect(() => {
    if (!scrollRef.current) return;
    const saved = getSectionScroll(activeSectionId);
    if (saved > 0 && scrollRef.current.scrollLeft === 0) {
      scrollRef.current.scrollLeft = saved;
    }
  }, [activeSectionId]);

  if (!apps || apps.length === 0) return null;

  const visibleApps = apps.slice(0, displayCount);
  const hasMore = apps.length > displayCount;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    saveSectionScroll(activeSectionId, el.scrollLeft);
    if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 80) {
      if (hasMore) {
        setDisplayCount(prev => prev + 16);
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || !scrollRef.current) return;
    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    startXRef.current = e.pageX;
    scrollLeftRef.current = scrollRef.current.scrollLeft;
  };

  const handleMouseLeave = () => {
    isDraggingRef.current = false;
    if (scrollRef.current) {
      saveSectionScroll(activeSectionId, scrollRef.current.scrollLeft);
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    if (scrollRef.current) {
      saveSectionScroll(activeSectionId, scrollRef.current.scrollLeft);
    }
    setTimeout(() => {
      hasDraggedRef.current = false;
    }, 80);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !scrollRef.current) return;
    const deltaX = e.pageX - startXRef.current;
    if (Math.abs(deltaX) > 3) {
      hasDraggedRef.current = true;
      const maxScroll = scrollRef.current.scrollWidth - scrollRef.current.clientWidth;
      const nextScroll = Math.max(0, Math.min(scrollLeftRef.current - deltaX, maxScroll));
      scrollRef.current.scrollLeft = nextScroll;
      saveSectionScroll(activeSectionId, nextScroll);
    }
  };

  return (
    <section className="w-full py-2">
      {/* Section Header */}
      <div className="flex justify-between items-start mb-3 px-2.5 sm:px-4 md:px-6">
        <button
          type="button"
          onClick={onSeeAll}
          className="flex flex-col group cursor-pointer text-left focus:outline-none"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-[19px] sm:text-[20px] font-semibold text-[#0f172a] dark:text-[#f3f4f6] tracking-tight group-hover:text-[#0b57d0] transition-colors">
              {title}
            </h2>
            {badge && (
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                {badge}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-[#475569] dark:text-[#9aa0a6] mt-0.5 group-hover:text-[#0b57d0]/80 transition-colors">
              {subtitle}
            </p>
          )}
        </button>
        {onSeeAll && (
          <button
            type="button"
            onClick={onSeeAll}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#475569] dark:text-[#9aa0a6] hover:text-[#0f172a] dark:hover:text-white hover:bg-theme-hover transition-colors cursor-pointer shrink-0 mt-0.5"
            aria-label={`See all in ${title}`}
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Horizontal Slider of Squircle App Icons - Matched to Skeleton */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        className="flex gap-3.5 sm:gap-4 overflow-x-auto scrollbar-hide pb-2 px-2.5 sm:px-4 md:px-6 items-start cursor-grab active:cursor-grabbing select-none w-full scroll-pl-2.5 sm:scroll-pl-4 overscroll-x-contain"
        style={{
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-x pan-y',
          overscrollBehaviorX: 'contain',
          overscrollBehaviorY: 'auto',
        }}
      >
        {visibleApps.map((app) => {
          const full = appsMap[app.id] || app;
          const appReviews = reviewsMap[app.id];
          const ratingCalc = calculateAppRatingAndReviews(
            appReviews,
            app.rating ?? full.rating,
            app.ratingsCount ?? full.ratingsCount,
            app.reviewsCount ?? full.reviewsCount,
            app.ratingBreakdown ?? full.ratingBreakdown
          );
          const rating = ratingCalc.isRated ? ratingCalc.averageRating : 0;
          const rawDownloads = app.downloadsCount ?? full.downloadsCount ?? parseDownloadCount(app.downloads ?? full.downloads);
          const downloadsFormatted = rawDownloads > 0 ? formatDownloadCount(rawDownloads) : null;
          const size = getUnifiedAppSize(app);

          const slug = (app as any).slug || slugifyAppName(app.name) || app.id;
          const appUrl = `/apps/${encodeURIComponent(slug)}`;

          return (
            <a
              key={app.id}
              href={appUrl}
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && !hasDraggedRef.current) {
                  e.preventDefault();
                  onAppClick(app.id);
                }
              }}
              className="w-[92px] sm:w-[100px] md:w-[104px] shrink-0 flex flex-col items-start cursor-pointer select-none group text-left no-underline"
            >
              {/* Squircle App Icon */}
              <div className="w-[92px] h-[92px] sm:w-[100px] sm:h-[100px] md:w-[104px] md:h-[104px] rounded-[22px] overflow-hidden shadow-xs mb-2 bg-theme-hover border-0 flex items-center justify-center">
                <AppLazyImage
                  src={app.iconUrl}
                  alt={app.name}
                  fallbackText={app.name}
                  className="w-full h-full object-cover select-none pointer-events-none"
                  containerClassName="w-full h-full"
                />
              </div>

              {/* Title */}
              <h4 className="text-[#0f172a] dark:text-[#f3f4f6] text-xs sm:text-[13px] font-medium leading-snug line-clamp-1 w-full group-hover:text-[#0b57d0] transition-colors">
                {app.name}
              </h4>

              {/* Subtitle with Rating or Size, and Downloads */}
              <div className="flex items-center gap-1 text-[11px] text-[#475569] dark:text-[#9aa0a6] mt-0.5 truncate w-full">
                {ratingCalc.isRated ? (
                  <span className="flex items-center gap-0.5 text-[#0f172a] dark:text-[#f3f4f6] font-medium shrink-0">
                    <span>{ratingCalc.averageRatingFormatted}</span>
                    <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400 inline" />
                  </span>
                ) : (
                  <span className="truncate">{size || app.category || 'App'}</span>
                )}

                {downloadsFormatted && (
                  <span className="truncate">• {downloadsFormatted}</span>
                )}
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}
