const TRUSTED_ORIGIN_PATTERNS = [
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  /^https:\/\/([a-z0-9-]+\.)?prople\.(co\.in|store)$/i,
  /^https:\/\/([a-z0-9-]+\.)?run\.app$/i,
  /^https:\/\/([a-z0-9-]+\.)?google\.com$/i,
  /^https:\/\/([a-z0-9-]+\.)?googleusercontent\.com$/i,
  /^https:\/\/([a-z0-9-]+\.)?aistudio\.google\.com$/i,
  /^https:\/\/([a-z0-9-]+\.)?vercel\.app$/i,
  /^https:\/\/prople-store(-[a-z0-9-]+)?\.web\.app$/i,
  /^https:\/\/prople-store(-[a-z0-9-]+)?\.firebaseapp\.com$/i,
];

function isTrustedOrigin(origin?: string): boolean {
  if (!origin || typeof origin !== 'string') return false;
  const clean = origin.trim();
  if (clean === 'null') return false;
  return TRUSTED_ORIGIN_PATTERNS.some((pattern) => pattern.test(clean));
}

function getSecureCorsHeaders(origin?: string): Record<string, string> {
  const trusted = isTrustedOrigin(origin);
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-Requested-With, Accept, X-User-Id, X-User-Email, X-Entity-Ref-ID',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };

  if (trusted && origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

function isBloatOrSecondaryAsset(name: string): boolean {
  if (!name || typeof name !== 'string') return true;
  const lower = name.toLowerCase().trim();
  if (
    lower.endsWith('.sha256') || lower.endsWith('.sha512') || lower.endsWith('.sha1') ||
    lower.endsWith('.md5') || lower.endsWith('.asc') || lower.endsWith('.sig') ||
    lower.endsWith('.cert') || lower.endsWith('.crt') || lower.endsWith('.pem') ||
    lower.endsWith('.txt') || lower.endsWith('.md') || lower.endsWith('.pdf') ||
    lower.endsWith('.pom') || lower.endsWith('.json') || lower.endsWith('.xml') ||
    lower.endsWith('.aar') || lower.endsWith('-sources.jar') || lower.endsWith('-javadoc.jar') ||
    lower.endsWith('-source.zip') || lower.endsWith('-sources.zip') || lower.endsWith('-src.zip') ||
    lower.endsWith('-src.tar.gz') || lower.includes('source code') || lower.includes('source-code') ||
    lower.includes('-debug-symbols') || lower.includes('-symbols.zip') || lower.includes('-pdb.zip') ||
    lower.includes('-dbg.deb') || lower.includes('-devel.rpm') || lower.includes('-dev.deb')
  ) {
    return true;
  }
  return false;
}

function isBinaryPackage(filenameOrUrl: string): boolean {
  if (!filenameOrUrl) return false;
  const clean = filenameOrUrl.split('?')[0].toLowerCase();
  const name = clean.split('/').pop() || '';
  if (isBloatOrSecondaryAsset(name)) return false;
  return (
    name.endsWith('.apk') || name.endsWith('.aab') || name.endsWith('.exe') ||
    name.endsWith('.msi') || name.endsWith('.msix') || name.endsWith('.msixbundle') ||
    name.endsWith('.appx') || name.endsWith('.appxbundle') || name.endsWith('.appimage') ||
    name.endsWith('.deb') || name.endsWith('.rpm') || name.endsWith('.tar.gz') ||
    name.endsWith('.tgz') || name.endsWith('.tar.xz') || name.endsWith('.txz') ||
    name.endsWith('.7z') || name.endsWith('.zip') || name.endsWith('.rar') ||
    name.endsWith('.dmg') || name.endsWith('.pkg') || name.endsWith('.ipa') ||
    name.endsWith('.jar') || name.endsWith('.run')
  );
}

function selectMainPackageAsset(rawAssets: any[], platform?: string) {
  if (!Array.isArray(rawAssets) || rawAssets.length === 0) return null;
  const valid = rawAssets.filter(a => typeof a?.name === 'string' && (a.browser_download_url || a.downloadUrl));
  const clean = valid.filter(a => !isBloatOrSecondaryAsset(a.name) && !(typeof a.size === 'number' && a.size > 0 && a.size < 1024 * 1024));
  const pool = clean.length > 0 ? clean : valid.filter(a => !isBloatOrSecondaryAsset(a.name));
  const p = (platform || '').toLowerCase().trim();

  if (p === 'linux') {
    const appImage = pool.find(a => a.name.toLowerCase().endsWith('.appimage'));
    if (appImage) return { name: appImage.name, downloadUrl: appImage.browser_download_url || appImage.downloadUrl };
    const deb = pool.find(a => a.name.toLowerCase().endsWith('.deb'));
    if (deb) return { name: deb.name, downloadUrl: deb.browser_download_url || deb.downloadUrl };
    const rpm = pool.find(a => a.name.toLowerCase().endsWith('.rpm'));
    if (rpm) return { name: rpm.name, downloadUrl: rpm.browser_download_url || rpm.downloadUrl };
    const tar = pool.find(a => (a.name.toLowerCase().endsWith('.tar.gz') || a.name.toLowerCase().endsWith('.tar.xz')) && (a.name.toLowerCase().includes('linux') || a.name.toLowerCase().includes('amd64')));
    if (tar) return { name: tar.name, downloadUrl: tar.browser_download_url || tar.downloadUrl };
  } else if (p === 'windows') {
    const exe = pool.find(a => a.name.toLowerCase().endsWith('.exe'));
    if (exe) return { name: exe.name, downloadUrl: exe.browser_download_url || exe.downloadUrl };
    const msi = pool.find(a => a.name.toLowerCase().endsWith('.msi'));
    if (msi) return { name: msi.name, downloadUrl: msi.browser_download_url || msi.downloadUrl };
  } else if (p === 'android') {
    const apk = pool.find(a => a.name.toLowerCase().endsWith('.apk'));
    if (apk) return { name: apk.name, downloadUrl: apk.browser_download_url || apk.downloadUrl };
  }

  const defaultBest = pool.find(a => isBinaryPackage(a.name));
  if (defaultBest) return { name: defaultBest.name, downloadUrl: defaultBest.browser_download_url || defaultBest.downloadUrl };
  return null;
}

import { isSafePublicUrl, safeFetchWithRedirectCheck } from '../server/securityDefense';


function getExactMimeType(fileName: string, upstreamContentType?: string | null): string {
  const lower = (fileName || '').toLowerCase();
  if (lower.endsWith('.apk') || lower.endsWith('.aab')) return 'application/vnd.android.package-archive';
  if (lower.endsWith('.exe')) return 'application/x-msdownload';
  if (lower.endsWith('.msi')) return 'application/x-msi';
  if (lower.endsWith('.msix') || lower.endsWith('.appx') || lower.endsWith('.msixbundle') || lower.endsWith('.appxbundle')) return 'application/msix';
  if (lower.endsWith('.deb')) return 'application/vnd.debian.binary-package';
  if (lower.endsWith('.rpm')) return 'application/x-redhat-package-manager';
  if (lower.endsWith('.appimage') || lower.endsWith('.run') || lower.endsWith('.bin')) return 'application/x-executable';
  if (lower.endsWith('.dmg')) return 'application/x-apple-diskimage';
  if (lower.endsWith('.pkg') && !lower.includes('.pkg.tar.')) return 'application/x-newton-compatible-pkg';
  if (lower.endsWith('.ipa')) return 'application/x-itunes-ipa';
  if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) return 'application/gzip';
  if (lower.endsWith('.tar.xz') || lower.endsWith('.txz') || lower.endsWith('.pkg.tar.xz')) return 'application/x-xz';
  if (lower.endsWith('.tar.zst') || lower.endsWith('.tzst') || lower.endsWith('.pkg.tar.zst')) return 'application/zstd';
  if (lower.endsWith('.7z')) return 'application/x-7z-compressed';
  if (lower.endsWith('.rar')) return 'application/vnd.rar';
  if (lower.endsWith('.zip')) return 'application/zip';
  if (lower.endsWith('.jar')) return 'application/java-archive';
  if (upstreamContentType && !upstreamContentType.includes('text/') && !upstreamContentType.includes('json')) {
    return upstreamContentType;
  }
  return 'application/octet-stream';
}

function extractExactFileName(urlStr: string, customName?: string): string {
  const cleanUrlPath = (urlStr || '').split('?')[0].split('#')[0];
  const urlBase = decodeURIComponent(cleanUrlPath.split('/').pop() || '').trim();
  if (urlBase && isBinaryPackage(urlBase) && !isBloatOrSecondaryAsset(urlBase)) {
    return urlBase;
  }
  if (customName) {
    const cleanCustom = decodeURIComponent(customName.split('?')[0].split('#')[0].split('/').pop() || '').trim();
    if (cleanCustom && isBinaryPackage(cleanCustom) && !isBloatOrSecondaryAsset(cleanCustom)) {
      return cleanCustom;
    }
  }
  return '';
}

export default async function handler(req: any, res: any) {
  const corsHeaders = getSecureCorsHeaders(req.headers?.origin);
  for (const [key, value] of Object.entries(corsHeaders)) {
    res.setHeader(key, value);
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const rawUrl = (req.query?.url as string || '').trim();
    const customName = (req.query?.name as string || '').trim();
    const platform = (req.query?.platform as string || '').trim().toLowerCase();

    if (!rawUrl) {
      return res.status(400).json({ success: false, error: 'Missing download URL parameter.' });
    }

    const lowerRaw = rawUrl.toLowerCase().split('?')[0];
    if (
      lowerRaw.endsWith('/archive/refs/heads/main.zip') ||
      lowerRaw.endsWith('/archive/refs/heads/master.zip') ||
      lowerRaw.includes('/archive/refs/heads/') ||
      lowerRaw.includes('/archive/refs/tags/') ||
      lowerRaw.includes('/archive/') ||
      lowerRaw.includes('/tarball/') ||
      lowerRaw.includes('/zipball/') ||
      lowerRaw.includes('/tree/') ||
      lowerRaw.includes('/blob/') ||
      lowerRaw.includes('/actions/runs/') ||
      lowerRaw.includes('/pipeline/') ||
      lowerRaw.includes('/pipelines/')
    ) {
      return res.status(422).json({
        success: false,
        error: 'Source code archives, repositories, and CI pipeline paths cannot be downloaded as executable packages. Only verified binary packages (.apk, .deb, .AppImage, .exe, .dmg) are served.'
      });
    }

    let targetBinaryUrl = rawUrl;
    let resolvedExactAssetName = '';

    // If rawUrl is a GitHub repository or release tag URL, resolve it to the exact main release package asset
    if (rawUrl.includes('github.com') && !rawUrl.includes('/releases/download/') && !rawUrl.includes('/raw/')) {
      const match = rawUrl.match(/github\.com\/([^/]+)\/([^/]+)/i);
      if (match) {
        const owner = match[1];
        const repo = match[2].replace(/\.git$/i, '');
        let tag = '';
        if (rawUrl.includes('/releases/tag/')) {
          tag = rawUrl.split('/releases/tag/')[1]?.split('/')[0]?.split('?')[0] || '';
        }
        const ghHeaders: Record<string, string> = {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'PropleStore/1.0'
        };
        if (process.env.GITHUB_TOKEN) {
          ghHeaders['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
        }

        const apiUrl = tag
          ? `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`
          : `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
        
        try {
          const ghRes = await fetch(apiUrl, { headers: ghHeaders });
          if (ghRes.ok) {
            const relData = await ghRes.json();
            if (Array.isArray(relData.assets)) {
              const bestAsset = selectMainPackageAsset(relData.assets, platform);
              if (bestAsset?.downloadUrl) {
                targetBinaryUrl = bestAsset.downloadUrl;
                resolvedExactAssetName = bestAsset.name;
              }
            }
          } else if (!tag) {
            const listRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=5`, { headers: ghHeaders });
            if (listRes.ok) {
              const releases = await listRes.json();
              if (Array.isArray(releases)) {
                for (const rel of releases) {
                  if (Array.isArray(rel.assets)) {
                    const bestAsset = selectMainPackageAsset(rel.assets, platform);
                    if (bestAsset?.downloadUrl) {
                      targetBinaryUrl = bestAsset.downloadUrl;
                      resolvedExactAssetName = bestAsset.name;
                      break;
                    }
                  }
                }
              }
            }
          }
        } catch {}
      }
    }

    if (targetBinaryUrl.includes('github.com') && !targetBinaryUrl.includes('/releases/download/') && !targetBinaryUrl.includes('/raw/')) {
      return res.status(204).end();
    }

    if (!targetBinaryUrl.startsWith('http://') && !targetBinaryUrl.startsWith('https://')) {
      targetBinaryUrl = 'https://' + targetBinaryUrl;
    }

    if (!isSafePublicUrl(targetBinaryUrl)) {
      return res.status(403).end();
    }

    // Strictly use the exact package filename from the resolved asset or binary URL (never create bloat fallback files)
    const safeFileName = resolvedExactAssetName || extractExactFileName(targetBinaryUrl, customName);
    if (!safeFileName) {
      return res.status(204).end();
    }

    // Stream directly from upstream host (validating each redirect target against SSRF filter)
    const upstreamRes = await safeFetchWithRedirectCheck(targetBinaryUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': '*/*'
      }
    }, 5);

    if (!upstreamRes.ok || !upstreamRes.body) {
      return res.status(204).end();
    }

    const cleanSafeName = safeFileName.replace(/["\r\n]/g, '');
    const lowerName = cleanSafeName.toLowerCase();
    const upstreamContentType = (upstreamRes.headers.get('content-type') || '').toLowerCase();

    if (upstreamContentType.includes('text/html') || upstreamContentType.includes('application/json') || upstreamContentType.includes('text/plain')) {
      return res.status(204).end();
    }

    const ONE_MB = 1024 * 1024; // 1,048,576 bytes
    const isExecutableBinary = (
      lowerName.endsWith('.apk') ||
      lowerName.endsWith('.aab') ||
      lowerName.endsWith('.appimage') ||
      lowerName.endsWith('.exe') ||
      lowerName.endsWith('.msi') ||
      lowerName.endsWith('.msix') ||
      lowerName.endsWith('.appx') ||
      lowerName.endsWith('.deb') ||
      lowerName.endsWith('.rpm') ||
      lowerName.endsWith('.dmg') ||
      lowerName.endsWith('.pkg') ||
      lowerName.endsWith('.ipa') ||
      lowerName.endsWith('.run') ||
      lowerName.endsWith('.bin') ||
      lowerName.endsWith('.tar.gz') ||
      lowerName.endsWith('.tgz') ||
      lowerName.endsWith('.zip') ||
      lowerName.endsWith('.7z')
    );

    const contentLength = upstreamRes.headers.get('content-length');
    if (contentLength) {
      const parsedLen = parseInt(contentLength, 10);
      if (parsedLen < ONE_MB && isExecutableBinary) {
        return res.status(422).json({
          success: false,
          error: `Application package size is under 1 MB (${(parsedLen / 1024).toFixed(1)} KB). Download prevented to avoid corrupted stubs.`
        });
      }
    }

    // Inspect the first chunk to guarantee zero HTML/XML/JSON files
    const reader = (upstreamRes.body as ReadableStream<Uint8Array>).getReader();
    const firstRead = await reader.read();
    if (firstRead.done || !firstRead.value || firstRead.value.length === 0) {
      try { reader.cancel(); } catch {}
      return res.status(204).end();
    }

    const firstBytes = firstRead.value;
    if (firstBytes.length >= 4) {
      const headStr = Buffer.from(firstBytes.subarray(0, Math.min(firstBytes.length, 64))).toString('utf8').trimStart().toLowerCase();
      if (
        headStr.startsWith('<!doctype') ||
        headStr.startsWith('<html') ||
        headStr.startsWith('<head') ||
        headStr.startsWith('<body') ||
        headStr.startsWith('<?xml') ||
        headStr.startsWith('<?php') ||
        headStr.startsWith('{"error"') ||
        headStr.startsWith('{"success":false')
      ) {
        try { reader.cancel(); } catch {}
        return res.status(422).json({
          success: false,
          error: 'Upstream returned an HTML or error document instead of a binary package.'
        });
      }
    }

    const mimeType = getExactMimeType(cleanSafeName, upstreamContentType);

    res.status(200);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${cleanSafeName}"; filename*=UTF-8''${encodeURIComponent(cleanSafeName)}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Disposition, Content-Type');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    res.setHeader('Cache-Control', 'no-transform, public, max-age=3600');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    // Write first chunk immediately
    res.write(Buffer.from(firstBytes));

    let streamClosed = false;
    req.on('close', () => {
      streamClosed = true;
      try { reader.cancel(); } catch {}
    });

    while (!streamClosed) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.length > 0 && !streamClosed) {
        const canContinue = res.write(Buffer.from(value));
        if (!canContinue && !streamClosed) {
          await new Promise<void>((resolve) => res.once('drain', resolve));
        }
      }
    }

    if (!streamClosed) {
      res.end();
    }
  } catch (err: any) {
    if (!res.headersSent) {
      return res.status(204).end();
    }
  }
}
