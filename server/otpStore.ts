// Distributed OTP store backed by Firebase Realtime Database
// with fallback to global in-memory cache.
// Ensures OTPs persist across serverless function instances, Vercel lambdas, and reboots.

import crypto from 'crypto';
import { hmacDigest, timingSafeEqualString, getInternalHmacSecret } from './securityDefense';

function timingSafeStringMatch(a: string, b: string): boolean {
  return timingSafeEqualString(a, b);
}

interface StoredOtpRecord {
  codeHmac?: string;
  email: string;
  expiresAt: number;
  attempts: number;
  createdAt: number;
}

export interface AuthSessionRecord {
  status: 'pending' | 'completed';
  email: string;
  createdAt: number;
  completedAt?: number;
  user?: any;
}

const GLOBAL_OTP_STEP_MS = 10 * 60 * 1000; // 10 minutes step

declare global {
  // eslint-disable-next-line no-var
  var __PROPLE_MEMORY_OTPS: Map<string, StoredOtpRecord> | undefined;
  // eslint-disable-next-line no-var
  var __PROPLE_MEMORY_PASSWORDS: Map<string, string> | undefined;
  // eslint-disable-next-line no-var
  var __PROPLE_AUTH_SESSIONS: Map<string, AuthSessionRecord> | undefined;
  // eslint-disable-next-line no-var
  var __PROPLE_CONSUMED_CODES: Map<string, number> | undefined;
}

if (!globalThis.__PROPLE_MEMORY_OTPS) {
  globalThis.__PROPLE_MEMORY_OTPS = new Map<string, StoredOtpRecord>();
}
if (!globalThis.__PROPLE_MEMORY_PASSWORDS) {
  globalThis.__PROPLE_MEMORY_PASSWORDS = new Map<string, string>();
}
if (!globalThis.__PROPLE_AUTH_SESSIONS) {
  globalThis.__PROPLE_AUTH_SESSIONS = new Map<string, AuthSessionRecord>();
}
if (!globalThis.__PROPLE_CONSUMED_CODES) {
  globalThis.__PROPLE_CONSUMED_CODES = new Map<string, number>();
}

const memoryStore = globalThis.__PROPLE_MEMORY_OTPS;
const passwordMemoryStore = globalThis.__PROPLE_MEMORY_PASSWORDS;
const sessionMemoryStore = globalThis.__PROPLE_AUTH_SESSIONS;
const consumedCodesStore = globalThis.__PROPLE_CONSUMED_CODES;

// Prune expired consumed codes every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, exp] of consumedCodesStore.entries()) {
    if (now > exp) consumedCodesStore.delete(key);
  }
}, 15 * 60 * 1000).unref();

export function getStableInternalSecret(): string {
  return getInternalHmacSecret();
}

/**
 * Computes a standardized 6-digit TOTP code for a given email and time window step.
 * Based on RFC 4226 / RFC 6238 HMAC dynamic truncation.
 */
export function computeTotpCode(email: string, stepIndex: number): string {
  const norm = email.toLowerCase().trim();
  const secret = getStableInternalSecret();
  const hmac = crypto.createHmac('sha256', secret).update(`prople_totp:${norm}:${stepIndex}`).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (binary % 1000000).toString().padStart(6, '0');
}

/**
 * Generates an instantaneous TOTP 6-digit code for the current time step.
 */
export function generateTotpOtp(email: string): string {
  const stepIndex = Math.floor(Date.now() / GLOBAL_OTP_STEP_MS);
  return computeTotpCode(email, stepIndex);
}

/**
 * Creates a cryptographically signed Challenge Token containing email, codeHash, and expiration.
 * The client browser retains this token in sessionStorage and sends it on verification.
 * Enables 100% stateless, multi-instance verification across Vercel and Cloud Run.
 */
