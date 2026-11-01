import React from 'react';

export interface VerifiedBadgeProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  title?: string;
}

const SIZE_MAP = {
  xs: 'w-3.5 h-3.5',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-7 h-7',
};

/**
 * X (Twitter) / Instagram style Verified Publisher blue tick badge
 */
export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({
  size = 'sm',
  className = '',
  title = 'Verified Publisher',
}) => {
  const sizeClass = SIZE_MAP[size] || SIZE_MAP.sm;

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 align-middle select-none ${className}`}
      title={title}
      aria-label={title}
    >
      <svg
        viewBox="0 0 24 24"
        className={`${sizeClass} drop-shadow-[0_1px_2px_rgba(29,155,240,0.3)] transition-transform duration-150`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* X / Instagram Scalloped Blue Rosette */}
        <path
          d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.67-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.34 2.19c-1.39-.46-2.9-.2-3.91.81s-1.27 2.52-.81 3.91C2.63 9.33 1.75 10.57 1.75 12c0 1.43.88 2.67 2.19 3.34-.46 1.39-.2 2.9.81 3.91s2.52 1.27 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z"
          fill="#1D9BF0"
        />
        {/* Crisp Center White Checkmark */}
        <path
          d="M10.54 16.2l-3.54-3.54 1.41-1.41 2.13 2.12 6.01-6.01 1.41 1.41-7.42 7.43z"
          fill="#FFFFFF"
        />
      </svg>
    </span>
  );
};

export default VerifiedBadge;
