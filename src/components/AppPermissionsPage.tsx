/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { 
  ArrowLeft, 
  KeyRound, 
  MoreVertical,
  Mic
} from 'lucide-react';
import { AppDetails } from '../types';
import { usePreserveScroll } from '../services/scrollManager';
import { extractPermissionGroups } from '../utils/permissionUtils';
import { getPlayStorePermissionIcon } from './PlayStorePermissionIcons';
import { useToast } from '../context/ToastContext';
import { useNavigation } from '../context/NavigationContext';
import { FlagAppModal } from './FlagAppModal';
import { AdminModerationService } from '../services/adminModerationService';

interface AppPermissionsPageProps {
  app: AppDetails;
  onBack: () => void;
}

export default function AppPermissionsPage({ app, onBack }: AppPermissionsPageProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  usePreserveScroll(`app-permissions-${app.id}`, scrollRef);

  const [showMenu, setShowMenu] = useState(false);
  const [isFlagModalOpen, setIsFlagModalOpen] = useState(false);
  const [micPermissionState, setMicPermissionState] = useState<'idle' | 'prompting' | 'granted' | 'denied'>('idle');

  const { showToast } = useToast();
  const { openHowItWorks } = useNavigation();

  const handleAskMicPermission = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showToast('Microphone access is not supported by this browser.');
      return;
    }
    setMicPermissionState('prompting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicPermissionState('granted');
      showToast('Microphone permission granted for Prople Store.');
    } catch (err: any) {
      console.warn('Microphone permission request error:', err);
      setMicPermissionState('denied');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        showToast('Microphone permission was denied. Please allow microphone access in your browser settings.');
      } else {
        showToast('Could not access microphone: ' + (err.message || 'Unknown error'));
      }
    }
  };

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

  const groups = extractPermissionGroups(app);

  const renderCategoryIcon = (id: string) => {
    return getPlayStorePermissionIcon(id, "w-6 h-6 text-neutral-400 dark:text-neutral-300 shrink-0");
  };

  const versionText = app.versionName || app.version || '';

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-theme-bg text-theme-text font-sans w-full shadow-none overflow-hidden selection:bg-blue-500/30">
      {/* Top Header: Back arrow, App title & subtitle. App logo removed per design. */}
      <header className="relative w-full h-[60px] sm:h-[68px] shrink-0 bg-theme-bg border-0 z-20">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-2.5 sm:px-4 md:px-6 lg:px-8 gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 -translate-x-[2px]">
            <button 
              type="button"
              id="permissions-back-button"
              onClick={onBack} 
              className="w-10 h-10 -ml-1 text-theme-text hover:bg-theme-hover active:bg-theme-hover/80 rounded-full transition-colors shrink-0 cursor-pointer flex items-center justify-center"
              aria-label="Back"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>

            <div className="min-w-0 flex-1">
              <h1 className="text-[16px] sm:text-[17px] font-medium text-theme-text truncate leading-tight font-google-sans">
                {app.name}
              </h1>
              <p className="text-[12px] sm:text-[13px] text-theme-text-muted leading-tight mt-0.5 font-normal truncate">
                App permissions
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Scrollable Content Area */}
      <div 
        ref={scrollRef}
        tabIndex={0}
        className="flex-1 overflow-y-auto overflow-x-hidden w-full outline-none focus:outline-none overscroll-y-contain relative scrollbar-hide"
        style={{
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
        }}
      >
        <main className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 pt-4 pb-20 space-y-8">
          <div className="lg:grid lg:grid-cols-12 lg:gap-12 items-start">
            <div className="lg:col-span-8 flex flex-col min-w-0 space-y-6">
              {/* Subheading: "Version x.x.x may request access to" */}
              <div className="text-[14px] sm:text-[15px] text-theme-text font-normal">
                {versionText ? `Version ${versionText} may request access to` : `${app.name} may request access to`}
              </div>

              {/* Grouped Permissions List */}
              {groups.length > 0 ? (
                <div className="space-y-6 pt-1">
                  {groups.map((group) => (
                    <div key={group.id} className="flex items-start gap-4">
                      <div className="mt-0.5 shrink-0">
                        {renderCategoryIcon(group.id)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <h2 className="text-[15px] sm:text-[16px] font-medium text-theme-text font-google-sans leading-snug">
                            {group.name}
                          </h2>
                          {group.id === 'microphone' && (
                            <button
                              type="button"
                              onClick={handleAskMicPermission}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-600/10 hover:bg-blue-600/20 text-blue-500 dark:text-[#8ab4f8] text-xs font-medium transition-colors cursor-pointer border border-blue-500/20"
                            >
                              <Mic className="w-3.5 h-3.5" />
                              <span>{micPermissionState === 'granted' ? 'Mic Granted ✓' : 'Ask mic permission'}</span>
                            </button>
                          )}
                        </div>
                        <ul className="mt-1 space-y-1">
                          {group.items.map((point, pIdx) => {
                            const cleanPoint = point.replace(new RegExp(`^${group.name}\\s*[:-]\\s*`, 'i'), '').trim() || point;
                            return (
                              <li 
                                key={pIdx} 
                                className="text-[13px] sm:text-[14px] text-theme-text-muted leading-relaxed flex items-start gap-2"
                              >
                                <span className="select-none text-theme-text-muted leading-relaxed">•</span>
                                <span className="flex-1 break-words">{cleanPoint}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center space-y-3">
                  <div className="w-14 h-14 rounded-full bg-neutral-800/40 dark:bg-white/5 text-neutral-400 dark:text-neutral-400 flex items-center justify-center mx-auto">
                    <KeyRound className="w-6 h-6 text-neutral-400 dark:text-neutral-400" strokeWidth={1.75} />
                  </div>
                  <h3 className="text-base font-medium text-theme-text font-google-sans">
                    No special permissions requested
                  </h3>
                  <p className="text-xs sm:text-sm text-theme-text-muted max-w-sm mx-auto leading-relaxed">
                    This application operates within standard sandbox constraints and does not request sensitive system or hardware access.
                  </p>
                </div>
              )}

              {/* Play Store Standard Disclaimer & Learn More */}
              <div className="pt-8 border-t border-theme-border/40 space-y-3">
                <p className="text-[13px] sm:text-[14px] text-theme-text-muted leading-relaxed">
                  You can disable access for these permissions in Settings. Updates to {app.name} may automatically add additional capabilities within each group.
                </p>
                <div className="flex items-center gap-4 flex-wrap">
                  <button
                    type="button"
                    onClick={openHowItWorks}
                    className="text-[13px] sm:text-[14px] text-blue-500 dark:text-[#8ab4f8] hover:underline font-medium cursor-pointer"
                  >
                    Learn more
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Flag App Modal */}
      {isFlagModalOpen && (
        <FlagAppModal
          isOpen={isFlagModalOpen}
          onClose={() => setIsFlagModalOpen(false)}
          onConfirmFlag={handleConfirmFlag}
        />
      )}
    </div>
  );
}
