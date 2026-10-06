import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { AppDetails, Review } from '../types';

export interface AppReportItem {
  id: string; // appId
  appId: string;
  appName: string;
  appIcon: string;
  developer: string;
  category: string;
  githubRepo?: string;
  downloadUrl?: string;
  reportReasons: string[];
  reportCount: number;
  firstReportedAt: number;
  lastReportedAt: number;
  status: 'pending' | 'resolved' | 'dismissed' | 'private' | 'banned';
  notes?: string;
}

export interface ReviewReportItem {
  id: string; // reviewId
  reviewId: string;
  appId: string;
  appName: string;
  userName: string;
  userEmail?: string;
  userAvatar?: string;
  rating: number;
  reviewText: string;
  reportReasons: string[];
  reportCount: number;
  firstReportedAt: number;
  lastReportedAt: number;
  status: 'pending' | 'dismissed' | 'deleted';
  notes?: string;
}

export interface PublisherRestriction {
  publisherKey: string; // normalized name or email or uid
  publisherName: string;
  publisherEmail?: string;
  isBlocked: boolean;
  isRestricted: boolean;
  reason?: string;
  updatedAt: number;
}

export interface BannedReleaseLink {
  id: string;
  urlOrRepo: string;
  type?: 'profile' | 'release';
  targetIdentifier?: string; // username if profile, repo or url if release
  appName?: string;
  bannedAt: number;
  reason: string;
}

export interface BannedCheckResult {
  isBanned: boolean;
  reason?: string;
  bannedType?: 'profile' | 'release';
  matchedTarget?: string;
}

/**
 * Validates user input before adding to Banned Links / Profiles.
 * Prevents accidental saving of malformed URLs, random sentences, or spaces.
 */
