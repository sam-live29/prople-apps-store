import { AppListing, AppDetails } from '../types';
import { getSearchHistory } from './searchHistory';

export interface IndexedSuggestionItem {
  id: string;
  query: string;
  count: number;
  icon?: 'search' | 'trending' | 'fire';
}

/**
 * Strips all emojis and pictographic symbols from search queries.
 */
export function stripEmojis(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu, '')
    .trim();
}

/**
 * Counts how many apps in the catalogue match a given candidate search query.
 */
function countMatchingCatalogApps(
  query: string,
  allApps: AppListing[],
  appsMap: Record<string, AppDetails>
): number {
  const cleanQ = query.toLowerCase().trim();
  if (!cleanQ || cleanQ.length < 2) return 0;

  return allApps.filter(app => {
    const full = appsMap[app.id];
    const appName = (app.name || '').toLowerCase();
    const appCat = (app.category || full?.category || '').toLowerCase();
    const appDev = (app.developer || '').toLowerCase();
    const tags = ((app as any).tags || (full as any)?.tags || []).map((t: string) => t.toLowerCase());

    if (appName.includes(cleanQ)) return true;
    if (appCat.includes(cleanQ) || (appCat.length > 2 && cleanQ.includes(appCat))) return true;
    if (appDev.includes(cleanQ)) return true;
    if (tags.some((t: string) => t.includes(cleanQ) || (t.length > 2 && cleanQ.includes(t)))) return true;

    // Check individual significant search tokens
    const words = cleanQ.split(/\s+/).filter(w => w.length > 2 && w !== 'app' && w !== 'apps' && w !== '&');
    if (words.length > 0 && words.some(w => appName.includes(w) || appCat.includes(w) || tags.some((t: string) => t.includes(w)))) {
      return true;
    }

    return false;
  }).length;
}

/**
 * Dynamically computes verified search suggestions strictly indexed from
 * the real apps available in the database catalogue.
 *
 * If an indexed query does not match any apps in the store, it will NEVER appear.
 */
export function getIndexedSearchSuggestions(
  allApps: AppListing[],
  appsMap: Record<string, AppDetails> = {}
): {
  row1: IndexedSuggestionItem[];
  row2: IndexedSuggestionItem[];
  relatedTopics: IndexedSuggestionItem[];
} {
  if (!allApps || allApps.length === 0) {
    return { row1: [], row2: [], relatedTopics: [] };
  }

  const candidateQueries: { query: string; isHistory?: boolean }[] = [];
  const seenQueries = new Set<string>();

  const addCandidate = (q: string, isHistory = false) => {
    const clean = stripEmojis(q).trim();
    if (!clean || clean.length < 2) return;
    const key = clean.toLowerCase();
    if (seenQueries.has(key)) return;
    seenQueries.add(key);
    candidateQueries.push({ query: clean, isHistory });
  };

  // 1. User's recent search queries from search history (if they match indexed apps)
  try {
    const history = getSearchHistory();
    history.forEach(item => {
      addCandidate(item.query, true);
    });
  } catch {
    // Ignore storage issues
  }

  // 2. Real categories from apps that are currently in the catalogue
  const catalogCategories = new Set<string>();
  allApps.forEach(app => {
    const full = appsMap[app.id];
    const cat = app.category || full?.category;
    if (cat && cat.trim()) {
      catalogCategories.add(cat.trim());
    }
  });

  catalogCategories.forEach(cat => {
    addCandidate(cat);
    // Add friendly variations if relevant
    const catLower = cat.toLowerCase();
    if (catLower.includes('game') && !catLower.includes('games')) {
      addCandidate(`${cat}s`);
    } else if (!catLower.includes('game') && !catLower.includes('app')) {
      addCandidate(`${cat} Apps`);
    }
  });

  // 3. Real tags and features from apps in the catalogue
  allApps.forEach(app => {
    const full = appsMap[app.id];
    const tags = ((app as any).tags || (full as any)?.tags || []) as string[];
    tags.forEach(tag => {
      if (typeof tag === 'string' && tag.trim().length >= 3) {
        const cleanTag = tag.trim();
        // Capitalize words
        const formatted = cleanTag
          .split(/[\s-_]+/)
          .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
        addCandidate(formatted);
      }
    });
  });

  // 4. Prominent app names from the catalogue
  allApps.slice(0, 8).forEach(app => {
    if (app.name && app.name.trim().length >= 3 && app.name.trim().length <= 30) {
      addCandidate(app.name.trim());
    }
  });

  // 5. Verify every single candidate against the current catalog
  const verifiedList: IndexedSuggestionItem[] = [];

  candidateQueries.forEach((cand, idx) => {
    const matchCount = countMatchingCatalogApps(cand.query, allApps, appsMap);
    if (matchCount > 0) {
      verifiedList.push({
        id: `idx-sugg-${idx}-${cand.query.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        query: cand.query,
        count: matchCount,
        icon: cand.isHistory ? 'trending' : (idx % 4 === 1 ? 'trending' : (idx % 4 === 3 ? 'fire' : 'search'))
      });
    }
  });

  // Sort: history matches first, then by highest match count
  verifiedList.sort((a, b) => {
    return b.count - a.count;
  });

  // Must have at least 2 verified suggestions to be meaningful
  if (verifiedList.length < 2) {
    return { row1: [], row2: [], relatedTopics: [] };
  }

  // Divide into Row 1, Row 2, and Related Topics
  const totalForRows = Math.min(verifiedList.length, 12);
  const half = Math.ceil(totalForRows / 2);
  const row1 = verifiedList.slice(0, half);
  const row2 = verifiedList.slice(half, totalForRows);

  const remaining = verifiedList.slice(totalForRows);
  const relatedTopics = remaining.slice(0, 8);

  return {
    row1,
    row2,
    relatedTopics
  };
}
