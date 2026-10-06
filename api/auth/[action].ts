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

function hmacDigest(value: string, salt = ''): string {
  const secret =
    process.env.SESSION_SECRET ||
    process.env.INTERNAL_SECURITY_KEY ||
    'prople-store-high-entropy-security-key-2026';
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

const DEFAULT_RESEND_API_KEY = 're_cCvaGHEg_A9mhHNEfaUFBoNRi736V9bPL';

function getResendApiKey(): string {
  let key = (
    process.env.RESEND_API_KEY ||
    process.env.RESEND_API_KEY_ ||
    process.env.VITE_RESEND_API_KEY ||
    process.env.RESEND_KEY ||
    process.env.VITE_RESEND_KEY ||
    DEFAULT_RESEND_API_KEY
  ).trim();

  if (!key) {
    try {
      const envPath = path.join(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        const match = content.match(/RESEND_API_KEY\s*=\s*([^\r\n]+)/);
        if (match && match[1]) {
          key = match[1].trim().replace(/^['"]|['"]$/g, '');
        }
      }
    } catch {}
  }

  return key;
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
  const spacedCode = safeCode.split('').join(' ');
  const safeEmail = escapeHtmlStr(email || '');
  const safeActionUrl = actionUrl ? escapeHtmlStr(actionUrl) : '';
  const defaultActionText = isPasswordReset ? 'Reset Password' : 'Verify Email';
  const safeActionText = escapeHtmlStr(actionText || defaultActionText);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
<body style="margin: 0; padding: 0; background-color: #0d1117; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e6edf3; -webkit-font-smoothing: antialiased; line-height: 1.6;">
  <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; max-width: 0px; opacity: 0;">
    ${safeCode} is your Prople Store authentication code. Valid for ${validityMinutes} minutes. &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0d1117; width: 100%;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <div style="max-width: 560px; width: 100%; text-align: left;">
          <div style="margin-bottom: 28px;">
            <a href="https://www.prople.co.in" target="_blank" style="text-decoration: none; display: inline-flex; align-items: center; gap: 12px;">
              <img src="https://www.prople.co.in/logo.png" width="36" height="36" alt="Prople Store" style="display: block; width: 36px; height: 36px; border-radius: 8px; border: 0;" />
              <span style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.4px;">Prople Store</span>
            </a>
          </div>

          <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 600; color: #ffffff; line-height: 1.35;">
            ${safeTitle}, <span style="color: #60a5fa;">${displayUser}</span>
          </h1>

          <div style="background-color: #161b22; border: 1px solid #30363d; border-radius: 10px; padding: 26px 24px; margin-bottom: 24px;">
            <p style="margin: 0 0 18px 0; font-size: 15px; color: #c9d1d9; line-height: 1.6;">
              ${safePurpose}
            </p>

            <div style="margin: 22px 0; text-align: left;">
              <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #8b949e; margin-bottom: 8px;">
                Authentication Code
              </div>
              <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #ffffff; background-color: #0d1117; border: 1px solid #30363d; border-radius: 8px; padding: 14px 22px; display: inline-block;">
                ${spacedCode}
              </div>
            </div>

            ${safeActionUrl ? `
            <div style="margin: 26px 0 20px 0;">
              <a href="${safeActionUrl}" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-weight: 600; font-size: 15px; text-decoration: none; padding: 13px 30px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.3); text-align: center; border: 1px solid rgba(255,255,255,0.1);">
                ${safeActionText} &rarr;
              </a>
            </div>
            <p style="margin: 0 0 20px 0; font-size: 13px; color: #8b949e; word-break: break-all; line-height: 1.5;">
              Or click this direct link: <a href="${safeActionUrl}" style="color: #58a6ff; text-decoration: underline;">${safeActionUrl}</a>
            </p>
            ` : ''}

            <p style="margin: 18px 0 10px 0; font-size: 13px; color: #8b949e; line-height: 1.5;">
              This code ${safeActionUrl ? 'and link are' : 'is'} valid for <strong>${validityMinutes} minutes</strong> and can only be used once.
            </p>
            <p style="margin: 0 0 20px 0; font-size: 13px; color: #8b949e; line-height: 1.5;">
              <strong>Please don't share this code with anyone:</strong> we'll never ask for it on the phone or via email.
            </p>
            <p style="margin: 22px 0 0 0; font-size: 14px; color: #c9d1d9; line-height: 1.5;">
              Thanks,<br>
              <strong style="color: #ffffff;">The Prople Team</strong>
            </p>
          </div>

          <div style="border-top: 1px solid #21262d; padding-top: 20px; font-size: 12px; color: #8b949e; line-height: 1.6;">
            <div>
              <strong style="color: #c9d1d9;">Prople Store</strong> &bull; Multi-Platform Application &amp; Web Store &bull; Cloaktail Industries
            </div>
            <div style="margin-top: 6px;">
              Delivered securely from <a href="https://www.prople.co.in" style="color: #58a6ff; text-decoration: none;">prople.co.in</a> &bull;
              <a href="https://www.prople.co.in/privacy" style="color: #58a6ff; text-decoration: none;">Privacy Policy</a> &bull;
              <a href="https://www.prople.co.in/terms" style="color: #58a6ff; text-decoration: none;">Terms of Service</a> &bull;
              <a href="mailto:support@prople.co.in" style="color: #58a6ff; text-decoration: none;">support@prople.co.in</a>
            </div>
            ${safeEmail ? `
            <div style="margin-top: 8px; color: #6e7681; font-size: 11px;">
              This email was sent to ${safeEmail} regarding your Prople Store account. If you did not initiate this request, you can safely ignore this email.
            </div>
            ` : ''}
          </div>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

const RTDB_URL = (
  process.env.FIREBASE_DATABASE_URL ||
  'https://prople-store-3efed-default-rtdb.firebaseio.com'
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

if (!globalThis.__PROPLE_VERCEL_OTPS) {
  globalThis.__PROPLE_VERCEL_OTPS = new Map<string, StoredOtpRecord>();
}

const memoryStore = globalThis.__PROPLE_VERCEL_OTPS;

function getOtpKey(email: string): string {
  return Buffer.from(email.toLowerCase().trim()).toString('base64url');
}

async function persistOtp(email: string, code: string, ttlMinutes = 15): Promise<void> {
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
      signal: AbortSignal.timeout(3500),
    });
  } catch (err: any) {
    console.warn('[Distributed OTP] RTDB sync notice:', err?.message || err);
  }
}

async function verifyAndConsumeOtpRecord(
  email: string,
  inputCode: string,
  consume = true
): Promise<{ valid: boolean; error?: string }> {
  const norm = email.toLowerCase().trim();
  const cleanCode = String(inputCode || '').trim();
  if (!cleanCode || !/^\d{6}$/.test(cleanCode)) {
    return { valid: false, error: 'Please enter a valid 6-digit verification code.' };
  }

  const key = getOtpKey(norm);
  const now = Date.now();

  const memRec = memoryStore.get(norm) || null;
  let rtdbRec: StoredOtpRecord | null = null;

  try {
    const rtdbRes = await fetch(`${RTDB_URL}/_auth_otps/${key}.json`, {
      signal: AbortSignal.timeout(3500),
    });
    if (rtdbRes.ok) {
      const data = await rtdbRes.json();
      if (data && typeof data === 'object' && (data.code || data.codeHmac)) {
        rtdbRec = data as StoredOtpRecord;
      }
    }
  } catch {}

  let rec: StoredOtpRecord | null = null;
  if (memRec && rtdbRec) {
    rec = (memRec.createdAt || 0) >= (rtdbRec.createdAt || 0) ? memRec : rtdbRec;
  } else {
    rec = memRec || rtdbRec;
  }

  if (!rec) {
    return {
      valid: false,
      error: 'Verification code not found or expired. Please request a new verification code.',
    };
  }

  if (now > rec.expiresAt) {
    memoryStore.delete(norm);
    fetch(`${RTDB_URL}/_auth_otps/${key}.json`, { method: 'DELETE' }).catch(() => {});
    return {
      valid: false,
      error: 'Verification code has expired. Please request a new verification code.',
    };
  }

  if ((rec.attempts || 0) >= 5) {
    memoryStore.delete(norm);
    fetch(`${RTDB_URL}/_auth_otps/${key}.json`, { method: 'DELETE' }).catch(() => {});
    return {
      valid: false,
      error: 'Too many incorrect attempts. Please request a new verification code.',
    };
  }

  const matchesHmac = rec.codeHmac
    ? timingSafeEqualString(rec.codeHmac, hmacDigest(cleanCode, norm))
    : false;
  const matchesPlain = rec.code
    ? timingSafeEqualString(String(rec.code), cleanCode)
    : false;

  if (!matchesHmac && !matchesPlain) {
    rec.attempts = (rec.attempts || 0) + 1;
    memoryStore.set(norm, rec);
    fetch(`${RTDB_URL}/_auth_otps/${key}/attempts.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rec.attempts),
    }).catch(() => {});

    return {
      valid: false,
      error: 'Invalid verification code. Please check your email and try again.',
    };
  }

  if (consume) {
    memoryStore.delete(norm);
    fetch(`${RTDB_URL}/_auth_otps/${key}.json`, { method: 'DELETE' }).catch(() => {});
  }

  return { valid: true };
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
    // 1. send-otp
    if (action === 'send-otp') {
      if (!email || !email.includes('@')) {
        return res.status(400).json({ success: false, error: 'A valid email address is required.' });
      }

      const code = crypto.randomInt(100000, 1000000).toString();
      const sessionKey = getOtpKey(email);

      await Promise.all([
        persistOtp(email, code, 15).catch(() => {}),
        fetch(`${RTDB_URL}/_auth_sessions/${sessionKey}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'pending', email, createdAt: Date.now() }),
          signal: AbortSignal.timeout(3000),
        }).catch(() => {}),
      ]);

      const resendApiKey = getResendApiKey();
      const verifyLink = `https://www.prople.co.in/?auth=verify-email&email=${encodeURIComponent(email)}&code=${code}`;
      let emailSent = false;
      let lastResendError = '';

      if (resendApiKey) {
        const recipientName = formatRecipientName(body.name || body.displayName, email);
        const htmlContent = renderPropleEmail({
          recipientName,
          email,
          title: 'Please verify your identity',
          purposeText: 'Here is your Prople Store authentication verification code and direct link:',
          code,
          validityMinutes: 15,
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

        for (const sender of candidateSenders) {
          const result = await dispatchResendEmail(
            resendApiKey,
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
          }
        }
      } else {
        lastResendError = 'RESEND_API_KEY is not configured in server environment';
      }

      if (!emailSent) {
        return res.status(500).json({
          success: false,
          error:
            lastResendError ||
            'Failed to dispatch verification email via Resend. Please check your Resend API key and domain configuration.',
        });
      }

      return res.status(200).json({
        success: true,
        delivered: true,
        message: `A verification code has been dispatched to ${email}. Please check your inbox or spam folder.`,
      });
    }

    // 2. forgot-password / send-reset-link
    if (action === 'forgot-password' || action === 'send-reset-link') {
      if (!email || !email.includes('@')) {
        return res.status(400).json({ success: false, error: 'A valid email address is required.' });
      }

      const code = crypto.randomInt(100000, 1000000).toString();
      const sessionKey = getOtpKey(email);

      await Promise.all([
        persistOtp(email, code, 15).catch(() => {}),
        fetch(`${RTDB_URL}/_auth_sessions/${sessionKey}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'pending', email, createdAt: Date.now() }),
          signal: AbortSignal.timeout(3000),
        }).catch(() => {}),
      ]);

      const resendApiKey = getResendApiKey();
      const resetLink = `https://www.prople.co.in/?auth=reset-password&email=${encodeURIComponent(email)}&code=${code}`;
      let emailSent = false;
      let lastResendError = '';

      if (resendApiKey) {
        const recipientName = formatRecipientName(body.name || body.displayName, email);
        const htmlContent = renderPropleEmail({
          recipientName,
          email,
          title: 'Reset your password',
          purposeText: 'Here is your Prople Store password reset code and direct link:',
          code,
          validityMinutes: 15,
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

        for (const sender of candidateSenders) {
          const sent = await dispatchResendEmail(
            resendApiKey,
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
          }
        }
      } else {
        lastResendError = 'RESEND_API_KEY is not configured in server environment';
      }

      if (!emailSent) {
        return res.status(500).json({
          success: false,
          error:
            lastResendError ||
            'Failed to dispatch password reset email via Resend. Please check your Resend API key and domain configuration.',
        });
      }

      return res.status(200).json({
        success: true,
        delivered: true,
        message: `A password reset code and link have been dispatched to ${email}. Please check your inbox or spam folder.`,
      });
    }

    // 3. verify-otp (Strict cryptographic verification - ZERO random code acceptance)
    if (action === 'verify-otp') {
      const code = (body.code || '').toString().trim();
      if (!email || !code) {
        return res.status(400).json({ success: false, error: 'Email and verification code are required.' });
      }

      const verification = await verifyAndConsumeOtpRecord(email, code, true);
      if (!verification.valid) {
        return res.status(400).json({
          success: false,
          error: verification.error || 'Invalid or expired verification code.',
        });
      }

      const verifiedUser = {
        uid: `usr_email_${Buffer.from(email).toString('base64url').slice(0, 24)}`,
        email,
        displayName: email.split('@')[0],
        isEmailVerified: true,
      };

      const key = getOtpKey(email);
      fetch(`${RTDB_URL}/_auth_sessions/${key}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed', email, createdAt: Date.now(), user: verifiedUser }),
      }).catch(() => {});

      return res.status(200).json({
        success: true,
        user: verifiedUser,
      });
    }

    // 3b. verify-reset-code (Step 1 of password reset - verifies code without consuming it yet)
    if (action === 'verify-reset-code') {
      const code = (body.code || '').toString().trim();
      if (!email || !code) {
        return res.status(400).json({ success: false, error: 'Email and verification code are required.' });
      }

      const verification = await verifyAndConsumeOtpRecord(email, code, false);
      if (!verification.valid) {
        return res.status(400).json({
          success: false,
          error: verification.error || 'Invalid or expired verification code.',
        });
      }

      return res.status(200).json({ success: true });
    }

    // 4. reset-password (Strict cryptographic verification - ZERO random code acceptance)
    if (action === 'reset-password') {
      const code = (body.code || '').toString().trim();
      const newPassword = (body.newPassword || '').toString();
      if (!email || !code || !newPassword || newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          error: 'Valid email, verification code, and password (min 6 characters) are required.',
        });
      }

      let isValid = false;
      let verifyError = 'Invalid or expired verification code.';

      // Check stored 6-digit OTP
      if (/^\d{6}$/.test(code)) {
        const verification = await verifyAndConsumeOtpRecord(email, code, true);
        isValid = verification.valid;
        if (verification.error) verifyError = verification.error;
      } else if (code.length > 8) {
        // Firebase oobCode from Firebase action link
        const fbApiKey = process.env.FIREBASE_API_KEY || 'AIzaSyC5iotZL4UVF7QcdVn1ps3gIcetBDt9sc4';
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

      fetch(`${RTDB_URL}/_auth_otps/pwd_${key}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash: pwdHash, updatedAt: Date.now() }),
      }).catch(() => {});

      const finalUser = {
        uid: `usr_email_${Buffer.from(email).toString('base64url').slice(0, 24)}`,
        email,
        displayName: email.split('@')[0],
        isEmailVerified: true,
      };

      fetch(`${RTDB_URL}/_auth_sessions/${key}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed', email, createdAt: Date.now(), user: finalUser }),
      }).catch(() => {});

      return res.status(200).json({
        success: true,
        message: 'Your password has been successfully reset. You may now sign in.',
        user: finalUser,
      });
    }

    // 5. verify-password
    if (action === 'verify-password') {
      const password = (body.password || '').toString();
      if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Email and password are required.' });
      }

      const key = getOtpKey(email);
      try {
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
      } catch {}

      const fbApiKey = process.env.FIREBASE_API_KEY || 'AIzaSyC5iotZL4UVF7QcdVn1ps3gIcetBDt9sc4';
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

      return res.status(401).json({ success: false, error: 'auth/invalid-credential' });
    }

    // 6. check-security-status
    if (action === 'check-security-status') {
      return res.status(200).json({
        success: true,
        allowed: true,
        isIpLocked: false,
        remainingAttempts: 5,
      });
    }

    // 7. report-failed-login
    if (action === 'report-failed-login') {
      return res.status(200).json({
        success: true,
        isLocked: false,
        strikeCount: 1,
      });
    }

    // 8. report-successful-login
    if (action === 'report-successful-login') {
      return res.status(200).json({ success: true });
    }

    // 9. session-status
    if (action === 'session-status') {
      if (!email) {
        return res.status(200).json({ success: true, status: 'none' });
      }

      const key = getOtpKey(email);
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

      return res.status(200).json({ success: true, status: 'none' });
    }

    // 10. consume-session
    if (action === 'consume-session') {
      if (email) {
        const key = getOtpKey(email);
        fetch(`${RTDB_URL}/_auth_sessions/${key}.json`, { method: 'DELETE' }).catch(() => {});
      }
      return res.status(200).json({ success: true });
    }

    // 11. migrate-user-rights
    if (action === 'migrate-user-rights') {
      return res.status(200).json({ success: true, user: null });
    }

    return res.status(404).json({ success: false, error: `Unknown auth action: ${action}` });
  } catch (err: any) {
    console.warn('[auth router notice]', err?.message || err);
    return res.status(500).json({ success: false, error: err?.message || 'Authentication service error' });
  }
}
