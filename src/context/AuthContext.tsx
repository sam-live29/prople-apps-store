import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  signInWithPopup, 
  GoogleAuthProvider,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserProfile, DeveloperKeystore } from '../types';
import { generateDeveloperKeystore } from '../services/keystoreService';
import { safeFetchJson } from '../utils/safeFetch';
import { sanitizeErrorMessage } from '../utils/errorUtils';
import { propagatePublisherNameToAllReleases } from '../services/publisherNameService';
import { AdminPermissionsService, DEFAULT_ADMIN_EMAILS } from '../services/adminPermissionsService';

interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isPublisher: boolean;
  isAdmin: boolean;
  login: (email: string, pass: string) => Promise<void>;
  verifyPasswordStep: (email: string, pass: string) => Promise<void>;
  cancelPendingTwoFactor: () => Promise<void>;
  signup: (email: string, pass: string, name: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  sendEmailOtp: (email: string, name?: string) => Promise<{ success: boolean; delivered?: boolean; message?: string }>;
  verifyEmailOtp: (email: string, code: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<{ success: boolean; delivered?: boolean; message?: string }>;
  resetPasswordWithCode: (email: string, code: string, newPassword: string) => Promise<void>;
  completeExternalAuth: (userData: any) => void;
  logout: () => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
  togglePublisherStatus: (status?: boolean) => void;
  isPublisherOfApp: (appDeveloper?: string, appId?: string, appDeveloperId?: string, appDeveloperEmail?: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_USER_KEY = 'appmarket_user_profile';
const SESSION_PENDING_2FA_KEY = 'prople_pending_2fa';

export const isDeveloperEmail = (email?: string): boolean => {
  if (!email) return false;
  const norm = email.toLowerCase().trim();
  if (DEFAULT_ADMIN_EMAILS.includes(norm)) return true;
  return (
    norm === 'ventureforge.corp@gmail.com' ||
    norm === 'sahanurmolla077@gmail.com' ||
    norm === 'sahanurmolla1777@gmail.com' ||
    norm === 'sahanurmolla7076@gmail.com' ||
    norm === 'sahanurmolla2886@gmail.com' ||
    norm === 'sahanurmolla190@gmail.com' ||
    norm === 'sahanurmolla1290@gmail.com' ||
    norm === 'prople.site@gmail.com' ||
    norm.endsWith('@prople.co.in') ||
    norm === 'prople.org@gmail.com' ||
    norm === 'cloaktailofficial@gmail.com' ||
    norm === 'cloaktailsupport@gmail.com'
  );
};

export const isAdminEmail = (email?: string): boolean => {
  if (!email) return false;
  const norm = email.toLowerCase().trim();
  if (AdminPermissionsService.isAdmin({ email: norm })) return true;
  if (DEFAULT_ADMIN_EMAILS.includes(norm)) return true;
  if (
    norm === 'ventureforge.corp@gmail.com' ||
    norm === 'sahanurmolla077@gmail.com' ||
    norm === 'sahanurmolla1777@gmail.com' ||
    norm === 'sahanurmolla7076@gmail.com' ||
    norm === 'sahanurmolla2886@gmail.com' ||
    norm === 'sahanurmolla190@gmail.com' ||
    norm === 'sahanurmolla1290@gmail.com' ||
    norm === 'prople.site@gmail.com' ||
    norm === 'prople.org@gmail.com' ||
    norm === 'cloaktailofficial@gmail.com' ||
    norm === 'cloaktailsupport@gmail.com'
  ) return true;
  if (norm.endsWith('@prople.co.in')) {
    const local = norm.slice(0, -'@prople.co.in'.length);
    return ['admin', 'security', 'moderator', 'executive', 'root', 'dev'].includes(local);
  }
  return false;
};

// Unified bi-directional account profile resolution across Google and Email authentication
export async function unifyUserProfileAcrossAccounts(
  email: string,
  currentUid: string,
  initialData: Partial<UserProfile>
): Promise<UserProfile> {
  const cleanEmail = (email || '').toLowerCase().trim();
  const isAdminHardcoded = isAdminEmail(cleanEmail);
  const isDevHardcoded = isDeveloperEmail(cleanEmail);

  // Check local saved profile for the exact same account first so recent Settings edits are never lost
  let localAccountData: Partial<UserProfile> | null = null;
  try {
    if (typeof localStorage !== 'undefined') {
      const savedBackup = localStorage.getItem('prople_saved_profile_' + cleanEmail);
      if (savedBackup) {
        const parsedBackup = JSON.parse(savedBackup);
        if (parsedBackup && (parsedBackup as any).nameResetVersion === 'fresh_start_v1') {
          localAccountData = parsedBackup;
        }
      }
      if (!localAccountData) {
        const savedRaw = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
        if (savedRaw) {
          const parsed = JSON.parse(savedRaw);
          if (
            parsed &&
            (parsed as any).nameResetVersion === 'fresh_start_v1' &&
            ((currentUid && parsed.uid === currentUid) ||
              (cleanEmail && (parsed.email || '').toLowerCase().trim() === cleanEmail))
          ) {
            localAccountData = parsed;
          }
        }
      }
    }
  } catch {}

  let mergedIsPublisher = isDevHardcoded ? true : Boolean(initialData.isPublisher || localAccountData?.isPublisher);
  const isInvalidName = (val?: string) =>
    !val ||
    val === 'User' ||
    val === 'Developer' ||
    val === 'Publisher' ||
    val === 'Verified Publisher' ||
    val === 'Verified Developer' ||
    val.toLowerCase() === cleanEmail.split('@')[0];

  const validInitialName = (initialData as any).nameResetVersion === 'fresh_start_v1' && !isInvalidName(initialData.publisherName || initialData.displayName)
    ? (initialData.publisherName || initialData.displayName || '').trim()
    : '';
  const validLocalName = localAccountData && !isInvalidName(localAccountData.publisherName || localAccountData.displayName)
    ? (localAccountData.publisherName || localAccountData.displayName || '').trim()
    : '';

  let mergedPublisherName = validInitialName || validLocalName || '';
  let mergedPublisherRole = isAdminHardcoded
    ? 'Store Administrator'
    : isDevHardcoded
    ? 'Verified Developer'
    : mergedIsPublisher
    ? initialData.publisherRole || localAccountData?.publisherRole || 'Verified Developer'
    : 'Standard User';
  let mergedPublishedAppIds: string[] = Array.from(
    new Set([
      ...(Array.isArray(localAccountData?.publishedAppIds) ? localAccountData!.publishedAppIds! : []),
      ...(Array.isArray(initialData.publishedAppIds) ? initialData.publishedAppIds : []),
    ])
  );
  let mergedKeystore: DeveloperKeystore | undefined = initialData.developerKeystore || localAccountData?.developerKeystore;
  let mergedBio = initialData.bio || localAccountData?.bio || '';
  let mergedPhotoURL = initialData.photoURL || localAccountData?.photoURL;
  let mergedLocation = initialData.location || localAccountData?.location || 'Global';
  let mergedAge = initialData.age || localAccountData?.age || '25';
  let mergedGender = initialData.gender || localAccountData?.gender || 'Prefer not to say';
  let mergedPublisherBio = initialData.publisherBio || localAccountData?.publisherBio || '';
  let mergedPublisherWebsite = initialData.publisherWebsite || localAccountData?.publisherWebsite || '';
  let mergedPublisherGithub = initialData.publisherGithub || localAccountData?.publisherGithub || '';
  let mergedPublisherLocation = initialData.publisherLocation || localAccountData?.publisherLocation || '';
  let mergedLastNameChangedAt = validInitialName ? initialData.lastNameChangedAt : (validLocalName ? localAccountData?.lastNameChangedAt : undefined);
  let mergedNameChangeSessionStartedAt = validInitialName ? initialData.nameChangeSessionStartedAt : (validLocalName ? localAccountData?.nameChangeSessionStartedAt : undefined);
  let isVerifiedAdmin = isAdminHardcoded;
  let hasAuthoritativeClientName = Boolean(mergedPublisherName && mergedLastNameChangedAt);

  // 1. Client-side Firestore check FIRST: directly read user's doc (fast, indexed, authorized by isOwner rule)
  if (currentUid && db && auth.currentUser?.uid === currentUid) {
    try {
      const directDocSnap = await getDoc(doc(db, 'users', currentUid));
      if (directDocSnap && directDocSnap.exists()) {
        const data = directDocSnap.data();
        if (data) {
          if (data.isPublisher) mergedIsPublisher = true;

          if (data.nameResetVersion === 'fresh_start_v1') {
            const docChangedAt = data.lastNameChangedAt ? new Date(data.lastNameChangedAt).getTime() : 0;
            const localChangedAt = localAccountData?.lastNameChangedAt ? new Date(localAccountData.lastNameChangedAt).getTime() : 0;

            if (data.publisherName && !isInvalidName(data.publisherName)) {
              if (!localChangedAt || docChangedAt >= localChangedAt) {
                mergedPublisherName = data.publisherName;
                if (data.lastNameChangedAt) mergedLastNameChangedAt = data.lastNameChangedAt;
                if (data.nameChangeSessionStartedAt) mergedNameChangeSessionStartedAt = data.nameChangeSessionStartedAt;
              }
              hasAuthoritativeClientName = true;
            }
          } else {
            // Fresh start reset: clear legacy un-verified name on this user doc
            setDoc(doc(db, 'users', currentUid), {
              displayName: mergedPublisherName || '',
              publisherName: mergedPublisherName || '',
              lastNameChangedAt: mergedLastNameChangedAt || null,
              nameChangeSessionStartedAt: mergedNameChangeSessionStartedAt || null,
              nameResetVersion: 'fresh_start_v1'
            }, { merge: true }).catch(() => {});
          }
          if (data.publisherRole) {
            if (data.publisherRole === 'Store Administrator' || data.publisherRole === 'Super Admin') {
              mergedPublisherRole = 'Store Administrator';
              isVerifiedAdmin = true;
            } else if (data.publisherRole === 'Verified Developer' && mergedPublisherRole !== 'Store Administrator') {
              mergedPublisherRole = 'Verified Developer';
            }
          }
          if (data.isAdmin || data.role === 'admin') {
            isVerifiedAdmin = true;
            mergedPublisherRole = 'Store Administrator';
            mergedIsPublisher = true;
          }
          if (data.developerKeystore && !mergedKeystore) {
            mergedKeystore = data.developerKeystore;
          }
          if (Array.isArray(data.publishedAppIds)) {
            mergedPublishedAppIds = Array.from(new Set([...mergedPublishedAppIds, ...data.publishedAppIds]));
          }
          if (data.publisherBio && !mergedPublisherBio) mergedPublisherBio = data.publisherBio;
          if (data.publisherWebsite && !mergedPublisherWebsite) mergedPublisherWebsite = data.publisherWebsite;
          if (data.publisherGithub && !mergedPublisherGithub) mergedPublisherGithub = data.publisherGithub;
          if (data.publisherLocation && !mergedPublisherLocation) mergedPublisherLocation = data.publisherLocation;
          if (data.bio !== undefined && !initialData.bio) mergedBio = data.bio;
          if (data.age && !initialData.age) mergedAge = data.age;
          if (data.gender && !initialData.gender) mergedGender = data.gender;
          if (data.location && !initialData.location) mergedLocation = data.location;
          if (data.photoURL && !mergedPhotoURL) mergedPhotoURL = data.photoURL;
        }
      }
    } catch (e) {
      console.warn('[AuthContext] Direct user doc check notice:', e);
    }
  }

  // 2. Server migration and rights transfer with 3.5s timeout protection (never allowed to overwrite an authoritative client publisherName)
  if (currentUid && cleanEmail) {
    try {
      const migratePromise = safeFetchJson<{
        success: boolean;
        user?: any;
        totalAppsClaimed?: number;
        isAdmin?: boolean;
      }>('/api/auth/migrate-user-rights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUid,
          userEmail: cleanEmail,
          displayName: mergedPublisherName || initialData.displayName,
          publisherName: mergedPublisherName,
          lastNameChangedAt: mergedLastNameChangedAt,
          nameChangeSessionStartedAt: mergedNameChangeSessionStartedAt,
          photoURL: mergedPhotoURL
        })
      });

      const timeoutPromise = new Promise<{ ok: false; status: 0; data: null; error: string }>((resolve) => 
        setTimeout(() => resolve({ ok: false, status: 0, data: null, error: 'timeout' }), 3500)
      );

      const res = await Promise.race([migratePromise, timeoutPromise]);

      if (res.ok && res.data?.success && res.data.user) {
        const u = res.data.user;
        if (u.isPublisher) mergedIsPublisher = true;
        if (
          !hasAuthoritativeClientName &&
          u.nameResetVersion === 'fresh_start_v1' &&
          u.publisherName &&
          !isInvalidName(u.publisherName)
        ) {
          mergedPublisherName = u.publisherName;
        }
        if (u.publisherRole) {
          if (u.publisherRole === 'Store Administrator' || u.publisherRole === 'Super Admin') {
            mergedPublisherRole = 'Store Administrator';
            isVerifiedAdmin = true;
          } else if (u.publisherRole === 'Verified Developer' && mergedPublisherRole !== 'Store Administrator') {
            mergedPublisherRole = 'Verified Developer';
          }
        }
        if (u.developerKeystore && !mergedKeystore) {
          mergedKeystore = u.developerKeystore;
        }
        if (Array.isArray(u.publishedAppIds)) {
          mergedPublishedAppIds = Array.from(new Set([...mergedPublishedAppIds, ...u.publishedAppIds]));
        }
        if (u.publisherBio && !mergedPublisherBio) mergedPublisherBio = u.publisherBio;
        if (u.publisherWebsite && !mergedPublisherWebsite) mergedPublisherWebsite = u.publisherWebsite;
        if (u.publisherGithub && !mergedPublisherGithub) mergedPublisherGithub = u.publisherGithub;
        if (u.publisherLocation && !mergedPublisherLocation) mergedPublisherLocation = u.publisherLocation;
        if (u.bio && !mergedBio) mergedBio = u.bio;
        if (u.photoURL && !mergedPhotoURL) mergedPhotoURL = u.photoURL;
        if (!mergedLastNameChangedAt && u.lastNameChangedAt) mergedLastNameChangedAt = u.lastNameChangedAt;
        if (!mergedNameChangeSessionStartedAt && u.nameChangeSessionStartedAt) mergedNameChangeSessionStartedAt = u.nameChangeSessionStartedAt;
        if (res.data.isAdmin) {
          isVerifiedAdmin = true;
          mergedPublisherRole = 'Store Administrator';
        }
      }
    } catch (apiErr) {
      console.warn('[AuthContext] Authoritative server rights transfer notice:', apiErr);
    }
  }

  if (mergedPublishedAppIds.length > 0 || isVerifiedAdmin) {
    mergedIsPublisher = true;
  }

  if (isVerifiedAdmin) {
    mergedPublisherRole = 'Store Administrator';
  }

  if (mergedIsPublisher && !mergedKeystore && currentUid && cleanEmail) {
    mergedKeystore = generateDeveloperKeystore(currentUid, cleanEmail, mergedPublisherName);
  }

  const unified: UserProfile = {
    uid: currentUid,
    email: cleanEmail,
    displayName: mergedPublisherName || '',
    photoURL: mergedPhotoURL,
    age: mergedAge,
    gender: mergedGender,
    location: mergedLocation,
    bio: mergedBio,
    isEmailVerified: Boolean(initialData.isEmailVerified),
    isPublisher: mergedIsPublisher,
    publisherName: mergedPublisherName || '',
    publisherRole: mergedPublisherRole,
    publishedAppIds: mergedPublishedAppIds,
    developerKeystore: mergedKeystore,
    publisherBio: mergedPublisherBio,
    publisherWebsite: mergedPublisherWebsite,
    publisherEmail: cleanEmail,
    publisherGithub: mergedPublisherGithub,
    publisherLocation: mergedPublisherLocation,
    lastNameChangedAt: mergedLastNameChangedAt,
    nameChangeSessionStartedAt: mergedNameChangeSessionStartedAt,
    ...({ nameResetVersion: 'fresh_start_v1' } as any)
  };

  return unified;
}

