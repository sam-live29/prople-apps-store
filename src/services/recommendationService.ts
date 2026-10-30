import { AppListing, AppDetails } from '../types';
import { 
  suggestedApps, 
  recommendedApps, 
  searchSuggestedApps, 
  topChartsApps,
  similarAppsList
} from '../data';
import { getSearchHistory } from '../utils/searchHistory';
import { CATEGORY_INTENT_MAP } from '../utils/searchEngine';
import { detectClientOS, ClientOS, isAndroidApp, isWindowsApp, isLinuxApp, isMacApp, isIOSApp } from './osDetectionService';

// Database fallback of available applications
const allAppsDb: (AppListing | null | undefined)[] = [
  ...suggestedApps,
  ...recommendedApps,
  ...searchSuggestedApps,
  ...topChartsApps,
  ...similarAppsList
];

// Remove duplicates by ID to form a clean unique collection of apps
const uniqueApps: AppListing[] = Array.from(
  new Map(
    allAppsDb
      .filter((app): app is AppListing => Boolean(app && app.id))
      .map(app => [app.id, app])
  ).values()
);

export interface UserInteractionEvent {
  type: 'view' | 'install' | 'search' | 'rate';
  appId?: string;
  category?: string;
  tags?: string[];
  developer?: string;
  query?: string;
  rating?: number;
  timestamp: number;
}

export interface UserTasteProfile {
  id: string;
  categoryAffinities: Record<string, number>;
  topCategories: string[];
  favoriteCategories: string[]; // For backwards compatibility
  recentlyViewedCategories: string[];
  preferredDevelopers: string[];
  preferredTags: string[];
  installedAppIds: string[];
}

const INTERACTIONS_STORAGE_KEY = 'propleStoreUserInteractions';
const LEGACY_INTERACTIONS_KEY = typeof atob !== 'undefined' ? atob('cGxheVN0b3JlVXNlckludGVyYWN0aW9ucw==') : '';
const MAX_STORED_INTERACTIONS = 50;

/**
 * Loads user interactions from localStorage safely
 */
