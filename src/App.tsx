/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import MarketplaceShell from './components/Layout';
import HomePage from './components/HomePage';
import ExplorePage from './components/ExplorePage';
import ActiveSearchPage from './components/ActiveSearchPage';
import NotificationsPage from './components/NotificationsPage';
import AppDetailPage from './components/AppDetailPage';
import SimilarAppsPage from './components/SimilarAppsPage';
import WishlistPage from './components/WishlistPage';
import SearchResultsPage from './components/SearchResultsPage';
import YouPage from './components/YouPage';
import PrivacyPolicyPage from './components/PrivacyPolicyPage';
import TermsPage from './components/TermsPage';
import DataSafetyPage from './components/DataSafetyPage';
import AppsSecurityPage from './components/AppsSecurityPage';
import AboutStorePage from './components/AboutStorePage';
import AntiPiracyPolicyPage from './components/AntiPiracyPolicyPage';
import UserConsentPolicyPage from './components/UserConsentPolicyPage';
import HowItWorksPage from './components/HowItWorksPage';
import AuthPage from './components/AuthPage';
import { DeveloperDonationModal } from './components/DeveloperDonationModal';
import { RecommendationService } from './services/recommendationService';
import { useNavigation } from './context/NavigationContext';
import { useStoreConfig } from './context/StoreConfigContext';
import { usePreserveScroll } from './services/scrollManager';
import { useBookmarks } from './services/bookmarkService';

