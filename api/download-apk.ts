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

const DEFAULT_ALLOWED_OUTBOUND_HOST_PATTERNS: RegExp[] = [
  /^([a-z0-9-]+\.)?github\.com$/i,
  /^([a-z0-9-]+\.)?githubusercontent\.com$/i,
  /^([a-z0-9-]+\.)?amazonaws\.com$/i,
  /^([a-z0-9-]+\.)?cloudfront\.net$/i,
  /^([a-z0-9-]+\.)?r2\.dev$/i,
  /^([a-z0-9-]+\.)?r2\.cloudflarestorage\.com$/i,
  /^([a-z0-9-]+\.)?digitaloceanspaces\.com$/i,
  /^([a-z0-9-]+\.)?backblazeb2\.com$/i,
  /^([a-z0-9-]+\.)?b-cdn\.net$/i,
  /^([a-z0-9-]+\.)?wasabisys\.com$/i,
  /^([a-z0-9-]+\.)?linodeobjects\.com$/i,
  /^([a-z0-9-]+\.)?your-objectstorage\.com$/i,
  /^([a-z0-9-]+\.)?contabostorage\.com$/i,
  /^([a-z0-9-]+\.)?supabase\.co$/i,
  /^([a-z0-9-]+\.)?vercel-storage\.com$/i,
  /^([a-z0-9-]+\.)?firebasestorage\.app$/i,
  /^([a-z0-9-]+\.)?storage\.googleapis\.com$/i,
  /^([a-z0-9-]+\.)?googleapis\.com$/i,
  /^([a-z0-9-]+\.)?googleusercontent\.com$/i,
  /^([a-z0-9-]+\.)?gitlab\.com$/i,
  /^([a-z0-9-]+\.)?sourceforge\.net$/i,
  /^([a-z0-9-]+\.)?prople\.(co\.in|store)$/i,
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
    Vary: 'Origin',
  };

  if (trusted && origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

function isReservedIpv4(a: number, b: number, c: number, _d: number): boolean {
  if (a === 0 || a === 127 || a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  if (a >= 224) return true;
  return false;
}

function parseAnyIpv4(host: string): [number, number, number, number] | null {
  const clean = host.trim().toLowerCase();
  if (/^\d+$/.test(clean)) {
    const num = parseInt(clean, 10);
    if (!isNaN(num) && num >= 0 && num <= 4294967295) {
      return [(num >>> 24) & 255, (num >>> 16) & 255, (num >>> 8) & 255, num & 255];
    }
  }
  if (/^0x[0-9a-f]+$/i.test(clean)) {
    const num = parseInt(clean, 16);
    if (!isNaN(num) && num >= 0 && num <= 4294967295) {
      return [(num >>> 24) & 255, (num >>> 16) & 255, (num >>> 8) & 255, num & 255];
    }
  }
  const parts = clean.split('.');
  if (parts.length >= 1 && parts.length <= 4) {
    const parsedParts: number[] = [];
    for (const p of parts) {
      if (!p) return null;
      let val: number;
      if (p.startsWith('0x') || p.startsWith('0X')) val = parseInt(p, 16);
      else if (p.startsWith('0') && p.length > 1 && /^[0-7]+$/.test(p)) val = parseInt(p, 8);
      else if (/^\d+$/.test(p)) val = parseInt(p, 10);
      else return null;
      if (isNaN(val) || val < 0) return null;
      parsedParts.push(val);
    }
    if (parsedParts.length === 4 && parsedParts.every((v) => v <= 255)) {
      return [parsedParts[0], parsedParts[1], parsedParts[2], parsedParts[3]];
    }
    if (parsedParts.length === 1 && parsedParts[0] <= 4294967295) {
      const num = parsedParts[0];
      return [(num >>> 24) & 255, (num >>> 16) & 255, (num >>> 8) & 255, num & 255];
    }
  }
  return null;
}

function isAllowedOutboundHost(hostname: string): boolean {
  const cleanHost = (hostname || '').toLowerCase().trim();
  if (!cleanHost) return false;
  const envAllowed = (process.env.ALLOWED_OUTBOUND_HOSTS || process.env.OUTBOUND_FETCH_ALLOWLIST || '')
    .toLowerCase()
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const pattern of envAllowed) {
    if (pattern === cleanHost) return true;
    if (pattern.startsWith('*.') && cleanHost.endsWith(pattern.slice(1))) return true;
    if (pattern.startsWith('.') && cleanHost.endsWith(pattern)) return true;
  }
  return DEFAULT_ALLOWED_OUTBOUND_HOST_PATTERNS.some((pat) => pat.test(cleanHost));
}

function isSafePublicUrl(candidateUrl: string, requireAllowlist = false): boolean {
  if (!candidateUrl || typeof candidateUrl !== 'string') return false;
  const trimmed = candidateUrl.trim();
  if (/[\x00-\x1F\x7F-\x9F\s]/.test(trimmed)) return false;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:' && (process.env.NODE_ENV === 'production' || parsed.protocol !== 'http:')) {
    return false;
  }
  if (parsed.username || parsed.password) return false;
  if (parsed.port && parsed.port !== '80' && parsed.port !== '443') return false;

  const hostname = parsed.hostname.toLowerCase().trim();
  if (!hostname) return false;

  const blockedHosts = new Set([
    'localhost',
    'localhost.localdomain',
    'ip6-localhost',
    'ip6-loopback',
    '127.0.0.1',
    '::1',
    '[::1]',
    '0.0.0.0',
    '169.254.169.254',
    '169.254.170.2',
    '100.100.100.200',
    'metadata.google.internal',
    'metadata',
    'instance-data',
  ]);
  if (blockedHosts.has(hostname)) return false;

  if (
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.lan') ||
    hostname.endsWith('.home') ||
    hostname.endsWith('.corp') ||
    hostname.endsWith('.intranet') ||
    hostname.endsWith('.onion') ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.nip.io') ||
    hostname.endsWith('.sslip.io') ||
    hostname.endsWith('.xip.io') ||
    hostname.includes('127.0.0.1') ||
    hostname.includes('169.254.') ||
    hostname.includes('192.168.') ||
    hostname.includes('10.0.') ||
    hostname.includes('localhost')
  ) {
    return false;
  }

  if (hostname.startsWith('[') && hostname.endsWith(']')) return false;

  const ipv4Octets = parseAnyIpv4(hostname);
  if (ipv4Octets && isReservedIpv4(...ipv4Octets)) return false;

  if (requireAllowlist && !isAllowedOutboundHost(hostname)) {
    return false;
  }

  return true;
}

