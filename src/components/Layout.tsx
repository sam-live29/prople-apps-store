import React, { ReactNode, useState, useRef, useEffect, createContext } from 'react';
import { 
  Menu, 
  X, 
  Gamepad2,
  LayoutGrid, 
  Search, 
  User, 
  Bell, 
  Code, 
  TrendingUp, 
  Grid, 
  Shield, 
  FileText, 
  HelpCircle, 
  LogOut, 
  ChevronRight,
  Info,
  Trash2
} from 'lucide-react';
import { useInstall } from '../context/InstallContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNavigation } from '../context/NavigationContext';
import BottomNav from './BottomNav';
import BrandLogo from './BrandLogo';
import { OfflineIndicator } from './OfflineIndicator';
import PrivacyPolicyPage from './PrivacyPolicyPage';
import TermsPage from './TermsPage';

interface LayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenSearch?: (startWithVoice?: boolean) => void;
  onOpenNotifications?: () => void;
  onOpenAppDetail?: (appId: string) => void;
  activeSubTab?: string;
  onSubTabChange?: (tab: string) => void;
  hideHeader?: boolean;
  hideBottomNav?: boolean;
}

export const ScrollContext = createContext({ isNavVisible: true });

const homeTabs = ['For you', 'Top charts', 'Categories'];

