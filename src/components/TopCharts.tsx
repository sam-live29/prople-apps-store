import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useStoreConfig } from '../context/StoreConfigContext';
import { useReviews } from '../context/ReviewContext';
import StoreCircleLoader from './StoreCircleLoader';
import SearchResultRowSkeleton from './SearchResultRowSkeleton';
import AppLazyImage from './AppLazyImage';
import PullToRefresh from './PullToRefresh';
import { 
  ChevronDown, 
  Check, 
  X, 
  ShoppingCart, 
  Clock, 
  PenTool, 
  Car, 
  Flower2, 
  Book, 
  Briefcase, 
  Gamepad2, 
  MessageSquare, 
  GraduationCap, 
  Clapperboard
} from 'lucide-react';
import { AppListing } from '../types';
import { 
  calculateAppRatingAndReviews, 
  formatDownloadCount, 
  parseDownloadCount,
  getUnifiedAppSize,
  getAppPublisherName
} from '../utils/appMetricsAlgorithm';
import { getAppFormatBadgeLabel } from '../services/osDetectionService';
import { isGameApp } from '../utils/productionFeedAlgorithm';
import { slugifyAppName } from '../utils/shareUtils';

interface TopChartsProps {
  onAppClick?: (id: string) => void;
  initialCategory?: string;
}

