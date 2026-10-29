import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

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
  const allowOrigin = trusted && origin ? origin : '*';
  const allowCredentials = trusted ? 'true' : 'false';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Credentials': allowCredentials,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-Requested-With, Accept, X-User-Id, X-User-Email, X-Entity-Ref-ID',
    'Access-Control-Max-Age': '86400',
  };
}

let ephemeralSessionSecret: string | null = null;

function getSessionSecret(): string {
  const configured = process.env.SESSION_SECRET || process.env.INTERNAL_SECURITY_KEY;
  if (configured && configured.trim()) {
    return configured.trim();
  }
  if (!ephemeralSessionSecret) {
    ephemeralSessionSecret = crypto.randomBytes(32).toString('hex');
  }
  return ephemeralSessionSecret;
}

function hmacDigest(value: string, salt = ''): string {
  const secret = getSessionSecret();
  return crypto.createHmac('sha256', secret).update(`${salt}:${value}`).digest('hex');
}

function timingSafeEqualString(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function escapeHtmlStr(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatRecipientName(rawName?: string, email?: string): string {
  if (rawName && typeof rawName === 'string' && rawName.trim().length >= 2) {
    return escapeHtmlStr(rawName.trim());
  }
  if (!email) return 'there';
  const prefix = email.split('@')[0];
  const cleaned = prefix.replace(/[0-9]+$/, '').replace(/[._-]+/g, ' ').trim();
  if (cleaned.length >= 2) {
    return escapeHtmlStr(
      cleaned
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ')
    );
  }
  return escapeHtmlStr(prefix);
}

function getCandidateResendApiKeys(): string[] {
  const envKeys = [
    process.env.RESEND_API_KEY,
    process.env.RESEND_API_KEY_,
    process.env.VITE_RESEND_API_KEY,
    process.env.RESEND_KEY,
    process.env.VITE_RESEND_KEY,
  ];

  const candidateKeys: string[] = [];

  for (const raw of envKeys) {
    if (raw && typeof raw === 'string') {
      const clean = raw.replace(/^Bearer\s+/i, '').replace(/^['"]|['"]$/g, '').trim();
      if (clean && !candidateKeys.includes(clean)) {
        candidateKeys.push(clean);
      }
    }
  }

  return candidateKeys;
}

function getResendApiKey(): string {
  const keys = getCandidateResendApiKeys();
  return keys[0] || '';
}

async function sendFirebaseOobCode(
  requestType: 'PASSWORD_RESET' | 'VERIFY_EMAIL' | 'EMAIL_SIGNIN',
  email: string,
  continueUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const apiKey = process.env.FIREBASE_API_KEY || '';
    if (!apiKey) {
      return { success: false, error: 'Firebase email delivery is not configured for this environment.' };
    }

    const bodyPayload: any = {
      email: email.trim().toLowerCase(),
      continueUrl,
      requestType: requestType === 'VERIFY_EMAIL' ? 'EMAIL_SIGNIN' : requestType,
    };

    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
      signal: AbortSignal.timeout(5000),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const fbMsg = data?.error?.message || 'Failed to dispatch email via Firebase';
      if (typeof fbMsg === 'string' && fbMsg.includes('UNAUTHORIZED_DOMAIN')) {
        const authDomain = process.env.FIREBASE_AUTH_DOMAIN || 'prople-store-3efed.firebaseapp.com';
        bodyPayload.continueUrl = `https://${authDomain}`;
        try {
          const retryRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyPayload),
            signal: AbortSignal.timeout(5000),
          });
          const retryData = await retryRes.json().catch(() => ({}));
          if (retryRes.ok) {
            return { success: true };
          }
        } catch {}
      }
      return { success: false, error: fbMsg };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Firebase request failed' };
  }
}

