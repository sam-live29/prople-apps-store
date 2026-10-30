import React, { useState, useRef, useMemo, useEffect, useLayoutEffect } from 'react';
import { 
  Star, 
  Search, 
  TrendingUp, 
  ChevronRight,
  Download
} from 'lucide-react';
import { useStoreConfig } from '../context/StoreConfigContext';
import { useNavigation } from '../context/NavigationContext';
import TopCharts from './TopCharts';
import CategoriesPage from './CategoriesPage';
import HomeSkeleton from './HomeSkeleton';
import PullToRefresh from './PullToRefresh';
import LandscapeCardsSection from './LandscapeCardsSection';
import VideoCardsSection from './VideoCardsSection';
import ColumnStackSection from './ColumnStackSection';
import SquircleRowSection from './SquircleRowSection';
import EditorialFeatureCard from './EditorialFeatureCard';
import HeroSpotlightCard from './HeroSpotlightCard';
import HomeFeedFooter from './HomeFeedFooter';
import { getIndexedSpotlightBanners } from '../utils/appMetricsAlgorithm';
import { getIndexedSearchSuggestions } from '../utils/indexedSuggestions';
import { generateProductionHomeFeed, isGameApp } from '../utils/productionFeedAlgorithm';
import { 
  getAppFormatBadgeLabel,
  detectClientOS,
  sortAppsByDeviceCompatibility
} from '../services/osDetectionService';
import { saveSectionScroll, getSectionScroll } from '../services/sectionScrollMemoryService';
import { usePreserveScroll } from '../services/scrollManager';

interface HomePageProps {
  activeCategory: string;
  activeSubTab: string;
  onSubTabChange?: (subTab: string) => void;
  onAppClick: (id: string) => void;
  onShowSimilarApps?: () => void;
  onShowRecommendedApps?: () => void;
  onShowMustTryApps?: () => void;
  onShowTopRatedApps?: () => void;
  onSearchQuery?: (query: string) => void;
}

export default function HomePage({ 
  activeCategory, 
  activeSubTab, 
  onSubTabChange,
  onAppClick, 
  onShowSimilarApps, 
  onShowRecommendedApps, 
  onShowMustTryApps,
  onShowTopRatedApps,
  onSearchQuery
}: HomePageProps) {
  const forYouScrollRef = useRef<HTMLDivElement | null>(null);
  const topChartsScrollRef = useRef<HTMLDivElement | null>(null);
  const categoriesScrollRef = useRef<HTMLDivElement | null>(null);

  const isForYouSubTab = activeSubTab !== 'Top charts' && activeSubTab !== 'Categories';

  usePreserveScroll(`subtab-foryou-${activeCategory}`, forYouScrollRef, isForYouSubTab);
  usePreserveScroll(`subtab-topcharts-${activeCategory}`, topChartsScrollRef, activeSubTab === 'Top charts');
  usePreserveScroll(`subtab-categories-${activeCategory}`, categoriesScrollRef, activeSubTab === 'Categories');

  return (
    <div className="flex-1 h-full min-h-0 relative w-full overflow-hidden flex flex-col">
      <div 
        ref={forYouScrollRef}
        data-subtab-scroll="foryou"
        className={`flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden w-full relative outline-none overscroll-y-contain ${
          isForYouSubTab ? 'block' : 'hidden'
        }`}
        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
      >
        <div className="min-h-full pb-[calc(68px+env(safe-area-inset-bottom,12px))] md:pb-4 w-full">
          <ForYouView
            activeCategory={activeCategory}
            onSubTabChange={onSubTabChange}
            onAppClick={onAppClick}
            onShowSimilarApps={onShowSimilarApps}
            onShowRecommendedApps={onShowRecommendedApps}
            onShowMustTryApps={onShowMustTryApps}
            onShowTopRatedApps={onShowTopRatedApps}
            onSearchQuery={onSearchQuery}
          />
        </div>
      </div>

      <div 
        ref={topChartsScrollRef}
        data-subtab-scroll="topcharts"
        className={`flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden w-full relative outline-none overscroll-y-contain ${
          activeSubTab === 'Top charts' ? 'block' : 'hidden'
        }`}
        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
      >
        <div className="min-h-full pb-[calc(68px+env(safe-area-inset-bottom,12px))] md:pb-4 w-full">
          <TopCharts onAppClick={onAppClick} initialCategory={activeCategory} />
        </div>
      </div>

      <div 
        ref={categoriesScrollRef}
        data-subtab-scroll="categories"
        className={`flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden w-full relative outline-none overscroll-y-contain ${
          activeSubTab === 'Categories' ? 'block' : 'hidden'
        }`}
        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
      >
        <div className="min-h-full pb-[calc(68px+env(safe-area-inset-bottom,12px))] md:pb-4 w-full">
          <CategoriesPage onAppClick={onAppClick} isGamesMode={activeCategory === 'games'} />
        </div>
      </div>
    </div>
  );
}

