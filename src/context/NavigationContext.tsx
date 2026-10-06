import React, { 
  createContext, 
  useContext, 
  useState, 
  useEffect, 
  useRef, 
  useCallback, 
  ReactNode 
} from 'react';
import { slugifyAppName } from '../utils/shareUtils';
import { RecommendationService } from '../services/recommendationService';

export type MainTab = 'games' | 'apps' | 'search' | 'you' | 'books';

export type OverlayType = 
  | 'none' 
  | 'search' 
  | 'notifications' 
  | 'similar-apps' 
  | 'recommended-apps' 
  | 'must-try-apps' 
  | 'latest-releases'
  | 'top-rated-apps'
  | 'bookmarked-apps'
  | 'wishlist'
  | 'search-results'
  | 'privacy'
  | 'terms'
  | 'data-safety'
  | 'data-deletion'
  | 'security'
  | 'about'
  | 'contact'
  | 'publisher-console'
  | 'auth'
  | 'anti-piracy'
  | 'user-consent'
  | 'how-it-works';

export type AppDetailSubView = 'none' | 'about' | 'data-safety' | 'reviews' | 'write-review' | 'permissions';

export type YouSubView = 
  | 'main' 
  | 'notifications' 
  | 'settings' 
  | 'help' 
  | 'studio' 
  | 'ratings-and-reviews' 
  | 'auth' 
  | 'privacy' 
  | 'terms'
  | 'security'
  | 'admin-panel'
  | 'bookmarked-apps'
  | 'wishlist'
  | 'edit-profile'
  | 'how-it-works'
  | 'anti-piracy'
  | 'user-consent';

export interface NavigationState {
  activeTab: MainTab;
  activeSubTab: string;
  overlay: OverlayType;
  activeAppDetailsId: string | null;
  detailView: AppDetailSubView;
  searchQuery: string;
  startWithVoice: boolean;
  youView: YouSubView;
  selectedCategory: string | null;
  writeReviewRating?: number;
  targetReviewId?: string | null;
  activePublisherName?: string | null;
  authMode?: 'signin' | 'signup';
}

