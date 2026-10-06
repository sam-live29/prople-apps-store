import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ArrowLeft, Search, X, BookmarkPlus } from 'lucide-react';
import { AppListing } from '../types';
import StoreCircleLoader from './StoreCircleLoader';
import AppLazyImage from './AppLazyImage';
import SquircleGridSkeleton from './SquircleGridSkeleton';
import PullToRefresh from './PullToRefresh';
import { usePreserveScroll } from '../services/scrollManager';
import { useStoreConfig } from '../context/StoreConfigContext';
import { getUnifiedAppSize } from '../utils/appMetricsAlgorithm';
import { slugifyAppName } from '../utils/shareUtils';

export default function SimilarAppsPage({ 
  onBack, 
  onAppClick, 
  title = "Similar apps", 
  appsList 
}: { 
  onBack: () => void; 
  onAppClick?: (id: string) => void; 
  title?: string; 
  appsList?: AppListing[];
}) {
  const { allAppListings, refreshCatalogue, isPullRefreshing } = useStoreConfig();
  const [isScrolled, setIsScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Circle loading state mirroring SearchResultsPage with visited cache to never reload already viewed sections
  const normalizedKey = (title || 'similar-apps').trim().toLowerCase();
  const isAlreadyLoaded = typeof window !== 'undefined' && Boolean((window as any).__visitedSectionsCache?.has(normalizedKey));
  const [isLoading, setIsLoading] = useState(!isAlreadyLoaded);

  // Pull to refresh handler: shows indicator on loading screen, then dismisses it before the central apps loading screen finishes
  const handleRefresh = async () => {
    setIsLoading(true);
    if (typeof window !== 'undefined') {
      const key = (title || 'similar-apps').trim().toLowerCase();
      (window as any).__visitedSectionsCache?.delete(key);
    }
    try {
      await Promise.all([
        refreshCatalogue(),
        new Promise((resolve) => setTimeout(resolve, 750)),
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (!(window as any).__visitedSectionsCache) {
        (window as any).__visitedSectionsCache = new Set<string>();
      }
    }
    const key = (title || 'similar-apps').trim().toLowerCase();
    if (!key || (window as any).__visitedSectionsCache?.has(key)) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(() => {
      (window as any).__visitedSectionsCache?.add(key);
      setIsLoading(false);
    }, 120);
    return () => clearTimeout(timer);
  }, [title]);

  usePreserveScroll(`similar-apps-${title}`, scrollRef);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setIsScrolled(e.currentTarget.scrollTop > 10);
  };

  // Use provided appsList or fallback to all available catalog apps
  const totalApps = appsList !== undefined ? appsList : allAppListings;

  // Filter apps when inline search is active
  const filteredApps = useMemo(() => {
    if (!searchQuery.trim()) return totalApps;
    const q = searchQuery.toLowerCase().trim();
    return totalApps.filter((app) => 
      app.name.toLowerCase().includes(q) ||
      (app.developer && app.developer.toLowerCase().includes(q)) ||
      (app.category && app.category.toLowerCase().includes(q)) ||
      (app.description && app.description.toLowerCase().includes(q)) ||
      (app.tags && app.tags.some(t => t.toLowerCase().includes(q)))
    );
  }, [totalApps, searchQuery]);

  // Progressive loading (30 apps initial, 30 more)
  const [displayLimit, setDisplayLimit] = useState(30);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Reset display limit when query changes
  useEffect(() => {
    setDisplayLimit(30);
  }, [searchQuery]);

  const displayApps = useMemo(() => {
    return filteredApps.slice(0, displayLimit);
  }, [filteredApps, displayLimit]);

  const hasMore = filteredApps.length > displayApps.length;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore && hasMore) {
          setIsLoadingMore(true);
          setTimeout(() => {
            setDisplayLimit((prev) => prev + 30);
            setIsLoadingMore(false);
          }, 350);
        }
      },
      { rootMargin: '250px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore]);

  // Auto focus input when search is activated without viewport jump
  useEffect(() => {
    if (isSearchActive) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus({ preventScroll: true });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isSearchActive]);

  const handleCloseSearch = () => {
    setIsSearchActive(false);
    setSearchQuery('');
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-theme-bg text-theme-text font-sans w-full shadow-none overflow-hidden selection:bg-blue-500/30">
      {/* Header */}
      <header className="h-[60px] sm:h-[68px] shrink-0 bg-theme-bg z-20 w-full border-0 px-2.5 sm:px-4 md:px-6">
        <div className="w-full max-w-7xl mx-auto h-full flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0 flex-1 -translate-x-[2px]">
            <button 
              type="button"
              onClick={onBack} 
              className="w-9 h-9 -ml-1 text-theme-text hover:bg-theme-hover active:bg-theme-hover/80 rounded-full transition-colors shrink-0 cursor-pointer flex items-center justify-center" 
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-[17px] sm:text-[19px] font-medium font-google-sans text-theme-text tracking-tight truncate">{title}</h1>
          </div>
        </div>
      </header>

      <PullToRefresh
        scrollRef={scrollRef}
        onRefresh={handleRefresh}
        isRefreshing={isPullRefreshing}
        earlyDismissDurationMs={300}
        dismissBeforeEnd={true}
        className="flex-1 min-h-0 flex flex-col w-full relative"
      >
        <div
          ref={scrollRef}
          tabIndex={0}
          className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 sm:px-4 md:px-6 pt-4 pb-24 w-full max-w-7xl mx-auto outline-none focus:outline-none overscroll-y-contain"
          style={{
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
          }}
          onScroll={handleScroll}
        >
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center min-h-[50vh] w-full">
              <StoreCircleLoader size="md" />
            </div>
          ) : displayApps.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 mt-12 text-center">
                {searchQuery ? (
                  <>
                    <p className="text-theme-text font-medium text-base mb-1">No matching apps found</p>
                    <p className="text-theme-text-muted text-sm max-w-xs mb-4">No apps found matching &ldquo;{searchQuery}&rdquo; in this section.</p>
                    <button 
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="px-4 py-2 text-sm font-medium text-blue-500 hover:bg-blue-500/10 rounded-full transition-colors cursor-pointer"
                    >
                      Clear search
                    </button>
                  </>
                ) : (title.toLowerCase().includes('wishlist') || title.toLowerCase().includes('bookmark')) ? (
                  <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-center py-6 animate-in fade-in zoom-in-95 duration-200">
                    <div className="w-16 h-16 rounded-full bg-theme-hover flex items-center justify-center mb-4 text-theme-text-muted shadow-xs">
                      <BookmarkPlus className="w-8 h-8 text-blue-500/80 dark:text-blue-400/80" />
                    </div>
                    <p className="text-theme-text font-semibold text-[17px] mb-1.5">Your wishlist is empty</p>
                    <p className="text-theme-text-muted text-[13px] sm:text-[14px] leading-relaxed mb-6">
                      Tap the wishlist icon on any app details header to save apps and games you want to install later.
                    </p>
                    <button
                      type="button"
                      onClick={onBack}
                      className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-medium rounded-full transition-colors cursor-pointer shadow-xs"
                    >
                      Explore apps
                    </button>
                  </div>
                ) : (
                  <p className="text-theme-text-muted text-sm font-medium">No apps currently available in this section.</p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(112px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(124px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(136px,1fr))] gap-x-4 sm:gap-x-6 gap-y-7 justify-items-center">
                {displayApps.map((app) => {
                  const slug = (app as any).slug || slugifyAppName(app.name) || app.id;
                  const appUrl = `/apps/${encodeURIComponent(slug)}`;
                  return (
                    <a 
                      key={app.id} 
                      href={appUrl}
                      onClick={(e) => {
                        if (!e.metaKey && !e.ctrlKey) {
                          e.preventDefault();
                          onAppClick?.(app.id);
                        }
                      }} 
                      className="w-[96px] sm:w-[112px] md:w-[124px] lg:w-[136px] flex flex-col items-start cursor-pointer relative select-none group no-underline text-left"
                    >
                      {/* Standard App Size Icon */}
                      <div className="w-[96px] h-[96px] sm:w-[112px] sm:h-[112px] md:w-[124px] md:h-[124px] lg:w-[136px] lg:h-[136px] rounded-[22px] sm:rounded-[26px] overflow-hidden shadow-xs mb-2 bg-theme-hover border-0 flex items-center justify-center">
                        <AppLazyImage
                          src={app.iconUrl}
                          alt={app.name}
                          fallbackText={app.name}
                          className="w-full h-full object-cover"
                          containerClassName="w-full h-full"
                        />
                      </div>
                      <h4 className="text-theme-text text-xs sm:text-[13px] font-medium leading-snug line-clamp-1 w-full group-hover:text-blue-500 transition-colors">
                        {app.name}
                      </h4>
                      <div className="flex items-center gap-1 text-[11px] text-theme-text-muted mt-0.5 truncate w-full">
                        {app.rating ? (
                          <span className="flex items-center gap-0.5 text-theme-text font-medium">
                            <span>{app.rating.toFixed(1)}</span>
                            <span className="text-[10px] text-amber-400">★</span>
                          </span>
                        ) : null}
                        {app.rating ? <span>•</span> : null}
                        <span className="truncate">{getUnifiedAppSize(app)}</span>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}

            {/* Sentinel and auto-appearing loader for vertical scrolling (loads 30 more apps) */}
            <div ref={sentinelRef} className="h-1 w-full" />
            {isLoadingMore && (
              <div className="w-full py-4 flex flex-col items-center justify-center gap-3 animate-in fade-in duration-150">
                <StoreCircleLoader size="sm" minHeightClass="min-h-0" />
                <SquircleGridSkeleton count={6} />
              </div>
            )}
          </div>
      </PullToRefresh>
    </div>
  );
}
