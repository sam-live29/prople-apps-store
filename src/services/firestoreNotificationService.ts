import { 
  collection, 
  doc, 
  getDoc,
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { NotificationItem, NotificationCategory, AppDetails, UserProfile } from '../types';
import { appDetailsMock } from '../data';

const NOTIFS_COLLECTION = 'notifications';

/**
 * Format relative timestamp string from epoch ms
 */
export function formatNotificationTimestamp(createdAt?: number): string {
  if (!createdAt) return 'Just now';
  const now = Date.now();
  const diffSec = Math.floor((now - createdAt) / 1000);

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const LOCAL_STORE_NOTIFS_KEY = 'prople_store_notifications_v5';

/**
 * Realtime listener for all database notifications
 */
export function listenToStoreNotifications(
  onUpdate: (notifications: NotificationItem[]) => void,
  onError?: (err: any) => void
): () => void {
  // Immediately emit cached items to eliminate loading flash
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(LOCAL_STORE_NOTIFS_KEY);
      if (raw) {
        const cached: NotificationItem[] = JSON.parse(raw);
        if (Array.isArray(cached) && cached.length > 0) {
          onUpdate(cached);
        }
      }
    } catch {}
  }

  const handleCustomUpdate = (e: Event) => {
    const customEvent = e as CustomEvent<NotificationItem[]>;
    if (customEvent.detail && Array.isArray(customEvent.detail)) {
      onUpdate(customEvent.detail);
    } else if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(LOCAL_STORE_NOTIFS_KEY);
        if (raw) onUpdate(JSON.parse(raw));
      } catch {}
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('prople:notifications:updated', handleCustomUpdate);
  }

  try {
    const colRef = collection(db, NOTIFS_COLLECTION);

    const unsubFirestore = onSnapshot(
      colRef,
      (snapshot) => {
        const items: NotificationItem[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          const docId = d.id;

          // Filter out legacy hardcoded placeholder documents and download count spam in memory
          if (
            docId.includes('brick-stack') || 
            data.appId === 'app-brick-stack' || 
            data.title?.toLowerCase().includes('brick stack') ||
            docId === 'notif-security-scan' ||
            data.actionType === 'security_check' ||
            data.category === 'download_count' ||
            docId.startsWith('notif-dl-verified-') ||
            docId.startsWith('notif-milestone-') ||
            data.title?.toLowerCase().includes('download verified') ||
            data.title?.toLowerCase().includes('official download') ||
            data.title?.toLowerCase().includes('download milestone') ||
            data.message?.toLowerCase().includes('verified download recorded') ||
            data.message?.toLowerCase().includes('total downloads')
          ) {
            return;
          }

          const createdAt = typeof data.createdAt === 'number' 
            ? data.createdAt 
            : data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now();

          items.push({
            id: docId,
            title: data.title || 'Notification',
            message: data.message || '',
            timestamp: formatNotificationTimestamp(createdAt),
            iconUrl: data.iconUrl || '',
            appId: data.appId || undefined,
            actionType: data.actionType || (data.appId ? 'app_detail' : undefined),
            actionUrl: data.actionUrl || undefined,
            actionLabel: data.actionLabel || (data.appId ? 'Open app details' : undefined),
            isUnread: data.isUnread !== false,
            createdAt,
            category: data.category || undefined,
            targetType: data.targetType || undefined,
            targetUid: data.targetUid || undefined,
            targetUserName: data.targetUserName || undefined,
            targetEmail: data.targetEmail || undefined,
            publisherAppId: data.publisherAppId || undefined,
            publisherUid: data.publisherUid || undefined,
            publisherEmail: data.publisherEmail || undefined,
            publisherName: data.publisherName || undefined
          });
        });

        // Merge with locally queued broadcast items if any exist
        if (typeof window !== 'undefined') {
          try {
            const raw = localStorage.getItem(LOCAL_STORE_NOTIFS_KEY);
            if (raw) {
              const localItems: NotificationItem[] = JSON.parse(raw);
              localItems.forEach(loc => {
                if (!items.some(it => it.id === loc.id)) {
                  items.push(loc);
                }
              });
            }
          } catch {}
        }

        // Sort descending by creation time in memory
        items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(LOCAL_STORE_NOTIFS_KEY, JSON.stringify(items.slice(0, 100)));
          } catch {}
        }

        onUpdate(items);
      },
      (err) => {
        console.warn('listenToStoreNotifications error:', err);
        if (onError) onError(err);
      }
    );

    return () => {
      unsubFirestore();
      if (typeof window !== 'undefined') {
        window.removeEventListener('prople:notifications:updated', handleCustomUpdate);
      }
    };
  } catch (err) {
    console.warn('listenToStoreNotifications setup error:', err);
    if (onError) onError(err);
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('prople:notifications:updated', handleCustomUpdate);
      }
    };
  }
}

/**
 * Add a real notification to Firestore database
 */
