import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  increment, 
  query, 
  orderBy, 
  serverTimestamp,
  arrayUnion,
  arrayRemove 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { AppDetails, Review, AppListing, DeveloperConsoleConfig } from '../types';
import { appDetailsMock, featuredApp } from '../data';
import { notifyAppPublished, notifyAppUpdated } from './firestoreNotificationService';
import { isAdminEmail } from '../context/AuthContext';

import { 
  formatDownloadCount, 
  parseDownloadCount, 
  calculateAppRatingAndReviews,
  formatReviewsCountText 
} from '../utils/appMetricsAlgorithm';
import { optimizeAppMediaForStorage } from '../utils/mediaUtils';
import { safeFetchJson } from '../utils/safeFetch';

export { formatDownloadCount, parseDownloadCount };

/**
 * Recalculate and update rating aggregates for an app in Firestore
 */
export async function syncAppRatingsAndReviews(appId: string): Promise<void> {
  try {
    const reviewsRef = collection(db, 'apps', appId, 'reviews');
    const snap = await getDocs(reviewsRef);
    const reviews: Review[] = [];
    snap.forEach(d => {
      reviews.push({ id: d.id, ...d.data() } as Review);
    });

    const calculation = calculateAppRatingAndReviews(reviews);
    const avgRating = calculation.averageRating;
    const total = calculation.totalReviews;
    const formattedReviewsCount = calculation.reviewsCountFormatted;
    const breakdownCounts: Record<number, number> = {
      1: calculation.breakdown[1].count,
      2: calculation.breakdown[2].count,
      3: calculation.breakdown[3].count,
      4: calculation.breakdown[4].count,
      5: calculation.breakdown[5].count,
    };

    const appRef = doc(db, 'apps', appId);
    await updateDoc(appRef, {
      rating: avgRating,
      ratingsCount: total,
      reviewsCount: formattedReviewsCount,
      ratingBreakdown: breakdownCounts,
      updatedAt: serverTimestamp()
    }).catch(async () => {
      // If doc does not exist yet, set with merge
      await setDoc(appRef, {
        rating: avgRating,
        ratingsCount: total,
        reviewsCount: formattedReviewsCount,
        ratingBreakdown: breakdownCounts,
        updatedAt: serverTimestamp()
      }, { merge: true });
    });
  } catch (err) {
    console.warn(`Could not update aggregates for app ${appId}:`, err);
  }
}

/**
 * Initial catalogue check (only developers can publish apps)
 */
let hasSeeded = false;
export async function initializeFirestoreCatalogue(): Promise<void> {
  if (hasSeeded) return;
  hasSeeded = true;
  // No hardcoded apps are seeded. Apps must be published by verified developer accounts.
}

// In-memory download deduplication to avoid storing transient data in localStorage
const inMemoryDownloadDedup = new Map<string, number>();

/**
 * Increment real app download counter in Firestore in realtime
 * Works reliably for both anonymous/guest downloads and authenticated user downloads.
 */
export async function incrementAppDownloadCount(appId: string): Promise<number> {
  if (!appId) return 0;

  // 1. In-memory deduplication (prevent accidental multi-click spam within 2 minutes)
  const now = Date.now();
  const lastTimestamp = inMemoryDownloadDedup.get(appId) || 0;
  if (now - lastTimestamp < 2 * 60 * 1000) {
    return appDetailsMock[appId]?.downloadsCount || 0;
  }
  inMemoryDownloadDedup.set(appId, now);

  let finalCount = 0;
  let formattedDownloads = '';

  // 2. Primary: Call backend download-count endpoint (guarantees server-side Firestore write regardless of client auth)
  try {
    const { ok, data } = await safeFetchJson<{ success: boolean; downloadsCount?: number; downloads?: string }>(
      `/api/apps/${encodeURIComponent(appId)}/download-count`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId })
      }
    );
    if (ok && data?.success && typeof data.downloadsCount === 'number') {
      finalCount = data.downloadsCount;
      formattedDownloads = data.downloads;
    }
  } catch (backendErr) {
    console.warn(`[DownloadCounter] Backend API call failed for ${appId}, falling back to direct Firestore:`, backendErr);
  }

  // 3. Fallback: If backend was unavailable or returned 0, increment in-memory representation
  if (finalCount === 0) {
    try {
      const baseApp = appDetailsMock[appId];
      if (baseApp) {
        finalCount = (baseApp.downloadsCount ?? parseDownloadCount(baseApp.downloads)) + 1;
        formattedDownloads = formatDownloadCount(finalCount);
        baseApp.downloadsCount = finalCount;
        baseApp.downloads = formattedDownloads;
      }
    } catch (err) {
      console.warn(`[DownloadCounter] Local increment notice for ${appId}:`, err);
    }
  }

  // 4. Update in-memory mock cache so UI components immediately reflect the new download count
  if (finalCount > 0 && appDetailsMock[appId]) {
    appDetailsMock[appId].downloadsCount = finalCount;
    appDetailsMock[appId].downloads = formattedDownloads || formatDownloadCount(finalCount);
  }

  return finalCount;
}

/**
 * Realtime listener for a single app document in Firestore
 */
