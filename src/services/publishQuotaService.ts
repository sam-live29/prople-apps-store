import { PublishQuotaInfo, UpdateQuotaInfo } from '../types';

const QUOTA_STORAGE_PREFIX = 'appmarket_publish_quota_';
const UPDATE_QUOTA_STORAGE_PREFIX = 'appmarket_update_quota_';

// Production rate limits & exhaustion thresholds
export const EXHAUSTION_WINDOW_MS = 15 * 60 * 1000; // 15 minutes window for new app releases
export const MAX_PER_WINDOW = 3;                     // Max 3 app releases per 15 min window
export const COOLDOWN_BETWEEN_PUBLISH_MS = 3 * 60 * 1000; // 3 minutes cooldown between consecutive releases
export const DAILY_LIMIT = 10;                       // 10 releases per 24 hours

// App update rate limits: 5 updates per 1 hour
export const UPDATE_WINDOW_MS = 60 * 60 * 1000;      // 1 hour window
export const MAX_UPDATES_PER_HOUR = 5;               // Max 5 updates per 1 hour window

function getStorageKey(ownerUid: string): string {
  return `${QUOTA_STORAGE_PREFIX}${ownerUid || 'anonymous'}`;
}

export function loadPublishTimestamps(ownerUid: string): number[] {
  try {
    const raw = localStorage.getItem(getStorageKey(ownerUid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(t => typeof t === 'number') : [];
  } catch {
    return [];
  }
}

export function savePublishTimestamps(ownerUid: string, timestamps: number[]): void {
  try {
    // Keep only timestamps within last 24 hours
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const filtered = timestamps.filter(t => t > cutoff);
    localStorage.setItem(getStorageKey(ownerUid), JSON.stringify(filtered));
  } catch {}
}

/**
 * Check the publishing exhaustion period and frequency status for a developer
 */
export function getPublishQuotaStatus(ownerUid: string): PublishQuotaInfo {
  const timestamps = loadPublishTimestamps(ownerUid);
  const now = Date.now();

  // 1. Timestamps within the active 15-minute rolling window
  const windowCutoff = now - EXHAUSTION_WINDOW_MS;
  const inWindow = timestamps.filter(t => t > windowCutoff);
  const lastPublishedAt = timestamps.length > 0 ? Math.max(...timestamps) : undefined;

  // 2. Cooldown calculation (3 minutes between consecutive publishes)
  let cooldownRemainingSeconds = 0;
  if (lastPublishedAt) {
    const elapsedSinceLast = now - lastPublishedAt;
    if (elapsedSinceLast < COOLDOWN_BETWEEN_PUBLISH_MS) {
      cooldownRemainingSeconds = Math.ceil((COOLDOWN_BETWEEN_PUBLISH_MS - elapsedSinceLast) / 1000);
    }
  }

  // 3. Window quota exhaustion
  const remainingInWindow = Math.max(0, MAX_PER_WINDOW - inWindow.length);
  
  // Earliest publish timestamp in window to determine when a slot reopens
  let windowReopenRemainingSeconds = 0;
  if (inWindow.length >= MAX_PER_WINDOW) {
    const oldestInWindow = Math.min(...inWindow);
    const windowExpiry = oldestInWindow + EXHAUSTION_WINDOW_MS;
    if (windowExpiry > now) {
      windowReopenRemainingSeconds = Math.ceil((windowExpiry - now) / 1000);
    }
  }

  const effectiveRemainingSeconds = Math.max(cooldownRemainingSeconds, windowReopenRemainingSeconds);
  const isExhausted = remainingInWindow <= 0 || cooldownRemainingSeconds > 0;

  // Format next available time string (e.g. "02:45")
  let nextAvailableTimeFormatted = undefined;
  if (effectiveRemainingSeconds > 0) {
    const m = Math.floor(effectiveRemainingSeconds / 60);
    const s = effectiveRemainingSeconds % 60;
    nextAvailableTimeFormatted = `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  return {
    publishedTimestamps: timestamps,
    lastPublishedAt,
    exhaustionWindowMs: EXHAUSTION_WINDOW_MS,
    maxPerWindow: MAX_PER_WINDOW,
    cooldownMs: COOLDOWN_BETWEEN_PUBLISH_MS,
    isExhausted,
    cooldownRemainingSeconds: effectiveRemainingSeconds,
    remainingInWindow,
    nextAvailableTimeFormatted
  };
}

/**
 * Record a successful publication event to enforce exhaustion and frequency tracking
 */
export function recordPublishEvent(ownerUid: string): PublishQuotaInfo {
  const current = loadPublishTimestamps(ownerUid);
  const updated = [...current, Date.now()];
  savePublishTimestamps(ownerUid, updated);
  return getPublishQuotaStatus(ownerUid);
}

function getUpdateStorageKey(ownerUid: string, appId?: string): string {
  return `${UPDATE_QUOTA_STORAGE_PREFIX}${ownerUid || 'anonymous'}_${appId || 'global'}`;
}

export function loadUpdateTimestamps(ownerUid: string, appId?: string): number[] {
  try {
    const raw = localStorage.getItem(getUpdateStorageKey(ownerUid, appId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(t => typeof t === 'number') : [];
  } catch {
    return [];
  }
}

export function saveUpdateTimestamps(ownerUid: string, appId: string | undefined, timestamps: number[]): void {
  try {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const filtered = timestamps.filter(t => t > cutoff);
    localStorage.setItem(getUpdateStorageKey(ownerUid, appId), JSON.stringify(filtered));
  } catch {}
}

/**
 * Check the app update quota status: allow frequent updates with max 5 updates per 1-hour window
 */
export function getUpdateQuotaStatus(ownerUid: string, appId?: string): UpdateQuotaInfo {
  const timestamps = loadUpdateTimestamps(ownerUid, appId);
  const now = Date.now();

  // Timestamps within the active 1-hour rolling window
  const windowCutoff = now - UPDATE_WINDOW_MS;
  const inWindow = timestamps.filter(t => t > windowCutoff);
  const lastUpdatedAt = timestamps.length > 0 ? Math.max(...timestamps) : undefined;

  const remainingInWindow = Math.max(0, MAX_UPDATES_PER_HOUR - inWindow.length);
  const isExhausted = remainingInWindow <= 0;

  let nextAvailableTimeFormatted = undefined;
  if (isExhausted && inWindow.length > 0) {
    const oldestInWindow = Math.min(...inWindow);
    const windowExpiry = oldestInWindow + UPDATE_WINDOW_MS;
    if (windowExpiry > now) {
      const remainingSeconds = Math.ceil((windowExpiry - now) / 1000);
      const m = Math.floor(remainingSeconds / 60);
      const s = remainingSeconds % 60;
      nextAvailableTimeFormatted = `${m}:${s < 10 ? '0' : ''}${s}`;
    }
  }

  return {
    updateTimestamps: timestamps,
    lastUpdatedAt,
    windowMs: UPDATE_WINDOW_MS,
    maxPerWindow: MAX_UPDATES_PER_HOUR,
    isExhausted,
    remainingInWindow,
    nextAvailableTimeFormatted
  };
}

/**
 * Record an app update event to track against the 5-times-per-1-hour limit
 */
export function recordUpdateEvent(ownerUid: string, appId?: string): UpdateQuotaInfo {
  const current = loadUpdateTimestamps(ownerUid, appId);
  const updated = [...current, Date.now()];
  saveUpdateTimestamps(ownerUid, appId, updated);
  return getUpdateQuotaStatus(ownerUid, appId);
}

