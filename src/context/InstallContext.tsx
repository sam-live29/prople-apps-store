import React, { createContext, useContext, useState, ReactNode, useRef, useEffect, useCallback, useMemo } from 'react';
import { InstallState, AppInstallData, NotificationItem, PendingDownloadIncrement } from '../types';
import { 
  scheduleDownloadIncrement, 
  getPendingDownloadForApp, 
  subscribeToPendingDownloads 
} from '../services/scheduledDownloadService';
import { 
  listenToStoreNotifications, 
  addNotificationToFirestore, 
  markNotificationAsReadInFirestore, 
  markAllNotificationsAsReadInFirestore, 
  deleteNotificationFromFirestore, 
  clearAllNotificationsInFirestore,
  dismissNotificationForUser,
  loadDismissedNotificationsFromFirestore,
  isNotificationVisibleToUser,
  showPhoneNativeNotification,
  isPublicNotification,
  isPrivateDeveloperNotification,
  isAppReleaseOrUpdateNotification,
  isGlobalBroadcastNotification,
  getPushedNativeNotifIds,
  recordNativeNotifPushed,
  requestPhoneNotificationPermission
} from '../services/firestoreNotificationService';
import { incrementAppDownloadCount } from '../services/firestoreAppService';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { auth } from '../firebase';
import GoogleSignInDialog from '../components/GoogleSignInDialog';
import { selectMainPackageAsset, isBloatOrSecondaryAsset, isBinaryPackage } from '../utils/packageResolution';
import { safeFetchJson } from '../utils/safeFetch';
import { LoadingStyleVariant } from '../components/InstallProgressButton';

interface InstallOptions {
  downloadUrl?: string;
  appName?: string;
  sizeString?: string;
  iconUrl?: string;
  sha256?: string;
  fileName?: string;
  platform?: 'android' | 'linux' | 'windows' | 'mac' | 'ios' | string;
  packageFormat?: string;
  skipNativeDispatch?: boolean;
}

interface PendingInstallItem {
  appId: string;
  options?: InstallOptions;
  appName?: string;
}

export interface AuthDialogConfig {
  pending?: PendingInstallItem;
  mode?: 'default' | 'publisher' | 'review';
  customTitle?: string;
  customSubtitle?: string;
  onSuccess?: () => void;
}

interface InstallContextType {
  installState: Record<string, AppInstallData>;
  startInstall: (appId: string, options?: InstallOptions | string, legacyAppName?: string) => void;
  pauseInstall: (appId: string) => void;
  resumeInstall: (appId: string) => void;
  cancelInstall: (appId: string) => void;
  uninstall: (appId: string) => void;
  openApp: (appId: string, url?: string) => void;
  downloadApp: (appId: string, url?: string) => void;
  saveDownloadedPackage: (appId: string) => void;
  updateState: (appId: string, data: Partial<AppInstallData>) => void;
  activeDownloadsCount: number;
  downloadedAppsList: Array<{ id: string; name: string; size: string; iconUrl?: string; installedAt?: string; fileName?: string }>;
  notifications: NotificationItem[];
  unreadNotificationsCount: number;
  updatesAvailableCount: number;
  addNotification: (item: Partial<NotificationItem> & { title: string; message: string }) => void;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  clearNotification: (id: string) => void;
  clearAllNotifications: () => void;
  isAuthDialogOpen: boolean;
  openAuthDialog: (configOrPending?: PendingInstallItem | AuthDialogConfig) => void;
  closeAuthDialog: () => void;
  pendingInstall: PendingInstallItem | null;
  pendingDownloads: PendingDownloadIncrement[];
  getPendingDownload: (appId: string) => PendingDownloadIncrement | null;
  loadingStyleVariant: LoadingStyleVariant;
  setLoadingStyleVariant: (variant: LoadingStyleVariant) => void;
  isTestLoadingModalOpen: boolean;
  openTestLoadingModal: () => void;
  closeTestLoadingModal: () => void;
}

const InstallContext = createContext<InstallContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'prople_store_installed_apps_v2';
const LOCAL_NOTIFS_KEY = 'prople_store_notifications_v5';

function parseSizeToBytes(sizeStr?: string): number {
  if (!sizeStr) return 0;
  const trimmed = sizeStr.trim().toUpperCase();
  const num = parseFloat(trimmed.replace(/[^\d.]/g, ''));
  if (isNaN(num) || num <= 0) return 0;
  if (trimmed.includes('GB')) return Math.round(num * 1024 * 1024 * 1024);
  if (trimmed.includes('MB')) return Math.round(num * 1024 * 1024);
  if (trimmed.includes('KB')) return Math.round(num * 1024);
  return Math.round(num * 1024 * 1024);
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1000) {
    return `${(mb / 1024).toFixed(1)} GB`;
  }
  return `${mb.toFixed(1)} MB`;
}

let lastTriggerTime = 0;
let lastTriggerUrl = '';

export function isBinaryFileName(name?: string): boolean {
  if (!name) return false;
  const lower = name.toLowerCase().split('?')[0];
  if (lower.endsWith('.aar')) return false; // Never treat .aar library as an executable binary package
  return isBinaryPackage(name);
}