export default function MarketplaceShell({ 
  children, 
  activeTab, 
  onTabChange, 
  onOpenSearch, 
  onOpenNotifications, 
  onOpenAppDetail, 
  activeSubTab, 
  onSubTabChange,
  hideHeader,
  hideBottomNav
}: LayoutProps) {
  const mainRef = useRef<HTMLElement | null>(null);
  const { unreadNotificationsCount } = useInstall();
  const { user, loginWithGoogle, logout } = useAuth();
  const { showToast } = useToast();
  const { 
    openPrivacyPolicy, 
    openTermsOfService, 
    openAboutStore,
    openAuthPage,
    setYouView,
    youView,
    overlay,
    activeAppDetailsId
  } = useNavigation();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const isConsoleOpen = Boolean(
    activeTab === 'you' && youView === 'studio'
  );

  const isSubViewInYou = activeTab === 'you' && Boolean(youView && youView !== 'main');
  const shouldHideHeader = Boolean(
    hideHeader || 
    isSubViewInYou || 
    isConsoleOpen || 
    (overlay && overlay !== 'none') || 
    Boolean(activeAppDetailsId)
  );
  const shouldHideBottomNav = Boolean(
    hideBottomNav || 
    isSubViewInYou || 
    isConsoleOpen || 
    (overlay && overlay !== 'none') || 
    Boolean(activeAppDetailsId)
  );
  const [isDesktopMode, setIsDesktopMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return true;
  });

  useEffect(() => {
    const checkDesktopMode = () => {
      // In desktop mode on mobiles/tablets or standard desktop monitors, width is >= 768px
      setIsDesktopMode(window.innerWidth >= 768);
    };

    checkDesktopMode();
    window.addEventListener('resize', checkDesktopMode);
    return () => window.removeEventListener('resize', checkDesktopMode);
  }, []);

  const hasUnread = unreadNotificationsCount > 0;

  // Handle Escape key to dismiss drawer or modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isDrawerOpen) {
          e.stopPropagation();
          setIsDrawerOpen(false);
          return;
        }
        if (showPrivacy) {
          e.stopPropagation();
          setShowPrivacy(false);
          return;
        }
        if (showTerms) {
          e.stopPropagation();
          setShowTerms(false);
          return;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isDrawerOpen, showPrivacy, showTerms]);

  return (
    <ScrollContext.Provider value={{ isNavVisible: true }}>
      <div className="fixed inset-0 flex flex-col bg-theme-bg text-theme-text font-sans w-full shadow-none overflow-hidden selection:bg-blue-500/30">
        
        {/* Main Content Shell */}
        <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
          {/* Top Header (Mobile & Desktop) */}
          {!shouldHideHeader && (
            <div className="w-full z-40 bg-theme-bg shrink-0">
              <header className="h-[60px] sm:h-[68px] flex items-center justify-between px-2.5 sm:px-4 md:px-6 bg-theme-bg shrink-0 gap-3 border-0">
                {/* App logo on left beside menu button. Aligned with For you filter */}
                <div className="flex items-center gap-2 sm:gap-3 shrink-0 -translate-x-[2px]">
                  <button 
                    type="button"
                    id="header-side-menu-btn"
                    onClick={() => setIsDrawerOpen(true)}
                    className="hidden md:flex w-8 h-8 text-theme-text hover:bg-theme-hover rounded-full transition-colors cursor-pointer items-center justify-center shrink-0"
                    aria-label="Open side menu"
                  >
                    <Menu className="w-5 h-5" />
                  </button>
                  <div className={activeTab === 'search' ? 'w-9 h-9 md:w-auto flex items-center justify-center md:justify-start shrink-0' : 'flex items-center shrink-0'}>
                    <BrandLogo 
                      size="md" 
                      showText={true} 
                      hideTextOnMobile={activeTab === 'search'} 
                      onClick={() => onTabChange('apps')} 
                    />
                  </div>

                  {/* Desktop Quick Nav Tabs: Games, Apps */}
                  <div className="hidden md:flex items-center gap-1.5 ml-2">
                    <button
                      type="button"
                      onClick={() => onTabChange('games')}
                      className={`px-3.5 py-1.5 rounded-full text-[13px] font-google-sans font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                        activeTab === 'games'
                          ? 'bg-[#c2e7ff] dark:bg-[#004a77] text-[#001d35] dark:text-[#c2e7ff] font-semibold'
                          : 'text-theme-text-muted hover:text-theme-text hover:bg-theme-hover'
                      }`}
                    >
                      <Gamepad2 className="w-4 h-4" />
                      <span>Games</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onTabChange('apps')}
                      className={`px-3.5 py-1.5 rounded-full text-[13px] font-google-sans font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                        activeTab === 'apps'
                          ? 'bg-[#c2e7ff] dark:bg-[#004a77] text-[#001d35] dark:text-[#c2e7ff] font-semibold'
                          : 'text-theme-text-muted hover:text-theme-text hover:bg-theme-hover'
                      }`}
                    >
                      <LayoutGrid className="w-4 h-4" />
                      <span>Apps</span>
                    </button>
                  </div>
                </div>

                {/* Center: Search Bar on Explore tab matching Search page position & size, or flexible spacer on other tabs */}
                {activeTab === 'search' ? (
                  <div className="flex-1 min-w-0 max-w-full md:max-w-[543px] lg:max-w-[643px] -ml-[4px]">
                    <div 
                      onClick={() => onOpenSearch?.(false)}
                      className="w-full min-w-0 flex items-center bg-theme-hover md:bg-theme-bg md:border md:border-theme-border rounded-full h-[46px] px-4 cursor-pointer hover:bg-theme-hover/80 transition-colors overflow-hidden"
                    >
                      <div className="flex items-center min-w-0 flex-1 gap-3">
                        <Search className="w-4.5 h-4.5 text-theme-text-muted shrink-0" />
                        <span className="flex-1 min-w-0 bg-transparent text-theme-text text-[15px] font-normal truncate">Search apps and games</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1"></div>
                )}

                <div className="flex items-center gap-2 shrink-0 -translate-x-[4px]">
                  {activeTab !== 'search' && (
                    <button 
                      onClick={() => onOpenSearch?.(false)} 
                      className="w-9 h-9 flex items-center justify-center text-[#444746] dark:text-theme-text hover:bg-theme-hover rounded-full transition-colors cursor-pointer" 
                      title="Search"
                      aria-label="Search"
                    >
                      <Search className="w-5 h-5" />
                    </button>
                  )}
                  {activeTab !== 'search' && (
                    <div className="relative flex items-center justify-center w-9 h-9">
                      <button 
                        className="w-9 h-9 text-[#444746] dark:text-theme-text hover:bg-theme-hover rounded-full transition-colors flex items-center justify-center cursor-pointer" 
                        onClick={onOpenNotifications}
                        aria-label="Notifications"
                      >
                        <Bell className="w-5 h-5" />
                      </button>
                      {hasUnread && (
                        <div className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-[#b3261e] rounded-full border-2 border-theme-bg flex items-center justify-center shadow-xs pointer-events-none">
                           <span className="text-[9px] font-bold text-white leading-none pb-[0.5px]">{unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <button 
                    type="button"
                    className={`w-8 h-8 rounded-full ${user ? 'bg-blue-600' : 'bg-theme-hover border border-theme-border/60'} flex items-center justify-center overflow-hidden cursor-pointer hover:opacity-90 transition-opacity shadow-xs ${activeTab === 'search' ? '' : 'ml-1'}`}
                    onClick={() => onTabChange('you')}
                    aria-label="Account profile"
                  >
                     {user?.photoURL && user.photoURL.trim() ? (
                       <img 
                         src={user.photoURL} 
                         alt={user.displayName || 'User'} 
                         referrerPolicy="no-referrer" 
                         className="w-full h-full object-cover"
                         onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }} 
                       />
                     ) : user ? (
                       <span className="text-xs font-semibold text-white">
                         {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                       </span>
                     ) : (
                       <User className="w-4.5 h-4.5 text-theme-text-muted" />
                     )}
                  </button>
                </div>
              </header>

              {(activeTab === 'apps' || activeTab === 'games' || activeTab === 'books') && (
                <div className="flex px-2.5 sm:px-4 md:px-6 pt-0 mb-0 w-full bg-theme-bg border-b border-[#e0e2ec]/60 dark:border-white/5 transition-none select-none">
                  <div className="flex w-full justify-start gap-6 sm:gap-8 overflow-x-hidden sm:overflow-x-visible">
                    {homeTabs.map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          onSubTabChange?.(tab);
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                        className={`relative pt-1 pb-3 px-0.5 shrink-0 whitespace-nowrap text-left text-[14px] sm:text-[15px] font-medium transition-none cursor-pointer outline-none focus:outline-none select-none ${
                          activeSubTab === tab 
                            ? 'text-[#0b57d0] dark:text-[#8ab4f8]' 
                            : 'text-[#444746] dark:text-[#9aa0a6] hover:text-[#1f1f1f] dark:hover:text-white'
                        }`}
                      >
                        <span>{tab}</span>
                        <div 
                          className={`absolute bottom-0 left-0 right-0 h-[3px] rounded-t-full transition-none pointer-events-none ${
                            activeSubTab === tab 
                              ? 'bg-[#0b57d0] dark:bg-[#8ab4f8]' 
                              : 'bg-transparent'
                          }`} 
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Dynamic Content Window */}
          <main
            ref={mainRef}
            tabIndex={-1}
            className="flex-1 min-h-0 relative w-full overflow-hidden flex flex-col outline-none focus:outline-none"
          >
            {children}
          </main>

          {!shouldHideBottomNav && (
            <div className="fixed md:static bottom-0 left-0 right-0 z-40 shrink-0 md:hidden">
              <BottomNav activeTab={activeTab} onTabChange={onTabChange} />
            </div>
          )}
        </div>

        {/* Side Menu Drawer Overlay (Floats directly over UI with zero component or layout shifting) */}
        {isDesktopMode && isDrawerOpen && (
          <div 
            className="fixed inset-0 z-50 transition-opacity duration-200 opacity-100 pointer-events-auto"
          >
            {/* Transparent click-away area (No darkening, no layout shifts) */}
            <div 
              className="absolute inset-0 bg-transparent"
              onClick={() => setIsDrawerOpen(false)}
            />

            {/* Slide-out Drawer Panel (No border, smooth GPU-accelerated translate without layout reflow) */}
            <div 
              className={`absolute top-0 bottom-0 left-0 w-[85vw] max-w-[340px] sm:max-w-[360px] h-full bg-theme-bg text-theme-text shadow-2xl flex flex-col z-10 transition-transform duration-250 ease-out overflow-hidden ${
                isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drawer Header & User Account Card */}
              <div className="p-4 sm:p-5 border-b border-theme-border/60 shrink-0">
                <div className="flex items-center justify-between mb-4">
                  <BrandLogo size="sm" />
                  <button 
                    type="button"
                    id="drawer-close-btn"
                    onClick={() => setIsDrawerOpen(false)}
                    className="p-1.5 text-theme-text-muted hover:text-theme-text rounded-full hover:bg-theme-hover transition-colors cursor-pointer"
                    aria-label="Close menu"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* User Account Info */}
                {user ? (
                  <div 
                    onClick={() => {
                      setIsDrawerOpen(false);
                      onTabChange('you');
                    }}
                    className="flex items-center gap-3 p-2 rounded-2xl hover:bg-theme-hover cursor-pointer transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
                      {user.photoURL && user.photoURL.trim() ? (
                        <img 
                          src={user.photoURL} 
                          alt={user.displayName || 'User'} 
                          referrerPolicy="no-referrer" 
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                        />
                      ) : (
                        <span>{(user.displayName || user.email || 'U').charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-sm font-semibold text-theme-text truncate leading-tight">
                          {user.displayName || 'Account'}
                        </h4>
                        {user.isPublisher && (
                          <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] font-medium rounded-full shrink-0">
                            Publisher
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-theme-text-muted truncate mt-0.5">
                        {user.email}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-theme-text-muted shrink-0" />
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5 p-1">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-theme-hover text-theme-text-muted flex items-center justify-center shrink-0">
                        <User className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold text-theme-text leading-tight">Sign in to Store</h4>
                        <p className="text-[11px] text-theme-text-muted mt-0.5 leading-tight">Manage apps, reviews & releases</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        id="drawer-signin-btn"
                        onClick={() => {
                          setIsDrawerOpen(false);
                          openAuthPage();
                        }}
                        className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl font-medium text-xs shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <User className="w-3.5 h-3.5 shrink-0" />
                        <span>Sign in</span>
                      </button>
                      <button
                        type="button"
                        id="drawer-google-signin-btn"
                        title="Sign in with Google"
                        onClick={async () => {
                          try {
                            await loginWithGoogle();
                            showToast('Signed in successfully');
                          } catch {
                            showToast('Sign in failed. Please try again.');
                          }
                        }}
                        className="py-2 px-3 bg-white text-gray-800 hover:bg-gray-50 active:bg-gray-100 rounded-xl font-medium text-xs border border-gray-200 shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                        </svg>
                        <span>Google</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Drawer Scrollable Navigation & Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-hide">
                {/* Main Store Nav */}
                <div>
                  <p className="text-[11px] font-semibold text-theme-text-muted uppercase tracking-wider px-3 mb-1.5">
                    Store Navigation
                  </p>
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        onTabChange('games');
                        setIsDrawerOpen(false);
                      }}
                      className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                        activeTab === 'games'
                          ? 'bg-blue-600/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 font-semibold'
                          : 'text-theme-text hover:bg-theme-hover'
                      }`}
                    >
                      <Gamepad2 className="w-4 h-4" />
                      <span>Games</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onTabChange('apps');
                        setIsDrawerOpen(false);
                      }}
                      className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                        activeTab === 'apps' && activeSubTab === 'For you'
                          ? 'bg-blue-600/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 font-semibold'
                          : 'text-theme-text hover:bg-theme-hover'
                      }`}
                    >
                      <LayoutGrid className="w-4 h-4" />
                      <span>Apps</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onTabChange('apps');
                        onSubTabChange?.('Top charts');
                        setIsDrawerOpen(false);
                      }}
                      className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                        activeTab === 'apps' && activeSubTab === 'Top charts'
                          ? 'bg-blue-600/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400'
                          : 'text-theme-text hover:bg-theme-hover'
                      }`}
                    >
                      <TrendingUp className="w-4 h-4" />
                      <span>Top Charts</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onTabChange('apps');
                        onSubTabChange?.('Categories');
                        setIsDrawerOpen(false);
                      }}
                      className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                        activeTab === 'apps' && activeSubTab === 'Categories'
                          ? 'bg-blue-600/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400'
                          : 'text-theme-text hover:bg-theme-hover'
                      }`}
                    >
                      <Grid className="w-4 h-4" />
                      <span>Categories</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsDrawerOpen(false);
                        onOpenSearch?.(false);
                      }}
                      className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-theme-text hover:bg-theme-hover transition-colors cursor-pointer"
                    >
                      <Search className="w-4 h-4" />
                      <span>Search Apps</span>
                    </button>
                  </div>
                </div>

                {/* Account & Activity */}
                <div>
                  <p className="text-[11px] font-semibold text-theme-text-muted uppercase tracking-wider px-3 mb-1.5">
                    Account & Activity
                  </p>
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsDrawerOpen(false);
                        onOpenNotifications?.();
                      }}
                      className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-theme-text hover:bg-theme-hover transition-colors cursor-pointer"
                    >
                      <Bell className="w-4 h-4" />
                      <span className="flex-1 text-left">Notifications</span>
                      {hasUnread && (
                        <span className="px-1.5 py-0.5 bg-blue-500 text-white text-[10px] font-bold rounded-full">
                          {unreadNotificationsCount}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Settings & Legal */}
                <div>
                  <p className="text-[11px] font-semibold text-theme-text-muted uppercase tracking-wider px-3 mb-1.5">
                    Settings & Legal
                  </p>
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsDrawerOpen(false);
                        openPrivacyPolicy();
                      }}
                      className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-theme-text hover:bg-theme-hover transition-colors cursor-pointer"
                    >
                      <Shield className="w-4 h-4" />
                      <span>Privacy Policy</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsDrawerOpen(false);
                        openTermsOfService();
                      }}
                      className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-theme-text hover:bg-theme-hover transition-colors cursor-pointer"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Terms of Service</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsDrawerOpen(false);
                        openAboutStore();
                      }}
                      className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-theme-text hover:bg-theme-hover transition-colors cursor-pointer"
                    >
                      <Info className="w-4 h-4" />
                      <span>About Prople Store</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsDrawerOpen(false);
                        onTabChange('you');
                        setYouView('help');
                      }}
                      className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-theme-text hover:bg-theme-hover transition-colors cursor-pointer"
                    >
                      <HelpCircle className="w-4 h-4" />
                      <span>Help and feedback</span>
                    </button>
                  </div>
                </div>

                {/* Account Logout if Signed in */}
                {user && (
                  <div className="pt-2 border-t border-theme-border/40">
                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        showToast('Signed out of Prople Store');
                        setIsDrawerOpen(false);
                      }}
                      className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-theme-border/60 bg-theme-hover/20 text-center shrink-0">
                <p className="text-xs font-semibold text-theme-text">Prople Store</p>
                <p className="text-[10px] text-theme-text-muted mt-0.5">Operated by Cloaktail Industries</p>
              </div>
            </div>
          </div>
        )}

        {/* Overlay Modals triggered from Drawer */}
        {showPrivacy && (
          <PrivacyPolicyPage onBack={() => setShowPrivacy(false)} />
        )}
        {showTerms && (
          <TermsPage onBack={() => setShowTerms(false)} />
        )}

        {/* PWA Offline Connectivity Banner */}
        <OfflineIndicator />
      </div>
    </ScrollContext.Provider>
  );
}

