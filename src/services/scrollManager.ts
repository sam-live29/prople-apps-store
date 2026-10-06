/**
 * Scroll Management & Preservation Service
 * 
 * Provides high-performance, seamless scroll position memory across:
 * - Tab and sub-tab transitions (Apps, Games, Search, You; For You, Top charts, Categories)
 * - Navigation between listings and detail pages (App Details, Search Results, Reviews, etc.)
 * - Browser reloads and refreshes (via in-memory cache backed by sessionStorage)
 * 
 * Eliminates aggressive auto-scroll resetting so browsing state is preserved.
 */
import React, { useEffect, useLayoutEffect, useRef } from 'react';

const STORAGE_KEY = 'prople_scroll_positions_v1';

class ScrollManager {
  private scrollMap = new Map<string, number>();
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      // Use manual scroll restoration so native browser behavior doesn't conflict with custom SPA containers
      if ('scrollRestoration' in window.history) {
        window.history.scrollRestoration = 'manual';
      }

      // Synchronize initial scroll state from sessionStorage
      try {
        if (window.sessionStorage) {
          const raw = window.sessionStorage.getItem(STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
              Object.entries(parsed).forEach(([k, v]) => {
                if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
                  this.scrollMap.set(k, Math.round(v));
                }
              });
            }
          }
        }
      } catch {
        // Fallback gracefully if storage is restricted
      }

      window.addEventListener('beforeunload', () => this.flushPersist());
      window.addEventListener('pagehide', () => this.flushPersist());
    }
  }

  public flushPersist(): void {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    try {
      const dump: Record<string, number> = {};
      this.scrollMap.forEach((v, k) => {
        dump[k] = v;
      });
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(dump));
    } catch {}
  }

  private schedulePersist(): void {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }
    this.persistTimer = setTimeout(() => {
      try {
        const dump: Record<string, number> = {};
        this.scrollMap.forEach((v, k) => {
          dump[k] = v;
        });
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(dump));
      } catch {
        // Storage quota full or restricted
      }
    }, 150);
  }

  /**
   * Record the vertical scroll position for a specific key
   */
  public saveScroll(key: string, scrollTop: number): void {
    if (!key || typeof scrollTop !== 'number' || !Number.isFinite(scrollTop) || scrollTop < 0) {
      return;
    }
    const rounded = Math.round(scrollTop);
    this.scrollMap.set(key, rounded);
    this.schedulePersist();
  }

  /**
   * Retrieve the preserved vertical scroll position for a given key
   */
  public getScroll(key: string): number {
    if (!key) return 0;
    return this.scrollMap.get(key) || 0;
  }

  /**
   * Attempt to restore the preserved scroll position to a target DOM element.
   * Returns true if a positive scroll offset was restored.
   */
  public restoreScroll(key: string, element: HTMLElement | null): boolean {
    if (!element || !key) return false;
    const saved = this.getScroll(key);
    if (saved > 0) {
      element.scrollTop = saved;
      return true;
    }
    return false;
  }

  /**
   * Clear the saved scroll position for a single key (e.g. on manual pull-to-refresh)
   */
  public clearScroll(key: string): void {
    if (!key) return;
    this.scrollMap.delete(key);
    this.schedulePersist();
  }

  /**
   * Clear all preserved scroll positions
   */
  public clearAllScrolls(): void {
    this.scrollMap.clear();
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {}
  }

  /**
   * Explicitly scrolls a container or the window to the top.
   * Only used when the user explicitly triggers an intentional scroll-to-top action.
   */
  public scrollToTop(element?: HTMLElement | null): void {
    if (element) {
      element.scrollTop = 0;
    }
  }

  /**
   * Deprecated / neutral no-op:
   * Aggressive resetting of all scroll containers across the DOM is removed
   * to preserve active scroll states during navigation.
   */
  public resetAllScrollContainers(): void {
    // No-op: Scroll positions are now preserved across views and navigation transitions.
  }
}

export const scrollManager = new ScrollManager();

/**
 * React Hook for persistent scroll preservation on any scrollable view container.
 * Restores position synchronously before first paint with zero auto-scroll animations or jumps.
 */
export function usePreserveScroll(
  key: string,
  ref: React.RefObject<HTMLElement | null>,
  enabled: boolean = true
) {
  // 1. Synchronously restore scroll position before browser paint — strictly no delayed timers or animated jumps
  useLayoutEffect(() => {
    if (!enabled || !key) return;
    const el = ref.current;
    if (!el) return;

    const saved = scrollManager.getScroll(key);
    if (saved > 0 && el.scrollTop === 0) {
      el.scrollTop = saved;
    }
  }, [key, enabled, ref]);

  // 2. Track scroll events passively
  useEffect(() => {
    if (!enabled || !key) return;
    const el = ref.current;
    if (!el) return;

    let rafId: number | null = null;
    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (ref.current) {
          scrollManager.saveScroll(key, ref.current.scrollTop);
        }
      });
    };

    el.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      if (ref.current) {
        scrollManager.saveScroll(key, ref.current.scrollTop);
      }
      el.removeEventListener('scroll', handleScroll);
    };
  }, [key, enabled, ref]);
}

/**
 * Hook to scroll to top explicitly on user-invoked action
 */
export function useScrollToTop(
  ref: React.RefObject<HTMLElement | null>,
  deps: React.DependencyList = []
) {
  useLayoutEffect(() => {
    scrollManager.scrollToTop(ref.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
