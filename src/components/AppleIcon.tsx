import React from 'react';

export interface AppleIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  fill?: string;
}

/**
 * Authentic Apple Logo Vector Icon for iOS and macOS packages (.ipa, .dmg).
 * Calibrated on a 24x24 grid with optical centering and crisp rendering across
 * buttons, action bars, badges, and headers.
 */
export function AppleIcon({ className = 'w-4 h-4 shrink-0', fill = 'currentColor', ...props }: AppleIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={fill}
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 7.03c.66-.82 1.11-1.96.99-3.11-1 .04-2.18.66-2.88 1.48-.61.71-1.15 1.87-1.01 2.99 1.11.08 2.24-.55 2.9-1.36z" />
    </svg>
  );
}

export default AppleIcon;
