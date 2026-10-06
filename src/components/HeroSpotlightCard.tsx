import React, { useRef, useEffect, useMemo } from 'react';
import { Star, Loader2, Download } from 'lucide-react';
import { SpotlightBannerItem } from '../utils/appMetricsAlgorithm';
import { AppDetails } from '../types';
import { useInstall } from '../context/InstallContext';
import { getContentRatingBadge, getContentRatingLabel, getUnifiedAppSize } from '../utils/appMetricsAlgorithm';
import { getAppPrimaryActionLabel, isWindowsApp, isLinuxApp, isMacApp, isIOSApp } from '../services/osDetectionService';
import LinuxIcon from './LinuxIcon';
import WindowsIcon from './WindowsIcon';
import AndroidIcon from './AndroidIcon';
import MacIcon from './MacIcon';
import AppleIcon from './AppleIcon';
import AppLazyImage from './AppLazyImage';
import { useBannerAmbientColors } from '../hooks/useBannerAmbientColors';
import { slugifyAppName } from '../utils/shareUtils';

export interface HeroSpotlightCardProps {
  key?: React.Key;
  item: SpotlightBannerItem;
  fullApp?: AppDetails;
  onAppClick: (appId: string) => void;
  hasBannerDraggedRef?: React.MutableRefObject<boolean>;
}

