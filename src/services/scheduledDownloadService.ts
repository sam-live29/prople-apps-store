import { incrementAppDownloadCount } from './firestoreAppService';
import { 
  notifyPublisherDownloadVerified,
  checkAndTriggerDownloadMilestones 
} from './firestoreNotificationService';
import { PendingDownloadIncrement } from '../types';

const STORAGE_KEY = 'appmarket_pending_download_increments';
export const DOWNLOAD_DELAY_MS = 5 * 60 * 1000; // 5 minutes

type Listener = (pending: PendingDownloadIncrement[]) => void;
const listeners: Set<Listener> = new Set();

let intervalId: number | null = null;

function loadPending(): PendingDownloadIncrement[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePending(items: PendingDownloadIncrement[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {}
  notifyListeners(items);
}

function notifyListeners(items: PendingDownloadIncrement[]) {
  listeners.forEach(l => {
    try {
      l(items);
    } catch (e) {
      console.warn('Listener error in scheduledDownloadService:', e);
    }
  });
}

/**
 * Check and process any pending downloads that have elapsed the 5 minute verification window
 */
export async function processPendingDownloads(
  onIncrementSuccess?: (appId: string, appName: string, newCount: number) => void
): Promise<void> {
  const all = loadPending();
  const now = Date.now();
  let changed = false;

  for (const item of all) {
    if (!item.executed && now >= item.executeAt) {
      item.executed = true;
      changed = true;

      try {
        const newCount = await incrementAppDownloadCount(item.appId);
        
        // Notify publisher of verified download
        notifyPublisherDownloadVerified(item.appId, item.appName, item.iconUrl, newCount).catch(() => {});

        // Check if publisher reached a download milestone (e.g. 100 downloads) and notify
        checkAndTriggerDownloadMilestones(item.appId, item.appName, newCount, item.iconUrl).catch(() => {});

        if (onIncrementSuccess) {
          onIncrementSuccess(item.appId, item.appName, newCount);
        }
      } catch (err) {
        console.warn(`Could not execute scheduled 5-min download for ${item.appId}:`, err);
      }
    }
  }

  // Filter out executed items older than 1 hour to keep storage clean
  const cleaned = all.filter(item => !item.executed || now - item.executeAt < 3600000);
  if (changed || cleaned.length !== all.length) {
    savePending(cleaned);
  }
}

/**
 * Schedule a new download count increment for an app with 5 minutes delay.
 * Triggered when the user clicks install and the download pop-up successfully opens.
 */
export function scheduleDownloadIncrement(
  appId: string,
  appName: string,
  iconUrl?: string,
  onIncrementSuccess?: (appId: string, appName: string, newCount: number) => void
): PendingDownloadIncrement {
  const now = Date.now();
  const executeAt = now + DOWNLOAD_DELAY_MS;

  const newItem: PendingDownloadIncrement = {
    id: `dl-${appId}-${now}`,
    appId,
    appName,
    iconUrl,
    triggerTime: now,
    executeAt,
    executed: false
  };

  const existing = loadPending();
  // Filter out any unexecuted duplicate for the same app within last 3 minutes to avoid spamming
  const deduped = existing.filter(e => !(e.appId === appId && !e.executed && now - e.triggerTime < 180000));
  deduped.push(newItem);
  savePending(deduped);

  // Set explicit timer for this item
  window.setTimeout(() => {
    processPendingDownloads(onIncrementSuccess);
  }, DOWNLOAD_DELAY_MS + 100);

  ensureIntervalStarted(onIncrementSuccess);

  return newItem;
}

/**
 * Get active pending download item for a specific app (if verification is still counting down)
 */
export function getPendingDownloadForApp(appId: string): PendingDownloadIncrement | null {
  const all = loadPending();
  const now = Date.now();
  const match = all.find(item => item.appId === appId && !item.executed && now < item.executeAt);
  return match || null;
}

/**
 * Subscribe to pending downloads state changes
 */
export function subscribeToPendingDownloads(listener: Listener): () => void {
  listeners.add(listener);
  listener(loadPending());
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Ensure the background heartbeat ticker is running to handle page refreshes / tab switches
 */
export function ensureIntervalStarted(
  onIncrementSuccess?: (appId: string, appName: string, newCount: number) => void
): void {
  if (intervalId !== null) return;

  // Run initial check on startup
  processPendingDownloads(onIncrementSuccess);

  intervalId = window.setInterval(() => {
    processPendingDownloads(onIncrementSuccess);
  }, 10000); // Check every 10 seconds
}
