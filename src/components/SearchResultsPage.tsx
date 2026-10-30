import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  Search, 
  Mic,
  ChevronDown,
  X,
  Info,
  Loader2,
  Play,
  Maximize2,
  Download
} from 'lucide-react';
import { useInstall, getDirectDownloadUrl } from '../context/InstallContext';
import { useStoreConfig } from '../context/StoreConfigContext';
import { useReviews } from '../context/ReviewContext';
import { useAuth } from '../context/AuthContext';
import { saveSearchQuery } from '../utils/searchHistory';
import { requestBrowserMicrophonePermission } from '../utils/permissionUtils';
import BottomNav from './BottomNav';
import BrandLogo from './BrandLogo';
import LinuxIcon from './LinuxIcon';
import WindowsIcon from './WindowsIcon';
import AndroidIcon from './AndroidIcon';
import MacIcon from './MacIcon';
import AppleIcon from './AppleIcon';
import StoreCircleLoader from './StoreCircleLoader';
import PullToRefresh from './PullToRefresh';
import { usePreserveScroll } from '../services/scrollManager';
import { safeFetchJson } from '../utils/safeFetch';
import { AppListing, AppDetails } from '../types';
import { extractYouTubeId, getYouTubeThumbnail, isYouTubeUrl } from '../utils/mediaUtils';
import { 
  calculateAppRatingAndReviews, 
  formatDownloadCount, 
  parseDownloadCount, 
  getContentRatingBadge, 
  getContentRatingLabel,
  getUnifiedAppSize,
  getAppTrailerYoutubeId,
  getAppPublisherName
} from '../utils/appMetricsAlgorithm';
import { 
  getAppPrimaryActionLabel, 
  getDownloadingStatusLabel, 
  getVerifyingStatusLabel,
  getAppFormatBadgeLabel,
  isWindowsApp,
  isLinuxApp,
  isMacApp,
  isIOSApp,
  detectClientOS,
  sortAppsByDeviceCompatibility
} from '../services/osDetectionService';
import { rankAppsForSearch } from '../utils/searchEngine';
import { RecommendationService } from '../services/recommendationService';
import { slugifyAppName } from '../utils/shareUtils';
import PenguinIcon from './PenguinIcon';
import SearchResultRowSkeleton from './SearchResultRowSkeleton';
import AppLazyImage from './AppLazyImage';
import ConfirmationDialog from './ConfirmationDialog';
import MediaGalleryLightbox from './MediaUpload/MediaGalleryLightbox';
import { useAutoResetVideoOnScrollAndPage } from '../hooks/useAutoResetVideoOnScrollAndPage';

