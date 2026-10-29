import fs from 'fs';
import path from 'path';

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

export default async function handler(req: any, res: any) {
  const corsHeaders = getSecureCorsHeaders(req.headers?.origin);
  for (const [key, value] of Object.entries(corsHeaders)) {
    res.setHeader(key, value);
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  res.setHeader('Content-Type', 'application/json');

  const rawAppId = (req.query?.appId || req.query?.id || '').toString().trim();
  const appId = sanitizeIdentifier(rawAppId, 120);
  if (!appId) {
    return res.status(400).json({ success: false, error: 'App identifier is required' });
  }

  const cleanId = appId.toLowerCase();
  const cleanSlug = cleanId.replace(/[^a-z0-9]/g, '');

  try {
    let databaseId = '(default)';
    try {
      const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (config.firestoreDatabaseId) databaseId = config.firestoreDatabaseId;
      }
    } catch {}
    const projectId = process.env.FIREBASE_PROJECT_ID || 'prople-store-3efed';
    const baseFirestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents`;

    const parseFirestoreDoc = (doc: any) => {
      if (!doc || !doc.fields) return null;
      const id = doc.name ? doc.name.split('/').pop() : appId;
      const fields = doc.fields || {};
      const parsed: any = { id };
      for (const [key, val] of Object.entries<any>(fields)) {
        if (val.stringValue !== undefined) parsed[key] = val.stringValue;
        else if (val.integerValue !== undefined) parsed[key] = parseInt(val.integerValue, 10);
        else if (val.doubleValue !== undefined) parsed[key] = parseFloat(val.doubleValue);
        else if (val.booleanValue !== undefined) parsed[key] = val.booleanValue;
        else if (val.arrayValue !== undefined) {
          parsed[key] = (val.arrayValue.values || []).map((v: any) => v.stringValue || v);
        } else if (val.mapValue !== undefined) {
          const mapObj: any = {};
          for (const [mk, mv] of Object.entries<any>(val.mapValue.fields || {})) {
            mapObj[mk] = mv.stringValue ?? mv.integerValue ?? mv.booleanValue ?? mv;
          }
          parsed[key] = mapObj;
        }
      }
      return parsed;
    };

    // Handle DELETE method
    if (req.method === 'DELETE') {
      const body = req.body || {};
      const userId = (body.userId || req.headers['x-user-id'] || '').toString().trim();
      const userEmail = (body.userEmail || req.headers['x-user-email'] || '').toString().toLowerCase().trim();

      const directDocUrl = `${baseFirestoreUrl}/apps/${encodeURIComponent(appId)}`;
      const getRes = await fetch(directDocUrl).catch(() => null);
      if (!getRes || !getRes.ok) {
        return res.status(404).json({ success: false, error: 'Application not found' });
      }

      const existingDocData = await getRes.json().catch(() => null);
      const existingData = parseFirestoreDoc(existingDocData);
      if (!existingData) {
        return res.status(404).json({ success: false, error: 'Application not found' });
      }

      const devEmail = (existingData.developerEmail || '').toLowerCase().trim();
      const pubEmail = (existingData.publisherEmail || '').toLowerCase().trim();
      const ownerEmail = (existingData.ownerEmail || '').toLowerCase().trim();
      const devInfoEmail = (existingData.developerInfo?.email || '').toLowerCase().trim();

      const isMatchingEmail = userEmail && (
        devEmail === userEmail ||
        pubEmail === userEmail ||
        ownerEmail === userEmail ||
        devInfoEmail === userEmail
      );

      const isOwner =
        !existingData.owner ||
        existingData.owner === 'developer' ||
        existingData.owner === 'dev-publisher' ||
        (userId && (
          existingData.owner === userId ||
          existingData.developerId === userId ||
          existingData.publisherId === userId ||
          existingData.creatorUid === userId
        )) ||
        isMatchingEmail ||
        (userEmail && (userEmail.startsWith('sahanurmolla') || userEmail.startsWith('sahinurmolla') || userEmail === 'prople.site@gmail.com' || userEmail.includes('admin')));

      if (!isOwner) {
        return res.status(403).json({ success: false, error: 'Forbidden: You do not own this application and cannot delete it.' });
      }

      const delRes = await fetch(directDocUrl, { method: 'DELETE' }).catch(() => null);
      if (!delRes || !delRes.ok) {
        return res.status(500).json({ success: false, error: 'Failed to delete application from store' });
      }

      // Also clean up any banner doc
      try {
        const bannerUrl = `${baseFirestoreUrl}/banners/banner-${encodeURIComponent(appId)}`;
        await fetch(bannerUrl, { method: 'DELETE' }).catch(() => {});
      } catch {}

      return res.status(200).json({ success: true, deletedAppId: appId });
    }

    // 1. Direct document lookup by ID
    const directDocUrl = `${baseFirestoreUrl}/apps/${encodeURIComponent(appId)}`;
    const directRes = await fetch(directDocUrl).catch(() => null);
    if (directRes && directRes.ok) {
      const docData = await directRes.json().catch(() => null);
      const app = parseFirestoreDoc(docData);
      if (app) {
        return res.status(200).json({ success: true, app });
      }
    }

    // 2. Query all apps to resolve by slug, packageName, or name
    const allAppsUrl = `${baseFirestoreUrl}/apps?pageSize=100`;
    const allAppsRes = await fetch(allAppsUrl).catch(() => null);
    if (allAppsRes && allAppsRes.ok) {
      const data = await allAppsRes.json().catch(() => null);
      if (data && Array.isArray(data.documents)) {
        const apps = data.documents.map(parseFirestoreDoc).filter(Boolean);
        const matched = apps.find((app: any) => {
          if (!app) return false;
          if (app.id && app.id.toLowerCase() === cleanId) return true;
          if (app.slug && app.slug.toLowerCase() === cleanId) return true;
          if (app.packageName && app.packageName.toLowerCase() === cleanId) return true;
          if (app.name && app.name.toLowerCase() === cleanId) return true;
          const nameSlug = (app.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const idSlug = (app.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          return Boolean((nameSlug && nameSlug === cleanSlug) || (idSlug && idSlug === cleanSlug));
        });

        if (matched) {
          return res.status(200).json({ success: true, app: matched });
        }
      }
    }

    return res.status(404).json({ success: false, error: 'Application not found' });
  } catch (err: any) {
    console.warn('[apps appId Notice]', err?.message || err);
    return res.status(404).json({ success: false, error: 'Application not found' });
  }
}