// Sync profile to Firestore
async function syncUserProfileToFirestore(profile: UserProfile): Promise<void> {
  if (
    !profile.uid || 
    profile.uid === 'developer' ||
    profile.uid === 'dev-publisher' ||
    profile.email === 'developer@prople.store'
  ) {
    return;
  }
  try {
    // Only write directly to Firestore from the client if the user is authenticated in Firebase Auth
    // and matches the document UID. Unauthenticated client writes are correctly rejected by security rules.
    if (auth.currentUser && auth.currentUser.uid === profile.uid) {
      const userRef = doc(db, 'users', profile.uid);
      await setDoc(userRef, {
        uid: profile.uid,
        email: profile.email || '',
        displayName: profile.publisherName || profile.displayName || '',
        photoURL: profile.photoURL || null,
        age: profile.age || '25',
        gender: profile.gender || 'Prefer not to say',
        location: profile.location || 'Global',
        bio: profile.bio || '',
        isEmailVerified: Boolean(profile.isEmailVerified),
        isPublisher: Boolean(profile.isPublisher),
        publisherName: profile.publisherName || profile.displayName || '',
        publisherRole: profile.publisherRole || (isDeveloperEmail(profile.email) ? 'Store Administrator' : (profile.isPublisher ? 'Verified Developer' : 'Standard User')),
        publishedAppIds: profile.publishedAppIds || [],
        developerKeystore: profile.developerKeystore || null,
        publisherBio: profile.publisherBio || '',
        publisherWebsite: profile.publisherWebsite || '',
        publisherEmail: profile.publisherEmail || profile.email || '',
        publisherGithub: profile.publisherGithub || '',
        publisherLocation: profile.publisherLocation || profile.location || '',
        lastNameChangedAt: profile.lastNameChangedAt || null,
        nameChangeSessionStartedAt: profile.nameChangeSessionStartedAt || null,
        nameResetVersion: 'fresh_start_v1',
        updatedAt: serverTimestamp()
      }, { merge: true });
    }

    // Ensure all apps and rights matching this verified email have ownership and profile migrated to current user's UID
    if (profile.email) {
      safeFetchJson<{ success: boolean; totalClaimed?: number; appIds?: string[] }>('/api/apps/migrate-ownership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.uid, userEmail: profile.email })
      }).catch(() => {});

      safeFetchJson<{ success: boolean; user?: any }>('/api/auth/migrate-user-rights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: profile.uid, 
          userEmail: profile.email,
          displayName: profile.publisherName || profile.displayName,
          publisherName: profile.publisherName || profile.displayName,
          lastNameChangedAt: profile.lastNameChangedAt,
          nameChangeSessionStartedAt: profile.nameChangeSessionStartedAt,
          photoURL: profile.photoURL
        })
      }).catch(() => {});
    }
  } catch (err) {
    console.warn('Could not sync user profile to Firestore:', err);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const pendingTwoFactorRef = React.useRef<boolean>((() => {
    try {
      return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(SESSION_PENDING_2FA_KEY) === '1';
    } catch {
      return false;
    }
  })());
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      // If 2-step verification OTP is still pending, do not hydrate user session prematurely
      if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(SESSION_PENDING_2FA_KEY) === '1') {
        return null;
      }
      // One-time fresh start reset of all stored user names
      if (typeof localStorage !== 'undefined' && localStorage.getItem('prople_fresh_names_reset_v1') !== 'done') {
        localStorage.setItem('prople_fresh_names_reset_v1', 'done');
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k === LOCAL_STORAGE_USER_KEY || k.startsWith('prople_saved_profile_'))) {
            try {
              const raw = localStorage.getItem(k);
              if (raw) {
                const p = JSON.parse(raw);
                if (p && typeof p === 'object') {
                  p.displayName = '';
                  p.publisherName = '';
                  delete p.lastNameChangedAt;
                  delete p.nameChangeSessionStartedAt;
                  p.nameResetVersion = 'fresh_start_v1';
                  localStorage.setItem(k, JSON.stringify(p));
                }
              }
            } catch {}
          }
        }
        safeFetchJson('/api/publishers/reset-all-names', { method: 'POST' }).catch(() => {});
      }

      // Purge any legacy inquiry status
      localStorage.removeItem('developer_inquiry_status');
      const saved = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Automatically purge any stale mock, synthetic, or fake "Google Developer" accounts
        if (
          !parsed.email ||
          parsed.email === 'developer@prople.store' ||
          parsed.displayName === 'Google Developer' ||
          parsed.displayName === 'Developer' ||
          parsed.publisherRole === 'Developer' ||
          parsed.uid === 'developer' ||
          parsed.uid === 'dev-publisher'
        ) {
          localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
          return null;
        }
        if (parsed.nameResetVersion !== 'fresh_start_v1') {
          parsed.displayName = '';
          parsed.publisherName = '';
          delete parsed.lastNameChangedAt;
          delete parsed.nameChangeSessionStartedAt;
          parsed.nameResetVersion = 'fresh_start_v1';
          localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(parsed));
        }
        // If not a store admin or verified publisher, ensure standard user role
        if (!isDeveloperEmail(parsed.email) && !parsed.isPublisher) {
          parsed.publisherRole = 'Standard User';
          parsed.isPublisher = false;
        }
        return parsed;
      }

      // Check preserved publisher name across sessions / guest / after logout
      const preservedName = localStorage.getItem('prople_preserved_publisher_name');
      if (preservedName && preservedName.trim()) {
        const guestUid = localStorage.getItem('prople_guest_uid') || `guest_${Date.now()}`;
        return {
          uid: guestUid,
          email: '',
          displayName: preservedName.trim(),
          publisherName: preservedName.trim(),
          publisherRole: 'Standard User',
          isPublisher: true,
          publishedAppIds: [],
          isEmailVerified: false,
          nameResetVersion: 'fresh_start_v1'
        } as any;
      }
    } catch {
      // fallback
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Safety release: guarantee that loading state is never blocked indefinitely
    const safetyTimer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        // Gate 2-step verification: Do not log user in until Step 2 (OTP) is verified
        let isPending2FA = pendingTwoFactorRef.current;
        try {
          if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(SESSION_PENDING_2FA_KEY) === '1') {
            isPending2FA = true;
          }
        } catch {}
        if (isPending2FA) {
          setIsLoading(false);
          clearTimeout(safetyTimer);
          return;
        }

        // Release loading immediately so page and modals are never blocked
        setIsLoading(false);
        clearTimeout(safetyTimer);

        let remoteData: Partial<UserProfile> = {};
        try {
          const userSnapPromise = getDoc(doc(db, 'users', fbUser.uid));
          const timeoutPromise = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 2000));
          const userSnap = await Promise.race([userSnapPromise, timeoutPromise]) as any;
          if (userSnap && userSnap.exists()) {
            remoteData = userSnap.data() as Partial<UserProfile>;
          }
        } catch {
          // Fallback if offline/in initial state
        }

        const email = fbUser.email || remoteData.email || '';
        if (email) {
          try {
            const isFreshRemote = (remoteData as any).nameResetVersion === 'fresh_start_v1';
            const unified = await unifyUserProfileAcrossAccounts(email, fbUser.uid, {
              ...remoteData,
              email,
              displayName: isFreshRemote ? (remoteData.publisherName || remoteData.displayName || '') : '',
              publisherName: isFreshRemote ? (remoteData.publisherName || '') : '',
              photoURL: remoteData.photoURL || fbUser.photoURL || undefined,
              isEmailVerified: fbUser.emailVerified || remoteData.isEmailVerified,
            });
            setUser(unified);
            try {
              localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(unified));
              if (unified.publisherName) {
                localStorage.setItem('prople_preserved_publisher_name', unified.publisherName);
                localStorage.setItem('prople_preserved_display_name', unified.publisherName);
              }
            } catch {}
            syncUserProfileToFirestore(unified);
          } catch (e) {
            console.warn('[AuthContext] Auth state profile sync notice:', e);
          }
        }
      } else {
        // When not authenticated with Firebase, maintain any active verified email/OTP session or preserved publisher name
        setUser((prev) => {
          if (prev && prev.isEmailVerified && prev.email) {
            return prev;
          }
          try {
            const saved = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
            if (saved) {
              const parsed = JSON.parse(saved);
              if (parsed && ((parsed.isEmailVerified && parsed.email) || parsed.publisherName)) {
                return parsed;
              }
            }
            const preserved = localStorage.getItem('prople_preserved_publisher_name');
            if (preserved && preserved.trim()) {
              const guestUid = localStorage.getItem('prople_guest_uid') || `guest_${Date.now()}`;
              return {
                uid: guestUid,
                email: '',
                displayName: preserved.trim(),
                publisherName: preserved.trim(),
                publisherRole: 'Standard User',
                isPublisher: true,
                publishedAppIds: [],
                isEmailVerified: false,
                nameResetVersion: 'fresh_start_v1'
              } as any;
            }
          } catch {}
          return null;
        });
        setIsLoading(false);
        clearTimeout(safetyTimer);
      }
    });

    // Cross-tab and cross-window auth broadcast listener
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        channel = new BroadcastChannel('prople_auth_sync');
        channel.onmessage = (event) => {
          if (event?.data?.type === 'AUTH_SUCCESS' && event.data.user) {
            setUser(event.data.user);
            try {
              localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(event.data.user));
            } catch {}
          }
        };
      }
    } catch {}

    const handleStorage = (e: StorageEvent) => {
      if (e.key === LOCAL_STORAGE_USER_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && parsed.email) {
            setUser(parsed);
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      unsubscribe();
      channel?.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Proactive migration and rights unification on active user session
  useEffect(() => {
    if (user?.uid && user?.email) {
      safeFetchJson<{ success: boolean; user?: any; totalAppsClaimed?: number; isAdmin?: boolean }>('/api/auth/migrate-user-rights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          userEmail: user.email,
          displayName: user.publisherName || user.displayName,
          publisherName: user.publisherName,
          lastNameChangedAt: user.lastNameChangedAt,
          nameChangeSessionStartedAt: user.nameChangeSessionStartedAt,
          photoURL: user.photoURL
        })
      }).then(res => {
        if (res.ok && res.data?.success && res.data.user) {
          const u = res.data.user;
          setUser(prev => {
            if (!prev || prev.uid !== user.uid) return prev;
            const keepExistingName = Boolean(
              prev.publisherName &&
              prev.publisherName !== 'User' &&
              prev.publisherName !== 'Developer'
            );
            const updated: UserProfile = {
              ...prev,
              isPublisher: Boolean(prev.isPublisher || u.isPublisher),
              publisherName: keepExistingName ? prev.publisherName : (u.publisherName || prev.publisherName),
              displayName: keepExistingName ? (prev.publisherName || prev.displayName) : (u.publisherName || prev.displayName),
              publisherRole: u.publisherRole === 'Store Administrator' ? 'Store Administrator' : (prev.publisherRole || u.publisherRole),
              publishedAppIds: Array.isArray(u.publishedAppIds)
                ? Array.from(new Set([...(prev.publishedAppIds || []), ...u.publishedAppIds]))
                : prev.publishedAppIds,
              developerKeystore: prev.developerKeystore || u.developerKeystore,
              publisherBio: prev.publisherBio || u.publisherBio,
              publisherWebsite: prev.publisherWebsite || u.publisherWebsite,
              publisherGithub: prev.publisherGithub || u.publisherGithub,
              publisherLocation: prev.publisherLocation || u.publisherLocation,
            };
            try {
              localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(updated));
            } catch {}
            return updated;
          });
        }
      }).catch(() => {});
    }
  }, [user?.uid, user?.email]);

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    const cleanEmail = email.trim();

    try {
      // 1. Enterprise Security Check: Verify 5 failed attempts per 24hr and IP lockout status
      try {
        const { ok: secOk, data: secData } = await safeFetchJson<{
          success: boolean;
          allowed: boolean;
          reason?: string;
          isIpLocked?: boolean;
        }>('/api/auth/check-security-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail }),
        });

        if (secOk && secData && !secData.allowed) {
          const secError = new Error(secData.reason || 'Login is temporarily restricted due to security policy.');
          (secError as any).code = secData.isIpLocked ? 'auth/ip-locked' : 'auth/too-many-requests';
          throw secError;
        }
      } catch (checkErr: any) {
        if (checkErr?.code === 'auth/ip-locked' || checkErr?.code === 'auth/too-many-requests') {
          throw checkErr;
        }
      }

      let cred: any = null;
      let firebaseError: any = null;

      try {
        cred = await signInWithEmailAndPassword(auth, cleanEmail, pass);
      } catch (fbErr: any) {
        firebaseError = fbErr;
      }

      if (cred?.user) {
        // Reset failed login attempts on successful login
        safeFetchJson('/api/auth/report-successful-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail }),
        }).catch(() => {});

        const userEmail = cred.user.email || cleanEmail;
        
        let remoteData: Partial<UserProfile> = {};
        try {
          const snap = await getDoc(doc(db, 'users', cred.user.uid));
          if (snap.exists()) {
            remoteData = snap.data() as Partial<UserProfile>;
          }
        } catch {}

        const isFreshRemote = (remoteData as any).nameResetVersion === 'fresh_start_v1';
        const unified = await unifyUserProfileAcrossAccounts(userEmail, cred.user.uid, {
          ...remoteData,
          email: userEmail,
          displayName: isFreshRemote ? (remoteData.publisherName || remoteData.displayName || '') : '',
          publisherName: isFreshRemote ? (remoteData.publisherName || '') : '',
          photoURL: cred.user.photoURL || undefined,
          isEmailVerified: cred.user.emailVerified,
        });

        setUser(unified);
        localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(unified));
        syncUserProfileToFirestore(unified);
        return;
      }

      // If Firebase Auth failed, check server-authoritative password verification as high-availability fallback
      if (firebaseError) {
        try {
          const { ok, data } = await safeFetchJson<{
            success: boolean;
            user?: any;
            error?: string;
          }>('/api/auth/verify-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: cleanEmail, password: pass }),
          });

          if (ok && data?.success && data.user) {
            const vUser = data.user;
            const userEmail = vUser.email || cleanEmail;

            let remoteData: Partial<UserProfile> = {};
            try {
              const snap = await getDoc(doc(db, 'users', vUser.uid));
              if (snap.exists()) {
                remoteData = snap.data() as Partial<UserProfile>;
              }
            } catch {}

            const isFreshRemote = (remoteData as any).nameResetVersion === 'fresh_start_v1' || vUser.nameResetVersion === 'fresh_start_v1';
            const unified = await unifyUserProfileAcrossAccounts(userEmail, vUser.uid, {
              ...vUser,
              ...remoteData,
              email: userEmail,
              displayName: isFreshRemote ? (remoteData.publisherName || vUser.publisherName || remoteData.displayName || vUser.displayName || '') : '',
              publisherName: isFreshRemote ? (remoteData.publisherName || vUser.publisherName || '') : '',
              photoURL: vUser.photoURL || undefined,
              isEmailVerified: true,
            });

            setUser(unified);
            localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(unified));
            syncUserProfileToFirestore(unified);
            return;
          }
        } catch (serverAuthErr: any) {
          console.warn('[AuthContext] Server verification fallback notice:', serverAuthErr);
        }
      }

      // Both Firebase and server fallback failed: Register failed login strike in security audit log
      try {
        const { data: failData } = await safeFetchJson<{
          success: boolean;
          isLocked: boolean;
          strikeCount: number;
          message?: string;
        }>('/api/auth/report-failed-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            reason: firebaseError?.code || firebaseError?.message || 'Failed password login',
          }),
        });

        if (failData?.isLocked) {
          const lockError = new Error(failData.message || 'Access denied: Your IP address has been locked due to exceeding 20 failed security verification attempts.');
          (lockError as any).code = 'auth/ip-locked';
          throw lockError;
        }
      } catch (logErr: any) {
        if (logErr?.code === 'auth/ip-locked') {
          throw logErr;
        }
      }

      console.warn('[AuthContext] Login notice:', firebaseError?.code || firebaseError?.message);
      throw firebaseError || new Error('Invalid email or password.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Step 1 of 2-Step Verification (2FA) for existing user login:
   * Verifies email + password against security rate limits, Firebase Auth, and server hash store
   * WITHOUT logging the user into the active session yet, then dispatches a 6-digit OTP to their email.
   */
  const verifyPasswordStep = async (email: string, pass: string) => {
    setIsLoading(true);
    const cleanEmail = email.trim();

    try {
      // 1. Pre-flight Security Check: Verify 5 failed attempts per 24hr and IP lockout status
      try {
        const { ok: secOk, data: secData } = await safeFetchJson<{
          success: boolean;
          allowed: boolean;
          reason?: string;
          isIpLocked?: boolean;
        }>('/api/auth/check-security-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail }),
        });

        if (secOk && secData && !secData.allowed) {
          const secError = new Error(secData.reason || 'Login is temporarily restricted due to security policy.');
          (secError as any).code = secData.isIpLocked ? 'auth/ip-locked' : 'auth/too-many-requests';
          throw secError;
        }
      } catch (checkErr: any) {
        if (checkErr?.code === 'auth/ip-locked' || checkErr?.code === 'auth/too-many-requests') {
          throw checkErr;
        }
      }

      // Activate 2FA gate before testing Firebase credentials so onAuthStateChanged does not log in prematurely
      pendingTwoFactorRef.current = true;
      try {
        sessionStorage.setItem(SESSION_PENDING_2FA_KEY, '1');
      } catch {}

      let passwordVerified = false;
      let firebaseError: any = null;

      try {
        const cred = await signInWithEmailAndPassword(auth, cleanEmail, pass);
        if (cred?.user) {
          passwordVerified = true;
        }
      } catch (fbErr: any) {
        firebaseError = fbErr;
      }

      // Fallback to server-authoritative password verification if Firebase client SDK rejected or was unreachable
      if (!passwordVerified) {
        try {
          const { ok, data } = await safeFetchJson<{
            success: boolean;
            user?: any;
            error?: string;
          }>('/api/auth/verify-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: cleanEmail, password: pass }),
          });

          if (ok && data?.success && data.user) {
            passwordVerified = true;
          }
        } catch (serverAuthErr: any) {
          console.warn('[AuthContext] 2FA server password verification notice:', serverAuthErr);
        }
      }

      if (!passwordVerified) {
        pendingTwoFactorRef.current = false;
        try {
          sessionStorage.removeItem(SESSION_PENDING_2FA_KEY);
        } catch {}

        // Register failed login strike in security audit log
        try {
          const { data: failData } = await safeFetchJson<{
            success: boolean;
            isLocked: boolean;
            strikeCount: number;
            message?: string;
          }>('/api/auth/report-failed-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: cleanEmail,
              reason: firebaseError?.code || firebaseError?.message || 'Failed password login',
            }),
          });

          if (failData?.isLocked) {
            const lockError = new Error(failData.message || 'Access denied: Your IP address has been locked due to exceeding 20 failed security verification attempts.');
            (lockError as any).code = 'auth/ip-locked';
            throw lockError;
          }
        } catch (logErr: any) {
          if (logErr?.code === 'auth/ip-locked') {
            throw logErr;
          }
        }

        throw firebaseError || new Error('Invalid email or password.');
      }

      // Password is valid! Now dispatch 6-digit OTP for Step 2 verification
      const { ok: otpOk, data: otpData, error: otpErr } = await safeFetchJson<{
        success: boolean;
        message?: string;
        error?: string;
      }>('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });

      if (!otpOk || !otpData?.success) {
        pendingTwoFactorRef.current = false;
        try {
          sessionStorage.removeItem(SESSION_PENDING_2FA_KEY);
        } catch {}
        try {
          await signOut(auth);
        } catch {}
        throw new Error(otpData?.error || otpErr || 'Password verified, but failed to send 2-step verification code. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const cancelPendingTwoFactor = async () => {
    pendingTwoFactorRef.current = false;
    try {
      sessionStorage.removeItem(SESSION_PENDING_2FA_KEY);
    } catch {}
    try {
      await signOut(auth);
    } catch {}
  };

  const signup = async (email: string, pass: string, name: string) => {
    setIsLoading(true);
    const cleanEmail = (email || '').toLowerCase().trim();
    const cleanName = (name || '').trim();
    try {
      let userUid = '';
      let cred: any = null;

      try {
        cred = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
        if (cleanName && cred?.user) {
          await updateProfile(cred.user, { displayName: cleanName }).catch(() => {});
        }
        userUid = cred?.user?.uid || '';
      } catch (fbErr: any) {
        // If Firebase Auth does not have Email/Password enabled (auth/operation-not-allowed),
        // gracefully fall back to server-authoritative registration
        if (fbErr?.code === 'auth/operation-not-allowed') {
          console.warn('[AuthContext] Firebase Email/Password not enabled in Firebase Console; using server-authoritative credential store.');
        } else {
          throw fbErr;
        }
      }

      if (!userUid) {
        userUid = 'usr_email_' + (typeof btoa !== 'undefined' ? btoa(cleanEmail).replace(/=/g, '').slice(0, 24) : 'id_' + Date.now());
      }

      // Authoritative server-side password & user sync
      try {
        await safeFetchJson('/api/auth/register-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, password: pass, displayName: cleanName, uid: userUid }),
        });
      } catch (serverErr) {
        console.warn('[AuthContext] Server register-user notice:', serverErr);
      }

      const nowTs = cleanName ? Date.now() : undefined;
      const unified = await unifyUserProfileAcrossAccounts(cleanEmail, userUid, {
        email: cleanEmail,
        displayName: cleanName,
        publisherName: cleanName,
        lastNameChangedAt: nowTs,
        nameChangeSessionStartedAt: nowTs,
        photoURL: cred?.user?.photoURL || undefined,
        isEmailVerified: true,
        ...({ nameResetVersion: 'fresh_start_v1' } as any)
      });

      setUser(unified);
      localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(unified));
      syncUserProfileToFirestore(unified);
    } catch (err: any) {
      console.warn('[AuthContext] Signup notice:', err?.code || err?.message || err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    setIsLoading(true);
    let resolvedUser: UserProfile | null = null;
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      // Enforce Google account picker so user always chooses a legitimate account
      provider.setCustomParameters({
        prompt: 'select_account'
      });

      // 45-second timeout protection in case the browser popup is abandoned or suppressed
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          const timeoutErr: any = new Error('Google sign-in timed out. Please try again.');
          timeoutErr.code = 'auth/timeout';
          reject(timeoutErr);
        }, 45000);
      });

      const cred = await Promise.race([
        signInWithPopup(auth, provider),
        timeoutPromise
      ]);

      if (!cred || !cred.user || !cred.user.email) {
        throw new Error('Please select a legitimate Google account to sign in.');
      }

      const email = cred.user.email.toLowerCase().trim();

      // Clear any pending 2FA gate since Google OAuth provides verified email authentication
      pendingTwoFactorRef.current = false;
      try {
        sessionStorage.removeItem(SESSION_PENDING_2FA_KEY);
      } catch {}

      // Retrieve any previous local profile cache for immediate zero-latency population
      let cachedProfile: Partial<UserProfile> = {};
      try {
        const persistentSaved = localStorage.getItem('prople_saved_profile_' + email);
        if (persistentSaved) {
          const p = JSON.parse(persistentSaved);
          if (p && p.nameResetVersion === 'fresh_start_v1') {
            cachedProfile = p;
          }
        }
        if (!cachedProfile.publisherName) {
          const saved = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
          if (saved) {
            const p = JSON.parse(saved);
            if (p && p.nameResetVersion === 'fresh_start_v1' && p.email && p.email.toLowerCase() === email) {
              cachedProfile = p;
            }
          }
        }
      } catch {}

      const isAdminHardcoded = isAdminEmail(email);
      const isDevHardcoded = isDeveloperEmail(email);

      // 1. Fast, optimistic profile: do not pre-profile name from Google account so user can set and verify availability
      resolvedUser = {
        uid: cred.user.uid,
        email,
        displayName: cachedProfile.publisherName || cachedProfile.displayName || '',
        photoURL: cred.user.photoURL || cachedProfile.photoURL,
        age: cachedProfile.age || '25',
        gender: cachedProfile.gender || 'Prefer not to say',
        location: cachedProfile.location || 'Global',
        bio: cachedProfile.bio || '',
        isEmailVerified: true,
        isPublisher: cachedProfile.isPublisher ?? (isAdminHardcoded || isDevHardcoded),
        publisherName: cachedProfile.publisherName || cachedProfile.displayName || '',
        publisherRole: cachedProfile.publisherRole || (isAdminHardcoded ? 'Store Administrator' : (isDevHardcoded ? 'Verified Developer' : 'Standard User')),
        publishedAppIds: cachedProfile.publishedAppIds || [],
        developerKeystore: cachedProfile.developerKeystore,
        publisherBio: cachedProfile.publisherBio || '',
        publisherWebsite: cachedProfile.publisherWebsite || '',
        publisherEmail: email,
        publisherGithub: cachedProfile.publisherGithub || '',
        publisherLocation: cachedProfile.publisherLocation || '',
        ...({ nameResetVersion: 'fresh_start_v1' } as any)
      };

      setUser(resolvedUser);
      try {
        localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(resolvedUser));
      } catch {}

      // Immediately release loading indicator so dialog and buttons close instantly
      setIsLoading(false);

      // 2. Asynchronously enrich rights, keystore & publisher apps in background (non-blocking)
      (async () => {
        let remoteData: Partial<UserProfile> = {};
        try {
          const snapPromise = getDoc(doc(db, 'users', cred.user.uid));
          const snapTimeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 2500));
          const snap = await Promise.race([snapPromise, snapTimeout]) as any;
          if (snap && snap.exists()) {
            remoteData = snap.data() as Partial<UserProfile>;
          }
        } catch (docErr) {
          console.warn('[AuthContext] Fast user doc check notice:', docErr);
        }

        try {
          const unified = await unifyUserProfileAcrossAccounts(email, cred.user.uid, {
            ...resolvedUser,
            ...remoteData
          });
          setUser(unified);
          try {
            localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(unified));
          } catch {}
          syncUserProfileToFirestore(unified);
        } catch (enrichErr) {
          console.warn('[AuthContext] Background profile unification notice:', enrichErr);
        }
      })().catch(() => {});

    } catch (err: any) {
      console.warn('[AuthContext] Google sign-in notice:', err?.code || err?.message || err);
      // Only reset user if credentials were not obtained
      if (!resolvedUser) {
        setUser(null);
        try {
          localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
        } catch {}
      }

      let message = 'Google sign-in could not be completed.';
      if (err?.code === 'auth/popup-closed-by-user') {
        message = 'Google account selection was closed before signing in. Please select your Google account to proceed.';
      } else if (err?.code === 'auth/popup-blocked') {
        message = 'Google sign-in popup was blocked by your browser. Please allow popups or open in a new window to select your Google account.';
      } else if (err?.code === 'auth/cancelled-popup-request') {
        message = 'Google sign-in was cancelled. Please try again.';
      } else if (err?.code === 'auth/timeout') {
        message = 'Google sign-in timed out. Please try again.';
      } else if (err?.code === 'auth/account-exists-with-different-credential') {
        message = 'An account already exists with this email address under a different login method.';
      } else if (err?.message) {
        message = err.message;
      }
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const sendEmailOtp = async (email: string, name?: string) => {
    setIsLoading(true);
    const cleanEmail = email.toLowerCase().trim();
    try {
      const { ok, data, error } = await safeFetchJson<{ 
        success: boolean; 
        delivered?: boolean;
        challengeToken?: string;
        message?: string; 
        error?: string;
      }>('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, name: name?.trim() }),
      });

      if (!ok || !data?.success) {
        throw new Error(data?.error || error || 'Failed to dispatch verification code. Please try again.');
      }

      if (data?.challengeToken) {
        try {
          sessionStorage.setItem('prople_challenge_token_' + cleanEmail, data.challengeToken);
        } catch {}
      }

      return { 
        success: true, 
        delivered: data?.delivered ?? true,
        challengeToken: data?.challengeToken,
        message: data?.message || `A verification code has been dispatched to ${cleanEmail}.`
      };
    } finally {
      setIsLoading(false);
    }
  };

  const verifyEmailOtp = async (email: string, code: string) => {
    setIsLoading(true);
    const cleanEmail = email.toLowerCase().trim();
    const cleanCode = code.trim();
    try {
      if (!/^\d{6}$/.test(cleanCode)) {
        throw new Error('Please enter a valid 6-digit verification code.');
      }

      let challengeToken: string | undefined;
      try {
        challengeToken = sessionStorage.getItem('prople_challenge_token_' + cleanEmail) || undefined;
      } catch {}

      const { ok, data, error } = await safeFetchJson<{ success: boolean; user?: any; error?: string }>('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, code: cleanCode, challengeToken }),
      });

      if (!ok || !data?.success || !data?.user) {
        throw new Error(data?.error || error || 'Incorrect verification code. Please check your email and enter the latest 6 digits.');
      }

      const verifiedUser = data.user;

      // Clear 2FA pending gate now that Step 2 OTP is verified
      pendingTwoFactorRef.current = false;
      try {
        sessionStorage.removeItem(SESSION_PENDING_2FA_KEY);
        sessionStorage.removeItem('prople_challenge_token_' + cleanEmail);
      } catch {}

      const activeFbUid = auth.currentUser?.uid;
      const resolvedUid = activeFbUid || verifiedUser.uid;
      const userEmail = verifiedUser.email || cleanEmail;

      let remoteData: Partial<UserProfile> = {};
      try {
        const snap = await getDoc(doc(db, 'users', resolvedUid));
        if (snap.exists()) {
          remoteData = snap.data() as Partial<UserProfile>;
        }
      } catch {}

      const isFreshRemote = (remoteData as any).nameResetVersion === 'fresh_start_v1' || verifiedUser.nameResetVersion === 'fresh_start_v1';
      const unified = await unifyUserProfileAcrossAccounts(userEmail, resolvedUid, {
        ...verifiedUser,
        ...remoteData,
        email: userEmail,
        displayName: isFreshRemote ? (remoteData.publisherName || verifiedUser.publisherName || remoteData.displayName || verifiedUser.displayName || '') : '',
        publisherName: isFreshRemote ? (remoteData.publisherName || verifiedUser.publisherName || '') : '',
        isEmailVerified: true,
      });

      setUser(unified);
      localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(unified));
      syncUserProfileToFirestore(unified);
    } finally {
      setIsLoading(false);
    }
  };

  const forgotPassword = async (email: string) => {
    setIsLoading(true);
    const cleanEmail = email.toLowerCase().trim();
    try {
      // Dispatch server-authoritative branded HTML email with 6-digit OTP & direct reset link via Resend.com
      const { ok, data, error } = await safeFetchJson<{
        success: boolean;
        delivered?: boolean;
        challengeToken?: string;
        message?: string; 
        error?: string;
      }>('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, name: user?.displayName }),
      });

      if (!ok || !data?.success) {
        throw new Error(data?.error || error || 'Failed to dispatch password reset code. Please try again.');
      }

      if (data?.challengeToken) {
        try {
          sessionStorage.setItem('prople_challenge_token_' + cleanEmail, data.challengeToken);
        } catch {}
      }

      return {
        success: true,
        delivered: data?.delivered ?? true,
        challengeToken: data?.challengeToken,
        message: data?.message || `Password reset link and verification code sent to ${cleanEmail}. Please check your inbox or spam folder.`,
      };
    } finally {
      setIsLoading(false);
    }
  };

  const resetPasswordWithCode = async (email: string, code: string, newPassword: string) => {
    setIsLoading(true);
    const cleanEmail = email.toLowerCase().trim();
    const cleanCode = code.trim();
    try {
      // If code is a Firebase oobCode (from Firebase action link), confirm directly with Firebase Auth
      if (cleanCode.length > 8 || !/^\d{6}$/.test(cleanCode)) {
        try {
          const { confirmPasswordReset } = await import('firebase/auth');
          await confirmPasswordReset(auth, cleanCode, newPassword);
        } catch (oobErr: any) {
          console.warn('[AuthContext] confirmPasswordReset notice:', oobErr?.message);
        }
      }

      let challengeToken: string | undefined;
      try {
        challengeToken = sessionStorage.getItem('prople_challenge_token_' + cleanEmail) || undefined;
      } catch {}

      const { ok, data, error } = await safeFetchJson<{
        success: boolean;
        message?: string;
        user?: any;
        error?: string;
      }>('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, code: cleanCode, newPassword, challengeToken }),
      });

      if (!ok || !data?.success || !data?.user) {
        throw new Error(data?.error || error || 'Incorrect verification code. Please check your email and enter the latest 6 digits.');
      }

      const verifiedUser = data.user;

      // If user is logged into Firebase, also update Firebase password
      if (auth.currentUser && auth.currentUser.email === cleanEmail) {
        try {
          const { updatePassword } = await import('firebase/auth');
          await updatePassword(auth.currentUser, newPassword);
        } catch {}
      }

      const userEmail = verifiedUser.email || cleanEmail;

      let remoteData: Partial<UserProfile> = {};
      try {
        const snap = await getDoc(doc(db, 'users', verifiedUser.uid));
        if (snap.exists()) {
          remoteData = snap.data() as Partial<UserProfile>;
        }
      } catch {}

      const isFreshRemote = (remoteData as any).nameResetVersion === 'fresh_start_v1' || verifiedUser.nameResetVersion === 'fresh_start_v1';
      const unified = await unifyUserProfileAcrossAccounts(userEmail, verifiedUser.uid, {
        ...verifiedUser,
        ...remoteData,
        email: userEmail,
        displayName: isFreshRemote ? (remoteData.publisherName || verifiedUser.publisherName || remoteData.displayName || verifiedUser.displayName || '') : '',
        publisherName: isFreshRemote ? (remoteData.publisherName || verifiedUser.publisherName || '') : '',
        isEmailVerified: true,
      });

      setUser(unified);
      localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(unified));
      try {
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const channel = new BroadcastChannel('prople_auth_sync');
          channel.postMessage({ type: 'AUTH_SUCCESS', user: unified });
          channel.close();
        }
      } catch {}
      syncUserProfileToFirestore(unified);
    } finally {
      setIsLoading(false);
    }
  };

  const completeExternalAuth = async (userData: any) => {
    if (!userData || !userData.email) return;
    try {
      const userEmail = userData.email.toLowerCase().trim();
      const safeUid = userData.uid || 'usr_' + Buffer.from(userEmail).toString('base64url').slice(0, 24);
      const isFresh = userData.nameResetVersion === 'fresh_start_v1';

      const unified = await unifyUserProfileAcrossAccounts(userEmail, safeUid, {
        ...userData,
        displayName: isFresh ? (userData.publisherName || userData.displayName || '') : '',
        publisherName: isFresh ? (userData.publisherName || '') : '',
        isEmailVerified: true
      });

      setUser(unified);
      try {
        localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(unified));
      } catch {}

      try {
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const channel = new BroadcastChannel('prople_auth_sync');
          channel.postMessage({ type: 'AUTH_SUCCESS', user: unified });
          channel.close();
        }
      } catch {}

      syncUserProfileToFirestore(unified);
    } catch (err) {
      console.warn('[completeExternalAuth] Error:', err);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await signOut(auth);
    } catch (err) {
      console.warn('SignOut error or offline:', err);
    } finally {
      const preservedName = localStorage.getItem('prople_preserved_publisher_name') || '';
      localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
      if (preservedName && preservedName.trim()) {
        const guestUid = localStorage.getItem('prople_guest_uid') || `guest_${Date.now()}`;
        try {
          localStorage.setItem('prople_guest_uid', guestUid);
        } catch {}
        const guestProfile: UserProfile = {
          uid: guestUid,
          email: '',
          displayName: preservedName.trim(),
          publisherName: preservedName.trim(),
          publisherRole: 'Standard User',
          isPublisher: true,
          publishedAppIds: [],
          isEmailVerified: false,
          ...({ nameResetVersion: 'fresh_start_v1' } as any)
        };
        setUser(guestProfile);
        try {
          localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(guestProfile));
        } catch {}
      } else {
        setUser(null);
      }
      setIsLoading(false);
    }
  };

  const updateUserProfile = async (data: Partial<UserProfile>): Promise<void> => {
    const newName = (data.publisherName || data.displayName || '').trim();

    if (auth.currentUser && newName) {
      updateProfile(auth.currentUser, { displayName: newName }).catch(() => {});
    }

    let resolvedUpdatedProfile: UserProfile | null = null;
    let previousPublisherName = '';

    setUser((prev) => {
      const baseProfile = prev || (() => {
        try {
          const saved = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
          return saved ? JSON.parse(saved) : null;
        } catch {
          return null;
        }
      })();

      if (!baseProfile) {
        const guestUid = localStorage.getItem('prople_guest_uid') || `guest_${Date.now()}`;
        try {
          localStorage.setItem('prople_guest_uid', guestUid);
        } catch {}
        const createdGuest: UserProfile = {
          uid: guestUid,
          email: '',
          displayName: newName || 'Guest Developer',
          publisherName: newName || 'Guest Developer',
          bio: data.bio || '',
          age: data.age || '25',
          gender: data.gender || 'Prefer not to say',
          location: data.location || 'Global',
          isEmailVerified: false,
          isPublisher: true,
          publisherRole: 'Standard User',
          publishedAppIds: [],
          lastNameChangedAt: data.lastNameChangedAt,
          nameChangeSessionStartedAt: data.nameChangeSessionStartedAt,
          ...({ nameResetVersion: 'fresh_start_v1' } as any)
        };
        try {
          localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(createdGuest));
          if (newName) {
            localStorage.setItem('prople_preserved_publisher_name', newName);
            localStorage.setItem('prople_preserved_display_name', newName);
          }
        } catch {}
        resolvedUpdatedProfile = createdGuest;
        return createdGuest;
      }

      previousPublisherName = (baseProfile.publisherName || baseProfile.displayName || '').trim();

      const updated: UserProfile = { 
        ...baseProfile, 
        ...data,
        displayName: newName || baseProfile.publisherName || baseProfile.displayName || '',
        publisherName: newName || baseProfile.publisherName || baseProfile.displayName || '',
        lastNameChangedAt: data.lastNameChangedAt !== undefined ? data.lastNameChangedAt : baseProfile.lastNameChangedAt,
        nameChangeSessionStartedAt: data.nameChangeSessionStartedAt !== undefined ? data.nameChangeSessionStartedAt : baseProfile.nameChangeSessionStartedAt,
        ...({ nameResetVersion: 'fresh_start_v1' } as any)
      };
      if (!updated.developerKeystore && updated.uid) {
        updated.developerKeystore = generateDeveloperKeystore(updated.uid, updated.email, updated.displayName);
      }
      try {
        localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(updated));
        if (newName) {
          localStorage.setItem('prople_preserved_publisher_name', newName);
          localStorage.setItem('prople_preserved_display_name', newName);
        }
        if (updated.email) {
          localStorage.setItem('prople_saved_profile_' + updated.email.toLowerCase().trim(), JSON.stringify(updated));
        }
      } catch {}

      try {
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const bc = new BroadcastChannel('prople_auth_sync');
          bc.postMessage({ type: 'AUTH_SUCCESS', user: updated });
          bc.close();
        }
      } catch {}

      resolvedUpdatedProfile = updated;
      return updated;
    });

    const targetProfile = resolvedUpdatedProfile as UserProfile | null;
    if (targetProfile) {
      // 1. Authoritative server-side persistence across all account docs and developer registry
      try {
        await safeFetchJson('/api/user/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: targetProfile.uid,
            userEmail: targetProfile.email,
            displayName: targetProfile.displayName,
            publisherName: targetProfile.publisherName,
            bio: targetProfile.bio,
            age: targetProfile.age,
            gender: targetProfile.gender,
            location: targetProfile.location,
            photoURL: targetProfile.photoURL,
            lastNameChangedAt: targetProfile.lastNameChangedAt,
            nameChangeSessionStartedAt: targetProfile.nameChangeSessionStartedAt
          })
        });
      } catch (err) {
        console.warn('[updateUserProfile] Server profile API notice:', err);
      }

      // 2. Client-side Firestore sync
      await syncUserProfileToFirestore(targetProfile);

      // 3. Universally propagate the updated publisher name across all releases owned by this user
      if (newName && (targetProfile.uid || targetProfile.email)) {
        await propagatePublisherNameToAllReleases(
          newName,
          targetProfile.uid,
          targetProfile.email,
          previousPublisherName
        );
      }
    }
  };

  const togglePublisherStatus = (status?: boolean) => {
    setUser((prev) => {
      if (!prev) return null;
      const nextStatus = status !== undefined ? status : true;
      const updated: UserProfile = {
        ...prev,
        isPublisher: nextStatus,
        publisherName: prev.publisherName || prev.displayName || '',
        publisherRole: nextStatus ? (isDeveloperEmail(prev.email) ? 'Store Administrator' : 'Verified Developer') : 'Standard User',
        ...({ nameResetVersion: 'fresh_start_v1' } as any)
      };
      try {
        localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(updated));
      } catch {}
      syncUserProfileToFirestore(updated);
      return updated;
    });
  };

  const isPublisher = Boolean(user?.isPublisher);

  /**
   * Strictly verifies if the user is the legitimate publisher/owner of an application.
   * NO fuzzy string or generic name matching to avoid accidental ownership crossover.
   */
  const isPublisherOfApp = (
    appDeveloper?: string, 
    appId?: string, 
    appDeveloperId?: string, 
    appDeveloperEmail?: string
  ): boolean => {
    if (!user) return false;
    const currentEmail = (user.email || '').toLowerCase().trim();
    const currentUid = (user.uid || '').trim();

    // Explicit developer contact email match (Strict: must match current user email)
    if (appDeveloperEmail) {
      return Boolean(currentEmail && appDeveloperEmail.toLowerCase().trim() === currentEmail);
    }

    // Explicit developer UID match (highest priority security check)
    if (appDeveloperId && currentUid && appDeveloperId === currentUid && appDeveloperId !== 'developer' && appDeveloperId !== 'dev-publisher') {
      return true;
    }

    // Default to false: Never grant unauthorized access to another user's published app
    return false;
  };

  const isAdmin = Boolean(
    user && (
      AdminPermissionsService.isAdmin(user) ||
      isAdminEmail(user.email) ||
      user.publisherRole === 'Store Administrator' ||
      user.publisherRole === 'Super Admin' ||
      (user as any).isAdmin === true ||
      (user as any).role === 'admin'
    )
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        isAuthenticated: !!user,
        isLoading,
        isPublisher,
        isAdmin,
        login,
        verifyPasswordStep,
        cancelPendingTwoFactor,
        signup,
        loginWithGoogle,
        sendEmailOtp,
        verifyEmailOtp,
        forgotPassword,
        resetPasswordWithCode,
        completeExternalAuth,
        logout,
        updateUserProfile,
        togglePublisherStatus,
        isPublisherOfApp
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