export default function TopCharts({ onAppClick, initialCategory }: TopChartsProps) {
  const { allAppListings, apps, refreshCatalogue, isPullRefreshing } = useStoreConfig();
  const { getAppReviews } = useReviews();

  const [isRefreshing, setIsRefreshing] = useState(false);

  const [showTopFilter, setShowTopFilter] = useState(false);
  const [showCategoriesFilter, setShowCategoriesFilter] = useState(false);
  
  const [selectedTopFilter, setSelectedTopFilter] = useState('Top rated');
  const [selectedCategory, setSelectedCategory] = useState(initialCategory === 'games' ? 'Games' : 'All categories');

  // Pull to refresh handler: smoothly refreshes catalogue in background without resetting scroll
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refreshCatalogue(),
        new Promise((resolve) => setTimeout(resolve, 600)),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const topFilters = ['Top rated', 'Trending', 'New releases'];
  
  const categoriesList = [
    { name: 'All categories', icon: null },
    { name: 'Games', icon: Gamepad2 },
    { name: 'Ecommerce', icon: ShoppingCart },
    { name: 'Watch faces', icon: Clock },
    { name: 'Art & Design', icon: PenTool },
    { name: 'Auto & Vehicles', icon: Car },
    { name: 'Beauty', icon: Flower2 },
    { name: 'Books & Reference', icon: Book },
    { name: 'Business', icon: Briefcase },
    { name: 'Communication', icon: MessageSquare },
    { name: 'Education', icon: GraduationCap },
    { name: 'Entertainment', icon: Clapperboard },
  ];

  const getAppMetrics = (listing: AppListing) => {
    const fullApp = apps[listing.id];
    const reviews = getAppReviews(listing.id);
    const ratingCalc = calculateAppRatingAndReviews(
      reviews,
      listing.rating ?? fullApp?.rating,
      listing.ratingsCount ?? fullApp?.ratingsCount,
      (listing as any).reviewsCount ?? fullApp?.reviewsCount
    );

    const rawDownloads = listing.downloadsCount ?? fullApp?.downloadsCount ?? parseDownloadCount(listing.downloads ?? fullApp?.downloads);
    const downloadsFormatted = rawDownloads > 0 ? formatDownloadCount(rawDownloads) : null;
    const size = getUnifiedAppSize(listing || fullApp);

    return {
      isRated: ratingCalc.isRated,
      averageRating: ratingCalc.averageRatingFormatted,
      reviewsCount: ratingCalc.reviewsCountFormatted,
      downloadsFormatted,
      size,
      contentRating: listing.contentRating || fullApp?.contentRating || 'Rated for 3+'
    };
  };

  const filteredApps = useMemo(() => {
    let result = allAppListings.filter(app => {
      if (selectedCategory === 'All categories') return true;
      const catLower = (app.category || '').toLowerCase();
      const targetCatLower = selectedCategory.toLowerCase();
      if (targetCatLower === 'games') {
        return isGameApp(app, apps[app.id]);
      }
      return catLower.includes(targetCatLower);
    });

    if (selectedTopFilter === 'Top rated') {
      result = [...result].sort((a, b) => {
        const metricsA = getAppMetrics(a);
        const metricsB = getAppMetrics(b);
        const ratingA = metricsA.isRated ? parseFloat(metricsA.averageRating) : (a.rating || 0);
        const ratingB = metricsB.isRated ? parseFloat(metricsB.averageRating) : (b.rating || 0);
        return ratingB - ratingA;
      });
    } else if (selectedTopFilter === 'Trending') {
      result = [...result].sort((a, b) => {
        const dCountA = a.downloadsCount ?? parseDownloadCount(a.downloads);
        const dCountB = b.downloadsCount ?? parseDownloadCount(b.downloads);
        return dCountB - dCountA;
      });
    }

    return result;
  }, [allAppListings, selectedCategory, selectedTopFilter]);

  // Progressive vertical loading (initial 30, loads 30 more)
  const [displayLimit, setDisplayLimit] = useState(30);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Instant synchronous display without artificial animation delay
  const [isLoading, setIsLoading] = useState(false);

  // Reset limit when filters change
  useEffect(() => {
    setDisplayLimit(30);
  }, [selectedCategory, selectedTopFilter]);

  const displayedApps = useMemo(() => {
    return filteredApps.slice(0, displayLimit);
  }, [filteredApps, displayLimit]);

  const hasMore = filteredApps.length > displayedApps.length;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setDisplayLimit((prev) => prev + 30);
        }
      },
      { rootMargin: '350px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore]);

  return (
    <PullToRefresh
      onRefresh={handleRefresh}
      isRefreshing={isRefreshing || isPullRefreshing}
      earlyDismissDurationMs={300}
      dismissBeforeEnd={true}
      className="flex-1 min-h-0 flex flex-col w-full relative"
    >
      <div className="w-full bg-theme-bg min-h-full pb-20 relative font-sans">
      {/* Top Filter Chips Bar */}
      <div className="flex items-center gap-2 px-2.5 sm:px-4 md:px-6 py-2.5 sticky top-0 bg-theme-bg z-10 w-full transition-none">
        <button 
          onClick={() => setShowTopFilter(true)}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs sm:text-[13px] font-medium transition-none cursor-pointer outline-none border-0 ${
            selectedTopFilter 
              ? 'bg-[#c2e7ff] text-[#001d35] dark:bg-[#004a77] dark:text-[#c2e7ff]' 
              : 'bg-theme-card hover:bg-theme-hover text-theme-text'
          }`}
        >
          <Check className="w-3.5 h-3.5 text-[#001d35] dark:text-[#c2e7ff]" />
          <span>{selectedTopFilter}</span>
          <ChevronDown className="w-3.5 h-3.5 ml-0.5 text-[#001d35] dark:text-[#c2e7ff]" />
        </button>
        <button 
          onClick={() => setShowCategoriesFilter(true)}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs sm:text-[13px] font-medium transition-none cursor-pointer outline-none border-0 ${
            selectedCategory !== 'All categories' 
              ? 'bg-[#c2e7ff] text-[#001d35] dark:bg-[#004a77] dark:text-[#c2e7ff]' 
              : 'bg-theme-card hover:bg-theme-hover text-theme-text'
          }`}
        >
          {selectedCategory !== 'All categories' && <Check className="w-3.5 h-3.5 text-[#001d35] dark:text-[#c2e7ff]" />}
          <span>{selectedCategory !== 'All categories' ? selectedCategory : 'Categories'}</span>
          <ChevronDown className={`w-3.5 h-3.5 ml-0.5 ${selectedCategory !== 'All categories' ? 'text-[#001d35] dark:text-[#c2e7ff]' : 'text-theme-text-muted'}`} />
        </button>
      </div>

      {/* Edge-to-Edge List Rows */}
      <div className="w-full max-w-7xl mx-auto px-2.5 sm:px-4 md:px-6 pt-2">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 md:gap-3 w-full animate-pulse select-none">
            {Array.from({ length: 9 }).map((_, idx) => (
              <div
                key={idx}
                className="w-full flex items-center gap-3.5 py-2 px-1 rounded-xl"
              >
                <span className="w-6 text-center font-semibold text-sm text-theme-text-muted/60 shrink-0">
                  {idx + 1}
                </span>
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-[18px] shrink-0 bg-theme-hover shadow-xs border-0" />
                <div className="flex-1 min-w-0 flex flex-col justify-center space-y-1.5">
                  <div className="h-4 w-36 sm:w-44 rounded bg-theme-hover" />
                  <div className="h-3 w-28 sm:w-36 rounded bg-theme-hover/70" />
                  <div className="flex items-center gap-1.5">
                    <div className="h-3 w-8 rounded bg-theme-hover/80" />
                    <div className="h-1.5 w-1.5 rounded-full bg-theme-hover/50" />
                    <div className="h-3 w-12 rounded bg-theme-hover/60" />
                    <div className="h-1.5 w-1.5 rounded-full bg-theme-hover/50" />
                    <div className="h-3 w-10 rounded bg-theme-hover/60" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : displayedApps.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 mt-12 text-center w-full">
            <p className="text-[#5e6368] dark:text-[#9aa0a6] text-sm">No apps found in {selectedCategory}.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 md:gap-3 w-full">
            {displayedApps.map((app, index) => {
              const metrics = getAppMetrics(app);
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
                  className="w-full flex items-center gap-3.5 py-2 px-1 rounded-xl hover:bg-[#f1f3f4] dark:hover:bg-theme-hover/40 transition-colors cursor-pointer select-none no-underline text-left"
                >
                  <span className="w-6 text-center font-semibold text-sm text-[#1f1f1f] dark:text-[#e3e3e3] shrink-0">{index + 1}</span>
                  
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-[18px] overflow-hidden shrink-0 bg-theme-hover shadow-xs border-0 flex items-center justify-center">
                    <AppLazyImage
                      src={app.iconUrl}
                      alt={app.name}
                      fallbackText={app.name}
                      className="w-full h-full object-cover"
                      containerClassName="w-full h-full"
                    />
                  </div>
                  
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <h4 className="text-[#0f172a] dark:text-[#f3f4f6] text-[15px] sm:text-base font-semibold leading-tight mb-0.5 truncate">{app.name}</h4>
                    <p className="text-[#475569] dark:text-[#9aa0a6] text-xs sm:text-[13px] mb-1 truncate">
                      {getAppPublisherName(app)} {app.category ? `• ${app.category}` : ''}
                    </p>
                    
                    <div className="flex items-center gap-1.5 text-xs text-[#475569] dark:text-[#9aa0a6] whitespace-nowrap overflow-hidden text-ellipsis">
                      {metrics.isRated ? (
                        <span className="flex items-center gap-0.5 font-medium text-[#0f172a] dark:text-[#f3f4f6] shrink-0">
                          <span>{metrics.averageRating}</span>
                          <span className="text-[10px] text-amber-400">★</span>
                        </span>
                      ) : (
                        <span className="shrink-0 text-[#475569] dark:text-[#9aa0a6]">Unrated</span>
                      )}
                      {metrics.downloadsFormatted && (
                        <span className="shrink-0 font-medium text-[#0f172a] dark:text-[#f3f4f6]">
                          • {metrics.downloadsFormatted}
                        </span>
                      )}
                      {metrics.size && <span className="shrink-0">• {metrics.size}</span>}
                      {(() => {
                        const fmtInfo = getAppFormatBadgeLabel(apps[app.id] || app);
                        const fmtText = fmtInfo.compactLabel || fmtInfo.label;
                        return fmtText ? <span className="shrink-0 truncate">• {fmtText}</span> : null;
                      })()}
                    </div>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 md:gap-3 w-full opacity-70">
              <SearchResultRowSkeleton />
              <SearchResultRowSkeleton />
              <SearchResultRowSkeleton />
            </div>
          </div>
        )}
      </div>

      {showTopFilter && (
        <div 
           className="fixed inset-0 z-[60] bg-transparent flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
           onClick={() => setShowTopFilter(false)}
        >
           <div 
             className="bg-theme-card text-theme-text border-none w-full max-w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl pb-4 animate-in slide-in-from-bottom-5 sm:zoom-in-95 duration-200 shadow-2xl overflow-hidden"
             onClick={(e) => e.stopPropagation()}
           >
              <div className="flex flex-col pt-4">
                 <h2 className="text-[19px] font-semibold text-[#0f172a] dark:text-[#f3f4f6] px-5 pb-3">Top charts</h2>
                 <ul className="flex flex-col mt-1">
                    {topFilters.map((filter) => (
                      <li 
                        key={filter} 
                        className={`flex items-center justify-between px-5 py-4 cursor-pointer text-[15px] transition-colors ${
                          selectedTopFilter === filter ? 'text-blue-600 dark:text-blue-400 font-medium bg-blue-600/5 dark:bg-blue-500/10' : 'text-theme-text hover:bg-theme-hover'
                        }`} 
                        onClick={() => { setSelectedTopFilter(filter); setShowTopFilter(false); }}
                      >
                         <span>{filter}</span>
                         {selectedTopFilter === filter && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                      </li>
                    ))}
                 </ul>
              </div>
           </div>
        </div>
      )}

      {showCategoriesFilter && (
        <div className="fixed inset-0 z-[70] bg-theme-bg text-theme-text overflow-y-auto scrollbar-hide w-full animate-in slide-in-from-bottom-4 duration-200 flex flex-col shadow-none">
          <div className="flex items-center gap-4 px-4 sm:px-6 md:px-8 h-[68px] sticky top-0 bg-theme-bg shrink-0">
             <button onClick={() => setShowCategoriesFilter(false)} className="p-2 -ml-2 rounded-full hover:bg-theme-hover transition-colors">
               <X className="w-6 h-6 text-theme-text" />
             </button>
             <h2 className="text-[19px] font-semibold text-[#0f172a] dark:text-[#f3f4f6]">Categories</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto max-w-3xl mx-auto w-full px-4 sm:px-6 py-2">
             <ul className="flex flex-col">
                {categoriesList.map((category) => (
                  <li 
                    key={category.name} 
                    className={`flex items-center justify-between gap-4 px-4 py-4 cursor-pointer text-[15px] transition-colors rounded-xl ${
                      selectedCategory === category.name ? 'text-blue-600 dark:text-blue-400 font-medium bg-blue-600/5 dark:bg-blue-500/10' : 'text-theme-text hover:bg-theme-hover'
                    }`} 
                    onClick={() => { setSelectedCategory(category.name); setShowCategoriesFilter(false); }}
                  >
                     <div className="flex items-center gap-4">
                       {category.icon && <category.icon className={`w-5 h-5 ${selectedCategory === category.name ? 'text-blue-600 dark:text-blue-400' : 'text-theme-text-muted'}`} />}
                       <span>{category.name}</span>
                     </div>
                     {selectedCategory === category.name && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                  </li>
                ))}
             </ul>
          </div>
        </div>
      )}
      </div>
    </PullToRefresh>
  );
}
