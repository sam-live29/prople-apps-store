import React from 'react';

export interface AndroidIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  /** Optional variant: 'head' (canonical Android Bugdroid head) or 'download' */
  variant?: 'head' | 'download';
}

/**
 * Authentic Google Android Bugdroid Icon for Android app download buttons, action buttons, and format indicators.
 * Optically calibrated silhouette with crisp circular eye cutouts and balanced antennae designed to scale cleanly
 * inside action buttons and badges (12px to 24px+).
 */
export function AndroidIcon({
  className = 'w-4 h-4 shrink-0',
  variant = 'head',
  ...props
}: AndroidIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9993.4482.9993.9993.0001.5511-.4482.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.4114 13.8533 8.125 12 8.125s-3.5902.2864-5.1368.8247L4.8409 5.4467a.4161.4161 0 00-.5677-.1521.4157.4157 0 00-.1521.5676l1.9973 3.4592C2.6889 10.9868.3438 14.7431 0 19.162h24c-.3438-4.4189-2.6889-8.1752-6.1185-9.8406"
      />
    </svg>
  );
}

/**
 * Dedicated Android Download Icon variant for explicit package download buttons
 */
export function AndroidDownloadIcon(props: React.SVGProps<SVGSVGElement>) {
  return <AndroidIcon {...props} />;
}

export default AndroidIcon;
