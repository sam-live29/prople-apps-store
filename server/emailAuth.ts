import "dotenv/config";
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
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

let runtimeResendApiKey = process.env.RESEND_API_KEY || '';

export const setRuntimeResendApiKey = (key: string): void => {
  if (key && typeof key === 'string') {
    runtimeResendApiKey = key.trim();
  }
};

export const getCandidateResendApiKeys = (): string[] => {
  const envKeys = [
    runtimeResendApiKey,
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
};

export const getResendApiKey = (): string => {
  const keys = getCandidateResendApiKeys();
  return keys[0] || '';
};

export const getResendClient = (): Resend | null => {
  const key = getResendApiKey();
  if (!key) return null;
  return new Resend(key);
};

export const getAuthEmailFrom = (): string => {
  return (process.env.AUTH_EMAIL_FROM || '').trim() || 'The Prople Team <auth@prople.co.in>';
};

// In-memory OTP storage with TTL for high performance (and fallback store)
interface StoredOtp {
  code: string;
  email: string;
  expiresAt: number;
  attempts: number;
}

const otpStore = new Map<string, StoredOtp>();

import { persistOtp, verifyAndConsumeOtp, generateTotpOtp, createSignedChallengeToken } from './otpStore.ts';

// Cleanup expired OTPs every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of otpStore.entries()) {
    if (val.expiresAt < now) {
      otpStore.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

export function generateOtp(email?: string): string {
  if (email && typeof email === 'string' && email.includes('@')) {
    return generateTotpOtp(email);
  }
  // Generate cryptographically secure 6-digit number using CSPRNG
  return crypto.randomInt(100000, 1000000).toString();
}

export async function storeOtp(email: string, code: string, ttlMinutes = 30): Promise<void> {
  const norm = email.toLowerCase().trim();
  otpStore.set(norm, {
    code,
    email: norm,
    expiresAt: Date.now() + ttlMinutes * 60 * 1000,
    attempts: 0,
  });
  await persistOtp(norm, code, ttlMinutes);
}

export async function verifyStoredOtp(
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

  // Check the multi-tier distributed store (signed challenge token, memory, multi-window TOTP, RTDB)
  const distributedResult = await verifyAndConsumeOtp(norm, cleanCode, consume, challengeToken);
  if (distributedResult.valid) {
    if (consume) {
      otpStore.delete(norm);
    }
    return { valid: true };
  }

  // Fallback to local memory store if needed
  const entry = otpStore.get(norm);
  if (!entry) {
    return distributedResult;
  }

  if (Date.now() > entry.expiresAt + 3 * 60 * 1000) {
    otpStore.delete(norm);
    return { valid: false, error: 'Verification code has expired. Please request a new verification code.' };
  }

  if (entry.attempts >= 5) {
    otpStore.delete(norm);
    return { valid: false, error: 'Too many incorrect attempts. Please request a new verification code.' };
  }

  if (!timingSafeCompare(String(entry.code), cleanCode)) {
    entry.attempts += 1;
    return { valid: false, error: 'Incorrect verification code. Please check your email and enter the latest 6 digits.' };
  }

  // Success: consume OTP if requested
  if (consume) {
    otpStore.delete(norm);
  }
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

/**
 * Standardized, professional HTML email template for Prople Store authentication.
 * Features:
 * - Brand header with high-resolution logo and Prople Store branding
 * - Prominent 6-digit spaced monospace authentication code
 * - High-contrast primary CTA button (Verify Email or Reset Password)
 * - Direct fallback link for non-HTML or click-restricted email clients
 * - Schema.org Email Markup so Gmail presents interactive "Copy code" actions in the inbox list
 * - Strict 15-minute expiration & anti-phishing advisory
 * - Professional footer referencing prople.co.in, Cloaktail Industries, and direct support
 */
export function renderPropleEmail({
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
  const safeTitle = escapeHtmlEmail(title);
  const safePurpose = escapeHtmlEmail(purposeText);
  const safeCode = escapeHtmlEmail(code);
  const safeEmail = escapeHtmlEmail(email || '');
  const safeActionUrl = actionUrl ? escapeHtmlEmail(actionUrl) : '';
  const defaultActionText = isPasswordReset ? 'Reset Password' : 'Verify Email';
  const safeActionText = escapeHtmlEmail(actionText || defaultActionText);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${safeTitle}</title>
  <!-- Schema.org Email Markup for Gmail Inbox Actions & 1-Tap Copy Code -->
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
<body style="margin: 0; padding: 0; width: 100%; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #262626; font-size: 14px; line-height: 1.5; -webkit-font-smoothing: antialiased;">
  <!-- Preheader preview text for inbox -->
  <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; max-width: 0px; opacity: 0;">
    ${safeCode} is your Prople Store verification code. &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 0; padding: 0; width: 100%; background-color: #ffffff;">
    <tr>
      <td align="center" valign="top" style="margin: 0; padding: 0;">
        <!-- Borderless Full-Bleed 9:16 Portrait Container -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; width: 100%; margin: 0 auto; background-color: #ffffff; border: 0; text-align: left; box-sizing: border-box;">
          <tr>
            <td style="padding: 32px 20px 40px 20px;">
              
              <!-- Centered Brand Header -->
              <div style="text-align: center; margin-bottom: 22px;">
                <a href="https://www.prople.co.in" target="_blank" style="text-decoration: none; display: inline-block;">
                  <img src="https://www.prople.co.in/logo.png" width="48" height="48" alt="Prople Store" style="display: block; margin: 0 auto; width: 48px; height: 48px; border-radius: 10px; border: 0;" />
                  <span style="display: block; margin-top: 8px; font-size: 19px; font-weight: 700; color: #262626; letter-spacing: -0.3px;">Prople Store</span>
                </a>
              </div>

              <!-- Greeting -->
              <p style="margin: 0 0 12px 0; font-size: 15px; font-weight: 600; color: #262626;">
                Hi${displayUser ? ` ${displayUser}` : ''},
              </p>

              <!-- Purpose -->
              <p style="margin: 0 0 18px 0; font-size: 14px; color: #262626; line-height: 1.5;">
                ${safePurpose} ${safeEmail ? `for <strong style="color: #000000;">${safeEmail}</strong>.` : ''}
              </p>

              <!-- OTP Verification Box -->
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="width: 100%; margin: 16px 0 20px 0; background-color: #f7f7f7; border: 1px solid #e6e6e6; border-radius: 8px; box-sizing: border-box;">
                <tr>
                  <td style="padding: 16px 14px; text-align: center; vertical-align: middle;">
                    <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #737373; margin-bottom: 4px;">Security Code</div>
                    <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 28px; font-weight: 700; letter-spacing: 6px; color: #000000; line-height: 1.2; user-select: all; -webkit-user-select: all;">${safeCode}</div>
                  </td>
                </tr>
              </table>

              <!-- Primary Action CTA Button -->
              ${safeActionUrl ? `
              <div style="margin: 20px 0 20px 0;">
                <a href="${safeActionUrl}" target="_blank" style="display: block; width: 100%; box-sizing: border-box; background-color: #0095f6; color: #ffffff; font-weight: 600; font-size: 14px; text-decoration: none; padding: 12px 20px; border-radius: 8px; text-align: center;">
                  ${safeActionText}
                </a>
              </div>
              ` : ''}

              <!-- Expiry Notice -->
              <p style="margin: 0 0 20px 0; font-size: 13px; color: #737373; line-height: 1.5;">
                This code is valid for <strong>${validityMinutes} minutes</strong>. If you did not make this request, you can safely ignore this email.
              </p>

              <!-- Sign-off -->
              <p style="margin: 0 0 24px 0; font-size: 14px; color: #262626; line-height: 1.5;">
                Thanks,<br>
                <strong style="color: #000000;">The Prople Team</strong>
              </p>

              <!-- Instagram-style Divider & Footer -->
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

// Backward-compatible alias
export const renderGithubEmail = renderPropleEmail;

/**
 * Standardized HTML email template compatible with Firebase Console Custom Email Templates.
 * Variables supported by Firebase Auth:
 * %APP_NAME% - Application Name (e.g. Prople Store)
 * %DISPLAY_NAME% - User's display name
 * %LINK% - Action handler verification or password reset URL
 * %EMAIL% - User's email address
 */
export function renderFirebaseHtmlTemplate(type: 'reset-password' | 'verify-email'): string {
  const isReset = type === 'reset-password';
  const actionTitle = isReset ? 'Reset your Prople Store password' : 'Verify your email address';
  const headingText = isReset ? 'Reset your password' : 'Verify your email';
  const bodyText = isReset
    ? 'We received a request to reset the password for your Prople Store account. Click the button below to choose a new password.'
    : 'Welcome to Prople Store! Please verify your email address to activate your account and start discovering applications.';
  const buttonText = isReset ? 'Reset Password' : 'Verify Email';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${actionTitle}</title>
</head>
<body style="margin: 0; padding: 0; width: 100%; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #262626; font-size: 14px; line-height: 1.5; -webkit-font-smoothing: antialiased;">
  <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; max-width: 0px; opacity: 0;">
    ${headingText} for Prople Store. Valid for 15 minutes. &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 0; padding: 0; width: 100%; background-color: #ffffff;">
    <tr>
      <td align="center" valign="top" style="margin: 0; padding: 0;">
        <!-- Borderless Full-Bleed 9:16 Portrait Container -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; width: 100%; margin: 0 auto; background-color: #ffffff; border: 0; text-align: left; box-sizing: border-box;">
          <tr>
            <td style="padding: 32px 20px 40px 20px;">
              
              <!-- Centered Brand Header -->
              <div style="text-align: center; margin-bottom: 22px;">
                <a href="https://www.prople.co.in" target="_blank" style="text-decoration: none; display: inline-block;">
                  <img src="https://www.prople.co.in/logo.png" width="48" height="48" alt="Prople Store" style="display: block; margin: 0 auto; width: 48px; height: 48px; border-radius: 10px; border: 0;" />
                  <span style="display: block; margin-top: 8px; font-size: 19px; font-weight: 700; color: #262626; letter-spacing: -0.3px;">Prople Store</span>
                </a>
              </div>

              <!-- Greeting -->
              <p style="margin: 0 0 12px 0; font-size: 15px; font-weight: 600; color: #262626;">
                Hi %DISPLAY_NAME%,
              </p>

              <!-- Purpose -->
              <p style="margin: 0 0 18px 0; font-size: 14px; color: #262626; line-height: 1.5;">
                ${bodyText}
              </p>

              <!-- Prominent Primary Call-To-Action Button -->
              <div style="margin: 20px 0 20px 0;">
                <a href="%LINK%" target="_blank" style="display: block; width: 100%; box-sizing: border-box; background-color: #0095f6; color: #ffffff; font-weight: 600; font-size: 14px; text-decoration: none; padding: 12px 20px; border-radius: 8px; text-align: center;">
                  ${buttonText}
                </a>
              </div>

              <!-- Validity Advisory -->
              <p style="margin: 0 0 20px 0; font-size: 13px; color: #737373; line-height: 1.5;">
                This link is valid for <strong>15 minutes</strong> and can only be used once. If you did not make this request, you can safely ignore this email.
              </p>

              <!-- Sender Signature -->
              <p style="margin: 0 0 24px 0; font-size: 14px; color: #262626; line-height: 1.5;">
                Thanks,<br>
                <strong style="color: #000000;">The Prople Team</strong>
              </p>

              <!-- Instagram-style Divider & Footer -->
              <div style="border-top: 1px solid #dbdbdb; padding-top: 20px; text-align: center; font-size: 11px; color: #8e8e8e; line-height: 1.6;">
                <div style="font-weight: 600; color: #737373; text-transform: uppercase; letter-spacing: 0.8px; font-size: 11px; margin-bottom: 6px;">from CLOAKTAIL</div>
                <div>&copy; Cloaktail Industries &bull; Prople Store &bull; <a href="https://www.prople.co.in" style="color: #0095f6; text-decoration: none;">prople.co.in</a></div>
                <div style="margin-top: 4px; color: #8e8e8e;">This message was sent to <span style="color: #262626;">%EMAIL%</span> regarding your Prople Store account.</div>
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

/**
 * Dispatches an email using Google Firebase Identity Toolkit REST API.
 * This guarantees reliable email delivery directly via Firebase's authorized email infrastructure
 * without requiring any third-party email provider keys.
 * Handles both PASSWORD_RESET and EMAIL_SIGNIN/VERIFY_EMAIL gracefully.
 */
export async function sendFirebaseOobCode(
  requestType: 'PASSWORD_RESET' | 'VERIFY_EMAIL' | 'EMAIL_SIGNIN',
  email: string,
  continueUrl: string,
  idToken?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { getServerFirebaseConfig } = await import("./firebaseConfig.ts");
    const fbConfig = getServerFirebaseConfig();
    const apiKey = !fbConfig.isExampleConfig ? fbConfig.apiKey : "";

    if (!apiKey) {
      return { success: false, error: 'Firebase service is temporarily unreachable' };
    }

    // Prepare body: if VERIFY_EMAIL without an idToken, fallback to EMAIL_SIGNIN
    // which dispatches a verified authentication link directly to the email.
    let fbRequestType: string = requestType;
    const bodyPayload: any = {
      email: email.trim().toLowerCase(),
      continueUrl,
    };

    if (requestType === 'VERIFY_EMAIL') {
      if (idToken) {
        fbRequestType = 'VERIFY_EMAIL';
        bodyPayload.idToken = idToken;
        delete bodyPayload.email;
      } else {
        fbRequestType = 'EMAIL_SIGNIN';
      }
    }

    bodyPayload.requestType = fbRequestType;

    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
    });

    const data = await res.json();
    if (!res.ok) {
      const fbMsg = data?.error?.message || 'Failed to dispatch email';
      if (typeof fbMsg === 'string' && fbMsg.includes('UNAUTHORIZED_DOMAIN')) {
        const authDomain = process.env.FIREBASE_AUTH_DOMAIN || 'prople-store-3efed.firebaseapp.com';
        bodyPayload.continueUrl = `https://${authDomain}`;
        try {
          const retryRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyPayload),
          });
          const retryData = await retryRes.json();
          if (retryRes.ok) {
            return { success: true };
          }
        } catch {}
      }
      return { success: false, error: fbMsg };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function sendOtpEmail(
  email: string, 
  code: string,
  recipientName?: string,
  verifyLink?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const cleanEmail = email.toLowerCase().trim();
  const directLink = verifyLink || `https://www.prople.co.in/?auth=verify-email&email=${encodeURIComponent(cleanEmail)}&code=${code}`;

  const htmlContent = renderPropleEmail({
    recipientName,
    email: cleanEmail,
    title: 'Please verify your identity',
    purposeText: 'Here is your Prople Store authentication verification code:',
    code,
    validityMinutes: 15,
    actionUrl: directLink,
    actionText: 'Verify Email',
  });

  const candidateKeys = getCandidateResendApiKeys();
  const primarySender = getAuthEmailFrom();
  const candidateSenders = Array.from(new Set([
    primarySender,
    'The Prople Team <auth@prople.co.in>',
    'Prople Store <auth@prople.co.in>',
    'Prople Store <onboarding@resend.dev>'
  ].filter(Boolean)));

  let lastError = '';

  for (const key of candidateKeys) {
    try {
      const client = new Resend(key);
      for (const sender of candidateSenders) {
        const sendResult = await client.emails.send({
          from: sender,
          to: [cleanEmail],
          subject: `${code} is your Prople Store verification code`,
          html: htmlContent,
          headers: {
            'X-Entity-Ref-ID': Date.now().toString(),
          },
        });

        if (!sendResult.error) {
          console.log(`[Resend] Successfully dispatched OTP verification email to ${cleanEmail} via ${sender}`);
          return {
            success: true,
            message: `A verification code has been dispatched to ${cleanEmail}. Please check your inbox or spam folder.`
          };
        } else {
          lastError = sendResult.error?.message || String(sendResult.error);
          console.warn(`[Resend] Dispatch notice with sender '${sender}':`, lastError);
          const errLower = lastError.toLowerCase();
          if (errLower.includes('api key is invalid') || errLower.includes('unauthorized') || (sendResult.error as any)?.statusCode === 401) {
            break; // Try next candidate key
          }
        }
      }
    } catch (resendErr: any) {
      lastError = resendErr?.message || String(resendErr);
      console.warn('[Resend] Dispatch exception:', lastError);
    }
  }

  // Fallback to Firebase Identity Toolkit if Resend failed across all keys
  console.warn('[Resend] Resend dispatch did not succeed, attempting Firebase Identity Toolkit fallback...');
  const fbResult = await sendFirebaseOobCode('VERIFY_EMAIL', cleanEmail, directLink);
  if (fbResult.success) {
    console.log(`[Firebase] Successfully dispatched verification link to ${cleanEmail} via Firebase Auth`);
    return {
      success: true,
      message: `A verification link has been dispatched to ${cleanEmail}. Please check your inbox or spam folder.`
    };
  } else if (fbResult.error) {
    lastError = fbResult.error;
  }

  return { 
    success: false, 
    error: lastError || 'Failed to dispatch verification email. Please check your email configuration.'
  };
}

export async function sendPasswordResetEmailTemplate(
  email: string, 
  code: string,
  resetLink?: string,
  recipientName?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const cleanEmail = email.toLowerCase().trim();
  const directLink = resetLink || `https://www.prople.co.in/?auth=reset-password&email=${encodeURIComponent(cleanEmail)}&code=${code}`;

  const htmlContent = renderPropleEmail({
    recipientName,
    email: cleanEmail,
    title: 'Reset your password',
    purposeText: 'Here is your Prople Store password reset code:',
    code,
    validityMinutes: 15,
    actionUrl: directLink,
    actionText: 'Reset Password',
    isPasswordReset: true,
  });

  const candidateKeys = getCandidateResendApiKeys();
  const primarySender = getAuthEmailFrom();
  const candidateSenders = Array.from(new Set([
    primarySender,
    'The Prople Team <auth@prople.co.in>',
    'Prople Store <auth@prople.co.in>',
    'Prople Store <onboarding@resend.dev>'
  ].filter(Boolean)));

  let lastError = '';

  for (const key of candidateKeys) {
    try {
      const client = new Resend(key);
      for (const sender of candidateSenders) {
        const sendResult = await client.emails.send({
          from: sender,
          to: [cleanEmail],
          subject: `${code} is your Prople Store password reset code`,
          html: htmlContent,
          headers: {
            'X-Entity-Ref-ID': Date.now().toString(),
          },
        });

        if (!sendResult.error) {
          console.log(`[Resend] Successfully dispatched password reset email to ${cleanEmail} via ${sender}`);
          return {
            success: true,
            message: `A password reset code and link have been dispatched to ${cleanEmail}. Please check your inbox or spam folder.`
          };
        } else {
          lastError = sendResult.error?.message || String(sendResult.error);
          console.warn(`[Resend] Password reset dispatch notice with sender '${sender}':`, lastError);
          const errLower = lastError.toLowerCase();
          if (errLower.includes('api key is invalid') || errLower.includes('unauthorized') || (sendResult.error as any)?.statusCode === 401) {
            break; // Try next candidate key
          }
        }
      }
    } catch (resendErr: any) {
      lastError = resendErr?.message || String(resendErr);
      console.warn('[Resend] Password reset dispatch exception:', lastError);
    }
  }

  // Fallback to Firebase Identity Toolkit if Resend failed across all keys
  console.warn('[Resend] Password reset dispatch did not succeed, attempting Firebase Identity Toolkit fallback...');
  const fbResult = await sendFirebaseOobCode('PASSWORD_RESET', cleanEmail, directLink);
  if (fbResult.success) {
    console.log(`[Firebase] Successfully dispatched password reset email to ${cleanEmail} via Firebase Auth`);
    return {
      success: true,
      message: `A password reset link has been dispatched to ${cleanEmail}. Please check your inbox or spam folder.`
    };
  } else if (fbResult.error) {
    lastError = fbResult.error;
  }

  return { 
    success: false, 
    error: lastError || 'Failed to dispatch password reset email. Please check your email configuration.'
  };
}

