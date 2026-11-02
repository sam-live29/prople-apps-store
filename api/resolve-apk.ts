import crypto from 'crypto';

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

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0 || !Number.isFinite(bytes)) return '';
  const gb = 1024 * 1024 * 1024;
  const mb = 1024 * 1024;
  const kb = 1024;
  if (bytes >= gb) return `${(bytes / gb).toFixed(2)} GB`;
  if (bytes >= mb) return `${(bytes / mb).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / kb))} KB`;
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

function detectStorageProvider(urlStr: string): string {
  try {
    const host = new URL(urlStr).hostname.toLowerCase();
    if (host.endsWith('.r2.dev') || host.endsWith('.r2.cloudflarestorage.com')) return 'Cloudflare R2';
    if (host.endsWith('.amazonaws.com')) return 'AWS S3';
    if (host.endsWith('.cloudfront.net')) return 'AWS CloudFront';
    if (host.endsWith('.digitaloceanspaces.com')) return 'DigitalOcean Spaces';
    if (host.endsWith('.backblazeb2.com')) return 'Backblaze B2';
    if (host.endsWith('.b-cdn.net')) return 'Bunny CDN';
    if (host.endsWith('.wasabisys.com')) return 'Wasabi Cloud';
    if (host.endsWith('.firebasestorage.app') || host.endsWith('.googleapis.com')) return 'Cloud Storage';
    if (host.includes('github.com') || host.includes('githubusercontent.com')) return 'GitHub Release';
    return `Direct Storage (${host})`;
  } catch {
    return 'Direct Storage';
  }
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

function isSafePublicProbeUrl(candidateUrl: string): boolean {
  if (!candidateUrl || typeof candidateUrl !== 'string') return false;
  let parsed: URL;
  try {
    parsed = new URL(candidateUrl.trim());
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
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname === '[::1]' ||
    hostname === '169.254.169.254' ||
    hostname === 'metadata.google.internal' ||
    hostname.startsWith('[') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.lan') ||
    hostname.endsWith('.localhost') ||
    hostname.includes('127.0.0.1') ||
    hostname.includes('169.254.') ||
    hostname.includes('192.168.')
  ) {
    return false;
  }
  const parts = hostname.split('.');
  if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
    const nums = parts.map((p) => parseInt(p, 10));
    if (nums.every((n) => n >= 0 && n <= 255) && isReservedIpv4(nums[0], nums[1], nums[2], nums[3])) {
      return false;
    }
  }
  return true;
}

function inferBinaryDetails(nameOrUrl: string, requestedPlatform?: string) {
  const lowerClean = (nameOrUrl || '').toLowerCase().split('?')[0].split('#')[0];
  const base = lowerClean.split('/').pop() || lowerClean;
  if (isBloatPackage(base)) {
    return { isBinary: false, isApk: false, isIos: false, isWindows: false, isLinux: false, isMac: false, platform: requestedPlatform || 'android', format: 'apk' };
  }
  const isDirectApk = base.endsWith('.apk') || base.endsWith('.aab');
  const isDirectIpa = base.endsWith('.ipa');
  const isDirectWin = base.endsWith('.exe') || base.endsWith('.msi') || base.endsWith('.msix') || base.endsWith('.msixbundle') || base.endsWith('.appx') || base.endsWith('.appxbundle');
  const isDirectLin = base.endsWith('.appimage') || base.endsWith('.deb') || base.endsWith('.rpm') || base.endsWith('.tar.gz') || base.endsWith('.tgz') || base.endsWith('.tar.xz') || base.endsWith('.tar.zst') || base.endsWith('.snap') || base.endsWith('.flatpak') || base.endsWith('.run') || base.endsWith('.bin');
  const isDirectMac = base.endsWith('.dmg') || (base.endsWith('.pkg') && !base.includes('.pkg.tar.'));
  const isArchivePkg = base.endsWith('.zip') || base.endsWith('.7z') || base.endsWith('.rar');

  const isBinary = isDirectApk || isDirectIpa || isDirectWin || isDirectLin || isDirectMac || isArchivePkg;
  let platform = requestedPlatform || 'android';
  let format = 'apk';

  if (isDirectIpa) {
    platform = 'ios';
    format = 'ipa';
  } else if (isDirectMac) {
    platform = 'mac';
    format = base.endsWith('.pkg') ? 'pkg' : 'dmg';
  } else if (isDirectLin) {
    platform = 'linux';
    format = base.endsWith('.deb') ? 'deb' : base.endsWith('.rpm') ? 'rpm' : (base.endsWith('.tar.gz') || base.endsWith('.tgz')) ? 'tar.gz' : 'AppImage';
  } else if (isDirectWin) {
    platform = 'windows';
    format = base.endsWith('.msi') ? 'msi' : base.endsWith('.msix') ? 'msix' : 'exe';
  } else if (isDirectApk) {
    platform = 'android';
    format = base.endsWith('.aab') ? 'aab' : 'apk';
  } else if (isArchivePkg) {
    platform = requestedPlatform || (base.includes('mac') || base.includes('darwin') ? 'mac' : base.includes('linux') ? 'linux' : 'windows');
    format = base.endsWith('.7z') ? '7z' : base.endsWith('.rar') ? 'rar' : 'zip';
  }

  return {
    isBinary,
    isApk: platform === 'android' && isBinary,
    isIos: platform === 'ios' && isBinary,
    isWindows: platform === 'windows' && isBinary,
    isLinux: platform === 'linux' && isBinary,
    isMac: platform === 'mac' && isBinary,
    platform,
    format,
  };
}

