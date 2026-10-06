import React from 'react';
import defaultLogo from '../assets/images/logo.png';

// Eagerly pre-warm the browser image cache in memory at script evaluation time
if (typeof window !== 'undefined') {
  try {
    const preload = new Image();
    preload.src = '/logo.png';
  } catch {}
}

interface BrandLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  hideTextOnMobile?: boolean;
  onClick?: () => void;
  customSrc?: string;
}

export default function BrandLogo({ 
  className = '', 
  size = 'md', 
  showText = true,
  hideTextOnMobile = false,
  onClick,
  customSrc 
}: BrandLogoProps) {
  const imgSrc = customSrc || '/logo.png';

  const sizeConfig = {
    sm: {
      pixels: 28,
      iconClass: 'w-7 h-7 min-w-[28px] min-h-[28px]',
      text: 'text-[16px]',
      badge: 'text-[10px] px-1.5 py-0.5',
      gap: 'gap-2',
      wordGap: 'gap-1.5'
    },
    md: {
      pixels: 36,
      iconClass: 'w-[36px] h-[36px] min-w-[36px] min-h-[36px]',
      text: 'text-[19px] sm:text-[20px]',
      badge: 'text-[11px] px-2 py-0.5',
      gap: 'gap-2',
      wordGap: 'gap-1'
    },
    lg: {
      pixels: 46,
      iconClass: 'w-[46px] h-[46px] min-w-[46px] min-h-[46px]',
      text: 'text-2xl',
      badge: 'text-xs px-2.5 py-1',
      gap: 'gap-3 sm:gap-3.5',
      wordGap: 'gap-2'
    },
    xl: {
      pixels: 67,
      iconClass: 'w-[67px] h-[67px] min-w-[67px] min-h-[67px]',
      text: 'text-3xl',
      badge: 'text-sm px-3 py-1',
      gap: 'gap-3.5 sm:gap-4',
      wordGap: 'gap-2'
    }
  };

  const current = sizeConfig[size] || sizeConfig.md;

  return (
    <div 
      onClick={onClick}
      className={`inline-flex items-center select-none shrink-0 ${showText ? current.gap : ''} ${
        onClick ? 'cursor-pointer hover:opacity-90 active:opacity-75' : ''
      } ${className}`}
      title="Prople Store"
    >
      {/* App Logo Image (Replaceable via /public/logo.png or in-app image upload) */}
      <img 
        src={imgSrc}
        alt="Prople Store Logo"
        width={current.pixels}
        height={current.pixels}
        loading="eager"
        decoding="sync"
        fetchPriority="high"
        style={{ width: current.pixels, height: current.pixels, aspectRatio: '1 / 1' }}
        className={`${current.iconClass} shrink-0 block object-contain`}
        onError={(e) => {
          const target = e.currentTarget;
          if (target.src !== defaultLogo) {
            target.src = defaultLogo;
          }
        }}
      />

      {/* Brand Typography: Prople Store */}
      {showText && (
        <div 
          className={`items-center tracking-tight leading-none whitespace-nowrap shrink-0 ${current.wordGap} ${
            hideTextOnMobile ? 'hidden md:flex' : 'flex'
          }`}
        >
          <span className={`font-bold text-theme-text ${current.text} tracking-tight font-sans`}>
            Prople
          </span>
          <span className={`font-normal text-theme-text ${current.text} tracking-tight font-sans`}>
            Store
          </span>
        </div>
      )}
    </div>
  );
}