export function getInitialNavigationState(): NavigationState {
  try {
    const rawPath = (window.location.pathname || '').toLowerCase().replace(/\/$/, '');
    const searchParams = new URLSearchParams(window.location.search);
    const appId = searchParams.get('app') || searchParams.get('id') || searchParams.get('download');
    const query = searchParams.get('q') || searchParams.get('search');
    const tab = searchParams.get('tab');
    
    // Direct path-based route checking
    if (rawPath === '/privacy' || rawPath === '/privacy-policy') {
      return {
        ...initialNavigationState,
        overlay: 'privacy',
      };
    }

    if (rawPath === '/terms' || rawPath === '/terms-and-conditions' || rawPath === '/terms-of-service' || rawPath === '/tos') {
      return {
        ...initialNavigationState,
        overlay: 'terms',
      };
    }

    if (rawPath === '/anti-piracy' || rawPath === '/dmca' || rawPath === '/anti-piracy-policy' || rawPath === '/copyright') {
      return {
        ...initialNavigationState,
        overlay: 'anti-piracy',
        activeTab: 'you',
        youView: 'anti-piracy',
      };
    }

    if (rawPath === '/user-consent' || rawPath === '/consent' || rawPath === '/data-policy' || rawPath === '/data-collection' || rawPath === '/consent-policy') {
      return {
        ...initialNavigationState,
        overlay: 'user-consent',
        activeTab: 'you',
        youView: 'user-consent',
      };
    }

    if (rawPath === '/data-safety') {
      return {
        ...initialNavigationState,
        overlay: 'data-safety',
      };
    }

    if (rawPath === '/security' || rawPath === '/apps-security' || rawPath === '/apps-and-security' || rawPath === '/security-policy' || rawPath === '/transparency') {
      return {
        ...initialNavigationState,
        overlay: 'security',
      };
    }

    if (rawPath === '/data-deletion' || rawPath === '/user-data-deletion') {
      return {
        ...initialNavigationState,
        overlay: 'privacy',
      };
    }

    if (rawPath === '/about' || rawPath === '/about-us') {
      return {
        ...initialNavigationState,
        overlay: 'about',
      };
    }

    if (
      rawPath === '/studio' ||
      rawPath === '/publish' ||
      rawPath === '/console' ||
      rawPath === '/developer-console' ||
      searchParams.get('publish') === 'true' ||
      searchParams.get('view') === 'studio' ||
      searchParams.get('view') === 'publish' ||
      (typeof window !== 'undefined' && localStorage.getItem('prople_publish_form_open') === 'true')
    ) {
      return {
        ...initialNavigationState,
        activeTab: 'you',
        youView: 'studio',
      };
    }

    if (rawPath === '/contact' || rawPath === '/support' || rawPath === '/help') {
      return {
        ...initialNavigationState,
        activeTab: 'you',
        youView: 'help',
      };
    }

    if (rawPath === '/auth' || rawPath === '/login' || rawPath === '/signin' || searchParams.get('auth') || searchParams.get('mode') === 'reset-password') {
      return {
        ...initialNavigationState,
        overlay: 'auth',
      };
    }

    const cleanPath = (rawPath || '/').replace(/\/+$/, '') || '/';
    const PLATFORM_KEYS = new Set(['android', 'windows', 'linux', 'mac', 'apple', 'ios', 'web', 'all']);

    // 1. Direct App Path: /apps/:slug, /app/:slug, /apps/:slug/download
    const appPathMatch = cleanPath.match(/^\/(?:apps|app)\/([^\/]+)(?:\/download)?$/);
    if (appPathMatch && appPathMatch[1]) {
      const slugOrId = decodeURIComponent(appPathMatch[1]);
      if (!PLATFORM_KEYS.has(slugOrId.toLowerCase())) {
        const initialHydratedApp = typeof window !== 'undefined' ? (window as any).__INITIAL_APP__ : null;
        const initialId = initialHydratedApp?.id || null;
        return {
          ...initialNavigationState,
          activeAppDetailsId: initialId || slugOrId,
        };
      }
    }

    // 2. Category Path: /categories/:slug, /category/:slug
    const catPathMatch = cleanPath.match(/^\/(?:categories|category)\/([^\/]+)$/);
    if (catPathMatch && catPathMatch[1]) {
      const catSlug = decodeURIComponent(catPathMatch[1]);
      return {
        ...initialNavigationState,
        activeTab: 'apps',
        activeSubTab: 'Categories',
        selectedCategory: catSlug,
      };
    }

    // 3. Developer Profile Path: /developers/:slug, /developer/:slug -> direct pub: search
    const devPathMatch = cleanPath.match(/^\/(?:developers|developer)\/([^\/]+)$/);
    if (devPathMatch && devPathMatch[1]) {
      const devSlug = decodeURIComponent(devPathMatch[1]);
      return {
        ...initialNavigationState,
        overlay: 'search-results',
        searchQuery: `pub:${devSlug}`,
        activePublisherName: devSlug,
      };
    }

    // 4. Platform Catalog Routes: /platforms/:platform, /platform/:platform, /apps/:platform, /apps
    const platformMatch = cleanPath.match(/^\/(?:platforms|platform|apps)(?:\/(android|windows|linux|mac|apple|ios|web))?$/);
    if (platformMatch) {
      const plat = platformMatch[1];
      const subTabTitle = plat ? (plat.charAt(0).toUpperCase() + plat.slice(1)) : 'For you';
      return {
        ...initialNavigationState,
        activeTab: 'apps',
        activeSubTab: subTabTitle,
      };
    }

    // 5. Legacy download route fallback: /download/:id
    const legacyDownloadMatch = cleanPath.match(/^\/downloads?\/([^\/]+)$/);
    if (legacyDownloadMatch && legacyDownloadMatch[1]) {
      return {
        ...initialNavigationState,
        activeAppDetailsId: decodeURIComponent(legacyDownloadMatch[1]),
      };
    }

    // Tab routes
    if (rawPath === '/games') {
      return {
        ...initialNavigationState,
        activeTab: 'games',
      };
    }

    if (rawPath === '/search' || rawPath === '/explore') {
      return {
        ...initialNavigationState,
        activeTab: 'search',
        overlay: query ? 'search-results' : 'none',
        searchQuery: query || '',
      };
    }

    if (rawPath === '/you' || rawPath === '/account' || rawPath === '/profile') {
      return {
        ...initialNavigationState,
        activeTab: 'you',
      };
    }

    if (rawPath === '/notifications') {
      return {
        ...initialNavigationState,
        overlay: 'notifications',
      };
    }

    if (rawPath === '/wishlist' || rawPath === '/bookmarks' || rawPath === '/bookmarked-apps') {
      return {
        ...initialNavigationState,
        overlay: 'wishlist',
      };
    }

    // Query parameters fallback
    if (appId) {
      const reviewId = searchParams.get('review');
      return {
        ...initialNavigationState,
        activeAppDetailsId: appId,
        detailView: reviewId ? 'reviews' : 'none',
        targetReviewId: reviewId || null,
      };
    }
    
    if (query) {
      return {
        ...initialNavigationState,
        overlay: 'search-results',
        searchQuery: query,
      };
    }

    if (tab === 'games' || tab === 'apps' || tab === 'search' || tab === 'you' || tab === 'books') {
      return {
        ...initialNavigationState,
        activeTab: tab as MainTab,
      };
    }
  } catch {
    // Sandboxed environment fallback
  }

  return initialNavigationState;
}