export function getMimeTypeForFile(fileName?: string): string {
  if (!fileName) return 'application/octet-stream';
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.apk') || lower.endsWith('.aab')) return 'application/vnd.android.package-archive';
  if (lower.endsWith('.exe')) return 'application/x-msdownload';
  if (lower.endsWith('.msi')) return 'application/x-msi';
  if (lower.endsWith('.msix') || lower.endsWith('.appx') || lower.endsWith('.msixbundle') || lower.endsWith('.appxbundle')) return 'application/msix';
  if (lower.endsWith('.7z')) return 'application/x-7z-compressed';
  if (lower.endsWith('.rar')) return 'application/vnd.rar';
  if (lower.endsWith('.zip')) return 'application/zip';
  if (lower.endsWith('.deb')) return 'application/vnd.debian.binary-package';
  if (lower.endsWith('.appimage') || lower.endsWith('.bin') || lower.endsWith('.run') || lower.includes('linux')) return 'application/x-executable';
  if (lower.endsWith('.rpm')) return 'application/x-redhat-package-manager';
  if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) return 'application/gzip';
  if (lower.endsWith('.tar.xz') || lower.endsWith('.txz')) return 'application/x-xz';
  if (lower.endsWith('.tar.zst') || lower.endsWith('.tzst') || lower.endsWith('.pkg.tar.zst')) return 'application/zstd';
  if (lower.endsWith('.snap')) return 'application/vnd.snap';
  if (lower.endsWith('.flatpak') || lower.endsWith('.flatpakref')) return 'application/vnd.flatpak';
  if (lower.endsWith('.dmg')) return 'application/x-apple-diskimage';
  if (lower.endsWith('.pkg')) return 'application/x-newton-compatible-pkg';
  if (lower.endsWith('.ipa')) return 'application/x-itunes-ipa';
  if (lower.endsWith('.jar')) return 'application/java-archive';
  return 'application/octet-stream';
}

/**
 * Extracts the exact binary package filename from the URL or provided assetName.
 * Never invents bloat fallback filenames (like package.bin, application.apk, or -v1.0.apk).
 */
export function extractExactPackageFileName(downloadUrl?: string, customFileName?: string): string {
  if (customFileName) {
    const cleanCustom = decodeURIComponent(customFileName.split('?')[0].split('#')[0].split('/').pop() || '').trim();
    if (cleanCustom && isBinaryFileName(cleanCustom) && !isBloatOrSecondaryAsset(cleanCustom)) {
      return cleanCustom;
    }
  }
  if (downloadUrl) {
    const cleanPath = downloadUrl.trim().split('?')[0].split('#')[0];
    const urlBase = decodeURIComponent(cleanPath.split('/').pop() || '').trim();
    if (urlBase && isBinaryFileName(urlBase) && !isBloatOrSecondaryAsset(urlBase)) {
      return urlBase;
    }
  }
  return '';
}

/**
 * Resolves the direct download URL for any application package (.apk, .exe, .msi, .dmg, .AppImage, .deb, etc.).
 * Directly links to authentic GitHub release CDN assets (Fastly/S3) for 0ms download start and zero server egress.
 */
