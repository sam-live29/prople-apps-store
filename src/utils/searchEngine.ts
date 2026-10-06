import { AppListing, AppDetails } from '../types';
import { getAppPublisherName } from './appMetricsAlgorithm';
import { 
  detectClientOS, 
  ClientOS, 
  isAndroidApp, 
  isWindowsApp, 
  isLinuxApp,
  isMacApp,
  isIOSApp
} from '../services/osDetectionService';

// Generic search stopwords to filter out when tokenizing queries
const STOPWORDS = new Set([
  'app',
  'apps',
  'application',
  'applications',
  'the',
  'a',
  'an',
  'and',
  'or',
  'for',
  'in',
  'on',
  'at',
  'to',
  'of',
  'with',
  'by',
  'from',
  'get',
  'give',
  'show',
  'me',
  'please',
  'i',
  'need',
  'want',
]);

// Semantic Category Intent Mapping
// Maps common user search phrases and keywords directly to catalog categories and concepts
export const CATEGORY_INTENT_MAP: Record<string, string[]> = {
  // Health & Fitness
  health: ['Health & Fitness', 'Medical', 'Sports', 'Lifestyle'],
  fitness: ['Health & Fitness', 'Sports', 'Lifestyle'],
  tracker: ['Health & Fitness', 'Tools', 'Productivity'],
  workout: ['Health & Fitness', 'Sports'],
  gym: ['Health & Fitness', 'Sports'],
  calorie: ['Health & Fitness', 'Medical'],
  diet: ['Health & Fitness', 'Food & Drink', 'Medical'],
  exercise: ['Health & Fitness', 'Sports'],
  running: ['Health & Fitness', 'Sports'],
  run: ['Health & Fitness', 'Sports'],
  sleep: ['Health & Fitness', 'Lifestyle', 'Medical'],
  water: ['Health & Fitness', 'Lifestyle'],
  heart: ['Health & Fitness', 'Medical'],
  medical: ['Medical', 'Health & Fitness'],

  // Food & Drink
  food: ['Food & Drink', 'Lifestyle'],
  recipe: ['Food & Drink', 'Lifestyle'],
  recipes: ['Food & Drink', 'Lifestyle'],
  cooking: ['Food & Drink'],
  cook: ['Food & Drink'],
  grocery: ['Food & Drink', 'Shopping'],
  restaurant: ['Food & Drink', 'Travel & Local'],
  meal: ['Food & Drink', 'Health & Fitness'],
  coffee: ['Food & Drink'],
  fastfood: ['Food & Drink'],

  // Productivity & Office
  productivity: ['Productivity', 'Business', 'Tools'],
  notes: ['Productivity', 'Tools'],
  note: ['Productivity', 'Tools'],
  memo: ['Productivity', 'Tools'],
  todo: ['Productivity', 'Tools'],
  task: ['Productivity', 'Tools'],
  tasks: ['Productivity', 'Tools'],
  calendar: ['Productivity'],
  organizer: ['Productivity', 'Lifestyle'],
  planner: ['Productivity', 'Lifestyle'],
  office: ['Productivity', 'Business'],
  document: ['Productivity', 'Business', 'Tools'],
  pdf: ['Productivity', 'Tools'],
  sheets: ['Productivity', 'Business'],

  // Tools & Utilities
  tool: ['Tools', 'Utilities', 'Productivity'],
  tools: ['Tools', 'Utilities', 'Productivity'],
  utility: ['Tools', 'Utilities'],
  utilities: ['Tools', 'Utilities'],
  calculator: ['Tools'],
  calc: ['Tools'],
  converter: ['Tools'],
  cleaner: ['Tools'],
  file: ['Tools', 'Productivity'],
  scanner: ['Tools', 'Productivity'],
  qr: ['Tools'],
  browser: ['Communication', 'Tools'],

  // Photography & Video
  photo: ['Photography', 'Video Players & Editors'],
  photos: ['Photography'],
  picture: ['Photography'],
  pictures: ['Photography'],
  camera: ['Photography', 'Video Players & Editors'],
  image: ['Photography'],
  images: ['Photography'],
  editor: ['Photography', 'Video Players & Editors', 'Tools'],
  filter: ['Photography'],
  video: ['Video Players & Editors', 'Entertainment'],
  videos: ['Video Players & Editors', 'Entertainment'],
  movie: ['Entertainment', 'Video Players & Editors'],
  movies: ['Entertainment', 'Video Players & Editors'],
  stream: ['Entertainment', 'Video Players & Editors'],

  // Music & Audio
  music: ['Music & Audio', 'Entertainment'],
  audio: ['Music & Audio'],
  song: ['Music & Audio'],
  songs: ['Music & Audio'],
  podcast: ['Music & Audio', 'News & Magazines'],
  radio: ['Music & Audio', 'News & Magazines'],
  mp3: ['Music & Audio', 'Tools'],

  // Finance & Crypto
  finance: ['Finance', 'Business'],
  money: ['Finance'],
  budget: ['Finance', 'Productivity'],
  expense: ['Finance'],
  wallet: ['Finance'],
  crypto: ['Finance'],
  bitcoin: ['Finance'],
  bank: ['Finance'],
  stock: ['Finance'],

  // Communication & Social
  chat: ['Communication', 'Social'],
  message: ['Communication', 'Social'],
  messaging: ['Communication', 'Social'],
  social: ['Social', 'Communication'],
  talk: ['Communication'],
  community: ['Social', 'Communication'],
  dating: ['Dating', 'Social'],

  // Games
  game: ['Games', 'Action', 'Adventure', 'Arcade', 'Puzzle', 'Casual', 'Simulation', 'Racing', 'RPG'],
  games: ['Games', 'Action', 'Adventure', 'Arcade', 'Puzzle', 'Casual', 'Simulation', 'Racing', 'RPG'],
  gaming: ['Games'],
  puzzle: ['Puzzle', 'Games', 'Casual'],
  racing: ['Racing', 'Games'],
  action: ['Action', 'Games'],
  arcade: ['Arcade', 'Games'],
  rpg: ['RPG', 'Games', 'Adventure'],
};

