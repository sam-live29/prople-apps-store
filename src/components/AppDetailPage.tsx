import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Download, Search, Share2, Star } from 'lucide-react';
import { useStoreConfig } from '../context/StoreConfigContext';
import { AppDetails } from '../types';
import { formatDownloadCount, getUnifiedAppSize, parseDownloadCount } from '../utils/appMetricsAlgorithm';

interface AppDetailPageProps {
  appId: string;
  onBack: () => void;
  onShowSimilarApps?: () => void;
  onOpenSearch?: () => void;
  onOrgClick?: (orgName: string) => void;
  onAppClick?: (appId: string) => void;
}

function normalizeAppRecord(record: Partial<AppDetails> | null | undefined, targetAppId: string): AppDetails | null {
  if (!record || typeof record !== 'object' || typeof record.name !== 'string' || !record.name.trim()) {
    return null;
  }

  const downloadsCount = typeof record.downloadsCount === 'number'
    ? record.downloadsCount
    : (record.downloads ? parseDownloadCount(record.downloads) : 0);
  const screenshots = Array.isArray(record.screenshots)
    ? record.screenshots.filter((item): item is string => typeof item === 'string')
    : [];
  const tabletScreenshots = Array.isArray(record.tabletScreenshots)
    ? record.tabletScreenshots.filter((item): item is string => typeof item === 'string')
    : [];
  const tags = Array.isArray(record.tags)
    ? record.tags.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : [];
  const downloadUrl = typeof record.downloadUrl === 'string' ? record.downloadUrl : undefined;
  let assetName = record.assetName;
  if (!assetName && downloadUrl) {
    try {
      assetName = decodeURIComponent(downloadUrl.split('?')[0].split('#')[0].split('/').pop() || '').trim();
    } catch {
      assetName = downloadUrl.split('?')[0].split('#')[0].split('/').pop() || '';
    }
  }

  return {
    ...record,
    id: typeof record.id === 'string' && record.id ? record.id : targetAppId,
    name: record.name.trim(),
    developer: typeof record.developer === 'string' && record.developer ? record.developer : 'Verified Publisher',
    category: typeof record.category === 'string' && record.category ? record.category : 'General',
    rating: typeof record.rating === 'number' && Number.isFinite(record.rating) ? record.rating : 0,
    ratingsCount: typeof record.ratingsCount === 'number' ? record.ratingsCount : 0,
    reviewsCount: record.reviewsCount || '0 reviews',
    size: getUnifiedAppSize(record as AppDetails),
    downloads: record.downloads
      ? formatDownloadCount(record.downloads)
      : formatDownloadCount(downloadsCount),
    downloadsCount,
    contentRating: record.contentRating || 'Rated for 3+',
    price: record.price || 'Free',
    type: record.type || 'github_release',
    url: record.url || '#',
    downloadUrl,
    releaseTag: record.releaseTag || 'v1.0.0',
    versionName: record.versionName || '1.0.0',
    assetName: assetName || '',
    containsAds: Boolean(record.containsAds),
    inAppPurchases: Boolean(record.inAppPurchases),
    iconUrl: record.iconUrl || '',
    featureGraphicUrl: record.featureGraphicUrl || '',
    detailsBannerUrl: record.detailsBannerUrl || '',
    heroBannerUrl: record.heroBannerUrl || '',
    screenshots,
    tabletScreenshots,
    promoVideoUrl: record.promoVideoUrl || '',
    videoThumbnailUrl: record.videoThumbnailUrl || '',
    tagline: record.tagline || '',
    aboutText: record.aboutText || record.description || `${record.name} on Prople Store.`,
    tags: tags.length ? tags : [record.category || 'App', 'Verified'],
    developerInfo: record.developerInfo || {},
    reviews: Array.isArray(record.reviews) ? record.reviews : [],
  } as AppDetails;
}

