import { useState, useEffect, useRef } from 'react';
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

  // If the user hasn't changed their own existing name, it's valid
  if (options?.currentUserName && options.currentUserName.trim().toLowerCase() === cleanLower) {
    return {
      available: true,
      isTaken: false,
      message: 'This is your current publisher name.'
    };
  }

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

  // Remote verification via server endpoint
  try {
    const params = new URLSearchParams();
    params.set('name', trimmed);
    if (options?.currentUserId) params.set('currentUserId', options.currentUserId);
    if (options?.currentUserEmail) params.set('currentUserEmail', options.currentUserEmail);

    const { ok, data } = await safeFetchJson<PublisherNameCheckResult>(
      `/api/publishers/check-name?${params.toString()}`
    );

    if (ok && data) {
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

    // If identical to current user's active name, it is valid immediately
    if (options?.currentUserName && options.currentUserName.trim().toLowerCase() === trimmed.toLowerCase()) {
      setIsChecking(false);
      setCheckResult({
        available: true,
        isTaken: false,
        message: ''
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
} | null): NameChangeStatus {
  if (!user || (!user.lastNameChangedAt && !user.nameChangeSessionStartedAt)) {
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
 * Claim or update a publisher name in the indexed database registry
 */
export async function claimPublisherName(
  name: string,
  userId: string,
  userEmail: string,
  timestamps?: {
    lastNameChangedAt: number;
    nameChangeSessionStartedAt: number;
  }
): Promise<{ success: boolean; message?: string }> {
  try {
    const { ok, data } = await safeFetchJson<{ success: boolean; message?: string }>(
      '/api/publishers/claim-name',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: name.trim(), 
          userId, 
          userEmail,
          lastNameChangedAt: timestamps?.lastNameChangedAt,
          nameChangeSessionStartedAt: timestamps?.nameChangeSessionStartedAt
        })
      }
    );
    if (ok && data?.success) {
      nameCheckCache.clear();
      return { success: true };
    }
    return { success: false, message: data?.message || 'Failed to claim publisher name.' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Network error claiming publisher name.' };
  }
}

export function invalidatePublisherNameCache(): void {
  nameCheckCache.clear();
}
