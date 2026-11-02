import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

function slugifyAppName(name: string): string {
  return (name || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getServerFirebaseConfig() {
  let fileConfig: any = {};
  const candidates: string[] = [path.join(process.cwd(), 'firebase-applet-config.json')];
  try {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    candidates.push(path.join(currentDir, '..', 'firebase-applet-config.json'));
  } catch {}

  for (const configPath of candidates) {
    try {
      if (fs.existsSync(configPath)) {
        fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        break;
      }
    } catch {}
  }

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
  const appId = process.env.FIREBASE_APP_ID || (isReal(fileConfig.appId) ? fileConfig.appId : '');
  const authDomain =
    process.env.FIREBASE_AUTH_DOMAIN ||
    (isReal(fileConfig.authDomain) ? fileConfig.authDomain : projectId ? `${projectId}.firebaseapp.com` : '');
  const firestoreDatabaseId =
    process.env.FIRESTORE_DATABASE_ID ||
    process.env.FIREBASE_DATABASE_ID ||
    (isReal(fileConfig.firestoreDatabaseId) ? fileConfig.firestoreDatabaseId : '(default)');
  const storageBucket =
    process.env.FIREBASE_STORAGE_BUCKET ||
    (isReal(fileConfig.storageBucket) ? fileConfig.storageBucket : projectId ? `${projectId}.firebasestorage.app` : '');
  const messagingSenderId =
    process.env.FIREBASE_MESSAGING_SENDER_ID || (isReal(fileConfig.messagingSenderId) ? fileConfig.messagingSenderId : '');

  const isExampleConfig = !isReal(apiKey) || !isReal(projectId);

  return {
    projectId: projectId || 'example-prople-store',
    appId: appId || '1:000000000000:web:0000000000000000000000',
    apiKey: apiKey || 'AIzaSyExamplePlaceholderApiKey0000000000',
    authDomain: authDomain || 'example-prople-store.firebaseapp.com',
    firestoreDatabaseId: firestoreDatabaseId || 'example-firestore-database-id',
    storageBucket: storageBucket || 'example-prople-store.firebasestorage.app',
    messagingSenderId: messagingSenderId || '000000000000',
    isExampleConfig,
  };
}

const SITEMAP_BASE = 'https://prople.co.in';

let memoryAppsCache: any[] = [];
let lastCacheFetch = 0;
const CACHE_TTL_MS = 60 * 1000;

function escapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatIsoDate(val: any, fallback: string): string {
  if (!val) return fallback;
  try {
    if (typeof val === 'string') {
      return val.includes('T') ? val.split('T')[0] : val.slice(0, 10);
    }
    if (typeof val === 'number') {
      return new Date(val).toISOString().split('T')[0];
    }
    if (val && typeof val.toDate === 'function') {
      return val.toDate().toISOString().split('T')[0];
    }
    if (val instanceof Date) {
      return val.toISOString().split('T')[0];
    }
  } catch {}
  return fallback;
}

function getFirebaseDb() {
  const fbConfig = getServerFirebaseConfig();
  const existingApps = getApps();
  const fbApp = existingApps.find(a => a.name === 'prople-sitemaps-client') || 
    initializeApp(fbConfig, 'prople-sitemaps-client');
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
    console.warn('[Vercel Sitemap] Error fetching apps via Firebase SDK:', err?.message || err);
  }

  return memoryAppsCache;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const rawName = (req.query?.name || '').toString().toLowerCase().replace(/\.xml$/, '');
  const now = new Date().toISOString().split('T')[0];

  try {
    // 1. Sitemaps Index: /sitemap.xml
    if (!rawName || rawName === 'index' || rawName === 'sitemap') {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${SITEMAP_BASE}/sitemaps/apps.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${SITEMAP_BASE}/sitemaps/categories.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${SITEMAP_BASE}/sitemaps/platforms.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${SITEMAP_BASE}/sitemaps/developers.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${SITEMAP_BASE}/sitemaps/pages.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
</sitemapindex>`;
      return res.status(200).send(xml);
    }

    const allApps = await fetchAllPublishedApps();

    // 2. Applications Sitemap: /sitemaps/apps.xml
    if (rawName === 'apps' || rawName.startsWith('apps-')) {
      const seenAppSlugs = new Set<string>();
      let urls = '';

      for (const app of allApps) {
        if (app && app.isPublished !== false) {
          const canonicalSlug = app.slug || slugifyAppName(app.name) || app.id;
          if (seenAppSlugs.has(canonicalSlug)) continue;
          seenAppSlugs.add(canonicalSlug);
          const lastMod = formatIsoDate(app.updatedAt || app.createdAt, now);
          urls += `  <url>\n    <loc>${escapeXml(`${SITEMAP_BASE}/apps/${encodeURIComponent(canonicalSlug)}`)}</loc>\n    <lastmod>${escapeXml(lastMod)}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;
        }
      }

      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}</urlset>`;
      return res.status(200).send(xml);
    }

    // 3. Categories Sitemap: /sitemaps/categories.xml
    if (rawName === 'categories') {
      const uniqueCategories = new Set<string>();
      for (const app of allApps) {
        if (app?.category) uniqueCategories.add(app.category.trim());
      }
      const standardCats = [
        'Art & Design', 'Auto & Vehicles', 'Beauty', 'Books & Reference', 'Business',
        'Comics', 'Communication', 'Dating', 'Education', 'Entertainment', 'Events',
        'Finance', 'Food & Drink', 'Games', 'Health & Fitness', 'Lifestyle',
        'Maps & Navigation', 'Medical', 'Music & Audio', 'News & Magazines', 'Parenting',
        'Personalisation', 'Photography', 'Productivity', 'Shopping', 'Social', 'Sports',
        'Tools', 'Travel & Local', 'Video Players & Editors', 'Weather'
      ];
      for (const c of standardCats) uniqueCategories.add(c);

      let urls = '';
      for (const cat of uniqueCategories) {
        const catSlug = slugifyAppName(cat);
        urls += `  <url>\n    <loc>${escapeXml(`${SITEMAP_BASE}/categories/${encodeURIComponent(catSlug)}`)}</loc>\n    <lastmod>${escapeXml(now)}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
      }

      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}</urlset>`;
      return res.status(200).send(xml);
    }

    // 4. Platforms Sitemap: /sitemaps/platforms.xml
    if (rawName === 'platforms') {
      const platforms = ['android', 'windows', 'linux', 'mac', 'apple', 'web'];
      let urls = '';
      for (const plat of platforms) {
        urls += `  <url>\n    <loc>${escapeXml(`${SITEMAP_BASE}/platforms/${plat}`)}</loc>\n    <lastmod>${escapeXml(now)}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
      }

      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}</urlset>`;
      return res.status(200).send(xml);
    }

    // 5. Developers Sitemap: /sitemaps/developers.xml
    if (rawName === 'developers') {
      const uniqueDevelopers = new Set<string>();
      for (const app of allApps) {
        if (app?.developer) uniqueDevelopers.add(app.developer.trim());
      }
      uniqueDevelopers.add('Cloaktail Industries');

      let urls = '';
      for (const dev of uniqueDevelopers) {
        const devSlug = slugifyAppName(dev);
        urls += `  <url>\n    <loc>${escapeXml(`${SITEMAP_BASE}/developers/${encodeURIComponent(devSlug)}`)}</loc>\n    <lastmod>${escapeXml(now)}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
      }

      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}</urlset>`;
      return res.status(200).send(xml);
    }

    // 6. Pages Sitemap: /sitemaps/pages.xml
    if (rawName === 'pages') {
      const pages = [
        { path: '', priority: '1.0', changefreq: 'daily' },
        { path: '/apps', priority: '0.9', changefreq: 'daily' },
        { path: '/about', priority: '0.6', changefreq: 'monthly' },
        { path: '/terms', priority: '0.5', changefreq: 'monthly' },
        { path: '/privacy', priority: '0.5', changefreq: 'monthly' },
        { path: '/security', priority: '0.6', changefreq: 'monthly' },
        { path: '/how-it-works', priority: '0.6', changefreq: 'monthly' },
        { path: '/anti-piracy', priority: '0.5', changefreq: 'monthly' },
        { path: '/user-consent', priority: '0.5', changefreq: 'monthly' },
      ];

      let urls = '';
      for (const p of pages) {
        urls += `  <url>\n    <loc>${escapeXml(`${SITEMAP_BASE}${p.path}`)}</loc>\n    <lastmod>${escapeXml(now)}</lastmod>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>\n`;
      }

      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}</urlset>`;
      return res.status(200).send(xml);
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${SITEMAP_BASE}/sitemaps/apps.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
</sitemapindex>`;
    return res.status(200).send(xml);
  } catch (err: any) {
    console.error('[Vercel Sitemap Error]:', err?.message || err);
    return res.status(500).send(`<?xml version="1.0" encoding="UTF-8"?><error>${escapeXml(err?.message || 'Error generating sitemap')}</error>`);
  }
}
