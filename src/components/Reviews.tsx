import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Star, ArrowRight, MoreVertical, ShieldCheck, MessageSquare, Flag, Trash2, Edit3 } from 'lucide-react';
import { Review, AppDetails } from '../types';
import { useReviews } from '../context/ReviewContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import MediaGalleryLightbox from './MediaUpload/MediaGalleryLightbox';
import { FlagReviewModal } from './FlagReviewModal';
import ConfirmationDialog from './ConfirmationDialog';
import { calculateAppRatingAndReviews } from '../utils/appMetricsAlgorithm';
import { AdminModerationService } from '../services/adminModerationService';

interface ReviewsProps {
  app: AppDetails;
  reviews?: Review[];
  setReviews?: (reviews: Review[]) => void;
  onSeeAllReviews?: (reviewId?: string) => void;
  onWriteReview?: (rating?: number) => void;
}

export function Reviews({ app, onSeeAllReviews, onWriteReview }: ReviewsProps) {
  const { getAppReviews, userVotes, toggleHelpfulVote, canReplyAsPublisher, flagReview, isReviewFlagged, deleteReview } = useReviews();
  const { user, isAdmin } = useAuth();
  const { showToast } = useToast();
  
  const currentReviews = getAppReviews(app.id);
  const isPublisherForThisApp = canReplyAsPublisher(app.developer, app.id);

  const [hoverRating, setHoverRating] = useState<number>(0);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number>(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);
  const [flagModalReview, setFlagModalReview] = useState<Review | null>(null);
  const [deleteConfirmReviewId, setDeleteConfirmReviewId] = useState<string | null>(null);
  const [isDeletingReview, setIsDeletingReview] = useState<boolean>(false);
  const [openMenuReviewId, setOpenMenuReviewId] = useState<string | null>(null);

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

  const handleHelpful = (reviewId: string, vote: 'yes' | 'no') => {
    toggleHelpfulVote(app.id, reviewId, vote);
  };

  // Session baseline vote ranking for most-voted reviews preview:
  // Voting during active session does not cause instant jumping or card swapping.
  // Next session or after an app refresh, higher voted reviews rise into higher priority positions.
  const sessionRankingRef = useRef<Record<string, number>>({});
  const [rankingVersion, setRankingVersion] = useState<number>(0);

  useEffect(() => {
    if (currentReviews.length > 0) {
      currentReviews.forEach(r => {
        if (sessionRankingRef.current[r.id] === undefined) {
          sessionRankingRef.current[r.id] = r.helpfulCount || 0;
        }
      });
    }
  }, [currentReviews]);

  // Update session baseline when app is refreshed or user returns to tab
  useEffect(() => {
    const handleAppRefresh = () => {
      const updated: Record<string, number> = {};
      currentReviews.forEach(r => {
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
  }, [currentReviews]);

  // Priority-sorted reviews using session-locked vote counts
  const prioritizedReviews = useMemo(() => {
    const list = [...currentReviews];
    list.sort((a, b) => {
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
    return list;
  }, [currentReviews, rankingVersion]);

  const ratingCalculation = calculateAppRatingAndReviews(
    currentReviews,
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

  return (
    <div className="py-5">
      {/* Rate this App Section */}
      <div className="mb-4">
        <h2 className="text-[18px] sm:text-[19px] font-semibold text-[#0f172a] dark:text-[#f3f4f6] mb-1">Rate this app</h2>
        <p className="text-xs text-theme-text-muted mb-3">Tell others what you think</p>
        
        {/* 1-5 Star Selecting Structure */}
        <div className="flex items-center justify-between mb-3">
          {[1, 2, 3, 4, 5].map(i => (
             <button
               key={i}
               type="button"
               onClick={() => onWriteReview ? onWriteReview(i) : onSeeAllReviews?.()}
               onMouseEnter={() => setHoverRating(i)}
               onMouseLeave={() => setHoverRating(0)}
               className="p-1 rounded-full hover:bg-theme-hover transition-all active:scale-90 flex items-center justify-center group"
               title={`Rate ${i} star${i > 1 ? 's' : ''}`}
             >
               <Star 
                 className={`w-7 h-7 transition-all duration-150 ${
                   hoverRating >= i 
                     ? 'text-blue-400 fill-blue-400 scale-105' 
                     : 'text-zinc-400 dark:text-zinc-600 hover:text-blue-400 dark:hover:text-blue-400 hover:scale-105'
                 }`} 
                 strokeWidth={hoverRating >= i ? 1.5 : 1.75}
               />
             </button>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button 
            onClick={() => onWriteReview ? onWriteReview(0) : onSeeAllReviews?.()} 
            className="text-blue-400 text-xs font-medium hover:underline inline-block"
          >
            Write a review
          </button>
        </div>
      </div>

      {/* Ratings and reviews Header */}
      <div 
        className="flex items-center justify-between mb-5 cursor-pointer hover:opacity-80 transition-opacity pt-2" 
        onClick={() => onSeeAllReviews?.()}
      >
         <h2 className="text-[18px] sm:text-[19px] font-semibold text-[#0f172a] dark:text-[#f3f4f6]">Ratings and reviews</h2>
         <button className="w-8 h-8 flex items-center justify-center rounded-full bg-theme-hover text-theme-text pointer-events-none">
           <ArrowRight className="w-4.5 h-4.5" />
         </button>
      </div>

      {/* Ratings Breakdown */}
      <div className="flex items-start gap-6 mb-8">
        <div className="flex flex-col items-center justify-center min-w-[90px]">
           <span className="text-5xl font-semibold text-theme-text tracking-tight">
             {isRated ? averageRating : '—'}
           </span>
           <div className="flex text-amber-400 mt-1.5 mb-1 text-[12px] gap-0.5">
             {[1,2,3,4,5].map(i => (
               <span key={i} className={isRated && i <= Math.round(Number(averageRating)) ? 'text-amber-400' : 'text-zinc-400 dark:text-zinc-600'}>★</span>
             ))}
           </div>
           <span className="text-[11px] text-theme-text-muted text-center whitespace-nowrap">
             {displayReviewsCount}
           </span>
        </div>
        <div className="flex-1 flex flex-col gap-1.5 pt-1">
           {[5,4,3,2,1].map(n => {
             const percentage = breakdown[n]?.percentage || 0;
             return (
               <div key={n} className="flex items-center gap-2 h-2.5">
                 <span className="text-[11px] font-medium text-theme-text-muted w-2.5 text-right">{n}</span>
                 <div className="flex-1 h-2 bg-theme-hover dark:bg-zinc-800 rounded-full overflow-hidden">
                   <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${percentage}%` }} />
                 </div>
               </div>
             );
           })}
        </div>
      </div>

      {/* Individual Reviews List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        {prioritizedReviews.length === 0 ? (
          <p className="col-span-full text-sm text-theme-text-muted text-center py-4">No reviews yet. Be the first to review!</p>
        ) : (
          prioritizedReviews.slice(0, 4).map(review => (
            <div 
              key={review.id} 
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest('button') || target.closest('a') || target.closest('.cursor-pointer:not(.review-card)')) {
                  return;
                }
                onSeeAllReviews?.();
              }}
              className="review-card flex flex-col py-3 px-0 border-0 bg-transparent transition-colors cursor-pointer justify-between animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
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
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuReviewId(openMenuReviewId === review.id ? null : review.id);
                    }}
                    title="More options"
                    aria-label="More options"
                    className="p-1.5 text-theme-text-muted hover:text-theme-text hover:bg-theme-hover rounded-full transition-colors shrink-0 cursor-pointer"
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
                                if (onWriteReview) {
                                  onWriteReview(review.rating);
                                } else {
                                  onSeeAllReviews?.();
                                }
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

              {/* Attached Review Photos */}
              {review.media && review.media.length > 0 && (
                <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                  {review.media.filter(m => Boolean(m && m.trim())).map((imgUrl, imgIdx) => (
                    <div
                      key={imgIdx}
                      onClick={() => {
                        setLightboxImages(review.media || []);
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
                      onClick={() => handleHelpful(review.id, 'yes')}
                      className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        userVotes[review.id] === 'yes'
                          ? 'bg-blue-500/20 text-blue-400 font-semibold'
                          : 'border border-theme-border/60 bg-transparent text-theme-text hover:bg-theme-hover'
                      }`}
                    >
                      Yes
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleHelpful(review.id, 'no')}
                      className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        userVotes[review.id] === 'no'
                          ? 'bg-blue-500/20 text-blue-400 font-semibold'
                          : 'border border-theme-border/60 bg-transparent text-theme-text hover:bg-theme-hover'
                      }`}
                    >
                      No
                    </button>

                    {isPublisherForThisApp && !review.reply && (
                      <button
                        type="button"
                        onClick={() => onSeeAllReviews?.()}
                        className="px-4 py-1.5 rounded-lg bg-blue-500/10 text-xs font-medium text-blue-400 hover:bg-blue-500/20 transition-colors"
                      >
                        Reply
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Verified Developer Response */}
              {review.reply && (
                <div className="w-full bg-[#181818] dark:bg-[#181818] bg-zinc-100 rounded-2xl p-4 mt-3 min-h-[96px] flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[14px] font-normal text-theme-text truncate pr-2">
                      {review.reply.authorName || app.developer}
                    </span>
                    <span className="text-xs text-theme-text-muted shrink-0">{review.reply.date}</span>
                  </div>
                  <p className="text-[14px] text-theme-text leading-relaxed whitespace-pre-wrap min-h-[44px]">
                    {review.reply.text}
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {currentReviews.length > 0 && (
        <button 
          type="button"
          onClick={() => onSeeAllReviews?.()} 
          className="w-full mt-4 py-2.5 px-4 rounded-xl border border-theme-border/60 hover:bg-theme-hover text-blue-400 text-xs sm:text-sm font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          View all reviews
        </button>
      )}

      {/* Review Photos Lightbox */}
      <MediaGalleryLightbox
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        mediaItems={lightboxImages.map(img => ({ type: 'image' as const, url: img, title: 'Review Photo' }))}
        initialIndex={lightboxIndex}
        appName={app.name}
      />
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
    </div>
  );
}
