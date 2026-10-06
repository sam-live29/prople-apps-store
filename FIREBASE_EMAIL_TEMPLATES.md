# Prople Store — Standardized Firebase Authentication Email Templates

This document provides standardized, professional HTML email templates for Firebase Authentication (Password Reset & Email Verification) designed specifically for **Prople Store** and **Cloaktail Industries**.

These templates feature:
- Official Prople Store branding & high-resolution logo (`https://www.prople.co.in/logo.png`)
- Clean dark theme styling (`#0d1117` background with `#161b22` cards and `#30363d` borders)
- Prominent call-to-action buttons (`Reset Password` and `Verify Email`)
- Security advisories, expiration notices (15 minutes), and anti-phishing notices
- Professional signature (`Thanks, The Prople Team`)
- Complete footers referencing `prople.co.in`, Cloaktail Industries, and support contacts (`support@prople.co.in`)
- Official Firebase placeholders: `%APP_NAME%`, `%LINK%`, `%EMAIL%`, `%DISPLAY_NAME%`

---

## 1. Password Reset Template

### Configuration in Firebase Console
- **Sender Name**: `The Prople Team`
- **From Email / Reply-To**: `auth@prople.co.in` (or `support@prople.co.in`)
- **Subject**: `Reset your password for Prople Store`
- **Authorized Domain**: `prople.co.in`
- **Customized Action URL**: `https://www.prople.co.in/?auth=reset-password`

### HTML Email Body
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your password – Prople Store</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0d1117; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e6edf3; -webkit-font-smoothing: antialiased; line-height: 1.6;">
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
            <p style="margin: 0 0 18px 0; font-size: 15px; color: #c9d1d9; line-height: 1.6;">
              We received a request to reset your Prople Store account password. To create a new password, click the button below:
            </p>

            <!-- Prominent Call-To-Action Button -->
            <div style="margin: 28px 0 22px 0;">
              <a href="%LINK%" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-weight: 600; font-size: 15px; text-decoration: none; padding: 13px 30px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.3); text-align: center; border: 1px solid rgba(255,255,255,0.1);">
                Reset Password &rarr;
              </a>
            </div>

            <!-- Direct Fallback Link -->
            <p style="margin: 0 0 20px 0; font-size: 13px; color: #8b949e; word-break: break-all; line-height: 1.5;">
              Or copy and paste this link into your browser: <br />
              <a href="%LINK%" style="color: #58a6ff; text-decoration: underline;">%LINK%</a>
            </p>

            <!-- Validity & Security Advisory -->
            <p style="margin: 18px 0 10px 0; font-size: 13px; color: #8b949e; line-height: 1.5;">
              This link is valid for <strong>15 minutes</strong> and can only be used once.
            </p>

            <p style="margin: 0 0 20px 0; font-size: 13px; color: #8b949e; line-height: 1.5;">
              <strong>Please don't share this link with anyone:</strong> If you did not request a password reset, you can safely ignore this email. Your account remains completely secure.
            </p>

            <!-- Sender Signature -->
            <p style="margin: 22px 0 0 0; font-size: 14px; color: #c9d1d9; line-height: 1.5;">
              Thanks,<br />
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

## 2. Email Address Verification Template

### Configuration in Firebase Console
- **Sender Name**: `The Prople Team`
- **From Email / Reply-To**: `auth@prople.co.in` (or `support@prople.co.in`)
- **Subject**: `Verify your email for Prople Store`
- **Authorized Domain**: `prople.co.in`
- **Customized Action URL**: `https://www.prople.co.in/?auth=verify-email`

### HTML Email Body
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your email – Prople Store</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0d1117; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e6edf3; -webkit-font-smoothing: antialiased; line-height: 1.6;">
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
            Verify your email, <span style="color: #60a5fa;">%DISPLAY_NAME%</span>
          </h1>

          <!-- Main Content Card -->
          <div style="background-color: #161b22; border: 1px solid #30363d; border-radius: 10px; padding: 26px 24px; margin-bottom: 24px;">
            <p style="margin: 0 0 18px 0; font-size: 15px; color: #c9d1d9; line-height: 1.6;">
              Welcome to Prople Store! To complete your registration and activate your verified account, please verify your email address:
            </p>

            <!-- Prominent Call-To-Action Button -->
            <div style="margin: 28px 0 22px 0;">
              <a href="%LINK%" target="_blank" style="display: inline-block; background-color: #238636; color: #ffffff; font-weight: 600; font-size: 15px; text-decoration: none; padding: 13px 30px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.3); text-align: center; border: 1px solid rgba(255,255,255,0.1);">
                Verify Email &rarr;
              </a>
            </div>

            <!-- Direct Fallback Link -->
            <p style="margin: 0 0 20px 0; font-size: 13px; color: #8b949e; word-break: break-all; line-height: 1.5;">
              Or copy and paste this link into your browser: <br />
              <a href="%LINK%" style="color: #58a6ff; text-decoration: underline;">%LINK%</a>
            </p>

            <!-- Validity & Security Advisory -->
            <p style="margin: 18px 0 10px 0; font-size: 13px; color: #8b949e; line-height: 1.5;">
              This verification link is valid for <strong>15 minutes</strong> and can only be used once.
            </p>

            <p style="margin: 0 0 20px 0; font-size: 13px; color: #8b949e; line-height: 1.5;">
              If you did not sign up for Prople Store, you can safely ignore this email.
            </p>

            <!-- Sender Signature -->
            <p style="margin: 22px 0 0 0; font-size: 14px; color: #c9d1d9; line-height: 1.5;">
              Thanks,<br />
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

## 3. How to Paste These Templates in Firebase Console

1. Open your Firebase project: [https://console.firebase.google.com](https://console.firebase.google.com)
2. In the left navigation, select **Build > Authentication**.
3. Click on the **Templates** tab at the top.
4. Select **Password reset** or **Email address verification**.
5. Click the edit pencil icon ✏️.
6. Set:
   - **Sender name**: `The Prople Team`
   - **Reply-to**: `support@prople.co.in`
   - **Subject**: As specified above.
7. Click **Customize action URL** and ensure it points to:
   - `https://www.prople.co.in/?auth=reset-password` (for Password reset)
   - `https://www.prople.co.in/?auth=verify-email` (for Email verification)
8. Paste the corresponding HTML into the message body.
9. Click **Save**.
