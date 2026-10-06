import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  ArrowLeft, 
  Search, 
  Star, 
  MoreVertical, 
  ThumbsUp, 
  ChevronDown, 
  Check, 
  ShieldCheck, 
  MessageSquare, 
  X,
  Flag
} from 'lucide-react';
import PullToRefresh from './PullToRefresh';
import { Review, AppDetails, MAX_REPLY_CHARACTERS } from '../types';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useReviews } from '../context/ReviewContext';
import { useNavigation } from '../context/NavigationContext';
import { FlagAppModal } from './FlagAppModal';
import MediaGalleryLightbox from './MediaUpload/MediaGalleryLightbox';
import WriteReviewPage from './WriteReviewPage';
import { FlagReviewModal } from './FlagReviewModal';
import ConfirmationDialog from './ConfirmationDialog';
import { usePreserveScroll } from '../services/scrollManager';
import { calculateAppRatingAndReviews } from '../utils/appMetricsAlgorithm';
import { AdminModerationService } from '../services/adminModerationService';

interface AppRatingsReviewsPageProps {
  app: AppDetails;
  reviews?: Review[];
  setReviews?: (reviews: Review[]) => void;
  targetReviewId?: string | null;
  onBack: () => void;
  onWriteReview?: (rating?: number) => void;
  initialRating?: number;
}

