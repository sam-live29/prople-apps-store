import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowLeft, 
  ExternalLink,
  ChevronDown,
  Info,
  X,
  MoreVertical
} from 'lucide-react';
import { AppDetails } from '../types';
import { sanitizeSafeUrl, sanitizeExternalUrl } from '../utils/securityUtils';
import { usePreserveScroll } from '../services/scrollManager';
import { useNavigation } from '../context/NavigationContext';
import { useToast } from '../context/ToastContext';
import { FlagAppModal } from './FlagAppModal';
import { AdminModerationService } from '../services/adminModerationService';
import AppPermissionsPage from './AppPermissionsPage';
import { extractPermissionGroups } from '../utils/permissionUtils';


export default function DataSafetyPage({ app, onBack }: { app?: AppDetails; onBack: () => void }) {
  const { openTermsOfService, openPrivacyPolicy } = useNavigation();
  const { showToast } = useToast();

  const scrollRef = useRef<HTMLDivElement | null>(null);
  usePreserveScroll(`data-safety-${app?.id || 'default'}`, scrollRef);

  const [showPermissionsPage, setShowPermissionsPage] = useState(false);
  const [isDataSharedOpen, setIsDataSharedOpen] = useState(false);
  const [isDataCollectedOpen, setIsDataCollectedOpen] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isFlagModalOpen, setIsFlagModalOpen] = useState(false);

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
    if (!app) return;
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

  const safety = app?.dataSafety;
  
  const overviewText = safety?.overview || 
    'Safety starts with understanding how developers collect and share your data. Data privacy and security practices may vary based on your use, region, and age. The developer provided this information and may update it over time.';
  
  const dataSharedText = safety?.dataShared || 'The developer says this app doesn’t share user data with other companies or organisations.';
  const dataCollectedList = safety?.dataCollected || [];
  const deletionPolicy = safety?.deletionPolicy;

  // App privacy policy URL resolution
  const rawPrivacyUrl = app?.developerInfo?.privacyPolicy || app?.privacyPolicy || 'https://www.prople.co.in/privacy';
  const safePrivacyUrl = sanitizeSafeUrl(rawPrivacyUrl, '/privacy');
  const isExternalPrivacy = safePrivacyUrl.startsWith('http://') || safePrivacyUrl.startsWith('https://');

  const termsUrl = app?.developerInfo?.termsAndConditions || app?.developerInfo?.termsOfService || app?.termsAndConditions || app?.termsOfService || 'https://www.prople.co.in/terms';
  const safeTermsUrl = sanitizeSafeUrl(termsUrl, '/terms');
  const isExternalTerms = safeTermsUrl.startsWith('http://') || safeTermsUrl.startsWith('https://');

  const rawWebsite = app?.developerInfo?.website?.trim() || (app as any)?.website?.trim() || '';
  const websiteUrl = rawWebsite && !rawWebsite.includes('github.com') ? rawWebsite : '';
  const formattedWebsiteUrl = sanitizeExternalUrl(websiteUrl);

  if (showPermissionsPage && app) {
    return <AppPermissionsPage app={app} onBack={() => setShowPermissionsPage(false)} />;
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-theme-bg text-theme-text font-sans w-full shadow-none overflow-hidden selection:bg-blue-500/30">
      {/* Header: Back Arrow on left with App title & subtitle, 3-dots Menu on right */}
      <header className="relative w-full h-[60px] sm:h-[68px] shrink-0 bg-theme-bg border-0 z-20">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-2.5 sm:px-4 md:px-6 lg:px-8 gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 min-w-0 flex-1 -translate-x-[2px]">
            <button 
              type="button"
              id="data-safety-back-button"
              onClick={onBack} 
              className="w-9 h-9 -ml-1 text-theme-text hover:bg-theme-hover active:bg-theme-hover/80 rounded-full transition-colors shrink-0 cursor-pointer flex items-center justify-center"
              aria-label="Back"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-[16px] sm:text-[17px] font-medium text-theme-text truncate leading-tight font-google-sans">
                {app?.name}
              </h1>
              <p className="text-[12px] sm:text-[13px] text-theme-text-muted leading-tight mt-0.5 font-normal truncate">
                Data safety
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area - Identical Layout Style to AboutAppPage */}
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
              {/* Section 1: Overview */}
              <div>
                <h1 className="text-[18px] sm:text-[20px] font-medium font-google-sans text-theme-text mb-3">
                  Data safety
                </h1>
                <p className="text-[15px] text-theme-text leading-[1.65] font-normal">
                  {overviewText}
                </p>
                <div className="mt-2">
                  <span 
                    onClick={() => {
                      if (!isExternalPrivacy || rawPrivacyUrl.includes('prople.store/privacy') || rawPrivacyUrl.includes('prople.co.in/privacy')) {
                        openPrivacyPolicy();
                      } else {
                        window.open(safePrivacyUrl, '_blank', 'noopener,noreferrer');
                      }
                    }}
                    className="text-[14px] text-blue-500 dark:text-[#8ab4f8] hover:underline cursor-pointer font-normal"
                  >
                    Learn more
                  </span>
                </div>
              </div>

              {/* Developer Privacy Policy Row with the App Logo (Moved above Data shared) */}
              <div className="flex items-center justify-between py-1.5 gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  {app?.iconUrl ? (
                    <img
                      src={app.iconUrl}
                      alt={app.name}
                      className="w-10 h-10 rounded-[10px] object-cover shrink-0 shadow-xs border border-white/10"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-[10px] bg-theme-hover flex items-center justify-center text-sm font-semibold shrink-0 text-theme-text">
                      {app?.name?.charAt(0) || 'P'}
                    </div>
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="text-[14px] sm:text-[15px] font-medium text-theme-text truncate font-google-sans">
                      {app?.name ? `${app.name} privacy policy` : 'Developer privacy policy'}
                    </span>
                    <span className="text-[12px] sm:text-[13px] text-theme-text-muted truncate">
                      {app?.developer || 'Developer provided'}
                    </span>
                  </div>
                </div>

                <a
                  href={isExternalPrivacy ? safePrivacyUrl : '/privacy'}
                  onClick={(e) => {
                    if (!isExternalPrivacy || rawPrivacyUrl.includes('prople.store/privacy') || rawPrivacyUrl.includes('prople.co.in/privacy')) {
                      e.preventDefault();
                      openPrivacyPolicy();
                    }
                  }}
                  target={isExternalPrivacy && !rawPrivacyUrl.includes('prople.store/privacy') && !rawPrivacyUrl.includes('prople.co.in/privacy') ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  className="text-[14px] sm:text-[15px] text-blue-500 dark:text-[#8ab4f8] hover:underline font-normal inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <span>See privacy policy</span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                </a>
              </div>

              {/* Section 2: Data Shared */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[18px] sm:text-[19px] font-medium font-google-sans text-theme-text">
                      Data shared
                    </h3>
                    <p className="text-[13px] text-theme-text-muted mt-0.5">
                      Data that may be shared with other companies or organisations
                    </p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setIsDataSharedOpen(!isDataSharedOpen)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-theme-text-muted hover:text-theme-text hover:bg-theme-hover transition-colors cursor-pointer"
                    aria-label="Toggle data shared"
                  >
                    <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${isDataSharedOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                <div className="pt-1">
                  <p className="text-[15px] text-theme-text leading-[1.65] whitespace-pre-line">
                    {dataSharedText}
                  </p>

                  {isDataSharedOpen && safety?.dataSharedDetails && (
                    <div className="mt-3.5 space-y-3 pt-2">
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-[14px] sm:text-[15px] text-theme-text">Sharing details</span>
                        <span className="text-[14px] sm:text-[15px] text-theme-text text-right font-normal">
                          {safety.dataSharedDetails}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 3: Data Collected */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[18px] sm:text-[19px] font-medium font-google-sans text-theme-text">
                      Data collected
                    </h3>
                    <p className="text-[13px] text-theme-text-muted mt-0.5">
                      Data this app may collect
                    </p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setIsDataCollectedOpen(!isDataCollectedOpen)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-theme-text-muted hover:text-theme-text hover:bg-theme-hover transition-colors"
                    aria-label="Toggle data collected"
                  >
                    <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${isDataCollectedOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                <div className="pt-1">
                  {dataCollectedList.length > 0 ? (
                    <div className="flex flex-col space-y-3">
                      {dataCollectedList.map((item, index) => {
                        const hasColon = item.includes(':');
                        if (!hasColon) {
                          return (
                            <div key={index} className="py-0.5">
                              <p className="text-[14px] sm:text-[15px] text-theme-text font-normal leading-relaxed whitespace-pre-line">
                                {item}
                              </p>
                            </div>
                          );
                        }
                        const parts = item.split(':');
                        const title = parts[0]?.trim();
                        const desc = parts.slice(1).join(':').trim();

                        return (
                          <div key={index} className="flex items-start justify-between gap-4 py-1">
                            <div className="min-w-0 flex-1">
                              <h4 className="text-[15px] font-medium text-theme-text">{title}</h4>
                              {desc && <p className="text-[13px] sm:text-[14px] text-theme-text-muted mt-0.5 leading-relaxed whitespace-pre-line">{desc}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[15px] text-theme-text leading-[1.65]">
                      The developer declared that this application does not collect personal or sensitive user data.
                    </p>
                  )}
                </div>
              </div>



          {/* Section 6: Data Deletion Policy */}
          {deletionPolicy && (
            <div className="space-y-3 pt-1">
              <div>
                <h3 className="text-[18px] sm:text-[19px] font-medium font-google-sans text-theme-text">
                  Data deletion &amp; retention policy
                </h3>
                <p className="text-[13px] text-theme-text-muted mt-0.5">
                  How the developer handles data removal requests
                </p>
              </div>

              <div className="pt-1">
                <p className="text-[15px] text-theme-text leading-[1.65] whitespace-pre-line font-normal">
                  {deletionPolicy}
                </p>
              </div>
            </div>
          )}

          {/* Section 6: App Permissions (Structured bullet points and permission sections) */}
          <div className="space-y-4 pt-1">
            <h3 className="text-[18px] sm:text-[19px] font-medium font-google-sans text-theme-text">
              App permissions
            </h3>

            <div className="flex flex-col space-y-3">
              <span className="text-[14px] sm:text-[15px] text-theme-text font-medium">Requested permissions</span>

              {previewPermissionGroups.length > 0 ? (
                <div className="space-y-3 pt-0.5">
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

                  <div className="pt-1">
                    <button 
                      type="button"
                      onClick={() => setShowPermissionsPage(true)} 
                      className="text-[14px] sm:text-[15px] text-blue-500 dark:text-[#8ab4f8] hover:underline font-medium cursor-pointer text-left inline-block"
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
                  <div className="pt-0.5">
                    <button 
                      type="button"
                      onClick={() => setShowPermissionsPage(true)} 
                      className="text-[14px] sm:text-[15px] text-blue-500 dark:text-[#8ab4f8] hover:underline font-normal cursor-pointer text-left inline-block"
                    >
                      See details
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Secondary Sidebar Column */}
        <div className="md:col-span-5 lg:col-span-4 flex flex-col gap-6 pt-6 md:pt-0 min-w-0 md:sticky md:top-4 self-start">

          {/* Section 7: Developer Policies & External Links */}
          <div className="space-y-3.5 pt-1">
            {formattedWebsiteUrl && (
              <div className="flex items-center justify-between">
                <span className="text-[14px] sm:text-[15px] text-theme-text">Official Website</span>
                <a 
                  href={formattedWebsiteUrl}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[14px] sm:text-[15px] text-blue-500 dark:text-[#8ab4f8] hover:underline inline-flex items-center gap-1.5 truncate max-w-[60%]"
                >
                  <span className="truncate">{websiteUrl}</span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                </a>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-[14px] sm:text-[15px] text-theme-text">Terms and Conditions</span>
              <a 
                href={isExternalTerms ? safeTermsUrl : '/terms'}
                onClick={(e) => {
                  if (!isExternalTerms || termsUrl.includes('prople.store/terms') || termsUrl.includes('prople.co.in/terms') || termsUrl.endsWith('/terms')) {
                    e.preventDefault();
                    openTermsOfService();
                  }
                }}
                target={isExternalTerms && !termsUrl.includes('prople.store/terms') && !termsUrl.includes('prople.co.in/terms') ? '_blank' : undefined}
                rel="noopener noreferrer"
                className="text-[14px] sm:text-[15px] text-blue-500 dark:text-[#8ab4f8] hover:underline inline-flex items-center gap-1.5"
              >
                <span>Read Agreement</span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              </a>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[14px] sm:text-[15px] text-theme-text">Privacy Policy</span>
              <a 
                href={isExternalPrivacy ? safePrivacyUrl : '/privacy'}
                onClick={(e) => {
                  if (!isExternalPrivacy || rawPrivacyUrl.includes('prople.store/privacy') || rawPrivacyUrl.includes('prople.co.in/privacy') || rawPrivacyUrl.endsWith('/privacy')) {
                    e.preventDefault();
                    openPrivacyPolicy();
                  }
                }}
                target={isExternalPrivacy && !rawPrivacyUrl.includes('prople.store/privacy') && !rawPrivacyUrl.includes('prople.co.in/privacy') ? '_blank' : undefined}
                rel="noopener noreferrer"
                className="text-[14px] sm:text-[15px] text-blue-500 dark:text-[#8ab4f8] hover:underline inline-flex items-center gap-1.5"
              >
                <span>Read Policy</span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

      {/* Flag as inappropriate modal */}
      <FlagAppModal
        isOpen={isFlagModalOpen}
        onClose={() => setIsFlagModalOpen(false)}
        onConfirmFlag={handleConfirmFlag}
      />
    </div>
  );
}