export default function App() {
  const { allAppListings, apps } = useStoreConfig();
  const { bookmarkedIds } = useBookmarks();
  const {
    activeTab,
    activeSubTab,
    overlay,
    activeAppDetailsId,
    searchQuery,
    startWithVoice,
    goBack,
    changeTab,
    changeSubTab,
    openSearch,
    performSearch,
    openNotifications,
    openSimilarApps,
    openRecommendedApps,
    openMustTryApps,
    openLatestReleases,
    openTopRatedApps,
    openPublisherConsole,
    activePublisherName,
    openAppDetail,
    openAppReviews,
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
    previewPopup,
    setPreviewPopup,
    showActivePopupUI,
    setShowActivePopupUI,
    resetPopupTriggers,
    youView,
    setYouView,
    authMode,
    resetToHome,
    canGoBack,
    historyDepth,
  } = useNavigation();

  // Global event listener to open Developer Console & publishing flow
  React.useEffect(() => {
    const handleOpenConsoleEvent = () => {
      changeTab('you');
      setYouView('studio');
    };
    window.addEventListener('prople:open:console', handleOpenConsoleEvent);
    return () => window.removeEventListener('prople:open:console', handleOpenConsoleEvent);
  }, [changeTab, setYouView]);

  const isWishlistInYou = activeTab === 'you' && (youView === 'wishlist' || youView === 'bookmarked-apps');
  const isSubViewInYou = activeTab === 'you' && Boolean(youView && youView !== 'main');

  // Dedicated, isolated scroll containers for main tabs
  const exploreScrollRef = useRef<HTMLDivElement | null>(null);
  const youScrollRef = useRef<HTMLDivElement | null>(null);
  usePreserveScroll('tab-search', exploreScrollRef, activeTab === 'search');
  usePreserveScroll('tab-you', youScrollRef, activeTab === 'you');

  const renderOverlay = () => {
    if (overlay === 'search-results') {
      return (
        <SearchResultsPage 
          query={searchQuery} 
          onBack={goBack} 
          onOpenSearch={(startVoice?: boolean) => {
            openSearch(Boolean(startVoice));
          }}
          onAppClick={(id) => { 
            openAppDetail(id); 
          }}
          onSearchQuery={(q) => {
            performSearch(q);
          }}
          activeTab={activeTab}
          onTabChange={(t) => changeTab(t as any)}
        />
      );
    }

    if (overlay === 'similar-apps') {
      const similar = RecommendationService.getSimilarApps(activeAppDetailsId, allAppListings, 50, apps);
      const activeApp = activeAppDetailsId ? (apps[activeAppDetailsId] || allAppListings.find(a => a.id === activeAppDetailsId)) : undefined;
      return (
        <SimilarAppsPage 
          appsList={similar.length > 0 ? similar : allAppListings}
          title={activeApp ? `Similar to ${activeApp.name}` : "Similar apps"}
          onBack={goBack} 
          onAppClick={(id) => { 
            openAppDetail(id); 
          }} 
        />
      );
    }

    if (overlay === 'recommended-apps') {
      const recommended = RecommendationService.getPersonalizedRecommendations(undefined, 50, allAppListings);
      return (
        <SimilarAppsPage 
          appsList={recommended.length > 0 ? recommended : allAppListings} 
          title="Recommended for you" 
          onBack={goBack} 
          onAppClick={(id) => { 
            openAppDetail(id); 
          }} 
        />
      );
    }

    if (overlay === 'must-try-apps') {
      const webapps = RecommendationService.getRelatedWebApps(50, allAppListings);
      return (
        <SimilarAppsPage 
          appsList={webapps.length > 0 ? webapps : allAppListings} 
          title="Must-try Apps" 
          onBack={goBack} 
          onAppClick={(id) => { 
            openAppDetail(id); 
          }} 
        />
      );
    }

    if (overlay === 'latest-releases') {
      const latest = [...allAppListings].sort((a, b) => {
        const detailsA = apps[a.id];
        const detailsB = apps[b.id];
        const aHas = !!(detailsA?.releaseNotes || detailsA?.releaseTag || detailsA?.versionName || a.featuredTitle);
        const bHas = !!(detailsB?.releaseNotes || detailsB?.releaseTag || detailsB?.versionName || b.featuredTitle);
        if (aHas && !bHas) return -1;
        if (!aHas && bHas) return 1;
        return 0;
      });
      return (
        <SimilarAppsPage 
          appsList={latest.length > 0 ? latest : allAppListings} 
          title="Latest releases" 
          onBack={goBack} 
          onAppClick={(id) => { 
            openAppDetail(id); 
          }} 
        />
      );
    }

    if (overlay === 'top-rated-apps') {
      const topRated = allAppListings
        .filter(a => {
          const fullApp = apps[a.id];
          const r = a.rating ?? fullApp?.rating ?? 0;
          return r >= 4.0;
        })
        .sort((a, b) => {
          const fullA = apps[a.id];
          const fullB = apps[b.id];
          const rA = a.rating ?? fullA?.rating ?? 0;
          const rB = b.rating ?? fullB?.rating ?? 0;
          if (rB !== rA) return rB - rA;
          return (fullB?.downloadsCount || 0) - (fullA?.downloadsCount || 0);
        });
      return (
        <SimilarAppsPage 
          appsList={topRated.length > 0 ? topRated : allAppListings} 
          title="Top Rated Apps & Games" 
          onBack={goBack} 
          onAppClick={(id) => { 
            openAppDetail(id); 
          }} 
        />
      );
    }

    if (overlay === 'bookmarked-apps' || overlay === 'wishlist') {
      const wishlistApps = bookmarkedIds
        .map((id) => allAppListings.find((app) => app.id === id))
        .filter((app): app is (typeof allAppListings)[0] => Boolean(app));
      return (
        <WishlistPage 
          appsList={wishlistApps} 
          title="Wishlist" 
          onBack={goBack} 
          onAppClick={(id) => { 
            openAppDetail(id); 
          }} 
        />
      );
    }

    if (overlay === 'search') {
      return (
        <ActiveSearchPage 
          initialQuery={searchQuery}
          autoStartVoice={startWithVoice}
          onClose={goBack} 
          onSearch={(q) => { 
            performSearch(q); 
          }} 
        />
      );
    }
    
    if (overlay === 'notifications') {
      return (
        <NotificationsPage 
          onClose={goBack} 
          onAppClick={(id) => {
            openAppDetail(id);
          }}
          onNavigate={(dest) => {
            if (dest === 'manage-apps' || dest === 'console') {
              changeTab('you');
            } else if (dest === 'dev-donation' || dest === 'donation') {
              setPreviewPopup('dev-donation');
            }
          }}
        />
      );
    }

    if (overlay === 'privacy' || overlay === 'data-deletion') {
      return (
        <PrivacyPolicyPage 
          onBack={goBack} 
          onOpenTerms={openTermsOfService}
          onOpenAbout={openAboutStore}
          onOpenSecurity={openAppsSecurity}
          onOpenAntiPiracy={openAntiPiracy}
          onOpenHowItWorks={openHowItWorks}
          onOpenUserConsent={openUserConsentPolicy}
        />
      );
    }

    if (overlay === 'terms') {
      return (
        <TermsPage 
          onBack={goBack} 
          onOpenPrivacy={openPrivacyPolicy}
          onOpenAbout={openAboutStore}
          onOpenSecurity={openAppsSecurity}
          onOpenAntiPiracy={openAntiPiracy}
          onOpenHowItWorks={openHowItWorks}
          onOpenUserConsent={openUserConsentPolicy}
        />
      );
    }

    if (overlay === 'anti-piracy') {
      return (
        <AntiPiracyPolicyPage 
          onBack={goBack} 
          onOpenPrivacy={openPrivacyPolicy}
          onOpenTerms={openTermsOfService}
          onOpenSecurity={openAppsSecurity}
          onOpenHowItWorks={openHowItWorks}
          onOpenUserConsent={openUserConsentPolicy}
          onOpenAbout={openAboutStore}
        />
      );
    }

    if (overlay === 'user-consent') {
      return (
        <UserConsentPolicyPage 
          onBack={goBack} 
          onOpenPrivacy={openPrivacyPolicy}
          onOpenTerms={openTermsOfService}
          onOpenSecurity={openAppsSecurity}
          onOpenAntiPiracy={openAntiPiracy}
          onOpenHowItWorks={openHowItWorks}
          onOpenAbout={openAboutStore}
        />
      );
    }

    if (overlay === 'data-safety') {
      return (
        <DataSafetyPage 
          onBack={goBack} 
        />
      );
    }

    if (overlay === 'security') {
      return (
        <AppsSecurityPage 
          onBack={goBack} 
          onOpenPrivacy={openPrivacyPolicy}
          onOpenTerms={openTermsOfService}
          onOpenDataSafety={openDataSafety}
        />
      );
    }

    if (overlay === 'about') {
      return (
        <AboutStorePage 
          onBack={goBack} 
          onOpenPrivacy={openPrivacyPolicy}
          onOpenTerms={openTermsOfService}
          onOpenSecurity={openAppsSecurity}
          onOpenAntiPiracy={openAntiPiracy}
          onOpenUserConsent={openUserConsentPolicy}
        />
      );
    }

    if (overlay === 'how-it-works') {
      return (
        <HowItWorksPage 
          onBack={goBack} 
          onNavigateHome={resetToHome}
          onOpenConsole={() => openPublisherConsole('')}
          onOpenSecurity={openAppsSecurity}
          onOpenPrivacy={openPrivacyPolicy}
          onOpenTerms={openTermsOfService}
          onOpenAntiPiracy={openAntiPiracy}
          onOpenUserConsent={openUserConsentPolicy}
        />
      );
    }

    if (overlay === 'auth') {
      return (
        <AuthPage 
          initialMode={authMode || 'signin'}
          onClose={goBack}
          onSuccess={() => {
            if (canGoBack && historyDepth > 1) {
              goBack();
            } else {
              resetToHome();
            }
          }}
        />
      );
    }

    if (activeAppDetailsId) {
      return (
        <AppDetailPage 
          key={activeAppDetailsId}
          appId={activeAppDetailsId} 
          onBack={goBack} 
          onShowSimilarApps={openSimilarApps} 
          onOpenSearch={() => openSearch(false)} 
          onOrgClick={(orgName) => {
            const cleanOrg = (orgName || '').trim();
            performSearch(`pub:${cleanOrg}`);
          }}
          onAppClick={openAppDetail}
        />
      );
    }

    return null;
  };

  return (
    <>
      <MarketplaceShell 
        activeTab={activeTab} 
        onTabChange={(t) => changeTab(t as any)} 
        activeSubTab={activeSubTab}
        onSubTabChange={changeSubTab}
        hideHeader={Boolean(isSubViewInYou || overlay !== 'none' || activeAppDetailsId)}
        hideBottomNav={Boolean(isSubViewInYou || overlay !== 'none' || activeAppDetailsId)}
        onOpenSearch={(startVoice?: unknown) => {
          openSearch(startVoice === true);
        }}
        onOpenNotifications={openNotifications}
        onOpenAppDetail={openAppDetail}
      >
        {/* Tab 0: Games (Games Feed with exact same home layout & shuffled algorithm) */}
        <div 
          data-tab-scroll="games"
          className={`flex-1 h-full min-h-0 relative w-full overflow-hidden flex flex-col ${
            activeTab === 'games' ? 'flex' : 'hidden'
          }`}
        >
          <HomePage 
            activeCategory="games"
            activeSubTab={activeSubTab} 
            onSubTabChange={changeSubTab}
            onAppClick={openAppDetail} 
            onShowSimilarApps={openSimilarApps} 
            onShowRecommendedApps={openRecommendedApps} 
            onShowMustTryApps={openMustTryApps} 
            onShowTopRatedApps={openTopRatedApps}
            onSearchQuery={(q) => {
              performSearch(q);
            }}
          />
        </div>

        {/* Tab 1: Apps (Home Feed with sub-tabs) */}
        <div 
          data-tab-scroll="apps"
          className={`flex-1 h-full min-h-0 relative w-full overflow-hidden flex flex-col ${
            activeTab === 'apps' ? 'flex' : 'hidden'
          }`}
        >
          <HomePage 
            activeCategory="apps" 
            activeSubTab={activeSubTab} 
            onSubTabChange={changeSubTab}
            onAppClick={openAppDetail} 
            onShowSimilarApps={openSimilarApps} 
            onShowRecommendedApps={openRecommendedApps} 
            onShowMustTryApps={openMustTryApps} 
            onShowTopRatedApps={openTopRatedApps}
            onSearchQuery={(q) => {
              performSearch(q);
            }}
          />
        </div>

        {/* Tab 2: Search (Explore Feed with isolated scroll) */}
        <div 
          ref={exploreScrollRef}
          data-tab-scroll="search"
          className={`flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden w-full relative outline-none overscroll-y-contain ${
            activeTab === 'search' ? 'flex flex-col' : 'hidden'
          }`}
          style={{
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
          }}
        >
          <div className="min-h-full pb-[calc(68px+env(safe-area-inset-bottom,12px))] md:pb-4 w-full">
            <ExplorePage
              onOpenSearch={() => openSearch(false)}
              onSearchQuery={(q) => {
                performSearch(q);
              }}
              onAppClick={openAppDetail}
              onShowLatestReleases={openLatestReleases}
              onCategoryClick={(catName) => {
                if (catName === 'All categories') {
                  performSearch('');
                } else {
                  performSearch(catName);
                }
              }}
            />
          </div>
        </div>

        {/* Tab 3: You (Profile & Management with isolated scroll) */}
        <div 
          ref={youScrollRef}
          data-tab-scroll="you"
          className={`flex-1 h-full min-h-0 ${isSubViewInYou ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden'} w-full relative outline-none overscroll-y-contain ${
            activeTab === 'you' ? 'flex flex-col' : 'hidden'
          }`}
          style={{
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
          }}
        >
          <div className={`${isSubViewInYou ? 'h-full flex flex-col' : 'min-h-full pb-[calc(68px+env(safe-area-inset-bottom,12px))] md:pb-4'} w-full`}>
            <YouPage 
              onAppClick={openAppDetail} 
              onOpenNotifications={openNotifications}
            />
          </div>
        </div>

        {/* Tab 4: Books (Books & Reference Feed) */}
        <div 
          data-tab-scroll="books"
          className={`flex-1 h-full min-h-0 relative w-full overflow-hidden flex flex-col ${
            activeTab === 'books' ? 'flex' : 'hidden'
          }`}
        >
          <HomePage 
            activeCategory="books"
            activeSubTab={activeSubTab} 
            onSubTabChange={changeSubTab}
            onAppClick={openAppDetail} 
            onShowSimilarApps={openSimilarApps} 
            onShowRecommendedApps={openRecommendedApps} 
            onShowMustTryApps={openMustTryApps} 
            onShowTopRatedApps={openTopRatedApps}
            onSearchQuery={(q) => {
              performSearch(q);
            }}
          />
        </div>
      </MarketplaceShell>

      {/* Top Overlay Layer - Keeps MarketplaceShell and tab scroll states intact */}
      {renderOverlay()}

      {/* Developer Donation UPI QR Modal */}
      <DeveloperDonationModal
        isOpen={previewPopup === 'dev-donation'}
        onClose={() => setPreviewPopup(null)}
      />
    </>
  );
}
