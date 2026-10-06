import { useState, useEffect, useCallback } from 'react';

const BOOKMARKS_STORAGE_KEY = 'prople_store_bookmarks_v1';
const BOOKMARKS_EVENT_NAME = 'prople_bookmarks_changed';

/**
 * Get the current list of bookmarked application IDs from local storage.
 */
export function getBookmarkedAppIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string' && id.trim().length > 0) : [];
  } catch (e) {
    console.warn('[BookmarkService] Failed to read bookmarks from storage:', e);
    return [];
  }
}

/**
 * Save the bookmarked application IDs to local storage and dispatch update event.
 */
function saveBookmarkedAppIds(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(uniqueIds));
    window.dispatchEvent(
      new CustomEvent(BOOKMARKS_EVENT_NAME, {
        detail: { bookmarkedIds: uniqueIds },
      })
    );
  } catch (e) {
    console.warn('[BookmarkService] Failed to persist bookmarks to storage:', e);
  }
}

/**
 * Check if a specific app is bookmarked.
 */
export function isAppBookmarked(appId: string): boolean {
  if (!appId) return false;
  const current = getBookmarkedAppIds();
  return current.includes(appId);
}

/**
 * Add an application to the bookmarks list.
 */
export function addBookmark(appId: string): boolean {
  if (!appId) return false;
  const current = getBookmarkedAppIds();
  if (!current.includes(appId)) {
    const updated = [appId, ...current];
    saveBookmarkedAppIds(updated);
    return true;
  }
  return false;
}

/**
 * Remove an application from the bookmarks list.
 */
export function removeBookmark(appId: string): boolean {
  if (!appId) return false;
  const current = getBookmarkedAppIds();
  if (current.includes(appId)) {
    const updated = current.filter((id) => id !== appId);
    saveBookmarkedAppIds(updated);
    return true;
  }
  return false;
}

/**
 * Clear all bookmarked applications.
 */
export function clearAllBookmarks(): void {
  saveBookmarkedAppIds([]);
}

/**
 * Toggle an application's bookmark status.
 * @returns {boolean} True if the app is now bookmarked, false if removed.
 */
export function toggleBookmark(appId: string): boolean {
  if (!appId) return false;
  const current = getBookmarkedAppIds();
  if (current.includes(appId)) {
    removeBookmark(appId);
    return false;
  } else {
    addBookmark(appId);
    return true;
  }
}

/**
 * React hook for consuming and updating bookmarks across the application.
 */
export function useBookmarks() {
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>(() => getBookmarkedAppIds());

  useEffect(() => {
    const handleUpdate = () => {
      setBookmarkedIds(getBookmarkedAppIds());
    };

    window.addEventListener(BOOKMARKS_EVENT_NAME, handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener(BOOKMARKS_EVENT_NAME, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const checkIsBookmarked = useCallback(
    (appId: string): boolean => {
      if (!appId) return false;
      return bookmarkedIds.includes(appId);
    },
    [bookmarkedIds]
  );

  const handleToggle = useCallback(
    (appId: string): boolean => {
      return toggleBookmark(appId);
    },
    []
  );

  const handleAdd = useCallback((appId: string): boolean => {
    return addBookmark(appId);
  }, []);

  const handleRemove = useCallback((appId: string): boolean => {
    return removeBookmark(appId);
  }, []);

  const handleClearAll = useCallback((): void => {
    clearAllBookmarks();
  }, []);

  return {
    bookmarkedIds,
    bookmarksCount: bookmarkedIds.length,
    isBookmarked: checkIsBookmarked,
    toggleBookmark: handleToggle,
    addBookmark: handleAdd,
    removeBookmark: handleRemove,
    clearAllBookmarks: handleClearAll,
  };
}
