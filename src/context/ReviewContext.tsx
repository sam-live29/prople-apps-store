import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { Review, AppDetails, MAX_REVIEW_CHARACTERS, MAX_REPLY_CHARACTERS } from '../types';
import { appDetailsMock, suggestedApps, topChartsApps } from '../data';

const EMPTY_REVIEWS: Review[] = [];
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import {
  initializeFirestoreCatalogue,
  listenToAppReviews,
  addAppReviewToFirestore,
  updateAppReviewInFirestore,
  deleteAppReviewFromFirestore,
  replyToAppReviewInFirestore,
  voteAppReviewInFirestore
} from '../services/firestoreAppService';
import {
  notifyPublisherNewReview,
  notifyPublisherReviewUpdated,
  notifyUserReviewReply,
  notifyUserReviewDeleted,
  notifyUserReviewHelpful
} from '../services/firestoreNotificationService';
import { AdminModerationService } from '../services/adminModerationService';

interface ReviewWithAppInfo extends Review {
  appId: string;
  appName: string;
  appIcon: string;
  appDeveloper: string;
}

interface ReviewContextType {
  reviewsMap: Record<string, Review[]>;
  userVotes: Record<string, 'yes' | 'no'>;
  flaggedReviewIds: string[];
  getAppReviews: (appId: string) => Review[];
  getUserReviews: () => ReviewWithAppInfo[];
  getPublisherAppsReviews: () => ReviewWithAppInfo[];
  getPublisherReplies: () => ReviewWithAppInfo[];
  getPendingPublisherReviews: () => ReviewWithAppInfo[];
  addReview: (appId: string, review: Omit<Review, 'id' | 'date'>) => Promise<void>;
  updateReview: (appId: string, reviewId: string, partial: Partial<Review>) => Promise<void>;
  deleteReview: (appId: string, reviewId: string, moderationInfo?: { reason?: string; appName?: string; targetUser?: { id?: string; name?: string; email?: string } }) => Promise<void>;
  addOrUpdatePublisherReply: (appId: string, reviewId: string, replyText: string) => Promise<boolean>;
  deletePublisherReply: (appId: string, reviewId: string) => Promise<boolean>;
  voteHelpful: (appId: string, reviewId: string, isHelpful: boolean) => void;
  toggleHelpfulVote: (appId: string, reviewId: string, vote: 'yes' | 'no') => void;
  canReplyAsPublisher: (appDeveloper?: string, appId?: string) => boolean;
  flagReview: (appId: string, reviewId: string, reason?: string) => void;
  isReviewFlagged: (reviewId: string) => boolean;
}

const ReviewContext = createContext<ReviewContextType | undefined>(undefined);

const LOCAL_STORAGE_REVIEWS_KEY = 'appmarket_reviews_store_v5';
const LOCAL_STORAGE_VOTES_KEY = 'appmarket_user_votes_v2';
const LOCAL_STORAGE_FLAGGED_KEY = 'appmarket_flagged_reviews_v2';

// Seed initial reviews map from mock data as instant fallback
const getInitialReviewsMap = (): Record<string, Review[]> => {
  const map: Record<string, Review[]> = {};
  
  Object.values(appDetailsMock).forEach((app) => {
    if (app.id && app.reviews) {
      map[app.id] = app.reviews.map(r => ({
        ...r,
        appId: app.id,
        appName: app.name,
        appIcon: app.iconUrl,
        reply: r.reply ? {
          ...r.reply,
          authorName: app.developer || 'Developer',
          isVerifiedPublisher: true,
          authorRole: 'Verified Developer'
        } : undefined
      }));
    }
  });

  return map;
};

