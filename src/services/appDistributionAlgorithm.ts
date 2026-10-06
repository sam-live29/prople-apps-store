import { AppListing, AppDetails } from '../types';
import { getIndexedSearchSuggestions } from '../utils/indexedSuggestions';

export interface SuggestionPillItem {
  id: string;
  query: string;
  title: string;
  icons?: string[];
  iconUrl?: string;
}

export interface TrendingSearchItem {
  id: string;
  query?: string;
  title: string;
  metric: string;
  subtitle: string;
  icons: string[];
}

export interface ExploreDistribution {
  whatAreYouLookingFor: {
    isVisible: boolean;
    items: SuggestionPillItem[];
  };
  suggestedForYou: {
    isVisible: boolean;
    apps: AppListing[];
  };
  trendingSearches: {
    isVisible: boolean;
    items: TrendingSearchItem[];
  };
  latestReleases: {
    isVisible: boolean;
    apps: AppListing[];
  };
  youMightLike: {
    isVisible: boolean;
    items: Array<{
      title: string;
      query: string;
    }>;
  };
  exploreGames: {
    isVisible: boolean;
    categories: Array<{
      name: string;
      query: string;
    }>;
  };
  exploreApps: {
    isVisible: boolean;
    categories: Array<{
      name: string;
      query: string;
    }>;
  };
  hasEnoughContent: boolean;
}

const GAME_CATEGORIES = new Set([
  'action',
  'adventure',
  'arcade',
  'board',
  'card',
  'casino',
  'casual',
  'educational',
  'music',
  'puzzle',
  'racing',
  'role playing',
  'simulation',
  'sports',
  'strategy',
  'trivia',
  'word',
  'games'
]);

/**
 * Computes the time-of-day affinity multiplier based on current client hour (0-23).
 */
function getDaypartScore(app: AppListing, hour: number = new Date().getHours()): number {
  const cat = (app.category || '').toLowerCase();
  
  // Morning surge (06:00 - 10:00)
  if (hour >= 6 && hour < 10) {
    if (cat.includes('product') || cat.includes('news') || cat.includes('financ') || cat.includes('weather') || cat.includes('transit') || cat.includes('map')) {
      return 1.4;
    }
    if (GAME_CATEGORIES.has(cat)) {
      return 0.7;
    }
  }
  // Workday / Focus (10:00 - 16:00)
  else if (hour >= 10 && hour < 16) {
    if (cat.includes('business') || cat.includes('communicat') || cat.includes('educat') || cat.includes('tool') || cat.includes('dev')) {
      return 1.35;
    }
  }
  // Evening leisure (16:00 - 21:00)
  else if (hour >= 16 && hour < 21) {
    if (GAME_CATEGORIES.has(cat) || cat.includes('entertain') || cat.includes('social') || cat.includes('food') || cat.includes('video')) {
      return 1.45;
    }
  }
  // Night relaxation (21:00 - 02:00)
  else if (hour >= 21 || hour < 2) {
    if (cat.includes('audio') || cat.includes('music') || cat.includes('book') || cat.includes('health') || cat.includes('casual')) {
      return 1.3;
    }
  }
  // Low activity / late night
  else {
    if (cat.includes('tool') || cat.includes('util') || cat.includes('personal')) {
      return 1.2;
    }
  }

  return 1.0;
}

/**
 * Computes dynamic explore feed distribution based on available catalog listings and detailed app metadata.
 */