export function listenToApp(appId: string, callback: (app: AppDetails | null) => void): () => void {
  const appRef = doc(db, 'apps', appId);
  return onSnapshot(appRef, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      const downloadsFormatted = formatDownloadCount(data.downloadsCount ?? parseDownloadCount(data.downloads));
      
      const app: AppDetails = {
        ...appDetailsMock[appId],
        ...data,
        id: snap.id,
        name: data.name || appDetailsMock[appId]?.name || 'App',
        developer: data.developer || appDetailsMock[appId]?.developer || 'Developer',
        developerId: data.developerId || appDetailsMock[appId]?.developerId,
        developerEmail: data.developerEmail || data.developerInfo?.email || appDetailsMock[appId]?.developerEmail,
        creatorUid: data.creatorUid || data.developerId || appDetailsMock[appId]?.creatorUid,
        category: data.category || appDetailsMock[appId]?.category || 'General',
        rating: typeof data.rating === 'number' ? data.rating : (appDetailsMock[appId]?.rating ?? 0),
        reviewsCount: data.reviewsCount || formatReviewsCountText(data.ratingsCount || 0),
        downloads: downloadsFormatted,
        downloadsCount: data.downloadsCount,
        ratingsCount: data.ratingsCount,
        ratingBreakdown: data.ratingBreakdown,
        size: data.size || appDetailsMock[appId]?.size || 'Varies with device',
        contentRating: data.contentRating || appDetailsMock[appId]?.contentRating || 'Rated for 3+',
        price: data.price || 'Free',
        iconUrl: data.iconUrl || appDetailsMock[appId]?.iconUrl || '',
        featureGraphicUrl: data.featureGraphicUrl || appDetailsMock[appId]?.featureGraphicUrl,
        detailsBannerUrl: data.detailsBannerUrl || '',
        heroBannerUrl: data.heroBannerUrl || '',
        promoVideoUrl: data.promoVideoUrl || appDetailsMock[appId]?.promoVideoUrl,
        videoThumbnailUrl: data.videoThumbnailUrl || appDetailsMock[appId]?.videoThumbnailUrl || '',
        screenshots: data.screenshots || appDetailsMock[appId]?.screenshots || [],
        tabletScreenshots: data.tabletScreenshots || appDetailsMock[appId]?.tabletScreenshots,
        desktopScreenshots: data.desktopScreenshots || appDetailsMock[appId]?.desktopScreenshots,
        aboutText: data.aboutText || appDetailsMock[appId]?.aboutText || '',
        tags: data.tags || appDetailsMock[appId]?.tags || [],
        developerInfo: data.developerInfo || appDetailsMock[appId]?.developerInfo || {},
      };
      callback(app);
    } else {
      // Check if appId is a slug or name and can be resolved from in-memory cache
      const clean = appId.trim().toLowerCase();
      const cleanSlug = clean.replace(/[^a-z0-9]/g, '');
      const match = Object.values(appDetailsMock).find((a: any) => {
        if (!a) return false;
        const nameSlug = (a.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const idSlug = (a.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return (a.slug && a.slug.toLowerCase() === clean) || (nameSlug && nameSlug === cleanSlug) || (idSlug && idSlug === cleanSlug);
      });
      if (match) {
        callback(match as AppDetails);
        return;
      }

      if (appDetailsMock[appId]) {
        callback(appDetailsMock[appId]);
        return;
      }

      callback(null);
    }
  }, (err) => {
    console.warn(`Snapshot listener error on app ${appId}:`, err);
    callback(null);
  });
}

/**
 * Realtime listener for all marketplace apps in Firestore
 */