export const initialNavigationState: NavigationState = {
  activeTab: 'apps',
  activeSubTab: 'For you',
  overlay: 'none',
  activeAppDetailsId: null,
  detailView: 'none',
  searchQuery: '',
  startWithVoice: false,
  youView: 'main',
  selectedCategory: null,
  writeReviewRating: 0,
  targetReviewId: null,
  activePublisherName: null,
};

export interface NavigationContextType extends NavigationState {
  canGoBack: boolean;
  historyDepth: number;
  goBack: () => boolean;
  registerBackHandler: (handler: () => boolean) => () => void;
  
  changeTab: (tab: MainTab) => void;
  changeSubTab: (subTab: string) => void;
  
  openSearch: (startWithVoice?: boolean) => void;
  performSearch: (query: string) => void;
  closeSearch: () => void;
  
  openNotifications: () => void;
  closeNotifications: () => void;
  
  openSimilarApps: () => void;
  openRecommendedApps: () => void;
  openMustTryApps: () => void;
  openLatestReleases: () => void;
  openTopRatedApps: () => void;
  openBookmarkedApps: () => void;
  openWishlist: () => void;
  openPublisherConsole: (publisherName: string) => void;
  closeOverlay: () => void;
  
  openAppDetail: (appId: string) => void;
  closeAppDetail: () => void;
  openDetailSubView: (view: AppDetailSubView, rating?: number) => void;
  closeDetailSubView: () => void;
  openAppReviews: (appId: string, reviewId?: string) => void;
  clearTargetReviewId: () => void;
  
  openPrivacyPolicy: () => void;
  openTermsOfService: () => void;
  openDataSafety: () => void;
  openDataDeletion: () => void;
  openAppsSecurity: () => void;
  openAboutStore: () => void;
  openHowItWorks: () => void;
  openAntiPiracy: () => void;
  openUserConsentPolicy: () => void;
  openContactSupport: () => void;
  openAuthPage: (mode?: 'signin' | 'signup') => void;
  authMode?: 'signin' | 'signup';

  setYouView: (view: YouSubView) => void;
  setSelectedCategory: (category: string | null) => void;
  
  pushStep: (partial: Partial<NavigationState>) => void;
  resetToHome: () => void;

  previewPopup: 'dev-donation' | null;
  setPreviewPopup: (popup: 'dev-donation' | null) => void;
  showActivePopupUI: boolean;
  setShowActivePopupUI: (show: boolean) => void;
  toggleActivePopupUI: () => void;
  resetPopupTriggers: () => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

function statesAreEqual(a: NavigationState, b: NavigationState): boolean {
  return (
    a.activeTab === b.activeTab &&
    a.activeSubTab === b.activeSubTab &&
    a.overlay === b.overlay &&
    (a.authMode || 'signin') === (b.authMode || 'signin') &&
    a.activeAppDetailsId === b.activeAppDetailsId &&
    a.detailView === b.detailView &&
    a.searchQuery === b.searchQuery &&
    a.startWithVoice === b.startWithVoice &&
    a.youView === b.youView &&
    a.selectedCategory === b.selectedCategory &&
    (a.writeReviewRating || 0) === (b.writeReviewRating || 0) &&
    (a.targetReviewId || null) === (b.targetReviewId || null) &&
    (a.activePublisherName || null) === (b.activePublisherName || null)
  );
}

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<NavigationState>(getInitialNavigationState);
  const stackRef = useRef<NavigationState[]>([getInitialNavigationState()]);
  const isNavigatingBackRef = useRef(false);

  // Initialize browser history entry if none exists
  useEffect(() => {
    try {
      const initialState = getInitialNavigationState();
      if (!window.history.state || window.history.state.appmarketStepIndex === undefined) {
        window.history.replaceState(
          { appmarketStepIndex: 0, state: initialState },
          ''
        );
      }
    } catch {
      // Safe fallback if history API is restricted in sandboxed iframe
    }
  }, []);

