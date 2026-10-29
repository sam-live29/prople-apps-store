import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { HeroBannerConfig, HomeSectionConfig, AppDetails, AppListing } from '../types';
import { featuredApp, appDetailsMock } from '../data';
import { 
  listenToAllApps, 
  fetchAllAppsOnce,
  publishAppToFirestore, 
  updateAppInFirestore, 
  deleteAppFromFirestore, 
  initializeFirestoreCatalogue 
} from '../services/firestoreAppService';
import { getUnifiedAppSize, formatDownloadCount } from '../utils/appMetricsAlgorithm';
import { clearAllSectionScrolls } from '../services/sectionScrollMemoryService';
import { AdminModerationService } from '../services/adminModerationService';
import { RecommendationService } from '../services/recommendationService';
import { safeFetchJson } from '../utils/safeFetch';

interface StoreConfigContextType {
  banners: HeroBannerConfig[];
  activeBanners: HeroBannerConfig[];
  updateBanner: (id: string, updated: Partial<HeroBannerConfig>) => void;
  addBanner: (banner: Omit<HeroBannerConfig, 'id'>) => string;
  deleteBanner: (id: string) => void;
  sections: HomeSectionConfig[];
  updateSection: (key: string, updated: Partial<HomeSectionConfig>) => void;
  toggleSection: (key: string) => void;
  resetToDefaults: () => void;

  // Realtime Published Catalogue
  apps: Record<string, AppDetails>;
  appsList: AppDetails[];
  allAppListings: AppListing[];
  rawAllAppListings: AppListing[];
  publishApp: (
    app: AppDetails, 
    featureOnSpotlight?: boolean, 
    spotlightBadge?: string, 
    spotlightHeadline?: string
  ) => Promise<void>;
  updateApp: (appId: string, partial: Partial<AppDetails>) => Promise<void>;
  deleteApp: (appId: string, userId?: string, userEmail?: string) => Promise<void>;
  removeApp: (appId: string, userId?: string, userEmail?: string) => Promise<void>;
  isLoadingApps: boolean;
  hasInitialSyncCompleted: boolean;
  isPullRefreshing: boolean;
  refreshCatalogue: () => Promise<void>;
}

const LOCAL_STORAGE_BANNERS_KEY = 'appmarket_custom_banners';
const LOCAL_STORAGE_SECTIONS_KEY = 'appmarket_custom_sections';
const LOCAL_STORAGE_APPS_KEY = 'appmarket_published_apps_cache';
const ACTIVE_CATALOG_STORAGE_KEY = 'prople_active_catalog_v3';

const defaultBanners: HeroBannerConfig[] = [];

const defaultSections: HomeSectionConfig[] = [
  { id: 'sec-hero', key: 'hero', title: 'Featured Hero Banner', enabled: false },
  { id: 'sec-suggested', key: 'suggested', title: 'Suggested for You', subtitle: '', enabled: true },
  { id: 'sec-recommended', key: 'recommended', title: 'Recommended for you', enabled: true },
  { id: 'sec-webapps', key: 'webapps', title: 'Must-try Apps', enabled: true },
];

const StoreConfigContext = createContext<StoreConfigContextType | undefined>(undefined);