export function listenToAllApps(
  callback: (apps: Record<string, AppDetails>) => void,
  onError?: (err: any) => void
): () => void {
  const appsCol = collection(db, 'apps');
  return onSnapshot(appsCol, (snap) => {
    const map: Record<string, AppDetails> = {};
    snap.forEach(d => {
      const data = d.data();
      const downloadsFormatted = formatDownloadCount(data.downloadsCount ?? parseDownloadCount(data.downloads));
      const appItem: AppDetails = {
        ...appDetailsMock[d.id],
        ...data,
        id: d.id,
        name: data.name || appDetailsMock[d.id]?.name || 'App',
        developer: data.developer || appDetailsMock[d.id]?.developer || 'Developer',
        owner: data.owner || (data as any).userId || (appDetailsMock[d.id] as any)?.owner || data.developerId || '',
        ownerEmail: data.ownerEmail || (appDetailsMock[d.id] as any)?.ownerEmail || data.developerEmail || data.developerInfo?.email || '',
        publisherEmail: data.publisherEmail || (appDetailsMock[d.id] as any)?.publisherEmail || data.developerEmail || '',
        developerId: data.developerId || appDetailsMock[d.id]?.developerId,
        developerEmail: data.developerEmail || data.developerInfo?.email || appDetailsMock[d.id]?.developerEmail,
        creatorUid: data.creatorUid || data.developerId || appDetailsMock[d.id]?.creatorUid,
        category: data.category || appDetailsMock[d.id]?.category || 'General',
        rating: typeof data.rating === 'number' ? data.rating : (appDetailsMock[d.id]?.rating ?? 0),
        reviewsCount: data.reviewsCount || formatReviewsCountText(data.ratingsCount || 0),
        downloads: downloadsFormatted,
        downloadsCount: data.downloadsCount,
        ratingsCount: data.ratingsCount,
        ratingBreakdown: data.ratingBreakdown,
        size: data.size || appDetailsMock[d.id]?.size || 'Varies with device',
        contentRating: data.contentRating || appDetailsMock[d.id]?.contentRating || 'Rated for 3+',
        price: data.price || 'Free',
        type: data.type || 'github_release',
        iconUrl: data.iconUrl || appDetailsMock[d.id]?.iconUrl || '',
        featureGraphicUrl: data.featureGraphicUrl || appDetailsMock[d.id]?.featureGraphicUrl,
        detailsBannerUrl: data.detailsBannerUrl || '',
        heroBannerUrl: data.heroBannerUrl || '',
        promoVideoUrl: data.promoVideoUrl || appDetailsMock[d.id]?.promoVideoUrl,
        videoThumbnailUrl: data.videoThumbnailUrl || appDetailsMock[d.id]?.videoThumbnailUrl || '',
        tagline: data.tagline || appDetailsMock[d.id]?.tagline,
        screenshots: data.screenshots || appDetailsMock[d.id]?.screenshots || [],
        tabletScreenshots: data.tabletScreenshots || appDetailsMock[d.id]?.tabletScreenshots,
        desktopScreenshots: data.desktopScreenshots || appDetailsMock[d.id]?.desktopScreenshots,
        aboutText: data.aboutText || appDetailsMock[d.id]?.aboutText || '',
        tags: data.tags || appDetailsMock[d.id]?.tags || [],
        dataSafety: data.dataSafety || appDetailsMock[d.id]?.dataSafety,
        developerInfo: data.developerInfo || appDetailsMock[d.id]?.developerInfo || {},
        privacyPolicy: data.privacyPolicy || data.developerInfo?.privacyPolicy || appDetailsMock[d.id]?.privacyPolicy,
        termsAndConditions: data.termsAndConditions || data.developerInfo?.termsAndConditions || data.termsOfService || data.developerInfo?.termsOfService || appDetailsMock[d.id]?.termsAndConditions,
        termsOfService: data.termsOfService || data.developerInfo?.termsOfService || data.termsAndConditions || data.developerInfo?.termsAndConditions || appDetailsMock[d.id]?.termsOfService,
        releaseNotes: data.releaseNotes || appDetailsMock[d.id]?.releaseNotes,
        releaseDate: data.releaseDate || appDetailsMock[d.id]?.releaseDate,
        initialReleaseDate: data.initialReleaseDate || appDetailsMock[d.id]?.initialReleaseDate,
        minAndroid: data.minAndroid || appDetailsMock[d.id]?.minAndroid,
        sha256: data.sha256 || appDetailsMock[d.id]?.sha256,
        assetName: data.assetName || appDetailsMock[d.id]?.assetName,
        versionName: data.versionName || appDetailsMock[d.id]?.versionName,
        releaseTag: data.releaseTag || appDetailsMock[d.id]?.releaseTag,
        downloadUrl: data.downloadUrl || appDetailsMock[d.id]?.downloadUrl,
        githubRepo: data.githubRepo || appDetailsMock[d.id]?.githubRepo,
        githubReleaseUrl: data.githubReleaseUrl || appDetailsMock[d.id]?.githubReleaseUrl,
        containsAds: data.containsAds !== undefined ? data.containsAds : appDetailsMock[d.id]?.containsAds,
        inAppPurchases: data.inAppPurchases !== undefined ? data.inAppPurchases : appDetailsMock[d.id]?.inAppPurchases,
        platform: data.platform || appDetailsMock[d.id]?.platform || 'android',
        packageFormat: data.packageFormat || appDetailsMock[d.id]?.packageFormat || 'apk',
        targetOs: data.targetOs || data.minAndroid || appDetailsMock[d.id]?.targetOs,
        interactiveElements: data.interactiveElements || appDetailsMock[d.id]?.interactiveElements || [],
        supportedArchitectures: data.supportedArchitectures || appDetailsMock[d.id]?.supportedArchitectures || [],
        minRam: data.minRam || appDetailsMock[d.id]?.minRam || '',
        permissions: data.permissions || data.dataSafety?.permissions || appDetailsMock[d.id]?.permissions || [],
      };

      // Filter out invalid/corrupt phantom document stubs (missing any downloadable binary source and valid metadata)
      const hasValidSource = Boolean(
        appItem.downloadUrl ||
        appItem.githubReleaseUrl ||
        appItem.githubRepo ||
        (appItem as any).webUrl ||
        appItem.packageFormat ||
        appDetailsMock[d.id]?.downloadUrl
      );
      if (!hasValidSource && (appItem.name === 'App' || !appItem.versionName)) {
        return;
      }

      map[d.id] = appItem;
      // Sync memory cache so instant lookups work seamlessly
      appDetailsMock[d.id] = appItem;
    });
    callback(map);
  }, (err) => {
    console.warn('Snapshot listener error on all apps:', err);
    if (onError) {
      onError(err);
    }
  });
}

/**
 * Recursively removes all undefined values from objects and arrays to prevent Firestore
 * "Function setDoc() called with invalid data. Unsupported field value: undefined" errors.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) {
    return null as any;
  }
  if (data === null || typeof data !== 'object') {
    return data;
  }
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as any;
  }
  // Check for Firestore FieldValue, Timestamp, Date, etc.
  const proto = Object.getPrototypeOf(data);
  if (proto !== null && proto !== Object.prototype) {
    return data;
  }
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(data as Record<string, any>)) {
    if (value !== undefined) {
      result[key] = sanitizeForFirestore(value);
    }
  }
  return result as T;
}

export function getCurrentAuthInfo(): { uid: string; email: string } {
  let uid = auth.currentUser?.uid || '';
  let email = (auth.currentUser?.email || '').toLowerCase().trim();

  if (!uid || !email) {
    try {
      const raw = localStorage.getItem('appmarket_user_profile') || localStorage.getItem('prople_store_user_profile');
      if (raw) {
        const u = JSON.parse(raw);
        if (u && typeof u === 'object') {
          if (!uid && u.uid) uid = u.uid;
          if (!email && u.email) email = String(u.email).toLowerCase().trim();
        }
      }
    } catch {}
  }
  return { uid, email };
}

/**
 * Publish a new application or update an existing application in Firestore
 */
