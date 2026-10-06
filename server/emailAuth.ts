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

export function renderGithubEmail({
  recipientName,
  title,
  purposeText,
  code,
  validityMinutes = 15,
  actionUrl,
  actionText,
}: {
  recipientName?: string;
  title: string;
  purposeText: string;
  code: string;
  validityMinutes?: number;
  actionUrl?: string;
  actionText?: string;
}): string {
  const displayUser = escapeHtmlEmail(recipientName ? recipientName : 'there');
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
<body style="margin: 0; padding: 0; background-color: #0d1117; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #e6edf3; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0d1117; padding: 40px 16px 36px;">
    <tr>
      <td align="center">
        <!-- Brand Logo -->
        <table border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
          <tr>
            <td align="center">
              <a href="https://www.prople.co.in" target="_blank" style="text-decoration: none; display: inline-block;">
                <img src="https://www.prople.co.in/logo.png" width="36" height="36" alt="Prople Store" style="display: block; width: 36px; height: 36px; border-radius: 8px; border: 0;" />
              </a>
            </td>
          </tr>
        </table>

        <!-- Heading -->
        <h1 style="margin: 0 0 24px; font-size: 24px; font-weight: 500; color: #ffffff; text-align: center; letter-spacing: -0.3px; line-height: 1.3;">
          ${safeTitle}, <strong style="font-weight: 600; color: #ffffff;">${displayUser}</strong>
        </h1>

        <!-- Card Container (GitHub exact styling: transparent background, 1px border, wider container) -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: transparent; border: 1px solid #30363d; border-radius: 6px; box-sizing: border-box; text-align: left;">
          <tr>
            <td style="padding: 24px 28px 28px; font-size: 14px; line-height: 1.6; color: #e6edf3;">
              <p style="margin: 0 0 20px; font-size: 14px; color: #e6edf3; line-height: 1.5;">
                ${safePurpose}
              </p>

              <!-- Verification Code: bold, white, centered, generous letter-spacing like GitHub -->
              <p style="margin: 28px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 32px; font-weight: 600; letter-spacing: 6px; color: #ffffff; text-align: center; line-height: 1;">
                ${safeCode}
              </p>

              ${safeActionUrl ? `
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 20px 0 24px;">
                <tr>
                  <td align="center">
                    <a href="${safeActionUrl}" target="_blank" style="display: inline-block; background-color: #238636; color: #ffffff; font-weight: 600; font-size: 14px; text-decoration: none; padding: 12px 28px; border-radius: 6px; border: 1px solid rgba(240,246,252,0.1); box-shadow: 0 1px 2px rgba(0,0,0,0.2);">
                      ${safeActionText} &rarr;
                    </a>
                  </td>
                </tr>
              </table>
              ` : ''}

              <p style="margin: 24px 0 12px; font-size: 14px; color: #e6edf3; line-height: 1.5;">
                This code is valid for <strong style="color: #ffffff;">${validityMinutes} minutes</strong> and can only be used once.
              </p>

              <p style="margin: 0 0 24px; font-size: 14px; color: #8b949e; line-height: 1.5;">
                <strong style="color: #e6edf3;">Please don't share this code with anyone</strong>: we'll never ask for it on the phone or via email.
              </p>

              <p style="margin: 0; font-size: 14px; color: #e6edf3; line-height: 1.5;">
                Thanks,<br>
                <span style="color: #8b949e;">The Prople Team</span>
              </p>
            </td>
          </tr>
        </table>

        <!-- Footer -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; margin-top: 24px;">
          <tr>
            <td align="center" style="font-size: 12px; color: #8b949e; line-height: 1.5;">
              <p style="margin: 0;">
                Delivered securely from <a href="https://www.prople.co.in" style="color: #58a6ff; text-decoration: none;">prople.co.in</a> &bull; Cloaktail Industries
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendOtpEmail(email: string, code: string): Promise<{ success: boolean; message?: string; error?: string }> {
  const client = getResendClient();
  if (!client) {
    console.warn('[Resend] RESEND_API_KEY is not configured in environment.');
    return { success: false, error: 'Unable to deliver verification email at this time. Please try again later.' };
  }
  const username = email.split('@')[0];

  try {
    const htmlContent = renderGithubEmail({
      recipientName: username,
      title: 'Please verify your identity',
      purposeText: 'Here is your Prople Store authentication code:',
      code,
      validityMinutes: 15,
    });

    const primarySender = getAuthEmailFrom();
    const candidateSenders = [
      primarySender,
      'Prople Store <auth@send.prople.co.in>',
      'Prople Store <support@prople.co.in>',
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
  resetLink?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const client = getResendClient();
  if (!client) {
    console.warn('[Resend] RESEND_API_KEY is not configured in environment.');
    return { success: false, error: 'Unable to deliver password reset email at this time. Please try again later.' };
  }
  const username = email.split('@')[0];

  try {
    const htmlContent = renderGithubEmail({
      recipientName: username,
      title: 'Reset your password',
      purposeText: 'Here is your Prople Store password reset code and direct link:',
      code,
      validityMinutes: 15,
      actionUrl: resetLink,
      actionText: 'Reset Password Directly',
    });

    const primarySender = getAuthEmailFrom();
    const fallbackSender = 'Prople Store <support@prople.co.in>';
    const testDomainSender = 'Prople Store <onboarding@resend.dev>';

    let sendResult = await client.emails.send({
      from: primarySender,
      to: [email],
      subject: `${code} is your Prople Store password reset code`,
      html: htmlContent,
      headers: {
        'X-Entity-Ref-ID': Date.now().toString(),
      },
    });

    if (sendResult.error) {
      console.warn(`[Resend] Primary sender ${primarySender} returned error (${sendResult.error.message}), trying fallback sender ${fallbackSender}...`);
      sendResult = await client.emails.send({
        from: fallbackSender,
        to: [email],
        subject: `${code} is your Prople Store password reset code`,
        html: htmlContent,
        headers: {
          'X-Entity-Ref-ID': Date.now().toString(),
        },
      });

      if (sendResult.error && (email === 'sahanurmolla1290@gmail.com' || email.endsWith('@resend.dev'))) {
        console.warn(`[Resend] Trying test domain sender for registered owner ${email}...`);
        sendResult = await client.emails.send({
          from: testDomainSender,
          to: [email],
          subject: `${code} is your Prople Store password reset code`,
          html: htmlContent,
          headers: {
            'X-Entity-Ref-ID': Date.now().toString(),
          },
        });
      }
    }

    if (sendResult.error) {
      console.error('[Resend] Password reset email error:', sendResult.error);
      return { 
        success: false, 
        error: sendResult.error.message || 'Unable to deliver password reset email. Please check the address or try again.'
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
