import { Meilisearch } from 'meilisearch';

// Meilisearch Configuration
const MEILISEARCH_HOST = process.env.MEILISEARCH_HOST || 'http://localhost:7700';
const MEILISEARCH_ADMIN_KEY = 
  process.env.MEILISEARCH_ADMIN_KEY || 
  process.env.MEILISEARCH_API_KEY || 
  '';
const MEILISEARCH_SEARCH_KEY = 
  process.env.MEILISEARCH_SEARCH_KEY || 
  '';
const MEILISEARCH_MASTER_KEY = 
  process.env.MEILISEARCH_MASTER_KEY || 
  '';

export const MEILISEARCH_INDEX_NAME = 'apps';

let client: Meilisearch | null = null;
let isIndexConfigured = false;
let isMeiliAvailable = false;
let lastHealthCheck = 0;

/**
 * Returns or initializes the Meilisearch client
 */
export function getMeilisearchClient(): Meilisearch {
  if (!client) {
    client = new Meilisearch({
      host: MEILISEARCH_HOST,
      apiKey: MEILISEARCH_ADMIN_KEY,
    });
  }
  return client;
}

/**
 * Check if the Meilisearch server is reachable
 */
export async function checkMeilisearchHealth(): Promise<boolean> {
  const now = Date.now();
  // Cache positive health status for 30s, negative health status for 60s
  const cacheDuration = isMeiliAvailable ? 30000 : 60000;
  if (now - lastHealthCheck < cacheDuration && lastHealthCheck > 0) {
    return isMeiliAvailable;
  }

  try {
    const cli = getMeilisearchClient();
    const health = await Promise.race([
      cli.health(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Meilisearch health check timeout')), 600)
      )
    ]);
    isMeiliAvailable = health.status === 'available';
  } catch (err: any) {
    isMeiliAvailable = false;
  }
  lastHealthCheck = now;
  return isMeiliAvailable;
}

/**
 * Ensures the `apps` index exists with optimal search, filtering, and typo settings
 */
export async function ensureAppsIndexConfigured(): Promise<boolean> {
  if (isIndexConfigured && isMeiliAvailable) return true;

  try {
    const isHealthy = await checkMeilisearchHealth();
    if (!isHealthy) return false;

    const cli = getMeilisearchClient();
    const index = cli.index(MEILISEARCH_INDEX_NAME);

    // Try to retrieve index or create if missing
    try {
      await index.getRawInfo();
    } catch {
      await cli.createIndex(MEILISEARCH_INDEX_NAME, { primaryKey: 'id' });
    }

    // Configure search ranking, searchable, filterable, and sortable attributes
    await index.updateSettings({
      searchableAttributes: [
        'name',
        'developer',
        'publisherName',
        'publishedBy',
        'category',
        'tagline',
        'description',
        'tags',
        'features',
        'requirements',
        'targetOs',
        'minAndroid',
        'permissions',
        'securityPractices',
        'releaseNotes',
        'packageName',
        'platform',
        'packageFormat'
      ],
      filterableAttributes: [
        'category',
        'platform',
        'isPublished',
        'owner',
        'rating',
        'downloadsCount',
        'containsAds',
        'inAppPurchases',
        'contentRating'
      ],
      sortableAttributes: [
        'rating',
        'downloadsCount',
        'updatedAt',
        'createdAt'
      ],
      rankingRules: [
        'words',
        'typo',
        'proximity',
        'attribute',
        'sort',
        'exactness'
      ],
      typoTolerance: {
        enabled: true,
        minWordSizeForTypos: {
          oneTypo: 4,
          twoTypos: 8,
        },
      },
    });

    isIndexConfigured = true;
    console.log('[Meilisearch] `apps` index configured successfully with typo tolerance & ranking rules');
    return true;
  } catch (err: any) {
    console.warn('[Meilisearch] Index configuration deferred (server offline or starting):', err.message);
    return false;
  }
}

/**
 * Normalizes app document for Meilisearch index
 */