export async function addNotificationToFirestore(
  item: Omit<NotificationItem, 'id'> & { id?: string }
): Promise<string> {
  // Download count increments and verified download events are app metrics recorded on the app document.
  // Never add them to notification feeds or local storage to prevent owner notification spam and cross-app interference.
  if (
    item.category === 'download_count' ||
    item.id?.startsWith('notif-dl-verified-') ||
    item.id?.startsWith('notif-milestone-') ||
    item.title?.toLowerCase().includes('download verified') ||
    item.title?.toLowerCase().includes('official download') ||
    item.title?.toLowerCase().includes('download milestone') ||
    item.message?.toLowerCase().includes('verified download recorded') ||
    item.message?.toLowerCase().includes('total downloads')
  ) {
    return item.id || '';
  }

  const notifId = item.id || `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = item.createdAt || Date.now();

  const formattedItem: NotificationItem = {
    id: notifId,
    title: item.title,
    message: item.message,
    timestamp: formatNotificationTimestamp(now),
    iconUrl: item.iconUrl || '',
    appId: item.appId || undefined,
    actionType: item.actionType || (item.appId ? 'app_detail' : undefined),
    actionUrl: item.actionUrl || undefined,
    actionLabel: item.actionLabel || (item.appId ? 'Open app details' : undefined),
    isUnread: item.isUnread !== undefined ? item.isUnread : true,
    createdAt: now,
    category: item.category || undefined,
    targetType: item.targetType || 'all',
    targetUid: item.targetUid || undefined,
    targetUserName: item.targetUserName || undefined,
    targetEmail: item.targetEmail || undefined,
    publisherAppId: item.publisherAppId || undefined,
    publisherUid: item.publisherUid || undefined,
    publisherEmail: item.publisherEmail || undefined,
    publisherName: item.publisherName || undefined
  };

  // 1. Immediately cache locally and dispatch custom event so UI updates with zero delay
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(LOCAL_STORE_NOTIFS_KEY);
      let list: NotificationItem[] = raw ? JSON.parse(raw) : [];
      list = list.filter(n => n.id !== notifId);
      list.unshift(formattedItem);
      localStorage.setItem(LOCAL_STORE_NOTIFS_KEY, JSON.stringify(list.slice(0, 100)));
      window.dispatchEvent(new CustomEvent('prople:notifications:updated', { detail: list }));
    } catch {}
  }

  // 2. Persist to Firestore
  try {
    const docRef = doc(db, NOTIFS_COLLECTION, notifId);
    const payload = {
      title: item.title,
      message: item.message,
      iconUrl: item.iconUrl || '',
      appId: item.appId || null,
      actionType: item.actionType || (item.appId ? 'app_detail' : null),
      actionUrl: item.actionUrl || null,
      actionLabel: item.actionLabel || (item.appId ? 'Open app details' : null),
      isUnread: item.isUnread !== undefined ? item.isUnread : true,
      createdAt: now,
      creatorUid: auth.currentUser?.uid || null,
      category: item.category || null,
      targetType: item.targetType || 'all',
      targetUid: item.targetUid || null,
      targetUserName: item.targetUserName || null,
      targetEmail: item.targetEmail || null,
      publisherAppId: item.publisherAppId || (item.targetType === 'publisher' ? item.appId || null : null),
      publisherUid: item.publisherUid || null,
      publisherEmail: item.publisherEmail || null,
      publisherName: item.publisherName || null
    };

    await setDoc(docRef, payload, { merge: true });
  } catch (err) {
    console.warn('Persist notification to Firestore error (cached locally):', err);
  }

  // Server-authoritative fallback for administrators
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('appmarket_user_profile') : null;
    let email = (item as any)?.senderEmail || auth.currentUser?.email || (raw ? JSON.parse(raw)?.email : '');
    if (!email && typeof window !== 'undefined') {
      try {
        const adminEmail = localStorage.getItem('prople_admin_email');
        if (adminEmail) email = adminEmail;
      } catch {}
    }
    if (!email) {
      email = auth.currentUser?.email || 'admin@prople.co.in';
    }
    if (email) {
      fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: email, action: 'send', notification: formattedItem, notificationId: notifId })
      }).catch(() => {});
    }
  } catch {}

  return notifId;
}

/**
 * Storage key to track notifications that have already triggered a native system/phone notification on this device
 */
export const PUSHED_NATIVE_NOTIFS_STORAGE_KEY = 'prople_pushed_native_notif_ids_v2';

export function getPushedNativeNotifIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(PUSHED_NATIVE_NOTIFS_STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch {}
  return new Set();
}

export function recordNativeNotifPushed(id: string): void {
  if (typeof window === 'undefined' || !id) return;
  try {
    const set = getPushedNativeNotifIds();
    set.add(id);
    const arr = Array.from(set).slice(-300);
    localStorage.setItem(PUSHED_NATIVE_NOTIFS_STORAGE_KEY, JSON.stringify(arr));
  } catch {}
}

/**
 * Request native phone/browser notification permission
 */
export async function requestPhoneNotificationPermission(): Promise<NotificationPermission | null> {
  if (typeof window === 'undefined' || !('Notification' in window)) return null;
  try {
    if (Notification.permission === 'default') {
      const result = await Notification.requestPermission();
      return result;
    }
    return Notification.permission;
  } catch (err) {
    console.warn('requestPhoneNotificationPermission error:', err);
    return null;
  }
}

/**
 * In-memory registry to prevent duplicate notification triggers across
 * immediate caller dispatches and real-time Firestore onSnapshot listeners.
 */
const recentlyDispatchedNotifKeys = new Map<string, number>();

export function markNotificationDispatched(key: string): void {
  if (!key) return;
  const normalized = key.replace(/^(global|direct)-/, '');
  const now = Date.now();
  recentlyDispatchedNotifKeys.set(key, now);
  recentlyDispatchedNotifKeys.set(normalized, now);
}

export function isNotificationRecentlyDispatched(key: string, windowMs = 20000): boolean {
  if (!key) return false;
  const normalized = key.replace(/^(global|direct)-/, '');
  const now = Date.now();
  const t1 = recentlyDispatchedNotifKeys.get(key);
  const t2 = recentlyDispatchedNotifKeys.get(normalized);
  if (t1 && now - t1 < windowMs) return true;
  if (t2 && now - t2 < windowMs) return true;
  return false;
}

/**
 * Trigger real phone/system native notification using Web Notifications & Service Worker
 */
export async function showPhoneNativeNotification(
  title: string,
  options?: {
    body?: string;
    icon?: string;
    badge?: string;
    tag?: string;
    data?: any;
    vibrate?: number[];
  }
): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;

  const rawTag = options?.tag || '';
  const textKey = `${title.trim()}:::${(options?.body || '').trim()}`;

  // Deduplication check: prevent multiple triggers for the same notice within the debounce window
  if (
    (rawTag && isNotificationRecentlyDispatched(rawTag)) ||
    isNotificationRecentlyDispatched(textKey)
  ) {
    return false;
  }

  // Mark as dispatched immediately
  if (rawTag) {
    markNotificationDispatched(rawTag);
    recordNativeNotifPushed(rawTag);
  }
  markNotificationDispatched(textKey);

  // Clean stale keys
  const now = Date.now();
  if (recentlyDispatchedNotifKeys.size > 200) {
    for (const [k, time] of recentlyDispatchedNotifKeys.entries()) {
      if (now - time > 60000) recentlyDispatchedNotifKeys.delete(k);
    }
  }

  try {
    // Only dispatch system push if permission was already granted by user.
    // Never interrupt the user with unprompted permission dialogs or browser loading lines during background actions.
    if (Notification.permission !== 'granted') {
      return false;
    }

    const defaultIcon = '/pwa-192x192.png';
    const notifOptions: NotificationOptions = {
      body: options?.body || '',
      icon: options?.icon || defaultIcon,
      badge: options?.badge || defaultIcon,
      tag: options?.tag || `notif-${Date.now()}`,
      data: options?.data || { url: '/' },
      vibrate: options?.vibrate || [150, 80, 150],
      requireInteraction: false
    } as any;

    // Prefer existing active serviceWorker registration for mobile Android Chrome and PWA environments
    if ('serviceWorker' in navigator) {
      try {
        let registration = await navigator.serviceWorker.getRegistration();
        if (!registration && 'ready' in navigator.serviceWorker) {
          try {
            registration = await Promise.race([
              navigator.serviceWorker.ready,
              new Promise<any>((resolve) => setTimeout(() => resolve(null), 1000))
            ]);
          } catch {}
        }
        if (registration && typeof registration.showNotification === 'function') {
          await registration.showNotification(title, notifOptions);
          return true;
        }
      } catch (swErr) {
        console.warn('Service worker showNotification warning:', swErr);
      }

      // Fallback: try posting to service worker controller directly without network re-registration
      try {
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'SHOW_NOTIFICATION',
            title,
            options: notifOptions
          });
          return true;
        }
      } catch {}
    }

    // Standard Window Notification fallback for desktop browsers
    try {
      new Notification(title, notifOptions);
      return true;
    } catch {
      return false;
    }
  } catch (err) {
    console.warn('showPhoneNativeNotification error:', err);
    return false;
  }
}

/**
 * Identifies whether a notification is an app update or new release notice.
 * Individual app release notes from publishers are strictly in-app notifications.
 */
export function isAppReleaseOrUpdateNotification(n: NotificationItem): boolean {
  if (!n) return false;
  // If it's a global platform broadcast from admin, it is NOT an individual app update
  if (n.targetType === 'global' || (n.id && n.id.startsWith('notif-global-'))) return false;

  if (n.appId && (n.category === 'app_update' || n.category === 'new_release')) return true;
  const title = (n.title || '').toLowerCase();
  if (
    n.appId && (
      title.startsWith('update available') ||
      title.startsWith('updated:') ||
      title.startsWith('new release') ||
      title.startsWith('new app:')
    )
  ) {
    return true;
  }
  return false;
}

/**
 * Identifies whether a notification is an official GLOBAL BROADCAST from the Admin Panel.
 * Global broadcasts are native Firestore notifications that are pushed to users' phones.
 */
export function isGlobalBroadcastNotification(n: NotificationItem): boolean {
  if (!n) return false;
  if (n.targetType === 'global') return true;
  if (n.id && (n.id.startsWith('notif-global-') || n.id.includes('global'))) return true;
  if (n.category === 'global_notice' || n.category === 'announcement') return true;
  if (n.targetType === 'all' && !n.appId) return true;
  return false;
}

/**
 * Identifies whether a notification is a PUBLIC platform announcement
 * (Global Notices, store-wide broadcasts, platform security alerts).
 * Public announcements are served in Notification Centre AND pushed natively to mobile notifications.
 */
export function isPublicNotification(n: NotificationItem): boolean {
  if (!n) return false;
  // Global broadcasts from admin panel always qualify for native mobile push
  if (isGlobalBroadcastNotification(n)) return true;

  // Single app updates and new releases are kept in the in-app Notification Centre
  if (isAppReleaseOrUpdateNotification(n)) return false;

  if (n.targetType === 'global' || n.category === 'announcement' || n.category === 'global_notice') return true;
  return false;
}

/**
 * Identifies whether a notification is a DEVELOPER / PUBLISHER PRIVATE MATTER
 * (Stars, ratings, reviews, review replies, download counts, developer status).
 * Private matters are NEVER pushed natively to the phone, and are served strictly
 * in the publisher's in-app Notification Centre.
 */
export function isPrivateDeveloperNotification(n: NotificationItem): boolean {
  if (n.targetType === 'publisher') return true;
  if (
    n.category === 'review' ||
    n.category === 'new_review' ||
    n.category === 'review_reply' ||
    n.category === 'download_count'
  ) {
    return true;
  }
  return false;
}

/**
 * Broadcast an in-app notification when a new app is published to the store.
 * Available to all store users strictly in their in-app Notification Centre (no native push).
 */
export async function notifyAppPublished(app: AppDetails): Promise<void> {
  try {
    const notifId = `notif-app-${app.id}-${Date.now()}`;
    const versionStr = app.versionName || app.releaseTag || 'v1.0.0';
    const title = `New Release: ${app.name} ${versionStr}`;
    const message = `${app.name} by ${app.developer || 'Verified Publisher'} is now available for download.`;

    await addNotificationToFirestore({
      id: notifId,
      title,
      message,
      iconUrl: app.iconUrl || '',
      appId: app.id,
      category: 'new_release',
      targetType: 'all',
      actionType: 'app_detail',
      actionLabel: 'Download APK',
      isUnread: true,
      createdAt: Date.now()
    });

    // NOTE: New app releases are strictly delivered as in-app notifications in the Notification Centre
    // and are NOT pushed natively to all users' phones/browsers.
  } catch (e) {
    console.warn('Failed to post app publish notification to Firestore:', e);
  }
}

/**
 * Broadcast an in-app notification when an existing app is updated.
 * Available to all store users strictly in their in-app Notification Centre (no native push).
 */
export async function notifyAppUpdated(app: AppDetails): Promise<void> {
  try {
    const versionStr = app.versionName || app.releaseTag || 'latest';
    const notifId = `notif-update-${app.id}-${Date.now()}`;
    const title = `Update Available: ${app.name} ${versionStr}`;
    const message = `A new update for ${app.name} (${versionStr}) is now available with the latest fixes and improvements.`;

    await addNotificationToFirestore({
      id: notifId,
      title,
      message,
      iconUrl: app.iconUrl || '',
      appId: app.id,
      category: 'app_update',
      targetType: 'all',
      actionType: 'app_detail',
      actionLabel: 'Update APK',
      isUnread: true,
      createdAt: Date.now()
    });

    // NOTE: App updates are strictly delivered as in-app notifications in the Notification Centre
    // and are NOT pushed natively to all users' phones/browsers.
  } catch (e) {
    console.warn('Failed to post app update notification to Firestore:', e);
  }
}

export const DOWNLOAD_MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];

/**
 * Download milestones are tracked in app metrics, not as notification bell items.
 */
export async function notifyPublisherDownloadMilestone(_params: {
  appId: string;
  appName: string;
  milestone: number;
  iconUrl?: string;
  publisherName?: string;
  publisherEmail?: string;
  publisherUid?: string;
}): Promise<void> {
  // Pure metric tracking; intentionally no notification document created.
  return;
}

/**
 * Developer donation reminder milestones: 2, 10, 20, 30, 40...
 * Reminds user to donate after publishing 2 apps, then 10, then 20, then 30, then 40...
 */
export function isPublisherDonationMilestone(count: number): boolean {
  if (count === 2) return true;
  if (count >= 10 && count % 10 === 0) return true;
  return false;
}

export function getEligibleDonationMilestones(publishedCount: number): number[] {
  const milestones: number[] = [];
  if (publishedCount >= 2) milestones.push(2);
  for (let m = 10; m <= publishedCount; m += 10) {
    milestones.push(m);
  }
  return milestones;
}

/**
 * Trigger in-app donation reminder notification for publisher milestone (2, 10, 20, 30, 40 apps).
 * Sent to publisher in Notification Centre with direct action to open donation sustainability popup.
 */
export async function notifyPublisherDonationReminder(params: {
  milestone: number;
  publisherUid?: string;
  publisherEmail?: string;
  publisherName?: string;
}): Promise<void> {
  try {
    const { milestone, publisherUid, publisherEmail, publisherName } = params;
    const notifId = `notif-donation-milestone-${milestone}-${publisherUid || publisherEmail || 'user'}`;
    const title = `Milestone: ${milestone} Apps Published!`;
    const message = `Congratulations on publishing ${milestone} apps on Prople Store! Consider supporting our platform with a small donation.`;

    await addNotificationToFirestore({
      id: notifId,
      title,
      message,
      category: 'donation',
      actionType: 'dev-donation',
      actionLabel: 'Sustain Prople',
      targetType: 'publisher',
      publisherUid,
      publisherEmail,
      publisherName,
      isUnread: true,
      createdAt: Date.now()
    });
  } catch (e) {
    console.warn('Failed to post donation milestone notification:', e);
  }
}

/**
 * Check if download milestone has been crossed (tracked in dashboard analytics, not notification center).
 */
export async function checkAndTriggerDownloadMilestones(
  _appId: string,
  _appName: string,
  _count: number,
  _iconUrl?: string,
  _devInfo?: { developerId?: string; developerEmail?: string; developerName?: string }
): Promise<void> {
  // Pure metric tracking; intentionally no notification document created.
  return;
}

/**
 * Record verified download metrics.
 * Note: Download counts are strictly recorded as app metrics and in the developer dashboard,
 * and are NOT posted as notification documents in the shared Notification Centre,
 * preventing cross-app notification pollution and owner spam.
 */
export async function notifyPublisherDownloadVerified(
  _appId: string, 
  _appName: string, 
  _iconUrl?: string, 
  _newCount?: number,
  _devInfo?: { developerId?: string; developerEmail?: string; developerName?: string }
): Promise<void> {
  // Pure metric tracking; intentionally no notification document created.
  return;
}

/**
 * Post a notification when a user leaves a new review on an app.
 * Given to the publisher of this specific app with native phone notification.
 */
export async function notifyPublisherNewReview(
  appId: string,
  appName: string,
  review: { userName?: string; rating: number; text: string },
  iconUrl?: string,
  devInfo?: { developerId?: string; developerEmail?: string; developerName?: string }
): Promise<void> {
  try {
    let developerId = devInfo?.developerId;
    let developerEmail = devInfo?.developerEmail;
    let developerName = devInfo?.developerName;

    if (!developerId && !developerEmail && !developerName) {
      try {
        const appSnap = await getDoc(doc(db, 'apps', appId));
        if (appSnap.exists()) {
          const d = appSnap.data();
          developerId = d.developerId || d.creatorUid;
          developerEmail = d.developerEmail || d.developerInfo?.email;
          developerName = d.developer;
        }
      } catch {
        const mock = appDetailsMock[appId];
        if (mock) {
          developerId = mock.developerId || mock.creatorUid;
          developerEmail = mock.developerEmail;
          developerName = mock.developer;
        }
      }
    }

    const notifId = `notif-rev-${appId}-${Date.now()}`;
    const cleanUser = review.userName || 'A user';
    const snippet = review.text ? (review.text.length > 70 ? review.text.substring(0, 67) + '...' : review.text) : 'Left a rating';
    const title = `⭐ New ${review.rating}★ Review for ${appName}`;
    const message = `${cleanUser} rated ${review.rating}★: "${snippet}"`;

    await addNotificationToFirestore({
      id: notifId,
      title,
      message,
      iconUrl: iconUrl || '',
      appId,
      category: 'review',
      targetType: 'publisher',
      publisherAppId: appId,
      publisherUid: developerId,
      publisherEmail: developerEmail,
      publisherName: developerName,
      actionType: 'app_detail',
      actionLabel: 'Respond to review',
      isUnread: true,
      createdAt: Date.now()
    });
    // Private developer notification: Strictly served in in-app notification center (no native mobile push)
  } catch (e) {
    console.warn('Failed to post review notification to Firestore:', e);
  }
}

/**
 * Post a notification when a user updates their review on an app.
 * Delivered strictly to publisher in-app notification centre.
 */
export async function notifyPublisherReviewUpdated(
  appId: string,
  appName: string,
  review: { userName?: string; rating: number; text: string },
  iconUrl?: string,
  devInfo?: { developerId?: string; developerEmail?: string; developerName?: string }
): Promise<void> {
  try {
    let developerId = devInfo?.developerId;
    let developerEmail = devInfo?.developerEmail;
    let developerName = devInfo?.developerName;

    if (!developerId && !developerEmail && !developerName) {
      try {
        const appSnap = await getDoc(doc(db, 'apps', appId));
        if (appSnap.exists()) {
          const d = appSnap.data();
          developerId = d.developerId || d.creatorUid;
          developerEmail = d.developerEmail || d.developerInfo?.email;
          developerName = d.developer;
        }
      } catch {
        const mock = appDetailsMock[appId];
        if (mock) {
          developerId = mock.developerId || mock.creatorUid;
          developerEmail = mock.developerEmail;
          developerName = mock.developer;
        }
      }
    }

    const notifId = `notif-rev-upd-${appId}-${Date.now()}`;
    const cleanUser = review.userName || 'A reviewer';
    const snippet = review.text ? (review.text.length > 70 ? review.text.substring(0, 67) + '...' : review.text) : 'Updated rating';
    const title = `Review Updated: ${appName}`;
    const message = `${cleanUser} updated their review to ${review.rating}★: "${snippet}"`;

    await addNotificationToFirestore({
      id: notifId,
      title,
      message,
      iconUrl: iconUrl || '',
      appId,
      category: 'review',
      targetType: 'publisher',
      publisherAppId: appId,
      publisherUid: developerId,
      publisherEmail: developerEmail,
      publisherName: developerName,
      actionType: 'app_detail',
      actionLabel: 'View updated review',
      isUnread: true,
      createdAt: Date.now()
    });
    // Private developer notification: Strictly served in in-app notification center (no native mobile push)
  } catch (e) {
    console.warn('Failed to post review update notification to Firestore:', e);
  }
}

/**
 * Post a notification when the developer/publisher replies to a review.
 * Sent ONLY to the user's notification centre.
 */
export async function notifyUserReviewReply(
  appId: string,
  appName: string,
  review: { id: string; userId: string; userName?: string; text?: string },
  replyText: string,
  publisherName?: string,
  iconUrl?: string
): Promise<void> {
  try {
    const notifId = `notif-reply-${review.id}-${Date.now()}`;
    const snippet = replyText.length > 75 ? replyText.substring(0, 72) + '...' : replyText;
    const title = `Developer replied to your review`;
    const message = `${publisherName || 'The developer'} replied to your review on ${appName}: "${snippet}"`;

    await addNotificationToFirestore({
      id: notifId,
      title,
      message,
      iconUrl: iconUrl || '',
      appId,
      category: 'review_reply',
      targetType: 'user',
      targetUid: review.userId,
      targetUserName: review.userName,
      actionType: 'app_detail',
      actionLabel: 'View developer reply',
      isUnread: true,
      createdAt: Date.now()
    });
    // Review conversations are developer-user matters: Served in in-app notification center (no native mobile push)
  } catch (e) {
    console.warn('Failed to post review reply notification to Firestore:', e);
  }
}

/**
 * Post a notification when other users mark someone's review as helpful.
 * Sent directly to the review author's Notification Centre in-app.
 */
export async function notifyUserReviewHelpful(params: {
  appId: string;
  appName: string;
  reviewId: string;
  helpfulCount: number;
  userId?: string;
  userName?: string;
  userEmail?: string;
  iconUrl?: string;
}): Promise<void> {
  try {
    const notifId = `notif-helpful-${params.reviewId}-${params.helpfulCount}`;
    const title = `👍 ${params.helpfulCount} helpful vote${params.helpfulCount > 1 ? 's' : ''}`;
    const message = `Store users found your review on "${params.appName}" helpful (${params.helpfulCount} total mark${params.helpfulCount > 1 ? 's' : ''}).`;

    await addNotificationToFirestore({
      id: notifId,
      title,
      message,
      iconUrl: params.iconUrl || '',
      appId: params.appId,
      category: 'review',
      targetType: 'user',
      targetUid: params.userId || 'u-me',
      targetUserName: params.userName || undefined,
      targetEmail: params.userEmail || undefined,
      actionType: 'app_detail',
      actionLabel: 'View review',
      isUnread: true,
      createdAt: Date.now()
    });
    // Reviews and ratings are private: in-app notification only
  } catch (e) {
    console.warn('Failed to post review helpful notification:', e);
  }
}

/**
 * Post a direct notification when a user, profile, or release link is banned.
 * Directly notifies the user in Notification Centre and triggers phone native notification.
 */
export async function notifyUserBanned(params: {
  targetIdentifier: string;
  urlOrRepo: string;
  type: 'profile' | 'release';
  reason: string;
  appName?: string;
  targetUid?: string;
  targetEmail?: string;
}): Promise<void> {
  try {
    const notifId = `notif-ban-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const isProfile = params.type === 'profile';
    const title = isProfile
      ? `Account Restriction Notice: @${params.targetIdentifier}`
      : `Release Distribution Banned`;
    const message = `Platform Enforcement Notice: ${
      isProfile
        ? `GitHub profile @${params.targetIdentifier} has been banned from distribution across the entire platform.`
        : `Release link "${params.targetIdentifier}" has been restricted.`
    } Reason: ${params.reason || 'Violated community guidelines / distribution terms.'}`;

    await addNotificationToFirestore({
      id: notifId,
      title,
      message,
      category: 'moderation',
      targetType: isProfile ? 'all' : 'publisher',
      targetUid: params.targetUid || undefined,
      targetUserName: params.targetIdentifier,
      targetEmail: params.targetEmail || undefined,
      actionType: 'app_detail',
      actionLabel: 'View details',
      isUnread: true,
      createdAt: Date.now()
    });

    // Trigger normal native phone notification
    showPhoneNativeNotification(title, {
      body: message,
      tag: `ban-${params.targetIdentifier}`
    }).catch(() => {});
  } catch (e) {
    console.warn('notifyUserBanned error:', e);
  }
}

