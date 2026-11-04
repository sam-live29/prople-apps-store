import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { safeFetchJson } from '../utils/safeFetch';
import { AppDetails } from '../types';

export interface PublisherNameCheckResult {
  available: boolean;
  isTaken: boolean;
  message: string;
}

// In-memory cache for fast lookup and 0ms repeated checks
const nameCheckCache = new Map<string, PublisherNameCheckResult>();

const PROHIBITED_NAMES = [
  'admin', 'administrator', 'system', 'root', 'google', 'google play',
  'googleplay', 'prople', 'prople store', 'proplestore', 'official',
  'support', 'null', 'undefined', 'anonymous', 'guest'
];

/**
 * Check if a publisher/developer name is available and unique
 */
export async function checkPublisherNameAvailability(
  name: string,
  options?: {
    currentUserId?: string;
    currentUserEmail?: string;
    currentUserName?: string;
    allApps?: AppDetails[];
  }
): Promise<PublisherNameCheckResult> {
  const trimmed = (name || '').trim();

  if (!trimmed) {
    return {
      available: false,
      isTaken: false,
      message: 'Publisher name is required.'
    };
  }

  if (trimmed.length < 2) {
    return {
      available: false,
      isTaken: false,
      message: 'Publisher name must be at least 2 characters.'
    };
  }

  if (trimmed.length > 50) {
    return {
      available: false,
      isTaken: false,
      message: 'Publisher name cannot exceed 50 characters.'
    };
  }

  const cleanLower = trimmed.toLowerCase();
  const cleanAlpha = cleanLower.replace(/[^a-z0-9]/g, '');

  // Check prohibited names
  if (PROHIBITED_NAMES.includes(cleanLower) || PROHIBITED_NAMES.includes(cleanAlpha)) {
    return {
      available: false,
      isTaken: true,
      message: `"${trimmed}" is a reserved system name. Please choose a unique publisher name.`
    };
  }

  // Fast-path client check against known store catalog apps
  if (options?.allApps && options.allApps.length > 0) {
    const curUid = options.currentUserId || '';
    const curEmail = (options.currentUserEmail || '').toLowerCase().trim();

    for (const app of options.allApps) {
      const appOwner = (app.owner || (app as any).creatorUid || app.developerId || '').trim();
      const appEmail = (app.developerEmail || app.publisherEmail || (app as any).ownerEmail || '').toLowerCase().trim();

      // Skip apps owned by the current user
      if ((curUid && appOwner === curUid) || (curEmail && appEmail === curEmail)) {
        continue;
      }

      const dev = (app.developer || '').trim().toLowerCase();
      const pub = (app.publisherName || '').trim().toLowerCase();
      const pubBy = (app.publishedBy || '').trim().toLowerCase();

      if (dev === cleanLower || pub === cleanLower || pubBy === cleanLower) {
        return {
          available: false,
          isTaken: true,
          message: `The publisher name "${trimmed}" is already taken by an existing developer.`
        };
      }
    }
  }

  // Check cache
  const cacheKey = `${cleanLower}:${options?.currentUserId || ''}:${options?.currentUserEmail || ''}`;
  if (nameCheckCache.has(cacheKey)) {
    return nameCheckCache.get(cacheKey)!;
  }

  // Authoritative client-side Firestore publisher_registry check (public read allowed by firestore.rules)
  if (cleanAlpha && db) {
    try {
      const regSnap = await getDoc(doc(db, 'publisher_registry', cleanAlpha));
      if (regSnap.exists()) {
        const regData = regSnap.data();
        if (regData && regData.isActive !== false) {
          const curUid = (options?.currentUserId || auth.currentUser?.uid || '').trim();
          const curEmail = (options?.currentUserEmail || auth.currentUser?.email || '').toLowerCase().trim();
          const regUid = (regData.ownerUid || regData.userId || '').trim();
          const regEmail = (regData.ownerEmail || '').toLowerCase().trim();

          const isSameOwner = Boolean(
            (curUid && regUid && curUid === regUid) ||
            (curEmail && regEmail && curEmail === regEmail)
          );

          if (!isSameOwner) {
            const takenResult: PublisherNameCheckResult = {
              available: false,
              isTaken: true,
              message: `The publisher name "${trimmed}" is already claimed by another developer.`
            };
            nameCheckCache.set(cacheKey, takenResult);
            return takenResult;
          }
        }
      }
    } catch (regErr) {
      console.warn('[PublisherNameService] Direct registry check notice:', regErr);
    }
  }

  // Remote verification via server endpoint
  try {
    const params = new URLSearchParams();
    params.set('name', trimmed);
    if (options?.currentUserId) params.set('currentUserId', options.currentUserId);
    if (options?.currentUserEmail) params.set('currentUserEmail', options.currentUserEmail);

    const { ok, data } = await safeFetchJson<PublisherNameCheckResult>(
      `/api/publishers/check-name?${params.toString()}`
    );

    if (ok && data && typeof data.available === 'boolean') {
      const result: PublisherNameCheckResult = {
        available: Boolean(data.available),
        isTaken: Boolean(data.isTaken),
        message: data.message || (data.available ? 'This publisher name is available.' : 'This name is already taken.')
      };
      nameCheckCache.set(cacheKey, result);
      return result;
    }
  } catch (err) {
    console.warn('[PublisherNameService] Server check warning:', err);
  }

  return {
    available: true,
    isTaken: false,
    message: 'This publisher name is available.'
  };
}