function renderPropleEmail({
  recipientName,
  email,
  title,
  purposeText,
  code,
  validityMinutes = 15,
  actionUrl,
  actionText,
  isPasswordReset = false,
}: {
  recipientName?: string;
  email?: string;
  title: string;
  purposeText: string;
  code: string;
  validityMinutes?: number;
  actionUrl?: string;
  actionText?: string;
  isPasswordReset?: boolean;
}): string {
  const displayUser = formatRecipientName(recipientName, email);
  const safeTitle = escapeHtmlStr(title);
  const safePurpose = escapeHtmlStr(purposeText);
  const safeCode = escapeHtmlStr(code);
  const safeEmail = escapeHtmlStr(email || '');
  const safeActionUrl = actionUrl ? escapeHtmlStr(actionUrl) : '';
  const defaultActionText = isPasswordReset ? 'Reset Password' : 'Verify Email';
  const safeActionText = escapeHtmlStr(actionText || defaultActionText);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${safeTitle}</title>
  <script type="application/ld+json">
  {
    "@context": "http://schema.org",
    "@type": "EmailMessage",
    "description": "${safeTitle}",
    "potentialAction": {
      "@type": "ConfirmAction",
      "name": "Copy code: ${safeCode}",
      "handler": {
        "@type": "HttpActionHandler",
        "url": "${safeActionUrl || 'https://www.prople.co.in'}"
      }
    }
  }
  </script>
</head>
<body style="margin: 0; padding: 0; width: 100%; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #262626; font-[...]">
  <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; max-width: 0px; opacity: 0;">
    ${safeCode} is your Prople Store verification code. &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 0; padding: 0; width: 100%; background-color: #ffffff;">
    <tr>
      <td align="center" valign="top" style="margin: 0; padding: 0;">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; width: 100%; margin: 0 auto; background-color: #ffffff; border: 0; text-align: center;">
          <tr>
            <td style="padding: 32px 20px 40px 20px;">
              <div style="text-align: center; margin-bottom: 22px;">
                <a href="https://www.prople.co.in" target="_blank" style="text-decoration: none; display: inline-block;">
                  <img src="https://www.prople.co.in/logo.png" width="48" height="48" alt="Prople Store" style="display: block; margin: 0 auto; width: 48px; height: 48px; border-radius: 10px; border: 1px solid #e5e5e5; background-color: #ffffff;" />
                  <span style="display: block; margin-top: 8px; font-size: 19px; font-weight: 700; color: #262626; letter-spacing: -0.3px;">Prople Store</span>
                </a>
              </div>

              <p style="margin: 0 0 12px 0; font-size: 15px; font-weight: 600; color: #262626;">
                Hi${displayUser ? ` ${displayUser}` : ''},
              </p>

              <p style="margin: 0 0 18px 0; font-size: 14px; color: #262626; line-height: 1.5;">
                ${safePurpose} ${safeEmail ? `for <strong style="color: #000000;">${safeEmail}</strong>.` : ''}
              </p>

              <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="width: 100%; margin: 16px 0 20px 0; background-color: #f7f7f7; border: 1px solid #e6e6e6; border-radius: 14px;">
                <tr>
                  <td style="padding: 16px 14px; text-align: center; vertical-align: middle;">
                    <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #737373; margin-bottom: 4px;">Security Code</div>
                    <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 28px; font-weight: 700; letter-spacing: 6px; color: #000000; line-height: 1.3;">${safeCode}</div>
                  </td>
                </tr>
              </table>

              ${safeActionUrl ? `
              <div style="margin: 20px 0 20px 0;">
                <a href="${safeActionUrl}" target="_blank" style="display: block; width: 100%; box-sizing: border-box; background-color: #0095f6; color: #ffffff; font-weight: 600; font-size: 14px; text-decoration: none; border-radius: 10px; padding: 14px 18px; text-align: center;">
                  ${safeActionText}
                </a>
              </div>
              ` : ''}

              <p style="margin: 0 0 20px 0; font-size: 13px; color: #737373; line-height: 1.5;">
                This code is valid for <strong>${validityMinutes} minutes</strong>. If you did not make this request, you can safely ignore this email.
              </p>

              <p style="margin: 0 0 24px 0; font-size: 14px; color: #262626; line-height: 1.5;">
                Thanks,<br>
                <strong style="color: #000000;">The Prople Team</strong>
              </p>

              <div style="border-top: 1px solid #dbdbdb; padding-top: 20px; text-align: center; font-size: 11px; color: #8e8e8e; line-height: 1.6;">
                <div style="font-weight: 600; color: #737373; text-transform: uppercase; letter-spacing: 0.8px; font-size: 11px; margin-bottom: 6px;">from CLOAKTAIL</div>
                <div>&copy; Cloaktail Industries &bull; Prople Store &bull; <a href="https://www.prople.co.in" style="color: #0095f6; text-decoration: none;">prople.co.in</a></div>
                ${safeEmail ? `<div style="margin-top: 4px; color: #8e8e8e;">This message was sent to <span style="color: #262626;">${safeEmail}</span> regarding your account.</div>` : ''}
                <div style="margin-top: 8px;">
                  <a href="https://www.prople.co.in/privacy" style="color: #8e8e8e; text-decoration: none; margin: 0 6px;">Privacy Policy</a> &bull;
                  <a href="https://www.prople.co.in/terms" style="color: #8e8e8e; text-decoration: none; margin: 0 6px;">Terms</a> &bull;
                  <a href="mailto:support@prople.co.in" style="color: #8e8e8e; text-decoration: none; margin: 0 6px;">Help Center</a>
                </div>
              </div>

            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

const RTDB_URL = (
  process.env.FIREBASE_DATABASE_URL || ''
).replace(/\/$/, '');

interface StoredOtpRecord {
  code?: string;
  codeHmac?: string;
  email: string;
  expiresAt: number;
  attempts: number;
  createdAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __PROPLE_VERCEL_OTPS: Map<string, StoredOtpRecord> | undefined;
}

const GLOBAL_OTP_STEP_MS = 10 * 60 * 1000; // 10 minutes step

declare global {
  // eslint-disable-next-line no-var
  var __PROPLE_VERCEL_OTPS: Map<string, StoredOtpRecord> | undefined;
  // eslint-disable-next-line no-var
  var __PROPLE_VERCEL_CONSUMED_CODES: Map<string, number> | undefined;
}

if (!globalThis.__PROPLE_VERCEL_OTPS) {
  globalThis.__PROPLE_VERCEL_OTPS = new Map<string, StoredOtpRecord>();
}
if (!globalThis.__PROPLE_VERCEL_CONSUMED_CODES) {
  globalThis.__PROPLE_VERCEL_CONSUMED_CODES = new Map<string, number>();
}

const memoryStore = globalThis.__PROPLE_VERCEL_OTPS;
const consumedCodesStore = globalThis.__PROPLE_VERCEL_CONSUMED_CODES;

function computeTotpCode(email: string, stepIndex: number): string {
  const norm = email.toLowerCase().trim();
  const secret = getSessionSecret();
  const hmac = crypto.createHmac('sha256', secret).update(`prople_totp:${norm}:${stepIndex}`).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (binary % 1000000).toString().padStart(6, '0');
}

function generateTotpCode(email: string): string {
  const stepIndex = Math.floor(Date.now() / GLOBAL_OTP_STEP_MS);
  return computeTotpCode(email, stepIndex);
}

function createSignedChallengeToken(email: string, code: string, ttlMinutes = 30): string {
  const norm = email.toLowerCase().trim();
  const cleanCode = code.trim();
  const expiresAt = Date.now() + Math.round(ttlMinutes * 60 * 1000);
  const secret = getSessionSecret();
  const payload = JSON.stringify({
    e: norm,
    h: crypto.createHmac('sha256', secret).update(`${norm}:${cleanCode}`).digest('hex'),
    exp: expiresAt,
  });
  const b64Payload = Buffer.from(payload, 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(b64Payload).digest('base64url');
  return `${b64Payload}.${sig}`;
}

function verifyChallengeToken(
  token: string | undefined | null,
  email: string,
  inputCode: string
): { valid: boolean; error?: string } {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return { valid: false };
  }
  try {
    const [b64Payload, sig] = token.split('.');
    const secret = getSessionSecret();
    const expectedSig = crypto.createHmac('sha256', secret).update(b64Payload).digest('base64url');
    if (!timingSafeEqualString(sig, expectedSig)) {
      return { valid: false };
    }
    const payloadJson = Buffer.from(b64Payload, 'base64url').toString('utf8');
    const data = JSON.parse(payloadJson);
    const norm = email.toLowerCase().trim();
    if (data.e !== norm) {
      return { valid: false };
    }
    if (Date.now() > data.exp + 3 * 60 * 1000) {
      return { valid: false, error: 'Verification code has expired. Please request a new verification code.' };
    }
    const cleanCode = inputCode.trim();
    const expectedHash = crypto.createHmac('sha256', secret).update(`${norm}:${cleanCode}`).digest('hex');
    if (!timingSafeEqualString(data.h, expectedHash)) {
      return { valid: false, error: 'Incorrect verification code. Please check your email and enter the latest 6 digits.' };
    }
    return { valid: true };
  } catch {
    return { valid: false };
  }
}

function getOtpKey(email: string): string {
  return Buffer.from(email.toLowerCase().trim()).toString('base64url');
}

async function persistOtp(email: string, code: string, ttlMinutes = 30): Promise<void> {
  const norm = email.toLowerCase().trim();
  const cleanCode = code.trim();
  const now = Date.now();
  const expiresAt = now + Math.round(ttlMinutes * 60 * 1000);

  const record: StoredOtpRecord = {
    code: cleanCode,
    codeHmac: hmacDigest(cleanCode, norm),
    email: norm,
    expiresAt,
    attempts: 0,
    createdAt: now,
  };

  memoryStore.set(norm, record);

  if (!RTDB_URL) {
    return;
  }

  try {
    const key = getOtpKey(norm);
    const url = `${RTDB_URL}/_auth_otps/${key}.json`;
    await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: cleanCode,
        codeHmac: record.codeHmac,
        email: norm,
        expiresAt,
        attempts: 0,
        createdAt: now,
      }),
      signal: AbortSignal.timeout(3500),
    });
  } catch (err: any) {
    console.warn('[Distributed OTP] RTDB sync notice:', err?.message || err);
  }
}