export function validateBannedLinkInput(input: string): { isValid: boolean; error?: string } {
  const trimmed = (input || '').trim();
  if (!trimmed) {
    return { isValid: false, error: 'Please enter a GitHub profile (@username), GitHub URL, or release link.' };
  }

  // Reject sentences, spaces, or multiple words
  if (/\s/.test(trimmed)) {
    return { isValid: false, error: 'Invalid link: URL or handle cannot contain spaces or sentences.' };
  }

  // If user entered @username
  if (trimmed.startsWith('@')) {
    const handle = trimmed.slice(1);
    if (!/^[a-zA-Z0-9]([a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(handle)) {
      return { isValid: false, error: 'Invalid GitHub handle. Usernames must be 1-39 alphanumeric characters or hyphens.' };
    }
    return { isValid: true };
  }

  // If URL with http / https
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (!parsed.hostname || !parsed.hostname.includes('.')) {
        return { isValid: false, error: 'Invalid URL: Please provide a valid domain name (e.g. https://github.com/...)' };
      }
      return { isValid: true };
    } catch {
      return { isValid: false, error: 'Malformed URL format. Please enter a valid URL (e.g. https://github.com/owner/repo).' };
    }
  }

  // If github.com/... entered without protocol
  if (/^(www\.)?github\.com\//i.test(trimmed)) {
    try {
      new URL(`https://${trimmed}`);
      return { isValid: true };
    } catch {
      return { isValid: false, error: 'Malformed GitHub URL format.' };
    }
  }

  // If plain username without @ (1-39 chars)
  if (/^[a-zA-Z0-9]([a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(trimmed)) {
    return { isValid: true };
  }

  return {
    isValid: false,
    error: 'Please enter a valid URL (https://github.com/...) or a GitHub username (@username).'
  };
}

export function parseBannedTarget(input: string, forcedType?: 'profile' | 'release'): {
  type: 'profile' | 'release';
  targetIdentifier: string;
  urlOrRepo: string;
  displayName: string;
} {
  const trimmed = (input || '').trim();
  let clean = trimmed.replace(/^https?:\/\//i, '').replace(/^www\./i, '');

  if (forcedType === 'profile') {
    let username = trimmed.replace(/^https?:\/\/(www\.)?github\.com\//i, '').replace(/^@+/, '').split('/')[0].trim().toLowerCase();
    return {
      type: 'profile',
      targetIdentifier: username,
      urlOrRepo: `https://github.com/${username}`,
      displayName: `@${username}`
    };
  }

  // If user entered @username
  if (trimmed.startsWith('@')) {
    const username = trimmed.replace(/^@+/, '').split('/')[0].trim().toLowerCase();
    return {
      type: 'profile',
      targetIdentifier: username,
      urlOrRepo: `https://github.com/${username}`,
      displayName: `@${username}`
    };
  }

  // Check if it's a GitHub URL
  if (clean.toLowerCase().startsWith('github.com/')) {
    const path = clean.substring('github.com/'.length).replace(/\/+$/, '');
    const segments = path.split('/').filter(Boolean);

    // e.g. github.com/username or github.com/username/ (only 1 segment)
    if (segments.length === 1) {
      const username = segments[0].toLowerCase();
      return {
        type: 'profile',
        targetIdentifier: username,
        urlOrRepo: `https://github.com/${username}`,
        displayName: `@${username}`
      };
    }

    // 2 or more segments -> repo or release
    const owner = segments[0].toLowerCase();
    const repo = segments[1].toLowerCase();
    return {
      type: 'release',
      targetIdentifier: `${owner}/${repo}`,
      urlOrRepo: trimmed.startsWith('http') ? trimmed : `https://${clean}`,
      displayName: `${owner}/${repo}`
    };
  }

  // If user entered a single word with no slashes or dots (like a username)
  if (!trimmed.includes('/') && !trimmed.includes('.') && /^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    const username = trimmed.toLowerCase();
    return {
      type: 'profile',
      targetIdentifier: username,
      urlOrRepo: `https://github.com/${username}`,
      displayName: `@${username}`
    };
  }

  // Any other URL or link
  return {
    type: 'release',
    targetIdentifier: trimmed,
    urlOrRepo: trimmed.startsWith('http') ? trimmed : `https://${trimmed}`,
    displayName: trimmed
  };
}

export interface AppModerationState {
  appId: string;
  isPrivate: boolean;
  isBanned: boolean;
  bannedRepoUrl?: string;
  moderatedAt?: number;
  reason?: string;
}

const LOCAL_STORAGE_APP_REPORTS = 'prople_admin_app_reports_v1';
const LOCAL_STORAGE_REVIEW_REPORTS = 'prople_admin_review_reports_v1';
const LOCAL_STORAGE_PUBLISHER_RESTRICTIONS = 'prople_admin_publisher_restrictions_v1';
const LOCAL_STORAGE_BANNED_RELEASES = 'prople_admin_banned_releases_v1';
const LOCAL_STORAGE_APP_MODERATION = 'prople_admin_app_moderation_v1';

// In-memory cache
let appReportsCache: Record<string, AppReportItem> = {};
let reviewReportsCache: Record<string, ReviewReportItem> = {};
let publisherRestrictionsCache: Record<string, PublisherRestriction> = {};
let bannedReleasesCache: BannedReleaseLink[] = [];
let appModerationCache: Record<string, AppModerationState> = {};

export function dispatchModerationEvent() {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('admin:moderation:updated'));
    } catch {}
  }
}

// Real-time Firestore sync listeners
let hasInitListeners = false;
export function initModerationFirestoreSync() {
  if (hasInitListeners || typeof window === 'undefined') return;
  hasInitListeners = true;

  try {
    // 1. App Moderation
    onSnapshot(collection(db, 'app_moderation'), (snap) => {
      let changed = false;
      snap.forEach((docSnap) => {
        const data = docSnap.data() as AppModerationState;
        if (data && data.appId) {
          appModerationCache[data.appId] = {
            appId: data.appId,
            isPrivate: Boolean(data.isPrivate),
            isBanned: Boolean(data.isBanned),
            reason: data.reason,
            moderatedAt: typeof data.moderatedAt === 'number' ? data.moderatedAt : Date.now()
          };
          changed = true;
        }
      });
      if (changed) {
        saveAppModeration();
        dispatchModerationEvent();
      }
    }, () => {});

    // 2. Publisher Restrictions
    onSnapshot(collection(db, 'publisher_restrictions'), (snap) => {
      let changed = false;
      snap.forEach((docSnap) => {
        const data = docSnap.data() as any;
        if (data && (data.publisherKey || data.publisherName)) {
          const key = (data.publisherKey || data.publisherName).trim().toLowerCase();
          publisherRestrictionsCache[key] = {
            publisherKey: key,
            publisherName: data.publisherName || key,
            publisherEmail: data.publisherEmail,
            isBlocked: Boolean(data.isBlocked || data.isSuspended),
            isRestricted: Boolean(data.isRestricted),
            reason: data.reason,
            updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now()
          };
          changed = true;
        }
      });
      if (changed) {
        savePublisherRestrictions();
        dispatchModerationEvent();
      }
    }, () => {});

    // 3. Banned Releases
    onSnapshot(collection(db, 'banned_releases'), (snap) => {
      const items: BannedReleaseLink[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as any;
        if (data && (data.urlOrRepo || data.targetIdentifier)) {
          const target = (data.urlOrRepo || data.targetIdentifier || '').trim();
          
          // Purge corrupted/invalid legacy test entries automatically from Firestore
          const check = validateBannedLinkInput(target);
          if (
            !check.isValid ||
            target.startsWith('Remove this') ||
            target.includes('give here') ||
            (target.includes(' ') && !target.startsWith('@'))
          ) {
            try {
              deleteDoc(doc(db, 'banned_releases', docSnap.id)).catch(() => {});
            } catch {}
            return;
          }

          items.push({
            id: docSnap.id,
            urlOrRepo: data.urlOrRepo || '',
            type: data.type || 'release',
            targetIdentifier: data.targetIdentifier || '',
            appName: data.appName,
            bannedAt: typeof data.bannedAt === 'number' ? data.bannedAt : Date.now(),
            reason: data.reason || 'Violated terms'
          });
        }
      });
      // Always sync cache with Firestore state (even when collection is empty)
      bannedReleasesCache = items;
      saveBannedReleases();
      dispatchModerationEvent();
    }, (err) => {
      console.warn('Moderation Firestore sync error:', err);
    });
  } catch (err) {
    console.warn('Moderation Firestore sync error:', err);
  }
}

