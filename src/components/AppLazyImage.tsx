import React, { useState, useEffect, useRef } from 'react';

export interface AppLazyImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null;
  alt?: string;
  className?: string;
  containerClassName?: string;
  skeletonClassName?: string;
  fallbackText?: string;
  fallbackIcon?: React.ReactNode;
  fallbackClassName?: string;
  aspectRatio?: string | number;
}

// Module-level image cache across navigation and tab switches
const globalLoadedImageCache = new Set<string>();

/**
 * AppLazyImage
 * Progressive lazy-loading image component.
 * Features:
 * - Instant rendering if image URL was previously loaded in the session (0ms delay, 0 shimmer)
 * - Lightweight shimmer/pulse skeleton placeholder during initial fetch
 * - Native lazy loading and asynchronous decoding
 * - Smooth opacity fade-in on first load only (CLS = 0)
 * - Safe fallback for broken/missing URLs without browser error artifacts
 */
export default function AppLazyImage({
  src,
  alt = '',
  className = 'w-full h-full object-cover',
  containerClassName = '',
  skeletonClassName = '',
  fallbackText,
  fallbackIcon,
  fallbackClassName = '',
  aspectRatio,
  style,
  ...props
}: AppLazyImageProps) {
  const isInitiallyCached = Boolean(src && globalLoadedImageCache.has(src));
  const [isLoaded, setIsLoaded] = useState(isInitiallyCached);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Sync state when src changes
  useEffect(() => {
    if (src && globalLoadedImageCache.has(src)) {
      setIsLoaded(true);
      setHasError(false);
      return;
    }
    setIsLoaded(false);
    setHasError(false);
  }, [src]);

  // Check if image is already cached/complete on mount
  useEffect(() => {
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      if (src) globalLoadedImageCache.add(src);
      setIsLoaded(true);
    }
  }, [src]);

  const isValidSrc = Boolean(src && typeof src === 'string' && src.trim().length > 0);

  const containerStyle: React.CSSProperties = {
    ...style,
    ...(aspectRatio ? { aspectRatio: String(aspectRatio) } : {}),
  };

  return (
    <div
      className={`relative overflow-hidden select-none ${containerClassName}`}
      style={containerStyle}
    >
      {/* 1. Shimmer / Skeleton Placeholder while loading */}
      {!isLoaded && !hasError && (
        <div
          className={`absolute inset-0 bg-theme-hover/90 dark:bg-white/[0.06] animate-pulse pointer-events-none z-0 ${skeletonClassName}`}
          aria-hidden="true"
        />
      )}

      {/* 2. Fallback State for missing/failed URLs */}
      {(hasError || !isValidSrc) ? (
        <div
          className={`absolute inset-0 w-full h-full flex items-center justify-center bg-blue-600/90 text-white font-bold select-none ${fallbackClassName}`}
          aria-label={alt || 'App icon'}
        >
          {fallbackIcon ? (
            fallbackIcon
          ) : fallbackText ? (
            <span className="text-xl font-bold uppercase">{fallbackText.charAt(0)}</span>
          ) : (
            <span className="text-base font-bold uppercase">{(alt && alt.charAt(0)) || '•'}</span>
          )}
        </div>
      ) : (
        /* 3. Real Image Element */
        <img
          ref={imgRef}
          src={src!}
          alt={alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => {
            if (src) globalLoadedImageCache.add(src);
            setIsLoaded(true);
          }}
          onError={() => setHasError(true)}
          className={`${className} ${isInitiallyCached ? '' : 'transition-opacity duration-150'} select-none pointer-events-none ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          {...props}
        />
      )}
    </div>
  );
}