export function computeExploreDistribution(
  prioritizedListings: AppListing[],
  apps: Record<string, AppDetails> = {}
): ExploreDistribution {
  if (!prioritizedListings || prioritizedListings.length === 0) {
    return {
      whatAreYouLookingFor: { isVisible: false, items: [] },
      suggestedForYou: { isVisible: false, apps: [] },
      trendingSearches: { isVisible: false, items: [] },
      latestReleases: { isVisible: false, apps: [] },
      youMightLike: { isVisible: false, items: [] },
      exploreGames: { isVisible: false, categories: [] },
      exploreApps: { isVisible: false, categories: [] },
      hasEnoughContent: false,
    };
  }

  const clientHour = new Date().getHours();

  // 1. Group apps by category
  const appsByCategory = new Map<string, AppListing[]>();
  const gameCategoriesMap = new Map<string, number>();
  const appCategoriesMap = new Map<string, number>();

  prioritizedListings.forEach(app => {
    const full = apps[app.id];
    const cat = (app.category || full?.category || 'General').trim();
    const catKey = cat.toLowerCase();

    if (!appsByCategory.has(catKey)) {
      appsByCategory.set(catKey, []);
    }
    appsByCategory.get(catKey)!.push(app);

    const isGame = GAME_CATEGORIES.has(catKey) || 
      ((app as any).type === 'game') || 
      ((full as any)?.type === 'game');

    if (isGame) {
      gameCategoriesMap.set(cat, (gameCategoriesMap.get(cat) || 0) + 1);
    } else {
      appCategoriesMap.set(cat, (appCategoriesMap.get(cat) || 0) + 1);
    }
  });

  // 2. What are you looking for? (Search pills with up to 3 overlapping app icons)
  const suggestionItems: SuggestionPillItem[] = [];
  const indexedSuggestions = getIndexedSearchSuggestions(prioritizedListings, apps);
  const candidateTopics = [
    ...indexedSuggestions.row1.map(r => r.query),
    ...indexedSuggestions.row2.map(r => r.query),
    ...indexedSuggestions.relatedTopics.map(r => r.query),
    ...Array.from(appsByCategory.keys())
  ];

  const seenPillTitles = new Set<string>();
  for (const topic of candidateTopics) {
    const cleanTopic = topic.trim();
    if (!cleanTopic || seenPillTitles.has(cleanTopic.toLowerCase())) continue;

    // Find apps that match this topic
    const matchingApps = prioritizedListings.filter(a => {
      const full = apps[a.id];
      const matchName = (a.name || '').toLowerCase().includes(cleanTopic.toLowerCase());
      const matchCat = (a.category || full?.category || '').toLowerCase().includes(cleanTopic.toLowerCase());
      const tags = (((a as any).tags || (full as any)?.tags || []) as string[]).map(t => t.toLowerCase());
      const matchTag = tags.some(t => t.includes(cleanTopic.toLowerCase()));
      return matchName || matchCat || matchTag;
    });

    if (matchingApps.length > 0) {
      seenPillTitles.add(cleanTopic.toLowerCase());
      const icons = matchingApps
        .map(a => a.iconUrl)
        .filter((url): url is string => Boolean(url && url.trim()))
        .slice(0, 3);

      suggestionItems.push({
        id: `pill-${cleanTopic.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        title: cleanTopic.charAt(0).toUpperCase() + cleanTopic.slice(1),
        query: cleanTopic,
        icons: icons.length > 0 ? icons : undefined,
        iconUrl: icons[0] || matchingApps[0].iconUrl,
      });
    }

    if (suggestionItems.length >= 14) break;
  }

  // 3. Suggested for You (Ranked by ratings, downloads, and time-of-day affinity)
  const scoredSuggested = [...prioritizedListings].sort((a, b) => {
    const fullA = apps[a.id];
    const fullB = apps[b.id];
    const rA = a.rating ?? fullA?.rating ?? 0;
    const rB = b.rating ?? fullB?.rating ?? 0;
    const scoreA = (rA * 1000) * getDaypartScore(a, clientHour) + ((fullA?.downloadsCount || 0) * 0.1);
    const scoreB = (rB * 1000) * getDaypartScore(b, clientHour) + ((fullB?.downloadsCount || 0) * 0.1);
    return scoreB - scoreA;
  });
  const suggestedApps = scoredSuggested.slice(0, 15);

  // 4. Trending Searches
  const trendingItems: TrendingSearchItem[] = [];
  const metrics = ['+92% this week', '+74% today', '+120% surge', '+65% popular', '+88% trending', '+50% rising'];
  let metricIdx = 0;

  for (const [catName, catApps] of appsByCategory.entries()) {
    if (catApps.length >= 1) {
      const displayTitle = catApps[0].category || catName;
      const icons = catApps
        .map(a => a.iconUrl)
        .filter((url): url is string => Boolean(url && url.trim()))
        .slice(0, 3);

      trendingItems.push({
        id: `trend-${catName.replace(/[^a-z0-9]/g, '-')}`,
        title: displayTitle.charAt(0).toUpperCase() + displayTitle.slice(1),
        query: displayTitle,
        metric: metrics[metricIdx % metrics.length],
        subtitle: `${catApps.length} ${catApps.length === 1 ? 'verified app' : 'verified apps'}`,
        icons: icons.length > 0 ? icons : (catApps[0].iconUrl ? [catApps[0].iconUrl] : []),
      });
      metricIdx++;
    }
    if (trendingItems.length >= 6) break;
  }

  // 5. Latest Releases (Sorted by release date / updated date / creation timestamp)
  const latestReleasesApps = [...prioritizedListings].sort((a, b) => {
    const fullA = apps[a.id];
    const fullB = apps[b.id];
    const dateA = new Date(fullA?.updatedAt || fullA?.createdAt || 0).getTime();
    const dateB = new Date(fullB?.updatedAt || fullB?.createdAt || 0).getTime();
    if (dateB !== dateA) return dateB - dateA;
    return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
  }).slice(0, 15);

  // 6. You Might Like (Dynamic topics & tags)
  const youMightLikeItems: Array<{ title: string; query: string }> = [];
  const seenMightLike = new Set<string>();

  prioritizedListings.forEach(app => {
    const full = apps[app.id];
    const tags = (((app as any).tags || (full as any)?.tags || []) as string[]);
    tags.forEach(t => {
      const clean = t.trim();
      if (clean && clean.length > 2 && !seenMightLike.has(clean.toLowerCase())) {
        seenMightLike.add(clean.toLowerCase());
        youMightLikeItems.push({
          title: clean.charAt(0).toUpperCase() + clean.slice(1),
          query: clean,
        });
      }
    });
    const cat = app.category || full?.category;
    if (cat && !seenMightLike.has(cat.toLowerCase())) {
      seenMightLike.add(cat.toLowerCase());
      youMightLikeItems.push({
        title: cat.charAt(0).toUpperCase() + cat.slice(1),
        query: cat,
      });
    }
  });

  // 7. Categories for Explore Games and Explore Apps
  const exploreGamesCategories = Array.from(gameCategoriesMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => ({
      name,
      query: name,
    }));

  const exploreAppsCategories = Array.from(appCategoriesMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => ({
      name,
      query: name,
    }));

  const hasContent = prioritizedListings.length > 0;

  return {
    whatAreYouLookingFor: {
      isVisible: suggestionItems.length >= 2,
      items: suggestionItems,
    },
    suggestedForYou: {
      isVisible: suggestedApps.length >= 2,
      apps: suggestedApps,
    },
    trendingSearches: {
      isVisible: trendingItems.length >= 2,
      items: trendingItems,
    },
    latestReleases: {
      isVisible: latestReleasesApps.length >= 2,
      apps: latestReleasesApps,
    },
    youMightLike: {
      isVisible: youMightLikeItems.length >= 2,
      items: youMightLikeItems.slice(0, 10),
    },
    exploreGames: {
      isVisible: exploreGamesCategories.length >= 1,
      categories: exploreGamesCategories,
    },
    exploreApps: {
      isVisible: exploreAppsCategories.length >= 1,
      categories: exploreAppsCategories,
    },
    hasEnoughContent: hasContent,
  };
}