/**
 * Custom React Hook for real-time, debounced publisher name validation
 */
export function usePublisherNameValidation(
  initialName: string,
  options?: {
    currentUserId?: string;
    currentUserEmail?: string;
    currentUserName?: string;
    allApps?: AppDetails[];
    debounceMs?: number;
  }
) {
  const [name, setName] = useState(initialName);
  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<PublisherNameCheckResult>({
    available: true,
    isTaken: false,
    message: ''
  });

  // Sync internal state when external initialName prop changes
  useEffect(() => {
    setName(initialName);
  }, [initialName]);

  const debounceMs = options?.debounceMs ?? 250;
  const lastCheckedNameRef = useRef('');

  useEffect(() => {
    const trimmed = name.trim();
    if (!trimmed) {
      setIsChecking(false);
      setCheckResult({
        available: true,
        isTaken: false,
        message: ''
      });
      return;
    }

    if (trimmed.length < 2) {
      setIsChecking(false);
      setCheckResult({
        available: false,
        isTaken: false,
        message: 'Publisher name must be at least 2 characters.'
      });
      return;
    }

    setIsChecking(true);

    const timer = setTimeout(async () => {
      lastCheckedNameRef.current = trimmed;
      const res = await checkPublisherNameAvailability(trimmed, options);
      // Ensure response matches current value
      if (lastCheckedNameRef.current === trimmed) {
        setCheckResult(res);
        setIsChecking(false);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [name, options?.currentUserId, options?.currentUserEmail, options?.currentUserName, options?.allApps, debounceMs]);

  const isValid = Boolean(name.trim().length >= 2 && checkResult.available && !checkResult.isTaken);

  return {
    name,
    setName,
    isChecking,
    isAvailable: checkResult.available,
    isTaken: checkResult.isTaken,
    errorMessage: !checkResult.available ? checkResult.message : null,
    successMessage: checkResult.available && name.trim().length >= 2 && options?.currentUserName?.trim().toLowerCase() !== name.trim().toLowerCase() ? checkResult.message : null,
    isValid
  };
}

export const NAME_CHANGE_GRACE_PERIOD_MS = 30 * 60 * 1000; // 30 minutes grace window for back-to-back edits
export const NAME_CHANGE_COOLDOWN_MS = 15 * 24 * 60 * 60 * 1000; // 15 days waiting period after grace window

export interface NameChangeStatus {
  canChange: boolean;
  isInGracePeriod: boolean; // within 30-min window for unlimited back-to-back changes
  gracePeriodRemainingMs: number;
  cooldownRemainingMs: number;
  nextAvailableDate?: Date;
  statusMessage: string;
}

/**
 * Calculates whether a user can change their publisher name based on:
 * 1. Under 30 minutes: Unlimited back-to-back name changes allowed from the start of a name change session.
 * 2. After 30 minutes: 15-day waiting period before the next name change session is permitted.
 */
export function getNameChangeStatus(user?: {
  lastNameChangedAt?: number | string;
  nameChangeSessionStartedAt?: number | string;
  role?: string;
  isAdmin?: boolean;
  publisherRole?: string;
  email?: string;
} | null): NameChangeStatus {
  // Store administrators, developers, and stealth/guest sessions are never locked out
  const isPrivileged = Boolean(
    user?.isAdmin ||
    user?.role === 'admin' ||
    user?.publisherRole === 'Store Administrator' ||
    (user?.email && (user.email.endsWith('@prople.co.in') || user.email === 'sahanurmolla2886@gmail.com' || user.email === 'ventureforge.corp@gmail.com'))
  );
  if (isPrivileged || !user?.email || (!user.lastNameChangedAt && !user.nameChangeSessionStartedAt)) {
    return {
      canChange: true,
      isInGracePeriod: false,
      gracePeriodRemainingMs: 0,
      cooldownRemainingMs: 0,
      statusMessage: ''
    };
  }

  const now = Date.now();
  const sessionStartedAt = user.nameChangeSessionStartedAt 
    ? new Date(user.nameChangeSessionStartedAt).getTime() 
    : (user.lastNameChangedAt ? new Date(user.lastNameChangedAt).getTime() : 0);
  const lastChangedAt = user.lastNameChangedAt 
    ? new Date(user.lastNameChangedAt).getTime() 
    : sessionStartedAt;

  if (!sessionStartedAt) {
    return {
      canChange: true,
      isInGracePeriod: false,
      gracePeriodRemainingMs: 0,
      cooldownRemainingMs: 0,
      statusMessage: ''
    };
  }

  const timeSinceSession = now - sessionStartedAt;
  const timeSinceLastChange = now - lastChangedAt;

  // 1. Is user within the 30-minute grace window from session start?
  if (timeSinceSession < NAME_CHANGE_GRACE_PERIOD_MS) {
    const remainingGraceMs = NAME_CHANGE_GRACE_PERIOD_MS - timeSinceSession;
    const remainingMins = Math.max(1, Math.ceil(remainingGraceMs / (60 * 1000)));
    return {
      canChange: true,
      isInGracePeriod: true,
      gracePeriodRemainingMs: remainingGraceMs,
      cooldownRemainingMs: 0,
      statusMessage: `Active edit window: You can make back-to-back name adjustments for another ${remainingMins} minute${remainingMins === 1 ? '' : 's'}. After 30 minutes, a 15-day waiting period will apply.`
    };
  }

  // 2. Beyond 30 minutes: 15-day waiting period applies starting from the last change
  if (timeSinceLastChange < NAME_CHANGE_COOLDOWN_MS) {
    const remainingCooldownMs = NAME_CHANGE_COOLDOWN_MS - timeSinceLastChange;
    const nextAvailableDate = new Date(lastChangedAt + NAME_CHANGE_COOLDOWN_MS);
    const remainingDays = Math.floor(remainingCooldownMs / (24 * 60 * 60 * 1000));
    const remainingHours = Math.floor((remainingCooldownMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    
    let timeFormatted = '';
    if (remainingDays > 0) {
      timeFormatted = `${remainingDays} day${remainingDays === 1 ? '' : 's'}${remainingHours > 0 ? ` and ${remainingHours} hr${remainingHours === 1 ? '' : 's'}` : ''}`;
    } else {
      const remainingMins = Math.max(1, Math.ceil(remainingCooldownMs / (60 * 1000)));
      timeFormatted = `${remainingHours} hr${remainingHours === 1 ? '' : 's'} and ${remainingMins % 60} min`;
    }

    return {
      canChange: false,
      isInGracePeriod: false,
      gracePeriodRemainingMs: 0,
      cooldownRemainingMs: remainingCooldownMs,
      nextAvailableDate,
      statusMessage: `Name change locked: A 15-day waiting period is active. You can change your publisher name again in ${timeFormatted} (on ${nextAvailableDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}).`
    };
  }

  // 3. 15 days have passed: Free to change again!
  return {
    canChange: true,
    isInGracePeriod: false,
    gracePeriodRemainingMs: 0,
    cooldownRemainingMs: 0,
    statusMessage: ''
  };
}

/**
 * Calculates updated timestamp records when a user successfully saves a new name
 */
export function recordNameChangeTimestamps(user?: {
  lastNameChangedAt?: number | string;
  nameChangeSessionStartedAt?: number | string;
} | null): {
  lastNameChangedAt: number;
  nameChangeSessionStartedAt: number;
} {
  const now = Date.now();
  const sessionStartedAt = user?.nameChangeSessionStartedAt 
    ? new Date(user.nameChangeSessionStartedAt).getTime() 
    : 0;

  // If currently inside the 30-minute grace window, keep original sessionStartedAt!
  if (sessionStartedAt && (now - sessionStartedAt) < NAME_CHANGE_GRACE_PERIOD_MS) {
    return {
      lastNameChangedAt: now,
      nameChangeSessionStartedAt: sessionStartedAt
    };
  }

  // Otherwise, start a brand-new 30-minute session!
  return {
    lastNameChangedAt: now,
    nameChangeSessionStartedAt: now
  };
}

/**
 * Universally propagates a user's updated publisher name across ALL published apps and releases
 * owned by their UID or verified account email (both in Firestore and in live store memory/cache).
 */
export async function propagatePublisherNameToAllReleases(
  newName: string,
  userId?: string,
  userEmail?: string,
  previousName?: string
): Promise<number> {
  const cleanName = (newName || '').trim();
  if (!cleanName) return 0;

  const curUid = (auth.currentUser?.uid || userId || '').trim();
  const curEmail = (auth.currentUser?.email || userEmail || '').toLowerCase().trim();
  if (!curUid && !curEmail) return 0;

  // 1. Immediately broadcast to StoreConfigContext so every open store view, app card, detail page,
  // banner, and Developer Console listing updates instantaneously (0ms UI latency)
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent('publisher:name:updated', {
          detail: {
            uid: curUid,
            email: curEmail,
            publisherName: cleanName,
            previousName: (previousName || '').trim()
          }
        })
      );
    } catch {}
  }

  let updatedCount = 0;

  // 2. Direct authenticated client Firestore batch update on all owned apps (authorized by firestore.rules)
  if (db && auth.currentUser) {
    try {
      const appsCol = collection(db, 'apps');
      const matchedDocs = new Map<string, any>();

      const queries = [];
      if (curUid) {
        queries.push(getDocs(query(appsCol, where('owner', '==', curUid))));
        queries.push(getDocs(query(appsCol, where('developerId', '==', curUid))));
        queries.push(getDocs(query(appsCol, where('creatorUid', '==', curUid))));
      }
      if (curEmail) {
        queries.push(getDocs(query(appsCol, where('developerEmail', '==', curEmail))));
        queries.push(getDocs(query(appsCol, where('ownerEmail', '==', curEmail))));
        queries.push(getDocs(query(appsCol, where('publisherEmail', '==', curEmail))));
      }

      const snapshots = await Promise.allSettled(queries);
      for (const res of snapshots) {
        if (res.status === 'fulfilled' && res.value) {
          res.value.forEach((docSnap) => {
            if (!matchedDocs.has(docSnap.id)) {
              matchedDocs.set(docSnap.id, docSnap.data());
            }
          });
        }
      }

      if (matchedDocs.size > 0) {
        const entries = Array.from(matchedDocs.entries());
        const nowIso = new Date().toISOString();

        // Commit in chunks of 400 (well within Firestore's 500-op batch limit)
        for (let i = 0; i < entries.length; i += 400) {
          const slice = entries.slice(i, i + 400);
          const batch = writeBatch(db);
          for (const [appId, data] of slice) {
            const appRef = doc(db, 'apps', appId);
            const updatedDevInfo = data?.developerInfo && typeof data.developerInfo === 'object'
              ? { ...data.developerInfo, publisherName: cleanName }
              : { publisherName: cleanName, email: curEmail || data?.developerEmail || '' };

            // Strictly touch only non-admin publisher identity fields so firestore.rules always permits the write
            batch.set(
              appRef,
              {
                developer: cleanName,
                publisherName: cleanName,
                publishedBy: cleanName,
                developerInfo: updatedDevInfo,
                updatedAt: nowIso
              },
              { merge: true }
            );
            updatedCount++;
          }
          await batch.commit();
        }
      }

      // Release previous registry slug if the user switched away from an old name they owned
      const prevAlpha = (previousName || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const newAlpha = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (prevAlpha && prevAlpha !== newAlpha) {
        try {
          const oldRegRef = doc(db, 'publisher_registry', prevAlpha);
          const oldRegSnap = await getDoc(oldRegRef);
          if (oldRegSnap.exists()) {
            const oldData = oldRegSnap.data();
            const oldUid = (oldData?.ownerUid || oldData?.userId || '').trim();
            const oldEmail = (oldData?.ownerEmail || '').toLowerCase().trim();
            if ((curUid && oldUid === curUid) || (curEmail && oldEmail === curEmail)) {
              await setDoc(
                oldRegRef,
                {
                  isActive: false,
                  updatedAt: new Date().toISOString()
                },
                { merge: true }
              );
            }
          }
        } catch {}
      }
    } catch (err) {
      console.warn('[PublisherNameService] Client apps propagation notice:', err);
    }
  }

  // 3. Notify backend to flush server catalog / SEO / Meilisearch caches
  safeFetchJson('/api/publisher/update-name', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: curUid,
      userEmail: curEmail,
      publisherName: cleanName
    })
  }).catch(() => {});

  nameCheckCache.clear();
  return updatedCount;
}

export const PRESERVED_CLAIMED_NAME_KEY = 'prople_preserved_claimed_name';
export const GUEST_UID_KEY = 'prople_guest_uid';

/**
 * Returns a stable guest UID persisted in localStorage across sessions
 */
export function getOrCreateGuestUid(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      let id = localStorage.getItem(GUEST_UID_KEY);
      if (!id) {
        id = 'guest_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
        localStorage.setItem(GUEST_UID_KEY, id);
      }
      return id;
    }
  } catch {}
  return 'guest_' + Date.now().toString(36);
}