// Auto-run listener initialization
if (typeof window !== 'undefined') {
  setTimeout(() => initModerationFirestoreSync(), 100);
}

// Initialize from localStorage
function initLocalCache() {
  if (typeof window === 'undefined') return;
  try {
    const rawApp = localStorage.getItem(LOCAL_STORAGE_APP_REPORTS);
    if (rawApp) appReportsCache = JSON.parse(rawApp);
  } catch {}
  try {
    const rawRev = localStorage.getItem(LOCAL_STORAGE_REVIEW_REPORTS);
    if (rawRev) reviewReportsCache = JSON.parse(rawRev);
  } catch {}
  try {
    const rawPub = localStorage.getItem(LOCAL_STORAGE_PUBLISHER_RESTRICTIONS);
    if (rawPub) publisherRestrictionsCache = JSON.parse(rawPub);
  } catch {}
  try {
    const rawBan = localStorage.getItem(LOCAL_STORAGE_BANNED_RELEASES);
    if (rawBan) {
      const parsed = JSON.parse(rawBan);
      if (Array.isArray(parsed)) {
        bannedReleasesCache = parsed.filter(b => {
          const t = (b.urlOrRepo || b.targetIdentifier || '').trim();
          return validateBannedLinkInput(t).isValid && !t.startsWith('Remove this') && !t.includes('give here');
        });
      }
    }
  } catch {}
  try {
    const rawMod = localStorage.getItem(LOCAL_STORAGE_APP_MODERATION);
    if (rawMod) appModerationCache = JSON.parse(rawMod);
  } catch {}
}

initLocalCache();

function saveAppReports() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_APP_REPORTS, JSON.stringify(appReportsCache));
  } catch {}
}

function saveReviewReports() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_REVIEW_REPORTS, JSON.stringify(reviewReportsCache));
  } catch {}
}

function savePublisherRestrictions() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_PUBLISHER_RESTRICTIONS, JSON.stringify(publisherRestrictionsCache));
  } catch {}
}

function saveBannedReleases() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_BANNED_RELEASES, JSON.stringify(bannedReleasesCache));
  } catch {}
}

function saveAppModeration() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_APP_MODERATION, JSON.stringify(appModerationCache));
  } catch {}
}

function getCurrentAdminEmail(): string {
  try {
    const raw = localStorage.getItem('appmarket_user_profile');
    if (raw) {
      const p = JSON.parse(raw);
      if (p && p.email) return p.email;
    }
  } catch {}
  return '';
}