export function ReviewProvider({ children }: { children: ReactNode }) {
  const { user, isPublisher, isPublisherOfApp } = useAuth();
  const { showToast } = useToast();

  const [reviewsMap, setReviewsMap] = useState<Record<string, Review[]>>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_REVIEWS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load reviews cache', e);
    }
    return getInitialReviewsMap();
  });

  const [userVotes, setUserVotes] = useState<Record<string, 'yes' | 'no'>>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_VOTES_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load user votes', e);
    }
    return {};
  });

  const [flaggedReviewIds, setFlaggedReviewIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_FLAGGED_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load flagged reviews', e);
    }
    return [];
  });

  const activeListenersRef = useRef<Record<string, () => void>>({});

  // 1. Initialize Firestore catalogue (reviews are subscribed on-demand per app to avoid flooding connection)
  useEffect(() => {
    initializeFirestoreCatalogue().catch(err => {
      console.warn('Catalogue seed notification:', err);
    });

    return () => {
      Object.keys(activeListenersRef.current).forEach(key => {
        const unsub = activeListenersRef.current[key];
        if (typeof unsub === 'function') {
          unsub();
        }
      });
      activeListenersRef.current = {};
    };
  }, []);

  // Save flagged reviews to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_FLAGGED_KEY, JSON.stringify(flaggedReviewIds));
    } catch (e) {
      console.warn('Failed to save flagged reviews', e);
    }
  }, [flaggedReviewIds]);

  // Save votes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_VOTES_KEY, JSON.stringify(userVotes));
    } catch (e) {
      console.warn('Failed to save user votes', e);
    }
  }, [userVotes]);

  // Save reviews cache to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_REVIEWS_KEY, JSON.stringify(reviewsMap));
    } catch (e) {
      console.warn('Failed to save reviews cache', e);
    }
  }, [reviewsMap]);

  const getAppReviews = (appId: string): Review[] => {
    // If not subscribed yet, listen dynamically
    if (!activeListenersRef.current[appId]) {
      activeListenersRef.current[appId] = listenToAppReviews(appId, (firestoreReviews) => {
        setReviewsMap(prev => ({
          ...prev,
          [appId]: firestoreReviews || []
        }));
      });
    }
    return reviewsMap[appId] || EMPTY_REVIEWS;
  };

  const canReplyAsPublisher = (appDeveloper?: string, appId?: string): boolean => {
    if (!user || !isPublisher) return false;
    return isPublisherOfApp(appDeveloper, appId);
  };

  const getAppMetadata = (appId: string) => {
    const detail = appDetailsMock[appId];
    if (detail) {
      return {
        name: detail.name,
        icon: detail.iconUrl,
        developer: detail.developer,
        developerId: detail.developerId || detail.creatorUid,
        developerEmail: detail.developerEmail || detail.developerInfo?.email
      };
    }
    const all = [...suggestedApps, ...topChartsApps];
    const found = all.find(a => a.id === appId);
    return {
      name: found?.name || 'Application',
      icon: found?.iconUrl || '',
      developer: found?.developer || 'Developer',
      developerId: undefined,
      developerEmail: undefined
    };
  };

  const getUserReviews = useCallback((): ReviewWithAppInfo[] => {
    const list: ReviewWithAppInfo[] = [];
    const currentUid = user?.uid || 'u-me';
    const currentName = user?.displayName || 'You';

    Object.keys(reviewsMap).forEach((appId) => {
      const reviews = reviewsMap[appId] || [];
      const appMeta = getAppMetadata(appId);
      reviews.forEach(r => {
        if (r.userId === currentUid || r.userId === 'u-me' || r.userName === currentName || r.userName === 'You') {
          list.push({
            ...r,
            appId,
            appName: appMeta.name || r.appName,
            appIcon: appMeta.icon || r.appIcon,
            appDeveloper: appMeta.developer || r.appDeveloper
          });
        }
      });
    });

    return list;
  }, [reviewsMap, user?.uid, user?.displayName]);

  const getPublisherAppsReviews = useCallback((): ReviewWithAppInfo[] => {
    const list: ReviewWithAppInfo[] = [];
    if (!isPublisher) return list;

    Object.keys(reviewsMap).forEach((appId) => {
      const reviews = reviewsMap[appId] || [];
      const appMeta = getAppMetadata(appId);
      if (canReplyAsPublisher(appMeta.developer, appId)) {
        reviews.forEach(r => {
          list.push({
            ...r,
            appId,
            appName: appMeta.name || r.appName,
            appIcon: appMeta.icon || r.appIcon,
            appDeveloper: appMeta.developer || r.appDeveloper
          });
        });
      }
    });

    return list;
  }, [reviewsMap, isPublisher, user]);

  const getPublisherReplies = useCallback((): ReviewWithAppInfo[] => {
    const list: ReviewWithAppInfo[] = [];
    if (!isPublisher) return list;

    Object.keys(reviewsMap).forEach((appId) => {
      const reviews = reviewsMap[appId] || [];
      const appMeta = getAppMetadata(appId);
      if (canReplyAsPublisher(appMeta.developer, appId)) {
        reviews.forEach(r => {
          if (r.reply) {
            list.push({
              ...r,
              appId,
              appName: appMeta.name || r.appName,
              appIcon: appMeta.icon || r.appIcon,
              appDeveloper: appMeta.developer || r.appDeveloper
            });
          }
        });
      }
    });

    return list;
  }, [reviewsMap, isPublisher, user]);

  const getPendingPublisherReviews = (): ReviewWithAppInfo[] => {
    const list: ReviewWithAppInfo[] = [];
    if (!isPublisher) return list;

    Object.keys(reviewsMap).forEach((appId) => {
      const reviews = reviewsMap[appId] || [];
      const appMeta = getAppMetadata(appId);
      if (canReplyAsPublisher(appMeta.developer, appId)) {
        reviews.forEach(r => {
          if (!r.reply) {
            list.push({
              ...r,
              appId,
              appName: r.appName || appMeta.name,
              appIcon: r.appIcon || appMeta.icon,
              appDeveloper: appMeta.developer
            });
          }
        });
      }
    });

    return list;
  };

  const addReview = async (appId: string, reviewData: Omit<Review, 'id' | 'date'>) => {
    const appMeta = getAppMetadata(appId);
    const reviewId = `rev-${Date.now()}`;
    const sanitizedText = (reviewData.text || '').trim().slice(0, MAX_REVIEW_CHARACTERS);
    const newReview: Review = {
      ...reviewData,
      text: sanitizedText,
      id: reviewId,
      appId,
      appName: appMeta.name,
      appIcon: appMeta.icon,
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      helpfulCount: 0
    };

    // Optimistic local update
    setReviewsMap(prev => {
      const existing = prev[appId] || [];
      return {
        ...prev,
        [appId]: [newReview, ...existing.filter(r => r.id !== reviewId)]
      };
    });

    // Realtime Firestore persistence
    try {
      await addAppReviewToFirestore(appId, newReview);
    } catch (err) {
      console.warn('Realtime Firestore review write error:', err);
    }

    // Realtime notification ONLY for the verified publisher of this app
    notifyPublisherNewReview(
      appId,
      appMeta.name,
      newReview,
      appMeta.icon,
      {
        developerId: appMeta.developerId,
        developerEmail: appMeta.developerEmail,
        developerName: appMeta.developer
      }
    ).catch(e => console.warn('notifyPublisherNewReview error:', e));
  };

  const updateReview = async (appId: string, reviewId: string, partial: Partial<Review>) => {
    const sanitizedPartial: Partial<Review> = { ...partial };
    if (sanitizedPartial.text !== undefined) {
      sanitizedPartial.text = sanitizedPartial.text.trim().slice(0, MAX_REVIEW_CHARACTERS);
    }

    const appMeta = getAppMetadata(appId);
    let updatedReviewObj: Review | undefined;

    // Optimistic local update
    setReviewsMap(prev => {
      const existing = prev[appId] || [];
      return {
        ...prev,
        [appId]: existing.map(r => {
          if (r.id === reviewId) {
            updatedReviewObj = { ...r, ...sanitizedPartial };
            return updatedReviewObj;
          }
          return r;
        })
      };
    });

    // Realtime Firestore persistence
    try {
      await updateAppReviewInFirestore(appId, reviewId, sanitizedPartial);
    } catch (err) {
      console.warn('Realtime Firestore review update error:', err);
    }

    // Trigger publisher notification for updated review
    if (updatedReviewObj) {
      notifyPublisherReviewUpdated(
        appId,
        appMeta.name,
        {
          userName: updatedReviewObj.userName,
          rating: updatedReviewObj.rating,
          text: updatedReviewObj.text
        },
        appMeta.icon,
        {
          developerId: appMeta.developerId,
          developerEmail: appMeta.developerEmail,
          developerName: appMeta.developer
        }
      ).catch(e => console.warn('notifyPublisherReviewUpdated error:', e));
    }
  };

  const deleteReview = async (
    appId: string, 
    reviewId: string,
    moderationInfo?: { reason?: string; appName?: string; targetUser?: { id?: string; name?: string; email?: string } }
  ) => {
    // Find target review before deleting to extract user info if not passed
    const targetReview = (reviewsMap[appId] || []).find(r => r.id === reviewId) ||
      (appDetailsMock[appId]?.reviews || []).find(r => r.id === reviewId);

    // Optimistic local update
    setReviewsMap(prev => {
      const existing = prev[appId] || [];
      return {
        ...prev,
        [appId]: existing.filter(r => r.id !== reviewId)
      };
    });

    // Realtime Firestore persistence
    try {
      await deleteAppReviewFromFirestore(appId, reviewId);
    } catch (err) {
      console.warn('Realtime Firestore review delete error:', err);
    }

    // Direct notification to user in Notification Centre and phone native notification
    if (moderationInfo) {
      const appMeta = getAppMetadata(appId);
      const userId = moderationInfo.targetUser?.id || targetReview?.userId;
      const userName = moderationInfo.targetUser?.name || targetReview?.author;
      const userEmail = moderationInfo.targetUser?.email || targetReview?.userEmail;
      notifyUserReviewDeleted({
        appId,
        appName: moderationInfo.appName || appMeta.name,
        reviewId,
        userId,
        userName,
        userEmail,
        reason: moderationInfo.reason || 'Violated community guidelines'
      }).catch((err) => {
        console.warn('Failed to send review deleted notification:', err);
      });
    }
  };

  const addOrUpdatePublisherReply = async (appId: string, reviewId: string, replyText: string): Promise<boolean> => {
    const appMeta = getAppMetadata(appId);
    if (!isPublisher || !canReplyAsPublisher(appMeta.developer, appId)) {
      showToast('Publisher privileges required to respond as developer');
      return false;
    }

    const publisherAuthor = user?.publisherName || user?.displayName || appMeta.developer || 'Developer';
    const replyDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
    const trimmedReply = replyText.trim().slice(0, MAX_REPLY_CHARACTERS);
    const replyObj = {
      date: replyDate,
      text: trimmedReply,
      authorName: publisherAuthor,
      authorRole: user?.publisherRole || 'Verified Publisher',
      isVerifiedPublisher: true
    };

    // Optimistic local update
    setReviewsMap(prev => {
      const existing = prev[appId] || [];
      return {
        ...prev,
        [appId]: existing.map(r => {
          if (r.id === reviewId) {
            return {
              ...r,
              reply: replyObj
            };
          }
          return r;
        })
      };
    });

    // Realtime Firestore persistence
    try {
      await replyToAppReviewInFirestore(appId, reviewId, replyObj);
    } catch (err) {
      console.warn('Realtime Firestore reply write error:', err);
    }

    // Notify ONLY the user who wrote this review that the publisher replied
    const targetReview = (reviewsMap[appId] || []).find(r => r.id === reviewId) ||
      (appDetailsMock[appId]?.reviews || []).find(r => r.id === reviewId);

    if (targetReview) {
      notifyUserReviewReply(
        appId,
        appMeta.name,
        targetReview,
        replyText.trim(),
        publisherAuthor,
        appMeta.icon
      ).catch(e => console.warn('notifyUserReviewReply error:', e));
    }

    showToast('Publisher reply published successfully');
    return true;
  };

  const deletePublisherReply = async (appId: string, reviewId: string): Promise<boolean> => {
    const appMeta = getAppMetadata(appId);
    if (!isPublisher || !canReplyAsPublisher(appMeta.developer, appId)) {
      showToast('Publisher privileges required to modify response');
      return false;
    }

    setReviewsMap(prev => {
      const existing = prev[appId] || [];
      return {
        ...prev,
        [appId]: existing.map(r => {
          if (r.id === reviewId) {
            const { reply, ...rest } = r;
            return rest as Review;
          }
          return r;
        })
      };
    });

    try {
      await updateAppReviewInFirestore(appId, reviewId, { reply: undefined });
    } catch (err) {
      console.warn('Realtime Firestore reply delete error:', err);
    }

    showToast('Publisher reply removed');
    return true;
  };

  const toggleHelpfulVote = (appId: string, reviewId: string, vote: 'yes' | 'no') => {
    const currentVote = userVotes[reviewId];

    if (currentVote === vote) {
      // Toggle off / remove vote
      setUserVotes(prev => {
        const next = { ...prev };
        delete next[reviewId];
        return next;
      });

      if (vote === 'yes') {
        setReviewsMap(prev => {
          const existing = prev[appId] || [];
          return {
            ...prev,
            [appId]: existing.map(r => r.id === reviewId ? { ...r, helpfulCount: Math.max(0, (r.helpfulCount || 0) - 1) } : r)
          };
        });
      }

      voteAppReviewInFirestore(appId, reviewId, vote === 'yes' ? 'no' : 'yes', vote).catch(console.warn);
    } else {
      // New or switched vote
      setUserVotes(prev => ({
        ...prev,
        [reviewId]: vote
      }));

      setReviewsMap(prev => {
        const existing = prev[appId] || [];
        return {
          ...prev,
          [appId]: existing.map(r => {
            if (r.id === reviewId) {
              let newCount = r.helpfulCount || 0;
              if (vote === 'yes') {
                newCount += 1;
              } else if (currentVote === 'yes') {
                newCount = Math.max(0, newCount - 1);
              }
              return { ...r, helpfulCount: newCount };
            }
            return r;
          })
        };
      });

      voteAppReviewInFirestore(appId, reviewId, vote, currentVote).catch(console.warn);
      showToast('Thank you for your feedback');

      // If user voted yes, notify review author that their review was helpful
      if (vote === 'yes') {
        const appMeta = getAppMetadata(appId);
        const targetReview = (reviewsMap[appId] || []).find(r => r.id === reviewId) ||
          (appDetailsMock[appId]?.reviews || []).find(r => r.id === reviewId);
        if (targetReview) {
          const currentHelpful = (targetReview.helpfulCount || 0) + 1;
          notifyUserReviewHelpful({
            appId,
            appName: appMeta.name,
            reviewId,
            helpfulCount: currentHelpful,
            userId: targetReview.userId,
            userName: targetReview.userName,
            userEmail: (targetReview as any).userEmail,
            iconUrl: appMeta.icon
          }).catch(e => console.warn('notifyUserReviewHelpful error:', e));
        }
      }
    }
  };

  const voteHelpful = (appId: string, reviewId: string, isHelpful: boolean) => {
    toggleHelpfulVote(appId, reviewId, isHelpful ? 'yes' : 'no');
  };

  const flagReview = (appId: string, reviewId: string, reason: string = 'Inappropriate content') => {
    if (!flaggedReviewIds.includes(reviewId)) {
      setFlaggedReviewIds(prev => [...prev, reviewId]);
    }

    const currentReviews = reviewsMap[appId] || [];
    const targetRev = currentReviews.find(r => r.id === reviewId);

    setReviewsMap(prev => {
      const existing = prev[appId] || [];
      return {
        ...prev,
        [appId]: existing.map(r => r.id === reviewId ? { ...r, isFlagged: true, flagReason: reason } : r)
      };
    });

    if (targetRev) {
      try {
        AdminModerationService.recordReviewReport(
          { id: appId, name: (targetRev as any).appName || 'Prople Store App' },
          {
            id: reviewId,
            author: targetRev.author,
            email: targetRev.email,
            avatar: targetRev.avatar,
            rating: targetRev.rating,
            comment: targetRev.comment
          },
          reason
        );
      } catch (err) {
        console.warn('Failed to record review moderation report', err);
      }
    }

    updateAppReviewInFirestore(appId, reviewId, { isFlagged: true, flagReason: reason }).catch(console.warn);
    showToast('Review flagged as inappropriate. Sent for moderation.');
  };

  const isReviewFlagged = (reviewId: string): boolean => {
    return flaggedReviewIds.includes(reviewId);
  };

  return (
    <ReviewContext.Provider
      value={{
        reviewsMap,
        userVotes,
        flaggedReviewIds,
        getAppReviews,
        getUserReviews,
        getPublisherAppsReviews,
        getPublisherReplies,
        getPendingPublisherReviews,
        addReview,
        updateReview,
        deleteReview,
        addOrUpdatePublisherReply,
        deletePublisherReply,
        voteHelpful,
        toggleHelpfulVote,
        canReplyAsPublisher,
        flagReview,
        isReviewFlagged
      }}
    >
      {children}
    </ReviewContext.Provider>
  );
}

export function useReviews() {
  const context = useContext(ReviewContext);
  if (!context) {
    throw new Error('useReviews must be used within a ReviewProvider');
  }
  return context;
}