async function safeFetchWithRedirectCheck(
  targetUrl: string,
  options: RequestInit = {},
  maxRedirects = 5
): Promise<{ res: Response; finalUrl: string }> {
  let currentUrl = targetUrl;
  let redirectsCount = 0;
  const seenUrls = new Set<string>();

  while (redirectsCount <= maxRedirects) {
    if (seenUrls.has(currentUrl)) {
      throw new Error('Circular redirect loop detected');
    }
    seenUrls.add(currentUrl);

    if (!isSafePublicUrl(currentUrl, false)) {
      throw new Error('Destination URL blocked by security policy');
    }

    const fetchOptions: RequestInit = {
      ...options,
      redirect: 'manual',
    };

    const res = await fetch(currentUrl, fetchOptions);
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get('location');
      if (!location) return { res, finalUrl: currentUrl };
      const nextUrl = new URL(location, currentUrl).toString();
      if (currentUrl.startsWith('https:') && nextUrl.startsWith('http:')) {
        throw new Error('HTTPS downgrade blocked');
      }
      currentUrl = nextUrl;
      redirectsCount += 1;
      continue;
    }

    return { res, finalUrl: currentUrl };
  }

  throw new Error('Maximum redirects exceeded');
}

function isBloatOrSecondaryAsset(name: string): boolean {
  if (!name || typeof name !== 'string') return true;
  const lower = name.toLowerCase().trim();
  return (
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
  );
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
  const valid = rawAssets.filter((a) => typeof a?.name === 'string' && (a.browser_download_url || a.downloadUrl));
  const clean = valid.filter((a) => !isBloatOrSecondaryAsset(a.name));
  const pool = clean.length > 0 ? clean : valid;
  const p = (platform || '').toLowerCase().trim();

  if (p === 'linux') {
    const appImage = pool.find((a) => a.name.toLowerCase().endsWith('.appimage'));
    if (appImage) return { name: appImage.name, downloadUrl: appImage.browser_download_url || appImage.downloadUrl };
    const deb = pool.find((a) => a.name.toLowerCase().endsWith('.deb'));
    if (deb) return { name: deb.name, downloadUrl: deb.browser_download_url || deb.downloadUrl };
    const rpm = pool.find((a) => a.name.toLowerCase().endsWith('.rpm'));
    if (rpm) return { name: rpm.name, downloadUrl: rpm.browser_download_url || rpm.downloadUrl };
    const tar = pool.find((a) => (a.name.toLowerCase().endsWith('.tar.gz') || a.name.toLowerCase().endsWith('.tar.xz')) && (a.name.toLowerCase().includes('linux') || a.name.toLowerCase().includes('amd64')));
    if (tar) return { name: tar.name, downloadUrl: tar.browser_download_url || tar.downloadUrl };
  } else if (p === 'windows') {
    const exe = pool.find((a) => a.name.toLowerCase().endsWith('.exe'));
    if (exe) return { name: exe.name, downloadUrl: exe.browser_download_url || exe.downloadUrl };
    const msi = pool.find((a) => a.name.toLowerCase().endsWith('.msi'));
    if (msi) return { name: msi.name, downloadUrl: msi.browser_download_url || msi.downloadUrl };
  } else if (p === 'android') {
    const apk = pool.find((a) => a.name.toLowerCase().endsWith('.apk'));
    if (apk) return { name: apk.name, downloadUrl: apk.browser_download_url || apk.downloadUrl };
  } else if (p === 'mac') {
    const dmg = pool.find((a) => a.name.toLowerCase().endsWith('.dmg'));
    if (dmg) return { name: dmg.name, downloadUrl: dmg.browser_download_url || dmg.downloadUrl };
    const pkg = pool.find((a) => a.name.toLowerCase().endsWith('.pkg'));
    if (pkg) return { name: pkg.name, downloadUrl: pkg.browser_download_url || pkg.downloadUrl };
  } else if (p === 'ios') {
    const ipa = pool.find((a) => a.name.toLowerCase().endsWith('.ipa'));
    if (ipa) return { name: ipa.name, downloadUrl: ipa.browser_download_url || ipa.downloadUrl };
  }

  const defaultBest = pool.find((a) => isBinaryPackage(a.name));
  if (defaultBest) return { name: defaultBest.name, downloadUrl: defaultBest.browser_download_url || defaultBest.downloadUrl };
  return null;
}

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

