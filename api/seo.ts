import fs from 'fs';
import path from 'path';
import { 
  injectAppSeoIntoHtml, 
  injectCategorySeoIntoHtml, 
  injectDeveloperSeoIntoHtml, 
  injectPlatformSeoIntoHtml, 
  injectHomeSeoIntoHtml, 
  slugifyAppName,
  SeoAppMetadata 
} from '../server/seoRenderer';
import { getServerFirebaseConfig } from '../server/firebaseConfig';

const BASE_URL = 'https://prople.co.in';

let memoryAppsCache: any[] = [];
let lastCacheFetch = 0;
const CACHE_TTL_MS = 60 * 1000; // 60s cache in serverless memory

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
    const databaseId = !fbConfig.isExampleConfig ? fbConfig.firestoreDatabaseId : '(default)';
    const projectId = !fbConfig.isExampleConfig ? fbConfig.projectId : '';

    if (!projectId) {
      return memoryAppsCache;
    }

    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/apps?pageSize=200`;

    // Strict 2000ms timeout to guarantee serverless functions NEVER hang or hit Vercel 15s limit
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
    const databaseId = !fbConfig.isExampleConfig ? fbConfig.firestoreDatabaseId : '(default)';
    const projectId = !fbConfig.isExampleConfig ? fbConfig.projectId : '';

    if (!projectId || !appIdOrSlug) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1800);

    const docUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/apps/${encodeURIComponent(appIdOrSlug)}`;
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

function getBaseTemplate(): string {
  const candidatePaths = [
    path.join(process.cwd(), 'dist', 'index.html'),
    path.join(process.cwd(), 'index.html'),
    path.join(__dirname, '..', 'dist', 'index.html'),
    path.join(__dirname, '..', 'index.html'),
  ];

  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf-8');
        if (content && content.length > 100) {
          return content;
        }
      }
    } catch {}
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
  const host = req.headers?.['x-forwarded-host'] || req.headers?.host || 'prople.co.in';
  const proto = req.headers?.['x-forwarded-proto'] || 'https';
  const baseUrl = host.includes('localhost') ? `${proto}://${host}` : BASE_URL;

  const query = req.query || {};
  const reqType = (query.type || '').toString().toLowerCase();
  const rawSlug = (query.slug || query.match || query.id || '').toString();
  const slug = decodeURIComponent(rawSlug).replace(/^\/+|\/+$/g, '');

  const templateHtml = getBaseTemplate();

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.setHeader('X-Robots-Tag', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');

  try {
    const allApps = await fetchAllPublishedApps();

    // 1. Single Application Page: /apps/:slug or /app/:slug
    if (reqType === 'app' || !reqType) {
      if (!slug) {
        const html = injectHomeSeoIntoHtml(templateHtml, baseUrl, allApps);
        return res.status(200).send(html);
      }

      const cleanSlug = slug.toLowerCase();
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

      // If not in cache, attempt direct document lookup by exact ID
      if (!matchedApp) {
        matchedApp = await fetchSingleAppDirect(slug);
      }

      if (matchedApp) {
        let transformedHtml = injectAppSeoIntoHtml(templateHtml, matchedApp, baseUrl);
        const hydrationJson = JSON.stringify(matchedApp).replace(/</g, '\\u003c');
        const hydrationScript = `<script id="prople-initial-app" type="application/json">${hydrationJson}</script><script>try{window.__INITIAL_APP__=JSON.parse(document.getElementById("prople-initial-app").textContent);}catch(e){}</script>`;
        if (transformedHtml.includes('</head>')) {
          transformedHtml = transformedHtml.replace('</head>', `${hydrationScript}\n</head>`);
        } else {
          transformedHtml = `${hydrationScript}\n${transformedHtml}`;
        }
        return res.status(200).send(transformedHtml);
      }

      // If not yet matched or newly created, deliver the SPA shell directly so the client-side router loads it gracefully!
      return res.status(200).send(templateHtml);
    }

    // 2. Developer Page: /developers/:slug
    if (reqType === 'developer') {
      const devSlug = slug;
      const matchedApp = allApps.find((a: any) => a.developer && slugifyAppName(a.developer) === devSlug);
      const developerName = matchedApp?.developer || devSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      const devApps = allApps.filter((a: any) => a.developer && (slugifyAppName(a.developer) === devSlug || a.developer.toLowerCase() === developerName.toLowerCase()));

      const transformedHtml = injectDeveloperSeoIntoHtml(templateHtml, developerName, baseUrl, devApps);
      return res.status(200).send(transformedHtml);
    }

    // 3. Category Page: /categories/:slug
    if (reqType === 'category') {
      const catSlug = slug;
      const matchedApp = allApps.find((a: any) => a.category && slugifyAppName(a.category) === catSlug);
      const categoryName = matchedApp?.category || catSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      const catApps = allApps.filter((a: any) => a.category && (slugifyAppName(a.category) === catSlug || a.category.toLowerCase() === categoryName.toLowerCase()));

      const transformedHtml = injectCategorySeoIntoHtml(templateHtml, categoryName, baseUrl, catApps);
      return res.status(200).send(transformedHtml);
    }

    // 4. Platform Page: /platforms/:slug
    if (reqType === 'platform') {
      const platformParam = (slug || 'all') as any;
      const platformApps = platformParam === 'all' ? allApps : allApps.filter((a: any) => {
        const plat = (a.platform || '').toLowerCase();
        const pkg = (a.packageFormat || '').toLowerCase();
        const target = (a.targetOs || '').toLowerCase();
        const appType = (a.type || '').toLowerCase();
        if (platformParam === 'android') return plat === 'android' || pkg === 'apk' || pkg === 'aab';
        if (platformParam === 'windows') return plat === 'windows' || pkg === 'exe' || pkg === 'msi' || pkg === 'msix';
        if (platformParam === 'linux') return plat === 'linux' || pkg === 'deb' || pkg === 'appimage' || pkg === 'rpm' || pkg === 'flatpak' || pkg === 'tar.gz';
        if (platformParam === 'mac') return plat === 'mac' || plat === 'macos' || pkg === 'dmg' || pkg === 'pkg' || target.includes('mac');
        if (platformParam === 'apple' || platformParam === 'ios') return plat === 'ios' || plat === 'apple' || plat === 'mac' || pkg === 'ipa' || pkg === 'dmg';
        if (platformParam === 'web') return plat === 'web' || appType === 'pwa' || appType === 'web' || appType === 'webapp';
        return false;
      });

      const transformedHtml = injectPlatformSeoIntoHtml(templateHtml, platformParam, baseUrl, platformApps);
      return res.status(200).send(transformedHtml);
    }

    // 5. Default Fallback
    const fallbackHtml = injectHomeSeoIntoHtml(templateHtml, baseUrl, allApps);
    return res.status(200).send(fallbackHtml);
  } catch (err: any) {
    console.error('[Vercel SEO Handler Notice]:', err?.message || err);
    return res.status(200).send(templateHtml);
  }
}
