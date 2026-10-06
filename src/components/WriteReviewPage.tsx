import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ArrowLeft, 
  Star, 
  MoreVertical
} from 'lucide-react';
import { AppDetails, Review, MAX_REVIEW_CHARACTERS } from '../types';
import { useAuth } from '../context/AuthContext';
import { useReviews } from '../context/ReviewContext';
import { useToast } from '../context/ToastContext';
import { useInstall } from '../context/InstallContext';
import ReviewMediaUploader from './MediaUpload/ReviewMediaUploader';
import MediaGalleryLightbox from './MediaUpload/MediaGalleryLightbox';
import ConfirmationDialog from './ConfirmationDialog';
import { usePreserveScroll } from '../services/scrollManager';

interface WriteReviewPageProps {
  app: AppDetails;
  initialRating?: number;
  onBack: () => void;
  onSuccess?: () => void;
}

const RATING_LABELS: Record<number, string> = {
  1: 'Hated it',
  2: 'Disliked it',
  3: "It's OK",
  4: 'Liked it',
  5: 'Loved it'
};

export default function WriteReviewPage({
  app,
  initialRating = 0,
  onBack,
  onSuccess
}: WriteReviewPageProps) {
  const { user } = useAuth();
  const { openAuthDialog } = useInstall();
  const { 
    addReview, 
    updateReview, 
    deleteReview, 
    getUserReviews 
  } = useReviews();
  const { showToast } = useToast();

  const userReviews = getUserReviews();
  
  // Find if user already has an existing review for this current app
  const existingReviewForThisApp = useMemo(() => {
    return userReviews.find(r => r.appId === app.id);
  }, [userReviews, app.id]);

  // Target app currently being edited or reviewed (defaults to current app)
  const [targetApp, setTargetApp] = useState<{
    id: string;
    name: string;
    iconUrl?: string;
  }>(() => ({
    id: app.id,
    name: app.name,
    iconUrl: app.iconUrl
  }));

  const [targetReviewId, setTargetReviewId] = useState<string | null>(
    existingReviewForThisApp?.id || null
  );

  const [rating, setRating] = useState<number>(initialRating || existingReviewForThisApp?.rating || 0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [reviewText, setReviewText] = useState<string>(existingReviewForThisApp?.text || '');
  const [media, setMedia] = useState<string[]>(existingReviewForThisApp?.media || []);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  usePreserveScroll(`write-review-${app.id}`, scrollContainerRef);

  // Lightbox modal state for viewing previous review photos
  const [activeLightboxImages, setActiveLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number>(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);

  // Delete confirmation modal state
  const [deletingReviewId, setDeletingReviewId] = useState<{ appId: string; reviewId: string; appName: string } | null>(null);
  const [openMenuReviewId, setOpenMenuReviewId] = useState<string | null>(null);

  const isEditingOtherApp = targetApp.id !== app.id;
  const isEditingReview = Boolean(targetReviewId);

  useEffect(() => {
    if (targetApp.id === app.id) {
      if (initialRating > 0) {
        setRating(initialRating);
      } else if (existingReviewForThisApp?.rating) {
        setRating(existingReviewForThisApp.rating);
      }
      if (existingReviewForThisApp) {
        setTargetReviewId(existingReviewForThisApp.id);
        setReviewText(existingReviewForThisApp.text || '');
        setMedia(existingReviewForThisApp.media || []);
      }
    }
  }, [initialRating, existingReviewForThisApp?.id, app.id, targetApp.id]);

  const handleSelectToEdit = (prevReview: typeof userReviews[0]) => {
    setTargetApp({
      id: prevReview.appId,
      name: prevReview.appName,
      iconUrl: prevReview.appIcon || (prevReview.appId === app.id ? app.iconUrl : undefined)
    });
    setTargetReviewId(prevReview.id);
    setRating(prevReview.rating);
    setReviewText(prevReview.text);
    setMedia(prevReview.media || []);

    // Focus the review textarea for instant editing without scroll jumps
    setTimeout(() => {
      textareaRef.current?.focus({ preventScroll: true });
    }, 150);

    showToast(`Loaded review for ${prevReview.appName} to edit`);
  };

  const handleSwitchBackToOriginalApp = () => {
    setTargetApp({
      id: app.id,
      name: app.name,
      iconUrl: app.iconUrl
    });
    setTargetReviewId(existingReviewForThisApp?.id || null);
    setRating(existingReviewForThisApp?.rating || initialRating || 0);
    setReviewText(existingReviewForThisApp?.text || '');
    setMedia(existingReviewForThisApp?.media || []);
    showToast(`Switched back to ${app.name}`);
  };

  const handleSubmit = () => {
    if (!user) {
      openAuthDialog({
        appId: targetApp.id,
        appName: targetApp.name,
        options: {
          iconUrl: targetApp.iconUrl,
          sizeString: app.size
        }
      });
      showToast('Please sign in with Google to post your review.');
      return;
    }

    if (rating === 0) {
      showToast('Please select a star rating first');
      return;
    }

    if (reviewText.trim().length > MAX_REVIEW_CHARACTERS) {
      showToast(`Review cannot exceed ${MAX_REVIEW_CHARACTERS} characters.`);
      return;
    }

    if (targetReviewId) {
      // Update existing review (works for current app or any other app selected on submit page!)
      updateReview(targetApp.id, targetReviewId, {
        rating,
        text: reviewText.trim() || 'Great app!',
        media: media.length > 0 ? media : undefined
      });
      showToast(`Your review for ${targetApp.name} has been updated.`);

      // If user was editing another app from the submit page, smoothly switch back to original app
      if (isEditingOtherApp) {
        handleSwitchBackToOriginalApp();
        return;
      }
    } else {
      // Post new review for current app
      addReview(targetApp.id, {
        userId: user?.uid || 'u-me',
        userName: user?.displayName || 'User',
        userAvatar: user?.photoURL || undefined,
        rating,
        text: reviewText.trim() || 'Great app!',
        media: media.length > 0 ? media : undefined,
        helpfulCount: 0
      });
      showToast('Thank you! Your review has been posted.');
    }

    if (onSuccess) {
      onSuccess();
    } else {
      onBack();
    }
  };

  const handleConfirmDelete = () => {
    if (!deletingReviewId) return;
    
    deleteReview(deletingReviewId.appId, deletingReviewId.reviewId);
    showToast(`Deleted review for ${deletingReviewId.appName}`);
    
    // If the review being deleted is the one currently loaded in the form, reset cleanly
    if (deletingReviewId.reviewId === targetReviewId || deletingReviewId.appId === targetApp.id) {
      handleSwitchBackToOriginalApp();
      if (deletingReviewId.appId === app.id) {
        setRating(0);
        setReviewText('');
        setMedia([]);
        setTargetReviewId(null);
      }
    }
    
    setDeletingReviewId(null);
  };

  const handleHeaderBack = () => {
    if (isEditingOtherApp) {
      handleSwitchBackToOriginalApp();
    } else {
      onBack();
    }
  };

  const activeRating = hoverRating || rating;

  return (
    <div className="fixed inset-0 z-[70] bg-theme-bg text-theme-text flex flex-col h-full h-[100dvh] overflow-hidden">
      <div className="w-full flex flex-col h-full">
        {/* Top Header - Aligned with App Detail Sub Pages */}
        <header className="relative w-full h-[60px] sm:h-[68px] shrink-0 bg-theme-bg border-0 z-20">
          <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-2.5 sm:px-4 md:px-6 gap-3">
            <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0 max-w-[calc(100%-140px)] sm:max-w-md -translate-x-[2px]">
              <button
                type="button"
                onClick={handleHeaderBack}
                className="w-9 h-9 -ml-1 text-theme-text hover:bg-theme-hover active:bg-theme-hover/80 rounded-full transition-colors shrink-0 cursor-pointer flex items-center justify-center"
                title={isEditingOtherApp ? `Back to ${app.name}` : 'Go back'}
                aria-label="Back"
              >
                <ArrowLeft className="w-6 h-6 text-theme-text" />
              </button>
              <div className="flex flex-col min-w-0 justify-center">
                <h1 className="text-[16px] sm:text-[17px] font-medium font-google-sans text-theme-text tracking-tight truncate leading-tight">
                  {targetApp.name}
                </h1>
                <span className="text-[12px] sm:text-[13px] text-theme-text-muted truncate leading-tight mt-0.5 font-normal">
                  {targetReviewId ? 'Edit review' : 'Write a review'}
                </span>
              </div>
            </div>

            <div className="flex-1"></div>

            <div className="flex items-center shrink-0 translate-x-[4px]">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={rating === 0}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-medium rounded-full shadow-xs transition-all shrink-0 cursor-pointer"
              >
                {targetReviewId ? 'Update' : 'Post'}
              </button>
            </div>
          </div>
        </header>

      {/* Main Content Area */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto w-full pb-safe">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 pt-4 pb-20 space-y-7">
          <div className="lg:grid lg:grid-cols-12 lg:gap-12 items-start">
            <div className="lg:col-span-8 flex flex-col min-w-0 space-y-7">
        {/* Banner when editing a review for another app */}
        {isEditingOtherApp && (
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/20 text-xs animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center gap-2.5 min-w-0">
              {targetApp.iconUrl ? (
                <img src={targetApp.iconUrl} alt={targetApp.name} className="w-7 h-7 rounded-lg object-cover shrink-0 border border-theme-border/30" />
              ) : (
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  {targetApp.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <span className="text-theme-text truncate font-medium">
                  Editing review for <span className="text-blue-600 dark:text-[#8ab4f8]">{targetApp.name}</span>
                </span>
                <span className="text-[11px] text-theme-text-muted">
                  Update stars, comments, or photos above
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSwitchBackToOriginalApp}
              className="px-3 py-1.5 text-xs text-theme-text-muted hover:text-theme-text font-medium shrink-0 cursor-pointer rounded-full hover:bg-theme-hover active:bg-theme-border/40 transition-colors"
            >
              Back to {app.name}
            </button>
          </div>
        )}
        {/* User Identity Info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center overflow-hidden shrink-0">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'Google User'}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-sm font-semibold text-white">
                {(user?.displayName || 'U').charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-theme-text">{user?.displayName || 'Google User'}</span>
            <span className="text-[11px] text-theme-text-muted">Reviews are public and include your Google account details</span>
          </div>
        </div>

        {/* Star Rating Section */}
        <div className="flex flex-col items-center justify-center py-2">
          <div className="flex items-center gap-2 mb-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="p-1.5 rounded-full hover:bg-theme-hover transition-all active:scale-90 flex items-center justify-center"
              >
                <Star
                  className={`w-9 h-9 transition-all duration-150 ${
                    activeRating >= star
                      ? 'text-blue-500 fill-blue-500 scale-105'
                      : 'text-zinc-400 dark:text-zinc-600 hover:text-blue-400'
                  }`}
                  strokeWidth={activeRating >= star ? 1.5 : 1.75}
                />
              </button>
            ))}
          </div>

          <span className="text-xs font-medium text-theme-text h-4">
            {activeRating > 0 ? RATING_LABELS[activeRating] : 'Tap the stars to rate'}
          </span>
        </div>

        {/* Text Review Input */}
        <div className="space-y-1.5">
          <textarea
            ref={textareaRef}
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value.slice(0, MAX_REVIEW_CHARACTERS))}
            placeholder={`Describe your experience (optional, max ${MAX_REVIEW_CHARACTERS} characters)...`}
            maxLength={MAX_REVIEW_CHARACTERS}
            rows={4}
            className={`w-full bg-theme-hover/40 dark:bg-zinc-900/60 border rounded-xl p-3.5 text-sm text-theme-text placeholder-theme-text-muted outline-none transition-colors resize-none ${
              reviewText.length >= MAX_REVIEW_CHARACTERS
                ? 'border-amber-500/80 focus:border-amber-500'
                : 'border-theme-border/60 focus:border-blue-500/80'
            }`}
          />
          <div className="flex items-center justify-between text-xs px-1 text-theme-text-muted">
            <span className="text-[11px]">
              {reviewText.length >= MAX_REVIEW_CHARACTERS
                ? 'Character limit reached'
                : 'Help others know what to expect'}
            </span>
            <span
              className={`font-mono text-[11px] transition-colors ${
                reviewText.length >= MAX_REVIEW_CHARACTERS
                  ? 'text-amber-500 font-semibold'
                  : reviewText.length >= MAX_REVIEW_CHARACTERS - 50
                  ? 'text-amber-400'
                  : 'text-theme-text-muted'
              }`}
            >
              {reviewText.length}/{MAX_REVIEW_CHARACTERS}
            </span>
          </div>
        </div>

        {/* Media / Photo Uploader */}
        <div className="space-y-2">
          <span className="text-xs font-medium text-theme-text">Add photos (optional)</span>
          <ReviewMediaUploader
            media={media}
            onChange={setMedia}
            maxFiles={3}
          />
        </div>

        {/* User's Previous Reviews Section (using the exact same UI as All Reviews) */}
        <div className="pt-5 border-t border-theme-border/40 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[16px] font-medium text-theme-text">Your previous reviews</h3>
            {userReviews.length > 0 && (
              <span className="text-xs text-theme-text-muted">
                {userReviews.length} {userReviews.length === 1 ? 'review' : 'reviews'}
              </span>
            )}
          </div>

          {/* EMPTY STATE (Matching All Reviews empty state style) */}
          {userReviews.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <p className="text-sm text-theme-text-muted">No previous reviews yet</p>
              <p className="text-xs text-theme-text-muted/80 mt-1 max-w-[260px] leading-relaxed">
                Reviews you write on apps will appear here for easy management.
              </p>
            </div>
          ) : (
            /* PREVIOUS REVIEWS LIST (Identical item structure as All Reviews page) */
            <div className="flex flex-col gap-4">
              {userReviews.map((review) => {
                const isCurrentAppReview = review.appId === app.id;
                const isCurrentlyBeingEdited = review.id === targetReviewId;
                
                return (
                  <div 
                    key={review.id} 
                    className={`flex flex-col pb-4 border-b border-theme-border/30 last:border-0 rounded-2xl p-3 transition-all animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                      isCurrentlyBeingEdited 
                        ? 'bg-blue-500/10 border border-blue-500/30 shadow-xs' 
                        : 'hover:bg-theme-hover/30'
                    }`}
                  >
                    {/* Header with App Icon, App Name & Badge */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3 min-w-0">
                        {(review.appIcon || app.iconUrl) ? (
                          <img 
                            src={review.appIcon || app.iconUrl} 
                            alt={review.appName} 
                            className="w-8 h-8 rounded-lg object-cover shrink-0 border border-theme-border/40" 
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg shrink-0 bg-blue-600 flex items-center justify-center text-white text-xs font-bold border border-theme-border/40">
                            {review.appName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                          <span className="text-[14px] font-medium text-theme-text truncate">{review.appName}</span>
                          {isCurrentAppReview && (
                            <span className="text-[10px] bg-blue-500/15 text-blue-400 font-medium px-1.5 py-0.5 rounded shrink-0">
                              This app
                            </span>
                          )}
                          {isCurrentlyBeingEdited && (
                            <span className="text-[10px] bg-blue-600 text-white font-medium px-1.5 py-0.5 rounded shrink-0">
                              Editing
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuReviewId(openMenuReviewId === review.id ? null : review.id);
                          }}
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
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuReviewId(null);
                                  handleSelectToEdit(review);
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
                                  setDeletingReviewId({ appId: review.appId, reviewId: review.id, appName: review.appName });
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-theme-hover text-red-400 text-sm font-medium transition-colors cursor-pointer"
                              >
                                Delete review
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Star rating and Date */}
                    <div className="flex items-center gap-2 text-xs text-theme-text-muted mb-2">
                      <div className="flex text-amber-400">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <span key={i} className={i <= review.rating ? 'text-amber-400' : 'text-zinc-400 dark:text-zinc-600'}>
                            ★
                          </span>
                        ))}
                      </div>
                      <span>{review.date}</span>
                    </div>

                    {/* Review text */}
                    <p className="text-[14px] text-theme-text leading-relaxed mb-3 whitespace-pre-wrap">
                      {review.text}
                    </p>

                    {/* Review Attached Photos */}
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

                    {/* Developer Response */}
                    {review.reply && (
                      <div className="w-full bg-[#181818] dark:bg-[#181818] bg-zinc-100 rounded-2xl p-4 mt-3 min-h-[96px] flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[14px] font-normal text-theme-text truncate pr-2">
                            {review.reply.authorName || review.appName}
                          </span>
                          <span className="text-xs text-theme-text-muted shrink-0">{review.reply.date}</span>
                        </div>
                        <p className="text-[14px] text-theme-text leading-relaxed whitespace-pre-wrap min-h-[44px]">
                          {review.reply.text}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
            </div>
          </div>
        </main>
      </div>

      {/* Delete Confirmation Dialog (standardized with app remove dialog) */}
      <ConfirmationDialog
        isOpen={Boolean(deletingReviewId)}
        title="Delete review?"
        description={
          deletingReviewId ? (
            <span>
              Are you sure you want to permanently delete your review for{' '}
              <strong className="font-medium text-theme-text">{deletingReviewId.appName}</strong>? This action cannot be undone.
            </span>
          ) : (
            'Are you sure you want to permanently delete your review? This action cannot be undone.'
          )
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isDestructive={true}
        icon="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingReviewId(null)}
      />

      {/* Image Lightbox Viewer */}
      <MediaGalleryLightbox
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        mediaItems={activeLightboxImages.map(img => ({ type: 'image' as const, url: img, title: 'Review Photo' }))}
        initialIndex={lightboxIndex}
        appName={app.name}
      />
      </div>
    </div>
  );
}
