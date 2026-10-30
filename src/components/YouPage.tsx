import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useInstall } from '../context/InstallContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { 
  Settings, 
  HelpCircle, 
  Bell, 
  ArrowLeft,
  ChevronLeft, 
  ChevronRight, 
  Code, 
  Mail, 
  MessageSquare, 
  FileText, 
  ExternalLink, 
  LogOut, 
  LogIn, 
  User,
  ShieldCheck,
  ShieldAlert,
  Star,
  Download,
  Heart,
  BookmarkPlus,
  Briefcase,
  Workflow
} from 'lucide-react';
import AppConsole from './AppConsole';
import AuthPage from './AuthPage';
import NotificationsPage from './NotificationsPage';
import RatingsAndReviewsPage from './RatingsAndReviewsPage';
import ConfirmationDialog from './ConfirmationDialog';
import PrivacyPolicyPage from './PrivacyPolicyPage';
import TermsPage from './TermsPage';
import AppsSecurityPage from './AppsSecurityPage';
import HowItWorksPage from './HowItWorksPage';
import AntiPiracyPolicyPage from './AntiPiracyPolicyPage';
import UserConsentPolicyPage from './UserConsentPolicyPage';
import BrandLogo from './BrandLogo';
import { useNavigation } from '../context/NavigationContext';
import { isAdminEmail } from '../context/AuthContext';
import { AdminModerationService } from '../services/adminModerationService';
import AdminControlPanel from './AdminControlPanel';
import SimilarAppsPage from './SimilarAppsPage';
import WishlistPage from './WishlistPage';
import EditProfilePage from './EditProfilePage';
import { useStoreConfig } from '../context/StoreConfigContext';
import { useBookmarks } from '../services/bookmarkService';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { AppListing } from '../types';
import StoreCircleLoader from './StoreCircleLoader';