export function getDirectDownloadUrl(downloadUrl?: string, fileName?: string, platform?: string): string {
  if (!downloadUrl || downloadUrl === '#' || (!downloadUrl.startsWith('http://') && !downloadUrl.startsWith('https://') && !downloadUrl.startsWith('/api/'))) return '';

  const cleanUrl = downloadUrl.trim();
  if (cleanUrl.startsWith('/api/download-apk') || cleanUrl.startsWith('/api/download-proxy')) {
    return cleanUrl;
  }

  const lowerUrl = cleanUrl.toLowerCase().split('?')[0];
  if (
    lowerUrl.includes('/archive/refs/') ||
    lowerUrl.includes('/tarball/') ||
    lowerUrl.includes('/zipball/') ||
    lowerUrl.includes('/actions/runs/') ||
    lowerUrl.includes('/pipeline/') ||
    lowerUrl.includes('/pipelines/') ||
    lowerUrl.includes('/tree/') ||
    lowerUrl.includes('/blob/')
  ) {
    return '';
  }

  const exactName = extractExactPackageFileName(cleanUrl, fileName);

  // 1. If it's a GitHub release tag URL, resolve directly to the authentic binary release link!
  if (cleanUrl.includes('github.com') && cleanUrl.includes('/releases/tag/') && exactName) {
    const parts = cleanUrl.replace(/^https?:\/\/github\.com\//i, '').split('/releases/tag/');
    const repo = parts[0];
    const tag = parts[1]?.split('/')[0]?.split('?')[0];
    if (repo && tag) {
      return `https://github.com/${repo}/releases/download/${tag}/${exactName}`;
    }
  }

  // 2. If it's already a direct release download link or binary package, return the direct link!
  if (cleanUrl.includes('/releases/download/') || isBinaryFileName(cleanUrl)) {
    return cleanUrl;
  }

  // 3. Fallback: if it's another repository URL or needs resolving via proxy
  if (cleanUrl.includes('github.com/')) {
    const params = new URLSearchParams();
    params.set('url', cleanUrl);
    if (exactName) params.set('name', exactName);
    if (platform) params.set('platform', platform);
    return `/api/download-apk?${params.toString()}`;
  }

  return cleanUrl;
}

/**
 * Instant Zero-Buffering Native Stream Dispatcher:
 * Triggers the browser's native DownloadManager immediately at t=0ms via direct CDN release link
 * or same-origin fallback without holding files in memory.
 * - Direct Fastly CDN streaming (zero Prople Store bandwidth consumption)
 * - Zero delay on page
 * - Zero page navigation, zero new tabs, and zero address bar loading line
 * - Uses only the exact package filename (no bloat fallback files)
 * - Strictly rejects downloads for package sizes under 1 MB to prevent 10.33 KB apk bloat download
 */
export function dispatchInstantNativeDownload(
  targetUrl: string,
  fileName?: string,
  platform?: string,
  onError?: (msg: string) => void,
  sizeString?: string
): { success: boolean; error?: string } {
  if (!targetUrl || typeof window === 'undefined') {
    const err = 'Missing download URL.';
    onError?.(err);
    return { success: false, error: err };
  }

  // Strictly block package sizes less than 1 MB to prevent 10.33 KB apk bloat download
  if (sizeString) {
    const parsedBytes = parseSizeToBytes(sizeString);
    if (parsedBytes > 0 && parsedBytes < 1024 * 1024) {
      const err = `Package size is under 1 MB (${sizeString}). Download prevented to avoid corrupted stubs.`;
      console.warn('[InstallContext]', err);
      onError?.(err);
      return { success: false, error: err };
    }
  }

  const cleanUrl = targetUrl.trim();
  const lowerUrl = cleanUrl.toLowerCase().split('?')[0];

  // Immediate block against HTML, PHP, ASP, source code archives, or internal non-binary paths
  if (
    lowerUrl.includes('__cookie_check') ||
    lowerUrl.includes('/api/apps') ||
    lowerUrl.includes('/api/auth') ||
    lowerUrl.endsWith('.html') ||
    lowerUrl.endsWith('.htm') ||
    lowerUrl.endsWith('.php') ||
    lowerUrl.endsWith('.asp') ||
    lowerUrl.endsWith('.aspx') ||
    lowerUrl.includes('/archive/refs/') ||
    lowerUrl.includes('/tarball/') ||
    lowerUrl.includes('/zipball/') ||
    lowerUrl.includes('/actions/runs/') ||
    lowerUrl.includes('/pipeline/') ||
    lowerUrl.includes('/pipelines/') ||
    lowerUrl.includes('/tree/') ||
    lowerUrl.includes('/blob/')
  ) {
    const err = 'Target URL is a webpage or source archive, not an installable binary package.';
    console.error('[InstallContext]', err, cleanUrl);
    onError?.(err);
    return { success: false, error: err };
  }

  const exactFileName = extractExactPackageFileName(cleanUrl, fileName);

  // If it's a non-GitHub URL and we have neither a binary URL nor an exact binary package filename, refuse bloat fallback
  if (!cleanUrl.includes('github.com') && !cleanUrl.startsWith('/api/download-') && !cleanUrl.startsWith('blob:') && !exactFileName && !isBinaryFileName(cleanUrl)) {
    const err = 'No exact binary package found at target URL.';
    onError?.(err);
    return { success: false, error: err };
  }

  // DIRECT RELEASE DOWNLOAD OPTIMIZATION:
  // If the target is already a genuine GitHub release asset or binary package, trigger native download directly from GitHub CDN!
  let directBinaryUrl = '';
  if (cleanUrl.includes('/releases/download/') || isBinaryFileName(cleanUrl)) {
    directBinaryUrl = cleanUrl;
  } else if (cleanUrl.includes('github.com') && cleanUrl.includes('/releases/tag/') && exactFileName) {
    const parts = cleanUrl.replace(/^https?:\/\/github\.com\//i, '').split('/releases/tag/');
    const repo = parts[0];
    const tag = parts[1]?.split('/')[0]?.split('?')[0];
    if (repo && tag) {
      directBinaryUrl = `https://github.com/${repo}/releases/download/${tag}/${exactFileName}`;
    }
  }

  if (directBinaryUrl) {
    triggerAnchorDownload(directBinaryUrl, exactFileName);
    return { success: true };
  }

  let sameOriginDownloadUrl = cleanUrl;
  if (!cleanUrl.startsWith('/api/download-apk') && !cleanUrl.startsWith('blob:')) {
    const params = new URLSearchParams();
    params.set('url', cleanUrl);
    if (exactFileName) params.set('name', exactFileName);
    if (platform) params.set('platform', platform);
    sameOriginDownloadUrl = `/api/download-apk?${params.toString()}`;
  }

  try {
    // If the URL is going through our /api/download-apk proxy, perform an async head/pre-check
    // to verify that the upstream server is returning a real binary and not a 422 JSON error or 10.33 KB HTML page!
    if (sameOriginDownloadUrl.startsWith('/api/download-apk')) {
      fetch(sameOriginDownloadUrl, { method: 'HEAD' })
        .then((headRes) => {
          if (!headRes.ok || headRes.status === 204 || headRes.status === 422) {
            headRes.json().catch(() => ({})).then((errData: any) => {
              const errMsg = errData?.error || 'The binary package for this application is not accessible or currently updating.';
              console.warn('[InstallContext] Download pre-check failed:', errMsg);
              onError?.(errMsg);
            });
            return;
          }
          // Direct real binary verified! Trigger native browser download directly
          triggerAnchorDownload(sameOriginDownloadUrl, exactFileName);
        })
        .catch(() => {
          // In case HEAD is not allowed by intermediate proxy, fall back to direct anchor download
          triggerAnchorDownload(sameOriginDownloadUrl, exactFileName);
        });
      return { success: true };
    }

    triggerAnchorDownload(sameOriginDownloadUrl, exactFileName);
    return { success: true };
  } catch (err: any) {
    const msg = err?.message || 'Failed to start package download.';
    onError?.(msg);
    return { success: false, error: msg };
  }
}

function triggerAnchorDownload(url: string, fileName?: string) {
  const a = document.createElement('a');
  a.href = url;
  if (fileName) {
    a.download = fileName;
    a.setAttribute('download', fileName);
  }
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (document.body.contains(a)) {
      document.body.removeChild(a);
    }
  }, 2000);
}

export async function downloadBinaryAsBlob(
  targetUrl: string,
  fileName: string,
  _appName?: string,
  platform?: string,
  onError?: (msg: string) => void,
  _onProgress?: (progress: number, downloadedBytes: number, totalBytes: number) => void
): Promise<{ success: boolean; blobUrl?: string; error?: string }> {
  return dispatchInstantNativeDownload(targetUrl, fileName, platform, onError);
}

export function triggerInstantDownload(url: string, fileName: string, onError?: (msg: string) => void): boolean {
  const res = dispatchInstantNativeDownload(url, fileName, undefined, onError);
  return res.success;
}

export function triggerDirectDownloadLink(
  url: string, 
  fileName: string,
  _appName?: string,
  platform?: string,
  onError?: (msg: string) => void
): boolean {
  const res = dispatchInstantNativeDownload(url, fileName, platform, onError);
  return res.success;
}

/**
 * Universal client-side GitHub release resolver:
 * Directly queries GitHub's public CORS-friendly API to find genuine binary packages (.apk, .exe, .msi, .zip, .dmg, .AppImage)
 * when publishing or inspecting a repository.
 */