export default function HeroSpotlightCard({
  item,
  fullApp,
  onAppClick,
  hasBannerDraggedRef,
}: HeroSpotlightCardProps) {
  const details = fullApp || item.app || item;
  const { startInstall } = useInstall();

  const targetDownloadUrl =
    (details as any)?.downloadUrl ||
    (item.app as any)?.downloadUrl ||
    '';

  const targetFileName =
    (details as any)?.assetName ||
    (details as any)?.fileName ||
    (item.app as any)?.assetName ||
    '';

  const targetSha256 = (details as any)?.sha256 || item.app?.sha256;
  const targetPackageFormat = (details as any)?.packageFormat || item.app?.packageFormat;
  const targetPlat = isIOSApp(details) ? 'ios' : isLinuxApp(details) ? 'linux' : isWindowsApp(details) ? 'windows' : isMacApp(details) ? 'mac' : 'android';
  const targetSize = getUnifiedAppSize(details) || item.appSize || '';

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    startInstall(item.appId, {
      downloadUrl: targetDownloadUrl,
      appName: item.appName,
      sizeString: targetSize,
      iconUrl: item.appIcon,
      sha256: targetSha256,
      fileName: targetFileName,
      platform: targetPlat,
      packageFormat: targetPackageFormat,
    });
  };

  const rawRating = Number(item.appRating || (details as any)?.rating || 0);
  const isRated = rawRating > 0;
  const formattedRating = rawRating.toFixed(1);

  // Determine footer subline (e.g. "Contains ads")
  const containsAdsLabel = useMemo(() => {
    const hasAds = Boolean((details as any)?.containsAds || item.app?.containsAds);
    if (hasAds) return 'Contains ads';
    return 'Free download';
  }, [details, item.app]);

  // Determine button caption (only show "In-app purchases" if applicable; never show "Free")
  const purchaseCaption = useMemo(() => {
    const hasIAP = Boolean((details as any)?.inAppPurchases || item.app?.inAppPurchases);
    if (hasIAP) return 'In-app purchases';
    return null;
  }, [details, item.app]);

  // Prioritize heroBannerUrl if uploaded for this spotlight card
  const activeSpotlightImageUrl = 
    (fullApp as any)?.heroBannerUrl || 
    (item.app as any)?.heroBannerUrl || 
    (details as any)?.heroBannerUrl || 
    item.imageUrl;

  // Dynamic Ambient Colored Shadow & Side Border Glow derived from the banner side border colors
  const ambientColors = useBannerAmbientColors(activeSpotlightImageUrl);

  // Derive Spotlight Badge Tag from developer console or item metadata
  const effectiveBadge =
    (fullApp as any)?.spotlightBadge ||
    item.badge ||
    (details as any)?.spotlightBadge ||
    (details as any)?.category ||
    item.category ||
    'Featured';

  const slug = (details as any)?.slug || slugifyAppName(item.appName) || item.appId;
  const appUrl = `/apps/${encodeURIComponent(slug)}`;

  return (
    <a
      href={appUrl}
      onClick={(e) => {
        if (!e.metaKey && !e.ctrlKey && (!hasBannerDraggedRef || !hasBannerDraggedRef.current)) {
          e.preventDefault();
          onAppClick(item.appId);
        }
      }}
      className="group relative w-[calc(100vw-28px)] sm:w-[500px] md:w-[560px] lg:w-[620px] shrink-0 border-0 border-none bg-transparent shadow-none cursor-pointer flex flex-col select-none no-underline text-left"
    >
      {/* Top Banner Graphic & Event Overlay - bright, clear, stunning card with luminous inward side border glow */}
      <div 
        className="relative z-10 aspect-[16/9] w-full rounded-[24px] sm:rounded-[26px] overflow-hidden bg-neutral-900 shrink-0 border-0 border-none ring-0 outline-none"
      >
        {activeSpotlightImageUrl && activeSpotlightImageUrl.trim() ? (
          <AppLazyImage
            src={activeSpotlightImageUrl}
            alt={item.appName}
            className="w-full h-full object-cover select-none pointer-events-none brightness-[1.03] contrast-[1.02]"
            containerClassName="w-full h-full"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-red-950 via-purple-950 to-indigo-950 flex items-center justify-center">
            <span className="text-white/40 text-xs font-medium">Featured Event</span>
          </div>
        )}

        {/* Full-canvas Organic Ambient Color Wash (Strictly curved radial gradients, zero straight borders, zero box edges) */}
        <div 
          className="absolute inset-0 pointer-events-none z-10"
          style={ambientColors.titleBackgroundStyle}
        />

        {/* Top Spotlight Badge Tag (Restored, Completely borderless pill) */}
        {effectiveBadge && (
          <div className="absolute top-3 left-3 sm:top-3.5 sm:left-3.5 z-20 pointer-events-none">
            <span className="inline-flex items-center px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-semibold text-neutral-900 bg-white/95 backdrop-blur-md border-0 border-none shadow-sm tracking-normal">
              {effectiveBadge}
            </span>
          </div>
        )}

        {/* Bottom Title Area (Borderless typography over natural ambient wash) */}
        <div className="absolute inset-x-0 bottom-0 pb-3.5 px-3.5 sm:px-4 z-20 pointer-events-none flex flex-col justify-end">
          <p className="text-white font-extrabold text-[14.5px] sm:text-[16px] leading-[1.3] line-clamp-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] tracking-[-0.01em]">
            {item.headline || `Special event and featured showcase for ${item.appName}`}
          </p>
        </div>
      </div>

      {/* Connected Bottom App Identity & Action Card - clean, crisp, native Google Play surface */}
      <div className="relative z-0 -mt-3.5 sm:-mt-4 pt-5.5 sm:pt-6 pb-3 sm:pb-3.5 px-3.5 sm:px-4 w-full rounded-b-[24px] sm:rounded-b-[26px] rounded-t-none overflow-hidden flex items-center justify-between gap-3 bg-[#e8eaed] dark:bg-[#1e1f23] border-0 border-none shadow-none hover:bg-[#dfe1e5] dark:hover:bg-[#25272c] transition-colors min-w-0">
        {/* Left: App Icon & Details */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          {/* Squircle App Icon */}
          <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-[15px] sm:rounded-[16px] overflow-hidden bg-neutral-800 shrink-0 border-0 border-none shadow-none flex items-center justify-center">
            <AppLazyImage
              src={item.appIcon}
              alt={item.appName}
              fallbackText={item.appName}
              className="w-full h-full object-cover select-none pointer-events-none"
              containerClassName="w-full h-full"
            />
          </div>

          {/* Info Column */}
          <div className="min-w-0 flex-1">
            {/* App Name */}
            <h4 className="text-[14.5px] sm:text-[15.5px] font-medium text-neutral-900 dark:text-white truncate leading-snug">
              {item.appName}
            </h4>

            {/* Developer / Publisher */}
            <p className="text-xs text-neutral-600 dark:text-[#9aa0a6] truncate mt-0.5">
              {item.appDeveloper || 'Verified Developer'}
            </p>

            {/* Rating & Content Rating: 4.1 ★ • [7+] Rated for 7+ */}
            <div className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-[#9aa0a6] mt-1">
              {isRated ? (
                <span className="flex items-center gap-0.5 font-medium text-neutral-900 dark:text-white">
                  {formattedRating}
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400 inline -mt-0.5" />
                </span>
              ) : (
                <span className="text-neutral-500 dark:text-[#9aa0a6] font-medium">Unrated</span>
              )}
              <span className="text-neutral-400 dark:text-neutral-500">•</span>
              <span className="border border-neutral-400 dark:border-neutral-500/60 text-[9px] font-bold px-1 py-[0.5px] rounded-[3px] text-neutral-700 dark:text-neutral-300 leading-none">
                {getContentRatingBadge(item.contentRating)}
              </span>
              <span className="truncate text-neutral-600 dark:text-[#9aa0a6] text-[11px] sm:text-[11.5px]">
                {getContentRatingLabel(item.contentRating)}
              </span>
            </div>

            {/* Subline: Contains ads / Free download */}
            <div className="text-[11px] text-neutral-600 dark:text-[#9aa0a6] mt-0.5">
              {containsAdsLabel}
            </div>
          </div>
        </div>

        {/* Right: Google Play Material 3 Action Button */}
        <div className="flex flex-col items-center shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={handleActionClick}
            className="min-w-[82px] sm:min-w-[88px] h-8 sm:h-8.5 px-4 rounded-full bg-[#0b57d0] hover:bg-[#0842a0] text-white dark:bg-[#a8c7fa] dark:hover:bg-[#8ab4f8] dark:text-[#003366] font-semibold text-xs sm:text-[13px] transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer border-0 select-none"
          >
            {isIOSApp(details) ? (
              <AppleIcon className="w-3.5 h-3.5 shrink-0" />
            ) : isMacApp(details) ? (
              <MacIcon className="w-3.5 h-3.5 shrink-0" />
            ) : isLinuxApp(details) ? (
              <LinuxIcon className="w-3.5 h-3.5 shrink-0" />
            ) : isWindowsApp(details) ? (
              <WindowsIcon className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <AndroidIcon className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>Download</span>
          </button>

          {/* In-app purchases caption only if app has IAP - never show Free */}
          {purchaseCaption && (
            <span className="text-[10px] sm:text-[10.5px] text-neutral-500 dark:text-[#9aa0a6] text-center mt-1 block select-none">
              {purchaseCaption}
            </span>
          )}
        </div>
      </div>
    </a>
  );
}