export default function AppDetailPage({ appId, onBack, onShowSimilarApps, onOpenSearch, onOrgClick }: AppDetailPageProps) {
  const { apps, allAppListings } = useStoreConfig();
  const [fetchedApp, setFetchedApp] = useState<AppDetails | null>(null);

  useEffect(() => {
    let cancelled = false;
    const existing = apps[appId] || allAppListings.find((item) => item.id === appId);
    if (existing) {
      setFetchedApp(null);
      return () => { cancelled = true; };
    }

    fetch(`/api/apps/${encodeURIComponent(appId)}`)
      .then(async (response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!cancelled && data?.success && data.app) setFetchedApp(data.app);
      })
      .catch(() => undefined);

    return () => { cancelled = true; };
  }, [appId, apps, allAppListings]);

  const targetAppId = apps[appId]?.id || fetchedApp?.id || appId;
  const resolvedRawApp = apps[targetAppId] || apps[appId] || allAppListings.find((item) => item.id === appId) || fetchedApp;
  const app = useMemo(() => normalizeAppRecord(resolvedRawApp, targetAppId), [resolvedRawApp, targetAppId]);

  if (!app) {
    return (
      <main className="fixed inset-0 z-[60] flex flex-col bg-theme-bg text-theme-text">
        <header className="flex h-14 items-center px-4">
          <button type="button" onClick={onBack} aria-label="Back" className="rounded-full p-2 hover:bg-theme-hover"><ArrowLeft /></button>
          <span className="ml-3">App details</span>
        </header>
        <div className="flex flex-1 items-center justify-center">Loading app details…</div>
      </main>
    );
  }

  const screenshots = [...app.screenshots, ...app.tabletScreenshots.filter((image) => !app.screenshots.includes(image))];
  const size = getUnifiedAppSize(app);

  return (
    <main className="fixed inset-0 z-[60] overflow-y-auto bg-theme-bg text-theme-text">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-theme-border/30 bg-theme-bg/95 px-4 backdrop-blur">
        <button type="button" onClick={onBack} aria-label="Back" className="rounded-full p-2 hover:bg-theme-hover"><ArrowLeft /></button>
        <span className="min-w-0 flex-1 truncate font-medium">{app.name}</span>
        {onOpenSearch && <button type="button" onClick={onOpenSearch} aria-label="Search" className="rounded-full p-2 hover:bg-theme-hover"><Search /></button>}
        <button type="button" onClick={() => navigator.share?.({ title: app.name, url: window.location.href })} aria-label="Share" className="rounded-full p-2 hover:bg-theme-hover"><Share2 /></button>
      </header>

      <article className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <section className="flex items-center gap-4">
          {app.iconUrl ? <img src={app.iconUrl} alt="" className="h-20 w-20 rounded-2xl object-cover" /> : <div className="h-20 w-20 rounded-2xl bg-theme-hover" />}
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold">{app.name}</h1>
            <button type="button" onClick={() => onOrgClick?.(app.developer)} className="text-blue-600 hover:underline dark:text-blue-300">{app.developer}</button>
            <p className="text-sm text-theme-text-muted">{app.category}</p>
          </div>
        </section>

        <section className="my-6 flex flex-wrap items-center gap-x-8 gap-y-3 border-y border-theme-border/30 py-4 text-sm">
          <span className="inline-flex items-center gap-1"><Star className="h-4 w-4" /> {app.rating.toFixed(1)}</span>
          <span>{app.downloads} downloads</span>
          {size && <span>{size}</span>}
          <span>{app.contentRating}</span>
        </section>

        {app.downloadUrl ? (
          <a href={app.downloadUrl} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-blue-600 px-6 font-medium text-white hover:bg-blue-700"><Download className="h-4 w-4" /> Download</a>
        ) : <p className="text-sm text-theme-text-muted">Download unavailable</p>}

        {app.tagline && <p className="mt-6 text-lg">{app.tagline}</p>}
        <section className="py-6">
          <h2 className="mb-2 text-xl font-medium">About this app</h2>
          <p className="whitespace-pre-line leading-relaxed">{app.aboutText}</p>
          {app.tags.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{app.tags.map((tag) => <span key={tag} className="rounded-full border border-theme-border/40 px-3 py-1 text-sm">{tag}</span>)}</div>}
        </section>

        {screenshots.length > 0 && <section className="py-4"><h2 className="mb-3 text-xl font-medium">Screenshots</h2><div className="flex gap-3 overflow-x-auto">{screenshots.map((image, index) => <img key={`${image}-${index}`} src={image} alt={`${app.name} screenshot ${index + 1}`} className="h-64 w-auto rounded-lg object-cover" loading="lazy" />)}</div></section>}

        {onShowSimilarApps && <button type="button" onClick={onShowSimilarApps} className="mt-4 text-blue-600 hover:underline dark:text-blue-300">See similar apps</button>}
      </article>
    </main>
  );
}