export interface ScoredAppResult {
  app: AppListing;
  score: number;
  matchReasons: string[];
  matchedRequirements: string[];
  isCompatible: boolean;
}

/**
 * Parses file size strings like "14.2 MB", "120 KB", "1.1 GB" into numerical megabytes
 */
export function parseSizeToMegabytes(sizeStr?: string): number | null {
  if (!sizeStr) return null;
  const match = sizeStr.match(/([\d.]+)\s*(gb|mb|kb|bytes|b)/i);
  if (!match) return null;
  const num = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  if (isNaN(num)) return null;
  if (unit === 'gb') return num * 1024;
  if (unit === 'mb') return num;
  if (unit === 'kb') return num / 1024;
  return num / (1024 * 1024);
}

/**
 * Tokenizes a query string, stripping punctuation and filtering generic stopwords.
 */
export function tokenizeQuery(rawQuery: string): string[] {
  if (!rawQuery) return [];
  const clean = rawQuery
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();

  return clean
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length >= 2 && !STOPWORDS.has(w));
}

/**
 * Calculates a Bayesian-weighted rating score for balanced app ranking.
 * Prevents a 5.0-star app with 1 rating from dominating an established 4.8-star app with 10k ratings.
 */
function calculateBayesianRating(rating: number, ratingsCount: number): number {
  if (rating <= 0) return 0;
  const minThreshold = 5;
  const storeMean = 3.8;
  const count = Math.max(0, ratingsCount);
  return (count / (count + minThreshold)) * rating + (minThreshold / (count + minThreshold)) * storeMean;
}

/**
 * Evaluates whether an app matches a search query using:
 *  1. Deep multi-attribute indexing of ALL publishing forma specifications
 *  2. Explicit user app requirements detection (offline, no ads, low storage, camera, no permissions, specific OS)
 *  3. Lexical & semantic scoring with token matching and synonym expansion
 *  4. Bayesian quality and engagement momentum
 *  5. Device OS compatibility weighting
 */
