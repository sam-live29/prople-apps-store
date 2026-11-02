import { doc, getDoc, collection, onSnapshot, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { UserProfile, AppDetails } from '../types';

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

export interface AdminAccountRecord {
  uid?: string;
  email: string;
  role: 'Super Admin' | 'Store Administrator' | 'Platform Moderator';
  permissions: AdminAction[];
  grantedAt?: string;
  isActive: boolean;
}

// Built-in verified administrator emails (equality across all admins)
export const DEFAULT_ADMIN_EMAILS = [
  'ventureforge.corp@gmail.com',
  'sahanurmolla1777@gmail.com',
  'sahanurmolla7076@gmail.com',
  'sahanurmolla2886@gmail.com',
  'sahanurmolla190@gmail.com',
  'prople.site@gmail.com',
  'prople.org@gmail.com',
  'cloaktailofficial@gmail.com',
  'cloaktailsupport@gmail.com',
];

export const VERIFIED_ADMIN_DOMAIN = '@prople.co.in';

const ALL_ADMIN_ACTIONS: AdminAction[] = [
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

// Role-Based Access Control (RBAC) definition ensuring equality among admins
const ROLE_PERMISSIONS: Record<string, AdminAction[]> = {
  'Super Admin': ALL_ADMIN_ACTIONS,
  'Store Administrator': ALL_ADMIN_ACTIONS,
  'Platform Moderator': [
    'DELETE_APP',
    'UPDATE_APP',
    'RECEIVE_REPORTS',
    'DISMISS_REPORT',
    'DELETE_REVIEW',
    'BAN_LINK',
    'RESTRICT_PUBLISHER'
  ],
};

// In-memory cache for dynamic Firestore admin accounts
const dynamicAdminsByEmail = new Map<string, AdminAccountRecord>();
const dynamicAdminsByUid = new Map<string, AdminAccountRecord>();
let hasSubscribedToAdmins = false;

/**
 * Initializes real-time listener to Firestore 'admins' collection
 * to dynamically fetch and sync admin accounts across the app.
 */
export function initAdminPermissionsSync() {
  if (hasSubscribedToAdmins || typeof window === 'undefined') return;
  hasSubscribedToAdmins = true;

  // Pre-seed default admins
  DEFAULT_ADMIN_EMAILS.forEach(email => {
    const record: AdminAccountRecord = {
      email: email.toLowerCase().trim(),
      role: 'Store Administrator',
      permissions: ALL_ADMIN_ACTIONS,
      isActive: true,
      grantedAt: new Date().toISOString()
    };
    dynamicAdminsByEmail.set(record.email, record);
  });

  try {
    if (!db) return;
    onSnapshot(collection(db, 'admins'), (snapshot) => {
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data && (data.email || docSnap.id.includes('@'))) {
          const email = (data.email || (docSnap.id.includes('@') ? docSnap.id : '')).toLowerCase().trim();
          const uid = (data.uid || (!docSnap.id.includes('@') ? docSnap.id : '')).trim();
          const role = (data.role || 'Store Administrator') as AdminAccountRecord['role'];
          const permissions = Array.isArray(data.permissions) && data.permissions.length > 0
            ? data.permissions
            : (ROLE_PERMISSIONS[role] || ALL_ADMIN_ACTIONS);

          const record: AdminAccountRecord = {
            uid: uid || undefined,
            email,
            role: role === 'Super Admin' ? 'Super Admin' : (role === 'Platform Moderator' ? 'Platform Moderator' : 'Store Administrator'),
            permissions,
            grantedAt: data.grantedAt || data.createdAt,
            isActive: data.isActive !== false
          };

          if (email) dynamicAdminsByEmail.set(email, record);
          if (uid) dynamicAdminsByUid.set(uid, record);
        }
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('admin:permissions:updated'));
      }
    }, (err) => {
      console.warn('[AdminPermissionsService] Firestore admins sync notice:', err);
    });
  } catch (err) {
    console.warn('[AdminPermissionsService] Init listener notice:', err);
  }
}

// Auto-run listener initialization
if (typeof window !== 'undefined') {
  setTimeout(() => initAdminPermissionsSync(), 50);
}

/**
 * Centralized Admin Permissions Service
 * Ensures equal permissions among all administrators based on RBAC.
 */
