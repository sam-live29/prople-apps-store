  const app: AppDetails | null = useMemo(() => {
    if (!resolvedRawApp || !resolvedRawApp.name) {
      return null;
    }

    const normalized = normalizeAppRecord(resolvedRawApp, targetAppId);
    if (!normalized) {
      return null;
    }

    const appSize = getUnifiedAppSize(normalized);
    const downloadsFormatted = normalized.downloads
      ? formatDownloadCount(normalized.downloads)
      : (typeof normalized.downloadsCount === 'number' ? formatDownloadCount(normalized.downloadsCount) : '0+');

    return {
      ...normalized,
      id: normalized.id || targetAppId,
      name: normalized.name,
      developer: normalized.developer || 'Verified Publisher',
      category: normalized.category || 'General',
      rating: typeof normalized.rating === 'number' ? normalized.rating : 0,
      ratingsCount: typeof normalized.ratingsCount === 'number' ? normalized.ratingsCount : 0,
      reviewsCount: normalized.reviewsCount || (normalized.ratingsCount ? `${normalized.ratingsCount} review${normalized.ratingsCount === 1 ? '' : 's'}` : '0 reviews'),
      size: appSize,
      downloads: downloadsFormatted,
      downloadsCount: typeof normalized.downloadsCount === 'number' ? normalized.downloadsCount : (normalized.downloads ? parseDownloadCount(normalized.downloads) : 0),
      contentRating: normalized.contentRating || 'Rated for 3+',
      price: normalized.price || 'Free',
      type: normalized.type || 'github_release',
      url: normalized.url || '#',
      githubRepo: normalized.githubRepo,
      githubReleaseUrl: normalized.githubReleaseUrl,
      downloadUrl: normalized.downloadUrl,
      releaseTag: normalized.releaseTag || 'v1.0.0',
      versionName: normalized.versionName || '1.0.0',
      assetName: normalized.assetName || (normalized.downloadUrl ? decodeURIComponent(String(normalized.downloadUrl).split('?')[0].split('#')[0].split('/').pop() || '').trim() : ''),
      sha256: normalized.sha256,
      releaseNotes: normalized.releaseNotes,
      containsAds: Boolean(normalized.containsAds),
      inAppPurchases: Boolean(normalized.inAppPurchases),
      iconUrl: normalized.iconUrl || '',
      featureGraphicUrl: normalized.featureGraphicUrl || '',
      detailsBannerUrl: (normalized as any)?.detailsBannerUrl || '',
      heroBannerUrl: (normalized as any)?.heroBannerUrl || '',
      screenshots: Array.isArray(normalized.screenshots) ? normalized.screenshots : [],
      tabletScreenshots: Array.isArray(normalized.tabletScreenshots) ? normalized.tabletScreenshots : [],
      promoVideoUrl: normalized.promoVideoUrl || '',
      videoThumbnailUrl: normalized.videoThumbnailUrl || '',
      tagline: normalized.tagline || '',
      aboutText: normalized.aboutText || normalized.description || `${normalized.name} on Prople Store.`,
      tags: Array.isArray(normalized.tags) && normalized.tags.length > 0 ? normalized.tags : [normalized.category || 'App', 'Verified'].filter(Boolean),
      developerInfo: normalized.developerInfo || {
        website: normalized.url,
        github: normalized.githubRepo ? `https://github.com/${normalized.githubRepo.split('/')[0]}` : undefined,
        email: normalized.developer ? `support@${normalized.developer.toLowerCase().replace(/[^a-z0-9]/g, '')}.org` : undefined
      },
      reviews: Array.isArray(normalized.reviews) ? normalized.reviews : [],
      platform: normalized.platform,
      targetOs: normalized.targetOs,
      packageFormat: normalized.packageFormat,
      dataSafety: normalized.dataSafety
    };
  }, [resolvedRawApp, targetAppId]);

