import React, { useMemo, useRef, useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  ArrowRight,
  Camera,
  Star,
  Bell,
  Search,
  MoreVertical,
  CheckCheck
} from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useReviews } from '../context/ReviewContext';
import { useInstall } from '../context/InstallContext';
import { useToast } from '../context/ToastContext';
import { useNavigation } from '../context/NavigationContext';
import { usePreserveScroll } from '../services/scrollManager';

function ReviewNotificationRow({
  review,
  onDismiss,
  onClick
}: {
  key?: React.Key;
  review: any;
  onDismiss: (key: string) => void;
  onClick: (appId: string, reviewId: string) => void;
}) {
  const itemKey = `${review.appId}-${review.id}`;
  const x = useMotionValue(0);
  const [isDismissing, setIsDismissing] = useState(false);
  const isDraggingRef = useRef(false);

  // Linear opacity fade as card is dragged across the screen
  const opacity = useTransform(x, [-180, -70, 0, 70, 180], [0.15, 0.75, 1, 0.75, 0.15]);

  const handleDragEnd = (_: any, info: { offset: { x: number }; velocity: { x: number } }) => {
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 60);

    const swipeThreshold = 75;
    const velocityThreshold = 300;
    const currentOffset = info.offset.x;
    const currentVelocity = info.velocity.x;
    const shouldDismiss = Math.abs(currentOffset) > swipeThreshold || Math.abs(currentVelocity) > velocityThreshold;

    if (shouldDismiss && !isDismissing) {
      setIsDismissing(true);
      const direction = (currentOffset !== 0 ? currentOffset : currentVelocity) < 0 ? -1 : 1;
      const targetX = direction * 500;

      // Linearly fling off screen with high fluidity, then remove from state
      animate(x, targetX, {
        duration: 0.18,
        ease: [0.22, 1, 0.36, 1],
        onComplete: () => {
          onDismiss(itemKey);
        }
      });
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{
        opacity: 0,
        scale: 0.95,
        transition: { duration: 0.15 }
      }}
      transition={{ duration: 0.15 }}
      className="relative overflow-hidden select-none w-full"
    >
      {/* Review Notification Row matching Developer Console row style */}
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
          if (!isDraggingRef.current && !isDismissing && Math.abs(x.get()) < 8) {
            onClick(review.appId, review.id);
          }
        }}
        className="w-full flex items-center justify-between gap-3 py-2 sm:py-2.5 rounded-xl cursor-pointer select-none bg-transparent group relative outline-none transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* App Logo - exact console size (w-14 h-14 sm:w-16 sm:h-16 rounded-2xl) */}
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden shrink-0 bg-theme-hover shadow-xs flex items-center justify-center">
            {review.appIcon && review.appIcon.trim() ? (
              <img src={review.appIcon} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-blue-500">
                {review.appName ? review.appName.charAt(0).toUpperCase() : 'A'}
              </span>
            )}
          </div>

          {/* Review Details matching console layout */}
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <h4 className="text-theme-text text-[15px] sm:text-base font-medium leading-tight truncate group-hover:text-blue-500 transition-colors">
                {review.appName}
              </h4>
              <span className="text-[11px] text-theme-text-muted shrink-0 whitespace-nowrap ml-1">
                {review.date}
              </span>
            </div>

            <p className="text-theme-text-muted text-xs sm:text-[13px] mb-1 truncate leading-tight">
              {review.text}
            </p>

            <div className="flex items-center gap-1.5 text-xs text-theme-text-muted whitespace-nowrap overflow-hidden text-ellipsis">
              <span className="flex items-center gap-0.5 font-medium text-theme-text shrink-0">
                <span>{review.rating}</span>
                <span className="text-[10px] text-amber-400">★</span>
              </span>
              <span className="shrink-0">•</span>
              <span className="truncate">{review.userName || 'User Review'}</span>
              {review.media && review.media.length > 0 && (
                <span className="shrink-0 text-blue-400 flex items-center gap-0.5">
                  • <Camera className="w-3 h-3 inline" /> {review.media.length}
                </span>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function RatingsAndReviewsPage({ 
  onClose,
  onNavigateToSettings 
}: { 
  onClose: () => void;
  onNavigateToSettings?: () => void;
}) {
  const { isPublisher } = useAuth();
  const { 
    getUserReviews, 
    getPublisherAppsReviews
  } = useReviews();
  const { notifications, markNotificationAsRead, clearNotification } = useInstall();
  const { showToast } = useToast();
  const { openAppReviews, openSearch } = useNavigation();

  const userReviews = getUserReviews();
  const allPublisherReviews = getPublisherAppsReviews();

  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  usePreserveScroll('ratings-and-reviews-page', scrollRef);

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

  // Unified reviews feed combining reviews written by the user and reviews on apps published by the user
  const unifiedReviews = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{
      review: typeof userReviews[0];
      isMyReview: boolean;
    }> = [];

    // 1. User's own authored reviews
    userReviews.forEach(r => {
      const key = `${r.appId}-${r.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        list.push({
          review: r,
          isMyReview: true
        });
      }
    });

    // 2. Reviews received on user's published apps (for publishers)
    if (isPublisher) {
      allPublisherReviews.forEach(r => {
        const key = `${r.appId}-${r.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          list.push({
            review: r,
            isMyReview: false
          });
        }
      });
    }

    return list.sort((a, b) => {
      const dateA = new Date(a.review.date).getTime();
      const dateB = new Date(b.review.date).getTime();
      if (!isNaN(dateA) && !isNaN(dateB)) {
        return dateB - dateA;
      }
      return b.review.id.localeCompare(a.review.id);
    });
  }, [userReviews, allPublisherReviews, isPublisher]);

  const displayedReviews = useMemo(() => {
    return unifiedReviews.filter(item => !dismissedKeys.has(`${item.review.appId}-${item.review.id}`));
  }, [unifiedReviews, dismissedKeys]);

  const handleReviewClick = (appId: string, reviewId: string) => {
    openAppReviews(appId, reviewId);
  };

  const handleDismissSingle = (key: string) => {
    setDismissedKeys(prev => new Set([...prev, key]));
  };

  const handleMarkAllAsRead = () => {
    notifications
      .filter(n => n.title?.toLowerCase().includes('review') || n.message?.toLowerCase().includes('review'))
      .forEach(n => markNotificationAsRead(n.id));
    showToast('All reviews marked as read');
    setShowMenu(false);
  };

  const handleClearAllNotifications = () => {
    notifications
      .filter(n => n.title?.toLowerCase().includes('review') || n.message?.toLowerCase().includes('review'))
      .forEach(n => clearNotification(n.id));
    const allKeys = new Set(unifiedReviews.map(r => `${r.review.appId}-${r.review.id}`));
    setDismissedKeys(allKeys);
    showToast('All review notifications cleared');
    setShowMenu(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-theme-bg text-theme-text font-sans w-full shadow-none overflow-hidden select-none">
      {/* Top Header - Aligned with Sub Pages Header */}
      <header className="h-[60px] sm:h-[64px] flex items-center px-3 sm:px-5 bg-theme-bg shrink-0 z-20 w-full border-0">
        <div className="w-full max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <button 
              type="button"
              id="reviews-back-btn"
              onClick={onClose}
              className="w-10 h-10 -ml-1 text-theme-text hover:bg-theme-hover active:bg-theme-hover/80 rounded-full transition-colors shrink-0 cursor-pointer flex items-center justify-center"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5 text-theme-text" />
            </button>
            <h1 className="text-[16px] sm:text-[17px] font-medium tracking-tight text-theme-text font-google-sans truncate">
              Ratings &amp; reviews
            </h1>
          </div>
        </div>
      </header>

      {/* Reviews Content Stream - Matching Developer Console Layout */}
      <div
        ref={scrollRef}
        tabIndex={0}
        className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 sm:px-4 md:px-6 lg:px-8 pt-2 sm:pt-3 pb-8 scrollbar-hide flex flex-col min-h-0 w-full max-w-7xl mx-auto outline-none focus:outline-none overscroll-y-contain"
      >
        {displayedReviews.length === 0 ? (
          <div className="py-14 px-6 text-center flex flex-col items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-theme-hover border border-theme-border flex items-center justify-center text-theme-text-muted mb-3 opacity-80">
              <Star className="w-7 h-7 stroke-[1.5]" />
            </div>
            <p className="text-base font-semibold text-theme-text">No review notifications yet</p>
            <p className="text-xs text-theme-text-muted mt-1 max-w-xs leading-relaxed">
              When you submit reviews or receive user feedback on your published apps, real-time activity notifications will appear here.
            </p>
          </div>
        ) : (
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <AnimatePresence mode="popLayout" initial={false}>
              {displayedReviews.map(({ review }) => (
                <ReviewNotificationRow
                  key={`${review.appId}-${review.id}`}
                  review={review}
                  onDismiss={handleDismissSingle}
                  onClick={handleReviewClick}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