function parseContentDispositionFileName(disposition?: string | null): string {
  if (!disposition || typeof disposition !== 'string') return '';
  const utf8Match = disposition.match(/filename\*\s*=\s*(?:UTF-8''|utf-8'')([^;\r\n]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim().replace(/^["']|["']$/g, ''));
    } catch {
      return utf8Match[1].trim().replace(/^["']|["']$/g, '');
    }
  }
  const plainMatch = disposition.match(/filename\s*=\s*"([^"]+)"/i) || disposition.match(/filename\s*=\s*([^;\r\n]+)/i);
  if (plainMatch?.[1]) {
    try {
      return decodeURIComponent(plainMatch[1].trim().replace(/^["']|["']$/g, ''));
    } catch {
      return plainMatch[1].trim().replace(/^["']|["']$/g, '');
    }
  }
  return '';
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
    const rawUrl = ((req.query?.url as string) || '').trim();
    const customName = ((req.query?.name as string) || '').trim();
    const platform = ((req.query?.platform as string) || '').trim().toLowerCase();

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
        error: 'Source code archives, repositories, and CI pipeline paths cannot be downloaded as executable packages.',
      });
    }

    let targetBinaryUrl = rawUrl;
    let resolvedExactAssetName = '';

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
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'PropleStore/1.0',
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

    if (!isSafePublicUrl(targetBinaryUrl, false)) {
      return res.status(403).end();
    }

    const { res: upstreamRes, finalUrl } = await safeFetchWithRedirectCheck(
      targetBinaryUrl,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: '*/*',
        },
      },
      5
    );

    if (!upstreamRes.ok || !upstreamRes.body) {
      return res.status(204).end();
    }

    const dispositionName = parseContentDispositionFileName(upstreamRes.headers.get('content-disposition'));
    let safeFileName =
      resolvedExactAssetName ||
      (dispositionName && isBinaryPackage(dispositionName) ? dispositionName : '') ||
      extractExactFileName(targetBinaryUrl, customName) ||
      extractExactFileName(finalUrl, customName);

    if (!safeFileName && dispositionName && !isBloatOrSecondaryAsset(dispositionName)) {
      safeFileName = dispositionName;
    }
    if (!safeFileName) {
      try {
        await upstreamRes.body.cancel();
      } catch {}
      return res.status(204).end();
    }

    const cleanSafeName = safeFileName.replace(/["\r\n]/g, '');
    const lowerName = cleanSafeName.toLowerCase();
    const upstreamContentType = (upstreamRes.headers.get('content-type') || '').toLowerCase();

    if (
      upstreamContentType.includes('text/html') ||
      upstreamContentType.includes('application/json') ||
      upstreamContentType.includes('text/plain')
    ) {
      try {
        await upstreamRes.body.cancel();
      } catch {}
      return res.status(204).end();
    }

    try {
      if (upstreamRes.body) {
        await upstreamRes.body.cancel();
      }
    } catch {}

    // Universal Zero-Byte Directory Pointer Mode:
    // Prople Store operates strictly as an intermediary directory pointer under safe harbor provisions.
    // Zero binary bytes are buffered, stored, or streamed through this server.
    // Clients receive an immediate 302 Found redirect directly to the verified upstream binary host (GitHub, Cloudflare R2, AWS S3, CDN, or VPS)
    // with no-referrer to protect user privacy.
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Referrer-Policy', 'no-referrer');
    return res.redirect(302, finalUrl || targetBinaryUrl);
  } catch {
    if (!res.headersSent) {
      return res.status(204).end();
    }
  }
}