export const AdminPermissionsService = {
  /**
   * Strictly determines if a given email or UID belongs to an administrator.
   */
  isAdmin(user?: { email?: string; uid?: string; role?: string; isAdmin?: boolean; publisherRole?: string } | null): boolean {
    if (!user) return false;
    const email = (user.email || '').toLowerCase().trim();
    const uid = (user.uid || '').trim();

    // 1. Direct check against dynamic admin maps
    if (email && dynamicAdminsByEmail.has(email) && dynamicAdminsByEmail.get(email)?.isActive) {
      return true;
    }
    if (uid && dynamicAdminsByUid.has(uid) && dynamicAdminsByUid.get(uid)?.isActive) {
      return true;
    }

    // 2. Check built-in admin list
    if (email && DEFAULT_ADMIN_EMAILS.includes(email)) {
      return true;
    }

    // 3. Check @prople.co.in administrative handles
    if (email.endsWith(VERIFIED_ADMIN_DOMAIN)) {
      const local = email.slice(0, -VERIFIED_ADMIN_DOMAIN.length);
      if (['admin', 'security', 'moderator', 'executive', 'root', 'dev'].includes(local)) {
        return true;
      }
    }

    // 4. Check user profile attributes
    if (
      user.role === 'admin' ||
      user.isAdmin === true ||
      user.publisherRole === 'Store Administrator' ||
      user.publisherRole === 'Super Admin'
    ) {
      return true;
    }

    return false;
  },

  /**
   * Validates whether a user can perform a specific administrative action.
   */
  hasPermission(
    action: AdminAction,
    user?: { email?: string; uid?: string; role?: string; isAdmin?: boolean; publisherRole?: string } | null
  ): boolean {
    if (!this.isAdmin(user)) return false;

    const email = (user?.email || '').toLowerCase().trim();
    const uid = (user?.uid || '').trim();

    const record = (email ? dynamicAdminsByEmail.get(email) : null) || (uid ? dynamicAdminsByUid.get(uid) : null);
    if (record) {
      return record.permissions.includes(action);
    }

    // Default: All verified admins have full equality across all admin actions
    return true;
  },

  /**
   * Evaluates if a user can delete an app.
   * Equality rule: ANY administrator can delete ANY application.
   * Non-admins can only delete applications they own.
   */
  canDeleteApp(
    app: { id: string; owner?: string; developerId?: string; creatorUid?: string; developerEmail?: string; publisherEmail?: string; ownerEmail?: string },
    user?: { email?: string; uid?: string; role?: string; isAdmin?: boolean; publisherRole?: string } | null
  ): boolean {
    if (!user) return false;

    // Equal administrative authority across all admins
    if (this.hasPermission('DELETE_APP', user)) {
      return true;
    }

    // Standard publisher ownership check
    const curEmail = (user.email || '').toLowerCase().trim();
    const curUid = (user.uid || '').trim();

    const isOwner = Boolean(
      (curUid && (app.owner === curUid || app.developerId === curUid || app.creatorUid === curUid)) ||
      (curEmail && (
        (app.developerEmail && app.developerEmail.toLowerCase().trim() === curEmail) ||
        (app.publisherEmail && app.publisherEmail.toLowerCase().trim() === curEmail) ||
        (app.ownerEmail && app.ownerEmail.toLowerCase().trim() === curEmail)
      ))
    );

    return isOwner;
  },

  /**
   * Evaluates if a user can take administrative moderation action (private/ban/quarantine) on an app.
   */
  canModerateApp(
    user?: { email?: string; uid?: string; role?: string; isAdmin?: boolean; publisherRole?: string } | null
  ): boolean {
    return this.hasPermission('UPDATE_APP', user);
  },

  /**
   * Evaluates if a user can receive and review reports.
   */
  canReceiveReports(
    user?: { email?: string; uid?: string; role?: string; isAdmin?: boolean; publisherRole?: string } | null
  ): boolean {
    return this.hasPermission('RECEIVE_REPORTS', user);
  },

  /**
   * Evaluates if a user can verify accounts.
   */
  canVerifyAccount(
    user?: { email?: string; uid?: string; role?: string; isAdmin?: boolean; publisherRole?: string } | null
  ): boolean {
    return this.hasPermission('VERIFY_ACCOUNT', user);
  },

  /**
   * Retrieves all registered admin accounts for admin panel display.
   */
  getAllAdminRecords(): AdminAccountRecord[] {
    const map = new Map<string, AdminAccountRecord>();
    DEFAULT_ADMIN_EMAILS.forEach(email => {
      map.set(email, {
        email,
        role: 'Store Administrator',
        permissions: ALL_ADMIN_ACTIONS,
        isActive: true,
        grantedAt: 'System Default'
      });
    });
    dynamicAdminsByEmail.forEach((rec, key) => map.set(key, rec));
    return Array.from(map.values());
  }
};
