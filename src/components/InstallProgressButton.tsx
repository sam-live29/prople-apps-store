import React from 'react';
import { Download } from 'lucide-react';
import { AppListing, AppDetails } from '../types';
import { getAppActionFileLabel } from '../services/osDetectionService';
import { getDirectDownloadUrl } from '../context/InstallContext';

export type LoadingStyleVariant = 
  | 'tonal-brand'
  | 'solid-brand'
  | 'deep-contrast'
  | 'outline-minimal'
  | 'glass-glow';

interface InstallProgressButtonProps {
  app: AppListing | AppDetails;
  resolvedPlatform?: string;
  onDownload?: () => void;
  className?: string;
  [key: string]: any;
}

/**
 * Direct Download Button:
 * Places the genuine release binary link directly behind the download button,
 * triggering immediate native browser downloads straight from CDN with background telemetry.
 */
export const InstallProgressButton: React.FC<InstallProgressButtonProps> = ({
  app,
  resolvedPlatform,
  onDownload,
  className = ''
}) => {
  const label = getAppActionFileLabel(app as any, resolvedPlatform);
  const directReleaseUrl = getDirectDownloadUrl(app.downloadUrl, app.assetName, resolvedPlatform) || app.downloadUrl || '';

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDownload) {
      onDownload();
    } else if (directReleaseUrl && directReleaseUrl !== '#') {
      const a = document.createElement('a');
      a.href = directReleaseUrl;
      if (app.assetName) a.download = app.assetName;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (document.body.contains(a)) document.body.removeChild(a);
      }, 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`h-11 px-6 bg-[#0b57d0] hover:bg-[#0842a0] text-white dark:bg-[#a8c7fa] dark:hover:bg-[#d3e3fd] dark:text-[#041e49] font-medium font-google-sans rounded-full text-sm sm:text-base transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer select-none border-0 ${className}`}
    >
      <Download className="w-4 h-4 shrink-0" />
      <span>{label}</span>
    </button>
  );
};
