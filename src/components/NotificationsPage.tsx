import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ArrowLeft, Bell, ExternalLink, ArrowRight, ShieldCheck, MoreVertical, CheckCheck, Download, Star, MessageSquare, RefreshCw, Sparkles, Heart } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'motion/react';
import { useInstall } from '../context/InstallContext';
import { useStoreConfig } from '../context/StoreConfigContext';
import { NotificationItem } from '../types';
import { usePreserveScroll } from '../services/scrollManager';
import { sanitizeExternalUrl } from '../utils/securityUtils';
import { requestPhoneNotificationPermission } from '../services/firestoreNotificationService';
import GlobalNoticeDetailModal from './GlobalNoticeDetailModal';

interface NotificationsPageProps {
  onClose: () => void;
  onAppClick?: (appId: string) => void;
  onNavigate?: (view: string) => void;
}

interface NotificationRowProps {
  key?: React.Key;
  notif: NotificationItem;
  onDismiss: (id: string) => void;
  onClick: (notif: NotificationItem) => void;
}

// Helper to reduce verbose caption message down to essential, concise details
function getReducedCaptionMessage(message?: string): string {
  if (!message) return '';
  const text = message.trim();

  // Download verification boilerplate:
  // "+1 verified download recorded for Retro Bricks Stacks. Total downloads: 14..." -> "Retro Bricks Stacks"
  if (/verified download recorded for/i.test(text)) {
    const parts = text.split(/verified download recorded for\s*/i);
    if (parts[1]) {
      return parts[1].split('.')[0].trim();
    }
  }

  // Prepared/activated:
  // "Lumina Reader has been prepared and activated for direct download." -> "Ready to install"
  if (/prepared and activated/i.test(text)) {
    return 'Ready to install';
  }

  // Downloaded and verified on device:
  if (/has been downloaded and verified on your device/i.test(text)) {
    return 'Downloaded & verified';
  }

  // Milestone:
  // "Congratulations! "Retro Bricks Stacks" has officially reached 25 downloads." -> "Reached 25 downloads"
  if (/officially reached|milestone/i.test(text)) {
    const match = text.match(/reached\s+([0-9,]+(?:\s+downloads)?)/i);
    if (match) {
      return `Reached ${match[1]}`;
    }
  }

  // Strip greetings & congratulations boilerplate
  let cleaned = text.replace(/^congratulations!?:?\s*/i, '');
  cleaned = cleaned.replace(/^(hello|hi|dear developer),?\s*/i, '');

  if (cleaned.length > 42) {
    return cleaned.substring(0, 40).trim() + '...';
  }

  return cleaned;
}

