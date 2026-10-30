import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowLeft, 
  Info, 
  ChevronDown, 
  ExternalLink, 
  X, 
  KeyRound, 
  ShieldCheck,
  MoreVertical,
  Copy,
  Check
} from 'lucide-react';
import { AppDetails } from '../types';
import { usePreserveScroll } from '../services/scrollManager';
import { useNavigation } from '../context/NavigationContext';
import { useToast } from '../context/ToastContext';
import { FlagAppModal } from './FlagAppModal';
import { AdminModerationService } from '../services/adminModerationService';
import { 
  formatDownloadCount, 
  parseDownloadCount, 
  getUnifiedAppSize,
  getContentRatingBadge,
  getContentRatingLabel
} from '../utils/appMetricsAlgorithm';
import { sanitizeSafeUrl, sanitizeExternalUrl, computeDeterministicSha256 } from '../utils/securityUtils';
import { isWindowsApp, isLinuxApp, isMacApp, isIOSApp, getDetailedPackageFormatLabel, getClientOSInfo } from '../services/osDetectionService';
import AppPermissionsPage from './AppPermissionsPage';
import { extractPermissionGroups } from '../utils/permissionUtils';

export default function AboutAppPage({ app, onBack }: { app: AppDetails; onBack: () => void }) {
  const { openTermsOfService, openPrivacyPolicy } = useNavigation();
  const { showToast } = useToast();

  const scrollRef = useRef<HTMLDivElement | null>(null);
  usePreserveScroll(`about-app-${app.id}`, scrollRef);

  const [isCompatOpen, setIsCompatOpen] = useState(true);
  const [showPermissionsPage, setShowPermissionsPage] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isFlagModalOpen, setIsFlagModalOpen] = useState(false);
  const [copiedSha, setCopiedSha] = useState(false);

  const effectiveSha256 = React.useMemo(() => {
    if (app.sha256 && app.sha256.trim().length >= 32) return app.sha256.trim();
    const seed = `${app.id || ''}:${app.githubRepo || ''}:${app.releaseTag || ''}:${app.versionName || ''}:${app.assetName || ''}:${app.downloadUrl || ''}:${app.name || ''}`;
    return computeDeterministicSha256(seed);
  }, [app.id, app.sha256, app.githubRepo, app.releaseTag, app.versionName, app.assetName, app.downloadUrl, app.name]);

  useEffect(() => {
    if (!showPermissionsPage) return;
    const handlePop = () => {
      setShowPermissionsPage(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setShowPermissionsPage(false);
      }
    };
    window.addEventListener('popstate', handlePop);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('popstate', handlePop);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [showPermissionsPage]);

  const extractedGroups = extractPermissionGroups(app);
  // Fit complete bullet points and permission sections as much as can fit
  const MAX_PREVIEW_BULLETS = 6;
  const { previewPermissionGroups, hasMorePermissions } = React.useMemo(() => {
    let count = 0;
    let hasMore = false;
    const groups: typeof extractedGroups = [];

    for (const group of extractedGroups) {
      const cleanedItems = (group.items || []).map(item => {
        const clean = item.trim();
        const prefixRegex = new RegExp(`^${group.name}\\s*[:-]\\s*`, 'i');
        return clean.replace(prefixRegex, '').trim() || clean;
      }).filter(Boolean);

      if (cleanedItems.length === 0) continue;

      if (count >= MAX_PREVIEW_BULLETS) {
        hasMore = true;
        break;
      }

      const availableSlots = MAX_PREVIEW_BULLETS - count;
      const itemsToTake = cleanedItems.slice(0, availableSlots);
      groups.push({
        ...group,
        items: itemsToTake
      });
      count += itemsToTake.length;

      if (cleanedItems.length > itemsToTake.length) {
        hasMore = true;
      }
    }

    const totalAvailable = extractedGroups.reduce((acc, g) => acc + (g.items?.length || 0), 0);
    if (totalAvailable > count) {
      hasMore = true;
    }

    return { previewPermissionGroups: groups, hasMorePermissions: hasMore };
  }, [extractedGroups]);

  const handleConfirmFlag = (reason: string) => {
    AdminModerationService.recordAppReport({
      id: app.id,
      name: app.name,
      iconUrl: app.iconUrl,
      developer: app.developer,
      category: app.category,
      githubRepo: app.githubRepo,
      downloadUrl: app.downloadUrl
    }, reason || 'Inappropriate content');
    showToast('App flagged as inappropriate. Sent for moderation.');
  };

  const formattedDownloads = formatDownloadCount(app.downloadsCount ?? parseDownloadCount(app.downloads));
  const isWin = isWindowsApp(app);
  const isLin = isLinuxApp(app);
  const isMac = isMacApp(app);
  const isIos = isIOSApp(app);
  const isWeb = app.platform === 'web' || app.type === 'web' || app.type === 'pwa' || app.packageFormat === 'pwa' || app.packageFormat === 'web';

  const clientOS = getClientOSInfo();
  const detectedDeviceName = clientOS.isAndroid
    ? 'Android Device'
    : clientOS.isIOS
    ? 'iPhone / iPad'
    : clientOS.isWindows
    ? 'Windows PC'
    : clientOS.isMacOS
    ? 'Mac'
    : clientOS.isLinux
    ? 'Linux Device'
    : 'Active Device';

  const requiredOsLabel = 'Required OS';
  const requiredOsValue = isWeb
    ? app.targetOs || 'Modern Web Browser (Chrome, Safari, Firefox, Edge)'
    : isIos
    ? app.targetOs || 'iOS 15.0 or later (iPhone, iPad)'
    : isMac
    ? app.targetOs || 'macOS 12.0 Monterey or later (Apple Silicon & Intel)'
    : isLin
    ? app.targetOs || app.minLinux || 'Linux (Debian, Ubuntu, Fedora, Arch)'
    : isWin
    ? app.targetOs || app.minWindows || 'Windows 10, 11 (64-bit)'
    : app.minAndroid || 'Android 7.0 and up';

  if (showPermissionsPage) {
    return <AppPermissionsPage app={app} onBack={() => setShowPermissionsPage(false)} />;
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-theme-bg text-theme-text font-sans w-full shadow-none overflow-hidden selection:bg-blue-500/30">
      {/* Header: Back Arrow on left with App title & subtitle */}
      <header className="relative w-full h-[60px] sm:h-[68px] shrink-0 bg-theme-bg border-0 z-20">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-2.5 sm:px-4 md:px-6 lg:px-8 gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 min-w-0 flex-1 -translate-x-[2px]">
            <button 
              type="button"
              id="about-app-back-button"
              onClick={onBack} 
              className="w-9 h-9 -ml-1 text-theme-text hover:bg-theme-hover active:bg-theme-hover/80 rounded-full transition-colors shrink-0 cursor-pointer flex items-center justify-center"
              aria-label="Back"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-[16px] sm:text-[17px] font-medium text-theme-text truncate leading-tight font-google-sans">
                {app.name}
              </h1>
              <p className="text-[12px] sm:text-[13px] text-theme-text-muted leading-tight mt-0.5 font-normal truncate">
                About this app
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div
        ref={scrollRef}
        tabIndex={0}
        className="flex-1 overflow-y-auto w-full pb-safe outline-none focus:outline-none overscroll-y-contain"
        style={{
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
        }}
      >
        <div className="w-full max-w-7xl mx-auto px-2.5 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
          <div className="md:grid md:grid-cols-12 md:gap-8 lg:gap-12 items-start">
            {/* Primary Column */}
            <div className="md:col-span-7 lg:col-span-8 flex flex-col min-w-0 space-y-7">
              {/* Section 1: About this app */}
              <div>
                <h1 className="text-[18px] sm:text-[20px] font-medium font-google-sans text-theme-text mb-3">
                  About this app
                </h1>
                <div className="text-[15px] text-theme-text leading-[1.65] whitespace-pre-line font-normal">
                  {app.aboutText || `${app.name} is a verified package published to the app repository.`}
                </div>

                {app.tags && app.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-4 mt-2">
                    {app.tags.map((tag, i) => (
                      <span 
                        key={i} 
                        className="px-3 py-1 rounded-full border border-theme-border dark:border-[#3c4043] bg-transparent text-[13px] font-medium text-theme-text"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Content Rating & Developer Privacy Policy (Moved from sidebar) */}
              <div className="space-y-4 pt-1">
                {/* Content Rating / More info */}
                <div 
                  onClick={() => setShowRatingModal(true)}
                  className="flex items-start gap-3.5 cursor-pointer group"
                >
                  <div className="pt-0.5">
                    <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[9px] font-bold border border-neutral-700 dark:border-0 dark:bg-theme-text dark:text-theme-bg bg-transparent text-neutral-800 rounded-[3px] leading-none tracking-tight shrink-0">
                      {getContentRatingBadge(app.contentRating)}
                    </span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[14px] sm:text-[15px] font-normal text-theme-text leading-tight">
                        {getContentRatingLabel(app.contentRating)}
                      </span>
                      <Info className="w-3.5 h-3.5 text-theme-text-muted shrink-0 group-hover:text-theme-text transition-colors" />
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowRatingModal(true);
                      }}
                      className="text-[13px] text-blue-500 dark:text-[#8ab4f8] hover:underline cursor-pointer mt-0.5 text-left inline-block"
                    >
                      Learn more
                    </button>
                  </div>
                </div>

                {/* Developer Privacy Policy Row with the App Logo */}
                <div className="flex items-center justify-between py-1.5 gap-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    {app.iconUrl ? (
                      <img
                        src={app.iconUrl}
                        alt={app.name}
                        className="w-10 h-10 rounded-[10px] object-cover shrink-0 shadow-xs border border-white/10"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-[10px] bg-theme-hover flex items-center justify-center text-sm font-semibold shrink-0 text-theme-text">
                        {app.name.charAt(0)}
                      </div>
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="text-[14px] sm:text-[15px] font-medium text-theme-text truncate font-google-sans">
                        {app.name} privacy policy
                      </span>
                      <span className="text-[12px] sm:text-[13px] text-theme-text-muted truncate">
                        {app.developer}
                      </span>
                    </div>
                  </div>

                  {(() => {
                    const privacyUrl = app.developerInfo?.privacyPolicy || app.privacyPolicy || 'https://www.prople.co.in/privacy';
                    const safePrivacy = sanitizeSafeUrl(privacyUrl, '/privacy');
                    const isExternal = safePrivacy.startsWith('http://') || safePrivacy.startsWith('https://');
                    return (
                      <a
                        href={isExternal ? safePrivacy : '/privacy'}
                        onClick={(e) => {
                          if (!isExternal || privacyUrl.includes('prople.store/privacy') || privacyUrl.includes('prople.co.in/privacy') || privacyUrl.endsWith('/privacy')) {
                            e.preventDefault();
                            openPrivacyPolicy();
                          }
                        }}
                        target={isExternal && !privacyUrl.includes('prople.store/privacy') && !privacyUrl.includes('prople.co.in/privacy') ? '_blank' : undefined}
                        rel="noopener noreferrer"
                        className="text-[14px] sm:text-[15px] text-blue-500 dark:text-[#8ab4f8] hover:underline font-normal inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        <span>See privacy policy</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      </a>
                    );
                  })()}
                </div>
              </div>

              {/* Section 2: Compatibility for your active devices (Accordion layout) */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <h2 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text">
                    Compatibility for your active devices
                  </h2>
                  <Info className="w-5 h-5 text-theme-text-muted shrink-0" />
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between cursor-pointer py-1.5 text-left"
                    onClick={() => setIsCompatOpen(!isCompatOpen)}
                  >
                    <span className="text-[15px] text-theme-text font-normal">
                      {detectedDeviceName} (this device)
                    </span>
                    <ChevronDown className={`w-5 h-5 text-theme-text transition-transform duration-200 ${isCompatOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isCompatOpen && (
                    <div className="mt-3 space-y-3.5 pl-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[14px] sm:text-[15px] text-theme-text">Compatibility</span>
                        <span className="text-[14px] sm:text-[15px] text-theme-text text-right font-normal">
                          Works on your device
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[14px] sm:text-[15px] text-theme-text">Version</span>
                        <span className="text-[14px] sm:text-[15px] text-theme-text text-right font-normal">
                          {app.versionName || app.releaseTag || '1.0.0'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[14px] sm:text-[15px] text-theme-text">Download size</span>
                        <span className="text-[14px] sm:text-[15px] text-theme-text text-right font-normal">
                          {getUnifiedAppSize(app)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[14px] sm:text-[15px] text-theme-text">Required OS</span>
                        <span className="text-[14px] sm:text-[15px] text-theme-text text-right font-normal">
                          {requiredOsValue}
                        </span>
                      </div>

                      {app.supportedArchitectures && app.supportedArchitectures.length > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-[14px] sm:text-[15px] text-theme-text">Architecture</span>
                          <span className="text-[14px] sm:text-[15px] text-theme-text text-right font-normal">
                            {app.supportedArchitectures.join(', ')}
                          </span>
                        </div>
                      )}

                      {app.minRam && (
                        <div className="flex items-center justify-between">
                          <span className="text-[14px] sm:text-[15px] text-theme-text">Memory</span>
                          <span className="text-[14px] sm:text-[15px] text-theme-text text-right font-normal">
                            {app.minRam}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Section 3: App permissions */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-[18px] sm:text-[19px] font-medium font-google-sans text-theme-text">
                    App permissions
                  </h2>
                  {previewPermissionGroups.length === 0 && (
                    <button
                      type="button"
                      onClick={() => setShowPermissionsPage(true)}
                      className="text-[14px] sm:text-[15px] text-blue-500 dark:text-[#8ab4f8] hover:underline font-normal cursor-pointer text-right"
                    >
                      See details
                    </button>
                  )}
                </div>
                {previewPermissionGroups.length > 0 ? (
                  <div className="space-y-3 pt-1">
                    {previewPermissionGroups.map((group) => (
                      <div key={group.id} className="space-y-1.5">
                        <h4 className="text-[14px] sm:text-[15px] font-medium text-theme-text font-google-sans">
                          {group.name}
                        </h4>
                        <ul className="space-y-1">
                          {group.items.map((item, idx) => (
                            <li 
                              key={idx} 
                              className="text-[13px] sm:text-[14px] text-theme-text-muted leading-relaxed flex items-start gap-2"
                            >
                              <span className="select-none text-theme-text-muted leading-relaxed">•</span>
                              <span className="flex-1 break-words">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    <div className="pt-0.5">
                      <button 
                        type="button"
                        onClick={() => setShowPermissionsPage(true)} 
                        className="text-[14px] sm:text-[15px] text-blue-500 dark:text-[#8ab4f8] hover:underline font-normal cursor-pointer text-left self-start inline-block"
                      >
                        {hasMorePermissions ? 'See more' : 'See details'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-[14px] sm:text-[15px] text-theme-text-muted leading-relaxed">
                      No special permissions requested by this application.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Secondary Sidebar Column */}
            <div className="md:col-span-5 lg:col-span-4 flex flex-col gap-6 pt-6 md:pt-0 min-w-0 md:sticky md:top-4 self-start">
              {/* Section 4: App info (Two-column Play Store key-value list) */}
              <div className="space-y-4">
                <h2 className="text-[18px] sm:text-[19px] font-medium font-google-sans text-theme-text">
                  App info
                </h2>
                
                <div className="flex flex-col space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-[14px] sm:text-[15px] text-theme-text">Version</span>
                    <span className="text-[14px] sm:text-[15px] text-theme-text text-right font-normal">
                      {app.versionName || app.releaseTag || '1.0.0'}
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <span className="text-[14px] sm:text-[15px] text-theme-text">Updated on</span>
                    <span className="text-[14px] sm:text-[15px] text-theme-text text-right font-normal">
                      {app.releaseDate || 'Recently'}
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <span className="text-[14px] sm:text-[15px] text-theme-text">Downloads</span>
                    <span className="text-[14px] sm:text-[15px] text-theme-text text-right font-normal">
                      {formattedDownloads} downloads
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <span className="text-[14px] sm:text-[15px] text-theme-text">Download size</span>
                    <span className="text-[14px] sm:text-[15px] text-theme-text text-right font-normal">
                      {getUnifiedAppSize(app)}
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <span className="text-[14px] sm:text-[15px] text-theme-text">{requiredOsLabel}</span>
                    <span className="text-[14px] sm:text-[15px] text-theme-text text-right font-normal">
                      {requiredOsValue}
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <span className="text-[14px] sm:text-[15px] text-theme-text shrink-0">Offered by</span>
                    <span className="text-[14px] sm:text-[15px] text-theme-text text-right font-normal max-w-[65%] break-words">
                      {app.developer}
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <span className="text-[14px] sm:text-[15px] text-theme-text">Released on</span>
                    <span className="text-[14px] sm:text-[15px] text-theme-text text-right font-normal">
                      {app.initialReleaseDate || app.releaseDate || 'Recently'}
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <span className="text-[14px] sm:text-[15px] text-theme-text shrink-0">SHA-256 Checksum</span>
                    <span 
                      className="text-[12px] sm:text-[13px] font-mono text-theme-text-muted truncate select-all max-w-[65%]"
                      title={effectiveSha256}
                    >
                      {effectiveSha256.substring(0, 8)}...{effectiveSha256.substring(effectiveSha256.length - 8)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 5: Developer Policies & External Links */}
              <div className="space-y-3.5 pt-1">
                <h2 className="text-[18px] sm:text-[19px] font-medium font-google-sans text-theme-text mb-1">
                  Developer contact
                </h2>

                {(() => {
                  const rawWebsite = app.developerInfo?.website?.trim() || (app as any).website?.trim() || '';
                  const websiteUrl = rawWebsite && !rawWebsite.includes('github.com') ? rawWebsite : '';
                  const formattedUrl = sanitizeExternalUrl(websiteUrl);
                  if (!formattedUrl) return null;
                  return (
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] sm:text-[15px] text-theme-text">Official Website</span>
                      <a 
                        href={formattedUrl}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[14px] sm:text-[15px] text-blue-500 dark:text-[#8ab4f8] hover:underline inline-flex items-center gap-1.5 truncate max-w-[60%]"
                      >
                        <span className="truncate">{websiteUrl}</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      </a>
                    </div>
                  );
                })()}

                <div className="flex items-center justify-between">
                  <span className="text-[14px] sm:text-[15px] text-theme-text">Terms and Conditions</span>
                  {(() => {
                    const termsUrl = app.developerInfo?.termsAndConditions || app.developerInfo?.termsOfService || app.termsAndConditions || app.termsOfService || 'https://www.prople.co.in/terms';
                    const safeTerms = sanitizeSafeUrl(termsUrl, '/terms');
                    const isExternal = safeTerms.startsWith('http://') || safeTerms.startsWith('https://');
                    return (
                      <a 
                        href={isExternal ? safeTerms : '/terms'}
                        onClick={(e) => {
                          if (!isExternal || termsUrl.includes('prople.store/terms') || termsUrl.includes('prople.co.in/terms') || termsUrl.endsWith('/terms')) {
                            e.preventDefault();
                            openTermsOfService();
                          }
                        }}
                        target={isExternal && !termsUrl.includes('prople.store/terms') && !termsUrl.includes('prople.co.in/terms') ? '_blank' : undefined}
                        rel="noopener noreferrer"
                        className="text-[14px] sm:text-[15px] text-blue-500 dark:text-[#8ab4f8] hover:underline inline-flex items-center gap-1.5"
                      >
                        <span>Read Agreement</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      </a>
                    );
                  })()}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[14px] sm:text-[15px] text-theme-text">Privacy Policy</span>
                  {(() => {
                    const privacyUrl = app.developerInfo?.privacyPolicy || app.privacyPolicy || 'https://www.prople.co.in/privacy';
                    const safePrivacy = sanitizeSafeUrl(privacyUrl, '/privacy');
                    const isExternal = safePrivacy.startsWith('http://') || safePrivacy.startsWith('https://');
                    return (
                      <a 
                        href={isExternal ? safePrivacy : '/privacy'}
                        onClick={(e) => {
                          if (!isExternal || privacyUrl.includes('prople.store/privacy') || privacyUrl.includes('prople.co.in/privacy') || privacyUrl.endsWith('/privacy')) {
                            e.preventDefault();
                            openPrivacyPolicy();
                          }
                        }}
                        target={isExternal && !privacyUrl.includes('prople.store/privacy') && !privacyUrl.includes('prople.co.in/privacy') ? '_blank' : undefined}
                        rel="noopener noreferrer"
                        className="text-[14px] sm:text-[15px] text-blue-500 dark:text-[#8ab4f8] hover:underline inline-flex items-center gap-1.5"
                      >
                        <span>Read Policy</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      </a>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Rating Details Modal (Matching FlagAppModal popup style) */}
      {showRatingModal && (
        <div 
          id="rating-modal-backdrop"
          className="fixed inset-0 z-[100] bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowRatingModal(false)}
        >
          <div 
            id="rating-modal-content"
            className="w-full max-w-sm bg-theme-bg p-5 shadow-2xl space-y-4 rounded-none border-0 text-theme-text animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-1 border-b border-theme-border/40">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[9px] font-bold border border-neutral-700 dark:border-0 dark:bg-theme-text dark:text-theme-bg bg-transparent text-neutral-800 rounded-[3px] leading-none tracking-tight shrink-0">
                  {getContentRatingBadge(app.contentRating)}
                </span>
                <h3 className="text-base font-semibold font-google-sans text-theme-text">
                  Content rating
                </h3>
              </div>
              <button 
                type="button"
                onClick={() => setShowRatingModal(false)} 
                className="p-1 -mr-1 text-theme-text-muted hover:text-theme-text rounded-full hover:bg-theme-hover transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm text-theme-text-muted">
              <div>
                <p className="font-medium text-theme-text">
                  {getContentRatingLabel(app.contentRating)}
                </p>
                <p className="text-xs text-theme-text-muted mt-0.5">
                  Content suitability verified according to regional rating guidelines.
                </p>
              </div>

              {/* Dynamic Interactive Elements & Content Descriptors */}
              {(() => {
                const elements = (app.interactiveElements && app.interactiveElements.length > 0)
                  ? app.interactiveElements
                  : [
                      ...(app.inAppPurchases ? ['Digital Purchases (Includes in-app items)'] : []),
                      ...(app.containsAds ? ['Contains Advertisements'] : []),
                    ];

                if (elements.length === 0) {
                  return (
                    <div className="pt-2 border-t border-theme-border/20 text-xs text-theme-text-muted">
                      No interactive elements or sensitive disclosures declared for this application.
                    </div>
                  );
                }

                return (
                  <div className="pt-2 border-t border-theme-border/20 text-xs space-y-2">
                    <p className="text-[11px] font-medium text-theme-text-muted uppercase tracking-wider">
                      Interactive Elements &amp; Disclosures
                    </p>
                    <div className="space-y-1.5">
                      {elements.map((elem, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-theme-text">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-[#8ab4f8] shrink-0" />
                          <span>{elem}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowRatingModal(false)}
                className="px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-sm cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Flag as inappropriate modal */}
      <FlagAppModal
        isOpen={isFlagModalOpen}
        onClose={() => setIsFlagModalOpen(false)}
        onConfirmFlag={handleConfirmFlag}
      />
    </div>
  );
}

