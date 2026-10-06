import React, { useRef, useState, useMemo, useEffect, useLayoutEffect } from 'react';
import { Star, ArrowRight } from 'lucide-react';
import { AppListing } from '../types';
import StoreCircleLoader from './StoreCircleLoader';
import AppLazyImage from './AppLazyImage';
import { getUnifiedAppSize, calculateAppRatingAndReviews } from '../utils/appMetricsAlgorithm';
import { deriveDynamicSectionTitle } from '../utils/dynamicStoreFeedAlgorithm';
import { getAppFormatBadgeLabel } from '../services/osDetectionService';
import { saveSectionScroll, getSectionScroll } from '../services/sectionScrollMemoryService';
import { slugifyAppName } from '../utils/shareUtils';
import { useReviews } from '../context/ReviewContext';

interface ColumnStackSectionProps {
  title?: string;
  subtitle?: string;
  apps: AppListing[];
  onAppClick: (appId: string) => void;
  onSeeAll?: () => void;
  sectionId?: string;
}

export default function ColumnStackSection({
  title,
  subtitle,
  apps,
  onAppClick,
  onSeeAll,
  sectionId,
}: ColumnStackSectionProps) {
  const activeSectionId = sectionId || title || 'column_stack_section';
  const { reviewsMap } = useReviews();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasDraggedRef = useRef(false);

  const [displayCount, setDisplayCount] = useState(24); // 8 columns of 3 apps
  const [isLoadingMore, setIsLoadingMore] = useState(false);

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

  const dynamicMeta = useMemo(() => {
    return deriveDynamicSectionTitle(apps, 'column', 0);
  }, [apps]);

  const displayTitle = title || dynamicMeta.title;
  const displaySubtitle = subtitle || dynamicMeta.subtitle;

  // Group into columns of 3
  const columns = useMemo(() => {
    const cols: AppListing[][] = [];
    for (let i = 0; i < visibleApps.length; i += 3) {
      cols.push(visibleApps.slice(i, i + 3));
    }
    return cols;
  }, [visibleApps]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    saveSectionScroll(activeSectionId, el.scrollLeft);
    if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 100) {
      if (hasMore && !isLoadingMore) {
        setIsLoadingMore(true);
        setTimeout(() => {
          setDisplayCount(prev => prev + 15);
          setIsLoadingMore(false);
        }, 250);
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

  if (columns.length === 0) return null;

  return (
    <section className="w-full py-2">
      {/* Section Header */}
      <div className="flex justify-between items-start mb-3 px-2.5 sm:px-4 md:px-6">
        <button
          type="button"
          onClick={onSeeAll}
          className="flex flex-col group cursor-pointer text-left focus:outline-none"
        >
          <h2 className="text-[19px] sm:text-[20px] font-semibold text-[#0f172a] dark:text-[#f3f4f6] tracking-tight group-hover:text-[#0b57d0] transition-colors">
            {displayTitle}
          </h2>
          {displaySubtitle && (
            <p className="text-xs text-[#475569] dark:text-[#9aa0a6] mt-0.5 group-hover:text-[#0b57d0]/80 transition-colors">
              {displaySubtitle}
            </p>
          )}
        </button>
        {onSeeAll && (
          <button
            type="button"
            onClick={onSeeAll}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#475569] dark:text-[#9aa0a6] hover:text-[#0f172a] dark:hover:text-white hover:bg-theme-hover transition-colors cursor-pointer shrink-0 mt-0.5"
            aria-label={`See all in ${displayTitle}`}
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Horizontal Carousel with 3-Row Columns - Matched to Skeleton alignment */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        className="flex gap-3.5 sm:gap-4 overflow-x-auto scrollbar-hide pb-2 px-2.5 sm:px-4 md:px-6 items-start cursor-grab active:cursor-grabbing select-none w-full overscroll-x-contain"
        style={{
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-x pan-y',
          overscrollBehaviorX: 'contain',
          overscrollBehaviorY: 'auto',
        }}
      >
        {columns.map((col, colIdx) => (
          <div
            key={colIdx}
            className="w-[calc(100vw-32px)] max-w-[340px] sm:w-[340px] md:w-[360px] shrink-0 space-y-3.5"
          >
            {col.map((app) => {
              const appReviews = reviewsMap[app.id];
              const ratingCalc = calculateAppRatingAndReviews(
                appReviews,
                app.rating,
                app.ratingsCount,
                app.reviewsCount,
                app.ratingBreakdown
              );
              const sizeVal = getUnifiedAppSize(app);
              const priceOrFree = app.price && app.price !== 'Free' && app.price !== '$0.00' ? app.price : sizeVal;

              const summaryText =
                app.shortDescription ||
                app.tagline ||
                app.description?.slice(0, 75) ||
                `Explore and enjoy ${app.name} on the store.`;

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
                  className="flex items-center gap-3.5 py-1.5 pr-2.5 pl-0 rounded-xl cursor-pointer select-none group hover:bg-[#f1f3f4] dark:hover:bg-theme-hover/40 transition-colors text-left no-underline"
                >
                  {/* Squircle App Icon */}
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-[18px] overflow-hidden bg-theme-hover shrink-0 shadow-xs border-0 flex items-center justify-center">
                    <AppLazyImage
                      src={app.iconUrl}
                      alt={app.name}
                      fallbackText={app.name}
                      className="w-full h-full object-cover select-none pointer-events-none"
                      containerClassName="w-full h-full"
                    />
                  </div>

                  {/* App Details Column */}
                  <div className="min-w-0 flex-1">
                    <h4 className="text-[15px] font-medium text-[#0f172a] dark:text-[#f3f4f6] truncate leading-snug group-hover:text-[#0b57d0] transition-colors">
                      {app.name}
                    </h4>
                    <p className="text-[13px] text-[#475569] dark:text-[#9aa0a6] line-clamp-1 mt-0.5 leading-normal">
                      {summaryText}
                    </p>

                    {/* Clean Metadata Row */}
                    <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs text-[#475569] dark:text-[#9aa0a6] mt-1">
                      {ratingCalc.isRated ? (
                        <span className="flex items-center gap-0.5 text-[#0f172a] dark:text-[#f3f4f6] font-medium shrink-0">
                          <span>{ratingCalc.averageRatingFormatted}</span>
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400 inline" />
                        </span>
                      ) : (
                        <span className="shrink-0 text-[#475569] dark:text-[#9aa0a6]">Unrated</span>
                      )}
                      <span>•</span>
                      <span>{priceOrFree}</span>
                      <span>•</span>
                      <span>{getAppFormatBadgeLabel(app).label}</span>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        ))}

        {/* Progressive loader indicator when sliding side by side */}
        {isLoadingMore && (
          <div className="shrink-0 flex items-center justify-center self-center my-auto h-[160px] px-5 select-none animate-in fade-in duration-150">
            <StoreCircleLoader size="sm" minHeightClass="min-h-0" />
          </div>
        )}
      </div>
    </section>
  );
}
