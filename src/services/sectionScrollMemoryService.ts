/**
 * sectionScrollMemoryService.ts
 * 
 * Preserves scroll and slide positions for horizontal carousels (Editorial Spotlight,
 * Landscape Cards, Video Cards, Squircle Rows, Column Stacks, Hero Banner, etc.)
 * across installation state changes, catalogue updates, and navigation between
 * App Details and Home.
 */

const memoryScrollMap = new Map<string, number>();
const STORAGE_KEY = 'prople_section_scroll_memory_v1';

// Synchronize from sessionStorage on initial module load
try {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    const cached = window.sessionStorage.getItem(STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed === 'object') {
        Object.entries(parsed).forEach(([key, val]) => {
          if (typeof val === 'number' && Number.isFinite(val) && val >= 0) {
            memoryScrollMap.set(key, val);
          }
        });
      }
    }
  }
} catch {
  // Graceful fallback if storage is restricted
}

let persistTimeout: any = null;

export function flushSectionPersist(): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  if (persistTimeout) {
    clearTimeout(persistTimeout);
    persistTimeout = null;
  }
  try {
    const dump: Record<string, number> = {};
    memoryScrollMap.forEach((v, k) => {
      dump[k] = v;
    });
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(dump));
  } catch {}
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushSectionPersist);
  window.addEventListener('pagehide', flushSectionPersist);
}

function schedulePersist(): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  if (persistTimeout) clearTimeout(persistTimeout);
  persistTimeout = setTimeout(() => {
    try {
      const dump: Record<string, number> = {};
      memoryScrollMap.forEach((v, k) => {
        dump[k] = v;
      });
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(dump));
    } catch {
      // Storage full or restricted
    }
  }, 100);
}

/**
 * Record the current horizontal scroll position for a given section.
 */
export function saveSectionScroll(sectionId: string, scrollLeft: number): void {
  if (!sectionId || typeof scrollLeft !== 'number' || !Number.isFinite(scrollLeft)) return;
  const rounded = Math.max(0, Math.round(scrollLeft));
  memoryScrollMap.set(sectionId, rounded);
  schedulePersist();
}

/**
 * Retrieve the saved horizontal scroll position for a given section.
 */
export function getSectionScroll(sectionId: string): number {
  if (!sectionId) return 0;
  return memoryScrollMap.get(sectionId) || 0;
}

/**
 * Clear the saved horizontal scroll position for a given section.
 */
export function clearSectionScroll(sectionId: string): void {
  if (!sectionId) return;
  memoryScrollMap.delete(sectionId);
  schedulePersist();
}

/**
 * Clear all saved horizontal scroll positions (used on pull-to-refresh or fresh reload).
 */
export function clearAllSectionScrolls(): void {
  memoryScrollMap.clear();
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
}

/**
 * Attempt to restore the saved scroll position on a DOM element.
 * Returns true if a positive saved scroll position was applied.
 */
export function restoreSectionScroll(
  el: HTMLElement | null,
  sectionId: string
): boolean {
  if (!el || !sectionId) return false;
  const saved = getSectionScroll(sectionId);
  if (saved > 0) {
    el.scrollLeft = saved;
    return true;
  }
  return false;
}