async function probeDirectBinaryUrl(initialUrl: string): Promise<{
  reachable: boolean;
  finalUrl: string;
  size: number;
  dispositionFileName: string;
  contentType: string;
  headers?: any;
}> {
  let currentUrl = initialUrl;
  const fetchHeaders: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PropleStore/1.0',
    Accept: '*/*',
  };

  const followSafe = async (method: 'HEAD' | 'GET', extraHeaders?: Record<string, string>) => {
    let url = currentUrl;
    for (let hop = 0; hop <= 5; hop++) {
      if (!isSafePublicProbeUrl(url)) throw new Error('Unsafe target URL');
      const resp = await fetch(url, {
        method,
        headers: { ...fetchHeaders, ...(extraHeaders || {}) },
        redirect: 'manual',
        signal: AbortSignal.timeout(3500),
      });
      if ([301, 302, 303, 307, 308].includes(resp.status)) {
        const loc = resp.headers.get('location');
        if (!loc) return { resp, url };
        const next = new URL(loc, url).toString();
        if (url.startsWith('https:') && next.startsWith('http:')) throw new Error('HTTPS downgrade blocked');
        url = next;
        continue;
      }
      return { resp, url };
    }
    throw new Error('Too many redirects');
  };

  try {
    let { resp, url: resolvedFinal } = await followSafe('HEAD');
    let totalSize = 0;
    const cl = resp.headers.get('content-length');
    if (cl) totalSize = parseInt(cl, 10) || 0;

    // Many S3/R2 presigned URLs or custom VPS servers disallow HEAD (403/405/501) or omit Content-Length on HEAD
    if (!resp.ok || totalSize <= 0) {
      try {
        const rangeAttempt = await followSafe('GET', { Range: 'bytes=0-0' });
        if (rangeAttempt.resp.ok || rangeAttempt.resp.status === 206) {
          resp = rangeAttempt.resp;
          resolvedFinal = rangeAttempt.url;
          const contentRange = resp.headers.get('content-range');
          if (contentRange) {
            const totalMatch = contentRange.match(/\/(\d+)\s*$/);
            if (totalMatch?.[1]) {
              totalSize = parseInt(totalMatch[1], 10) || 0;
            }
          }
          if (totalSize <= 0) {
            const getCl = resp.headers.get('content-length');
            if (getCl) {
              const parsed = parseInt(getCl, 10) || 0;
              if (resp.status === 200 && parsed > 1) totalSize = parsed;
            }
          }
        }
        try {
          await rangeAttempt.resp.body?.cancel();
        } catch {}
      } catch {}
    }

    const dispositionFileName = parseContentDispositionFileName(resp.headers.get('content-disposition'));
    const contentType = (resp.headers.get('content-type') || '').toLowerCase();
    return {
      reachable: resp.ok || resp.status === 206,
      finalUrl: resolvedFinal,
      size: totalSize,
      dispositionFileName,
      contentType,
      headers: resp.headers,
    };
  } catch {
    return {
      reachable: false,
      finalUrl: initialUrl,
      size: 0,
      dispositionFileName: '',
      contentType: '',
      headers: undefined,
    };
  }
}