export async function resolveGitHubApkClientSide(
  rawUrl: string,
  platform?: 'android' | 'linux' | 'windows' | 'mac' | string
): Promise<{ resolvedUrl: string; assetName?: string; isWindows?: boolean; isLinux?: boolean } | null> {
  try {
    const cleanUrl = rawUrl.trim();
    if (isBinaryFileName(cleanUrl)) {
      const fileName = decodeURIComponent(cleanUrl.split('/').pop()?.split('?')[0]?.split('#')[0] || '').trim();
      const fn = fileName.toLowerCase();
      return { 
        resolvedUrl: cleanUrl, 
        assetName: fileName, 
        isWindows: fn.endsWith('.exe') || fn.endsWith('.msi'),
        isLinux: fn.endsWith('.appimage') || fn.endsWith('.deb') || fn.endsWith('.rpm') || fn.includes('linux')
      };
    }
    const match = cleanUrl.match(/github\.com\/([^/]+)\/([^/]+)/i);
    if (!match) return null;
    const owner = match[1];
    const repo = match[2].replace(/\.git$/i, '');

    // 1. Try latest release
    const { ok: latestOk, data: release } = await safeFetchJson<any>(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    });
    if (latestOk && release && Array.isArray(release.assets) && release.assets.length > 0) {
      const bin = selectMainPackageAsset(release.assets, platform);
      if (bin?.downloadUrl) {
        const fn = bin.name.toLowerCase();
        return { 
          resolvedUrl: bin.downloadUrl, 
          assetName: bin.name, 
          isWindows: fn.endsWith('.exe') || fn.endsWith('.msi'),
          isLinux: fn.endsWith('.appimage') || fn.endsWith('.deb') || fn.endsWith('.rpm') || fn.includes('linux')
        };
      }
    }

    // 2. Try all releases
    const { ok: listOk, data: releases } = await safeFetchJson<any>(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=5`, {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    });
    if (listOk && Array.isArray(releases)) {
      for (const rel of releases) {
        if (Array.isArray(rel.assets) && rel.assets.length > 0) {
          const bin = selectMainPackageAsset(rel.assets, platform);
          if (bin?.downloadUrl) {
            const fn = bin.name.toLowerCase();
            return { 
              resolvedUrl: bin.downloadUrl, 
              assetName: bin.name, 
              isWindows: fn.endsWith('.exe') || fn.endsWith('.msi'),
              isLinux: fn.endsWith('.appimage') || fn.endsWith('.deb') || fn.endsWith('.rpm') || fn.includes('linux')
            };
          }
        }
      }
    }
  } catch (err) {
    console.warn('[InstallContext] Client-side GitHub release resolution error:', err);
  }
  return null;
}

export async function triggerDirectDownloadImmediate(
  downloadUrl?: string, 
  fileName?: string, 
  _appName?: string,
  platform?: 'android' | 'linux' | 'windows' | 'mac' | string,
  onError?: (msg: string) => void,
  sizeString?: string
): Promise<boolean> {
  if (!downloadUrl) return false;
  const cleanUrl = downloadUrl.trim();
  const targetPlat = (platform || '').toLowerCase().trim();
  const exactFileName = extractExactPackageFileName(cleanUrl, fileName);

  const res = dispatchInstantNativeDownload(cleanUrl, exactFileName, targetPlat, onError, sizeString);
  return res.success;
}

export async function triggerBrowserApkDownload(
  downloadUrl?: string, 
  fileName?: string, 
  _appName?: string,
  onError?: (msg: string) => void,
  platform?: 'android' | 'linux' | 'windows' | 'mac' | string,
  sizeString?: string
): Promise<boolean> {
  if (!downloadUrl || downloadUrl === '#' || (!downloadUrl.startsWith('http://') && !downloadUrl.startsWith('https://') && !downloadUrl.startsWith('/api/'))) {
    onError?.('Valid download URL is missing.');
    return false;
  }

  // Debounce accidental rapid duplicate clicks within 400ms on the same URL
  const now = Date.now();
  if (now - lastTriggerTime < 400 && lastTriggerUrl === downloadUrl) {
    return true;
  }
  lastTriggerTime = now;
  lastTriggerUrl = downloadUrl;

  const cleanUrl = downloadUrl.trim();
  const targetPlat = (platform || '').toLowerCase().trim();
  const exactFileName = extractExactPackageFileName(cleanUrl, fileName);

  const res = dispatchInstantNativeDownload(cleanUrl, exactFileName, targetPlat, onError, sizeString);
  return res.success;
}

export function InstallProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isPublisherOfApp } = useAuth();
  const { showToast } = useToast();

  const [installState, setInstallState] = useState<Record<string, AppInstallData>>(() => {
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch {}
    return {};
  });

  const [rawNotifications, setRawNotifications] = useState<NotificationItem[]>(() => {
    try {
      // Purge legacy storage keys from previous builds
      ['prople_store_notifications_v1', 'prople_store_notifications_v2', 'prople_store_notifications_v3', 'prople_store_notifications_v4'].forEach(k => {
        try { localStorage.removeItem(k); } catch {}
      });

      const saved = localStorage.getItem(LOCAL_NOTIFS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (n: NotificationItem) => 
              n.id !== 'notif-security-scan' && 
              !n.id.includes('brick-stack') &&
              n.appId !== 'app-brick-stack' &&
              !n.title?.toLowerCase().includes('brick stack') &&
              !n.title?.toLowerCase().includes('play protect') &&
              n.category !== 'download_count' &&
              !n.id?.startsWith('notif-dl-verified-') &&
              !n.id?.startsWith('notif-milestone-') &&
              !n.title?.toLowerCase().includes('download verified') &&
              !n.title?.toLowerCase().includes('official download') &&
              !n.title?.toLowerCase().includes('download milestone') &&
              !n.message?.toLowerCase().includes('verified download recorded') &&
              !n.message?.toLowerCase().includes('total downloads')
          );
        }
      }
    } catch (e) {
      console.warn('Failed to load notifications from storage', e);
    }
    return [];
  });

  const [dismissedNotifIds, setDismissedNotifIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('prople_store_dismissed_notifs_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Synchronize remote dismissed notification IDs from user profile in Firestore
  useEffect(() => {
    if (user?.uid) {
      loadDismissedNotificationsFromFirestore(user).then((remoteIds) => {
        if (remoteIds && remoteIds.length > 0) {
          setDismissedNotifIds(prev => {
            const merged = Array.from(new Set([...prev, ...remoteIds])).slice(-500);
            try { localStorage.setItem('prople_store_dismissed_notifs_v1', JSON.stringify(merged)); } catch {}
            return merged;
          });
        }
      }).catch(() => {});
    }
  }, [user]);

  // Loading Theme Variant State with LocalStorage Persistence
  const [loadingStyleVariant, setLoadingStyleVariantState] = useState<LoadingStyleVariant>(() => {
    try {
      const saved = localStorage.getItem('prople_loading_style');
      if (saved && ['tonal-brand', 'solid-brand', 'deep-contrast', 'outline-minimal', 'glass-glow'].includes(saved)) {
        return saved as LoadingStyleVariant;
      }
    } catch {}
    return 'tonal-brand';
  });

  const [isTestLoadingModalOpen, setIsTestLoadingModalOpen] = useState(false);

  const setLoadingStyleVariant = useCallback((variant: LoadingStyleVariant) => {
    setLoadingStyleVariantState(variant);
    try {
      localStorage.setItem('prople_loading_style', variant);
    } catch {}
    showToast(`Applied ${variant} loading style to store!`);
  }, [showToast]);

  const openTestLoadingModal = useCallback(() => {
    setIsTestLoadingModalOpen(true);
  }, []);

  const closeTestLoadingModal = useCallback(() => {
    setIsTestLoadingModalOpen(false);
  }, []);

  const seenNotifIdsRef = useRef<Set<string>>(new Set());
  const isFirstNotifLoadRef = useRef(true);
  const inFlightClearIdsRef = useRef<Set<string>>(new Set());
  const isClearingAllRef = useRef<boolean>(false);

  // Real-time listener for Firestore database notifications
  useEffect(() => {
    const unsubscribe = listenToStoreNotifications(
      (liveNotifs) => {
        const cleaned = liveNotifs.filter(
          (n: NotificationItem) => 
            n.id !== 'notif-security-scan' && 
            !n.id.includes('brick-stack') &&
            n.appId !== 'app-brick-stack' &&
            !n.title?.toLowerCase().includes('brick stack') &&
            n.category !== 'download_count' &&
            !n.id?.startsWith('notif-dl-verified-') &&
            !n.id?.startsWith('notif-milestone-') &&
            !n.title?.toLowerCase().includes('download verified') &&
            !n.title?.toLowerCase().includes('official download') &&
            !n.title?.toLowerCase().includes('download milestone') &&
            !n.message?.toLowerCase().includes('verified download recorded') &&
            !n.message?.toLowerCase().includes('total downloads')
        );

        const pushedIds = getPushedNativeNotifIds();

        cleaned.forEach(n => {
          const notifId = n.id;
          const isGlobalBroadcast = isGlobalBroadcastNotification(n);
          const isEligibleForNativePush = 
            isGlobalBroadcast || 
            (isPublicNotification(n) && !isPrivateDeveloperNotification(n) && !isAppReleaseOrUpdateNotification(n));

          if (!isNotificationVisibleToUser(n, user, isPublisherOfApp)) {
            seenNotifIdsRef.current.add(notifId);
            return;
          }

          if (isFirstNotifLoadRef.current) {
            // First load on startup:
            // Check if there is an unpushed recent global broadcast from admin panel (created within last 4 hours)
            const isRecentBroadcast = 
              isGlobalBroadcast && 
              n.createdAt && 
              (Date.now() - n.createdAt < 4 * 60 * 60 * 1000) &&
              n.isUnread !== false;

            if (isRecentBroadcast && !pushedIds.has(notifId) && !seenNotifIdsRef.current.has(notifId)) {
              seenNotifIdsRef.current.add(notifId);
              recordNativeNotifPushed(notifId);
              showPhoneNativeNotification(n.title, {
                body: n.message,
                icon: n.iconUrl || '/pwa-192x192.png',
                tag: notifId,
                data: { url: n.actionUrl || '/' }
              });
            } else {
              seenNotifIdsRef.current.add(notifId);
            }
          } else {
            // Live incoming notification while app is running
            if (!seenNotifIdsRef.current.has(notifId) && !pushedIds.has(notifId)) {
              seenNotifIdsRef.current.add(notifId);
              if (isEligibleForNativePush) {
                recordNativeNotifPushed(notifId);
                showPhoneNativeNotification(n.title, {
                  body: n.message,
                  icon: n.iconUrl || '/pwa-192x192.png',
                  tag: notifId,
                  data: { url: n.actionUrl || '/' }
                });
              }
            }
          }
        });

        isFirstNotifLoadRef.current = false;
        setRawNotifications(cleaned);
        try {
          localStorage.setItem(LOCAL_NOTIFS_KEY, JSON.stringify(cleaned));
        } catch {}
      },
      (err) => {
        console.warn('Live notifications subscription error:', err);
      }
    );
    return () => unsubscribe();
  }, [user, isPublisherOfApp]);

  // Filter notifications based on role:
  // - Download counts & reviews: ONLY visible to the publisher of that app
  // - Updates & new release apps: visible to all users
  // - Review replies: ONLY visible to the author of the review
  const visibleNotifications = useMemo(() => {
    return rawNotifications.filter(n => {
      if (dismissedNotifIds.includes(n.id)) return false;
      return isNotificationVisibleToUser(n, user, isPublisherOfApp);
    });
  }, [rawNotifications, user, isPublisherOfApp, dismissedNotifIds]);

  // Authentication Dialog & Pending Install Flow
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [authDialogConfig, setAuthDialogConfig] = useState<AuthDialogConfig | null>(null);
  const [pendingInstall, setPendingInstall] = useState<PendingInstallItem | null>(null);
  const pendingInstallRef = useRef<PendingInstallItem | null>(null);
  const installStateRef = useRef(installState);

  // Keep installStateRef in sync
  useEffect(() => {
    installStateRef.current = installState;
  }, [installState]);

  // Keep track of abort controllers, intervals, and chunk timers per app
  const abortControllersRef = useRef<Record<string, AbortController>>({});
  const activeIntervalsRef = useRef<Record<string, number>>({});
  const activeTimeoutsRef = useRef<Record<string, number>>({});

  // Sync pendingInstall to ref
  useEffect(() => {
    pendingInstallRef.current = pendingInstall;
  }, [pendingInstall]);

  // Pending 5-Minute Verified Download Increments
  const [pendingDownloads, setPendingDownloads] = useState<PendingDownloadIncrement[]>([]);

  useEffect(() => {
    return subscribeToPendingDownloads((items) => {
      setPendingDownloads([...items]);
    });
  }, []);

  const getPendingDownload = useCallback((targetAppId: string) => {
    return getPendingDownloadForApp(targetAppId);
  }, [pendingDownloads]);

  // Clear any legacy simulated installed state from localStorage
  useEffect(() => {
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch {}
  }, []);

  // Sync notifications to local storage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_NOTIFS_KEY, JSON.stringify(rawNotifications));
    } catch (e) {
      console.warn('Failed to save notifications to storage', e);
    }
  }, [rawNotifications]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      (Object.values(abortControllersRef.current) as AbortController[]).forEach(c => c?.abort());
      (Object.values(activeIntervalsRef.current) as number[]).forEach(window.clearInterval);
      (Object.values(activeTimeoutsRef.current) as number[]).forEach(window.clearTimeout);
    };
  }, []);

  const updateState = (appId: string, data: Partial<AppInstallData>) => {
    setInstallState(prev => {
      const existing: AppInstallData = prev[appId] || {
        state: 'uninstalled',
        progress: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        speedFormatted: '0 MB/s',
        etaFormatted: '--',
        sizeFormatted: '0 MB'
      };
      return {
        ...prev,
        [appId]: { ...existing, ...data }
      };
    });
  };

  const addNotification = (item: Partial<NotificationItem> & { title: string; message: string }) => {
    const newItem: NotificationItem = {
      id: item.id || `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: item.title,
      message: item.message,
      timestamp: item.timestamp || 'Just now',
      iconUrl: item.iconUrl,
      isUnread: item.isUnread !== undefined ? item.isUnread : true,
      appId: item.appId,
      actionType: item.actionType || (item.appId ? 'app_detail' : undefined),
      actionUrl: item.actionUrl,
      actionLabel: item.actionLabel,
      createdAt: item.createdAt || Date.now(),
      category: item.category,
      targetType: item.targetType,
      targetUid: item.targetUid,
      targetUserName: item.targetUserName,
      targetEmail: item.targetEmail,
      publisherAppId: item.publisherAppId,
      publisherUid: item.publisherUid,
      publisherEmail: item.publisherEmail,
      publisherName: item.publisherName
    };
    setRawNotifications(prev => [newItem, ...prev.filter(n => n.id !== newItem.id)]);
    // Persist to real Firestore database
    addNotificationToFirestore(newItem).catch((err) => {
      console.warn('addNotificationToFirestore error:', err);
    });
  };

  const markNotificationAsRead = (id: string) => {
    setRawNotifications(prev => prev.map(n => n.id === id ? { ...n, isUnread: false } : n));
    markNotificationAsReadInFirestore(id).catch((err) => {
      console.warn('markNotificationAsReadInFirestore error:', err);
    });
  };

  const markAllNotificationsAsRead = () => {
    const unreadIds = visibleNotifications.filter(n => n.isUnread).map(n => n.id);
    setRawNotifications(prev => prev.map(n => unreadIds.includes(n.id) ? { ...n, isUnread: false } : n));
    if (unreadIds.length > 0) {
      markAllNotificationsAsReadInFirestore(unreadIds).catch((err) => {
        console.warn('markAllNotificationsAsReadInFirestore error:', err);
      });
    }
  };

  const clearNotification = useCallback((id: string) => {
    if (!id) return;
    if (inFlightClearIdsRef.current.has(id) || isClearingAllRef.current) {
      return;
    }
    inFlightClearIdsRef.current.add(id);

    // 1. Immediately remove from local state & cache
    setRawNotifications(prev => {
      const updated = prev.filter(n => n.id !== id);
      try {
        localStorage.setItem(LOCAL_NOTIFS_KEY, JSON.stringify(updated));
        const storeRaw = localStorage.getItem('prople_store_notifications_v5');
        if (storeRaw) {
          const storeList: NotificationItem[] = JSON.parse(storeRaw);
          const filteredStore = storeList.filter(n => n.id !== id);
          localStorage.setItem('prople_store_notifications_v5', JSON.stringify(filteredStore));
        }
      } catch {}
      return updated;
    });

    // 2. Register in dismissed set so it never reappears from live query snapshots
    setDismissedNotifIds(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id].slice(-500);
      try { localStorage.setItem('prople_store_dismissed_notifs_v1', JSON.stringify(next)); } catch {}
      return next;
    });

    // 3. Background sync with Firestore: persists dismissal & deletes doc if authorized
    deleteNotificationFromFirestore(id, user)
      .catch((err) => {
        console.warn('deleteNotificationFromFirestore notice:', err);
      })
      .finally(() => {
        inFlightClearIdsRef.current.delete(id);
      });
  }, [user]);

  const clearAllNotifications = useCallback(() => {
    if (isClearingAllRef.current) return;
    const targetItems = [...visibleNotifications];
    if (targetItems.length === 0) return;

    isClearingAllRef.current = true;
    const targetIds = targetItems.map(n => n.id);
    const targetIdSet = new Set(targetIds);

    // 1. Register in dismissed set
    setDismissedNotifIds(prev => {
      const next = Array.from(new Set([...prev, ...targetIds])).slice(-500);
      try { localStorage.setItem('prople_store_dismissed_notifs_v1', JSON.stringify(next)); } catch {}
      return next;
    });

    // 2. Immediately remove from local state & cache
    setRawNotifications(prev => {
      const updated = prev.filter(n => !targetIdSet.has(n.id));
      try {
        localStorage.setItem(LOCAL_NOTIFS_KEY, JSON.stringify(updated));
        const storeRaw = localStorage.getItem('prople_store_notifications_v5');
        if (storeRaw) {
          const storeList: NotificationItem[] = JSON.parse(storeRaw);
          const filteredStore = storeList.filter(n => !targetIdSet.has(n.id));
          localStorage.setItem('prople_store_notifications_v5', JSON.stringify(filteredStore));
        }
      } catch {}
      return updated;
    });

    // 3. Background sync with Firestore: persists dismissals
    clearAllNotificationsInFirestore(targetIds, user)
      .catch((err) => {
        console.warn('clearAllNotificationsInFirestore notice:', err);
      })
      .finally(() => {
        isClearingAllRef.current = false;
      });
  }, [visibleNotifications, user]);

  const startInstall = useCallback((appId: string, options?: InstallOptions | string, legacyAppName?: string) => {
    let opts: InstallOptions = {};
    if (typeof options === 'string') {
      opts = { downloadUrl: options, appName: legacyAppName };
    } else if (options) {
      opts = options;
    }

    const current = installStateRef.current[appId];
    const appName = opts.appName || current?.appName || 'Application';
    const sizeString = opts.sizeString || current?.sizeFormatted;
    const totalBytes = parseSizeToBytes(sizeString);

    // Strictly prevent downloading apps with sizes less than 1 MB to prevent 10.33 KB apk bloat download
    if (totalBytes > 0 && totalBytes < 1024 * 1024) {
      showToast(`Download prevented: package size (${sizeString}) is less than 1 MB.`);
      return;
    }

    const downloadUrl = (opts.downloadUrl || current?.downloadUrl || '').trim();
    const sha256 = opts.sha256 || current?.sha256;
    const iconUrl = opts.iconUrl || current?.iconUrl;
    const rawFileName = opts.fileName || current?.fileName;
    const platform = opts.platform || current?.platform;
    const packageFormat = opts.packageFormat || current?.packageFormat;

    if (!downloadUrl || downloadUrl === '#') {
      showToast('Application package download link is not available.');
      return;
    }

    const exactFileName = extractExactPackageFileName(downloadUrl, rawFileName);
    const targetPlat = (platform || '').toLowerCase().trim();

    // Instant 0ms download dispatch without any mock simulation or RAM cache accumulation
    if (!opts.skipNativeDispatch) {
      const res = dispatchInstantNativeDownload(downloadUrl, exactFileName, targetPlat, (err) => showToast(err), sizeString);
      if (!res.success) {
        return;
      }
    }

    showToast(`Downloading ${exactFileName || appName}...`);

    // Schedule official download registration (updates document download metrics, no notification spam)
    scheduleDownloadIncrement(appId, appName, iconUrl);
  }, [showToast]);

  // SEAMLESS FLOW:
  // When user successfully authenticates (with Google or other provider),
  // automatically resume and proceed with any pending installation!
  useEffect(() => {
    if (user && pendingInstallRef.current) {
      const pending = pendingInstallRef.current;
      pendingInstallRef.current = null;
      setPendingInstall(null);
      setIsAuthDialogOpen(false);

      // Start install seamlessly
      startInstall(pending.appId, pending.options, pending.appName);
    }
  }, [user?.uid, startInstall]);

  const openAuthDialog = (configOrPending?: PendingInstallItem | AuthDialogConfig) => {
    if (configOrPending) {
      if ('appId' in configOrPending) {
        setPendingInstall(configOrPending);
        setAuthDialogConfig({ pending: configOrPending });
      } else {
        if (configOrPending.pending) {
          setPendingInstall(configOrPending.pending);
        }
        setAuthDialogConfig(configOrPending);
      }
    } else {
      setAuthDialogConfig(null);
    }
    setIsAuthDialogOpen(true);
  };

  const closeAuthDialog = () => {
    if (pendingInstall) {
      const curr = installState[pendingInstall.appId];
      if (curr && (curr.state === 'pending' || curr.state === 'paused')) {
        updateState(pendingInstall.appId, {
          state: 'uninstalled',
          progress: 0,
          downloadedBytes: 0,
          totalBytes: 0,
          speedFormatted: '',
          etaFormatted: ''
        });
      }
      setPendingInstall(null);
    }
    setAuthDialogConfig(null);
    setIsAuthDialogOpen(false);
  };

  const pauseInstall = (appId: string) => {
    if (abortControllersRef.current[appId]) {
      abortControllersRef.current[appId].abort();
      delete abortControllersRef.current[appId];
    }
    if (activeIntervalsRef.current[appId]) {
      clearInterval(activeIntervalsRef.current[appId]);
      delete activeIntervalsRef.current[appId];
    }
    if (activeTimeoutsRef.current[appId]) {
      clearTimeout(activeTimeoutsRef.current[appId]);
      delete activeTimeoutsRef.current[appId];
    }

    const curr = installState[appId];
    if (curr && (curr.state === 'downloading' || curr.state === 'pending')) {
      updateState(appId, {
        state: 'paused',
        speedFormatted: 'Paused',
        etaFormatted: 'Paused'
      });
    }
  };

  const resumeInstall = (appId: string) => {
    const curr = installState[appId];
    if (curr && curr.state === 'paused') {
      startInstall(appId, {
        downloadUrl: curr.downloadUrl,
        appName: curr.appName,
        iconUrl: curr.iconUrl,
        sha256: curr.sha256,
        fileName: curr.fileName,
        sizeString: `${formatBytes(curr.totalBytes)}`,
        platform: curr.platform,
        packageFormat: curr.packageFormat
      });
    }
  };

  const cancelInstall = (appId: string) => {
    if (abortControllersRef.current[appId]) {
      abortControllersRef.current[appId].abort();
      delete abortControllersRef.current[appId];
    }
    if (activeIntervalsRef.current[appId]) {
      clearInterval(activeIntervalsRef.current[appId]);
      delete activeIntervalsRef.current[appId];
    }
    if (activeTimeoutsRef.current[appId]) {
      clearTimeout(activeTimeoutsRef.current[appId]);
      delete activeTimeoutsRef.current[appId];
    }

    updateState(appId, {
      state: 'uninstalled',
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      speedFormatted: '0 MB/s',
      etaFormatted: '--',
      sizeFormatted: '0 MB',
      needsUpdate: false
    });
    showToast('Download cancelled');
  };

  const uninstall = (appId: string) => {
    cancelInstall(appId);
  };

  const saveDownloadedPackage = (appId: string) => {
    const item = installState[appId];
    const targetPlat = (item?.platform || '').toLowerCase().trim();
    const exactFileName = extractExactPackageFileName(item?.downloadUrl, item?.fileName);

    if (item?.downloadUrl) {
      const res = dispatchInstantNativeDownload(item.downloadUrl, exactFileName, targetPlat, (err) => showToast(err), item?.sizeFormatted);
      if (res.success) {
        showToast(`Downloading ${exactFileName || item?.appName || 'package'}...`);
      }
    }
  };

  const downloadApp = async (appId: string, url?: string) => {
    const item = installState[appId];
    const targetPlat = (item?.platform || '').toLowerCase().trim();
    const targetUrl = (url || item?.downloadUrl || '').trim();
    const exactFileName = extractExactPackageFileName(targetUrl, item?.fileName);

    // Instant 0ms direct download in current window without opening new tabs/windows or RAM cache delay
    if (targetUrl && (targetUrl.startsWith('http://') || targetUrl.startsWith('https://') || targetUrl.startsWith('/api/'))) {
      const success = await triggerBrowserApkDownload(targetUrl, exactFileName, item?.appName, (err) => {
        showToast(err);
      }, item?.platform, item?.sizeFormatted);
      if (success) {
        showToast(`Downloading ${exactFileName || item?.appName || 'package'}...`);
        incrementAppDownloadCount(appId).catch(() => {});
      }
    } else {
      showToast('Application package download link is not available.');
    }
  };

  const openApp = (appId: string, url?: string) => {
    // Both openApp and downloadApp initiate 1-click direct download
    downloadApp(appId, url);
  };

  const activeDownloadsCount = (Object.values(installState) as AppInstallData[]).filter(
    s => s.state === 'downloading' || s.state === 'pending' || s.state === 'verifying' || s.state === 'installing' || s.state === 'paused'
  ).length;

  const downloadedAppsList = (Object.entries(installState) as [string, AppInstallData][])
    .filter(([_, data]) => data.state === 'installed')
    .map(([id, data]) => ({
      id,
      name: data.appName || id,
      size: formatBytes(data.totalBytes || 26 * 1024 * 1024),
      iconUrl: data.iconUrl,
      installedAt: data.installedAt,
      fileName: data.fileName
    }));

  const unreadNotificationsCount = visibleNotifications.filter(n => n.isUnread !== false).length;

  const installedAppsWithUpdates = (Object.values(installState) as AppInstallData[]).filter(
    s => s.state === 'installed' && s.needsUpdate
  );
  const updateNotifsCount = visibleNotifications.filter(
    n => n.isUnread !== false && (
      n.category === 'app_update' || 
      n.category === 'new_release' ||
      n.title.toLowerCase().includes('update') || 
      n.title.toLowerCase().includes('release')
    )
  ).length;
  const updatesAvailableCount = Math.max(installedAppsWithUpdates.length, updateNotifsCount);

  return (
    <InstallContext.Provider
      value={{
        installState,
        startInstall,
        pauseInstall,
        resumeInstall,
        cancelInstall,
        uninstall,
        openApp,
        downloadApp,
        saveDownloadedPackage,
        updateState,
        activeDownloadsCount,
        downloadedAppsList,
        notifications: visibleNotifications,
        unreadNotificationsCount,
        updatesAvailableCount,
        addNotification,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        clearNotification,
        clearAllNotifications,
        isAuthDialogOpen,
        openAuthDialog,
        closeAuthDialog,
        pendingInstall,
        pendingDownloads,
        getPendingDownload,
        loadingStyleVariant,
        setLoadingStyleVariant,
        isTestLoadingModalOpen,
        openTestLoadingModal,
        closeTestLoadingModal
      }}
    >
      {children}

      {/* Global Google Sign-In Requirement Dialog */}
      <GoogleSignInDialog
        isOpen={isAuthDialogOpen}
        onClose={closeAuthDialog}
        mode={authDialogConfig?.mode || 'default'}
        customTitle={authDialogConfig?.customTitle}
        customSubtitle={authDialogConfig?.customSubtitle}
        pendingApp={
          pendingInstall
            ? {
                appId: pendingInstall.appId,
                appName: pendingInstall.appName || pendingInstall.options?.appName,
                iconUrl: pendingInstall.options?.iconUrl,
                sizeString: pendingInstall.options?.sizeString,
                fileName: pendingInstall.options?.fileName
              }
            : null
        }
        onSuccess={() => {
          if (authDialogConfig?.onSuccess) {
            authDialogConfig.onSuccess();
          }
        }}
      />
    </InstallContext.Provider>
  );
}

export function useInstall() {
  const context = useContext(InstallContext);
  if (context === undefined) {
    throw new Error('useInstall must be used within an InstallProvider');
  }
  return context;
}