export function createSignedChallengeToken(email: string, code: string, ttlMinutes = 30): string {
  const norm = email.toLowerCase().trim();
  const cleanCode = code.trim();
  const expiresAt = Date.now() + Math.round(ttlMinutes * 60 * 1000);
  const secret = getStableInternalSecret();
  const payload = JSON.stringify({
    e: norm,
    h: crypto.createHmac('sha256', secret).update(`${norm}:${cleanCode}`).digest('hex'),
    exp: expiresAt,
  });
  const b64Payload = Buffer.from(payload, 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(b64Payload).digest('base64url');
  return `${b64Payload}.${sig}`;
}

/**
 * Verifies a Challenge Token against the given email and input code.
 */
export function verifyChallengeToken(
  token: string | undefined | null,
  email: string,
  inputCode: string
): { valid: boolean; error?: string } {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return { valid: false };
  }
  try {
    const [b64Payload, sig] = token.split('.');
    const secret = getStableInternalSecret();
    const expectedSig = crypto.createHmac('sha256', secret).update(b64Payload).digest('base64url');
    if (!timingSafeStringMatch(sig, expectedSig)) {
      return { valid: false };
    }
    const payloadJson = Buffer.from(b64Payload, 'base64url').toString('utf8');
    const data = JSON.parse(payloadJson);
    const norm = email.toLowerCase().trim();
    if (data.e !== norm) {
      return { valid: false };
    }
    // Check expiration with 3-minute grace period for clock skew
    if (Date.now() > data.exp + 3 * 60 * 1000) {
      return { valid: false, error: 'Verification code has expired. Please request a new verification code.' };
    }
    const cleanCode = inputCode.trim();
    const expectedHash = crypto.createHmac('sha256', secret).update(`${norm}:${cleanCode}`).digest('hex');
    if (!timingSafeStringMatch(data.h, expectedHash)) {
      return { valid: false, error: 'Incorrect verification code. Please check your email and enter the latest 6 digits.' };
    }
    return { valid: true };
  } catch {
    return { valid: false };
  }
}

const RTDB_URL = (
  process.env.FIREBASE_DATABASE_URL ||
  'https://prople-store-3efed-default-rtdb.firebaseio.com'
).replace(/\/$/, '');

function getOtpKey(email: string): string {
  // Safe Firebase RTDB key by base64 encoding normalized email
  return Buffer.from(email.toLowerCase().trim()).toString('base64url');
}

/**
 * Stores an OTP with a specified expiration (in minutes, default 30 minutes)
 * Writes to memory cache and Realtime Database.
 */
export async function persistOtp(
  email: string,
  code: string,
  ttlMinutes = 30
): Promise<void> {
  const norm = email.toLowerCase().trim();
  const cleanCode = code.trim();
  const now = Date.now();
  const ttlMs = Math.round(ttlMinutes * 60 * 1000);
  const expiresAt = now + ttlMs;

  const record: StoredOtpRecord = {
    codeHmac: hmacDigest(cleanCode, norm),
    email: norm,
    expiresAt,
    attempts: 0,
    createdAt: now,
  };

  // 1. In-memory cache
  memoryStore.set(norm, record);

  // 2. Realtime Database persistent store (stores only cryptographic codeHmac, expiry, and metadata)
  try {
    const key = getOtpKey(norm);
    const url = `${RTDB_URL}/_auth_otps/${key}.json`;
    await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        codeHmac: record.codeHmac,
        email: norm,
        expiresAt,
        attempts: 0,
        createdAt: now,
      }),
      signal: AbortSignal.timeout(4000),
    });
  } catch (err: any) {
    // Graceful fallback to memory and stateless TOTP verification
  }
}

/**
 * Verifies and optionally consumes an OTP code.
 * Checks Challenge Token, in-memory cache, multi-window TOTP, and RTDB.
 */
