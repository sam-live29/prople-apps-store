import React, { useState, useEffect, useRef } from 'react';
import {
  ColumnStackSkeleton,
  LandscapeCardsSkeleton,
  SquircleRowSkeleton,
  EditorialCardSkeleton,
  SearchSuggestionsSkeleton,
} from './HomeSkeleton';

export type FeedSectionType =
  | 'column_stack'
  | 'landscape_cards'
  | 'squircle_row'
  | 'video_cards'
  | 'top_rated'
  | 'editorial_feature'
  | 'search_suggestions';

interface LazyFeedSectionProps {
  sectionType: FeedSectionType;
  title?: string;
  priority?: boolean;
  rootMargin?: string;
  children: React.ReactNode;
}

/**
 * LazyFeedSection
 * Progressively loads home feed marketplace sections when approaching the viewport.
 * While awaiting viewport entry, renders the exact matching skeleton.
 * Eliminates large blank areas, freezes, and cumulative layout shifts.
 */
export default function LazyFeedSection({
  sectionType,
  title,
  priority = false,
  rootMargin = '350px 0px',
  children,
}: LazyFeedSectionProps) {
  const [isVisible, setIsVisible] = useState(priority);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (priority || isVisible) return;

    const el = containerRef.current;
    if (!el) return;

    // Use IntersectionObserver with generous margin so content arrives seamlessly before user reaches it
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        },
        {
          rootMargin,
          threshold: 0.01,
        }
      );

      observer.observe(el);
      return () => observer.disconnect();
    } else {
      // Fallback for older browsers
      setIsVisible(true);
    }
  }, [priority, isVisible, rootMargin]);

  if (isVisible) {
    return (
      <div ref={containerRef} className="w-full animate-in fade-in duration-200">
        {children}
      </div>
    );
  }

  // Render the archetype-matched skeleton placeholder
  return (
    <div ref={containerRef} className="w-full" aria-busy="true" aria-label={`Loading ${title || 'section'}`}>
      {sectionType === 'column_stack' && <ColumnStackSkeleton />}
      {(sectionType === 'landscape_cards' || sectionType === 'video_cards') && <LandscapeCardsSkeleton />}
      {(sectionType === 'squircle_row' || sectionType === 'top_rated') && <SquircleRowSkeleton />}
      {sectionType === 'editorial_feature' && <EditorialCardSkeleton />}
      {sectionType === 'search_suggestions' && <SearchSuggestionsSkeleton />}
    </div>
  );
}
