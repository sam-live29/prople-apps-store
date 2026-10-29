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

export default async function handler(req: any, res: any) {
  const corsHeaders = getSecureCorsHeaders(req.headers?.origin);
  for (const [key, value] of Object.entries(corsHeaders)) {
    res.setHeader(key, value);
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  try {
    const { getServerFirebaseConfig } = await import('../server/firebaseConfig');
    const fbConfig = getServerFirebaseConfig();
    const databaseId = !fbConfig.isExampleConfig ? fbConfig.firestoreDatabaseId : '(default)';
    const projectId = !fbConfig.isExampleConfig ? fbConfig.projectId : '';

    if (projectId) {
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/apps`;
      const firestoreRes = await fetch(firestoreUrl).catch(() => null);
    if (firestoreRes && firestoreRes.ok) {
      const data = await firestoreRes.json().catch(() => null);
      if (data && Array.isArray(data.documents)) {
        const apps = data.documents.map((doc: any) => {
          const id = doc.name.split('/').pop();
          const fields = doc.fields || {};
          const parsed: any = { id };
          for (const [key, val] of Object.entries<any>(fields)) {
            if (val.stringValue !== undefined) parsed[key] = val.stringValue;
            else if (val.integerValue !== undefined) parsed[key] = parseInt(val.integerValue, 10);
            else if (val.doubleValue !== undefined) parsed[key] = parseFloat(val.doubleValue);
            else if (val.booleanValue !== undefined) parsed[key] = val.booleanValue;
            else if (val.arrayValue !== undefined) {
              parsed[key] = (val.arrayValue.values || []).map((v: any) => v.stringValue || v);
            }
          }
          return parsed;
        });
        const requestedId = (req.query?.id || req.query?.appId || req.query?.slug || '').toString().trim().toLowerCase();
        if (requestedId) {
          const cleanSlug = requestedId.replace(/[^a-z0-9]/g, '');
          const single = apps.find((app: any) => {
            if (!app) return false;
            if (app.id && app.id.toLowerCase() === requestedId) return true;
            if (app.slug && app.slug.toLowerCase() === requestedId) return true;
            if (app.packageName && app.packageName.toLowerCase() === requestedId) return true;
            if (app.name && app.name.toLowerCase() === requestedId) return true;
            const nameSlug = (app.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const idSlug = (app.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            return Boolean((nameSlug && nameSlug === cleanSlug) || (idSlug && idSlug === cleanSlug));
          });
          if (single) {
            return res.status(200).json({ success: true, app: single });
          }
          return res.status(404).json({ success: false, error: 'Application not found' });
        }

        return res.status(200).json({ success: true, apps });
      }
    }
    }

    return res.status(200).json({ success: true, apps: [] });
  } catch (err: any) {
    console.warn('[apps API Notice]', err?.message || err);
    return res.status(200).json({ success: true, apps: [] });
  }
}
