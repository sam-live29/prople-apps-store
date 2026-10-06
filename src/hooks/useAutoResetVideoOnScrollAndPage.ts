import React, { useEffect, useRef } from 'react';

export interface AutoResetVideoOptions {
  /** Whether the video is actively playing in an iframe or player */
  isPlaying: boolean;
  /** Callback to stop playback and reset back to cover/thumbnail state */
  onReset: () => void;
  /** Ref of the container DOM element wrapping the video player */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Minimum visible ratio required to keep playing (default: 0.15 = 15% visible) */
  minVisibilityRatio?: number;
  /** Unique identifier for this video (appId, url, or slot key) to coordinate exclusive single playback */
  videoId?: string;
}

/**
 * Custom React hook ensuring all app preview videos strictly conform to:
 * 1. Immediate stop & reset when page/tab/subtab/overlay changes or user navigates.
 * 2. Immediate stop & reset when scrolling (vertically or horizontally) moves the video outside the visible viewport.
 * 3. Exclusive playback coordination: playing one video stops any other active video.
 */
export function useAutoResetVideoOnScrollAndPage({
  isPlaying,
  onReset,
  containerRef,
  minVisibilityRatio = 0.15,
  videoId,
}: AutoResetVideoOptions) {
  const onResetRef = useRef(onReset);
  onResetRef.current = onReset;

  const currentIdRef = useRef(videoId || Math.random().toString(36).slice(2));
  if (videoId) currentIdRef.current = videoId;

  // 1. Listen for global navigation and page change events
  useEffect(() => {
    const handleGlobalStop = () => {
      if (isPlaying) {
        onResetRef.current();
      }
    };

    const handleVideoStarted = (e: Event) => {
      const customEvt = e as CustomEvent<{ id?: string }>;
      if (isPlaying && customEvt.detail?.id && customEvt.detail.id !== currentIdRef.current) {
        onResetRef.current();
      }
    };

    window.addEventListener('prople:stop:all:videos', handleGlobalStop);
    window.addEventListener('popstate', handleGlobalStop);
    window.addEventListener('hashchange', handleGlobalStop);
    window.addEventListener('prople:video:started', handleVideoStarted);

    return () => {
      window.removeEventListener('prople:stop:all:videos', handleGlobalStop);
      window.removeEventListener('popstate', handleGlobalStop);
      window.removeEventListener('hashchange', handleGlobalStop);
      window.removeEventListener('prople:video:started', handleVideoStarted);
    };
  }, [isPlaying]);

  // 2. Broadcast when playback starts & monitor viewport/scroll visibility
  useEffect(() => {
    if (!isPlaying) return;

    // Notify other components that a new video started playing so they stop
    window.dispatchEvent(
      new CustomEvent('prople:video:started', {
        detail: { id: currentIdRef.current },
      })
    );

    const targetEl = containerRef.current;
    if (!targetEl) return;

    let isDisposed = false;

    // Check bounds against viewport and scrollable ancestors
    const checkVisibility = () => {
      if (isDisposed || !containerRef.current) return;
      const el = containerRef.current;
      const rect = el.getBoundingClientRect();

      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

      // Complete vertical or horizontal exit from window viewport
      const isCompletelyOffScreen =
        rect.bottom <= 2 ||
        rect.top >= viewportHeight - 2 ||
        rect.right <= 2 ||
        rect.left >= viewportWidth - 2;

      if (isCompletelyOffScreen) {
        isDisposed = true;
        onResetRef.current();
        return;
      }

      // Proportional visible area test inside the window
      const visibleWidth = Math.max(0, Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0));
      const visibleHeight = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));
      const visibleArea = visibleWidth * visibleHeight;
      const totalArea = rect.width * rect.height;

      if (totalArea > 0 && visibleArea / totalArea < minVisibilityRatio) {
        isDisposed = true;
        onResetRef.current();
        return;
      }

      // Check bounds within nearest scrollable parent (e.g. horizontal carousel)
      let parent = el.parentElement;
      while (parent && parent !== document.body) {
        const style = window.getComputedStyle(parent);
        const isScrollable =
          style.overflowX === 'auto' ||
          style.overflowX === 'scroll' ||
          style.overflowY === 'auto' ||
          style.overflowY === 'scroll';

        if (isScrollable) {
          const parentRect = parent.getBoundingClientRect();
          const isOutsideParent =
            rect.right <= parentRect.left + 5 ||
            rect.left >= parentRect.right - 5 ||
            rect.bottom <= parentRect.top + 5 ||
            rect.top >= parentRect.bottom - 5;

          if (isOutsideParent) {
            isDisposed = true;
            onResetRef.current();
            return;
          }
        }
        parent = parent.parentElement;
      }
    };

    // IntersectionObserver for native browser-optimized viewport tracking
    let observer: IntersectionObserver | null = null;
    try {
      observer = new IntersectionObserver(
        (entries) => {
          if (isDisposed) return;
          for (const entry of entries) {
            if (!entry.isIntersecting || entry.intersectionRatio < minVisibilityRatio) {
              isDisposed = true;
              onResetRef.current();
              break;
            }
          }
        },
        {
          root: null, // Viewport
          threshold: [0, minVisibilityRatio, 0.5, 1.0],
        }
      );
      observer.observe(targetEl);
    } catch {
      // Fallback to scroll listeners if IntersectionObserver fails
    }

    // Capture: true listens to scroll events on ANY element (both window and carousels)
    const handleScrollOrResize = () => {
      checkVisibility();
    };

    window.addEventListener('scroll', handleScrollOrResize, { passive: true, capture: true });
    window.addEventListener('resize', handleScrollOrResize, { passive: true });

    // Initial check in case it was triggered off-screen
    checkVisibility();

    return () => {
      isDisposed = true;
      if (observer) {
        try {
          observer.disconnect();
        } catch {}
      }
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isPlaying, minVisibilityRatio, containerRef]);
}