export function StoreConfigProvider({ children }: { children: ReactNode }) {
  // Instant cache hydration from window.__INITIAL_APP__ or sessionStorage/localStorage prevents any blank or empty flash
  const [apps, setApps] = useState<Record<string, AppDetails>>(() => {
    const seedApps: Record<string, AppDetails> = {};
    if (typeof window !== 'undefined' && (window as any).__INITIAL_APP__) {
      const init = (window as any).__INITIAL_APP__;
      if (init && init.id) {
        seedApps[init.id] = init;
        if (init.slug) seedApps[init.slug] = init;
      }
    }
    try {
      const cached = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(ACTIVE_CATALOG_STORAGE_KEY)) ||
                     (typeof localStorage !== 'undefined' && localStorage.getItem(ACTIVE_CATALOG_STORAGE_KEY));
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          return { ...seedApps, ...parsed };
        }
      }
    } catch {}
    return seedApps;
  });
  const [isLoadingApps, setIsLoadingApps] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && (window as any).__INITIAL_APP__) {
      return false;
    }
    try {
      const cached = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(ACTIVE_CATALOG_STORAGE_KEY)) ||
                     (typeof localStorage !== 'undefined' && localStorage.getItem(ACTIVE_CATALOG_STORAGE_KEY));
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          return false;
        }
      }
    } catch {}
    return true;
  });
  const [hasInitialSyncCompleted, setHasInitialSyncCompleted] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && (window as any).__INITIAL_APP__) {
      return true;
    }
    try {
      const cached = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(ACTIVE_CATALOG_STORAGE_KEY)) ||
                     (typeof localStorage !== 'undefined' && localStorage.getItem(ACTIVE_CATALOG_STORAGE_KEY));
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          return true;
        }
      }
    } catch {}
    return false;
  });
  const [isPullRefreshing, setIsPullRefreshing] = useState<boolean>(false);
  const [moderationVersion, setModerationVersion] = useState<number>(0);

  // Clear legacy client-side cache keys from localStorage on mount
  useEffect(() => {
    try {
      localStorage.removeItem(LOCAL_STORAGE_APPS_KEY);
      localStorage.removeItem(LOCAL_STORAGE_BANNERS_KEY);
      localStorage.removeItem(LOCAL_STORAGE_SECTIONS_KEY);
    } catch {}
  }, []);

  // Re-sync moderation enforcement whenever admin triggers an action
  useEffect(() => {
    const handleModerationUpdate = () => {
      setModerationVersion(v => v + 1);
    };
    window.addEventListener('admin:moderation:updated', handleModerationUpdate);
    return () => window.removeEventListener('admin:moderation:updated', handleModerationUpdate);
  }, []);

  // Subscribe to real-time Firestore apps
  useEffect(() => {
    initializeFirestoreCatalogue();

    let isMounted = true;
    let hasLoadedFirstData = false;

    const syncAppsAndBanners = (liveApps: Record<string, AppDetails> | null) => {
      if (!isMounted) return;
      const freshApps = liveApps || {};
      const count = Object.keys(freshApps).length;
      
      // Update in-memory apps state: Firestore snapshot is the authoritative source of record
      setApps(() => {
        try {
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(ACTIVE_CATALOG_STORAGE_KEY, JSON.stringify(freshApps));
          }
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(ACTIVE_CATALOG_STORAGE_KEY, JSON.stringify(freshApps));
          }
        } catch {}
        return freshApps;
      });
      hasLoadedFirstData = true;
      setHasInitialSyncCompleted(true);
      clearTimeout(safetyTimer);
      setIsLoadingApps(false);

      if (count > 0) {
        // Synchronize all banners with live app logos, graphics, and metadata
        setBanners(prevBanners => {
          let changed = false;
          const updated = prevBanners.map(b => {
            const liveApp = b.appId 
              ? freshApps[b.appId] 
              : Object.values(freshApps).find(a => a.name.toLowerCase() === b.appName?.toLowerCase());
            if (!liveApp) return b;
            const nextIcon = liveApp.iconUrl || b.appIcon;
            const nextName = liveApp.name || b.appName;
            const nextDev = liveApp.developer || b.appDeveloper;
            const nextImage = liveApp.featureGraphicUrl || liveApp.heroBannerUrl || b.imageUrl;
            const nextRating = liveApp.rating ?? b.appRating;
            const nextDownloads = liveApp.downloads || b.appDownloads;
            if (
              nextIcon !== b.appIcon ||
              nextName !== b.appName ||
              nextDev !== b.appDeveloper ||
              nextImage !== b.imageUrl ||
              nextRating !== b.appRating ||
              nextDownloads !== b.appDownloads ||
              b.appId !== liveApp.id
            ) {
              changed = true;
              return {
                ...b,
                appId: liveApp.id,
                appIcon: nextIcon,
                appName: nextName,
                appDeveloper: nextDev,
                imageUrl: nextImage,
                appRating: nextRating,
                appDownloads: nextDownloads
              };
            }
            return b;
          });

          if (changed) {
            return updated;
          }
          return prevBanners;
        });
      }
    };

    // Safety timeout: If Firestore listener is slow, attempt fallback to /api/apps before dismissing skeleton
    const safetyTimer = setTimeout(async () => {
      if (!isMounted) return;
      if (!hasLoadedFirstData) {
        try {
          const { ok, data } = await safeFetchJson<{ success: boolean; apps?: any[] }>('/api/apps');
          if (isMounted && ok && data?.success && Array.isArray(data.apps) && data.apps.length > 0) {
            const map: Record<string, AppDetails> = {};
            data.apps.forEach((app: any) => {
              if (app && app.id) {
                map[app.id] = {
                  ...app,
                  downloads: app.downloads || formatDownloadCount(app.downloadsCount || 0)
                };
              }
            });
            syncAppsAndBanners(map);
            return;
          }
        } catch {}
      }
      setHasInitialSyncCompleted(true);
      setIsLoadingApps(false);
    }, 4500);

    // Fast parallel fetch from server-side /api/apps (typically resolves in 20-50ms)
    safeFetchJson<{ success: boolean; apps?: any[] }>('/api/apps').then(({ ok, data }) => {
      if (!isMounted) return;
      if (ok && data?.success && Array.isArray(data.apps) && data.apps.length > 0) {
        const map: Record<string, AppDetails> = {};
        data.apps.forEach((app: any) => {
          if (app && app.id) {
            map[app.id] = {
              ...app,
              downloads: app.downloads || formatDownloadCount(app.downloadsCount || 0)
            };
          }
        });
        syncAppsAndBanners(map);
      }
    }).catch(() => {});

    // Concurrently trigger fetchAllAppsOnce for immediate retrieval on fresh load / cold cache
    fetchAllAppsOnce().then((onceApps) => {
      if (!isMounted) return;
      if (onceApps && Object.keys(onceApps).length > 0 && !hasLoadedFirstData) {
        syncAppsAndBanners(onceApps);
      }
    }).catch(() => {});

    // Primary real-time subscription
    const unsubscribe = listenToAllApps(
      (liveApps) => {
        syncAppsAndBanners(liveApps);
      },
      (err) => {
        if (!isMounted) return;
        console.warn('Live apps subscription notice:', err);
        // If we haven't loaded data yet, try one-time fetch before terminating loading
        fetchAllAppsOnce().then((onceApps) => {
          if (!isMounted) return;
          if (onceApps && Object.keys(onceApps).length > 0) {
            syncAppsAndBanners(onceApps);
          } else {
            clearTimeout(safetyTimer);
            setHasInitialSyncCompleted(true);
            setIsLoadingApps(false);
          }
        }).catch(() => {
          if (isMounted) {
            clearTimeout(safetyTimer);
            setHasInitialSyncCompleted(true);
            setIsLoadingApps(false);
          }
        });
      }
    );

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, []);

  const [banners, setBanners] = useState<HeroBannerConfig[]>(defaultBanners);
  const [sections, setSections] = useState<HomeSectionConfig[]>(defaultSections);

  const saveBanners = (updated: HeroBannerConfig[]) => {
    setBanners(updated);
  };

  const saveSections = (updated: HomeSectionConfig[]) => {
    setSections(updated);
  };

  const updateBanner = (id: string, partial: Partial<HeroBannerConfig>) => {
    setBanners((prev) => prev.map((b) => (b.id === id ? { ...b, ...partial } : b)));
  };

  const addBanner = (newBanner: Omit<HeroBannerConfig, 'id'>): string => {
    const id = 'banner_' + Math.random().toString(36).substring(2, 9);
    const created: HeroBannerConfig = { ...newBanner, id };
    setBanners((prev) => [created, ...prev.filter(b => b.appId !== newBanner.appId)]);
    return id;
  };

  const deleteBanner = (id: string) => {
    setBanners((prev) => {
      const updated = prev.filter((b) => b.id !== id);
      return updated.length > 0 ? updated : defaultBanners;
    });
  };

  const updateSection = (key: string, partial: Partial<HomeSectionConfig>) => {
    const updated = sections.map((s) => (s.key === key ? { ...s, ...partial } : s));
    saveSections(updated);
  };

  const toggleSection = (key: string) => {
    const updated = sections.map((s) => (s.key === key ? { ...s, enabled: !s.enabled } : s));
    saveSections(updated);
  };

  const resetToDefaults = () => {
    saveBanners(defaultBanners);
    saveSections(defaultSections);
  };

  // Publish app to Firestore and optionally feature on spotlight immediately
  const publishApp = async (
    app: AppDetails, 
    featureOnSpotlight = true, 
    spotlightBadge?: string, 
    spotlightHeadline?: string
  ): Promise<void> => {
    const saved = await publishAppToFirestore(app);
    const finalApp = saved || app;

    // Update in-memory reactive state instantly
    setApps(prev => {
      const updated = { ...prev, [finalApp.id]: finalApp };
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(ACTIVE_CATALOG_STORAGE_KEY, JSON.stringify(updated));
        }
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(ACTIVE_CATALOG_STORAGE_KEY, JSON.stringify(updated));
        }
      } catch {}
      return updated;
    });

    // Automatically update or feature published app on spotlight globally ONLY if it has a genuine, dedicated banner (never use icon as banner)
    const rawHeroImage = (app.heroBannerUrl?.trim() || app.featureGraphicUrl?.trim() || '');
    const isIconOrPlaceholder = !rawHeroImage || 
      rawHeroImage === (app.iconUrl || '').trim() || 
      rawHeroImage.includes('/logo.png') || 
      rawHeroImage.includes('/icon.svg') ||
      rawHeroImage.includes('/favicon');
    const heroImage = isIconOrPlaceholder ? '' : rawHeroImage;

    setBanners(prev => {
      let matched = false;
      const updated = prev.map(b => {
        if (b.appId === app.id || (b.appName && b.appName.toLowerCase() === app.name.toLowerCase())) {
          matched = true;
          return {
            ...b,
            appId: app.id,
            titleBadge: spotlightBadge?.trim() || b.titleBadge || app.category || 'Featured Release',
            headline: spotlightHeadline?.trim() || app.tagline?.trim() || b.headline || `Discover ${app.name} on the marketplace.`,
            imageUrl: heroImage || b.imageUrl,
            appName: app.name,
            appDeveloper: app.developer,
            appIcon: app.iconUrl,
            appRating: app.rating ?? b.appRating ?? 0,
            appDownloads: app.downloads || b.appDownloads || '0+',
            isActive: featureOnSpotlight ?? b.isActive
          };
        }
        return b;
      });

      if (!matched && featureOnSpotlight && heroImage) {
        const id = 'banner_' + Math.random().toString(36).substring(2, 9);
        const newBanner: HeroBannerConfig = {
          id,
          appId: app.id,
          titleBadge: spotlightBadge?.trim() || app.category || 'Featured Release',
          headline: spotlightHeadline?.trim() || app.tagline?.trim() || `Discover ${app.name} on the marketplace.`,
          imageUrl: heroImage,
          appName: app.name,
          appDeveloper: app.developer,
          appRating: app.rating ?? 0,
          appIcon: app.iconUrl,
          appDownloads: app.downloads || '0+',
          targetUrl: `/apps/${app.id}`,
          isActive: true,
          displayOrder: prev.length + 1
        };
        return [newBanner, ...updated];
      }

      return updated;
    });
  };

  const updateApp = async (appId: string, partial: Partial<AppDetails>): Promise<void> => {
    await updateAppInFirestore(appId, partial);
    setApps(prev => {
      if (!prev[appId]) return prev;
      return {
        ...prev,
        [appId]: { ...prev[appId], ...partial }
      };
    });

    // Synchronize banners immediately with the updated media, logo, and information
    setBanners(prev => {
      const hasMatching = prev.some(b => b.appId === appId || (partial.name && b.appName?.toLowerCase() === partial.name.toLowerCase()));
      if (!hasMatching) return prev;
      return prev.map(b => {
        if (b.appId !== appId && (!partial.name || b.appName?.toLowerCase() !== partial.name.toLowerCase())) {
          return b;
        }
        return {
          ...b,
          appId,
          ...(partial.name ? { appName: partial.name } : {}),
          ...(partial.developer ? { appDeveloper: partial.developer } : {}),
          ...(partial.iconUrl ? { appIcon: partial.iconUrl } : {}),
          ...(partial.heroBannerUrl || partial.featureGraphicUrl ? { imageUrl: (partial.heroBannerUrl || partial.featureGraphicUrl) } : {}),
          ...(partial.tagline ? { headline: partial.tagline } : {}),
          ...(partial.category ? { titleBadge: partial.category } : {}),
          ...(partial.rating !== undefined ? { appRating: partial.rating } : {}),
          ...(partial.downloads ? { appDownloads: partial.downloads } : {})
        };
      });
    });
  };

  const deleteApp = async (appId: string, userId?: string, userEmail?: string): Promise<void> => {
    await deleteAppFromFirestore(appId, userId, userEmail);
    setApps(prev => {
      const next = { ...prev };
      delete next[appId];
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(ACTIVE_CATALOG_STORAGE_KEY, JSON.stringify(next));
        }
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(ACTIVE_CATALOG_STORAGE_KEY, JSON.stringify(next));
        }
      } catch {}
      return next;
    });

    // Clean up from appDetailsMock and active draft sessions
    delete appDetailsMock[appId];
    try {
      localStorage.removeItem(`prople_draft_update_app_${appId}`);
      const activeSessionRaw = localStorage.getItem('prople_publish_form_session');
      if (activeSessionRaw) {
        const parsed = JSON.parse(activeSessionRaw);
        if (parsed?.appId === appId) {
          localStorage.removeItem('prople_publish_form_session');
          localStorage.removeItem('prople_publish_form_open');
        }
      }
    } catch {}

    // Remove banner if exists
    const matchingBanner = banners.find(b => b.appId === appId);
    if (matchingBanner) {
      deleteBanner(matchingBanner.id);
    }
  };

  const appsList = useMemo(() => Object.values(apps), [apps]);

  // Complete unfiltered catalog with moderation status flags
  const rawAllAppListings: AppListing[] = useMemo(() => {
    return appsList.map(app => {
      const isBanned = AdminModerationService.isAppBanned(app.id);
      const isPrivate = AdminModerationService.isAppPrivate(app.id);
      const pubName = app.publisherName || app.developer;
      const isPubBlocked = Boolean(pubName && AdminModerationService.isPublisherBlocked(pubName));
      const isPubRestricted = Boolean(pubName && AdminModerationService.isPublisherRestricted(pubName));
      const banCheck = AdminModerationService.isAppBlockedOrSuspended(app);

      return {
        id: app.id,
        name: app.name,
        developer: app.developer,
        category: app.category,
        rating: app.rating,
        ratingsCount: app.ratingsCount,
        size: getUnifiedAppSize(app),
        downloads: app.downloads,
        downloadsCount: app.downloadsCount,
        price: app.price,
        iconUrl: app.iconUrl,
        featureGraphicUrl: app.featureGraphicUrl,
        detailsBannerUrl: app.detailsBannerUrl,
        heroBannerUrl: app.heroBannerUrl,
        isVerified: true,
        containsAds: app.containsAds,
        contentRating: app.contentRating,
        type: app.type,
        url: app.url,
        githubRepo: app.githubRepo,
        githubReleaseUrl: app.githubReleaseUrl,
        downloadUrl: app.downloadUrl || (app as any).primaryApk?.downloadUrl || (app as any).releaseAsset?.downloadUrl,
        releaseTag: app.releaseTag,
        versionName: app.versionName,
        assetName: app.assetName || (app as any).primaryApk?.name || (app as any).releaseAsset?.name,
        primaryApk: (app as any).primaryApk,
        releaseAsset: (app as any).releaseAsset,
        sha256: app.sha256,
        releaseNotes: app.releaseNotes,
        screenshots: app.screenshots || [],
        tabletScreenshots: app.tabletScreenshots || [],
        promoVideoUrl: app.promoVideoUrl || '',
        videoThumbnailUrl: app.videoThumbnailUrl || '',
        tagline: app.tagline || '',
        aboutText: app.aboutText || app.description || '',
        featuredImageUrl: app.featureGraphicUrl || app.heroBannerUrl || '',
        featuredTitle: app.tagline || app.name,
        featuredSubtitle: app.developer,
        publisherName: app.publisherName || app.developerInfo?.publisherName,
        publisherEmail: app.publisherEmail || (app as any).ownerEmail || app.developerEmail,
        publishedBy: app.publishedBy || app.developerInfo?.publisherName,
        creatorUid: app.creatorUid || (app as any).owner || app.developerId,
        owner: (app as any).owner || app.creatorUid || app.developerId,
        developerId: app.developerId || app.creatorUid || (app as any).owner,
        developerEmail: app.developerEmail || app.publisherEmail || (app as any).ownerEmail,
        githubRepoOwner: app.githubRepoOwner || app.developerInfo?.githubRepoOwner,
        developerInfo: app.developerInfo,
        tags: app.tags || [],
        platform: app.platform,
        targetOs: app.targetOs,
        packageFormat: app.packageFormat,
        minAndroid: app.minAndroid,
        minWindows: app.minWindows,
        minLinux: app.minLinux,
        inAppPurchases: app.inAppPurchases,
        interactiveElements: app.interactiveElements || [],
        supportedArchitectures: app.supportedArchitectures || [],
        minRam: app.minRam || '',
        permissions: (app as any).permissions || (app.dataSafety as any)?.permissions || [],
        securityPractices: (app as any).securityPractices || (app.dataSafety as any)?.securityPractices || [],
        dataSafety: app.dataSafety,
        keystoreFingerprint: app.keystoreFingerprint,
        keystoreAlias: app.keystoreAlias,
        // Enforcement state flags
        isBanned: Boolean(isBanned || banCheck.isBlocked),
        isPrivate: Boolean(isPrivate),
        isPublisherBlocked: Boolean(isPubBlocked),
        isPublisherRestricted: Boolean(isPubRestricted),
        moderationReason: banCheck.reason
      };
    });
  }, [appsList, moderationVersion]);

  // Public-facing storefront catalogue: strictly excludes banned apps, blocked publishers, and private apps
  const allAppListings: AppListing[] = useMemo(() => {
    return rawAllAppListings.filter(app => !app.isBanned && !app.isPrivate && !app.isPublisherBlocked);
  }, [rawAllAppListings]);

  // Keep RecommendationService synchronized with live marketplace catalog
  useEffect(() => {
    if (allAppListings.length > 0) {
      RecommendationService.setGlobalAppsCatalog(allAppListings);
    }
  }, [allAppListings]);

  const activeBanners = useMemo(() => {
    // If the public catalogue has no active apps, do not show any app banners
    if (allAppListings.length === 0) return [];

    return banners.filter((b) => {
      if (!b.isActive) return false;
      if (b.appId) {
        if (AdminModerationService.isAppPrivate(b.appId) || AdminModerationService.isAppBanned(b.appId)) {
          return false;
        }
        const matching = rawAllAppListings.find(a => a.id === b.appId);
        if (matching && (matching.isBanned || matching.isPrivate || matching.isPublisherBlocked)) {
          return false;
        }
        // App must exist in the public-facing storefront catalogue
        if (!allAppListings.some(a => a.id === b.appId)) {
          return false;
        }
      }
      if (b.appName) {
        const matchingByName = rawAllAppListings.find(a => a.name.toLowerCase() === b.appName.toLowerCase());
        if (matchingByName && (matchingByName.isBanned || matchingByName.isPrivate || matchingByName.isPublisherBlocked)) {
          return false;
        }
        if (!allAppListings.some(a => a.name.toLowerCase() === b.appName.toLowerCase())) {
          return false;
        }
      }
      return true;
    });
  }, [banners, rawAllAppListings, allAppListings]);

  const refreshCatalogue = async (): Promise<void> => {
    setIsPullRefreshing(true);
    setIsLoadingApps(true);
    try {
      try {
        window.dispatchEvent(new CustomEvent('app:refresh'));
        window.dispatchEvent(new CustomEvent('store:refresh'));
      } catch {}

      clearAllSectionScrolls();

      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem(ACTIVE_CATALOG_STORAGE_KEY);
        }
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(ACTIVE_CATALOG_STORAGE_KEY);
        }
      } catch {}

      const [freshApps] = await Promise.all([
        fetchAllAppsOnce(),
        new Promise((resolve) => setTimeout(resolve, 850))
      ]);

      if (freshApps && typeof freshApps === 'object') {
        setApps(freshApps);
        try {
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(ACTIVE_CATALOG_STORAGE_KEY, JSON.stringify(freshApps));
          }
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(ACTIVE_CATALOG_STORAGE_KEY, JSON.stringify(freshApps));
          }
        } catch {}
      }
    } catch (err) {
      console.warn('Catalogue refresh error:', err);
    } finally {
      setIsLoadingApps(false);
      setIsPullRefreshing(false);
    }
  };

  return (
    <StoreConfigContext.Provider
      value={{
        banners,
        activeBanners,
        updateBanner,
        addBanner,
        deleteBanner,
        sections,
        updateSection,
        toggleSection,
        resetToDefaults,
        apps,
        appsList,
        allAppListings,
        rawAllAppListings,
        publishApp,
        updateApp,
        deleteApp,
        removeApp: deleteApp,
        isLoadingApps,
        hasInitialSyncCompleted,
        isPullRefreshing,
        refreshCatalogue,
      }}
    >
      {children}
    </StoreConfigContext.Provider>
  );
}

export function useStoreConfig() {
  const context = useContext(StoreConfigContext);
  if (!context) {
    throw new Error('useStoreConfig must be used within a StoreConfigProvider');
  }
  return context;
}