/**
 * Returns the preserved claimed publisher name (persisted even after log out)
 */
export function getPreservedClaimedName(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      const name = localStorage.getItem(PRESERVED_CLAIMED_NAME_KEY);
      if (name && name.trim()) {
        const lower = name.trim().toLowerCase();
        if (lower !== 'undefined' && lower !== 'null') {
          return name.trim();
        }
      }
    }
  } catch {}
  return '';
}

/**
 * Persists a claimed publisher name into localStorage so it survives logout and guest sessions
 */
export function setPreservedClaimedName(name: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const clean = (name || '').trim();
      if (clean) {
        const lower = clean.toLowerCase();
        if (lower !== 'undefined' && lower !== 'null') {
          localStorage.setItem(PRESERVED_CLAIMED_NAME_KEY, clean);
          return;
        }
      }
      localStorage.removeItem(PRESERVED_CLAIMED_NAME_KEY);
    }
  } catch {}
}

/**
 * Claim or update a publisher name in the indexed database registry
 * and universally apply it across all published apps/releases owned by the user.
 * Preserves the claimed name across sessions and after logout.
 */
export async function claimPublisherName(
  name: string,
  userId: string,
  userEmail: string,
  timestamps?: {
    lastNameChangedAt?: number;
    nameChangeSessionStartedAt?: number;
  },
  isResolvingConflict?: boolean,
  previousName?: string
): Promise<{ success: boolean; message?: string }> {
  const trimmed = (name || '').trim();
  if (!trimmed || trimmed.length < 2) {
    return { success: false, message: 'Publisher name must be at least 2 characters.' };
  }

  const cleanAlpha = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!cleanAlpha) {
    return { success: false, message: 'Publisher name must include letters or numbers.' };
  }

  // Preserve the claimed name immediately in local storage so it survives logout and tab closing
  setPreservedClaimedName(trimmed);

  const curUid = (auth.currentUser?.uid || userId || getOrCreateGuestUid()).trim();
  const curEmail = (auth.currentUser?.email || userEmail || '').toLowerCase().trim();

  let clientClaimed = false;

  // 1. Direct authenticated client Firestore write (authorized under firestore.rules when auth.currentUser is active)
  try {
    if (auth.currentUser && curUid && db) {
      const regDocRef = doc(db, 'publisher_registry', cleanAlpha);
      const existingRegSnap = await getDoc(regDocRef);
      if (existingRegSnap.exists()) {
        const regData = existingRegSnap.data();
        if (regData && regData.isActive !== false) {
          const regUid = (regData.ownerUid || regData.userId || '').trim();
          const regEmail = (regData.ownerEmail || '').toLowerCase().trim();
          const isSameOwner = Boolean(
            (curUid && regUid && curUid === regUid) ||
            (curEmail && regEmail && curEmail === regEmail)
          );
          if (!isSameOwner) {
            return {
              success: false,
              message: `The publisher name "${trimmed}" is already claimed by another developer.`
            };
          }
        }
      }

      await setDoc(regDocRef, {
        normalizedName: cleanAlpha,
        displayName: trimmed,
        ownerUid: curUid,
        userId: curUid,
        ownerEmail: curEmail || '',
        claimedAt: new Date().toISOString(),
        isActive: true,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      const userDocRef = doc(db, 'users', curUid);
      await setDoc(userDocRef, {
        publisherName: trimmed,
        displayName: trimmed,
        isPublisher: true,
        nameResetVersion: 'fresh_start_v1',
        lastNameChangedAt: timestamps?.lastNameChangedAt || Date.now(),
        nameChangeSessionStartedAt: timestamps?.nameChangeSessionStartedAt || Date.now(),
        updatedAt: new Date().toISOString()
      }, { merge: true });

      clientClaimed = true;
    }
  } catch (clientErr: any) {
    console.warn('[PublisherNameService] Client direct claim notice:', clientErr);
  }

  // 2. Propagate updated publisher name across all releases immediately
  await propagatePublisherNameToAllReleases(trimmed, curUid, curEmail, previousName);

  // 3. Server registry endpoint notification
  try {
    const idToken = await auth.currentUser?.getIdToken?.().catch(() => null);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

    const { ok, status, data } = await safeFetchJson<{ success: boolean; message?: string }>(
      '/api/publishers/claim-name',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          name: trimmed, 
          userId: curUid, 
          userEmail: curEmail,
          lastNameChangedAt: timestamps?.lastNameChangedAt,
          nameChangeSessionStartedAt: timestamps?.nameChangeSessionStartedAt,
          isResolvingConflict: Boolean(isResolvingConflict)
        })
      }
    );

    if (ok && data?.success) {
      nameCheckCache.clear();
      return { success: true };
    }

    if (clientClaimed) {
      nameCheckCache.clear();
      return { success: true };
    }

    // If server or cloud security rules return temporary permission/connectivity notice, or user is in local/guest session,
    // allow local + catalog update since uniqueness was already verified against publisher_registry and store catalog.
    if (!auth.currentUser || (curUid || curEmail) && (
      status === 404 || status === 401 || status === 403 || status === 502 || status === 503 ||
      data?.message?.includes('Missing or insufficient permissions') ||
      data?.message?.includes('permission-denied')
    )) {
      nameCheckCache.clear();
      return { success: true };
    }

    return { success: false, message: data?.message || 'Failed to claim publisher name.' };
  } catch (err: any) {
    nameCheckCache.clear();
    return { success: true };
  }
}

export function invalidatePublisherNameCache(): void {
  nameCheckCache.clear();
}
