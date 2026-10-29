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

function sanitizeIdentifier(input: any, maxLength = 100): string {
  if (typeof input !== 'string') return '';
  return input.replace(/[^a-zA-Z0-9_\-\.:]/g, '').slice(0, maxLength);
}

function isBloatPackage(name: string): boolean {
  const lower = (name || '').toLowerCase().trim();
  return (
    lower.endsWith('.sha256') ||
    lower.endsWith('.sha512') ||
    lower.endsWith('.sha1') ||
    lower.endsWith('.md5') ||
    lower.endsWith('.asc') ||
    lower.endsWith('.sig') ||
    lower.endsWith('.cert') ||
    lower.endsWith('.pem') ||
    lower.endsWith('.txt') ||
    lower.endsWith('.md') ||
    lower.endsWith('.pdf') ||
    lower.endsWith('.aar') || // Dev Android Archive library - NOT an end-user installable app
    lower.endsWith('.pom') ||
    lower.endsWith('-sources.jar') ||
    lower.endsWith('-javadoc.jar') ||
    lower.includes('-source.') ||
    lower.includes('-sources.') ||
    lower.includes('-src.') ||
    lower.includes('source-code') ||
    lower.includes('-debug-symbols') ||
    lower.includes('-symbols.zip') ||
    lower.includes('-pdb.zip') ||
    lower.includes('-dbg.deb') ||
    lower.includes('-devel.rpm') ||
    lower.includes('-dev.deb')
  );
}