/**
 * Post a direct notification when a user profile or release link is unbanned.
 * Directly notifies the user in Notification Centre and triggers phone native notification.
 */
export async function notifyUserUnbanned(params: {
  targetIdentifier: string;
  urlOrRepo: string;
  type: 'profile' | 'release';
  reason?: string;
  appName?: string;
  targetUid?: string;
  targetEmail?: string;
}): Promise<void> {
  try {
    const notifId = `notif-unban-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const isProfile = params.type === 'profile';
    const title = isProfile
      ? `Account Restriction Lifted: @${params.targetIdentifier}`
      : `Release Distribution Reinstated: ${params.appName || params.targetIdentifier}`;
    const message = isProfile
      ? `Your GitHub profile @${params.targetIdentifier} has been unbanned. Repository releases and apps can now be published and updated on Prople Store.`
      : `Release link "${params.urlOrRepo}" has been unbanned and restored for distribution on Prople Store.`;

    await addNotificationToFirestore({
      id: notifId,
      title,
      message,
      category: 'moderation',
      targetType: isProfile ? 'all' : 'publisher',
      targetUid: params.targetUid || undefined,
      targetUserName: params.targetIdentifier,
      targetEmail: params.targetEmail || undefined,
      actionType: 'console',
      actionLabel: 'Open Console',
      isUnread: true,
      createdAt: Date.now()
    });

    // Trigger normal native phone notification
    showPhoneNativeNotification(title, {
      body: message,
      tag: `unban-${params.targetIdentifier}`
    }).catch(() => {});
  } catch (e) {
    console.warn('notifyUserUnbanned error:', e);
  }
}

/**
 * Sanitizes any administration reason string to ensure administrative emails or personal identifiers
 * are never exposed to end-users or publishers in push notifications or notifications history.
 */
export function sanitizeNotificationReason(reason?: string): string {
  if (!reason) return '';
  return reason
    .replace(/\s*\([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\)/g, '')
    .replace(/Administrator\s*\([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\)/gi, 'Platform Administration')
    .replace(/by\s+[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, 'by Platform Administration')
    .replace(/\bby Administrator\b/gi, 'by Platform Administration')
    .trim();
}

/**
 * Send a targeted notification specifically to an individual account / email holder.
 * Only the recipient with this matching email/UID will receive and see this notification.
 */
export async function sendTargetedAccountNotice(params: {
  targetEmail: string;
  title: string;
  message: string;
  category?: NotificationCategory;
  appId?: string;
  appName?: string;
  targetUid?: string;
  actionType?: 'app_detail' | 'manage_apps' | 'security_check' | 'console' | 'link';
  actionUrl?: string;
  actionLabel?: string;
  iconUrl?: string;
}): Promise<string> {
  const notifId = `notif-direct-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const cleanMessage = sanitizeNotificationReason(params.message);

  await addNotificationToFirestore({
    id: notifId,
    title: params.title,
    message: cleanMessage,
    iconUrl: params.iconUrl || '/logo.png',
    appId: params.appId,
    category: params.category || 'moderation',
    targetType: 'user',
    targetEmail: params.targetEmail.trim().toLowerCase(),
    targetUid: params.targetUid || null,
    publisherEmail: params.targetEmail.trim().toLowerCase(),
    actionType: params.actionType || (params.appId ? 'app_detail' : 'link'),
    actionUrl: params.actionUrl || (params.appId ? `/apps/${params.appId}` : undefined),
    actionLabel: params.actionLabel || (params.appId ? 'View App Status' : 'View Notice'),
    isUnread: true,
    createdAt: Date.now()
  });

  // Only trigger local phone notification if the current device user matches the targetEmail
  const currentUserEmail = auth.currentUser?.email?.toLowerCase();
  if (currentUserEmail && currentUserEmail === params.targetEmail.trim().toLowerCase()) {
    markNotificationDispatched(notifId);
    showPhoneNativeNotification(params.title, {
      body: cleanMessage,
      icon: params.iconUrl || '/logo.png',
      tag: notifId
    }).catch(() => {});
  }

  return notifId;
}

/**
 * Broadcast an official Global Platform Notice to ALL Prople Store users and developers.
 * Delivered to every user's Notification Centre and sends native push notification.
 */
export async function sendGlobalBroadcastNotice(params: {
  title: string;
  message: string;
  category?: NotificationCategory;
  actionType?: 'app_detail' | 'manage_apps' | 'security_check' | 'console' | 'link';
  actionUrl?: string;
  actionLabel?: string;
  iconUrl?: string;
  priority?: 'normal' | 'important' | 'critical';
  senderEmail?: string;
}): Promise<string> {
  const notifId = `notif-global-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const cleanMessage = sanitizeNotificationReason(params.message);

  await addNotificationToFirestore({
    id: notifId,
    title: params.title,
    message: cleanMessage,
    iconUrl: params.iconUrl || '/logo.png',
    category: params.category || 'announcement',
    targetType: 'global',
    actionType: params.actionType || (params.actionUrl ? 'link' : undefined),
    actionUrl: params.actionUrl || undefined,
    actionLabel: params.actionLabel || (params.actionUrl ? 'Open Link' : 'View Announcement'),
    isUnread: true,
    createdAt: Date.now(),
    senderEmail: params.senderEmail
  } as any);

  // Global notice triggers native phone push notification
  try {
    await showPhoneNativeNotification(params.title, {
      body: cleanMessage,
      icon: params.iconUrl || '/logo.png',
      tag: notifId,
      data: { url: params.actionUrl || '/' }
    });
  } catch (pushErr) {
    console.warn('Native mobile push notice dispatch warning:', pushErr);
  }

  return notifId;
}

/**
 * Revoke or delete a broadcast notification by ID from Firestore
 */
export async function deleteBroadcastNotification(notificationId: string, senderEmail?: string): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(LOCAL_STORE_NOTIFS_KEY);
      if (raw) {
        let list: NotificationItem[] = JSON.parse(raw);
        list = list.filter(n => n.id !== notificationId);
        localStorage.setItem(LOCAL_STORE_NOTIFS_KEY, JSON.stringify(list));
        window.dispatchEvent(new CustomEvent('prople:notifications:updated', { detail: list }));
      }
    } catch {}
  }
  try {
    const docRef = doc(db, NOTIFS_COLLECTION, notificationId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('deleteBroadcastNotification error:', err);
  }

  // Server-authoritative fallback for administrators
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('appmarket_user_profile') : null;
    const email = senderEmail || auth.currentUser?.email || (raw ? JSON.parse(raw)?.email : '') || 'admin@prople.co.in';
    if (email) {
      fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: email, action: 'delete', notificationId })
      }).catch(() => {});
    }
  } catch {}
}

/**
 * Post a notification when an admin performs a major action on an application
 * (Ban, take private, make public, or delete permanently).
 * Sent to the publisher in Notification Centre and native phone notification.
 */
export async function notifyPublisherAppAction(params: {
  appId: string;
  appName: string;
  action: 'banned' | 'unbanned' | 'private' | 'public' | 'deleted';
  reason?: string;
  publisherName?: string;
  publisherUid?: string;
  publisherEmail?: string;
  iconUrl?: string;
}): Promise<void> {
  try {
    const notifId = `notif-app-action-${params.appId}-${Date.now()}`;
    let title = '';
    let message = '';
    const cleanReason = sanitizeNotificationReason(params.reason);

    switch (params.action) {
      case 'banned':
        title = `Application Banned: ${params.appName}`;
        message = `"${params.appName}" was blocked from platform distribution by administration. ${cleanReason ? `Reason: ${cleanReason}` : 'Reason: Violated platform distribution terms.'}`;
        break;
      case 'unbanned':
        title = `Application Reinstated: ${params.appName}`;
        message = `"${params.appName}" has been unbanned and restored to the platform.`;
        break;
      case 'private':
        title = `Application Made Private: ${params.appName}`;
        message = `"${params.appName}" has been set to private by platform administration. ${cleanReason ? `Reason: ${cleanReason}` : ''}`;
        break;
      case 'public':
        title = `Application Made Public: ${params.appName}`;
        message = `"${params.appName}" is now visible and public in the store catalog.`;
        break;
      case 'deleted':
        title = `Application Removed: ${params.appName}`;
        message = `"${params.appName}" was permanently deleted from the store catalog by platform administration. ${cleanReason ? `Reason: ${cleanReason}` : ''}`;
        break;
    }

    await addNotificationToFirestore({
      id: notifId,
      title,
      message,
      iconUrl: params.iconUrl || '',
      appId: params.appId,
      category: 'moderation',
      targetType: 'publisher',
      publisherAppId: params.appId,
      publisherUid: params.publisherUid || null,
      publisherEmail: params.publisherEmail || null,
      publisherName: params.publisherName || null,
      actionType: 'app_detail',
      actionLabel: 'View app status',
      isUnread: true,
      createdAt: Date.now()
    });

    // Trigger native phone notification if recipient matches current device
    const currentEmail = auth.currentUser?.email?.toLowerCase();
    const targetEmail = params.publisherEmail?.toLowerCase();
    if (!targetEmail || (currentEmail && currentEmail === targetEmail)) {
      showPhoneNativeNotification(title, {
        body: message,
        icon: params.iconUrl,
        tag: `app-${params.action}-${params.appId}`
      }).catch(() => {});
    }
  } catch (e) {
    console.warn('notifyPublisherAppAction error:', e);
  }
}

/**
 * Post a notification when a publisher is restricted or suspended by admin.
 */
export async function notifyPublisherRestrictionAction(params: {
  publisherName: string;
  action: 'restricted' | 'unrestricted' | 'suspended' | 'reactivated';
  reason?: string;
  publisherEmail?: string;
  publisherUid?: string;
}): Promise<void> {
  try {
    const notifId = `notif-pub-${params.publisherName}-${Date.now()}`;
    const isSuspension = params.action === 'suspended';
    const isReactivation = params.action === 'reactivated';
    const isRestriction = params.action === 'restricted';

    const title = isSuspension 
      ? `Publisher Account Suspended` 
      : isReactivation
      ? `Publisher Account Reactivated`
      : isRestriction 
      ? `Publisher Account Restricted`
      : `Publisher Restriction Lifted`;

    const cleanReason = sanitizeNotificationReason(params.reason);
    const message = `Platform Notice for ${params.publisherName}: Account status updated to ${params.action}. ${cleanReason ? `Reason: ${cleanReason}` : ''}`;

    await addNotificationToFirestore({
      id: notifId,
      title,
      message,
      category: 'moderation',
      targetType: 'publisher',
      publisherUid: params.publisherUid || null,
      publisherEmail: params.publisherEmail || null,
      publisherName: params.publisherName,
      actionType: 'console',
      actionLabel: 'Publisher Console',
      isUnread: true,
      createdAt: Date.now()
    });

    const currentEmail = auth.currentUser?.email?.toLowerCase();
    const targetEmail = params.publisherEmail?.toLowerCase();
    if (!targetEmail || (currentEmail && currentEmail === targetEmail)) {
      showPhoneNativeNotification(title, {
        body: message,
        tag: `pub-${params.action}-${params.publisherName}`
      }).catch(() => {});
    }
  } catch (e) {
    console.warn('notifyPublisherRestrictionAction error:', e);
  }
}

/**
 * Post a notification when a normal user's review is deleted for community guidelines.
 * Sent directly to the user's notification centre and triggers native phone notification.
 */
export async function notifyUserReviewDeleted(params: {
  appId: string;
  appName?: string;
  reviewId: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  reason?: string;
  iconUrl?: string;
}): Promise<void> {
  try {
    const notifId = `notif-rev-deleted-${params.reviewId}-${Date.now()}`;
    const title = `Review Removed: Community Guidelines`;
    const cleanApp = params.appName || 'an application';
    const reasonText = sanitizeNotificationReason(params.reason) || 'Violated store community guidelines';
    const message = `Your review on "${cleanApp}" was removed by moderation. Reason: ${reasonText}. Please ensure reviews follow community safety rules.`;

    await addNotificationToFirestore({
      id: notifId,
      title,
      message,
      iconUrl: params.iconUrl || '',
      appId: params.appId,
      category: 'moderation',
      targetType: 'user',
      targetUid: params.userId || 'u-me',
      targetUserName: params.userName || undefined,
      targetEmail: params.userEmail || undefined,
      actionType: 'app_detail',
      actionLabel: 'View guidelines',
      isUnread: true,
      createdAt: Date.now()
    });

    // Trigger normal native phone notification if recipient matches
    const currentEmail = auth.currentUser?.email?.toLowerCase();
    const targetEmail = params.userEmail?.toLowerCase();
    if (!targetEmail || (currentEmail && currentEmail === targetEmail)) {
      showPhoneNativeNotification(title, {
        body: message,
        icon: params.iconUrl,
        tag: `review-removed-${params.reviewId}`
      }).catch(() => {});
    }
  } catch (e) {
    console.warn('notifyUserReviewDeleted error:', e);
  }
}

/**
 * Strict filtering predicate:
 * - Download counts & reviews: ONLY visible to the publisher of that app. Never all users.
 * - Updates & new release apps: visible to all users.
 * - Review replies: ONLY visible to the user whose review was replied to.
 */
export function isNotificationVisibleToUser(
  notif: NotificationItem,
  user: UserProfile | null,
  isPublisherOfApp: (appDev?: string, appId?: string, devId?: string, devEmail?: string) => boolean
): boolean {
  // Rule 0: Global platform broadcasts and announcements are visible to all users
  if (
    notif.targetType === 'all' || 
    notif.targetType === 'global' || 
    notif.category === 'announcement' || 
    notif.category === 'global_notice'
  ) {
    return true;
  }

  const title = (notif.title || '').toLowerCase();
  const msg = (notif.message || '').toLowerCase();

  const isDownloadCount = 
    notif.category === 'download_count' ||
    title.includes('download verified') ||
    title.includes('official download') ||
    title.includes('download milestone') ||
    msg.includes('verified download recorded') ||
    msg.includes('total downloads');

  const isReview = 
    notif.category === 'review' ||
    title.startsWith('new review') ||
    title.includes('rated your app');

  const isReviewReply = 
    notif.category === 'review_reply' ||
    title.includes('developer replied') ||
    title.includes('publisher replied') ||
    title.includes('replied to your review');

  const isAppUpdate = 
    notif.category === 'app_update' ||
    title.startsWith('update available') ||
    title.startsWith('updated:');

  const isNewRelease = 
    notif.category === 'new_release' ||
    title.startsWith('new release') ||
    title.startsWith('new app:');

  // Rule 1: Download counts and download verified events are strictly app metrics; never display them in Notification Centre
  if (isDownloadCount) {
    return false;
  }

  // Rule 2: Reviews notifications ONLY for the publisher of that app. Never all users.
  if (isReview) {
    if (!user) return false;
    const targetAppId = notif.publisherAppId || notif.appId;
    return isPublisherOfApp(
      notif.publisherName,
      targetAppId,
      notif.publisherUid,
      notif.publisherEmail
    );
  }

  // Rule 3: Review replies notifications ONLY for the author of that review
  if (isReviewReply) {
    if (!user) {
      const localUid = typeof window !== 'undefined' ? localStorage.getItem('prople_local_user_uid') : null;
      if (localUid && notif.targetUid === localUid) return true;
      return notif.targetUid === 'u-me';
    }
    if (notif.targetUid && (user.uid === notif.targetUid || notif.targetUid === 'u-me')) return true;
    if (notif.targetEmail && user.email && user.email.toLowerCase() === notif.targetEmail.toLowerCase()) return true;
    if (notif.targetUserName && (
      (user.displayName && user.displayName.toLowerCase() === notif.targetUserName.toLowerCase()) ||
      (user.publisherName && user.publisherName.toLowerCase() === notif.targetUserName.toLowerCase())
    )) return true;
    return false;
  }

  // Rule 4: Updates and new release apps notifications are for all users
  if (isAppUpdate || isNewRelease) {
    return true;
  }

  // Rule 5: User-specific actions (e.g. device install completion, review deletion, moderation notice)
  if (notif.targetType === 'user') {
    const localUid = typeof window !== 'undefined' ? localStorage.getItem('prople_local_user_uid') : null;
    if (!user) {
      if (localUid && notif.targetUid === localUid) return true;
      if (!notif.targetUid || notif.targetUid === 'local-device' || notif.targetUid === 'u-me') return true;
      return false;
    }
    if (notif.targetUid && (notif.targetUid === user.uid || notif.targetUid === localUid || notif.targetUid === 'local-device' || notif.targetUid === 'u-me')) return true;
    if (notif.targetEmail && user.email && user.email.toLowerCase() === notif.targetEmail.toLowerCase()) return true;
    if (notif.targetUserName && (
      (user.displayName && user.displayName.toLowerCase() === notif.targetUserName.toLowerCase()) ||
      (user.publisherName && user.publisherName.toLowerCase() === notif.targetUserName.toLowerCase())
    )) return true;
    if (notif.targetUid || notif.targetEmail) return false;
    return true;
  }

  // Rule 6: Explicit publisher targeting
  if (notif.targetType === 'publisher') {
    if (!user) return false;
    const targetAppId = notif.publisherAppId || notif.appId;
    return isPublisherOfApp(
      notif.publisherName,
      targetAppId,
      notif.publisherUid,
      notif.publisherEmail
    );
  }

  return true;
}

/**
 * Mark a notification as read in Firestore
 */
export async function markNotificationAsReadInFirestore(id: string): Promise<void> {
  try {
    const docRef = doc(db, NOTIFS_COLLECTION, id);
    await updateDoc(docRef, { isUnread: false });
  } catch (e) {
    console.warn('markNotificationAsReadInFirestore error:', e);
  }
}

/**
 * Mark all notifications as read in Firestore
 */
export async function markAllNotificationsAsReadInFirestore(ids: string[]): Promise<void> {
  try {
    const batch = writeBatch(db);
    ids.forEach((id) => {
      const docRef = doc(db, NOTIFS_COLLECTION, id);
      batch.update(docRef, { isUnread: false });
    });
    await batch.commit();
  } catch (e) {
    console.warn('markAllNotificationsAsReadInFirestore error:', e);
  }
}

/**
 * Persist dismissed notification ID for the active user across sessions and devices
 */
export async function dismissNotificationForUser(id: string, user?: UserProfile | null): Promise<void> {
  if (!id) return;
  // 1. Local device storage
  try {
    const raw = localStorage.getItem('prople_store_dismissed_notifs_v1');
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem('prople_store_dismissed_notifs_v1', JSON.stringify(list.slice(-500)));
    }
  } catch {}

  // 2. Remote Firestore sync to user profile subcollection if authenticated
  if (user?.uid && user.uid !== 'developer' && user.uid !== 'dev-publisher') {
    try {
      const dismissRef = doc(db, 'users', user.uid, 'dismissed_notifications', id);
      await setDoc(dismissRef, { notificationId: id, dismissedAt: Date.now() }, { merge: true });
    } catch (err) {
      console.warn('dismissNotificationForUser remote sync warning:', err);
    }
  }
}

/**
 * Load remote dismissed notification IDs from user profile
 */
export async function loadDismissedNotificationsFromFirestore(user?: UserProfile | null): Promise<string[]> {
  if (!user?.uid || user.uid === 'developer' || user.uid === 'dev-publisher') return [];
  try {
    const colRef = collection(db, 'users', user.uid, 'dismissed_notifications');
    const snap = await getDocs(colRef);
    const ids: string[] = [];
    snap.forEach(d => ids.push(d.id));
    return ids;
  } catch (err) {
    console.warn('loadDismissedNotificationsFromFirestore notice:', err);
    return [];
  }
}

/**
 * Delete a notification from Firestore if user is authorized, or sync dismissal.
 * Never throws permission-denied errors to the UI when a user dismisses shared announcements.
 */
export async function deleteNotificationFromFirestore(id: string, user?: UserProfile | null): Promise<void> {
  if (!id) return;
  
  // Always register as dismissed for this user
  await dismissNotificationForUser(id, user);

  // Check if user is an administrator
  const userEmail = (user?.email || auth.currentUser?.email || '').toLowerCase().trim();
  const isAdmin = Boolean(
    user?.isAdmin ||
    (userEmail && (
      userEmail.endsWith('@prople.co.in') ||
      userEmail === 'prople.org@gmail.com' ||
      userEmail === 'cloaktailofficial@gmail.com' ||
      userEmail === 'cloaktailsupport@gmail.com'
    ))
  );

  // If administrator, attempt server-authoritative broadcast delete
  if (isAdmin) {
    try {
      await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail, action: 'delete', notificationId: id })
      });
    } catch {}
  }

  // Attempt client-side Firestore document delete if user owns the document or has admin permissions
  try {
    const docRef = doc(db, NOTIFS_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (e: any) {
    // Non-blocking: Shared catalog notices and broadcast releases cannot (and should not)
    // be erased from the global database by individual users; user dismissal is safely preserved.
    console.warn('deleteNotificationFromFirestore non-fatal notice:', e?.message || e);
  }
}

/**
 * Clear all notifications in Firestore or mark all as dismissed
 */
export async function clearAllNotificationsInFirestore(ids: string[], user?: UserProfile | null): Promise<void> {
  if (!ids || ids.length === 0) return;
  
  // Persist all dismissals
  for (const id of ids) {
    await dismissNotificationForUser(id, user).catch(() => {});
  }

  const userEmail = (user?.email || auth.currentUser?.email || '').toLowerCase().trim();
  const isAdmin = Boolean(
    user?.isAdmin ||
    (userEmail && (
      userEmail.endsWith('@prople.co.in') ||
      userEmail === 'prople.org@gmail.com' ||
      userEmail === 'cloaktailofficial@gmail.com' ||
      userEmail === 'cloaktailsupport@gmail.com'
    ))
  );

  if (isAdmin) {
    for (const id of ids) {
      try {
        await fetch('/api/admin/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userEmail, action: 'delete', notificationId: id })
        });
      } catch {}
    }
  }

  try {
    for (let i = 0; i < ids.length; i += 450) {
      const chunk = ids.slice(i, i + 450);
      const batch = writeBatch(db);
      chunk.forEach((id) => {
        const docRef = doc(db, NOTIFS_COLLECTION, id);
        batch.delete(docRef);
      });
      await batch.commit();
    }
  } catch (e) {
    console.warn('clearAllNotificationsInFirestore non-fatal notice:', e);
  }
}