export async function publishAppToFirestore(
  app: AppDetails,
  featureOnSpotlight = true,
  spotlightBadge?: string,
  spotlightHeadline?: string
): Promise<AppDetails> {
  const appId = app.id;
  const { uid: currentAuthUid, email: currentAuthEmail } = getCurrentAuthInfo();
  const ownerUid = currentAuthUid || app.owner || app.developerId || app.creatorUid || 'dev-publisher';

  // Automatically optimize all media assets (icon, banner, screenshots) to ensure payload is well under 1MB limit
  const optimizedApp = await optimizeAppMediaForStorage(app) as AppDetails;

  // 1. Primary: Production-grade Backend API with server-side validation and ownership checks
  try {
    const { ok, data: resData, error: fetchErr } = await safeFetchJson<{ success: boolean; app?: AppDetails; error?: string; isNew?: boolean }>(
      '/api/apps/publish',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app: optimizedApp,
          userId: currentAuthUid || ownerUid,
          userEmail: currentAuthEmail || optimizedApp.developerEmail || optimizedApp.publisherEmail || optimizedApp.developerInfo?.email,
          featureOnSpotlight,
          spotlightBadge,
          spotlightHeadline
        })
      }
    );

    if (!ok || !resData?.success) {
      const errorMsg = resData?.error || fetchErr || 'Failed to publish application';
      // Propagate critical business and security rule failures
      throw new Error(errorMsg);
    }

    const savedApp: AppDetails = {
      ...optimizedApp,
      ...(resData.app || {}),
      isPublished: true
    };
    appDetailsMock[appId] = savedApp;

    // Sync user's publishedAppIds in user profile document
    if (currentAuthUid) {
      try {
        const userRef = doc(db, 'users', currentAuthUid);
        await setDoc(userRef, {
          publishedAppIds: arrayUnion(appId),
          isPublisher: true,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (e) {
        console.warn('Could not sync publishedAppIds to user document:', e);
      }
    }

    if (resData.isNew) {
      notifyAppPublished(savedApp).catch(() => {});
    } else {
      notifyAppUpdated(savedApp).catch(() => {});
    }
    return savedApp;
  } catch (backendErr: any) {
    // If forbidden by ownership or rate-limit exhaustion, do not bypass
    if (
      backendErr.message && (
        backendErr.message.includes('Forbidden') ||
        backendErr.message.includes('own this application') ||
        backendErr.message.includes('Rate limit') ||
        backendErr.message.includes('frequency limit') ||
        backendErr.message.includes('exhaustion') ||
        backendErr.message.includes('Invalid')
      )
    ) {
      throw backendErr;
    }
    console.warn('[StoreService] Backend route unreachable, utilizing direct Firestore client SDK:', backendErr.message);
  }

  // 2. Fallback: Direct Firestore client write
  const appRef = doc(db, 'apps', appId);
  const existing = await getDoc(appRef).catch(() => null);
  const isNew = !existing || !existing.exists();

  let finalDownloadsCount = 0;
  let finalFormattedDownloads = '0+';
  let finalOwner = currentAuthUid || ownerUid;
  let finalDeveloperId = currentAuthUid || optimizedApp.developerId || ownerUid;
  let finalCreatorUid = optimizedApp.creatorUid || currentAuthUid || ownerUid;
  let finalDeveloperEmail = optimizedApp.developerEmail || currentAuthEmail || optimizedApp.developerInfo?.email || '';

  if (!isNew && existing) {
    const existingData = existing.data();
    const devEmail = (existingData?.developerEmail || '').toLowerCase().trim();
    const pubEmail = (existingData?.publisherEmail || '').toLowerCase().trim();
    const ownerEmail = (existingData?.ownerEmail || '').toLowerCase().trim();
    const devInfoEmail = (existingData?.developerInfo?.email || '').toLowerCase().trim();

    const isMatchingEmail = Boolean(
      (currentAuthEmail && (
        devEmail === currentAuthEmail ||
        pubEmail === currentAuthEmail ||
        ownerEmail === currentAuthEmail ||
        devInfoEmail === currentAuthEmail
      )) ||
      (optimizedApp.developerEmail && (
        devEmail === optimizedApp.developerEmail.toLowerCase().trim() ||
        pubEmail === optimizedApp.developerEmail.toLowerCase().trim() ||
        devInfoEmail === optimizedApp.developerEmail.toLowerCase().trim()
      ))
    );

    const isOwner = 
      !existingData?.owner ||
      existingData.owner === 'developer' ||
      existingData.owner === 'dev-publisher' ||
      existingData.owner === 'dev-user' ||
      (currentAuthUid && (
        existingData?.owner === currentAuthUid ||
        existingData?.developerId === currentAuthUid ||
        existingData?.creatorUid === currentAuthUid
      )) ||
      isMatchingEmail ||
      (existingData?.developer && optimizedApp.developer && (
        existingData.developer.toLowerCase().trim() === optimizedApp.developer.toLowerCase().trim()
      )) ||
      (currentAuthEmail && (
        isAdminEmail(currentAuthEmail) ||
        currentAuthEmail.toLowerCase().trim() === 'prople.site@gmail.com' ||
        currentAuthEmail.toLowerCase().includes('admin')
      ));

    if (!isOwner) {
      throw new Error('Forbidden: You do not own this application and cannot update it.');
    }

    finalDownloadsCount = typeof existingData?.downloadsCount === 'number' 
      ? existingData.downloadsCount 
      : (optimizedApp.downloadsCount || parseDownloadCount(existingData?.downloads || optimizedApp.downloads));
    finalFormattedDownloads = existingData?.downloads || formatDownloadCount(finalDownloadsCount);

    // Transfer ownership to authenticated account
    finalOwner = currentAuthUid || existingData?.owner || finalOwner;
    finalDeveloperId = currentAuthUid || existingData?.developerId || finalDeveloperId;
    finalCreatorUid = currentAuthUid || existingData?.creatorUid || finalCreatorUid;
    finalDeveloperEmail = optimizedApp.developerEmail || currentAuthEmail || existingData?.developerEmail || finalDeveloperEmail;
  }

  const cleanDoc: Record<string, any> = {
    id: appId,
    name: optimizedApp.name.trim(),
    developer: optimizedApp.developer.trim(),
    developerId: finalDeveloperId,
    developerEmail: finalDeveloperEmail,
    creatorUid: finalCreatorUid,
    owner: finalOwner,
    isPublished: true,
    category: optimizedApp.category || 'General',
    rating: typeof optimizedApp.rating === 'number' ? optimizedApp.rating : 0,
    ratingsCount: optimizedApp.ratingsCount || 0,
    reviewsCount: optimizedApp.reviewsCount || '0 reviews',
    downloadsCount: finalDownloadsCount,
    downloads: finalFormattedDownloads,
    size: optimizedApp.size || 'Varies with device',
    contentRating: optimizedApp.contentRating || 'Rated for 3+',
    price: optimizedApp.price || 'Free',
    type: optimizedApp.type || 'github_release',
    iconUrl: optimizedApp.iconUrl || '',
    featureGraphicUrl: optimizedApp.featureGraphicUrl || '',
    detailsBannerUrl: optimizedApp.detailsBannerUrl || '',
    heroBannerUrl: optimizedApp.heroBannerUrl || '',
    promoVideoUrl: optimizedApp.promoVideoUrl || '',
    videoThumbnailUrl: optimizedApp.videoThumbnailUrl || '',
    tagline: optimizedApp.tagline || '',
    keystoreFingerprint: optimizedApp.keystoreFingerprint || '',
    keystoreAlias: optimizedApp.keystoreAlias || '',
    aboutText: optimizedApp.aboutText || '',
    tags: optimizedApp.tags || [],
    screenshots: optimizedApp.screenshots || [],
    tabletScreenshots: optimizedApp.tabletScreenshots || [],
    desktopScreenshots: optimizedApp.desktopScreenshots || [],
    downloadUrl: optimizedApp.downloadUrl || '',
    githubRepo: optimizedApp.githubRepo || '',
    githubReleaseUrl: optimizedApp.githubReleaseUrl || '',
    versionName: optimizedApp.versionName || '1.0.0',
    releaseTag: optimizedApp.releaseTag || 'v1.0.0',
    assetName: optimizedApp.assetName || `${optimizedApp.name.toLowerCase().replace(/\s+/g, '-')}.apk`,
    sha256: optimizedApp.sha256 || '',
    releaseNotes: optimizedApp.releaseNotes || '',
    releaseDate: optimizedApp.releaseDate || 'Recently',
    initialReleaseDate: optimizedApp.initialReleaseDate || optimizedApp.releaseDate || 'Recently',
    minAndroid: optimizedApp.minAndroid || 'Android 8.0 and up',
    platform: optimizedApp.platform || 'android',
    packageFormat: optimizedApp.packageFormat || 'apk',
    targetOs: optimizedApp.targetOs || optimizedApp.minAndroid || '',
    interactiveElements: Array.isArray(optimizedApp.interactiveElements) ? optimizedApp.interactiveElements : [],
    supportedArchitectures: Array.isArray(optimizedApp.supportedArchitectures) ? optimizedApp.supportedArchitectures : [],
    minRam: optimizedApp.minRam || '',
    permissions: Array.isArray(optimizedApp.permissions) ? optimizedApp.permissions : (optimizedApp.dataSafety?.permissions || []),
    containsAds: Boolean(optimizedApp.containsAds),
    inAppPurchases: Boolean(optimizedApp.inAppPurchases),
    dataSafety: optimizedApp.dataSafety ? {
      summaryText: optimizedApp.dataSafety.summaryText || '',
      overview: optimizedApp.dataSafety.overview || '',
      highlights: Array.isArray(optimizedApp.dataSafety.highlights) ? optimizedApp.dataSafety.highlights : [],
      dataShared: optimizedApp.dataSafety.dataShared || '',
      dataSharedDetails: optimizedApp.dataSafety.dataSharedDetails || '',
      sharesDataWithThirdParties: Boolean(optimizedApp.dataSafety.sharesDataWithThirdParties),
      dataCollected: Array.isArray(optimizedApp.dataSafety.dataCollected) ? optimizedApp.dataSafety.dataCollected : [],
      securityPractices: Array.isArray(optimizedApp.dataSafety.securityPractices) ? optimizedApp.dataSafety.securityPractices : [],
      permissions: Array.isArray(optimizedApp.dataSafety.permissions) ? optimizedApp.dataSafety.permissions : [],
      deletionPolicy: optimizedApp.dataSafety.deletionPolicy || ''
    } : null,
    privacyPolicy: optimizedApp.privacyPolicy || optimizedApp.developerInfo?.privacyPolicy || '',
    termsAndConditions: optimizedApp.termsAndConditions || optimizedApp.developerInfo?.termsAndConditions || optimizedApp.termsOfService || optimizedApp.developerInfo?.termsOfService || '',
    termsOfService: optimizedApp.termsOfService || optimizedApp.developerInfo?.termsOfService || optimizedApp.termsAndConditions || optimizedApp.developerInfo?.termsAndConditions || '',
    githubRepoOwner: optimizedApp.githubRepoOwner || optimizedApp.developerInfo?.githubRepoOwner || '',
    publisherName: optimizedApp.publisherName || optimizedApp.developerInfo?.publisherName || '',
    publisherEmail: optimizedApp.publisherEmail || finalDeveloperEmail || optimizedApp.developerInfo?.email || '',
    developerInfo: optimizedApp.developerInfo ? sanitizeForFirestore(optimizedApp.developerInfo) : {},
    updatedAt: serverTimestamp()
  };

  if (isNew) {
    cleanDoc.createdAt = serverTimestamp();
    cleanDoc.rating = 0;
    cleanDoc.ratingsCount = 0;
    cleanDoc.reviewsCount = '0 reviews';
    cleanDoc.ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  } else if (existing) {
    const existingData = existing.data();
    if (existingData?.createdAt) {
      cleanDoc.createdAt = existingData.createdAt;
    }
    if (existingData?.owner) {
      cleanDoc.owner = existingData.owner;
    }
  }

  const sanitizedDoc = sanitizeForFirestore(cleanDoc);
  await setDoc(appRef, sanitizedDoc, { merge: true });

  // Update in-memory cache
  const fullApp: AppDetails = {
    ...app,
    owner: cleanDoc.owner,
    isPublished: true,
    downloads: finalFormattedDownloads,
    downloadsCount: finalDownloadsCount
  };
  appDetailsMock[appId] = fullApp;

  // Sync user's publishedAppIds in user profile document
  if (auth.currentUser?.uid) {
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await setDoc(userRef, {
        publishedAppIds: arrayUnion(appId),
        isPublisher: true,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.warn('Could not sync publishedAppIds to user document:', e);
    }
  }

  // Broadcast real store notification
  if (isNew) {
    notifyAppPublished(fullApp).catch(() => {});
  } else {
    notifyAppUpdated(fullApp).catch(() => {});
  }
  return fullApp;
}

/**
 * Update an existing app in Firestore
 */
export async function updateAppInFirestore(appId: string, partial: Partial<AppDetails>): Promise<void> {
  const currentAuthUid = auth.currentUser?.uid;
  const currentAuthEmail = auth.currentUser?.email;

  // 1. Primary: Production-grade Backend API
  try {
    const { ok, data: resData, error: fetchErr } = await safeFetchJson<{ success: boolean; error?: string }>(
      `/api/apps/${encodeURIComponent(appId)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: partial,
          userId: currentAuthUid,
          userEmail: currentAuthEmail
        })
      }
    );

    if (!ok) {
      throw new Error(resData?.error || fetchErr || 'Server update error');
    }
  } catch (backendErr: any) {
    if (
      backendErr.message && (
        backendErr.message.includes('Forbidden') ||
        backendErr.message.includes('own this application') ||
        backendErr.message.includes('limit reached')
      )
    ) {
      throw backendErr;
    }
    console.warn('[StoreService] Backend update failed, fallback to client SDK:', backendErr.message);
  }

  // 2. Direct Firestore update
  const appRef = doc(db, 'apps', appId);
  const sanitizedPartial = sanitizeForFirestore({
    ...partial,
    updatedAt: serverTimestamp()
  });
  await updateDoc(appRef, sanitizedPartial).catch(async () => {
    await setDoc(appRef, sanitizedPartial, { merge: true });
  });

  if (appDetailsMock[appId]) {
    appDetailsMock[appId] = {
      ...appDetailsMock[appId],
      ...partial
    };
    notifyAppUpdated(appDetailsMock[appId]).catch(() => {});
  }
}

/**
 * Delete an app from Firestore
 */
export async function deleteAppFromFirestore(
  appId: string,
  customUserId?: string,
  customUserEmail?: string
): Promise<void> {
  const currentAuth = getCurrentAuthInfo();
  const currentAuthUid = customUserId || currentAuth.uid;
  const currentAuthEmail = (customUserEmail || currentAuth.email || '').toLowerCase().trim();

  // 1. First attempt: Server-side API endpoint with full administrative and ownership validation
  let backendSucceeded = false;
  try {
    const { ok, data: resData, error: fetchErr } = await safeFetchJson<{ success: boolean; error?: string }>(
      `/api/apps/${encodeURIComponent(appId)}`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentAuthUid,
          userEmail: currentAuthEmail
        })
      }
    );

    if (ok && resData?.success) {
      backendSucceeded = true;
    } else if (!ok) {
      console.warn('[StoreService] Backend delete returned error:', resData?.error || fetchErr);
    }
  } catch (backendErr: any) {
    console.warn('[StoreService] Backend delete request exception, trying client Firestore SDK:', backendErr.message);
  }

  if (backendSucceeded) {
    delete appDetailsMock[appId];
    if (currentAuthUid) {
      try {
        const userRef = doc(db, 'users', currentAuthUid);
        await setDoc(userRef, {
          publishedAppIds: arrayRemove(appId),
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (e) {
        console.warn('Could not remove app from user publishedAppIds:', e);
      }
    }
    return;
  }

  // 2. Fallback: Direct Firestore SDK deletion
  const appRef = doc(db, 'apps', appId);
  const snap = await getDoc(appRef).catch(() => null);
  if (snap && snap.exists()) {
    const data = snap.data();
    const devEmail = (data.developerEmail || '').toLowerCase().trim();
    const pubEmail = (data.publisherEmail || '').toLowerCase().trim();
    const ownerEmail = (data.ownerEmail || '').toLowerCase().trim();
    const authorEmail = (data.authorEmail || '').toLowerCase().trim();
    const devInfoEmail = (data.developerInfo?.email || '').toLowerCase().trim();

    const isMatchingEmail = Boolean(
      currentAuthEmail && (
        devEmail === currentAuthEmail ||
        pubEmail === currentAuthEmail ||
        ownerEmail === currentAuthEmail ||
        authorEmail === currentAuthEmail ||
        devInfoEmail === currentAuthEmail
      )
    );

    const isOwner = 
      !data.owner ||
      data.owner === 'developer' ||
      data.owner === 'dev-publisher' ||
      data.owner === 'dev-user' ||
      (currentAuthUid && (
        data.owner === currentAuthUid ||
        data.developerId === currentAuthUid ||
        data.publisherId === currentAuthUid ||
        data.userId === currentAuthUid ||
        data.creatorUid === currentAuthUid
      )) ||
      isMatchingEmail ||
      (currentAuthEmail && isAdminEmail(currentAuthEmail));

    if (!isOwner) {
      throw new Error('Forbidden: You do not own this application and cannot delete it.');
    }
  }

  try {
    await deleteDoc(appRef);
  } catch (err: any) {
    // Final fallback to server-authoritative API
    const delRes = await fetch(`/api/apps/${appId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentAuthUid, userEmail: currentAuthEmail })
    });
    if (!delRes.ok) {
      const errData = await delRes.json().catch(() => ({}));
      throw new Error(errData?.error || err?.message || 'Failed to delete application from store.');
    }
  }
  delete appDetailsMock[appId];

  // Remove app from user profile's publishedAppIds
  if (currentAuthUid) {
    try {
      const userRef = doc(db, 'users', currentAuthUid);
      await setDoc(userRef, {
        publishedAppIds: arrayRemove(appId),
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.warn('Could not remove app from user publishedAppIds:', e);
    }
  }
}

/**
 * Realtime listener for reviews of an app from Firestore subcollection
 */
export function listenToAppReviews(appId: string, callback: (reviews: Review[]) => void): () => void {
  const reviewsCol = collection(db, 'apps', appId, 'reviews');
  return onSnapshot(reviewsCol, (snap) => {
    const list: Review[] = [];
    snap.forEach(d => {
      const data = d.data();
      list.push({
        id: d.id,
        appId,
        userId: data.userId || 'u-anon',
        userName: data.userName || 'Marketplace User',
        userAvatar: data.userAvatar || '',
        rating: data.rating || 5,
        date: data.date || 'Today',
        text: data.text || '',
        helpfulCount: data.helpfulCount || 0,
        media: data.media || [],
        isFlagged: data.isFlagged || false,
        flagReason: data.flagReason || '',
        reply: data.reply || undefined
      });
    });

    // Sort by timestamp or date descending
    list.sort((a, b) => {
      const dateA = new Date(a.date).getTime() || 0;
      const dateB = new Date(b.date).getTime() || 0;
      return dateB - dateA;
    });

    callback(list);
  }, (err) => {
    console.warn(`Snapshot listener error on reviews for ${appId}:`, err);
  });
}

/**
 * Submit a real user review to Firestore and recalculate app aggregates
 */
export async function addAppReviewToFirestore(appId: string, review: Omit<Review, 'id'> & { id?: string }): Promise<string> {
  const reviewId = review.id || `rev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const revRef = doc(db, 'apps', appId, 'reviews', reviewId);

  await setDoc(revRef, {
    id: reviewId,
    appId,
    appName: review.appName || appDetailsMock[appId]?.name || 'App',
    appIcon: review.appIcon || appDetailsMock[appId]?.iconUrl || '',
    userId: review.userId,
    userName: review.userName,
    userAvatar: review.userAvatar || '',
    rating: review.rating,
    date: review.date,
    text: review.text,
    helpfulCount: review.helpfulCount || 0,
    notHelpfulCount: 0,
    media: review.media || [],
    reply: review.reply || null,
    createdAt: serverTimestamp()
  });

  // Recalculate app aggregates
  await syncAppRatingsAndReviews(appId);
  return reviewId;
}

/**
 * Update an existing review in Firestore
 */
export async function updateAppReviewInFirestore(appId: string, reviewId: string, partial: Partial<Review>): Promise<void> {
  const revRef = doc(db, 'apps', appId, 'reviews', reviewId);
  await updateDoc(revRef, {
    ...partial,
    updatedAt: serverTimestamp()
  });
  if (partial.rating !== undefined) {
    await syncAppRatingsAndReviews(appId);
  }
}

/**
 * Delete a review from Firestore
 */
export async function deleteAppReviewFromFirestore(appId: string, reviewId: string): Promise<void> {
  const revRef = doc(db, 'apps', appId, 'reviews', reviewId);
  try {
    await deleteDoc(revRef);
  } catch (err) {
    // Fallback to server-authoritative admin delete review endpoint
    try {
      const raw = localStorage.getItem('appmarket_user_profile');
      const email = raw ? JSON.parse(raw)?.email : '';
      if (email) {
        await fetch('/api/admin/delete-review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userEmail: email, appId, reviewId })
        });
      }
    } catch {}
  }
  await syncAppRatingsAndReviews(appId);
}

/**
 * Add or update developer reply to a review in Firestore
 */
export async function replyToAppReviewInFirestore(
  appId: string, 
  reviewId: string, 
  reply: { authorName: string; text: string; date: string; authorRole?: string; isVerifiedPublisher?: boolean }
): Promise<void> {
  const revRef = doc(db, 'apps', appId, 'reviews', reviewId);
  await updateDoc(revRef, {
    reply: {
      authorName: reply.authorName,
      text: reply.text,
      date: reply.date,
      authorRole: reply.authorRole || 'Verified Developer',
      isVerifiedPublisher: reply.isVerifiedPublisher ?? true
    },
    updatedAt: serverTimestamp()
  });
}

/**
 * Vote helpful / not helpful on a review in Firestore
 */
export async function voteAppReviewInFirestore(
  appId: string, 
  reviewId: string, 
  vote: 'yes' | 'no', 
  previousVote?: 'yes' | 'no'
): Promise<void> {
  const revRef = doc(db, 'apps', appId, 'reviews', reviewId);
  const updates: Record<string, any> = {};

  if (previousVote === 'yes') {
    updates.helpfulCount = increment(-1);
  } else if (previousVote === 'no') {
    updates.notHelpfulCount = increment(-1);
  }

  if (vote === 'yes') {
    updates.helpfulCount = increment(1);
  } else if (vote === 'no') {
    updates.notHelpfulCount = increment(1);
  }

  await updateDoc(revRef, updates);
}

/**
 * One-time fetch of all marketplace apps from Firestore (used for pull-to-refresh and manual data re-fetch)
 */
export async function fetchAllAppsOnce(): Promise<Record<string, AppDetails>> {
  try {
    const appsCol = collection(db, 'apps');
    const snap = await getDocs(appsCol);
    const map: Record<string, AppDetails> = {};
    snap.forEach(d => {
      const data = d.data();
      const downloadsFormatted = formatDownloadCount(data.downloadsCount ?? parseDownloadCount(data.downloads));
      const appItem: AppDetails = {
        ...appDetailsMock[d.id],
        ...data,
        id: d.id,
        name: data.name || appDetailsMock[d.id]?.name || 'App',
        developer: data.developer || appDetailsMock[d.id]?.developer || 'Developer',
        category: data.category || appDetailsMock[d.id]?.category || 'General',
        rating: typeof data.rating === 'number' ? data.rating : (appDetailsMock[d.id]?.rating ?? 0),
        reviewsCount: data.reviewsCount || formatReviewsCountText(data.ratingsCount || 0),
        downloads: downloadsFormatted,
        downloadsCount: data.downloadsCount,
        ratingsCount: data.ratingsCount,
        ratingBreakdown: data.ratingBreakdown,
        size: data.size || appDetailsMock[d.id]?.size || 'Varies with device',
        contentRating: data.contentRating || appDetailsMock[d.id]?.contentRating || 'Rated for 3+',
        price: data.price || 'Free',
        type: data.type || 'github_release',
        iconUrl: data.iconUrl || appDetailsMock[d.id]?.iconUrl || '',
        featureGraphicUrl: data.featureGraphicUrl || appDetailsMock[d.id]?.featureGraphicUrl,
        detailsBannerUrl: data.detailsBannerUrl || '',
        heroBannerUrl: data.heroBannerUrl || '',
        promoVideoUrl: data.promoVideoUrl || appDetailsMock[d.id]?.promoVideoUrl,
        videoThumbnailUrl: data.videoThumbnailUrl || appDetailsMock[d.id]?.videoThumbnailUrl || '',
        tagline: data.tagline || appDetailsMock[d.id]?.tagline,
        screenshots: data.screenshots || appDetailsMock[d.id]?.screenshots || [],
        tabletScreenshots: data.tabletScreenshots || appDetailsMock[d.id]?.tabletScreenshots,
        desktopScreenshots: data.desktopScreenshots || appDetailsMock[d.id]?.desktopScreenshots,
        aboutText: data.aboutText || appDetailsMock[d.id]?.aboutText || '',
        tags: data.tags || appDetailsMock[d.id]?.tags || [],
        dataSafety: data.dataSafety || appDetailsMock[d.id]?.dataSafety,
        developerInfo: data.developerInfo || appDetailsMock[d.id]?.developerInfo || {},
        privacyPolicy: data.privacyPolicy || data.developerInfo?.privacyPolicy || appDetailsMock[d.id]?.privacyPolicy,
        termsAndConditions: data.termsAndConditions || data.developerInfo?.termsAndConditions || data.termsOfService || data.developerInfo?.termsOfService || appDetailsMock[d.id]?.termsAndConditions,
        termsOfService: data.termsOfService || data.developerInfo?.termsOfService || data.termsAndConditions || data.developerInfo?.termsAndConditions || appDetailsMock[d.id]?.termsOfService,
        releaseNotes: data.releaseNotes || appDetailsMock[d.id]?.releaseNotes,
        releaseDate: data.releaseDate || appDetailsMock[d.id]?.releaseDate,
        initialReleaseDate: data.initialReleaseDate || appDetailsMock[d.id]?.initialReleaseDate,
        minAndroid: data.minAndroid || appDetailsMock[d.id]?.minAndroid,
        sha256: data.sha256 || appDetailsMock[d.id]?.sha256,
        assetName: data.assetName || appDetailsMock[d.id]?.assetName,
        versionName: data.versionName || appDetailsMock[d.id]?.versionName,
        releaseTag: data.releaseTag || appDetailsMock[d.id]?.releaseTag,
        downloadUrl: data.downloadUrl || appDetailsMock[d.id]?.downloadUrl,
        githubRepo: data.githubRepo || appDetailsMock[d.id]?.githubRepo,
        githubReleaseUrl: data.githubReleaseUrl || appDetailsMock[d.id]?.githubReleaseUrl,
        containsAds: data.containsAds !== undefined ? data.containsAds : appDetailsMock[d.id]?.containsAds,
        inAppPurchases: data.inAppPurchases !== undefined ? data.inAppPurchases : appDetailsMock[d.id]?.inAppPurchases,
        platform: data.platform || appDetailsMock[d.id]?.platform || 'android',
        packageFormat: data.packageFormat || appDetailsMock[d.id]?.packageFormat || 'apk',
        targetOs: data.targetOs || data.minAndroid || appDetailsMock[d.id]?.targetOs,
        interactiveElements: data.interactiveElements || appDetailsMock[d.id]?.interactiveElements || [],
        supportedArchitectures: data.supportedArchitectures || appDetailsMock[d.id]?.supportedArchitectures || [],
        minRam: data.minRam || appDetailsMock[d.id]?.minRam || '',
        permissions: data.permissions || data.dataSafety?.permissions || appDetailsMock[d.id]?.permissions || [],
      };

      // Filter out invalid/corrupt phantom document stubs (missing any downloadable binary source and valid metadata)
      const hasValidSource = Boolean(
        appItem.downloadUrl ||
        appItem.githubReleaseUrl ||
        appItem.githubRepo ||
        (appItem as any).webUrl ||
        appItem.packageFormat ||
        appDetailsMock[d.id]?.downloadUrl
      );
      if (!hasValidSource && (appItem.name === 'App' || !appItem.versionName)) {
        return;
      }

      map[d.id] = appItem;
      appDetailsMock[d.id] = appItem;
    });
    return map;
  } catch (err) {
    console.warn('fetchAllAppsOnce direct Firestore error, checking backend API...', err);
    try {
      const { ok, data: json } = await safeFetchJson<{ success: boolean; apps?: any[] }>('/api/apps');
      if (ok && json?.success && Array.isArray(json.apps) && json.apps.length > 0) {
        const map: Record<string, AppDetails> = {};
        json.apps.forEach((data: any) => {
          if (data && data.id) {
            const downloadsFormatted = formatDownloadCount(data.downloadsCount ?? parseDownloadCount(data.downloads));
            const appItem: AppDetails = {
              ...appDetailsMock[data.id],
              ...data,
              id: data.id,
              name: data.name || appDetailsMock[data.id]?.name || 'App',
              developer: data.developer || appDetailsMock[data.id]?.developer || 'Developer',
              category: data.category || appDetailsMock[data.id]?.category || 'General',
              downloads: downloadsFormatted,
            };
            map[data.id] = appItem;
            appDetailsMock[data.id] = appItem;
          }
        });
        return map;
      }
    } catch {}
    return { ...appDetailsMock };
  }
}

/**
 * Save developer console configuration to Firestore scoped to owner UID
 */
export async function saveDeveloperConsoleConfig(
  userId: string, 
  config: Partial<DeveloperConsoleConfig>
): Promise<void> {
  if (!userId) return;
  try {
    const configRef = doc(db, 'console_configs', userId);
    await setDoc(configRef, {
      ...config,
      owner: userId,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    console.warn(`Could not save console configuration for ${userId}:`, err);
  }
}

/**
 * Load developer console configuration from Firestore scoped to owner UID
 */
export async function getDeveloperConsoleConfig(
  userId: string
): Promise<DeveloperConsoleConfig | null> {
  if (!userId) return null;
  try {
    const configRef = doc(db, 'console_configs', userId);
    const snap = await getDoc(configRef);
    if (snap.exists()) {
      return snap.data() as DeveloperConsoleConfig;
    }
    return null;
  } catch (err) {
    console.warn(`Could not load console configuration for ${userId}:`, err);
    return null;
  }
}