async function verifyAndConsumeOtpRecord(
  email: string,
  inputCode: string,
  consume = true,
  challengeToken?: string
): Promise<{ valid: boolean; error?: string }> {
  const norm = email.toLowerCase().trim();
  const cleanCode = String(inputCode || '').trim();
  if (!cleanCode || !/^\d{6}$/.test(cleanCode)) {
    return { valid: false, error: 'Please enter a valid 6-digit verification code.' };
  }

  const key = getOtpKey(norm);
  const now = Date.now();

  // 1. Check signed challenge token first
  if (challengeToken) {
    const challengeResult = verifyChallengeToken(challengeToken, norm, cleanCode);
    if (challengeResult.valid) {
      if (consume) {
        memoryStore.delete(norm);
        consumedCodesStore.set(`${norm}:${cleanCode}`, now + 45 * 60 * 1000);
      }
      return { valid: true };
    } else if (challengeResult.error && challengeResult.error.includes('expired')) {
      return challengeResult;
    }
  }

  // 2. Check memory store
  const memRec = memoryStore.get(norm) || null;
  if (memRec) {
    if (now <= memRec.expiresAt + 3 * 60 * 1000) {
      const matchesPlain = memRec.code ? timingSafeEqualString(String(memRec.code), cleanCode) : false;
      const matchesHmac = memRec.codeHmac ? timingSafeEqualString(memRec.codeHmac, hmacDigest(cleanCode, norm)) : false;
      if (matchesPlain || matchesHmac) {
        if (consume) {
          memoryStore.delete(norm);
          consumedCodesStore.set(`${norm}:${cleanCode}`, now + 45 * 60 * 1000);
        }
        return { valid: true };
      }
    }
  }

  // 3. Check multi-window stateless TOTP (up to 40 minutes across any instance)
  const currentStep = Math.floor(now / GLOBAL_OTP_STEP_MS);
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
        memoryStore.delete(norm);
      }
      return { valid: true };
    }
  }

  // 4. Check RTDB if accessible
  if (RTDB_URL) {
    try {
      const rtdbRes = await fetch(`${RTDB_URL}/_auth_otps/${key}.json`, {
        signal: AbortSignal.timeout(2500),
      });
      if (rtdbRes.ok) {
        const data = await rtdbRes.json();
        if (data && typeof data === 'object') {
          const rtdbRec = data as StoredOtpRecord;
          if (now <= (rtdbRec.expiresAt || 0) + 3 * 60 * 1000) {
            const matchesHmac = rtdbRec.codeHmac ? timingSafeEqualString(rtdbRec.codeHmac, hmacDigest(cleanCode, norm)) : false;
            const matchesPlain = rtdbRec.code ? timingSafeEqualString(String(rtdbRec.code), cleanCode) : false;
            if (matchesHmac || matchesPlain) {
              if (consume) {
                memoryStore.delete(norm);
                consumedCodesStore.set(`${norm}:${cleanCode}`, now + 45 * 60 * 1000);
              }
              return { valid: true };
            }
          }
        }
      }
    } catch {}
  }

  return {
    valid: false,
    error: 'Incorrect verification code. Please check your email and enter the latest 6 digits.',
  };
}

