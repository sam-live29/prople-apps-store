import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { isStrictAdminEmail, verifySecuritySecret } from '../../server/securityDefense.ts';
import { authenticateApiRequest } from '../../server/tokenVerifier.ts';

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

const publishTimestamps = new Map<string, number[]>();
const updateTimestamps = new Map<string, number[]>();

function checkEdgePublishRateLimit(key: string): boolean {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const recent = (publishTimestamps.get(key) || []).filter(t => now - t < windowMs);
  if (recent.length >= 3) return false;
  recent.push(now);
  publishTimestamps.set(key, recent);
  return true;
}

function checkEdgeUpdateRateLimit(key: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const recent = (updateTimestamps.get(key) || []).filter(t => now - t < windowMs);
  if (recent.length >= 5) return false;
  recent.push(now);
  updateTimestamps.set(key, recent);
  return true;
}

function slugifyAppName(name: string): string {
  return (name || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toFirestoreValue(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: val.toString() };
    return { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
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

export default async function handler(req: any, res: any) {
  const corsHeaders = getSecureCorsHeaders(req.headers?.origin);
  for (const [key, value] of Object.entries(corsHeaders)) {
    res.setHeader(key, value);
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Use POST.' });
  }

  res.setHeader('Content-Type', 'application/json');

  try {
    const { app: appPayload, userId, userEmail, featureOnSpotlight } = req.body || {};
    if (!appPayload || typeof appPayload !== 'object') {
      return res.status(400).json({ success: false, error: 'Missing app payload in request body' });
    }

    if (!appPayload.name || typeof appPayload.name !== 'string' || !appPayload.name.trim()) {
      return res.status(400).json({ success: false, error: 'Application name is required' });
    }

    const fbConfig = getServerFirebaseConfig();
    const databaseId = !fbConfig.isExampleConfig ? fbConfig.firestoreDatabaseId : '(default)';
    const projectId = !fbConfig.isExampleConfig ? fbConfig.projectId : '';
    if (!projectId) {
      return res.status(503).json({ success: false, error: 'Firestore configuration unavailable' });
    }

    const appId = (appPayload.id || `app-${(appPayload.name || 'app').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`).trim();
    const callerAuth = await authenticateApiRequest(req);
    const effectiveUid = callerAuth.uid || String(userId || req.headers['x-user-id'] || appPayload.owner || appPayload.developerId || appPayload.creatorUid || 'dev-publisher').trim();
    const effectiveEmail = callerAuth.email || String(userEmail || req.headers['x-user-email'] || appPayload.developerEmail || appPayload.publisherEmail || '').toLowerCase().trim();
    const isVerifiedAdmin = callerAuth.isVerifiedAdmin;

    const baseFirestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents`;
    const docUrl = `${baseFirestoreUrl}/apps/${encodeURIComponent(appId)}`;

    // 1. Fetch existing doc if present
    const existingRes = await fetch(docUrl).catch(() => null);
    const existingDocData = existingRes && existingRes.ok ? await existingRes.json().catch(() => null) : null;
    const existing = existingDocData ? parseFirestoreDoc(existingDocData) : null;

    if (existing) {
      const devEmail = (existing.developerEmail || '').toLowerCase().trim();
      const pubEmail = (existing.publisherEmail || '').toLowerCase().trim();
      const ownerEmail = (existing.ownerEmail || '').toLowerCase().trim();

      const isMatchingEmail = callerAuth.email && (
        devEmail === callerAuth.email ||
        pubEmail === callerAuth.email ||
        ownerEmail === callerAuth.email
      );

      const isOwner = isVerifiedAdmin || (
        callerAuth.uid && callerAuth.uid !== 'guest' && (
          existing.owner === callerAuth.uid ||
          existing.developerId === callerAuth.uid ||
          existing.creatorUid === callerAuth.uid
        )
      ) || Boolean(isMatchingEmail);

      if (!isOwner) {
        return res.status(403).json({ success: false, error: 'Forbidden: You do not own this application and cannot update it.' });
      }

      if (!checkEdgeUpdateRateLimit(`${effectiveUid}:${appId}`)) {
        return res.status(429).json({ success: false, error: 'Release update rate limit exceeded (maximum 5 updates per hour for this application).' });
      }
    }

    const cleanDoc: Record<string, any> = {
      ...appPayload,
      id: appId,
      slug: slugifyAppName(appPayload.name || existing?.name || ''),
      owner: effectiveUid || existing?.owner || 'developer',
      developerId: effectiveUid || existing?.developerId || 'developer',
      creatorUid: effectiveUid || existing?.creatorUid || 'developer',
      developerEmail: effectiveEmail || appPayload.developerEmail || existing?.developerEmail || '',
      updatedAt: new Date().toISOString(),
      isPublished: true,
    };

    if (!existing) {
      if (!checkEdgePublishRateLimit(effectiveUid || effectiveEmail || 'developer')) {
        return res.status(429).json({ success: false, error: 'Publishing quota reached (maximum 3 new applications per 15 minutes).' });
      }
      cleanDoc.createdAt = new Date().toISOString();
      cleanDoc.rating = typeof appPayload.rating === 'number' ? appPayload.rating : 5.0;
      cleanDoc.ratingsCount = typeof appPayload.ratingsCount === 'number' ? appPayload.ratingsCount : 1;
      cleanDoc.reviewsCount = appPayload.reviewsCount || '1 review';
      cleanDoc.downloadsCount = typeof appPayload.downloadsCount === 'number' ? appPayload.downloadsCount : 1;
      cleanDoc.downloads = appPayload.downloads || '1+';
    }

    // Convert to Firestore REST document shape
    const firestoreFields: Record<string, any> = {};
    for (const [k, v] of Object.entries(cleanDoc)) {
      if (v !== undefined) {
        firestoreFields[k] = toFirestoreValue(v);
      }
    }

    const saveRes = await fetch(`${docUrl}?updateMask.fieldPaths=${Object.keys(firestoreFields).join('&updateMask.fieldPaths=')}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: firestoreFields }),
    });

    if (!saveRes.ok) {
      // Fallback to direct POST or PUT
      const putRes = await fetch(docUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: firestoreFields }),
      });
      if (!putRes.ok) {
        const errText = await putRes.text().catch(() => '');
        console.error('[Vercel Apps Publish] REST save error:', errText);
        return res.status(500).json({ success: false, error: 'Failed to write application record to Firestore' });
      }
    }

    return res.status(200).json({ success: true, app: cleanDoc, isNew: !existing });
  } catch (err: any) {
    console.error('[Apps Publish Handler Error]:', err?.message || err);
    return res.status(500).json({ success: false, error: err?.message || 'Internal server error while publishing application' });
  }
}
