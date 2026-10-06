import React, { useState, useRef, useEffect, ReactNode } from 'react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  isRefreshing?: boolean;
  children: ReactNode;
  disabled?: boolean;
  scrollRef?: React.RefObject<HTMLElement | null>;
  className?: string;
  dismissIndicatorOnTrigger?: boolean;
  dismissBeforeEnd?: boolean;
  earlyDismissDurationMs?: number;
}

const PULL_THRESHOLD = 64; // px of intentional displacement

export default function PullToRefresh({
  onRefresh,
  isRefreshing = false,
  children,
  disabled = false,
  scrollRef,
  className = "relative w-full",
  dismissIndicatorOnTrigger = false,
  dismissBeforeEnd = false,
  earlyDismissDurationMs,
}: PullToRefreshProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollParentRef = useRef<HTMLElement | null>(null);
  const shouldDismissOnTrigger = dismissIndicatorOnTrigger;
  const effectiveEarlyDismissDurationMs = earlyDismissDurationMs ?? (dismissBeforeEnd ? 300 : undefined);

  const [pullDistance, setPullDistance] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isIndicatorActive, setIsIndicatorActive] = useState(isRefreshing);
  const [isDismissingEarly, setIsDismissingEarly] = useState(false);
  const [isDismissedEarly, setIsDismissedEarly] = useState(false);

  // Store active refs to avoid rebinding listeners on every state update
  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const canPullRef = useRef(false);
  const isDraggingRef = useRef(false);
  const currentPullDistanceRef = useRef(0);
  const isRefreshingRef = useRef(isRefreshing);
  isRefreshingRef.current = isRefreshing;
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  const dismissIndicatorOnTriggerRef = useRef(shouldDismissOnTrigger);
  dismissIndicatorOnTriggerRef.current = shouldDismissOnTrigger;

  // Locate the closest scrollable container (.overflow-y-auto or <main> or explicitly provided scrollRef)
  const findScrollContainer = (): HTMLElement | null => {
    if (scrollRef?.current && document.body.contains(scrollRef.current)) {
      return scrollRef.current;
    }
    if (scrollParentRef.current && document.body.contains(scrollParentRef.current)) {
      return scrollParentRef.current;
    }
    if (!containerRef.current) return null;

    // Check ancestors first (e.g. <main> or wrapper)
    let el: HTMLElement | null = containerRef.current.parentElement;
    while (el) {
      const overflowY = window.getComputedStyle(el).overflowY;
      if (overflowY === 'auto' || overflowY === 'scroll' || el.tagName.toLowerCase() === 'main') {
        scrollParentRef.current = el;
        return el;
      }
      el = el.parentElement;
    }

    // Check container itself
    const selfOverflow = window.getComputedStyle(containerRef.current).overflowY;
    if (selfOverflow === 'auto' || selfOverflow === 'scroll') {
      scrollParentRef.current = containerRef.current;
      return containerRef.current;
    }

    // Check direct children with scrollable class
    const childScroll = containerRef.current.querySelector<HTMLElement>('.overflow-y-auto, [data-scroll-container]');
    if (childScroll) {
      scrollParentRef.current = childScroll;
      return childScroll;
    }

    return null;
  };

  const getScrollTop = (): number => {
    const parent = findScrollContainer();
    return parent ? parent.scrollTop : (window.scrollY || document.documentElement.scrollTop || 0);
  };

  const updatePullDistance = (d: number) => {
    currentPullDistanceRef.current = d;
    setPullDistance(d);
  };

  useEffect(() => {
    const parent = findScrollContainer();
    const target = parent || containerRef.current;
    if (!target || disabled) return;

    const onStart = (clientY: number, clientX: number) => {
      if (isRefreshingRef.current || disabled) return;
      if (getScrollTop() <= 1) {
        canPullRef.current = true;
        isDraggingRef.current = false;
        startYRef.current = clientY;
        startXRef.current = clientX;
      } else {
        canPullRef.current = false;
      }
    };

    const onMove = (clientY: number, clientX: number, cancelable: boolean, preventDefault: () => void) => {
      if (!canPullRef.current || isRefreshingRef.current || disabled) return;

      const deltaY = clientY - startYRef.current;
      const deltaX = clientX - startXRef.current;

      // Only intercept if strictly at the very top (scrollTop <= 0) and user is pulling downward
      if (getScrollTop() > 0) {
        canPullRef.current = false;
        isDraggingRef.current = false;
        setIsDragging(false);
        updatePullDistance(0);
        return;
      }

      // If predominantly horizontal swipe (e.g. scrolling banners or app card rows)
      if (Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
        canPullRef.current = false;
        isDraggingRef.current = false;
        setIsDragging(false);
        updatePullDistance(0);
        return;
      }

      // If user is swiping upward (scrolling down into content), let native scrolling happen uninhibited!
      if (deltaY <= 0) {
        canPullRef.current = false;
        isDraggingRef.current = false;
        setIsDragging(false);
        updatePullDistance(0);
        return;
      }

      // If pulling down with significant, deliberate intent (at least 18px downward)
      if (deltaY > 18) {
        // Elastic tension curve
        const damped = Math.min(88, Math.pow(deltaY - 18, 0.82) * 1.35);
        if (damped > 4) {
          if (cancelable) {
            preventDefault();
          }
          isDraggingRef.current = true;
          setIsDragging(true);
          updatePullDistance(damped);
        }
      } else {
        updatePullDistance(0);
        isDraggingRef.current = false;
        setIsDragging(false);
      }
    };

    const onEnd = () => {
      if (!canPullRef.current) return;
      canPullRef.current = false;

      const wasDragging = isDraggingRef.current;
      const dist = currentPullDistanceRef.current;
      isDraggingRef.current = false;
      setIsDragging(false);

      if (wasDragging && dist >= PULL_THRESHOLD) {
        // Threshold reached: trigger refresh
        if (dismissIndicatorOnTriggerRef.current) {
          updatePullDistance(0);
        } else {
          updatePullDistance(PULL_THRESHOLD);
        }
        try {
          onRefreshRef.current();
        } catch (err) {
          console.error('Refresh failed:', err);
        }
      } else {
        updatePullDistance(0);
      }
    };

    // Touch events for mobile
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        onStart(e.touches[0].clientY, e.touches[0].clientX);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        onMove(e.touches[0].clientY, e.touches[0].clientX, e.cancelable, () => e.preventDefault());
      }
    };

    const handleTouchEnd = () => {
      onEnd();
    };

    target.addEventListener('touchstart', handleTouchStart, { passive: true });
    target.addEventListener('touchmove', handleTouchMove, { passive: false });
    target.addEventListener('touchend', handleTouchEnd, { passive: true });
    target.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      target.removeEventListener('touchstart', handleTouchStart);
      target.removeEventListener('touchmove', handleTouchMove);
      target.removeEventListener('touchend', handleTouchEnd);
      target.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [disabled, scrollRef?.current]);

  // Synchronize when refreshing state finishes or early dismissal is configured
  useEffect(() => {
    if (shouldDismissOnTrigger) {
      setPullDistance(0);
      setIsDragging(false);
      setIsIndicatorActive(false);
      setIsDismissingEarly(false);
      setIsDismissedEarly(false);
      return;
    }

    if (isRefreshing) {
      setIsIndicatorActive(true);
      setIsDismissingEarly(false);
      setIsDismissedEarly(false);
      setPullDistance(PULL_THRESHOLD);

      if (effectiveEarlyDismissDurationMs && effectiveEarlyDismissDurationMs > 0) {
        const timer = setTimeout(() => {
          setIsDismissingEarly(true);
          const finishTimer = setTimeout(() => {
            setIsIndicatorActive(false);
            setIsDismissingEarly(false);
            setIsDismissedEarly(true);
            setPullDistance(0);
            setIsDragging(false);
          }, 200);
          return () => clearTimeout(finishTimer);
        }, effectiveEarlyDismissDurationMs);
        return () => clearTimeout(timer);
      }
    } else {
      setIsDismissingEarly(false);
      setIsDismissedEarly(false);
      const timer = setTimeout(() => {
        setIsIndicatorActive(false);
        setPullDistance(0);
        setIsDragging(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isRefreshing, shouldDismissOnTrigger, effectiveEarlyDismissDurationMs]);

  const pullRatio = Math.min(1, pullDistance / PULL_THRESHOLD);
  const isThresholdMet = pullDistance >= PULL_THRESHOLD;
  const isSpinnerActive = !isDismissedEarly && (isIndicatorActive || isRefreshing || isDismissingEarly);
  const isVisible = shouldDismissOnTrigger
    ? (isDragging && pullDistance > 6)
    : !isDismissedEarly && ((pullDistance > 6 && isDragging) || isSpinnerActive);
  const rotationDegrees = Math.min(360, pullRatio * 280);

  return (
    <div ref={containerRef} className={className}>
      {/* Material 3 Floating Pill Spinner Indicator */}
      {isVisible && (
        <div
          className={`absolute inset-x-0 z-50 flex justify-center pointer-events-none transition-all ${
            isDragging ? 'duration-0' : isDismissingEarly ? 'duration-200 ease-in' : 'duration-300 ease-out'
          }`}
          style={{
            top: isDismissingEarly 
              ? '4px' 
              : isSpinnerActive 
                ? '14px' 
                : `${Math.max(6, pullDistance - 36)}px`,
            opacity: isDismissingEarly 
              ? 0 
              : isSpinnerActive 
                ? 1 
                : Math.min(1, Math.max(0, (pullDistance - 6) / 22)),
            transform: isDismissingEarly 
              ? 'scale(0.65)' 
              : `scale(${isSpinnerActive ? 1 : Math.min(1, 0.45 + pullRatio * 0.55)})`,
          }}
          aria-live="polite"
        >
          <div className="w-10 h-10 flex items-center justify-center pointer-events-none">
            {isSpinnerActive ? (
              <svg
                className="m3-spinner drop-shadow-sm"
                width={28}
                height={28}
                viewBox="0 0 50 50"
              >
                <circle
                  cx={25}
                  cy={25}
                  r={18}
                  fill="none"
                  strokeWidth={4.5}
                  className="stroke-blue-500/20 dark:stroke-blue-400/25"
                />
                <circle
                  className="m3-spinner-circle stroke-blue-600 dark:stroke-blue-400"
                  cx={25}
                  cy={25}
                  r={18}
                  fill="none"
                  strokeWidth={4.5}
                />
              </svg>
            ) : (
              <svg 
                className="transition-transform drop-shadow-sm" 
                style={{ transform: `rotate(${rotationDegrees}deg)` }}
                width={28}
                height={28}
                viewBox="0 0 50 50"
              >
                <circle
                  cx={25}
                  cy={25}
                  r={18}
                  fill="none"
                  strokeWidth={4.5}
                  className="stroke-zinc-400/40 dark:stroke-zinc-600/40"
                />
                <circle
                  cx={25}
                  cy={25}
                  r={18}
                  fill="none"
                  strokeWidth={4.5}
                  strokeDasharray="113.1"
                  strokeDashoffset={Math.max(0, 113.1 * (1 - pullRatio))}
                  strokeLinecap="round"
                  className={`transition-colors duration-150 ${
                    isThresholdMet 
                      ? 'stroke-blue-600 dark:stroke-blue-400' 
                      : 'stroke-zinc-500 dark:stroke-zinc-300'
                  }`}
                />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Main View Content - static layout, not pulled down */}
      <div className={className.includes('flex-1') ? 'flex-1 min-h-0 flex flex-col w-full' : 'w-full'}>
        {children}
      </div>
    </div>
  );
}