export async function verifyAndConsumeOtp(
  email: string,
  inputCode: string,
  consume = true,
  challengeToken?: string
): Promise<{ valid: boolean; error?: string }> {
  const norm = email.toLowerCase().trim();
  const cleanCode = String(inputCode || '').trim();
  if (!cleanCode || !/^\d{6}$/.test(cleanCode)) {
    return {
      valid: false,
      error: 'Please enter a valid 6-digit verification code.',
    };
  }

  const now = Date.now();
  const key = getOtpKey(norm);

  // 1. First check stateless signed Challenge Token if supplied by client
  if (challengeToken) {
    const challengeResult = verifyChallengeToken(challengeToken, norm, cleanCode);
    if (challengeResult.valid) {
      if (consume) {
        await deleteOtpRecord(norm, key);
        consumedCodesStore.set(`${norm}:${cleanCode}`, now + 45 * 60 * 1000);
      }
      return { valid: true };
    } else if (challengeResult.error && challengeResult.error.includes('expired')) {
      return challengeResult;
    }
  }

  // 2. Second check in-memory store
  const memRecord = memoryStore.get(norm) || null;
  if (memRecord) {
    const isExpired = now > memRecord.expiresAt + 3 * 60 * 1000;
    if (!isExpired) {
      const matchesHmac = memRecord.codeHmac ? timingSafeEqualString(memRecord.codeHmac, hmacDigest(cleanCode, norm)) : false;
      if (matchesHmac) {
        if (consume) {
          await deleteOtpRecord(norm, key);
          consumedCodesStore.set(`${norm}:${cleanCode}`, now + 45 * 60 * 1000);
        }
        return { valid: true };
      }
    }
  }

  // 3. Third check RFC-compatible time-stepped OTP windows (covers up to 40 minutes with zero database dependency)
  const currentStep = Math.floor(now / GLOBAL_OTP_STEP_MS);
  // Check windows: current, -1 (10-20m), -2 (20-30m), -3 (30-40m), +1 (clock skew)
  const validSteps = [currentStep, currentStep - 1, currentStep - 2, currentStep - 3, currentStep + 1];
  for (const step of validSteps) {
    const expectedTotp = computeTotpCode(norm, step);
    if (timingSafeEqualString(expectedTotp, cleanCode)) {
      const consumedKey = `${norm}:${cleanCode}`;
      const consumedExpiry = consumedCodesStore.get(consumedKey);
      if (consumedExpiry && now < consumedExpiry) {
        return {
          valid: false,
          error: 'This verification code has already been used. Please request a new verification code.',
        };
      }
      if (consume) {
        consumedCodesStore.set(consumedKey, now + 45 * 60 * 1000);
        await deleteOtpRecord(norm, key);
      }
      return { valid: true };
    }
  }

  // 4. Fourth fallback: Check Realtime Database if accessible
  try {
    const url = `${RTDB_URL}/_auth_otps/${key}.json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        const rtdbRecord = data as StoredOtpRecord;
        if (now <= (rtdbRecord.expiresAt || 0) + 3 * 60 * 1000) {
          const matchesHmac = rtdbRecord.codeHmac ? timingSafeEqualString(rtdbRecord.codeHmac, hmacDigest(cleanCode, norm)) : false;
          if (matchesHmac) {
            if (consume) {
              await deleteOtpRecord(norm, key);
              consumedCodesStore.set(`${norm}:${cleanCode}`, now + 45 * 60 * 1000);
            }
            return { valid: true };
          }
        }
      }
    }
  } catch {}

  // 5. Code did not match any active record or window
  return {
    valid: false,
    error: 'Incorrect verification code. Please check your email and enter the latest 6 digits.',
  };
}

async function deleteOtpRecord(email: string, key: string): Promise<void> {
  memoryStore.delete(email);
  try {
    await fetch(`${RTDB_URL}/_auth_otps/${key}.json`, {
      method: 'DELETE',
    });
  } catch {}
}

/**
 * Persists a user's hashed password in RTDB under _auth_otps/pwd_${key}.json
 * and in memory cache for high availability and instant auth.
 */
export async function persistUserPasswordHash(email: string, hash: string): Promise<void> {
  const norm = email.toLowerCase().trim();
  passwordMemoryStore.set(norm, hash);

  try {
    const key = getOtpKey(norm);
    const url = `${RTDB_URL}/_auth_otps/pwd_${key}.json`;
    await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hash, updatedAt: Date.now() }),
      signal: AbortSignal.timeout(4000),
    });
  } catch (err: any) {
    console.warn('[Distributed Password Store] RTDB write notice:', err?.message || err);
  }
}

/**
 * Retrieves a user's hashed password from memory cache or RTDB.
 */
export async function getUserPasswordHash(email: string): Promise<string | null> {
  const norm = email.toLowerCase().trim();
  if (passwordMemoryStore.has(norm)) {
    return passwordMemoryStore.get(norm)!;
  }

  try {
    const key = getOtpKey(norm);
    const url = `${RTDB_URL}/_auth_otps/pwd_${key}.json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object' && data.hash) {
        passwordMemoryStore.set(norm, data.hash);
        return data.hash;
      }
    }
  } catch (err: any) {
    console.warn('[Distributed Password Store] RTDB read notice:', err?.message || err);
  }

  return null;
}

