import express from 'express';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  limit,
  where
} from 'firebase/firestore';

/**
 * Prople Store — Enterprise Authentication Security Engine
 *
 * Security Policies Implemented:
 * 1. 5 failed login attempts per 24 hours per account/IP.
 * 2. 10 OTP dispatches per 2 hours per email/IP.
 * 3. Comprehensive audit logging of all failed attempts (password, OTP, reset) with client IP to Firestore.
 * 4. Automatic IP lockout if an IP exceeds 20 failed verification strikes.
 */

export interface SecurityStatusResult {
  allowed: boolean;
  reason?: string;
  remainingAttempts?: number;
  isIpLocked?: boolean;
}

export interface FailedLogEntry {
  ip: string;
  email: string;
  type: 'failed_password_login' | 'failed_otp_verify' | 'failed_password_reset' | 'otp_limit_exceeded';
  timestamp: number;
  isoTime: string;
  userAgent?: string;
  reason?: string;
}

// Memory caches backed by Firestore for sub-millisecond evaluation
const emailFailedLoginTimestamps = new Map<string, number[]>(); // email -> timestamps in last 24h
const ipFailedLoginTimestamps = new Map<string, number[]>();    // ip -> timestamps in last 24h
const emailOtpTimestamps = new Map<string, number[]>();         // email -> timestamps in last 2h
const ipOtpTimestamps = new Map<string, number[]>();            // ip -> timestamps in last 2h
const ipTotalStrikes = new Map<string, number>();               // ip -> cumulative failed verification count
const lockedIps = new Set<string>();                            // set of blocked IPs

const LOGIN_FAIL_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_LOGIN_FAILS = 5;                        // 5 failed attempts per 24hr

const OTP_WINDOW_MS = 2 * 60 * 60 * 1000;         // 2 hours
const MAX_OTPS = 10;                              // 10 OTPs in 2 hr

const MAX_IP_STRIKES_BEFORE_LOCK = 20;             // Lock IP if > 20 failed attempts

// Memory pruning every 10 minutes to prevent RAM exhaustion and unbounded growth
setInterval(() => {
  const now = Date.now();
  for (const [email, times] of emailFailedLoginTimestamps.entries()) {
    const valid = times.filter((t) => now - t < LOGIN_FAIL_WINDOW_MS);
    if (valid.length === 0) emailFailedLoginTimestamps.delete(email);
    else emailFailedLoginTimestamps.set(email, valid);
  }
  for (const [ip, times] of ipFailedLoginTimestamps.entries()) {
    const valid = times.filter((t) => now - t < LOGIN_FAIL_WINDOW_MS);
    if (valid.length === 0) ipFailedLoginTimestamps.delete(ip);
    else ipFailedLoginTimestamps.set(ip, valid);
  }
  for (const [email, times] of emailOtpTimestamps.entries()) {
    const valid = times.filter((t) => now - t < OTP_WINDOW_MS);
    if (valid.length === 0) emailOtpTimestamps.delete(email);
    else emailOtpTimestamps.set(email, valid);
  }
  for (const [ip, times] of ipOtpTimestamps.entries()) {
    const valid = times.filter((t) => now - t < OTP_WINDOW_MS);
    if (valid.length === 0) ipOtpTimestamps.delete(ip);
    else ipOtpTimestamps.set(ip, valid);
  }
}, 10 * 60 * 1000).unref();

let isInitialized = false;

/**
 * Initializes security cache from Firestore to preserve rate-limits and locked IPs across server restarts
 */
export async function initAuthSecurity(db: any) {
  if (isInitialized || !db) return;
  try {
    // 1. Load locked IPs
    const lockedSnap = await getDocs(collection(db, 'locked_ips'));
    lockedSnap.forEach((d) => {
      const data = d.data();
      if (data?.ip) lockedIps.add(data.ip.trim());
      else if (d.id) lockedIps.add(d.id.trim());
    });
    console.log(`[Auth Security] Loaded ${lockedIps.size} locked IP(s) from database.`);

    // 2. Load recent IP strikes
    const stateDoc = await getDoc(doc(db, 'auth_security_state', 'active_ip_strikes'));
    if (stateDoc.exists()) {
      const data = stateDoc.data() || {};
      for (const [ip, count] of Object.entries(data)) {
        if (typeof count === 'number') {
          ipTotalStrikes.set(ip, count);
          if (count > MAX_IP_STRIKES_BEFORE_LOCK) {
            lockedIps.add(ip);
          }
        }
      }
    }

    isInitialized = true;
  } catch (err: any) {
    console.warn('[Auth Security] Failed to load security state from Firestore:', err.message);
  }
}

