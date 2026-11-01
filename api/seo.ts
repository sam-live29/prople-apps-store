import fs from 'fs';
import path from 'path';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { 
  injectAppSeoIntoHtml, 
  injectCategorySeoIntoHtml, 
  injectDeveloperSeoIntoHtml, 
  injectPlatformSeoIntoHtml, 
  injectHomeSeoIntoHtml, 
  renderNotFoundHtml, 
  slugifyAppName,
  SeoAppMetadata 
} from '../server/seoRenderer';
import { getServerFirebaseConfig } from '../server/firebaseConfig';

const BASE_URL = 'https://prople.co.in';

let memoryAppsCache: any[] = [];
let lastCacheFetch = 0;
const CACHE_TTL_MS = 60 * 1000; // 60s cache in serverless memory

function getFirebaseDb() {
  const fbConfig = getServerFirebaseConfig();
  const existingApps = getApps();
  const fbApp = existingApps.find(a => a.name === 'prople-seo-client') || 
    initializeApp(fbConfig, 'prople-seo-client');
  return fbConfig.firestoreDatabaseId && !fbConfig.firestoreDatabaseId.includes('example')
    ? getFirestore(fbApp, fbConfig.firestoreDatabaseId)
    : getFirestore(fbApp);
}

async function fetchAllPublishedApps(): Promise<any[]> {
  const now = Date.now();
  if (memoryAppsCache.length > 0 && now - lastCacheFetch < CACHE_TTL_MS) {
    return memoryAppsCache;
  }

  try {
    const db = getFirebaseDb();
    const snap = await getDocs(collection(db, 'apps'));
    const list: any[] = [];
    snap.forEach(d => {
      const data = d.data();
      if (data.isPublished !== false) {
        list.push({ id: d.id, ...data });
      }
    });

    if (list.length > 0) {
      memoryAppsCache = list;
      lastCacheFetch = now;
      return list;
    }
  } catch (err: any) {
    console.warn('[Vercel SEO] Error fetching apps via Firebase SDK:', err?.message || err);
  }

  return memoryAppsCache;
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
        try {
          const db = getFirebaseDb();
          const docSnap = await getDoc(doc(db, 'apps', slug));
          if (docSnap.exists()) {
            matchedApp = { id: docSnap.id, ...docSnap.data() };
          }
        } catch {}
      }

      if (matchedApp) {
        const transformedHtml = injectAppSeoIntoHtml(templateHtml, matchedApp, baseUrl);
        return res.status(200).send(transformedHtml);
      }

      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('X-Robots-Tag', 'noindex, follow');
      const notFoundHtml = renderNotFoundHtml(templateHtml, slug, baseUrl);
      return res.status(404).send(notFoundHtml);
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
    console.error('[Vercel SEO Handler Error]:', err?.message || err);
    return res.status(200).send(templateHtml);
  }
}