function ForYouView({ 
  activeCategory, 
  onSubTabChange,
  onAppClick, 
  onShowSimilarApps: _onShowSimilarApps, 
  onShowRecommendedApps, 
  onShowMustTryApps, 
  onShowTopRatedApps,
  onSearchQuery
}: { 
  activeCategory: string; 
  onSubTabChange?: (subTab: string) => void;
  onAppClick: (id: string) => void; 
  onShowSimilarApps?: () => void; 
  onShowRecommendedApps?: () => void; 
  onShowMustTryApps?: () => void; 
  onShowTopRatedApps?: () => void;
  onSearchQuery?: (query: string) => void;
}) {
  const { allAppListings, apps, activeBanners, isLoadingApps, hasInitialSyncCompleted, isPullRefreshing, refreshCatalogue } = useStoreConfig();
  const { setSelectedCategory, openLatestReleases } = useNavigation();

  const bannerScrollRef = useRef<HTMLDivElement | null>(null);

  // Drag-to-scroll refs for hero banners
  const isBannerDraggingRef = useRef(false);
  const bannerStartXRef = useRef(0);
  const bannerScrollLeftRef = useRef(0);
  const hasBannerDraggedRef = useRef(false);

  const isGamesMode = activeCategory === 'games';

  const clientOS = useMemo(() => detectClientOS(), []);

  // Device-aware prioritized catalog:
  // Shows apps runnable on the user's specific OS/device first, preventing cross-platform package flooding
  const allCatalogApps = useMemo(() => {
    return sortAppsByDeviceCompatibility(allAppListings, clientOS);
  }, [allAppListings, clientOS]);

  // Dynamically indexed search suggestions derived from the database catalog
  const indexedSuggestions = useMemo(() => {
    return getIndexedSearchSuggestions(allCatalogApps, apps);
  }, [allCatalogApps, apps]);

  // Production-Grade Home Feed Generation (Category-driven, multi-archetype, diverse)
  const productionSections = useMemo(() => {
    return generateProductionHomeFeed(allCatalogApps, apps, {
      hasSearchSuggestions: indexedSuggestions.row1.length > 0,
      hasRelatedTopics: indexedSuggestions.relatedTopics.length > 0,
      mode: isGamesMode ? 'games' : 'apps',
    });
  }, [allCatalogApps, apps, indexedSuggestions, isGamesMode]);

  // Strictly indexed & capped spotlight banners (maximum 6 banners)
  const spotlightItems = useMemo(() => {
    if (!allCatalogApps || allCatalogApps.length === 0) return [];
    const initialBanners = getIndexedSpotlightBanners(activeBanners, allCatalogApps, apps, 8);
    if (isGamesMode) {
      const gameBanners = initialBanners.filter(b => {
        const app = apps[b.appId] || allCatalogApps.find(x => x.id === b.appId);
        return app ? isGameApp(app, apps[b.appId]) : false;
      });
      if (gameBanners.length > 0) {
        return gameBanners.slice(0, 6);
      }
    }
    return initialBanners.slice(0, 6);
  }, [activeBanners, allCatalogApps, apps, isGamesMode]);

  const hasAnyApps = allCatalogApps.length > 0;

  const BANNER_SECTION_ID = 'home_hero_spotlight_banner';

  // Restore scroll position synchronously before paint to eliminate any visible jump
  useLayoutEffect(() => {
    if (!bannerScrollRef.current) return;
    const saved = getSectionScroll(BANNER_SECTION_ID);
    if (saved > 0) {
      bannerScrollRef.current.scrollLeft = saved;
    }
  }, []);

  // Mouse Drag to Scroll handlers for free banner movement
  const handleBannerMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || !bannerScrollRef.current) return;
    isBannerDraggingRef.current = true;
    hasBannerDraggedRef.current = false;
    bannerStartXRef.current = e.pageX;
    bannerScrollLeftRef.current = bannerScrollRef.current.scrollLeft;
  };

  const handleBannerMouseLeave = () => {
    isBannerDraggingRef.current = false;
    if (bannerScrollRef.current) {
      saveSectionScroll(BANNER_SECTION_ID, bannerScrollRef.current.scrollLeft);
    }
  };

  const handleBannerMouseUp = () => {
    isBannerDraggingRef.current = false;
    if (bannerScrollRef.current) {
      saveSectionScroll(BANNER_SECTION_ID, bannerScrollRef.current.scrollLeft);
    }
    setTimeout(() => {
      hasBannerDraggedRef.current = false;
    }, 80);
  };

  const handleBannerMouseMove = (e: React.MouseEvent) => {
    if (!isBannerDraggingRef.current || !bannerScrollRef.current) return;
    const deltaX = e.pageX - bannerStartXRef.current;
    if (Math.abs(deltaX) > 3) {
      hasBannerDraggedRef.current = true;
      const maxScroll = bannerScrollRef.current.scrollWidth - bannerScrollRef.current.clientWidth;
      const nextScroll = Math.max(0, Math.min(bannerScrollLeftRef.current - deltaX, maxScroll));
      bannerScrollRef.current.scrollLeft = nextScroll;
      saveSectionScroll(BANNER_SECTION_ID, nextScroll);
    }
  };

  if (isLoadingApps || !hasInitialSyncCompleted || isPullRefreshing) {
    return (
      <PullToRefresh onRefresh={refreshCatalogue} isRefreshing={isPullRefreshing} earlyDismissDurationMs={360} dismissBeforeEnd={true}>
        <HomeSkeleton
          hasSpotlight={true}
          hasSuggested={true}
          hasFantasy={true}
          hasOffline={true}
          hasSearchSuggestions={true}
          hasWebapps={true}
          hasTopRated={true}
          hasRelatedTopics={true}
          isGames={activeCategory === 'games'}
        />
      </PullToRefresh>
    );
  }

  return (
    <PullToRefresh onRefresh={refreshCatalogue} isRefreshing={isPullRefreshing} earlyDismissDurationMs={360} dismissBeforeEnd={true}>
      <div className="flex flex-col bg-theme-bg min-h-[100dvh] w-full font-sans overflow-x-hidden">
        {/* Edge-to-Edge Free Moving Spotlight Hero Banners */}
        {spotlightItems.length > 0 && (
          <div className="w-full pt-1 pb-1 relative group select-none">
            <div
              ref={bannerScrollRef}
              onScroll={(e) => saveSectionScroll(BANNER_SECTION_ID, e.currentTarget.scrollLeft)}
              onMouseDown={handleBannerMouseDown}
              onMouseLeave={handleBannerMouseLeave}
              onMouseUp={handleBannerMouseUp}
              onMouseMove={handleBannerMouseMove}
              className="flex gap-2.5 sm:gap-4 overflow-x-auto scrollbar-hide px-2.5 sm:px-4 md:px-6 py-2 sm:py-3 cursor-grab active:cursor-grabbing overscroll-x-contain"
              style={{
                WebkitOverflowScrolling: 'touch',
                touchAction: 'pan-x pan-y',
                overscrollBehaviorX: 'contain',
                overscrollBehaviorY: 'auto',
              }}
            >
              {spotlightItems.map((item, idx) => (
                <HeroSpotlightCard
                  key={item.id || idx}
                  item={item}
                  fullApp={apps[item.appId]}
                  onAppClick={onAppClick}
                  hasBannerDraggedRef={hasBannerDraggedRef}
                />
              ))}
            </div>
          </div>
        )}

        {/* Main Content Feed with Structured Intervals */}
        <div className="py-3 flex flex-col gap-6 sm:gap-7 w-full overflow-x-hidden">
          {!hasAnyApps && hasInitialSyncCompleted && !isLoadingApps && (
            <div className="flex flex-col items-center justify-center p-8 mt-8 text-center px-2.5 sm:px-4 md:px-6">
              <div className="w-16 h-16 rounded-full bg-theme-hover border border-theme-border flex items-center justify-center text-theme-text-muted mb-4">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-8 h-8" strokeWidth="1.5">
                  <rect width="7" height="7" x="3" y="3" rx="1" />
                  <rect width="7" height="7" x="14" y="3" rx="1" />
                  <rect width="7" height="7" x="14" y="14" rx="1" />
                  <rect width="7" height="7" x="3" y="14" rx="1" />
                </svg>
              </div>
              <h2 className="text-theme-text font-medium text-lg mb-1">No apps published yet</h2>
              <p className="text-theme-text-muted text-sm max-w-xs">Applications published by verified developer accounts will appear here in the store catalogue.</p>
            </div>
          )}

          {/* DYNAMIC CATEGORY-DRIVEN SECTIONS WITH COMPLETE UI ARCHETYPE ROTATION */}
          {productionSections.map((sec) => {
            if (sec.type !== 'search_suggestions' && sec.type !== 'related_topics' && (!sec.apps || sec.apps.length === 0)) {
              return null;
            }

            // 1. Column Stack (3-Row multi-column horizontal cards)
            if (sec.type === 'column_stack') {
              return (
                <div key={sec.id}>
                  <ColumnStackSection
                    sectionId={sec.id}
                    title={sec.title}
                    subtitle={sec.subtitle}
                    apps={sec.apps}
                    onAppClick={onAppClick}
                    onSeeAll={() => {
                      if (sec.categoryKey) {
                        setSelectedCategory(sec.categoryKey);
                      } else if (sec.id.includes('indie-cold-start') || sec.id.includes('cold-start-guarantee')) {
                        openLatestReleases();
                      } else if (onShowRecommendedApps) {
                        onShowRecommendedApps();
                      }
                    }}
                  />
                </div>
              );
            }

            // 2. Landscape Cards (16:9 widescreen banners)
            if (sec.type === 'landscape_cards') {
              return (
                <div key={sec.id}>
                  <LandscapeCardsSection
                    sectionId={sec.id}
                    title={sec.title}
                    subtitle={sec.subtitle}
                    apps={sec.apps}
                    appsMap={apps}
                    onAppClick={onAppClick}
                    onSeeAll={() => {
                      if (sec.categoryKey) {
                        setSelectedCategory(sec.categoryKey);
                      } else if (sec.id.includes('indie-cold-start') || sec.id.includes('cold-start-guarantee')) {
                        openLatestReleases();
                      } else if (onShowRecommendedApps) {
                        onShowRecommendedApps();
                      }
                    }}
                    defaultCategoryTag={sec.tag}
                  />
                </div>
              );
            }

            // 3. Squircle Row (96px/104px app icons)
            if (sec.type === 'squircle_row') {
              return (
                <div key={sec.id}>
                  <SquircleRowSection
                    sectionId={sec.id}
                    title={sec.title}
                    subtitle={sec.subtitle}
                    apps={sec.apps}
                    appsMap={apps}
                    onAppClick={onAppClick}
                    onSeeAll={() => {
                      if (sec.categoryKey) {
                        setSelectedCategory(sec.categoryKey);
                      } else if (sec.id.includes('indie-cold-start') || sec.id.includes('cold-start-guarantee')) {
                        openLatestReleases();
                      } else if (onShowMustTryApps) {
                        onShowMustTryApps();
                      }
                    }}
                    badge={sec.tag}
                  />
                </div>
              );
            }

            // 4. Video Cards (Gameplay trailers / video cards)
            if (sec.type === 'video_cards') {
              return (
                <div key={sec.id}>
                  <VideoCardsSection
                    sectionId={sec.id}
                    title={sec.title}
                    subtitle={sec.subtitle}
                    apps={sec.apps}
                    appsMap={apps}
                    onAppClick={onAppClick}
                    onSeeAll={() => {
                      if (sec.categoryKey) {
                        setSelectedCategory(sec.categoryKey);
                      } else if (onShowRecommendedApps) {
                        onShowRecommendedApps();
                      }
                    }}
                    defaultCategoryTag={sec.tag}
                  />
                </div>
              );
            }

            // 5. Top Rated Apps & Games (Gold stars with download milestones)
            if (sec.type === 'top_rated') {
              return (
                <div key={sec.id}>
                  <SquircleRowSection
                    sectionId={sec.id}
                    title={sec.title}
                    subtitle={sec.subtitle}
                    apps={sec.apps}
                    appsMap={apps}
                    onAppClick={onAppClick}
                    onSeeAll={() => {
                      if (onShowTopRatedApps) {
                        onShowTopRatedApps();
                      } else if (onSubTabChange) {
                        onSubTabChange('Top charts');
                      }
                    }}
                    badge={sec.tag}
                    isTopRatedMode={true}
                  />
                </div>
              );
            }

            // 6. Editorial Feature Spotlight Cards (Supporting multiple apps in spotlight)
            if (sec.type === 'editorial_feature' && ((sec.apps && sec.apps.length > 0) || sec.featuredApp)) {
              const editorialApps = sec.apps && sec.apps.length > 0 
                ? sec.apps 
                : (sec.featuredApp ? [sec.featuredApp] : []);
              const primaryApp = sec.featuredApp || editorialApps[0];

              return (
                <div key={sec.id}>
                  <EditorialFeatureCard
                    sectionId={sec.id}
                    apps={editorialApps}
                    app={primaryApp}
                    fullApp={primaryApp ? apps[primaryApp.id] : undefined}
                    appsMap={apps}
                    onAppClick={onAppClick}
                    title={sec.title}
                    tag={sec.tag}
                  />
                </div>
              );
            }

            // Interval 1: Latest Search Suggestions Chip Cloud
            if (sec.type === 'search_suggestions' && indexedSuggestions.row1.length > 0) {
              return (
                <section key={sec.id} className="w-full py-1">
                  <div className="flex justify-between items-center mb-3 px-2.5 sm:px-4 md:px-6">
                    <h2 className="text-[17px] font-medium text-theme-text tracking-tight flex items-center gap-1.5">
                      Latest search suggestions
                    </h2>
                    {onSearchQuery && (
                      <button 
                        type="button" 
                        onClick={() => onSearchQuery('')} 
                        className="text-xs font-semibold text-blue-500 hover:text-blue-400 transition-colors px-1 sm:px-2 py-1 cursor-pointer flex items-center gap-0.5 shrink-0"
                      >
                        <span>Explore all</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col gap-2.5 w-full">
                    {/* Row 1 */}
                    <div 
                      className="flex gap-2.5 overflow-x-auto scrollbar-hide py-0.5 px-2.5 sm:px-4 md:px-6 w-full overscroll-x-contain items-center"
                      style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y', overscrollBehaviorY: 'auto' }}
                    >
                      {indexedSuggestions.row1.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onSearchQuery?.(item.query)}
                          className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-theme-card hover:bg-theme-hover text-theme-text text-xs sm:text-[13px] font-medium transition-all active:scale-95 border-0 border-none shrink-0 cursor-pointer group"
                        >
                          {item.icon === 'trending' ? (
                            <TrendingUp className="w-3.5 h-3.5 text-emerald-500 group-hover:text-emerald-600 transition-colors shrink-0" />
                          ) : item.icon === 'fire' ? (
                            <span className="text-xs select-none">🔥</span>
                          ) : (
                            <Search className="w-3.5 h-3.5 text-theme-text-muted group-hover:text-blue-500 transition-colors shrink-0" />
                          )}
                          <span className="whitespace-nowrap">{item.query}</span>
                        </button>
                      ))}
                    </div>

                    {/* Row 2 */}
                    {indexedSuggestions.row2.length > 0 && (
                      <div 
                        className="flex gap-2.5 overflow-x-auto scrollbar-hide py-0.5 px-2.5 sm:px-4 md:px-6 w-full overscroll-x-contain items-center"
                        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y', overscrollBehaviorY: 'auto' }}
                      >
                        {indexedSuggestions.row2.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => onSearchQuery?.(item.query)}
                            className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-theme-card hover:bg-theme-hover text-theme-text text-xs sm:text-[13px] font-medium transition-all active:scale-95 border-0 border-none shrink-0 cursor-pointer group"
                          >
                            {item.icon === 'trending' ? (
                              <TrendingUp className="w-3.5 h-3.5 text-emerald-500 group-hover:text-emerald-600 transition-colors shrink-0" />
                            ) : item.icon === 'fire' ? (
                              <span className="text-xs select-none">🔥</span>
                            ) : (
                              <Search className="w-3.5 h-3.5 text-theme-text-muted group-hover:text-blue-500 transition-colors shrink-0" />
                            )}
                            <span className="whitespace-nowrap">{item.query}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              );
            }

            // Interval 2: Searches related to your interests
            if (sec.type === 'related_topics' && indexedSuggestions.relatedTopics.length > 0) {
              return (
                <section key={sec.id} className="w-full py-1">
                  <div className="flex justify-between items-center mb-3 px-2.5 sm:px-4 md:px-6">
                    <h2 className="text-[17px] font-medium text-theme-text tracking-tight flex items-center gap-1.5">
                      Searches related to your interests
                    </h2>
                  </div>

                  <div 
                    className="flex gap-2.5 overflow-x-auto scrollbar-hide py-1 px-2.5 sm:px-4 md:px-6 w-full overscroll-x-contain"
                    style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y', overscrollBehaviorY: 'auto' }}
                  >
                    {indexedSuggestions.relatedTopics.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSearchQuery?.(item.query)}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-theme-card hover:bg-theme-hover text-theme-text text-xs sm:text-[13px] font-medium transition-all active:scale-95 border-0 border-none shrink-0 cursor-pointer group"
                      >
                        {item.icon === 'trending' ? (
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-500 group-hover:text-emerald-600 transition-colors shrink-0" />
                        ) : item.icon === 'fire' ? (
                          <span className="text-xs select-none">🔥</span>
                        ) : (
                          <Search className="w-3.5 h-3.5 text-theme-text-muted group-hover:text-blue-500 transition-colors shrink-0" />
                        )}
                        <span className="whitespace-nowrap">{item.query}</span>
                      </button>
                    ))}
                  </div>
                </section>
              );
            }

            return null;
          })}

          {/* Feed Completion Footer */}
          {hasAnyApps && (
            <HomeFeedFooter
              onCategoryClick={(catId) => setSelectedCategory(catId)}
            />
          )}
        </div>
      </div>
    </PullToRefresh>
  );
}
