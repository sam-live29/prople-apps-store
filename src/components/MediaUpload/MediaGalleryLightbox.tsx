import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { extractYouTubeId } from '../../utils/mediaUtils';

interface MediaGalleryLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  mediaItems: Array<{
    type: 'image' | 'video';
    url: string;
    title?: string;
  }>;
  initialIndex?: number;
  appName?: string;
}

export default function MediaGalleryLightbox({
  isOpen,
  onClose,
  mediaItems,
  initialIndex = 0,
  appName = 'App'
}: MediaGalleryLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // Touch tracking references
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const initialDistanceRef = useRef<number | null>(null);
  const initialScaleRef = useRef<number>(1);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastTapTimeRef = useRef<number>(0);

  const resetZoom = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    setCurrentIndex(initialIndex);
    resetZoom();
  }, [initialIndex, isOpen, resetZoom]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && scale === 1) handleNext();
      if (e.key === 'ArrowLeft' && scale === 1) handlePrev();
      if (e.key === '+' || e.key === '=') zoomIn();
      if (e.key === '-' || e.key === '_') zoomOut();
      if (e.key === '0') resetZoom();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, mediaItems.length, scale, resetZoom]);

  // Close lightbox and stop video playback if page, tab, or history changes
  useEffect(() => {
    if (!isOpen) return;
    const handleStopAll = () => {
      onClose();
    };
    window.addEventListener('prople:stop:all:videos', handleStopAll);
    window.addEventListener('popstate', handleStopAll);
    return () => {
      window.removeEventListener('prople:stop:all:videos', handleStopAll);
      window.removeEventListener('popstate', handleStopAll);
    };
  }, [isOpen, onClose]);

  const validItems = mediaItems.filter(item => Boolean(item && item.url && typeof item.url === 'string' && item.url.trim().length > 0));

  if (!isOpen || validItems.length === 0) return null;

  const currentItem = validItems[currentIndex] || validItems[0];
  const youtubeId = extractYouTubeId(currentItem.url);
  const isVideo = currentItem.type === 'video' || Boolean(youtubeId);
  const isVerticalVideo = currentItem.url.includes('/shorts/');

  const handleNext = () => {
    if (validItems.length <= 1) return;
    resetZoom();
    setCurrentIndex((prev) => (prev + 1) % validItems.length);
  };

  const handlePrev = () => {
    if (validItems.length <= 1) return;
    resetZoom();
    setCurrentIndex((prev) => (prev - 1 + validItems.length) % validItems.length);
  };

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.5, 4));
  };

  const zoomOut = () => {
    setScale((prev) => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  // Double-tap zoom handler
  const handleDoubleTap = (e: React.MouseEvent | React.TouchEvent) => {
    if (isVideo) return;
    if (scale > 1) {
      resetZoom();
    } else {
      setScale(2.5);
    }
  };

  // Touch handlers for mobile pinch-to-zoom & pan
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Two fingers: initialize pinch
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialDistanceRef.current = dist;
      initialScaleRef.current = scale;
      touchStartX.current = null;
    } else if (e.touches.length === 1) {
      // One finger: detect double-tap or swipe / pan
      const now = Date.now();
      if (now - lastTapTimeRef.current < 300) {
        handleDoubleTap(e);
        lastTapTimeRef.current = 0;
        return;
      }
      lastTapTimeRef.current = now;

      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      panStartRef.current = {
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialDistanceRef.current !== null) {
      // Pinching gesture in progress
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / initialDistanceRef.current;
      const newScale = Math.min(Math.max(initialScaleRef.current * ratio, 1), 4);
      setScale(newScale);
      if (newScale === 1) {
        setPosition({ x: 0, y: 0 });
      }
    } else if (e.touches.length === 1 && scale > 1 && panStartRef.current) {
      // Panning zoomed image
      const newX = e.touches[0].clientX - panStartRef.current.x;
      const newY = e.touches[0].clientY - panStartRef.current.y;
      // Restrict pan bounds based on scale
      const maxPanX = (window.innerWidth * (scale - 1)) / 2;
      const maxPanY = (window.innerHeight * (scale - 1)) / 2;
      setPosition({
        x: Math.min(Math.max(newX, -maxPanX), maxPanX),
        y: Math.min(Math.max(newY, -maxPanY), maxPanY)
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      initialDistanceRef.current = null;
    }

    if (e.touches.length === 0) {
      panStartRef.current = null;

      // Handle horizontal swipe navigation only when not zoomed in
      if (scale === 1 && touchStartX.current !== null) {
        const touchEndX = e.changedTouches[0].clientX;
        const diffX = touchStartX.current - touchEndX;

        if (diffX > 50) {
          handleNext();
        } else if (diffX < -50) {
          handlePrev();
        }
      }
      touchStartX.current = null;
      touchStartY.current = null;

      if (scale < 1.05) {
        resetZoom();
      }
    }
  };

  // Mouse wheel zoom support for desktop
  const handleWheel = (e: React.WheelEvent) => {
    if (isVideo) return;
    if (e.deltaY < 0) {
      setScale((prev) => Math.min(prev + 0.25, 4));
    } else if (e.deltaY > 0) {
      setScale((prev) => {
        const next = Math.max(prev - 0.25, 1);
        if (next === 1) setPosition({ x: 0, y: 0 });
        return next;
      });
    }
  };

  const lightboxContent = (
    <div 
      id="media-gallery-lightbox-modal"
      className="fixed inset-0 z-[9999] bg-black text-white flex flex-col justify-between select-none animate-in fade-in duration-200"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
      style={{ touchAction: scale > 1 ? 'none' : 'pan-y pinch-zoom' }}
    >
      {/* Top Header Bar matching App Details Page header layout */}
      <div className="h-[60px] sm:h-[68px] flex items-center justify-between px-3 sm:px-4 md:px-6 bg-gradient-to-b from-black/90 to-transparent z-20 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
          <button
            type="button"
            id="media-lightbox-back-button"
            onClick={onClose}
            className="w-9 h-9 -ml-1 rounded-full text-white hover:bg-white/15 active:bg-white/25 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] transition-colors shrink-0 cursor-pointer flex items-center justify-center"
            aria-label="Back"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-white truncate max-w-[160px] sm:max-w-xs">{appName}</h3>
            {mediaItems.length > 1 && (
              <p className="text-xs text-white/60">
                {currentIndex + 1} of {mediaItems.length}
              </p>
            )}
          </div>
        </div>

        {/* Zoom Controls for Touch & Desktop */}
        {!isVideo && (
          <div className="flex items-center gap-1 sm:gap-2 bg-white/10 backdrop-blur-md rounded-full px-2 py-1 border border-white/10">
            <button
              type="button"
              onClick={zoomOut}
              disabled={scale <= 1}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/80 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Zoom out"
              title="Zoom out (-)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono font-medium text-white/90 min-w-[36px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={zoomIn}
              disabled={scale >= 4}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/80 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Zoom in"
              title="Zoom in (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            {scale > 1 && (
              <button
                type="button"
                onClick={resetZoom}
                className="w-8 h-8 rounded-full flex items-center justify-center text-amber-300 hover:text-amber-200 transition-colors ml-1"
                aria-label="Reset zoom"
                title="Reset zoom (0)"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Visual Display Stage */}
      <div className="flex-1 relative flex items-center justify-center p-2 sm:p-6 overflow-hidden">
        {/* Previous Button (Desktop) */}
        {mediaItems.length > 1 && scale === 1 && (
          <button
            onClick={handlePrev}
            className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-black/50 hover:bg-black/80 text-white/80 hover:text-white transition-colors backdrop-blur-md cursor-pointer"
            aria-label="Previous"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Media Frame (Supports Pinch & Pan Transformations) */}
        <div 
          className="max-w-full max-h-full flex items-center justify-center transition-transform duration-75 ease-out"
          style={{
            transform: `translate3d(${position.x}px, ${position.y}px, 0px) scale(${scale})`,
            transformOrigin: 'center center',
            cursor: scale > 1 ? 'grab' : 'zoom-in',
          }}
          onDoubleClick={handleDoubleTap}
        >
          {isVideo && youtubeId ? (
            <div 
              style={{
                aspectRatio: isVerticalVideo ? '9 / 16' : '16 / 9',
                maxWidth: isVerticalVideo ? 'min(90vw, calc(80vh * 9 / 16))' : 'min(90vw, 960px, calc(80vh * 16 / 9))',
                width: '100%',
                height: 'auto'
              }}
              className="rounded-[4px] overflow-hidden shadow-2xl bg-black"
            >
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0&playsinline=1`}
                title={currentItem.title || `${appName} video preview`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="w-full h-full aspect-[16/9] border-0"
              />
            </div>
          ) : currentItem?.url ? (
            <div className="rounded-[4px] overflow-hidden shadow-2xl flex items-center justify-center">
              <img
                src={currentItem.url}
                alt={currentItem.title || `${appName} preview ${currentIndex + 1}`}
                className="max-h-[85vh] w-auto max-w-full object-contain rounded-[4px] select-none"
                draggable={false}
              />
            </div>
          ) : null}
        </div>

        {/* Next Button (Desktop) */}
        {mediaItems.length > 1 && scale === 1 && (
          <button
            onClick={handleNext}
            className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-black/50 hover:bg-black/80 text-white/80 hover:text-white transition-colors backdrop-blur-md cursor-pointer"
            aria-label="Next"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(lightboxContent, document.body);
  }

  return lightboxContent;
}
