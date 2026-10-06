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
<body style="margin: 0; padding: 24px 12px; background-color: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #262626; font-size: 14px; line-height: 1.5; -webkit-font-smoothing: antialiased;">
  <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; max-width: 0px; opacity: 0;">
    Reset your password for Prople Store. Valid for 15 minutes. &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <!-- Main Instagram-style Card Container -->
        <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="max-width: 440px; width: 100%; background-color: #ffffff; border: 1px solid #dbdbdb; border-radius: 8px; overflow: hidden; text-align: left;">
          <tr>
            <td style="padding: 32px 28px 24px 28px;">
              
              <!-- Centered Brand Header -->
              <div style="text-align: center; margin-bottom: 24px;">
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
              <p style="margin: 0 0 20px 0; font-size: 14px; color: #262626; line-height: 1.5;">
                We received a request to reset the password for your Prople Store account. Click the button below to choose a new password.
              </p>

              <!-- Prominent Primary Call-To-Action Button -->
              <div style="margin: 22px 0 16px 0;">
                <a href="%LINK%" target="_blank" style="display: block; width: 100%; box-sizing: border-box; background-color: #0095f6; color: #ffffff; font-weight: 600; font-size: 14px; text-decoration: none; padding: 12px 20px; border-radius: 8px; text-align: center;">
                  Reset Password
                </a>
              </div>

              <!-- Fallback Direct Link -->
              <p style="margin: 0 0 18px 0; font-size: 12px; color: #737373; word-break: break-all; line-height: 1.4;">
                Or copy and paste this link into your browser: <br>
                <a href="%LINK%" style="color: #0095f6; text-decoration: underline;">%LINK%</a>
              </p>

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
<body style="margin: 0; padding: 24px 12px; background-color: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #262626; font-size: 14px; line-height: 1.5; -webkit-font-smoothing: antialiased;">
  <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; max-width: 0px; opacity: 0;">
    Verify your email for Prople Store. Valid for 15 minutes. &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <!-- Main Instagram-style Card Container -->
        <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="max-width: 440px; width: 100%; background-color: #ffffff; border: 1px solid #dbdbdb; border-radius: 8px; overflow: hidden; text-align: left;">
          <tr>
            <td style="padding: 32px 28px 24px 28px;">
              
              <!-- Centered Brand Header -->
              <div style="text-align: center; margin-bottom: 24px;">
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
              <p style="margin: 0 0 20px 0; font-size: 14px; color: #262626; line-height: 1.5;">
                Welcome to Prople Store! Please verify your email address to activate your account and start discovering applications.
              </p>

              <!-- Prominent Primary Call-To-Action Button -->
              <div style="margin: 22px 0 16px 0;">
                <a href="%LINK%" target="_blank" style="display: block; width: 100%; box-sizing: border-box; background-color: #0095f6; color: #ffffff; font-weight: 600; font-size: 14px; text-decoration: none; padding: 12px 20px; border-radius: 8px; text-align: center;">
                  Verify Email
                </a>
              </div>

              <!-- Fallback Direct Link -->
              <p style="margin: 0 0 18px 0; font-size: 12px; color: #737373; word-break: break-all; line-height: 1.4;">
                Or copy and paste this link into your browser: <br>
                <a href="%LINK%" style="color: #0095f6; text-decoration: underline;">%LINK%</a>
              </p>

              <!-- Validity Advisory -->
              <p style="margin: 0 0 20px 0; font-size: 13px; color: #737373; line-height: 1.5;">
                This link is valid for <strong>15 minutes</strong> and can only be used once. If you did not sign up for Prople Store, you can safely ignore this email.
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
<body style="margin: 0; padding: 24px 12px; background-color: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #262626; font-size: 14px; line-height: 1.5; -webkit-font-smoothing: antialiased;">
  <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; max-width: 0px; opacity: 0;">
    Your 1-click sign in link for Prople Store. Valid for 15 minutes. &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <!-- Main Instagram-style Card Container -->
        <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="max-width: 440px; width: 100%; background-color: #ffffff; border: 1px solid #dbdbdb; border-radius: 8px; overflow: hidden; text-align: left;">
          <tr>
            <td style="padding: 32px 28px 24px 28px;">
              
              <!-- Centered Brand Header -->
              <div style="text-align: center; margin-bottom: 24px;">
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
              <p style="margin: 0 0 20px 0; font-size: 14px; color: #262626; line-height: 1.5;">
                Click the button below to sign in instantly to your Prople Store account without entering a password.
              </p>

              <!-- Prominent Primary Call-To-Action Button -->
              <div style="margin: 22px 0 16px 0;">
                <a href="%LINK%" target="_blank" style="display: block; width: 100%; box-sizing: border-box; background-color: #0095f6; color: #ffffff; font-weight: 600; font-size: 14px; text-decoration: none; padding: 12px 20px; border-radius: 8px; text-align: center;">
                  Sign In to Prople Store
                </a>
              </div>

              <!-- Fallback Direct Link -->
              <p style="margin: 0 0 18px 0; font-size: 12px; color: #737373; word-break: break-all; line-height: 1.4;">
                Or copy and paste this link into your browser: <br>
                <a href="%LINK%" style="color: #0095f6; text-decoration: underline;">%LINK%</a>
              </p>

              <!-- Validity Advisory -->
              <p style="margin: 0 0 20px 0; font-size: 13px; color: #737373; line-height: 1.5;">
                This link is valid for <strong>15 minutes</strong> and can only be used once. If you did not request this, you can safely ignore this email.
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
</html>
```
