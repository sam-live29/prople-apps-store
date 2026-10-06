# Prople Store — Standardized Firebase Authentication HTML Email Templates

This document contains standardized, high-deliverability, dark-mode-optimized HTML email templates for **Firebase Authentication** configured for **prople.co.in** (Prople Store / Cloaktail Industries).

---

## 1. Firebase Console Configuration Guide

1. Navigate to [Firebase Console](https://console.firebase.google.com/) &rarr; select project **`prople-store-3efed`**.
2. Go to **Authentication** &rarr; **Templates** tab.
3. Set **Sender name**: `The Prople Team`
4. Set **Reply-to**: `support@prople.co.in`
5. Under **Authorized domains**, ensure `prople.co.in` and `www.prople.co.in` are listed.
6. For each template below, click the **Edit template** pencil icon, switch to HTML mode, and paste the corresponding HTML code.

---

## 2. Password Reset Template (Firebase Authentication)

- **Subject**: `Reset your password for Prople Store`
- **Sender name**: `The Prople Team`
- **Reply-to**: `support@prople.co.in`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your Prople Store password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0d1117; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e6edf3; -webkit-font-smoothing: antialiased; line-height: 1.6;">
  <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; max-width: 0px; opacity: 0;">
    Reset your password for Prople Store. Valid for 15 minutes. &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
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
            Reset your password, <span style="color: #60a5fa;">%DISPLAY_NAME%</span>
          </h1>

          <!-- Main Content Card -->
          <div style="background-color: #161b22; border: 1px solid #30363d; border-radius: 10px; padding: 26px 24px; margin-bottom: 24px;">
            
            <p style="margin: 0 0 20px 0; font-size: 15px; color: #c9d1d9; line-height: 1.6;">
              We received a request to reset the password for your Prople Store account. Click the button below to choose a new password.
            </p>

            <!-- Prominent Primary Call-To-Action Button -->
            <div style="margin: 26px 0 22px 0;">
              <a href="%LINK%" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-weight: 600; font-size: 15px; text-decoration: none; padding: 13px 32px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.3); text-align: center; border: 1px solid rgba(255,255,255,0.1);">
                Reset Password &rarr;
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
</html>
```

---

## 3. Email Address Verification Template (Firebase Authentication)

- **Subject**: `Verify your email address for Prople Store`
- **Sender name**: `The Prople Team`
- **Reply-to**: `support@prople.co.in`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your Prople Store email address</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0d1117; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e6edf3; -webkit-font-smoothing: antialiased; line-height: 1.6;">
  <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; max-width: 0px; opacity: 0;">
    Verify your email for Prople Store. Valid for 15 minutes. &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
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
            Welcome to Prople Store, <span style="color: #60a5fa;">%DISPLAY_NAME%</span>
          </h1>

          <!-- Main Content Card -->
          <div style="background-color: #161b22; border: 1px solid #30363d; border-radius: 10px; padding: 26px 24px; margin-bottom: 24px;">
            
            <p style="margin: 0 0 20px 0; font-size: 15px; color: #c9d1d9; line-height: 1.6;">
              Please verify your email address to activate your Prople Store account and access secure app installs, developer publishing, and personalized downloads.
            </p>

            <!-- Prominent Primary Call-To-Action Button -->
            <div style="margin: 26px 0 22px 0;">
              <a href="%LINK%" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-weight: 600; font-size: 15px; text-decoration: none; padding: 13px 32px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.3); text-align: center; border: 1px solid rgba(255,255,255,0.1);">
                Verify Email &rarr;
              </a>
            </div>

            <!-- Fallback Direct Link -->
            <p style="margin: 0 0 20px 0; font-size: 13px; color: #8b949e; word-break: break-all; line-height: 1.5;">
              Or copy and paste this link into your browser: <br>
              <a href="%LINK%" style="color: #58a6ff; text-decoration: underline;">%LINK%</a>
            </p>

            <!-- Validity Advisory -->
            <p style="margin: 18px 0 10px 0; font-size: 13px; color: #8b949e; line-height: 1.5;">
              This link is valid for <strong>15 minutes</strong> and can only be used once. If you did not sign up for Prople Store, you can safely ignore this email.
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
</html>
```

---

## 4. Email Link (Passwordless Sign-In) Template

- **Subject**: `Sign in to Prople Store`
- **Sender name**: `The Prople Team`
- **Reply-to**: `support@prople.co.in`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in to Prople Store</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0d1117; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e6edf3; -webkit-font-smoothing: antialiased; line-height: 1.6;">
  <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; max-width: 0px; opacity: 0;">
    Your 1-click sign in link for Prople Store. Valid for 15 minutes. &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
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
            Sign in to Prople Store, <span style="color: #60a5fa;">%DISPLAY_NAME%</span>
          </h1>

          <!-- Main Content Card -->
          <div style="background-color: #161b22; border: 1px solid #30363d; border-radius: 10px; padding: 26px 24px; margin-bottom: 24px;">
            
            <p style="margin: 0 0 20px 0; font-size: 15px; color: #c9d1d9; line-height: 1.6;">
              Click the button below to sign in instantly to your Prople Store account without entering a password.
            </p>

            <!-- Prominent Primary Call-To-Action Button -->
            <div style="margin: 26px 0 22px 0;">
              <a href="%LINK%" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-weight: 600; font-size: 15px; text-decoration: none; padding: 13px 32px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.3); text-align: center; border: 1px solid rgba(255,255,255,0.1);">
                Sign In to Prople Store &rarr;
              </a>
            </div>

            <!-- Fallback Direct Link -->
            <p style="margin: 0 0 20px 0; font-size: 13px; color: #8b949e; word-break: break-all; line-height: 1.5;">
              Or copy and paste this link into your browser: <br>
              <a href="%LINK%" style="color: #58a6ff; text-decoration: underline;">%LINK%</a>
            </p>

            <!-- Validity Advisory -->
            <p style="margin: 18px 0 10px 0; font-size: 13px; color: #8b949e; line-height: 1.5;">
              This link is valid for <strong>15 minutes</strong> and can only be used once. If you did not request this, you can safely ignore this email.
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
</html>
```
