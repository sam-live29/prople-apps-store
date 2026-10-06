import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ArrowLeft, MoreVertical, Share2, ArrowRight, Globe, Phone, Mail, ExternalLink, Copy, Check, GitBranch, HardDrive, FileCode, ChevronDown, ChevronLeft, ChevronRight, Play, Pause, RefreshCw, ShieldAlert, ShieldCheck, Loader2, X, Lock, EyeOff, Zap, Info, HelpCircle, Maximize2, Clock, LayoutGrid, UserCheck, FileText, MapPin, Download, BookmarkPlus, BookmarkCheck, Package } from 'lucide-react';
import PenguinIcon from './PenguinIcon';
import StoreCircleLoader from './StoreCircleLoader';
import LinuxIcon from './LinuxIcon';
import WindowsIcon from './WindowsIcon';
import AndroidIcon from './AndroidIcon';
import MacIcon from './MacIcon';
import AppleIcon from './AppleIcon';
import PackageFormatIcon from './PackageFormatIcon';
import { appDetailsMock } from '../data';
import { useInstall, getDirectDownloadUrl, extractExactPackageFileName } from '../context/InstallContext';
import { isBinaryPackage, isBloatOrSecondaryAsset } from '../utils/packageResolution';
import { useToast } from '../context/ToastContext';
import { useBookmarks } from '../services/bookmarkService';
import { useReviews } from '../context/ReviewContext';
import { useStoreConfig } from '../context/StoreConfigContext';
import { useBannerAmbientColors } from '../hooks/useBannerAmbientColors';
import { useAuth } from '../context/AuthContext';
import { listenToApp } from '../services/firestoreAppService';
import { Reviews } from './Reviews';
import AboutAppPage from './AboutAppPage';
import DataSafetyPage from './DataSafetyPage';
import AppRatingsReviewsPage from './AppRatingsReviewsPage';
import WriteReviewPage from './WriteReviewPage';
import AppPermissionsPage from './AppPermissionsPage';
import { RecommendationService, recordUserAppView } from '../services/recommendationService';
import { AppDetails, AppListing, AppDownloadOptionItem } from '../types';
import MediaGalleryLightbox from './MediaUpload/MediaGalleryLightbox';
import AppLazyImage from './AppLazyImage';
import { extractYouTubeId, getYouTubeThumbnail, isYouTubeUrl } from '../utils/mediaUtils';
import { sanitizeSafeUrl, sanitizeExternalUrl, sanitizeYouTubeId, computeDeterministicSha256 } from '../utils/securityUtils';
import { getSafetyHighlightIcon } from '../utils/safetyIcons';
import { 
  calculateAppRatingAndReviews, 
  formatDownloadCount, 
  parseDownloadCount, 
  getContentRatingBadge, 
  getContentRatingLabel,
  getUnifiedAppSize,
  extractGitHubRepoOwner,
  getAppPublisherName,
  normalizeCanonicalPublisherName,
  fetchGitHubReleaseMetadata
} from '../utils/appMetricsAlgorithm';
import { 
  getAppPrimaryActionLabel, 
  getAppActionFileLabel,
  getDownloadingStatusLabel, 
  getVerifyingStatusLabel,
  getAppFormatBadgeLabel,
  isWindowsApp,
  isLinuxApp,
  isMacApp,
  isAndroidApp,
  isIOSApp,
  detectClientOS,
  getClientOSInfo
} from '../services/osDetectionService';
import ConfirmationDialog from './ConfirmationDialog';
import { useAutoResetVideoOnScrollAndPage } from '../hooks/useAutoResetVideoOnScrollAndPage';

