import fs from 'fs';
import path from 'path';

function getSecureCorsHeaders(origin?: string): Record<string, string> {
  const allowOrigin = origin || '*';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Credentials': 'false',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-Requested-With, Accept, X-User-Id, X-User-Email, X-Entity-Ref-ID',
    'Access-Control-Max-Age': '86400',
  };
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
