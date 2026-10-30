import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Navigation,
  PenTool,
  Car,
  SprayCan,
  BookOpen,
  Briefcase,
  Smile,
  BookMarked,
  MessageSquare,
  Heart,
  GraduationCap,
  Clapperboard,
  Calendar,
  Wallet,
  Utensils,
  Gamepad2,
  HeartPulse,
  Home,
  Code2,
  Sun,
  MapPin,
  Stethoscope,
  Music,
  Newspaper,
  Users,
  Sliders,
  Camera,
  CheckSquare,
  ShoppingBag,
  Share2,
  Trophy,
  Wrench,
  Plane,
  Video,
  CloudSun,
  ArrowLeft,
  Search,
  Grid,
  X
} from 'lucide-react';
import { appCategories } from '../data';
import { useStoreConfig } from '../context/StoreConfigContext';
import { AppListing } from '../types';
import { useNavigation } from '../context/NavigationContext';
import { usePreserveScroll } from '../services/scrollManager';
import { getUnifiedAppSize } from '../utils/appMetricsAlgorithm';
import {
  canonicalizeCategoryKey,
  doesAppMatchCategory,
  getAppLatestTimestampMs,
  normalizeCategoryName,
} from '../utils/productionFeedAlgorithm';
import StoreCircleLoader from './StoreCircleLoader';
import PullToRefresh from './PullToRefresh';
import { slugifyAppName } from '../utils/shareUtils';

interface CategoriesPageProps {
  onAppClick?: (id: string) => void;
  initialCategory?: string | null;
  isGamesMode?: boolean;
}

const CATEGORY_ICON_MAP: Record<string, React.ElementType> = {
  'navigation': Navigation,
  'pen-tool': PenTool,
  'car': Car,
  'spray-can': SprayCan,
  'book-open': BookOpen,
  'briefcase': Briefcase,
  'smile': Smile,
  'book-marked': BookMarked,
  'message-square': MessageSquare,
  'heart': Heart,
  'graduation-cap': GraduationCap,
  'clapperboard': Clapperboard,
  'calendar': Calendar,
  'wallet': Wallet,
  'utensils': Utensils,
  'gamepad-2': Gamepad2,
  'heart-pulse': HeartPulse,
  'home': Home,
  'code-2': Code2,
  'sun': Sun,
  'map-pin': MapPin,
  'stethoscope': Stethoscope,
  'music': Music,
  'newspaper': Newspaper,
  'users': Users,
  'sliders': Sliders,
  'camera': Camera,
  'check-square': CheckSquare,
  'shopping-bag': ShoppingBag,
  'share-2': Share2,
  'trophy': Trophy,
  'wrench': Wrench,
  'plane': Plane,
  'video': Video,
  'cloud-sun': CloudSun,
  'grid': Grid,
};