function NotificationRow({ notif, onDismiss, onClick }: NotificationRowProps) {
  const { allAppListings, apps } = useStoreConfig();
  const matchedApp = notif.appId 
    ? (apps[notif.appId] || allAppListings.find(a => a.id === notif.appId))
    : allAppListings.find(a => 
        (a.name && notif.title?.toLowerCase().includes(a.name.toLowerCase())) ||
        (a.name && notif.message?.toLowerCase().includes(a.name.toLowerCase()))
      );
  const rawIcon = matchedApp?.iconUrl || notif.iconUrl;
  const resolvedIcon = typeof rawIcon === 'string' && rawIcon.trim().length > 0 ? rawIcon.trim() : null;
  const hasAppTarget = Boolean(notif.appId || matchedApp?.id);

  const x = useMotionValue(0);
  const [isDismissing, setIsDismissing] = useState(false);
  const isDraggingRef = useRef(false);
  const hasTriggeredDismissRef = useRef(false);
  const isUnread = notif.isUnread !== false;
  const reducedCaption = getReducedCaptionMessage(notif.message);

  // Linear opacity fade as card is dragged across the screen
  const opacity = useTransform(x, [-180, -70, 0, 70, 180], [0.15, 0.75, 1, 0.75, 0.15]);

  const handleDragEnd = (_: any, info: { offset: { x: number }; velocity: { x: number } }) => {
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 50);

    const swipeThreshold = 70;
    const velocityThreshold = 250;
    const currentOffset = info.offset.x;
    const currentVelocity = info.velocity.x;
    const shouldDismiss = Math.abs(currentOffset) > swipeThreshold || Math.abs(currentVelocity) > velocityThreshold;

    if (shouldDismiss && !hasTriggeredDismissRef.current) {
      hasTriggeredDismissRef.current = true;
      setIsDismissing(true);
      const direction = (currentOffset !== 0 ? currentOffset : currentVelocity) < 0 ? -1 : 1;
      const targetX = direction * (window.innerWidth || 500);

      // Smooth fling out animation, then trigger onDismiss once
      animate(x, targetX, {
        duration: 0.14,
        ease: [0.2, 0.8, 0.2, 1],
        onComplete: () => {
          onDismiss(notif.id);
        }
      });
    }
  };

  const isUpdate = notif.category === 'app_update' || notif.title?.toLowerCase().includes('update');
  const isRelease = notif.category === 'new_release' || notif.title?.toLowerCase().includes('new release');
  const isDonation = notif.category === 'donation' || notif.actionType === 'dev-donation' || notif.actionType === 'donation' || notif.title?.toLowerCase().includes('donation') || notif.title?.toLowerCase().includes('milestone');

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1, height: 'auto' }}
      exit={{
        opacity: 0,
        height: 0,
        marginTop: 0,
        marginBottom: 0,
        paddingTop: 0,
        paddingBottom: 0,
        scale: 0.96,
        transition: {
          opacity: { duration: 0.15, ease: 'easeOut' },
          height: { duration: 0.22, ease: [0.25, 1, 0.5, 1], delay: 0.04 },
          marginTop: { duration: 0.22, ease: [0.25, 1, 0.5, 1], delay: 0.04 },
          marginBottom: { duration: 0.22, ease: [0.25, 1, 0.5, 1], delay: 0.04 },
          scale: { duration: 0.15, ease: 'easeOut' }
        }
      }}
      transition={{
        layout: { type: 'spring', damping: 28, stiffness: 500, mass: 0.5 }
      }}
      className="relative overflow-hidden select-none w-full"
    >
      {/* Draggable Notification Row with 1:1 linear movement matching console row style */}
      <motion.div
        style={{ x, opacity }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={1}
        dragTransition={{ bounceStiffness: 600, bounceDamping: 35 }}
        onDragStart={() => {
          isDraggingRef.current = true;
        }}
        onDragEnd={handleDragEnd}
        onClick={() => {
          if (!isDraggingRef.current && !hasTriggeredDismissRef.current && !isDismissing && Math.abs(x.get()) < 8) {
            onClick(notif);
          }
        }}
        className="w-full flex items-center justify-between gap-3 py-2 sm:py-2.5 rounded-xl cursor-pointer select-none bg-transparent group relative outline-none transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Notification App Logo - exactly same size as console page (w-14 h-14 sm:w-16 sm:h-16 rounded-2xl) */}
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden shrink-0 bg-theme-hover shadow-xs flex items-center justify-center">
            {resolvedIcon ? (
              <img src={resolvedIcon} alt="" className="w-full h-full object-cover" />
            ) : matchedApp?.name ? (
              <span className="text-xl font-bold text-blue-500">
                {matchedApp.name.charAt(0).toUpperCase()}
              </span>
            ) : isDonation ? (
              <Heart className="w-7 h-7 text-pink-500 fill-pink-500/20" />
            ) : isUpdate ? (
              <RefreshCw className="w-7 h-7 text-emerald-500" />
            ) : isRelease ? (
              <Sparkles className="w-7 h-7 text-blue-500" />
            ) : notif.actionType === 'security_check' ? (
              <ShieldCheck className="w-7 h-7 text-emerald-400" />
            ) : (
              <Bell className="w-7 h-7 text-blue-400" />
            )}
          </div>

          {/* Clean Notification Details with restored timestamp and reduced caption message */}
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <h4 className="text-theme-text text-[14px] sm:text-[15px] font-medium leading-tight truncate group-hover:text-blue-500 transition-colors">
                  {notif.title}
                </h4>
                {isUnread && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 inline-block shadow-xs" title="New" />
                )}
              </div>
              {notif.timestamp && (
                <span className="text-[11px] text-theme-text-muted shrink-0 whitespace-nowrap ml-1">
                  {notif.timestamp}
                </span>
              )}
            </div>

            {reducedCaption && (
              <p className="text-theme-text-muted text-xs truncate leading-tight">
                {reducedCaption}
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function NotificationsPage({ onClose, onAppClick, onNavigate }: NotificationsPageProps) {
  const { 
    notifications, 
    markNotificationAsRead, 
    markAllNotificationsAsRead,
    clearNotification,
    clearAllNotifications
  } = useInstall();
  const { allAppListings } = useStoreConfig();

  const [showMenu, setShowMenu] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<NotificationItem | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const notifScrollRef = useRef<HTMLDivElement | null>(null);
  usePreserveScroll('notifications-page', notifScrollRef);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      requestPhoneNotificationPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!showMenu) return;

    const handleOutsideInteraction = (e: MouseEvent | TouchEvent | PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('pointerdown', handleOutsideInteraction, true);
    document.addEventListener('touchstart', handleOutsideInteraction, true);
    document.addEventListener('mousedown', handleOutsideInteraction, true);

    return () => {
      document.removeEventListener('pointerdown', handleOutsideInteraction, true);
      document.removeEventListener('touchstart', handleOutsideInteraction, true);
      document.removeEventListener('mousedown', handleOutsideInteraction, true);
    };
  }, [showMenu]);

  const handleNotificationClick = (notif: NotificationItem) => {
    markNotificationAsRead(notif.id);

    // Resolve target app ID from notification or matching by title/message
    let targetAppId = notif.appId;
    if (!targetAppId && allAppListings && allAppListings.length > 0) {
      const match = allAppListings.find(a => 
        (a.name && notif.title?.toLowerCase().includes(a.name.toLowerCase())) ||
        (a.name && notif.message?.toLowerCase().includes(a.name.toLowerCase()))
      );
      if (match) {
        targetAppId = match.id;
      }
    }

    if (targetAppId && onAppClick) {
      onAppClick(targetAppId);
      // DO NOT call onClose() here: onAppClick sets activeAppDetailsId, which renders AppDetailPage.
      // Calling onClose() triggers goBack(), which cancels navigation and pops history.
      return;
    }

    if (notif.actionType === 'dev-donation' || notif.actionType === 'donation' || notif.category === 'donation') {
      if (onNavigate) {
        onNavigate('dev-donation');
      }
      onClose();
      return;
    }

    if (notif.actionType === 'console' && onNavigate) {
      onNavigate('console');
      onClose();
      return;
    }

    if (notif.actionUrl) {
      const safeActionUrl = sanitizeExternalUrl(notif.actionUrl);
      if (safeActionUrl) {
        try {
          const newWindow = window.open(safeActionUrl, '_blank', 'noopener,noreferrer');
          if (!newWindow) {
            const link = document.createElement('a');
            link.href = safeActionUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.click();
          }
        } catch {
          const link = document.createElement('a');
          link.href = safeActionUrl;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.click();
        }
      }
      return;
    }

    // Notice/announcement with full details
    setSelectedNotice(notif);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-theme-bg text-theme-text font-sans w-full shadow-none overflow-hidden select-none">
      {/* Top Header - Aligned with App Detail Page Header */}
      <header className="h-[60px] sm:h-[68px] flex items-center bg-theme-bg shrink-0 z-20 w-full border-0">
        <div className="w-full max-w-7xl mx-auto h-full flex items-center justify-between px-2.5 sm:px-4 md:px-6 gap-3">
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 -translate-x-[2px]">
            <button 
              type="button"
              id="notifications-back-btn"
              onClick={onClose}
              className="w-9 h-9 -ml-1 text-theme-text hover:bg-theme-hover active:bg-theme-hover/80 rounded-full transition-colors shrink-0 cursor-pointer flex items-center justify-center"
              aria-label="Back"
            >
              <ArrowLeft className="w-6 h-6 text-theme-text" />
            </button>
            <h1 className="text-[17px] sm:text-[19px] font-medium tracking-tight text-theme-text font-google-sans truncate">
              Notifications &amp; updates
            </h1>
          </div>
        </div>
      </header>

      {/* Notifications Content Stream - Matching Developer Console Layout */}
      <div 
        ref={notifScrollRef} 
        className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 sm:px-4 md:px-6 lg:px-8 pt-2 sm:pt-3 pb-8 scrollbar-hide flex flex-col min-h-0 w-full max-w-7xl mx-auto"
      >
        <div className="w-full flex flex-col space-y-1">
          <AnimatePresence mode="popLayout" initial={false}>
            {notifications.map((notif) => (
              <NotificationRow
                key={notif.id}
                notif={notif}
                onDismiss={clearNotification}
                onClick={handleNotificationClick}
              />
            ))}
          </AnimatePresence>
        </div>

        <AnimatePresence initial={false}>
          {notifications.length === 0 && (
            <motion.div
              key="empty-notifs-state"
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
              className="py-14 px-6 text-center flex flex-col items-center justify-center w-full"
            >
              <div className="w-14 h-14 rounded-2xl bg-theme-hover border border-theme-border flex items-center justify-center text-theme-text-muted mb-3 opacity-80">
                <Bell className="w-7 h-7 stroke-[1.5]" />
              </div>
              <p className="text-base font-semibold text-theme-text">No notifications yet</p>
              <p className="text-xs text-theme-text-muted mt-1 max-w-xs leading-relaxed">
                When you install apps or publish updates, real-time activity and security notifications will appear here.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Straight Corner Global Notice Detail Modal */}
      <GlobalNoticeDetailModal
        isOpen={Boolean(selectedNotice)}
        notice={selectedNotice}
        onClose={() => setSelectedNotice(null)}
        onDelete={(n) => {
          clearNotification(n.id);
          setSelectedNotice(null);
        }}
        onOpenAppDetail={onAppClick}
      />
    </div>
  );
}