async function dispatchResendEmail(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  html: string
): Promise<{ ok: boolean; status: number; error?: string }> {
  try {
    const cleanKey = apiKey.trim().replace(/^['"]|['"]$/g, '');
    const cleanFrom = from.trim();
    const cleanTo = to.trim().toLowerCase();

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cleanKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: cleanFrom,
        to: [cleanTo],
        subject: subject.trim(),
        html,
      }),
    });
    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      console.warn(`[Resend Dispatch Failed] from: "${cleanFrom}" status: ${response.status} body: ${errBody}`);
      return { ok: false, status: response.status, error: errBody };
    }
    console.log(`[Resend Dispatch Success] from: "${cleanFrom}" to: "${cleanTo}" status: ${response.status}`);
    return { ok: true, status: response.status };
  } catch (err: any) {
    console.warn(`[Resend Dispatch Exception] from: "${from}" error: ${err?.message || err}`);
    return { ok: false, status: 0, error: err?.message };
  }
}

function parseBody(req: any): any {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
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

  const rawAction = (req.query?.action || '').toString().toLowerCase().trim();
  const urlPath = (req.url || '').split('?')[0];
  const pathAction = urlPath.split('/').pop()?.toLowerCase().trim() || '';
  const action = rawAction || pathAction;

  const body = parseBody(req);
  const email = (body.email || req.query?.email || '').toString().toLowerCase().trim();

  try {
    if (action === 'send-otp') {
      if (!email || !email.includes('@')) {
        return res.status(400).json({ success: false, error: 'A valid email address is required.' });
      }

      const code = generateTotpCode(email);
      const challengeToken = createSignedChallengeToken(email, code, 30);
      const sessionKey = getOtpKey(email);

      await Promise.all([
        persistOtp(email, code, 30).catch(() => {}),
        RTDB_URL
          ? fetch(`${RTDB_URL}/_auth_sessions/${sessionKey}.json`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'pending', email, createdAt: Date.now() }),
              signal: AbortSignal.timeout(3000),
            }).catch(() => {})
          : Promise.resolve(),
      ]);

      const candidateKeys = getCandidateResendApiKeys();
      const verifyLink = `https://www.prople.co.in/?auth=verify-email&email=${encodeURIComponent(email)}&code=${code}&token=${encodeURIComponent(challengeToken)}`;
      let emailSent = false;
      let lastResendError = '';

      const recipientName = formatRecipientName(body.name || body.displayName, email);
      const htmlContent = renderPropleEmail({
        recipientName,
        email,
        title: 'Please verify your identity',
        purposeText: 'Here is your Prople Store authentication verification code:',
        code,
        validityMinutes: 30,
        actionUrl: verifyLink,
        actionText: 'Verify Email',
      });

      const primarySender = (process.env.AUTH_EMAIL_FROM || '').trim() || 'The Prople Team <auth@prople.co.in>';
      const candidateSenders = Array.from(
        new Set([
          primarySender,
          'The Prople Team <auth@prople.co.in>',
          'Prople Store <auth@prople.co.in>',
          'Prople Store <onboarding@resend.dev>',
        ].filter(Boolean))
      );

      if (candidateKeys.length === 0) {
        return res.status(500).json({
          success: false,
          error: 'Email delivery is not configured: missing RESEND_API_KEY environment variable.',
        });
      }

      for (const key of candidateKeys) {
        for (const sender of candidateSenders) {
          const result = await dispatchResendEmail(
            key,
            sender,
            email,
            `${code} is your Prople Store verification code`,
            htmlContent
          );
          if (result.ok) {
            emailSent = true;
            break;
          } else if (result.error) {
            lastResendError = result.error;
            if (result.status === 401 || result.status === 403) {
              console.warn(`[Resend] Key returned ${result.status}, trying fallback key...`);
              break;
            }
          }
        }
        if (emailSent) break;
      }

      if (!emailSent) {
        console.warn('[Auth] Resend dispatch did not succeed, attempting Firebase Identity Toolkit fallback...');
        const fbResult = await sendFirebaseOobCode('VERIFY_EMAIL', email, verifyLink);
        if (fbResult.success) {
          emailSent = true;
        } else {
          lastResendError = fbResult.error || lastResendError;
        }
      }

      if (!emailSent) {
        return res.status(500).json({
          success: false,
          error: lastResendError || 'Failed to dispatch verification email. Please check your email configuration.',
        });
      }

      return res.status(200).json({
        success: true,
        delivered: true,
        challengeToken,
        message: `A verification code has been dispatched to ${email}. Please check your inbox or spam folder.`,
      });
    }

    if (action === 'forgot-password' || action === 'send-reset-link') {
      if (!email || !email.includes('@')) {
        return res.status(400).json({ success: false, error: 'A valid email address is required.' });
      }

      const code = generateTotpCode(email);
      const challengeToken = createSignedChallengeToken(email, code, 30);
      const sessionKey = getOtpKey(email);

      await Promise.all([
        persistOtp(email, code, 30).catch(() => {}),
        RTDB_URL
          ? fetch(`${RTDB_URL}/_auth_sessions/${sessionKey}.json`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'pending', email, createdAt: Date.now() }),
              signal: AbortSignal.timeout(3000),
            }).catch(() => {})
          : Promise.resolve(),
      ]);

      const candidateKeys = getCandidateResendApiKeys();
      const resetLink = `https://www.prople.co.in/?auth=reset-password&email=${encodeURIComponent(email)}&code=${code}&token=${encodeURIComponent(challengeToken)}`;
      let emailSent = false;
      let lastResendError = '';

      const recipientName = formatRecipientName(body.name || body.displayName, email);
      const htmlContent = renderPropleEmail({
        recipientName,
        email,
        title: 'Reset your password',
        purposeText: 'Here is your Prople Store password reset code:',
        code,
        validityMinutes: 30,
        actionUrl: resetLink,
        actionText: 'Reset Password',
        isPasswordReset: true,
      });

      const primarySender = (process.env.AUTH_EMAIL_FROM || '').trim() || 'The Prople Team <auth@prople.co.in>';
      const candidateSenders = Array.from(
        new Set([
          primarySender,
          'The Prople Team <auth@prople.co.in>',
          'Prople Store <auth@prople.co.in>',
          'Prople Store <onboarding@resend.dev>',
        ].filter(Boolean))
      );

      if (candidateKeys.length === 0) {
        return res.status(500).json({
          success: false,
          error: 'Email delivery is not configured: missing RESEND_API_KEY environment variable.',
        });
      }

      for (const key of candidateKeys) {
        for (const sender of candidateSenders) {
          const sent = await dispatchResendEmail(
            key,
            sender,
            email,
            `${code} is your Prople Store password reset code`,
            htmlContent
          );
          if (sent.ok) {
            emailSent = true;
            break;
          } else if (sent.error) {
            lastResendError = sent.error;
            if (sent.status === 401 || sent.status === 403) {
              console.warn(`[Resend] Key returned ${sent.status}, trying fallback key...`);
              break;
            }
          }
        }
        if (emailSent) break;
      }

      if (!emailSent) {
        console.warn('[Auth] Resend dispatch did not succeed, attempting Firebase Identity Toolkit fallback...');
        const fbResult = await sendFirebaseOobCode('PASSWORD_RESET', email, resetLink);
        if (fbResult.success) {
          emailSent = true;
        } else {
          lastResendError = fbResult.error || lastResendError;
        }
      }

      if (!emailSent) {
        return res.status(500).json({
          success: false,
          error: lastResendError || 'Failed to dispatch password reset email. Please check your email configuration.',
        });
      }

      return res.status(200).json({
        success: true,
        delivered: true,
        challengeToken,
        message: `A password reset code and link have been dispatched to ${email}. Please check your inbox or spam folder.`,
      });
    }

    if (action === 'verify-otp') {
      const code = (body.code || '').toString().trim();
      const clientChallengeToken = body.challengeToken || req.headers?.['x-challenge-token'];
      if (!email || !code) {
        return res.status(400).json({ success: false, error: 'Email and verification code are required.' });
      }

      const verification = await verifyAndConsumeOtpRecord(email, code, true, clientChallengeToken);
      if (!verification.valid) {
        return res.status(400).json({
          success: false,
          error: verification.error || 'Incorrect verification code. Please check your email and enter the latest 6 digits.',
        });
      }

      const verifiedUser = {
        uid: `usr_email_${Buffer.from(email).toString('base64url').slice(0, 24)}`,
        email,
        displayName: email.split('@')[0],
        isEmailVerified: true,
      };

      const key = getOtpKey(email);
      if (RTDB_URL) {
        fetch(`${RTDB_URL}/_auth_sessions/${key}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'completed', email, createdAt: Date.now(), user: verifiedUser }),
        }).catch(() => {});
      }

      return res.status(200).json({
        success: true,
        user: verifiedUser,
      });
    }

    if (action === 'verify-reset-code') {
      const code = (body.code || '').toString().trim();
      const clientChallengeToken = body.challengeToken || req.headers?.['x-challenge-token'];
      if (!email || !code) {
        return res.status(400).json({ success: false, error: 'Email and verification code are required.' });
      }

      const verification = await verifyAndConsumeOtpRecord(email, code, false, clientChallengeToken);
      if (!verification.valid) {
        return res.status(400).json({
          success: false,
          error: verification.error || 'Incorrect verification code. Please check your email and enter the latest 6 digits.',
        });
      }

      return res.status(200).json({ success: true, challengeToken: clientChallengeToken });
    }

    if (action === 'reset-password') {
      const code = (body.code || '').toString().trim();
      const newPassword = (body.newPassword || '').toString();
      const clientChallengeToken = body.challengeToken || req.headers?.['x-challenge-token'];
      if (!email || !code || !newPassword || newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          error: 'Valid email, verification code, and password (min 6 characters) are required.',
        });
      }

      let isValid = false;
      let verifyError = 'Incorrect verification code. Please check your email and enter the latest 6 digits.';

      if (/^\d{6}$/.test(code)) {
        const verification = await verifyAndConsumeOtpRecord(email, code, true, clientChallengeToken);
        isValid = verification.valid;
        if (verification.error) verifyError = verification.error;
      } else if (code.length > 8) {
        const fbApiKey = process.env.FIREBASE_API_KEY || '';
        if (fbApiKey) {
          try {
            const fbRes = await fetch(
              `https://identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=${fbApiKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ oobCode: code, newPassword }),
              }
            );
            if (fbRes.ok) {
              isValid = true;
            }
          } catch {}
        }
      }

      if (!isValid) {
        return res.status(400).json({
          success: false,
          error: verifyError,
        });
      }

      const key = getOtpKey(email);
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.pbkdf2Sync(newPassword, salt, 10000, 64, 'sha512').toString('hex');
      const pwdHash = `${salt}:${hash}`;

      if (RTDB_URL) {
        fetch(`${RTDB_URL}/_auth_otps/pwd_${key}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hash: pwdHash, updatedAt: Date.now() }),
        }).catch(() => {});
      }

      const finalUser = {
        uid: `usr_email_${Buffer.from(email).toString('base64url').slice(0, 24)}`,
        email,
        displayName: email.split('@')[0],
        isEmailVerified: true,
      };

      if (RTDB_URL) {
        fetch(`${RTDB_URL}/_auth_sessions/${key}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'completed', email, createdAt: Date.now(), user: finalUser }),
        }).catch(() => {});
      }

      return res.status(200).json({
        success: true,
        message: 'Your password has been successfully reset. You may now sign in.',
        user: finalUser,
      });
    }

    if (action === 'verify-password') {
      const password = (body.password || '').toString();
      if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Email and password are required.' });
      }

      const key = getOtpKey(email);
      try {
        if (RTDB_URL) {
          const pwdRes = await fetch(`${RTDB_URL}/_auth_otps/pwd_${key}.json`, {
            signal: AbortSignal.timeout(3000),
          });
          if (pwdRes.ok) {
            const pwdData = await pwdRes.json();
            if (pwdData && typeof pwdData.hash === 'string' && pwdData.hash.includes(':')) {
              const [salt, storedHex] = pwdData.hash.split(':');
              const computed = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
              if (timingSafeEqualString(computed, storedHex)) {
                return res.status(200).json({
                  success: true,
                  user: {
                    uid: `usr_email_${Buffer.from(email).toString('base64url').slice(0, 24)}`,
                    email,
                    displayName: email.split('@')[0],
                    isEmailVerified: true,
                  },
                });
              }
            }
          }
        }
      } catch {}

      const fbApiKey = process.env.FIREBASE_API_KEY || '';
      if (fbApiKey) {
        try {
          const idtRes = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${fbApiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password, returnSecureToken: true }),
            }
          );
          if (idtRes.ok) {
            const idtData = await idtRes.json();
            if (idtData && idtData.localId) {
              return res.status(200).json({
                success: true,
                user: {
                  uid: idtData.localId,
                  email,
                  displayName: idtData.displayName || email.split('@')[0],
                  isEmailVerified: Boolean(idtData.emailVerified),
                },
              });
            }
          }
        } catch {}
      }

      return res.status(401).json({ success: false, error: 'auth/invalid-credential' });
    }

    if (action === 'check-security-status') {
      return res.status(200).json({
        success: true,
        allowed: true,
        isIpLocked: false,
        remainingAttempts: 5,
      });
    }

    if (action === 'report-failed-login') {
      return res.status(200).json({
        success: true,
        isLocked: false,
        strikeCount: 1,
      });
    }

    if (action === 'report-successful-login') {
      return res.status(200).json({ success: true });
    }

    if (action === 'session-status') {
      if (!email) {
        return res.status(200).json({ success: true, status: 'none' });
      }

      const key = getOtpKey(email);
      if (RTDB_URL) {
        try {
          const rtdbRes = await fetch(`${RTDB_URL}/_auth_sessions/${key}.json`).catch(() => null);
          if (rtdbRes && rtdbRes.ok) {
            const rec = await rtdbRes.json().catch(() => null);
            if (rec && typeof rec === 'object' && rec.status) {
              return res.status(200).json({
                success: true,
                status: rec.status,
                user: rec.user || undefined,
              });
            }
          }
        } catch {}
      }

      return res.status(200).json({ success: true, status: 'none' });
    }

    if (action === 'consume-session') {
      if (email && RTDB_URL) {
        const key = getOtpKey(email);
        fetch(`${RTDB_URL}/_auth_sessions/${key}.json`, { method: 'DELETE' }).catch(() => {});
      }
      return res.status(200).json({ success: true });
    }

    if (action === 'migrate-user-rights') {
      return res.status(200).json({ success: true, user: null });
    }

    return res.status(404).json({ success: false, error: `Unknown auth action: ${action}` });
  } catch (err: any) {
    console.warn('[auth router notice]', err?.message || err);
    return res.status(500).json({ success: false, error: err?.message || 'Authentication service error' });
  }
}
