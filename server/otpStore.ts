// Distributed OTP store backed by Firebase Realtime Database
// with fallback to global in-memory cache.
// Ensures OTPs persist across serverless function instances, Vercel lambdas, and reboots.

import crypto from 'crypto';
import { hmacDigest, timingSafeEqualString } from './securityDefense';

function timingSafeStringMatch(a: string, b: string): boolean {
  return timingSafeEqualString(a, b);
}

interface StoredOtpRecord {
  code?: string;
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

declare global {
  // eslint-disable-next-line no-var
  var __PROPLE_MEMORY_OTPS: Map<string, StoredOtpRecord> | undefined;
  // eslint-disable-next-line no-var
  var __PROPLE_MEMORY_PASSWORDS: Map<string, string> | undefined;
  // eslint-disable-next-line no-var
  var __PROPLE_AUTH_SESSIONS: Map<string, AuthSessionRecord> | undefined;
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

const memoryStore = globalThis.__PROPLE_MEMORY_OTPS;
const passwordMemoryStore = globalThis.__PROPLE_MEMORY_PASSWORDS;
const sessionMemoryStore = globalThis.__PROPLE_AUTH_SESSIONS;

const RTDB_URL = (
  process.env.FIREBASE_DATABASE_URL ||
  'https://prople-store-3efed-default-rtdb.firebaseio.com'
).replace(/\/$/, '');

function getOtpKey(email: string): string {
  // Safe Firebase RTDB key by base64 encoding normalized email
  return Buffer.from(email.toLowerCase().trim()).toString('base64url');
}

/**
 * Stores an OTP with a specified expiration (in minutes or fractional minutes)
 * Writes to both Firebase Realtime Database and in-memory cache.
 */
export async function persistOtp(
  email: string,
  code: string,
  ttlMinutes = 10
): Promise<void> {
  const norm = email.toLowerCase().trim();
  const cleanCode = code.trim();
  const now = Date.now();
  const ttlMs = Math.round(ttlMinutes * 60 * 1000);
  const expiresAt = now + ttlMs;

  const record: StoredOtpRecord = {
    code: cleanCode,
    codeHmac: hmacDigest(cleanCode, norm),
    email: norm,
    expiresAt,
    attempts: 0,
    createdAt: now,
  };

  // 1. In-memory cache
  memoryStore.set(norm, record);

  // 2. Realtime Database persistent store (stores codeHmac for zero plaintext risk)
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
    console.warn('[Distributed OTP] Failed to write to RTDB, using memory cache:', err?.message || err);
  }
}

/**
 * Verifies and consumes an OTP code.
 * Checks memory cache and Realtime Database.
 */
export async function verifyAndConsumeOtp(
  email: string,
  inputCode: string
): Promise<{ valid: boolean; error?: string }> {
  const norm = email.toLowerCase().trim();
  const cleanCode = String(inputCode).trim();
  const now = Date.now();
  const key = getOtpKey(norm);

  // 1. Try to read from RTDB first for cross-instance consistency
  let record: StoredOtpRecord | null = null;

  try {
    const url = `${RTDB_URL}/_auth_otps/${key}.json`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object' && (data.code || data.codeHmac)) {
        record = data as StoredOtpRecord;
      }
    }
  } catch (err: any) {
    console.warn('[Distributed OTP] Failed to read from RTDB:', err.message);
  }

  // Fallback to memory store if RTDB failed or was empty
  if (!record && memoryStore.has(norm)) {
    record = memoryStore.get(norm)!;
  }

  if (!record) {
    return {
      valid: false,
      error: 'Verification code not found or expired. Please request a new verification code.',
    };
  }

  if (now > record.expiresAt) {
    // Delete expired record
    await deleteOtpRecord(norm, key);
    return {
      valid: false,
      error: 'Verification code has expired. Please request a new verification code.',
    };
  }

  if (record.attempts >= 5) {
    await deleteOtpRecord(norm, key);
    return {
      valid: false,
      error: 'Too many incorrect attempts. Please request a new verification code.',
    };
  }

  const matchesHmac = record.codeHmac
    ? timingSafeEqualString(record.codeHmac, hmacDigest(cleanCode, norm))
    : false;
  const matchesPlain = record.code
    ? timingSafeEqualString(String(record.code), cleanCode)
    : false;

  if (!matchesHmac && !matchesPlain) {
    record.attempts = (record.attempts || 0) + 1;
    memoryStore.set(norm, record);
    // Update attempts in RTDB asynchronously
    try {
      await fetch(`${RTDB_URL}/_auth_otps/${key}/attempts.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record.attempts),
      });
    } catch {}

    return {
      valid: false,
      error: 'Invalid verification code. Please check your email and try again.',
    };
  }

  // Successfully verified - consume OTP so it cannot be used again
  await deleteOtpRecord(norm, key);
  return { valid: true };
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