export default function AppRatingsReviewsPage({ 
  app, 
  onBack,
  onWriteReview,
  initialRating = 0,
  targetReviewId = null
}: AppRatingsReviewsPageProps) {
  const { showToast } = useToast();
  const { user, isAdmin } = useAuth();
  const { 
    getAppReviews, 
    userVotes,
    addOrUpdatePublisherReply, 
    deletePublisherReply, 
    deleteReview,
    toggleHelpfulVote, 
    canReplyAsPublisher,
    flagReview,
    isReviewFlagged
  } = useReviews();

  const appReviews = getAppReviews(app.id);

  const [filterRating, setFilterRating] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'relevant' | 'latest' | 'oldest'>('relevant');
  const [activeModal, setActiveModal] = useState<'relevance' | 'rating' | null>(null);
  const [flagModalReview, setFlagModalReview] = useState<Review | null>(null);
  const [deleteConfirmReviewId, setDeleteConfirmReviewId] = useState<string | null>(null);
  const [isDeletingReview, setIsDeletingReview] = useState<boolean>(false);
  const [openMenuReviewId, setOpenMenuReviewId] = useState<string | null>(null);
  const [hoverRating, setHoverRating] = useState<number>(0);

  const [showMenu, setShowMenu] = useState<boolean>(false);
  const [isFlagAppModalOpen, setIsFlagAppModalOpen] = useState<boolean>(false);

  const handleConfirmFlagApp = (reason: string) => {
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
    setIsFlagAppModalOpen(false);
  };

  // Helper to determine if a review was authored by current user
  const isMyReview = (review: Review): boolean => {
    if (!review) return false;
    if (user) {
      if (review.userId && (review.userId === user.uid || (user.uid && review.userId.toLowerCase() === user.uid.toLowerCase()))) {
        return true;
      }
      if (user.displayName && review.userName && review.userName.trim().toLowerCase() === user.displayName.trim().toLowerCase()) {
        return true;
      }
    }
    return review.userId === 'u-me' || review.userName === 'You';
  };

  const handleDeleteReview = async (reviewId: string) => {
    setIsDeletingReview(true);
    try {
      await deleteReview(app.id, reviewId);
      AdminModerationService.resolveReviewReport(reviewId, 'Deleted by moderator/admin');
      setOpenMenuReviewId(null);
      setDeleteConfirmReviewId(null);
      showToast('Review has been deleted.', { type: 'success' });
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete review.');
    } finally {
      setIsDeletingReview(false);
    }
  };

  const { openSearch, targetReviewId: navTargetReviewId, clearTargetReviewId } = useNavigation();
  const activeTargetReviewId = targetReviewId || navTargetReviewId;
  const [highlightedReviewId, setHighlightedReviewId] = useState<string | null>(null);

  // Track reviews that have already been highlighted during this component lifecycle
  // so a review is NEVER highlighted more than once and can NEVER enter a loop.
  const handledTargetReviewIdsRef = useRef<Set<string>>(new Set());
  const highlightTimersRef = useRef<NodeJS.Timeout[]>([]);

  const reviewsScrollRef = useRef<HTMLDivElement | null>(null);
  usePreserveScroll(`app-reviews-${app.id}`, reviewsScrollRef);

  useEffect(() => {
    if (!activeTargetReviewId) return;

    // If this review was already highlighted during this view, never repeat
    if (handledTargetReviewIdsRef.current.has(activeTargetReviewId)) {
      return;
    }
    handledTargetReviewIdsRef.current.add(activeTargetReviewId);

    setHighlightedReviewId(activeTargetReviewId);
    setFilterRating(null);

    // End highlight after 2.2s
    const t3 = setTimeout(() => {
      setHighlightedReviewId(null);
      clearTargetReviewId?.();
    }, 2200);

    highlightTimersRef.current.push(t3);
  }, [activeTargetReviewId, clearTargetReviewId]);

  // Clean up timers and targetReviewId on unmount so it never leaks into future actions
  useEffect(() => {
    return () => {
      highlightTimersRef.current.forEach(clearTimeout);
      highlightTimersRef.current = [];
      clearTargetReviewId?.();
    };
  }, [clearTargetReviewId]);

  // Fallback internal Write Review page if onWriteReview callback is not passed
  const [internalShowWrite, setInternalShowWrite] = useState<boolean>(false);
  const [internalWriteRating, setInternalWriteRating] = useState<number>(initialRating);

  // Publisher Reply state
  const [replyingReviewId, setReplyingReviewId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<string>('');
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [deleteReplyConfirmId, setDeleteReplyConfirmId] = useState<string | null>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize reply textarea to fit content neatly without excessive empty height
  useEffect(() => {
    if (replyingReviewId && replyTextareaRef.current) {
      const el = replyTextareaRef.current;
      el.style.height = 'auto';
      el.style.height = `${Math.max(36, Math.min(el.scrollHeight, 120))}px`;
    }
  }, [replyText, replyingReviewId]);

  // Review image Lightbox viewer state
  const [activeLightboxImages, setActiveLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number>(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);

  const isUserPublisherForThisApp = canReplyAsPublisher(app.developer, app.id);

  const ratingCalculation = calculateAppRatingAndReviews(
    appReviews,
    app.rating,
    app.ratingsCount,
    app.reviewsCount,
    app.ratingBreakdown
  );
  const averageRating = ratingCalculation.averageRatingFormatted;
  const totalReviewsCount = ratingCalculation.totalReviews;
  const displayReviewsCount = ratingCalculation.reviewsCountFormatted;
  const isRated = ratingCalculation.isRated;
  const breakdown = ratingCalculation.breakdown;

  const handleOpenWrite = (ratingVal: number = 0) => {
    if (onWriteReview) {
      onWriteReview(ratingVal);
    } else {
      setInternalWriteRating(ratingVal);
      setInternalShowWrite(true);
    }
  };

  const handleStartReply = (review: Review) => {
    if (!isUserPublisherForThisApp) {
      showToast('Publisher privileges required to author developer replies.');
      return;
    }
    setReplyingReviewId(review.id);
    setReplyText(review.reply?.text || '');
    setEditingReplyId(review.reply ? review.id : null);
  };

  const handleCancelReply = () => {
    setReplyingReviewId(null);
    setReplyText('');
    setEditingReplyId(null);
  };

  const handleSubmitReply = (reviewId: string) => {
    if (!replyText.trim()) {
      showToast('Please enter your response before submitting.');
      return;
    }

    if (replyText.trim().length > MAX_REPLY_CHARACTERS) {
      showToast(`Developer response cannot exceed ${MAX_REPLY_CHARACTERS} characters.`);
      return;
    }

    const success = addOrUpdatePublisherReply(app.id, reviewId, replyText.trim());
    if (success) {
      handleCancelReply();
    }
  };

  const handleDeleteReply = (reviewId: string) => {
    deletePublisherReply(app.id, reviewId);
    if (replyingReviewId === reviewId) {
      handleCancelReply();
    }
  };

  const handleVote = (reviewId: string, vote: 'yes'|'no') => {
    // If the review being voted on is currently highlighted, clear the highlight immediately
    if (highlightedReviewId === reviewId) {
      setHighlightedReviewId(null);
      clearTargetReviewId?.();
    }
    toggleHelpfulVote(app.id, reviewId, vote);
  };

  // Session baseline vote ranking for 'relevant' sorting:
  // When prioritizing by most votes, don't instantly change its position while voting in this session.
  // Take time and keep positions stable during the user's active session.
  // After the user's session ends (navigating away, tab switch, or session restart)
  // OR after an app refresh (pull to refresh, browser reload, or refresh action),
  // the reviews with more votes will be higher than before.
  const sessionRankingRef = useRef<Record<string, number>>({});
  const [rankingVersion, setRankingVersion] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  useEffect(() => {
    if (appReviews.length > 0) {
      appReviews.forEach(r => {
        if (sessionRankingRef.current[r.id] === undefined) {
          sessionRankingRef.current[r.id] = r.helpfulCount || 0;
        }
      });
    }
  }, [appReviews]);

  // When app is refreshed or user returns from background / another tab, refresh session baseline
  useEffect(() => {
    const handleAppRefresh = () => {
      const updated: Record<string, number> = {};
      appReviews.forEach(r => {
        updated[r.id] = r.helpfulCount || 0;
      });
      sessionRankingRef.current = updated;
      setRankingVersion(v => v + 1);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleAppRefresh();
      }
    };

    window.addEventListener('app:refresh', handleAppRefresh);
    window.addEventListener('store:refresh', handleAppRefresh);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('app:refresh', handleAppRefresh);
      window.removeEventListener('store:refresh', handleAppRefresh);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [appReviews]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const updated: Record<string, number> = {};
      appReviews.forEach(r => {
        updated[r.id] = r.helpfulCount || 0;
      });
      sessionRankingRef.current = updated;
      setRankingVersion(v => v + 1);

      try {
        window.dispatchEvent(new CustomEvent('app:refresh'));
      } catch {}

      await new Promise(resolve => setTimeout(resolve, 600));
    } catch {
      // no-op
    } finally {
      setIsRefreshing(false);
    }
  };

  const processedReviews = useMemo(() => {
    let result = [...appReviews];
    if (filterRating !== null) {
      result = result.filter(r => r.rating === filterRating);
    }
    
    if (sortBy === 'latest') {
      result.sort((a, b) => {
        const dateA = new Date(a.date).getTime() || 0;
        const dateB = new Date(b.date).getTime() || 0;
        if (dateB !== dateA) return dateB - dateA;
        return b.id.localeCompare(a.id);
      });
    } else if (sortBy === 'oldest') {
      result.sort((a, b) => {
        const dateA = new Date(a.date).getTime() || 0;
        const dateB = new Date(b.date).getTime() || 0;
        if (dateA !== dateB) return dateA - dateB;
        return a.id.localeCompare(b.id);
      });
    } else {
      // 'relevant': Sort by most vote review priority.
      // Evaluated against the session baseline vote counts so voting during the active
      // session takes time and avoids instant jumping. After the session ends or app refreshes, higher voted reviews rise.
      result.sort((a, b) => {
        const scoreA = sessionRankingRef.current[a.id] ?? (a.helpfulCount || 0);
        const scoreB = sessionRankingRef.current[b.id] ?? (b.helpfulCount || 0);
        if (scoreB !== scoreA) {
          return scoreB - scoreA;
        }
        const dateA = new Date(a.date).getTime() || 0;
        const dateB = new Date(b.date).getTime() || 0;
        if (dateB !== dateA) return dateB - dateA;
        return b.id.localeCompare(a.id);
      });
    }
    return result;
  }, [appReviews, filterRating, sortBy, rankingVersion]);

  if (internalShowWrite) {
    return (
      <WriteReviewPage
        app={app}
        initialRating={internalWriteRating}
        onBack={() => setInternalShowWrite(false)}
        onSuccess={() => setInternalShowWrite(false)}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-theme-bg text-theme-text font-sans w-full shadow-none overflow-hidden selection:bg-blue-500/30 select-none">
      {/* Top Header - Aligned with App Detail Sub Pages Header */}
      <header className="relative w-full h-[60px] sm:h-[68px] shrink-0 bg-theme-bg border-0 z-20">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-2.5 sm:px-4 md:px-6 gap-3">
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0 flex-1 -translate-x-[2px]">
            <button 
              type="button"
              id="reviews-back-button"
              onClick={onBack} 
              className="w-9 h-9 -ml-1 text-theme-text hover:bg-theme-hover active:bg-theme-hover/80 rounded-full transition-colors shrink-0 cursor-pointer flex items-center justify-center" 
              aria-label="Back"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex flex-col min-w-0 justify-center">
              <h1 className="text-[16px] sm:text-[17px] font-medium font-google-sans text-theme-text tracking-tight truncate leading-tight">
                {app.name}
              </h1>
              <span className="text-xs text-theme-text-muted truncate leading-normal mt-0.5">
                Ratings &amp; reviews
              </span>
            </div>
          </div>
        </div>
      </header>

      <div
        ref={reviewsScrollRef}
        tabIndex={0}
        className="flex-1 overflow-y-auto overflow-x-hidden w-full pb-safe outline-none focus:outline-none overscroll-y-contain"
        style={{
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
        }}
      >
        <PullToRefresh onRefresh={handleRefresh} isRefreshing={isRefreshing}>
        <div className="w-full max-w-7xl mx-auto px-2.5 sm:px-4 md:px-6 lg:px-8">
        {/* Top Section: Rate App & Breakdown in Responsive 2-Column Grid on Tablet/Desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 md:gap-8 md:items-center py-4 border-b border-theme-border/30">
          {/* Overall Ratings Summary & Breakdown */}
          <div className="py-2">
            <div className="flex items-start gap-6">
              <div className="flex flex-col items-center justify-center min-w-[90px]">
                <span className="text-5xl font-semibold text-theme-text tracking-tight">
                  {isRated ? averageRating : '—'}
                </span>
                <div className="flex text-amber-400 mt-1.5 mb-1 text-[12px] gap-0.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <span key={i} className={isRated && i <= Math.round(Number(averageRating)) ? 'text-amber-400' : 'text-zinc-400 dark:text-zinc-600'}>
                      ★
                    </span>
                  ))}
                </div>
                <span className="text-[11px] text-theme-text-muted text-center whitespace-nowrap">
                  {displayReviewsCount}
                </span>
              </div>

              <div className="flex-1 flex flex-col gap-1.5 pt-1">
                {[5, 4, 3, 2, 1].map((n) => {
                  const percentage = breakdown[n]?.percentage || 0;
                  return (
                    <div key={n} className="flex items-center gap-2 h-2.5">
                      <span className="text-[11px] font-medium text-theme-text-muted w-2.5 text-right">{n}</span>
                      <div className="flex-1 h-2 bg-theme-hover dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Rate This App / Prompt to Write Review */}
          <div className="pt-4 md:pt-0 pb-2 md:pb-0 md:border-l md:border-theme-border/30 md:pl-8">
            <h2 className="text-[17px] sm:text-[19px] font-medium text-theme-text tracking-tight mb-1">Rate this app</h2>
            <p className="text-xs text-theme-text-muted mb-3">Tell others what you think</p>
            
            <div className="flex items-center justify-between mb-3 max-w-xs">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => handleOpenWrite(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 rounded-full hover:bg-theme-hover transition-all active:scale-90 flex items-center justify-center group"
                  title={`Rate ${star} star${star > 1 ? 's' : ''}`}
                >
                  <Star
                    className={`w-7 h-7 transition-all duration-150 ${
                      hoverRating >= star
                        ? 'text-blue-400 fill-blue-400 scale-105'
                        : 'text-zinc-400 dark:text-zinc-600 hover:text-blue-400 dark:hover:text-blue-400 hover:scale-105'
                    }`}
                    strokeWidth={hoverRating >= star ? 1.5 : 1.75}
                  />
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => handleOpenWrite(0)}
                className="text-blue-400 text-xs font-medium hover:underline inline-block"
              >
                Write a review
              </button>
            </div>
          </div>
        </div>

        {/* Filter Pills */}
        <div
          className="flex items-center gap-2 py-2.5 overflow-x-auto scrollbar-hide relative"
          style={{
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-x pan-y',
            overscrollBehaviorX: 'contain',
            overscrollBehaviorY: 'auto',
          }}
        >
          <button 
             onClick={() => setActiveModal('relevance')}
             className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition-colors ${sortBy ? 'bg-blue-500/15 text-blue-400' : 'bg-theme-hover text-theme-text'}`}>
             <Check className="w-3.5 h-3.5" />
             {sortBy === 'relevant' ? 'Most relevant' : sortBy === 'latest' ? 'Latest' : 'Oldest'}
             <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
          </button>
          
          <button 
             onClick={() => setActiveModal('rating')}
             className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition-colors ${filterRating !== null ? 'bg-blue-500/15 text-blue-400' : 'bg-theme-hover text-theme-text'}`}>
             {filterRating !== null && <Check className="w-3.5 h-3.5" />}
             {filterRating !== null ? <div className="flex items-center gap-0.5">{filterRating}<Star className="w-3 h-3 fill-current text-amber-400" /></div> : 'Rating'}
             <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
          </button>

          {filterRating !== null && (
            <button
              onClick={() => setFilterRating(null)}
              className="text-xs text-blue-400 hover:underline px-2 shrink-0"
            >
              Reset filter
            </button>
          )}
        </div>

        {/* Reviews List */}
        <div className="px-1 sm:px-2 pb-8 pt-2 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 lg:gap-6 flex-1">
          {processedReviews.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
               <p className="text-sm text-theme-text-muted">No reviews match your filter.</p>
               <button onClick={() => setFilterRating(null)} className="mt-3 text-blue-400 font-medium text-xs">Clear filters</button>
            </div>
          ) : (
            processedReviews.map((review) => {
              const isReplying = replyingReviewId === review.id;
              const isHighlighted = highlightedReviewId === review.id;
              
              return (
                <div 
                  key={review.id} 
                  id={`review-item-${review.id}`}
                  className="relative flex flex-col py-3 sm:py-4 px-0 border-0 bg-transparent scroll-mt-24 animate-in fade-in slide-in-from-bottom-2 duration-300 justify-between"
                >
                  {isHighlighted && (
                    <div 
                      className="review-highlight-animation absolute -inset-x-2 sm:-inset-x-3.5 md:-inset-x-5 -top-2.5 bottom-0 pointer-events-none rounded-none" 
                      aria-hidden="true"
                      onAnimationEnd={() => {
                        setHighlightedReviewId(null);
                        clearTargetReviewId?.();
                      }}
                    />
                  )}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-3 min-w-0">
                       {review.userAvatar && review.userAvatar.trim() ? (
                         <img src={review.userAvatar} referrerPolicy="no-referrer" className="w-8 h-8 rounded-full object-cover shrink-0 border border-theme-border/40" alt={review.userName} />
                       ) : (
                         <div className="w-8 h-8 rounded-full bg-slate-700 dark:bg-zinc-700 flex items-center justify-center text-xs font-medium text-white shrink-0">
                           {review.userName.charAt(0).toUpperCase()}
                         </div>
                       )}
                       <span className="text-[14px] font-medium text-theme-text truncate">{review.userName}</span>
                    </div>
                    <div className="relative shrink-0">
                      <button 
                        type="button" 
                        className="p-1.5 text-theme-text-muted hover:text-theme-text hover:bg-theme-hover rounded-full transition-colors shrink-0 cursor-pointer" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuReviewId(openMenuReviewId === review.id ? null : review.id);
                        }}
                        title="More options"
                        aria-label="More options"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {openMenuReviewId === review.id && (
                        <>
                          <div 
                            className="fixed inset-0 z-40" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuReviewId(null);
                            }} 
                          />
                          <div className="absolute right-0 top-full mt-1 w-52 bg-theme-card rounded-xl shadow-xl py-1.5 z-50 text-theme-text animate-in fade-in zoom-in-95 duration-100">
                            {isMyReview(review) ? (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuReviewId(null);
                                    handleOpenWrite(review.rating);
                                  }}
                                  className="w-full text-left px-4 py-2 hover:bg-theme-hover text-theme-text text-sm font-medium transition-colors cursor-pointer"
                                >
                                  Edit review
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuReviewId(null);
                                    setDeleteConfirmReviewId(review.id);
                                  }}
                                  className="w-full text-left px-4 py-2 hover:bg-theme-hover text-red-400 text-sm font-medium transition-colors cursor-pointer"
                                >
                                  Delete review
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuReviewId(null);
                                    setFlagModalReview(review);
                                  }}
                                  className="w-full text-left px-4 py-2 hover:bg-theme-hover text-theme-text text-sm font-medium transition-colors cursor-pointer"
                                >
                                  Flag as inappropriate
                                </button>
                                {isAdmin && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenMenuReviewId(null);
                                      setDeleteConfirmReviewId(review.id);
                                    }}
                                    className="w-full text-left px-4 py-2 hover:bg-theme-hover text-red-500 hover:text-red-400 text-sm font-medium transition-colors cursor-pointer"
                                  >
                                    Delete review (Admin)
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-theme-text-muted mb-2">
                    <div className="flex text-blue-500 dark:text-blue-400 gap-0.5 text-xs">
                      {[1,2,3,4,5].map(i => (
                        <span key={i} className={i <= review.rating ? 'text-blue-500 dark:text-blue-400' : 'text-zinc-500 dark:text-zinc-600'}>★</span>
                      ))}
                    </div>
                    <span className="text-xs text-theme-text-muted">{review.date}</span>
                  </div>
                  <p className="text-[14px] text-theme-text leading-relaxed mb-2.5 whitespace-pre-wrap">
                    {review.text}
                  </p>

                  {/* Attached User Review Photos */}
                  {review.media && review.media.length > 0 && (
                    <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                      {review.media.filter(m => Boolean(m && m.trim())).map((imgUrl, imgIdx) => (
                        <div
                          key={imgIdx}
                          onClick={() => {
                            setActiveLightboxImages(review.media || []);
                            setLightboxIndex(imgIdx);
                            setIsLightboxOpen(true);
                          }}
                          className="w-16 h-16 rounded-xl overflow-hidden bg-theme-hover border border-theme-border/60 shrink-0 cursor-pointer group relative shadow-sm"
                        >
                          <img src={imgUrl} alt="Review attachment" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {review.helpfulCount > 0 && (
                     <p className="text-xs text-theme-text-muted mb-2.5">{review.helpfulCount} people found this helpful</p>
                  )}

                  {!isMyReview(review) && (
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-theme-text-muted">Was this review helpful?</span>

                      <div className="flex items-center gap-2">
                        <button 
                          type="button"
                          onClick={() => handleVote(review.id, 'yes')}
                          className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            userVotes[review.id] === 'yes' 
                              ? 'bg-blue-500/20 text-blue-400 font-semibold' 
                              : 'border border-theme-border/60 bg-transparent text-theme-text hover:bg-theme-hover'
                          }`}>
                          Yes
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleVote(review.id, 'no')}
                          className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            userVotes[review.id] === 'no' 
                              ? 'bg-blue-500/20 text-blue-400 font-semibold' 
                              : 'border border-theme-border/60 bg-transparent text-theme-text hover:bg-theme-hover'
                          }`}>
                          No
                        </button>

                        {/* Publisher Only: Reply Button (Only for OTHER users' reviews, never own review) */}
                        {isUserPublisherForThisApp && !review.reply && !isReplying && (
                          <button
                            type="button"
                            onClick={() => handleStartReply(review)}
                            className="px-4 py-1.5 rounded-lg bg-blue-500/10 text-xs font-medium text-blue-400 hover:bg-blue-500/20 transition-colors"
                          >
                            Reply
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Developer Response or Inline Reply Editor */}
                  {isUserPublisherForThisApp && isReplying ? (
                    <div className="w-full bg-[#181818] dark:bg-[#181818] bg-zinc-100 rounded-xl p-3 mt-2 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[13px] font-medium text-theme-text truncate pr-2">
                          {user?.publisherName || user?.displayName || review.reply?.authorName || app.developer}
                        </span>
                        <span className="text-[11px] text-theme-text-muted shrink-0">
                          {review.reply?.date || 'Responding as Developer'}
                        </span>
                      </div>
                      <textarea
                        ref={replyTextareaRef}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Write a reply..."
                        maxLength={MAX_REPLY_CHARACTERS}
                        rows={1}
                        className="w-full bg-transparent border-0 p-0 text-[13px] text-theme-text placeholder-theme-text-muted outline-none focus:outline-none focus:ring-0 resize-none leading-relaxed min-h-[36px] max-h-[120px]"
                      />

                      <div className="flex items-center justify-between gap-2 mt-2">
                        <span
                          className={`font-mono text-[10px] transition-colors ${
                            replyText.length >= MAX_REPLY_CHARACTERS
                              ? 'text-amber-500 font-semibold'
                              : replyText.length >= MAX_REPLY_CHARACTERS - 50
                              ? 'text-amber-400'
                              : 'text-theme-text-muted'
                          }`}
                        >
                          {replyText.length}/{MAX_REPLY_CHARACTERS}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleCancelReply}
                            className="px-2.5 py-1 text-xs font-medium text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSubmitReply(review.id)}
                            disabled={!replyText.trim() || replyText.length > MAX_REPLY_CHARACTERS}
                            className="px-3.5 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium rounded-full transition-colors shadow-xs cursor-pointer"
                          >
                            {editingReplyId ? 'Save' : 'Reply'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : review.reply ? (
                    <div className="w-full bg-[#181818] dark:bg-[#181818] bg-zinc-100 rounded-xl p-3 mt-2 min-h-[96px] flex flex-col justify-between">
                       <div className="flex items-center justify-between mb-1.5">
                         <span className="text-[13px] font-medium text-theme-text truncate pr-2">
                           {review.reply.authorName || app.developer}
                         </span>
                         <span className="text-[11px] text-theme-text-muted shrink-0">{review.reply.date}</span>
                       </div>
                       <p className="text-[13px] text-theme-text leading-relaxed whitespace-pre-wrap min-h-[44px]">
                          {review.reply.text}
                       </p>

                       {/* Publisher-Only controls for modifying developer response */}
                       {isUserPublisherForThisApp && (
                         <div className="flex items-center justify-end gap-3 mt-2">
                           <button
                             type="button"
                             onClick={() => handleStartReply(review)}
                             className="text-[11px] font-medium text-blue-400 hover:underline cursor-pointer"
                           >
                             Edit
                           </button>
                           <button
                             type="button"
                             onClick={() => setDeleteReplyConfirmId(review.id)}
                             className="text-[11px] font-medium text-red-400 hover:underline cursor-pointer"
                           >
                             Delete
                           </button>
                         </div>
                       )}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
        </div>
        </PullToRefresh>
      </div>

      {/* Relevance Sort Modal */}
      {activeModal === 'relevance' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
           <div className="w-full max-w-sm bg-theme-bg rounded-t-3xl sm:rounded-2xl border border-theme-border/60 p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-theme-border/40 pb-3">
                 <h3 className="font-semibold text-theme-text text-base">Sort reviews by</h3>
                 <button onClick={() => setActiveModal(null)} className="p-1 rounded-full hover:bg-theme-hover">
                    <X className="w-5 h-5 text-theme-text-muted" />
                 </button>
              </div>
              <div className="flex flex-col gap-1">
                 {[
                   { id: 'relevant', label: 'Most relevant' },
                   { id: 'latest', label: 'Most recent (Latest)' },
                   { id: 'oldest', label: 'Oldest first' }
                 ].map(item => (
                   <button
                     key={item.id}
                     onClick={() => {
                       setSortBy(item.id as any);
                       setActiveModal(null);
                     }}
                     className={`flex items-center justify-between p-3 rounded-xl text-sm font-medium transition-colors ${
                       sortBy === item.id ? 'bg-blue-500/15 text-blue-400' : 'hover:bg-theme-hover text-theme-text'
                     }`}
                   >
                     <span>{item.label}</span>
                     {sortBy === item.id && <Check className="w-4 h-4 text-blue-400" />}
                   </button>
                 ))}
              </div>
           </div>
        </div>
      )}

      {/* Star Filter Modal */}
      {activeModal === 'rating' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
           <div className="w-full max-w-sm bg-theme-bg rounded-t-3xl sm:rounded-2xl border border-theme-border/60 p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-theme-border/40 pb-3">
                 <h3 className="font-semibold text-theme-text text-base">Filter by rating</h3>
                 <button onClick={() => setActiveModal(null)} className="p-1 rounded-full hover:bg-theme-hover">
                    <X className="w-5 h-5 text-theme-text-muted" />
                 </button>
              </div>
              <div className="flex flex-col gap-1">
                 <button
                   onClick={() => {
                     setFilterRating(null);
                     setActiveModal(null);
                   }}
                   className={`flex items-center justify-between p-3 rounded-xl text-sm font-medium transition-colors ${
                     filterRating === null ? 'bg-blue-500/15 text-blue-400' : 'hover:bg-theme-hover text-theme-text'
                   }`}
                 >
                   <span>All star ratings</span>
                   {filterRating === null && <Check className="w-4 h-4 text-blue-400" />}
                 </button>
                 {[5, 4, 3, 2, 1].map(stars => (
                   <button
                     key={stars}
                     onClick={() => {
                       setFilterRating(stars);
                       setActiveModal(null);
                     }}
                     className={`flex items-center justify-between p-3 rounded-xl text-sm font-medium transition-colors ${
                       filterRating === stars ? 'bg-blue-500/15 text-blue-400' : 'hover:bg-theme-hover text-theme-text'
                     }`}
                   >
                     <div className="flex items-center gap-1.5">
                       <span>{stars} Stars</span>
                       <div className="flex text-amber-400">
                         {Array.from({ length: stars }).map((_, i) => (
                           <Star key={i} className="w-3.5 h-3.5 fill-current" />
                         ))}
                       </div>
                     </div>
                     {filterRating === stars && <Check className="w-4 h-4 text-blue-400" />}
                   </button>
                 ))}
              </div>
           </div>
        </div>
      )}

      {/* Delete Review Confirmation Dialog (standardized with app remove dialog) */}
      <ConfirmationDialog
        isOpen={Boolean(deleteConfirmReviewId)}
        title="Delete review?"
        description="Are you sure you want to permanently delete this review? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isDestructive={true}
        icon="danger"
        onConfirm={() => {
          if (deleteConfirmReviewId) {
            handleDeleteReview(deleteConfirmReviewId);
          }
        }}
        onCancel={() => setDeleteConfirmReviewId(null)}
      />

      {/* Delete Publisher Reply Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={Boolean(deleteReplyConfirmId)}
        title="Delete response?"
        description="Are you sure you want to delete your response to this review? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isDestructive={true}
        icon="danger"
        onConfirm={() => {
          if (deleteReplyConfirmId) {
            handleDeleteReply(deleteReplyConfirmId);
            setDeleteReplyConfirmId(null);
          }
        }}
        onCancel={() => setDeleteReplyConfirmId(null)}
      />

      {/* Flag Review Modal */}
      <FlagReviewModal
        isOpen={Boolean(flagModalReview)}
        onClose={() => setFlagModalReview(null)}
        review={flagModalReview}
        isAlreadyFlagged={flagModalReview ? isReviewFlagged(flagModalReview.id) : false}
        onConfirmFlag={(reason) => {
          if (flagModalReview) {
            flagReview(app.id, flagModalReview.id, reason);
          }
        }}
      />

      {/* Review Photos Lightbox */}
      <MediaGalleryLightbox
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        mediaItems={activeLightboxImages.map(img => ({ type: 'image' as const, url: img, title: 'Review Photo' }))}
        initialIndex={lightboxIndex}
        appName={app.name}
      />

      {/* Flag App Modal */}
      <FlagAppModal
        isOpen={isFlagAppModalOpen}
        onClose={() => setIsFlagAppModalOpen(false)}
        onConfirmFlag={handleConfirmFlagApp}
      />
    </div>
  );
}
