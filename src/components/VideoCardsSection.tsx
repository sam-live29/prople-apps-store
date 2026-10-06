import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { Star, ArrowRight, Play, X, Maximize2 } from 'lucide-react';
import { AppListing } from '../types';
import StoreCircleLoader from './StoreCircleLoader';
import AppLazyImage from './AppLazyImage';
import { getUnifiedAppSize, getAppTrailerYoutubeId } from '../utils/appMetricsAlgorithm';
import { getYouTubeThumbnail } from '../utils/mediaUtils';
import { deriveDynamicSectionTitle } from '../utils/dynamicStoreFeedAlgorithm';
import MediaGalleryLightbox from './MediaUpload/MediaGalleryLightbox';
import { saveSectionScroll, getSectionScroll } from '../services/sectionScrollMemoryService';
import { useAutoResetVideoOnScrollAndPage } from '../hooks/useAutoResetVideoOnScrollAndPage';

interface VideoCardItemProps {
  key?: React.Key;
  app: AppListing;
  full: any;
  ytId?: string | null;
  thumbUrl: string;
  isPlaying: boolean;
  onPlay: () => void;
  onReset: () => void;
  onAppClick: (appId: string) => void;
  onOpenLightbox: () => void;
  hasDraggedRef: React.MutableRefObject<boolean>;
  ratingVal: string | null;
  sizeVal: string;
  genreStr: string;
}

