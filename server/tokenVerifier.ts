import { getServerFirebaseConfig } from './firebaseConfig.ts';
import { isStrictAdminEmail, verifySecuritySecret } from './securityDefense.ts';
import crypto from 'crypto';

export interface VerifiedUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  isAdmin: boolean;
}

// In-memory verification cache to eliminate redundant network calls for identical valid tokens
// Token SHA-256 -> { user: VerifiedUser, expiresAt: number }
const verifiedTokenCache = new Map<string, { user: VerifiedUser; expiresAt: number }>();

// Periodic pruning of expired token cache every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [hash, record] of verifiedTokenCache.entries()) {
    if (now > record.expiresAt) {
      verifiedTokenCache.delete(hash);
    }
  }
}, 5 * 60 * 1000).unref();

function getSha256(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Authoritatively verifies a Firebase ID Token using Google Identity Toolkit.
 * Decodes, validates structure, and verifies cryptographic signature against Google Auth servers.
 * Never trusts client claims without verification.
 */
export async function verifyFirebaseIdToken(rawToken?: string | null): Promise<VerifiedUser | null> {
  if (!rawToken || typeof rawToken !== 'string') return null;
  const token = rawToken.replace(/^Bearer\s+/i, '').trim();
  if (!token || token.split('.').length !== 3) return null;

  const tokenHash = getSha256(token);
  const now = Date.now();
  const cached = verifiedTokenCache.get(tokenHash);
  if (cached && now < cached.expiresAt) {
    return cached.user;
  }

  // Fast structural decode to check basic expiration before hitting Google API
  try {
    const payloadPart = token.split('.')[1];
    const decodedPayload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf-8'));
    if (decodedPayload.exp && decodedPayload.exp * 1000 < now) {
      return null; // Expired token
    }
  } catch {
    return null; // Malformed payload
  }

  const { apiKey } = getServerFirebaseConfig();
  if (!apiKey || apiKey.includes('example')) {
    return null;
  }

  try {
    const lookupUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(lookupUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json().catch(() => null);
    const userInfo = data?.users?.[0];
    if (!userInfo || !userInfo.localId) {
      return null;
    }

    const uid = userInfo.localId;
    const email = (userInfo.email || '').toLowerCase().trim();
    const emailVerified = Boolean(userInfo.emailVerified);
    const isAdmin = Boolean(email && emailVerified && isStrictAdminEmail(email));

    const verified: VerifiedUser = {
      uid,
      email,
      emailVerified,
      isAdmin,
    };

    // Cache valid token for 5 minutes or until token expiration
    verifiedTokenCache.set(tokenHash, {
      user: verified,
      expiresAt: now + 5 * 60 * 1000,
    });

    return verified;
  } catch (err: any) {
    console.warn('[TokenVerifier] Error verifying ID token with Identity Toolkit:', err?.message || err);
    return null;
  }
}

/**
 * Centralized caller authorization helper:
 * Resolves verified caller identity from Authorization header or admin secret.
 * Prevents client-controlled identity spoofing (X-User-Id / body.userId).
 */
export async function authenticateApiRequest(req: any): Promise<{
  isAuthenticated: boolean;
  isVerifiedAdmin: boolean;
  uid: string | null;
  email: string | null;
}> {
  const adminSecret = req.headers?.['x-admin-secret'] || req.body?.adminSecret;
  if (adminSecret && verifySecuritySecret(adminSecret)) {
    return {
      isAuthenticated: true,
      isVerifiedAdmin: true,
      uid: 'admin-root',
      email: 'admin@prople.co.in',
    };
  }

  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  const rawToken = (authHeader || req.body?.idToken || '').replace(/^Bearer\s+/i, '').trim();

  if (rawToken) {
    const verified = await verifyFirebaseIdToken(rawToken);
    if (verified) {
      return {
        isAuthenticated: true,
        isVerifiedAdmin: verified.isAdmin,
        uid: verified.uid,
        email: verified.email,
      };
    }
  }

  return {
    isAuthenticated: false,
    isVerifiedAdmin: false,
    uid: null,
    email: null,
  };
}