export function formatAppForIndex(app: any) {
  const permissionsList = Array.isArray(app.dataSafety?.permissions) 
    ? app.dataSafety.permissions.map(String) 
    : (Array.isArray(app.permissions) ? app.permissions.map(String) : []);
  const securityPractices = Array.isArray(app.dataSafety?.securityPractices)
    ? app.dataSafety.securityPractices.map(String)
    : [];
  const featuresList = Array.isArray(app.features)
    ? app.features.map(String)
    : [];

  return {
    id: String(app.id || ''),
    name: String(app.name || ''),
    developer: String(app.developer || ''),
    publisherName: String(app.publisherName || app.developerInfo?.publisherName || app.publishedBy || app.developer || ''),
    publishedBy: String(app.publishedBy || app.publisherName || app.developer || ''),
    category: String(app.category || 'Tools'),
    tagline: String(app.tagline || app.shortDescription || ''),
    description: String(app.description || app.aboutText || ''),
    platform: String(app.platform || 'android'),
    packageFormat: String(app.packageFormat || 'apk'),
    targetOs: String(app.targetOs || app.minAndroid || ''),
    minAndroid: String(app.minAndroid || ''),
    packageName: String(app.packageName || app.bundleId || ''),
    features: featuresList,
    requirements: String(app.requirements || app.minAndroid || app.targetOs || ''),
    permissions: permissionsList,
    securityPractices: securityPractices,
    containsAds: Boolean(app.containsAds),
    inAppPurchases: Boolean(app.inAppPurchases),
    contentRating: String(app.contentRating || 'Rated for 3+'),
    releaseNotes: String(app.releaseNotes || app.changelog || ''),
    size: String(app.size || ''),
    rating: typeof app.rating === 'number' ? app.rating : parseFloat(app.rating) || 0,
    downloadsCount: typeof app.downloadsCount === 'number' ? app.downloadsCount : parseInt(app.downloadsCount, 10) || 0,
    downloads: String(app.downloads || '0+'),
    reviewsCount: String(app.reviewsCount || '0'),
    iconUrl: String(app.iconUrl || ''),
    featureGraphicUrl: String(app.featureGraphicUrl || app.iconUrl || ''),
    screenshots: Array.isArray(app.screenshots) ? app.screenshots.map(String) : [],
    tabletScreenshots: Array.isArray(app.tabletScreenshots) ? app.tabletScreenshots.map(String) : [],
    desktopScreenshots: Array.isArray(app.desktopScreenshots) ? app.desktopScreenshots.map(String) : [],
    promoVideoUrl: String(app.promoVideoUrl || ''),
    downloadUrl: String(app.downloadUrl || ''),
    tags: Array.isArray(app.tags) ? app.tags.map(String) : [],
    isPublished: app.isPublished !== false,
    owner: String(app.owner || app.developerId || ''),
    createdAt: String(app.createdAt || new Date().toISOString()),
    updatedAt: String(app.updatedAt || new Date().toISOString()),
  };
}

/**
 * Index or update a single application
 */
export async function indexApp(app: any): Promise<boolean> {
  try {
    const isHealthy = await checkMeilisearchHealth();
    if (!isHealthy) return false;

    await ensureAppsIndexConfigured();
    const cli = getMeilisearchClient();
    const index = cli.index(MEILISEARCH_INDEX_NAME);
    const doc = formatAppForIndex(app);

    await index.addDocuments([doc], { primaryKey: 'id' });
    console.log(`[Meilisearch] Indexed app: ${doc.id} (${doc.name})`);
    return true;
  } catch (err: any) {
    console.warn(`[Meilisearch] Error indexing app ${app?.id}:`, err.message);
    return false;
  }
}

/**
 * Index a batch of applications
 */
export async function indexApps(apps: any[]): Promise<{ success: boolean; count: number }> {
  if (!Array.isArray(apps) || apps.length === 0) {
    return { success: true, count: 0 };
  }

  try {
    const isHealthy = await checkMeilisearchHealth();
    if (!isHealthy) {
      return { success: false, count: 0 };
    }

    await ensureAppsIndexConfigured();
    const cli = getMeilisearchClient();
    const index = cli.index(MEILISEARCH_INDEX_NAME);
    const docs = apps.map(formatAppForIndex).filter(d => Boolean(d.id && d.name));

    await index.addDocuments(docs, { primaryKey: 'id' });
    console.log(`[Meilisearch] Batch indexed ${docs.length} apps`);
    return { success: true, count: docs.length };
  } catch (err: any) {
    console.warn('[Meilisearch] Error batch indexing apps:', err.message);
    return { success: false, count: 0 };
  }
}

