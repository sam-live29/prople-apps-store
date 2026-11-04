import { AppDetails } from '../types';

export function slugifyAppName(name: string): string {
  return (name || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getAppShareUrl(app: { id: string; name?: string } | string, appName?: string): string {
  const appId = typeof app === 'string' ? app : app.id;
  const name = typeof app === 'object' ? app.name : appName;
  const slug = name ? slugifyAppName(name) : '';
  const finalSlug = slug || appId;
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.prople.co.in';
    return `${origin}/apps/${encodeURIComponent(finalSlug)}`;
  } catch {
    return `/apps/${encodeURIComponent(finalSlug)}`;
  }
}

export function getAppDownloadShareUrl(app: { id: string; name?: string } | string, appName?: string): string {
  const appId = typeof app === 'string' ? app : app.id;
  const name = typeof app === 'object' ? app.name : appName;
  const slug = name ? slugifyAppName(name) : '';
  const finalSlug = slug || appId;
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.prople.co.in';
    return `${origin}/apps/${encodeURIComponent(finalSlug)}/download`;
  } catch {
    return `/apps/${encodeURIComponent(finalSlug)}/download`;
  }
}

export async function copyAppDownloadLink(
  app: AppDetails,
  showToast?: (msg: string) => void
): Promise<void> {
  const downloadUrl = getAppDownloadShareUrl(app);
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(downloadUrl);
      if (showToast) {
        showToast('Download link copied to clipboard');
      }
    }
  } catch {
    if (showToast) {
      showToast('Unable to copy download link');
    }
  }
}

/**
 * Triggers the device/browser's native share menu (`navigator.share`).
 * Strictly shares pure text & URL without any media/image attachments.
 * This ensures messaging platforms (WhatsApp, Telegram, iMessage, etc.) automatically
 * generate the native rich link preview card (side app thumbnail + bottom website favicon)
 * without sending picture/media attachments.
 */
export async function shareAppNative(
  app: AppDetails,
  showToast?: (msg: string) => void,
  options?: { isDownloadLink?: boolean }
): Promise<void> {
  const shareUrl = options?.isDownloadLink ? getAppDownloadShareUrl(app) : getAppShareUrl(app);
  const shareTitle = options?.isDownloadLink ? `Download ${app.name} - Prople Store` : `${app.name} - Prople Store`;
  const shareText = options?.isDownloadLink ? `Download and install ${app.name} on Prople Store:` : `Check out ${app.name} on Prople Store!`;

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: shareTitle,
        text: shareText,
        url: shareUrl,
      });
      return;
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // User dismissed share dialog
        return;
      }
      // On platforms where separate text and url is rejected, pass combined text + url
      try {
        await navigator.share({
          title: shareTitle,
          text: `${shareText} ${shareUrl}`,
        });
        return;
      } catch (innerErr: any) {
        if (innerErr?.name === 'AbortError') return;
      }
    }
  }

  // Fallback to copying direct link to clipboard
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      if (showToast) {
        showToast(options?.isDownloadLink ? 'Download link copied to clipboard' : 'App link copied to clipboard');
      }
    }
  } catch {
    if (showToast) {
      showToast('Unable to copy link');
    }
  }
}
