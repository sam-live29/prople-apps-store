export interface SearchHistoryItem {
  id: string;
  query: string;
  timestamp: number;
}

const STORAGE_KEY = 'propleStoreRecentSearches';
const LEGACY_STORAGE_KEY = typeof atob !== 'undefined' ? atob('cGxheVN0b3JlUmVjZW50U2VhcmNoZXM=') : '';

export function getSearchHistory(): SearchHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => {
        if (typeof item === 'string') {
          return { id: `rs-${Date.now()}-${Math.random()}`, query: item, timestamp: Date.now() };
        }
        return {
          id: item.id || `rs-${Date.now()}-${Math.random()}`,
          query: item.query || '',
          timestamp: item.timestamp || Date.now()
        };
      }).filter(item => item.query.trim().length > 0).slice(0, 4);
    }
    return [];
  } catch {
    return [];
  }
}

export function saveSearchQuery(query: string): SearchHistoryItem[] {
  const trimmed = query.trim();
  if (!trimmed) return getSearchHistory();
  
  try {
    const current = getSearchHistory();
    const filtered = current.filter(
      item => item.query.toLowerCase() !== trimmed.toLowerCase()
    );
    const updated: SearchHistoryItem[] = [
      { id: `rs-${Date.now()}`, query: trimmed, timestamp: Date.now() },
      ...filtered
    ].slice(0, 4); // Keep top 4 recent searches
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function removeSearchHistoryItem(id: string): SearchHistoryItem[] {
  try {
    const current = getSearchHistory();
    const updated = current.filter(item => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function clearSearchHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
