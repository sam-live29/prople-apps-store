import { 
  collection as serverCollection, 
  doc as serverDoc, 
  getDoc as serverGetDoc, 
  getDocs as serverGetDocs, 
  setDoc as serverSetDoc,
  query as serverQuery,
  where as serverWhere,
  limit as serverLimit
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
  "sahabhaiislive@gmail.com",
  "sahanurmolla077@gmail.com",
  "sahanurmolla1777@gmail.com",
  "sahanurmolla7076@gmail.com",
  "sahanurmolla2886@gmail.com",
  "sahanurmolla190@gmail.com",
  "sahanurmolla1290@gmail.com",
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
      const idKey = d.id.toLowerCase().trim();
      const extractedEmail = (
        data.email || 
        data.accountEmail || 
        data.userEmail || 
        (d.id.includes('@') ? d.id : '')
      ).toLowerCase().trim();
      const uid = (data.uid || (!d.id.includes('@') ? d.id : '')).trim();

      const rec: ServerAdminRecord = {
        uid: uid || undefined,
        email: extractedEmail || idKey,
        role: 'Store Administrator',
        permissions: ALL_ADMIN_ACTIONS,
        grantedAt: data.grantedAt || new Date().toISOString(),
        isActive: data.isActive !== false
      };

      if (extractedEmail) newMap.set(extractedEmail, rec);
      if (uid) newMap.set(uid, rec);
      newMap.set(idKey, rec);
      const sanitizedEmail = extractedEmail ? extractedEmail.replace(/[^a-zA-Z0-9_-]/g, '_') : '';
      if (sanitizedEmail) newMap.set(sanitizedEmail, rec);
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
  const sanitizedEmailKey = normEmail ? normEmail.replace(/[^a-zA-Z0-9_-]/g, '_') : '';

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
  if (normEmail && (cachedAdmins.has(normEmail) || (sanitizedEmailKey && cachedAdmins.has(sanitizedEmailKey)))) {
    const r = cachedAdmins.get(normEmail) || cachedAdmins.get(sanitizedEmailKey);
    if (r?.isActive) return true;
  }
  if (cleanUid && cachedAdmins.has(cleanUid) && cachedAdmins.get(cleanUid)?.isActive) return true;

  // Query Firestore if not found in memory
  if (serverDb) {
    await syncAdminCacheFromFirestore(serverDb);
    if (normEmail && (cachedAdmins.has(normEmail) || (sanitizedEmailKey && cachedAdmins.has(sanitizedEmailKey)))) {
      const r = cachedAdmins.get(normEmail) || cachedAdmins.get(sanitizedEmailKey);
      if (r?.isActive) return true;
    }
    if (cleanUid && cachedAdmins.has(cleanUid) && cachedAdmins.get(cleanUid)?.isActive) return true;

    // Check direct doc in admins collection by UID or email
    try {
      if (cleanUid) {
        const directAdminUid = await serverGetDoc(serverDoc(serverDb, "admins", cleanUid));
        if (directAdminUid.exists() && directAdminUid.data()?.isActive !== false) return true;
      }
      if (normEmail) {
        const directAdminEmail = await serverGetDoc(serverDoc(serverDb, "admins", sanitizedEmailKey || normEmail));
        if (directAdminEmail.exists() && directAdminEmail.data()?.isActive !== false) return true;
      }
    } catch {}

    // Check user document for role == 'admin' or publisherRole == 'Store Administrator'
    try {
      if (cleanUid) {
        const userDoc = await serverGetDoc(serverDoc(serverDb, "users", cleanUid));
        if (userDoc.exists()) {
          const u: any = userDoc.data();
          if (u.role === 'admin' || u.isAdmin === true || u.publisherRole === 'Store Administrator' || u.publisherRole === 'Super Admin') {
            return true;
          }
        }
      }
      if (normEmail) {
        const qUser = serverQuery(
          serverCollection(serverDb, "users"),
          serverWhere("email", "==", normEmail),
          serverLimit(1)
        );
        const uSnap = await serverGetDocs(qUser);
        if (!uSnap.empty) {
          const u: any = uSnap.docs[0].data();
          if (u.role === 'admin' || u.isAdmin === true || u.publisherRole === 'Store Administrator' || u.publisherRole === 'Super Admin') {
            return true;
          }
        }
      }
    } catch {}
  }

  return false;
}

/**
 * Validates if an administrator has permission to perform an action under the shared RBAC model.
 * Complete equality across all verified store administrators.
 */
export async function hasAdminPermission(
  serverDb: any,
  action: AdminAction,
  email?: string | null,
  uid?: string | null
): Promise<boolean> {
  const isAdmin = await isAuthorizedAdmin(serverDb, email, uid);
  // Complete equality: all authorized administrators have permission for all administrative actions
  return isAdmin;
}
