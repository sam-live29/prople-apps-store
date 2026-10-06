import React from 'react';

interface StoreCircleLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
  minHeightClass?: string;
  strokeWidth?: number;
  fast?: boolean;
}

export default function StoreCircleLoader({
  size = 'md',
  className = '',
  label,
  minHeightClass = 'min-h-[55vh]',
  strokeWidth,
  fast = false
}: StoreCircleLoaderProps) {
  const sizeMap = {
    sm: { dimension: 32, strokeWidth: 3, r: 18, viewBox: '0 0 50 50', center: 25 },
    md: { dimension: 44, strokeWidth: 3.2, r: 18, viewBox: '0 0 50 50', center: 25 },
    lg: { dimension: 48, strokeWidth: 3.2, r: 18, viewBox: '0 0 50 50', center: 25 },
  };

  const currentSize = sizeMap[size];
  const actualStrokeWidth = strokeWidth ?? currentSize.strokeWidth;

  return (
    <div 
      role="status" 
      aria-label={label || "Loading apps"}
      className={`w-full flex-1 flex flex-col items-center justify-center ${minHeightClass} animate-in fade-in duration-200 ${className}`}
    >
      <div className="relative flex items-center justify-center">
        <svg
          className={fast ? "m3-spinner-fast" : "m3-spinner"}
          width={currentSize.dimension}
          height={currentSize.dimension}
          viewBox={currentSize.viewBox}
        >
          {/* Subtle blue track circle */}
          <circle
            cx={currentSize.center}
            cy={currentSize.center}
            r={currentSize.r}
            fill="none"
            strokeWidth={actualStrokeWidth}
            className="stroke-blue-500/15 dark:stroke-blue-400/20"
          />
          {/* Active Material signature blue rotating arc */}
          <circle
            className={fast ? "m3-spinner-circle-fast stroke-blue-600 dark:stroke-blue-400" : "m3-spinner-circle stroke-blue-600 dark:stroke-blue-400"}
            cx={currentSize.center}
            cy={currentSize.center}
            r={currentSize.r}
            fill="none"
            strokeWidth={actualStrokeWidth}
          />
        </svg>
      </div>
      {label && (
        <span className="mt-3 text-xs text-theme-text-muted font-medium tracking-wide">
          {label}
        </span>
      )}
      <span className="sr-only">Loading apps...</span>
    </div>
  );
}
