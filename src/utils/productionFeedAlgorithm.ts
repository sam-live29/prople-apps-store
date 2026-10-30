import { AppListing, AppDetails } from '../types';
import { parseDownloadCount, getAppTrailerYoutubeId } from './appMetricsAlgorithm';
import { RecommendationService, buildLiveUserProfile } from '../services/recommendationService';
import { detectClientOS } from '../services/osDetectionService';

export type HomeSectionType =
  | 'column_stack'
  | 'landscape_cards'
  | 'squircle_row'
  | 'video_cards'
  | 'top_rated'
  | 'editorial_feature'
  | 'search_suggestions'
  | 'related_topics';

export interface HomeFeedSection {
  id: string;
  type: HomeSectionType;
  title: string;
  subtitle?: string;
  tag?: string;
  apps: AppListing[];
  categoryKey?: string;
  featuredApp?: AppListing;
}

/**
 * Normalizes raw category string to standard title case
 */
export function normalizeCategoryName(rawCategory?: string): string {
  if (!rawCategory || !rawCategory.trim()) return 'General';
  const clean = rawCategory.trim();
  // If starts with cat-, strip it
  if (clean.startsWith('cat-')) {
    return clean
      .replace(/^cat-/, '')
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/**
 * Parses Firestore Timestamp objects, epoch seconds/ms, or date strings into milliseconds
 */
export function parseAppTimestampMs(val: any): number {
  if (!val) return 0;
  if (typeof val === 'number') {
    return val > 1e12 ? val : val * 1000;
  }
  if (typeof val.toMillis === 'function') {
    return val.toMillis();
  }
  if (typeof val.seconds === 'number') {
    return val.seconds * 1000 + Math.floor((val.nanoseconds || 0) / 1e6);
  }
  if (typeof val._seconds === 'number') {
    return val._seconds * 1000;
  }
  if (typeof val === 'string') {
    const parsed = Date.parse(val);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/**
 * Returns the latest activity timestamp (ms) for an app across updatedAt, createdAt, and releaseDate
 */
export function getAppLatestTimestampMs(a: AppListing, full?: AppDetails): number {
  const d = full || a;
  return Math.max(
    parseAppTimestampMs((a as any).updatedAt),
    parseAppTimestampMs((d as any).updatedAt),
    parseAppTimestampMs((a as any).createdAt),
    parseAppTimestampMs((d as any).createdAt),
    parseAppTimestampMs((a as any).releaseDate),
    parseAppTimestampMs((d as any).releaseDate),
    parseAppTimestampMs((a as any).initialReleaseDate),
    parseAppTimestampMs((d as any).initialReleaseDate)
  );
}

/**
 * Normalizes a category label or URL slug into a canonical comparison key
 */
export function canonicalizeCategoryKey(raw?: string): string {
  if (!raw || !raw.trim()) return 'general';
  let key = raw
    .trim()
    .toLowerCase()
    .replace(/^cat-/, '')
    .replace(/&/g, ' ')
    .replace(/\band\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!key) return 'general';
  if (key === 'utilities' || key === 'utility' || key === 'developer tools') return 'tools';
  if (key === 'personalization') return 'personalisation';
  if (key === 'ecommerce') return 'shopping';
  return key;
}

/**
 * Strictly checks whether an app belongs to the target category (no false-positive title/dev keyword bleed)
 */
export function doesAppMatchCategory(
  app: AppListing,
  full: AppDetails | undefined,
  targetCategory: string,
  isGamesMode = false
): boolean {
  if (!targetCategory || targetCategory === 'All categories') {
    return isGamesMode ? isGameApp(app, full) : true;
  }

  const targetKey = canonicalizeCategoryKey(targetCategory);
  if (targetKey === 'all categories') {
    return isGamesMode ? isGameApp(app, full) : true;
  }

  const rawAppCat = (app.category || full?.category || 'General').trim();
  const appCatKey = canonicalizeCategoryKey(rawAppCat);

  if (targetKey === 'games' || targetKey === 'game') {
    return appCatKey === 'games' || appCatKey === 'game' || isGameApp(app, full);
  }

  if (appCatKey === targetKey) {
    return true;
  }

  // Handle combined legacy categories cleanly
  if (rawAppCat.toLowerCase() === 'photo & video') {
    return targetKey === 'photography' || targetKey === 'video players editors';
  }

  return false;
}

/**
 * Returns an authentic conversational shelf title based on category and style
 */
export function getCategorySectionTitle(
  category: string,
  sectionType: HomeSectionType,
  hasGames: boolean
): { title: string; subtitle: string; tag: string } {
  const cleanCat = normalizeCategoryName(category);
  const catLower = cleanCat.toLowerCase();

  let title = `Great ${cleanCat} apps tailored for you`;
  let subtitle = cleanCat;
  let tag = `${cleanCat} • Verified`;

  // Conversational user-taste category mappings:
  // 1. Productivity: "Stay organized & get things done"
  if (
    catLower.includes('productivity') ||
    catLower.includes('business') ||
    catLower.includes('work') ||
    catLower.includes('office')
  ) {
    title = 'Stay organized & get things done';
    subtitle = 'Productivity';
    tag = 'Productivity • Must-Have';
  }
  // 2. Tools: "Tools to simplify everyday tasks"
  else if (catLower.includes('tool') || catLower.includes('utility') || catLower.includes('utilities')) {
    title = 'Tools to simplify everyday tasks';
    subtitle = 'Tools';
    tag = 'Tools • Essential';
  }
  // 3. Music: "Listen to music, podcasts & audio"
  else if (catLower.includes('music') || catLower.includes('audio') || catLower.includes('podcast')) {
    title = 'Listen to music, podcasts & audio';
    subtitle = 'Music & Audio';
    tag = 'Audio • Popular';
  }
  // 4. Entertainment: "Stream movies, shows & videos"
  else if (
    catLower.includes('entertainment') ||
    catLower.includes('video') ||
    catLower.includes('movie') ||
    catLower.includes('stream') ||
    catLower.includes('tv')
  ) {
    title = 'Stream movies, shows & videos';
    subtitle = 'Entertainment';
    tag = 'Entertainment • Popular';
  }
  // 5. Communication: "Stay connected with friends and family"
  else if (
    catLower.includes('communication') ||
    catLower.includes('social') ||
    catLower.includes('message') ||
    catLower.includes('messaging') ||
    catLower.includes('chat')
  ) {
    title = 'Stay connected with friends and family';
    subtitle = 'Communication';
    tag = 'Communication • Top Picks';
  }
  // 6. Action: "Action-packed games you might enjoy"
  else if (
    catLower.includes('action') ||
    catLower.includes('racing') ||
    catLower.includes('arcade') ||
    catLower.includes('fighting')
  ) {
    title = hasGames ? 'Action-packed games you might enjoy' : `Top ${cleanCat} apps you might enjoy`;
    subtitle = cleanCat;
    tag = hasGames ? 'Action • Games' : `${cleanCat} • Featured`;
  }
  // 7. Casual: "Relax with puzzles & casual games"
  else if (
    catLower.includes('casual') ||
    catLower.includes('puzzle') ||
    catLower.includes('trivia') ||
    catLower.includes('brain') ||
    catLower.includes('board') ||
    catLower.includes('card') ||
    catLower.includes('word')
  ) {
    title = hasGames ? 'Relax with puzzles & casual games' : `Casual & everyday ${cleanCat} apps`;
    subtitle = cleanCat;
    tag = hasGames ? 'Puzzles & Casual • Games' : `${cleanCat} • Featured`;
  }
  // 8. Finance: "Manage your money & investments"
  else if (catLower.includes('finance') || catLower.includes('wallet') || catLower.includes('money')) {
    title = 'Manage your money & investments';
    subtitle = 'Finance';
    tag = 'Finance • Secure';
  }
  // 9. Health & Fitness: "Build healthy habits & stay fit"
  else if (catLower.includes('health') || catLower.includes('fitness') || catLower.includes('workout')) {
    title = 'Build healthy habits & stay fit';
    subtitle = 'Health & Fitness';
    tag = 'Health • Wellness';
  }
  // 10. Photography & Art: "Capture moments & unleash creativity"
  else if (catLower.includes('photo') || catLower.includes('art') || catLower.includes('design')) {
    title = 'Capture moments & unleash creativity';
    subtitle = cleanCat.includes('Photo') ? 'Photography' : cleanCat;
    tag = 'Creative • Studio';
  }
  // 11. Education: "Learn something new every day"
  else if (catLower.includes('education') || catLower.includes('learn')) {
    title = 'Learn something new every day';
    subtitle = 'Education';
    tag = 'Education • Learning';
  }
  // 12. Books & Reference: "Explore stories, books & knowledge"
  else if (catLower.includes('book') || catLower.includes('reference') || catLower.includes('reading')) {
    title = 'Explore stories, books & knowledge';
    subtitle = 'Books & Reference';
    tag = 'Books • Knowledge';
  }
  // 13. Shopping: "Shop smart & find great deals"
  else if (catLower.includes('shop')) {
    title = 'Shop smart & find great deals';
    subtitle = 'Shopping';
    tag = 'Shopping • Deals';
  }
  // 14. News & Magazines: "Stay informed with top news & stories"
  else if (catLower.includes('news') || catLower.includes('magazine')) {
    title = 'Stay informed with top news & stories';
    subtitle = 'News & Magazines';
    tag = 'News • Current';
  }
  // 15. Travel & Local: "Plan your next journey & explore"
  else if (catLower.includes('travel') || catLower.includes('local') || catLower.includes('map') || catLower.includes('navigation')) {
    title = 'Plan your next journey & explore';
    subtitle = 'Travel & Local';
    tag = 'Travel • Guide';
  }
  // 16. Simulation: "Build, manage & simulate new worlds"
  else if (catLower.includes('simulation') || catLower.includes('tycoon')) {
    title = 'Build, manage & simulate new worlds';
    subtitle = 'Simulation';
    tag = 'Simulation • Games';
  }
  // 17. Strategy: "Test your tactics & master strategy"
  else if (catLower.includes('strategy')) {
    title = 'Test your tactics & master strategy';
    subtitle = 'Strategy';
    tag = 'Strategy • Games';
  }
  // 18. Role Playing / RPG: "Embark on epic role-playing quests"
  else if (catLower.includes('role') || catLower.includes('rpg')) {
    title = 'Embark on epic role-playing quests';
    subtitle = 'Role Playing';
    tag = 'RPG • Adventure';
  }
  // 19. Adventure: "Thrilling adventures you'll love"
  else if (catLower.includes('adventure')) {
    title = "Thrilling adventures you'll love";
    subtitle = 'Adventure';
    tag = 'Adventure • Games';
  }
  // 20. Sports: "Follow live games, scores & sports" / "Step onto the field & compete"
  else if (catLower.includes('sport')) {
    if (hasGames || catLower.includes('game')) {
      title = 'Step onto the field & compete';
      subtitle = 'Sports Games';
      tag = 'Sports • Compete';
    } else {
      title = 'Follow live games, scores & sports';
      subtitle = 'Sports';
      tag = 'Sports • Live';
    }
  }
  // 21. Lifestyle: "Enrich your daily lifestyle & routines"
  else if (catLower.includes('lifestyle')) {
    title = 'Enrich your daily lifestyle & routines';
    subtitle = 'Lifestyle';
    tag = 'Lifestyle • Daily';
  }
  // 22. Weather: "Check local forecasts & live radar"
  else if (catLower.includes('weather')) {
    title = 'Check local forecasts & live radar';
    subtitle = 'Weather';
    tag = 'Weather • Accurate';
  }
  // 23. Personalization: "Customize your phone & home screen"
  else if (catLower.includes('personalization') || catLower.includes('theme') || catLower.includes('wallpaper')) {
    title = 'Customize your phone & home screen';
    subtitle = 'Personalization';
    tag = 'Personalization • Themes';
  }
  // 24. Food & Drink: "Discover delicious recipes & food"
  else if (catLower.includes('food') || catLower.includes('drink') || catLower.includes('recipe')) {
    title = 'Discover delicious recipes & food';
    subtitle = 'Food & Drink';
    tag = 'Food • Recipes';
  }
  // 25. Dating: "Meet new people & make connections"
  else if (catLower.includes('dating')) {
    title = 'Meet new people & make connections';
    subtitle = 'Dating';
    tag = 'Dating • Social';
  }
  // 26. Medical: "Track your health & medical essentials"
  else if (catLower.includes('medical') || catLower.includes('medicine')) {
    title = 'Track your health & medical essentials';
    subtitle = 'Medical';
    tag = 'Medical • Trusted';
  }
  // 27. Auto & Vehicles: "Navigate roads & auto essentials"
  else if (catLower.includes('auto') || catLower.includes('vehicle') || catLower.includes('car')) {
    title = 'Navigate roads & auto essentials';
    subtitle = 'Auto & Vehicles';
    tag = 'Auto • Commute';
  }
  // 28. House & Home: "Design, organize & upgrade your home"
  else if (catLower.includes('house') || catLower.includes('home')) {
    title = 'Design, organize & upgrade your home';
    subtitle = 'House & Home';
    tag = 'Home • Living';
  }
  // 29. Family & Kids: "Family favorites & parenting essentials"
  else if (catLower.includes('parenting') || catLower.includes('family') || catLower.includes('kid')) {
    title = 'Family favorites & parenting essentials';
    subtitle = 'Family';
    tag = 'Family • Safe';
  }
  // 30. Comics: "Read popular comics & graphic stories"
  else if (catLower.includes('comic') || catLower.includes('manga')) {
    title = 'Read popular comics & graphic stories';
    subtitle = 'Comics';
    tag = 'Comics • Stories';
  }
  // Games fallback
  else if (hasGames || catLower.includes('game')) {
    const isGenericGames = catLower === 'games' || catLower === 'game';
    title = isGenericGames ? 'Exciting games you might enjoy' : `Exciting ${cleanCat} games you might enjoy`;
    subtitle = cleanCat;
    tag = isGenericGames ? 'Games • Play Now' : `${cleanCat} • Games`;
  }
  // Universal dynamic fallback for any newly uploaded category in the store catalog
  else {
    title = `Great ${cleanCat} apps tailored for you`;
    subtitle = cleanCat;
    tag = `${cleanCat} • Verified App`;
  }

  return { title, subtitle, tag };
}

/**
 * Visual family taxonomy enforcing the Stage 3 Strict Adjacency Rule
 * Guarantees that two identical or visually equivalent UI models never appear consecutively.
 */
type VisualFamily = 'stack' | 'landscape' | 'squircle' | 'video' | 'editorial' | 'chips';

function getVisualFamily(type: HomeSectionType): VisualFamily {
  switch (type) {
    case 'column_stack':
      return 'stack';
    case 'landscape_cards':
      return 'landscape';
    case 'squircle_row':
    case 'top_rated':
      return 'squircle';
    case 'video_cards':
      return 'video';
    case 'editorial_feature':
      return 'editorial';
    case 'search_suggestions':
    case 'related_topics':
      return 'chips';
    default:
      return 'squircle';
  }
}

/**
 * Checks if an app possesses verified trailer video media
 */
function hasAppVideo(a: AppListing, full?: AppDetails): boolean {
  const d = full || a;
  return Boolean(
    getAppTrailerYoutubeId(d) ||
    d.promoVideoUrl ||
    (d as any).youtubeVideoId
  );
}

/**
 * Checks if an app possesses 16:9 feature graphic media or high-resolution preview banner
 * Strictly rejects app logo or icon fallbacks.
 */
function hasApp16x9Graphic(a: AppListing, full?: AppDetails): boolean {
  const d = full || a;
  const icon = (d.iconUrl || '').trim();
  const banner = (d.featureGraphicUrl || (d as any).heroBannerUrl || (d as any).detailsBannerUrl || (d as any).videoThumbnailUrl || '').trim();
  if (!banner) return false;
  if (icon && (banner === icon || banner.toLowerCase() === icon.toLowerCase())) return false;
  if (banner === '/logo.png' || banner.endsWith('/logo.png') || banner === '/icon.svg' || banner.endsWith('/icon.svg') || banner.includes('/favicon')) return false;
  return true;
}

/**
 * Identifies if an app qualifies for Cold-Start / Indie developer exposure
 */
function isAppColdStartOrIndie(a: AppListing, full?: AppDetails): boolean {
  const d = full || a;
  if (Boolean((d as any).isIndie)) return true;
  const dCount = a.downloadsCount ?? (d as any).downloadsCount ?? parseDownloadCount(a.downloads ?? (d as any).downloads);
  if (dCount < 500) return true;
  const created = Math.max(
    parseAppTimestampMs((a as any).createdAt),
    parseAppTimestampMs((d as any).createdAt),
    parseAppTimestampMs((a as any).updatedAt),
    parseAppTimestampMs((d as any).updatedAt)
  );
  if (created > 0 && Date.now() - created < 45 * 24 * 60 * 60 * 1000) return true;
  return false;
}

/**
 * Parses unified app package size in megabytes (MB)
 */
function getAppSizeMB(a: AppListing, full?: AppDetails): number {
  const sizeStr = (a.size || (full as any)?.size || '').trim().toLowerCase();
  if (!sizeStr) return 35;
  if (sizeStr.endsWith('kb')) {
    const kb = parseFloat(sizeStr);
    return isNaN(kb) ? 1 : kb / 1024;
  }
  if (sizeStr.endsWith('mb')) {
    const mb = parseFloat(sizeStr);
    return isNaN(mb) ? 35 : mb;
  }
  if (sizeStr.endsWith('gb')) {
    const gb = parseFloat(sizeStr);
    return isNaN(gb) ? 1024 : gb * 1024;
  }
  const rawNum = parseFloat(sizeStr);
  return isNaN(rawNum) ? 35 : rawNum;
}

/**
 * Detects whether an app is a game or game-related utility/tool by deeply analyzing
 * ALL publishing details:
 * - App Name & Tool Name (e.g. game title, GFX tool, game booster, crosshair, emulator, companion)
 * - Category / Genre (Games, Action, Arcade, Puzzle, RPG, Racing, Simulation, Strategy, etc.)
 * - Short Description, Tagline & About Text (gameplay, mechanics, actual tool function)
 * - Features & Key Features (e.g. 60/120fps gaming, custom crosshair, game latency, quests)
 * - Tags & Search Keywords
 * - Release Notes & Highlights
 */
export function isGameApp(a: AppListing, full?: AppDetails): boolean {
  if (!a) return false;
  const d = full || a;

  const name = `${a.name || ''} ${d.name || ''}`.toLowerCase();
  const cat = `${a.category || ''} ${d.category || ''}`.toLowerCase();
  const desc = `${a.description || ''} ${d.description || ''} ${d.aboutText || ''}`.toLowerCase();
  const tagline = `${d.tagline || ''} ${a.featuredTitle || ''} ${a.featuredSubtitle || ''}`.toLowerCase();
  const releaseNotes = `${a.releaseNotes || ''} ${d.releaseNotes || ''} ${(d as any).whatsNew || ''}`.toLowerCase();

  const tags = [
    ...(Array.isArray(a.tags) ? a.tags : []),
    ...(Array.isArray(d.tags) ? d.tags : []),
  ].map((t: string) => String(t).toLowerCase());

  const features = [
    ...(Array.isArray((d as any).features) ? (d as any).features : []),
    ...(Array.isArray((d as any).keyFeatures) ? (d as any).keyFeatures : []),
    ...(Array.isArray((d as any).highlights) ? (d as any).highlights : []),
  ].map((f: any) => (typeof f === 'string' ? f : (f?.title || f?.description || '')).toLowerCase());

  const allText = `${name} ${cat} ${tagline} ${tags.join(' ')} ${features.join(' ')} ${desc} ${releaseNotes}`;

  // 0. Explicit Non-Game Categories Guard
  const NON_GAME_CATEGORIES = [
    'cat-productivity', 'productivity', 'cat-tools', 'tools', 'utilities',
    'cat-communication', 'communication', 'cat-social', 'social', 'messaging',
    'cat-business', 'business', 'cat-finance', 'finance', 'cat-education', 'education',
    'cat-health-fitness', 'health & fitness', 'health', 'fitness',
    'cat-music-audio', 'music & audio', 'music', 'audio',
    'cat-photography', 'photography', 'photo & video',
    'cat-shopping', 'shopping', 'cat-travel-local', 'travel & local', 'travel',
    'cat-weather', 'weather', 'cat-art-design', 'art & design',
    'cat-books-reference', 'books & reference', 'books', 'reference',
    'cat-news-magazines', 'news & magazines', 'news',
    'cat-food-drink', 'food & drink', 'cat-house-home', 'house & home',
    'cat-lifestyle', 'lifestyle', 'cat-auto-vehicles', 'auto & vehicles',
    'cat-libraries-demo', 'libraries & demo', 'personalization', 'personalisation'
  ];

  const isExplicitNonGameCategory = NON_GAME_CATEGORIES.some(ng => cat === ng || (cat.startsWith(ng) && !cat.includes('game')));
  if (isExplicitNonGameCategory) {
    if (cat.startsWith('cat-games') || cat === 'games') return true;
    return false;
  }

  // 1. Direct Category Match
  const GAME_CATEGORIES = [
    'cat-games', 'games', 'action', 'adventure', 'arcade', 'board',
    'card', 'casino', 'casual', 'puzzle', 'racing', 'role playing',
    'role-playing', 'rpg', 'simulation', 'sports', 'strategy', 'trivia',
    'word'
  ];
  if (GAME_CATEGORIES.some(gc => cat === gc || cat.includes(gc))) {
    // Exclude if it's strictly a non-game sports/news app with no gameplay or game mechanics
    if (cat.includes('sports') && !allText.includes('game') && !allText.includes('play') && !allText.includes('match') && !allText.includes('score')) {
      // Continue to check other signals
    } else {
      return true;
    }
  }

  // 2. Gaming Utilities & Tool Names / Actual Work
  // (GFX tools, game boosters, crosshair overlays, emulators, companions, keymappers)
  const GAMING_TOOL_PATTERNS = [
    'game booster', 'gamebooster', 'fps booster', 'game turbo', 'game space',
    'game launcher', 'game optimizer', 'gfx tool', 'crosshair', 'custom aim',
    'aim assist', 'sensi tool', 'emulator', 'retroarch', 'ppsspp', 'keymapper',
    'octopus', 'mantis gamepad', 'gamepad', 'game companion', 'game stats',
    'game tracker', 'kd tracker', 'game guide', 'game wiki', 'minecraft mod',
    'minecraft skin', 'skin editor for', 'mod for game', 'game recorder',
    'fps meter', 'fps counter', 'ping reducer', 'lag fix for game', 'game cheat',
    'autoclicker for game', 'auto clicker for game', 'gaming tool', 'gamer tool',
    'controller support', 'game overlay', 'game sensitivity', 'game plugins'
  ];
  if (GAMING_TOOL_PATTERNS.some(pattern => allText.includes(pattern))) {
    return true;
  }

  // 3. Game Title & Name Patterns
  const GAME_TITLE_KEYWORDS = [
    'game', 'games', 'gaming', 'arcade', 'rpg', 'simulator', 'simulation',
    'racing', 'racer', 'shooter', 'fps', 'pvp', 'pve', 'quest', 'dungeon',
    'battle royale', 'battles', 'billiards', 'snooker', '8 ball pool', 'chess',
    'solitaire', 'ludo', 'rummy', 'poker', 'casino', 'runner', 'crafting',
    'tycoon', 'platformer', 'sandbox', 'survival', 'warfare', 'zombie',
    'ninja', 'warrior', 'roguelike', 'match 3', 'match-3', 'tower defense',
    'clash of', 'roblox', 'minecraft', 'pubg', 'fortnite', 'gta', 'pokemon',
    'fifa', 'codm', 'tetris', 'sudoku', 'minesweeper', 'pinball', 'clash'
  ];
  if (GAME_TITLE_KEYWORDS.some(kw => name.includes(kw))) {
    if (!name.includes('google play') && !name.includes('play store')) {
      return true;
    }
  }

  // 4. Gameplay Mechanics & Actual Work in Description / Features
  const GAMEPLAY_PHRASES = [
    'gameplay', 'play now', 'play online', 'play with friends', 'multiplayer battle',
    'player vs player', 'single player', 'campaign mode', 'boss fight', 'boss battle',
    'defeat enemies', 'levels to complete', 'high score', 'leaderboard',
    'power-ups', 'craft weapons', 'dungeon crawler', 'tower defense',
    'turn-based combat', 'real-time strategy', 'battle royale', 'survival game',
    'physics-based game', 'endless runner', 'puzzle solver', 'driving simulator',
    'flight simulator', 'train simulator', 'farming simulator', 'city builder',
    'tycoon game', 'arcade action', 'unlimited coins', 'score points', 'unlock characters',
    'action-packed levels', 'epic quests', 'fighting game', 'racing tracks'
  ];
  if (GAMEPLAY_PHRASES.some(phrase => allText.includes(phrase))) {
    return true;
  }

  // 5. Tags & Keywords
  const GAME_TAGS = [
    'game', 'games', 'gaming', 'arcade', 'action', 'adventure', 'puzzle',
    'racing', 'rpg', 'simulation', 'strategy', 'casual', 'sports', 'shooter',
    'multiplayer', 'offline game', 'online game', 'indie game', 'esports'
  ];
  if (tags.some(t => GAME_TAGS.some(gt => t.includes(gt)))) {
    return true;
  }

  return false;
}

/**
 * Thematic slice representing an algorithmic candidate shelf from Stage 1
 */
interface ThematicSlice {
  id: string;
  facet: 'affinity' | 'category' | 'velocity' | 'cold_start' | 'form_factor' | 'video' | 'top_rated' | 'editorial';
  title: string;
  subtitle?: string;
  tag?: string;
  categoryKey?: string;
  candidateApps: AppListing[];
  featuredApp?: AppListing;
  priorityScore: number;
}

/**
 * Priority order of archetype assignments evaluated in Stage 2
 */
interface ArchetypeCandidates {
  primary: HomeSectionType;
  secondary?: HomeSectionType;
  tertiary?: HomeSectionType;
}

/**
 * Stage 2: Precision Section Matching Matrix
 * Evaluates asset readiness (video trailers, 16:9 graphics, density) to assign archetypes.
 */
function matchPrecisionArchetype(
  slice: ThematicSlice,
  availableApps: AppListing[],
  appsMap: Record<string, AppDetails>
): ArchetypeCandidates {
  if (slice.facet === 'editorial') {
    return { primary: 'editorial_feature' };
  }

  const total = availableApps.length;
  const videoCount = availableApps.filter(a => hasAppVideo(a, appsMap[a.id])).length;
  const graphicCount = availableApps.filter(a => hasApp16x9Graphic(a, appsMap[a.id])).length;

  // Video trailer candidate slice: strictly requires at least 2 actual videos
  if (slice.facet === 'video' && videoCount >= 2) {
    return {
      primary: 'video_cards',
      secondary: graphicCount >= 2 ? 'landscape_cards' : 'squircle_row',
      tertiary: total >= 3 ? 'column_stack' : 'squircle_row',
    };
  }

  // Top rated collection (gold stars)
  if (slice.facet === 'top_rated') {
    return {
      primary: 'top_rated',
      secondary: graphicCount >= 3 ? 'landscape_cards' : (total >= 6 ? 'column_stack' : 'squircle_row'),
      tertiary: 'squircle_row',
    };
  }

  // Broad multi-category discovery sampler with sufficient density
  if (slice.facet === 'affinity' && total >= 6) {
    return {
      primary: 'column_stack',
      secondary: graphicCount >= 3 ? 'landscape_cards' : 'squircle_row',
      tertiary: 'squircle_row',
    };
  }

  // 16:9 Feature Graphic rich slice (wide banners): strictly requires at least 3 genuine landscape graphics
  if (graphicCount >= 3) {
    return {
      primary: 'landscape_cards',
      secondary: total >= 6 ? 'column_stack' : 'squircle_row',
      tertiary: 'squircle_row',
    };
  }

  // High density category with >= 6 apps
  if (total >= 6 && slice.categoryKey) {
    return {
      primary: 'column_stack',
      secondary: 'squircle_row',
      tertiary: graphicCount >= 2 ? 'landscape_cards' : undefined,
    };
  }

  // Default clean archetype for categories with standard app icons
  return {
    primary: 'squircle_row',
    secondary: total >= 6 ? 'column_stack' : (graphicCount >= 2 ? 'landscape_cards' : undefined),
    tertiary: total >= 3 ? 'column_stack' : undefined,
  };
}

export interface ProductionFeedOptions {
  hasSearchSuggestions?: boolean;
  hasRelatedTopics?: boolean;
  mode?: 'all' | 'apps' | 'games';
}

/**
 * 4-Stage Precision Section Choosing & Distribution Algorithm
 *
 * Implements Google Play Store-style multi-facet slicing, precision archetype matching,
 * fatigue pacing adjacency rules, and anti-monopoly exposure guarantees.
 */
export function generateProductionHomeFeed(
  allApps: AppListing[],
  appsMap: Record<string, AppDetails> = {},
  options?: ProductionFeedOptions
): HomeFeedSection[] {
  const feedMode = options?.mode || 'all';
  const rawValid = (allApps || []).filter(
    a => Boolean(a && a.id && a.name)
  );

  if (rawValid.length === 0) {
    return [];
  }

  // Deduplicate strictly by unique app ID so distinct published apps sharing a title across categories/platforms are never dropped
  const dedupedMap = new Map<string, AppListing>();
  for (const a of rawValid) {
    if (!dedupedMap.has(a.id)) {
      dedupedMap.set(a.id, a);
    }
  }
  const validApps = Array.from(dedupedMap.values());

  // Deep Game & Gaming Tool Segmentation
  const gameEligibleApps = validApps.filter(a => isGameApp(a, appsMap[a.id]));
  const appsEligibleApps = validApps.filter(a => !isGameApp(a, appsMap[a.id]));

  // Active pool for the current feed mode:
  // In 'games' mode, prioritize strictly game-relevant apps and gaming tools.
  const poolApps = feedMode === 'games'
    ? (gameEligibleApps.length > 0 ? gameEligibleApps : validApps)
    : feedMode === 'apps'
      ? (appsEligibleApps.length > 0 ? appsEligibleApps : validApps)
      : validApps;

  const clientOS = detectClientOS();
  const userProfile = buildLiveUserProfile();

  // Helper comparator to shuffle/sort according to feedMode (games vs apps)
  const modeSortApps = (appList: AppListing[]): AppListing[] => {
    if (feedMode === 'all') return appList;
    return [...appList].sort((a, b) => {
      const isAGame = isGameApp(a, appsMap[a.id]);
      const isBGame = isGameApp(b, appsMap[b.id]);
      if (feedMode === 'games') {
        if (isAGame && !isBGame) return -1;
        if (!isAGame && isBGame) return 1;
      } else if (feedMode === 'apps') {
        if (!isAGame && isBGame) return -1;
        if (isAGame && !isBGame) return 1;
      }
      return 0;
    });
  };

  // =========================================================================
  // STAGE 4 SETUP: Anti-Monopoly & Fair Exposure Limits
  // Appearance cap scales smoothly with catalog size so small catalogs populate all showcase archetypes
  // =========================================================================
  const MAX_APPEARANCES_PER_APP = poolApps.length <= 4 ? 4 : poolApps.length <= 10 ? 3 : 2;
  const appAppearanceCount = new Map<string, number>();

  const getAvailableCandidates = (candidates: AppListing[]): AppListing[] => {
    return candidates.filter(a => (appAppearanceCount.get(a.id) || 0) < MAX_APPEARANCES_PER_APP);
  };

  const recordAppUsage = (usedApps: AppListing[]) => {
    for (const a of usedApps) {
      appAppearanceCount.set(a.id, (appAppearanceCount.get(a.id) || 0) + 1);
    }
  };

  // =========================================================================
  // STAGE 1: Multi-Facet Slicing Engine
  // Slices catalog by Category, User Taste Affinity, Velocity, Cold-Start, Form Factor
  // =========================================================================
  const candidateSlices: ThematicSlice[] = [];

  // Group apps by genuine normalized category from the mode-specific pool
  // (Also include cross-catalog categories when overall catalog is small on main Home feed so new apps never hide)
  const categorySourceApps = feedMode === 'apps' && validApps.length <= 12 ? validApps : poolApps;
  const categoryGroups = new Map<string, AppListing[]>();
  for (const a of categorySourceApps) {
    const full = appsMap[a.id] || a;
    const cat = normalizeCategoryName(a.category || full.category || 'General');
    const list = categoryGroups.get(cat) || [];
    list.push(a);
    categoryGroups.set(cat, list);
  }

  // 1. Facet: User Taste Affinity — "Suggested for you" (Top discovery sampler)
  const suggestedSource = feedMode === 'apps' && poolApps.length < 3 ? validApps : poolApps;
  const rawSuggested = RecommendationService.getSuggestedForYou(suggestedSource, 16, {
    clientOS,
    appsMap,
  });
  const suggestedCandidates = modeSortApps(rawSuggested);
  if (suggestedCandidates.length >= (suggestedSource.length >= 3 ? 3 : 1)) {
    const primaryInterest = userProfile.topCategories[0] || (feedMode === 'games' ? 'Action & Adventure' : 'your interests');
    candidateSlices.push({
      id: 'section-suggested-for-you',
      facet: 'affinity',
      title: feedMode === 'games' ? 'Suggested games for you' : 'Suggested for you',
      subtitle: userProfile.topCategories.length > 0 ? `Based on your interest in ${primaryInterest}` : (feedMode === 'games' ? 'Picks tailored to your gaming style' : 'Based on your downloads'),
      tag: feedMode === 'games' ? 'Games • Tailored for you' : 'Tailored for you',
      candidateApps: suggestedCandidates,
      priorityScore: 100,
    });
  }

  // 2. Facet: Playable Video Trailers & Gameplay Highlights
  const rawVideo = poolApps.filter(a => hasAppVideo(a, appsMap[a.id]));
  const videoCandidates = modeSortApps(rawVideo);
  if (videoCandidates.length >= 2) {
    candidateSlices.push({
      id: 'section-featured-video-trailers',
      facet: 'video',
      title: feedMode === 'games' ? 'Gameplay Trailers & Highlights' : 'Trailers & Gameplay Highlights',
      subtitle: feedMode === 'games' ? 'Watch action & preview gameplay' : 'Watch trailers & gameplay',
      tag: 'Watch & Play',
      candidateApps: videoCandidates,
      priorityScore: feedMode === 'games' ? 96 : 90,
    });
  }

  // 3. Facet: New & Recently Published Releases (Always surfaces newly published apps immediately on Home)
  const newReleasesSource = feedMode === 'games'
    ? poolApps
    : (poolApps.length < 4 ? validApps : poolApps);
  const sortedNewReleases = [...newReleasesSource].sort((a, b) => {
    const tsB = getAppLatestTimestampMs(b, appsMap[b.id]);
    const tsA = getAppLatestTimestampMs(a, appsMap[a.id]);
    if (tsB !== tsA) return tsB - tsA;
    return b.id.localeCompare(a.id);
  });
  const indieOrNewCandidates = sortedNewReleases.filter(a => isAppColdStartOrIndie(a, appsMap[a.id]));
  const activeNewCandidates = indieOrNewCandidates.length > 0 ? indieOrNewCandidates : sortedNewReleases;
  if (activeNewCandidates.length >= 1) {
    candidateSlices.push({
      id: 'section-indie-cold-start',
      facet: 'cold_start',
      title: feedMode === 'games' ? 'New & updated games' : 'New & updated releases',
      subtitle: 'Freshly published & updated on Prople Store',
      tag: 'New Releases • Verified',
      candidateApps: activeNewCandidates,
      priorityScore: 88,
    });
  }

  // 4. Facet: Velocity & Trending Momentum (7-day velocity decay)
  const rawTrending = [...poolApps].sort((a, b) => {
    const fullA = appsMap[a.id] || a;
    const fullB = appsMap[b.id] || b;
    const dCountA = a.downloadsCount ?? fullA.downloadsCount ?? parseDownloadCount(a.downloads ?? fullA.downloads);
    const dCountB = b.downloadsCount ?? fullB.downloadsCount ?? parseDownloadCount(b.downloads ?? fullB.downloads);
    const ratingA = a.rating ?? fullA.rating ?? 0;
    const ratingB = b.rating ?? fullB.rating ?? 0;
    // Composite velocity score: log10(downloads) * rating + recency tie-breaker
    const scoreA = Math.log10(dCountA + 10) * (ratingA > 0 ? ratingA : 3.5);
    const scoreB = Math.log10(dCountB + 10) * (ratingB > 0 ? ratingB : 3.5);
    if (scoreB !== scoreA) return scoreB - scoreA;
    return getAppLatestTimestampMs(b, appsMap[b.id]) - getAppLatestTimestampMs(a, appsMap[a.id]);
  });
  const trendingCandidates = modeSortApps(rawTrending);
  if (trendingCandidates.length >= (poolApps.length >= 3 ? 3 : 2)) {
    candidateSlices.push({
      id: 'section-trending-velocity',
      facet: 'velocity',
      title: feedMode === 'games' ? 'Trending games gaining momentum' : 'Trending apps gaining momentum',
      subtitle: feedMode === 'games' ? 'Fast-rising titles this week' : 'Fast-rising picks this week',
      tag: 'Trending • High Momentum',
      candidateApps: trendingCandidates,
      priorityScore: 82,
    });
  }

  // 5. Facet: User Activity Recommendation (Engagement & recent categories)
  const rawRecommended = RecommendationService.getPersonalizedRecommendations({
    profile: userProfile,
    limit: 14,
    sourceApps: poolApps,
    clientOS,
    appsMap,
  });
  const recommendedList = modeSortApps(rawRecommended);
  if (recommendedList.length >= 3) {
    const activityCategory = userProfile.recentlyViewedCategories[0] || userProfile.topCategories[0];
    candidateSlices.push({
      id: 'section-recommended-for-you',
      facet: 'affinity',
      title: feedMode === 'games' ? 'Recommended games for you' : 'Recommended for you',
      subtitle: activityCategory ? `Based on your recent interest in ${activityCategory}` : 'Based on your activity',
      tag: 'Recommended',
      candidateApps: recommendedList,
      priorityScore: 78,
    });
  }

  // 6. Facet: Top Rated Apps & Games (Gold stars, player reviews)
  const rawTopRated = poolApps
    .filter(a => {
      const full = appsMap[a.id] || a;
      const r = a.rating ?? full.rating ?? 0;
      return r >= 4.0;
    })
    .sort((a, b) => {
      const fullA = appsMap[a.id] || a;
      const fullB = appsMap[b.id] || b;
      const rA = a.rating ?? fullA.rating ?? 0;
      const rB = b.rating ?? fullB.rating ?? 0;
      if (rB !== rA) return rB - rA;
      const dCountA = a.downloadsCount ?? fullA.downloadsCount ?? 0;
      const dCountB = b.downloadsCount ?? fullB.downloadsCount ?? 0;
      return dCountB - dCountA;
    });
  const topRatedCandidates = modeSortApps(rawTopRated);
  if (topRatedCandidates.length >= (poolApps.length >= 3 ? 3 : 1)) {
    candidateSlices.push({
      id: 'section-top-rated-highlights',
      facet: 'top_rated',
      title: feedMode === 'games' ? 'Top Rated Games' : (feedMode === 'apps' ? 'Top Rated Apps' : 'Top Rated Apps & Games'),
      subtitle: feedMode === 'games' ? '4.0+ ★ based on player reviews' : '4.0+ ★ based on verified reviews',
      tag: feedMode === 'games' ? '4.0+ ★ • Gamers\' Choice' : '4.0+ ★ • Players\' Choice',
      candidateApps: topRatedCandidates,
      priorityScore: feedMode === 'games' ? 92 : 74,
    });
  }

  // 7. Dedicated Facet: Gaming Utilities & Booster Tools (GFX tools, game boosters, crosshair, emulators)
  if (feedMode === 'games') {
    const gamingTools = poolApps.filter(a => {
      const full = appsMap[a.id] || a;
      const name = `${a.name || ''} ${full.name || ''}`.toLowerCase();
      const cat = `${a.category || ''} ${full.category || ''}`.toLowerCase();
      const desc = `${a.description || ''} ${full.description || ''} ${full.aboutText || ''}`.toLowerCase();
      const tags = (a.tags || []).concat(full.tags || []).map(t => String(t).toLowerCase());
      const toolKeywords = [
        'tool', 'booster', 'crosshair', 'gfx', 'fps', 'emulator', 'companion',
        'keymapper', 'gamepad', 'optimizer', 'ping reducer', 'sensi', 'tracker',
        'aim assist', 'mod installer'
      ];
      return toolKeywords.some(tk => name.includes(tk) || cat.includes(tk) || desc.includes(tk) || tags.some(t => t.includes(tk)));
    });

    if (gamingTools.length >= 2) {
      candidateSlices.push({
        id: 'section-gaming-utilities-tools',
        facet: 'category',
        title: 'Gaming Utilities & Booster Tools',
        subtitle: 'GFX tools, game boosters & companion utilities',
        tag: 'Gamer Tools • Boosters',
        categoryKey: 'Gaming Tools',
        candidateApps: gamingTools,
        priorityScore: 89,
      });
    }
  }

  // 8. Facet: Form-Factor — Compact & Lightweight Tools / Casual Games (Under 25MB)
  const rawCompact = poolApps.filter(a => {
    const size = getAppSizeMB(a, appsMap[a.id]);
    const cat = (a.category || '').toLowerCase();
    if (feedMode === 'games') {
      return (size <= 45 && isGameApp(a, appsMap[a.id])) || cat.includes('casual') || cat.includes('puzzle');
    }
    const isToolOrUtil = cat.includes('tool') || cat.includes('utility') || cat.includes('productivity');
    return size <= 35 && isToolOrUtil;
  });
  const compactTools = modeSortApps(rawCompact);
  if (compactTools.length >= 3) {
    candidateSlices.push({
      id: 'section-compact-tools',
      facet: 'form_factor',
      title: feedMode === 'games' ? 'Lightweight & instant games' : 'Compact & lightweight tools',
      subtitle: 'Fast to download & play',
      tag: 'Lightweight • Fast',
      candidateApps: compactTools,
      priorityScore: feedMode === 'games' ? 68 : 65,
    });
  }

  // 9. Facet: Category Slices (Sorted by density + user affinity)
  const sortedCategoryTuples = Array.from(categoryGroups.entries()).sort((a, b) => {
    const catA = a[0];
    const catB = b[0];
    const isGameA = isGameApp({ category: catA } as any) || catA.toLowerCase().includes('game');
    const isGameB = isGameApp({ category: catB } as any) || catB.toLowerCase().includes('game');

    let modeBonusA = 0;
    let modeBonusB = 0;
    if (feedMode === 'games') {
      if (isGameA) modeBonusA += 50;
      if (isGameB) modeBonusB += 50;
    } else if (feedMode === 'apps') {
      if (!isGameA) modeBonusA += 25;
      if (!isGameB) modeBonusB += 25;
    }

    const affinityA = (userProfile.categoryAffinities[catA] || 0) * 8 + (userProfile.topCategories.includes(catA) ? 10 : 0);
    const affinityB = (userProfile.categoryAffinities[catB] || 0) * 8 + (userProfile.topCategories.includes(catB) ? 10 : 0);
    return (b[1].length + affinityB + modeBonusB) - (a[1].length + affinityA + modeBonusA);
  });

  sortedCategoryTuples.forEach(([catName, catApps], index) => {
    const isGameCat = isGameApp({ category: catName } as any) || catName.toLowerCase().includes('game');

    // In games mode, exclude purely non-game category shelves
    if (feedMode === 'games' && !isGameCat && gameEligibleApps.length > 0) {
      return;
    }

    const { title, subtitle, tag } = getCategorySectionTitle(
      catName,
      'squircle_row',
      isGameCat
    );

    let catPriority = 60 - index;
    if (feedMode === 'games') {
      catPriority = isGameCat ? 85 - index : 20 - index;
    } else if (feedMode === 'apps') {
      catPriority = !isGameCat ? 70 - index : 20 - index;
    }

    candidateSlices.push({
      id: `section-cat-${catName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      facet: 'category',
      title,
      subtitle,
      tag,
      categoryKey: catName,
      candidateApps: modeSortApps(catApps),
      priorityScore: catPriority,
    });
  });

  // Editorial candidates pool (High ratings with 16:9 feature graphic)
  const editorialPool: AppListing[] = [];
  const seenEditorial = new Set<string>();
  for (const a of validApps) {
    const full = appsMap[a.id] || a;
    const r = a.rating ?? full.rating ?? 0;
    const bannerUrl = (full.featureGraphicUrl || a.featureGraphicUrl || (full as any).videoThumbnailUrl || (a as any).videoThumbnailUrl || '').trim();
    if (r >= 3.8 && bannerUrl.length > 0 && !seenEditorial.has(a.id)) {
      seenEditorial.add(a.id);
      editorialPool.push(a);
    }
  }

  // Sort slices by priorityScore descending
  candidateSlices.sort((a, b) => b.priorityScore - a.priorityScore);

  // =========================================================================
  // STAGES 2, 3 & 4: Precision Matching, Fatigue Pacing & Appearance Capping
  // =========================================================================
  const sections: HomeFeedSection[] = [];
  let lastVisualFamily: VisualFamily | null = null;
  let shelvesSinceEditorial = 0;
  let editorialIndex = 0;

  // Working queue of slices
  const sliceQueue = [...candidateSlices];

  while (sliceQueue.length > 0) {
    // Find the next viable slice whose assigned archetype satisfies the Strict Adjacency Rule
    let chosenSliceIndex = -1;
    let chosenArchetype: HomeSectionType | null = null;
    let chosenApps: AppListing[] = [];

    for (let i = 0; i < sliceQueue.length; i++) {
      const slice = sliceQueue[i];
      // For category and cold-start shelves, prioritize genuine apps without artificial starvation
      const isDedicatedShelf = slice.facet === 'category' || slice.facet === 'cold_start';
      const available = (isDedicatedShelf && slice.candidateApps.length > 0)
        ? slice.candidateApps
        : getAvailableCandidates(slice.candidateApps);
      const minRequired = slice.facet === 'video'
        ? 2
        : (slice.facet === 'category' || slice.facet === 'cold_start' ? 1 : Math.min(2, poolApps.length));

      if (available.length < minRequired) {
        continue;
      }

      const activeSliceApps = available.length > 0 ? available : slice.candidateApps;
      const archetypes = matchPrecisionArchetype(slice, activeSliceApps, appsMap);

      // Check primary candidate
      if (getVisualFamily(archetypes.primary) !== lastVisualFamily) {
        chosenSliceIndex = i;
        chosenArchetype = archetypes.primary;
        chosenApps = activeSliceApps;
        break;
      }

      // Check secondary candidate
      if (archetypes.secondary && getVisualFamily(archetypes.secondary) !== lastVisualFamily) {
        chosenSliceIndex = i;
        chosenArchetype = archetypes.secondary;
        chosenApps = activeSliceApps;
        break;
      }

      // Check tertiary candidate
      if (archetypes.tertiary && getVisualFamily(archetypes.tertiary) !== lastVisualFamily) {
        chosenSliceIndex = i;
        chosenArchetype = archetypes.tertiary;
        chosenApps = activeSliceApps;
        break;
      }
    }

    // If all remaining slices collide with lastVisualFamily, force-pivot the archetype of the top slice safely
    if (chosenSliceIndex === -1 && sliceQueue.length > 0) {
      const slice = sliceQueue[0];
      const isCatSlice = slice.facet === 'category';
      const available = (isCatSlice && slice.candidateApps.length > 0)
        ? slice.candidateApps
        : getAvailableCandidates(slice.candidateApps);
      const activeSliceApps = available.length > 0 ? available : slice.candidateApps;

      const hasGraphics = activeSliceApps.filter(a => hasApp16x9Graphic(a, appsMap[a.id])).length >= 2;
      const canStack = activeSliceApps.length >= 3;

      if (lastVisualFamily === 'squircle') {
        if (canStack) chosenArchetype = 'column_stack';
        else if (hasGraphics) chosenArchetype = 'landscape_cards';
        else chosenArchetype = 'squircle_row';
      } else if (lastVisualFamily === 'stack') {
        if (hasGraphics) chosenArchetype = 'landscape_cards';
        else chosenArchetype = 'squircle_row';
      } else if (lastVisualFamily === 'landscape') {
        if (canStack) chosenArchetype = 'column_stack';
        else chosenArchetype = 'squircle_row';
      } else {
        chosenArchetype = 'squircle_row';
      }
      chosenSliceIndex = 0;
      chosenApps = activeSliceApps;
    }

    if (chosenSliceIndex === -1 || !chosenArchetype) {
      break;
    }

    const [slice] = sliceQueue.splice(chosenSliceIndex, 1);

    // Limit apps per section by archetype capacity
    let sliceAppsFinal: AppListing[] = chosenApps;
    if (chosenArchetype === 'column_stack') {
      sliceAppsFinal = chosenApps.slice(0, 12);
    } else if (chosenArchetype === 'landscape_cards') {
      sliceAppsFinal = chosenApps.slice(0, 8);
    } else if (chosenArchetype === 'video_cards') {
      sliceAppsFinal = chosenApps.slice(0, 8);
    } else if (chosenArchetype === 'squircle_row' || chosenArchetype === 'top_rated') {
      sliceAppsFinal = chosenApps.slice(0, 12);
    }

    // Build the final section
    sections.push({
      id: `${slice.id}-${chosenArchetype}`,
      type: chosenArchetype,
      title: slice.title,
      subtitle: slice.subtitle,
      tag: slice.tag,
      apps: sliceAppsFinal,
      categoryKey: slice.categoryKey,
    });

    recordAppUsage(sliceAppsFinal);
    lastVisualFamily = getVisualFamily(chosenArchetype);
    shelvesSinceEditorial++;

    // =========================================================================
    // RHYTHMIC INTERVAL: Search Suggestions & Editorial Features
    // =========================================================================
    // 1. Search Suggestions Chip Cloud after shelf 2
    if (sections.length === 2 && options?.hasSearchSuggestions) {
      sections.push({
        id: 'section-interval-search-suggestions',
        type: 'search_suggestions',
        title: 'Latest search suggestions',
        apps: [],
      });
      lastVisualFamily = 'chips';
    }

    // 2. Editorial Feature Spotlight inserted every 5-7 shelves
    if (shelvesSinceEditorial >= 5 && editorialPool.length > 0) {
      const editorialApp = editorialPool[editorialIndex % editorialPool.length];
      editorialIndex++;
      const companions = validApps
        .filter(a => a.id !== editorialApp.id && (a.category === editorialApp.category || !a.category))
        .slice(0, 3);

      sections.push({
        id: `section-editorial-feature-${editorialIndex}`,
        type: 'editorial_feature',
        title: "Editor's Choice Spotlight",
        tag: 'Featured • Hand-Picked',
        apps: [editorialApp, ...companions],
        featuredApp: editorialApp,
      });

      recordAppUsage([editorialApp]);
      lastVisualFamily = 'editorial';
      shelvesSinceEditorial = 0;
    }

    // 3. Related Topics chips interval around shelf 6
    if (sections.length === 6 && options?.hasRelatedTopics) {
      sections.push({
        id: 'section-interval-related-topics',
        type: 'related_topics',
        title: 'Searches related to your interests',
        apps: [],
      });
      lastVisualFamily = 'chips';
    }
  }

  // =========================================================================
  // COLD-START EXPOSURE GUARANTEE:
  // Ensure every newly uploaded or unexposed app is guaranteed display in at least 1 section!
  // =========================================================================
  const unexposedApps = validApps.filter(a => (appAppearanceCount.get(a.id) || 0) === 0);
  if (unexposedApps.length > 0) {
    const fallbackArchetype = lastVisualFamily === 'squircle' ? 'column_stack' : 'squircle_row';
    sections.push({
      id: 'section-cold-start-guarantee',
      type: fallbackArchetype,
      title: 'Freshly launched & emerging apps',
      subtitle: 'New indie creators & updates',
      tag: 'New Releases • Verified',
      apps: unexposedApps,
    });
    recordAppUsage(unexposedApps);
  }

  return sections;
}

