import { 
  collection as serverCollection, 
  doc as serverDoc, 
  getDoc as serverGetDoc, 
  getDocs as serverGetDocs, 
  setDoc as serverSetDoc 
} from "firebase/firestore";

export type AdminAction =
  | 'DELETE_APP'
  | 'UPDATE_APP'
  | 'RECEIVE_REPORTS'
  | 'DISMISS_REPORT'
  | 'DELETE_REVIEW'
  | 'BAN_LINK'
  | 'VERIFY_ACCOUNT'
  | 'RESTRICT_PUBLISHER'
  | 'MANAGE_ADMINS';

export interface ServerAdminRecord {
  uid?: string;
  email: string;
  role: 'Super Admin' | 'Store Administrator' | 'Platform Moderator';
  permissions: AdminAction[];
  grantedAt?: string;
  isActive: boolean;
}

export const ALL_ADMIN_ACTIONS: AdminAction[] = [
  'DELETE_APP',
  'UPDATE_APP',
  'RECEIVE_REPORTS',
  'DISMISS_REPORT',
  'DELETE_REVIEW',
  'BAN_LINK',
  'VERIFY_ACCOUNT',
  'RESTRICT_PUBLISHER',
  'MANAGE_ADMINS',
];

export const DEFAULT_ADMIN_EMAILS = [
  "ventureforge.corp@gmail.com",
  "sahanurmolla1777@gmail.com",
  "sahanurmolla7076@gmail.com",
  "sahanurmolla2886@gmail.com",
  "sahanurmolla190@gmail.com",
  "prople.site@gmail.com",
  "cloaktailsupport@gmail.com",
  "cloaktailofficial@gmail.com",
  "prople.org@gmail.com",
];

export const VERIFIED_ADMIN_DOMAIN = "@prople.co.in";

// Cache dynamic admins in memory to maintain sub-millisecond response times
let cachedAdmins = new Map<string, ServerAdminRecord>();
let lastCacheSync = 0;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL

export async function syncAdminCacheFromFirestore(serverDb: any): Promise<void> {
  if (!serverDb) return;
  const now = Date.now();
  if (now - lastCacheSync < CACHE_TTL_MS && cachedAdmins.size > 0) return;

  try {
    const adminsCol = serverCollection(serverDb, "admins");
    const snap = await serverGetDocs(adminsCol);
    const newMap = new Map<string, ServerAdminRecord>();

    // Seed defaults
    DEFAULT_ADMIN_EMAILS.forEach(email => {
      newMap.set(email.toLowerCase().trim(), {
        email: email.toLowerCase().trim(),
        role: 'Store Administrator',
        permissions: ALL_ADMIN_ACTIONS,
        isActive: true,
        grantedAt: new Date().toISOString()
      });
    });

    snap.forEach(d => {
      const data = d.data();
      const email = (data.email || (d.id.includes('@') ? d.id : '')).toLowerCase().trim();
      const uid = (data.uid || (!d.id.includes('@') ? d.id : '')).trim();
      const role = data.role || 'Store Administrator';
      const permissions = Array.isArray(data.permissions) && data.permissions.length > 0
        ? data.permissions
        : ALL_ADMIN_ACTIONS;

      const rec: ServerAdminRecord = {
        uid: uid || undefined,
        email,
        role: role === 'Super Admin' ? 'Super Admin' : (role === 'Platform Moderator' ? 'Platform Moderator' : 'Store Administrator'),
        permissions,
        grantedAt: data.grantedAt,
        isActive: data.isActive !== false
      };

      if (email) newMap.set(email, rec);
      if (uid) newMap.set(uid, rec);
    });

    cachedAdmins = newMap;
    lastCacheSync = now;
  } catch (err: any) {
    console.warn("[AdminPermissionsServer] Firestore sync notice:", err.message);
  }
}

/**
 * Ensures built-in administrator accounts exist in the Firestore 'admins' collection.
 */
export async function bootstrapDefaultAdmins(serverDb: any): Promise<void> {
  if (!serverDb) return;
  try {
    for (const email of DEFAULT_ADMIN_EMAILS) {
      const docKey = email.toLowerCase().trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      const adminRef = serverDoc(serverDb, "admins", docKey);
      await serverSetDoc(adminRef, {
        email: email.toLowerCase().trim(),
        role: 'Store Administrator',
        permissions: ALL_ADMIN_ACTIONS,
        isActive: true,
        grantedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }
    console.log("[AdminPermissionsServer] Bootstrapped administrator accounts in Firestore");
  } catch (err: any) {
    console.warn("[AdminPermissionsServer] Bootstrap notice:", err.message);
  }
}

/**
 * Checks whether an email or UID has administrative privileges.
 * Equal validation across all registered admins.
 */
export async function isAuthorizedAdmin(serverDb: any, email?: string | null, uid?: string | null): Promise<boolean> {
  const normEmail = (email || '').toLowerCase().trim();
  const cleanUid = (uid || '').trim();

  if (normEmail && DEFAULT_ADMIN_EMAILS.includes(normEmail)) return true;

  if (normEmail && normEmail.endsWith(VERIFIED_ADMIN_DOMAIN)) {
    const local = normEmail.slice(0, -VERIFIED_ADMIN_DOMAIN.length);
    if (['admin', 'security', 'moderator', 'executive', 'root', 'dev'].includes(local)) {
      return true;
    }
  }

  // Check env-configured admins
  const envAdmins = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '')
    .toLowerCase()
    .split(',')
    .map(e => e.trim())
    .filter(Boolean);
  if (normEmail && envAdmins.includes(normEmail)) return true;

  // Check cached Firestore admins
  if (normEmail && cachedAdmins.has(normEmail) && cachedAdmins.get(normEmail)?.isActive) return true;
  if (cleanUid && cachedAdmins.has(cleanUid) && cachedAdmins.get(cleanUid)?.isActive) return true;

  // Query Firestore if not found in memory
  if (serverDb) {
    await syncAdminCacheFromFirestore(serverDb);
    if (normEmail && cachedAdmins.has(normEmail) && cachedAdmins.get(normEmail)?.isActive) return true;
    if (cleanUid && cachedAdmins.has(cleanUid) && cachedAdmins.get(cleanUid)?.isActive) return true;

    // Check user document for role == 'admin' or publisherRole == 'Store Administrator'
    if (cleanUid) {
      try {
        const userDoc = await serverGetDoc(serverDoc(serverDb, "users", cleanUid));
        if (userDoc.exists()) {
          const u = userDoc.data();
          if (u.role === 'admin' || u.isAdmin === true || u.publisherRole === 'Store Administrator' || u.publisherRole === 'Super Admin') {
            return true;
          }
        }
      } catch {}
    }
  }

  return false;
}

/**
 * Validates if an administrator has permission to perform an action under the shared RBAC model.
 * All verified store administrators have equal permissions.
 */
export async function hasAdminPermission(
  serverDb: any,
  action: AdminAction,
  email?: string | null,
  uid?: string | null
): Promise<boolean> {
  const isAdmin = await isAuthorizedAdmin(serverDb, email, uid);
  if (!isAdmin) return false;

  const normEmail = (email || '').toLowerCase().trim();
  const cleanUid = (uid || '').trim();

  const record = (normEmail ? cachedAdmins.get(normEmail) : null) || (cleanUid ? cachedAdmins.get(cleanUid) : null);
  if (record && Array.isArray(record.permissions)) {
    return record.permissions.includes(action);
  }

  // Default equality: All administrators have equal access across administrative actions
  return true;
}
