import React, { useState, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  Search,
  X,
  MoreVertical,
  Package,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useStoreConfig } from '../context/StoreConfigContext';
import { useBookmarks } from '../services/bookmarkService';
import { AppListing } from '../types';
import { parseDownloadCount, formatDownloadCount, getAppPublisherName } from '../utils/appMetricsAlgorithm';
import { shareAppNative, slugifyAppName } from '../utils/shareUtils';
import PullToRefresh from './PullToRefresh';
import AppLazyImage from './AppLazyImage';
import StoreCircleLoader from './StoreCircleLoader';
import { usePreserveScroll } from '../services/scrollManager';

interface WishlistPageProps {
  onBack: () => void;
  onAppClick?: (id: string) => void;
  title?: string;
  appsList?: AppListing[];
}

export default function WishlistPage({
  onBack,
  onAppClick,
  title = 'Wishlist',
  appsList: propAppsList,
}: WishlistPageProps) {
  const { showToast } = useToast();
  const { allAppListings, apps: storeApps, refreshCatalogue, isPullRefreshing, isLoadingApps, hasInitialSyncCompleted } = useStoreConfig();
  const { bookmarkedIds, toggleBookmark } = useBookmarks();

  const scrollRef = useRef<HTMLDivElement | null>(null);
  usePreserveScroll('wishlist-apps-page', scrollRef);

  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 3-dots dropdown menu states (identical to PublisherConsolePage)
  const [openMenuAppId, setOpenMenuAppId] = useState<string | null>(null);
  const [menuCoords, setMenuCoords] = useState<{
    top?: number;
    bottom?: number;
    right: number;
    transformOrigin: string;
  } | null>(null);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);

  // Resolve full wishlist app items in real time
  const wishlistApps = useMemo(() => {
    if (propAppsList && propAppsList.length > 0 && bookmarkedIds.length === 0) {
      return propAppsList;
    }
    const resolved: AppListing[] = [];
    bookmarkedIds.forEach((id) => {
      const match = allAppListings.find((a) => a.id === id) || (storeApps[id] as AppListing);
      if (match) {
        resolved.push(match);
      }
    });
    return resolved;
  }, [bookmarkedIds, allAppListings, storeApps, propAppsList]);

  // Filter by search query only (filters bar removed per user instruction)
  const filteredApps = useMemo(() => {
    if (!searchQuery.trim()) {
      return wishlistApps;
    }
    const q = searchQuery.toLowerCase().trim();
    return wishlistApps.filter(
      (app) =>
        app.name?.toLowerCase().includes(q) ||
        app.developer?.toLowerCase().includes(q) ||
        app.category?.toLowerCase().includes(q) ||
        app.shortDescription?.toLowerCase().includes(q)
    );
  }, [wishlistApps, searchQuery]);

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

  const handleToggleMenu = (appId: string, triggerBtn: HTMLButtonElement) => {
    if (openMenuAppId === appId) {
      setOpenMenuAppId(null);
      setMenuCoords(null);
      menuTriggerRef.current = null;
      return;
    }

    const rect = triggerBtn.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const estimatedMenuHeight = 180;
    const spaceBelow = viewportHeight - rect.bottom;
    const rightOffset = Math.max(12, viewportWidth - rect.right);

    if (spaceBelow >= estimatedMenuHeight || spaceBelow > rect.top) {
      setMenuCoords({
        top: rect.bottom + 4,
        right: rightOffset,
        transformOrigin: 'top right',
      });
    } else {
      setMenuCoords({
        bottom: viewportHeight - rect.top + 4,
        right: rightOffset,
        transformOrigin: 'bottom right',
      });
    }

    setOpenMenuAppId(appId);
    menuTriggerRef.current = triggerBtn;
  };

  const handleRemoveAppFromWishlist = (app: AppListing) => {
    toggleBookmark(app.id);
    setOpenMenuAppId(null);
    setMenuCoords(null);
    showToast('Removed from wishlist', {
      type: 'info',
      actionLabel: 'Undo',
      onAction: () => {
        toggleBookmark(app.id);
        showToast('Added to wishlist', {
          type: 'success',
        });
      },
    });
  };

  return (
    <div className="flex flex-col h-full w-full bg-theme-bg select-none overflow-hidden relative">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-theme-bg h-[60px] sm:h-[68px] shrink-0 px-2.5 sm:px-4 md:px-6 lg:px-8 flex items-center justify-between gap-3 border-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 -translate-x-[2px]">
          <button
            type="button"
            id="wishlist-back-button"
            onClick={onBack}
            className="w-9 h-9 -ml-1 text-theme-text hover:bg-theme-hover active:bg-theme-hover/80 rounded-full transition-colors shrink-0 cursor-pointer flex items-center justify-center"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-theme-text" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-[17px] sm:text-[19px] font-medium font-google-sans tracking-tight text-theme-text truncate">
              {title}
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content Area: Apps List matching Console style */}
      <PullToRefresh
        scrollRef={scrollRef}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing || isPullRefreshing}
        earlyDismissDurationMs={300}
        dismissBeforeEnd={true}
        className="flex-1 min-h-0 flex flex-col w-full relative"
      >
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 sm:px-4 md:px-6 lg:px-8 pt-2 sm:pt-3 pb-[calc(76px+env(safe-area-inset-bottom,16px))] md:pb-8 scrollbar-hide flex flex-col min-h-0 w-full max-w-7xl mx-auto"
        >
          {/* Search Bar - On Page (identical to Console page) */}
          <div className="w-full mb-2">
            <div className="w-full flex items-center bg-theme-hover rounded-full h-[46px] px-4 transition-colors">
              <Search className="w-4.5 h-4.5 text-theme-text-muted mr-3 shrink-0" />
              <input
                id="wishlist-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search wishlist"
                className="flex-1 min-w-0 w-full bg-transparent text-theme-text text-[15px] font-normal focus:outline-none placeholder:text-theme-text-muted"
              />
              {searchQuery && (
                <button
                  type="button"
                  id="wishlist-search-clear"
                  onClick={() => setSearchQuery('')}
                  className="p-1 -mr-1 text-theme-text-muted hover:text-theme-text rounded-full shrink-0 flex items-center justify-center cursor-pointer transition-colors"
                  aria-label="Clear query"
                  title="Clear query"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {searchQuery.trim() && (
              <div className="flex items-center text-[11px] text-theme-text-muted mt-1.5 px-2">
                <span>{filteredApps.length} {filteredApps.length === 1 ? 'app' : 'apps'} found</span>
              </div>
            )}
          </div>

          {/* Apps Listing - 100% Identical markup and classes to AppConsole */}
          <div className="w-full flex flex-col space-y-1">
            {(isLoadingApps || !hasInitialSyncCompleted) && bookmarkedIds.length > 0 && wishlistApps.length === 0 ? (
              <div className="flex-1 flex items-center justify-center min-h-[50vh] w-full">
                <StoreCircleLoader size="md" />
              </div>
            ) : wishlistApps.length === 0 ? (
              <div className="py-14 px-6 text-center flex flex-col items-center justify-center">
                <div className="w-14 h-14 rounded-2xl bg-theme-hover border border-theme-border flex items-center justify-center text-theme-text-muted mb-3 opacity-80">
                  <Package className="w-7 h-7 stroke-[1.5]" />
                </div>
                <p className="text-base font-semibold text-theme-text">
                  Your wishlist is empty
                </p>
                <p className="text-xs text-theme-text-muted mt-1 max-w-xs leading-relaxed">
                  Tap the wishlist icon on any app details header to save apps and games you want to install later.
                </p>
                <button
                  type="button"
                  onClick={onBack}
                  className="mt-5 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-medium rounded-full transition-colors cursor-pointer shadow-xs"
                >
                  Explore apps
                </button>
              </div>
            ) : filteredApps.length === 0 ? (
              <div className="py-14 px-6 text-center flex flex-col items-center justify-center">
                <div className="w-14 h-14 rounded-2xl bg-theme-hover border border-theme-border flex items-center justify-center text-theme-text-muted mb-3 opacity-80">
                  <Package className="w-7 h-7 stroke-[1.5]" />
                </div>
                <p className="text-base font-semibold text-theme-text">
                  No matching apps
                </p>
                <p className="text-xs text-theme-text-muted mt-1 max-w-xs leading-relaxed">
                  No saved apps match &ldquo;{searchQuery}&rdquo;
                </p>
              </div>
            ) : (
              filteredApps.map((app) => {
                const rawDownloads = app.downloadsCount ?? parseDownloadCount(app.downloads);
                const downloadsFormatted = rawDownloads > 0 ? formatDownloadCount(rawDownloads) : (app.downloads || '0+');
                const isRated = typeof app.rating === 'number' && app.rating > 0;
                const averageRating = isRated ? app.rating.toFixed(1) : null;

                const slug = (app as any).slug || slugifyAppName(app.name) || app.id;
                const appUrl = `/apps/${encodeURIComponent(slug)}`;

                return (
                  <div
                    key={app.id}
                    id={`app-item-${app.id}`}
                    className="w-full flex items-center justify-between gap-3 py-2 sm:py-2.5 rounded-xl select-none bg-transparent group relative outline-none transition-colors"
                  >
                    <a
                      href={appUrl}
                      onClick={(e) => {
                        if (!e.metaKey && !e.ctrlKey) {
                          e.preventDefault();
                          onAppClick?.(app.id);
                        }
                      }}
                      className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer no-underline text-left"
                    >
                      {/* App Icon */}
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden shrink-0 bg-theme-hover shadow-xs border-0 flex items-center justify-center">
                        <AppLazyImage
                          src={app.iconUrl}
                          alt={app.name}
                          fallbackText={app.name}
                          className="w-full h-full object-cover"
                          containerClassName="w-full h-full"
                        />
                      </div>

                      {/* App Details */}
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h4 className="text-theme-text text-[15px] sm:text-base font-medium leading-tight truncate group-hover:text-blue-500 transition-colors">
                            {app.name}
                          </h4>
                        </div>

                        <p className="text-theme-text-muted text-xs sm:text-[13px] mb-1 truncate">
                          {getAppPublisherName(app)} {app.category ? `• ${app.category}` : ''}
                        </p>

                        <div className="flex items-center gap-1.5 text-xs text-theme-text-muted whitespace-nowrap overflow-hidden text-ellipsis">
                          {isRated ? (
                            <span className="flex items-center gap-0.5 font-medium text-theme-text shrink-0">
                              <span>{averageRating}</span>
                              <span className="text-[10px] text-amber-400">★</span>
                            </span>
                          ) : (
                            <span className="shrink-0 text-theme-text-muted">Unrated</span>
                          )}
                          {downloadsFormatted && (
                            <span className="shrink-0 font-medium text-theme-text">• {downloadsFormatted}</span>
                          )}
                          {app.size && <span className="shrink-0">• {app.size}</span>}
                        </div>
                      </div>
                    </a>

                    {/* 3 Dots Menu Button - aligned equally matching Console page */}
                    <div className="relative shrink-0 flex items-center justify-center -mr-2.5 sm:-mr-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        id={`app-menu-btn-${app.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleMenu(app.id, e.currentTarget);
                        }}
                        className={`w-9 h-9 flex items-center justify-center text-[#444746] dark:text-theme-text hover:bg-theme-hover active:bg-theme-hover/80 rounded-full transition-colors cursor-pointer ${
                          openMenuAppId === app.id ? 'bg-theme-hover text-theme-text' : ''
                        }`}
                        aria-label="More actions"
                        title="More actions"
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </PullToRefresh>

      {/* Dynamic 3-Dots Dropdown Menu - 100% Identical to PublisherConsolePage */}
      {openMenuAppId && menuCoords && (() => {
        const app = filteredApps.find((a) => a.id === openMenuAppId) || wishlistApps.find((a) => a.id === openMenuAppId);
        if (!app) return null;

        return (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenuAppId(null);
                setMenuCoords(null);
                menuTriggerRef.current = null;
              }}
            />
            <div
              id={`publisher-menu-dropdown-${app.id}`}
              style={{
                position: 'fixed',
                top: menuCoords.top !== undefined ? `${menuCoords.top}px` : undefined,
                bottom: menuCoords.bottom !== undefined ? `${menuCoords.bottom}px` : undefined,
                right: `${menuCoords.right}px`,
                transformOrigin: menuCoords.transformOrigin,
                maxHeight: 'calc(100vh - 32px)',
              }}
              className="w-52 bg-theme-card rounded-xl shadow-xl py-1.5 z-50 border border-theme-border/20 flex flex-col animate-in fade-in zoom-in-95 duration-100 overflow-y-auto scrollbar-hide"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                id={`publisher-menu-view-store-${app.id}`}
                onClick={() => {
                  setOpenMenuAppId(null);
                  setMenuCoords(null);
                  menuTriggerRef.current = null;
                  onAppClick?.(app.id);
                }}
                className="w-full text-left px-4 py-2 hover:bg-theme-hover text-theme-text text-sm font-medium transition-colors cursor-pointer"
              >
                View in Store
              </button>

              <button
                id={`publisher-menu-remove-wishlist-${app.id}`}
                onClick={() => {
                  handleRemoveAppFromWishlist(app);
                }}
                className="w-full text-left px-4 py-2 hover:bg-theme-hover text-theme-text text-sm font-medium transition-colors cursor-pointer"
              >
                Remove from wishlist
              </button>

              <button
                id={`publisher-menu-share-${app.id}`}
                onClick={() => {
                  setOpenMenuAppId(null);
                  setMenuCoords(null);
                  menuTriggerRef.current = null;
                  shareAppNative(app, showToast);
                }}
                className="w-full text-left px-4 py-2 hover:bg-theme-hover text-theme-text text-sm font-medium transition-colors cursor-pointer"
              >
                Share App
              </button>
            </div>
          </>
        );
      })()}
    </div>
  );
}