/**
 * Delete an app from the Meilisearch index
 */
export async function deleteAppFromIndex(appId: string): Promise<boolean> {
  try {
    const isHealthy = await checkMeilisearchHealth();
    if (!isHealthy) return false;

    const cli = getMeilisearchClient();
    const index = cli.index(MEILISEARCH_INDEX_NAME);
    await index.deleteDocument(appId);
    console.log(`[Meilisearch] Deleted app ${appId} from index`);
    return true;
  } catch (err: any) {
    console.warn(`[Meilisearch] Error deleting app ${appId}:`, err.message);
    return false;
  }
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
  category?: string;
  platform?: string;
  sort?: string[];
  filter?: string | string[];
}

// Server stopwords for semantic token stripping
const SERVER_STOPWORDS = new Set(['app', 'apps', 'application', 'applications', 'best', 'top', 'free', 'download', 'the', 'a', 'an', 'for', 'to']);

// Intent mapping for generic category queries
const SERVER_INTENT_MAP: Record<string, string[]> = {
  health: ['Health & Fitness', 'Medical', 'Sports', 'Lifestyle'],
  fitness: ['Health & Fitness', 'Sports'],
  tracker: ['Health & Fitness', 'Tools', 'Productivity'],
  workout: ['Health & Fitness', 'Sports'],
  food: ['Food & Drink', 'Lifestyle'],
  recipe: ['Food & Drink'],
  cooking: ['Food & Drink'],
  grocery: ['Food & Drink', 'Shopping'],
  photo: ['Photography', 'Video Players & Editors'],
  camera: ['Photography'],
  editor: ['Photography', 'Video Players & Editors', 'Tools'],
  music: ['Music & Audio'],
  audio: ['Music & Audio'],
  video: ['Video Players & Editors', 'Entertainment'],
  productivity: ['Productivity', 'Tools', 'Business'],
  notes: ['Productivity', 'Tools'],
  todo: ['Productivity', 'Tools'],
  wallet: ['Finance'],
  crypto: ['Finance'],
  finance: ['Finance', 'Business'],
  game: ['Games', 'Action', 'Arcade', 'Puzzle', 'Casual', 'Simulation', 'Racing', 'RPG'],
  games: ['Games', 'Action', 'Arcade', 'Puzzle', 'Casual', 'Simulation', 'Racing', 'RPG'],
};

/**
 * Performs a search query against Meilisearch with automatic fallback to database/in-memory catalog
 */