export function scoreAppForSearch(
  app: AppListing,
  query: string,
  options?: {
    clientOS?: ClientOS;
    appsMap?: Record<string, AppDetails>;
  }
): ScoredAppResult | null {
  const cleanQ = query.trim().toLowerCase();
  if (!cleanQ) return null;

  const clientOS = options?.clientOS || detectClientOS();
  const fullApp = options?.appsMap ? options.appsMap[app.id] : undefined;

  // ---------------------------------------------------------------------------
  // COMPLETE PUBLISHING FORMA ATTRIBUTES EXTRACTION & INDEXING
  // ---------------------------------------------------------------------------
  const appName = (app.name || '').toLowerCase();
  const appTagline = (app.tagline || (fullApp as any)?.tagline || (fullApp as any)?.shortDescription || '').toLowerCase();
  const appAbout = (app.aboutText || fullApp?.aboutText || (fullApp as any)?.description || '').toLowerCase();
  
  // Developer & Publisher fields
  const appDev = (app.developer || '').toLowerCase();
  const appPublisher = (
    (fullApp as any)?.publisherName || 
    (app as any)?.publisherName || 
    (fullApp as any)?.publishedBy || 
    (app as any)?.publishedBy || 
    fullApp?.developerInfo?.publisherName || 
    ''
  ).toLowerCase();
  const appDevEmail = (
    (fullApp as any)?.developerEmail || 
    (fullApp as any)?.publisherEmail || 
    fullApp?.developerInfo?.email || 
    ''
  ).toLowerCase();
  const appRepoOwner = (
    (fullApp as any)?.githubRepoOwner || 
    fullApp?.developerInfo?.githubRepoOwner || 
    ''
  ).toLowerCase();

  // Category & Taxonomy
  const appCat = (app.category || fullApp?.category || '').toLowerCase();
  const appTags = (
    Array.isArray((app as any).tags) 
      ? (app as any).tags 
      : Array.isArray(fullApp?.tags) 
      ? fullApp!.tags 
      : []
  ).map((t: any) => String(t).toLowerCase());

  // Package & Release Identity
  const packageName = ((fullApp as any)?.packageName || (app as any)?.packageName || (fullApp as any)?.assetName || '').toLowerCase();
  const releaseNotes = ((fullApp as any)?.releaseNotes || (fullApp as any)?.changelog || '').toLowerCase();
  const versionName = ((fullApp as any)?.versionName || (fullApp as any)?.releaseTag || '').toLowerCase();

  // System & OS Requirements
  const targetOs = ((fullApp as any)?.targetOs || (app as any)?.targetOs || '').toLowerCase();
  const minAndroid = ((fullApp as any)?.minAndroid || (fullApp as any)?.targetOs || '').toLowerCase();
  const minWindows = ((fullApp as any)?.minWindows || '').toLowerCase();
  const minLinux = ((fullApp as any)?.minLinux || '').toLowerCase();
  const platform = ((app.platform || fullApp?.platform || '') as string).toLowerCase();
  const packageFormat = ((app.packageFormat || fullApp?.packageFormat || '') as string).toLowerCase();
  const sizeString = app.size || fullApp?.size || '';
  const sizeMB = parseSizeToMegabytes(sizeString);

  // Permissions & Hardware Requirements
  const rawPermissions: string[] = [
    ...(Array.isArray(fullApp?.dataSafety?.permissions) ? fullApp!.dataSafety!.permissions : []),
    ...(Array.isArray((fullApp as any)?.permissionsRequired) ? (fullApp as any).permissionsRequired : []),
    ...(Array.isArray((app as any)?.permissions) ? (app as any).permissions : [])
  ].map(p => String(p).toLowerCase());

  // Security & Data Safety
  const securityPractices: string[] = (
    Array.isArray(fullApp?.dataSafety?.securityPractices) 
      ? fullApp!.dataSafety!.securityPractices 
      : []
  ).map(s => String(s).toLowerCase());
  const dataCollected: string[] = (
    Array.isArray(fullApp?.dataSafety?.dataCollected) 
      ? fullApp!.dataSafety!.dataCollected 
      : []
  ).map(d => String(d).toLowerCase());

  // Commercial & Content Ratings
  const containsAds = app.containsAds ?? fullApp?.containsAds ?? false;
  const inAppPurchases = (fullApp as any)?.inAppPurchases ?? false;
  const price = (app.price || fullApp?.price || 'Free').toLowerCase();
  const isFree = price === 'free' || price === '$0' || price === '0';
  const contentRating = (app.contentRating || fullApp?.contentRating || 'Rated for 3+').toLowerCase();

  // Features List
  const featuresList: string[] = (
    Array.isArray((fullApp as any)?.features) 
      ? (fullApp as any).features 
      : []
  ).map((f: any) => String(f).toLowerCase());

  // Package & Platform determination
  const isAnd = isAndroidApp(app) || platform === 'android' || packageFormat === 'apk';
  const isWin = isWindowsApp(app) || platform === 'windows' || packageFormat === 'exe' || packageFormat === 'msi';
  const isLin = isLinuxApp(app) || platform === 'linux' || packageFormat === 'deb' || packageFormat === 'appimage';
  const isMac = isMacApp(app) || platform === 'mac' || packageFormat === 'dmg' || packageFormat === 'pkg';
  const isIos = isIOSApp(app) || platform === 'ios' || packageFormat === 'ipa';
  const isWeb = app.type === 'webapp' || platform === 'web' || platform === 'multiplatform' || packageFormat === 'web' || packageFormat === 'pwa';

  // Device compatibility
  let isCompatible = true;
  if (clientOS === 'android') {
    isCompatible = isAnd || isWeb;
  } else if (clientOS === 'windows') {
    isCompatible = isWin || isWeb;
  } else if (clientOS === 'linux') {
    isCompatible = isLin || isWeb;
  } else if (clientOS === 'macos' || (clientOS as any) === 'mac') {
    isCompatible = isMac || isWeb;
  } else if (clientOS === 'ios') {
    isCompatible = isIos || isWeb;
  }

  let score = 0;
  const matchReasons: string[] = [];
  const matchedRequirements: string[] = [];

  const isPublisherSearch = cleanQ.startsWith('pub:') || cleanQ.startsWith('publisher:');
  const targetQ = isPublisherSearch
    ? (cleanQ.startsWith('pub:') ? cleanQ.slice(4).trim() : cleanQ.slice(10).trim())
    : cleanQ;

  // ===========================================================================
  // 1. EXACT & PREFIX IDENTITY MATCHING (Highest Priority in App Store Search)
  // When a user searches for an app (e.g. "AdMob", "Lumina Reader"), the actual
  // app matching by name MUST ALWAYS appear first above any developer/publisher.
  // ===========================================================================
  const cleanTargetQNoSpaces = targetQ.replace(/[^a-z0-9]/g, '');
  const appNameNoSpaces = appName.replace(/[^a-z0-9]/g, '');

  if (!isPublisherSearch) {
    if (appName === targetQ) {
      score += 50000;
      matchReasons.push('Exact app name match');
    } else if (appNameNoSpaces && cleanTargetQNoSpaces && appNameNoSpaces === cleanTargetQNoSpaces) {
      score += 45000;
      matchReasons.push('Exact app name match');
    } else if (appName.startsWith(targetQ)) {
      score += 30000;
      matchReasons.push('Name starts with query');
    } else if (appName.includes(targetQ)) {
      score += 20000;
      matchReasons.push('Name contains query');
    } else if (appNameNoSpaces && cleanTargetQNoSpaces && (appNameNoSpaces.includes(cleanTargetQNoSpaces) || cleanTargetQNoSpaces.includes(appNameNoSpaces))) {
      score += 15000;
      matchReasons.push('Name matches query');
    }

    // Package name match (e.g. searching "com.example.app")
    if (packageName && (packageName === targetQ || packageName.includes(targetQ))) {
      score += 18000;
      matchReasons.push('Package ID match');
    }
  }

  // ===========================================================================
  // 2. DEVELOPER & PUBLISHER MATCHING
  // If the query is an explicit publisher search (pub:...), publisher matches get top tier.
  // In general searches, publisher match is a secondary signal and NEVER overrides the actual app name.
  // ===========================================================================
  const canonicalPub = getAppPublisherName(app).toLowerCase().trim();
  const appDevNoSpaces = appDev.replace(/[^a-z0-9]/g, '');
  const appPubNoSpaces = appPublisher.replace(/[^a-z0-9]/g, '');
  const canonicalPubNoSpaces = canonicalPub.replace(/[^a-z0-9]/g, '');

  const isExactPublisher =
    (appDev && appDev === targetQ) ||
    (appPublisher && appPublisher === targetQ) ||
    (canonicalPub && canonicalPub === targetQ) ||
    (cleanTargetQNoSpaces.length >= 3 && (
      (appDevNoSpaces && appDevNoSpaces === cleanTargetQNoSpaces) ||
      (appPubNoSpaces && appPubNoSpaces === cleanTargetQNoSpaces) ||
      (canonicalPubNoSpaces && canonicalPubNoSpaces === cleanTargetQNoSpaces)
    ));

  const isPartialPublisher = !isExactPublisher && cleanTargetQNoSpaces.length >= 4 && (
    (appDev && appDev.includes(targetQ)) ||
    (appPublisher && appPublisher.includes(targetQ)) ||
    (canonicalPub && canonicalPub.includes(targetQ)) ||
    (appDevNoSpaces && appDevNoSpaces.includes(cleanTargetQNoSpaces)) ||
    (appPubNoSpaces && appPubNoSpaces.includes(cleanTargetQNoSpaces)) ||
    (canonicalPubNoSpaces && canonicalPubNoSpaces.includes(cleanTargetQNoSpaces))
  );

  if (isPublisherSearch) {
    if (isExactPublisher) {
      score += 50000;
      matchReasons.push(`Published by ${app.developer || canonicalPub || 'Publisher'}`);
    } else if (isPartialPublisher) {
      score += 25000;
      matchReasons.push('Developer / Publisher match');
    }
  } else {
    // In general search, publisher matches are secondary signals
    if (isExactPublisher) {
      score += 3500;
      matchReasons.push(`Published by ${app.developer || canonicalPub || 'Publisher'}`);
    } else if (isPartialPublisher) {
      score += 1200;
      matchReasons.push('Developer / Publisher match');
    } else if ((appRepoOwner && appRepoOwner.includes(targetQ)) || (appDevEmail && appDevEmail.includes(targetQ))) {
      score += 800;
      matchReasons.push('Developer credentials match');
    }
  }

  // ===========================================================================
  // 3. CATEGORY DIRECT MATCH
  // ===========================================================================
  if (appCat === cleanQ) {
    score += 400;
    matchReasons.push(`Category: ${app.category}`);
  } else if (appCat.includes(cleanQ) || cleanQ.includes(appCat)) {
    score += 260;
    matchReasons.push(`Category match`);
  }

  // ===========================================================================
  // 4. ACCURATE APPS REQUIREMENT INTENT MATCHING
  // Analyzes user queries for technical and functional app requirements
  // ===========================================================================

  // Requirement A: Offline / No Internet
  const isOfflineQuery = 
    cleanQ.includes('offline') || 
    cleanQ.includes('no internet') || 
    cleanQ.includes('without internet') || 
    cleanQ.includes('no wifi') || 
    cleanQ.includes('standalone');

  if (isOfflineQuery) {
    const isOfflineCapable = 
      appTags.some(t => t.includes('offline')) ||
      appAbout.includes('offline') ||
      appTagline.includes('offline') ||
      featuresList.some(f => f.includes('offline')) ||
      rawPermissions.length === 0 || // zero permissions means completely offline
      !rawPermissions.some(p => p.includes('internet') || p.includes('network'));

    if (isOfflineCapable) {
      score += 450;
      matchReasons.push('Meets offline requirement');
      matchedRequirements.push('Works Offline');
    }
  }

  // Requirement B: Ad-Free (No Ads)
  const isAdFreeQuery = 
    cleanQ.includes('no ad') || 
    cleanQ.includes('no ads') || 
    cleanQ.includes('ad free') || 
    cleanQ.includes('adfree') || 
    cleanQ.includes('without ads');

  if (isAdFreeQuery) {
    if (!containsAds) {
      score += 400;
      matchReasons.push('Ad-free verified');
      matchedRequirements.push('No Ads');
    } else {
      score -= 300; // Demote apps containing ads when user explicitly asks for no ads
    }
  }

  // Requirement C: Completely Free / No In-App Purchases
  const isFreeNoIapQuery = 
    cleanQ.includes('no in app') || 
    cleanQ.includes('no iap') || 
    cleanQ.includes('completely free') || 
    cleanQ.includes('100% free');

  if (isFreeNoIapQuery) {
    if (isFree && !inAppPurchases) {
      score += 380;
      matchReasons.push('100% Free • No in-app purchases');
      matchedRequirements.push('No In-App Purchases');
    }
  }

  // Requirement D: Zero Permissions / Privacy-Safe Permissions
  const isNoPermsQuery = 
    cleanQ.includes('no perm') || 
    cleanQ.includes('zero perm') || 
    cleanQ.includes('safe perm') || 
    cleanQ.includes('no access');

  if (isNoPermsQuery) {
    const hasZeroPerms = 
      rawPermissions.length === 0 || 
      rawPermissions.some(p => p.includes('no perm') || p.includes('zero') || p.includes('none'));
    if (hasZeroPerms) {
      score += 450;
      matchReasons.push('No permissions required');
      matchedRequirements.push('Zero Permissions');
    }
  }

  // Requirement E: Hardware / Sensor Requirements (Camera, Scanner, GPS, Mic)
  const isCameraQuery = cleanQ.includes('camera') || cleanQ.includes('scanner') || cleanQ.includes('photo');
  if (isCameraQuery) {
    const hasCameraFeature = 
      rawPermissions.some(p => p.includes('camera')) ||
      appCat.includes('photography') ||
      appTags.some(t => t.includes('camera') || t.includes('scan')) ||
      appAbout.includes('camera') ||
      featuresList.some(f => f.includes('camera') || f.includes('scanner'));

    if (hasCameraFeature) {
      score += 320;
      matchReasons.push('Supports camera & optical scanning');
      matchedRequirements.push('Camera Ready');
    }
  }

  const isAudioQuery = cleanQ.includes('mic') || cleanQ.includes('audio') || cleanQ.includes('voice') || cleanQ.includes('recorder');
  if (isAudioQuery) {
    const hasAudioFeature = 
      rawPermissions.some(p => p.includes('audio') || p.includes('record') || p.includes('mic')) ||
      appCat.includes('audio') ||
      appTags.some(t => t.includes('audio') || t.includes('sound') || t.includes('voice')) ||
      appAbout.includes('audio') ||
      featuresList.some(f => f.includes('mic') || f.includes('audio'));

    if (hasAudioFeature) {
      score += 320;
      matchReasons.push('Supports audio & microphone input');
      matchedRequirements.push('Audio Support');
    }
  }

  // Requirement F: Lightweight / Package Size Requirement
  const isLightweightQuery = 
    cleanQ.includes('lightweight') || 
    cleanQ.includes('lite') || 
    cleanQ.includes('small size') || 
    cleanQ.includes('low storage') || 
    cleanQ.includes('low ram') ||
    cleanQ.includes('under 10mb') || 
    cleanQ.includes('under 20mb') || 
    cleanQ.includes('under 50mb') || 
    cleanQ.includes('under 100mb');

  if (isLightweightQuery) {
    let sizeLimit = 50; // default 50 MB
    if (cleanQ.includes('under 10mb')) sizeLimit = 10;
    else if (cleanQ.includes('under 20mb')) sizeLimit = 20;
    else if (cleanQ.includes('under 50mb')) sizeLimit = 50;
    else if (cleanQ.includes('under 100mb')) sizeLimit = 100;

    if (sizeMB !== null && sizeMB <= sizeLimit) {
      score += 380;
      matchReasons.push(`Lightweight package (${sizeString})`);
      matchedRequirements.push(`Small Size (${sizeString})`);
    } else if (appTags.some(t => t.includes('lite') || t.includes('lightweight')) || appName.includes('lite')) {
      score += 320;
      matchReasons.push('Optimized lite edition');
      matchedRequirements.push('Lite Edition');
    }
  }

  // Requirement G: OS & Architecture Requirements
  const userRequestedAndroid = cleanQ.includes('android') || cleanQ.includes('apk') || cleanQ.includes('aab');
  const userRequestedWindows = cleanQ.includes('windows') || cleanQ.includes('exe') || cleanQ.includes('msi') || cleanQ.includes('pc');
  const userRequestedLinux = cleanQ.includes('linux') || cleanQ.includes('deb') || cleanQ.includes('appimage') || cleanQ.includes('ubuntu');
  const userRequestedMac = cleanQ.includes('mac') || cleanQ.includes('macos') || cleanQ.includes('dmg') || cleanQ.includes('pkg') || cleanQ.includes('apple') || cleanQ.includes('darwin');

  if (userRequestedMac) {
    if (isMac) {
      score += 450;
      matchReasons.push('Native macOS application (.dmg / .pkg)');
      matchedRequirements.push('macOS Ready');
    }
  }

  // Specific Android Version Check (e.g. "android 11", "android 10", "android 8")
  const androidVerMatch = cleanQ.match(/android\s*(\d+)/i);
  if (androidVerMatch) {
    const verNum = parseInt(androidVerMatch[1], 10);
    if (minAndroid.includes(`android ${verNum}`) || targetOs.includes(`android ${verNum}`) || minAndroid.includes(`${verNum}`)) {
      score += 300;
      matchReasons.push(`Verified for Android ${verNum}+`);
      matchedRequirements.push(`Android ${verNum}+ Supported`);
    }
  }

  // Requirement H: Open Source & Security Audit
  const isOpenSourceQuery = 
    cleanQ.includes('open source') || 
    cleanQ.includes('opensource') || 
    cleanQ.includes('foss') || 
    cleanQ.includes('audited') || 
    cleanQ.includes('privacy') || 
    cleanQ.includes('encrypted');

  if (isOpenSourceQuery) {
    const isOSS = 
      Boolean(fullApp?.githubRepo || (app as any).githubRepo || appRepoOwner) ||
      securityPractices.some(s => s.includes('open-source') || s.includes('audit')) ||
      appTags.some(t => t.includes('open source') || t.includes('foss'));

    const isEncrypted = securityPractices.some(s => s.includes('encrypt'));

    if (isOSS) {
      score += 380;
      matchReasons.push('Open-source audited codebase');
      matchedRequirements.push('Open Source');
    }
    if (isEncrypted) {
      score += 250;
      matchReasons.push('End-to-end encrypted storage');
      matchedRequirements.push('Encrypted');
    }
  }

  // Requirement I: Family & Child Safety
  const isFamilyQuery = cleanQ.includes('kid') || cleanQ.includes('kids') || cleanQ.includes('family') || cleanQ.includes('children');
  if (isFamilyQuery) {
    if (contentRating.includes('3+') || contentRating.includes('everyone')) {
      score += 300;
      matchReasons.push('Rated for Everyone / Family friendly');
      matchedRequirements.push('Family Friendly');
    } else {
      score -= 400; // Filter or heavily demote mature apps
    }
  }

  // ===========================================================================
  // 5. TOKENIZED MULTI-WORD SEMANTIC SEARCH ACROSS ALL FORMA FIELDS
  // ===========================================================================
  const tokens = tokenizeQuery(cleanQ);
  if (tokens.length > 0) {
    let tokensMatchedCount = 0;

    for (const token of tokens) {
      let tokenMatched = false;

      // Token in App Name
      if (appName.includes(token)) {
        score += 8000;
        tokenMatched = true;
      }

      // Token in Developer / Publisher
      if (appDev.includes(token) || appPublisher.includes(token)) {
        score += isPublisherSearch ? 8000 : 400;
        tokenMatched = true;
      }

      // Token in Category
      if (appCat.includes(token)) {
        score += 1500;
        tokenMatched = true;
      }

      // Token in Tags
      if (appTags.some(t => t.includes(token))) {
        score += 1200;
        tokenMatched = true;
      }

      // Token in Tagline
      if (appTagline.includes(token)) {
        score += 800;
        tokenMatched = true;
      }

      // Token in Features
      if (featuresList.some(f => f.includes(token))) {
        score += 600;
        tokenMatched = true;
      }

      // Token in Technical Requirements (targetOs, minAndroid, platform)
      if (targetOs.includes(token) || minAndroid.includes(token) || platform.includes(token) || packageFormat.includes(token)) {
        score += 70;
        tokenMatched = true;
      }

      // Token in Permissions
      if (rawPermissions.some(p => p.includes(token))) {
        score += 60;
        tokenMatched = true;
      }

      // Token in Release Notes
      if (releaseNotes.includes(token) || versionName.includes(token)) {
        score += 50;
        tokenMatched = true;
      }

      // Token in About Description
      if (appAbout.includes(token)) {
        score += 40;
        tokenMatched = true;
      }

      // Semantic Category Intent Mapping (e.g. "health" -> "Health & Fitness", "food" -> "Food & Drink")
      const mappedCats = CATEGORY_INTENT_MAP[token];
      if (mappedCats && mappedCats.some(c => appCat.includes(c.toLowerCase()) || c.toLowerCase().includes(appCat))) {
        score += 160;
        tokenMatched = true;
        matchReasons.push(`Matches ${token} category`);
      }

      if (tokenMatched) {
        tokensMatchedCount++;
      }
    }

    // Significant bonus if ALL query tokens matched across publishing forma
    if (tokensMatchedCount === tokens.length && tokens.length > 1) {
      score += 280;
      matchReasons.push('Matches all query terms');
    }
  }

  // If no relevance score was achieved, this app does not match
  if (score <= 0) {
    return null;
  }

  // ===========================================================================
  // 6. POPULARITY & BAYESIAN QUALITY SIGNAL BOOST
  // ===========================================================================
  const downloads = app.downloadsCount || fullApp?.downloadsCount || 0;
  if (downloads > 0) {
    score += Math.min(80, Math.log10(downloads + 1) * 20);
  }

  const rawRating = app.rating ?? fullApp?.rating ?? 0;
  const ratingsCount = app.ratingsCount ?? fullApp?.ratingsCount ?? (downloads > 50 ? 8 : 1);
  if (rawRating > 0) {
    const bayesianRating = calculateBayesianRating(rawRating, ratingsCount);
    score += bayesianRating * 12;
  }

  // Quality & Completeness Signal (Rich media, Verified Developer)
  if (fullApp?.screenshots && fullApp.screenshots.length >= 3) {
    score += 25; // Completeness bonus
  }
  if ((fullApp as any)?.keystoreFingerprint || app.isVerified) {
    score += 35; // Cryptographic developer identity verified
  }

  // ===========================================================================
  // 7. DEVICE COMPATIBILITY RE-RANKING
  // ===========================================================================
  if (clientOS === 'android') {
    if (userRequestedWindows) {
      if (isWin) score += 350;
    } else if (userRequestedLinux) {
      if (isLin) score += 350;
    } else if (userRequestedMac) {
      if (isMac) score += 350;
    } else {
      if (isAnd) score += 250;
      else if (isWeb) score += 140;
      else score -= 400; // Incompatible desktop package on Android mobile
    }
  } else if (clientOS === 'windows') {
    if (userRequestedAndroid) {
      if (isAnd) score += 350;
    } else if (userRequestedLinux) {
      if (isLin) score += 350;
    } else if (userRequestedMac) {
      if (isMac) score += 350;
    } else {
      if (isWin) score += 250;
      else if (isWeb) score += 140;
      else score -= 400;
    }
  } else if (clientOS === 'linux') {
    if (userRequestedAndroid) {
      if (isAnd) score += 350;
    } else if (userRequestedWindows) {
      if (isWin) score += 350;
    } else if (userRequestedMac) {
      if (isMac) score += 350;
    } else {
      if (isLin) score += 250;
      else if (isWeb) score += 140;
      else score -= 400;
    }
  } else if (clientOS === 'macos' || (clientOS as any) === 'mac') {
    if (userRequestedAndroid) {
      if (isAnd) score += 350;
    } else if (userRequestedWindows) {
      if (isWin) score += 350;
    } else if (userRequestedLinux) {
      if (isLin) score += 350;
    } else {
      if (isMac) score += 250;
      else if (isWeb) score += 140;
      else score -= 400;
    }
  }

  return {
    app,
    score,
    matchReasons: Array.from(new Set(matchReasons)),
    matchedRequirements: Array.from(new Set(matchedRequirements)),
    isCompatible,
  };
}