export default function CategoriesPage({ onAppClick, initialCategory = null, isGamesMode = false }: CategoriesPageProps) {
  const { allAppListings, apps, isLoadingApps, hasInitialSyncCompleted, refreshCatalogue, isPullRefreshing } = useStoreConfig();
  const { selectedCategory: navCategory, setSelectedCategory: navSetSelectedCategory, goBack } = useNavigation();
  const rawSelectedCategory = navCategory !== null ? navCategory : initialCategory;
  
  const setSelectedCategory = (cat: string | null) => {
    if (cat === null) {
      goBack();
    } else {
      navSetSelectedCategory(cat);
    }
  };

  const allApps: AppListing[] = allAppListings;

  // Merge standard store categories with any custom categories used by published apps
  const mergedCategories = useMemo(() => {
    const base = [...appCategories];
    const existingKeys = new Set(base.map(c => canonicalizeCategoryKey(c.name)));
    for (const app of allApps) {
      const rawCat = (app.category || apps[app.id]?.category || '').trim();
      if (!rawCat) continue;
      const key = canonicalizeCategoryKey(rawCat);
      if (!existingKeys.has(key)) {
        existingKeys.add(key);
        const cleanName = normalizeCategoryName(rawCat);
        base.push({
          id: `cat-${slugifyAppName(cleanName)}`,
          name: cleanName,
          icon: 'grid',
        });
      }
    }
    return base;
  }, [allApps, apps]);

  const sortedCategories = useMemo(() => {
    if (!isGamesMode) return mergedCategories;
    return [...mergedCategories].sort((a, b) => {
      const aIsGame = a.name.toLowerCase().includes('game') || a.id === 'cat-games';
      const bIsGame = b.name.toLowerCase().includes('game') || b.id === 'cat-games';
      if (aIsGame && !bIsGame) return -1;
      if (!aIsGame && bIsGame) return 1;
      return 0;
    });
  }, [mergedCategories, isGamesMode]);

  // Resolve URL slug or ID (e.g. 'music-audio' or 'cat-productivity') to canonical category display name
  const selectedCategory = useMemo(() => {
    if (!rawSelectedCategory) return null;
    if (rawSelectedCategory === 'All categories' || rawSelectedCategory.toLowerCase() === 'all-categories') {
      return 'All categories';
    }
    const targetSlug = slugifyAppName(rawSelectedCategory.replace(/^cat-/, ''));
    const targetKey = canonicalizeCategoryKey(rawSelectedCategory);
    const matchedCat = mergedCategories.find(
      c =>
        c.name.toLowerCase() === rawSelectedCategory.toLowerCase() ||
        c.id.toLowerCase() === rawSelectedCategory.toLowerCase() ||
        slugifyAppName(c.name) === targetSlug ||
        canonicalizeCategoryKey(c.name) === targetKey
    );
    return matchedCat ? matchedCat.name : normalizeCategoryName(rawSelectedCategory);
  }, [rawSelectedCategory, mergedCategories]);

  // Strictly filter apps belonging to the chosen category without cross-category false positives
  const categoryApps = useMemo(() => {
    if (!selectedCategory) return [];
    const matched = allApps.filter(app =>
      doesAppMatchCategory(app, apps[app.id], selectedCategory, isGamesMode)
    );
    return [...matched].sort((a, b) => {
      const tsDiff = getAppLatestTimestampMs(b, apps[b.id]) - getAppLatestTimestampMs(a, apps[a.id]);
      if (tsDiff !== 0) return tsDiff;
      return (b.downloadsCount || 0) - (a.downloadsCount || 0);
    });
  }, [allApps, apps, selectedCategory, isGamesMode]);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when search is activated without viewport jump
  useEffect(() => {
    if (isSearchActive) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus({ preventScroll: true });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isSearchActive]);

  // Reset search when category changes
  useEffect(() => {
    setIsSearchActive(false);
    setSearchQuery('');
  }, [selectedCategory]);

  const handleOpenSearch = () => {
    setIsSearchActive(true);
  };

  const handleCloseSearch = () => {
    setIsSearchActive(false);
    setSearchQuery('');
  };

  // On-page filtering of the category apps based on search query
  const filteredCategoryApps = useMemo(() => {
    if (!searchQuery.trim()) {
      return categoryApps;
    }
    const q = searchQuery.toLowerCase().trim();
    return categoryApps.filter(app => {
      const name = (app.name || '').toLowerCase();
      const dev = (app.developer || '').toLowerCase();
      const desc = (app.description || '').toLowerCase();
      const cat = (app.category || '').toLowerCase();
      const tags = (app.tags || []).join(' ').toLowerCase();
      return name.includes(q) || dev.includes(q) || desc.includes(q) || cat.includes(q) || tags.includes(q);
    });
  }, [categoryApps, searchQuery]);

  const categoryScrollRef = useRef<HTMLDivElement | null>(null);
  const mainScrollRef = useRef<HTMLDivElement | null>(null);
  usePreserveScroll(`category-${selectedCategory || ''}`, categoryScrollRef, Boolean(selectedCategory));
  usePreserveScroll('categories-main-list', mainScrollRef, !selectedCategory);

  // Instant synchronous state for categories
  const [isCategoryLoading, setIsCategoryLoading] = useState(false);
  const [isCategoryRefreshing, setIsCategoryRefreshing] = useState(false);

  const [isMainRefreshing, setIsMainRefreshing] = useState(false);

  const handleMainRefresh = async () => {
    setIsMainRefreshing(true);
    try {
      await Promise.all([
        refreshCatalogue(),
        new Promise((resolve) => setTimeout(resolve, 750)),
      ]);
    } finally {
      setIsMainRefreshing(false);
    }
  };

  const handleCategoryRefresh = async () => {
    setIsCategoryRefreshing(true);
    try {
      await Promise.all([
        refreshCatalogue(),
        new Promise((resolve) => setTimeout(resolve, 750)),
      ]);
    } finally {
      setIsCategoryRefreshing(false);
    }
  };

  // 1. Full-screen Category apps view when a category is tapped
  if (selectedCategory) {
    return (
      <div className="fixed inset-0 z-[70] flex flex-col bg-theme-bg text-theme-text font-sans w-full shadow-none overflow-hidden selection:bg-blue-500/30">
        {/* Full-screen top app bar with search toggle aligned with home page right edge actions */}
        {isSearchActive ? (
          <header className="h-[60px] sm:h-[68px] shrink-0 bg-theme-bg z-20 w-full border-0 transition-all flex items-center px-2.5 sm:px-4 md:px-6 gap-3">
            <button
              type="button"
              id="category-search-back-btn"
              onClick={handleCloseSearch}
              className="w-9 h-9 -ml-1 text-theme-text hover:bg-theme-hover active:bg-theme-hover/80 rounded-full transition-colors shrink-0 cursor-pointer flex items-center justify-center -translate-x-[2px]"
              aria-label="Exit search"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex-1 flex items-center min-w-0">
              <input
                ref={searchInputRef}
                type="text"
                id="category-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    handleCloseSearch();
                  }
                }}
                placeholder={`Search in ${selectedCategory}...`}
                className="w-full bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-theme-text placeholder:text-theme-text-muted text-[16px] sm:text-[17px] font-normal"
              />
              {searchQuery && (
                <button
                  type="button"
                  id="category-clear-search-btn"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus({ preventScroll: true });
                  }}
                  className="w-8 h-8 flex items-center justify-center text-theme-text-muted hover:text-theme-text hover:bg-theme-hover rounded-full transition-colors cursor-pointer shrink-0 ml-1"
                  aria-label="Clear search"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </header>
        ) : (
          <header className="h-[60px] sm:h-[68px] shrink-0 bg-theme-bg z-20 w-full border-0 px-2.5 sm:px-4 md:px-6">
            <div className="w-full max-w-7xl mx-auto h-full flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0 max-w-[calc(100%-60px)] sm:max-w-md -translate-x-[2px]">
                <button
                  type="button"
                  id="category-back-button"
                  onClick={goBack}
                  className="w-9 h-9 -ml-1 text-theme-text hover:bg-theme-hover active:bg-theme-hover/80 rounded-full transition-colors shrink-0 cursor-pointer flex items-center justify-center"
                  aria-label="Back"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-[17px] sm:text-[19px] font-semibold text-[#0f172a] dark:text-[#f3f4f6] tracking-tight truncate">
                  {selectedCategory}
                </h1>
              </div>

              {/* Search button aligned in relative position to home page PFP/actions on right edge */}
              <div className="flex items-center gap-2 shrink-0 -translate-x-[4px]">
                <button
                  type="button"
                  id="category-search-activate-btn"
                  onClick={handleOpenSearch}
                  className="w-9 h-9 flex items-center justify-center text-[#444746] dark:text-theme-text hover:bg-theme-hover active:bg-theme-hover/80 rounded-full transition-colors cursor-pointer"
                  aria-label="Search"
                  title="Search"
                >
                  <Search className="w-5 h-5" />
                </button>
              </div>
            </div>
          </header>
        )}

        {/* Dynamic Grid of apps occupying full screen */}
        <PullToRefresh
          scrollRef={categoryScrollRef}
          onRefresh={handleCategoryRefresh}
          isRefreshing={isCategoryRefreshing || isPullRefreshing}
          dismissBeforeEnd={true}
          earlyDismissDurationMs={300}
          className="flex-1 min-h-0 flex flex-col w-full relative"
        >
          <div ref={categoryScrollRef} className="flex-1 overflow-y-auto px-2.5 sm:px-4 md:px-6 pt-4 pb-28 w-full">
            {isCategoryLoading || ((isLoadingApps || !hasInitialSyncCompleted) && allApps.length === 0) ? (
              <div className="flex-1 flex items-center justify-center min-h-[50vh] w-full">
                <StoreCircleLoader size="md" />
              </div>
            ) : categoryApps.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 mt-24 text-center">
                <p className="text-theme-text-muted text-sm">No apps found in this category.</p>
              </div>
            ) : filteredCategoryApps.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 mt-24 text-center">
                <p className="text-theme-text-muted text-sm">No apps matching &ldquo;{searchQuery}&rdquo; in {selectedCategory}.</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus({ preventScroll: true });
                  }}
                  className="mt-3 px-4 py-1.5 text-xs font-medium text-blue-500 hover:bg-blue-500/10 rounded-full transition-colors cursor-pointer"
                >
                  Clear search
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(112px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(124px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(136px,1fr))] gap-x-4 sm:gap-x-6 gap-y-7 w-full justify-items-center">
                {filteredCategoryApps.map((app) => {
                  const slug = (app as any).slug || slugifyAppName(app.name) || app.id;
                  const appUrl = `/apps/${encodeURIComponent(slug)}`;
                  return (
                    <a
                      key={app.id}
                      id={`app-item-${app.id}`}
                      href={appUrl}
                      onClick={(e) => {
                        if (!e.metaKey && !e.ctrlKey) {
                          e.preventDefault();
                          onAppClick?.(app.id);
                        }
                      }}
                      className="w-[96px] sm:w-[112px] md:w-[124px] lg:w-[136px] flex flex-col items-start cursor-pointer select-none group relative no-underline text-left"
                    >
                      <div className="w-[96px] h-[96px] sm:w-[112px] sm:h-[112px] md:w-[124px] md:h-[124px] lg:w-[136px] lg:h-[136px] rounded-[22px] sm:rounded-[26px] overflow-hidden shadow-xs mb-2 bg-theme-hover flex items-center justify-center transition-transform duration-150 group-hover:scale-[1.02]">
                        {app.iconUrl && app.iconUrl.trim() ? (
                          <img 
                            src={app.iconUrl} 
                            alt={app.name} 
                            draggable={false}
                            className="w-full h-full object-cover select-none pointer-events-none" 
                          />
                        ) : (
                          <span className="text-2xl font-bold text-blue-500">{app.name.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <h4 className="text-theme-text text-xs sm:text-[13px] font-medium leading-snug line-clamp-1 w-full group-hover:text-blue-500 transition-colors">
                        {app.name}
                      </h4>
                      <div className="flex items-center text-[11px] text-theme-text-muted justify-between gap-1 w-full min-h-[20px] mt-0.5">
                        <span className="truncate">{getUnifiedAppSize(app)}</span>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </PullToRefresh>
      </div>
    );
  }

  // 2. Responsive Categories Layout (List on mobile, multi-column card grid on tablet and desktop)
  return (
    <PullToRefresh
      onRefresh={handleMainRefresh}
      isRefreshing={isMainRefreshing || isPullRefreshing}
      earlyDismissDurationMs={300}
      dismissBeforeEnd={true}
      className="flex-1 min-h-0 flex flex-col w-full relative"
    >
      <div className="w-full min-h-full bg-theme-bg pb-28 font-sans">
        {(isLoadingApps || !hasInitialSyncCompleted) && allApps.length === 0 ? (
          <div className="flex-1 flex items-center justify-center min-h-[50vh] w-full">
            <StoreCircleLoader size="md" />
          </div>
        ) : (
        <div className="w-full py-3 px-2.5 sm:px-4 md:px-6">
          {/* Responsive grid of categories on tablet and desktop, clean list on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 w-full">
            {sortedCategories.map((category) => {
              const IconComponent = CATEGORY_ICON_MAP[category.icon] || Grid;

              const catSlug = slugifyAppName(category.name);
              return (
                <a
                  key={category.id}
                  id={`category-row-${category.id}`}
                  href={`/categories/${encodeURIComponent(catSlug)}`}
                  onClick={(e) => {
                    if (!e.metaKey && !e.ctrlKey) {
                      e.preventDefault();
                      setSelectedCategory(category.name);
                    }
                  }}
                  className="group flex items-center gap-4 sm:gap-5 px-4 sm:px-5 h-[58px] sm:h-[64px] w-full cursor-pointer select-none rounded-2xl transition-colors duration-150 hover:bg-theme-hover/60 active:bg-theme-hover no-underline text-left"
                >
                  {/* Clean left icon matching authentic store design */}
                  <div className="w-6 h-6 flex items-center justify-center shrink-0 text-theme-text-muted group-hover:text-theme-text transition-colors">
                    <IconComponent className="w-[22px] h-[22px] sm:w-6 sm:h-6 stroke-[1.8]" />
                  </div>
                  
                  {/* Category label text */}
                  <span className="text-[15px] sm:text-[16px] font-normal text-theme-text tracking-normal leading-none select-none truncate">
                    {category.name}
                  </span>
                </a>
              );
            })}
          </div>
        </div>
        )}
      </div>
    </PullToRefresh>
  );
}

