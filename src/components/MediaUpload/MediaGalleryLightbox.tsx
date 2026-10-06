import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
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
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, mediaItems.length]);

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
    setCurrentIndex((prev) => (prev + 1) % validItems.length);
  };

  const handlePrev = () => {
    if (validItems.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + validItems.length) % validItems.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchStartX.current - touchEndX;

    if (diffX > 50) {
      handleNext();
    } else if (diffX < -50) {
      handlePrev();
    }
    touchStartX.current = null;
  };

  const lightboxContent = (
    <div 
      id="media-gallery-lightbox-modal"
      className="fixed inset-0 z-[9999] bg-black text-white flex flex-col justify-between select-none animate-in fade-in duration-200"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
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
            <h3 className="text-sm font-medium text-white truncate max-w-[200px] sm:max-w-xs">{appName}</h3>
            {mediaItems.length > 1 && (
              <p className="text-xs text-white/60">
                {currentIndex + 1} of {mediaItems.length}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Main Visual Display Stage */}
      <div className="flex-1 relative flex items-center justify-center p-2 sm:p-6 overflow-hidden">
        {/* Previous Button (Desktop) */}
        {mediaItems.length > 1 && (
          <button
            onClick={handlePrev}
            className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-black/50 hover:bg-black/80 text-white/80 hover:text-white transition-colors backdrop-blur-md cursor-pointer"
            aria-label="Previous"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Media Frame (Borderless, sharp corners) */}
        <div className="max-w-full max-h-full flex items-center justify-center">
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
                className="max-h-[85vh] w-auto max-w-full object-contain pointer-events-none rounded-[4px]"
              />
            </div>
          ) : null}
        </div>

        {/* Next Button (Desktop) */}
        {mediaItems.length > 1 && (
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