function DetailPromoVideoCard({
  app,
  promoYtId,
  customPromoThumb,
  isPlayingInline,
  onPlay,
  onReset,
  onOpenLightbox,
  hasDraggedRef,
}: {
  key?: React.Key;
  app: any;
  promoYtId: string;
  customPromoThumb?: string | null;
  isPlayingInline: boolean;
  onPlay: () => void;
  onReset: () => void;
  onOpenLightbox: () => void;
  hasDraggedRef: any;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);

  useAutoResetVideoOnScrollAndPage({
    isPlaying: isPlayingInline,
    onReset,
    containerRef: cardRef,
    videoId: `detail-promo-video-${app.id}`,
    minVisibilityRatio: 0.15,
  });

  return (
    <div
      ref={cardRef}
      style={{ aspectRatio: '16 / 9' }}
      className="h-[180px] sm:h-[220px] md:h-[270px] lg:h-[330px] xl:h-[360px] w-auto shrink-0 rounded-[4px] overflow-hidden shadow-sm hover:shadow-md bg-black relative cursor-pointer group transition-shadow duration-200"
    >
      {isPlayingInline ? (
        <div className="relative w-full h-full">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${promoYtId}?autoplay=1&rel=0&playsinline=1`}
            title={`${app.name} Trailer`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="w-full h-full border-0 block"
          />
          <div className="absolute top-2 right-2 flex items-center gap-1.5 z-30 pointer-events-auto">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenLightbox();
              }}
              title="Fullscreen"
              className="p-1.5 rounded-full bg-black/75 hover:bg-black/90 text-white backdrop-blur-md transition-colors cursor-pointer shadow-md"
              aria-label="Open fullscreen"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onReset();
              }}
              title="Close Video"
              className="p-1.5 rounded-full bg-black/75 hover:bg-black/90 text-white backdrop-blur-md transition-colors cursor-pointer shadow-md"
              aria-label="Close video"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div
          className="relative w-full h-full"
          onClick={() => {
            if (!hasDraggedRef.current) {
              onPlay();
            }
          }}
        >
          <img
            src={customPromoThumb || getYouTubeThumbnail(promoYtId, 'hq')}
            alt={`${app.name} preview video`}
            draggable={false}
            onError={(e) => {
              if (e.currentTarget.src.includes('maxresdefault')) {
                e.currentTarget.src = getYouTubeThumbnail(promoYtId, 'hq');
              }
            }}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200 select-none pointer-events-none rounded-[4px]"
          />
          <div className="absolute inset-0 bg-black/25 group-hover:bg-black/15 transition-colors flex items-center justify-center pointer-events-none">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
              <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-white text-white translate-x-0.5" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailScreenshotVideoCard({
  app,
  screenshot,
  index,
  mediaIdx,
  ytId,
  thumb,
  isPlayingInline,
  onPlay,
  onReset,
  onOpenLightbox,
  hasDraggedRef,
}: {
  key?: React.Key;
  app: any;
  screenshot: string;
  index: number;
  mediaIdx: number;
  ytId: string;
  thumb?: string | null;
  isPlayingInline: boolean;
  onPlay: () => void;
  onReset: () => void;
  onOpenLightbox: () => void;
  hasDraggedRef: any;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);

  useAutoResetVideoOnScrollAndPage({
    isPlaying: isPlayingInline,
    onReset,
    containerRef: cardRef,
    videoId: `detail-screenshot-video-${app.id}-${index}`,
    minVisibilityRatio: 0.15,
  });

  return (
    <div
      ref={cardRef}
      key={`yt-shot-${index}`}
      style={{ aspectRatio: '16 / 9' }}
      className="h-[180px] sm:h-[220px] md:h-[270px] lg:h-[330px] xl:h-[360px] w-auto shrink-0 rounded-[4px] overflow-hidden shadow-sm hover:shadow-md bg-black relative cursor-pointer group transition-shadow duration-200"
    >
      {isPlayingInline ? (
        <div className="relative w-full h-full">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0&playsinline=1`}
            title={`${app.name} Video ${index + 1}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="w-full h-full border-0 block"
          />
          <div className="absolute top-2 right-2 flex items-center gap-1.5 z-30 pointer-events-auto">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenLightbox();
              }}
              title="Fullscreen"
              className="p-1.5 rounded-full bg-black/75 hover:bg-black/90 text-white backdrop-blur-md transition-colors cursor-pointer shadow-md"
              aria-label="Open fullscreen"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onReset();
              }}
              title="Close Video"
              className="p-1.5 rounded-full bg-black/75 hover:bg-black/90 text-white backdrop-blur-md transition-colors cursor-pointer shadow-md"
              aria-label="Close video"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div
          className="relative w-full h-full"
          onClick={() => {
            if (!hasDraggedRef.current) {
              onPlay();
            }
          }}
        >
          {thumb ? (
            <img
              src={thumb}
              alt={`${app.name} video preview ${index + 1}`}
              draggable={false}
              onError={(e) => {
                if (e.currentTarget.src.includes('maxresdefault')) {
                  e.currentTarget.src = getYouTubeThumbnail(ytId, 'hq');
                }
              }}
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200 select-none pointer-events-none rounded-[4px]"
            />
          ) : (
            <div className="w-full h-full bg-theme-hover flex items-center justify-center">
              <Play className="w-8 h-8 text-theme-text-muted" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/25 group-hover:bg-black/15 transition-colors flex items-center justify-center pointer-events-none">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
              <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-white text-white translate-x-0.5" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
import { FlagAppModal } from './FlagAppModal';
import { AdminModerationService } from '../services/adminModerationService';
import { shareAppNative, copyAppDownloadLink, getAppShareUrl, slugifyAppName } from '../utils/shareUtils';
import { useNavigation } from '../context/NavigationContext';
import { usePreserveScroll } from '../services/scrollManager';
import { updateAppPageSeo, restoreDefaultSeo } from '../utils/seoHelper';

// Global module-level aspect ratio cache to eliminate Cumulative Layout Shift (CLS) and initial width jumps across views
const globalScreenshotAspectRatioCache: Record<string, number> = {};

export default function AppDetailPage({ 
  appId, 
  onBack, 
  onShowSimilarApps, 
  onOpenSearch, 
  onOrgClick,
  onAppClick 
}: { 
  key?: React.Key;
  appId: string; 
  onBack: () => void; 
  onShowSimilarApps?: () => void; 
  onOpenSearch?: () => void; 
  onOrgClick?: (orgName: string) => void;
  onAppClick?: (appId: string) => void;
}) {
  const { 
    detailView, 
    openDetailSubView, 
    goBack: navGoBack, 
    writeReviewRating: contextRating,
    targetReviewId,
    openAppReviews,
    openPrivacyPolicy,
    openTermsOfService,
    openWishlist,
    openBookmarkedApps
  } = useNavigation();

  const { showToast } = useToast();
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const isCurrentAppBookmarked = isBookmarked(appId);

  const handleToggleBookmark = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const nextState = toggleBookmark(appId);
    if (nextState) {
      showToast('Added to wishlist', {
        type: 'success',
        actionLabel: 'View',
        onAction: () => {
          if (openWishlist) {
            openWishlist();
          } else {
            openBookmarkedApps();
          }
        },
      });
    } else {
      showToast('Removed from wishlist', {
        type: 'info',
        actionLabel: 'Undo',
        onAction: () => {
          toggleBookmark(appId);
          showToast('Added to wishlist', {
            type: 'success',
            actionLabel: 'View',
            onAction: () => {
              if (openWishlist) {
                openWishlist();
              } else {
                openBookmarkedApps();
              }
            },
          });
        },
      });
    }
  };

  const { user } = useAuth();

  const [isScrolled, setIsScrolled] = useState(false);
  const [isAppSupportOpen, setIsAppSupportOpen] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [writeReviewRating, setWriteReviewRating] = useState<number>(0);

  const setDetailView = (view: 'none' | 'about' | 'data-safety' | 'reviews' | 'write-review' | 'permissions') => {
    if (view === 'none') {
      navGoBack();
    } else {
      openDetailSubView(view);
    }
  };

  const [copiedHash, setCopiedHash] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [showUninstallConfirm, setShowUninstallConfirm] = useState(false);
  const [isFlagAppModalOpen, setIsFlagAppModalOpen] = useState(false);
  const [flaggedAppIds, setFlaggedAppIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('appmarket_flagged_apps_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleConfirmFlagApp = (_reason: string) => {
    if (!flaggedAppIds.includes(appId)) {
      const updated = [...flaggedAppIds, appId];
      setFlaggedAppIds(updated);
      try {
        localStorage.setItem('appmarket_flagged_apps_v1', JSON.stringify(updated));
      } catch (err) {
        console.warn('Failed to save flagged app', err);
      }
    }
    try {
      AdminModerationService.recordAppReport({
        id: appId,
        name: app?.name || 'Untitled App',
        iconUrl: app?.iconUrl,
        developer: app?.developer,
        category: app?.category,
        githubRepo: app?.githubRepo,
        downloadUrl: app?.downloadUrl
      }, _reason || 'Inappropriate content');
    } catch (e) {
      console.warn('Failed to record app moderation report', e);
    }
    showToast('App flagged as inappropriate. Sent for moderation.');
  };

  const [imageAspectRatios, setImageAspectRatios] = useState<Record<string, number>>({});
  const [inlinePlayingVideo, setInlinePlayingVideo] = useState<string | null>(null);
  const [isPlayingBannerVideo, setIsPlayingBannerVideo] = useState(false);
  const [isWhatsNewDismissed, setIsWhatsNewDismissed] = useState(false);

  const bannerVideoRef = useRef<HTMLDivElement | null>(null);

  // Automatically pause, stop, and reset banner video when scrolled out of view or on page/tab change
  useAutoResetVideoOnScrollAndPage({
    isPlaying: isPlayingBannerVideo,
    onReset: () => setIsPlayingBannerVideo(false),
    containerRef: bannerVideoRef,
    videoId: `app-banner-video-${appId}`,
    minVisibilityRatio: 0.15,
  });

  // Reset What's new dismissal and playing videos when switching apps
  useEffect(() => {
    setIsWhatsNewDismissed(false);
    setInlinePlayingVideo(null);
    setIsPlayingBannerVideo(false);
  }, [appId]);

  // Close lightbox on Escape / Back
  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setLightboxOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [lightboxOpen]);
  
  // Drag-to-scroll for free preview screenshots movement
  const previewScrollRef = useRef<HTMLDivElement | null>(null);
  const detailScrollRef = useRef<HTMLDivElement | null>(null);
  usePreserveScroll(`app-detail-${appId}`, detailScrollRef);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const scrollStartXRef = useRef(0);
  const hasDraggedRef = useRef(false);

  const handlePreviewMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || !previewScrollRef.current) return;
    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    dragStartXRef.current = e.pageX;
    scrollStartXRef.current = previewScrollRef.current.scrollLeft;
  };

  const handlePreviewMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !previewScrollRef.current) return;
    const deltaX = e.pageX - dragStartXRef.current;
    if (Math.abs(deltaX) > 4) {
      hasDraggedRef.current = true;
      previewScrollRef.current.scrollLeft = scrollStartXRef.current - deltaX;
    }
  };

  const handlePreviewMouseUp = () => {
    isDraggingRef.current = false;
    setTimeout(() => {
      hasDraggedRef.current = false;
    }, 80);
  };

  const { 
    startInstall, 
    getPendingDownload
  } = useInstall();
  const { getAppReviews } = useReviews();
  const { apps: storeApps, allAppListings, rawAllAppListings, updateApp, activeBanners, isLoadingApps, hasInitialSyncCompleted } = useStoreConfig();

  const pendingDownload = getPendingDownload ? getPendingDownload(appId) : null;

  const similarCatalogApps = useMemo(() => {
    return RecommendationService.getSimilarApps(appId, allAppListings, 16, storeApps);
  }, [appId, allAppListings, storeApps]);

  const [liveApp, setLiveApp] = useState<AppDetails | null>(null);
  const [fetchedApp, setFetchedApp] = useState<AppDetails | null>(() => {
    if (typeof window !== 'undefined' && (window as any).__INITIAL_APP__) {
      const initApp = (window as any).__INITIAL_APP__;
      const cleanTarget = (appId || '').toLowerCase().trim();
      const cleanSlug = cleanTarget.replace(/[^a-z0-9]/g, '');
      const initSlug = (initApp.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const initIdSlug = (initApp.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (
        initApp.id === appId || 
        initApp.id?.toLowerCase() === cleanTarget ||
        initApp.name?.toLowerCase() === cleanTarget ||
        initApp.slug === cleanTarget ||
        (initSlug && initSlug === cleanSlug) ||
        (initIdSlug && initIdSlug === cleanSlug)
      ) {
        return initApp;
      }
    }
    return null;
  });
  const [isDirectFetching, setIsDirectFetching] = useState<boolean>(true);

  // Custom thumbnails state persisted in localStorage
  const [customThumbnails] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem(`app_custom_thumbnails_${appId}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Dynamically resolve app details combining memory listings, Firestore real-time data, and direct endpoint fetch
  const baseApp = useMemo(() => {
    return RecommendationService.getAppById(appId, allAppListings) || 
           RecommendationService.getAppById(appId, rawAllAppListings);
  }, [appId, allAppListings, rawAllAppListings]);

  // Loading screen for each app opening matching Search Results Page
  const [isAppOpeningLoading, setIsAppOpeningLoading] = useState(true);

  useEffect(() => {
    setIsAppOpeningLoading(true);
    setLiveApp(null);
    setFetchedApp(prev => {
      if (!prev) return null;
      const cleanTarget = (appId || '').toLowerCase().trim();
      const cleanSlug = cleanTarget.replace(/[^a-z0-9]/g, '');
      const prevSlug = (prev.slug || slugifyAppName(prev.name || '')).toLowerCase();
      const prevIdSlug = (prev.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (
        prev.id === appId || 
        prev.id?.toLowerCase() === cleanTarget || 
        prev.slug === cleanTarget || 
        prevSlug === cleanSlug ||
        prevIdSlug === cleanSlug
      ) {
        return prev;
      }
      return null;
    });
    setIsWhatsNewDismissed(false);
    setInlinePlayingVideo(null);
    setIsPlayingBannerVideo(false);
    const timer = setTimeout(() => {
      setIsAppOpeningLoading(false);
    }, 280);
    return () => clearTimeout(timer);
  }, [appId]);

  // Targeted direct server-side fetch to guarantee instant resolution on cold devices and deeplinks
  useEffect(() => {
    let isCancelled = false;
    setIsDirectFetching(true);

    if (baseApp || storeApps[appId]) {
      setIsDirectFetching(false);
    }

    const fetchAppDetails = async () => {
      try {
        const res = await fetch(`/api/apps/${encodeURIComponent(appId)}`).catch(() => null);
        if (res && res.ok) {
          const data = await res.json().catch(() => null);
          if (data && data.success && data.app && !isCancelled) {
            setFetchedApp(data.app);
            return;
          }
        }
        const fallbackRes = await fetch(`/api/apps?id=${encodeURIComponent(appId)}`).catch(() => null);
        if (fallbackRes && fallbackRes.ok) {
          const data = await fallbackRes.json().catch(() => null);
          if (data && data.success && data.app && !isCancelled) {
            setFetchedApp(data.app);
            return;
          }
        }
      } catch (err) {
        console.warn('[AppDetailPage] Direct fetch notice:', err);
      } finally {
        if (!isCancelled) {
          setIsDirectFetching(false);
        }
      }
    };
    fetchAppDetails();

    return () => {
      isCancelled = true;
    };
  }, [appId, baseApp]);

  const validFetchedApp = useMemo(() => {
    if (!fetchedApp) return null;
    const cleanTarget = (appId || '').toLowerCase().trim();
    const cleanSlug = cleanTarget.replace(/[^a-z0-9]/g, '');
    const fetchedSlug = (fetchedApp.slug || slugifyAppName(fetchedApp.name || '')).toLowerCase();
    const fetchedIdSlug = (fetchedApp.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (
      fetchedApp.id === appId ||
      fetchedApp.id?.toLowerCase() === cleanTarget ||
      fetchedApp.slug === appId ||
      fetchedSlug === cleanSlug ||
      fetchedIdSlug === cleanSlug ||
      (baseApp && fetchedApp.id === baseApp.id)
    ) {
      return fetchedApp;
    }
    return null;
  }, [fetchedApp, appId, baseApp]);

  const targetAppId = validFetchedApp?.id || baseApp?.id || (storeApps[appId]?.id) || appId;
  const storeApp = storeApps[targetAppId] || storeApps[appId] || (baseApp ? storeApps[baseApp.id] : undefined);
  const detailMock = appDetailsMock[targetAppId] || appDetailsMock[appId];

  // Subscribe to real Firestore app document
  useEffect(() => {
    if (!targetAppId) return;
    const unsub = listenToApp(targetAppId, (data) => {
      if (data && (data.id === targetAppId || data.id === appId)) {
        setLiveApp(data);
      }
    });
    return () => unsub();
  }, [targetAppId, appId]);

  const validLiveApp = (liveApp && (
    liveApp.id === targetAppId || 
    liveApp.id === appId || 
    (validFetchedApp && liveApp.id === validFetchedApp.id)
  )) ? liveApp : null;

  // Strict app resolution: NEVER use dummy fake placeholders ("Application", "Developer", "Coming Soon")
  const resolvedRawApp = validLiveApp || storeApp || validFetchedApp || (baseApp as unknown as AppDetails) || detailMock;

  const app: AppDetails | null = useMemo(() => {
    if (!resolvedRawApp || !resolvedRawApp.name) {
      return null;
    }

    const appSize = getUnifiedAppSize(resolvedRawApp);
    const downloadsFormatted = resolvedRawApp.downloads 
      ? formatDownloadCount(resolvedRawApp.downloads) 
      : (typeof resolvedRawApp.downloadsCount === 'number' ? formatDownloadCount(resolvedRawApp.downloadsCount) : '0+');

    return {
      id: resolvedRawApp.id || targetAppId,
      name: resolvedRawApp.name,
      developer: resolvedRawApp.developer || 'Verified Publisher',
      category: resolvedRawApp.category || 'General',
      rating: resolvedRawApp.rating ?? 0,
      ratingsCount: resolvedRawApp.ratingsCount ?? 0,
      reviewsCount: resolvedRawApp.reviewsCount || (resolvedRawApp.ratingsCount ? `${resolvedRawApp.ratingsCount} review${resolvedRawApp.ratingsCount === 1 ? '' : 's'}` : '0 reviews'),
      size: appSize,
      downloads: downloadsFormatted,
      downloadsCount: resolvedRawApp.downloadsCount ?? (resolvedRawApp.downloads ? parseDownloadCount(resolvedRawApp.downloads) : 0),
      contentRating: resolvedRawApp.contentRating || 'Rated for 3+',
      price: resolvedRawApp.price || 'Free',
      type: resolvedRawApp.type || 'github_release',
      url: resolvedRawApp.url || '#',
      githubRepo: resolvedRawApp.githubRepo,
      githubReleaseUrl: resolvedRawApp.githubReleaseUrl,
      downloadUrl: resolvedRawApp.downloadUrl,
      releaseTag: resolvedRawApp.releaseTag || 'v1.0.0',
      versionName: resolvedRawApp.versionName || '1.0.0',
      assetName: resolvedRawApp.assetName || (resolvedRawApp.downloadUrl ? decodeURIComponent(resolvedRawApp.downloadUrl.split('?')[0].split('#')[0].split('/').pop() || '').trim() : ''),
      sha256: resolvedRawApp.sha256,
      releaseNotes: resolvedRawApp.releaseNotes,
      containsAds: resolvedRawApp.containsAds || false,
      inAppPurchases: resolvedRawApp.inAppPurchases || false,
      iconUrl: resolvedRawApp.iconUrl || '',
      featureGraphicUrl: resolvedRawApp.featureGraphicUrl || '',
      detailsBannerUrl: (resolvedRawApp as any)?.detailsBannerUrl || '',
      heroBannerUrl: (resolvedRawApp as any)?.heroBannerUrl || '',
      screenshots: resolvedRawApp.screenshots || [],
      tabletScreenshots: resolvedRawApp.tabletScreenshots || [],
      promoVideoUrl: resolvedRawApp.promoVideoUrl || '',
      videoThumbnailUrl: (resolvedRawApp.videoThumbnailUrl || ''),
      tagline: resolvedRawApp.tagline || '',
      aboutText: resolvedRawApp.aboutText || resolvedRawApp.description || `${resolvedRawApp.name} on Prople Store.`,
      tags: resolvedRawApp.tags || [resolvedRawApp.category || 'App', 'Verified'].filter(Boolean),
      developerInfo: resolvedRawApp.developerInfo || {
        website: resolvedRawApp.url,
        github: resolvedRawApp.githubRepo ? `https://github.com/${resolvedRawApp.githubRepo.split('/')[0]}` : undefined,
        email: resolvedRawApp.developer ? `support@${resolvedRawApp.developer.toLowerCase().replace(/[^a-z0-9]/g, '')}.org` : undefined
      },
      reviews: resolvedRawApp.reviews || [],
      platform: resolvedRawApp.platform,
      targetOs: resolvedRawApp.targetOs,
      packageFormat: resolvedRawApp.packageFormat,
      dataSafety: resolvedRawApp.dataSafety
    };
  }, [resolvedRawApp, targetAppId]);

  // Dynamically update document title, OpenGraph, Twitter, and Schema.org JSON-LD for Google ranking & visibility
  useEffect(() => {
    if (app && app.name) {
      updateAppPageSeo(app);
      recordUserAppView(app);
    }
    return () => {
      restoreDefaultSeo();
    };
  }, [app?.id, app?.name, app?.category, app?.platform, app?.aboutText, app?.tagline, app?.rating, app?.downloads]);

  // Sync and persist custom video thumbnail to localStorage so it never goes missing
  useEffect(() => {
    if (appId && app?.videoThumbnailUrl && app?.promoVideoUrl) {
      try {
        const saved = localStorage.getItem(`app_custom_thumbnails_${appId}`);
        const current = saved ? JSON.parse(saved) : {};
        if (current[app.promoVideoUrl] !== app.videoThumbnailUrl) {
          current[app.promoVideoUrl] = app.videoThumbnailUrl;
          localStorage.setItem(`app_custom_thumbnails_${appId}`, JSON.stringify(current));
        }
      } catch {}
    }
  }, [appId, app?.videoThumbnailUrl, app?.promoVideoUrl]);

  // Upstream GitHub repo owner - extracted from release metadata or repo URL
  const repoOwner = 
    app?.githubRepoOwner || 
    app?.developerInfo?.githubRepoOwner || 
    (app ? extractGitHubRepoOwner(app.githubReleaseUrl || app.githubRepo || app.downloadUrl || app.developerInfo?.github || app.developerInfo?.website) : '') || 
    '';

  // Publisher name: dynamically inherited from the publisher's editable profile name
  const isPublisherAccount = Boolean(
    user && app && (
      (user.uid && (app.developerId === user.uid || app.creatorUid === user.uid || app.owner === user.uid)) ||
      (user.email && (
        (app.developerEmail && app.developerEmail.toLowerCase() === user.email.toLowerCase()) ||
        (app.publisherEmail && app.publisherEmail.toLowerCase() === user.email.toLowerCase()) ||
        (app.ownerEmail && (app as any).ownerEmail?.toLowerCase() === user.email.toLowerCase()) ||
        (app.developerInfo?.email && app.developerInfo.email.toLowerCase() === user.email.toLowerCase())
      ))
    )
  );

  const publisherDisplayName = (
    app?.publisherName ||
    app?.developer ||
    (app as any)?.publishedBy ||
    app?.developerInfo?.publisherName ||
    (isPublisherAccount && (user?.publisherName || user?.displayName)) ||
    'Verified Publisher'
  ).trim();

  // Support email: preserved authenticated publisher email, non-hideable
  const supportEmail = app?.developerInfo?.email || app?.developerEmail || app?.publisherEmail || (user?.email && isPublisherAccount ? user.email : '');
  const effectiveSupportEmail = supportEmail || (user?.email && isPublisherAccount ? user.email : (publisherDisplayName === 'Sahanur Molla' ? 'sahanurmolla190@gmail.com' : 'support@prople.co.in'));
  const effectivePublisher = publisherDisplayName || app?.developer || 'Verified Publisher';
  const effectiveRepoOwner = repoOwner || '';
  const effectiveSha256 = useMemo(() => {
    if (app?.sha256 && app.sha256.trim().length >= 32) {
      return app.sha256.trim();
    }
    const seed = `${app?.id || ''}:${app?.githubRepo || ''}:${app?.releaseTag || ''}:${app?.versionName || ''}:${app?.assetName || ''}:${app?.downloadUrl || ''}:${app?.name || ''}`;
    return computeDeterministicSha256(seed);
  }, [app?.id, app?.sha256, app?.githubRepo, app?.releaseTag, app?.versionName, app?.assetName, app?.downloadUrl, app?.name]);

  // Active banner lookup for Spotlight Banner features
  const matchingBanner = useMemo(() => {
    if (!activeBanners || !app?.name) return null;
    return activeBanners.find(
      (b) => b.appId === appId || (b.appName && b.appName.toLowerCase() === app.name.toLowerCase())
    );
  }, [activeBanners, appId, app?.name]);

  const rawPromoYtId = app?.promoVideoUrl ? extractYouTubeId(app.promoVideoUrl) : null;
  const promoYtId = sanitizeYouTubeId(rawPromoYtId);

  // Helper to ensure an app logo or icon is NEVER used as a widescreen banner on the app details page
  const isValidBanner = (url?: string | null): boolean => {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    if (!trimmed) return false;

    // Reject if matches app icon
    const appIcon = (app?.iconUrl || '').trim();
    if (appIcon && (trimmed === appIcon || trimmed.toLowerCase() === appIcon.toLowerCase())) {
      return false;
    }

    // Reject if matches matching banner's app icon
    const bannerAppIcon = (matchingBanner?.appIcon || '').trim();
    if (bannerAppIcon && (trimmed === bannerAppIcon || trimmed.toLowerCase() === bannerAppIcon.toLowerCase())) {
      return false;
    }

    // Reject default store logo or icon assets
    const lower = trimmed.toLowerCase();
    if (
      lower === '/logo.png' ||
      lower === '/icon.svg' ||
      lower === '/favicon.ico' ||
      lower === '/favicon.png' ||
      lower === '/pwa-192x192.png' ||
      lower === '/pwa-512x512.png' ||
      lower.endsWith('/logo.png') ||
      lower.endsWith('/icon.svg')
    ) {
      return false;
    }

    return true;
  };

  // If user didn't upload a banner for the app details page, strictly do NOT use app logo as banner
  const candidateBanner =
    (app?.detailsBannerUrl && isValidBanner(app.detailsBannerUrl) ? app.detailsBannerUrl.trim() : '') ||
    (app?.featureGraphicUrl && isValidBanner(app.featureGraphicUrl) ? app.featureGraphicUrl.trim() : '') ||
    ((app as any)?.bannerUrl && isValidBanner((app as any).bannerUrl) ? (app as any).bannerUrl.trim() : '') ||
    (matchingBanner?.imageUrl && isValidBanner(matchingBanner.imageUrl) ? matchingBanner.imageUrl.trim() : '') ||
    (app?.videoThumbnailUrl && isValidBanner(app.videoThumbnailUrl) ? app.videoThumbnailUrl.trim() : '') ||
    (app?.promoVideoUrl && customThumbnails[app.promoVideoUrl] && isValidBanner(customThumbnails[app.promoVideoUrl]) ? customThumbnails[app.promoVideoUrl] : '') ||
    (promoYtId ? getYouTubeThumbnail(promoYtId, 'maxres') || getYouTubeThumbnail(promoYtId, 'hq') : '') ||
    '';

  const bannerGraphic = isValidBanner(candidateBanner) ? candidateBanner : '';

  const ambientColors = useBannerAmbientColors(bannerGraphic);

  const rawOfficialWebsite = (app?.developerInfo?.website?.trim() || (app as any)?.website?.trim() || '');
  const officialWebsite = rawOfficialWebsite && !rawOfficialWebsite.includes('github.com') ? rawOfficialWebsite : '';
  const effectiveOfficialWebsiteUrl = officialWebsite 
    ? sanitizeExternalUrl(officialWebsite)
    : '';

  // GitHub Profile / Org resolution (from Developer & Publisher credentials)
  const rawGitHubProfile = (app?.developerInfo?.github?.trim() || (app as any)?.githubProfile?.trim() || (app as any)?.githubRepo?.trim() || '');
  const isReleaseLink = rawGitHubProfile.includes('/releases');
  const customGitHubProfile = !isReleaseLink && rawGitHubProfile ? rawGitHubProfile : '';
  const effectiveGitHubProfileUrl = customGitHubProfile 
    ? (customGitHubProfile.startsWith('http://') || customGitHubProfile.startsWith('https://') 
        ? sanitizeExternalUrl(customGitHubProfile) 
        : `https://github.com/${customGitHubProfile.replace(/^@/, '').replace(/[^a-zA-Z0-9_-]/g, '')}`)
    : '';
  const displayGitHubProfileName = customGitHubProfile 
    ? (customGitHubProfile.replace(/^https?:\/\/(www\.)?github\.com\/?/, '@').replace(/\/$/, '') || customGitHubProfile)
    : '';

  // Publisher Physical Address (only if non-empty and not dummy placeholder)
  const rawAddress = (app?.developerInfo?.address?.trim() || (app as any)?.address?.trim() || '');
  const isDummyAddress = rawAddress === 'Venture Community Labs, 100 Innovation Way' || 
                         rawAddress.toLowerCase().includes('verified google account publisher') ||
                         rawAddress.toLowerCase().includes('verified developer');
  const publisherPhysicalAddress = !isDummyAddress && rawAddress ? rawAddress : '';

  // Privacy Policy resolution: mandatory essential publisher link
  const rawPrivacyUrl = app?.developerInfo?.privacyPolicy || app?.privacyPolicy;
  const fallbackPrivacyUrl = repoOwner && app?.name 
    ? `https://github.com/${repoOwner}/${app.name.toLowerCase().replace(/\s+/g, '-')}/blob/main/PRIVACY.md` 
    : 'https://prople.store/privacy';
  const privacyPolicyUrl = rawPrivacyUrl || fallbackPrivacyUrl;
  const sanitizedPrivacyUrl = sanitizeSafeUrl(privacyPolicyUrl, '/privacy');
  const isExternalPrivacyUrl = Boolean(
    sanitizedPrivacyUrl && 
    (sanitizedPrivacyUrl.startsWith('http://') || sanitizedPrivacyUrl.startsWith('https://')) && 
    !sanitizedPrivacyUrl.includes('prople.store/privacy')
  );
  const effectivePrivacyUrl = isExternalPrivacyUrl ? sanitizedPrivacyUrl : '/privacy';
  const displayPrivacyUrl = isExternalPrivacyUrl ? sanitizedPrivacyUrl : 'https://prople.store/privacy';

  // Terms and Conditions resolution: mandatory essential publisher link option
  const rawTermsUrl = app?.developerInfo?.termsAndConditions || app?.developerInfo?.termsOfService || app?.termsAndConditions || app?.termsOfService;
  const fallbackTermsUrl = (() => {
    if (rawPrivacyUrl && rawPrivacyUrl.includes('github.com')) {
      if (rawPrivacyUrl.toLowerCase().includes('privacy')) {
        return rawPrivacyUrl.replace(/privacy([._-]policy)?/i, 'TERMS');
      }
      return `${rawPrivacyUrl.replace(/\/$/, '')}/blob/main/TERMS.md`;
    }
    if (repoOwner && app?.name) {
      return `https://github.com/${repoOwner}/${app.name.toLowerCase().replace(/\s+/g, '-')}/blob/main/TERMS.md`;
    }
    return 'https://prople.store/terms';
  })();
  const termsAndConditionsUrl = rawTermsUrl || fallbackTermsUrl;
  const sanitizedTermsUrl = sanitizeSafeUrl(termsAndConditionsUrl, '/terms');
  const isExternalTermsUrl = Boolean(
    sanitizedTermsUrl && 
    (sanitizedTermsUrl.startsWith('http://') || sanitizedTermsUrl.startsWith('https://')) &&
    !sanitizedTermsUrl.includes('prople.store/terms')
  );
  const effectiveTermsUrl = isExternalTermsUrl ? sanitizedTermsUrl : '/terms';
  const displayTermsUrl = isExternalTermsUrl ? sanitizedTermsUrl : 'https://prople.store/terms';

  const promoVideoUrl = app?.promoVideoUrl;
  const featureGraphicUrl = app?.featureGraphicUrl;
  const screenshots = app?.screenshots;
  const tabletScreenshots = app?.tabletScreenshots;

  // Pre-measure screenshots to identify horizontal vs vertical aspect ratios seamlessly
  useEffect(() => {
    const list = [
      ...(screenshots || []),
      ...(tabletScreenshots || []),
      ...(featureGraphicUrl ? [featureGraphicUrl] : [])
    ];
    list.forEach((url) => {
      if (!url || isYouTubeUrl(url)) return;
      if (globalScreenshotAspectRatioCache[url]) {
        setImageAspectRatios((prev) => (prev[url] ? prev : { ...prev, [url]: globalScreenshotAspectRatioCache[url] }));
        return;
      }
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth && img.naturalHeight) {
          const ratio = img.naturalWidth / img.naturalHeight;
          globalScreenshotAspectRatioCache[url] = ratio;
          setImageAspectRatios((prev) => (prev[url] === ratio ? prev : { ...prev, [url]: ratio }));
        }
      };
      img.src = url;
    });
  }, [screenshots, tabletScreenshots, featureGraphicUrl]);

  // Real-time Firestore Reviews
  const reviews = getAppReviews(appId);

  const installData = { state: 'uninstalled', progress: 0 };

  // Handle shared link direct download intent (/download/:appId or ?download=:appId)
  const downloadIntentTriggeredRef = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined' || downloadIntentTriggeredRef.current) return;
    try {
      const url = new URL(window.location.href);
      const isDownloadIntent = 
        url.pathname.includes('/download') || 
        url.searchParams.has('download') || 
        url.searchParams.get('action') === 'download';

      const targetAppDownloadUrl = app?.downloadUrl;
      if (isDownloadIntent && app && targetAppDownloadUrl) {
        if (installData.state === 'uninstalled') {
          downloadIntentTriggeredRef.current = true;
          const targetPlat = (app.platform === 'ios' || isIOSApp(app) || app.packageFormat === 'ipa')
            ? 'ios'
            : (app.platform === 'linux' || isLinuxApp(app))
            ? 'linux' 
            : (app.platform === 'windows' || isWindowsApp(app)) 
            ? 'windows' 
            : (app.platform === 'mac' || isMacApp(app) || app.packageFormat === 'dmg' || app.packageFormat === 'pkg')
            ? 'mac' 
            : 'android';
          showToast(`Direct download requested for ${app.name}...`);
          startInstall(appId, {
            downloadUrl: targetAppDownloadUrl,
            appName: app.name,
            sizeString: getUnifiedAppSize(app),
            iconUrl: app.iconUrl,
            sha256: app.sha256,
            fileName: app.assetName,
            platform: targetPlat,
            packageFormat: app.packageFormat
          });
        }
      }
    } catch {
      // ignore
    }
  }, [appId, app, installData.state, startInstall, showToast]);

  // Auto-recovery timeout: if an app cannot be found after active resolution, return smoothly to store
  useEffect(() => {
    if (app) return;
    const timer = setTimeout(() => {
      if (!app) {
        showToast('Application unavailable in store');
        if (onBack) {
          onBack();
        } else {
          navGoBack();
        }
      }
    }, 6000);
    return () => clearTimeout(timer);
  }, [app, onBack, navGoBack, showToast]);

  // While loading or resolving, render smooth store loader.
  if (!app) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-theme-bg text-theme-text font-sans w-full shadow-none overflow-hidden">
        <header className="relative w-full h-[60px] sm:h-[68px] shrink-0 bg-transparent border-0 z-20">
          <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-2.5 sm:px-4 md:px-6 lg:px-8 gap-3">
            <button 
              type="button"
              id="app-detail-back-button"
              onClick={onBack || navGoBack} 
              className="w-9 h-9 -ml-1 rounded-full text-theme-text hover:bg-theme-hover active:bg-theme-hover/80 transition-colors shrink-0 cursor-pointer flex items-center justify-center -translate-x-[2px]"
              aria-label="Back"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center min-h-[50vh] w-full">
          <StoreCircleLoader size="md" />
        </div>
      </div>
    );
  }

  if (detailView === 'about') {
    return <AboutAppPage app={app} onBack={() => setDetailView('none')} />;
  }

  if (detailView === 'data-safety') {
    return <DataSafetyPage app={app} onBack={() => setDetailView('none')} />;
  }

  if (detailView === 'permissions') {
    return <AppPermissionsPage app={app} onBack={() => setDetailView('none')} />;
  }

  if (detailView === 'write-review') {
    return (
      <WriteReviewPage
        app={app}
        initialRating={writeReviewRating}
        onBack={() => setDetailView('none')}
        onSuccess={() => setDetailView('reviews')}
      />
    );
  }

  if (detailView === 'reviews') {
    return (
      <AppRatingsReviewsPage 
        app={app} 
        reviews={reviews} 
        targetReviewId={targetReviewId}
        onWriteReview={(star) => {
          setWriteReviewRating(star || 0);
          setDetailView('write-review');
        }}
        onBack={() => {
          setDetailView('none');
        }} 
      />
    );
  }
  
  const ratingCalculation = calculateAppRatingAndReviews(
    reviews,
    app.rating,
    app.ratingsCount,
    app.reviewsCount
  );
  const averageRating = ratingCalculation.averageRatingFormatted;
  const displayReviewsCount = ratingCalculation.reviewsCountFormatted;
  const isRated = ratingCalculation.isRated;
  const totalReviewsCount = ratingCalculation.totalReviews;

  // Detect user's Operating System and client environment
  const clientOS = detectClientOS();
  const osInfo = getClientOSInfo();
  const isUserOnMac = osInfo.isMacOS;
  const isUserOnLinux = osInfo.isLinux;
  const isUserOnWindows = osInfo.isWindows;
  const isUserOnAndroid = osInfo.isAndroid;
  const isUserOnIOS = osInfo.isIOS;

  // Robust platform resolution: Linux takes strict priority over macOS to prevent misidentification
  const isLin = app.platform === 'linux' || isLinuxApp(app);
  const isWin = app.platform === 'windows' || isWindowsApp(app);
  const isMac = !isLin && !isWin && (app.platform === 'mac' || isMacApp(app) || app.packageFormat === 'dmg' || app.packageFormat === 'pkg');
  const isIos = !isLin && !isWin && !isMac && (app.platform === 'ios' || isIOSApp(app) || app.packageFormat === 'ipa');
  const isAnd = !isLin && !isWin && !isMac && !isIos && (app.platform === 'android' || isAndroidApp(app));

  const resolvedPlatform: 'linux' | 'windows' | 'mac' | 'android' | 'ios' = 
    isLin ? 'linux'
    : isWin ? 'windows'
    : isMac ? 'mac'
    : isIos ? 'ios'
    : (app.platform === 'multiplatform' && isUserOnMac) ? 'mac'
    : (app.platform === 'multiplatform' && isUserOnLinux) ? 'linux'
    : (app.platform === 'multiplatform' && isUserOnWindows) ? 'windows'
    : (app.platform === 'multiplatform' && isUserOnIOS) ? 'ios'
    : 'android';

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setIsScrolled(e.currentTarget.scrollTop > 50);
  };

  const handleCopySha256 = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    showToast('SHA-256 hash copied to clipboard');
    setTimeout(() => setCopiedHash(false), 2500);
  };

  const handleShare = () => {
    shareAppNative(app, showToast);
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-theme-bg text-theme-text font-sans w-full shadow-none overflow-hidden selection:bg-blue-500/30">
      <div
        ref={detailScrollRef}
        tabIndex={0}
        className="flex-1 overflow-y-auto overflow-x-hidden w-full outline-none focus:outline-none overscroll-y-contain relative"
        style={{
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
        }}
        onScroll={handleScroll}
      >
        {/* Top Header & 16:9 Banner Section for Mobile (< md) - Scrolls away naturally with the page */}
        {bannerGraphic ? (
          <div className="block md:hidden relative w-full border-0 border-none shadow-none">
            {/* True 16:9 Banner Card with Ambient Gradients */}
            <div ref={bannerVideoRef} className="relative aspect-[16/9] w-full overflow-hidden select-none border-0 border-none shadow-none ring-0 outline-none sm:rounded-b-2xl bg-black">
              {isPlayingBannerVideo && promoYtId ? (
                /* Inline YouTube Player inside Header Banner */
                <div className="relative w-full h-full bg-black">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${promoYtId}?autoplay=1&rel=0&playsinline=1`}
                    title={`${app.name} Trailer`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="w-full h-full border-0 block"
                  />
                  {/* Controls: Close and Fullscreen */}
                  <div className="absolute top-3 right-3 flex items-center gap-2 z-30 pointer-events-auto">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLightboxIndex(0);
                        setLightboxOpen(true);
                      }}
                      title="Fullscreen Theater Mode"
                      className="p-2 rounded-full bg-black/75 hover:bg-black/90 text-white backdrop-blur-md transition-colors cursor-pointer shadow-lg"
                      aria-label="Open fullscreen"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsPlayingBannerVideo(false);
                      }}
                      title="Close Video"
                      className="p-2 rounded-full bg-black/75 hover:bg-black/90 text-white backdrop-blur-md transition-colors cursor-pointer shadow-lg"
                      aria-label="Close video"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative w-full h-full group">
                  <AppLazyImage
                    src={bannerGraphic}
                    alt={app.name}
                    className="w-full h-full object-cover object-center select-none pointer-events-none brightness-[1.03] contrast-[1.02]"
                    containerClassName="w-full h-full"
                  />

                  {/* Banner Ambient Color Wash (Only in dark mode to preserve dark appearance; omitted in light mode to prevent muddy dark artifacts) */}
                  <div 
                    className="absolute inset-0 pointer-events-none z-10 hidden dark:block"
                    style={ambientColors.titleBackgroundStyle}
                  />

                  {/* Upside Ambient Gradient for crystal-clear header button legibility */}
                  <div 
                    className="absolute inset-x-0 top-0 h-24 sm:h-28 pointer-events-none z-10 bg-gradient-to-b from-black/60 via-black/25 to-transparent dark:from-black/75 dark:via-black/30"
                  />

                  {/* Light Mode Play Store Atmospheric Cloud Mist Fade (Dissolves banner seamlessly into pure white background) */}
                  <div 
                    className="absolute inset-x-0 bottom-0 h-36 sm:h-44 md:h-52 pointer-events-none z-10 block dark:hidden"
                    style={{
                      background: [
                        'linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.08) 20%, rgba(255,255,255,0.32) 42%, rgba(255,255,255,0.68) 65%, rgba(255,255,255,0.92) 84%, #ffffff 100%)',
                        'radial-gradient(ellipse 135% 85% at 50% 100%, #ffffff 0%, rgba(255,255,255,0.96) 48%, rgba(255,255,255,0.55) 76%, transparent 100%)',
                      ].join(', ')
                    }}
                  />

                  {/* Downside Ambient Gradient seamlessly blending into background (Strictly preserved for dark mode) */}
                  <div 
                    className="absolute inset-x-0 bottom-0 h-28 sm:h-36 md:h-44 pointer-events-none z-10 hidden dark:block"
                    style={{
                      background: 'linear-gradient(to top, var(--theme-bg) 0%, color-mix(in srgb, var(--theme-bg) 92%, transparent) 40%, color-mix(in srgb, var(--theme-bg) 40%, transparent) 72%, transparent 100%)'
                    }}
                  />

                  {/* Play Button on Header Banner if app has video */}
                  {promoYtId && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (inlinePlayingVideo) setInlinePlayingVideo(null);
                          setIsPlayingBannerVideo(true);
                        }}
                        className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md text-white flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer pointer-events-auto"
                        title="Play Trailer"
                        aria-label="Play Trailer"
                      >
                        <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-white text-white translate-x-0.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Header buttons directly on the image - completely transparent background, scrolls away naturally. Hidden in image viewer state */}
            <header className={`absolute top-0 inset-x-0 z-20 w-full h-[60px] sm:h-[68px] bg-transparent border-0 border-none shadow-none ${lightboxOpen ? 'opacity-0 pointer-events-none invisible' : ''}`}>
              <div className="h-full flex items-center justify-between px-2.5 sm:px-4 md:px-6 gap-3">
                <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0 -translate-x-[2px]">
                  <button 
                    type="button"
                    id="app-detail-back-button"
                    onClick={onBack || navGoBack} 
                    className="w-9 h-9 -ml-1 rounded-full text-white hover:bg-white/15 active:bg-white/25 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] transition-colors shrink-0 cursor-pointer flex items-center justify-center"
                    aria-label="Back"
                  >
                    <ArrowLeft className="w-6 h-6" />
                  </button>
                </div>

                <div className="flex-1"></div>

                <div className="flex items-center gap-2 shrink-0 translate-x-[11px]">
                  <button 
                    type="button"
                    id="app-detail-wishlist-button"
                    onClick={handleToggleBookmark} 
                    className={`w-9 h-9 flex items-center justify-center rounded-full drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] transition-all cursor-pointer ${
                      isCurrentAppBookmarked 
                        ? 'text-white bg-white/20 hover:bg-white/30 active:scale-95' 
                        : 'text-white hover:bg-white/15 active:bg-white/25 active:scale-95'
                    }`} 
                    aria-label={isCurrentAppBookmarked ? "Remove from wishlist" : "Add to wishlist"}
                    title={isCurrentAppBookmarked ? "In wishlist (tap to remove)" : "Add to wishlist"}
                  >
                     {isCurrentAppBookmarked ? (
                       <BookmarkCheck className="w-5 h-5 transition-transform scale-105" />
                     ) : (
                       <BookmarkPlus className="w-5 h-5 transition-transform" />
                     )}
                  </button>
                  <button 
                    id="app-detail-share-button"
                    onClick={handleShare} 
                    className="w-9 h-9 flex items-center justify-center rounded-full text-white hover:bg-white/15 active:bg-white/25 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] transition-colors cursor-pointer" 
                    aria-label="Share"
                    title="Share"
                  >
                     <Share2 className="w-5 h-5" />
                  </button>
                  <div className="relative flex items-center justify-center w-9 h-9 -translate-x-[7px]">
                    <button 
                      id="app-detail-more-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(!showMenu);
                      }} 
                      className="w-9 h-9 flex items-center justify-center rounded-full text-white hover:bg-white/15 active:bg-white/25 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] transition-colors cursor-pointer" 
                      aria-label="More options"
                      title="More options"
                    >
                       <MoreVertical className="w-5 h-5" />
                    </button>
                    {showMenu && (
                      <>
                        <div 
                          className="fixed inset-0 z-40 bg-transparent" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(false);
                          }} 
                          onTouchStart={(e) => {
                            e.stopPropagation();
                            setShowMenu(false);
                          }}
                        />
                        <div className="absolute right-2 top-full mt-1 w-52 bg-theme-card rounded-xl shadow-xl py-1.5 z-50 text-theme-text animate-in fade-in zoom-in-95 duration-100">
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowMenu(false);
                              handleToggleBookmark();
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-theme-hover text-theme-text text-sm font-medium transition-colors cursor-pointer flex items-center gap-2.5"
                          >
                            {isCurrentAppBookmarked ? (
                              <BookmarkCheck className="w-4 h-4 text-blue-500 dark:text-[#8ab4f8]" />
                            ) : (
                              <BookmarkPlus className="w-4 h-4 text-theme-text-muted" />
                            )}
                            <span>{isCurrentAppBookmarked ? 'Remove from wishlist' : 'Add to wishlist'}</span>
                          </button>
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowMenu(false);
                              setIsFlagAppModalOpen(true);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-theme-hover text-theme-text text-sm font-medium transition-colors cursor-pointer"
                          >
                            Flag as inappropriate
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </header>
          </div>
        ) : (
          /* Header for apps without banner - mobile only, scrolls away with page. Hidden in image viewer state */
          <header className={`block md:hidden relative w-full h-[60px] sm:h-[68px] shrink-0 bg-transparent border-0 border-none shadow-none z-20 ${lightboxOpen ? 'opacity-0 pointer-events-none invisible' : ''}`}>
            <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-2.5 sm:px-4 md:px-6 gap-3">
              <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0 -translate-x-[2px]">
                <button 
                  type="button"
                  id="app-detail-back-button"
                  onClick={onBack || navGoBack} 
                  className="w-9 h-9 -ml-1 text-theme-text hover:bg-theme-hover active:bg-theme-hover/80 rounded-full transition-colors shrink-0 cursor-pointer flex items-center justify-center"
                  aria-label="Back"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1"></div>

              <div className="flex items-center gap-2 shrink-0 translate-x-[11px]">
                <button 
                  type="button"
                  id="app-detail-wishlist-button"
                  onClick={handleToggleBookmark} 
                  className={`w-9 h-9 flex items-center justify-center rounded-full transition-all cursor-pointer ${
                    isCurrentAppBookmarked 
                      ? 'text-blue-600 dark:text-[#8ab4f8] bg-blue-500/10 hover:bg-blue-500/20 active:scale-95' 
                      : 'text-[#444746] dark:text-theme-text hover:bg-theme-hover active:scale-95'
                  }`} 
                  aria-label={isCurrentAppBookmarked ? "Remove from wishlist" : "Add to wishlist"}
                  title={isCurrentAppBookmarked ? "In wishlist (tap to remove)" : "Add to wishlist"}
                >
                   {isCurrentAppBookmarked ? (
                     <BookmarkCheck className="w-5 h-5 transition-transform scale-105" />
                   ) : (
                     <BookmarkPlus className="w-5 h-5 transition-transform" />
                   )}
                </button>
                <button 
                  id="app-detail-share-button"
                  onClick={handleShare} 
                  className="w-9 h-9 flex items-center justify-center text-[#444746] dark:text-theme-text hover:bg-theme-hover rounded-full transition-colors cursor-pointer" 
                  aria-label="Share"
                  title="Share"
                >
                   <Share2 className="w-5 h-5" />
                </button>
                <div className="relative flex items-center justify-center w-9 h-9 -translate-x-[7px]">
                  <button 
                    id="app-detail-more-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(!showMenu);
                    }} 
                    className="w-9 h-9 flex items-center justify-center text-[#444746] dark:text-theme-text hover:bg-theme-hover rounded-full transition-colors cursor-pointer" 
                    aria-label="More options"
                    title="More options"
                  >
                     <MoreVertical className="w-5 h-5" />
                  </button>
                  {showMenu && (
                    <>
                      <div 
                        className="fixed inset-0 z-40 bg-transparent" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMenu(false);
                        }} 
                        onTouchStart={(e) => {
                          e.stopPropagation();
                          setShowMenu(false);
                        }}
                      />
                      <div className="absolute right-2 top-full mt-1 w-52 bg-theme-card rounded-xl shadow-xl py-1.5 z-50 text-theme-text animate-in fade-in zoom-in-95 duration-100">
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(false);
                            handleToggleBookmark();
                          }} 
                          className="w-full text-left px-4 py-2 hover:bg-theme-hover text-theme-text text-sm font-medium transition-colors cursor-pointer flex items-center gap-2.5"
                        >
                          {isCurrentAppBookmarked ? (
                            <BookmarkCheck className="w-4 h-4 text-blue-600 dark:text-[#8ab4f8]" />
                          ) : (
                            <BookmarkPlus className="w-4 h-4 text-theme-text-muted" />
                          )}
                          <span>{isCurrentAppBookmarked ? 'Remove from wishlist' : 'Add to wishlist'}</span>
                        </button>
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(false);
                            setIsFlagAppModalOpen(true);
                          }} 
                          className="w-full text-left px-4 py-2 hover:bg-theme-hover text-theme-text text-sm font-medium transition-colors cursor-pointer"
                        >
                          Flag as inappropriate
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </header>
        )}

        {/* Desktop & Tablet Dedicated Top Navigation Bar (>= md) */}
        <header className={`hidden md:block w-full border-b border-theme-border/15 bg-theme-bg/85 backdrop-blur-md sticky top-0 z-20 ${lightboxOpen ? 'opacity-0 pointer-events-none invisible' : ''}`}>
          <div className="max-w-7xl mx-auto h-14 flex items-center justify-between px-4 md:px-6 lg:px-8 gap-4">
            {/* Left: Back button & Breadcrumbs */}
            <div className="flex items-center gap-3 min-w-0">
              <button 
                type="button"
                id="app-detail-desktop-back-button"
                onClick={onBack || navGoBack} 
                className="h-8 px-3 -ml-2 rounded-full text-theme-text hover:bg-theme-hover active:bg-theme-hover/80 transition-colors shrink-0 cursor-pointer flex items-center gap-1.5 text-xs font-medium font-google-sans"
                aria-label="Back to store"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <span className="text-theme-border/50 text-xs">/</span>

              <nav className="flex items-center gap-1.5 text-xs text-theme-text-muted truncate">
                <span className="hover:text-theme-text transition-colors">Store</span>
                <span>›</span>
                {app.category && (
                  <>
                    <span className="hover:text-theme-text transition-colors">{app.category}</span>
                    <span>›</span>
                  </>
                )}
                <span className="text-theme-text font-medium truncate">{app.name}</span>
              </nav>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button 
                type="button"
                onClick={handleToggleBookmark} 
                className={`h-8 px-3 rounded-full border border-theme-border/40 hover:bg-theme-hover active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-medium ${
                  isCurrentAppBookmarked 
                    ? 'text-blue-600 dark:text-[#8ab4f8] bg-blue-500/10 border-blue-500/30' 
                    : 'text-theme-text'
                }`}
                aria-label={isCurrentAppBookmarked ? "Remove from wishlist" : "Add to wishlist"}
                title={isCurrentAppBookmarked ? "In wishlist" : "Add to wishlist"}
              >
                {isCurrentAppBookmarked ? (
                  <BookmarkCheck className="w-3.5 h-3.5 text-blue-500" />
                ) : (
                  <BookmarkPlus className="w-3.5 h-3.5" />
                )}
                <span>{isCurrentAppBookmarked ? 'In wishlist' : 'Wishlist'}</span>
              </button>

              <button 
                type="button"
                onClick={handleShare} 
                className="h-8 px-3 rounded-full border border-theme-border/40 hover:bg-theme-hover active:scale-95 transition-all text-theme-text cursor-pointer flex items-center gap-1.5 text-xs font-medium"
                aria-label="Share"
                title="Share"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </button>

              <div className="relative flex items-center justify-center -translate-x-[7px]">
                <button 
                  id="app-detail-desktop-more-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(!showMenu);
                  }} 
                  className="w-8 h-8 flex items-center justify-center rounded-full text-theme-text hover:bg-theme-hover transition-colors cursor-pointer" 
                  aria-label="More options"
                  title="More options"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                {showMenu && (
                  <>
                    <div 
                      className="fixed inset-0 z-40 bg-transparent" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                      }} 
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                      }}
                    />
                    <div className="absolute right-0 top-full mt-1 w-52 bg-theme-card rounded-xl shadow-xl py-1.5 z-50 text-theme-text border border-theme-border/30 animate-in fade-in zoom-in-95 duration-100">
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMenu(false);
                          handleToggleBookmark();
                        }} 
                        className="w-full text-left px-4 py-2 hover:bg-theme-hover text-theme-text text-xs font-medium transition-colors cursor-pointer flex items-center gap-2.5"
                      >
                        {isCurrentAppBookmarked ? (
                          <BookmarkCheck className="w-3.5 h-3.5 text-blue-500 dark:text-[#8ab4f8]" />
                        ) : (
                          <BookmarkPlus className="w-3.5 h-3.5 text-theme-text-muted" />
                        )}
                        <span>{isCurrentAppBookmarked ? 'Remove from wishlist' : 'Add to wishlist'}</span>
                      </button>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMenu(false);
                          setIsFlagAppModalOpen(true);
                        }} 
                        className="w-full text-left px-4 py-2 hover:bg-theme-hover text-theme-text text-xs font-medium transition-colors cursor-pointer"
                      >
                        Flag as inappropriate
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        <div 
          className={`w-full max-w-7xl mx-auto px-2.5 sm:px-4 md:px-6 lg:px-8 pb-16 ${
            bannerGraphic 
              ? (isPlayingBannerVideo 
                  ? 'pt-2 sm:pt-4 md:pt-6 relative z-30' 
                  : '-mt-2 sm:-mt-4 md:mt-0 dark:-mt-10 dark:sm:-mt-14 dark:md:mt-0 pt-0 md:pt-6 relative z-30'
                ) 
              : 'pt-1 sm:pt-2 md:pt-6'
          }`}
        >
          {/* Mobile View: Classic Compact Store Header (< md) */}
          <div className="block md:hidden">
            {/* Header: Developer name on top, app title below (Google Play layout) */}
                <div className="pt-0 sm:pt-0.5 pb-1 flex flex-col">
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const pub = (publisherDisplayName || app.developer || '').trim();
                      if (onOrgClick && pub) {
                        onOrgClick(pub);
                      }
                    }}
                    className="text-[#0b57d0] hover:text-[#0842a0] dark:text-[#8ab4f8] text-base sm:text-lg md:text-xl font-medium sm:font-semibold hover:underline text-left truncate cursor-pointer block tracking-normal transition-colors font-google-sans relative z-30"
                  >
                    {publisherDisplayName || app.developer}
                  </button>
                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-normal sm:font-medium text-[#1f1f1f] dark:text-[#f3f4f6] leading-[1.12] tracking-tight mt-0.5 sm:mt-1 mb-3 sm:mb-3.5 break-words line-clamp-2 font-google-sans">
                    {app.name}
                  </h1>
                </div>

                {/* Side-by-side row: App Icon on left + Horizontal Stats on right */}
                <div className="flex items-center gap-3.5 sm:gap-5 w-full mb-3">
                  {/* App Icon */}
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-theme-hover shrink-0 shadow-xs border-0 flex items-center justify-center">
                    <AppLazyImage
                      src={app.iconUrl}
                      alt={app.name}
                      fallbackText={app.name}
                      className="w-full h-full object-cover select-none pointer-events-none"
                      containerClassName="w-full h-full"
                    />
                  </div>

                  {/* Stats Beside Icon (Rating, Content Rating, Size) */}
                  <div className="flex-1 grid grid-cols-3 items-center gap-1 min-w-0">
                    {/* 1. Rating */}
                    <button 
                      onClick={() => setDetailView('reviews')}
                      className="flex flex-col items-center justify-center min-w-0 px-0.5 text-center hover:opacity-80 active:scale-95 transition-all cursor-pointer rounded-lg hover:bg-theme-hover py-1"
                      title="View all ratings and reviews"
                    >
                      <span className="text-sm font-medium mb-0.5 flex items-center justify-center gap-0.5 text-theme-text truncate w-full">
                        {isRated ? (
                          <>
                            <span>{averageRating}</span>
                            <span className="text-[11px] text-amber-400">★</span>
                          </>
                        ) : (
                          <span className="text-sm font-medium text-theme-text">Unrated</span>
                        )}
                      </span>
                      <span className="text-[11px] text-theme-text-muted truncate w-full text-center flex items-center justify-center gap-0.5">
                        <span>{displayReviewsCount}</span>
                        <Info className="w-2.5 h-2.5 text-theme-text-muted shrink-0 hidden sm:inline" />
                      </span>
                    </button>

                    {/* 2. Content Rating */}
                    <div className="flex flex-col items-center justify-center min-w-0 px-0.5 text-center">
                      <span className="text-sm font-medium mb-0.5 text-theme-text flex items-center justify-center gap-1 truncate w-full">
                        <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[9px] font-bold border border-neutral-700 dark:border-0 dark:bg-theme-text dark:text-theme-bg bg-transparent text-neutral-800 rounded-[3px] leading-none tracking-tight shrink-0">
                          {getContentRatingBadge(app.contentRating)}
                        </span>
                      </span>
                      <span className="text-[11px] text-theme-text-muted truncate w-full text-center flex items-center justify-center gap-0.5">
                        <span>{getContentRatingLabel(app.contentRating)}</span>
                        <Info className="w-2.5 h-2.5 text-theme-text-muted shrink-0 hidden sm:inline" />
                      </span>
                    </div>

                    {/* 3. Downloads Count */}
                    <div className="flex flex-col items-center justify-center min-w-0 px-0.5 text-center">
                      <span className="text-sm font-medium mb-0.5 text-theme-text truncate w-full">
                        {app.downloads || '0+'}
                      </span>
                      <span className="text-[11px] text-theme-text-muted truncate w-full text-center">
                        Downloads
                      </span>
                    </div>
                  </div>
                </div>

                {/* Marketplace Download Action with Full-width Button on Mobile */}
                <div className="py-2.5 flex flex-col gap-1.5 w-full">
                  {!app.downloadUrl ? (
                    <div key="state-coming-soon-mob" className="h-11 w-full">
                      <button 
                        disabled
                        className="w-full h-11 bg-theme-hover text-theme-text-muted font-medium rounded-full text-sm cursor-not-allowed opacity-80 flex items-center justify-center gap-2"
                      >
                        {resolvedPlatform === 'ios' ? <AppleIcon className="w-4 h-4 shrink-0 opacity-60" /> : resolvedPlatform === 'mac' ? <MacIcon className="w-4 h-4 shrink-0 opacity-60" /> : resolvedPlatform === 'windows' ? <WindowsIcon className="w-4 h-4 shrink-0 opacity-60" /> : resolvedPlatform === 'linux' ? <LinuxIcon className="w-4 h-4 shrink-0 opacity-60" /> : <AndroidIcon className="w-4 h-4 shrink-0 opacity-60" />}
                        <span>Coming Soon</span>
                      </button>
                    </div>
                  ) : (
                    <div key="state-download-mob" className="flex flex-col gap-2 w-full">
                      {(() => {
                        const directReleaseUrl = getDirectDownloadUrl(app.downloadUrl, app.assetName, resolvedPlatform) || app.downloadUrl || '';
                        const exactFileName = extractExactPackageFileName(directReleaseUrl, app.assetName);
                        const isDirectLink = Boolean(directReleaseUrl && directReleaseUrl !== '#');

                        if (isDirectLink) {
                          return (
                            <a 
                              href={directReleaseUrl}
                              download={exactFileName || ''}
                              onClick={() => {
                                startInstall(appId, {
                                  downloadUrl: directReleaseUrl,
                                  appName: app.name,
                                  sizeString: getUnifiedAppSize(app),
                                  iconUrl: app.iconUrl,
                                  sha256: app.sha256,
                                  fileName: exactFileName || app.assetName,
                                  platform: resolvedPlatform,
                                  packageFormat: app.packageFormat,
                                  skipNativeDispatch: true
                                });
                              }}
                              className="w-full h-11 bg-[#0b57d0] hover:bg-[#0842a0] text-white dark:bg-[#a8c7fa] dark:hover:bg-[#d3e3fd] dark:active:bg-[#7cacf8] dark:text-[#041e49] font-medium font-google-sans rounded-full text-sm sm:text-base transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer select-none no-underline"
                            >
                              {resolvedPlatform === 'ios' ? <AppleIcon className="w-4 h-4 shrink-0" /> : resolvedPlatform === 'mac' ? <MacIcon className="w-4 h-4 shrink-0" /> : resolvedPlatform === 'windows' ? <WindowsIcon className="w-4 h-4 shrink-0" /> : resolvedPlatform === 'linux' ? <LinuxIcon className="w-4 h-4 shrink-0" /> : <AndroidIcon className="w-4 h-4 shrink-0" />}
                              <span>{getAppActionFileLabel(app, resolvedPlatform)}</span>
                            </a>
                          );
                        }

                        return (
                          <button 
                            type="button"
                            onClick={() => {
                              startInstall(appId, {
                                downloadUrl: app.downloadUrl,
                                appName: app.name,
                                sizeString: getUnifiedAppSize(app),
                                iconUrl: app.iconUrl,
                                sha256: app.sha256,
                                fileName: app.assetName,
                                platform: resolvedPlatform,
                                packageFormat: app.packageFormat
                              });
                            }}
                            className="w-full h-11 bg-[#0b57d0] hover:bg-[#0842a0] text-white dark:bg-[#a8c7fa] dark:hover:bg-[#d3e3fd] dark:active:bg-[#7cacf8] dark:text-[#041e49] font-medium font-google-sans rounded-full text-sm sm:text-base transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer select-none"
                          >
                            {resolvedPlatform === 'ios' ? <AppleIcon className="w-4 h-4 shrink-0" /> : resolvedPlatform === 'mac' ? <MacIcon className="w-4 h-4 shrink-0" /> : resolvedPlatform === 'windows' ? <WindowsIcon className="w-4 h-4 shrink-0" /> : resolvedPlatform === 'linux' ? <LinuxIcon className="w-4 h-4 shrink-0" /> : <AndroidIcon className="w-4 h-4 shrink-0" />}
                            <span>{getAppActionFileLabel(app, resolvedPlatform)}</span>
                          </button>
                        );
                      })()}
                    </div>
                  )}

                  {/* Commercial terms & Verified Package Format */}
                  {(() => {
                    const commercialTerms = [
                      app.containsAds ? 'Contains ads' : null,
                      app.inAppPurchases ? 'In-app purchases' : null,
                    ].filter(Boolean).join(' • ');

                    const appSize = getUnifiedAppSize(app);
                    const formatLabel = getAppFormatBadgeLabel(app).label;
                    const priceLabel = app.price && app.price !== 'Free' ? app.price : 'Free';
                    const verificationWithFormat = `${priceLabel} • Verified ${formatLabel}`;
                    const verifiedWithSize = appSize ? `${verificationWithFormat} • ${appSize}` : verificationWithFormat;

                    return (
                      <div className="text-theme-text-muted text-xs px-1 mt-0.5 flex items-center gap-1.5 flex-wrap">
                        {commercialTerms && (
                          <>
                            <span>{commercialTerms}</span>
                            <span>•</span>
                          </>
                        )}
                        <span>{verifiedWithSize}</span>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Desktop & Tablet View: Clean Marketplace Hero (>= md) - Banner removed for desktop only */}
              <div className="hidden md:flex md:items-start md:gap-7 lg:gap-9 pb-6 border-b border-theme-border/25 mb-6">
                {/* Large Desktop/Tablet App Icon */}
                <div className="w-32 h-32 lg:w-36 lg:h-36 rounded-3xl lg:rounded-[30px] overflow-hidden bg-theme-hover shrink-0 shadow-md flex items-center justify-center border border-theme-border/20">
                  <AppLazyImage
                    src={app.iconUrl}
                    alt={app.name}
                    fallbackText={app.name}
                    className="w-full h-full object-cover select-none pointer-events-none"
                    containerClassName="w-full h-full"
                  />
                </div>

                {/* Info & Action Bar */}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const pub = (publisherDisplayName || app.developer || '').trim();
                      if (onOrgClick && pub) {
                        onOrgClick(pub);
                      }
                    }}
                    className="text-[#0b57d0] hover:text-[#0842a0] dark:text-[#8ab4f8] text-base lg:text-lg font-medium hover:underline text-left truncate cursor-pointer block tracking-normal transition-colors font-google-sans"
                  >
                    {publisherDisplayName || app.developer}
                  </button>
                  <h1 className="text-3xl lg:text-4xl xl:text-5xl font-normal font-google-sans text-[#1f1f1f] dark:text-[#f3f4f6] leading-[1.12] tracking-tight mt-1 mb-2 break-words line-clamp-2">
                    {app.name}
                  </h1>

                  <div className="flex items-center gap-2 text-xs text-theme-text-muted mb-3 flex-wrap">
                    {app.category && <span className="font-medium text-theme-text">{app.category}</span>}
                    {app.category && <span>•</span>}
                    <span>{getAppFormatBadgeLabel(app).label}</span>
                    <span>•</span>
                    <span className="text-theme-text font-medium">{app.price && app.price !== 'Free' ? app.price : 'Free'}</span>
                    {app.containsAds && <span>• Contains ads</span>}
                    {app.inAppPurchases && <span>• In-app purchases</span>}
                  </div>

                  {/* Horizontal Stats Strip with dividers */}
                  <div className="flex items-center gap-5 lg:gap-6 py-2 border-y border-theme-border/20 my-1">
                    {/* 1. Rating */}
                    <button 
                      onClick={() => setDetailView('reviews')}
                      className="flex flex-col items-start min-w-0 text-left hover:opacity-80 active:scale-95 transition-all cursor-pointer"
                      title="View all ratings and reviews"
                    >
                      <span className="text-base font-semibold flex items-center gap-1 text-theme-text">
                        {isRated ? (
                          <>
                            <span>{averageRating}</span>
                            <span className="text-xs text-amber-400">★</span>
                          </>
                        ) : (
                          <span>Unrated</span>
                        )}
                      </span>
                      <span className="text-[11px] text-theme-text-muted">
                        {displayReviewsCount}
                      </span>
                    </button>

                    <div className="h-6 w-[1px] bg-theme-border/30" />

                    {/* 2. Content Rating */}
                    <div className="flex flex-col items-start min-w-0">
                      <span className="text-base font-semibold text-theme-text flex items-center gap-1">
                        <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[9px] font-bold border border-neutral-700 dark:border-0 dark:bg-theme-text dark:text-theme-bg bg-transparent text-neutral-800 rounded-[3px] leading-none tracking-tight shrink-0">
                          {getContentRatingBadge(app.contentRating)}
                        </span>
                      </span>
                      <span className="text-[11px] text-theme-text-muted">
                        {getContentRatingLabel(app.contentRating)}
                      </span>
                    </div>

                    <div className="h-6 w-[1px] bg-theme-border/30" />

                    {/* 3. Downloads */}
                    <div className="flex flex-col items-start min-w-0">
                      <span className="text-base font-semibold text-theme-text">
                        {app.downloads || '0+'}
                      </span>
                      <span className="text-[11px] text-theme-text-muted">
                        Downloads
                      </span>
                    </div>

                    <div className="h-6 w-[1px] bg-theme-border/30" />

                    {/* 4. Package Size */}
                    <div className="flex flex-col items-start min-w-0">
                      <span className="text-base font-semibold text-theme-text">
                        {getUnifiedAppSize(app) || 'Verified'}
                      </span>
                      <span className="text-[11px] text-theme-text-muted">
                        Download size
                      </span>
                    </div>
                  </div>

                  {/* Primary CTA Action Row for Desktop/Tablet */}
                  <div className="flex items-center gap-3 mt-4 flex-wrap">
                    {/* Desktop Download/Install Button */}
                    {(() => {
                      const directReleaseUrl = getDirectDownloadUrl(app.downloadUrl, app.assetName, resolvedPlatform) || app.downloadUrl || '';
                      const exactFileName = extractExactPackageFileName(directReleaseUrl, app.assetName);
                      const isDirectLink = Boolean(directReleaseUrl && directReleaseUrl !== '#');

                      if (!app.downloadUrl) {
                        return (
                          <button 
                            disabled
                            className="h-11 px-7 bg-theme-hover text-theme-text-muted font-medium rounded-full text-sm cursor-not-allowed opacity-80 flex items-center justify-center gap-2"
                          >
                            {resolvedPlatform === 'ios' ? <AppleIcon className="w-4 h-4 shrink-0 opacity-60" /> : resolvedPlatform === 'mac' ? <MacIcon className="w-4 h-4 shrink-0 opacity-60" /> : resolvedPlatform === 'windows' ? <WindowsIcon className="w-4 h-4 shrink-0 opacity-60" /> : resolvedPlatform === 'linux' ? <LinuxIcon className="w-4 h-4 shrink-0 opacity-60" /> : <AndroidIcon className="w-4 h-4 shrink-0 opacity-60" />}
                            <span>Coming Soon</span>
                          </button>
                        );
                      }

                      if (isDirectLink) {
                        return (
                          <a 
                            href={directReleaseUrl}
                            download={exactFileName || ''}
                            onClick={() => {
                              startInstall(appId, {
                                downloadUrl: directReleaseUrl,
                                appName: app.name,
                                sizeString: getUnifiedAppSize(app),
                                iconUrl: app.iconUrl,
                                sha256: app.sha256,
                                fileName: exactFileName || app.assetName,
                                platform: resolvedPlatform,
                                packageFormat: app.packageFormat,
                                skipNativeDispatch: true
                              });
                            }}
                            className="h-11 px-7 bg-[#0b57d0] hover:bg-[#0842a0] text-white dark:bg-[#a8c7fa] dark:hover:bg-[#d3e3fd] dark:text-[#041e49] font-medium font-google-sans rounded-full text-sm sm:text-base transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer select-none no-underline"
                          >
                            {resolvedPlatform === 'ios' ? <AppleIcon className="w-4 h-4 shrink-0" /> : resolvedPlatform === 'mac' ? <MacIcon className="w-4 h-4 shrink-0" /> : resolvedPlatform === 'windows' ? <WindowsIcon className="w-4 h-4 shrink-0" /> : resolvedPlatform === 'linux' ? <LinuxIcon className="w-4 h-4 shrink-0" /> : <AndroidIcon className="w-4 h-4 shrink-0" />}
                            <span>{getAppActionFileLabel(app, resolvedPlatform)}</span>
                          </a>
                        );
                      }

                      return (
                        <button 
                          type="button"
                          onClick={() => {
                            startInstall(appId, {
                              downloadUrl: app.downloadUrl,
                              appName: app.name,
                              sizeString: getUnifiedAppSize(app),
                              iconUrl: app.iconUrl,
                              sha256: app.sha256,
                              fileName: app.assetName,
                              platform: resolvedPlatform,
                              packageFormat: app.packageFormat
                            });
                          }}
                          className="h-11 px-7 bg-[#0b57d0] hover:bg-[#0842a0] text-white dark:bg-[#a8c7fa] dark:hover:bg-[#d3e3fd] dark:text-[#041e49] font-medium font-google-sans rounded-full text-sm sm:text-base transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer select-none"
                        >
                          {resolvedPlatform === 'ios' ? <AppleIcon className="w-4 h-4 shrink-0" /> : resolvedPlatform === 'mac' ? <MacIcon className="w-4 h-4 shrink-0" /> : resolvedPlatform === 'windows' ? <WindowsIcon className="w-4 h-4 shrink-0" /> : resolvedPlatform === 'linux' ? <LinuxIcon className="w-4 h-4 shrink-0" /> : <AndroidIcon className="w-4 h-4 shrink-0" />}
                          <span>{getAppActionFileLabel(app, resolvedPlatform)}</span>
                        </button>
                      );
                    })()}

                    {/* Wishlist Button */}
                    <button 
                      type="button"
                      onClick={handleToggleBookmark}
                      className={`h-11 px-4 rounded-full border border-theme-border/50 hover:bg-theme-hover active:scale-95 transition-all flex items-center gap-2 text-xs font-medium cursor-pointer ${
                        isCurrentAppBookmarked ? 'text-blue-500 bg-blue-500/10 border-blue-500/30' : 'text-theme-text'
                      }`}
                      title={isCurrentAppBookmarked ? 'Remove from wishlist' : 'Add to wishlist'}
                    >
                      {isCurrentAppBookmarked ? <BookmarkCheck className="w-4 h-4 text-blue-500" /> : <BookmarkPlus className="w-4 h-4" />}
                      <span>{isCurrentAppBookmarked ? 'In wishlist' : 'Add to wishlist'}</span>
                    </button>

                    {/* Share Button */}
                    <button 
                      type="button"
                      onClick={handleShare}
                      className="h-11 px-4 rounded-full border border-theme-border/50 hover:bg-theme-hover active:scale-95 transition-all flex items-center gap-2 text-xs font-medium text-theme-text cursor-pointer"
                      title="Share app"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Share</span>
                    </button>
                  </div>
                </div>
              </div>

        {/* Screenshots & Media Section - Sharp corners, preserve natural image ratio as it is, hide if not available */}
        {(() => {
          const displayScreenshots = [
            ...(app.screenshots || []),
            ...(app.tabletScreenshots || []).filter(s => !app.screenshots?.includes(s))
          ].filter(s => typeof s === 'string' && s.trim().length > 0);
          const hasScreenshots = displayScreenshots.length > 0;
          const hasPromoVideo = Boolean(app.promoVideoUrl && app.promoVideoUrl.trim());

          // If not available then don't show
          if (!hasScreenshots && !hasPromoVideo) {
            return null;
          }

          const allLightboxMedia: Array<{ type: 'video' | 'image'; url: string; title: string }> = [
            ...(hasPromoVideo ? [{ type: 'video' as const, url: app.promoVideoUrl!, title: `${app.name} Trailer` }] : []),
            ...displayScreenshots.map((url, i) => ({
              type: (isYouTubeUrl(url) ? 'video' : 'image') as 'video' | 'image',
              url,
              title: `${app.name} ${isYouTubeUrl(url) ? 'Video' : 'Screenshot'} ${i + 1}`
            }))
          ];

          return (
            <div className="py-2.5 w-full">
              {/* Media Carousel - Edge to Edge Free Moving with Non-blocking Vertical Scrolling & Desktop Controls */}
              <div className="relative group/carousel w-full">
                {/* Desktop Prev Button */}
                <button
                  type="button"
                  onClick={() => previewScrollRef.current?.scrollBy({ left: -360, behavior: 'smooth' })}
                  className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-theme-card/95 hover:bg-theme-card text-theme-text shadow-xl border border-theme-border/50 items-center justify-center cursor-pointer transition-all opacity-0 group-hover/carousel:opacity-100"
                  aria-label="Previous screenshots"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                {/* Desktop Next Button */}
                <button
                  type="button"
                  onClick={() => previewScrollRef.current?.scrollBy({ left: 360, behavior: 'smooth' })}
                  className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-theme-card/95 hover:bg-theme-card text-theme-text shadow-xl border border-theme-border/50 items-center justify-center cursor-pointer transition-all opacity-0 group-hover/carousel:opacity-100"
                  aria-label="Next screenshots"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>

                <div
                  ref={previewScrollRef}
                  onMouseDown={handlePreviewMouseDown}
                  onMouseLeave={handlePreviewMouseUp}
                  onMouseUp={handlePreviewMouseUp}
                  onMouseMove={handlePreviewMouseMove}
                  className="flex gap-2.5 overflow-x-auto scrollbar-hide -mx-2.5 sm:-mx-4 md:-mx-6 lg:mx-0 px-2.5 sm:px-4 md:px-6 lg:px-0 py-1 select-none cursor-grab active:cursor-grabbing w-auto"
                  style={{
                    WebkitOverflowScrolling: 'touch',
                    touchAction: 'pan-x pan-y',
                    overscrollBehaviorX: 'contain',
                    overscrollBehaviorY: 'auto',
                  }}
                >
                {/* Promo Video Card - Sharp corners with 16:9 ratio */}
                {hasPromoVideo && (() => {
                  const promoYtId = extractYouTubeId(app.promoVideoUrl);
                  if (!promoYtId) return null;

                  const customPromoThumb = app.videoThumbnailUrl || (app.promoVideoUrl ? customThumbnails[app.promoVideoUrl] : undefined) || (promoYtId ? getYouTubeThumbnail(promoYtId, 'maxres') : undefined) || (promoYtId ? getYouTubeThumbnail(promoYtId, 'hq') : undefined) || app.featureGraphicUrl;
                  const isPlayingInline = inlinePlayingVideo === app.promoVideoUrl;

                  return (
                    <DetailPromoVideoCard
                      key="promo-video-card"
                      app={app}
                      promoYtId={promoYtId}
                      customPromoThumb={customPromoThumb}
                      isPlayingInline={isPlayingInline}
                      onPlay={() => {
                        setIsPlayingBannerVideo(false);
                        setInlinePlayingVideo(app.promoVideoUrl!);
                      }}
                      onReset={() => {
                        if (inlinePlayingVideo === app.promoVideoUrl) {
                          setInlinePlayingVideo(null);
                        }
                      }}
                      onOpenLightbox={() => {
                        setLightboxIndex(0);
                        setLightboxOpen(true);
                      }}
                      hasDraggedRef={hasDraggedRef}
                    />
                  );
                })()}

                {/* Screenshots List - Natural aspect ratios preserved as they are with sharp corners */}
                {displayScreenshots.map((screenshot, index) => {
                  const mediaIdx = index + (hasPromoVideo ? 1 : 0);
                  const isYt = isYouTubeUrl(screenshot);
                  const ytId = isYt ? extractYouTubeId(screenshot) : null;
                  const isPlayingInline = isYt && inlinePlayingVideo === screenshot;

                  // If screenshot item is a YouTube video
                  if (isYt && ytId) {
                    const customThumb = customThumbnails[screenshot];
                    const thumb = customThumb || getYouTubeThumbnail(ytId, 'maxres') || getYouTubeThumbnail(ytId, 'hq');
                    return (
                      <DetailScreenshotVideoCard
                        key={`yt-shot-${index}`}
                        app={app}
                        screenshot={screenshot}
                        index={index}
                        mediaIdx={mediaIdx}
                        ytId={ytId}
                        thumb={thumb}
                        isPlayingInline={isPlayingInline}
                        onPlay={() => {
                          setIsPlayingBannerVideo(false);
                          setInlinePlayingVideo(screenshot);
                        }}
                        onReset={() => {
                          if (inlinePlayingVideo === screenshot) {
                            setInlinePlayingVideo(null);
                          }
                        }}
                        onOpenLightbox={() => {
                          setLightboxIndex(mediaIdx);
                          setLightboxOpen(true);
                        }}
                        hasDraggedRef={hasDraggedRef}
                      />
                    );
                  }

                  // Vertical screenshots expand to 9:16 aspect ratio width without altering height; horizontal screenshots retain natural aspect ratio
                  const detectedRatio = imageAspectRatios[screenshot];
                  const isHorizontal = detectedRatio ? detectedRatio >= 1.05 : false;
                  const effectiveRatio = isHorizontal ? `${detectedRatio}` : '9 / 16';

                  return (
                    <div
                      key={`shot-${index}`}
                      onClick={() => {
                        if (!hasDraggedRef.current) {
                          setLightboxIndex(mediaIdx);
                          setLightboxOpen(true);
                        }
                      }}
                      style={{ 
                        aspectRatio: effectiveRatio,
                      }}
                      className="h-[180px] sm:h-[220px] md:h-[270px] lg:h-[330px] xl:h-[360px] w-auto shrink-0 rounded-[4px] overflow-hidden shadow-sm hover:shadow-md bg-theme-hover/20 cursor-pointer group transition-shadow duration-200 select-none flex items-center justify-center"
                    >
                      {screenshot ? (
                        <img
                          src={screenshot}
                          alt={`${app.name} screenshot ${index + 1}`}
                          draggable={false}
                          onLoad={(e) => {
                            const img = e.currentTarget;
                            if (img.naturalWidth && img.naturalHeight) {
                              const r = img.naturalWidth / img.naturalHeight;
                              setImageAspectRatios((prev) => (prev[screenshot] === r ? prev : { ...prev, [screenshot]: r }));
                            }
                          }}
                          className={`h-full ${isHorizontal ? 'w-auto max-w-none object-contain' : 'w-full object-cover object-top'} rounded-[4px] select-none pointer-events-none group-hover:opacity-95 transition-opacity`}
                        />
                      ) : null}
                    </div>
                  );
                })}
                <div className="w-2 shrink-0" />
              </div>
            </div>

            {/* Lightbox Component */}
            <MediaGalleryLightbox
              isOpen={lightboxOpen}
              onClose={() => setLightboxOpen(false)}
              mediaItems={allLightboxMedia}
              initialIndex={lightboxIndex}
              appName={app.name}
            />
          </div>
        );
      })()}

        {/* Two-Column Responsive Workspace for Tablet & Desktop */}
        <div className="md:grid md:grid-cols-12 md:gap-8 lg:gap-12 items-start mt-4 sm:mt-6">
          {/* Primary Main Content Column */}
          <div className="md:col-span-7 lg:col-span-8 flex flex-col min-w-0">
            {/* What's New / Release Notes (Positioned after App Preview, rectangular sharp-cornered borderless transparent blue box with close button) */}
        {!isWhatsNewDismissed && app.releaseNotes && (
          <div id="whats-new-section" className="py-3 transition-all duration-200">
            <div 
              id="whats-new-banner" 
              className="rounded-none bg-blue-500/10 dark:bg-blue-500/15 border-none p-5 relative"
            >
              <div className="flex items-start justify-between gap-2.5 mb-2.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <h2 className="text-[15px] font-semibold text-[#0f172a] dark:text-blue-100 whitespace-nowrap">
                      What's new
                    </h2>
                  </div>
                  {app.releaseDate && (
                    <span className="text-xs text-blue-600/80 dark:text-blue-300/80 font-normal shrink-0">
                      • {app.releaseDate}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  id="close-whats-new-btn"
                  onClick={() => setIsWhatsNewDismissed(true)}
                  className="p-1.5 -mr-1.5 -mt-1.5 rounded-none text-blue-600/70 hover:text-blue-700 dark:text-blue-400/80 dark:hover:text-blue-200 hover:bg-blue-500/15 active:bg-blue-500/25 transition-colors cursor-pointer shrink-0"
                  aria-label="Close What's new"
                  title="Close What's new"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="text-sm text-theme-text/90 dark:text-blue-100/90 whitespace-pre-line leading-relaxed font-sans break-words">
                {app.releaseNotes}
              </div>
            </div>
          </div>
        )}

        {/* About this app */}
        <div className="py-5 cursor-pointer hover:bg-theme-hover/40 rounded-2xl transition-colors" onClick={() => setDetailView('about')}>
          <div className="flex items-center justify-between mb-3">
             <h2 className="text-[18px] sm:text-[19px] font-medium font-google-sans text-theme-text">About this app</h2>
             <button className="w-8 h-8 flex items-center justify-center rounded-full bg-theme-hover/70 text-theme-text pointer-events-none border-0">
               <ArrowRight className="w-4.5 h-4.5" />
             </button>
          </div>
          <p className="text-[15px] text-theme-text leading-relaxed mb-4">
            {app.aboutText}
          </p>
          <div className="flex flex-wrap gap-2.5">
            {app.tags.map((tag, i) => (
              <span key={i} className="px-3 py-1 rounded-full border border-theme-border dark:border-[#3c4043] bg-transparent text-[13px] font-medium text-theme-text">
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Ratings and reviews */}
        <div>
           <Reviews 
             app={app} 
             reviews={reviews} 
             onSeeAllReviews={(reviewId) => {
               if (reviewId) {
                 openAppReviews(app.id, reviewId);
               } else {
                 setDetailView('reviews');
               }
             }} 
             onWriteReview={(star) => {
               setWriteReviewRating(star || 0);
               setDetailView('write-review');
             }}
           />
        </div>
      </div>

      {/* Secondary Sidebar Column (Data safety & Developer Info on desktop, stacked on mobile) */}
      <div className="md:col-span-5 lg:col-span-4 flex flex-col gap-6 pt-6 md:pt-1 min-w-0 md:sticky md:top-6 self-start">
        {/* Data Safety */}
        <div className="py-5 lg:py-4">
           <div className="flex items-center justify-between mb-3 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setDetailView('data-safety')}>
             <h2 className="text-[18px] sm:text-[19px] font-medium font-google-sans text-theme-text">Data safety</h2>
             <button className="w-8 h-8 flex items-center justify-center rounded-full bg-theme-hover/70 text-theme-text pointer-events-none">
               <ArrowRight className="w-4.5 h-4.5" />
             </button>
          </div>
          <p className="text-[15px] text-theme-text leading-relaxed mb-3 whitespace-pre-line line-clamp-4">
            {app.dataSafety?.overview || app.dataSafety?.summaryText || (app.dataSafety?.dataShared ? `Developer declaration: ${app.dataSafety.dataShared}` : 'Safety starts with understanding how developers collect and share your data.')}
          </p>

          {/* Quick Declarations Snapshot */}
          <div className="flex flex-col gap-1.5 pt-1 pb-1">
            {app.dataSafety?.dataShared && (
              <p className="text-[13px] text-theme-text-muted truncate">
                {app.dataSafety.dataShared}
              </p>
            )}
            {app.dataSafety?.deletionPolicy && (
              <p className="text-[13px] text-theme-text-muted truncate">
                Data deletion: {app.dataSafety.deletionPolicy}
              </p>
            )}
          </div>
          
          <div className="mt-3">
            <button 
              type="button"
              className="text-blue-500 dark:text-[#8ab4f8] text-[14px] font-medium text-left hover:underline inline-flex items-center gap-1 cursor-pointer" 
              onClick={() => setDetailView('data-safety')}
            >
              <span>See details</span>
              <span>→</span>
            </button>
          </div>
        </div>

        {/* App Support & Developer Details */}
        <div className="py-5 lg:py-4">
          <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => setIsAppSupportOpen(!isAppSupportOpen)}>
             <h2 className="text-[18px] sm:text-[19px] font-semibold text-[#0f172a] dark:text-[#f3f4f6]">Developer & Publisher Info</h2>
             <button className="w-8 h-8 flex items-center justify-center rounded-full text-theme-text-muted">
               <ChevronDown className={`w-5 h-5 transition-transform ${isAppSupportOpen ? 'rotate-180' : ''}`} />
             </button>
          </div>
          {isAppSupportOpen && (
            <div className="flex flex-col gap-4 pt-1">
              {/* 1. Publisher (Google Account Identity) - Mandatory */}
              <div
                className="flex items-center gap-3.5 text-theme-text cursor-pointer hover:opacity-85 transition-opacity"
                id="dev-info-publisher"
                onClick={() => onOrgClick && effectivePublisher && onOrgClick(effectivePublisher)}
              >
                <UserCheck className="w-5 h-5 text-theme-text-muted shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-[14px] font-medium truncate text-blue-600 dark:text-[#8ab4f8] hover:underline">{effectivePublisher}</span>
                  <span className="text-xs text-theme-text-muted">Publisher • View all apps</span>
                </div>
              </div>

              {/* 2. Public Support Email - Mandatory */}
              <a 
                href={`mailto:${effectiveSupportEmail}`} 
                className="flex items-center gap-3.5 text-theme-text hover:text-blue-400 transition-colors"
                id="dev-info-support-email"
              >
                <Mail className="w-5 h-5 text-theme-text-muted shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-[14px] font-medium">Support Email</span>
                  <span className="text-xs text-theme-text-muted truncate">{effectiveSupportEmail}</span>
                </div>
              </a>

              {/* 3. Upstream GitHub Repository Owner */}
              {effectiveRepoOwner && (
                <a 
                  href={`https://github.com/${effectiveRepoOwner}`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center gap-3.5 text-theme-text hover:text-blue-400 transition-colors"
                  id="dev-info-repo-owner"
                >
                  <GitBranch className="w-5 h-5 text-theme-text-muted shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[14px] font-medium">GitHub Repository Owner</span>
                    <span className="text-xs text-theme-text-muted truncate">@{effectiveRepoOwner}</span>
                  </div>
                </a>
              )}

              {/* Package SHA-256 Checksum (Release Integrity Digest) */}
              {effectiveSha256 && (
                <div className="flex items-start gap-3.5 text-theme-text" id="dev-info-sha256">
                  <ShieldCheck className="w-5 h-5 text-theme-text-muted shrink-0 mt-0.5" />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[14px] font-medium">
                      Package SHA-256 Checksum
                    </span>
                    <span 
                      className="text-xs font-mono text-theme-text-muted break-all select-all mt-0.5"
                      title={effectiveSha256}
                    >
                      {effectiveSha256}
                    </span>
                    <span className="text-[11px] text-theme-text-muted mt-0.5">
                      Cryptographic release digest for {app?.assetName || `${app?.name || 'app'}.apk`} ({app?.versionName || app?.releaseTag || 'v1.0.0'})
                    </span>
                  </div>
                </div>
              )}

              {/* 4. Official Website (if provided) */}
              {effectiveOfficialWebsiteUrl && (
                <a 
                  href={effectiveOfficialWebsiteUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center gap-3.5 text-theme-text hover:text-blue-400 transition-colors"
                  id="dev-info-website"
                >
                  <Globe className="w-5 h-5 text-theme-text-muted shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[14px] font-medium">Official Website</span>
                    <span className="text-xs text-theme-text-muted truncate max-w-[280px] sm:max-w-md">{officialWebsite}</span>
                  </div>
                </a>
              )}

              {/* 5. Publisher Physical Address (only if provided, hidden if empty) */}
              {publisherPhysicalAddress && (
                <div className="flex items-start gap-3.5 text-theme-text" id="dev-info-address">
                  <MapPin className="w-5 h-5 text-theme-text-muted shrink-0 mt-0.5" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[14px] font-medium">Publisher Physical Address</span>
                    <div className="text-xs text-theme-text-muted whitespace-pre-line leading-relaxed break-words max-w-[280px] sm:max-w-md">
                      {publisherPhysicalAddress}
                    </div>
                  </div>
                </div>
              )}

              {/* 6. Privacy Policy - Mandatory */}
              <a 
                href={effectivePrivacyUrl} 
                onClick={(e) => {
                  if (!isExternalPrivacyUrl) {
                    e.preventDefault();
                    openPrivacyPolicy();
                  }
                }}
                target={isExternalPrivacyUrl ? '_blank' : undefined} 
                rel="noopener noreferrer" 
                className="flex items-center gap-3.5 text-theme-text hover:text-blue-400 transition-colors cursor-pointer group"
                id="dev-info-privacy-policy"
              >
                <Lock className="w-5 h-5 text-theme-text-muted group-hover:text-blue-400 shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-[14px] font-medium">Privacy Policy</span>
                  <span className="text-xs text-theme-text-muted truncate max-w-[280px] sm:max-w-md group-hover:text-blue-400/80">
                    {displayPrivacyUrl}
                  </span>
                </div>
              </a>

              {/* 7. Terms and Conditions - Mandatory Page Link Option */}
              <a 
                href={effectiveTermsUrl} 
                onClick={(e) => {
                  if (!isExternalTermsUrl) {
                    e.preventDefault();
                    openTermsOfService();
                  }
                }}
                target={isExternalTermsUrl ? '_blank' : undefined} 
                rel="noopener noreferrer" 
                className="flex items-center gap-3.5 text-theme-text hover:text-blue-400 transition-colors cursor-pointer group"
                id="dev-info-terms-conditions"
              >
                <FileText className="w-5 h-5 text-theme-text-muted group-hover:text-blue-400 shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-[14px] font-medium">Terms and Conditions</span>
                  <span className="text-xs text-theme-text-muted truncate max-w-[280px] sm:max-w-md group-hover:text-blue-400/80">
                    {displayTermsUrl}
                  </span>
                </div>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>

        {/* Similar Apps - only shown if other authentic apps exist */}
        {similarCatalogApps.length > 0 && (
          <div className="pt-2 pb-12">
            <div className="flex items-center justify-between mb-4">
               <button onClick={onShowSimilarApps} className="text-left flex items-center gap-2 group cursor-pointer">
                 <h2 className="text-[18px] sm:text-[19px] font-semibold text-[#0f172a] dark:text-[#f3f4f6] group-hover:text-[#0b57d0] transition-colors">Similar apps</h2>
               </button>
               <button onClick={onShowSimilarApps} className="w-8 h-8 flex items-center justify-center rounded-full bg-theme-hover text-theme-text hover:bg-theme-active transition-colors cursor-pointer" aria-label="See all similar apps">
                 <ArrowRight className="w-4.5 h-4.5" />
               </button>
            </div>
            {/* Mobile horizontal carousel */}
            <div
              className="flex sm:hidden gap-4 overflow-x-auto scrollbar-hide -mx-4 px-4 w-auto"
              style={{
                WebkitOverflowScrolling: 'touch',
                touchAction: 'pan-x pan-y',
                overscrollBehaviorX: 'contain',
                overscrollBehaviorY: 'auto',
              }}
            >
               {similarCatalogApps
                 .slice(0, 8)
                 .map((sim) => {
                   const simUrl = getAppShareUrl(sim);
                   return (
                     <a 
                       key={sim.id} 
                       href={simUrl}
                       onClick={(e) => {
                         if (!e.metaKey && !e.ctrlKey) {
                           e.preventDefault();
                           if (onAppClick) { 
                             onAppClick(sim.id); 
                           } else { 
                             onBack(); 
                             setTimeout(() => onOrgClick?.(sim.developer || sim.id), 50); 
                           }
                         }
                       }} 
                       className="w-[104px] shrink-0 flex flex-col cursor-pointer select-none no-underline text-left"
                     >
                      <div className="w-[104px] h-[104px] rounded-[20px] overflow-hidden shadow-sm mb-2 bg-theme-hover flex items-center justify-center">
                        <AppLazyImage
                          src={sim.iconUrl}
                          alt={sim.name}
                          fallbackText={sim.name}
                          className="w-full h-full object-cover select-none pointer-events-none"
                          containerClassName="w-full h-full"
                        />
                      </div>
                      <h4 className="text-theme-text text-xs font-medium leading-tight line-clamp-2 min-h-[32px] mb-1">{sim.name}</h4>
                      <div className="flex items-center gap-1 text-[11px] text-theme-text-muted">
                         <span className="text-amber-400">★</span>
                         <span>{sim.rating}</span>
                         <span>•</span>
                         <span>{sim.size}</span>
                      </div>
                    </a>
                   );
                 })}
            </div>

            {/* Tablet & Desktop Responsive Multi-Column Grid */}
            <div className="hidden sm:grid sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-4 w-full">
               {similarCatalogApps
                 .slice(0, 8)
                 .map((sim) => {
                   const simUrl = getAppShareUrl(sim);
                   return (
                     <a 
                       key={sim.id} 
                       href={simUrl}
                       onClick={(e) => {
                         if (!e.metaKey && !e.ctrlKey) {
                           e.preventDefault();
                           if (onAppClick) { 
                             onAppClick(sim.id); 
                           } else { 
                             onBack(); 
                             setTimeout(() => onOrgClick?.(sim.developer || sim.id), 50); 
                           }
                         }
                       }} 
                       className="flex flex-col cursor-pointer select-none group hover:opacity-90 transition-opacity no-underline text-left"
                     >
                      <div className="w-full aspect-square rounded-[22px] overflow-hidden shadow-xs mb-2 bg-theme-hover flex items-center justify-center border border-theme-border/20 group-hover:shadow-md transition-shadow">
                        <AppLazyImage
                          src={sim.iconUrl}
                          alt={sim.name}
                          fallbackText={sim.name}
                          className="w-full h-full object-cover select-none pointer-events-none"
                          containerClassName="w-full h-full"
                        />
                      </div>
                      <h4 className="text-theme-text text-xs font-medium leading-tight line-clamp-2 min-h-[32px] mb-1 group-hover:text-blue-500 transition-colors">{sim.name}</h4>
                      <div className="flex items-center gap-1 text-[11px] text-theme-text-muted">
                         <span className="text-amber-400">★</span>
                         <span>{sim.rating}</span>
                         <span>•</span>
                         <span>{sim.size}</span>
                      </div>
                    </a>
                   );
                 })}
            </div>
          </div>
        )}

      </div>

      {/* Flag App Inappropriate Modal */}
      <FlagAppModal
        isOpen={isFlagAppModalOpen}
        onClose={() => setIsFlagAppModalOpen(false)}
        onConfirmFlag={handleConfirmFlagApp}
        isAlreadyFlagged={flaggedAppIds.includes(appId)}
      />

      </div>

      {/* Simulated interval loading screen overlay: while active, the new app's page is already changing and rendering underneath in the background */}
      {isAppOpeningLoading && (
        <div 
          className="fixed inset-0 z-[70] flex flex-col bg-theme-bg text-theme-text font-sans w-full shadow-none overflow-hidden select-none pointer-events-auto"
          aria-live="polite"
          aria-busy="true"
        >
          <header className="relative w-full h-[60px] sm:h-[68px] shrink-0 bg-transparent border-0 z-20">
            <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-2.5 sm:px-4 md:px-6 lg:px-8 gap-3">
              <button 
                type="button"
                id="app-detail-back-button-overlay"
                onClick={onBack || navGoBack} 
                className="w-9 h-9 -ml-1 rounded-full text-theme-text hover:bg-theme-hover active:bg-theme-hover/80 transition-colors shrink-0 cursor-pointer flex items-center justify-center -translate-x-[2px]"
                aria-label="Back"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
            </div>
          </header>

          <div className="flex-1 flex items-center justify-center min-h-[50vh] w-full">
            <StoreCircleLoader size="md" />
          </div>
        </div>
      )}
    </div>
  );
}
