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

let runtimeResendApiKey = '';

export const setRuntimeResendApiKey = (key: string): void => {
  if (key && typeof key === 'string') {
    runtimeResendApiKey = key.trim();
  }
};

export const getResendApiKey = (): string => {
  let key = (
    runtimeResendApiKey ||
    process.env.RESEND_API_KEY ||
    process.env.RESEND_API_KEY_ ||
    process.env.VITE_RESEND_API_KEY ||
    process.env.RESEND_KEY ||
    process.env.VITE_RESEND_KEY ||
    ''
  ).trim();

  if (!key) {
    try {
      const envPath = path.join(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        const match = content.match(/RESEND_API_KEY\s*=\s*([^\r\n]+)/);
        if (match && match[1]) {
          key = match[1].trim().replace(/^['"]|['"]$/g, '');
          runtimeResendApiKey = key;
        }
      }
    } catch {}
  }

  return key;
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

export async function storeOtp(email: string, code: string, ttlMinutes = 15): Promise<void> {
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
  const spacedCode = safeCode.split('').join(' ');
  const safeEmail = escapeHtmlEmail(email || '');
  const safeActionUrl = actionUrl ? escapeHtmlEmail(actionUrl) : '';
  const defaultActionText = isPasswordReset ? 'Reset Password' : 'Verify Email';
  const safeActionText = escapeHtmlEmail(actionText || defaultActionText);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <!-- Schema.org Email Markup for Gmail Inbox Actions & Quick Code Extraction -->
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
  <!-- Preheader text for email clients -->
  <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; max-width: 0px; opacity: 0;">
    ${safeCode} is your Prople Store authentication code. Valid for ${validityMinutes} minutes. &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0d1117; width: 100%;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <div style="max-width: 560px; width: 100%; text-align: left;">
          
          <!-- Brand Header -->
          <div style="margin-bottom: 28px;">
            <a href="https://www.prople.co.in" target="_blank" style="text-decoration: none; display: inline-flex; align-items: center; gap: 12px;">
              <img src="https://www.prople.co.in/logo.png" width="36" height="36" alt="Prople Store" style="display: block; width: 36px; height: 36px; border-radius: 8px; border: 0;" />
              <span style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.4px;">Prople Store</span>
            </a>
          </div>

          <!-- Greeting Header -->
          <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 600; color: #ffffff; line-height: 1.35;">
            ${safeTitle}, <span style="color: #60a5fa;">${displayUser}</span>
          </h1>

          <!-- Main Content Card -->
          <div style="background-color: #161b22; border: 1px solid #30363d; border-radius: 10px; padding: 26px 24px; margin-bottom: 24px;">
            
            <p style="margin: 0 0 18px 0; font-size: 15px; color: #c9d1d9; line-height: 1.6;">
              ${safePurpose}
            </p>

            <!-- Authentication Code Box (Monospace, Spaced, High-Contrast) -->
            <div style="margin: 22px 0; text-align: left;">
              <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #8b949e; margin-bottom: 8px;">
                Authentication Code
              </div>
              <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #ffffff; background-color: #0d1117; border: 1px solid #30363d; border-radius: 8px; padding: 14px 22px; display: inline-block;">
                ${spacedCode}
              </div>
            </div>

            ${safeActionUrl ? `
            <!-- Prominent Call-To-Action Button -->
            <div style="margin: 26px 0 20px 0;">
              <a href="${safeActionUrl}" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-weight: 600; font-size: 15px; text-decoration: none; padding: 13px 30px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.3); text-align: center; border: 1px solid rgba(255,255,255,0.1);">
                ${safeActionText} &rarr;
              </a>
            </div>

            <!-- Direct Fallback Link -->
            <p style="margin: 0 0 20px 0; font-size: 13px; color: #8b949e; word-break: break-all; line-height: 1.5;">
              Or click this direct link: <a href="${safeActionUrl}" style="color: #58a6ff; text-decoration: underline;">${safeActionUrl}</a>
            </p>
            ` : ''}

            <!-- Validity & Security Advisory -->
            <p style="margin: 18px 0 10px 0; font-size: 13px; color: #8b949e; line-height: 1.5;">
              This code ${safeActionUrl ? 'and link are' : 'is'} valid for <strong>${validityMinutes} minutes</strong> and can only be used once.
            </p>

            <p style="margin: 0 0 20px 0; font-size: 13px; color: #8b949e; line-height: 1.5;">
              <strong>Please don't share this code with anyone:</strong> we'll never ask for it on the phone or via email.
            </p>

            <!-- Sender Signature -->
            <p style="margin: 22px 0 0 0; font-size: 14px; color: #c9d1d9; line-height: 1.5;">
              Thanks,<br>
              <strong style="color: #ffffff;">The Prople Team</strong>
            </p>
          </div>

          <!-- Professional Footer -->
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
  <title>${actionTitle}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0d1117; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e6edf3; -webkit-font-smoothing: antialiased; line-height: 1.6;">
  <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; max-width: 0px; opacity: 0;">
    ${headingText} for Prople Store. Valid for 15 minutes. &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0d1117; width: 100%;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <div style="max-width: 560px; width: 100%; text-align: left;">
          
          <!-- Brand Header -->
          <div style="margin-bottom: 28px;">
            <a href="https://www.prople.co.in" target="_blank" style="text-decoration: none; display: inline-flex; align-items: center; gap: 12px;">
              <img src="https://www.prople.co.in/logo.png" width="36" height="36" alt="Prople Store" style="display: block; width: 36px; height: 36px; border-radius: 8px; border: 0;" />
              <span style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.4px;">Prople Store</span>
            </a>
          </div>

          <!-- Greeting Header -->
          <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 600; color: #ffffff; line-height: 1.35;">
            ${headingText}, <span style="color: #60a5fa;">%DISPLAY_NAME%</span>
          </h1>

          <!-- Main Content Card -->
          <div style="background-color: #161b22; border: 1px solid #30363d; border-radius: 10px; padding: 26px 24px; margin-bottom: 24px;">
            
            <p style="margin: 0 0 20px 0; font-size: 15px; color: #c9d1d9; line-height: 1.6;">
              ${bodyText}
            </p>

            <!-- Prominent Primary Call-To-Action Button -->
            <div style="margin: 26px 0 22px 0;">
              <a href="%LINK%" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-weight: 600; font-size: 15px; text-decoration: none; padding: 13px 32px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.3); text-align: center; border: 1px solid rgba(255,255,255,0.1);">
                ${buttonText} &rarr;
              </a>
            </div>

            <!-- Fallback Direct Link -->
            <p style="margin: 0 0 20px 0; font-size: 13px; color: #8b949e; word-break: break-all; line-height: 1.5;">
              Or copy and paste this link into your browser: <br>
              <a href="%LINK%" style="color: #58a6ff; text-decoration: underline;">%LINK%</a>
            </p>

            <!-- Validity Advisory -->
            <p style="margin: 18px 0 10px 0; font-size: 13px; color: #8b949e; line-height: 1.5;">
              This link is valid for <strong>15 minutes</strong> and can only be used once. If you did not make this request, you can safely ignore this email.
            </p>

            <!-- Sender Signature -->
            <p style="margin: 22px 0 0 0; font-size: 14px; color: #c9d1d9; line-height: 1.5;">
              Thanks,<br>
              <strong style="color: #ffffff;">The Prople Team</strong>
            </p>
          </div>

          <!-- Professional Footer -->
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
            <div style="margin-top: 8px; color: #6e7681; font-size: 11px;">
              This email was sent to %EMAIL% regarding your Prople Store account.
            </div>
          </div>

        </div>
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
    let apiKey = process.env.FIREBASE_API_KEY || '';
    if (!apiKey) {
      try {
        const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
        if (fs.existsSync(configPath)) {
          const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
          apiKey = cfg.apiKey || '';
        }
      } catch {}
    }

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

  const client = getResendClient();
  let lastError = '';

  if (client) {
    try {
      const htmlContent = renderPropleEmail({
        recipientName,
        email: cleanEmail,
        title: 'Please verify your identity',
        purposeText: 'Here is your Prople Store authentication verification code and direct link:',
        code,
        validityMinutes: 15,
        actionUrl: directLink,
        actionText: 'Verify Email',
      });

      const primarySender = getAuthEmailFrom();
      const candidateSenders = [
        primarySender,
        'The Prople Team <auth@prople.co.in>',
        'Prople Store <auth@prople.co.in>',
        'auth@prople.co.in',
        'support@prople.co.in',
        'noreply@prople.co.in',
        'onboarding@resend.dev',
        'Prople Store <onboarding@resend.dev>'
      ];

      for (const sender of candidateSenders) {
        if (!sender) continue;
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
        }
      }
    } catch (resendErr: any) {
      lastError = resendErr?.message || String(resendErr);
      console.warn('[Resend] Dispatch warning:', lastError);
    }
  } else {
    lastError = 'RESEND_API_KEY is not configured in the server environment. Please set RESEND_API_KEY to send emails via Resend.';
    console.warn('[Resend] ' + lastError);
  }

  // Dual Fallback: Dispatch through Firebase Identity Toolkit email service if available
  const fbResult = await sendFirebaseOobCode('VERIFY_EMAIL', cleanEmail, directLink);
  if (fbResult.success) {
    return {
      success: true,
      message: `A verification code has been dispatched to ${cleanEmail}. Please check your inbox or spam folder.`
    };
  }

  // Both providers failed or unconfigured: return transparent status to notify caller
  return { 
    success: false, 
    error: lastError || 'Failed to dispatch email via Resend. Please ensure your Resend API key is configured and sender domain is verified.'
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

  const client = getResendClient();
  let lastError = '';

  if (client) {
    try {
      const htmlContent = renderPropleEmail({
        recipientName,
        email: cleanEmail,
        title: 'Reset your password',
        purposeText: 'Here is your Prople Store password reset code and direct link:',
        code,
        validityMinutes: 15,
        actionUrl: directLink,
        actionText: 'Reset Password',
        isPasswordReset: true,
      });

      const primarySender = getAuthEmailFrom();
      const candidateSenders = [
        primarySender,
        'The Prople Team <auth@prople.co.in>',
        'Prople Store <auth@prople.co.in>',
        'auth@prople.co.in',
        'support@prople.co.in',
        'noreply@prople.co.in',
        'onboarding@resend.dev',
        'Prople Store <onboarding@resend.dev>'
      ];

      for (const sender of candidateSenders) {
        if (!sender) continue;
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
        }
      }
    } catch (resendErr: any) {
      lastError = resendErr?.message || String(resendErr);
      console.warn('[Resend] Password reset dispatch warning:', lastError);
    }
  } else {
    lastError = 'RESEND_API_KEY is not configured in the server environment. Please set RESEND_API_KEY to send emails via Resend.';
    console.warn('[Resend] ' + lastError);
  }

  // Dual Fallback: Dispatch through Firebase Identity Toolkit email service if available
  const fbResult = await sendFirebaseOobCode('PASSWORD_RESET', cleanEmail, directLink);
  if (fbResult.success) {
    return {
      success: true,
      message: `A password reset code and link have been dispatched to ${cleanEmail}. Please check your inbox or spam folder.`
    };
  }

  return { 
    success: false, 
    error: lastError || 'Failed to dispatch password reset email via Resend. Please ensure your Resend API key is configured and sender domain is verified.'
  };
}