/**
 * Extracts and normalizes client IP address with sanitization against header injection
 */
export function getClientIp(req: express.Request): string {
  let rawIp = req.ip || req.socket?.remoteAddress || 'unknown';
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    const parts = forwarded.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) {
      rawIp = parts[0];
    }
  } else if (Array.isArray(forwarded) && forwarded.length > 0) {
    rawIp = String(forwarded[0]).trim();
  }
  const clean = rawIp.replace('::ffff:', '').replace(/[^0-9a-fA-F:.]/g, '').slice(0, 64);
  return clean || 'unknown';
}

/**
 * Checks if an IP is locked
 */
export function isIpLocked(ip: string): boolean {
  return lockedIps.has(ip);
}

/**
 * Verifies if a user or IP can attempt login (Max 5 failed attempts per 24hr)
 */
export function canAttemptLogin(email: string, ip: string): SecurityStatusResult {
  // Check 1: Is IP locked?
  if (isIpLocked(ip)) {
    return {
      allowed: false,
      isIpLocked: true,
      reason: 'Access denied: Your IP address has been locked due to exceeding 20 failed security verification attempts.',
      remainingAttempts: 0,
    };
  }

  const now = Date.now();
  const cleanEmail = (email || '').toLowerCase().trim();

  // Check 2: Failed login attempts for email in last 24 hours
  const emailTimes = (emailFailedLoginTimestamps.get(cleanEmail) || []).filter(
    (t) => now - t < LOGIN_FAIL_WINDOW_MS
  );
  emailFailedLoginTimestamps.set(cleanEmail, emailTimes);

  if (cleanEmail && emailTimes.length >= MAX_LOGIN_FAILS) {
    const oldestFail = emailTimes[0];
    const hoursLeft = Math.ceil((LOGIN_FAIL_WINDOW_MS - (now - oldestFail)) / (60 * 60 * 1000));
    return {
      allowed: false,
      reason: `Security limit reached: 5 failed login attempts in 24 hours. Login for this account is temporarily restricted for approximately ${hoursLeft} hour(s). You can reset your password to regain access.`,
      remainingAttempts: 0,
    };
  }

  // Check 3: Failed login attempts for IP in last 24 hours
  const ipTimes = (ipFailedLoginTimestamps.get(ip) || []).filter(
    (t) => now - t < LOGIN_FAIL_WINDOW_MS
  );
  ipFailedLoginTimestamps.set(ip, ipTimes);

  if (ipTimes.length >= MAX_LOGIN_FAILS) {
    return {
      allowed: false,
      reason: 'Security limit reached: 5 failed login attempts from this network in 24 hours. Please wait before trying again or use password reset.',
      remainingAttempts: 0,
    };
  }

  const emailRemaining = MAX_LOGIN_FAILS - emailTimes.length;
  const ipRemaining = MAX_LOGIN_FAILS - ipTimes.length;
  const remaining = Math.min(emailRemaining, ipRemaining);

  return {
    allowed: true,
    remainingAttempts: remaining,
  };
}

/**
 * Verifies if an email or IP can request an OTP (Max 10 OTPs in 2 hours)
 */
export function canRequestOtp(email: string, ip: string): SecurityStatusResult {
  if (isIpLocked(ip)) {
    return {
      allowed: false,
      isIpLocked: true,
      reason: 'Access denied: Your IP address has been locked due to exceeding 20 failed security verification attempts.',
    };
  }

  const now = Date.now();
  const cleanEmail = (email || '').toLowerCase().trim();

  // Check email OTPs in last 2 hours
  const emailTimes = (emailOtpTimestamps.get(cleanEmail) || []).filter(
    (t) => now - t < OTP_WINDOW_MS
  );
  emailOtpTimestamps.set(cleanEmail, emailTimes);

  if (cleanEmail && emailTimes.length >= MAX_OTPS) {
    const oldestOtp = emailTimes[0];
    const minutesLeft = Math.ceil((OTP_WINDOW_MS - (now - oldestOtp)) / (60 * 1000));
    return {
      allowed: false,
      reason: `OTP request limit reached: Maximum 10 verification codes allowed in 2 hours. Please try again in ${minutesLeft} minute(s).`,
      remainingAttempts: 0,
    };
  }

  // Check IP OTPs in last 2 hours
  const ipTimes = (ipOtpTimestamps.get(ip) || []).filter(
    (t) => now - t < OTP_WINDOW_MS
  );
  ipOtpTimestamps.set(ip, ipTimes);

  if (ipTimes.length >= MAX_OTPS) {
    return {
      allowed: false,
      reason: 'OTP request limit reached: Maximum 10 verification codes per 2 hours from this network. Please try again later.',
      remainingAttempts: 0,
    };
  }

  return {
    allowed: true,
    remainingAttempts: MAX_OTPS - Math.max(emailTimes.length, ipTimes.length),
  };
}