function VideoCardItem({
  app,
  ytId,
  thumbUrl,
  isPlaying,
  onPlay,
  onReset,
  onAppClick,
  onOpenLightbox,
  hasDraggedRef,
  ratingVal,
  sizeVal,
  genreStr,
}: VideoCardItemProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Automatically pause, stop, and reset video playback when scrolled out of view or on page/tab change
  useAutoResetVideoOnScrollAndPage({
    isPlaying,
    onReset,
    containerRef: cardRef,
    videoId: `video-cards-section-${app.id}`,
    minVisibilityRatio: 0.15,
  });

  return (
    <div
      ref={cardRef}
      className="w-[calc(100vw-32px)] sm:w-[320px] md:w-[340px] shrink-0 flex flex-col select-none group"
    >
      {/* Video Player or Provided Custom Thumbnail */}
      <div 
        className="relative aspect-video w-full rounded-2xl overflow-hidden shadow-xs mb-2.5 bg-zinc-950 transition-all"
      >
        {ytId && isPlaying ? (
          /* Raw YouTube Video iframe */
          <div className="relative w-full h-full bg-black">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0&playsinline=1&modestbranding=1&enablejsapi=1`}
              title={`${app.name} Video`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="w-full h-full border-0"
            />

            {/* Controls Overlay: Always show BOTH Fullscreen and Close buttons */}
            <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-20 pointer-events-auto">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenLightbox();
                }}
                title="Fullscreen Theater Mode"
                className="p-1.5 rounded-full bg-black/75 hover:bg-black/90 text-white backdrop-blur-md transition-colors cursor-pointer shadow-md"
                aria-label="Open fullscreen"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onReset();
                }}
                title="Close Video"
                className="p-1.5 rounded-full bg-black/75 hover:bg-black/90 text-white backdrop-blur-md transition-colors cursor-pointer shadow-md"
                aria-label="Close video"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          /* Video Thumbnail provided or derived */
          <div 
            className="relative w-full h-full cursor-pointer"
            onClick={() => {
              if (hasDraggedRef.current) return;
              if (ytId) {
                onPlay();
              } else {
                onAppClick(app.id);
              }
            }}
          >
            <AppLazyImage
              src={thumbUrl || (ytId ? getYouTubeThumbnail(ytId, 'hq') : '')}
              alt={`${app.name} Trailer`}
              className="w-full h-full object-cover select-none pointer-events-none brightness-95"
              containerClassName="w-full h-full"
            />
            <div className="absolute inset-0 bg-black/25 pointer-events-none" />

            {/* Play Button Overlay */}
            {ytId && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-12 h-12 rounded-full bg-black/60 backdrop-blur-xs flex items-center justify-center text-white shadow-lg group-hover:bg-black/75 transition-colors">
                  <Play className="w-5 h-5 fill-white text-white ml-0.5" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* App Info Row - Clicking takes user to app details */}
      <div 
        onClick={() => {
          if (!hasDraggedRef.current) {
            onAppClick(app.id);
          }
        }}
        className="flex items-center gap-3 px-0.5 cursor-pointer"
      >
        {/* Standardized App Icon Container */}
        <div className="w-12 h-12 rounded-2xl overflow-hidden bg-theme-hover shrink-0 shadow-xs flex items-center justify-center">
          <AppLazyImage
            src={app.iconUrl}
            alt={app.name}
            fallbackText={app.name}
            className="w-full h-full object-cover select-none pointer-events-none"
            containerClassName="w-full h-full"
          />
        </div>

        <div className="min-w-0 flex-1">
          <h4 className="text-[14px] sm:text-[15px] font-semibold text-theme-text truncate leading-snug group-hover:text-blue-500 transition-colors uppercase tracking-tight">
            {app.name}
          </h4>
          <p className="text-xs text-theme-text-muted truncate mt-0.5">
            {genreStr}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-theme-text-muted mt-0.5">
            {ratingVal ? (
              <>
                <span className="flex items-center gap-0.5 text-theme-text font-medium">
                  <span>{ratingVal}</span>
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400 inline" />
                </span>
                <span>•</span>
              </>
            ) : (
              <>
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">New</span>
                <span>•</span>
              </>
            )}
            <span className="truncate">{sizeVal}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface VideoCardsSectionProps {
  title?: string;
  subtitle?: string;
  apps: AppListing[];
  appsMap?: Record<string, any>;
  onAppClick: (appId: string) => void;
  onSeeAll?: () => void;
  defaultCategoryTag?: string;
  sectionId?: string;
}

export default function VideoCardsSection({
  title,
  subtitle,
  apps,
  appsMap = {},
  onAppClick,
  onSeeAll,
  defaultCategoryTag,
  sectionId,
}: VideoCardsSectionProps) {
  const activeSectionId = sectionId || title || 'video_cards_section';
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasDraggedRef = useRef(false);

  const [displayCount, setDisplayCount] = useState(12);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [playingAppId, setPlayingAppId] = useState<string | null>(null);
  const [lightboxApp, setLightboxApp] = useState<{ app: AppListing; ytId: string } | null>(null);

  // Restore and maintain the exact scroll position across app installs and navigation without jumps
  useLayoutEffect(() => {
    if (!scrollRef.current) return;
    const saved = getSectionScroll(activeSectionId);
    if (saved > 0 && scrollRef.current.scrollLeft === 0) {
      scrollRef.current.scrollLeft = saved;
    }
  }, [activeSectionId]);

  // Only apps with genuine available YouTube trailers or promo videos
  const appsWithTrailers = React.useMemo(() => {
    return apps.filter(a => {
      const full = appsMap[a.id] || a;
      return Boolean(getAppTrailerYoutubeId(a) || getAppTrailerYoutubeId(full) || a.promoVideoUrl || full.promoVideoUrl);
    });
  }, [apps, appsMap]);

  if (!appsWithTrailers || appsWithTrailers.length === 0) return null;

  const visibleApps = appsWithTrailers.slice(0, displayCount);
  const hasMore = appsWithTrailers.length > displayCount;

  // Derive dynamic title and tag if not provided
  const dynamicMeta = React.useMemo(() => {
    return deriveDynamicSectionTitle(appsWithTrailers, 'video', 0);
  }, [appsWithTrailers]);

  const displayTitle = title || dynamicMeta.title;
  const displaySubtitle = subtitle || dynamicMeta.subtitle;
  const displayTag = defaultCategoryTag || dynamicMeta.tag;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    saveSectionScroll(activeSectionId, el.scrollLeft);
    if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 80) {
      if (hasMore && !isLoadingMore) {
        setIsLoadingMore(true);
        setTimeout(() => {
          setDisplayCount(prev => prev + 10);
          setIsLoadingMore(false);
        }, 250);
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || !scrollRef.current) return;
    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    startXRef.current = e.pageX;
    scrollLeftRef.current = scrollRef.current.scrollLeft;
  };

  const handleMouseLeave = () => {
    isDraggingRef.current = false;
    if (scrollRef.current) {
      saveSectionScroll(activeSectionId, scrollRef.current.scrollLeft);
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    if (scrollRef.current) {
      saveSectionScroll(activeSectionId, scrollRef.current.scrollLeft);
    }
    setTimeout(() => {
      hasDraggedRef.current = false;
    }, 80);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !scrollRef.current) return;
    const deltaX = e.pageX - startXRef.current;
    if (Math.abs(deltaX) > 3) {
      hasDraggedRef.current = true;
      const maxScroll = scrollRef.current.scrollWidth - scrollRef.current.clientWidth;
      const nextScroll = Math.max(0, Math.min(scrollLeftRef.current - deltaX, maxScroll));
      scrollRef.current.scrollLeft = nextScroll;
      saveSectionScroll(activeSectionId, nextScroll);
    }
  };

  if (visibleApps.length === 0) return null;

  return (
    <section className="w-full py-2">
      {/* Section Header */}
      <div className="flex justify-between items-start mb-3 px-2.5 sm:px-4 md:px-6">
        <button
          type="button"
          onClick={onSeeAll}
          className="flex flex-col group cursor-pointer text-left focus:outline-none"
        >
          <h2 className="text-[19px] sm:text-[20px] font-semibold text-[#0f172a] dark:text-[#f3f4f6] tracking-tight group-hover:text-[#0b57d0] transition-colors">
            {displayTitle}
          </h2>
          {displaySubtitle && (
            <p className="text-xs text-[#475569] dark:text-[#9aa0a6] mt-0.5 group-hover:text-[#0b57d0]/80 transition-colors">
              {displaySubtitle}
            </p>
          )}
        </button>
        {onSeeAll && (
          <button
            type="button"
            onClick={onSeeAll}
            className="w-8 h-8 rounded-full flex items-center justify-center text-theme-text-muted hover:text-theme-text hover:bg-theme-hover transition-colors cursor-pointer shrink-0 mt-0.5"
            aria-label={`See all in ${displayTitle}`}
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Horizontal Carousel - Matched to Skeleton */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        className="flex gap-3.5 sm:gap-4 overflow-x-auto scrollbar-hide pb-2 px-2.5 sm:px-4 md:px-6 items-start cursor-grab active:cursor-grabbing select-none w-full overscroll-x-contain"
        style={{
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-x pan-y',
          overscrollBehaviorX: 'contain',
          overscrollBehaviorY: 'auto',
        }}
      >
        {visibleApps.map((app) => {
          const full = appsMap[app.id] || app;
          const ytId = getAppTrailerYoutubeId(app) || getAppTrailerYoutubeId(full);
          const thumbUrl =
            app.videoThumbnailUrl ||
            full.videoThumbnailUrl ||
            (ytId ? getYouTubeThumbnail(ytId, 'maxres') : '') ||
            app.featureGraphicUrl ||
            full.featureGraphicUrl ||
            (ytId ? getYouTubeThumbnail(ytId, 'hq') : '') ||
            '';
          const ratingNum = typeof app.rating === 'number' ? app.rating : (typeof full.rating === 'number' ? full.rating : 0);
          const ratingVal = ratingNum > 0 ? ratingNum.toFixed(1) : null;
          const sizeVal = getUnifiedAppSize(app);
          const genreStr = app.category || full.category || displayTag || 'Action';
          const isPlaying = playingAppId === app.id;

          return (
            <VideoCardItem
              key={app.id}
              app={app}
              full={full}
              ytId={ytId}
              thumbUrl={thumbUrl}
              isPlaying={isPlaying}
              onPlay={() => setPlayingAppId(app.id)}
              onReset={() => {
                if (playingAppId === app.id) setPlayingAppId(null);
              }}
              onAppClick={onAppClick}
              onOpenLightbox={() => setLightboxApp({ app, ytId: ytId || '' })}
              hasDraggedRef={hasDraggedRef}
              ratingVal={ratingVal}
              sizeVal={sizeVal}
              genreStr={genreStr}
            />
          );
        })}

        {/* Loading spinner when scrolling horizontally */}
        {isLoadingMore && (
          <div className="shrink-0 flex items-center justify-center self-center my-auto h-[160px] px-5 select-none animate-in fade-in duration-150">
            <StoreCircleLoader size="sm" minHeightClass="min-h-0" />
          </div>
        )}
      </div>

      {/* Fullscreen Video Theater Lightbox */}
      {lightboxApp && (
        <MediaGalleryLightbox
          isOpen={true}
          onClose={() => setLightboxApp(null)}
          mediaItems={[
            {
              type: 'video',
              url: `https://www.youtube.com/watch?v=${lightboxApp.ytId}`,
              title: `${lightboxApp.app.name} Gameplay Trailer`
            }
          ]}
          initialIndex={0}
          appName={lightboxApp.app.name}
        />
      )}
    </section>
  );
}
