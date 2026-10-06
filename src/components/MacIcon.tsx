import React, { useId } from 'react';

export interface MacIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  fill?: string;
}

/**
 * Authentic macOS Finder Icon (Modern Apple Squircle Silhouette)
 * 
 * Configured so that:
 * - The squircle body is filled with white / currentColor (matching the button / text style)
 * - The center profile outline (nose contour line), the two eye dots, and the smile curve
 *   are transparent cutouts, allowing the background (e.g. blue action button) to show through.
 */
export function MacIcon({ className = 'w-4 h-4 shrink-0', fill = 'currentColor', ...props }: MacIconProps) {
  const rawId = useId();
  const id = rawId.replace(/[:]/g, '_');
  const maskId = `mac-finder-cutout-${id}`;

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <defs>
        {/* Mask defining transparent cutouts for outline, dots, and smile curve */}
        <mask id={maskId}>
          {/* Base visible mask area */}
          <rect width="100" height="100" fill="#ffffff" />

          {/* 1. Center profile outline cutout (nose contour line) */}
          <path
            d="M 50 2 C 45 20, 41.5 36, 40.5 49 C 40 52.8, 41.5 54.8, 44 55.5 C 46 56, 48 56, 53.5 56 C 54.5 66, 55.5 82, 58 98"
            fill="none"
            stroke="#000000"
            strokeWidth="5.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* 2. Smile curve cutout */}
          <path
            d="M 23 63.5 C 31.5 77.5, 68.5 77.5, 77 63.5"
            fill="none"
            stroke="#000000"
            strokeWidth="6.5"
            strokeLinecap="round"
          />

          {/* 3. Left Eye dot cutout */}
          <rect x="27.5" y="32" width="6.5" height="15" rx="3.25" fill="#000000" />

          {/* 4. Right Eye dot cutout */}
          <rect x="66" y="32" width="6.5" height="15" rx="3.25" fill="#000000" />
        </mask>
      </defs>

      {/* Solid Apple Squircle body with transparent cutouts */}
      <rect
        x="2"
        y="2"
        width="96"
        height="96"
        rx="24"
        ry="24"
        fill={fill}
        mask={`url(#${maskId})`}
      />
    </svg>
  );
}

export default MacIcon;