function SearchPromoVideoCard({
  app,
  promoYtId,
  customThumb,
  isPlaying,
  onPlay,
  onReset,
  onOpenLightbox,
  hasDraggedRef,
}: {
  key?: React.Key;
  app: any;
  promoYtId: string;
  customThumb: string;
  isPlaying: boolean;
  onPlay: () => void;
  onReset: () => void;
  onOpenLightbox: () => void;
  hasDraggedRef: any;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);

  useAutoResetVideoOnScrollAndPage({
    isPlaying,
    onReset,
    containerRef: cardRef,
    videoId: `search-promo-video-${app.id}`,
    minVisibilityRatio: 0.15,
  });

  return (
    <div
      ref={cardRef}
      style={{ aspectRatio: '16 / 9' }}
      className="h-[170px] sm:h-[190px] md:h-[210px] lg:h-[230px] w-auto shrink-0 rounded-[4px] overflow-hidden shadow-sm hover:shadow-md bg-black relative group transition-shadow duration-200"
    >
      {isPlaying ? (
        <div className="relative w-full h-full">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${promoYtId}?autoplay=1&rel=0&playsinline=1`}
            title={`${app.name} video`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="w-full h-full border-0 block"
          />
          <div className="absolute top-2 right-2 flex items-center gap-1.5 z-20 pointer-events-auto">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenLightbox();
              }}
              title="Fullscreen Theater Mode"
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
          onClick={(e) => {
            e.stopPropagation();
            if (!hasDraggedRef.current) {
              onPlay();
            }
          }}
          className="relative w-full h-full cursor-pointer"
        >
          <img
            src={customThumb}
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

function SearchScreenshotVideoCard({
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
  screenshot: any;
  index: number;
  mediaIdx: number;
  ytId: string;
  thumb?: any;
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
    videoId: `search-screenshot-video-${app.id}-${index}`,
    minVisibilityRatio: 0.15,
  });

  return (
    <div
      ref={cardRef}
      key={`yt-shot-${index}`}
      style={{ aspectRatio: '16 / 9' }}
      className="h-[170px] sm:h-[190px] md:h-[210px] lg:h-[230px] w-auto shrink-0 rounded-[4px] overflow-hidden shadow-sm hover:shadow-md bg-black relative cursor-pointer group transition-shadow duration-200"
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
          <div className="absolute top-2 right-2 flex items-center gap-1.5 z-20 pointer-events-auto">
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
          onClick={(e) => {
            e.stopPropagation();
            if (!hasDraggedRef.current) {
              onPlay();
            }
          }}
          className="relative w-full h-full"
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

interface SearchResultsPageProps {
  query: string;
  onBack: () => void;
  onOpenSearch?: (startWithVoice?: boolean) => void;
  onAppClick?: (id: string) => void;
  onSearchQuery?: (q: string) => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export default function SearchResultsPage({ 
  query, 
  onBack, 
  onOpenSearch, 
  onAppClick, 
  onSearchQuery, 
  activeTab = 'search', 
  onTabChange 
}: SearchResultsPageProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [showMoreSponsored, setShowMoreSponsored] = useState(false);
  const [expandedAppIds, setExpandedAppIds] = useState<Record<string, boolean>>({});
  const [activeInlineVideo, setActiveInlineVideo] = useState<{ id: string; ytId: string } | null>(null);
  const [lightboxVideo, setLightboxVideo] = useState<{ app: AppListing; ytId: string } | null>(null);
  const [lightboxGallery, setLightboxGallery] = useState<{
    appName: string;
    items: Array<{ type: 'image' | 'video'; url: string; title?: string }>;
    index: number;
  } | null>(null);

  // Automatically reset all playing videos and lightboxes on navigation change
  useEffect(() => {
    const handleStopAll = () => {
      setActiveInlineVideo(null);
      setLightboxVideo(null);
      setLightboxGallery(null);
    };
    window.addEventListener('prople:stop:all:videos', handleStopAll);
    window.addEventListener('popstate', handleStopAll);
    return () => {
      window.removeEventListener('prople:stop:all:videos', handleStopAll);
      window.removeEventListener('popstate', handleStopAll);
    };
  }, []);

  const lastScrollY = useRef(0);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);

  const resultsScrollRef = useRef<HTMLDivElement | null>(null);
  usePreserveScroll(`search-results-${query}`, resultsScrollRef);
  
  const { startInstall } = useInstall();
  const { allAppListings, apps, refreshCatalogue, isPullRefreshing } = useStoreConfig();
  const { getAppReviews } = useReviews();
  const { user } = useAuth();

  const normalizedQuery = (query || '').trim().toLowerCase();
  const [isSearchingLoading, setIsSearchingLoading] = useState(true);
  const [isSearchRefreshing, setIsSearchRefreshing] = useState(false);
  const [imageAspectRatios, setImageAspectRatios] = useState<Record<string, number>>({});

  // Drag-to-scroll for free preview screenshots movement
  const previewScrollRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const scrollStartXRef = useRef(0);
  const hasDraggedRef = useRef(false);

  const handlePreviewMouseDown = (appId: string, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const el = previewScrollRefs.current[appId];
    if (!el) return;
    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    dragStartXRef.current = e.pageX;
    scrollStartXRef.current = el.scrollLeft;
  };

  const handlePreviewMouseMove = (appId: string, e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const el = previewScrollRefs.current[appId];
    if (!el) return;
    const deltaX = e.pageX - dragStartXRef.current;
    if (Math.abs(deltaX) > 4) {
      hasDraggedRef.current = true;
      el.scrollLeft = scrollStartXRef.current - deltaX;
    }
  };

  const handlePreviewMouseUp = () => {
    isDraggingRef.current = false;
    setTimeout(() => {
      hasDraggedRef.current = false;
    }, 80);
  };

  const handleSearchRefresh = async () => {
    setIsSearchRefreshing(true);
    setIsSearchingLoading(true);
    try {
      await Promise.all([
        refreshCatalogue(),
        new Promise((resolve) => setTimeout(resolve, 600)),
      ]);
    } finally {
      setIsSearchingLoading(false);
      setIsSearchRefreshing(false);
    }
  };

  // Trigger crisp circle loading UI on search navigation and queries
  useEffect(() => {
    setIsSearchingLoading(true);
    const timer = setTimeout(() => {
      setIsSearchingLoading(false);
    }, 240);
    return () => clearTimeout(timer);
  }, [query]);

  const toggleAppExpansion = (appId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedAppIds(prev => ({
      ...prev,
      [appId]: !prev[appId]
    }));
  };

  const handleVoiceSearch = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    requestBrowserMicrophonePermission().catch(() => {});
    if (onOpenSearch) {
      onOpenSearch(true);
    }
  };

  // Helper to compute genuine app metrics without mock/fake data
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

  // Save to search history
  useEffect(() => {
    if (query && query.trim() && !query.startsWith('pub:') && !query.startsWith('publisher:')) {
      const clean = query.startsWith('cat:') ? query.replace('cat:', '').trim() : query.trim();
      if (clean) saveSearchQuery(clean);
    }
  }, [query]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setIsScrolled(e.currentTarget.scrollTop > 10);
    
    // Bottom nav visibility logic
    const currentScrollY = e.currentTarget.scrollTop;
    if (currentScrollY > lastScrollY.current && currentScrollY > 50) {
      if (isNavVisible) setIsNavVisible(false);
    } else {
      if (!isNavVisible) setIsNavVisible(true);
    }
    lastScrollY.current = currentScrollY;

    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current);
    }
    scrollTimeout.current = setTimeout(() => {
      setIsNavVisible(true);
    }, 1500);
  };

  const allApps = useMemo(() => {
    // Merge allAppListings with any active apps from the apps dictionary
    const map = new Map<string, AppListing>();
    allAppListings.forEach(a => map.set(a.id, a));
    Object.values(apps).forEach((full: any) => {
      if (full && full.id && !map.has(full.id)) {
        map.set(full.id, full as unknown as AppListing);
      }
    });
    return Array.from(map.values());
  }, [allAppListings, apps]);

  // Meilisearch server-backed hits for typo tolerance & relevance ranking
  const [serverSearchHits, setServerSearchHits] = useState<any[] | null>(null);

  useEffect(() => {
    let isCancelled = false;
    const clean = query.trim();
    if (!clean || clean.startsWith('cat:')) {
      setServerSearchHits(null);
      return;
    }

    const controller = new AbortController();
    const currentOS = detectClientOS();
    safeFetchJson<{ success: boolean; hits: any[] }>(
      `/api/search?q=${encodeURIComponent(clean)}&limit=50&platform=${encodeURIComponent(currentOS)}`,
      { signal: controller.signal }
    )
      .then(({ ok, data }) => {
        if (!isCancelled && ok && data?.success && Array.isArray(data.hits)) {
          setServerSearchHits(data.hits);
        }
      })
      .catch(() => {
        // Fallback silently to client filtering
      });

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [query]);

  // Filtered results
  const searchResults = useMemo(() => {
    let filtered = allApps;

    if (query.trim().length > 0) {
      const lowerQuery = query.toLowerCase();
      const currentOS = detectClientOS();

      if (lowerQuery.startsWith('pub:') || lowerQuery.startsWith('publisher:')) {
        const devQuery = lowerQuery.startsWith('pub:')
          ? lowerQuery.replace('pub:', '').trim()
          : lowerQuery.replace('publisher:', '').trim();

        // Check if the searched publisher query corresponds to the authenticated logged-in user
        const userDisplayName = (user?.displayName || '').toLowerCase().trim();
        const userPubName = (user?.publisherName || '').toLowerCase().trim();
        const userEmail = (user?.email || '').toLowerCase().trim();
        const userEmailPrefix = userEmail.includes('@') ? userEmail.split('@')[0].trim() : '';
        const userUid = user?.uid || '';

        const isUserPublisherQuery = Boolean(
          user && devQuery && (
            (userDisplayName && (devQuery === userDisplayName || devQuery.includes(userDisplayName) || userDisplayName.includes(devQuery))) ||
            (userPubName && (devQuery === userPubName || devQuery.includes(userPubName) || userPubName.includes(devQuery))) ||
            (userEmail && (devQuery === userEmail || devQuery.includes(userEmail) || userEmail.includes(devQuery))) ||
            (userEmailPrefix && (devQuery === userEmailPrefix || devQuery.includes(userEmailPrefix) || userEmailPrefix.includes(devQuery)))
          )
        );

        const cleanQuery = devQuery.replace(/[^a-z0-9]/g, '');
        const isSahanurMollaQuery = cleanQuery.includes('sahanur') || cleanQuery.includes('sahinur') || devQuery.includes('sahanur') || devQuery.includes('sahinur');

        filtered = filtered.filter(app => {
          if (!devQuery) return true;
          const canonicalPub = getAppPublisherName(app).toLowerCase().trim();
          const cleanCanonical = canonicalPub.replace(/[^a-z0-9]/g, '');
          const dev = (app.developer || '').toLowerCase().trim();
          const cleanDev = dev.replace(/[^a-z0-9]/g, '');
          const pub = ((app as any).publisherName || '').toLowerCase().trim();
          const cleanPub = pub.replace(/[^a-z0-9]/g, '');
          const devInfo = ((app as any).developerInfo?.publisherName || '').toLowerCase().trim();
          const cleanDevInfo = devInfo.replace(/[^a-z0-9]/g, '');
          const pubBy = ((app as any).publishedBy || '').toLowerCase().trim();
          const devEmail = ((app as any).developerEmail || (app as any).developerInfo?.email || '').toLowerCase().trim();
          const cleanDevEmail = devEmail.split('@')[0].replace(/[^a-z0-9]/g, '');
          const pubEmail = ((app as any).publisherEmail || (app as any).ownerEmail || '').toLowerCase().trim();
          const cleanPubEmail = pubEmail.split('@')[0].replace(/[^a-z0-9]/g, '');
          const repoOwner = ((app as any).githubRepoOwner || (app as any).developerInfo?.githubRepoOwner || '').toLowerCase().trim();
          const cleanRepo = repoOwner.replace(/[^a-z0-9]/g, '');

          // 1. Universal Canonical Publisher Resolution (Exact & Substring)
          if (
            (canonicalPub && (canonicalPub === devQuery || canonicalPub.includes(devQuery) || devQuery.includes(canonicalPub))) ||
            (cleanCanonical && (cleanCanonical === cleanQuery || cleanCanonical.includes(cleanQuery) || cleanQuery.includes(cleanCanonical)))
          ) {
            return true;
          }

          // 2. Direct field text matching (exact, substring, and normalized alphanumeric)
          const textMatches =
            (dev && (dev === devQuery || dev.includes(devQuery) || devQuery.includes(dev))) ||
            (cleanDev && (cleanDev === cleanQuery || cleanDev.includes(cleanQuery) || cleanQuery.includes(cleanDev))) ||
            (pub && (pub === devQuery || pub.includes(devQuery) || devQuery.includes(pub))) ||
            (cleanPub && (cleanPub === cleanQuery || cleanPub.includes(cleanQuery) || cleanQuery.includes(cleanPub))) ||
            (devInfo && (devInfo === devQuery || devInfo.includes(devQuery) || devQuery.includes(devInfo))) ||
            (cleanDevInfo && (cleanDevInfo === cleanQuery || cleanDevInfo.includes(cleanQuery) || cleanQuery.includes(cleanDevInfo))) ||
            (pubBy && (pubBy === devQuery || pubBy.includes(devQuery) || devQuery.includes(pubBy))) ||
            (devEmail && (devEmail === devQuery || devEmail.includes(devQuery) || devQuery.includes(devEmail))) ||
            (cleanDevEmail && (cleanDevEmail === cleanQuery || cleanDevEmail.includes(cleanQuery) || cleanQuery.includes(cleanDevEmail))) ||
            (pubEmail && (pubEmail === devQuery || pubEmail.includes(devQuery) || devQuery.includes(pubEmail))) ||
            (cleanPubEmail && (cleanPubEmail === cleanQuery || cleanPubEmail.includes(cleanQuery) || cleanQuery.includes(cleanPubEmail))) ||
            (repoOwner && (repoOwner === devQuery || repoOwner.includes(devQuery) || devQuery.includes(repoOwner))) ||
            (cleanRepo && (cleanRepo === cleanQuery || cleanRepo.includes(cleanQuery) || cleanQuery.includes(cleanRepo)));

          if (textMatches) return true;

          // 3. Sahanur Molla / Sahinur Molla developer alias correlation (specific author matching)
          if (isSahanurMollaQuery) {
            if (
              cleanDev.includes('sahanur') ||
              cleanDev.includes('sahinur') ||
              cleanPub.includes('sahanur') ||
              cleanPub.includes('sahinur') ||
              cleanDevEmail.includes('sahanur') ||
              cleanDevEmail.includes('sahinur') ||
              cleanPubEmail.includes('sahanur') ||
              cleanPubEmail.includes('sahinur') ||
              cleanCanonical.includes('sahanur') ||
              cleanCanonical.includes('sahinur') ||
              (devEmail === 'prople.org@gmail.com' && isUserPublisherQuery) ||
              (pubEmail === 'prople.org@gmail.com' && isUserPublisherQuery)
            ) {
              return true;
            }
          }

          // 4. If this query represents the logged-in user's developer identity, match all their authored/owned apps
          if (isUserPublisherQuery) {
            const isOwnerByUid = userUid && (
              (app as any).developerId === userUid ||
              (app as any).creatorUid === userUid ||
              (app as any).owner === userUid ||
              (app as any).userId === userUid
            );
            const isOwnerByEmail = userEmail && (
              devEmail === userEmail ||
              pubEmail === userEmail ||
              devEmail.includes(userEmail) ||
              pubEmail.includes(userEmail)
            );
            if (isOwnerByUid || isOwnerByEmail) {
              return true;
            }
          }

          return false;
        });

        // Merge serverSearchHits to guarantee newly published or live Firestore publisher apps are present
        if (serverSearchHits && serverSearchHits.length > 0) {
          const seenIds = new Set(filtered.map(a => a.id));
          const appMap = new Map<string, AppListing>(allApps.map(a => [a.id, a]));
          for (const hit of serverSearchHits) {
            const hitId = String(hit?.id || '');
            const full = appMap.get(hitId) || (hit as AppListing);
            if (full && full.id && !seenIds.has(full.id)) {
              filtered.push(full);
              seenIds.add(full.id);
            }
          }
        }

        filtered = sortAppsByDeviceCompatibility(filtered, currentOS);
      } else if (lowerQuery === 'app console' || lowerQuery === 'apps console' || lowerQuery === 'developer console') {
        const userPub = (user?.publisherName || user?.displayName || '').toLowerCase().trim();
        const userEmail = (user?.email || '').toLowerCase().trim();
        const userUid = user?.uid || '';
        if (userPub || userEmail || userUid) {
          filtered = filtered.filter(app => {
            const dev = (app.developer || '').toLowerCase().trim();
            const pub = ((app as any).publisherName || '').toLowerCase().trim();
            const devEmail = ((app as any).developerEmail || '').toLowerCase().trim();
            const isUidMatch = userUid && ((app as any).developerId === userUid || (app as any).owner === userUid || (app as any).creatorUid === userUid);
            const isEmailMatch = userEmail && (devEmail === userEmail || ((app as any).ownerEmail || '').toLowerCase().trim() === userEmail);
            const isNameMatch = userPub && ((dev && (dev === userPub || dev.includes(userPub) || userPub.includes(dev))) || (pub && (pub === userPub || pub.includes(userPub) || userPub.includes(pub))));
            return Boolean(isUidMatch || isEmailMatch || isNameMatch);
          });
        }
        filtered = sortAppsByDeviceCompatibility(filtered, currentOS);
      } else if (lowerQuery.startsWith('cat:')) {
        const catQuery = lowerQuery.replace('cat:', '').trim();
        filtered = filtered.filter(app => app.category && app.category.toLowerCase().includes(catQuery));
        filtered = sortAppsByDeviceCompatibility(filtered, currentOS);
      } else {
        // If server / Meilisearch returned results, prioritize Meilisearch hits with device-aware re-ranking
        if (serverSearchHits && serverSearchHits.length > 0) {
          const appMap = new Map<string, AppListing>(allApps.map(a => [a.id, a]));
          const matchedFromMeili: AppListing[] = [];
          const seen = new Set<string>();

          for (const hit of serverSearchHits) {
            const hitObj = hit as any;
            const hitId = String(hitObj?.id || '');
            const app: AppListing | undefined = appMap.get(hitId) || (hitObj as AppListing);
            if (app && app.id && !seen.has(app.id)) {
              seen.add(app.id);
              matchedFromMeili.push(app);
            }
          }

          if (matchedFromMeili.length > 0) {
            // Server hits are already sorted strictly by search relevance (exact app name > prefix > publisher).
            return sortAppsByDeviceCompatibility(matchedFromMeili, currentOS);
          }
        }

        // Production semantic & multi-token search with device detection re-ranking
        filtered = rankAppsForSearch(allApps, query, { clientOS: currentOS, appsMap: apps });
      }
    }

    return filtered;
  }, [allApps, apps, query, serverSearchHits, user]);

  // Determine if this is a "specific app search"
  const isSpecificSearch = useMemo(() => {
    if (!query || query.trim().length < 2) return false;
    const clean = query.startsWith('cat:') ? query.replace('cat:', '').trim().toLowerCase() : query.trim().toLowerCase();
    
    return allApps.some(app => {
      const name = app.name.toLowerCase();
      return name === clean || name.startsWith(clean) || (clean.length >= 3 && name.includes(clean));
    });
  }, [allApps, query]);

  // Top result app
  const topApp = searchResults.length > 0 ? searchResults[0] : null;

  // Auto-expand specific top app if user searched specifically
  useEffect(() => {
    if (topApp && isSpecificSearch) {
      setExpandedAppIds(prev => ({
        ...prev,
        [topApp.id]: true
      }));
    }
  }, [topApp?.id, isSpecificSearch]);

  // Intelligent algorithm to determine when "Related searches" should appear
  // Only appears for topical, exploratory, or category-style discovery queries where genuine catalog alternatives exist.
  // Never appears for direct/exact app name lookups, category filter links, dead ends, or trivial queries.
  const relatedSearches = useMemo(() => {
    // 1. Guard against empty, trivial, or category navigation queries
    if (!query || query.trim().length < 3) return [];
    if (query.toLowerCase().startsWith('cat:')) return [];

    const clean = query.trim().toLowerCase();

    // 2. Exact match / Direct Navigational Search Check:
    // If the user searched for an exact app name (e.g. "WhatsApp", "Instagram", "Spotify"),
    // they are navigating directly to that specific app — related searches should NOT clutter the screen.
    const cleanNormalized = clean.replace(/[^a-z0-9]/g, '');
    const isExactAppMatch = allApps.some(app => {
      const appNameLower = app.name.toLowerCase().trim();
      const appNameNormalized = appNameLower.replace(/[^a-z0-9]/g, '');
      return appNameLower === clean || (cleanNormalized.length >= 3 && appNameNormalized === cleanNormalized);
    });
    if (isExactAppMatch) return [];

    // 3. Minimum results volume requirement:
    // Need at least 2 relevant search results to justify contextual exploration (never on 0 results or single isolated match)
    if (searchResults.length < 2) return [];

    // 4. Intent & Exploratory Keyword Recognition:
    // Detect whether query is seeking a type of app, service, or feature
    const exploratoryKeywords = [
      'app', 'apps', 'game', 'games', 'editor', 'edit', 'photo', 'video', 'camera',
      'player', 'music', 'audio', 'stream', 'song', 'mp3',
      'tracker', 'planner', 'manager', 'wallet', 'pay', 'upi', 'bank', 'money', 'finance',
      'tool', 'tools', 'utility', 'scanner', 'pdf', 'document', 'reader', 'book',
      'social', 'chat', 'message', 'call', 'meet',
      'ai', 'bot', 'assistant', 'smart', 'gpt',
      'browser', 'vpn', 'security', 'antivirus', 'cleaner', 'booster',
      'offline', 'online', 'free', 'best', 'pro', 'live', 'maker', 'creator',
      'workout', 'fitness', 'health', 'yoga', 'meditation', 'sleep', 'habit',
      'learn', 'study', 'education', 'english', 'language', 'quiz',
      'wallpaper', 'theme', 'launcher', 'keyboard', 'widget',
      'racing', 'action', 'puzzle', 'rpg', 'strategy', 'simulation', 'adventure', 'arcade'
    ];

    const hasExploratoryKeyword = exploratoryKeywords.some(kw => {
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      return regex.test(clean) || clean.includes(kw);
    });

    const distinctCategories = Array.from(new Set(searchResults.map(a => a.category).filter(Boolean))) as string[];
    const isMultiCategoryDiscovery = distinctCategories.length >= 2 && searchResults.length >= 3;

    // If it's neither an exploratory keyword nor a multi-category result set, do not show related searches
    if (!hasExploratoryKeyword && !isMultiCategoryDiscovery) return [];

    // 5. Generate domain-specific candidate suggestions
    const candidateTerms: string[] = [];

    if (clean.includes('upi') || clean.includes('pay') || clean.includes('bank') || clean.includes('wallet') || clean.includes('finance')) {
      candidateTerms.push('upi payment app', 'offline payment app', 'instant money transfer', 'budget tracker & expenses', 'digital banking');
    } else if (clean.includes('photo') || clean.includes('editor') || clean.includes('video') || clean.includes('camera') || clean.includes('edit')) {
      candidateTerms.push('photo editor & collage', 'video editing app', 'background remover app', 'camera filters & effects', 'graphic design app');
    } else if (clean.includes('game') || clean.includes('play') || clean.includes('racing') || clean.includes('action') || clean.includes('puzzle')) {
      candidateTerms.push('offline games without wifi', 'multiplayer online games', 'brain & puzzle games', 'action shooting games', 'car racing simulator');
    } else if (clean.includes('social') || clean.includes('chat') || clean.includes('message') || clean.includes('meet')) {
      candidateTerms.push('private messaging app', 'hd video calling app', 'group chat & community', 'social networking apps');
    } else if (clean.includes('ai') || clean.includes('bot') || clean.includes('assistant')) {
      candidateTerms.push('ai assistant', 'ai chatbot conversation', 'ai photo generator', 'smart notebook & writer');
    } else if (clean.includes('music') || clean.includes('audio') || clean.includes('player') || clean.includes('song')) {
      candidateTerms.push('offline music player', 'free music streaming', 'audio equalizer & bass', 'podcast player app');
    } else if (clean.includes('fitness') || clean.includes('workout') || clean.includes('health') || clean.includes('habit')) {
      candidateTerms.push('home workout no equipment', 'daily step & calorie tracker', 'habit & routine planner', 'meditation & calm sounds');
    } else if (clean.includes('tool') || clean.includes('scanner') || clean.includes('pdf') || clean.includes('doc')) {
      candidateTerms.push('pdf document scanner', 'qr & barcode reader', 'file manager & storage', 'office document viewer');
    } else {
      distinctCategories.forEach(cat => {
        const catName = cat.toLowerCase();
        if (!clean.includes(catName)) {
          candidateTerms.push(`best ${catName} apps`);
          candidateTerms.push(`free ${catName}`);
        }
      });
      const words = clean.split(/\s+/).filter(w => w.length > 2);
      if (words.length > 0) {
        candidateTerms.push(`offline ${words[0]}`);
        candidateTerms.push(`${words[0]} pro app`);
      }
    }

    // 6. Catalog Validation:
    // Only accept suggestions that differ from the current query AND actually match apps in the catalog
    // so tapping a suggestion is guaranteed to return valid apps.
    const verifiedSuggestions: string[] = [];
    for (const term of candidateTerms) {
      const lowerTerm = term.toLowerCase().trim();
      if (lowerTerm === clean || (clean.length > 3 && lowerTerm === `${clean} app`)) continue;

      const termKeywords = lowerTerm.split(/\s+/).filter(w => w.length > 2 && w !== 'app' && w !== 'apps');
      const hasCatalogSupport = allApps.some(app => {
        const text = `${app.name} ${app.category || ''} ${app.description || ''}`.toLowerCase();
        return termKeywords.some(kw => text.includes(kw));
      });

      if (hasCatalogSupport && !verifiedSuggestions.includes(term)) {
        verifiedSuggestions.push(term);
      }
      if (verifiedSuggestions.length >= 4) break;
    }

    // 7. Threshold: Only appear if we have at least 2 verified, high-value alternative queries
    return verifiedSuggestions.length >= 2 ? verifiedSuggestions : [];
  }, [allApps, query, searchResults]);

  // Suggested / Recommended carousel apps using personalization recommendation algorithm
  const suggestedApps = useMemo(() => {
    if (topApp) {
      return RecommendationService.getSimilarApps(topApp.id, allApps, 24, apps);
    }
    return RecommendationService.getPersonalizedRecommendations({
      limit: 24,
      sourceApps: allApps,
      appsMap: apps,
    });
  }, [allApps, topApp, apps]);

  const primarySuggestedApps = useMemo(() => suggestedApps.slice(0, 8), [suggestedApps]);
  const extraSuggestedApps = useMemo(() => suggestedApps.slice(8), [suggestedApps]);

  // Remaining search result items (excluding topApp if rendered separately)
  const remainingResults = useMemo(() => {
    if (!topApp) return [];
    return searchResults.slice(1);
  }, [searchResults, topApp]);

  // Progressive loading for vertical results list (30 initial, 30 more)
  const [resultsLimit, setResultsLimit] = useState(30);
  const [isLoadingMoreResults, setIsLoadingMoreResults] = useState(false);
  const resultsSentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setResultsLimit(30);
  }, [query]);

  const displayedRemainingResults = useMemo(() => {
    return remainingResults.slice(0, resultsLimit);
  }, [remainingResults, resultsLimit]);

  const hasMoreResults = remainingResults.length > displayedRemainingResults.length;

  useEffect(() => {
    const sentinel = resultsSentinelRef.current;
    if (!sentinel || !hasMoreResults) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMoreResults && hasMoreResults) {
          setIsLoadingMoreResults(true);
          setTimeout(() => {
            setResultsLimit((prev) => prev + 30);
            setIsLoadingMoreResults(false);
          }, 350);
        }
      },
      { rootMargin: '250px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreResults, isLoadingMoreResults]);

  const displayQuery = query.startsWith('publisher:')
    ? `pub:${query.slice('publisher:'.length).trim()}`
    : (query.startsWith('pub:')
      ? query
      : (query.startsWith('cat:') ? query.replace('cat:', '').trim() : query));

  // Dropdown using the EXACT UI model of App Details Page (AppDetailPage.tsx)
  const renderAppDetailDropdown = (listing: AppListing) => {
    const fullApp = apps[listing.id];
    const app: AppDetails = fullApp || {
      id: listing.id,
      name: listing.name,
      developer: listing.developer,
      category: listing.category || '',
      rating: listing.rating || 0,
      ratingsCount: listing.ratingsCount || 0,
      reviewsCount: (listing as any).reviewsCount || '0 reviews',
      downloads: listing.downloads || '',
      downloadsCount: listing.downloadsCount || 0,
      size: listing.size || '',
      contentRating: listing.contentRating || 'Rated for 3+',
      price: listing.price || 'Free',
      iconUrl: listing.iconUrl,
      screenshots: (listing as any).screenshots || [],
      aboutText: (listing as any).shortDescription || (listing as any).description || '',
      tags: listing.category ? [listing.category] : [],
      developerInfo: {
        website: '',
        email: ''
      }
    };

    const reviews = getAppReviews(app.id);
    const installData = { state: 'uninstalled', progress: 0 };
    
    const ratingCalculation = calculateAppRatingAndReviews(
      reviews,
      app.rating,
      app.ratingsCount,
      app.reviewsCount
    );
    const averageRating = ratingCalculation.averageRatingFormatted;
    const displayReviewsCount = ratingCalculation.reviewsCountFormatted;
    const isRated = ratingCalculation.isRated;

    const rawDownloads = app.downloadsCount ?? parseDownloadCount(app.downloads);
    const downloadsFormatted = rawDownloads > 0 ? formatDownloadCount(rawDownloads) : (app.downloads ? formatDownloadCount(app.downloads) : '0+');

    const displayScreenshots = [
      ...(app.screenshots || []),
      ...(app.tabletScreenshots || []).filter(s => !app.screenshots?.includes(s)),
      ...((app as any).desktopScreenshots || []).filter((s: string) => !app.screenshots?.includes(s) && !app.tabletScreenshots?.includes(s))
    ].filter(s => typeof s === 'string' && s.trim().length > 0);
    const hasScreenshots = displayScreenshots.length > 0;
    const promoYtId = extractYouTubeId(app.promoVideoUrl) || getAppTrailerYoutubeId(app);
    const hasPromoVideo = Boolean(promoYtId);

    const allLightboxMedia: Array<{ type: 'video' | 'image'; url: string; title: string }> = [
      ...(hasPromoVideo && promoYtId ? [{ type: 'video' as const, url: app.promoVideoUrl || `https://www.youtube.com/watch?v=${promoYtId}`, title: `${app.name} Trailer` }] : []),
      ...displayScreenshots.map((url, i) => ({
        type: (isYouTubeUrl(url) ? 'video' : 'image') as 'video' | 'image',
        url,
        title: `${app.name} ${isYouTubeUrl(url) ? 'Video' : 'Screenshot'} ${i + 1}`
      }))
    ];

    return (
      <div 
        className="w-full py-1.5 transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. App Details Page Exact Stats Row (No borders) */}
        <div className="flex items-center justify-between px-1 sm:px-3 py-2 overflow-x-auto scrollbar-hide">
          {/* Rating */}
          <button 
            type="button"
            onClick={() => onAppClick?.(app.id)}
            className="flex flex-col items-center justify-center min-w-[70px] sm:min-w-[75px] px-1.5 text-center hover:opacity-80 transition-all cursor-pointer rounded-lg hover:bg-theme-hover py-1"
            title="View all ratings and reviews"
          >
            <span className="text-sm font-medium mb-0.5 flex items-center gap-0.5 text-theme-text">
              {isRated ? (
                <>
                  <span>{averageRating}</span>
                  <span className="text-[11px] text-amber-400">★</span>
                </>
              ) : (
                <span className="text-sm font-medium text-theme-text">Unrated</span>
              )}
            </span>
            <span className="text-[11px] text-theme-text-muted whitespace-nowrap">{displayReviewsCount}</span>
          </button>

          {/* Content Rating */}
          <div className="flex flex-col items-center justify-center min-w-[70px] sm:min-w-[75px] px-1.5 text-center">
            <span className="text-sm font-medium mb-0.5 text-theme-text flex items-center justify-center gap-1">
              <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[9px] font-bold bg-theme-text text-theme-bg rounded-[3px] leading-none tracking-tight">
                {getContentRatingBadge(app.contentRating)}
              </span>
              <Info className="w-3 h-3 text-theme-text-muted shrink-0" />
            </span>
            <span className="text-[11px] text-theme-text-muted whitespace-nowrap">{getContentRatingLabel(app.contentRating)}</span>
          </div>

          {/* Downloads Count */}
          <div className="flex flex-col items-center justify-center min-w-[70px] sm:min-w-[75px] px-1.5 text-center">
            <span className="text-sm font-medium mb-0.5 text-theme-text whitespace-nowrap">
              {downloadsFormatted}
            </span>
            <span className="text-[11px] text-theme-text-muted whitespace-nowrap">Downloads</span>
          </div>
        </div>

        {/* 2. App Details Page Direct Download Action */}
        <div className="px-1 sm:px-3 py-2.5 flex items-center">
          <button 
            type="button"
            onClick={() => {
              const targetPlat = (app.platform === 'ios' || isIOSApp(app))
                ? 'ios'
                : (app.platform === 'linux' || isLinuxApp(app)) 
                ? 'linux' 
                : (app.platform === 'windows' || isWindowsApp(app)) 
                ? 'windows' 
                : (app.platform === 'mac' || isMacApp(app)) 
                ? 'mac' 
                : 'android';
              startInstall(app.id, {
                downloadUrl: app.downloadUrl,
                appName: app.name,
                sizeString: getUnifiedAppSize(app),
                iconUrl: app.iconUrl,
                sha256: app.sha256,
                fileName: app.assetName,
                platform: targetPlat,
                packageFormat: app.packageFormat
              });
            }}
            className="w-full sm:w-auto sm:min-w-[180px] sm:max-w-xs sm:px-8 h-11 bg-[#0b57d0] hover:bg-[#0842a0] text-white dark:bg-[#a8c7fa] dark:hover:bg-[#d3e3fd] dark:active:bg-[#7cacf8] dark:text-[#041e49] font-medium font-google-sans rounded-full text-sm sm:text-base transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer select-none"
          >
            {(app.platform === 'ios' || isIOSApp(app)) ? (
              <AppleIcon className="w-4 h-4 shrink-0" />
            ) : (app.platform === 'linux' || isLinuxApp(app)) ? (
              <LinuxIcon className="w-4 h-4 shrink-0" />
            ) : (app.platform === 'windows' || isWindowsApp(app)) ? (
              <WindowsIcon className="w-4 h-4 shrink-0" />
            ) : (app.platform === 'mac' || isMacApp(app)) ? (
              <MacIcon className="w-4 h-4 shrink-0" />
            ) : (
              <AndroidIcon className="w-4 h-4 shrink-0" />
            )}
            <span>{getAppPrimaryActionLabel(app)}</span>
          </button>
        </div>

        {/* 3. Search Result Media Carousel - Interactive horizontal screenshot & video carousel */}
        {(hasScreenshots || hasPromoVideo) && (() => {
          return (
            <div className="pt-1.5 pb-2 w-full">
              <div
                ref={(el) => {
                  previewScrollRefs.current[app.id] = el;
                }}
                onMouseDown={(e) => handlePreviewMouseDown(app.id, e)}
                onMouseLeave={handlePreviewMouseUp}
                onMouseUp={handlePreviewMouseUp}
                onMouseMove={(e) => handlePreviewMouseMove(app.id, e)}
                className="flex gap-2 overflow-x-auto scrollbar-hide -mx-2.5 sm:-mx-4 md:-mx-6 lg:mx-0 px-2.5 sm:px-4 md:px-6 lg:px-0 py-1 select-none cursor-grab active:cursor-grabbing w-auto"
                style={{
                  WebkitOverflowScrolling: 'touch',
                  touchAction: 'pan-x pan-y',
                  overscrollBehaviorX: 'contain',
                  overscrollBehaviorY: 'auto',
                }}
              >
                {/* Promo Video Card - 16:9 ratio */}
                {hasPromoVideo && promoYtId && (() => {
                  const customThumb = app.videoThumbnailUrl || getYouTubeThumbnail(promoYtId, 'maxres') || getYouTubeThumbnail(promoYtId, 'hq');
                  const videoKey = `promo-${app.id}`;
                  const isPlaying = activeInlineVideo?.id === videoKey;

                  return (
                    <SearchPromoVideoCard
                      key="promo-video-card"
                      app={app}
                      promoYtId={promoYtId}
                      customThumb={customThumb}
                      isPlaying={isPlaying}
                      onPlay={() => {
                        setActiveInlineVideo({ id: videoKey, ytId: promoYtId });
                      }}
                      onReset={() => {
                        if (activeInlineVideo?.id === videoKey) {
                          setActiveInlineVideo(null);
                        }
                      }}
                      onOpenLightbox={() => {
                        setLightboxGallery({
                          appName: app.name,
                          items: allLightboxMedia,
                          index: 0,
                        });
                      }}
                      hasDraggedRef={hasDraggedRef}
                    />
                  );
                })()}

                {/* Screenshots List - Full horizontal scrollable carousel */}
                {displayScreenshots.map((screenshot, index) => {
                  const mediaIdx = index + (hasPromoVideo && promoYtId ? 1 : 0);
                  const isYt = isYouTubeUrl(screenshot);
                  const ytId = isYt ? extractYouTubeId(screenshot) : null;
                  const videoKey = `shot-video-${app.id}-${index}`;
                  const isPlayingInline = isYt && activeInlineVideo?.id === videoKey;

                  if (isYt && ytId) {
                    const thumb = getYouTubeThumbnail(ytId, 'maxres') || getYouTubeThumbnail(ytId, 'hq');
                    return (
                      <SearchScreenshotVideoCard
                        key={`yt-shot-${index}`}
                        app={app}
                        screenshot={screenshot}
                        index={index}
                        mediaIdx={mediaIdx}
                        ytId={ytId}
                        thumb={thumb}
                        isPlayingInline={isPlayingInline}
                        onPlay={() => {
                          setActiveInlineVideo({ id: videoKey, ytId });
                        }}
                        onReset={() => {
                          if (activeInlineVideo?.id === videoKey) {
                            setActiveInlineVideo(null);
                          }
                        }}
                        onOpenLightbox={() => {
                          setLightboxGallery({
                            appName: app.name,
                            items: allLightboxMedia,
                            index: mediaIdx,
                          });
                        }}
                        hasDraggedRef={hasDraggedRef}
                      />
                    );
                  }

                  const detectedRatio = imageAspectRatios[screenshot];
                  const isHorizontal = detectedRatio ? detectedRatio >= 1.05 : false;
                  const effectiveRatio = isHorizontal ? `${detectedRatio}` : '9 / 16';

                  return (
                    <div
                      key={`shot-${index}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!hasDraggedRef.current) {
                          setLightboxGallery({
                            appName: app.name,
                            items: allLightboxMedia,
                            index: mediaIdx,
                          });
                        }
                      }}
                      style={{ aspectRatio: effectiveRatio }}
                      className="h-[170px] sm:h-[190px] md:h-[210px] lg:h-[230px] w-auto shrink-0 rounded-[4px] overflow-hidden shadow-sm hover:shadow-md bg-theme-hover/20 cursor-pointer group transition-shadow duration-200 select-none flex items-center justify-center"
                    >
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
                    </div>
                  );
                })}
                <div className="w-2 shrink-0" />
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  const handleQuickInstall = (app: AppListing, e: React.MouseEvent) => {
    e.stopPropagation();
    const targetPlat = (app.platform === 'ios' || isIOSApp(app))
      ? 'ios'
      : (app.platform === 'linux' || isLinuxApp(app)) 
      ? 'linux' 
      : (app.platform === 'windows' || isWindowsApp(app)) 
      ? 'windows' 
      : (app.platform === 'mac' || isMacApp(app)) 
      ? 'mac' 
      : 'android';
    startInstall(app.id, {
      downloadUrl: app.downloadUrl,
      appName: app.name,
      sizeString: getUnifiedAppSize(app),
      iconUrl: app.iconUrl,
      sha256: app.sha256,
      fileName: app.assetName,
      platform: targetPlat,
      packageFormat: app.packageFormat
    });
  };

  /**
   * Unified App Row Component
   * Ensures identical row height, icon size, typography, metrics, and dropdown behavior
   * across mobile and desktop/tablet viewports.
   */
  const renderAppRow = (app: AppListing, isTopResult: boolean = false) => {
    const isExpanded = !!expandedAppIds[app.id];
    const metrics = getAppMetrics(app);
    const slug = (app as any).slug || slugifyAppName(app.name) || app.id;
    const appUrl = `/apps/${encodeURIComponent(slug)}`;

    return (
      <div key={app.id} className="w-full flex flex-col h-full">
        {/* Mobile View: Row with accordion toggle (< md) */}
        <a 
          href={appUrl}
          onClick={(e) => {
            if (!e.metaKey && !e.ctrlKey) {
              e.preventDefault();
              onAppClick?.(app.id);
            }
          }}
          className="w-full flex md:hidden items-center gap-3 py-2.5 cursor-pointer select-none bg-transparent no-underline text-left"
        >
          {/* Exact unified list app icon (56px mobile, 64px sm) */}
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden shrink-0 bg-theme-hover shadow-xs border-0 flex items-center justify-center">
            <AppLazyImage
              src={app.iconUrl}
              alt={app.name}
              fallbackText={app.name}
              className="w-full h-full object-cover"
              containerClassName="w-full h-full"
            />
          </div>
          
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <h3 className="text-theme-text text-[15px] sm:text-base font-medium leading-tight mb-0.5 truncate">
              {app.name}
            </h3>
            <p className="text-theme-text-muted text-xs sm:text-[13px] mb-1 truncate">
              {getAppPublisherName(app)} {app.category ? `• ${app.category}` : ''}
            </p>
            
            <div className="flex items-center gap-1.5 text-xs text-theme-text-muted whitespace-nowrap overflow-hidden text-ellipsis">
              {metrics.isRated ? (
                <span className="flex items-center gap-0.5 font-medium text-theme-text shrink-0">
                  <span>{metrics.averageRating}</span>
                  <span className="text-[10px] text-amber-400">★</span>
                </span>
              ) : (
                <span className="shrink-0 text-theme-text-muted">Unrated</span>
              )}
              {!isExpanded && metrics.downloadsFormatted && (
                <span className="shrink-0 font-medium text-theme-text">
                  • {metrics.downloadsFormatted}
                </span>
              )}
              {metrics.size && <span className="shrink-0">• {metrics.size}</span>}
              {(() => {
                const fmtInfo = getAppFormatBadgeLabel(app);
                const fmtText = fmtInfo.compactLabel || fmtInfo.label;
                return fmtText ? <span className="shrink-0 truncate">• {fmtText}</span> : null;
              })()}
            </div>
          </div>

          {/* Dropdown chevron toggle button */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleAppExpansion(app.id, e);
              }}
              className={`w-8 h-8 rounded-full bg-theme-hover hover:bg-theme-active flex items-center justify-center text-theme-text-muted hover:text-theme-text transition-all cursor-pointer ${
                isExpanded ? 'bg-theme-active text-theme-text' : ''
              }`}
              aria-label="Toggle details"
              title="Show details"
            >
              <ChevronDown className={`w-4.5 h-4.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </a>

        {/* Desktop & Tablet View: Rich App Card with Direct Install CTA and visual preview (>= md) */}
        <a 
          href={appUrl}
          onClick={(e) => {
            if (!e.metaKey && !e.ctrlKey) {
              e.preventDefault();
              onAppClick?.(app.id);
            }
          }}
          className="hidden md:flex flex-col p-4 sm:p-5 rounded-2xl border border-theme-border/30 bg-theme-hover/20 hover:bg-theme-hover/40 transition-all cursor-pointer group shadow-xs hover:shadow-md justify-between h-full no-underline text-left"
        >
          <div className="flex items-start gap-3.5 mb-2.5">
            <div className="w-16 h-16 rounded-[18px] overflow-hidden shrink-0 bg-theme-hover shadow-xs flex items-center justify-center border-0">
              <AppLazyImage
                src={app.iconUrl}
                alt={app.name}
                fallbackText={app.name}
                className="w-full h-full object-cover"
                containerClassName="w-full h-full"
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-theme-text text-base font-semibold leading-tight truncate group-hover:text-blue-500 transition-colors">
                {app.name}
              </h3>
              <p className="text-theme-text-muted text-xs truncate mt-0.5">
                {getAppPublisherName(app)} {app.category ? `• ${app.category}` : ''}
              </p>
              <div className="flex items-center gap-1.5 text-xs text-theme-text-muted mt-1.5 flex-wrap">
                {metrics.isRated ? (
                  <span className="flex items-center gap-0.5 font-medium text-theme-text">
                    <span>{metrics.averageRating}</span>
                    <span className="text-[10px] text-amber-400">★</span>
                  </span>
                ) : (
                  <span className="text-theme-text-muted">Unrated</span>
                )}
                {metrics.size && <span>• {metrics.size}</span>}
                <span>• {getAppFormatBadgeLabel(app).label}</span>
                {metrics.downloadsFormatted && <span>• {metrics.downloadsFormatted}</span>}
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => handleQuickInstall(app, e)}
              className="shrink-0 h-9 px-4 rounded-full bg-[#0b57d0] hover:bg-[#0842a0] text-white dark:bg-[#a8c7fa] dark:hover:bg-[#d3e3fd] dark:text-[#041e49] text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer select-none"
              title="Install app"
            >
              {(app.platform === 'ios' || isIOSApp(app)) ? (
                <AppleIcon className="w-3.5 h-3.5 shrink-0" />
              ) : (app.platform === 'linux' || isLinuxApp(app)) ? (
                <LinuxIcon className="w-3.5 h-3.5 shrink-0" />
              ) : (app.platform === 'windows' || isWindowsApp(app)) ? (
                <WindowsIcon className="w-3.5 h-3.5 shrink-0" />
              ) : (app.platform === 'mac' || isMacApp(app)) ? (
                <MacIcon className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <AndroidIcon className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>{getAppPrimaryActionLabel(app)}</span>
            </button>
          </div>

          {/* Screenshot Preview Strip on Desktop/Tablet if available */}
          {(() => {
            const rawShots = [
              ...(app.screenshots || []),
              ...(app.tabletScreenshots || []).filter(s => !app.screenshots?.includes(s))
            ].filter(s => typeof s === 'string' && s.trim().length > 0 && !isYouTubeUrl(s));

            if (rawShots.length === 0) return null;

            return (
              <div className="flex gap-2 pt-2 overflow-hidden select-none">
                {rawShots.slice(0, 3).map((shot, sIdx) => (
                  <div key={sIdx} className="h-24 w-auto aspect-[9/16] rounded-lg overflow-hidden bg-theme-hover/40 border border-theme-border/20 shrink-0">
                    <img src={shot} alt={`${app.name} preview`} className="w-full h-full object-cover select-none pointer-events-none" />
                  </div>
                ))}
              </div>
            );
          })()}
        </a>

        {/* Expanded Dropdown Menu on mobile only */}
        {isExpanded && (
          <div className="block md:hidden">
            {renderAppDetailDropdown(app)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-theme-bg text-theme-text font-sans w-full shadow-none overflow-hidden select-none">
      {/* Top Header - Edge to Edge with Search pill aligned with Explore page */}
      <header className="h-[60px] sm:h-[68px] flex items-center justify-between px-2.5 sm:px-4 md:px-6 bg-theme-bg shrink-0 gap-3 z-20 w-full border-0">
        {/* Left: Back button (matching menu button sizing) + Brand logo on desktop */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 -translate-x-[2px]">
          <button 
            type="button"
            onClick={onBack} 
            className="w-8 h-8 text-theme-text hover:bg-theme-hover active:bg-theme-hover/80 rounded-full transition-colors cursor-pointer flex items-center justify-center shrink-0"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="hidden md:flex items-center">
            <BrandLogo size="md" showText={true} onClick={onBack} />
          </div>
        </div>

        {/* Center: Search Bar matching Explore tab header position */}
        <div className="flex-1 min-w-0 max-w-full md:max-w-[539px] lg:max-w-[639px]">
          <div 
            onClick={() => {
              if (onOpenSearch) onOpenSearch(false);
              else onBack();
            }}
            className="w-full min-w-0 flex items-center bg-theme-hover md:bg-theme-bg md:border md:border-theme-border rounded-full h-[46px] px-4 cursor-pointer hover:bg-theme-hover/80 transition-colors overflow-hidden"
          >
            <div className="flex items-center min-w-0 flex-1 gap-3">
              <Search className="w-4.5 h-4.5 text-theme-text-muted shrink-0" />
              <span className="flex-1 min-w-0 bg-transparent text-theme-text text-[15px] font-normal truncate">
                {displayQuery || 'Search apps and games'}
              </span>
            </div>
            {displayQuery && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onOpenSearch) onOpenSearch(false);
                  else onBack();
                }}
                className="p-1 -mr-1 text-theme-text-muted hover:text-theme-text rounded-full shrink-0 flex items-center justify-center cursor-pointer transition-colors"
                aria-label="Clear query"
                title="Clear query"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Right: Mic button matching PFP slot position and size */}
        <div className="flex items-center gap-2 shrink-0 -translate-x-[4px]">
          <button 
            type="button"
            onClick={handleVoiceSearch}
            className="w-8 h-8 rounded-full bg-theme-hover hover:bg-theme-active text-theme-text flex items-center justify-center overflow-hidden shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
            aria-label="Voice Search"
            title="Search with microphone"
          >
            <Mic className="w-4.5 h-4.5" />
          </button>
        </div>
      </header>

      {/* Results Content Area - Expanded Edge-to-Edge Layout */}
      <PullToRefresh
        scrollRef={resultsScrollRef}
        onRefresh={handleSearchRefresh}
        isRefreshing={isSearchRefreshing || isPullRefreshing}
        dismissBeforeEnd={true}
        earlyDismissDurationMs={300}
        className="flex-1 min-h-0 flex flex-col w-full relative"
      >
        <div 
          ref={resultsScrollRef} 
          tabIndex={0}
          className="flex-1 overflow-y-auto px-2.5 sm:px-4 md:px-6 pt-3 pb-[calc(76px+env(safe-area-inset-bottom,12px))] md:pb-8 flex flex-col min-h-0 outline-none focus:outline-none overscroll-y-contain" 
          style={{
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
          }}
          onScroll={handleScroll}
        >
          {isSearchingLoading ? (
            <div className="flex-1 flex items-center justify-center min-h-[50vh] w-full">
              <StoreCircleLoader size="md" />
            </div>
          ) : searchResults.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center my-auto">
              <div className="w-16 h-16 rounded-full bg-theme-hover flex items-center justify-center text-theme-text-muted mb-4">
                <Search className="w-8 h-8" />
              </div>
              <h2 className="text-theme-text font-medium text-lg mb-1">No results found</h2>
              <p className="text-theme-text-muted text-sm max-w-[280px]">
                We couldn't find any matches for "{query}". Try checking your spelling or searching another query.
              </p>
            </div>
          ) : (
            <div className="w-full max-w-7xl mx-auto flex flex-col space-y-6">
              {/* 1. TOP RESULT / SPECIFIC APP RESULT */}
              {topApp && (
                <div className="w-full">
                  {/* Mobile Row (< md) */}
                  <div className="block md:hidden">
                    {renderAppRow(topApp, true)}
                  </div>

                  {/* Tablet & Desktop Widescreen Featured Card (>= md) */}
                  {(() => {
                    const topMetrics = getAppMetrics(topApp);
                    const topShots = [
                      ...(topApp.screenshots || []),
                      ...(topApp.tabletScreenshots || []).filter(s => !topApp.screenshots?.includes(s))
                    ].filter(s => typeof s === 'string' && s.trim().length > 0 && !isYouTubeUrl(s));

                    const topSlug = (topApp as any).slug || slugifyAppName(topApp.name) || topApp.id;
                    const topAppUrl = `/apps/${encodeURIComponent(topSlug)}`;

                    return (
                      <a 
                        href={topAppUrl}
                        onClick={(e) => {
                          if (!e.metaKey && !e.ctrlKey) {
                            e.preventDefault();
                            onAppClick?.(topApp.id);
                          }
                        }}
                        className="hidden md:flex flex-col lg:flex-row lg:items-center justify-between gap-6 p-5 sm:p-6 rounded-3xl border border-theme-border/40 bg-gradient-to-r from-theme-hover/40 via-theme-hover/20 to-transparent hover:border-theme-border/70 shadow-xs hover:shadow-md transition-all cursor-pointer group no-underline text-left"
                      >
                        <div className="flex items-start gap-4 sm:gap-5 flex-1 min-w-0">
                          <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl lg:rounded-3xl overflow-hidden shrink-0 bg-theme-hover shadow-md flex items-center justify-center border-0">
                            <AppLazyImage
                              src={topApp.iconUrl}
                              alt={topApp.name}
                              fallbackText={topApp.name}
                              className="w-full h-full object-cover"
                              containerClassName="w-full h-full"
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[11px] font-semibold mb-1">
                              <span>Top match</span>
                            </div>
                            <h2 className="text-xl sm:text-2xl font-bold font-google-sans text-theme-text leading-tight truncate group-hover:text-blue-500 transition-colors">
                              {topApp.name}
                            </h2>
                            <p className="text-theme-text-muted text-xs sm:text-sm truncate mt-0.5">
                              {topApp.developer} {topApp.category ? `• ${topApp.category}` : ''}
                            </p>
                            
                            <div className="flex items-center gap-2 text-xs text-theme-text-muted mt-2 flex-wrap">
                              {topMetrics.isRated ? (
                                <span className="flex items-center gap-0.5 font-medium text-theme-text">
                                  <span>{topMetrics.averageRating}</span>
                                  <span className="text-xs text-amber-400">★</span>
                                </span>
                              ) : (
                                <span>Unrated</span>
                              )}
                              {topMetrics.size && <span>• {topMetrics.size}</span>}
                              <span>• {getAppFormatBadgeLabel(topApp).label}</span>
                              {topMetrics.downloadsFormatted && <span>• {topMetrics.downloadsFormatted}</span>}
                            </div>

                            <div className="flex items-center gap-3 mt-3">
                              <button
                                type="button"
                                onClick={(e) => handleQuickInstall(topApp, e)}
                                className="h-10 px-6 rounded-full bg-[#0b57d0] hover:bg-[#0842a0] text-white dark:bg-[#a8c7fa] dark:hover:bg-[#d3e3fd] dark:text-[#041e49] text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer select-none"
                              >
                                {(topApp.platform === 'ios' || isIOSApp(topApp)) ? (
                                  <AppleIcon className="w-4 h-4 shrink-0" />
                                ) : (topApp.platform === 'linux' || isLinuxApp(topApp)) ? (
                                  <LinuxIcon className="w-4 h-4 shrink-0" />
                                ) : (topApp.platform === 'windows' || isWindowsApp(topApp)) ? (
                                  <WindowsIcon className="w-4 h-4 shrink-0" />
                                ) : (topApp.platform === 'mac' || isMacApp(topApp)) ? (
                                  <MacIcon className="w-4 h-4 shrink-0" />
                                ) : (
                                  <AndroidIcon className="w-4 h-4 shrink-0" />
                                )}
                                <span>{getAppPrimaryActionLabel(topApp)}</span>
                              </button>
                              <span className="text-xs font-medium text-blue-500 hover:underline">
                                View details →
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Top App Preview Screenshots Strip */}
                        {topShots.length > 0 && (
                          <div className="flex gap-2.5 overflow-hidden shrink-0 select-none">
                            {topShots.slice(0, 3).map((shot, sIdx) => (
                              <div key={sIdx} className="h-28 sm:h-32 w-auto aspect-[9/16] rounded-xl overflow-hidden bg-theme-hover/40 border border-theme-border/20 shadow-xs">
                                <img src={shot} alt={`${topApp.name} screenshot ${sIdx + 1}`} className="w-full h-full object-cover select-none pointer-events-none" />
                              </div>
                            ))}
                          </div>
                        )}
                      </a>
                    );
                  })()}
                </div>
              )}

            {/* 2. RELATED SEARCHES SECTION - Clean borderless full-width rows */}
            {relatedSearches.length > 0 && (
              <div className="w-full">
                <h3 className="text-base sm:text-lg font-medium text-theme-text mb-2">
                  Related searches
                </h3>
                <div className="flex flex-col gap-0.5 w-full">
                  {relatedSearches.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => {
                        saveSearchQuery(term);
                        if (onSearchQuery) onSearchQuery(term);
                        else if (onOpenSearch) onOpenSearch(false);
                      }}
                      className="w-full flex items-center gap-3 py-2.5 px-0.5 border-0 bg-transparent text-theme-text hover:text-blue-500 active:bg-theme-hover/30 text-[15px] sm:text-base font-medium transition-colors cursor-pointer text-left"
                    >
                      <Search className="w-4.5 h-4.5 text-theme-text-muted shrink-0" />
                      <span className="truncate flex-1 min-w-0 leading-tight">{term}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 3. SPONSORED / SUGGESTED FOR YOU CAROUSEL - Aligned with grid */}
            {suggestedApps.length > 0 && (
              <div className="w-full">
                <div className="mb-3">
                  <h2 className="text-[18px] sm:text-[19px] font-semibold text-[#0f172a] dark:text-[#f3f4f6] tracking-tight">
                    Suggested for you
                  </h2>
                </div>

                <div 
                  className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-2.5 sm:-mx-4 md:-mx-6 px-2.5 sm:px-4 md:px-6 items-start select-none w-auto"
                  style={{
                    WebkitOverflowScrolling: 'touch',
                    touchAction: 'pan-x pan-y',
                    overscrollBehaviorX: 'contain',
                    overscrollBehaviorY: 'auto',
                  }}
                >
                  {primarySuggestedApps.map((app) => {
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
                        className="w-[96px] sm:w-[112px] md:w-[124px] lg:w-[136px] shrink-0 flex flex-col items-start cursor-pointer select-none group no-underline text-left"
                      >
                        {/* Standard App Size Icon */}
                        <div className="w-[96px] h-[96px] sm:w-[112px] sm:h-[112px] md:w-[124px] md:h-[124px] lg:w-[136px] lg:h-[136px] rounded-[22px] sm:rounded-[26px] overflow-hidden shadow-xs mb-2 bg-theme-hover border-0 flex items-center justify-center">
                          <AppLazyImage
                            src={app.iconUrl}
                            alt={app.name}
                            fallbackText={app.name}
                            className="w-full h-full object-cover select-none pointer-events-none"
                            containerClassName="w-full h-full"
                          />
                        </div>
                        <h4 className="text-theme-text text-xs sm:text-[13px] font-medium leading-snug line-clamp-1 w-full group-hover:text-blue-500 transition-colors">
                          {app.name}
                        </h4>
                        <div className="flex items-center gap-1 text-[11px] text-theme-text-muted mt-0.5">
                          {metrics.isRated ? (
                            <span className="flex items-center gap-0.5 text-theme-text font-medium">
                              <span>{metrics.averageRating}</span>
                              <span className="text-[10px] text-amber-400">★</span>
                            </span>
                          ) : (
                            <span>{getUnifiedAppSize(app)}</span>
                          )}
                          {metrics.downloadsFormatted && <span className="truncate">• {metrics.downloadsFormatted}</span>}
                        </div>
                      </a>
                    );
                  })}
                </div>

                {/* Expanded Vertical List of Additional Suggested Apps when "More results" is open */}
                {showMoreSponsored && extraSuggestedApps.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full pt-2 pb-1 animate-in fade-in duration-200">
                    {extraSuggestedApps.map((app) => (
                      <div key={app.id} className={expandedAppIds[app.id] ? "col-span-full" : "h-full"}>
                        {renderAppRow(app)}
                      </div>
                    ))}
                  </div>
                )}

                {/* More results button under carousel */}
                {extraSuggestedApps.length > 0 && (
                  <div className="w-full mt-2.5">
                    <button
                      type="button"
                      onClick={() => setShowMoreSponsored(!showMoreSponsored)}
                      className="w-full py-2.5 px-4 rounded-full border border-theme-border/60 text-theme-text text-sm font-medium hover:bg-theme-hover flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>{showMoreSponsored ? 'Fewer results' : 'More results'}</span>
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showMoreSponsored ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 4. "YOU MIGHT ALSO LIKE" OR RESULTS LIST WITH DROPDOWN PREVIEWS */}
            {remainingResults.length > 0 && (
              <div className="w-full">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base sm:text-lg font-semibold text-[#0f172a] dark:text-[#f3f4f6]">
                    {isSpecificSearch ? 'You might also like' : 'Results'}
                  </h3>
                </div>

                {/* Responsive grid of app rows on tablet/desktop */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
                  {displayedRemainingResults.map((app) => (
                    <div key={app.id} className={expandedAppIds[app.id] ? "col-span-full" : "h-full"}>
                      {renderAppRow(app)}
                    </div>
                  ))}
                </div>

                {/* Sentinel and auto-appearing loader for vertical scrolling (loads 30 more apps) */}
                <div ref={resultsSentinelRef} className="h-1 w-full" />
                {isLoadingMoreResults && (
                  <div className="w-full py-4 flex flex-col items-center justify-center gap-3 animate-in fade-in duration-150">
                    <StoreCircleLoader size="sm" minHeightClass="min-h-0" />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full opacity-70">
                      <SearchResultRowSkeleton />
                      <SearchResultRowSkeleton />
                      <SearchResultRowSkeleton />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        </div>
      </PullToRefresh>
      
      {onTabChange && (
        <div className="fixed md:static bottom-0 left-0 right-0 z-40 shrink-0 w-full bg-theme-nav pb-[env(safe-area-inset-bottom,0px)] box-content">
          <BottomNav activeTab={activeTab} onTabChange={onTabChange} isNavVisible={isNavVisible} />
        </div>
      )}

      {/* Theater Mode Fullscreen Lightbox Modal */}
      {lightboxVideo && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
          onClick={() => setLightboxVideo(null)}
        >
          <div 
            className="w-full max-w-4xl flex flex-col bg-zinc-950 rounded-2xl overflow-hidden shadow-2xl border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3.5 border-b border-white/10 bg-zinc-900/80">
              <div className="flex items-center gap-2.5 min-w-0">
                {lightboxVideo.app.iconUrl && (
                  <img src={lightboxVideo.app.iconUrl} alt={lightboxVideo.app.name} className="w-8 h-8 rounded-lg object-cover shrink-0" />
                )}
                <div className="min-w-0">
                  <h4 className="text-white text-sm font-medium truncate">{lightboxVideo.app.name}</h4>
                  <p className="text-zinc-400 text-xs truncate">Gameplay & Video Trailer</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLightboxVideo(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-colors"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="relative w-full aspect-video bg-black">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${lightboxVideo.ytId}?autoplay=1&rel=0&playsinline=1`}
                title={`${lightboxVideo.app.name} trailer`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="w-full h-full border-0"
              />
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Media Gallery Lightbox for Screenshots & Trailers */}
      <MediaGalleryLightbox
        isOpen={Boolean(lightboxGallery)}
        onClose={() => setLightboxGallery(null)}
        mediaItems={lightboxGallery?.items || []}
        initialIndex={lightboxGallery?.index || 0}
        appName={lightboxGallery?.appName || 'App'}
      />
    </div>
  );
}