/**
 * Records an OTP dispatch event
 */
export function recordOtpDispatched(email: string, ip: string) {
  const now = Date.now();
  const cleanEmail = (email || '').toLowerCase().trim();

  const emailTimes = emailOtpTimestamps.get(cleanEmail) || [];
  emailTimes.push(now);
  emailOtpTimestamps.set(cleanEmail, emailTimes);

  const ipTimes = ipOtpTimestamps.get(ip) || [];
  ipTimes.push(now);
  ipOtpTimestamps.set(ip, ipTimes);
}

/**
 * Records a successful login and clears the failed login attempt counter for that email
 */
export function recordSuccessfulLogin(email: string) {
  const cleanEmail = (email || '').toLowerCase().trim();
  emailFailedLoginTimestamps.delete(cleanEmail);
}

/**
 * Registers a failed security event in Firestore and increments IP strike count.
 * If strikes > 20, the IP is locked automatically.
 */
export async function registerFailedSecurityEvent(
  db: any,
  entry: Omit<FailedLogEntry, 'timestamp' | 'isoTime'>
): Promise<{ isLocked: boolean; strikeCount: number; message?: string }> {
  const now = Date.now();
  const fullEntry: FailedLogEntry = {
    ...entry,
    timestamp: now,
    isoTime: new Date(now).toISOString(),
  };

  const ip = entry.ip || 'unknown';
  const cleanEmail = (entry.email || '').toLowerCase().trim();

  // If this was a failed login attempt, track in 24hr sliding window
  if (entry.type === 'failed_password_login') {
    if (cleanEmail) {
      const emailTimes = emailFailedLoginTimestamps.get(cleanEmail) || [];
      emailTimes.push(now);
      emailFailedLoginTimestamps.set(cleanEmail, emailTimes);
    }
    const ipTimes = ipFailedLoginTimestamps.get(ip) || [];
    ipTimes.push(now);
    ipFailedLoginTimestamps.set(ip, ipTimes);
  }

  // Increment cumulative strike counter for this IP
  const currentStrikes = (ipTotalStrikes.get(ip) || 0) + 1;
  ipTotalStrikes.set(ip, currentStrikes);

  let isNowLocked = isIpLocked(ip);

  // Check if IP exceeds 20 strikes
  if (currentStrikes > MAX_IP_STRIKES_BEFORE_LOCK && !isNowLocked) {
    lockedIps.add(ip);
    isNowLocked = true;
    console.warn(`[Auth Security] 🚨 IP ${ip} EXCEEDED ${MAX_IP_STRIKES_BEFORE_LOCK} FAILED STRIKES. IP IS NOW LOCKED FOR LOGIN.`);

    // Persist locked IP to Firestore
    if (db) {
      try {
        const safeDocId = ip.replace(/[\/\.#$\[\]:]/g, '_');
        await setDoc(doc(db, 'locked_ips', safeDocId), {
          ip,
          lockedAt: now,
          lockedAtIso: new Date(now).toISOString(),
          reason: `Exceeded ${MAX_IP_STRIKES_BEFORE_LOCK} failed security verification attempts (password/OTP)`,
          strikeCount: currentStrikes,
          lastTargetEmail: cleanEmail,
          userAgent: entry.userAgent || 'unknown',
        });
      } catch (err: any) {
        console.warn('[Auth Security] Failed to save locked IP to Firestore:', err.message);
      }
    }
  }

  // Persist the individual failed log in Firestore collection `auth_failed_logs`
  if (db) {
    try {
      const logId = `${now}_${Math.random().toString(36).substring(2, 9)}`;
      await setDoc(doc(db, 'auth_failed_logs', logId), fullEntry);

      // Periodically update active strikes aggregate
      const safeIpKey = ip.replace(/[\/\.#$\[\]:]/g, '_');
      await setDoc(
        doc(db, 'auth_security_state', 'active_ip_strikes'),
        { [safeIpKey]: currentStrikes, lastUpdated: now },
        { merge: true }
      );
    } catch (dbErr: any) {
      console.warn('[Auth Security] Failed to log failure to Firestore:', dbErr.message);
    }
  }

  return {
    isLocked: isNowLocked,
    strikeCount: currentStrikes,
    message: isNowLocked
      ? 'Security alert: Your IP address has been locked due to exceeding 20 failed security verification attempts.'
      : undefined,
  };
}