export const AdminModerationService = {
  // Sync admin reports from server-authoritative endpoint
  async syncAdminReportsFromServer(): Promise<void> {
    const email = getCurrentAdminEmail();
    if (!email) return;
    try {
      const res = await fetch(`/api/admin/reports?userEmail=${encodeURIComponent(email)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          if (Array.isArray(data.appReports)) {
            for (const r of data.appReports) {
              if (r.id) appReportsCache[r.id] = r;
            }
            saveAppReports();
          }
          if (Array.isArray(data.reviewReports)) {
            for (const r of data.reviewReports) {
              if (r.id) reviewReportsCache[r.id] = r;
            }
            saveReviewReports();
          }
          dispatchModerationEvent();
        }
      }
    } catch {}
  },

  // --- App Reports ---
  recordAppReport(app: { id: string; name: string; iconUrl?: string; developer?: string; category?: string; githubRepo?: string; downloadUrl?: string }, reason: string) {
    initLocalCache();
    const existing = appReportsCache[app.id];
    const now = Date.now();
    if (existing) {
      if (!existing.reportReasons.includes(reason)) {
        existing.reportReasons.push(reason);
      }
      existing.reportCount += 1;
      existing.lastReportedAt = now;
      if (existing.status === 'dismissed' || existing.status === 'resolved') {
        existing.status = 'pending';
      }
    } else {
      appReportsCache[app.id] = {
        id: app.id,
        appId: app.id,
        appName: app.name || 'Untitled App',
        appIcon: app.iconUrl || '/logo.png',
        developer: app.developer || 'Unknown Developer',
        category: app.category || 'Tools',
        githubRepo: app.githubRepo,
        downloadUrl: app.downloadUrl,
        reportReasons: [reason || 'Inappropriate content'],
        reportCount: 1,
        firstReportedAt: now,
        lastReportedAt: now,
        status: 'pending'
      };
    }
    saveAppReports();

    // Firestore sync
    try {
      const docRef = doc(db, 'app_reports', app.id);
      setDoc(docRef, {
        ...appReportsCache[app.id],
        updatedAt: serverTimestamp()
      }, { merge: true }).catch(() => {});
    } catch {}
  },

  // Get App Reports sorted descending by report count (highest reports at the top)
  getAppReports(): AppReportItem[] {
    initLocalCache();
    const items = Object.values(appReportsCache);
    return items.sort((a, b) => {
      if (b.reportCount !== a.reportCount) {
        return b.reportCount - a.reportCount;
      }
      return b.lastReportedAt - a.lastReportedAt;
    });
  },

  dismissAppReport(appId: string) {
    initLocalCache();
    if (appReportsCache[appId]) {
      appReportsCache[appId].status = 'dismissed';
      saveAppReports();
      try {
        const docRef = doc(db, 'app_reports', appId);
        updateDoc(docRef, { status: 'dismissed' }).catch(() => {});
      } catch {}
      const adminEmail = getCurrentAdminEmail();
      if (adminEmail) {
        fetch('/api/admin/report-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userEmail: adminEmail, type: 'app', id: appId, status: 'dismissed' })
        }).catch(() => {});
      }
    }
  },

  deleteAppReport(appId: string) {
    initLocalCache();
    delete appReportsCache[appId];
    saveAppReports();
    try {
      deleteDoc(doc(db, 'app_reports', appId)).catch(() => {});
    } catch {}
    const adminEmail = getCurrentAdminEmail();
    if (adminEmail) {
      fetch('/api/admin/report-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: adminEmail, type: 'app', id: appId, status: 'deleted' })
      }).catch(() => {});
    }
  },

  // --- Review Reports ---
  recordReviewReport(
    app: { id: string; name: string },
    review: { id: string; author?: string; email?: string; avatar?: string; rating?: number; comment?: string; text?: string },
    reason: string
  ) {
    initLocalCache();
    const existing = reviewReportsCache[review.id];
    const now = Date.now();
    const reviewText = review.comment || review.text || '';
    if (existing) {
      if (!existing.reportReasons.includes(reason)) {
        existing.reportReasons.push(reason);
      }
      existing.reportCount += 1;
      existing.lastReportedAt = now;
      if (existing.status === 'dismissed') {
        existing.status = 'pending';
      }
    } else {
      reviewReportsCache[review.id] = {
        id: review.id,
        reviewId: review.id,
        appId: app.id,
        appName: app.name,
        userName: review.author || 'Anonymous User',
        userEmail: review.email,
        userAvatar: review.avatar,
        rating: review.rating || 5,
        reviewText: reviewText,
        reportReasons: [reason || 'Flagged review'],
        reportCount: 1,
        firstReportedAt: now,
        lastReportedAt: now,
        status: 'pending'
      };
    }
    saveReviewReports();

    // Firestore sync
    try {
      const docRef = doc(db, 'review_reports', review.id);
      setDoc(docRef, {
        ...reviewReportsCache[review.id],
        updatedAt: serverTimestamp()
      }, { merge: true }).catch(() => {});
    } catch {}
  },

  // Get Review Reports sorted descending by report count (highest reports at the top)
  getReviewReports(): ReviewReportItem[] {
    initLocalCache();
    const items = Object.values(reviewReportsCache);
    return items.sort((a, b) => {
      if (b.reportCount !== a.reportCount) {
        return b.reportCount - a.reportCount;
      }
      return b.lastReportedAt - a.lastReportedAt;
    });
  },

  dismissReviewReport(reviewId: string) {
    initLocalCache();
    if (reviewReportsCache[reviewId]) {
      reviewReportsCache[reviewId].status = 'dismissed';
      saveReviewReports();
      try {
        const docRef = doc(db, 'review_reports', reviewId);
        updateDoc(docRef, { status: 'dismissed' }).catch(() => {});
      } catch {}
      const adminEmail = getCurrentAdminEmail();
      if (adminEmail) {
        fetch('/api/admin/report-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userEmail: adminEmail, type: 'review', id: reviewId, status: 'dismissed' })
        }).catch(() => {});
      }
    }
  },

  deleteReviewReport(reviewId: string) {
    initLocalCache();
    delete reviewReportsCache[reviewId];
    saveReviewReports();
    try {
      deleteDoc(doc(db, 'review_reports', reviewId)).catch(() => {});
    } catch {}
    const adminEmail = getCurrentAdminEmail();
    if (adminEmail) {
      fetch('/api/admin/report-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: adminEmail, type: 'review', id: reviewId, status: 'deleted' })
      }).catch(() => {});
    }
  },

  // --- App Moderation (Private / Ban / Permanently Ban Repo Release Link / Delete) ---
  getAppModerationState(appId: string): AppModerationState | undefined {
    initLocalCache();
    return appModerationCache[appId];
  },

  getAllModerationStates(): Record<string, AppModerationState> {
    initLocalCache();
    return { ...appModerationCache };
  },

  setAppPrivate(appId: string, isPrivate: boolean, reason?: string) {
    initLocalCache();
    const current = appModerationCache[appId] || { appId, isPrivate: false, isBanned: false };
    current.isPrivate = isPrivate;
    current.moderatedAt = Date.now();
    if (reason) current.reason = reason;
    appModerationCache[appId] = current;
    saveAppModeration();

    if (appReportsCache[appId] && isPrivate) {
      appReportsCache[appId].status = 'private';
      saveAppReports();
    }

    dispatchModerationEvent();

    try {
      const docRef = doc(db, 'app_moderation', appId);
      setDoc(docRef, { ...current, updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
    } catch {}

    const adminEmail = getCurrentAdminEmail();
    if (adminEmail) {
      fetch('/api/admin/moderation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: adminEmail, appId, isPrivate, reason })
      }).catch(() => {});
    }
  },

  setAppBanned(appId: string, isBanned: boolean, reason?: string) {
    initLocalCache();
    const current = appModerationCache[appId] || { appId, isPrivate: false, isBanned: false };
    current.isBanned = isBanned;
    current.moderatedAt = Date.now();
    if (reason) current.reason = reason;
    appModerationCache[appId] = current;
    saveAppModeration();

    if (appReportsCache[appId] && isBanned) {
      appReportsCache[appId].status = 'banned';
      saveAppReports();
    }

    dispatchModerationEvent();

    try {
      const docRef = doc(db, 'app_moderation', appId);
      setDoc(docRef, { ...current, updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
    } catch {}

    const adminEmail = getCurrentAdminEmail();
    if (adminEmail) {
      fetch('/api/admin/moderation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: adminEmail, appId, isBanned, reason })
      }).catch(() => {});
    }
  },

  isAppPrivate(appId: string): boolean {
    initLocalCache();
    return Boolean(appModerationCache[appId]?.isPrivate);
  },

  isAppBanned(appId: string): boolean {
    initLocalCache();
    return Boolean(appModerationCache[appId]?.isBanned);
  },

  // Permanently ban the repository / release link or GitHub user profile
  permanentlyBanRepoReleaseLink(
    urlOrRepo: string,
    appName?: string,
    reason: string = 'Violated developer distribution terms',
    forcedType?: 'profile' | 'release'
  ) {
    initLocalCache();
    const valCheck = validateBannedLinkInput(urlOrRepo);
    if (!valCheck.isValid) {
      console.warn('Cannot ban invalid link or target:', urlOrRepo, valCheck.error);
      return;
    }

    const parsed = parseBannedTarget(urlOrRepo, forcedType);
    const itemType = forcedType || parsed.type;
    const cleanUrl = parsed.urlOrRepo.toLowerCase();
    const targetIdentifier = parsed.targetIdentifier.toLowerCase();
    const docKey = (parsed.targetIdentifier || cleanUrl).replace(/[^a-zA-Z0-9_-]/g, '_');

    const existingIdx = bannedReleasesCache.findIndex(b => {
      const bUrl = (b.urlOrRepo || (b as any).url || '').toLowerCase();
      const bIdent = (b.targetIdentifier || '').toLowerCase();
      return b.id === docKey || bUrl === cleanUrl || (bIdent && bIdent === targetIdentifier);
    });

    const now = Date.now();
    const newItem: BannedReleaseLink = {
      id: docKey,
      urlOrRepo: parsed.urlOrRepo,
      type: itemType,
      targetIdentifier: parsed.targetIdentifier,
      appName: appName || parsed.displayName,
      bannedAt: now,
      reason
    };

    if (existingIdx >= 0) {
      bannedReleasesCache[existingIdx] = newItem;
    } else {
      bannedReleasesCache.unshift(newItem);
    }
    saveBannedReleases();
    dispatchModerationEvent();

    try {
      const docRef = doc(db, 'banned_releases', docKey);
      setDoc(docRef, {
        ...newItem,
        updatedAt: serverTimestamp()
      }, { merge: true }).catch(() => {});
    } catch {}

    const adminEmail = getCurrentAdminEmail();
    if (adminEmail) {
      fetch('/api/admin/banned-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: adminEmail, action: 'add', linkData: newItem })
      }).catch(() => {});
    }
  },

  async unbanRepoReleaseLink(idOrUrl: string) {
    initLocalCache();
    const clean = idOrUrl.trim().toLowerCase();
    const targetDocKey = clean.replace(/[^a-zA-Z0-9_-]/g, '_');

    // Collect all matching Firestore document IDs to purge permanently
    const toDeleteDocIds = new Set<string>();
    toDeleteDocIds.add(idOrUrl);
    toDeleteDocIds.add(targetDocKey);

    bannedReleasesCache.forEach(b => {
      const bId = b.id;
      const bUrl = (b.urlOrRepo || (b as any).url || '').toLowerCase();
      const bTarget = (b.targetIdentifier || '').toLowerCase();
      if (bId === idOrUrl || bId === targetDocKey || bUrl === clean || bTarget === clean) {
        if (b.id) toDeleteDocIds.add(b.id);
        if (b.targetIdentifier) toDeleteDocIds.add(b.targetIdentifier.replace(/[^a-zA-Z0-9_-]/g, '_'));
        if (b.urlOrRepo) toDeleteDocIds.add(b.urlOrRepo.toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '_'));
      }
    });

    bannedReleasesCache = bannedReleasesCache.filter(b => {
      const bId = b.id;
      const bUrl = (b.urlOrRepo || (b as any).url || '').toLowerCase();
      const bTarget = (b.targetIdentifier || '').toLowerCase();
      return bId !== idOrUrl && bId !== targetDocKey && bUrl !== clean && bTarget !== clean;
    });
    saveBannedReleases();
    dispatchModerationEvent();

    // Permanently remove from Firestore database
    try {
      for (const dId of toDeleteDocIds) {
        if (dId) {
          deleteDoc(doc(db, 'banned_releases', dId)).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('Failed to delete banned release doc from Firestore:', err);
    }

    const adminEmail = getCurrentAdminEmail();
    if (adminEmail) {
      fetch('/api/admin/banned-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: adminEmail, action: 'remove', linkData: { id: idOrUrl } })
      }).catch(() => {});
    }
  },

  getBannedReleases(): BannedReleaseLink[] {
    initLocalCache();
    return [...bannedReleasesCache];
  },

  // Check if an arbitrary URL, repository, or GitHub profile matches any banned item
  checkIfUrlOrProfileBanned(urlOrRepo?: string): BannedCheckResult {
    if (!urlOrRepo) return { isBanned: false };
    initLocalCache();
    const clean = urlOrRepo.trim().toLowerCase();

    // Extract github owner/username if github URL
    let githubOwner: string | undefined;
    if (clean.includes('github.com')) {
      const path = clean.replace(/^https?:\/\/github\.com\//i, '').replace(/^github\.com\//i, '');
      const parts = path.split('/').filter(Boolean);
      if (parts[0]) {
        githubOwner = parts[0].toLowerCase();
      }
    }

    for (const b of bannedReleasesCache) {
      const bUrl = (b.urlOrRepo || (b as any).url || '').toLowerCase();
      const bTarget = (b.targetIdentifier || '').toLowerCase();
      const bType = b.type || (bTarget && !bTarget.includes('/') ? 'profile' : 'release');

      // 1. If it's a banned profile holder: reject ANY repository or release from this holder
      if (bType === 'profile') {
        const profileUsername = bTarget || parseBannedTarget(bUrl).targetIdentifier.toLowerCase();
        if (githubOwner && githubOwner === profileUsername) {
          return {
            isBanned: true,
            reason: b.reason,
            bannedType: 'profile',
            matchedTarget: profileUsername
          };
        }
        if (clean === profileUsername || clean.includes(`github.com/${profileUsername}`)) {
          return {
            isBanned: true,
            reason: b.reason,
            bannedType: 'profile',
            matchedTarget: profileUsername
          };
        }
      }

      // 2. If it's a specific release / repo link
      if (bUrl) {
        if (clean === bUrl || clean.includes(bUrl) || (bUrl.length > 8 && clean.includes(bUrl))) {
          return {
            isBanned: true,
            reason: b.reason,
            bannedType: 'release',
            matchedTarget: b.targetIdentifier || bUrl
          };
        }
      }

      if (bTarget && bTarget.includes('/')) {
        if (clean.includes(bTarget)) {
          return {
            isBanned: true,
            reason: b.reason,
            bannedType: 'release',
            matchedTarget: bTarget
          };
        }
      }
    }

    return { isBanned: false };
  },

  isReleaseOrRepoBanned(urlOrRepo?: string): boolean {
    return this.checkIfUrlOrProfileBanned(urlOrRepo).isBanned;
  },

  // --- Publisher Restrictions & Blocking ---
  getPublisherRestriction(publisherIdentifier: string): PublisherRestriction | undefined {
    initLocalCache();
    const key = publisherIdentifier.trim().toLowerCase();
    return publisherRestrictionsCache[key];
  },

  getAllPublisherRestrictions(): Record<string, PublisherRestriction> {
    initLocalCache();
    return { ...publisherRestrictionsCache };
  },

  setPublisherBlockStatus(publisherName: string, isBlocked: boolean, reason?: string, email?: string) {
    initLocalCache();
    const key = publisherName.trim().toLowerCase();
    const current = publisherRestrictionsCache[key] || {
      publisherKey: key,
      publisherName,
      publisherEmail: email,
      isBlocked: false,
      isRestricted: false,
      updatedAt: Date.now()
    };
    current.isBlocked = isBlocked;
    current.updatedAt = Date.now();
    if (reason) current.reason = reason;
    if (email) current.publisherEmail = email;
    publisherRestrictionsCache[key] = current;
    savePublisherRestrictions();
    dispatchModerationEvent();

    try {
      const docRef = doc(db, 'publisher_restrictions', key.replace(/[^a-zA-Z0-9_-]/g, '_'));
      setDoc(docRef, { ...current, updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
    } catch {}

    const adminEmail = getCurrentAdminEmail();
    if (adminEmail) {
      fetch('/api/admin/publisher-restrictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: adminEmail, pubKey: key, restriction: current })
      }).catch(() => {});
    }
  },

  setPublisherRestrictionStatus(publisherName: string, isRestricted: boolean, reason?: string, email?: string) {
    initLocalCache();
    const key = publisherName.trim().toLowerCase();
    const current = publisherRestrictionsCache[key] || {
      publisherKey: key,
      publisherName,
      publisherEmail: email,
      isBlocked: false,
      isRestricted: false,
      updatedAt: Date.now()
    };
    current.isRestricted = isRestricted;
    current.updatedAt = Date.now();
    if (reason) current.reason = reason;
    if (email) current.publisherEmail = email;
    publisherRestrictionsCache[key] = current;
    savePublisherRestrictions();
    dispatchModerationEvent();

    try {
      const docRef = doc(db, 'publisher_restrictions', key.replace(/[^a-zA-Z0-9_-]/g, '_'));
      setDoc(docRef, { ...current, updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
    } catch {}

    const adminEmail = getCurrentAdminEmail();
    if (adminEmail) {
      fetch('/api/admin/publisher-restrictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: adminEmail, pubKey: key, restriction: current })
      }).catch(() => {});
    }
  },

  isPublisherBlocked(publisherName?: string): boolean {
    if (!publisherName) return false;
    initLocalCache();
    const key = publisherName.trim().toLowerCase();
    const item = publisherRestrictionsCache[key];
    return Boolean(item?.isBlocked || (item as any)?.isSuspended);
  },

  isPublisherRestricted(publisherName?: string): boolean {
    if (!publisherName) return false;
    initLocalCache();
    const key = publisherName.trim().toLowerCase();
    return Boolean(publisherRestrictionsCache[key]?.isRestricted);
  },

  // Comprehensive check for whether an app is blocked, its publisher is blocked, or its repo/release is banned
  isAppBlockedOrSuspended(app: {
    id: string;
    publisherName?: string;
    developer?: string;
    downloadUrl?: string;
    githubRepo?: string;
    githubReleaseUrl?: string;
    url?: string;
  }): {
    isBlocked: boolean;
    reason?: string;
    type?: 'app_banned' | 'publisher_blocked' | 'link_banned' | 'profile_banned';
  } {
    initLocalCache();

    // 1. Direct app ban
    if (this.isAppBanned(app.id)) {
      const reason = appModerationCache[app.id]?.reason || 'Application suspended by platform administration';
      return { isBlocked: true, reason, type: 'app_banned' };
    }

    // 2. Publisher block
    const pubName = app.publisherName || app.developer;
    if (pubName && this.isPublisherBlocked(pubName)) {
      const pKey = pubName.trim().toLowerCase();
      const reason = publisherRestrictionsCache[pKey]?.reason || `Publisher "${pubName}" has been suspended`;
      return { isBlocked: true, reason, type: 'publisher_blocked' };
    }

    // 3. Link or Repo or Profile ban check
    const checkUrls = [app.downloadUrl, app.githubReleaseUrl, app.githubRepo, app.url].filter(Boolean) as string[];
    for (const url of checkUrls) {
      const banCheck = this.checkIfUrlOrProfileBanned(url);
      if (banCheck.isBanned) {
        return {
          isBlocked: true,
          reason: banCheck.reason || 'Distribution source is banned by platform administration',
          type: banCheck.bannedType === 'profile' ? 'profile_banned' : 'link_banned'
        };
      }
    }

    return { isBlocked: false };
  },

  // Aliases and Convenience Methods
  resolveReviewReport(reviewId: string, reason?: string) {
    initLocalCache();
    if (reviewReportsCache[reviewId]) {
      reviewReportsCache[reviewId].status = 'deleted';
      if (reason) reviewReportsCache[reviewId].notes = reason;
      saveReviewReports();
      try {
        const docRef = doc(db, 'review_reports', reviewId);
        updateDoc(docRef, { status: 'deleted', notes: reason || '' }).catch(() => {});
      } catch {}
    }
  },

  banReleaseUrl(url: string, reason?: string, appName?: string, type?: 'profile' | 'release') {
    this.permanentlyBanRepoReleaseLink(url, appName, reason || 'Banned by admin', type);
  },

  unbanReleaseUrl(urlOrId: string) {
    this.unbanRepoReleaseLink(urlOrId);
  },

  setPublisherRestricted(publisherName: string, isRestricted: boolean, reason?: string, email?: string) {
    this.setPublisherRestrictionStatus(publisherName, isRestricted, reason, email);
  },

  setPublisherSuspended(publisherName: string, isSuspended: boolean, reason?: string, email?: string) {
    this.setPublisherBlockStatus(publisherName, isSuspended, reason, email);
  },

  // Seed sample mock reports if empty to demonstrate functionality immediately
  seedDemoReportsIfEmpty() {
    initLocalCache();
    if (Object.keys(appReportsCache).length === 0) {
      this.recordAppReport(
        { id: 'app_demo_flag_1', name: 'Sample Flagged Tool', developer: 'Suspicious Developer', category: 'Tools', downloadUrl: 'https://example.com/bad.apk' },
        'Harmful to device or data'
      );
      this.recordAppReport(
        { id: 'app_demo_flag_1', name: 'Sample Flagged Tool', developer: 'Suspicious Developer', category: 'Tools' },
        'Improper content rating'
      );
      this.recordAppReport(
        { id: 'app_demo_flag_1', name: 'Sample Flagged Tool', developer: 'Suspicious Developer', category: 'Tools' },
        'Harmful to device or data'
      );
    }
  }
};