export async function searchApps(
  query: string, 
  options: SearchOptions = {}, 
  fallbackCatalog: any[] = []
): Promise<{
  hits: any[];
  estimatedTotalHits: number;
  query: string;
  source: 'meilisearch' | 'database_fallback';
  processingTimeMs: number;
}> {
  const startTime = Date.now();
  const rawQ = (query || '').trim();
  const isPublisherSearch = rawQ.toLowerCase().startsWith('pub:') || rawQ.toLowerCase().startsWith('publisher:');
  const cleanQ = isPublisherSearch
    ? (rawQ.toLowerCase().startsWith('pub:') ? rawQ.slice(4).trim() : rawQ.slice(10).trim())
    : rawQ;
  const lowerQ = cleanQ.toLowerCase();

  const queryTokens = lowerQ
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length >= 2 && !SERVER_STOPWORDS.has(w));

  const semanticQuery = queryTokens.length > 0 ? queryTokens.join(' ') : cleanQ;

  const applyPlatformRanking = (items: any[], targetPlatform?: string) => {
    if (!targetPlatform || !Array.isArray(items)) return items;
    const plat = targetPlatform.toLowerCase();
    return [...items].sort((a, b) => {
      const aPlat = (a.platform || '').toLowerCase();
      const bPlat = (b.platform || '').toLowerCase();
      const aIsWeb = a.type === 'webapp' || aPlat === 'web' || aPlat === 'multiplatform';
      const bIsWeb = b.type === 'webapp' || bPlat === 'web' || bPlat === 'multiplatform';

      const aScore = (aPlat === plat) ? 100 : aIsWeb ? 80 : 10;
      const bScore = (bPlat === plat) ? 100 : bIsWeb ? 80 : 10;
      return bScore - aScore;
    });
  };

  // Try Meilisearch if available
  const isHealthy = await checkMeilisearchHealth();
  if (isHealthy) {
    try {
      const cli = getMeilisearchClient();
      const index = cli.index(MEILISEARCH_INDEX_NAME);

      const filterParts: string[] = [];
      if (options.category) {
        filterParts.push(`category = "${options.category}"`);
      }
      if (options.filter) {
        if (Array.isArray(options.filter)) {
          filterParts.push(...options.filter);
        } else {
          filterParts.push(options.filter);
        }
      }

      const searchParams: any = {
        limit: options.limit || 50,
        offset: options.offset || 0,
        attributesToHighlight: ['name', 'developer', 'category', 'tagline', 'description'],
      };

      if (filterParts.length > 0) {
        searchParams.filter = filterParts.join(' AND ');
      }
      if (options.sort && options.sort.length > 0) {
        searchParams.sort = options.sort;
      }

      let res = await index.search(semanticQuery || cleanQ, searchParams);
      if ((!res.hits || res.hits.length === 0) && semanticQuery !== cleanQ) {
        res = await index.search(cleanQ, searchParams);
      }

      let hits = res.hits || [];
      if (options.platform) {
        hits = applyPlatformRanking(hits, options.platform);
      }

      const processingTimeMs = Date.now() - startTime;

      return {
        hits: hits.slice(0, options.limit || 20),
        estimatedTotalHits: res.estimatedTotalHits ?? hits.length,
        query: cleanQ,
        source: 'meilisearch',
        processingTimeMs,
      };
    } catch (err: any) {
      console.warn('[Meilisearch] Query execution failed, falling back to local search:', err.message);
    }
  }

  // Graceful Fallback: Local database / in-memory search with semantic matching
  let filtered = [...fallbackCatalog];

  if (options.category) {
    filtered = filtered.filter(a => (a.category || '').toLowerCase() === options.category?.toLowerCase());
  }

  if (lowerQ) {
    const scoredList: { app: any; score: number }[] = [];

    for (const app of filtered) {
      const dev = (app.developer || '').toLowerCase();
      const pub = (app.publisherName || '').toLowerCase();

      const devNoSpaces = dev.replace(/[^a-z0-9]/g, '');
      const pubNoSpaces = pub.replace(/[^a-z0-9]/g, '');
      const cleanQNoSpaces = lowerQ.replace(/[^a-z0-9]/g, '');

      const isExactPub =
        (dev && dev === lowerQ) ||
        (pub && pub === lowerQ) ||
        (cleanQNoSpaces.length >= 3 && (devNoSpaces === cleanQNoSpaces || pubNoSpaces === cleanQNoSpaces));

      const isPartialPub = !isExactPub && (
        (dev && (dev.includes(lowerQ) || lowerQ.includes(dev))) ||
        (pub && (pub.includes(lowerQ) || lowerQ.includes(pub))) ||
        (cleanQNoSpaces.length >= 4 && (
          (devNoSpaces && (devNoSpaces.includes(cleanQNoSpaces) || cleanQNoSpaces.includes(devNoSpaces))) ||
          (pubNoSpaces && (pubNoSpaces.includes(cleanQNoSpaces) || cleanQNoSpaces.includes(pubNoSpaces)))
        ))
      );

      if (isPublisherSearch) {
        let pScore = 0;
        if (isExactPub) pScore += 50000;
        else if (isPartialPub) pScore += 25000;
        else {
          for (const token of queryTokens) {
            if (dev.includes(token) || (pub && pub.includes(token))) pScore += 10000;
          }
        }
        if (pScore > 0) {
          scoredList.push({ app, score: pScore });
        }
        continue;
      }

      const name = (app.name || '').toLowerCase();
      const cleanNameNoSpaces = name.replace(/[^a-z0-9]/g, '');
      const cat = (app.category || '').toLowerCase();
      const tag = (app.tagline || app.shortDescription || '').toLowerCase();
      const desc = (app.description || '').toLowerCase();
      const tags = Array.isArray(app.tags) ? app.tags.map((t: string) => String(t).toLowerCase()) : [];
      const pkg = ((app.packageName || '') as string).toLowerCase();

      let score = 0;

      // 1. EXACT & PREFIX APP NAME MATCH (The Primary App Store Search Signal)
      if (name === lowerQ) score += 50000;
      else if (cleanNameNoSpaces && cleanQNoSpaces && cleanNameNoSpaces === cleanQNoSpaces) score += 45000;
      else if (name.startsWith(lowerQ)) score += 30000;
      else if (name.includes(lowerQ)) score += 20000;
      else if (cleanNameNoSpaces && cleanQNoSpaces && (cleanNameNoSpaces.includes(cleanQNoSpaces) || cleanQNoSpaces.includes(cleanNameNoSpaces))) score += 15000;

      // 2. Package ID match
      if (pkg && (pkg === lowerQ || pkg.includes(lowerQ))) score += 18000;

      // 3. Token matches in app name (Highest token priority)
      for (const token of queryTokens) {
        if (name.includes(token)) score += 8000;
        if (cat.includes(token)) score += 1500;
        if (tags.some((t: string) => t.includes(token))) score += 1200;
        if (tag.includes(token)) score += 800;
        if (desc.includes(token)) score += 300;

        // Intent match
        const mapped = SERVER_INTENT_MAP[token];
        if (mapped && mapped.some(m => cat.includes(m.toLowerCase()))) {
          score += 1000;
        }
      }

      // 4. Publisher match in general search (Secondary signal, NEVER outranks actual app name)
      if (isExactPub) {
        score += 3500;
      } else if (isPartialPub) {
        score += 1200;
      }

      if (score > 0) {
        score += Math.min(50, Math.log10((app.downloadsCount || 0) + 1) * 12);
        score += (app.rating || 0) * 5;
        scoredList.push({ app, score });
      }
    }

    scoredList.sort((a, b) => b.score - a.score);
    filtered = scoredList.map(s => s.app);
  }

  if (options.platform) {
    filtered = applyPlatformRanking(filtered, options.platform);
  }

  const offset = options.offset || 0;
  const limit = options.limit || 20;
  const hits = filtered.slice(offset, offset + limit);
  const processingTimeMs = Date.now() - startTime;

  return {
    hits,
    estimatedTotalHits: filtered.length,
    query: cleanQ,
    source: 'database_fallback',
    processingTimeMs,
  };
}

/**
 * Returns overall Meilisearch connectivity, keys info (redacted), and stats
 */
export async function getMeilisearchStatus(): Promise<{
  available: boolean;
  host: string;
  hasAdminKey: boolean;
  hasSearchKey: boolean;
  hasMasterKey: boolean;
  indexConfigured: boolean;
  totalDocuments?: number;
  stats?: any;
}> {
  const available = await checkMeilisearchHealth();
  let totalDocuments: number | undefined;
  let stats: any = undefined;

  if (available) {
    try {
      const cli = getMeilisearchClient();
      const index = cli.index(MEILISEARCH_INDEX_NAME);
      stats = await index.getStats();
      totalDocuments = stats.numberOfDocuments;
    } catch {}
  }

  return {
    available,
    host: MEILISEARCH_HOST,
    hasAdminKey: Boolean(MEILISEARCH_ADMIN_KEY),
    hasSearchKey: Boolean(MEILISEARCH_SEARCH_KEY),
    hasMasterKey: Boolean(MEILISEARCH_MASTER_KEY),
    indexConfigured: isIndexConfigured,
    totalDocuments,
    stats,
  };
}