/**
 * Searches and ranks store applications with complete publishing forma indexing,
 * deep requirement matching, and device compatibility awareness.
 */
export function rankAppsForSearch(
  apps: AppListing[],
  query: string,
  options?: {
    clientOS?: ClientOS;
    appsMap?: Record<string, AppDetails>;
  }
): AppListing[] {
  const cleanQ = (query || '').trim();
  if (!cleanQ) return apps;

  const scoredResults: ScoredAppResult[] = [];

  for (const app of apps) {
    const result = scoreAppForSearch(app, cleanQ, options);
    if (result && result.score > 0) {
      scoredResults.push(result);
    }
  }

  // Sort by relevance score descending strictly by true search relevance
  scoredResults.sort((a, b) => b.score - a.score);

  return scoredResults.map(r => r.app);
}

/**
 * Enhanced search returning rich scored results containing requirement badges
 * and matching explanations.
 */
export function searchAppsWithRequirements(
  apps: AppListing[],
  query: string,
  options?: {
    clientOS?: ClientOS;
    appsMap?: Record<string, AppDetails>;
  }
): ScoredAppResult[] {
  const cleanQ = (query || '').trim();
  if (!cleanQ) return [];

  const scoredResults: ScoredAppResult[] = [];

  for (const app of apps) {
    const result = scoreAppForSearch(app, cleanQ, options);
    if (result && result.score > 0) {
      scoredResults.push(result);
    }
  }

  scoredResults.sort((a, b) => b.score - a.score);
  return scoredResults;
}
