import crypto from 'crypto';
import { Resend } from 'resend';

function escapeHtmlEmail(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function timingSafeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export const getResendApiKey = (): string => {
  return (
    process.env.RESEND_API_KEY_ ||
    process.env.RESEND_API_KEY ||
    process.env.VITE_RESEND_API_KEY ||
    ''
  ).trim();
};

export const getResendClient = (): Resend | null => {
  const key = getResendApiKey();
  if (!key) return null;
  return new Resend(key);
};

export const getAuthEmailFrom = (): string => {
  return (process.env.AUTH_EMAIL_FROM || '').trim() || 'Prople Store <auth@prople.co.in>';
};

// In-memory OTP storage with TTL for high performance (and fallback store)
interface StoredOtp {
  code: string;
  email: string;
  expiresAt: number;
  attempts: number;
}

const otpStore = new Map<string, StoredOtp>();

import { persistOtp, verifyAndConsumeOtp } from './otpStore';

// Cleanup expired OTPs every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of otpStore.entries()) {
    if (val.expiresAt < now) {
      otpStore.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

export function generateOtp(): string {
  // Generate cryptographically secure 6-digit number using CSPRNG
  return crypto.randomInt(100000, 1000000).toString();
}

export async function storeOtp(email: string, code: string, ttlMinutes = 10): Promise<void> {
  const norm = email.toLowerCase().trim();
  otpStore.set(norm, {
    code,
    email: norm,
    expiresAt: Date.now() + ttlMinutes * 60 * 1000,
    attempts: 0,
  });
  await persistOtp(norm, code, ttlMinutes);
}

export async function verifyStoredOtp(email: string, inputCode: string): Promise<{ valid: boolean; error?: string }> {
  const norm = email.toLowerCase().trim();
  const cleanCode = inputCode.trim();

  // First try the distributed store
  const distributedResult = await verifyAndConsumeOtp(norm, cleanCode);
  if (distributedResult.valid) {
    otpStore.delete(norm);
    return { valid: true };
  }

  // Fallback to local memory store if needed
  const entry = otpStore.get(norm);
  if (!entry) {
    return distributedResult;
  }

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(norm);
    return { valid: false, error: 'Verification code has expired. Please request a new code.' };
  }

  if (entry.attempts >= 5) {
    otpStore.delete(norm);
    return { valid: false, error: 'Too many incorrect attempts. Please request a new code.' };
  }

  if (!timingSafeCompare(String(entry.code), cleanCode)) {
    entry.attempts += 1;
    return { valid: false, error: 'Invalid verification code. Please check your email and try again.' };
  }

  // Success: consume OTP
  otpStore.delete(norm);
  return { valid: true };
}

export function formatRecipientName(rawName?: string, email?: string): string {
  if (rawName && typeof rawName === 'string' && rawName.trim().length >= 2) {
    return escapeHtmlEmail(rawName.trim());
  }
  if (!email) return 'there';
  const prefix = email.split('@')[0];
  const cleaned = prefix.replace(/[0-9]+$/, '').replace(/[._-]+/g, ' ').trim();
  if (cleaned.length >= 2) {
    return escapeHtmlEmail(
      cleaned
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ')
    );
  }
  return escapeHtmlEmail(prefix);
}

export function renderGithubEmail({
  recipientName,
  email,
  title,
  purposeText,
  code,
  validityMinutes = 15,
  actionUrl,
  actionText,
}: {
  recipientName?: string;
  email?: string;
  title: string;
  purposeText: string;
  code: string;
  validityMinutes?: number;
  actionUrl?: string;
  actionText?: string;
}): string {
  const displayUser = formatRecipientName(recipientName, email);
  const safeTitle = escapeHtmlEmail(title);
  const safePurpose = escapeHtmlEmail(purposeText);
  const safeCode = escapeHtmlEmail(code);
  const safeActionUrl = actionUrl ? escapeHtmlEmail(actionUrl) : '';
  const safeActionText = escapeHtmlEmail(actionText || 'Reset Password Directly');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0d1117; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #e6edf3; -webkit-font-smoothing: antialiased; line-height: 1.6;">
  <div style="max-width: 560px; margin: 0 auto; padding: 36px 24px;">
    <!-- Brand Header -->
    <div style="margin-bottom: 24px;">
      <a href="https://www.prople.co.in" target="_blank" style="text-decoration: none; display: inline-flex; align-items: center; gap: 10px;">
        <img src="https://www.prople.co.in/logo.png" width="32" height="32" alt="Prople Store" style="display: block; width: 32px; height: 32px; border-radius: 6px; border: 0;" />
        <span style="font-size: 18px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">Prople Store</span>
      </a>
    </div>

    <!-- Body Content -->
    <p style="margin: 0 0 18px; font-size: 16px; color: #e6edf3;">Hey ${displayUser}!</p>

    <p style="margin: 0 0 20px; font-size: 14px; color: #e6edf3; line-height: 1.6;">
      ${safePurpose}
    </p>

    ${safeActionUrl ? `
    <!-- Action Button (Reset Password) -->
    <div style="margin: 32px 0 24px 0;">
      <a href="${safeActionUrl}" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-weight: 600; font-size: 15px; text-decoration: none; padding: 14px 32px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.3); text-align: center;">
        ${safeActionText} &rarr;
      </a>
    </div>
    ` : ''}

    <p style="margin: 24px 0 8px; font-size: 14px; color: #8b949e;">${safeActionUrl ? 'Or enter this 6-digit verification code on the reset page:' : 'Verification code:'}</p>
    <div style="margin: 0 0 24px; font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #ffffff; background-color: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 14px 24px; display: inline-block;">
      ${safeCode}
    </div>

    ${safeActionUrl ? `
    <p style="margin: 0 0 20px; font-size: 13px; color: #8b949e; word-break: break-all;">
      Direct link: <a href="${safeActionUrl}" style="color: #58a6ff; text-decoration: underline;">${safeActionUrl}</a>
    </p>
    ` : ''}

    <p style="margin: 20px 0 12px; font-size: 14px; color: #8b949e; line-height: 1.5;">
      This code ${safeActionUrl ? 'and link are' : 'is'} valid for <strong>${validityMinutes} minutes</strong> and can only be used once.
    </p>

    <p style="margin: 0 0 24px; font-size: 14px; color: #8b949e; line-height: 1.5;">
      If you did not request this, you can safely ignore this email. Please don't share this code with anyone.
    </p>

    <p style="margin: 24px 0 0; font-size: 14px; color: #e6edf3; line-height: 1.5;">
      Thanks,<br>
      <span style="color: #8b949e;">The Prople Team</span>
    </p>

    <!-- Footer -->
    <div style="margin-top: 36px; padding-top: 20px; border-top: 1px solid #21262d; font-size: 12px; color: #8b949e;">
      Prople Store &bull; Delivered securely from <a href="https://www.prople.co.in" style="color: #58a6ff; text-decoration: none;">prople.co.in</a> &bull; Cloaktail Industries
    </div>
  </div>
</body>
</html>`;
}

export async function sendOtpEmail(
  email: string, 
  code: string,
  recipientName?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const client = getResendClient();

  if (!client) {
    console.warn(`[Dev Auth] RESEND_API_KEY is not configured. Generated 6-digit verification code for ${email}: ${code}`);
    return { 
      success: true, 
      message: `A verification code has been dispatched to ${email}.` 
    };
  }

  try {
    const htmlContent = renderGithubEmail({
      recipientName,
      email,
      title: 'Please verify your identity',
      purposeText: 'Here is your Prople Store authentication verification code:',
      code,
      validityMinutes: 15,
    });

    const primarySender = getAuthEmailFrom();
    const candidateSenders = [
      primarySender,
      'Prople Store <auth@prople.co.in>',
      'Prople Store <auth@send.prople.co.in>',
      'Prople Store <support@prople.co.in>',
      'Prople Store <noreply@prople.co.in>',
      'Prople Store <onboarding@resend.dev>'
    ];

    let lastError: any = null;
    let delivered = false;

    for (const sender of candidateSenders) {
      if (!sender) continue;
      const sendResult = await client.emails.send({
        from: sender,
        to: [email],
        subject: `${code} is your Prople Store verification code`,
        html: htmlContent,
        headers: {
          'X-Entity-Ref-ID': Date.now().toString(),
        },
      });

      if (!sendResult.error) {
        delivered = true;
        break;
      }
      lastError = sendResult.error;
      console.warn(`[Resend] Sender "${sender}" returned error (${sendResult.error.message}), trying next candidate...`);
    }

    if (!delivered) {
      console.error('[Resend Error Final]', lastError);
      return { success: false, error: lastError?.message || 'Email delivery failed' };
    }

    return { 
      success: true, 
      message: `A verification code has been dispatched to ${email}.`
    };
  } catch (err: any) {
    console.error('[Resend] Unexpected error:', err);
    return { success: false, error: 'Unable to complete verification request. Please try again.' };
  }
}

export async function sendPasswordResetEmailTemplate(
  email: string, 
  code: string,
  resetLink?: string,
  recipientName?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const client = getResendClient();
  const displayName = recipientName ? recipientName.trim() : email.split('@')[0];

  if (!client) {
    console.warn(`[Dev Auth] RESEND_API_KEY is not configured. Generated password reset code for ${email}: ${code}, link: ${resetLink}`);
    return { 
      success: true, 
      message: `A password reset code has been dispatched to ${email}.` 
    };
  }

  try {
    const htmlContent = renderGithubEmail({
      recipientName,
      email,
      title: 'Reset your password',
      purposeText: 'Here is your Prople Store password reset code and direct link:',
      code,
      validityMinutes: 15,
      actionUrl: resetLink,
      actionText: 'Reset Password Directly',
    });

    const primarySender = getAuthEmailFrom();
    const candidateSenders = [
      primarySender,
      'Prople Store <auth@prople.co.in>',
      'Prople Store <auth@send.prople.co.in>',
      'Prople Store <support@prople.co.in>',
      'Prople Store <noreply@prople.co.in>',
      'Prople Store <onboarding@resend.dev>'
    ];

    let lastError: any = null;
    let delivered = false;

    for (const sender of candidateSenders) {
      if (!sender) continue;
      const sendResult = await client.emails.send({
        from: sender,
        to: [email],
        subject: `${code} is your Prople Store password reset code`,
        html: htmlContent,
        headers: {
          'X-Entity-Ref-ID': Date.now().toString(),
        },
      });

      if (!sendResult.error) {
        delivered = true;
        break;
      }
      lastError = sendResult.error;
      console.warn(`[Resend] Sender "${sender}" returned error (${sendResult.error.message}), trying next candidate...`);
    }

    if (!delivered) {
      console.error('[Resend] Password reset email error:', lastError);
      return { 
        success: false, 
        error: lastError?.message || 'Unable to deliver password reset email. Please check the address or try again.'
      };
    }

    return { 
      success: true, 
      message: `A password reset code has been dispatched to ${email}.`
    };
  } catch (err: any) {
    console.error('[Resend] Unexpected error:', err);
    return { success: false, error: err.message };
  }
}