/**
 * Creates an active auth/reset session in memory & RTDB for cross-window synchronization.
 */
export async function createAuthSession(email: string): Promise<void> {
  const norm = email.toLowerCase().trim();
  const record: AuthSessionRecord = {
    status: 'pending',
    email: norm,
    createdAt: Date.now(),
  };

  sessionMemoryStore.set(norm, record);

  try {
    const key = getOtpKey(norm);
    const url = `${RTDB_URL}/_auth_sessions/${key}.json`;
    await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
      signal: AbortSignal.timeout(4000),
    });
  } catch (err: any) {
    console.warn('[Auth Session] RTDB write session notice:', err?.message || err);
  }
}

/**
 * Marks an auth/reset session as completed with the authenticated user profile.
 * All listening windows/tabs (like Chrome) will immediately detect this and log in.
 */
export async function completeAuthSession(email: string, user: any): Promise<void> {
  const norm = email.toLowerCase().trim();
  const existing = sessionMemoryStore.get(norm);
  const record: AuthSessionRecord = {
    status: 'completed',
    email: norm,
    createdAt: existing?.createdAt || Date.now(),
    completedAt: Date.now(),
    user,
  };

  sessionMemoryStore.set(norm, record);

  try {
    const key = getOtpKey(norm);
    const url = `${RTDB_URL}/_auth_sessions/${key}.json`;
    await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
      signal: AbortSignal.timeout(4000),
    });
  } catch (err: any) {
    console.warn('[Auth Session] RTDB complete session notice:', err?.message || err);
  }
}

/**
 * Checks the status of an auth/reset session (pending, completed, or none).
 */
export async function getAuthSessionStatus(email: string): Promise<{
  status: 'pending' | 'completed' | 'none';
  user?: any;
}> {
  const norm = email.toLowerCase().trim();
  const now = Date.now();
  const SESSION_TTL_MS = 15 * 60 * 1000;

  // 1. Check in-memory store
  let record: AuthSessionRecord | undefined = sessionMemoryStore.get(norm);

  // 2. Fallback to RTDB
  if (!record || (record.status === 'pending' && now - record.createdAt > 3000)) {
    try {
      const key = getOtpKey(norm);
      const url = `${RTDB_URL}/_auth_sessions/${key}.json`;
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object' && data.status) {
          record = data as AuthSessionRecord;
          sessionMemoryStore.set(norm, record);
        }
      }
    } catch {}
  }

  if (!record) {
    return { status: 'none' };
  }

  if (record.status === 'completed') {
    if (record.completedAt && now - record.completedAt > SESSION_TTL_MS) {
      sessionMemoryStore.delete(norm);
      return { status: 'none' };
    }
    return { status: 'completed', user: record.user };
  }

  if (record.status === 'pending') {
    if (now - record.createdAt > SESSION_TTL_MS) {
      sessionMemoryStore.delete(norm);
      return { status: 'none' };
    }
    return { status: 'pending' };
  }

  return { status: 'none' };
}

/**
 * Clears/consumes the auth session after successful sync.
 */
export async function consumeAuthSession(email: string): Promise<void> {
  const norm = email.toLowerCase().trim();
  sessionMemoryStore.delete(norm);

  try {
    const key = getOtpKey(norm);
    const url = `${RTDB_URL}/_auth_sessions/${key}.json`;
    await fetch(url, {
      method: 'DELETE',
      signal: AbortSignal.timeout(3000),
    });
  } catch {}
}