export function getUserInteractions(): UserInteractionEvent[] {
  try {
    const raw = localStorage.getItem(INTERACTIONS_STORAGE_KEY) || localStorage.getItem(LEGACY_INTERACTIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Records a user interaction (app view, install, rating)
 */
export function recordUserInteraction(event: Omit<UserInteractionEvent, 'timestamp'>): void {
  try {
    const events = getUserInteractions();
    const newEvent: UserInteractionEvent = {
      ...event,
      timestamp: Date.now(),
    };
    const updated = [newEvent, ...events.slice(0, MAX_STORED_INTERACTIONS - 1)];
    localStorage.setItem(INTERACTIONS_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Could not record user interaction:', err);
  }
}

/**
 * Tracks an app page view event for user personalization
 */
export function recordUserAppView(app: AppListing | AppDetails): void {
  if (!app || !app.id) return;
  recordUserInteraction({
    type: 'view',
    appId: app.id,
    category: app.category,
    tags: Array.isArray((app as any).tags) ? (app as any).tags : undefined,
    developer: app.developer,
  });
}

/**
 * Tracks an app install event for user personalization
 */
export function recordUserAppInstall(appId: string, category?: string, developer?: string): void {
  if (!appId) return;
  recordUserInteraction({
    type: 'install',
    appId,
    category,
    developer,
  });
}

/**
 * Builds a dynamic, live UserTasteProfile from interactions, searches, and installs.
 */
export function buildLiveUserProfile(installedAppIds: string[] = []): UserTasteProfile {
  const interactions = getUserInteractions();
  const searchHistory = getSearchHistory();

  const categoryScores: Record<string, number> = {};
  const developerScores: Record<string, number> = {};
  const tagScores: Record<string, number> = {};
  const recentlyViewedCats: string[] = [];

  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  // 1. Process recent user interactions with exponential recency decay
  interactions.forEach((ev) => {
    const ageDays = Math.max(0, (now - ev.timestamp) / ONE_DAY_MS);
    const recencyWeight = Math.exp(-ageDays / 7); // Half-life of ~7 days

    let baseWeight = 1;
    if (ev.type === 'install') baseWeight = 5;
    else if (ev.type === 'rate') baseWeight = 4;
    else if (ev.type === 'view') baseWeight = 2;

    const finalWeight = baseWeight * recencyWeight;

    if (ev.category) {
      const cat = ev.category.trim();
      categoryScores[cat] = (categoryScores[cat] || 0) + finalWeight;
      if (ev.type === 'view' && !recentlyViewedCats.includes(cat)) {
        recentlyViewedCats.push(cat);
      }
    }

    if (ev.developer) {
      const dev = ev.developer.trim();
      developerScores[dev] = (developerScores[dev] || 0) + finalWeight;
    }

    if (ev.tags && Array.isArray(ev.tags)) {
      ev.tags.forEach((tag) => {
        const cleanTag = tag.trim().toLowerCase();
        tagScores[cleanTag] = (tagScores[cleanTag] || 0) + finalWeight;
      });
    }
  });

  // 2. Process search queries (Queries strongly reveal user category and task intent)
  searchHistory.forEach((sh, idx) => {
    const query = sh.query.toLowerCase().trim();
    const queryRankWeight = Math.max(1, 4 - idx); // Top recent searches weighted heavier

    // Check against CATEGORY_INTENT_MAP
    Object.entries(CATEGORY_INTENT_MAP).forEach(([keyword, mappedCategories]) => {
      if (query.includes(keyword)) {
        mappedCategories.forEach((cat) => {
          categoryScores[cat] = (categoryScores[cat] || 0) + queryRankWeight * 1.5;
        });
      }
    });
  });

  // Sort categories by score descending
  const sortedCategories = Object.entries(categoryScores)
    .sort((a, b) => b[1] - a[1])
    .map(([cat]) => cat);

  // Fallback categories if user has no browsing history yet
  const fallbackCategories = ['Tools', 'Productivity', 'Entertainment', 'Games'];
  const topCategories = sortedCategories.length > 0 ? sortedCategories : fallbackCategories;

  const preferredDevelopers = Object.entries(developerScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([dev]) => dev);

  const preferredTags = Object.entries(tagScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag]) => tag);

  return {
    id: 'user_live_profile',
    categoryAffinities: categoryScores,
    topCategories,
    favoriteCategories: topCategories.slice(0, 3),
    recentlyViewedCategories: recentlyViewedCats.slice(0, 3),
    preferredDevelopers,
    preferredTags,
    installedAppIds,
  };
}

/**
 * Calculates a Bayesian-weighted rating score.
 */
function calculateBayesianRating(rating: number, ratingsCount: number): number {
  if (rating <= 0) return 0;
  const minThreshold = 5;
  const storeMean = 3.8;
  const count = Math.max(0, ratingsCount);
  return (count / (count + minThreshold)) * rating + (minThreshold / (count + minThreshold)) * storeMean;
}

export interface PersonalizedRecommendationOptions {
  profile?: UserTasteProfile;
  limit?: number;
  sourceApps?: AppListing[];
  excludeIds?: string[];
  clientOS?: ClientOS;
  categoryFilter?: string;
  appsMap?: Record<string, AppDetails>;
}

/**
 * Service class that handles personalized app recommendations,
 * similar app clustering, and user taste affinity modeling.
 */
export class RecommendationService {
  /**
   * Generates a personalized list of app recommendations for a given user profile.
   * Multi-Factor Ranking:
   *  - User Category Affinity (Favorites & Recently Viewed)
   *  - User Topic / Tag Affinity
   *  - Developer Affinity
   *  - Bayesian Quality Score (Wilson/Bayesian Rating)
   *  - Download & Popularity Momentum (Logarithmic installs)
   *  - Platform & Device Compatibility Boost
   *  - Excludes already installed apps and duplicates
   */
  static getPersonalizedRecommendations(
    profileOrOptions?: UserTasteProfile | PersonalizedRecommendationOptions,
    legacyLimit: number = 12,
    legacySourceApps?: AppListing[]
  ): AppListing[] {
    let options: PersonalizedRecommendationOptions;

    // Support both old signature (profile, limit, sourceApps) and modern options object
    if (profileOrOptions && 'categoryAffinities' in (profileOrOptions as any)) {
      options = {
        profile: profileOrOptions as UserTasteProfile,
        limit: legacyLimit,
        sourceApps: legacySourceApps,
      };
    } else if (profileOrOptions && typeof profileOrOptions === 'object') {
      options = profileOrOptions as PersonalizedRecommendationOptions;
    } else {
      options = {
        limit: legacyLimit,
        sourceApps: legacySourceApps,
      };
    }

    const sourceApps = options.sourceApps && options.sourceApps.length > 0 ? options.sourceApps : uniqueApps;
    const profile = options.profile || buildLiveUserProfile(options.excludeIds || []);
    const limit = options.limit || 12;
    const clientOS = options.clientOS || detectClientOS();
    const excludeSet = new Set([...profile.installedAppIds, ...(options.excludeIds || [])]);
    const appsMap = options.appsMap || {};

    // Calculate dynamic score for each candidate app
    const scoredApps = sourceApps
      .filter(app => !excludeSet.has(app.id))
      .map(app => {
        let score = 0;
        const fullApp = appsMap[app.id];
        const appCat = app.category || fullApp?.category || '';
        const appDev = app.developer || fullApp?.developer || '';
        const appTags = (
          Array.isArray((app as any).tags)
            ? (app as any).tags
            : Array.isArray(fullApp?.tags)
            ? fullApp!.tags
            : []
        ).map((t: any) => String(t).toLowerCase());

        // 1. User Category Affinity Boost
        const catAffinity = profile.categoryAffinities[appCat] || 0;
        if (catAffinity > 0) {
          score += Math.min(60, catAffinity * 12);
        } else if (profile.favoriteCategories.includes(appCat)) {
          score += 25;
        }

        // 2. Recently Viewed Category Boost
        if (profile.recentlyViewedCategories.includes(appCat)) {
          score += 20;
        }

        // 3. Preferred Developer Boost
        if (profile.preferredDevelopers.includes(appDev)) {
          score += 25;
        }

        // 4. Preferred Tags Boost
        profile.preferredTags.forEach(tag => {
          if (appTags.some(t => t.includes(tag))) {
            score += 15;
          }
        });

        // 5. Bayesian Rating Quality Boost
        const rating = app.rating ?? fullApp?.rating ?? 0;
        const ratingsCount = app.ratingsCount ?? fullApp?.ratingsCount ?? (app.downloadsCount ? 10 : 1);
        if (rating > 0) {
          const bayesianRating = calculateBayesianRating(rating, ratingsCount);
          score += bayesianRating * 8;
        }

        // 6. Download Popularity Momentum
        const downloads = app.downloadsCount || fullApp?.downloadsCount || 0;
        if (downloads > 0) {
          score += Math.min(40, Math.log10(downloads + 1) * 10);
        }

        // 7. Verified Release Bonus
        if (app.isVerified || (fullApp as any)?.keystoreFingerprint) {
          score += 15;
        }

        // 7b. Freshness / Newly Published Release Boost
        const extractTsMs = (ts: any): number => {
          if (!ts) return 0;
          if (typeof ts === 'number') return ts > 1e12 ? ts : ts * 1000;
          if (typeof ts.toMillis === 'function') return ts.toMillis();
          if (typeof ts.seconds === 'number') return ts.seconds * 1000;
          if (typeof ts._seconds === 'number') return ts._seconds * 1000;
          if (typeof ts === 'string') {
            const parsed = Date.parse(ts);
            return Number.isNaN(parsed) ? 0 : parsed;
          }
          return 0;
        };
        const latestTs = Math.max(
          extractTsMs((app as any).updatedAt),
          extractTsMs((fullApp as any)?.updatedAt),
          extractTsMs((app as any).createdAt),
          extractTsMs((fullApp as any)?.createdAt),
          extractTsMs((app as any).releaseDate),
          extractTsMs((fullApp as any)?.releaseDate)
        );
        if (latestTs > 0) {
          const ageDays = (Date.now() - latestTs) / (24 * 60 * 60 * 1000);
          if (ageDays <= 14) {
            score += 35;
          } else if (ageDays <= 45) {
            score += 20;
          }
        }

        // 8. Device Compatibility Boost
        const isAnd = isAndroidApp(app);
        const isWin = isWindowsApp(app);
        const isLin = isLinuxApp(app);
        const isMac = isMacApp(app);
        const isIos = isIOSApp(app);
        const isWeb = app.type === 'webapp' || app.platform === 'web' || app.packageFormat === 'web' || app.packageFormat === 'pwa';

        if (clientOS === 'android') {
          if (isAnd) score += 30;
          else if (isWeb) score += 15;
          else score -= 80;
        } else if (clientOS === 'windows') {
          if (isWin) score += 30;
          else if (isWeb) score += 15;
          else score -= 80;
        } else if (clientOS === 'linux') {
          if (isLin) score += 30;
          else if (isWeb) score += 15;
          else score -= 80;
        } else if (clientOS === 'macos' || (clientOS as any) === 'mac') {
          if (isMac) score += 30;
          else if (isWeb) score += 15;
          else score -= 80;
        } else if (clientOS === 'ios') {
          if (isIos) score += 30;
          else if (isWeb) score += 15;
          else score -= 80;
        }

        // Base score for all apps to ensure catalog variety
        score += 5;

        return { app, score };
      });

    // Sort descending by score
    scoredApps.sort((a, b) => b.score - a.score);

    // Apply diversity balancing: Don't pack the top 10 with 8 apps from the same category
    const categoryCount: Record<string, number> = {};
    const diversifiedResults: AppListing[] = [];

    for (const item of scoredApps) {
      const cat = item.app.category || 'General';
      const count = categoryCount[cat] || 0;
      // Allow up to 3 apps per category in general recommendations
      if (count < 3 || diversifiedResults.length >= limit) {
        diversifiedResults.push(item.app);
        categoryCount[cat] = count + 1;
        if (diversifiedResults.length >= limit) break;
      }
    }

    // Backfill if diversity filter restricted total below limit
    if (diversifiedResults.length < limit) {
      const seenIds = new Set(diversifiedResults.map(a => a.id));
      for (const item of scoredApps) {
        if (!seenIds.has(item.app.id)) {
          diversifiedResults.push(item.app);
          seenIds.add(item.app.id);
          if (diversifiedResults.length >= limit) break;
        }
      }
    }

    return diversifiedResults.slice(0, limit);
  }

  /**
   * Generates personalized "Suggested for you" recommendations.
   * Prioritizes high-affinity user categories, ensuring distinct category representation.
   */
  static getSuggestedForYou(
    sourceApps?: AppListing[],
    limit: number = 12,
    options?: { clientOS?: ClientOS; appsMap?: Record<string, AppDetails> }
  ): AppListing[] {
    const profile = buildLiveUserProfile();
    return RecommendationService.getPersonalizedRecommendations({
      profile,
      limit,
      sourceApps,
      clientOS: options?.clientOS,
      appsMap: options?.appsMap,
    });
  }

  /**
   * Helper function to get related Web and multiplatform apps
   */
  static getRelatedWebApps(limit?: number, sourceApps?: AppListing[]): AppListing[] {
    const candidateApps = sourceApps && sourceApps.length > 0 ? sourceApps : uniqueApps;
    const apps = candidateApps.filter(app => app.type === 'webapp' || app.type === 'github_release' || app.type === 'native');
    const results = apps.length > 0 ? apps : candidateApps;
    return limit ? results.slice(0, limit) : results;
  }

  /**
   * Production-grade Similar Apps calculation:
   *  - Exact Category Match (+50 pts)
   *  - Shared Tags Jaccard Similarity (+30 pts)
   *  - Same Publisher / Developer (+25 pts)
   *  - Target Platform / Format Match (+20 pts)
   *  - Bayesian Rating Score (+15 pts)
   */
  static getSimilarApps(
    currentAppId?: string, 
    sourceApps?: AppListing[], 
    limit: number = 16,
    appsMap?: Record<string, AppDetails>
  ): AppListing[] {
    const candidateApps = sourceApps && sourceApps.length > 0 
      ? sourceApps 
      : (RecommendationService.globalAppsCatalog.length > 0 ? RecommendationService.globalAppsCatalog : uniqueApps);

    if (!currentAppId) {
      return candidateApps.slice(0, limit);
    }

    const currentApp = candidateApps.find(a => a.id === currentAppId) || (appsMap ? appsMap[currentAppId] : undefined);
    const currentFull = (appsMap ? appsMap[currentAppId] : undefined) || (currentApp as any);

    const currentCat = (currentApp?.category || currentFull?.category || '').toLowerCase().trim();
    const currentDev = (currentApp?.developer || currentFull?.developer || '').toLowerCase().trim();
    const currentPlatform = (currentApp?.platform || currentFull?.platform || 'android').toLowerCase();
    
    // Extract keywords from name, tagline, and tags
    const extractTokens = (text: string) => 
      text.toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 3 && !['app', 'apps', 'android', 'free', 'pro', 'for', 'the', 'and', 'with'].includes(w));

    const currentNameTokens = new Set(extractTokens(currentApp?.name || ''));
    const currentTaglineTokens = new Set(extractTokens((currentApp?.tagline || currentFull?.aboutText || '').slice(0, 300)));

    const currentTags = new Set(
      (
        Array.isArray((currentApp as any)?.tags)
          ? (currentApp as any).tags
          : Array.isArray(currentFull?.tags)
          ? currentFull!.tags
          : []
      ).map((t: any) => String(t).toLowerCase().trim())
    );

    const now = Date.now();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    const filtered = candidateApps.filter(a => a.id !== currentAppId);

    const scored = filtered.map(app => {
      let score = 0;
      const full = appsMap ? appsMap[app.id] : undefined;
      const appCat = (app.category || full?.category || '').toLowerCase().trim();
      const appDev = (app.developer || full?.developer || '').toLowerCase().trim();
      const appPlatform = (app.platform || full?.platform || 'android').toLowerCase();

      // 1. Semantic Category Matching
      if (currentCat && appCat) {
        if (currentCat === appCat) {
          score += 65;
        } else if (appCat.includes(currentCat) || currentCat.includes(appCat)) {
          score += 45;
        } else {
          // Cross-category semantic correlation (Communication <-> Social, Productivity <-> Tools, etc.)
          const cleanCat1 = currentCat.replace(/^cat-/, '');
          const cleanCat2 = appCat.replace(/^cat-/, '');
          if (
            (cleanCat1.includes('communicat') && cleanCat2.includes('social')) ||
            (cleanCat1.includes('social') && cleanCat2.includes('communicat')) ||
            (cleanCat1.includes('tool') && cleanCat2.includes('productiv')) ||
            (cleanCat1.includes('productiv') && cleanCat2.includes('tool')) ||
            (cleanCat1.includes('game') && cleanCat2.includes('game')) ||
            (cleanCat1.includes('media') && cleanCat2.includes('video')) ||
            (cleanCat1.includes('music') && cleanCat2.includes('audio'))
          ) {
            score += 35;
          }
        }
      }

      // 2. Keyword & Tag Overlap
      const appTags = (
        Array.isArray((app as any).tags)
          ? (app as any).tags
          : Array.isArray(full?.tags)
          ? full!.tags
          : []
      ).map((t: any) => String(t).toLowerCase().trim());

      let tagMatches = 0;
      appTags.forEach(t => {
        if (currentTags.has(t)) tagMatches++;
      });
      score += Math.min(45, tagMatches * 15);

      const appNameTokens = extractTokens(app.name || '');
      let nameOverlap = 0;
      appNameTokens.forEach(t => {
        if (currentNameTokens.has(t) || currentTaglineTokens.has(t)) nameOverlap++;
      });
      score += Math.min(30, nameOverlap * 10);

      // 3. New App Freshness & Dynamic Discovery Momentum
      const createdAtRaw = (app as any).createdAt || (full as any)?.createdAt || (app as any).initialReleaseDate;
      let ageDays = 180;
      if (createdAtRaw) {
        let t = 0;
        if (typeof createdAtRaw === 'object' && createdAtRaw.seconds) {
          t = createdAtRaw.seconds * 1000;
        } else if (typeof createdAtRaw === 'string' || typeof createdAtRaw === 'number') {
          t = new Date(createdAtRaw).getTime();
        }
        if (t > 0 && !isNaN(t)) {
          ageDays = Math.max(0, (now - t) / ONE_DAY_MS);
        }
      }
      if (ageDays <= 7) {
        score += 40; // Brand new releases receive strong visibility
      } else if (ageDays <= 30) {
        score += 25; // Fresh updates
      } else if (ageDays <= 90) {
        score += 10;
      }

      // 4. Same Developer / Publisher
      if (currentDev && appDev && currentDev === appDev) {
        score += 25;
      }

      // 5. Target Platform Alignment
      if (currentPlatform && appPlatform && currentPlatform === appPlatform) {
        score += 20;
      }

      // 6. Quality & Popularity
      const rating = app.rating ?? full?.rating ?? 0;
      score += rating * 4;

      const downloads = app.downloadsCount || full?.downloadsCount || 0;
      if (downloads > 0) {
        score += Math.min(25, Math.log10(downloads + 1) * 6);
      }

      // 7. Base floor to keep recommendations dynamic rather than empty
      score += 5;

      return { app, score };
    });

    scored.sort((a, b) => b.score - a.score);

    return scored.map(s => s.app).slice(0, limit);
  }

  private static globalAppsCatalog: AppListing[] = [];

  static setGlobalAppsCatalog(apps: AppListing[]) {
    if (Array.isArray(apps)) {
      this.globalAppsCatalog = apps;
    }
  }

  /**
   * Resolves an app by ID, name, or slug from the provided catalog
   */
  static getAppById(id: string, sourceApps?: AppListing[]): AppListing | undefined {
    if (!id) return undefined;
    const cleanId = id.trim().toLowerCase();
    const cleanSlug = cleanId.replace(/[^a-z0-9]/g, '');

    const matchFn = (app: AppListing) => {
      if (!app) return false;
      if (app.id === id || app.id.toLowerCase() === cleanId) return true;
      if (app.name && app.name.toLowerCase() === cleanId) return true;
      if (app.packageName && app.packageName.toLowerCase() === cleanId) return true;
      if ((app as any).slug && (app as any).slug.toLowerCase() === cleanId) return true;
      const appNameSlug = (app.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const appIdSlug = (app.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return Boolean(
        (appNameSlug && appNameSlug === cleanSlug) || 
        (appIdSlug && appIdSlug === cleanSlug)
      );
    };

    if (sourceApps && sourceApps.length > 0) {
      const found = sourceApps.find(matchFn);
      if (found) return found;
    }

    if (this.globalAppsCatalog && this.globalAppsCatalog.length > 0) {
      const foundInGlobal = this.globalAppsCatalog.find(matchFn);
      if (foundInGlobal) return foundInGlobal;
    }

    return uniqueApps.find(matchFn);
  }
}