export default function YouPage({ onAppClick, onOpenNotifications }: { onAppClick?: (id: string) => void; onOpenNotifications?: () => void }) {
  const { unreadNotificationsCount, openAuthDialog } = useInstall();
  const { showToast, hasActiveToast } = useToast();
  const { user, isLoading: isAuthLoading, logout, loginWithGoogle, isAdmin } = useAuth();
  const { isInstalled } = usePWAInstall();
  const isAdminUser = Boolean(isAdmin || isAdminEmail(user?.email) || user?.email === 'sahinurmolla190@gmail.com');

  const { 
    youView, 
    setYouView, 
    goBack,
    openPrivacyPolicy,
    openTermsOfService,
    openDataSafety,
    openDataDeletion,
    openAppsSecurity,
    openAboutStore,
    openHowItWorks,
    openAntiPiracy,
    openUserConsentPolicy,
    openContactSupport,
    openPublisherConsole,
    openAppReviews,
    openAuthPage,
    setPreviewPopup,
    resetToHome
  } = useNavigation();
  
  const { allAppListings } = useStoreConfig();
  const { bookmarkedIds } = useBookmarks();

  const bookmarkedApps = useMemo(() => {
    if (!bookmarkedIds.length) return [];
    return bookmarkedIds
      .map((id) => allAppListings.find((app) => app.id === id))
      .filter((app): app is AppListing => Boolean(app));
  }, [bookmarkedIds, allAppListings]);

  const setActiveView = (view: 'main' | 'notifications' | 'settings' | 'help' | 'studio' | 'ratings-and-reviews' | 'auth' | 'privacy' | 'terms' | 'security' | 'admin-panel' | 'bookmarked-apps' | 'wishlist' | 'edit-profile' | 'how-it-works' | 'anti-piracy' | 'user-consent') => {
    if (view === 'main') {
      goBack();
    } else {
      setYouView(view as any);
    }
  };
  const activeView = youView;

  const [adminStatsVersion, setAdminStatsVersion] = useState(0);
  const pendingAdminReportsCount = useMemo(() => {
    if (!isAdminUser) return 0;
    return AdminModerationService.getAppReports().filter(r => r.status === 'pending').length +
           AdminModerationService.getReviewReports().filter(r => r.status === 'pending').length;
  }, [isAdminUser, adminStatsVersion]);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authReturnView, setAuthReturnView] = useState<string>('main');
  const [authInitialMode, setAuthInitialMode] = useState<'signin' | 'signup'>('signin');

  const handleOpenConsole = () => {
    setActiveView('studio');
  };

  // Developer Program notice: arrives when an unauthenticated user views the profile page, but only if not already active
  useEffect(() => {
    try {
      localStorage.removeItem('prople_dev_notice_dismissed');
    } catch {}

    if (isAuthLoading || user || activeView !== 'main') return;

    // Never show developer notice during password reset or auth flows
    if (typeof window !== 'undefined') {
      const search = window.location.search || '';
      if (search.includes('reset-password') || search.includes('resetPassword') || search.includes('auth=') || search.includes('oobCode')) {
        return;
      }
    }

    // If a toast is already present and active (e.g. from tab switching), do not show another
    if (hasActiveToast && hasActiveToast()) {
      return;
    }

    const timer = setTimeout(() => {
      // Re-check when timer fires
      if (hasActiveToast && hasActiveToast()) {
        return;
      }

      showToast(
        'Developer Notice: App downloads on Prople Store are 100% free with no account needed. Sign in with Google to publish applications, manage GitHub releases, and access developer tools.',
        {
          type: 'info',
          actionLabel: 'Open console',
          actionPlacement: 'inline',
          duration: 16000,
          onAction: () => {
            setActiveView('studio');
          },
        }
      );
    }, 250);

    return () => clearTimeout(timer);
  }, [isAuthLoading, user, activeView, showToast, hasActiveToast]);

  const userEmail = user?.email || "Guest User";
  const userName = user?.publisherName || user?.displayName || "Guest";

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await loginWithGoogle();
      showToast('Signed in with Google');
    } catch {
      showToast('Google sign-in failed. Please try again.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  const toggleFaq = (id: string) => {
    setExpandedFaq(prev => prev === id ? null : id);
  };

  const handleSendFeedback = () => {
    window.location.href = 'mailto:cloaktailofficial@gmail.com?subject=Prople%20Store%20Feedback&body=Hello%20Prople%20Store%20Team,%0A%0AI%20would%20like%20to%20provide%20feedback%20regarding:%0A';
  };

  const handleVisitHelpCenter = () => {
    window.location.href = 'mailto:cloaktailofficial@gmail.com?subject=Prople%20Store%20Help%20Center%20Support';
  };

  if (activeView === 'bookmarked-apps' || activeView === 'wishlist') {
    return (
      <WishlistPage 
        title="Wishlist" 
        appsList={bookmarkedApps} 
        onBack={() => setActiveView('main')} 
        onAppClick={(id) => onAppClick?.(id)} 
      />
    );
  }

  if (activeView === 'auth') {
    return (
      <AuthPage 
        initialMode={authInitialMode}
        onClose={() => {
          const dest = authReturnView;
          setAuthReturnView('main');
          setAuthInitialMode('signin');
          setActiveView(dest as any);
        }} 
        onSuccess={() => {
          setAuthReturnView('main');
          setAuthInitialMode('signin');
          setActiveView('main');
          resetToHome?.();
        }} 
      />
    );
  }

  if (activeView === 'notifications') {
    return (
      <NotificationsPage 
        onClose={() => setActiveView('main')} 
        onAppClick={(id) => onAppClick?.(id)} 
        onNavigate={(v) => {
          if (v === 'console') setActiveView('studio');
          else if (v === 'dev-donation' || v === 'donation') setPreviewPopup('dev-donation');
          else setActiveView('main');
        }} 
      />
    );
  }

  if (activeView === 'edit-profile') {
    return <EditProfilePage onBack={() => goBack()} />;
  }

  if (activeView === 'how-it-works') {
    return (
      <HowItWorksPage 
        onBack={() => goBack()} 
        onNavigateHome={() => resetToHome?.()}
        onOpenConsole={handleOpenConsole}
        onOpenSecurity={() => setActiveView('security')}
        onOpenCatalog={() => resetToHome?.()}
      />
    );
  }

  if (activeView === 'settings') {
    return (
      <div className="fixed inset-0 z-50 bg-theme-bg text-theme-text w-full flex flex-col h-full overflow-y-auto scrollbar-hide pb-20 shadow-none">
        <header className="sticky top-0 bg-theme-bg z-20 flex items-center justify-between px-2.5 sm:px-4 md:px-6 h-[60px] sm:h-[68px] shrink-0 gap-3 border-0">
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0 -translate-x-[2px]">
            <button 
              onClick={() => goBack()} 
              className="w-9 h-9 flex items-center justify-center -ml-1 text-theme-text hover:bg-theme-hover active:bg-theme-hover/80 rounded-full transition-colors cursor-pointer" 
              aria-label="Back"
              title="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-theme-text" />
            </button>
            <h1 className="text-[17px] sm:text-[19px] font-medium text-theme-text tracking-tight truncate">
              Settings
            </h1>
          </div>
        </header>

        <div className="flex-1 w-full flex flex-col">
          {!user && (
            <div className="w-full flex-col flex">
              <MenuItem 
                onClick={() => {
                  openAuthPage('signin');
                }}
                icon={<LogIn className="w-5 h-5 text-theme-text-muted" />} 
                label="Sign In or Register" 
                sublabel="Email OTP or Google account sign-in"
                hasBorder={false}
                rightIcon={<ChevronRight className="w-4 h-4" />} 
              />
            </div>
          )}

          <div className="w-full flex-col flex">
            {/* Dedicated Edit Profile option in Settings */}
            {user && (
              <MenuItem 
                onClick={() => setActiveView('edit-profile')}
                icon={<User className="w-5 h-5 text-theme-text-muted" />} 
                label="Edit Profile" 
                sublabel="Display name, bio & preferences"
                hasBorder={false}
                rightIcon={<ChevronRight className="w-4 h-4 text-theme-text-muted" />} 
              />
            )}
            
            {/* Sustain Prople Platform Donation Modal Option */}
            <MenuItem 
              onClick={() => setPreviewPopup('dev-donation')}
              icon={<Heart className="w-5 h-5 text-red-500 fill-red-500" />} 
              label="Sustain Prople Platform" 
              sublabel="A note from the developer team.. "
              hasBorder={false}
              rightIcon={<ChevronRight className="w-4 h-4" />} 
            />

            {/* Log Out Button */}
            {user && (
              <button 
                id="settings-logout-btn"
                onClick={() => setShowLogoutConfirm(true)} 
                className="w-full flex items-center justify-between px-4 sm:px-6 md:px-8 py-3.5 hover:bg-red-500/10 text-red-500 hover:text-red-400 rounded-2xl transition-colors text-left group cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="text-red-500 group-hover:text-red-400 transition-colors">
                    <LogOut className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[14px] font-medium">Log out</span>
                    <span className="text-[12px] text-theme-text-muted">Sign out of {user.email}</span>
                  </div>
                </div>
              </button>
            )}
          </div>
        </div>

        <ConfirmationDialog
          isOpen={showLogoutConfirm}
          title="Sign out of account?"
          description={`Are you sure you want to sign out of ${user?.email || 'your account'}? You will need to sign in again to access developer tools and saved configurations.`}
          confirmLabel="Sign out"
          cancelLabel="Cancel"
          isDestructive={true}
          icon="danger"
          onConfirm={async () => {
            await logout();
            setShowLogoutConfirm(false);
            showToast('Logged out successfully');
          }}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      </div>
    );
  }

  if (activeView === 'admin-panel') {
    return (
      <AdminControlPanel 
        onClose={() => {
          setActiveView('main');
          setAdminStatsVersion(v => v + 1);
        }} 
        onOpenAppDetail={(id) => onAppClick?.(id)} 
        onOpenPublisher={(pub) => openPublisherConsole(pub)}
        onOpenPublisherConsole={(pub) => openPublisherConsole(pub)}
        onOpenReviews={(appId, reviewId) => openAppReviews(appId, reviewId)}
      />
    );
  }

  if (activeView === 'studio') {
    return (
      <AppConsole 
        onClose={() => setActiveView('main')} 
        onOpenAppDetail={(id) => onAppClick?.(id)} 
      />
    );
  }

  if (activeView === 'ratings-and-reviews') {
    return <RatingsAndReviewsPage onClose={() => setActiveView('main')} />;
  }

  if (activeView === 'privacy') {
    return (
      <PrivacyPolicyPage 
        onBack={() => setActiveView('main')} 
        onOpenTerms={openTermsOfService}
        onOpenAbout={openAboutStore}
        onOpenSecurity={() => setActiveView('security')}
        onOpenAntiPiracy={openAntiPiracy}
        onOpenHowItWorks={openHowItWorks}
        onOpenUserConsent={openUserConsentPolicy}
      />
    );
  }

  if (activeView === 'terms') {
    return (
      <TermsPage 
        onBack={() => setActiveView('main')} 
        onOpenPrivacy={openPrivacyPolicy}
        onOpenAbout={openAboutStore}
        onOpenSecurity={() => setActiveView('security')}
        onOpenAntiPiracy={openAntiPiracy}
        onOpenHowItWorks={openHowItWorks}
        onOpenUserConsent={openUserConsentPolicy}
      />
    );
  }

  if (activeView === 'anti-piracy') {
    return (
      <AntiPiracyPolicyPage 
        onBack={() => setActiveView('main')} 
        onOpenPrivacy={openPrivacyPolicy}
        onOpenTerms={openTermsOfService}
        onOpenSecurity={() => setActiveView('security')}
        onOpenHowItWorks={openHowItWorks}
        onOpenUserConsent={openUserConsentPolicy}
        onOpenAbout={openAboutStore}
      />
    );
  }

  if (activeView === 'user-consent') {
    return (
      <UserConsentPolicyPage 
        onBack={() => setActiveView('main')} 
        onOpenPrivacy={openPrivacyPolicy}
        onOpenTerms={openTermsOfService}
        onOpenSecurity={() => setActiveView('security')}
        onOpenAntiPiracy={openAntiPiracy}
        onOpenHowItWorks={openHowItWorks}
        onOpenAbout={openAboutStore}
      />
    );
  }

  if (activeView === 'security') {
    return (
      <AppsSecurityPage 
        onBack={() => setActiveView('main')} 
        onOpenPrivacy={openPrivacyPolicy}
        onOpenTerms={openTermsOfService}
        onOpenDataSafety={openDataSafety}
      />
    );
  }

  if (activeView === 'help') {
    return (
      <div className="fixed inset-0 z-50 bg-theme-bg text-theme-text w-full flex flex-col h-full overflow-y-auto scrollbar-hide pb-20 shadow-none">
        <header className="sticky top-0 bg-theme-bg z-20 flex items-center justify-between px-2.5 sm:px-4 md:px-6 h-[60px] sm:h-[68px] shrink-0 gap-3 border-0">
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0 -translate-x-[2px]">
            <button 
              onClick={() => setActiveView('main')} 
              className="w-9 h-9 flex items-center justify-center -ml-1 text-theme-text hover:bg-theme-hover active:bg-theme-hover/80 rounded-full transition-colors cursor-pointer" 
              aria-label="Back"
              title="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-theme-text" />
            </button>
            <h1 className="text-[17px] sm:text-[19px] font-medium text-theme-text tracking-tight truncate">
              Help and feedback
            </h1>
          </div>
        </header>
        
        <div className="w-full flex flex-col gap-6 md:gap-8 pb-10">
          <div className="py-6 px-2.5 sm:px-4 md:px-6 flex flex-col items-center justify-center gap-2 text-center">
            <div className="shrink-0 mb-3 flex items-center justify-center">
              <BrandLogo size="xl" showText={false} />
            </div>
            <span className="text-[20px] font-semibold text-theme-text">Contact Support</span>
            <span className="text-[15px] text-theme-text-muted mb-3">cloaktailofficial@gmail.com</span>
            <a href="mailto:cloaktailofficial@gmail.com" className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium rounded-full text-[15px] transition-colors shadow-xs">
               Send Email
            </a>
          </div>

          <div className="flex flex-col">
             <span className="text-[17px] font-medium text-theme-text mb-2 px-2.5 sm:px-4 md:px-6">Popular articles</span>
             <div className="flex flex-col space-y-0.5">
               <div>
                 <MenuItem 
                   onClick={() => toggleFaq('faq-install')} 
                   icon={<FileText className="w-5 h-5 text-gray-400" />} 
                   label="How to install and update apps" 
                   hasBorder={false}
                   rightIcon={<ChevronRight className={`w-4 h-4 text-theme-text-muted transition-transform duration-200 ${expandedFaq === 'faq-install' ? 'rotate-90 text-blue-500' : ''}`} />} 
                 />
                 {expandedFaq === 'faq-install' && (
                   <div className="px-2.5 sm:px-4 md:px-6 pb-3.5 pt-0 text-[13px] text-theme-text-muted leading-relaxed pl-13 animate-in fade-in duration-200">
                     Browse the store catalog, choose an app, and tap <strong>Install</strong> or <strong>Download APK</strong>. For Progressive Web Apps (PWAs), tap the Install icon in the top header or browser prompt to add it to your home screen. When new updates are released, visit the app page or check your notifications to get the latest build.
                   </div>
                 )}
               </div>

               <div>
                 <MenuItem 
                   onClick={() => toggleFaq('faq-storage')} 
                   icon={<FileText className="w-5 h-5 text-gray-400" />} 
                   label="Device storage and app manager" 
                   hasBorder={false}
                   rightIcon={<ChevronRight className={`w-4 h-4 text-theme-text-muted transition-transform duration-200 ${expandedFaq === 'faq-storage' ? 'rotate-90 text-blue-500' : ''}`} />} 
                 />
                 {expandedFaq === 'faq-storage' && (
                   <div className="px-2.5 sm:px-4 md:px-6 pb-3.5 pt-0 text-[13px] text-theme-text-muted leading-relaxed pl-13 animate-in fade-in duration-200">
                     Prople Store caches app listings and assets locally for rapid loading and offline browsing. You can manage storage space or clear cached data anytime through your device browser settings or system App Settings. To remove installed APKs, manage them directly from your device app launcher.
                   </div>
                 )}
               </div>

               <div>
                 <MenuItem 
                   onClick={() => toggleFaq('faq-publishing')} 
                   icon={<FileText className="w-5 h-5 text-gray-400" />} 
                   label="Publishing releases on Prople Store" 
                   hasBorder={false} 
                   rightIcon={<ChevronRight className={`w-4 h-4 text-theme-text-muted transition-transform duration-200 ${expandedFaq === 'faq-publishing' ? 'rotate-90 text-blue-500' : ''}`} />} 
                 />
                 {expandedFaq === 'faq-publishing' && (
                   <div className="px-2.5 sm:px-4 md:px-6 pb-3.5 pt-0 text-[13px] text-theme-text-muted leading-relaxed pl-13 animate-in fade-in duration-200">
                     Authorized solo developers can sign in with their verified developer Google account to access the Developer Console. From there, you can submit new application listings, manage APK download links, configure custom feature graphics, and provide official release notes.
                   </div>
                 )}
               </div>
             </div>
          </div>

          <div className="flex flex-col">
             <span className="text-[17px] font-medium text-theme-text mb-2 px-2.5 sm:px-4 md:px-6">Legal &amp; About</span>
             <div className="flex flex-col space-y-0.5">
               <MenuItem 
                 onClick={openPrivacyPolicy} 
                 icon={<ShieldCheck className="w-5 h-5 text-gray-400" />} 
                 label="Privacy Policy" 
                 hasBorder={false} 
                 rightIcon={<ChevronRight className="w-4 h-4 text-theme-text-muted" />} 
               />
               <MenuItem 
                 onClick={openTermsOfService} 
                 icon={<FileText className="w-5 h-5 text-gray-400" />} 
                 label="Terms and Conditions" 
                 hasBorder={false} 
                 rightIcon={<ChevronRight className="w-4 h-4 text-theme-text-muted" />} 
               />
               <MenuItem 
                 onClick={() => setActiveView('security')} 
                 icon={<ShieldCheck className="w-5 h-5 text-gray-400" />} 
                 label="Apps and security" 
                 sublabel="Platform security policy & transparency"
                 hasBorder={false} 
                 rightIcon={<ChevronRight className="w-4 h-4 text-theme-text-muted" />} 
               />
               <MenuItem 
                 onClick={openAboutStore} 
                 icon={<ExternalLink className="w-5 h-5 text-gray-400" />} 
                 label="About Prople Store" 
                 sublabel="Cloaktail Industries platform information"
                 hasBorder={false} 
                 rightIcon={<ChevronRight className="w-4 h-4 text-theme-text-muted" />} 
               />
               <MenuItem 
                 onClick={() => setActiveView('how-it-works')} 
                 icon={<Workflow className="w-5 h-5 text-gray-400" />} 
                 label="How Prople Store Works" 
                 sublabel="Architecture, branches & distribution workflows"
                 hasBorder={false} 
                 rightIcon={<ChevronRight className="w-4 h-4 text-theme-text-muted" />} 
               />
             </div>
          </div>
        </div>
      </div>
    );
  }

  if (isAuthLoading && !user) {
    return (
      <div className="flex flex-col min-h-full bg-theme-bg text-theme-text pb-20 selection:bg-blue-500/30">
        <div className="flex-1 flex items-center justify-center min-h-[50vh] w-full">
          <StoreCircleLoader size="md" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-theme-bg text-theme-text pb-20 selection:bg-blue-500/30">
      <div className="w-full max-w-4xl mx-auto px-2.5 sm:px-4 md:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        
        {/* Profile Info / Sign In Header */}
        {user ? (
          <div className="p-5 sm:p-6 bg-theme-card rounded-2xl shadow-xs flex flex-col items-center justify-center text-center">
            {/* Email above profile at middle */}
            <span className="text-[13px] text-theme-text-muted font-medium mb-3 block truncate max-w-full">
              {userEmail}
            </span>

            {/* PFP at middle */}
            <div 
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-blue-600 flex items-center justify-center overflow-hidden shrink-0 shadow-sm mb-2.5 relative"
            >
              {user.photoURL && user.photoURL.trim() ? (
                <img 
                  src={user.photoURL} 
                  alt={userName} 
                  referrerPolicy="no-referrer" 
                  className="w-full h-full object-cover" 
                  onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                />
              ) : (
                <span className="text-2xl sm:text-3xl font-bold text-white tracking-wide">
                  {userName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            {/* User Name */}
            <h2 className="text-lg sm:text-xl font-semibold text-theme-text tracking-tight truncate max-w-full">
              Hi, {userName}!
            </h2>
          </div>
        ) : (
          <div className="p-4 sm:p-5 bg-theme-card rounded-2xl shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-full bg-theme-hover flex items-center justify-center shrink-0">
                <User className="w-6 h-6 text-theme-text-muted" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base sm:text-lg font-semibold text-theme-text">Sign in to Prople Store</h2>
                <p className="text-xs text-theme-text-muted line-clamp-1">
                  Access developer tools, sync apps, and write reviews
                </p>
              </div>
            </div>
            <div className="w-full sm:w-auto">
              <button
                type="button"
                id="you-open-signin-btn"
                onClick={() => setActiveView('auth')}
                className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold rounded-full transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign in</span>
              </button>
            </div>
          </div>
        )}

        {/* Options Menu Card */}
        <div className="bg-theme-card rounded-2xl shadow-xs overflow-hidden">
          {/* Exclusive Admin Control Panel Option for Admin */}
          {isAdminUser && (
            <MenuItem 
              onClick={() => setActiveView('admin-panel')} 
              icon={<ShieldAlert className="w-5 h-5 text-theme-text-muted" />} 
              label="Admin Control Panel" 
              sublabel="Platform moderation, app reports & safety controls"
              badge={pendingAdminReportsCount > 0 ? pendingAdminReportsCount : undefined}
              badgeLabel={pendingAdminReportsCount > 0 ? `${pendingAdminReportsCount}` : undefined}
              rightIcon={<ChevronRight className="w-4 h-4 text-theme-text-muted" />} 
            />
          )}

          <MenuItem 
            onClick={() => setActiveView('wishlist')} 
            icon={<BookmarkPlus className="w-5 h-5 text-theme-text-muted" />} 
            label="Wishlist" 
            sublabel={bookmarkedApps.length > 0 ? `${bookmarkedApps.length} saved app${bookmarkedApps.length === 1 ? '' : 's'}` : "Saved apps & games"}
            badge={bookmarkedApps.length > 0 ? bookmarkedApps.length : undefined}
            badgeLabel={`${bookmarkedApps.length}`}
            rightIcon={<ChevronRight className="w-4 h-4 text-theme-text-muted" />} 
          />

          <MenuItem 
            onClick={() => setActiveView('ratings-and-reviews')} 
            icon={<Star className="w-5 h-5 text-theme-text-muted" />} 
            label="Ratings and reviews" 
            sublabel="Review history and feedback notifications"
            rightIcon={<ChevronRight className="w-4 h-4 text-theme-text-muted" />} 
          />
          <MenuItem 
            onClick={() => onOpenNotifications ? onOpenNotifications() : setActiveView('notifications')} 
            icon={<Bell className="w-5 h-5 text-theme-text-muted" />} 
            label="Notifications & offers" 
            badge={unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined}
            badgeLabel={unreadNotificationsCount === 1 ? '1 new' : `${unreadNotificationsCount} new`}
            rightIcon={<ChevronRight className="w-4 h-4 text-theme-text-muted" />} 
          />
          {/* Developer Console: Accessible to all publishers and admins */}
          <MenuItem 
            onClick={handleOpenConsole} 
            icon={<Code className="w-5 h-5 text-theme-text-muted" />} 
            label="Developer Console" 
            sublabel="Manage your releases and published apps"
            rightIcon={<ChevronRight className="w-4 h-4 text-theme-text-muted" />} 
          />
          <MenuItem 
            onClick={() => setActiveView('how-it-works')} 
            icon={<Workflow className="w-5 h-5 text-theme-text-muted" />} 
            label="How Prople Store Works" 
            sublabel="Branches, architecture & distribution workflows" 
            rightIcon={<ChevronRight className="w-4 h-4 text-theme-text-muted" />} 
          />
          <MenuItem 
            onClick={() => setActiveView('settings')} 
            icon={<Settings className="w-5 h-5 text-theme-text-muted" />} 
            label="Settings" 
            sublabel="Preferences and account" 
            rightIcon={<ChevronRight className="w-4 h-4 text-theme-text-muted" />} 
          />
          <MenuItem 
            onClick={() => setActiveView('help')} 
            icon={<HelpCircle className="w-5 h-5 text-theme-text-muted" />} 
            label="Help and feedback" 
            rightIcon={<ChevronRight className="w-4 h-4 text-theme-text-muted" />} 
          />
        </div>

        {/* Footer Links */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 py-6 px-4 text-[12px] text-theme-text-muted font-medium">
          <button type="button" onClick={openPrivacyPolicy} className="hover:text-theme-text transition-colors cursor-pointer">Privacy Policy</button>
          <span className="w-1 h-1 rounded-full bg-theme-text-muted/60"></span>
          <button type="button" onClick={openTermsOfService} className="hover:text-theme-text transition-colors cursor-pointer">Terms of Service</button>
          <span className="w-1 h-1 rounded-full bg-theme-text-muted/60"></span>
          <button type="button" onClick={openUserConsentPolicy} className="hover:text-theme-text transition-colors cursor-pointer">Data Collection &amp; Consent</button>
          <span className="w-1 h-1 rounded-full bg-theme-text-muted/60"></span>
          <button type="button" onClick={openAntiPiracy} className="hover:text-theme-text transition-colors cursor-pointer">Anti-Piracy &amp; DMCA</button>
          <span className="w-1 h-1 rounded-full bg-theme-text-muted/60"></span>
          <button type="button" onClick={() => setActiveView('security')} className="hover:text-theme-text transition-colors cursor-pointer">Apps &amp; Security</button>
          <span className="w-1 h-1 rounded-full bg-theme-text-muted/60"></span>
          <button type="button" onClick={openAboutStore} className="hover:text-theme-text transition-colors cursor-pointer">About Prople Store</button>
          <span className="w-1 h-1 rounded-full bg-theme-text-muted/60"></span>
          <button type="button" onClick={() => setActiveView('how-it-works')} className="hover:text-theme-text transition-colors cursor-pointer">How It Works</button>
        </div>
      </div>
    </div>
  );
}

function MenuItem({ 
  icon, 
  label, 
  sublabel, 
  rightIcon, 
  onClick, 
  hasBorder = false, 
  badge, 
  badgeLabel,
  tag,
  className
}: { 
  icon: React.ReactNode; 
  label: string; 
  sublabel?: string; 
  rightIcon?: React.ReactNode; 
  onClick?: () => void; 
  hasBorder?: boolean; 
  badge?: number; 
  badgeLabel?: string;
  tag?: string; 
  className?: string;
}) {
  return (
    <button 
      type="button"
      onClick={onClick} 
      className={className || `w-full flex items-center justify-between gap-3.5 px-4 sm:px-5 py-3.5 hover:bg-theme-hover/60 active:bg-theme-hover transition-colors text-left cursor-pointer ${hasBorder ? 'border-b border-theme-border/40' : ''}`}
    >
      <div className="flex items-center gap-3.5 flex-1 min-w-0">
        <div className="text-theme-text-muted shrink-0">
          {icon}
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[14px] sm:text-[15px] font-medium text-theme-text truncate">{label}</span>
            {tag && (
              <span className="bg-amber-500/20 text-amber-500 border border-amber-500/30 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">
                {tag}
              </span>
            )}
            {badge !== undefined && badge > 0 && (
              <span className="text-blue-600 dark:text-[#8ab4f8] text-[12px] sm:text-[13px] font-medium inline-flex items-center gap-1.5 ml-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-[#8ab4f8]" />
                <span>{badgeLabel !== undefined ? badgeLabel : badge}</span>
              </span>
            )}
          </div>
          {sublabel && (
            <span className="text-[12px] text-theme-text-muted mt-0.5 line-clamp-1">{sublabel}</span>
          )}
        </div>
      </div>
      {rightIcon && <div className="text-theme-text-muted shrink-0 ml-2">{rightIcon}</div>}
    </button>
  );
}
