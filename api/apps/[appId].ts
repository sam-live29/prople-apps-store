import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

const DEFAULT_ADMIN_EMAILS = [
  'sahanurmolla7076@gmail.com',
  'sahanurmolla2886@gmail.com',
  'sahanurmolla190@gmail.com',
  'prople.site@gmail.com',
  'cloaktailsupport@gmail.com',
  'cloaktailofficial@gmail.com',
  'prople.org@gmail.com',
];

const VERIFIED_ADMIN_DOMAIN = '@prople.co.in';

function isStrictAdminEmail(email?: string | null): boolean {
  if (!email || typeof email !== 'string') return false;
  const norm = email.toLowerCase().trim();
  if (DEFAULT_ADMIN_EMAILS.includes(norm)) return true;

  const envAdmins = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '')
    .toLowerCase()
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
  if (envAdmins.includes(norm)) return true;
  if (norm.endsWith(VERIFIED_ADMIN_DOMAIN)) {
    const local = norm.slice(0, -VERIFIED_ADMIN_DOMAIN.length);
    if (['admin', 'security', 'moderator', 'executive', 'root', 'dev'].includes(local)) {
      return true;
    }
  }
  return false;
}

function getServerFirebaseConfig() {
  let fileConfig: any = {};
  const candidates: string[] = [path.join(process.cwd(), 'firebase-applet-config.json')];
  try {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    candidates.push(path.join(currentDir, '..', '..', 'firebase-applet-config.json'));
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
    const fbConfig = getServerFirebaseConfig();
    const databaseId = !fbConfig.isExampleConfig ? fbConfig.firestoreDatabaseId : '(default)';
    const projectId = !fbConfig.isExampleConfig ? fbConfig.projectId : '';
    const baseFirestoreUrl = projectId ? `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents` : '';

    const parseFirestoreDoc = (doc: any) => {
      if (!doc || !doc.fields) return null;
      const id = doc.name ? doc.name.split('/').pop() : appId;
      const fields = doc.fields || {};
      const parsed: any = { id };
      if (doc.createTime) parsed.createdAt = doc.createTime;
      if (doc.updateTime) parsed.updatedAt = doc.updateTime;
      for (const [key, val] of Object.entries<any>(fields)) {
        const fieldVal = parseFirestoreField(val);
        if (fieldVal !== undefined) parsed[key] = fieldVal;
      }
      return parsed;
    };

    if (!baseFirestoreUrl) {
      return res.status(200).json({ success: true, app: null });
    }

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
        (userId && (
          existingData.owner === userId ||
          existingData.developerId === userId ||
          existingData.publisherId === userId ||
          existingData.creatorUid === userId
        )) ||
        isMatchingEmail ||
        (userEmail && isStrictAdminEmail(userEmail));

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