async function computeCloudSha256(
  binaryUrl: string,
  headers?: any,
  binaryName?: string,
  releaseNotes?: string
): Promise<string> {
  if (!binaryUrl) return '';
  // 1. Cloud storage checksum headers (AWS S3, Cloudflare R2, Digest RFC 3230)
  if (headers && typeof headers.get === 'function') {
    const amzSha = headers.get('x-amz-checksum-sha256');
    if (amzSha) {
      try {
        const buf = Buffer.from(amzSha.trim(), 'base64');
        if (buf.length === 32) return buf.toString('hex').toLowerCase();
      } catch {}
    }
    const metaSha = headers.get('x-amz-meta-sha256') || headers.get('x-checksum-sha256');
    if (metaSha && /^[a-fA-F0-9]{64}$/.test(metaSha.trim())) {
      return metaSha.trim().toLowerCase();
    }
    const digest = headers.get('digest');
    if (digest) {
      const match = digest.match(/sha-256=([^,;\s]+)/i);
      if (match?.[1]) {
        try {
          const buf = Buffer.from(match[1].trim(), 'base64');
          if (buf.length === 32) return buf.toString('hex').toLowerCase();
        } catch {}
        if (/^[a-fA-F0-9]{64}$/.test(match[1].trim())) {
          return match[1].trim().toLowerCase();
        }
      }
    }
  }

  // 2. Release notes match if provided
  if (releaseNotes) {
    if (binaryName) {
      const cleanName = binaryName.trim().toLowerCase();
      for (const line of releaseNotes.split(/\r?\n/)) {
        if (line.toLowerCase().includes(cleanName)) {
          const m = line.match(/\b([a-fA-F0-9]{64})\b/);
          if (m) return m[1].toLowerCase();
        }
      }
    }
    const labeled = releaseNotes.match(/(?:sha[-_]?256|checksum|sha2)\s*[:=]\s*[`"']?([a-fA-F0-9]{64})[`"']?/i);
    if (labeled) return labeled[1].toLowerCase();
  }

  // 3. Sidecar file probe (${binaryUrl}.sha256)
  try {
    const sidecarCandidate = `${binaryUrl.split('?')[0]}.sha256`;
    const scRes = await fetch(sidecarCandidate, {
      signal: AbortSignal.timeout(2500),
      headers: { 'User-Agent': 'PropleStore-SHA-Verifier/1.0' },
    });
    if (scRes.ok) {
      const scText = await scRes.text();
      const match = scText.match(/\b([a-fA-F0-9]{64})\b/);
      if (match) return match[1].toLowerCase();
    }
  } catch {}

  // 4. Ephemeral In-Memory Streaming Hash (discards chunks immediately, 0 disk storage)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const streamRes = await fetch(binaryUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PropleStore-SHA-Verifier/1.0',
        Accept: '*/*',
      },
    });
    if (streamRes.ok && streamRes.body) {
      const len = streamRes.headers.get('content-length');
      const parsedLen = len ? parseInt(len, 10) : 0;
      if (!len || parsedLen <= 150 * 1024 * 1024) {
        const hash = crypto.createHash('sha256');
        const reader = (streamRes.body as ReadableStream<Uint8Array>).getReader();
        let total = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            total += value.length;
            if (total > 150 * 1024 * 1024) {
              try {
                await reader.cancel();
              } catch {}
              break;
            }
            hash.update(Buffer.from(value));
          }
        }
        clearTimeout(timeout);
        return hash.digest('hex').toLowerCase();
      } else {
        try {
          await streamRes.body.cancel();
        } catch {}
      }
    }
    clearTimeout(timeout);
  } catch {}

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
    const platform = ((req.query?.platform as string) || '').trim().toLowerCase();

    if (!rawUrl) {
      return res.status(400).json({ success: false, error: 'Missing url parameter.' });
    }

    const cleanUrl = rawUrl.startsWith('http://') || rawUrl.startsWith('https://') ? rawUrl : `https://${rawUrl}`;
    const lowerPath = cleanUrl.toLowerCase().split('?')[0];
    const isGitHubRepoOrReleaseWebpage =
      lowerPath.includes('github.com') &&
      !lowerPath.includes('/releases/download/') &&
      !lowerPath.includes('/raw/');

    // Direct storage / cloud CDN / VPS / R2 / S3 / direct GitHub release binary URL
    if (!isGitHubRepoOrReleaseWebpage) {
      if (!isSafePublicProbeUrl(cleanUrl)) {
        return res.status(403).json({ success: false, error: 'Destination URL is restricted by security policy.' });
      }

      const initialDetails = inferBinaryDetails(cleanUrl, platform);
      const probed = await probeDirectBinaryUrl(cleanUrl);

      const urlFileName = decodeURIComponent(cleanUrl.split('?')[0].split('#')[0].split('/').pop() || '').trim();
      const redirectedFileName = decodeURIComponent(probed.finalUrl.split('?')[0].split('#')[0].split('/').pop() || '').trim();
      const bestCandidateName =
        (probed.dispositionFileName && inferBinaryDetails(probed.dispositionFileName, platform).isBinary ? probed.dispositionFileName : '') ||
        (initialDetails.isBinary ? urlFileName : '') ||
        (inferBinaryDetails(redirectedFileName, platform).isBinary ? redirectedFileName : '') ||
        probed.dispositionFileName ||
        urlFileName;

      const finalDetails = inferBinaryDetails(bestCandidateName || probed.finalUrl || cleanUrl, platform);
      const isHtmlOrJson =
        probed.contentType.includes('text/html') ||
        probed.contentType.includes('application/json') ||
        probed.contentType.includes('text/plain');

      if ((finalDetails.isBinary && !isHtmlOrJson) || (probed.reachable && !isHtmlOrJson && probed.size >= 1024 * 1024)) {
        const storageProvider = detectStorageProvider(cleanUrl);
        const sha256 = await computeCloudSha256(cleanUrl, probed.headers, bestCandidateName);
        return res.status(200).json({
          success: true,
          isBinary: true,
          isApk: finalDetails.isApk,
          isIos: finalDetails.isIos,
          isWindows: finalDetails.isWindows,
          isLinux: finalDetails.isLinux,
          isMac: finalDetails.isMac,
          platform: finalDetails.platform,
          format: finalDetails.format,
          resolvedUrl: cleanUrl,
          assetName: bestCandidateName,
          size: probed.size || undefined,
          sizeFormatted: formatBytes(probed.size) || undefined,
          sha256: sha256 || undefined,
          storageProvider,
          source: cleanUrl.includes('github.com') ? 'direct_binary' : 'direct_storage',
        });
      }

      return res.status(200).json({
        success: true,
        isBinary: false,
        isApk: false,
        resolvedUrl: '',
        source: 'external_url',
      });
    }

    const match = cleanUrl.match(/github\.com\/([^/]+)\/([^/]+)/i);
    if (!match) {
      return res.status(200).json({
        success: true,
        isBinary: false,
        isApk: false,
        resolvedUrl: '',
        source: 'external_url',
      });
    }

    const owner = sanitizeIdentifier(match[1]);
    const repo = sanitizeIdentifier(match[2].replace(/\.git$/i, ''));
    if (!owner || !repo) {
      return res.status(400).json({ success: false, error: 'Invalid repository identifier' });
    }

    const ghHeaders: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'PropleStore',
    };
    if (process.env.GITHUB_TOKEN) {
      ghHeaders['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
    const ghRes = await fetch(apiUrl, { headers: ghHeaders });

    if (ghRes.ok) {
      const release = await ghRes.json();
      if (Array.isArray(release.assets)) {
        const best = pickMainAsset(release.assets, platform);
        if (best?.browser_download_url) {
          const details = inferBinaryDetails(best.name || '', platform);
          let sha256 = '';
          if (typeof best.digest === 'string' && best.digest.toLowerCase().startsWith('sha256:')) {
            sha256 = best.digest.slice(7).toLowerCase();
          }
          if (!sha256) {
            sha256 = await computeCloudSha256(best.browser_download_url, undefined, best.name, release.body);
          }
          return res.status(200).json({
            success: true,
            isBinary: true,
            isApk: details.isApk,
            isIos: details.isIos,
            isWindows: details.isWindows,
            isLinux: details.isLinux,
            isMac: details.isMac,
            platform: details.platform,
            format: details.format,
            resolvedUrl: best.browser_download_url,
            assetName: best.name,
            size: best.size,
            sizeFormatted: formatBytes(best.size) || undefined,
            sha256: sha256 || undefined,
            tagName: release.tag_name,
            storageProvider: 'GitHub Release',
            source: 'github_release_asset',
          });
        }
      }
    }

    // Fallback: search releases list
    const listRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=5`, {
      headers: ghHeaders,
    });

    if (listRes.ok) {
      const releases = await listRes.json();
      if (Array.isArray(releases)) {
        for (const rel of releases) {
          if (Array.isArray(rel.assets)) {
            const best = pickMainAsset(rel.assets, platform);
            if (best?.browser_download_url) {
              const details = inferBinaryDetails(best.name || '', platform);
              let sha256 = '';
              if (typeof best.digest === 'string' && best.digest.toLowerCase().startsWith('sha256:')) {
                sha256 = best.digest.slice(7).toLowerCase();
              }
              if (!sha256) {
                sha256 = await computeCloudSha256(best.browser_download_url, undefined, best.name, rel.body);
              }
              return res.status(200).json({
                success: true,
                isBinary: true,
                isApk: details.isApk,
                isIos: details.isIos,
                isWindows: details.isWindows,
                isLinux: details.isLinux,
                isMac: details.isMac,
                platform: details.platform,
                format: details.format,
                resolvedUrl: best.browser_download_url,
                assetName: best.name,
                size: best.size,
                sizeFormatted: formatBytes(best.size) || undefined,
                sha256: sha256 || undefined,
                tagName: rel.tag_name,
                storageProvider: 'GitHub Release',
                source: 'github_release_asset',
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
      source: 'fallback_repo',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
