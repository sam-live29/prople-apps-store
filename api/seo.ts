import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const BASE_URL = 'https://www.prople.co.in';

let memoryAppsCache: any[] = [];
let lastCacheFetch = 0;
const CACHE_TTL_MS = 60 * 1000;

let cachedProductionTemplate: string | null = null;

interface FirebaseServerConfig {
  projectId: string;
  firestoreDatabaseId: string;
  isExampleConfig: boolean;
}

function getSafeModuleDir(): string | null {
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return null;
  }
}

function getServerFirebaseConfig(): FirebaseServerConfig {
  let fileConfig: any = {};
  try {
    const candidateConfigPaths = [
      path.join(process.cwd(), 'firebase-applet-config.json'),
    ];
    const modDir = getSafeModuleDir();
    if (modDir) {
      candidateConfigPaths.push(path.join(modDir, '..', 'firebase-applet-config.json'));
    }
    for (const p of candidateConfigPaths) {
      if (fs.existsSync(p)) {
        fileConfig = JSON.parse(fs.readFileSync(p, 'utf-8'));
        break;
      }
    }
  } catch {}

  const isReal = (val?: string) =>
    Boolean(
      val &&
      typeof val === 'string' &&
      val.trim().length > 0 &&
      !val.includes('example') &&
      !val.includes('Placeholder') &&
      !val.includes('0000000000')
    );

  const apiKey = process.env.FIREBASE_API_KEY || (isReal(fileConfig.apiKey) ? fileConfig.apiKey : '');
  const projectId = process.env.FIREBASE_PROJECT_ID || (isReal(fileConfig.projectId) ? fileConfig.projectId : '');
  const firestoreDatabaseId =
    process.env.FIRESTORE_DATABASE_ID ||
    process.env.FIREBASE_DATABASE_ID ||
    (isReal(fileConfig.firestoreDatabaseId) ? fileConfig.firestoreDatabaseId : '(default)');

  const isExampleConfig = !isReal(apiKey) || !isReal(projectId);

  return {
    projectId: projectId || 'example-prople-store',
    firestoreDatabaseId: firestoreDatabaseId || '(default)',
    isExampleConfig,
  };
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeJsonLd(data: unknown): string {
  return JSON.stringify(data, null, 2)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

function slugifyAppName(name: string): string {
  return (name || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function resolveAbsoluteImageUrl(url: string | undefined, baseUrl: string, fallback = '/logo.png'): string {
  const img = (url || '').trim();
  if (!img) return `${baseUrl}${fallback}`;
  if (img.startsWith('data:') || img.startsWith('blob:')) return img;
  if (img.startsWith('//')) return `https:${img}`;
  if (img.startsWith('/')) return `${baseUrl}${img}`;
  if (img.startsWith('http://') || img.startsWith('https://')) return img;
  return `${baseUrl}/${img}`;
}

function resolveSocialShareImageUrl(url: string | undefined, baseUrl: string, fallback = '/logo.png'): string {
  const img = (url || '').trim();
  if (!img || img.startsWith('data:') || img.startsWith('blob:')) return `${baseUrl}${fallback}`;
  if (img.startsWith('//')) return `https:${img}`;
  if (img.startsWith('/')) return `${baseUrl}${img}`;
  if (img.startsWith('http://') || img.startsWith('https://')) return img;
  return `${baseUrl}/${img}`;
}

function isCrawlerUserAgent(uaRaw?: string): boolean {
  if (!uaRaw) return false;
  const ua = uaRaw.toLowerCase();
  return (
    ua.includes('bot') ||
    ua.includes('crawler') ||
    ua.includes('spider') ||
    ua.includes('whatsapp') ||
    ua.includes('facebookexternalhit') ||
    ua.includes('twitterbot') ||
    ua.includes('telegrambot') ||
    ua.includes('discordbot') ||
    ua.includes('slackbot') ||
    ua.includes('linkedinbot') ||
    ua.includes('embedly') ||
    ua.includes('quora link preview') ||
    ua.includes('pinterest') ||
    ua.includes('applebot') ||
    ua.includes('curl/') ||
    ua.includes('wget/')
  );
}

function cleanAndInjectHtml(html: string, headInject: string, bodyContent?: string): string {
  let result = html;

  result = result.replace(/<title>[\s\S]*?<\/title>/gi, '');
  result = result.replace(/<meta\s+name=["']description["'][\s\S]*?>/gi, '');
  result = result.replace(/<meta\s+name=["']keywords["'][\s\S]*?>/gi, '');
  result = result.replace(/<meta\s+property=["']og:[^"']+["'][\s\S]*?>/gi, '');
  result = result.replace(/<meta\s+name=["']twitter:[^"']+["'][\s\S]*?>/gi, '');
  result = result.replace(/<link\s+rel=["']canonical["'][\s\S]*?>/gi, '');

  if (result.includes('</head>')) {
    result = result.replace('</head>', `${headInject}\n</head>`);
  } else {
    result = `${headInject}\n${result}`;
  }

  if (bodyContent) {
    const rootStart = result.indexOf('<div id="root"');
    if (rootStart !== -1) {
      const bodyEnd = result.indexOf('</body>', rootStart);
      const searchLimit = bodyEnd !== -1 ? bodyEnd : result.length;
      const scriptStart = result.indexOf('<script', rootStart);
      let lastDivClose = -1;
      if (scriptStart !== -1 && scriptStart < searchLimit) {
        lastDivClose = result.slice(0, scriptStart).lastIndexOf('</div>');
      } else if (bodyEnd !== -1) {
        lastDivClose = result.slice(0, bodyEnd).lastIndexOf('</div>');
      }

      if (lastDivClose > rootStart) {
        result =
          result.slice(0, rootStart) +
          `<div id="root" style="background-color: inherit; min-height: 100%; width: 100%;">${bodyContent}</div>` +
          result.slice(lastDivClose + 6);
      } else if (result.includes('<div id="root"></div>')) {
        result = result.replace(
          '<div id="root"></div>',
          `<div id="root" style="background-color: inherit; min-height: 100%; width: 100%;">${bodyContent}</div>`
        );
      }
    }
  }

  return result;
}

function injectAppSeoIntoHtml(html: string, app: any, baseUrl: string, injectSsrBody: boolean): string {
  const name = escapeHtml(app.name || 'Application');
  const canonicalSlug = app.slug || slugifyAppName(app.name) || app.id;
  const platform = escapeHtml((app.platform || 'Android').toUpperCase());
  const category = escapeHtml(app.category || 'Tools');
  const categorySlug = slugifyAppName(app.category || 'tools');
  const developer = escapeHtml(app.developer || 'Verified Publisher');
  const developerSlug = slugifyAppName(app.developer || 'developer');

  const rawDesc = (app.description || app.tagline || app.shortDescription || `${app.name} on Prople Store`).trim();
  const description = escapeHtml(rawDesc.slice(0, 200).replace(/[\r\n]+/g, ' '));
  const fullDescription = escapeHtml(rawDesc);

  const iconUrl = resolveAbsoluteImageUrl(app.iconUrl, baseUrl, '/logo.png');
  const socialShareIconUrl = resolveSocialShareImageUrl(app.iconUrl, baseUrl, '/logo.png');
  const socialFeatureGraphicUrl = app.featureGraphicUrl
    ? resolveSocialShareImageUrl(app.featureGraphicUrl, baseUrl, '/logo.png')
    : socialShareIconUrl;
  const canonicalUrl = `${baseUrl}/apps/${encodeURIComponent(canonicalSlug)}`;

  const exactAsset = app.assetName || `${slugifyAppName(app.name)}.${(app.packageFormat || 'apk').toLowerCase()}`;
  const safeDownloadHref = app.downloadUrl
    ? `/api/download-apk?url=${encodeURIComponent(app.downloadUrl)}&name=${encodeURIComponent(exactAsset)}&platform=${encodeURIComponent(app.platform || 'android')}`
    : canonicalUrl;

  const ratingVal = app.rating ? Number(app.rating) : null;
  const reviewsCountVal = app.reviewsCount
    ? typeof app.reviewsCount === 'number'
      ? app.reviewsCount
      : parseInt(String(app.reviewsCount), 10) || null
    : null;
  const downloads = escapeHtml(app.downloads || (app.downloadsCount ? `${app.downloadsCount}+` : 'Verified'));
  const version = escapeHtml(app.versionName || '1.0.0');
  const pkgFormat = escapeHtml(app.packageFormat || 'APK').toUpperCase();
  const pageTitle = `${name} — Download & Software Details | Prople Store`;

  const softwareAppJsonLd: any = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: app.name,
    description: rawDesc,
    applicationCategory: app.category || 'Tools',
    operatingSystem: app.platform || 'Android, iOS, iPadOS, macOS, Linux, Windows, Web Browser',
    url: canonicalUrl,
    downloadUrl: safeDownloadHref,
    image: socialShareIconUrl,
    screenshot: socialFeatureGraphicUrl,
    softwareVersion: version,
    offers: {
      '@type': 'Offer',
      price: '0.00',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Cloaktail Industries',
      url: baseUrl,
    },
    author: {
      '@type': 'Organization',
      name: app.developer || 'Verified Publisher',
      url: `${baseUrl}/developers/${encodeURIComponent(developerSlug)}`,
    },
  };

  if (ratingVal && ratingVal > 0 && reviewsCountVal && reviewsCountVal > 0) {
    softwareAppJsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: ratingVal.toFixed(1),
      ratingCount: reviewsCountVal,
      bestRating: '5',
      worstRating: '1',
    };
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Prople Store', item: `${baseUrl}/` },
      { '@type': 'ListItem', position: 2, name: 'Apps', item: `${baseUrl}/apps` },
      { '@type': 'ListItem', position: 3, name: app.category || 'Tools', item: `${baseUrl}/categories/${encodeURIComponent(categorySlug)}` },
      { '@type': 'ListItem', position: 4, name: app.name, item: canonicalUrl },
    ],
  };

  const hydrationJson = JSON.stringify(app).replace(/</g, '\\u003c');

  const headInject = `
    <title>${pageTitle}</title>
    <meta name="description" content="${description}" />
    <meta name="keywords" content="${name}, ${name} download, ${category} app, ${platform} application, free download, verified installer, prople store" />
    <meta name="author" content="${developer}" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Prople Store" />
    <meta property="og:title" content="${pageTitle}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${socialShareIconUrl}" />
    <meta property="og:image:secure_url" content="${socialShareIconUrl}" />
    <meta property="og:image:alt" content="${name} Icon" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:site" content="@PropleStore" />
    <meta name="twitter:title" content="${pageTitle}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${socialShareIconUrl}" />
    <script type="application/ld+json">
    ${safeJsonLd(softwareAppJsonLd)}
    </script>
    <script type="application/ld+json">
    ${safeJsonLd(breadcrumbJsonLd)}
    </script>
    <script id="prople-initial-app" type="application/json">${hydrationJson}</script>
  `;

  if (!injectSsrBody) {
    return cleanAndInjectHtml(html, headInject);
  }

  const preRenderedAppShell = `
    <div style="min-height: 100vh; background: #131314; color: #e3e3e3; font-family: 'Google Sans', Roboto, sans-serif;">
      <main id="prople-ssr-app" style="max-width: 960px; margin: 0 auto; padding: 24px 16px 80px;">
        <header style="display: flex; gap: 20px; align-items: flex-start; margin-bottom: 24px;">
          <img src="${iconUrl}" alt="${name} App Icon" width="108" height="108" style="border-radius: 24px; object-fit: cover; background: #1e1f22; flex-shrink: 0;" />
          <div style="flex: 1; min-width: 0;">
            <h1 style="font-size: 26px; font-weight: 700; color: #f3f4f6; margin: 0 0 6px;">${name}</h1>
            <p style="margin: 0 0 10px; font-size: 14px; color: #9aa0a6;">${developer} &bull; ${category}</p>
            <div style="display: flex; align-items: center; gap: 12px; font-size: 13px; color: #cbd5e1; flex-wrap: wrap;">
              <span>${downloads} Downloads</span>
              <span>&bull;</span>
              <span>${pkgFormat}</span>
            </div>
          </div>
        </header>
        <section style="margin-bottom: 28px;">
          <a href="${escapeHtml(safeDownloadHref)}" id="ssr-install-btn" style="display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 32px; background: #0b57d0; color: #ffffff; font-weight: 600; font-size: 15px; border-radius: 9999px; text-decoration: none;" download="${escapeHtml(exactAsset)}">
            Install ${name} (${pkgFormat})
          </a>
        </section>
        <article style="margin: 28px 0; padding: 20px; background: #1e1f22; border-radius: 16px;">
          <h2 style="font-size: 18px; font-weight: 600; color: #f3f4f6; margin-top: 0; margin-bottom: 12px;">About this application</h2>
          <div style="font-size: 14px; line-height: 1.65; color: #cbd5e1; white-space: pre-wrap;">${fullDescription}</div>
        </article>
      </main>
    </div>
  `;

  return cleanAndInjectHtml(html, headInject, preRenderedAppShell);
}

function injectCollectionSeoIntoHtml(
  html: string,
  titleStr: string,
  descStr: string,
  canonicalUrl: string,
  baseUrl: string
): string {
  const title = escapeHtml(titleStr);
  const desc = escapeHtml(descStr);
  const headInject = `
    <title>${title}</title>
    <meta name="description" content="${desc}" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Prople Store" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:image" content="${baseUrl}/logo.png" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${desc}" />
    <meta name="twitter:image" content="${baseUrl}/logo.png" />
  `;
  return cleanAndInjectHtml(html, headInject);
}

function parseFirestoreField(val: any): any {
  if (!val || typeof val !== 'object') return undefined;
  if (val.stringValue !== undefined) return val.stringValue;
  if (val.integerValue !== undefined) return parseInt(val.integerValue, 10);
  if (val.doubleValue !== undefined) return parseFloat(val.doubleValue);
  if (val.booleanValue !== undefined) return val.booleanValue;
  if (val.timestampValue !== undefined) return val.timestampValue;
  if (val.nullValue !== undefined) return null;
  if (val.arrayValue !== undefined) {
    return (val.arrayValue.values || []).map((v: any) => parseFirestoreField(v));
  }
  if (val.mapValue !== undefined) {
    const obj: Record<string, any> = {};
    for (const [k, v] of Object.entries<any>(val.mapValue.fields || {})) {
      obj[k] = parseFirestoreField(v);
    }
    return obj;
  }
  return undefined;
}

function parseFirestoreDoc(doc: any): any {
  if (!doc || !doc.fields) return null;
  const id = doc.name ? doc.name.split('/').pop() : '';
  const fields = doc.fields || {};
  const parsed: any = { id };
  if (doc.createTime) parsed.createdAt = doc.createTime;
  if (doc.updateTime) parsed.updatedAt = doc.updateTime;
  for (const [key, val] of Object.entries<any>(fields)) {
    const fieldVal = parseFirestoreField(val);
    if (fieldVal !== undefined) parsed[key] = fieldVal;
  }
  return parsed;
}

async function fetchAllPublishedApps(): Promise<any[]> {
  const now = Date.now();
  if (memoryAppsCache.length > 0 && now - lastCacheFetch < CACHE_TTL_MS) {
    return memoryAppsCache;
  }

  try {
    const fbConfig = getServerFirebaseConfig();
    if (fbConfig.isExampleConfig || !fbConfig.projectId) {
      return memoryAppsCache;
    }

    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${fbConfig.projectId}/databases/${fbConfig.firestoreDatabaseId}/documents/apps?pageSize=250`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(firestoreUrl, { signal: controller.signal }).catch(() => null);
    clearTimeout(timeout);

    if (res && res.ok) {
      const data = await res.json().catch(() => null);
      if (data && Array.isArray(data.documents)) {
        const apps = data.documents.map(parseFirestoreDoc).filter(Boolean);
        const publishedApps = apps.filter((a: any) => a && a.isPublished !== false);
        if (publishedApps.length > 0) {
          memoryAppsCache = publishedApps;
          lastCacheFetch = now;
          return publishedApps;
        }
      }
    }
  } catch (err: any) {
    console.warn('[Vercel SEO] Fast REST fetch notice:', err?.message || err);
  }

  return memoryAppsCache;
}

async function fetchSingleAppDirect(appIdOrSlug: string): Promise<any | null> {
  try {
    const fbConfig = getServerFirebaseConfig();
    if (fbConfig.isExampleConfig || !fbConfig.projectId || !appIdOrSlug) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1800);

    const docUrl = `https://firestore.googleapis.com/v1/projects/${fbConfig.projectId}/databases/${fbConfig.firestoreDatabaseId}/documents/apps/${encodeURIComponent(appIdOrSlug)}`;
    const res = await fetch(docUrl, { signal: controller.signal }).catch(() => null);
    clearTimeout(timeout);

    if (res && res.ok) {
      const docData = await res.json().catch(() => null);
      const app = parseFirestoreDoc(docData);
      if (app && app.isPublished !== false) {
        return app;
      }
    }
  } catch {}
  return null;
}

async function getBaseTemplate(proto: string, host: string): Promise<string> {
  if (cachedProductionTemplate) {
    return cachedProductionTemplate;
  }

  const isLocalHost = host.includes('localhost') || host.includes('127.0.0.1');
  const modDir = getSafeModuleDir();

  // 1. Prefer compiled Vite production HTML from disk (dist/index.html or server/index.built.html)
  const builtCandidatePaths = [
    path.join(process.cwd(), 'dist', 'index.html'),
    path.join(process.cwd(), 'server', 'index.built.html'),
    ...(modDir
      ? [
          path.join(modDir, '..', 'dist', 'index.html'),
          path.join(modDir, '..', 'server', 'index.built.html'),
        ]
      : []),
  ];

  for (const p of builtCandidatePaths) {
    try {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf-8');
        if (content && content.length > 100 && !content.includes('/src/main.tsx')) {
          cachedProductionTemplate = content;
          return content;
        }
      }
    } catch {}
  }

  // 2. On Vercel serverless, static build output lives on the Edge CDN at /index.html.
  // Fetch and cache the genuine production index.html (with hashed /assets/... bundles).
  if (!isLocalHost && host) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      const staticRes = await fetch(`${proto}://${host}/index.html`, {
        headers: { 'x-prople-seo-internal': '1', Accept: 'text/html' },
        signal: controller.signal,
      }).catch(() => null);
      clearTimeout(timeout);

      if (staticRes && staticRes.ok) {
        const htmlText = await staticRes.text().catch(() => '');
        if (htmlText && htmlText.length > 100 && !htmlText.includes('/src/main.tsx')) {
          cachedProductionTemplate = htmlText;
          return htmlText;
        }
      }
    } catch {}
  }

  // 3. In local development, allow root index.html
  if (isLocalHost) {
    const devPaths = [
      path.join(process.cwd(), 'index.html'),
      ...(modDir ? [path.join(modDir, '..', 'index.html')] : []),
    ];
    for (const p of devPaths) {
      try {
        if (fs.existsSync(p)) {
          const content = fs.readFileSync(p, 'utf-8');
          if (content && content.length > 100) {
            return content;
          }
        }
      } catch {}
    }
  }

  return `<!doctype html>
<html lang="en" class="dark" style="background-color: #131314; color-scheme: dark;">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <title>Prople Store</title>
    <meta name="description" content="Discover apps and games on Prople Store." />
    <link rel="icon" type="image/png" href="/logo.png" />
    <link rel="manifest" href="/manifest.webmanifest" />
  </head>
  <body style="margin: 0; background-color: #131314; color: #e3e3e3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <div id="root"></div>
  </body>
</html>`;
}

export default async function handler(req: any, res: any) {
  let fallbackHtml = `<!doctype html><html lang="en" class="dark" style="background-color:#131314;"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>Prople Store</title></head><body style="margin:0;background:#131314;"><div id="root"></div></body></html>`;

  try {
    const host = (req.headers?.['x-forwarded-host'] || req.headers?.host || 'www.prople.co.in').toString().split(',')[0].trim();
    const proto = (req.headers?.['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https')).toString().split(',')[0].trim();
    const baseUrl = host.includes('localhost') || host.includes('vercel.app') ? `${proto}://${host}` : BASE_URL;
    const isCrawler = isCrawlerUserAgent(req.headers?.['user-agent']?.toString());

    const query = req.query || {};
    const reqType = (query.type || '').toString().toLowerCase();
    const rawSlugVal = Array.isArray(query.slug)
      ? query.slug.join('/')
      : Array.isArray(query.match)
      ? query.match.join('/')
      : (query.slug || query.match || query.id || '').toString();

    let slug = '';
    try {
      slug = decodeURIComponent(rawSlugVal).replace(/^\/+|\/+$/g, '');
    } catch {
      slug = rawSlugVal.replace(/^\/+|\/+$/g, '');
    }
    // Strip trailing /download segment when matching app metadata
    const lookupSlug = slug.replace(/\/download$/i, '');

    const templateHtml = await getBaseTemplate(proto, host);
    fallbackHtml = templateHtml;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', isCrawler ? 'public, s-maxage=3600, stale-while-revalidate=86400' : 'no-cache, no-store, must-revalidate');
    res.setHeader('X-Robots-Tag', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');

    const allApps = await fetchAllPublishedApps();

    // 1. Single Application Page: /apps/:slug or /app/:slug
    if (reqType === 'app' || !reqType) {
      if (!lookupSlug) {
        const html = injectCollectionSeoIntoHtml(
          templateHtml,
          'Prople Store – Multi-Platform App Store & Application Marketplace (Android, Apple, Mac, Linux, Windows)',
          'Discover apps and games on Prople Store, a multi-platform app store and application marketplace supporting Android, Apple (iOS/iPadOS), Mac, Linux, and Windows.',
          `${baseUrl}/`,
          baseUrl
        );
        return res.status(200).send(html);
      }

      const PLATFORM_KEYS = new Set(['android', 'windows', 'linux', 'mac', 'apple', 'ios', 'web', 'all']);
      if (PLATFORM_KEYS.has(lookupSlug.toLowerCase())) {
        const platName = lookupSlug.charAt(0).toUpperCase() + lookupSlug.slice(1).toLowerCase();
        const html = injectCollectionSeoIntoHtml(
          templateHtml,
          `${platName} Applications & Software — Free Verified Downloads | Prople Store`,
          `Discover, search, and download top-rated ${platName} applications, packages, and tools on Prople Store.`,
          `${baseUrl}/platforms/${encodeURIComponent(lookupSlug.toLowerCase())}`,
          baseUrl
        );
        return res.status(200).send(html);
      }

      const cleanSlug = lookupSlug.toLowerCase();
      const cleanSlugNoDashes = cleanSlug.replace(/[^a-z0-9]/g, '');

      let matchedApp = allApps.find((a: any) => {
        if (!a) return false;
        if (a.id && a.id.toLowerCase() === cleanSlug) return true;
        if (a.slug && a.slug.toLowerCase() === cleanSlug) return true;
        if (a.packageName && a.packageName.toLowerCase() === cleanSlug) return true;
        const nameSlug = slugifyAppName(a.name || '');
        if (nameSlug && nameSlug === cleanSlug) return true;
        const idNoDashes = (a.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const nameNoDashes = (a.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return Boolean((idNoDashes && idNoDashes === cleanSlugNoDashes) || (nameNoDashes && nameNoDashes === cleanSlugNoDashes));
      });

      if (!matchedApp) {
        matchedApp = await fetchSingleAppDirect(lookupSlug);
      }

      if (matchedApp) {
        const transformedHtml = injectAppSeoIntoHtml(templateHtml, matchedApp, baseUrl, isCrawler);
        return res.status(200).send(transformedHtml);
      }

      return res.status(200).send(templateHtml);
    }

    // 2. Developer Page: /developers/:slug
    if (reqType === 'developer') {
      const devSlug = lookupSlug;
      const matchedApp = allApps.find((a: any) => a.developer && slugifyAppName(a.developer) === devSlug);
      const developerName =
        matchedApp?.developer ||
        devSlug
          .split('-')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');

      const transformedHtml = injectCollectionSeoIntoHtml(
        templateHtml,
        `${developerName} — Verified Developer Profile & Apps | Prople Store`,
        `Explore apps, games, tools, and releases developed and published by ${developerName} on Prople Store.`,
        `${baseUrl}/developers/${encodeURIComponent(slugifyAppName(developerName))}`,
        baseUrl
      );
      return res.status(200).send(transformedHtml);
    }

    // 3. Category Page: /categories/:slug
    if (reqType === 'category') {
      const catSlug = lookupSlug;
      const matchedApp = allApps.find((a: any) => a.category && slugifyAppName(a.category) === catSlug);
      const categoryName =
        matchedApp?.category ||
        catSlug
          .split('-')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');

      const transformedHtml = injectCollectionSeoIntoHtml(
        templateHtml,
        `${categoryName} Apps & Games — Download & Browse | Prople Store`,
        `Discover, download, and browse top-rated ${categoryName} applications, tools, and games on Prople Store.`,
        `${baseUrl}/categories/${encodeURIComponent(slugifyAppName(categoryName))}`,
        baseUrl
      );
      return res.status(200).send(transformedHtml);
    }

    // 4. Platform Page: /platforms/:slug
    if (reqType === 'platform') {
      const platformParam = (lookupSlug || 'all').toLowerCase();
      const platformLabel =
        platformParam === 'all'
          ? 'All Platforms'
          : platformParam.charAt(0).toUpperCase() + platformParam.slice(1);
      const canonical = platformParam === 'all' ? `${baseUrl}/apps` : `${baseUrl}/platforms/${encodeURIComponent(platformParam)}`;

      const transformedHtml = injectCollectionSeoIntoHtml(
        templateHtml,
        `${platformLabel} Applications & Software — Free Verified Downloads | Prople Store`,
        `Discover, search, and download top-rated ${platformLabel} applications, packages, and tools on Prople Store.`,
        canonical,
        baseUrl
      );
      return res.status(200).send(transformedHtml);
    }

    return res.status(200).send(templateHtml);
  } catch (err: any) {
    console.error('[Vercel SEO Handler Notice]:', err?.message || err);
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(fallbackHtml);
    }
  }
}