function pickMainAsset(rawAssets: any[], platform?: string) {
  if (!Array.isArray(rawAssets) || rawAssets.length === 0) return null;

  const valid = rawAssets.filter((a: any) => typeof a.name === 'string' && a.browser_download_url);
  const clean = valid.filter((a: any) => !isBloatPackage(a.name) && !(typeof a.size === 'number' && a.size > 0 && a.size < 1024 * 1024));
  const pool = clean.length > 0 ? clean : valid.filter((a: any) => !isBloatPackage(a.name));

  const p = (platform || '').toLowerCase();

  if (p === 'linux') {
    return (
      pool.find((a: any) => a.name.toLowerCase().endsWith('.appimage')) ||
      pool.find((a: any) => a.name.toLowerCase().endsWith('.deb') && !a.name.toLowerCase().includes('-dev')) ||
      pool.find((a: any) => a.name.toLowerCase().endsWith('.rpm') && !a.name.toLowerCase().includes('-devel')) ||
      pool.find((a: any) => {
        const n = a.name.toLowerCase();
        return (n.endsWith('.tar.gz') || n.endsWith('.tgz')) && (n.includes('linux') || n.includes('amd64') || n.includes('x86_64'));
      }) ||
      null
    );
  }

  if (p === 'windows') {
    return (
      pool.find((a: any) => {
        const n = a.name.toLowerCase();
        return n.endsWith('.exe') && (n.includes('setup') || n.includes('installer') || n.includes('win') || n.includes('x64'));
      }) ||
      pool.find((a: any) => a.name.toLowerCase().endsWith('.exe')) ||
      pool.find((a: any) => a.name.toLowerCase().endsWith('.msi')) ||
      pool.find((a: any) => a.name.toLowerCase().endsWith('.msix')) ||
      null
    );
  }

  if (p === 'android') {
    return (
      pool.find((a: any) => {
        const n = a.name.toLowerCase();
        return n.endsWith('.apk') && (n.includes('universal') || n.includes('release') || !n.includes('debug'));
      }) ||
      pool.find((a: any) => a.name.toLowerCase().endsWith('.apk')) ||
      pool.find((a: any) => a.name.toLowerCase().endsWith('.aab')) ||
      null
    );
  }

  if (p === 'mac' || p === 'macos' || p === 'darwin') {
    return (
      pool.find((a: any) => {
        const n = a.name.toLowerCase();
        return n.endsWith('.dmg') && (n.includes('universal') || n.includes('arm64') || n.includes('apple') || !n.includes('x86'));
      }) ||
      pool.find((a: any) => a.name.toLowerCase().endsWith('.dmg')) ||
      pool.find((a: any) => a.name.toLowerCase().endsWith('.pkg')) ||
      null
    );
  }

  if (p === 'ios' || p === 'iphone' || p === 'ipad') {
    return (
      pool.find((a: any) => a.name.toLowerCase().endsWith('.ipa')) ||
      null
    );
  }

  // Generic / auto-detect: prioritize APK, IPA, AppImage, DMG, EXE, DEB, PKG, MSI
  return (
    pool.find((a: any) => a.name.toLowerCase().endsWith('.apk') && !a.name.toLowerCase().includes('debug')) ||
    pool.find((a: any) => a.name.toLowerCase().endsWith('.ipa')) ||
    pool.find((a: any) => a.name.toLowerCase().endsWith('.appimage')) ||
    pool.find((a: any) => a.name.toLowerCase().endsWith('.dmg')) ||
    pool.find((a: any) => a.name.toLowerCase().endsWith('.exe')) ||
    pool.find((a: any) => a.name.toLowerCase().endsWith('.pkg')) ||
    pool.find((a: any) => a.name.toLowerCase().endsWith('.deb')) ||
    pool.find((a: any) => a.name.toLowerCase().endsWith('.msi')) ||
    pool.find((a: any) => a.name.toLowerCase().endsWith('.apk')) ||
    pool.find((a: any) => a.name.toLowerCase().endsWith('.rpm')) ||
    pool.find((a: any) => a.name.toLowerCase().endsWith('.tar.gz'))
  );
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
    const platform = (req.query?.platform as string || '').trim().toLowerCase();

    if (!rawUrl) {
      return res.status(400).json({ success: false, error: 'Missing url parameter.' });
    }

    const cleanUrl = rawUrl;
    const lowerClean = cleanUrl.toLowerCase().split('?')[0];
    const isDirectApk = lowerClean.endsWith('.apk') || lowerClean.endsWith('.aab');
    const isDirectIpa = lowerClean.endsWith('.ipa');
    const isDirectWin = lowerClean.endsWith('.exe') || lowerClean.endsWith('.msi') || lowerClean.endsWith('.msix') || lowerClean.endsWith('.appx');
    const isDirectLin = lowerClean.endsWith('.appimage') || lowerClean.endsWith('.deb') || lowerClean.endsWith('.rpm') || lowerClean.endsWith('.tar.gz') || lowerClean.endsWith('.tgz') || lowerClean.endsWith('.tar.xz') || lowerClean.endsWith('.tar.zst') || lowerClean.endsWith('.snap') || lowerClean.endsWith('.flatpak') || lowerClean.endsWith('.run') || lowerClean.endsWith('.bin');
    const isDirectMac = lowerClean.endsWith('.dmg') || (lowerClean.endsWith('.pkg') && !lowerClean.includes('.pkg.tar.'));

    if (isDirectApk || isDirectIpa || isDirectWin || isDirectLin || isDirectMac) {
      const parts = cleanUrl.split('/');
      const assetName = decodeURIComponent(parts[parts.length - 1]?.split('?')[0]?.split('#')[0] || '').trim();
      return res.status(200).json({
        success: true,
        isBinary: true,
        isApk: isDirectApk,
        isIos: isDirectIpa,
        isWindows: isDirectWin,
        isLinux: isDirectLin,
        isMac: isDirectMac,
        platform: isDirectIpa ? 'ios' : isDirectMac ? 'mac' : isDirectLin ? 'linux' : isDirectWin ? 'windows' : 'android',
        format: isDirectIpa ? 'ipa' : isDirectMac ? (lowerClean.endsWith('.pkg') ? 'pkg' : 'dmg') : isDirectLin ? 'AppImage' : isDirectWin ? 'exe' : 'apk',
        resolvedUrl: cleanUrl,
        assetName,
        source: 'direct_binary'
      });
    }

    const match = cleanUrl.match(/github\.com\/([^/]+)\/([^/]+)/i);
    if (!match) {
      return res.status(200).json({
        success: true,
        isBinary: false,
        isApk: false,
        resolvedUrl: '',
        source: 'external_url'
      });
    }

    const owner = sanitizeIdentifier(match[1]);
    const repo = sanitizeIdentifier(match[2].replace(/\.git$/i, ''));
    if (!owner || !repo) {
      return res.status(400).json({ success: false, error: 'Invalid repository identifier' });
    }

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
    const ghRes = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'PropleStore'
      }
    });

    if (ghRes.ok) {
      const release = await ghRes.json();
      if (Array.isArray(release.assets)) {
        const best = pickMainAsset(release.assets, platform);
        if (best?.browser_download_url) {
          const lowerName = (best.name || '').toLowerCase();
          const isIos = lowerName.endsWith('.ipa');
          const isMac = !isIos && (lowerName.endsWith('.dmg') || lowerName.endsWith('.pkg') || lowerName.includes('darwin') || lowerName.includes('macos') || lowerName.includes('osx'));
          const isLin = !isIos && !isMac && (lowerName.endsWith('.appimage') || lowerName.endsWith('.deb') || lowerName.endsWith('.rpm') || lowerName.endsWith('.tar.gz'));
          const isApk = !isIos && !isMac && !isLin && lowerName.endsWith('.apk');
          const isWin = !isIos && !isMac && !isLin && !isApk;
          return res.status(200).json({
            success: true,
            isBinary: true,
            isApk,
            isIos,
            isWindows: isWin,
            isLinux: isLin,
            isMac,
            platform: isIos ? 'ios' : isMac ? 'mac' : isLin ? 'linux' : isWin ? 'windows' : 'android',
            format: isIos ? 'ipa' : isMac ? (lowerName.endsWith('.pkg') ? 'pkg' : 'dmg') : isLin ? 'AppImage' : isWin ? 'exe' : 'apk',
            resolvedUrl: best.browser_download_url,
            assetName: best.name,
            size: best.size,
            tagName: release.tag_name,
            source: 'github_release_asset'
          });
        }
      }
    }

    // Fallback: search releases list
    const listRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=5`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'PropleStore'
      }
    });

    if (listRes.ok) {
      const releases = await listRes.json();
      if (Array.isArray(releases)) {
        for (const rel of releases) {
          if (Array.isArray(rel.assets)) {
            const best = pickMainAsset(rel.assets, platform);
            if (best?.browser_download_url) {
              const lowerName = (best.name || '').toLowerCase();
              const isIos = lowerName.endsWith('.ipa');
              const isMac = !isIos && (lowerName.endsWith('.dmg') || lowerName.endsWith('.pkg') || lowerName.includes('darwin') || lowerName.includes('macos') || lowerName.includes('osx'));
              const isLin = !isIos && !isMac && (lowerName.endsWith('.appimage') || lowerName.endsWith('.deb') || lowerName.endsWith('.rpm') || lowerName.endsWith('.tar.gz'));
              const isApk = !isIos && !isMac && !isLin && lowerName.endsWith('.apk');
              const isWin = !isIos && !isMac && !isLin && !isApk;
              return res.status(200).json({
                success: true,
                isBinary: true,
                isApk,
                isIos,
                isWindows: isWin,
                isLinux: isLin,
                isMac,
                platform: isIos ? 'ios' : isMac ? 'mac' : isLin ? 'linux' : isWin ? 'windows' : 'android',
                format: isIos ? 'ipa' : isMac ? (lowerName.endsWith('.pkg') ? 'pkg' : 'dmg') : isLin ? 'AppImage' : isWin ? 'exe' : 'apk',
                resolvedUrl: best.browser_download_url,
                assetName: best.name,
                size: best.size,
                tagName: rel.tag_name,
                source: 'github_release_asset'
              });
            }
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      isBinary: false,
      isApk: false,
      resolvedUrl: '',
      source: 'fallback_repo'
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