  // Sync canonical URL pathname and search parameters with state
  useEffect(() => {
    try {
      let targetPath = '/';
      const searchParams = new URLSearchParams();

      if (current.overlay === 'auth') {
        targetPath = current.authMode === 'signup' ? '/auth?mode=signup' : '/auth';
      } else if (current.overlay === 'privacy') {
        targetPath = '/privacy';
      } else if (current.overlay === 'terms') {
        targetPath = '/terms';
      } else if (current.overlay === 'anti-piracy' || current.youView === 'anti-piracy') {
        targetPath = '/anti-piracy';
      } else if (current.overlay === 'user-consent' || current.youView === 'user-consent') {
        targetPath = '/user-consent';
      } else if (current.overlay === 'data-safety') {
        targetPath = '/data-safety';
      } else if (current.overlay === 'data-deletion') {
        targetPath = '/data-deletion';
      } else if (current.overlay === 'about') {
        targetPath = '/about';
      } else if (current.overlay === 'contact') {
        targetPath = '/contact';
      } else if (current.activeAppDetailsId) {
        // Individual App Canonical Route: /apps/[slug]
        const matchingApp = RecommendationService.getAppById(current.activeAppDetailsId);
        const slug = matchingApp ? slugifyAppName(matchingApp.name) : '';
        const canonicalSlug = slug || current.activeAppDetailsId;
        targetPath = `/apps/${encodeURIComponent(canonicalSlug)}`;
      } else if (current.overlay === 'publisher-console' || current.activePublisherName) {
        // Developer Profile: /developers/[slug]
        targetPath = `/developers/${encodeURIComponent(slugifyAppName(current.activePublisherName || 'developer'))}`;
      } else if (current.selectedCategory) {
        // Category Route: /categories/[slug]
        targetPath = `/categories/${encodeURIComponent(slugifyAppName(current.selectedCategory))}`;
      } else if (current.overlay === 'search-results') {
        targetPath = '/search';
        if (current.searchQuery) {
          searchParams.set('q', current.searchQuery);
        }
      } else if (current.overlay === 'search') {
        targetPath = '/search';
      } else if (current.overlay === 'notifications') {
        targetPath = '/notifications';
      } else if (current.overlay === 'wishlist' || current.overlay === 'bookmarked-apps' || current.youView === 'bookmarked-apps' || current.youView === 'wishlist') {
        targetPath = '/wishlist';
      } else if (current.activeTab === 'apps') {
        const sub = current.activeSubTab;
        if (sub === 'Android') targetPath = '/platforms/android';
        else if (sub === 'Windows') targetPath = '/platforms/windows';
        else if (sub === 'Linux') targetPath = '/platforms/linux';
        else if (sub === 'Mac') targetPath = '/platforms/mac';
        else if (sub === 'Top charts') targetPath = '/apps';
        else targetPath = '/';
      } else if (current.activeTab === 'games') {
        targetPath = '/games';
      } else if (current.activeTab === 'search') {
        targetPath = '/search';
      } else if (current.activeTab === 'you') {
        if (current.youView === 'studio') {
          targetPath = '/studio';
        } else {
          targetPath = '/you';
        }
      }

      const queryString = searchParams.toString();
      const finalUrl = targetPath + (queryString ? `?${queryString}` : '');
      const currentUrl = (window.location.pathname || '') + (window.location.search || '');

      if (currentUrl !== finalUrl) {
        window.history.replaceState(window.history.state, '', finalUrl);
      }
    } catch {}

    // Automatically stop and reset all playing app preview videos when page, tab, subtab, or overlay changes
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('prople:stop:all:videos'));
      }
    } catch {}
  }, [
    current.overlay,
    current.activeAppDetailsId,
    current.activeTab,
    current.activeSubTab,
    current.selectedCategory,
    current.activePublisherName,
    current.searchQuery,
    current.youView,
    current.detailView,
    current.authMode
  ]);

  // Registered back handlers stack (LIFO) for modals and forms (e.g. publishing form confirmation)
  const backHandlersRef = useRef<(() => boolean)[]>([]);
  const currentRef = useRef(current);
  currentRef.current = current;

  const registerBackHandler = useCallback((handler: () => boolean) => {
    backHandlersRef.current.push(handler);
    return () => {
      backHandlersRef.current = backHandlersRef.current.filter(h => h !== handler);
    };
  }, []);

  // Synchronize with standard browser history popstate (Browser Back/Forward buttons & Android back gesture)
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      // Check if any registered subcomponent back handler wants to intercept (e.g. active publishing form)
      if (backHandlersRef.current.length > 0) {
        const lastHandler = backHandlersRef.current[backHandlersRef.current.length - 1];
        const intercepted = lastHandler();
        if (intercepted) {
          try {
            window.history.pushState(
              { appmarketStepIndex: stackRef.current.length - 1, state: currentRef.current },
              ''
            );
          } catch {}
          return;
        }
      }

      isNavigatingBackRef.current = true;
      if (event.state && event.state.state) {
        const targetState = event.state.state as NavigationState;
        const targetIndex = event.state.appmarketStepIndex;
        if (typeof targetIndex === 'number' && targetIndex >= 0 && targetIndex < stackRef.current.length) {
          stackRef.current = stackRef.current.slice(0, targetIndex + 1);
        } else if (stackRef.current.length > 1) {
          stackRef.current.pop();
        }
        setCurrent(targetState);
      } else {
        // Fallback pop from local stack
        if (stackRef.current.length > 1) {
          stackRef.current.pop();
          const prev = stackRef.current[stackRef.current.length - 1];
          setCurrent(prev);
        } else {
          setCurrent(initialNavigationState);
          stackRef.current = [initialNavigationState];
        }
      }
      setTimeout(() => {
        isNavigatingBackRef.current = false;
      }, 50);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Push forward step in stack and sync with browser history
  const pushStep = useCallback((partial: Partial<NavigationState>) => {
    setCurrent(prev => {
      const nextState: NavigationState = {
        ...prev,
        ...partial,
      };

      // Deduplicate consecutive identical states
      if (statesAreEqual(prev, nextState)) {
        return prev;
      }

      const nextStack = [...stackRef.current, nextState];
      stackRef.current = nextStack;

      try {
        window.history.pushState(
          { appmarketStepIndex: nextStack.length - 1, state: nextState },
          ''
        );
      } catch {}

      return nextState;
    });
  }, []);

  // Standard step-by-step back navigation
  const goBack = useCallback((): boolean => {
    if (backHandlersRef.current.length > 0) {
      const lastHandler = backHandlersRef.current[backHandlersRef.current.length - 1];
      const intercepted = lastHandler();
      if (intercepted) {
        return true;
      }
    }

    if (stackRef.current.length > 1) {
      // Pop the top step
      stackRef.current.pop();
      const prev = stackRef.current[stackRef.current.length - 1];
      setCurrent(prev);

      try {
        window.history.back();
      } catch {}

      return true;
    }

    // Step-by-step hierarchical unwinding even if stack was shallow (e.g. refreshed on a deep view)
    if (current.detailView !== 'none') {
      setCurrent(prev => {
        const next = { ...prev, detailView: 'none' as AppDetailSubView };
        stackRef.current = [next];
        return next;
      });
      return true;
    }

    if (current.activeAppDetailsId !== null) {
      setCurrent(prev => {
        const next = { ...prev, activeAppDetailsId: null };
        stackRef.current = [next];
        return next;
      });
      return true;
    }

    if (current.selectedCategory !== null) {
      setCurrent(prev => {
        const next = { ...prev, selectedCategory: null };
        stackRef.current = [next];
        return next;
      });
      return true;
    }

    if (current.overlay !== 'none') {
      setCurrent(prev => {
        const next = { ...prev, overlay: 'none' as OverlayType, activePublisherName: null };
        stackRef.current = [next];
        return next;
      });
      return true;
    }

    if (current.youView !== 'main') {
      setCurrent(prev => {
        const nextYouView: YouSubView = prev.youView === 'edit-profile' ? 'settings' : 'main';
        const next = { ...prev, youView: nextYouView };
        stackRef.current = [next];
        return next;
      });
      return true;
    }

    if (current.activeSubTab !== 'For you') {
      setCurrent(prev => {
        const next = { ...prev, activeSubTab: 'For you' };
        stackRef.current = [next];
        return next;
      });
      return true;
    }

    if (current.activeTab !== 'apps') {
      setCurrent(prev => {
        const next = { ...prev, activeTab: 'apps' as MainTab, activeSubTab: 'For you' };
        stackRef.current = [next];
        return next;
      });
      return true;
    }

    return false;
  }, [current]);

  // Keyboard shortcut: Escape key triggers standard back
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const target = e.target as HTMLElement | null;
        // Do not intercept Escape if typing in an input or textarea unless it is already handled
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
          target.blur();
          return;
        }

        const isRoot = 
          stackRef.current.length <= 1 &&
          current.activeTab === 'apps' &&
          current.activeSubTab === 'For you' &&
          current.overlay === 'none' &&
          current.activeAppDetailsId === null &&
          current.detailView === 'none' &&
          current.youView === 'main' &&
          current.selectedCategory === null;

        if (!isRoot) {
          e.preventDefault();
          goBack();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goBack, current]);

  const isRootState = 
    stackRef.current.length <= 1 &&
    current.activeTab === 'apps' &&
    current.activeSubTab === 'For you' &&
    current.overlay === 'none' &&
    current.activeAppDetailsId === null &&
    current.detailView === 'none' &&
    current.youView === 'main' &&
    current.selectedCategory === null;

  const canGoBack = !isRootState;

  // Granular helper navigation actions
  const changeTab = useCallback((tab: MainTab) => {
    pushStep({
      activeTab: tab,
      activeAppDetailsId: null,
      overlay: 'none',
      detailView: 'none',
      selectedCategory: null,
      activePublisherName: null,
      // If switching to apps or games, default subtab to For you if none
      activeSubTab: (tab === 'apps' || tab === 'games') ? current.activeSubTab || 'For you' : current.activeSubTab,
      youView: tab === 'you' ? current.youView || 'main' : 'main',
    });
  }, [pushStep, current.activeSubTab, current.youView]);

  const changeSubTab = useCallback((subTab: string) => {
    pushStep({
      activeSubTab: subTab,
      selectedCategory: null,
      overlay: 'none',
      activeAppDetailsId: null,
      detailView: 'none',
      activePublisherName: null,
    });
  }, [pushStep]);

  const openSearch = useCallback((startWithVoice?: boolean) => {
    pushStep({
      overlay: 'search',
      startWithVoice: Boolean(startWithVoice),
      activeAppDetailsId: null,
      detailView: 'none',
      activePublisherName: null,
    });
  }, [pushStep]);

  const performSearch = useCallback((query: string) => {
    const normalizedQuery = query.startsWith('publisher:')
      ? `pub:${query.slice('publisher:'.length).trim()}`
      : query;
    pushStep({
      overlay: 'search-results',
      searchQuery: normalizedQuery,
      startWithVoice: false,
      activeAppDetailsId: null,
      detailView: 'none',
      activePublisherName: null,
    });
  }, [pushStep]);

  const closeSearch = useCallback(() => {
    goBack();
  }, [goBack]);

  const openNotifications = useCallback(() => {
    pushStep({
      overlay: 'notifications',
      activeAppDetailsId: null,
      detailView: 'none',
      activePublisherName: null,
    });
  }, [pushStep]);

  const closeNotifications = useCallback(() => {
    goBack();
  }, [goBack]);

  const openSimilarApps = useCallback(() => {
    pushStep({
      overlay: 'similar-apps',
      detailView: 'none',
    });
  }, [pushStep]);

  const openRecommendedApps = useCallback(() => {
    pushStep({
      overlay: 'recommended-apps',
      activeAppDetailsId: null,
      detailView: 'none',
      activePublisherName: null,
    });
  }, [pushStep]);

  const openMustTryApps = useCallback(() => {
    pushStep({
      overlay: 'must-try-apps',
      activeAppDetailsId: null,
      detailView: 'none',
      activePublisherName: null,
    });
  }, [pushStep]);

  const openLatestReleases = useCallback(() => {
    pushStep({
      overlay: 'latest-releases',
      activeAppDetailsId: null,
      detailView: 'none',
      activePublisherName: null,
    });
  }, [pushStep]);

  const openTopRatedApps = useCallback(() => {
    pushStep({
      overlay: 'top-rated-apps',
      activeAppDetailsId: null,
      detailView: 'none',
      activePublisherName: null,
    });
  }, [pushStep]);

  const openWishlist = useCallback(() => {
    pushStep({
      overlay: 'wishlist',
      detailView: 'none',
      activeAppDetailsId: null,
      activePublisherName: null,
    });
  }, [pushStep]);

  const openBookmarkedApps = openWishlist;

  const openPublisherConsole = useCallback((publisherName: string) => {
    const cleanPub = (publisherName || '').trim();
    if (cleanPub) {
      performSearch(`pub:${cleanPub}`);
    } else {
      performSearch('pub:');
    }
  }, [performSearch]);

  const closeOverlay = useCallback(() => {
    goBack();
  }, [goBack]);

  const openAppDetail = useCallback((appId: string) => {
    pushStep({
      activeAppDetailsId: appId,
      overlay: 'none',
      detailView: 'none',
    });
  }, [pushStep]);

  const closeAppDetail = useCallback(() => {
    goBack();
  }, [goBack]);

  const openPrivacyPolicy = useCallback(() => {
    pushStep({
      overlay: 'privacy',
      activeAppDetailsId: null,
      detailView: 'none',
      activePublisherName: null,
    });
  }, [pushStep]);

  const openTermsOfService = useCallback(() => {
    pushStep({
      overlay: 'terms',
      activeAppDetailsId: null,
      detailView: 'none',
      activePublisherName: null,
    });
  }, [pushStep]);

  const openDataSafety = useCallback(() => {
    pushStep({
      overlay: 'data-safety',
      activeAppDetailsId: null,
      detailView: 'none',
      activePublisherName: null,
    });
  }, [pushStep]);

  const openDataDeletion = useCallback(() => {
    pushStep({
      overlay: 'privacy',
      activeAppDetailsId: null,
      detailView: 'none',
      activePublisherName: null,
    });
  }, [pushStep]);

  const openAppsSecurity = useCallback(() => {
    pushStep({
      overlay: 'security',
      youView: 'security',
      activeAppDetailsId: null,
      detailView: 'none',
      activePublisherName: null,
    });
  }, [pushStep]);

  const openAboutStore = useCallback(() => {
    pushStep({
      overlay: 'about',
      activeAppDetailsId: null,
      detailView: 'none',
      activePublisherName: null,
    });
  }, [pushStep]);

  const openHowItWorks = useCallback(() => {
    pushStep({
      overlay: 'how-it-works',
      activeTab: 'you',
      youView: 'how-it-works',
      activeAppDetailsId: null,
      detailView: 'none',
      activePublisherName: null,
    });
  }, [pushStep]);

  const openAntiPiracy = useCallback(() => {
    pushStep({
      overlay: 'anti-piracy',
      activeTab: 'you',
      youView: 'anti-piracy',
      activeAppDetailsId: null,
      detailView: 'none',
      activePublisherName: null,
    });
  }, [pushStep]);

  const openUserConsentPolicy = useCallback(() => {
    pushStep({
      overlay: 'user-consent',
      activeTab: 'you',
      youView: 'user-consent',
      activeAppDetailsId: null,
      detailView: 'none',
      activePublisherName: null,
    });
  }, [pushStep]);

  const openContactSupport = useCallback(() => {
    pushStep({
      activeTab: 'you',
      youView: 'help',
      overlay: 'none',
      activeAppDetailsId: null,
      detailView: 'none',
      activePublisherName: null,
    });
  }, [pushStep]);

  const openAuthPage = useCallback((mode: 'signin' | 'signup' = 'signin') => {
    pushStep({
      overlay: 'auth',
      authMode: mode,
      activeAppDetailsId: null,
      detailView: 'none',
      activePublisherName: null,
    });
  }, [pushStep]);

  const openDetailSubView = useCallback((view: AppDetailSubView, rating?: number) => {
    pushStep({
      detailView: view,
      writeReviewRating: rating !== undefined ? rating : current.writeReviewRating,
      targetReviewId: null,
    });
  }, [pushStep, current.writeReviewRating]);

  const closeDetailSubView = useCallback(() => {
    goBack();
  }, [goBack]);

  const openAppReviews = useCallback((appId: string, reviewId?: string) => {
    pushStep({
      activeAppDetailsId: appId,
      detailView: 'reviews',
      targetReviewId: reviewId || null,
      overlay: 'none',
    });
  }, [pushStep]);

  const clearTargetReviewId = useCallback(() => {
    setCurrent(prev => {
      if (!prev.targetReviewId) return prev;
      return { ...prev, targetReviewId: null };
    });
    if (stackRef.current.length > 0) {
      stackRef.current.forEach(step => {
        step.targetReviewId = null;
      });
    }
  }, []);

  const setYouView = useCallback((view: YouSubView) => {
    pushStep({
      activeTab: 'you',
      youView: view,
      activeAppDetailsId: null,
      detailView: 'none',
      overlay: 'none',
      activePublisherName: null,
    });
  }, [pushStep]);

  const setSelectedCategory = useCallback((category: string | null) => {
    pushStep({
      selectedCategory: category,
      activeAppDetailsId: null,
      detailView: 'none',
      overlay: 'none',
      activePublisherName: null,
    });
  }, [pushStep]);

  const resetToHome = useCallback(() => {
    stackRef.current = [initialNavigationState];
    setCurrent(initialNavigationState);
    try {
      window.history.replaceState(
        { appmarketStepIndex: 0, state: initialNavigationState },
        ''
      );
    } catch {}
  }, []);

  // Active Popup UI visibility state
  const [showActivePopupUI, setShowActivePopupUI] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('prople_show_popup_ui');
      return stored === null ? true : stored === 'true';
    } catch {
      return true;
    }
  });

  const [previewPopup, setPreviewPopup] = useState<'dev-donation' | null>(null);

  const toggleActivePopupUI = useCallback(() => {
    setShowActivePopupUI((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('prople_show_popup_ui', String(next));
      } catch {}
      return next;
    });
  }, []);

  const handleSetShowActivePopupUI = useCallback((show: boolean) => {
    setShowActivePopupUI(show);
    try {
      localStorage.setItem('prople_show_popup_ui', String(show));
    } catch {}
  }, []);

  const resetPopupTriggers = useCallback(() => {
    try {
      localStorage.removeItem('prople_store_welcome_terms_accepted');
      localStorage.removeItem('prople_app_details_terms_accepted');
      localStorage.removeItem('prople_developer_terms_accepted');
      localStorage.removeItem('prople_developer_donation_popup_shown');
      localStorage.removeItem('prople_developer_donation_milestones');
    } catch {}
  }, []);

  const value: NavigationContextType = {
    ...current,
    canGoBack,
    historyDepth: stackRef.current.length,
    goBack,
    registerBackHandler,
    changeTab,
    changeSubTab,
    openSearch,
    performSearch,
    closeSearch,
    openNotifications,
    closeNotifications,
    openSimilarApps,
    openRecommendedApps,
    openMustTryApps,
    openLatestReleases,
    openTopRatedApps,
    openBookmarkedApps,
    openWishlist,
    openPublisherConsole,
    closeOverlay,
    openAppDetail,
    closeAppDetail,
    openDetailSubView,
    closeDetailSubView,
    openAppReviews,
    clearTargetReviewId,
    openPrivacyPolicy,
    openTermsOfService,
    openDataSafety,
    openDataDeletion,
    openAppsSecurity,
    openAboutStore,
    openHowItWorks,
    openAntiPiracy,
    openUserConsentPolicy,
    openContactSupport,
    openAuthPage,
    authMode: current.authMode || 'signin',
    setYouView,
    setSelectedCategory,
    pushStep,
    resetToHome,
    previewPopup,
    setPreviewPopup,
    showActivePopupUI,
    setShowActivePopupUI: handleSetShowActivePopupUI,
    toggleActivePopupUI,
    resetPopupTriggers,
  };

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation(): NavigationContextType {
  const context = useContext(NavigationContext);
  if (!context) {
    // Return a safe no-op object if rendered outside of provider rather than throwing uncaught error
    return {
      ...initialNavigationState,
      canGoBack: false,
      historyDepth: 0,
      goBack: () => false,
      registerBackHandler: () => () => {},
      changeTab: () => {},
      changeSubTab: () => {},
      openSearch: () => {},
      performSearch: () => {},
      closeSearch: () => {},
      openNotifications: () => {},
      closeNotifications: () => {},
      openSimilarApps: () => {},
      openRecommendedApps: () => {},
      openMustTryApps: () => {},
      openLatestReleases: () => {},
      openTopRatedApps: () => {},
      openBookmarkedApps: () => {},
      openWishlist: () => {},
      openPublisherConsole: () => {},
      closeOverlay: () => {},
      openAppDetail: () => {},
      closeAppDetail: () => {},
      openDetailSubView: () => {},
      closeDetailSubView: () => {},
      openAppReviews: () => {},
      clearTargetReviewId: () => {},
      openPrivacyPolicy: () => {},
      openTermsOfService: () => {},
      openDataSafety: () => {},
      openDataDeletion: () => {},
      openAppsSecurity: () => {},
      openAboutStore: () => {},
      openHowItWorks: () => {},
      openAntiPiracy: () => {},
      openUserConsentPolicy: () => {},
      openContactSupport: () => {},
      openAuthPage: () => {},
      setYouView: () => {},
      setSelectedCategory: () => {},
      pushStep: () => {},
      resetToHome: () => {},
      previewPopup: null,
      setPreviewPopup: () => {},
      showActivePopupUI: false,
      setShowActivePopupUI: () => {},
      toggleActivePopupUI: () => {},
      resetPopupTriggers: () => {},
    };
  }
  return context;
}
