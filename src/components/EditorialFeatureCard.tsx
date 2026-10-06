import React, { useRef, useState, useEffect, useLayoutEffect, useMemo } from 'react';
import { Star, Loader2, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import AppLazyImage from './AppLazyImage';
import LinuxIcon from './LinuxIcon';
import WindowsIcon from './WindowsIcon';
import AndroidIcon from './AndroidIcon';
import MacIcon from './MacIcon';
import AppleIcon from './AppleIcon';
import { AppListing, AppDetails } from '../types';
import { useInstall } from '../context/InstallContext';
import { getUnifiedAppSize, getContentRatingBadge, getContentRatingLabel, getAppPublisherName } from '../utils/appMetricsAlgorithm';
import { getAppPrimaryActionLabel, getAppFormatBadgeLabel, isWindowsApp, isLinuxApp, isMacApp, isIOSApp } from '../services/osDetectionService';
import { saveSectionScroll, getSectionScroll } from '../services/sectionScrollMemoryService';
import { useBannerAmbientColors } from '../hooks/useBannerAmbientColors';
import { slugifyAppName } from '../utils/shareUtils';

interface EditorialCardItemProps {
  key?: string;
  app: AppListing;
  fullApp?: AppDetails;
  appsMap?: Record<string, AppDetails>;
  onAppClick: (appId: string) => void;
  isCarousel?: boolean;
  hasDraggedRef?: React.MutableRefObject<boolean>;
}

function EditorialCardItem({
  app,
  fullApp,
  appsMap,
  onAppClick,
  isCarousel = false,
  hasDraggedRef,
}: EditorialCardItemProps) {
  const details = fullApp || (appsMap && appsMap[app.id]) || app;
  const rating = app.rating ?? details.rating;
  const description =
    (details as any).shortDescription ||
    (details as any).tagline ||
    (details as any).aboutText ||
    (app as any).tagline ||
    'Experience outstanding performance and design.';

  const headlineText = (app as any).headline || (details as any).tagline || description;

  const targetDownloadUrl =
    (details as any)?.downloadUrl ||
    app.downloadUrl ||
    '';

  const targetFileName =
    (details as any)?.assetName ||
    (details as any)?.fileName ||
    app.assetName ||
    (app as any)?.fileName ||
    '';

  const targetSha256 = (details as any)?.sha256 || app.sha256;
  const targetPackageFormat = (details as any)?.packageFormat || (app as any)?.packageFormat;
  const targetPlat = isIOSApp(details) ? 'ios' : isLinuxApp(details) ? 'linux' : isWindowsApp(details) ? 'windows' : isMacApp(details) ? 'mac' : 'android';
  const targetSize = getUnifiedAppSize(details) || getUnifiedAppSize(app);

  const { startInstall } = useInstall();

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    startInstall(app.id, {
      downloadUrl: targetDownloadUrl,
      appName: app.name || details.name,
      sizeString: targetSize,
      iconUrl: app.iconUrl || details.iconUrl,
      sha256: targetSha256,
      fileName: targetFileName,
      platform: targetPlat,
      packageFormat: targetPackageFormat,
    });
  };

  // Only genuine feature graphic banner or video thumbnail. No fallback placeholders.
  const bannerGraphic =
    (app.heroBannerUrl && app.heroBannerUrl.trim()) ||
    ((details as any).heroBannerUrl && (details as any).heroBannerUrl.trim()) ||
    (app.featureGraphicUrl && app.featureGraphicUrl.trim()) ||
    ((details as any).featureGraphicUrl && (details as any).featureGraphicUrl.trim()) ||
    (app.videoThumbnailUrl && app.videoThumbnailUrl.trim()) ||
    ((details as any).videoThumbnailUrl && (details as any).videoThumbnailUrl.trim());

  // If no banner graphic exists, strict policy: do not showcase
  if (!bannerGraphic) {
    return null;
  }

  const purchaseCaption = useMemo(() => {
    const hasIAP = Boolean((details as any)?.inAppPurchases || app.inAppPurchases);
    if (hasIAP) return 'In-app purchases';
    return null;
  }, [details, app]);

  const containsAdsLabel = useMemo(() => {
    const hasAds = Boolean((details as any)?.containsAds || app.containsAds);
    if (hasAds) return 'Contains ads';
    return 'Free download';
  }, [details, app]);

  // Dynamic Ambient Colored Shadow & Side Border Glow derived from the banner side border colors
  const ambientColors = useBannerAmbientColors(bannerGraphic);

  // Derive Spotlight Badge Tag from developer console or item metadata
  const badgeText =
    (fullApp as any)?.spotlightBadge ||
    (app as any).spotlightBadge ||
    (details as any)?.spotlightBadge ||
    (app as any).badge ||
    (details as any)?.badge ||
    details.category ||
    app.category ||
    'Featured';

  const slug = (details as any)?.slug || slugifyAppName(app.name) || app.id;
  const appUrl = `/apps/${encodeURIComponent(slug)}`;

  return (
    <a
      href={appUrl}
      onClick={(e) => {
        if (!e.metaKey && !e.ctrlKey && !(hasDraggedRef && hasDraggedRef.current)) {
          e.preventDefault();
          onAppClick(app.id);
        }
      }}
      className={`relative ${
        isCarousel
          ? 'w-[calc(100vw-28px)] sm:w-[500px] md:w-[560px] lg:w-[620px] shrink-0'
          : 'w-full'
      } border-0 border-none bg-transparent shadow-none cursor-pointer flex flex-col select-none group no-underline text-left`}
    >
      {/* Top Banner Graphic & Floating Badge - bright, clear, stunning card with luminous inward side border glow */}
      <div 
        className="relative z-10 aspect-[16/9] w-full rounded-[24px] sm:rounded-[26px] overflow-hidden bg-neutral-900 shrink-0 border-0 border-none ring-0 outline-none"
      >
        <AppLazyImage
          src={bannerGraphic}
          alt={app.name}
          className="w-full h-full object-cover select-none pointer-events-none brightness-[1.03] contrast-[1.02]"
          containerClassName="w-full h-full"
        />

        {/* Full-canvas Organic Ambient Color Wash (Strictly curved radial gradients, zero straight borders, zero box edges) */}
        <div 
          className="absolute inset-0 pointer-events-none z-10"
          style={ambientColors.titleBackgroundStyle}
        />

        {/* Top Spotlight Badge Tag (Restored, Completely borderless pill) */}
        {badgeText && (
          <div className="absolute top-3 left-3 sm:top-3.5 sm:left-3.5 z-20 pointer-events-none">
            <span className="inline-flex items-center px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-semibold text-neutral-900 bg-white/95 backdrop-blur-md border-0 border-none shadow-sm tracking-normal">
              {badgeText}
            </span>
          </div>
        )}

        {/* Bottom Title Area (Borderless typography over natural ambient wash) */}
        <div className="absolute inset-x-0 bottom-0 pb-3.5 px-3.5 sm:px-4 z-20 pointer-events-none flex flex-col justify-end">
          <p className="text-white font-extrabold text-[14.5px] sm:text-[16px] leading-[1.3] line-clamp-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] tracking-[-0.01em]">
            {headlineText || description}
          </p>
        </div>
      </div>

      {/* Connected Bottom App Identity & Action Card - clean, crisp, native Google Play surface */}
      <div className="relative z-0 -mt-3.5 sm:-mt-4 pt-5.5 sm:pt-6 pb-3 sm:pb-3.5 px-3.5 sm:px-4 w-full rounded-b-[24px] sm:rounded-b-[26px] rounded-t-none overflow-hidden flex items-center justify-between gap-3 bg-[#e8eaed] dark:bg-[#1e1f23] border-0 border-none shadow-none hover:bg-[#dfe1e5] dark:hover:bg-[#25272c] transition-colors min-w-0">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          {/* App Squircle Icon */}
          <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-[15px] sm:rounded-[16px] overflow-hidden bg-neutral-800 shrink-0 border-0 border-none shadow-none flex items-center justify-center">
            <AppLazyImage
              src={app.iconUrl}
              alt={app.name}
              fallbackText={app.name}
              className="w-full h-full object-cover select-none pointer-events-none"
              containerClassName="w-full h-full"
            />
          </div>

          {/* App Details Column */}
          <div className="min-w-0 flex-1">
            <h4 className="text-[14.5px] sm:text-[15.5px] font-medium text-neutral-900 dark:text-white truncate leading-snug">
              {app.name}
            </h4>
            <p className="text-xs text-neutral-600 dark:text-[#9aa0a6] truncate mt-0.5">
              {getAppPublisherName(fullApp || app || details)}
            </p>

            {/* Rating & Content Rating: 4.1 ★ • [7+] Rated for 7+ */}
            <div className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-[#9aa0a6] mt-1">
              <span className="flex items-center gap-0.5 font-medium text-neutral-900 dark:text-white">
                {rating && rating > 0 ? rating.toFixed(1) : '4.5'}
                <Star className="w-3 h-3 fill-amber-400 text-amber-400 inline -mt-0.5" />
              </span>
              <span className="text-neutral-400 dark:text-neutral-500">•</span>
              <span className="border border-neutral-400 dark:border-neutral-500/60 text-[9px] font-bold px-1 py-[0.5px] rounded-[3px] text-neutral-700 dark:text-neutral-300 leading-none">
                {getContentRatingBadge((details as any)?.contentRating || app.contentRating)}
              </span>
              <span className="truncate text-neutral-600 dark:text-[#9aa0a6] text-[11px] sm:text-[11.5px]">
                {getContentRatingLabel((details as any)?.contentRating || app.contentRating)}
              </span>
            </div>

            {/* Subline: Contains ads / Free download */}
            <div className="text-[11px] text-neutral-600 dark:text-[#9aa0a6] mt-0.5">
              {containsAdsLabel}
            </div>
          </div>
        </div>

        {/* Action Button: Google Play Material 3 Pill */}
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

export interface EditorialFeatureCardProps {
  app?: AppListing;
  apps?: AppListing[];
  fullApp?: AppDetails;
  appsMap?: Record<string, AppDetails>;
  onAppClick: (appId: string) => void;
  title?: string;
  tag?: string;
  sectionId?: string;
}

export default function EditorialFeatureCard({
  app,
  apps,
  fullApp,
  appsMap = {},
  onAppClick,
  title = "Editor's Choice Spotlight",
  tag = 'Featured • Hand-Picked',
  sectionId,
}: EditorialFeatureCardProps) {
  const activeSectionId = sectionId || title || 'editorial_feature_spotlight';
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasDraggedRef = useRef(false);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Normalize apps list: strictly filter to apps that have authentic banner images and icons
  // No fake placeholder or default fallback images are allowed in this visual section.
  const eligibleApps = useMemo(() => {
    const rawList = apps && apps.length > 0 ? apps : app ? [app] : [];
    return rawList.filter((item) => {
      const details = appsMap[item.id] || item;
      const banner =
        (item.featureGraphicUrl && item.featureGraphicUrl.trim()) ||
        ((details as any).featureGraphicUrl && (details as any).featureGraphicUrl.trim()) ||
        (item.videoThumbnailUrl && item.videoThumbnailUrl.trim()) ||
        ((details as any).videoThumbnailUrl && (details as any).videoThumbnailUrl.trim());
      const icon =
        (item.iconUrl && item.iconUrl.trim()) ||
        ((details as any).iconUrl && (details as any).iconUrl.trim());

      return Boolean(banner && icon);
    });
  }, [apps, app, appsMap]);

  const updateScrollButtons = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
  };

  // Restore and maintain the exact slide position across app installs, catalogue updates, and navigation without jumps
  useLayoutEffect(() => {
    if (!scrollRef.current) return;
    const saved = getSectionScroll(activeSectionId);
    if (saved > 0 && scrollRef.current.scrollLeft === 0) {
      scrollRef.current.scrollLeft = saved;
    }
    updateScrollButtons();
  }, [activeSectionId]);

  const handleScroll = () => {
    updateScrollButtons();
    if (scrollRef.current) {
      saveSectionScroll(activeSectionId, scrollRef.current.scrollLeft);
    }
  };

  const handleScrollStep = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const step = Math.min(scrollRef.current.clientWidth * 0.85, 480);
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -step : step,
      behavior: 'smooth',
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || !scrollRef.current) return;
    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    startXRef.current = e.pageX;
    scrollLeftRef.current = scrollRef.current.scrollLeft;
  };

  const handleMouseLeave = () => {
    isDraggingRef.current = false;
    if (scrollRef.current) {
      saveSectionScroll(activeSectionId, scrollRef.current.scrollLeft);
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    if (scrollRef.current) {
      saveSectionScroll(activeSectionId, scrollRef.current.scrollLeft);
    }
    setTimeout(() => {
      hasDraggedRef.current = false;
    }, 80);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !scrollRef.current) return;
    const deltaX = e.pageX - startXRef.current;
    if (Math.abs(deltaX) > 4) {
      hasDraggedRef.current = true;
      const maxScroll = scrollRef.current.scrollWidth - scrollRef.current.clientWidth;
      const nextScroll = Math.max(0, Math.min(scrollLeftRef.current - deltaX, maxScroll));
      scrollRef.current.scrollLeft = nextScroll;
      saveSectionScroll(activeSectionId, nextScroll);
    }
  };

  // If no apps satisfy the required media banner, do not showcase this section
  if (eligibleApps.length === 0) return null;

  const isMultiple = eligibleApps.length > 1;

  return (
    <section className="w-full py-2">
      {/* Section Header */}
      <div className="flex justify-between items-start mb-3 px-2.5 sm:px-4 md:px-6">
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-2">
            <h2 className="text-[19px] sm:text-[20px] font-semibold text-[#0f172a] dark:text-[#f3f4f6] tracking-tight">
              {title}
            </h2>
            {isMultiple && (
              <span className="text-[11px] font-medium text-[#475569] dark:text-theme-text-muted/80 bg-theme-hover/60 px-2 py-0.5 rounded-full hidden sm:inline-block">
                {eligibleApps.length} apps
              </span>
            )}
          </div>
          {tag && (
            <p className="text-xs text-[#475569] dark:text-[#9aa0a6] mt-0.5">
              {tag}
            </p>
          )}
        </div>

        {isMultiple && (
          <div className="hidden sm:flex items-center gap-1 mt-0.5">
            <button
              type="button"
              onClick={() => handleScrollStep('left')}
              disabled={!canScrollLeft}
              className="w-7 h-7 rounded-full flex items-center justify-center text-theme-text-muted hover:text-theme-text hover:bg-theme-hover disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
              aria-label="Previous app"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleScrollStep('right')}
              disabled={!canScrollRight}
              className="w-7 h-7 rounded-full flex items-center justify-center text-theme-text-muted hover:text-theme-text hover:bg-theme-hover disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
              aria-label="Next app"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Editorial Spotlight Presentation */}
      {isMultiple ? (
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          className="flex gap-3.5 sm:gap-4 overflow-x-auto scrollbar-hide pb-2 px-2.5 sm:px-4 md:px-6 items-start cursor-grab active:cursor-grabbing select-none w-full overscroll-x-contain"
          style={{
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-x pan-y',
            overscrollBehaviorX: 'contain',
            overscrollBehaviorY: 'auto',
          }}
        >
          {eligibleApps.map((appItem) => (
            <EditorialCardItem
              key={appItem.id}
              app={appItem}
              fullApp={appsMap[appItem.id] || (appItem.id === app?.id ? fullApp : undefined)}
              appsMap={appsMap}
              onAppClick={onAppClick}
              isCarousel={true}
              hasDraggedRef={hasDraggedRef}
            />
          ))}
        </div>
      ) : (
        <div className="px-2.5 sm:px-4 md:px-6">
          <EditorialCardItem
            app={eligibleApps[0]}
            fullApp={appsMap[eligibleApps[0].id] || fullApp}
            appsMap={appsMap}
            onAppClick={onAppClick}
            isCarousel={false}
          />
        </div>
      )}
    </section>
  );
}
