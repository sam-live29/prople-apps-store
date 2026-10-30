import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { Readable } from "stream";
import { createServer as createViteServer } from "vite";
import { initializeApp as initFirebaseApp } from "firebase/app";
import { 
  getFirestore as initFirestore, 
  doc as serverDoc, 
  getDoc as serverGetDoc, 
  setDoc as serverSetDoc, 
  updateDoc as serverUpdateDoc, 
  deleteDoc as serverDeleteDoc,
  collection as serverCollection,
  getDocs as serverGetDocs,
  query as serverQuery,
  where as serverWhere,
  limit as serverLimit,
  setLogLevel
} from "firebase/firestore";

try {
  setLogLevel('silent');
} catch {}
import {
  indexApp,
  indexApps,
  deleteAppFromIndex,
  searchApps,
  getMeilisearchStatus,
  ensureAppsIndexConfigured
} from "./server/meilisearch.ts";
import { 
  injectAppSeoIntoHtml, 
  injectCategorySeoIntoHtml,
  injectDeveloperSeoIntoHtml,
  injectPlatformSeoIntoHtml,
  injectHomeSeoIntoHtml,
  renderNotFoundHtml,
  slugifyAppName
} from "./server/seoRenderer.ts";
import { createS3UploadPresignedUrl, uploadBufferToS3, S3_BUCKET_NAME, S3_REGION } from "./server/s3Storage.ts";
import { 
  generateOtp, 
  storeOtp, 
  verifyStoredOtp, 
  sendOtpEmail, 
  sendPasswordResetEmailTemplate,
  setRuntimeResendApiKey
} from "./server/emailAuth.ts";
import { 
  persistUserPasswordHash, 
  getUserPasswordHash,
  createAuthSession,
  completeAuthSession,
  getAuthSessionStatus,
  consumeAuthSession,
  createSignedChallengeToken
} from "./server/otpStore.ts";
import {
  initAuthSecurity,
  getClientIp,
  isIpLocked,
  canAttemptLogin,
  canRequestOtp,
  recordOtpDispatched,
  recordSuccessfulLogin,
  registerFailedSecurityEvent
} from "./server/authSecurity.ts";
import {
  isStrictAdminEmail,
  isSafePublicUrl,
  safeFetchWithRedirectCheck,
  getSecureCorsHeaders,
  prototypePollutionGuard,
  sanitizeRedirectTarget,
  sanitizeIdentifier,
  deepSanitizeObject
} from "./server/securityDefense.ts";
import { getServerFirebaseConfig } from "./server/firebaseConfig.ts";

// Server-side Firestore initialization using secure environment or project configuration
let serverDb: any = null;
try {
  const fbConfig = getServerFirebaseConfig();
  if (fbConfig.projectId && !fbConfig.isExampleConfig) {
    const fbApp = initFirebaseApp(fbConfig, "prople-store-server-backend");
    serverDb = fbConfig.firestoreDatabaseId && !fbConfig.firestoreDatabaseId.includes("example")
      ? initFirestore(fbApp, fbConfig.firestoreDatabaseId)
      : initFirestore(fbApp);
    console.log("[Backend] Firestore initialized with secure env config on DB:", fbConfig.firestoreDatabaseId || "(default)");
    initAuthSecurity(serverDb);
    serverGetDoc(serverDoc(serverDb, "system_config", "resend")).then((snap: any) => {
      if (snap && snap.exists()) {
        const data = snap.data();
        if (data?.apiKey) {
          setRuntimeResendApiKey(data.apiKey);
          console.log("[Backend] Loaded Resend API key from Firestore system_config");
        }
      }
    }).catch(() => {});
  } else {
    console.log("[Backend] Firebase running in standalone mode (set FIREBASE_PROJECT_ID and FIREBASE_API_KEY in .env for live cloud connection)");
  }
} catch (e: any) {
  console.warn("[Backend] Failed to initialize Firestore on server:", e.message);
}

// In-memory rate limiting state for server-side abuse prevention
interface RateEvent {
  timestamp: number;
}
const serverPublishHistory = new Map<string, RateEvent[]>(); // key: userId or client IP
const serverUpdateHistory = new Map<string, RateEvent[]>();  // key: `${userId}:${appId}` or `${clientIp}:${appId}`
const ipBurstHistory = new Map<string, number[]>();          // IP burst flood limiter

function getNormalizedClientIp(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  } else if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  return req.socket.remoteAddress || req.ip || 'unknown';
}

function checkIpBurstLimit(ip: string, maxRequests = 20, windowMs = 60 * 1000): boolean {
  const now = Date.now();
  const times = (ipBurstHistory.get(ip) || []).filter(t => now - t < windowMs);
  if (times.length >= maxRequests) return false;
  times.push(now);
  ipBurstHistory.set(ip, times);
  return true;
}

// Memory pruning every 5 minutes to prevent RAM exhaustion from high-throughput floods
setInterval(() => {
  const now = Date.now();
  const pubWindow = 15 * 60 * 1000;
  for (const [key, events] of serverPublishHistory.entries()) {
    const valid = events.filter(e => now - e.timestamp < pubWindow);
    if (valid.length === 0) serverPublishHistory.delete(key);
    else serverPublishHistory.set(key, valid);
  }
  const updWindow = 60 * 60 * 1000;
  for (const [key, events] of serverUpdateHistory.entries()) {
    const valid = events.filter(e => now - e.timestamp < updWindow);
    if (valid.length === 0) serverUpdateHistory.delete(key);
    else serverUpdateHistory.set(key, valid);
  }
  for (const [ip, times] of ipBurstHistory.entries()) {
    const valid = times.filter(t => now - t < 60 * 1000);
    if (valid.length === 0) ipBurstHistory.delete(ip);
    else ipBurstHistory.set(ip, valid);
  }
}, 5 * 60 * 1000).unref();

function checkPublishRateLimit(key: string): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  const MAX_PER_WINDOW = 3;
  const now = Date.now();
  const events = (serverPublishHistory.get(key) || []).filter(e => now - e.timestamp < WINDOW_MS);
  
  if (events.length >= MAX_PER_WINDOW) {
    const oldest = events[0].timestamp;
    const retryAfterMs = WINDOW_MS - (now - oldest);
    return { allowed: false, remaining: 0, retryAfterMs };
  }
  
  return { allowed: true, remaining: MAX_PER_WINDOW - events.length, retryAfterMs: 0 };
}

function recordPublishRateLimit(key: string) {
  const now = Date.now();
  const WINDOW_MS = 15 * 60 * 1000;
  const events = (serverPublishHistory.get(key) || []).filter(e => now - e.timestamp < WINDOW_MS);
  events.push({ timestamp: now });
  serverPublishHistory.set(key, events);
}

function checkUpdateRateLimit(key: string): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const WINDOW_MS = 60 * 60 * 1000; // 1 hour
  const MAX_PER_WINDOW = 5;
  const now = Date.now();
  const events = (serverUpdateHistory.get(key) || []).filter(e => now - e.timestamp < WINDOW_MS);
  
  if (events.length >= MAX_PER_WINDOW) {
    const oldest = events[0].timestamp;
    const retryAfterMs = WINDOW_MS - (now - oldest);
    return { allowed: false, remaining: 0, retryAfterMs };
  }
  
  return { allowed: true, remaining: MAX_PER_WINDOW - events.length, retryAfterMs: 0 };
}

function recordUpdateRateLimit(key: string) {
  const now = Date.now();
  const WINDOW_MS = 60 * 60 * 1000;
  const events = (serverUpdateHistory.get(key) || []).filter(e => now - e.timestamp < WINDOW_MS);
  events.push({ timestamp: now });
  serverUpdateHistory.set(key, events);
}

function isPrivateOrReservedHost(hostname: string): boolean {
  if (!hostname) return true;
  const h = hostname.toLowerCase().trim();
  if (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '::1' ||
    h === '[::1]' ||
    h === '0.0.0.0' ||
    h === '169.254.169.254' ||
    h === '100.100.100.200' ||
    h === 'metadata.google.internal'
  ) {
    return true;
  }
  if (h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.onion')) return true;
  if (h.startsWith('[fc') || h.startsWith('[fd') || h.startsWith('[fe80') || h.includes('::ffff:127.') || h.includes('::ffff:10.') || h.includes('::ffff:192.168.') || h.includes('::ffff:169.254.')) {
    return true;
  }
  // Reject pure integer/hex IP encodings used to bypass dotted-quad checks
  if (/^(0x[0-9a-f]+|\d+)$/i.test(h)) return true;
  
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = h.match(ipv4Regex);
  if (match) {
    const a = parseInt(match[1], 10);
    const b = parseInt(match[2], 10);
    if (a === 127) return true; // loopback
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local & cloud metadata
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 carrier-grade NAT / Alibaba metadata
    if (a === 0) return true; // 0.0.0.0/8
  }
  return false;
}

/**
 * Strict image validation against image poisoning, disguised documents (PDF, DOCX, ZIP),
 * executable binaries, and active scripts.
 */
function validateImageSource(source: any, fieldName: string): { valid: boolean; error?: string } {
  if (!source) return { valid: true };
  if (typeof source !== 'string') {
    return { valid: false, error: `Invalid ${fieldName}: must be a string.` };
  }

  const trimmed = source.trim();
  if (!trimmed) return { valid: true };

  // Case 1: Data URLs (Base64 uploads)
  if (trimmed.startsWith('data:')) {
    const mimeMatch = trimmed.match(/^data:image\/([a-zA-Z0-9.+_-]+);base64,/i);
    if (!mimeMatch) {
      return { 
        valid: false, 
        error: `Security violation in ${fieldName}: Invalid MIME type. Only genuine WebP, PNG, JPEG, GIF, and AVIF images are permitted. Documents, archives, and executables are strictly prohibited.` 
      };
    }

    const subtype = mimeMatch[1].toLowerCase();
    const allowedSubtypes = ['png', 'jpeg', 'jpg', 'webp', 'gif', 'avif', 'svg+xml'];
    if (!allowedSubtypes.includes(subtype)) {
      return {
        valid: false,
        error: `Security violation in ${fieldName}: Unsupported image format '${subtype}'.`
      };
    }

    if (trimmed.length > 7 * 1024 * 1024) {
      return { valid: false, error: `${fieldName} exceeds maximum allowable size of 5MB.` };
    }

    const base64Data = trimmed.substring(mimeMatch[0].length);
    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64Data.slice(0, 512), 'base64');
    } catch {
      return { valid: false, error: `Failed to decode base64 in ${fieldName}.` };
    }

    if (buffer.length < 4) {
      return { valid: false, error: `Truncated or empty image file in ${fieldName}.` };
    }

    // Disguised PDF (%PDF-)
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
      return { valid: false, error: `Image poisoning rejected in ${fieldName}: Disguised PDF document detected.` };
    }

    // Disguised ZIP / APK / DOCX (PK..)
    if (buffer[0] === 0x50 && buffer[1] === 0x4B && (buffer[2] === 0x03 || buffer[2] === 0x05)) {
      return { valid: false, error: `Image poisoning rejected in ${fieldName}: Disguised document archive detected.` };
    }

    // Disguised Windows PE executable (MZ)
    if (buffer[0] === 0x4D && buffer[1] === 0x5A) {
      return { valid: false, error: `Security violation in ${fieldName}: Disguised Windows PE executable detected.` };
    }

    // Disguised Linux ELF executable (\x7FELF)
    if (buffer[0] === 0x7F && buffer[1] === 0x45 && buffer[2] === 0x4C && buffer[3] === 0x46) {
      return { valid: false, error: `Security violation in ${fieldName}: Disguised ELF binary executable detected.` };
    }

    // Script / HTML injection detection
    const headerStr = buffer.toString('utf-8', 0, Math.min(buffer.length, 256)).toLowerCase();
    if (
      headerStr.includes('<html') ||
      headerStr.includes('<!doctype') ||
      headerStr.includes('<script') ||
      headerStr.includes('<?php') ||
      headerStr.includes('#!/') ||
      headerStr.includes('eval(')
    ) {
      return { valid: false, error: `Security violation in ${fieldName}: Disguised script or HTML payload detected.` };
    }

    // Verify legitimate image magic headers
    if (subtype === 'png') {
      const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
      if (!isPng) return { valid: false, error: `Invalid PNG image signature in ${fieldName}.` };
    } else if (subtype === 'jpeg' || subtype === 'jpg') {
      const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
      if (!isJpeg) return { valid: false, error: `Invalid JPEG image signature in ${fieldName}.` };
    } else if (subtype === 'gif') {
      const isGif = buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38;
      if (!isGif) return { valid: false, error: `Invalid GIF image signature in ${fieldName}.` };
    } else if (subtype === 'webp') {
      const isRiff = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
      if (buffer.length >= 12) {
        const isWebp = buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
        if (!isRiff || !isWebp) return { valid: false, error: `Invalid WebP image signature in ${fieldName}.` };
      } else if (!isRiff) {
        return { valid: false, error: `Invalid WebP image signature in ${fieldName}.` };
      }
    } else if (subtype === 'svg+xml') {
      const fullSvgStr = Buffer.from(base64Data, 'base64').toString('utf-8').toLowerCase();
      if (!fullSvgStr.includes('<svg')) {
        return { valid: false, error: `Invalid SVG format in ${fieldName}.` };
      }
      if (
        fullSvgStr.includes('<script') ||
        fullSvgStr.includes('onload=') ||
        fullSvgStr.includes('onerror=') ||
        fullSvgStr.includes('onclick=') ||
        fullSvgStr.includes('javascript:') ||
        fullSvgStr.includes('<!entity')
      ) {
        return { valid: false, error: `Active script content prohibited in SVG ${fieldName}.` };
      }
    }

    return { valid: true };
  }

  // Case 2: External HTTP/HTTPS URLs
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { valid: false, error: `Invalid protocol for ${fieldName}. Only HTTP and HTTPS are permitted.` };
      }
      if (isPrivateOrReservedHost(parsed.hostname)) {
        return { valid: false, error: `Security violation in ${fieldName}: Loopback and internal network references are prohibited.` };
      }
      return { valid: true };
    } catch {
      return { valid: false, error: `Invalid URL format in ${fieldName}.` };
    }
  }

  // Case 3: Relative path assets (e.g. /logo.png, /pwa-192x192.png)
  if (trimmed.startsWith('/')) {
    if (trimmed.includes('..') || trimmed.includes('\\')) {
      return { valid: false, error: `Directory traversal attempt blocked in ${fieldName}.` };
    }
    return { valid: true };
  }

  return { valid: false, error: `Unrecognized image source in ${fieldName}. Must be a valid HTTPS URL or authentic image Data URL.` };
}

function validateAppPayload(app: any): { valid: boolean; error?: string } {
  if (!app || typeof app !== 'object') {
    return { valid: false, error: 'Invalid app payload: body must contain an app object.' };
  }
  if (!app.id || typeof app.id !== 'string' || app.id.length < 2 || app.id.length > 100) {
    return { valid: false, error: 'Invalid app ID: must be a non-empty string between 2 and 100 characters.' };
  }
  if (!app.name || typeof app.name !== 'string' || app.name.trim().length === 0 || app.name.length > 150) {
    return { valid: false, error: 'Invalid app name: must be between 1 and 150 characters.' };
  }
  if (!app.developer || typeof app.developer !== 'string' || app.developer.trim().length === 0 || app.developer.length > 150) {
    return { valid: false, error: 'Invalid developer name: must be between 1 and 150 characters.' };
  }
  if (!app.downloadUrl || typeof app.downloadUrl !== 'string' || app.downloadUrl.trim().length === 0) {
    return { valid: false, error: 'Invalid download URL: an APK download link is required.' };
  }
  
  // Security validation against image poisoning and disguised documents
  if (app.iconUrl) {
    const v = validateImageSource(app.iconUrl, 'iconUrl');
    if (!v.valid) return v;
  }
  if (app.featureGraphicUrl) {
    const v = validateImageSource(app.featureGraphicUrl, 'featureGraphicUrl');
    if (!v.valid) return v;
  }
  if (app.detailsBannerUrl) {
    const v = validateImageSource(app.detailsBannerUrl, 'detailsBannerUrl');
    if (!v.valid) return v;
  }
  if (app.heroBannerUrl) {
    const v = validateImageSource(app.heroBannerUrl, 'heroBannerUrl');
    if (!v.valid) return v;
  }
  if (app.videoThumbnailUrl) {
    const v = validateImageSource(app.videoThumbnailUrl, 'videoThumbnailUrl');
    if (!v.valid) return v;
  }
  if (Array.isArray(app.screenshots)) {
    if (app.screenshots.length > 25) {
      return { valid: false, error: 'Maximum 25 screenshots allowed.' };
    }
    for (let i = 0; i < app.screenshots.length; i++) {
      const v = validateImageSource(app.screenshots[i], `screenshots[${i}]`);
      if (!v.valid) return v;
    }
  }
  if (Array.isArray(app.tabletScreenshots)) {
    for (let i = 0; i < app.tabletScreenshots.length; i++) {
      const v = validateImageSource(app.tabletScreenshots[i], `tabletScreenshots[${i}]`);
      if (!v.valid) return v;
    }
  }
  if (Array.isArray(app.desktopScreenshots)) {
    for (let i = 0; i < app.desktopScreenshots.length; i++) {
      const v = validateImageSource(app.desktopScreenshots[i], `desktopScreenshots[${i}]`);
      if (!v.valid) return v;
    }
  }
  
  return { valid: true };
}

function parseDownloadCount(val?: string | number): number {
  if (typeof val === 'number') return Math.max(0, val);
  if (!val || typeof val !== 'string') return 0;
  const clean = val.trim().toUpperCase().replace(/,/g, '');
  if (clean.endsWith('B+') || clean.endsWith('B')) {
    return Math.floor(parseFloat(clean) * 1_000_000_000) || 0;
  }
  if (clean.endsWith('M+') || clean.endsWith('M')) {
    return Math.floor(parseFloat(clean) * 1_000_000) || 0;
  }
  if (clean.endsWith('K+') || clean.endsWith('K')) {
    return Math.floor(parseFloat(clean) * 1_000) || 0;
  }
  return parseInt(clean.replace(/[^\d]/g, ''), 10) || 0;
}

function formatDownloadCount(val: number | string | undefined): string {
  const count = typeof val === 'number' ? val : parseDownloadCount(val);
  if (count <= 0) return '0+';
  if (count < 10) return `${count}+`;
  if (count < 50) return '10+';
  if (count < 100) return '50+';
  if (count < 500) return '100+';
  if (count < 1000) return '500+';
  if (count < 5000) return '1K+';
  if (count < 10000) return '5K+';
  if (count < 50000) return '10K+';
  if (count < 100000) return '50K+';
  if (count < 500000) return '100K+';
  if (count < 1000000) return '500K+';
  if (count < 5000000) return '1M+';
  if (count < 10000000) return '5M+';
  if (count < 50000000) return '10M+';
  if (count < 100000000) return '50M+';
  return '100M+';
}

const DANGEROUS_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.filter(item => item !== undefined).map(sanitizeObject);
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (DANGEROUS_OBJECT_KEYS.has(k)) continue;
    if (v !== undefined) {
      result[k] = sanitizeObject(v);
    }
  }
  return result;
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Enable trust proxy for cloud deployment environments (Cloud Run, AI Studio)
  app.enable('trust proxy');

  // Security: Disable X-Powered-By header to prevent technology fingerprinting
  app.disable('x-powered-by');

  // Security: Global OWASP & SOC 2 Compliant HTTP Security Headers
  app.use((req, res, next) => {
    // 1. Referrer-Policy: Prevents leaking origin paths or tokens across domains
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // 2. X-Content-Type-Options: Prevents MIME-type sniffing attacks
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // 3. X-Frame-Options: Omitted in favor of CSP frame-ancestors to allow AI Studio iframe embedding

    // 4. X-XSS-Protection: Defense in depth for legacy browsers
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // 5. Strict-Transport-Security (HSTS): Force HTTPS
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

    // 6. Permissions-Policy: Allow native browser/OS microphone permission prompts while restricting unused sensors
    res.setHeader('Permissions-Policy', 'camera=(), microphone=*, geolocation=(), payment=()');

    // 7. Content-Security-Policy (CSP): Cross-site scripting & injection mitigation
    const isDev = process.env.NODE_ENV !== 'production';
    const frameAncestors = "'self' https://*.run.app https://*.google.com https://*.googleusercontent.com https://*.aistudio.google.com";

    const scriptSrc = "script-src 'self' 'unsafe-inline' https://apis.google.com https://*.firebaseio.com https://*.googleapis.com https://www.youtube.com https://s.ytimg.com";

    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        scriptSrc,
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' data: https://fonts.gstatic.com",
        "img-src 'self' data: blob: https: http:",
        "media-src 'self' blob: https:",
        "connect-src 'self' https: wss: http: ws:",
        "frame-src 'self' https://accounts.google.com https://*.firebaseapp.com https://www.youtube.com https://www.youtube-nocookie.com",
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        `frame-ancestors ${frameAncestors}`,
      ].join('; ')
    );

    // Suppress fingerprinting headers
    res.removeHeader('Server');
    res.removeHeader('X-Powered-By');

    // CORS & Preflight handling with strict origin validation to prevent credential theft
    const corsHeaders = getSecureCorsHeaders(req.headers.origin);
    for (const [headerName, headerValue] of Object.entries(corsHeaders)) {
      res.setHeader(headerName, headerValue);
    }

    // Cross-Origin Opener Policy: Allows Google OAuth / Resend popups while preventing window hijacking
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    next();
  });

  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ limit: '25mb', extended: true }));
  app.use(prototypePollutionGuard);

  // RFC 9116 Compliant Security.txt endpoint
  app.get(["/.well-known/security.txt", "/security.txt"], (req, res) => {
    res.type("text/plain; charset=utf-8");
    const domain = `${req.protocol}://${req.get("host") || "prople.co.in"}`;
    const securityTxt = [
      "# Security Policy and Vulnerability Disclosure for Prople Store & Cloaktail Industries",
      "# Compliant with RFC 9116",
      "",
      "Contact: mailto:cloaktailsupport@gmail.com",
      "Contact: mailto:cloaktailofficial@gmail.com",
      "Expires: 2027-12-31T23:59:59.000Z",
      "Preferred-Languages: en",
      `Canonical: ${domain}/.well-known/security.txt`,
      `Policy: ${domain}/terms`,
      `Acknowledgments: ${domain}/terms`,
      `Hiring: ${domain}/about`,
      ""
    ].join("\n");
    res.send(securityTxt);
  });

  // Health check API
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "prople-store-backend"
    });
  });

  // Search Engine Optimization (SEO) & AI Directives: robots.txt
  app.get(["/robots.txt", "/robots"], (req, res) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
    res.setHeader("Access-Control-Allow-Origin", "*");
    const domain = "https://www.prople.co.in";
    const robots = [
      "# Prople Store - Robots Directives for Search Engines & AI Models",
      "# Canonical: https://www.prople.co.in/robots.txt",
      "",
      "User-agent: *",
      "Allow: /",
      "Disallow: /admin",
      "Disallow: /dashboard",
      "Disallow: /api/",
      "Disallow: /auth/",
      "Disallow: /login/",
      "Disallow: /internal/",
      "",
      "# Generative Engine Optimization (GEO): Permit AI assistants & web crawlers",
      "User-agent: Google-Extended",
      "Allow: /",
      "",
      "User-agent: GPTBot",
      "Allow: /",
      "",
      "User-agent: ClaudeBot",
      "Allow: /",
      "",
      "User-agent: PerplexityBot",
      "Allow: /",
      "",
      "User-agent: Applebot",
      "Allow: /",
      "",
      "User-agent: CCBot",
      "Allow: /",
      "",
      `Sitemap: ${domain}/sitemap.xml`,
      `# Machine-readable LLM catalog specification`,
      `# See: ${domain}/llms.txt`,
      `# Model Context Protocol (MCP) Server`,
      `# SSE Endpoint: ${domain}/api/mcp/sse`,
      `# MCP Info & Tools: ${domain}/api/mcp`,
      ""
    ].join("\n");
    return res.send(robots);
  });

  // Generative Engine Optimization (GEO): /llms.txt specification for AI models
  app.get(["/llms.txt", "/.well-known/llms.txt"], async (req, res) => {
    try {
      res.type("text/plain; charset=utf-8");
      const host = req.get("host") || "prople-store.web.app";
      const domain = `${req.protocol}://${host}`;

      let appsListing = "";
      if (serverDb) {
        try {
          const appsCol = serverCollection(serverDb, "apps");
          const snap = await serverGetDocs(appsCol);
          snap.forEach(d => {
            const app = d.data();
            if (app.isPublished !== false) {
              const appName = app.name || d.id;
              const canonicalSlug = app.slug || slugifyAppName(appName) || d.id;
              const summary = app.shortDescription || (app.description ? app.description.slice(0, 140).replace(/[\r\n]+/g, " ") : "Verified application");
              const category = app.category || "Tools";
              const platform = app.platform || "Android, Windows, Linux";
              appsListing += `- [${appName}](${domain}/apps/${encodeURIComponent(canonicalSlug)}): ${summary} (Category: ${category}, Platform: ${platform})\n`;
            }
          });
        } catch (e: any) {
          console.warn("[GEO] Error generating /llms.txt:", e.message);
        }
      }

      const content = [
        "# Prople Store — Official Application Marketplace & Knowledge Graph",
        "",
        "> Prople Store is an Android application marketplace and digital distribution platform operated by Cloaktail Industries.",
        "> Cloaktail Industries is the parent technology organization, founded and led by Sahanur Molla (Founder & CEO).",
        "",
        "## Corporate & Organizational Hierarchy",
        "- **Parent Organization**: Cloaktail Industries (Technology organization building software, AI, and emerging tech platforms)",
        "- **Founder & CEO**: Sahanur Molla",
        "- **Operating Platform**: Prople Store (Android application discovery, safe APK distribution, and developer ecosystem)",
        "- **Official Contact**: cloaktailofficial@gmail.com",
        "",
        "## Published Applications",
        appsListing || "- Direct index currently loading...",
        "",
        "## Model Context Protocol (MCP) Server for Agents & Developers",
        `- SSE Endpoint: ${domain}/api/mcp/sse`,
        `- MCP Info & Tool Schemas: ${domain}/api/mcp`,
        "- Stdio CLI Runner: `npx tsx server/mcp/cli.ts` (or `npm run mcp:stdio`)",
        "- Supported Tools: `search_apps`, `get_app_details`, `get_download_artifacts`, `get_data_safety_and_security`, `list_trending_and_top_charts`, `list_categories`",
        "",
        "## Discoverability & Sitemaps",
        `- [XML Sitemap](${domain}/sitemap.xml)`,
        `- [Robots Directives](${domain}/robots.txt)`,
        `- [Full Detailed Catalog](${domain}/llms-full.txt)`,
        `- [Model Context Protocol (MCP) SSE](${domain}/api/mcp/sse)`,
        ""
      ].join("\n");

      return res.send(content);
    } catch (err: any) {
      return res.status(500).send("# Error generating /llms.txt");
    }
  });

  // Generative Engine Optimization (GEO): /llms-full.txt with in-depth machine-readable entity metadata
  app.get("/llms-full.txt", async (req, res) => {
    try {
      res.type("text/plain; charset=utf-8");
      const host = req.get("host") || "prople-store.web.app";
      const domain = `${req.protocol}://${host}`;

      let catalog = "";
      if (serverDb) {
        try {
          const appsCol = serverCollection(serverDb, "apps");
          const snap = await serverGetDocs(appsCol);
          snap.forEach(d => {
            const app = d.data();
            if (app.isPublished !== false) {
              const appName = app.name || d.id;
              const canonicalSlug = app.slug || slugifyAppName(appName) || d.id;
              catalog += `\n### ${appName}\n`;
              catalog += `- **Direct Install Page**: ${domain}/apps/${encodeURIComponent(canonicalSlug)}\n`;
              catalog += `- **Developer**: ${app.developer || "Verified Developer"}\n`;
              catalog += `- **Category**: ${app.category || "Tools"}\n`;
              catalog += `- **Supported Platforms**: ${app.platform || "Android, Windows, Linux"}\n`;
              catalog += `- **Version**: ${app.versionName || "1.0.0"}\n`;
              catalog += `- **Rating**: ${app.rating ? `${Number(app.rating).toFixed(1)} ★` : "New (Pending Reviews)"}\n`;
              catalog += `- **Package Type**: ${app.packageFormat || "APK / Binary"}\n`;
              catalog += `- **Overview**: ${app.description || app.shortDescription || "No detailed description provided."}\n`;
            }
          });
        } catch (e: any) {
          console.warn("[GEO] Error generating /llms-full.txt:", e.message);
        }
      }

      const content = [
        "# Prople Store - Comprehensive Application Catalog for LLMs",
        "",
        "This resource provides full entity metadata for generative search and AI chatbots (Google Gemini, OpenAI ChatGPT, Perplexity, Anthropic Claude) to cite and direct users to verified app installations.",
        "",
        catalog || "\nNo applications registered yet."
      ].join("\n");

      return res.send(content);
    } catch (err: any) {
      return res.status(500).send("# Error generating /llms-full.txt");
    }
  });

  // Helper to ping search engines on new app publishes or updates
  function pingSearchEngines(sitemapUrl: string) {
    try {
      const endpoints = [
        `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
        `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`
      ];
      for (const pingUrl of endpoints) {
        fetch(pingUrl).catch(() => {});
      }
    } catch {}
  }

  // XML Escaper for Sitemaps
  function escapeXml(str: string): string {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function formatIsoDate(val: any, fallback: string): string {
    if (!val) return fallback;
    try {
      if (typeof val === 'string') {
        return val.includes('T') ? val.split('T')[0] : val.slice(0, 10);
      }
      if (typeof val === 'number') {
        return new Date(val).toISOString().split('T')[0];
      }
      if (val && typeof val.toDate === 'function') {
        return val.toDate().toISOString().split('T')[0];
      }
      if (val instanceof Date) {
        return val.toISOString().split('T')[0];
      }
    } catch {}
    return fallback;
  }

  // Canonical domain for sitemaps
  const SITEMAP_BASE = "https://www.prople.co.in";

  // Search Engine Optimization (SEO): Sitemaps Index at /sitemap.xml
  app.get(["/sitemap.xml", "/sitemap_index.xml"], async (req, res) => {
    try {
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Access-Control-Allow-Origin", "*");

      const now = new Date().toISOString().split("T")[0];
      const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${SITEMAP_BASE}/sitemaps/apps.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${SITEMAP_BASE}/sitemaps/categories.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${SITEMAP_BASE}/sitemaps/platforms.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${SITEMAP_BASE}/sitemaps/developers.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${SITEMAP_BASE}/sitemaps/pages.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
</sitemapindex>`;

      return res.send(sitemapIndex);
    } catch (err: any) {
      console.error("[SEO] Error generating sitemap index:", err.message);
      return res.status(500).send("<?xml version=\"1.0\" encoding=\"UTF-8\"?><error>Error generating sitemap index</error>");
    }
  });

  // Sub-Sitemap: Applications
  app.get(["/sitemaps/apps.xml", "/sitemaps/apps-1.xml"], async (req, res) => {
    try {
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Access-Control-Allow-Origin", "*");

      const now = new Date().toISOString().split("T")[0];
      const allApps = await getAllAppsServer();
      const seenAppSlugs = new Set<string>();

      let urls = "";
      for (const app of allApps) {
        if (app && app.isPublished !== false) {
          const canonicalSlug = app.slug || slugifyAppName(app.name) || app.id;
          if (seenAppSlugs.has(canonicalSlug)) continue;
          seenAppSlugs.add(canonicalSlug);
          const lastMod = formatIsoDate(app.updatedAt || app.createdAt, now);
          urls += `  <url>\n    <loc>${escapeXml(`${SITEMAP_BASE}/apps/${encodeURIComponent(canonicalSlug)}`)}</loc>\n    <lastmod>${escapeXml(lastMod)}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;
        }
      }

      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}</urlset>`;
      return res.send(xml);
    } catch (err: any) {
      console.error("[SEO Sitemap Apps Error]:", err);
      return res.status(500).send(`<?xml version="1.0" encoding="UTF-8"?><error>${escapeXml(err?.message || 'Error generating apps sitemap')}</error>`);
    }
  });

  // Sub-Sitemap: Categories
  app.get("/sitemaps/categories.xml", async (req, res) => {
    try {
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Access-Control-Allow-Origin", "*");

      const now = new Date().toISOString().split("T")[0];
      const allApps = await getAllAppsServer();
      const uniqueCategories = new Set<string>();

      for (const app of allApps) {
        if (app?.category) uniqueCategories.add(app.category.trim());
      }

      // Standard fallback store categories
      const standardCats = [
        'Art & Design', 'Auto & Vehicles', 'Beauty', 'Books & Reference', 'Business',
        'Comics', 'Communication', 'Dating', 'Education', 'Entertainment', 'Events',
        'Finance', 'Food & Drink', 'Games', 'Health & Fitness', 'Lifestyle',
        'Maps & Navigation', 'Medical', 'Music & Audio', 'News & Magazines', 'Parenting',
        'Personalisation', 'Photography', 'Productivity', 'Shopping', 'Social', 'Sports',
        'Tools', 'Travel & Local', 'Video Players & Editors', 'Weather'
      ];
      for (const cat of standardCats) {
        uniqueCategories.add(cat);
      }

      let urls = "";
      for (const cat of uniqueCategories) {
        const catSlug = slugifyAppName(cat);
        urls += `  <url>\n    <loc>${escapeXml(`${SITEMAP_BASE}/categories/${encodeURIComponent(catSlug)}`)}</loc>\n    <lastmod>${escapeXml(now)}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
      }

      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}</urlset>`;
      return res.send(xml);
    } catch (err: any) {
      return res.status(500).send("<?xml version=\"1.0\" encoding=\"UTF-8\"?><error>Error generating categories sitemap</error>");
    }
  });

  // Sub-Sitemap: Platforms
  app.get("/sitemaps/platforms.xml", (req, res) => {
    try {
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Access-Control-Allow-Origin", "*");

      const now = new Date().toISOString().split("T")[0];
      const platforms = ['android', 'windows', 'linux', 'mac', 'apple', 'web'];

      let urls = "";
      for (const plat of platforms) {
        urls += `  <url>\n    <loc>${escapeXml(`${SITEMAP_BASE}/platforms/${plat}`)}</loc>\n    <lastmod>${escapeXml(now)}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
      }

      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}</urlset>`;
      return res.send(xml);
    } catch (err: any) {
      return res.status(500).send("<?xml version=\"1.0\" encoding=\"UTF-8\"?><error>Error generating platforms sitemap</error>");
    }
  });

  // Sub-Sitemap: Developers
  app.get("/sitemaps/developers.xml", async (req, res) => {
    try {
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Access-Control-Allow-Origin", "*");

      const now = new Date().toISOString().split("T")[0];
      const allApps = await getAllAppsServer();
      const uniqueDevelopers = new Set<string>();

      for (const app of allApps) {
        if (app?.developer) uniqueDevelopers.add(app.developer.trim());
      }
      uniqueDevelopers.add('Cloaktail Industries');

      let urls = "";
      for (const dev of uniqueDevelopers) {
        const devSlug = slugifyAppName(dev);
        urls += `  <url>\n    <loc>${escapeXml(`${SITEMAP_BASE}/developers/${encodeURIComponent(devSlug)}`)}</loc>\n    <lastmod>${escapeXml(now)}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
      }

      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}</urlset>`;
      return res.send(xml);
    } catch (err: any) {
      return res.status(500).send("<?xml version=\"1.0\" encoding=\"UTF-8\"?><error>Error generating developers sitemap</error>");
    }
  });

  // Sub-Sitemap: Static Pages
  app.get("/sitemaps/pages.xml", (req, res) => {
    try {
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Access-Control-Allow-Origin", "*");

      const now = new Date().toISOString().split("T")[0];
      const pages = [
        { path: '', priority: '1.0', changefreq: 'daily' },
        { path: '/apps', priority: '0.9', changefreq: 'daily' },
        { path: '/about', priority: '0.6', changefreq: 'monthly' },
        { path: '/terms', priority: '0.5', changefreq: 'monthly' },
        { path: '/privacy', priority: '0.5', changefreq: 'monthly' },
        { path: '/security', priority: '0.6', changefreq: 'monthly' },
        { path: '/how-it-works', priority: '0.6', changefreq: 'monthly' },
        { path: '/anti-piracy', priority: '0.5', changefreq: 'monthly' },
        { path: '/user-consent', priority: '0.5', changefreq: 'monthly' },
      ];

      let urls = "";
      for (const p of pages) {
        urls += `  <url>\n    <loc>${escapeXml(`${SITEMAP_BASE}${p.path}`)}</loc>\n    <lastmod>${escapeXml(now)}</lastmod>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>\n`;
      }

      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}</urlset>`;
      return res.send(xml);
    } catch (err: any) {
      return res.status(500).send("<?xml version=\"1.0\" encoding=\"UTF-8\"?><error>Error generating pages sitemap</error>");
    }
  });

  // Single Unified Sitemap Fallback: /sitemap-all.xml
  app.get("/sitemap-all.xml", async (req, res) => {
    try {
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Access-Control-Allow-Origin", "*");

      const now = new Date().toISOString().split("T")[0];
      const allApps = await getAllAppsServer();
      const uniqueCategories = new Set<string>();
      const uniqueDevelopers = new Set<string>();
      const seenAppSlugs = new Set<string>();

      let urls = `  <url>\n    <loc>${SITEMAP_BASE}/</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n  <url>\n    <loc>${SITEMAP_BASE}/apps</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;

      for (const app of allApps) {
        if (app && app.isPublished !== false) {
          const canonicalSlug = app.slug || slugifyAppName(app.name) || app.id;
          if (seenAppSlugs.has(canonicalSlug)) continue;
          seenAppSlugs.add(canonicalSlug);
          const lastMod = formatIsoDate(app.updatedAt || app.createdAt, now);
          urls += `  <url>\n    <loc>${escapeXml(`${SITEMAP_BASE}/apps/${encodeURIComponent(canonicalSlug)}`)}</loc>\n    <lastmod>${escapeXml(lastMod)}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;
          if (app.category) uniqueCategories.add(app.category.trim());
          if (app.developer) uniqueDevelopers.add(app.developer.trim());
        }
      }

      for (const cat of uniqueCategories) {
        urls += `  <url>\n    <loc>${escapeXml(`${SITEMAP_BASE}/categories/${encodeURIComponent(slugifyAppName(cat))}`)}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
      }

      for (const dev of uniqueDevelopers) {
        urls += `  <url>\n    <loc>${escapeXml(`${SITEMAP_BASE}/developers/${encodeURIComponent(slugifyAppName(dev))}`)}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
      }

      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}</urlset>`;
      return res.send(xml);
    } catch (err: any) {
      return res.status(500).send("<?xml version=\"1.0\" encoding=\"UTF-8\"?><error>Error generating sitemap</error>");
    }
  });

  // In-memory cache for search fallback apps to ensure sub-10ms response times
  let searchFallbackCache: { apps: any[]; timestamp: number } = { apps: [], timestamp: 0 };

  // Meilisearch: Search API
  app.get("/api/search", async (req, res) => {
    try {
      const q = String(req.query.q || req.query.query || "");
      const category = req.query.category ? String(req.query.category) : undefined;
      const platform = req.query.platform ? String(req.query.platform) : undefined;
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || 20), 10)));
      const offset = Math.max(0, parseInt(String(req.query.offset || 0), 10));

      let fallbackApps: any[] = [];
      const now = Date.now();
      if (now - searchFallbackCache.timestamp < 15000 && searchFallbackCache.apps.length > 0) {
        fallbackApps = searchFallbackCache.apps;
      } else if (serverDb) {
        try {
          const appsCol = serverCollection(serverDb, "apps");
          const snap = await serverGetDocs(appsCol);
          snap.forEach(d => {
            const data = d.data();
            const hasValidSource = Boolean(
              data.downloadUrl ||
              data.githubReleaseUrl ||
              data.githubRepo ||
              data.webUrl ||
              data.packageFormat
            );
            if (hasValidSource || data.versionName || data.name !== 'App') {
              fallbackApps.push({ id: d.id, ...data });
            }
          });
          if (fallbackApps.length > 0) {
            searchFallbackCache = { apps: fallbackApps, timestamp: now };
          }
        } catch {}
      }

      const result = await searchApps(q, { category, platform, limit, offset }, fallbackApps);
      return res.json({ success: true, ...result });
    } catch (err: any) {
      console.error("[Backend] Search API error:", err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Meilisearch: Indexing Status API
  app.get("/api/search/status", async (req, res) => {
    try {
      const status = await getMeilisearchStatus();
      return res.json({ success: true, meilisearch: status });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  function isServerAdminEmail(email?: string): boolean {
    return isStrictAdminEmail(email);
  }

  // Meilisearch: Trigger Batch Indexing of All Apps (Protected Admin API)
  app.post("/api/search/sync", async (req, res) => {
    try {
      const userEmail = (req.body?.userEmail || req.headers['x-user-email'] || '').toString().trim();
      if (!userEmail || !isServerAdminEmail(userEmail)) {
        return res.status(403).json({
          success: false,
          error: "Forbidden: Administrator authorization required to trigger search re-indexing."
        });
      }

      if (!serverDb) {
        return res.status(503).json({ success: false, error: "Service temporarily unavailable. Please try again." });
      }
      const appsCol = serverCollection(serverDb, "apps");
      const snap = await serverGetDocs(appsCol);
      const allApps: any[] = [];
      snap.forEach(d => allApps.push({ id: d.id, ...d.data() }));

      const indexResult = await indexApps(allApps);
      return res.json({
        success: indexResult.success,
        indexedCount: indexResult.count,
        totalAppsInDb: allApps.length
      });
    } catch (err: any) {
      console.error("[Backend] Sync error:", err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // AWS S3 Media Storage APIs
  // ==========================================

  // Check S3 Configuration & Health
  app.get("/api/storage/status", (_req, res) => {
    const hasKeys = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
    return res.json({
      success: true,
      bucket: S3_BUCKET_NAME,
      region: S3_REGION,
      hasCredentials: hasKeys,
      publicBaseUrl: `https://${S3_BUCKET_NAME}.s3.${S3_REGION}.amazonaws.com`,
    });
  });

  // Request a Pre-Signed Upload URL (Upload directly to S3 from browser)
  app.post("/api/storage/presigned-url", async (req, res) => {
    try {
      const { filename, contentType, folder = "apps" } = req.body || {};
      if (!filename) {
        return res.status(400).json({ success: false, error: "Missing filename parameter." });
      }

      const safeFolder = String(folder).replace(/[^a-zA-Z0-9_\-\/]/g, "").slice(0, 50);
      const cleanFilename = String(filename).replace(/[^a-zA-Z0-9_\-\.]/g, "_").slice(0, 100);
      const timestamp = Date.now();
      const randomNonce = Math.random().toString(36).substring(2, 8);
      const s3Key = `${safeFolder}/${timestamp}-${randomNonce}-${cleanFilename}`;

      const presigned = await createS3UploadPresignedUrl(
        s3Key,
        contentType || "image/webp",
        900 // 15 minutes validity
      );

      if (!presigned) {
        return res.status(500).json({
          success: false,
          error: "Could not generate AWS S3 pre-signed upload URL. Please verify AWS credentials on server.",
          fallbackUrl: null,
        });
      }

      return res.json({
        success: true,
        uploadUrl: presigned.uploadUrl,
        publicUrl: presigned.publicUrl,
        key: s3Key,
      });
    } catch (err: any) {
      console.error("[Backend S3] Presigned URL error:", err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Server-side Direct Upload to S3 (Accepts base64 or binary data)
  app.post("/api/storage/upload", async (req, res) => {
    try {
      const { dataUrl, filename, folder = "apps" } = req.body || {};
      if (!dataUrl || typeof dataUrl !== "string") {
        return res.status(400).json({ success: false, error: "Missing or invalid dataUrl payload." });
      }

      // Check if it's already an external URL
      if (dataUrl.startsWith("http://") || dataUrl.startsWith("https://")) {
        return res.json({ success: true, url: dataUrl });
      }

      // Strict binary validation
      const validation = validateImageSource(dataUrl, filename || "Upload Image");
      if (!validation.valid) {
        return res.status(400).json({ success: false, error: validation.error });
      }

      const match = dataUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
      if (!match) {
        return res.status(400).json({ success: false, error: "Malformed base64 image data." });
      }

      const subtype = match[1];
      const base64Data = match[2];
      const buffer = Buffer.from(base64Data, "base64");
      const contentType = `image/${subtype}`;

      const safeFolder = String(folder).replace(/[^a-zA-Z0-9_\-\/]/g, "").slice(0, 50);
      const cleanFilename = String(filename || "image").replace(/[^a-zA-Z0-9_\-\.]/g, "_").slice(0, 100);
      const s3Key = `${safeFolder}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${cleanFilename}.${subtype}`;

      const publicUrl = await uploadBufferToS3(buffer, s3Key, contentType);
      if (!publicUrl) {
        return res.status(500).json({
          success: false,
          error: "Failed to stream image to AWS S3. Please verify server AWS environment variables.",
        });
      }

      return res.json({
        success: true,
        url: publicUrl,
        key: s3Key,
        sizeBytes: buffer.length,
      });
    } catch (err: any) {
      console.error("[Backend S3] Server upload error:", err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // Authentication Security & Abuse Defense APIs
  // ==========================================

  // Check whether the client IP or email is currently locked or rate-limited
  app.post("/api/auth/check-security-status", async (req, res) => {
    try {
      const ip = getClientIp(req);
      const email = String(req.body?.email || "").toLowerCase().trim();
      const status = canAttemptLogin(email, ip);
      return res.json({
        success: true,
        allowed: status.allowed,
        reason: status.reason,
        remainingAttempts: status.remainingAttempts,
        isIpLocked: status.isIpLocked || isIpLocked(ip),
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Register a failed login attempt (invoked when client-side Firebase Auth or server verification fails)
  app.post("/api/auth/report-failed-login", async (req, res) => {
    try {
      const ip = getClientIp(req);
      const email = String(req.body?.email || "").toLowerCase().trim();
      const reason = String(req.body?.reason || "Incorrect password or credentials");
      const userAgent = String(req.headers["user-agent"] || "");

      const result = await registerFailedSecurityEvent(serverDb, {
        ip,
        email,
        type: "failed_password_login",
        userAgent,
        reason,
      });

      return res.json({
        success: true,
        isLocked: result.isLocked,
        strikeCount: result.strikeCount,
        message: result.message,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Reset failed login counter for this account after a verified successful login
  app.post("/api/auth/report-successful-login", async (req, res) => {
    try {
      const email = String(req.body?.email || "").toLowerCase().trim();
      if (email) {
        recordSuccessfulLogin(email);
      }
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // Resend Custom Domain Email Authentication APIs
  // ==========================================

  // Request 6-digit OTP code to email (Enforces 10 OTPs / 2 hr limit & IP lock)
  app.post("/api/auth/send-otp", async (req, res) => {
    try {
      const ip = getClientIp(req);
      if (isIpLocked(ip)) {
        return res.status(403).json({
          success: false,
          error: "Access denied: Your IP address has been locked due to exceeding 20 failed security verification attempts.",
        });
      }

      const { email, name } = req.body || {};
      if (!email || typeof email !== "string" || !email.includes("@")) {
        return res.status(400).json({ success: false, error: "Please provide a valid email address." });
      }

      const cleanEmail = email.toLowerCase().trim();

      // Enforce 10 OTPs in 2 hr limit
      const otpCheck = canRequestOtp(cleanEmail, ip);
      if (!otpCheck.allowed) {
        await registerFailedSecurityEvent(serverDb, {
          ip,
          email: cleanEmail,
          type: "otp_limit_exceeded",
          userAgent: String(req.headers["user-agent"] || ""),
          reason: otpCheck.reason,
        });
        return res.status(429).json({ success: false, error: otpCheck.reason });
      }

      const code = generateOtp(cleanEmail);
      const challengeToken = createSignedChallengeToken(cleanEmail, code, 30);
      await Promise.all([
        storeOtp(cleanEmail, code, 30),
        createAuthSession(cleanEmail),
      ]);

      const host = req.headers["x-forwarded-host"] || req.headers.host || "www.prople.co.in";
      const proto = (req.headers["x-forwarded-proto"] as string) || (String(host).includes("localhost") ? "http" : "https");
      const baseUrl = `${proto}://${host}`;
      const directVerifyUrl = `${baseUrl}/?auth=verify-email&email=${encodeURIComponent(cleanEmail)}&code=${code}`;

      const emailResult = await sendOtpEmail(cleanEmail, code, name, directVerifyUrl);
      if (!emailResult.success) {
        return res.status(500).json({
          success: false,
          error: emailResult.error || "Failed to deliver verification email via Resend. Please verify your Resend configuration.",
        });
      }

      // Record successful OTP dispatch
      recordOtpDispatched(cleanEmail, ip);

      return res.json({
        success: true,
        delivered: true,
        challengeToken,
        message: emailResult.message || `A verification code has been dispatched to ${cleanEmail}. Please check your inbox or spam folder.`,
      });
    } catch (err: any) {
      console.error("[Auth API] send-otp error:", err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  function hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
    return `${salt}:${hash}`;
  }

  function verifyPassword(password: string, stored: string): boolean {
    if (!stored || !stored.includes(":")) return false;
    const [salt, key] = stored.split(":");
    if (!salt || !key) return false;
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
    const keyBuf = Buffer.from(key, "utf8");
    const hashBuf = Buffer.from(hash, "utf8");
    if (keyBuf.length !== hashBuf.length) return false;
    return crypto.timingSafeEqual(keyBuf, hashBuf);
  }

  // Verify 6-digit OTP code with existing user lookup (Logs failed attempts & locks IP if > 20 strikes)
  app.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const ip = getClientIp(req);
      if (isIpLocked(ip)) {
        return res.status(403).json({
          success: false,
          error: "Access denied: Your IP address has been locked due to exceeding 20 failed security verification attempts.",
        });
      }

      const { email, code, challengeToken: bodyToken } = req.body || {};
      if (!email || !code) {
        return res.status(400).json({ success: false, error: "Email and verification code are required." });
      }

      const cleanEmail = email.toLowerCase().trim();
      const clientChallengeToken = bodyToken || req.headers["x-challenge-token"];
      const verification = await verifyStoredOtp(cleanEmail, String(code), true, typeof clientChallengeToken === "string" ? clientChallengeToken : undefined);

      if (!verification.valid) {
        // Register failed verification strike in database
        const strikeRes = await registerFailedSecurityEvent(serverDb, {
          ip,
          email: cleanEmail,
          type: "failed_otp_verify",
          userAgent: String(req.headers["user-agent"] || ""),
          reason: verification.error || "Incorrect OTP code",
        });

        if (strikeRes.isLocked) {
          return res.status(403).json({ success: false, error: strikeRes.message });
        }

        return res.status(400).json({ success: false, error: verification.error });
      }

      // Check if user already exists in Firestore by email
      let userUid = "usr_email_" + Buffer.from(cleanEmail).toString("base64url").slice(0, 24);
      let displayName = cleanEmail.split("@")[0];
      let userAttributes: any = {};

      if (serverDb) {
        try {
          const q = serverQuery(
            serverCollection(serverDb, "users"),
            serverWhere("email", "==", cleanEmail),
            serverLimit(1)
          );
          const snap = await serverGetDocs(q);
          if (!snap.empty) {
            const docSnap = snap.docs[0];
            userUid = docSnap.id;
            const data = docSnap.data();
            displayName = data.displayName || displayName;
            userAttributes = { ...data };
          }
        } catch (dbErr: any) {
          console.warn("[Auth API] Firestore user query warning:", dbErr.message);
        }
      }

      const verifiedUser = {
        uid: userUid,
        email: cleanEmail,
        displayName: displayName,
        isEmailVerified: true,
        ...userAttributes,
      };

      // Reset any failed login attempts on successful authentication
      recordSuccessfulLogin(cleanEmail);

      // Broadcast auth session completion for real-time cross-window login
      await completeAuthSession(cleanEmail, verifiedUser);

      return res.json({
        success: true,
        user: verifiedUser,
      });
    } catch (err: any) {
      console.warn("[Auth API] verify-otp notice:", err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Request password reset 6-digit code via Resend (Enforces 10 OTPs / 2 hr limit & IP lock)
  app.post(["/api/auth/forgot-password", "/api/auth/send-reset-link"], async (req, res) => {
    try {
      const ip = getClientIp(req);
      if (isIpLocked(ip)) {
        return res.status(403).json({
          success: false,
          error: "Access denied: Your IP address has been locked due to exceeding 20 failed security verification attempts.",
        });
      }

      const { email, name } = req.body || {};
      if (!email || typeof email !== "string" || !email.includes("@")) {
        return res.status(400).json({ success: false, error: "Please provide a valid email address." });
      }

      const cleanEmail = email.toLowerCase().trim();

      // Enforce 10 OTPs in 2 hr limit
      const otpCheck = canRequestOtp(cleanEmail, ip);
      if (!otpCheck.allowed) {
        await registerFailedSecurityEvent(serverDb, {
          ip,
          email: cleanEmail,
          type: "otp_limit_exceeded",
          userAgent: String(req.headers["user-agent"] || ""),
          reason: otpCheck.reason,
        });
        return res.status(429).json({ success: false, error: otpCheck.reason });
      }

      const code = generateOtp(cleanEmail);
      const challengeToken = createSignedChallengeToken(cleanEmail, code, 30);
      await Promise.all([
        storeOtp(cleanEmail, code, 30),
        createAuthSession(cleanEmail),
      ]);

      const host = req.headers["x-forwarded-host"] || req.headers.host || "www.prople.co.in";
      const proto = (req.headers["x-forwarded-proto"] as string) || (String(host).includes("localhost") ? "http" : "https");
      const baseUrl = `${proto}://${host}`;
      const directResetUrl = `${baseUrl}/?auth=reset-password&email=${encodeURIComponent(cleanEmail)}&code=${code}&token=${encodeURIComponent(challengeToken)}`;

      const emailResult = await sendPasswordResetEmailTemplate(cleanEmail, code, directResetUrl, name);
      if (!emailResult.success) {
        return res.status(500).json({
          success: false,
          error: emailResult.error || "Failed to deliver password reset email via Resend. Please verify your Resend configuration.",
        });
      }

      // Record successful OTP dispatch
      recordOtpDispatched(cleanEmail, ip);

      return res.json({
        success: true,
        delivered: true,
        challengeToken,
        message: emailResult.message || `A password reset code and link have been dispatched to ${cleanEmail}. Please check your inbox or spam folder.`,
      });
    } catch (err: any) {
      console.warn("[Auth API] forgot-password notice:", err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Verify reset code without consuming it yet (Step 1 of password reset)
  app.post("/api/auth/verify-reset-code", async (req, res) => {
    try {
      const ip = getClientIp(req);
      if (isIpLocked(ip)) {
        return res.status(403).json({
          success: false,
          error: "Access denied: Your IP address has been locked due to exceeding 20 failed security verification attempts.",
        });
      }

      const { email, code, challengeToken: bodyToken } = req.body || {};
      if (!email || !code) {
        return res.status(400).json({ success: false, error: "Email and verification code are required." });
      }

      const cleanEmail = String(email).toLowerCase().trim();
      const clientChallengeToken = bodyToken || req.headers["x-challenge-token"];
      const verification = await verifyStoredOtp(cleanEmail, String(code), false, typeof clientChallengeToken === "string" ? clientChallengeToken : undefined);

      if (!verification.valid) {
        const strikeRes = await registerFailedSecurityEvent(serverDb, {
          ip,
          email: cleanEmail,
          type: "failed_password_reset",
          userAgent: String(req.headers["user-agent"] || ""),
          reason: verification.error || "Invalid or expired reset code",
        });

        if (strikeRes.isLocked) {
          return res.status(403).json({ success: false, error: strikeRes.message });
        }

        return res.status(400).json({
          success: false,
          error: verification.error || "Incorrect verification code. Please check your email and enter the latest 6 digits.",
        });
      }

      return res.json({ success: true, challengeToken: clientChallengeToken });
    } catch (err: any) {
      console.warn("[Auth API] verify-reset-code notice:", err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Verify reset code and update password (Logs failures & locks IP if > 20 strikes)
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const ip = getClientIp(req);
      if (isIpLocked(ip)) {
        return res.status(403).json({
          success: false,
          error: "Access denied: Your IP address has been locked due to exceeding 20 failed security verification attempts.",
        });
      }

      const { email, code, newPassword, challengeToken: bodyToken } = req.body || {};
      if (!email || !code || !newPassword) {
        return res.status(400).json({ success: false, error: "Email, code, and new password are required." });
      }

      if (typeof newPassword !== 'string' || newPassword.length < 6) {
        return res.status(400).json({ success: false, error: "Password must be at least 6 characters long." });
      }

      const cleanEmail = email.toLowerCase().trim();
      const clientChallengeToken = bodyToken || req.headers["x-challenge-token"];
      let verification = await verifyStoredOtp(cleanEmail, String(code), true, typeof clientChallengeToken === "string" ? clientChallengeToken : undefined);

      // If code is not in OTP store, check if it is a Firebase oobCode from email action link
      if (!verification.valid && (String(code).length > 8 || !/^\d{6}$/.test(String(code).trim()))) {
        try {
          const fbConfig = getServerFirebaseConfig();
          const fbKey = !fbConfig.isExampleConfig ? fbConfig.apiKey : "";
          if (fbKey) {
            const fbRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=${fbKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ oobCode: String(code).trim(), newPassword }),
            });
            if (fbRes.ok) {
              verification = { valid: true };
            }
          }
        } catch (oobErr: any) {
          console.warn("[Auth API] oobCode verification notice:", oobErr?.message);
        }
      }

      if (!verification.valid) {
        const strikeRes = await registerFailedSecurityEvent(serverDb, {
          ip,
          email: cleanEmail,
          type: "failed_password_reset",
          userAgent: String(req.headers["user-agent"] || ""),
          reason: verification.error || "Invalid or expired reset code",
        });

        if (strikeRes.isLocked) {
          return res.status(403).json({ success: false, error: strikeRes.message });
        }

        return res.status(400).json({ success: false, error: verification.error || "Invalid or expired reset code." });
      }

      let userUid = "usr_email_" + Buffer.from(cleanEmail).toString("base64url").slice(0, 24);
      let displayName = cleanEmail.split("@")[0];
      let existingData: any = {};

      const pwdHash = hashPassword(newPassword);

      // Persist password hash in high-availability distributed store (RTDB + Memory)
      await persistUserPasswordHash(cleanEmail, pwdHash);

      // Attempt to provision or update user in Firebase Auth via Identity Toolkit
      try {
        const fbConfig = getServerFirebaseConfig();
        if (!fbConfig.isExampleConfig && fbConfig.apiKey) {
          await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${fbConfig.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: cleanEmail, password: newPassword, returnSecureToken: true }),
            signal: AbortSignal.timeout(4000),
          });
        }
      } catch (fbSyncErr: any) {
        console.warn("[Auth API] Firebase user provision notice:", fbSyncErr.message);
      }

      // Check if user document already exists in Firestore by email
      if (serverDb) {
        try {
          const q = serverQuery(
            serverCollection(serverDb, "users"),
            serverWhere("email", "==", cleanEmail),
            serverLimit(1)
          );
          const snap = await serverGetDocs(q);
          if (!snap.empty) {
            const docSnap = snap.docs[0];
            userUid = docSnap.id;
            existingData = docSnap.data();
            displayName = existingData.displayName || displayName;
          }
        } catch (dbErr: any) {
          console.warn("[Auth API] Firestore user query notice:", dbErr.message);
        }
      }

      const finalUser = {
        uid: userUid,
        email: cleanEmail,
        displayName,
        isEmailVerified: true,
        ...existingData,
      };

      // Reset failed login attempts on successful password reset
      recordSuccessfulLogin(cleanEmail);

      // Broadcast auth session completion so open Chrome tabs immediately auto-login!
      await completeAuthSession(cleanEmail, finalUser);

      return res.json({
        success: true,
        message: "Your password has been updated successfully.",
        user: finalUser,
      });
    } catch (err: any) {
      console.warn("[Auth API] reset-password notice:", err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Cross-window Auth Session Status API for instant sync between Chrome & Gmail
  app.get("/api/auth/session-status", async (req, res) => {
    try {
      const email = String(req.query.email || "").toLowerCase().trim();
      if (!email) {
        return res.status(400).json({ success: false, error: "Missing email parameter." });
      }
      const session = await getAuthSessionStatus(email);
      return res.json({ success: true, ...session });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Consume Auth Session after successful automatic synchronization
  app.post("/api/auth/consume-session", async (req, res) => {
    try {
      const email = String(req.body?.email || "").toLowerCase().trim();
      if (email) {
        await consumeAuthSession(email);
      }
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // External browser direct redirect — hardened against CWE-601 Open Redirect attacks
  app.get("/open-browser", (req, res) => {
    const rawTarget = String(req.query.target || "/").trim();
    const safeTarget = sanitizeRedirectTarget(rawTarget, "/");
    return res.redirect(302, safeTarget);
  });

  // Server-authoritative password verification fallback (Enforces 5 failed logins / 24hr & IP lock)
  app.post("/api/auth/verify-password", async (req, res) => {
    try {
      const ip = getClientIp(req);
      if (isIpLocked(ip)) {
        return res.status(403).json({
          success: false,
          error: "Access denied: Your IP address has been locked due to exceeding 20 failed security verification attempts.",
        });
      }

      const { email, password } = req.body || {};
      if (!email || !password) {
        return res.status(400).json({ success: false, error: "Email and password are required." });
      }

      const cleanEmail = String(email).toLowerCase().trim();

      // Enforce 5 failed logins per 24 hours
      const loginCheck = canAttemptLogin(cleanEmail, ip);
      if (!loginCheck.allowed) {
        return res.status(429).json({ success: false, error: loginCheck.reason });
      }

      // 1. Check persistent password hash in RTDB / memory store
      const storedHash = await getUserPasswordHash(cleanEmail);
      if (storedHash && verifyPassword(String(password), storedHash)) {
        // Successful login: reset failed login attempts
        recordSuccessfulLogin(cleanEmail);

        let userUid = "usr_email_" + Buffer.from(cleanEmail).toString("base64url").slice(0, 24);
        let displayName = cleanEmail.split("@")[0];
        let remoteData: any = {};

        if (serverDb) {
          try {
            const q = serverQuery(
              serverCollection(serverDb, "users"),
              serverWhere("email", "==", cleanEmail),
              serverLimit(1)
            );
            const snap = await serverGetDocs(q);
            if (!snap.empty) {
              const docSnap = snap.docs[0];
              userUid = docSnap.id;
              remoteData = docSnap.data();
              displayName = remoteData.displayName || displayName;
            }
          } catch (dbErr: any) {
            console.warn("[Auth API] verify-password lookup notice:", dbErr.message);
          }
        }

        return res.json({
          success: true,
          user: {
            uid: userUid,
            email: cleanEmail,
            displayName,
            photoURL: remoteData.photoURL || undefined,
            age: remoteData.age || "25",
            gender: remoteData.gender || "Prefer not to say",
            location: remoteData.location || "Global",
            bio: remoteData.bio || "",
            isEmailVerified: true,
            isPublisher: Boolean(remoteData.isPublisher),
            publisherName: remoteData.publisherName || displayName,
            publisherRole: remoteData.publisherRole || "Standard User",
            developerKeystore: remoteData.developerKeystore || undefined,
            publishedAppIds: remoteData.publishedAppIds || [],
          },
        });
      }

      // 2. Also check if valid via Identity Toolkit REST API
      try {
        const fbConfig = getServerFirebaseConfig();
        if (!fbConfig.isExampleConfig && fbConfig.apiKey) {
          const idtRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${fbConfig.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: cleanEmail, password: String(password), returnSecureToken: true }),
            signal: AbortSignal.timeout(4000),
          });
            if (idtRes.ok) {
              const idtData = await idtRes.json();
              if (idtData && idtData.localId) {
                // Successful login: reset failed login attempts and cache PBKDF2 hash for instant 2FA verification
                recordSuccessfulLogin(cleanEmail);
                try {
                  await persistUserPasswordHash(cleanEmail, hashPassword(String(password)));
                } catch {}

                return res.json({
                  success: true,
                  user: {
                    uid: idtData.localId,
                    email: cleanEmail,
                    displayName: idtData.displayName || cleanEmail.split("@")[0],
                    isEmailVerified: Boolean(idtData.emailVerified),
                  }
                });
              }
            }
          }
        } catch (idtErr: any) {
        console.warn("[Auth API] Identity Toolkit fallback notice:", idtErr.message);
      }

      // Register failed password attempt strike
      const strikeRes = await registerFailedSecurityEvent(serverDb, {
        ip,
        email: cleanEmail,
        type: "failed_password_login",
        userAgent: String(req.headers["user-agent"] || ""),
        reason: "Incorrect password verification",
      });

      if (strikeRes.isLocked) {
        return res.status(403).json({ success: false, error: strikeRes.message });
      }

      return res.status(401).json({
        success: false,
        error: "auth/invalid-credential",
      });
    } catch (err: any) {
      console.warn("[Auth API] verify-password notice:", err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });



  // Production-grade backend API: Fetch all apps
  app.get("/api/apps", async (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    try {
      if (!serverDb) {
        return res.status(503).json({ success: false, error: "Database service unavailable" });
      }
      const appsCol = serverCollection(serverDb, "apps");
      const snap = await serverGetDocs(appsCol);
      const apps: any[] = [];
      snap.forEach(d => {
        const data = d.data();
        const hasValidSource = Boolean(
          data.downloadUrl ||
          data.githubReleaseUrl ||
          data.githubRepo ||
          data.webUrl ||
          data.packageFormat
        );
        if (!hasValidSource && (data.name === 'App' || !data.versionName)) {
          return;
        }
        apps.push({ id: d.id, ...data });
      });
      return res.json({ success: true, count: apps.length, apps });
    } catch (err: any) {
      console.warn("[Backend] Error fetching apps:", err.message);
      return res.json({ success: true, count: 0, apps: [] });
    }
  });

  // Production-grade backend API: Fetch single app by ID, slug, or packageName
  app.get("/api/apps/:appId", async (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    try {
      const { appId } = req.params;
      if (!appId || typeof appId !== 'string') {
        return res.status(400).json({ success: false, error: "Invalid app ID" });
      }

      // 1. Try helper with caching and multi-field queries (ID, packageName, slug)
      const appData = await getAppForSeo(appId);
      if (appData) {
        return res.json({ success: true, app: appData });
      }

      // 2. Direct Firestore fallback check
      if (serverDb) {
        const appRef = serverDoc(serverDb, "apps", appId);
        const snap = await serverGetDoc(appRef);
        if (snap.exists()) {
          return res.json({ success: true, app: { id: snap.id, ...snap.data() } });
        }
      }

      return res.status(404).json({ success: false, error: "Application not found" });
    } catch (err: any) {
      console.error("[Backend] Error fetching app:", err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Download increment rate limiter to prevent bot inflation
  const downloadIncrementHistory = new Map<string, number>();

  // Production-grade backend API: Increment app download counter
  // Protected against phantom app creation and bot flooding
  app.post("/api/apps/:appId/download-count", async (req, res) => {
    try {
      const { appId } = req.params;
      if (!appId || typeof appId !== 'string') {
        return res.status(400).json({ success: false, error: "Invalid app ID" });
      }

      if (!serverDb) {
        return res.status(503).json({ success: false, error: "Database service unavailable" });
      }

      const appRef = serverDoc(serverDb, "apps", appId);
      const snap = await serverGetDoc(appRef).catch(() => null);

      if (!snap || !snap.exists()) {
        return res.status(404).json({ success: false, error: "Application not found in repository." });
      }

      const data = snap.data();
      const currentCount = typeof data.downloadsCount === 'number'
        ? data.downloadsCount
        : parseDownloadCount(data.downloads);

      // Rate limit increments per IP per app (1 increment per 5 minutes)
      const clientIp = getNormalizedClientIp(req);
      const downloadKey = `${clientIp}:${appId}`;
      const now = Date.now();
      const lastIncrement = downloadIncrementHistory.get(downloadKey) || 0;

      if (now - lastIncrement < 5 * 60 * 1000) {
        return res.json({
          success: true,
          appId,
          downloadsCount: currentCount,
          downloads: data.downloads || formatDownloadCount(currentCount),
          cached: true
        });
      }

      downloadIncrementHistory.set(downloadKey, now);
      if (downloadIncrementHistory.size > 5000) {
        for (const [k, ts] of downloadIncrementHistory.entries()) {
          if (now - ts > 10 * 60 * 1000) downloadIncrementHistory.delete(k);
        }
      }

      const newCount = currentCount + 1;
      const currentDownloads = formatDownloadCount(newCount);

      await serverSetDoc(appRef, {
        downloadsCount: newCount,
        downloads: currentDownloads,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      return res.json({
        success: true,
        appId,
        downloadsCount: newCount,
        downloads: currentDownloads
      });
    } catch (err: any) {
      console.error("[Backend] Error incrementing download count:", err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Production-grade backend API: Publish or update an application
  app.post("/api/apps/publish", async (req, res) => {
    try {
      const { app: appPayload, userId, userEmail, featureOnSpotlight, spotlightBadge, spotlightHeadline } = req.body;
      const clientIp = getNormalizedClientIp(req);

      // High-volume burst limiter: reject flooding attempts
      if (!checkIpBurstLimit(clientIp)) {
        return res.status(429).json({
          success: false,
          error: "High request frequency detected from this IP. Please wait a moment before sending more requests."
        });
      }

      // Publisher Authentication Policy:
      // While downloading apps is open without sign-up, publishing and releasing apps strictly requires
      // a registered and signed-in publisher account.
      if (!userId || userId === 'guest' || userId === 'developer' || !userEmail) {
        return res.status(401).json({
          success: false,
          error: "Publisher authentication required: You must sign up and sign in with a verified account before releasing or modifying applications."
        });
      }

      // 1. Validate payload schema
      const validation = validateAppPayload(appPayload);
      if (!validation.valid) {
        return res.status(400).json({ success: false, error: validation.error });
      }

      if (!serverDb) {
        return res.status(503).json({ success: false, error: "Service temporarily unavailable. Please try again." });
      }

      const appId = appPayload.id;
      const appRef = serverDoc(serverDb, "apps", appId);
      const existingSnap = await serverGetDoc(appRef).catch(() => null);
      const exists = existingSnap && existingSnap.exists();

      if (exists) {
        // App exists: This is an UPDATE action
        const existingData = existingSnap.data();

        // 2. Strict Ownership Verification: Require authenticated user ID and email
        if (!userId || userId === 'guest' || !userEmail) {
          return res.status(401).json({
            success: false,
            error: "Unauthorized: You must be signed in with a verified account to update applications."
          });
        }

        const normUserEmail = (userEmail || '').toLowerCase().trim();
        const devEmail = (existingData.developerEmail || '').toLowerCase().trim();
        const pubEmail = (existingData.publisherEmail || '').toLowerCase().trim();
        const ownerEmail = (existingData.ownerEmail || '').toLowerCase().trim();
        const devInfoEmail = (existingData.developerInfo?.email || '').toLowerCase().trim();

        const isMatchingEmail = normUserEmail && (
          devEmail === normUserEmail ||
          pubEmail === normUserEmail ||
          ownerEmail === normUserEmail ||
          devInfoEmail === normUserEmail
        );

        const isOwner = 
          (userId && (
            existingData.owner === userId ||
            existingData.developerId === userId ||
            existingData.creatorUid === userId
          )) ||
          isMatchingEmail ||
          (normUserEmail && isServerAdminEmail(normUserEmail));

        if (!isOwner) {
          return res.status(403).json({
            success: false,
            error: "Forbidden: You do not own this application and cannot publish updates to this repository."
          });
        }

        // 3. Update Quota Policy: Max 5 updates per 1 hour (dual-checked by Account AND IP)
        const updateCheckUser = checkUpdateRateLimit(`${userId}:${appId}`);
        const updateCheckIp = checkUpdateRateLimit(`${clientIp}:${appId}`);
        if (!updateCheckUser.allowed || !updateCheckIp.allowed) {
          const retryAfterMs = Math.max(updateCheckUser.retryAfterMs, updateCheckIp.retryAfterMs);
          const minutesLeft = Math.max(1, Math.ceil(retryAfterMs / 60000));
          return res.status(429).json({
            success: false,
            error: `Update frequency limit reached: Maximum 5 updates per 1 hour. Next update available in ${minutesLeft} minutes.`,
            retryAfterMs
          });
        }

        // Transfer ownership to authenticated user if email matches or if not set
        const finalOwner = (isMatchingEmail && userId) ? userId : (existingData.owner || userId || 'developer');
        const finalDevId = (isMatchingEmail && userId) ? userId : (existingData.developerId || userId || 'developer');
        const finalCreator = (isMatchingEmail && userId) ? userId : (existingData.creatorUid || userId || 'developer');

        // Merge and update cleanly, transferring/preserving ownership
        const cleanDoc = sanitizeObject({
          ...existingData,
          ...appPayload,
          id: appId,
          slug: slugifyAppName(appPayload.name || existingData.name || ''),
          owner: finalOwner,
          developerId: finalDevId,
          creatorUid: finalCreator,
          developerEmail: appPayload.developerEmail || userEmail || existingData.developerEmail || '',
          ownerEmail: userEmail || existingData.ownerEmail || '',
          createdAt: existingData.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          downloadsCount: existingData.downloadsCount !== undefined ? existingData.downloadsCount : (appPayload.downloadsCount || 0),
          downloads: existingData.downloads || appPayload.downloads || '0+'
        });

        await serverSetDoc(appRef, cleanDoc, { merge: true });
        recordUpdateRateLimit(`${userId}:${appId}`);
        recordUpdateRateLimit(`${clientIp}:${appId}`);
        serverAppsCatalogCache = [];
        seoAppsCache.delete(appId.toLowerCase());
        if (cleanDoc.slug) seoAppsCache.delete(cleanDoc.slug);

        // Index updated app in Meilisearch
        indexApp(cleanDoc).catch(() => {});

        // Update spotlight banner if requested or already exists
        if (featureOnSpotlight) {
          const bannerRef = serverDoc(serverDb, "banners", `banner-${appId}`);
          await serverSetDoc(bannerRef, {
            id: `banner-${appId}`,
            appId: appId,
            title: appPayload.name,
            appName: appPayload.name,
            tagline: spotlightHeadline || appPayload.tagline || `Discover ${appPayload.name} on the marketplace.`,
            headline: spotlightHeadline || appPayload.tagline || `Discover ${appPayload.name} on the marketplace.`,
            badge: spotlightBadge || 'Featured Release',
            titleBadge: spotlightBadge || 'Featured Release',
            badgeBg: 'bg-blue-600',
            iconUrl: appPayload.iconUrl,
            appIcon: appPayload.iconUrl,
            featureGraphicUrl: appPayload.featureGraphicUrl || appPayload.iconUrl,
            imageUrl: appPayload.featureGraphicUrl || appPayload.iconUrl,
            targetUrl: `/app/${appId}`,
            developer: appPayload.developer,
            appDeveloper: appPayload.developer,
            rating: appPayload.rating || 5.0,
            appRating: appPayload.rating || 5.0,
            active: true,
            isActive: true,
            displayOrder: 1,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } else {
          // Even if featureOnSpotlight flag wasn't toggled, sync existing banner if one exists
          try {
            const bannerRef = serverDoc(serverDb, "banners", `banner-${appId}`);
            const bSnap = await serverGetDoc(bannerRef);
            if (bSnap.exists()) {
              await serverSetDoc(bannerRef, {
                title: appPayload.name,
                appName: appPayload.name,
                iconUrl: appPayload.iconUrl,
                appIcon: appPayload.iconUrl,
                featureGraphicUrl: appPayload.featureGraphicUrl || appPayload.iconUrl,
                imageUrl: appPayload.featureGraphicUrl || appPayload.iconUrl,
                developer: appPayload.developer,
                appDeveloper: appPayload.developer,
                updatedAt: new Date().toISOString()
              }, { merge: true });
            }
          } catch {}
        }

        serverAppsCatalogCache = [];
        seoAppsCache.delete(appId.toLowerCase());
        seoAppsCache.delete(appId);
        if (cleanDoc.slug) seoAppsCache.delete(cleanDoc.slug.toLowerCase());
        if (existingData?.slug && existingData.slug !== cleanDoc.slug) {
          seoAppsCache.delete(existingData.slug.toLowerCase());
        }

        // Notify search engines of sitemap changes
        const host = req.get("host") || "prople-store.web.app";
        const protocol = req.protocol || "https";
        pingSearchEngines(`${protocol}://${host}/sitemap.xml`);

        return res.json({ success: true, isNew: false, app: cleanDoc });
      } else {
        // App does NOT exist: This is a NEW PUBLISH action
        // 4. Publishing Exhaustion Policy: Max 3 new apps per 15 minutes (dual-checked by Account AND IP)
        const publishCheckUser = checkPublishRateLimit(userId);
        const publishCheckIp = checkPublishRateLimit(clientIp);
        if (!publishCheckUser.allowed || !publishCheckIp.allowed) {
          const retryAfterMs = Math.max(publishCheckUser.retryAfterMs, publishCheckIp.retryAfterMs);
          const minutesLeft = Math.max(1, Math.ceil(retryAfterMs / 60000));
          return res.status(429).json({
            success: false,
            error: `Release exhaustion period active: Rate limited to 3 new apps per 15 minutes. Cooldown window expires in ${minutesLeft} minutes.`,
            retryAfterMs
          });
        }

        // Generate guaranteed collision-free unique slug efficiently without full DB scan
        const baseSlug = slugifyAppName(appPayload.name || '') || 'app';
        let uniqueSlug = baseSlug;
        try {
          const appsCol = serverCollection(serverDb, "apps");
          const existingSlugs = new Set<string>();

          // 1. Fast-path: Check existing in-memory catalog cache (0ms)
          if (Array.isArray(serverAppsCatalogCache) && serverAppsCatalogCache.length > 0) {
            for (const a of serverAppsCatalogCache) {
              if (a.slug) existingSlugs.add(a.slug.toLowerCase());
              else if (a.name) existingSlugs.add(slugifyAppName(a.name).toLowerCase());
            }
          } else {
            // 2. Query only this specific slug from Firestore (1-doc indexed query instead of all docs)
            const slugQuery = serverQuery(appsCol, serverWhere("slug", "==", uniqueSlug), serverLimit(1));
            const slugSnap = await serverGetDocs(slugQuery);
            if (!slugSnap.empty) {
              existingSlugs.add(uniqueSlug.toLowerCase());
            }
          }

          if (existingSlugs.has(uniqueSlug.toLowerCase())) {
            const plat = slugifyAppName(appPayload.platform || '');
            if (plat && !existingSlugs.has(`${baseSlug}-${plat}`.toLowerCase())) {
              uniqueSlug = `${baseSlug}-${plat}`;
            } else {
              let counter = 2;
              while (existingSlugs.has(`${baseSlug}-${counter}`.toLowerCase())) {
                counter++;
              }
              uniqueSlug = `${baseSlug}-${counter}`;
            }
          }
        } catch (slugErr) {
          console.warn("[Backend] Non-fatal slug resolution warning:", slugErr);
        }

        const nowIso = new Date().toISOString();
        const cleanDoc = sanitizeObject({
          ...appPayload,
          id: appId,
          slug: uniqueSlug,
          owner: userId || appPayload.owner || 'developer',
          developerId: userId || appPayload.developerId || 'developer',
          developerEmail: userEmail || appPayload.developerEmail || '',
          ownerEmail: userEmail || appPayload.ownerEmail || '',
          creatorUid: userId || appPayload.creatorUid || 'developer',
          keystoreFingerprint: appPayload.keystoreFingerprint || '',
          keystoreAlias: appPayload.keystoreAlias || '',
          isPublished: true,
          createdAt: nowIso,
          updatedAt: nowIso,
          downloadsCount: 0,
          downloads: '0+',
          ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 }
        });

        // Parallelize primary app persistence, spotlight banner write, and publisher profile link
        const publishTasks: Promise<any>[] = [
          serverSetDoc(appRef, cleanDoc, { merge: true })
        ];

        if (featureOnSpotlight) {
          const bannerRef = serverDoc(serverDb, "banners", `banner-${appId}`);
          publishTasks.push(
            serverSetDoc(bannerRef, {
              id: `banner-${appId}`,
              appId: appId,
              title: appPayload.name,
              tagline: spotlightHeadline || appPayload.tagline || `Experience ${appPayload.name} on your device.`,
              badge: spotlightBadge || 'Featured Release',
              badgeBg: 'bg-emerald-600',
              iconUrl: appPayload.iconUrl,
              featureGraphicUrl: appPayload.featureGraphicUrl || appPayload.iconUrl,
              targetUrl: `/app/${appId}`,
              developer: appPayload.developer,
              rating: appPayload.rating || 5.0,
              active: true,
              displayOrder: 1,
              createdAt: nowIso,
              updatedAt: nowIso
            }, { merge: true })
          );
        }

        if (userId && serverDb) {
          const userRef = serverDoc(serverDb, "users", userId);
          publishTasks.push(
            serverGetDoc(userRef).then(async (uSnap) => {
              const existingPubs = uSnap.exists() ? (uSnap.data().publishedAppIds || []) : [];
              if (!existingPubs.includes(appId)) {
                await serverSetDoc(userRef, {
                  publishedAppIds: [...existingPubs, appId],
                  isPublisher: true,
                  updatedAt: nowIso
                }, { merge: true });
              }
            }).catch(uErr => {
              console.warn("[Backend] Could not sync user publishedAppIds:", uErr);
            })
          );
        }

        await Promise.all(publishTasks);

        recordPublishRateLimit(userId);
        recordPublishRateLimit(clientIp);
        serverAppsCatalogCache = [];
        seoAppsCache.delete(appId.toLowerCase());
        seoAppsCache.delete(appId);
        if (cleanDoc.slug) seoAppsCache.delete(cleanDoc.slug.toLowerCase());

        // Asynchronously index in Meilisearch & notify search engines
        indexApp(cleanDoc).catch(() => {});
        const host = req.get("host") || "prople-store.web.app";
        const protocol = req.protocol || "https";
        pingSearchEngines(`${protocol}://${host}/sitemap.xml`);

        return res.json({ success: true, isNew: true, app: cleanDoc });
      }
    } catch (err: any) {
      console.error("[Backend] Error publishing app:", err.message);
      return res.status(500).json({ success: false, error: err.message || "Failed to publish application" });
    }
  });

  // Production-grade backend API: Update existing app
  app.put("/api/apps/:appId", async (req, res) => {
    try {
      const { appId } = req.params;
      const { updates, userId, userEmail } = req.body;

      if (!serverDb) {
        return res.status(503).json({ success: false, error: "Service temporarily unavailable. Please try again." });
      }

      if (!userId || userId === 'guest' || !userEmail) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized: You must be signed in with a verified account to update applications."
        });
      }

      const appRef = serverDoc(serverDb, "apps", appId);
      const snap = await serverGetDoc(appRef);
      if (!snap.exists()) {
        return res.status(404).json({ success: false, error: "Application not found" });
      }

      const existingData = snap.data();
      const normUserEmail = (userEmail || '').toLowerCase().trim();
      const devEmail = (existingData.developerEmail || '').toLowerCase().trim();
      const pubEmail = (existingData.publisherEmail || '').toLowerCase().trim();
      const ownerEmail = (existingData.ownerEmail || '').toLowerCase().trim();
      const devInfoEmail = (existingData.developerInfo?.email || '').toLowerCase().trim();

      const isMatchingEmail = normUserEmail && (
        devEmail === normUserEmail ||
        pubEmail === normUserEmail ||
        ownerEmail === normUserEmail ||
        devInfoEmail === normUserEmail
      );

      const isOwner = 
        (userId && (
          existingData.owner === userId ||
          existingData.developerId === userId ||
          existingData.creatorUid === userId
        )) ||
        isMatchingEmail ||
        (normUserEmail && isServerAdminEmail(normUserEmail));

      if (!isOwner) {
        return res.status(403).json({
          success: false,
          error: "Forbidden: You do not own this application."
        });
      }

      // Image security validation against image poisoning and disguised documents
      if (updates && typeof updates === 'object') {
        if (updates.iconUrl) {
          const v = validateImageSource(updates.iconUrl, 'iconUrl');
          if (!v.valid) return res.status(400).json({ success: false, error: v.error });
        }
        if (updates.featureGraphicUrl) {
          const v = validateImageSource(updates.featureGraphicUrl, 'featureGraphicUrl');
          if (!v.valid) return res.status(400).json({ success: false, error: v.error });
        }
        if (updates.detailsBannerUrl) {
          const v = validateImageSource(updates.detailsBannerUrl, 'detailsBannerUrl');
          if (!v.valid) return res.status(400).json({ success: false, error: v.error });
        }
        if (updates.heroBannerUrl) {
          const v = validateImageSource(updates.heroBannerUrl, 'heroBannerUrl');
          if (!v.valid) return res.status(400).json({ success: false, error: v.error });
        }
        if (Array.isArray(updates.screenshots)) {
          for (let i = 0; i < updates.screenshots.length; i++) {
            const v = validateImageSource(updates.screenshots[i], `screenshots[${i}]`);
            if (!v.valid) return res.status(400).json({ success: false, error: v.error });
          }
        }
      }

      const clientIp = getNormalizedClientIp(req);
      if (!checkIpBurstLimit(clientIp)) {
        return res.status(429).json({
          success: false,
          error: "High request frequency detected from this IP. Please wait a moment before sending more requests."
        });
      }

      const updateCheckUser = checkUpdateRateLimit(`${userId}:${appId}`);
      const updateCheckIp = checkUpdateRateLimit(`${clientIp}:${appId}`);
      if (!updateCheckUser.allowed || !updateCheckIp.allowed) {
        const retryAfterMs = Math.max(updateCheckUser.retryAfterMs, updateCheckIp.retryAfterMs);
        const minutesLeft = Math.max(1, Math.ceil(retryAfterMs / 60000));
        return res.status(429).json({
          success: false,
          error: `Update limit reached: Maximum 5 updates per 1 hour reached. Try again in ${minutesLeft} minutes.`,
          retryAfterMs
        });
      }

      const sanitizedUpdates = sanitizeObject({
        ...updates,
        ...(updates.name ? { slug: slugifyAppName(updates.name) } : {}),
        updatedAt: new Date().toISOString()
      });

      await serverSetDoc(appRef, sanitizedUpdates, { merge: true });
      recordUpdateRateLimit(`${userId}:${appId}`);
      recordUpdateRateLimit(`${clientIp}:${appId}`);
      serverAppsCatalogCache = [];
      seoAppsCache.delete(appId.toLowerCase());
      if (sanitizedUpdates.slug) seoAppsCache.delete(sanitizedUpdates.slug);

      // Index updated document in Meilisearch
      indexApp({ ...existingData, ...sanitizedUpdates }).catch(() => {});

      // Synchronize existing banner if one exists for this app or featureOnSpotlight is set
      try {
        const bannerRef = serverDoc(serverDb, "banners", `banner-${appId}`);
        const bannerSnap = await serverGetDoc(bannerRef);
        if (bannerSnap.exists() || updates.featureOnSpotlight) {
          const bannerUpdates: Record<string, any> = {
            updatedAt: new Date().toISOString()
          };
          if (sanitizedUpdates.name) {
            bannerUpdates.title = sanitizedUpdates.name;
            bannerUpdates.appName = sanitizedUpdates.name;
          }
          if (sanitizedUpdates.developer) {
            bannerUpdates.developer = sanitizedUpdates.developer;
            bannerUpdates.appDeveloper = sanitizedUpdates.developer;
          }
          if (sanitizedUpdates.iconUrl) {
            bannerUpdates.iconUrl = sanitizedUpdates.iconUrl;
            bannerUpdates.appIcon = sanitizedUpdates.iconUrl;
          }
          if (sanitizedUpdates.featureGraphicUrl) {
            bannerUpdates.featureGraphicUrl = sanitizedUpdates.featureGraphicUrl;
            bannerUpdates.imageUrl = sanitizedUpdates.featureGraphicUrl;
          }
          if (sanitizedUpdates.tagline) {
            bannerUpdates.tagline = sanitizedUpdates.tagline;
            bannerUpdates.headline = sanitizedUpdates.tagline;
          }
          if (sanitizedUpdates.category) {
            bannerUpdates.badge = sanitizedUpdates.category;
            bannerUpdates.titleBadge = sanitizedUpdates.category;
          }
          if (sanitizedUpdates.rating !== undefined) {
            bannerUpdates.rating = sanitizedUpdates.rating;
            bannerUpdates.appRating = sanitizedUpdates.rating;
          }
          if (sanitizedUpdates.downloads) {
            bannerUpdates.downloads = sanitizedUpdates.downloads;
            bannerUpdates.appDownloads = sanitizedUpdates.downloads;
          }
          if (updates.featureOnSpotlight !== undefined) {
            bannerUpdates.active = updates.featureOnSpotlight;
            bannerUpdates.isActive = updates.featureOnSpotlight;
          }

          await serverSetDoc(bannerRef, bannerUpdates, { merge: true });
        }
      } catch (bannerErr) {
        console.warn("[Backend] Error syncing banner on app update:", bannerErr);
      }

      return res.json({ success: true, app: { ...existingData, ...sanitizedUpdates } });
    } catch (err: any) {
      console.error("[Backend] Error updating app:", err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Production-grade backend API: Delete app
  app.delete("/api/apps/:appId", async (req, res) => {
    try {
      const { appId } = req.params;
      const userId = (req.body?.userId || req.query?.userId || req.headers['x-user-id'] || '').toString().trim();
      const userEmail = (req.body?.userEmail || req.query?.userEmail || req.headers['x-user-email'] || '').toString().trim();

      if (!serverDb) {
        return res.status(503).json({ success: false, error: "Service temporarily unavailable. Please try again." });
      }

      if ((!userId || userId === 'guest') && !userEmail) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized: You must be signed in with a verified account to delete applications."
        });
      }

      const appRef = serverDoc(serverDb, "apps", appId);
      const snap = await serverGetDoc(appRef);
      if (!snap.exists()) {
        return res.status(404).json({ success: false, error: "Application not found" });
      }

      const existingData = snap.data();
      const normUserEmail = (userEmail || '').toLowerCase().trim();
      const devEmail = (existingData.developerEmail || '').toLowerCase().trim();
      const pubEmail = (existingData.publisherEmail || '').toLowerCase().trim();
      const ownerEmail = (existingData.ownerEmail || '').toLowerCase().trim();
      const authorEmail = (existingData.authorEmail || '').toLowerCase().trim();
      const devInfoEmail = (existingData.developerInfo?.email || '').toLowerCase().trim();

      const isMatchingEmail = normUserEmail && (
        devEmail === normUserEmail ||
        pubEmail === normUserEmail ||
        ownerEmail === normUserEmail ||
        authorEmail === normUserEmail ||
        devInfoEmail === normUserEmail
      );

      const isOwner = 
        !existingData.owner ||
        existingData.owner === 'developer' ||
        existingData.owner === 'dev-publisher' ||
        existingData.owner === 'dev-user' ||
        (userId && (
          existingData.owner === userId ||
          existingData.developerId === userId ||
          existingData.publisherId === userId ||
          existingData.userId === userId ||
          existingData.creatorUid === userId
        )) ||
        isMatchingEmail ||
        (normUserEmail && isServerAdminEmail(normUserEmail));

      if (!isOwner) {
        return res.status(403).json({
          success: false,
          error: "Forbidden: You do not own this application and cannot delete it."
        });
      }

      await serverDeleteDoc(appRef);

      // Delete associated spotlight banner from Firestore if exists
      try {
        const bannerRef = serverDoc(serverDb, "banners", `banner-${appId}`);
        await serverDeleteDoc(bannerRef);
      } catch {}

      // Flush server-side in-memory catalog cache and SEO caches
      serverAppsCatalogCache = [];
      seoAppsCache.delete(appId.toLowerCase());
      seoAppsCache.delete(appId);
      if (existingData?.slug) {
        seoAppsCache.delete(existingData.slug.toLowerCase());
      }
      if (existingData?.name) {
        seoAppsCache.delete(slugifyAppName(existingData.name));
      }

      // Delete app from Meilisearch index
      deleteAppFromIndex(appId).catch(() => {});

      return res.json({ success: true, deletedAppId: appId });
    } catch (err: any) {
      console.error("[Backend] Error deleting app:", err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Dedicated endpoint: Migrate and claim app ownership across authentication methods
  app.post("/api/apps/migrate-ownership", async (req, res) => {
    try {
      const { userId, userEmail } = req.body;
      if (!userId || !userEmail || typeof userEmail !== 'string') {
        return res.status(400).json({ success: false, error: "Missing userId or userEmail" });
      }

      if (!serverDb) {
        return res.status(503).json({ success: false, error: "Service temporarily unavailable. Please try again." });
      }

      const cleanEmail = userEmail.toLowerCase().trim();
      const cleanUid = String(userId).trim();

      const appsCol = serverCollection(serverDb, "apps");
      const snap = await serverGetDocs(appsCol);
      const claimedAppIds: string[] = [];
      const updatedApps: any[] = [];

      for (const d of snap.docs) {
        const data = d.data();
        const devEmail = (data.developerEmail || '').toLowerCase().trim();
        const pubEmail = (data.publisherEmail || '').toLowerCase().trim();
        const ownerEmail = (data.ownerEmail || '').toLowerCase().trim();
        const devInfoEmail = (data.developerInfo?.email || '').toLowerCase().trim();

        // Strict exact email match: An app belongs to a publisher if and only if its email matches the user's email
        const matches = Boolean(
          cleanEmail && (
            (devEmail && devEmail === cleanEmail) ||
            (pubEmail && pubEmail === cleanEmail) ||
            (ownerEmail && ownerEmail === cleanEmail) ||
            (devInfoEmail && devInfoEmail === cleanEmail)
          )
        );

        if (matches) {
          claimedAppIds.push(d.id);
          const needsUpdate = (
            data.owner !== cleanUid ||
            data.developerId !== cleanUid ||
            data.creatorUid !== cleanUid ||
            !data.ownerEmail ||
            Boolean(req.body.publisherName && data.developer !== req.body.publisherName)
          );

          if (needsUpdate) {
            const appRef = serverDoc(serverDb, "apps", d.id);
            const finalPubName = req.body.publisherName?.trim() || data.developer;
            const updatedPayload: Record<string, any> = {
              owner: cleanUid,
              developerId: cleanUid,
              creatorUid: cleanUid,
              developerEmail: data.developerEmail || cleanEmail,
              ownerEmail: cleanEmail,
              updatedAt: new Date().toISOString()
            };
            if (finalPubName) {
              updatedPayload.developer = finalPubName;
              updatedPayload.publisherName = finalPubName;
              updatedPayload.publishedBy = finalPubName;
            }
            try {
              await serverSetDoc(appRef, updatedPayload, { merge: true });
              updatedApps.push({ id: d.id, ...data, ...updatedPayload });
            } catch (appErr: any) {
              console.warn("[MigrateOwnership] App write notice:", appErr.message);
            }
          }
        }
      }

      // Sync Firestore user profile document with claimed app IDs
      if (claimedAppIds.length > 0) {
        try {
          const userRef = serverDoc(serverDb, "users", cleanUid);
          const userSnap = await serverGetDoc(userRef);
          const existingPublished = (userSnap.exists() && userSnap.data()?.publishedAppIds) || [];
          const combined = Array.from(new Set([...existingPublished, ...claimedAppIds]));
          const userPayload: Record<string, any> = {
            publishedAppIds: combined,
            isPublisher: true,
            updatedAt: new Date().toISOString()
          };
          if (req.body.publisherName?.trim()) {
            userPayload.displayName = req.body.publisherName.trim();
            userPayload.publisherName = req.body.publisherName.trim();
          }
          await serverSetDoc(userRef, userPayload, { merge: true });
        } catch (uErr: any) {
          console.warn("[MigrateOwnership] Could not sync user profile:", uErr.message);
        }
      }

      console.log(`[MigrateOwnership] Successfully linked ${claimedAppIds.length} apps to user ${cleanUid} (${cleanEmail})`);
      return res.json({
        success: true,
        totalClaimed: claimedAppIds.length,
        updatedCount: updatedApps.length,
        appIds: claimedAppIds
      });
    } catch (err: any) {
      console.warn("[MigrateOwnership] Notice:", err.message);
      return res.json({
        success: true,
        totalClaimed: 0,
        updatedCount: 0,
        appIds: []
      });
    }
  });

  // Dedicated endpoint: Update publisher's editable display name across all their apps
  app.post("/api/publisher/update-name", async (req, res) => {
    try {
      const { userId, userEmail, publisherName, lastNameChangedAt, nameChangeSessionStartedAt } = req.body || {};
      if (!publisherName || typeof publisherName !== 'string' || !publisherName.trim()) {
        return res.status(400).json({ success: false, error: "Missing or invalid publisherName" });
      }

      const cleanName = publisherName.trim();
      const cleanEmail = (userEmail || '').toLowerCase().trim();
      const cleanUid = (userId || '').trim();

      if (!serverDb) {
        return res.status(503).json({ success: false, error: "Database service unavailable" });
      }

      // Update user doc in Firestore to guarantee persistent sync of publisherName & nameChange timestamps
      if (cleanUid) {
        try {
          const userRef = serverDoc(serverDb, "users", cleanUid);
          const updateData: Record<string, any> = {
            publisherName: cleanName,
            displayName: cleanName,
            updatedAt: new Date().toISOString()
          };
          if (lastNameChangedAt) updateData.lastNameChangedAt = lastNameChangedAt;
          if (nameChangeSessionStartedAt) updateData.nameChangeSessionStartedAt = nameChangeSessionStartedAt;
          await serverSetDoc(userRef, updateData, { merge: true });
        } catch (uErr: any) {
          console.warn("[PublisherProfile] User doc update notice:", uErr.message);
        }
      }

      const appsCol = serverCollection(serverDb, "apps");
      const snap = await serverGetDocs(appsCol);
      let updatedCount = 0;

      for (const d of snap.docs) {
        const data = d.data();
        const devEmail = (data.developerEmail || '').toLowerCase().trim();
        const pubEmail = (data.publisherEmail || '').toLowerCase().trim();
        const ownerEmail = (data.ownerEmail || '').toLowerCase().trim();
        const devInfoEmail = (data.developerInfo?.email || '').toLowerCase().trim();

        const isOwner = Boolean(
          (cleanUid && (data.owner === cleanUid || data.developerId === cleanUid || data.creatorUid === cleanUid)) ||
          (cleanEmail && (devEmail === cleanEmail || pubEmail === cleanEmail || ownerEmail === cleanEmail || devInfoEmail === cleanEmail))
        );

        if (isOwner) {
          const appRef = serverDoc(serverDb, "apps", d.id);
          const devInfo = data.developerInfo ? { ...data.developerInfo, publisherName: cleanName } : { publisherName: cleanName };
          await serverSetDoc(appRef, {
            developer: cleanName,
            publisherName: cleanName,
            publishedBy: cleanName,
            developerInfo: devInfo,
            updatedAt: new Date().toISOString()
          }, { merge: true });
          updatedCount++;
        }
      }

      console.log(`[PublisherProfile] Updated publisher name to "${cleanName}" across ${updatedCount} apps`);
      return res.json({ success: true, updatedCount, publisherName: cleanName });
    } catch (err: any) {
      console.error("[PublisherProfile] Error updating publisher name across apps:", err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Dedicated endpoint: Comprehensive bi-directional migration of user rights, keystore, bookmarks, publisher profile & admin role
  app.post("/api/auth/migrate-user-rights", async (req, res) => {
    try {
      const { userId, userEmail, displayName, photoURL } = req.body || {};
      if (!userId || !userEmail || typeof userEmail !== 'string') {
        return res.status(400).json({ success: false, error: "Missing userId or userEmail" });
      }

      if (!serverDb) {
        return res.status(503).json({ success: false, error: "Service temporarily unavailable. Please try again." });
      }

      const cleanEmail = userEmail.toLowerCase().trim();
      const cleanUid = String(userId).trim();
      let isAdmin = isServerAdminEmail(cleanEmail);
      try {
        const adminsCol = serverCollection(serverDb, "admins");
        const adminSnap = await serverGetDocs(adminsCol);
        for (const adDoc of adminSnap.docs) {
          const adData = adDoc.data();
          if (
            adDoc.id === cleanUid ||
            (adData.email && adData.email.toLowerCase().trim() === cleanEmail) ||
            (adData.userEmail && adData.userEmail.toLowerCase().trim() === cleanEmail)
          ) {
            isAdmin = true;
            break;
          }
        }
      } catch (e: any) {
        console.warn("[MigrateUserRights] Admin check notice:", e.message);
      }

      // 1. Find user profile documents via direct UID lookup and indexed email query (fast & non-blocking)
      const usersCol = serverCollection(serverDb, "users");
      const foundUserDocs: { id: string; data: () => any }[] = [];
      try {
        const directUserDoc = await serverGetDoc(serverDoc(serverDb, "users", cleanUid));
        if (directUserDoc && directUserDoc.exists()) {
          foundUserDocs.push(directUserDoc);
        }
      } catch (err: any) {
        console.warn("[MigrateUserRights] Direct user doc check notice:", err.message);
      }

      try {
        const qEmail = serverQuery(usersCol, serverWhere("email", "==", cleanEmail), serverLimit(5));
        const emailSnap = await serverGetDocs(qEmail);
        emailSnap.forEach(d => {
          if (!foundUserDocs.some(existing => existing.id === d.id)) {
            foundUserDocs.push(d);
          }
        });
      } catch (err: any) {
        console.warn("[MigrateUserRights] Email query check notice:", err.message);
      }

      let mergedPublisherName = (displayName || cleanEmail.split('@')[0]).trim();
      let mergedPublisherRole = isAdmin ? 'Store Administrator' : 'Standard User';
      let mergedIsPublisher = isAdmin;
      let mergedKeystore: any = null;
      let mergedBio = '';
      let mergedWebsite = '';
      let mergedGithub = '';
      let mergedLocation = 'Global';
      let mergedAge = '25';
      let mergedGender = 'Prefer not to say';
      let mergedBookmarks: string[] = [];
      let mergedPublishedAppIds: string[] = [];
      let mergedLastNameChangedAt: any = null;
      let mergedNameChangeSessionStartedAt: any = null;

      // Scan found docs for any existing profile with matching email or this UID
      for (const d of foundUserDocs) {
        const data = d.data();
        const dEmail = (data.email || '').toLowerCase().trim();
        const dPubEmail = (data.publisherEmail || '').toLowerCase().trim();
        const matches = (dEmail === cleanEmail || dPubEmail === cleanEmail || d.id === cleanUid);

        if (matches) {
          if (data.isAdmin || data.role === 'admin' || data.publisherRole === 'Store Administrator' || data.publisherRole === 'Super Admin') {
            isAdmin = true;
          }
          if (data.publisherName && data.publisherName.trim()) {
            mergedPublisherName = data.publisherName.trim();
          }
          if (data.publisherRole) {
            if (data.publisherRole === 'Store Administrator' || data.publisherRole === 'Super Admin') {
              mergedPublisherRole = 'Store Administrator';
            } else if (data.publisherRole === 'Verified Developer' && mergedPublisherRole !== 'Store Administrator') {
              mergedPublisherRole = 'Verified Developer';
            }
          }
          if (data.isPublisher) {
            mergedIsPublisher = true;
          }
          // Preserve cryptographic keystore if found in any previous doc
          if (data.developerKeystore && typeof data.developerKeystore === 'object' && !mergedKeystore) {
            mergedKeystore = data.developerKeystore;
          }
          if (data.publisherBio) mergedBio = data.publisherBio;
          if (data.publisherWebsite) mergedWebsite = data.publisherWebsite;
          if (data.publisherGithub) mergedGithub = data.publisherGithub;
          if (data.publisherLocation) mergedLocation = data.publisherLocation;
          if (data.location) mergedLocation = data.location;
          if (data.age) mergedAge = data.age;
          if (data.gender) mergedGender = data.gender;
          if (data.lastNameChangedAt) mergedLastNameChangedAt = data.lastNameChangedAt;
          if (data.nameChangeSessionStartedAt) mergedNameChangeSessionStartedAt = data.nameChangeSessionStartedAt;
          if (Array.isArray(data.bookmarks)) {
            mergedBookmarks = Array.from(new Set([...mergedBookmarks, ...data.bookmarks]));
          }
          if (Array.isArray(data.publishedAppIds)) {
            mergedPublishedAppIds = Array.from(new Set([...mergedPublishedAppIds, ...data.publishedAppIds]));
          }
        }
      }

      // If user is admin, enforce store administrator role and publisher status
      if (isAdmin) {
        mergedIsPublisher = true;
        mergedPublisherRole = 'Store Administrator';
      }

      // 2. Claim all apps belonging to this email and update ownership using cached catalog
      const allApps = await getAllAppsServer(1500);
      const claimedAppIds: string[] = [];

      for (const appData of allApps) {
        if (!appData || !appData.id) continue;
        const devEmail = (appData.developerEmail || '').toLowerCase().trim();
        const pubEmail = (appData.publisherEmail || '').toLowerCase().trim();
        const ownerEmail = (appData.ownerEmail || '').toLowerCase().trim();
        const devInfoEmail = (appData.developerInfo?.email || '').toLowerCase().trim();

        const matches = Boolean(
          cleanEmail && (
            (devEmail && devEmail === cleanEmail) ||
            (pubEmail && pubEmail === cleanEmail) ||
            (ownerEmail && ownerEmail === cleanEmail) ||
            (devInfoEmail && devInfoEmail === cleanEmail)
          )
        );

        if (matches) {
          claimedAppIds.push(appData.id);
          const needsUpdate = (
            appData.owner !== cleanUid ||
            appData.developerId !== cleanUid ||
            appData.creatorUid !== cleanUid ||
            !appData.ownerEmail
          );

          if (needsUpdate) {
            try {
              const appRef = serverDoc(serverDb, "apps", appData.id);
              const updatedPayload: Record<string, any> = {
                owner: cleanUid,
                developerId: cleanUid,
                creatorUid: cleanUid,
                developerEmail: appData.developerEmail || cleanEmail,
                ownerEmail: cleanEmail,
                updatedAt: new Date().toISOString()
              };
              if (mergedPublisherName && (!appData.developer || appData.developer === 'Developer')) {
                updatedPayload.developer = mergedPublisherName;
                updatedPayload.publisherName = mergedPublisherName;
              }
              await serverSetDoc(appRef, updatedPayload, { merge: true });
            } catch (appErr: any) {
              console.warn("[MigrateUserRights] App claim write notice:", appErr.message);
            }
          }
        }
      }

      // Combine app IDs and sanitize against cross-account pollution:
      // Only keep app IDs that strictly belong to this user (by matching developer/owner email or UID)
      const combinedAppIds = Array.from(new Set([...mergedPublishedAppIds, ...claimedAppIds]));
      const sanitizedPublishedAppIds = combinedAppIds.filter(appId => {
        const app = allApps.find(ad => ad.id === appId);
        if (!app) return false;
        const devE = (app.developerEmail || app.ownerEmail || app.publisherEmail || '').toLowerCase().trim();
        const ownerU = (app.owner || app.developerId || app.creatorUid || '').trim();
        if (devE && devE !== cleanEmail) return false;
        if (ownerU && ownerU !== cleanUid && !['developer', 'dev-publisher', 'guest', ''].includes(ownerU)) return false;
        return true;
      });

      if (sanitizedPublishedAppIds.length > 0) {
        mergedIsPublisher = true;
      }

      // 3. Write unified user document to users/{cleanUid}
      const targetUserRef = serverDoc(serverDb, "users", cleanUid);
      const finalUserPayload: Record<string, any> = {
        uid: cleanUid,
        email: cleanEmail,
        displayName: displayName || mergedPublisherName,
        publisherName: mergedPublisherName,
        publisherRole: mergedPublisherRole,
        isPublisher: mergedIsPublisher,
        isEmailVerified: true,
        publisherBio: mergedBio,
        publisherWebsite: mergedWebsite,
        publisherEmail: cleanEmail,
        publisherGithub: mergedGithub,
        publisherLocation: mergedLocation,
        location: mergedLocation,
        age: mergedAge,
        gender: mergedGender,
        publishedAppIds: sanitizedPublishedAppIds,
        lastNameChangedAt: mergedLastNameChangedAt || null,
        nameChangeSessionStartedAt: mergedNameChangeSessionStartedAt || null,
        updatedAt: new Date().toISOString()
      };
      if (photoURL) {
        finalUserPayload.photoURL = photoURL;
      }
      if (mergedKeystore) {
        finalUserPayload.developerKeystore = mergedKeystore;
      }
      if (mergedBookmarks.length > 0) {
        finalUserPayload.bookmarks = mergedBookmarks;
      }

      try {
        await serverSetDoc(targetUserRef, finalUserPayload, { merge: true });
      } catch (writeErr: any) {
        console.warn("[MigrateUserRights] User doc write notice:", writeErr.message);
      }

      // Synchronize all alternate documents matching this email so switching back and forth is 100% persistent
      for (const d of foundUserDocs) {
        if (d.id !== cleanUid) {
          const dEmail = (d.data().email || '').toLowerCase().trim();
          const dPubEmail = (d.data().publisherEmail || '').toLowerCase().trim();
          if (dEmail === cleanEmail || dPubEmail === cleanEmail) {
            try {
              const altRef = serverDoc(serverDb, "users", d.id);
              await serverSetDoc(altRef, {
                publisherName: mergedPublisherName,
                publisherRole: mergedPublisherRole,
                isPublisher: mergedIsPublisher,
                developerKeystore: mergedKeystore || null,
                publishedAppIds: sanitizedPublishedAppIds,
                updatedAt: new Date().toISOString()
              }, { merge: true });
            } catch (altErr: any) {
              console.warn("[MigrateUserRights] Alternate doc sync notice:", altErr.message);
            }
          }
        }
      }

      // 4. If admin, ensure admins/{cleanUid} exists
      if (isAdmin) {
        try {
          const adminRef = serverDoc(serverDb, "admins", cleanUid);
          await serverSetDoc(adminRef, {
            uid: cleanUid,
            email: cleanEmail,
            role: 'Store Administrator',
            grantedAt: new Date().toISOString()
          }, { merge: true });
        } catch (e: any) {
          console.warn("[MigrateUserRights] Admin doc notice:", e.message);
        }
      }

      console.log(`[MigrateUserRights] Successfully unified rights for ${cleanEmail} (${cleanUid}), isPublisher: ${mergedIsPublisher}, apps: ${sanitizedPublishedAppIds.length}, isAdmin: ${isAdmin}`);
      return res.json({
        success: true,
        user: finalUserPayload,
        totalAppsClaimed: claimedAppIds.length,
        isAdmin
      });
    } catch (err: any) {
      console.warn("[MigrateUserRights] Notice:", err.message);
      return res.json({
        success: true,
        user: req.body || {},
        totalAppsClaimed: 0,
        isAdmin: false
      });
    }
  });

  // Check publisher & developer name uniqueness across all accounts and published apps
  const handleCheckPublisherName = async (req: express.Request, res: express.Response) => {
    try {
      const rawName = (req.query.name || req.body?.name || "").toString().trim();
      const currentUserId = (req.query.currentUserId || req.body?.currentUserId || "").toString().trim();
      const currentUserEmail = (req.query.currentUserEmail || req.body?.currentUserEmail || "").toString().toLowerCase().trim();

      if (!rawName) {
        return res.json({ available: false, isTaken: false, message: "Publisher name cannot be empty." });
      }

      if (rawName.length < 2) {
        return res.json({ available: false, isTaken: false, message: "Publisher name must be at least 2 characters." });
      }

      if (rawName.length > 50) {
        return res.json({ available: false, isTaken: false, message: "Publisher name cannot exceed 50 characters." });
      }

      const cleanLower = rawName.toLowerCase();
      const cleanAlphaNumeric = cleanLower.replace(/[^a-z0-9]/g, '');

      // Prohibited generic or reserved system names
      const prohibitedNames = [
        'admin', 'administrator', 'system', 'root', 'google', 'google play',
        'googleplay', 'prople', 'prople store', 'proplestore', 'official',
        'support', 'null', 'undefined', 'anonymous', 'guest'
      ];
      if (prohibitedNames.includes(cleanLower) || prohibitedNames.includes(cleanAlphaNumeric)) {
        return res.json({
          available: false,
          isTaken: true,
          message: `"${rawName}" is a reserved name. Please choose another publisher name.`
        });
      }

      if (!serverDb) {
        return res.json({ available: true, isTaken: false, message: "This publisher name is available." });
      }

      // 1. Check indexed publisher_registry collection in database (O(1) direct document key lookup)
      const regDocRef = serverDoc(serverDb, "publisher_registry", cleanAlphaNumeric);
      try {
        const regSnap = await serverGetDoc(regDocRef);
        if (regSnap.exists()) {
          const reg = regSnap.data();
          const regOwnerUid = (reg.ownerUid || '').trim();
          const regOwnerEmail = (reg.ownerEmail || '').toLowerCase().trim();

          // If claimed by another user/developer, it is unavailable
          if ((currentUserId && regOwnerUid === currentUserId) || (currentUserEmail && regOwnerEmail === currentUserEmail)) {
            // Belongs to the current requesting user
          } else {
            return res.json({
              available: false,
              isTaken: true,
              message: `The publisher name "${rawName}" is already claimed in the developer registry.`
            });
          }
        }
      } catch (regErr: any) {
        console.warn("[CheckPublisherName] Registry index check notice:", regErr?.message);
      }

      // 2. Check active publishers in Firestore users collection
      // CRITICAL: ONLY check users where isPublisher === true and publisherName is assigned!
      // A regular user signing up with a personal displayName (e.g. Sahanur Molla) is NOT a publisher!
      const usersCol = serverCollection(serverDb, "users");
      const userSnap = await serverGetDocs(usersCol);

      for (const d of userSnap.docs) {
        const u = d.data();
        const uId = (u.uid || d.id || '').trim();
        const uEmail = (u.email || '').toLowerCase().trim();

        // Skip current user's own identity docs
        if ((currentUserId && uId === currentUserId) || (currentUserEmail && uEmail === currentUserEmail)) {
          continue;
        }

        // Only check publisherName of users whose publisher accounts are activated
        if (u.isPublisher) {
          const pubName = (u.publisherName || '').trim().toLowerCase();
          const pubAlpha = pubName.replace(/[^a-z0-9]/g, '');
          if (pubName === cleanLower || pubAlpha === cleanAlphaNumeric) {
            return res.json({
              available: false,
              isTaken: true,
              message: `The publisher name "${rawName}" is already taken by an active publisher.`
            });
          }
        }
      }

      // 3. Check all existing published apps in Firestore
      const appsCol = serverCollection(serverDb, "apps");
      const appSnap = await serverGetDocs(appsCol);

      for (const d of appSnap.docs) {
        const a = d.data();
        const appOwner = (a.owner || a.creatorUid || a.developerId || '').trim();
        const appOwnerEmail = (a.ownerEmail || a.developerEmail || a.publisherEmail || '').toLowerCase().trim();

        // Skip apps owned by current user
        if (
          (currentUserId && appOwner === currentUserId) ||
          (currentUserEmail && appOwnerEmail === currentUserEmail)
        ) {
          continue;
        }

        const dev = (a.developer || '').trim().toLowerCase();
        const pub = (a.publisherName || '').trim().toLowerCase();
        const pubBy = (a.publishedBy || '').trim().toLowerCase();
        const devAlpha = dev.replace(/[^a-z0-9]/g, '');

        if (
          dev === cleanLower ||
          pub === cleanLower ||
          pubBy === cleanLower ||
          devAlpha === cleanAlphaNumeric
        ) {
          return res.json({
            available: false,
            isTaken: true,
            message: `The publisher name "${rawName}" is already taken by an existing developer.`
          });
        }
      }

      return res.json({
        available: true,
        isTaken: false,
        message: "This publisher name is available."
      });
    } catch (err: any) {
      console.warn("[CheckPublisherName] Notice:", err.message);
      return res.json({ available: true, isTaken: false, message: "This publisher name is available." });
    }
  };

  const handleClaimPublisherName = async (req: any, res: any) => {
    try {
      const rawName = (req.body?.name || "").toString().trim();
      const currentUserId = (req.body?.userId || req.body?.currentUserId || "").toString().trim();
      const currentUserEmail = (req.body?.userEmail || req.body?.currentUserEmail || "").toString().toLowerCase().trim();

      if (!rawName || rawName.length < 2 || rawName.length > 50) {
        return res.status(400).json({ success: false, message: "Publisher name must be between 2 and 50 characters." });
      }

      const cleanLower = rawName.toLowerCase();
      const cleanAlphaNumeric = cleanLower.replace(/[^a-z0-9]/g, '');

      // Prohibited generic or reserved system names
      const prohibitedNames = [
        'admin', 'administrator', 'system', 'root', 'google', 'google play',
        'googleplay', 'prople', 'prople store', 'proplestore', 'official',
        'support', 'null', 'undefined', 'anonymous', 'guest'
      ];
      if (prohibitedNames.includes(cleanLower) || prohibitedNames.includes(cleanAlphaNumeric)) {
        return res.status(400).json({ success: false, message: `"${rawName}" is a reserved system name.` });
      }

      if (!serverDb) {
        return res.status(503).json({ success: false, message: "Database temporarily unavailable." });
      }

      // Check if already claimed by someone else
      const regDocRef = serverDoc(serverDb, "publisher_registry", cleanAlphaNumeric);
      const regSnap = await serverGetDoc(regDocRef);
      if (regSnap.exists()) {
        const reg = regSnap.data();
        const ownerUid = (reg.ownerUid || '').trim();
        const ownerEmail = (reg.ownerEmail || '').toLowerCase().trim();
        if ((currentUserId && ownerUid && ownerUid !== currentUserId) && (currentUserEmail && ownerEmail && ownerEmail !== currentUserEmail)) {
          return res.status(409).json({ success: false, message: `The publisher name "${rawName}" is already claimed by another developer.` });
        }
      }

      // Cooldown validation: 30 minutes grace window for back-to-back edits, followed by 15-day waiting period
      const GRACE_PERIOD_MS = 30 * 60 * 1000;
      const COOLDOWN_PERIOD_MS = 15 * 24 * 60 * 60 * 1000;
      const now = Date.now();

      let targetUserDoc: any = null;
      let userDocRef: any = null;
      if (currentUserId && serverDb) {
        try {
          userDocRef = serverDoc(serverDb, "users", currentUserId);
          const uSnap = await serverGetDoc(userDocRef);
          if (uSnap.exists()) {
            targetUserDoc = uSnap.data();
          }
        } catch (e: any) {
          console.warn("[ClaimPublisherName] User lookup warning:", e.message);
        }
      }

      if (targetUserDoc && targetUserDoc.publisherName && targetUserDoc.publisherName.trim().toLowerCase() !== cleanLower) {
        const sessionStartedAt = targetUserDoc.nameChangeSessionStartedAt ? new Date(targetUserDoc.nameChangeSessionStartedAt).getTime() : 0;
        const lastChangedAt = targetUserDoc.lastNameChangedAt ? new Date(targetUserDoc.lastNameChangedAt).getTime() : sessionStartedAt;

        if (sessionStartedAt) {
          const timeSinceSession = now - sessionStartedAt;
          const timeSinceLast = now - lastChangedAt;

          if (timeSinceSession > GRACE_PERIOD_MS && timeSinceLast < COOLDOWN_PERIOD_MS) {
            const remainingMs = COOLDOWN_PERIOD_MS - timeSinceLast;
            const remainingDays = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
            const remainingHours = Math.floor((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
            const remainingText = remainingDays > 0 ? `${remainingDays} day(s)` : `${remainingHours} hour(s)`;
            return res.status(429).json({
              success: false,
              message: `Name change locked: A 15-day waiting period is active. You can change your publisher name again in ${remainingText}.`
            });
          }
        }
      }

      let calculatedSessionStarted = now;
      if (targetUserDoc?.nameChangeSessionStartedAt) {
        const sTime = new Date(targetUserDoc.nameChangeSessionStartedAt).getTime();
        if (now - sTime < GRACE_PERIOD_MS) {
          calculatedSessionStarted = sTime;
        }
      }
      if (req.body?.nameChangeSessionStartedAt) {
        calculatedSessionStarted = Number(req.body.nameChangeSessionStartedAt);
      }
      const calculatedLastChanged = req.body?.lastNameChangedAt ? Number(req.body.lastNameChangedAt) : now;

      // Save to indexed publisher registry
      await serverSetDoc(regDocRef, {
        normalizedName: cleanAlphaNumeric,
        displayName: rawName,
        ownerUid: currentUserId || '',
        ownerEmail: currentUserEmail || '',
        claimedAt: new Date().toISOString(),
        isActive: true,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // Update user doc if currentUserId provided
      if (userDocRef) {
        try {
          await serverSetDoc(userDocRef, {
            isPublisher: true,
            publisherName: rawName,
            displayName: rawName,
            lastNameChangedAt: calculatedLastChanged,
            nameChangeSessionStartedAt: calculatedSessionStarted,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch (uErr: any) {
          console.warn("[ClaimPublisherName] User doc update notice:", uErr?.message);
        }
      }

      return res.json({ success: true, message: `Publisher name "${rawName}" successfully claimed.` });
    } catch (err: any) {
      console.warn("[ClaimPublisherName] Error:", err?.message);
      return res.status(500).json({ success: false, message: err?.message || "Failed to claim publisher name." });
    }
  };

  app.get("/api/publishers/check-name", handleCheckPublisherName);
  app.post("/api/publishers/check-name", handleCheckPublisherName);
  app.post("/api/publishers/claim-name", handleClaimPublisherName);

  // Admin: Get all App Reports and Review Reports
  app.get("/api/admin/reports", async (req, res) => {
    try {
      const userEmail = (req.query?.userEmail || req.headers['x-user-email'] || '').toString().trim();
      if (!userEmail || !isServerAdminEmail(userEmail)) {
        return res.status(403).json({ success: false, error: "Forbidden: Administrator authorization required." });
      }

      if (!serverDb) {
        return res.status(503).json({ success: false, error: "Service temporarily unavailable. Please try again." });
      }

      const appReportsSnap = await serverGetDocs(serverCollection(serverDb, "app_reports"));
      const appReports: any[] = [];
      appReportsSnap.forEach(d => appReports.push({ id: d.id, ...d.data() }));

      const reviewReportsSnap = await serverGetDocs(serverCollection(serverDb, "review_reports"));
      const reviewReports: any[] = [];
      reviewReportsSnap.forEach(d => reviewReports.push({ id: d.id, ...d.data() }));

      return res.json({
        success: true,
        appReports,
        reviewReports
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Admin: Update report status (dismiss or delete)
  app.post("/api/admin/report-status", async (req, res) => {
    try {
      const { userEmail, type, id, status } = req.body || {};
      if (!userEmail || !isServerAdminEmail(userEmail)) {
        return res.status(403).json({ success: false, error: "Forbidden: Administrator authorization required." });
      }
      if (!serverDb || !id || !type) {
        return res.status(400).json({ success: false, error: "Invalid request parameters" });
      }

      const collectionName = type === 'app' ? 'app_reports' : 'review_reports';
      const docRef = serverDoc(serverDb, collectionName, id);

      if (status === 'deleted') {
        await serverDeleteDoc(docRef);
      } else {
        await serverSetDoc(docRef, { status: status || 'dismissed', updatedAt: new Date().toISOString() }, { merge: true });
      }

      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Admin: Set App Private or Banned in app_moderation
  app.post("/api/admin/moderation", async (req, res) => {
    try {
      const { userEmail, appId, isPrivate, isBanned, reason } = req.body || {};
      if (!userEmail || !isServerAdminEmail(userEmail)) {
        return res.status(403).json({ success: false, error: "Forbidden: Administrator authorization required." });
      }
      if (!serverDb || !appId) {
        return res.status(400).json({ success: false, error: "Missing appId" });
      }

      const modRef = serverDoc(serverDb, "app_moderation", appId);
      const modPayload: Record<string, any> = {
        appId,
        moderatedAt: Date.now(),
        updatedAt: new Date().toISOString()
      };
      if (typeof isPrivate === 'boolean') modPayload.isPrivate = isPrivate;
      if (typeof isBanned === 'boolean') modPayload.isBanned = isBanned;
      if (reason) modPayload.reason = reason;

      await serverSetDoc(modRef, modPayload, { merge: true });

      // Update app_reports if private/banned
      if (isPrivate || isBanned) {
        try {
          const reportRef = serverDoc(serverDb, "app_reports", appId);
          const repSnap = await serverGetDoc(reportRef);
          if (repSnap.exists()) {
            await serverSetDoc(reportRef, { status: isBanned ? 'banned' : 'private' }, { merge: true });
          }
        } catch {}
      }

      return res.json({ success: true, moderation: modPayload });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Admin: Manage Banned Releases / Links
  app.post("/api/admin/banned-links", async (req, res) => {
    try {
      const { userEmail, action, linkData } = req.body || {};
      if (!userEmail || !isServerAdminEmail(userEmail)) {
        return res.status(403).json({ success: false, error: "Forbidden: Administrator authorization required." });
      }
      if (!serverDb || !linkData?.id) {
        return res.status(400).json({ success: false, error: "Missing linkData id" });
      }

      const banRef = serverDoc(serverDb, "banned_releases", linkData.id);
      if (action === 'remove') {
        await serverDeleteDoc(banRef);
      } else {
        await serverSetDoc(banRef, {
          id: linkData.id,
          urlOrRepo: linkData.urlOrRepo || '',
          type: linkData.type || 'release',
          targetIdentifier: linkData.targetIdentifier || '',
          appName: linkData.appName || '',
          bannedAt: linkData.bannedAt || Date.now(),
          reason: linkData.reason || 'Violated terms',
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Admin: Manage Publisher Restrictions
  app.post("/api/admin/publisher-restrictions", async (req, res) => {
    try {
      const { userEmail, pubKey, restriction } = req.body || {};
      if (!userEmail || !isServerAdminEmail(userEmail)) {
        return res.status(403).json({ success: false, error: "Forbidden: Administrator authorization required." });
      }
      if (!serverDb || !pubKey) {
        return res.status(400).json({ success: false, error: "Missing pubKey" });
      }

      const cleanKey = pubKey.trim().toLowerCase();
      const pubRef = serverDoc(serverDb, "publisher_restrictions", cleanKey);
      await serverSetDoc(pubRef, {
        publisherKey: cleanKey,
        publisherName: restriction?.publisherName || pubKey,
        publisherEmail: restriction?.publisherEmail,
        isBlocked: Boolean(restriction?.isBlocked),
        isRestricted: Boolean(restriction?.isRestricted),
        reason: restriction?.reason || '',
        updatedAt: Date.now()
      }, { merge: true });

      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Admin: Broadcast notifications (send or delete)
  app.post("/api/admin/broadcast", async (req, res) => {
    try {
      const { userEmail, action, notification, notificationId } = req.body || {};
      if (!userEmail || !isServerAdminEmail(userEmail)) {
        return res.status(403).json({ success: false, error: "Forbidden: Administrator authorization required." });
      }
      if (!serverDb) {
        return res.status(503).json({ success: false, error: "Service temporarily unavailable. Please try again." });
      }

      const targetId = notificationId || notification?.id;
      if (!targetId) {
        return res.status(400).json({ success: false, error: "Missing notification id" });
      }

      const notifRef = serverDoc(serverDb, "notifications", targetId);
      if (action === 'delete') {
        await serverDeleteDoc(notifRef);
      } else {
        await serverSetDoc(notifRef, {
          ...notification,
          id: targetId,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Admin: Delete review across any app
  app.post("/api/admin/delete-review", async (req, res) => {
    try {
      const { userEmail, appId, reviewId } = req.body || {};
      if (!userEmail || !isServerAdminEmail(userEmail)) {
        return res.status(403).json({ success: false, error: "Forbidden: Administrator authorization required." });
      }
      if (!serverDb || !appId || !reviewId) {
        return res.status(400).json({ success: false, error: "Missing appId or reviewId" });
      }

      const revRef = serverDoc(serverDb, `apps/${appId}/reviews/${reviewId}`);
      await serverDeleteDoc(revRef);

      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Helper to format package sizes
  function formatBytesHelper(bytes: number): string {
    if (!bytes || isNaN(bytes) || bytes <= 0) return 'Varies with device';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // Helper to identify non-runnable artifacts, developer packages, checksums, and bloat
  function isBloatAsset(name: string): boolean {
    if (!name || typeof name !== 'string') return true;
    const lower = name.toLowerCase().trim();

    // Checksums, signatures, certificates
    if (
      lower.endsWith('.sha256') ||
      lower.endsWith('.sha512') ||
      lower.endsWith('.sha1') ||
      lower.endsWith('.md5') ||
      lower.endsWith('.asc') ||
      lower.endsWith('.sig') ||
      lower.endsWith('.cert') ||
      lower.endsWith('.crt') ||
      lower.endsWith('.pem')
    ) {
      return true;
    }

    // Documents and metadata
    if (
      lower.endsWith('.txt') ||
      lower.endsWith('.md') ||
      lower.endsWith('.pdf') ||
      lower.endsWith('.pom') ||
      lower.endsWith('.json') ||
      lower.endsWith('.xml')
    ) {
      return true;
    }

    // AAR is an Android development library archive (Gradle dependency), NOT an end-user installable app
    if (lower.endsWith('.aar')) {
      return true;
    }

    // Source code archives
    if (
      lower.endsWith('-sources.jar') ||
      lower.endsWith('-javadoc.jar') ||
      lower.endsWith('-source.zip') ||
      lower.endsWith('-sources.zip') ||
      lower.endsWith('-src.zip') ||
      lower.endsWith('-src.tar.gz') ||
      lower.includes('source code') ||
      lower.includes('source-code') ||
      lower === 'source.zip' ||
      lower === 'source.tar.gz'
    ) {
      return true;
    }

    // Debug symbols, developer headers, and debug build packages
    if (
      lower.includes('-debug-symbols') ||
      lower.includes('-symbols.zip') ||
      lower.includes('-pdb.zip') ||
      lower.includes('-dbg.deb') ||
      lower.includes('-dbgsym') ||
      lower.includes('-devel.rpm') ||
      lower.includes('-dev.deb') ||
      lower.includes('-headers.tar') ||
      lower.includes('-unaligned.apk')
    ) {
      return true;
    }

    return false;
  }

  // Helper to detect binary package format and platform
  function detectPackageDetails(filename: string): { 
    isBinary: boolean; 
    isApk: boolean; 
    isWindows: boolean; 
    isLinux: boolean; 
    isMac?: boolean;
    isIos?: boolean;
    format: 'apk' | 'aar' | 'aab' | 'exe' | 'msi' | 'zip' | '7z' | 'rar' | 'msix' | 'appx' | 'deb' | 'AppImage' | 'rpm' | 'tar.gz' | 'tar.xz' | 'tar.zst' | 'snap' | 'flatpak' | 'bin' | 'dmg' | 'pkg' | 'jar' | 'ipa' | 'unknown'; 
    platform: 'android' | 'windows' | 'linux' | 'mac' | 'ios' | 'web';
  } {
    const rawName = (filename || '').split('/').pop()?.split('?')[0] || '';
    const lower = rawName.toLowerCase();

    // iOS packages (.ipa)
    if (lower.endsWith('.ipa')) {
      return { isBinary: true, isApk: false, isWindows: false, isLinux: false, isMac: false, isIos: true, format: 'ipa', platform: 'ios' };
    }

    // Android packages (.apk, .aab)
    // Note: .aar is an Android archive dev library, NOT an executable app!
    if (lower.endsWith('.apk')) {
      return { isBinary: true, isApk: true, isWindows: false, isLinux: false, format: 'apk', platform: 'android' };
    }
    if (lower.endsWith('.aar')) {
      return { isBinary: false, isApk: false, isWindows: false, isLinux: false, format: 'aar', platform: 'android' };
    }
    if (lower.endsWith('.aab')) {
      return { isBinary: true, isApk: true, isWindows: false, isLinux: false, format: 'aab', platform: 'android' };
    }

    // Windows packages (.exe, .msi, .msix, .appx, windows 7z/zip/rar)
    if (lower.endsWith('.exe')) {
      return { isBinary: true, isApk: false, isWindows: true, isLinux: false, format: 'exe', platform: 'windows' };
    }
    if (lower.endsWith('.msi')) {
      return { isBinary: true, isApk: false, isWindows: true, isLinux: false, format: 'msi', platform: 'windows' };
    }
    if (lower.endsWith('.msix') || lower.endsWith('.msixbundle') || lower.endsWith('.appx') || lower.endsWith('.appxbundle')) {
      return { isBinary: true, isApk: false, isWindows: true, isLinux: false, format: 'msix', platform: 'windows' };
    }
    const isWinKeyword = (
      lower.includes('windows') ||
      lower.includes('_win_') ||
      lower.includes('-win_') ||
      lower.includes('_win-') ||
      lower.includes('-win-') ||
      lower.includes('_win.') ||
      lower.includes('-win.') ||
      lower.includes('.win.') ||
      lower.includes('win_x64') ||
      lower.includes('win-x64') ||
      lower.includes('win_arm64') ||
      lower.includes('win-arm64') ||
      lower.includes('win32') ||
      lower.includes('win64') ||
      lower.includes('pc-windows')
    );

    if (lower.endsWith('.7z')) {
      if (lower.includes('linux') || lower.includes('ubuntu') || lower.includes('debian')) {
        return { isBinary: true, isApk: false, isWindows: false, isLinux: true, format: '7z', platform: 'linux' };
      }
      if (lower.includes('mac') || lower.includes('darwin') || lower.includes('osx')) {
        return { isBinary: true, isApk: false, isWindows: false, isLinux: false, isMac: true, format: '7z', platform: 'mac' };
      }
      // Default .7z (like Steam++_v3.1.0_win_x64.7z) to Windows
      return { isBinary: true, isApk: false, isWindows: true, isLinux: false, format: '7z', platform: 'windows' };
    }

    if (lower.endsWith('.rar')) {
      return { isBinary: true, isApk: false, isWindows: true, isLinux: false, format: 'rar', platform: 'windows' };
    }

    if (lower.endsWith('.zip') && (isWinKeyword || lower.includes('x64') || lower.includes('x86') || lower.includes('portable')) && !lower.includes('linux') && !lower.includes('mac') && !lower.includes('darwin')) {
      return { isBinary: true, isApk: false, isWindows: true, isLinux: false, format: 'zip', platform: 'windows' };
    }

    // macOS packages (.dmg, .pkg, .app.zip)
    if (lower.endsWith('.dmg')) {
      return { isBinary: true, isApk: false, isWindows: false, isLinux: false, isMac: true, format: 'dmg', platform: 'mac' };
    }
    if (lower.endsWith('.pkg') && !lower.endsWith('.pkg.tar.zst') && !lower.endsWith('.pkg.tar.xz')) {
      return { isBinary: true, isApk: false, isWindows: false, isLinux: false, isMac: true, format: 'pkg', platform: 'mac' };
    }
    if (lower.endsWith('.app.zip')) {
      return { isBinary: true, isApk: false, isWindows: false, isLinux: false, isMac: true, format: 'dmg', platform: 'mac' };
    }

    // Linux packages (.deb, .appimage, .rpm, tarball, snap, flatpak, standalone bin)
    if (lower.endsWith('.deb')) {
      return { isBinary: true, isApk: false, isWindows: false, isLinux: true, format: 'deb', platform: 'linux' };
    }
    if (lower.endsWith('.appimage')) {
      return { isBinary: true, isApk: false, isWindows: false, isLinux: true, format: 'AppImage', platform: 'linux' };
    }
    if (lower.endsWith('.rpm')) {
      return { isBinary: true, isApk: false, isWindows: false, isLinux: true, format: 'rpm', platform: 'linux' };
    }
    if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz') || lower.endsWith('.tar.bz2') || lower.endsWith('.tbz2')) {
      return { isBinary: true, isApk: false, isWindows: false, isLinux: true, format: 'tar.gz', platform: 'linux' };
    }
    if (lower.endsWith('.tar.xz') || lower.endsWith('.txz')) {
      return { isBinary: true, isApk: false, isWindows: false, isLinux: true, format: 'tar.xz', platform: 'linux' };
    }
    if (lower.endsWith('.tar.zst') || lower.endsWith('.tzst') || lower.endsWith('.pkg.tar.zst') || lower.endsWith('.pkg.tar.xz')) {
      return { isBinary: true, isApk: false, isWindows: false, isLinux: true, format: 'tar.zst', platform: 'linux' };
    }
    if (lower.endsWith('.snap')) {
      return { isBinary: true, isApk: false, isWindows: false, isLinux: true, format: 'snap', platform: 'linux' };
    }
    if (lower.endsWith('.flatpak') || lower.endsWith('.flatpakref')) {
      return { isBinary: true, isApk: false, isWindows: false, isLinux: true, format: 'flatpak', platform: 'linux' };
    }
    if (lower.endsWith('.run')) {
      return { isBinary: true, isApk: false, isWindows: false, isLinux: true, format: 'bin', platform: 'linux' };
    }
    // Architecture or standalone Linux binaries without extensions (e.g. TeleGhost-linux-amd64)
    if (
      (lower.includes('linux') || lower.includes('ubuntu') || lower.includes('debian') || lower.includes('fedora') || lower.includes('archlinux') || lower.includes('amd64') || lower.includes('x86_64') || lower.includes('arm64') || lower.includes('aarch64')) &&
      !lower.endsWith('.exe') && !lower.endsWith('.msi') && !lower.endsWith('.apk') && !lower.endsWith('.aar') && !lower.endsWith('.dmg') && !lower.endsWith('.pkg') && !lower.endsWith('.zip') && !lower.endsWith('.7z')
    ) {
      return { isBinary: true, isApk: false, isWindows: false, isLinux: true, format: 'bin', platform: 'linux' };
    }

    // Java package (.jar)
    if (lower.endsWith('.jar') && !lower.includes('source') && !lower.includes('javadoc')) {
      return { isBinary: true, isApk: false, isWindows: true, isLinux: false, format: 'jar', platform: 'windows' };
    }

    // macOS keyword match only if not linux, windows, or android
    if ((lower.includes('darwin') || lower.includes('macos') || lower.includes('osx') || lower.includes('apple')) && !lower.includes('linux') && !lower.endsWith('.deb') && !lower.endsWith('.rpm') && !lower.endsWith('.appimage')) {
      return { isBinary: true, isApk: false, isWindows: false, isLinux: false, isMac: true, format: 'dmg', platform: 'mac' };
    }

    // Generic zip default to windows portable only if not linux
    if (lower.endsWith('.zip') && !lower.includes('linux')) {
      return { isBinary: true, isApk: false, isWindows: true, isLinux: false, format: 'zip', platform: 'windows' };
    }

    // GitHub release direct download URL
    if (filename.includes('/releases/download/')) {
      if (isWinKeyword || lower.includes('win') || lower.includes('windows')) {
        return { isBinary: true, isApk: false, isWindows: true, isLinux: false, format: 'exe', platform: 'windows' };
      }
      return { isBinary: true, isApk: false, isWindows: false, isLinux: true, format: 'bin', platform: 'linux' };
    }

    return { isBinary: false, isApk: false, isWindows: false, isLinux: false, format: 'unknown', platform: 'web' };
  }

  // Selects the main package asset based on platform and rejects bloat packages
  function pickBestAssetForPlatform(assets: any[], requestedPlatform?: string): any {
    if (!Array.isArray(assets) || assets.length === 0) return null;

    // Filter out non-binary bloat items
    const nonBloat = assets.filter(a => {
      const name = a.name || a.browser_download_url || '';
      return !isBloatAsset(name);
    });
    const pool = nonBloat.length > 0 ? nonBloat : assets;

    const plat = (requestedPlatform || '').toLowerCase().trim();

    // Linux target: .AppImage -> .deb -> .rpm -> linux tarball -> linux standalone bin
    if (plat === 'linux') {
      const appImage = pool.find(a => (a.name || '').toLowerCase().endsWith('.appimage'));
      if (appImage) return appImage;

      const deb = pool.find(a => {
        const n = (a.name || '').toLowerCase();
        return n.endsWith('.deb') && !n.includes('-dev') && !n.includes('-dbg');
      });
      if (deb) return deb;

      const rpm = pool.find(a => {
        const n = (a.name || '').toLowerCase();
        return n.endsWith('.rpm') && !n.includes('-devel') && !n.includes('-src');
      });
      if (rpm) return rpm;

      const linuxTar = pool.find(a => {
        const n = (a.name || '').toLowerCase();
        return (n.endsWith('.tar.gz') || n.endsWith('.tgz') || n.endsWith('.tar.xz')) &&
               (n.includes('linux') || n.includes('amd64') || n.includes('x86_64'));
      });
      if (linuxTar) return linuxTar;

      const linuxBin = pool.find(a => {
        const n = (a.name || '').toLowerCase();
        return (n.includes('linux') || n.includes('amd64') || n.includes('x86_64')) &&
               !n.endsWith('.exe') && !n.endsWith('.apk') && !n.endsWith('.aar') && !n.endsWith('.msi');
      });
      if (linuxBin) return linuxBin;

      const genericTar = pool.find(a => (a.name || '').toLowerCase().endsWith('.tar.gz') || (a.name || '').toLowerCase().endsWith('.tgz'));
      if (genericTar) return genericTar;

      const fallbackLinux = pool.find(a => {
        const n = (a.name || '').toLowerCase();
        return (n.endsWith('.tar.gz') || n.endsWith('.tgz')) && (n.includes('linux') || n.includes('amd64') || n.includes('x86_64'));
      });
      if (fallbackLinux) return fallbackLinux;

      return null;
    }

    // Windows target: .exe (installer) -> any .exe -> .msi -> .msix -> windows zip
    if (plat === 'windows') {
      const setupExe = pool.find(a => {
        const n = (a.name || '').toLowerCase();
        return n.endsWith('.exe') && (n.includes('setup') || n.includes('installer') || n.includes('win64') || n.includes('x64'));
      });
      if (setupExe) return setupExe;

      const anyExe = pool.find(a => (a.name || '').toLowerCase().endsWith('.exe'));
      if (anyExe) return anyExe;

      const msi = pool.find(a => {
        const n = (a.name || '').toLowerCase();
        return n.endsWith('.msi') || n.endsWith('.msix') || n.endsWith('.msixbundle') || n.endsWith('.appx') || n.endsWith('.appxbundle');
      });
      if (msi) return msi;

      const winArchive = pool.find(a => {
        const n = (a.name || '').toLowerCase();
        const isArch = n.endsWith('.7z') || n.endsWith('.zip') || n.endsWith('.rar');
        const isWin = n.includes('win') || n.includes('windows') || n.includes('portable') || n.includes('x64') || n.includes('x86') || n.includes('amd64');
        return isArch && isWin && !n.includes('linux');
      });
      if (winArchive) return winArchive;

      return null;
    }

    // Android target: release APK -> universal APK -> any APK -> AAB (Never .aar)
    if (plat === 'android') {
      const releaseApk = pool.find(a => {
        const n = (a.name || '').toLowerCase();
        return n.endsWith('.apk') && (n.includes('release') || n.includes('universal') || n.includes('arm64') || !n.includes('debug'));
      });
      if (releaseApk) return releaseApk;

      const anyApk = pool.find(a => (a.name || '').toLowerCase().endsWith('.apk'));
      if (anyApk) return anyApk;

      const aab = pool.find(a => (a.name || '').toLowerCase().endsWith('.aab'));
      if (aab) return aab;

      return null;
    }

    // iOS target: .ipa package
    if (plat === 'ios' || plat === 'iphone' || plat === 'ipad') {
      const ipa = pool.find(a => (a.name || '').toLowerCase().endsWith('.ipa'));
      if (ipa) return ipa;
      return null;
    }

    // macOS target: Universal DMG -> any DMG -> PKG -> macOS ZIP -> macOS Tarball
    if (plat === 'mac' || plat === 'macos' || plat === 'darwin') {
      const universalDmg = pool.find(a => {
        const n = (a.name || '').toLowerCase();
        return n.endsWith('.dmg') && (n.includes('universal') || n.includes('arm64') || n.includes('apple') || !n.includes('x86'));
      });
      if (universalDmg) return universalDmg;

      const anyDmg = pool.find(a => (a.name || '').toLowerCase().endsWith('.dmg'));
      if (anyDmg) return anyDmg;

      const pkg = pool.find(a => (a.name || '').toLowerCase().endsWith('.pkg'));
      if (pkg) return pkg;

      return null;
    }

    // General / Auto-detect across all non-bloat assets
    const priorityChecks = [
      (a: any) => (a.name || '').toLowerCase().endsWith('.apk') && !(a.name || '').toLowerCase().includes('debug'),
      (a: any) => (a.name || '').toLowerCase().endsWith('.ipa'),
      (a: any) => (a.name || '').toLowerCase().endsWith('.appimage'),
      (a: any) => (a.name || '').toLowerCase().endsWith('.deb') && !(a.name || '').toLowerCase().includes('-dev'),
      (a: any) => (a.name || '').toLowerCase().endsWith('.rpm'),
      (a: any) => ((a.name || '').toLowerCase().endsWith('.tar.gz') || (a.name || '').toLowerCase().endsWith('.tgz') || (a.name || '').toLowerCase().endsWith('.tar.xz')) && (a.name || '').toLowerCase().includes('linux'),
      (a: any) => (a.name || '').toLowerCase().endsWith('.exe') && ((a.name || '').toLowerCase().includes('setup') || (a.name || '').toLowerCase().includes('installer')),
      (a: any) => (a.name || '').toLowerCase().endsWith('.dmg'),
      (a: any) => (a.name || '').toLowerCase().endsWith('.pkg'),
      (a: any) => (a.name || '').toLowerCase().endsWith('.exe'),
      (a: any) => (a.name || '').toLowerCase().endsWith('.msi') || (a.name || '').toLowerCase().endsWith('.msix'),
      (a: any) => (a.name || '').toLowerCase().endsWith('.apk'),
      (a: any) => (a.name || '').toLowerCase().endsWith('.zip') && !(a.name || '').toLowerCase().includes('source')
    ];

    for (const check of priorityChecks) {
      const match = pool.find(check);
      if (match) return match;
    }

    // ZERO FALLBACK: Only return first asset if it is a verified binary package
    const first = pool[0];
    if (first && detectPackageDetails(first.name || first.browser_download_url || '').isBinary) {
      return first;
    }
    return null;
  }

  // Deep GitHub Release & App Package Binary Resolver (Android APK, Windows EXE/MSI/ZIP, Linux DEB/AppImage/RPM/Tarball)
  async function resolveGitHubApkUrl(inputUrl: string, requestedPlatform?: string): Promise<{
    resolvedUrl: string;
    assetName: string;
    isApk: boolean;
    isWindows?: boolean;
    isLinux?: boolean;
    isBinary?: boolean;
    platform?: 'android' | 'windows' | 'linux' | 'mac' | 'ios' | 'web';
    format?: 'apk' | 'aar' | 'aab' | 'exe' | 'msi' | 'zip' | '7z' | 'rar' | 'msix' | 'appx' | 'deb' | 'AppImage' | 'rpm' | 'tar.gz' | 'tar.xz' | 'tar.zst' | 'snap' | 'flatpak' | 'bin' | 'dmg' | 'pkg' | 'jar' | 'ipa' | 'unknown';
    tagName?: string;
    repoOwner?: string;
    repoName?: string;
    size?: number;
    sizeFormatted?: string;
    changelog?: string;
    publishedAt?: string;
    allAssets?: Array<{ name: string; downloadUrl: string; size: number }>;
  }> {
    let targetUrl = (inputUrl || '').trim();
    const plat = (requestedPlatform || '').toLowerCase().trim();
    const fallbackExt = plat === 'linux' ? 'AppImage' : plat === 'windows' ? 'exe' : 'apk';

    if (!targetUrl) {
      return { resolvedUrl: '', assetName: '', isApk: plat === 'android', isBinary: false, platform: (plat as any) || 'android' };
    }

    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }

    const cleanPath = targetUrl.split('?')[0];
    const directPackage = detectPackageDetails(cleanPath);

    // Case 1: Already a direct binary package link (ends in .apk, .exe, .msi, .msix, .zip, .deb, .AppImage, .rpm, .tar.gz)
    // NOTE: If the URL is a GitHub repo root or webpage (e.g. github.com/user/linux), it must NOT be treated as a direct binary just because the repo name contains 'linux'
    const isGitHubWebpage = targetUrl.includes('github.com') && !cleanPath.includes('/releases/download/') && !cleanPath.includes('/raw/');
    if (directPackage.isBinary && !isGitHubWebpage) {
      const parts = cleanPath.replace(/^https?:\/\/github\.com\//i, '').split('/');
      let owner: string | undefined;
      let repo: string | undefined;
      let tag: string | undefined;
      
      if (parts.length >= 6 && parts[2] === 'releases' && parts[3] === 'download') {
        owner = parts[0];
        repo = parts[1];
        tag = parts[4];
      }

      const fileName = decodeURIComponent(cleanPath.split('/').pop() || '');
      return {
        resolvedUrl: targetUrl,
        assetName: fileName,
        isApk: directPackage.isApk,
        isWindows: directPackage.isWindows,
        isLinux: directPackage.isLinux,
        isBinary: true,
        platform: directPackage.platform,
        format: directPackage.format,
        tagName: tag,
        repoOwner: owner,
        repoName: repo
      };
    }

    // Case 2: GitHub URL that points to release, tag, latest, or repo
    if (targetUrl.includes('github.com')) {
      const clean = targetUrl.replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '');
      const parts = clean.split('/');
      const owner = parts[0];
      const repo = parts[1];

      if (!owner || !repo) {
        return { resolvedUrl: '', assetName: '', isApk: plat === 'android', isBinary: false };
      }

      let tag: string | undefined;
      if (clean.includes('/releases/tag/')) {
        tag = clean.split('/releases/tag/')[1]?.split('/')[0]?.split('?')[0];
      } else if (clean.includes('/releases/download/')) {
        const afterDownload = clean.split('/releases/download/')[1]?.split('/');
        tag = afterDownload[0];
        const file = afterDownload[1] ? decodeURIComponent(afterDownload[1].split('?')[0]) : '';
        if (file) {
          const filePkg = detectPackageDetails(file);
          if (filePkg.isBinary) {
            return {
              resolvedUrl: targetUrl,
              assetName: file,
              isApk: filePkg.isApk,
              isWindows: filePkg.isWindows,
              isLinux: filePkg.isLinux,
              isBinary: true,
              platform: filePkg.platform,
              format: filePkg.format,
              tagName: tag,
              repoOwner: owner,
              repoName: repo
            };
          }
        }
      }

      const ghHeaders: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PropleStore/1.0'
      };
      if (process.env.GITHUB_TOKEN) {
        ghHeaders['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
      }

      // Step 0: Direct REST API query (fastest and most accurate for exact asset metadata)
      try {
        const apiUrl = tag 
          ? `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`
          : `https://api.github.com/repos/${owner}/${repo}/releases/latest`;

        const apiRes = await fetch(apiUrl, { headers: ghHeaders, signal: AbortSignal.timeout(3500) });
        if (apiRes.ok) {
          const data = await apiRes.json();
          const releaseTag = data.tag_name || tag || 'v1.0.0';
          const rawAssets: any[] = Array.isArray(data.assets) ? data.assets : [];
          
          const allAssets = rawAssets.map(a => ({
            name: a.name || '',
            downloadUrl: a.browser_download_url || '',
            size: a.size || 0
          })).filter(a => Boolean(a.name && a.downloadUrl));

          const binaryAsset = pickBestAssetForPlatform(rawAssets, plat);

          if (binaryAsset && binaryAsset.browser_download_url) {
            const pkg = detectPackageDetails(binaryAsset.name);
            return {
              resolvedUrl: binaryAsset.browser_download_url,
              assetName: binaryAsset.name,
              isApk: pkg.isApk,
              isWindows: pkg.isWindows,
              isLinux: pkg.isLinux,
              isBinary: true,
              platform: pkg.platform,
              format: pkg.format,
              tagName: releaseTag,
              repoOwner: owner,
              repoName: repo,
              size: binaryAsset.size || 0,
              sizeFormatted: formatBytesHelper(binaryAsset.size || 0),
              changelog: data.body || '',
              publishedAt: data.published_at,
              allAssets
            };
          }
        }
      } catch (apiErr) {
        console.warn('[Backend] GitHub API release check error:', apiErr);
      }

      // Step 1: Fallback to releases list if no tag or latest didn't match
      if (!tag) {
        try {
          const listRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=5`, {
            headers: ghHeaders,
            signal: AbortSignal.timeout(3500)
          });
          if (listRes.ok) {
            const releases = await listRes.json();
            if (Array.isArray(releases) && releases.length > 0) {
              for (const rel of releases) {
                const assets: any[] = Array.isArray(rel.assets) ? rel.assets : [];
                const binaryAsset = pickBestAssetForPlatform(assets, plat);

                if (binaryAsset && binaryAsset.browser_download_url) {
                  const pkg = detectPackageDetails(binaryAsset.name);
                  return {
                    resolvedUrl: binaryAsset.browser_download_url,
                    assetName: binaryAsset.name,
                    isApk: pkg.isApk,
                    isWindows: pkg.isWindows,
                    isLinux: pkg.isLinux,
                    isBinary: true,
                    platform: pkg.platform,
                    format: pkg.format,
                    tagName: rel.tag_name || 'release',
                    repoOwner: owner,
                    repoName: repo,
                    size: binaryAsset.size || 0,
                    sizeFormatted: formatBytesHelper(binaryAsset.size || 0),
                    changelog: rel.body || '',
                    publishedAt: rel.published_at
                  };
                }
              }
              if (releases[0]?.tag_name) {
                tag = releases[0].tag_name;
              }
            }
          }
        } catch (listErr) {
          console.warn('[Backend] Fast releases list fetch error:', listErr);
        }
      }

      // Step 2: Discover tag via latest redirect if still undefined
      if (!tag) {
        try {
          const latestRes = await fetch(`https://github.com/${owner}/${repo}/releases/latest`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PropleStore/1.0' },
            redirect: 'follow',
            signal: AbortSignal.timeout(3000)
          });
          const tagMatch = latestRes.url.match(/\/releases\/tag\/([^/?#]+)/);
          if (tagMatch) {
            tag = tagMatch[1];
          }
        } catch (e) {
          console.warn('[Backend] Could not follow latest release redirect:', e);
        }
      }

      // Step 3: Check expanded_assets as final fallback when API is rate-limited
      if (tag) {
        try {
          const expRes = await fetch(`https://github.com/${owner}/${repo}/releases/expanded_assets/${tag}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PropleStore/1.0' },
            signal: AbortSignal.timeout(3000)
          });
          if (expRes.ok) {
            const html = await expRes.text();
            const binaryMatches = [...html.matchAll(/href=[\"'](\/[^\/]+\/[^\/]+\/releases\/download\/[^\"']+\.(apk|aab|exe|msi|msix|zip|7z|rar|deb|appimage|rpm|tar\.gz|tgz|tar\.xz|dmg|pkg))[\"']/gi)].map(m => m[1]);
            if (binaryMatches.length > 0) {
              const assetsList = binaryMatches.map(link => {
                const name = decodeURIComponent(link.split('/').pop() || '');
                return {
                  name,
                  browser_download_url: 'https://github.com' + link
                };
              });
              const chosen = pickBestAssetForPlatform(assetsList, plat);
              if (chosen) {
                const pkg = detectPackageDetails(chosen.name);
                return {
                  resolvedUrl: chosen.browser_download_url,
                  assetName: chosen.name,
                  isApk: pkg.isApk,
                  isWindows: pkg.isWindows,
                  isLinux: pkg.isLinux,
                  isBinary: true,
                  platform: pkg.platform,
                  format: pkg.format,
                  tagName: tag,
                  repoOwner: owner,
                  repoName: repo
                };
              }
            }
          }
        } catch (e) {
          console.warn('[Backend] expanded_assets fetch error:', e);
        }
      }

      return {
        resolvedUrl: '',
        assetName: '',
        isApk: plat === 'android',
        isBinary: false,
        tagName: tag,
        repoOwner: owner,
        repoName: repo,
        platform: (plat as any) || 'android'
      };
    }

    return {
      resolvedUrl: directPackage.isBinary ? targetUrl : '',
      assetName: directPackage.isBinary ? decodeURIComponent(cleanPath.split('/').pop() || '') : '',
      isApk: directPackage.isApk,
      isWindows: directPackage.isWindows,
      isLinux: directPackage.isLinux,
      isBinary: directPackage.isBinary,
      platform: directPackage.platform,
      format: directPackage.format
    };
  }

  // API route for resolving GitHub URLs to direct binary download links (platform-aware)
  app.get("/api/resolve-apk", async (req, res) => {
    try {
      const url = req.query.url as string;
      const platform = (req.query.platform as string || '').trim().toLowerCase();
      if (!url) {
        return res.status(400).json({ success: false, error: "Missing URL query parameter" });
      }

      const result = await resolveGitHubApkUrl(url, platform);
      return res.json({
        success: true,
        ...result
      });
    } catch (err: any) {
      console.error("[Backend] Error resolving APK link:", err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // API route for fetching comprehensive GitHub release metadata for the publishing console
  app.get("/api/github-release-meta", async (req, res) => {
    try {
      const rawUrl = (req.query.url as string) || '';
      let owner = (req.query.owner as string) || '';
      let repo = (req.query.repo as string) || '';
      let tag = (req.query.tag as string) || '';
      const platform = (req.query.platform as string || '').trim().toLowerCase();

      if (rawUrl) {
        const clean = rawUrl.replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '');
        const parts = clean.split('/');
        if (parts.length >= 2) {
          owner = owner || parts[0];
          repo = repo || parts[1];
        }
        if (clean.includes('/releases/tag/')) {
          tag = tag || clean.split('/releases/tag/')[1]?.split('/')[0]?.split('?')[0];
        } else if (clean.includes('/releases/download/')) {
          tag = tag || clean.split('/releases/download/')[1]?.split('/')[0];
        }
      }

      if (!owner || !repo) {
        return res.status(400).json({ success: false, error: "Missing repository owner and name" });
      }

      const resolution = await resolveGitHubApkUrl(rawUrl || `https://github.com/${owner}/${repo}${tag ? `/releases/tag/${tag}` : ''}`, platform);

      const ghHeaders: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PropleStore/1.0'
      };
      if (process.env.GITHUB_TOKEN) {
        ghHeaders['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
      }

      const apiUrl = tag
        ? `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`
        : `https://api.github.com/repos/${owner}/${repo}/releases/latest`;

      let releaseData: any = null;
      try {
        const apiRes = await fetch(apiUrl, { headers: ghHeaders });
        if (apiRes.ok) {
          releaseData = await apiRes.json();
        } else {
          // Fallback to releases list
          const listRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=1`, { headers: ghHeaders });
          if (listRes.ok) {
            const list = await listRes.json();
            if (Array.isArray(list) && list.length > 0) {
              releaseData = list[0];
            }
          }
        }
      } catch (err) {
        console.warn('[Backend] Direct GitHub API fetch error in release-meta:', err);
      }

      const finalTag = releaseData?.tag_name || resolution.tagName || tag || 'v1.0.0';
      const rawAssets = Array.isArray(releaseData?.assets) ? releaseData.assets : [];
      
      // Find package assets
      const urlAssetName = (rawUrl || '').split('/').pop()?.split('?')[0]?.toLowerCase();
      const exactUrlAsset = urlAssetName ? rawAssets.find((a: any) => (a.name || '').toLowerCase() === urlAssetName) : null;

      const apkAsset = rawAssets.find((a: any) => (a.name || '').toLowerCase().endsWith('.apk'));
      const aabAsset = rawAssets.find((a: any) => (a.name || '').toLowerCase().endsWith('.aab'));
      const debAsset = rawAssets.find((a: any) => (a.name || '').toLowerCase().endsWith('.deb') && !(a.name || '').toLowerCase().includes('-dev'));
      const appImageAsset = rawAssets.find((a: any) => (a.name || '').toLowerCase().endsWith('.appimage'));
      const rpmAsset = rawAssets.find((a: any) => (a.name || '').toLowerCase().endsWith('.rpm') && !(a.name || '').toLowerCase().includes('-devel'));
      const tarAsset = rawAssets.find((a: any) => (a.name || '').toLowerCase().endsWith('.tar.gz') || (a.name || '').toLowerCase().endsWith('.tgz'));
      const exeAsset = rawAssets.find((a: any) => (a.name || '').toLowerCase().endsWith('.exe'));
      const msiAsset = rawAssets.find((a: any) => (a.name || '').toLowerCase().endsWith('.msi'));
      const msixAsset = rawAssets.find((a: any) => (a.name || '').toLowerCase().endsWith('.msix'));
      const zipAsset = rawAssets.find((a: any) => (a.name || '').toLowerCase().endsWith('.zip') && !(a.name || '').toLowerCase().includes('source'));
      const macDmgAsset = rawAssets.find((a: any) => (a.name || '').toLowerCase().endsWith('.dmg'));
      const macPkgAsset = rawAssets.find((a: any) => (a.name || '').toLowerCase().endsWith('.pkg'));
      const linuxBinAsset = rawAssets.find((a: any) => {
        const n = (a.name || '').toLowerCase();
        return (n.includes('linux') || n.includes('amd64') || n.includes('x86_64')) && !n.endsWith('.exe') && !n.endsWith('.apk') && !n.endsWith('.aar');
      });

      const bestAsset = exactUrlAsset || pickBestAssetForPlatform(rawAssets, platform || resolution.platform);
      const detectedPkg = bestAsset ? detectPackageDetails(bestAsset.name) : (resolution.isBinary ? resolution : null);

      const targetPlat = platform || detectedPkg?.platform || resolution.platform || 'android';
      const defaultExt = targetPlat === 'linux' ? 'AppImage' : targetPlat === 'windows' ? 'exe' : targetPlat === 'mac' ? 'dmg' : 'apk';
      const primaryDownloadUrl = resolution.isBinary
        ? resolution.resolvedUrl 
        : (bestAsset?.browser_download_url || '');

      const primaryName = resolution.isBinary 
        ? resolution.assetName 
        : (bestAsset?.name || '');

      const primarySize = exactUrlAsset?.size || bestAsset?.size || resolution.size || 0;

      return res.json({
        success: true,
        repoOwner: owner,
        repoName: repo,
        tagName: finalTag,
        isBinaryFound: resolution.isBinary || Boolean(bestAsset),
        isApkFound: resolution.isApk || Boolean(apkAsset || aabAsset),
        isLinuxFound: resolution.isLinux || Boolean(debAsset || appImageAsset || rpmAsset || tarAsset || linuxBinAsset),
        isWindowsFound: resolution.isWindows || Boolean(exeAsset || msiAsset || msixAsset || zipAsset),
        detectedPlatform: detectedPkg?.platform || resolution.platform || targetPlat,
        detectedFormat: detectedPkg?.format || resolution.format || defaultExt,
        primaryAsset: {
          name: primaryName,
          downloadUrl: primaryDownloadUrl,
          size: primarySize,
          sizeFormatted: formatBytesHelper(primarySize),
          format: detectedPkg?.format || resolution.format || defaultExt,
          platform: detectedPkg?.platform || resolution.platform || targetPlat
        },
        primaryApk: {
          name: primaryName,
          downloadUrl: primaryDownloadUrl,
          size: primarySize,
          sizeFormatted: formatBytesHelper(primarySize)
        },
        assets: rawAssets.filter((a: any) => !isBloatAsset(a.name)).map((a: any) => ({
          name: a.name,
          downloadUrl: a.browser_download_url,
          size: a.size,
          sizeFormatted: formatBytesHelper(a.size || 0),
          format: detectPackageDetails(a.name).format,
          platform: detectPackageDetails(a.name).platform
        })),
        body: releaseData?.body || resolution.changelog || `### What's Changed in ${finalTag}\n- Official application package distribution`,
        publishedAt: releaseData?.published_at || resolution.publishedAt || new Date().toISOString()
      });
    } catch (err: any) {
      console.error("[Backend] Error in /api/github-release-meta:", err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Direct same-origin App package binary streaming endpoint:
  // Streams the genuine binary file (.apk, .deb, .AppImage, .rpm, .tar.gz, .exe, .msi, .zip, .msix) directly to the client.
  app.all("/api/download-apk", async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return res.status(405).json({ success: false, error: "Method not allowed. Use GET or HEAD." });
    }
    const isHeadRequest = req.method === 'HEAD';
    try {
      const rawUrl = (req.query.url as string || '').trim();
      const customName = (req.query.name as string || '').trim();
      const platform = (req.query.platform as string || '').trim().toLowerCase();

      if (!rawUrl) {
        return res.status(400).json({ success: false, error: "Missing download URL parameter." });
      }

      // Strictly reject source archive downloads, pipeline URLs, or HTML source trees
      const lowerRaw = rawUrl.toLowerCase().split('?')[0];
      if (
        lowerRaw.endsWith('/archive/refs/heads/main.zip') ||
        lowerRaw.endsWith('/archive/refs/heads/master.zip') ||
        lowerRaw.includes('/archive/refs/heads/') ||
        lowerRaw.includes('/archive/refs/tags/') ||
        lowerRaw.includes('/archive/') ||
        lowerRaw.includes('/tarball/') ||
        lowerRaw.includes('/zipball/') ||
        lowerRaw.includes('/tree/') ||
        lowerRaw.includes('/blob/') ||
        lowerRaw.includes('/actions/runs/') ||
        lowerRaw.includes('/pipeline/') ||
        lowerRaw.includes('/pipelines/')
      ) {
        return res.status(422).json({
          success: false,
          error: "Source code archives, repositories, and CI pipeline paths cannot be downloaded as executable application packages. Only genuine release binary packages (.apk, .deb, .AppImage, .exe, .msi, .dmg) are served."
        });
      }

      // Step 1: Resolve the actual binary asset URL if it's a GitHub repository or release page
      let targetBinaryUrl = rawUrl;
      const initialPkg = detectPackageDetails(rawUrl);
      let resolvedExactName = '';

      if (rawUrl.includes('github.com') && (!initialPkg.isBinary || (!rawUrl.includes('/releases/download/') && !rawUrl.includes('/raw/')))) {
        const resolution = await resolveGitHubApkUrl(rawUrl, platform);
        if (!resolution.isBinary || !resolution.resolvedUrl) {
          return res.status(204).end();
        }
        targetBinaryUrl = resolution.resolvedUrl;
        if (resolution.assetName) {
          resolvedExactName = resolution.assetName;
        }
      }

      // Verify resolved target is a real binary package, not a web page
      const resolvedPkg = detectPackageDetails(targetBinaryUrl);
      if (!resolvedPkg.isBinary && !targetBinaryUrl.includes('/releases/download/')) {
        return res.status(204).end();
      }

      // Extract exact package filename from the binary URL or resolved asset (never invent bloat fallback files)
      const urlBaseName = decodeURIComponent(targetBinaryUrl.split('?')[0].split('#')[0].split('/').pop() || '').trim();
      const customCleanName = decodeURIComponent(customName.split('?')[0].split('#')[0].split('/').pop() || '').trim();
      let safeFileName = '';
      if (resolvedExactName && detectPackageDetails(resolvedExactName).isBinary) {
        safeFileName = resolvedExactName;
      } else if (urlBaseName && detectPackageDetails(urlBaseName).isBinary) {
        safeFileName = urlBaseName;
      } else if (customCleanName && detectPackageDetails(customCleanName).isBinary) {
        safeFileName = customCleanName;
      }

      if (!safeFileName) {
        return res.status(204).end();
      }

      if (!targetBinaryUrl.startsWith('http://') && !targetBinaryUrl.startsWith('https://')) {
        targetBinaryUrl = 'https://' + targetBinaryUrl;
      }

      let parsedTarget: URL;
      try {
        parsedTarget = new URL(targetBinaryUrl);
      } catch {
        return res.status(204).end();
      }

      if (parsedTarget.protocol !== 'http:' && parsedTarget.protocol !== 'https:') {
        return res.status(204).end();
      }

      if (isPrivateOrReservedHost(parsedTarget.hostname)) {
        return res.status(403).end();
      }

      // Step 2: Stream the authentic binary directly on-site to the client response:
      // Zero redirect to GitHub, zero browser address bar loading line, zero page navigation, zero RAM cache accumulation.
      const upstreamRes = await fetch(targetBinaryUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': '*/*'
        },
        redirect: 'follow'
      });

      if (!upstreamRes.ok || !upstreamRes.body) {
        return res.status(204).end();
      }

      const cleanSafeName = safeFileName.replace(/["\r\n]/g, '');
      const lowerName = cleanSafeName.toLowerCase();
      let mimeType = upstreamRes.headers.get('content-type') || 'application/octet-stream';

      if (mimeType.includes('text/html') || mimeType.includes('application/json') || mimeType.includes('text/plain')) {
        return res.status(204).end();
      }

      // Exact MIME type mapping for binary packages
      if (lowerName.endsWith('.apk') || lowerName.endsWith('.aab')) {
        mimeType = 'application/vnd.android.package-archive';
      } else if (lowerName.endsWith('.exe')) {
        mimeType = 'application/x-msdownload';
      } else if (lowerName.endsWith('.msi')) {
        mimeType = 'application/x-msi';
      } else if (lowerName.endsWith('.deb')) {
        mimeType = 'application/vnd.debian.binary-package';
      } else if (lowerName.endsWith('.rpm')) {
        mimeType = 'application/x-redhat-package-manager';
      } else if (lowerName.endsWith('.appimage') || lowerName.endsWith('.run') || lowerName.endsWith('.bin')) {
        mimeType = 'application/x-executable';
      } else if (lowerName.endsWith('.dmg')) {
        mimeType = 'application/x-apple-diskimage';
      } else if (lowerName.endsWith('.pkg') && !lowerName.includes('.pkg.tar.')) {
        mimeType = 'application/x-newton-compatible-pkg';
      } else if (lowerName.endsWith('.ipa')) {
        mimeType = 'application/x-itunes-ipa';
      }

      const ONE_MB = 1024 * 1024; // 1,048,576 bytes
      const isExecutableBinary = (
        lowerName.endsWith('.apk') ||
        lowerName.endsWith('.aab') ||
        lowerName.endsWith('.appimage') ||
        lowerName.endsWith('.exe') ||
        lowerName.endsWith('.msi') ||
        lowerName.endsWith('.msix') ||
        lowerName.endsWith('.appx') ||
        lowerName.endsWith('.deb') ||
        lowerName.endsWith('.rpm') ||
        lowerName.endsWith('.dmg') ||
        lowerName.endsWith('.pkg') ||
        lowerName.endsWith('.ipa') ||
        lowerName.endsWith('.run') ||
        lowerName.endsWith('.bin') ||
        lowerName.endsWith('.tar.gz') ||
        lowerName.endsWith('.tgz') ||
        lowerName.endsWith('.zip') ||
        lowerName.endsWith('.7z')
      );

      const contentLength = upstreamRes.headers.get('content-length');
      if (contentLength) {
        const parsedLen = parseInt(contentLength, 10);
        if (parsedLen < ONE_MB && isExecutableBinary) {
          console.warn(`[Backend] Rejecting download for ${cleanSafeName}: size ${parsedLen} bytes is under 1MB threshold.`);
          return res.status(422).json({
            success: false,
            error: `Application package size is under 1 MB (${(parsedLen / 1024).toFixed(1)} KB). Download prevented to avoid corrupted stubs.`
          });
        }
      }

      // Inspect the first chunk to guarantee zero HTML/XML/JSON files
      const reader = (upstreamRes.body as ReadableStream<Uint8Array>).getReader();
      const firstRead = await reader.read();
      if (firstRead.done || !firstRead.value || firstRead.value.length === 0) {
        try { reader.cancel(); } catch {}
        return res.status(204).end();
      }

      const firstBytes = firstRead.value;
      if (firstBytes.length >= 4) {
        const headStr = Buffer.from(firstBytes.subarray(0, Math.min(firstBytes.length, 64))).toString('utf8').trimStart().toLowerCase();
        if (
          headStr.startsWith('<!doctype') ||
          headStr.startsWith('<html') ||
          headStr.startsWith('<head') ||
          headStr.startsWith('<body') ||
          headStr.startsWith('<?xml') ||
          headStr.startsWith('<?php') ||
          headStr.startsWith('{"error"') ||
          headStr.startsWith('{"success":false')
        ) {
          try { reader.cancel(); } catch {}
          return res.status(422).json({
            success: false,
            error: 'Upstream returned an HTML or error document instead of a binary package.'
          });
        }
      }

      res.status(200);
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${cleanSafeName}"; filename*=UTF-8''${encodeURIComponent(cleanSafeName)}`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Accel-Buffering', 'no');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Disposition, Content-Type');
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }
      res.setHeader('Cache-Control', 'no-transform, public, max-age=3600');
      if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
      }

      if (isHeadRequest) {
        try { reader.cancel(); } catch {}
        return res.end();
      }

      // Write first chunk immediately
      res.write(Buffer.from(firstBytes));

      let streamClosed = false;
      req.on('close', () => {
        streamClosed = true;
        try { reader.cancel(); } catch {}
      });

      while (!streamClosed) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value && value.length > 0 && !streamClosed) {
          const canContinue = res.write(Buffer.from(value));
          if (!canContinue && !streamClosed) {
            await new Promise<void>((resolve) => res.once('drain', resolve));
          }
        }
      }

      if (!streamClosed) {
        res.end();
      }
    } catch (err: any) {
      console.error("[Backend] Error resolving binary download:", err.message);
      if (!res.headersSent) {
        return res.status(204).end();
      }
    }
  });

  // Direct APK / Asset download streaming endpoint:
  app.get("/api/download-proxy", async (req, res) => {
    try {
      const url = (req.query.url as string || '').trim();
      const platform = (req.query.platform as string || '').trim().toLowerCase();

      if (!url) {
        return res.status(400).json({ success: false, error: "Missing download url" });
      }

      // Automatically resolve GitHub release, tag, or repo URLs to their real binary asset
      const resolution = await resolveGitHubApkUrl(url, platform);
      
      // Strictly prevent downloading HTML webpages or non-binary resources
      if (!resolution.isBinary || !resolution.resolvedUrl || !resolution.assetName) {
        return res.status(204).end();
      }

      let targetUrl = resolution.resolvedUrl;

      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
      }

      if (!isSafePublicUrl(targetUrl)) {
        return res.status(403).end();
      }

      const safeName = resolution.assetName;
      const lowerName = safeName.toLowerCase();
      let mimeType = 'application/octet-stream';
      if (lowerName.endsWith('.apk') || lowerName.endsWith('.aab')) mimeType = 'application/vnd.android.package-archive';
      else if (lowerName.endsWith('.exe')) mimeType = 'application/x-msdownload';
      else if (lowerName.endsWith('.msi')) mimeType = 'application/x-msi';
      else if (lowerName.endsWith('.msix')) mimeType = 'application/msix';
      else if (lowerName.endsWith('.zip')) mimeType = 'application/zip';

      const upstreamRes = await safeFetchWithRedirectCheck(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': '*/*'
        }
      }, 5);

      if (!upstreamRes.ok || !upstreamRes.body) {
        return res.status(204).end();
      }

      const contentLength = upstreamRes.headers.get('content-length');
      res.status(200);
      res.setHeader('Content-Type', mimeType);
      const cleanSafeName = safeName.replace(/["\r\n]/g, '');
      res.setHeader('Content-Disposition', `attachment; filename="${cleanSafeName}"; filename*=UTF-8''${encodeURIComponent(cleanSafeName)}`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Accel-Buffering', 'no');
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }
      res.setHeader('Cache-Control', 'no-transform, public, max-age=3600');
      if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
      }

      const nodeStream = Readable.fromWeb(upstreamRes.body as any);
      nodeStream.on('error', (streamErr) => {
        console.warn("[Backend] /api/download-proxy stream pipe error:", streamErr.message);
        try { nodeStream.destroy(); } catch {}
      });
      req.on('close', () => {
        try { nodeStream.destroy(); } catch {}
      });
      return nodeStream.pipe(res);
    } catch (err: any) {
      console.error("[Backend] Download proxy redirect error:", err.message);
      if (!res.headersSent) {
        return res.status(204).end();
      }
    }
  });

  // API route for verifying the provided domain
  app.post("/api/verify-domain", async (req, res) => {
    try {
      const { url, verificationCode } = req.body;
      if (!url || !verificationCode) {
        return res.status(400).json({ success: false, error: "Missing URL or verification code" });
      }

      let targetUrl = url;
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
      }

      if (!isSafePublicUrl(targetUrl)) {
        return res.json({ success: false, isVerified: false, error: "Forbidden: Loopback and private internal network domains cannot be verified." });
      }

      const response = await safeFetchWithRedirectCheck(targetUrl, {
        headers: {
          'User-Agent': 'WebappMarketplaceVerifier/1.0'
        },
        signal: AbortSignal.timeout(10000)
      }, 3);

      const html = await response.text();
      
      // Check if the verification code is in the HTML
      // Example code structure: <meta name="webapp-verification" content="CODE">
      const isVerified = html.includes(verificationCode);

      return res.json({ success: true, isVerified });
    } catch (error: any) {
      console.error("Verification error:", error.message);
      return res.json({ success: false, isVerified: false, error: "Failed to reach the domain. Please verify the URL and try again." });
    }
  });

  function slugifyAppName(name: string): string {
    return (name || '')
      .trim()
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // In-memory cache for ultra-fast crawler, SSR and API app responses
  const seoAppsCache = new Map<string, { data: any; timestamp: number }>();
  let serverAppsCatalogCache: any[] = [];
  let serverAppsCatalogCacheTime = 0;

  let isFetchingAllApps = false;
  async function getAllAppsServer(maxWaitMs = 1200): Promise<any[]> {
    const now = Date.now();
    if (serverAppsCatalogCache.length > 0 && now - serverAppsCatalogCacheTime < 60000) {
      return serverAppsCatalogCache;
    }
    if (!serverDb) return serverAppsCatalogCache;

    const fetchPromise = (async () => {
      if (isFetchingAllApps) return serverAppsCatalogCache;
      isFetchingAllApps = true;
      try {
        const snap = await serverGetDocs(serverCollection(serverDb, "apps"));
        const list: any[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        if (list.length > 0) {
          serverAppsCatalogCache = list;
          serverAppsCatalogCacheTime = Date.now();
        }
        return serverAppsCatalogCache;
      } catch (e: any) {
        console.warn("[Server] Error getting all apps:", e.message);
        return serverAppsCatalogCache;
      } finally {
        isFetchingAllApps = false;
      }
    })();

    if (serverAppsCatalogCache.length > 0) {
      return serverAppsCatalogCache;
    }

    return Promise.race([
      fetchPromise,
      new Promise<any[]>((resolve) => setTimeout(() => resolve(serverAppsCatalogCache), maxWaitMs)),
    ]);
  }

  // Helper to fetch app data from Firestore for SSR SEO and deeplink resolution
  async function getAppForSeo(appId: string): Promise<any | null> {
    if (!appId || typeof appId !== 'string') return null;
    const cleanId = appId.trim().toLowerCase();
    const cleanSlug = cleanId.replace(/[^a-z0-9]/g, '');
    const cached = seoAppsCache.get(cleanId);
    if (cached && Date.now() - cached.timestamp < 300000) {
      return cached.data;
    }

    if (serverDb) {
      try {
        // 1. Direct doc ID match
        const appRef = serverDoc(serverDb, "apps", appId);
        const snap = await serverGetDoc(appRef);
        if (snap.exists()) {
          const data: any = { id: snap.id, ...snap.data() };
          seoAppsCache.set(cleanId, { data, timestamp: Date.now() });
          if (data.name) {
            seoAppsCache.set(slugifyAppName(data.name), { data, timestamp: Date.now() });
          }
          return data;
        }
        // 2. Direct package name match
        const q = serverQuery(serverCollection(serverDb, "apps"), serverWhere("packageName", "==", appId), serverLimit(1));
        const pkgSnap = await serverGetDocs(q);
        if (!pkgSnap.empty) {
          const doc = pkgSnap.docs[0];
          const data: any = { id: doc.id, ...doc.data() };
          seoAppsCache.set(cleanId, { data, timestamp: Date.now() });
          return data;
        }
        // 3. Direct slug match
        const qSlug = serverQuery(serverCollection(serverDb, "apps"), serverWhere("slug", "==", appId), serverLimit(1));
        const slugSnap = await serverGetDocs(qSlug);
        if (!slugSnap.empty) {
          const doc = slugSnap.docs[0];
          const data: any = { id: doc.id, ...doc.data() };
          seoAppsCache.set(cleanId, { data, timestamp: Date.now() });
          return data;
        }
        // 4. Direct name match
        const qName = serverQuery(serverCollection(serverDb, "apps"), serverWhere("name", "==", appId), serverLimit(1));
        const nameSnap = await serverGetDocs(qName);
        if (!nameSnap.empty) {
          const doc = nameSnap.docs[0];
          const data: any = { id: doc.id, ...doc.data() };
          seoAppsCache.set(cleanId, { data, timestamp: Date.now() });
          return data;
        }

        // 5. Deep catalog search across all apps (handles case insensitivity, slug vs name, dashes, symbols)
        const allApps = await getAllAppsServer();
        if (allApps.length > 0) {
          const matched = allApps.find(app => {
            if (!app) return false;
            if (app.id === appId || (app.id && app.id.toLowerCase() === cleanId)) return true;
            if (app.packageName && app.packageName.toLowerCase() === cleanId) return true;
            if (app.slug && app.slug.toLowerCase() === cleanId) return true;
            if (app.name && app.name.toLowerCase() === cleanId) return true;
            const nameSlug = slugifyAppName(app.name || '');
            const idSlug = slugifyAppName(app.id || '');
            const rawNameSlug = (app.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const rawIdSlug = (app.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            return Boolean(
              (nameSlug && (nameSlug === cleanId || nameSlug === cleanSlug)) ||
              (idSlug && (idSlug === cleanId || idSlug === cleanSlug)) ||
              (rawNameSlug && (rawNameSlug === cleanSlug || rawNameSlug === cleanId)) ||
              (rawIdSlug && (rawIdSlug === cleanSlug || rawIdSlug === cleanId))
            );
          });
          if (matched) {
            seoAppsCache.set(cleanId, { data: matched, timestamp: Date.now() });
            if (matched.id) {
              seoAppsCache.set(matched.id.toLowerCase(), { data: matched, timestamp: Date.now() });
            }
            if (matched.name) {
              seoAppsCache.set(slugifyAppName(matched.name), { data: matched, timestamp: Date.now() });
            }
            return matched;
          }
        }
      } catch (err: any) {
        console.warn("[SEO] Firestore fetch error for app", appId, err.message);
      }
    }
    return null;
  }

  // ==========================================
  // Model Context Protocol (MCP) Server Integration
  // ==========================================
  // Reusable application publishing pipeline for web console and MCP agents
  async function executeAppPublish(
    appPayload: any,
    userId: string,
    userEmail: string,
    options: { featureOnSpotlight?: boolean } = {}
  ): Promise<any> {
    if (!serverDb) throw new Error("Database service unavailable");
    const validation = validateAppPayload(appPayload);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.error}`);
    }

    const appId = appPayload.id || `app-${(appPayload.name || 'app').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const appRef = serverDoc(serverDb, "apps", appId);
    const existingSnap = await serverGetDoc(appRef).catch(() => null);
    const exists = existingSnap && existingSnap.exists();

    if (exists) {
      const existingData = existingSnap.data();
      const normUserEmail = (userEmail || '').toLowerCase().trim();
      const devEmail = (existingData.developerEmail || '').toLowerCase().trim();
      const pubEmail = (existingData.publisherEmail || '').toLowerCase().trim();
      const ownerEmail = (existingData.ownerEmail || '').toLowerCase().trim();

      const isMatchingEmail = normUserEmail && (
        devEmail === normUserEmail ||
        pubEmail === normUserEmail ||
        ownerEmail === normUserEmail
      );

      const isOwner = (userId && (
        existingData.owner === userId ||
        existingData.developerId === userId ||
        existingData.creatorUid === userId
      )) || isMatchingEmail || (normUserEmail && isServerAdminEmail(normUserEmail));

      if (!isOwner) {
        throw new Error("Forbidden: You do not own this application and cannot modify its release.");
      }

      const cleanDoc = sanitizeObject({
        ...existingData,
        ...appPayload,
        id: appId,
        slug: slugifyAppName(appPayload.name || existingData.name || ''),
        owner: userId || existingData.owner || 'developer',
        developerId: userId || existingData.developerId || 'developer',
        developerEmail: appPayload.developerEmail || userEmail || existingData.developerEmail || '',
        updatedAt: new Date().toISOString(),
        publishedVia: appPayload.publishedVia || 'mcp-agent'
      });

      await serverSetDoc(appRef, cleanDoc, { merge: true });
      serverAppsCatalogCache = [];
      seoAppsCache.delete(appId.toLowerCase());
      indexApp(cleanDoc).catch(() => {});
      return { success: true, app: cleanDoc };
    } else {
      // New app creation
      const cleanDoc = sanitizeObject({
        ...appPayload,
        id: appId,
        slug: slugifyAppName(appPayload.name || ''),
        owner: userId,
        developerId: userId,
        creatorUid: userId,
        developerEmail: userEmail,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        rating: 5.0,
        reviewsCount: 1,
        downloadsCount: 1,
        downloads: '1+',
        isPublished: true,
        publishedVia: appPayload.publishedVia || 'mcp-agent'
      });

      await serverSetDoc(appRef, cleanDoc);
      serverAppsCatalogCache = [];
      seoAppsCache.delete(appId.toLowerCase());
      indexApp(cleanDoc).catch(() => {});
      return { success: true, app: cleanDoc };
    }
  }

  // Reusable application release updater for version deployments
  async function executeAppReleaseUpdate(
    appId: string,
    version: string,
    downloadUrl: string,
    releaseNotes: string,
    userId: string,
    sizeFormatted?: string
  ): Promise<any> {
    if (!serverDb) throw new Error("Database service unavailable");
    const appRef = serverDoc(serverDb, "apps", appId);
    const existingSnap = await serverGetDoc(appRef);
    if (!existingSnap.exists()) {
      throw new Error(`Application "${appId}" not found in repository.`);
    }

    const updatePayload: Record<string, any> = {
      version,
      currentVersion: version,
      downloadUrl,
      packageUrl: downloadUrl,
      whatsNew: releaseNotes,
      releaseNotes,
      updatedAt: new Date().toISOString()
    };
    if (sizeFormatted) {
      updatePayload.size = sizeFormatted;
    }

    await serverSetDoc(appRef, updatePayload, { merge: true });
    serverAppsCatalogCache = [];
    seoAppsCache.delete(appId.toLowerCase());
    return { success: true, appId, version };
  }

  // Vite middleware for development vs static dist serving in production
  const isProduction = process.env.NODE_ENV === "production";
  let viteServer: any = null;

  if (!isProduction) {
    viteServer = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false,
        watch: null,
      },
      appType: "spa",
    });
  }

  // Serve Web App Manifest and Public Assets before SEO/HTML fallback
  const publicDir = path.join(process.cwd(), 'public');

  // Explicit PWA Web App Manifest handler with standard MIME type
  app.get(['/manifest.webmanifest', '/manifest.json'], (req, res) => {
    const webmanifestPath = path.join(publicDir, 'manifest.webmanifest');
    const jsonPath = path.join(publicDir, 'manifest.json');
    const targetFile = fs.existsSync(webmanifestPath) ? webmanifestPath : (fs.existsSync(jsonPath) ? jsonPath : null);

    if (targetFile) {
      res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.sendFile(targetFile);
    }
    return res.status(404).json({ error: 'Manifest not found' });
  });

  // Serve static public assets (icons, images, manifest, robots, sitemap, sw.js)
  app.use(express.static(publicDir, {
    maxAge: '1h',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.webmanifest') || filePath.endsWith('.json')) {
        res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
      } else if (filePath.endsWith('.svg')) {
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (filePath.endsWith('.png') || filePath.endsWith('.ico') || filePath.endsWith('.jpg') || filePath.endsWith('.webp')) {
        res.setHeader('Content-Type', filePath.endsWith('.png') ? 'image/png' : filePath.endsWith('.ico') ? 'image/x-icon' : filePath.endsWith('.webp') ? 'image/webp' : 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (filePath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      }
    }
  }));

  // Route-Based SEO, OpenGraph, Twitter, Schema.org JSON-LD, and SSR Document Pre-Renderer
  app.use(async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const rawPath = req.path;
    if (
      rawPath.startsWith('/api/') ||
      rawPath.startsWith('/@') ||
      rawPath.startsWith('/src/') ||
      rawPath.startsWith('/node_modules/') ||
      (rawPath.includes('.') && !rawPath.endsWith('.html'))
    ) {
      return next();
    }

    const host = req.get('host') || `localhost:${PORT}`;
    const proto = (req.headers['x-forwarded-proto'] as string) || (req.secure ? 'https' : req.protocol) || 'https';
    const baseUrl = `${proto}://${host}`;

    // 0. Trailing slash normalization (e.g. /apps/vlc/ -> /apps/vlc)
    if (rawPath.length > 1 && rawPath.endsWith('/')) {
      const cleanPath = rawPath.replace(/\/+$/, '');
      const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
      return res.redirect(301, cleanPath + query);
    }

    // 1. Zero Duplicate Canonical Redirects:
    // Redirect /?app=xyz or /app?id=xyz or /apps?id=xyz directly to /apps/canonical-slug
    const queryAppId = (req.query?.app || req.query?.id) as string;
    if ((rawPath === '/' || rawPath === '/app' || rawPath === '/apps') && queryAppId) {
      const app = await getAppForSeo(queryAppId);
      const canonicalSlug = app?.slug || (app?.name ? slugifyAppName(app.name) : '') || slugifyAppName(queryAppId);
      return res.redirect(301, `/apps/${encodeURIComponent(canonicalSlug)}`);
    }

    // Helper to get raw HTML template
    const getBaseTemplate = async (): Promise<string | null> => {
      try {
        if (isProduction) {
          const distIndexPath = path.join(process.cwd(), 'dist', 'index.html');
          if (fs.existsSync(distIndexPath)) {
            return fs.readFileSync(distIndexPath, 'utf-8');
          }
        } else if (viteServer) {
          const indexPath = path.join(process.cwd(), 'index.html');
          if (fs.existsSync(indexPath)) {
            const template = fs.readFileSync(indexPath, 'utf-8');
            return await viteServer.transformIndexHtml(req.originalUrl, template);
          }
        }
      } catch (e: any) {
        console.warn('[Server] Error reading index.html template:', e.message);
      }
      return null;
    };

    const PLATFORM_KEYWORDS = new Set(['android', 'windows', 'linux', 'mac', 'apple', 'ios', 'web', 'all']);

    try {
      // 2. Legacy /app/:slug Route Redirect to Canonical /apps/:slug
      const legacyAppMatch = rawPath.match(/^\/app\/([^\/]+)(?:\/download)?$/);
      if (legacyAppMatch && legacyAppMatch[1]) {
        const requestedSlug = decodeURIComponent(legacyAppMatch[1]);
        const appData = await getAppForSeo(requestedSlug);
        const canonicalSlug = appData?.slug || (appData?.name ? slugifyAppName(appData.name) : '') || requestedSlug;
        return res.redirect(301, `/apps/${encodeURIComponent(canonicalSlug)}`);
      }

      // 3. First-Class Application Route: /apps/:slug (when :slug is NOT a platform keyword)
      const appRouteMatch = rawPath.match(/^\/apps\/([^\/]+)(?:\/download)?$/);
      if (appRouteMatch && appRouteMatch[1]) {
        const requestedSlug = decodeURIComponent(appRouteMatch[1]);
        if (!PLATFORM_KEYWORDS.has(requestedSlug.toLowerCase())) {
          const appData = await getAppForSeo(requestedSlug);
          const rawHtml = await getBaseTemplate();
          if (!rawHtml) return next();

          // 404 Handling: App does not exist
          if (!appData) {
            const notFoundHtml = renderNotFoundHtml(rawHtml, requestedSlug, baseUrl);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            return res.status(404).send(notFoundHtml);
          }

          // Canonical Slug Redirect: If accessed by raw ID but clean name slug exists, 301 redirect
          const canonicalSlug = appData.slug || slugifyAppName(appData.name) || appData.id;
          if (requestedSlug !== canonicalSlug && requestedSlug === appData.id && appData.name) {
            return res.redirect(301, `/apps/${encodeURIComponent(canonicalSlug)}`);
          }

          let transformedHtml = injectAppSeoIntoHtml(rawHtml, appData, baseUrl);
          const hydrationJson = JSON.stringify(appData).replace(/</g, '\\u003c');
          const hydrationScript = `<script id="prople-initial-app" type="application/json">${hydrationJson}</script><script>try{window.__INITIAL_APP__=JSON.parse(document.getElementById("prople-initial-app").textContent);}catch(e){}</script>`;
          if (transformedHtml.includes('</head>')) {
            transformedHtml = transformedHtml.replace('</head>', `${hydrationScript}</head>`);
          } else {
            transformedHtml = hydrationScript + transformedHtml;
          }

          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          return res.send(transformedHtml);
        }
      }

      // 4. Category Routes: /categories/:slug or /category/:slug
      const catRouteMatch = rawPath.match(/^\/(?:categories|category)\/([^\/]+)$/);
      if (catRouteMatch && catRouteMatch[1]) {
        const catSlug = decodeURIComponent(catRouteMatch[1]);
        if (rawPath.startsWith('/category/')) {
          return res.redirect(301, `/categories/${encodeURIComponent(catSlug)}`);
        }

        const allApps = await getAllAppsServer();
        let matchedCategory = catSlug;
        const matchedApp = allApps.find(a => a.category && slugifyAppName(a.category) === catSlug);
        if (matchedApp && matchedApp.category) {
          matchedCategory = matchedApp.category;
        } else {
          matchedCategory = catSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        }
        const categoryApps = allApps.filter(a => a.category && (slugifyAppName(a.category) === catSlug || a.category.toLowerCase() === matchedCategory.toLowerCase()));

        const rawHtml = await getBaseTemplate();
        if (!rawHtml) return next();

        const transformedHtml = injectCategorySeoIntoHtml(rawHtml, matchedCategory, baseUrl, categoryApps);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.send(transformedHtml);
      }

      // 5. Developer Routes: /developers/:slug or /developer/:slug
      const devRouteMatch = rawPath.match(/^\/(?:developers|developer)\/([^\/]+)$/);
      if (devRouteMatch && devRouteMatch[1]) {
        const devSlug = decodeURIComponent(devRouteMatch[1]);
        if (rawPath.startsWith('/developer/')) {
          return res.redirect(301, `/developers/${encodeURIComponent(devSlug)}`);
        }

        const allApps = await getAllAppsServer();
        const matchedApp = allApps.find(a => a.developer && slugifyAppName(a.developer) === devSlug);
        const developerName = matchedApp?.developer || devSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const devApps = allApps.filter(a => a.developer && (slugifyAppName(a.developer) === devSlug || a.developer.toLowerCase() === developerName.toLowerCase()));

        const rawHtml = await getBaseTemplate();
        if (!rawHtml) return next();

        const transformedHtml = injectDeveloperSeoIntoHtml(rawHtml, developerName, baseUrl, devApps);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.send(transformedHtml);
      }

      // 6. Platform Routes: /platforms/:platform, /platform/:platform, /apps/:platform, or /apps
      const platformMatch = rawPath.match(/^\/(?:platforms|platform|apps)(?:\/(android|windows|linux|mac|apple|ios|web))?$/);
      if (platformMatch) {
        const matchedPlat = platformMatch[1];
        if (rawPath.startsWith('/platform/')) {
          return res.redirect(301, matchedPlat ? `/platforms/${matchedPlat}` : '/apps');
        }

        const platformParam = (matchedPlat || 'all') as 'android' | 'windows' | 'linux' | 'mac' | 'apple' | 'ios' | 'web' | 'all';
        const allApps = await getAllAppsServer();
        let platformApps = allApps;
        if (platformParam !== 'all') {
          platformApps = allApps.filter(a => {
            const plat = (a.platform || '').toLowerCase();
            const pkg = (a.packageFormat || '').toLowerCase();
            const target = (a.targetOs || '').toLowerCase();
            const appType = (a.type || '').toLowerCase();
            if (platformParam === 'android') return plat === 'android' || pkg === 'apk' || pkg === 'aab';
            if (platformParam === 'windows') return plat === 'windows' || pkg === 'exe' || pkg === 'msi' || pkg === 'msix';
            if (platformParam === 'linux') return plat === 'linux' || pkg === 'deb' || pkg === 'appimage' || pkg === 'rpm' || pkg === 'flatpak' || pkg === 'tar.gz';
            if (platformParam === 'mac') return plat === 'mac' || plat === 'macos' || pkg === 'dmg' || pkg === 'pkg' || target.includes('mac');
            if (platformParam === 'apple' || platformParam === 'ios') return plat === 'ios' || plat === 'apple' || plat === 'mac' || pkg === 'ipa' || pkg === 'dmg' || target.includes('ios') || target.includes('apple');
            if (platformParam === 'web') return plat === 'web' || appType === 'pwa' || appType === 'web' || appType === 'webapp' || pkg === 'pwa' || pkg === 'web';
            return false;
          });
        }

        const rawHtml = await getBaseTemplate();
        if (!rawHtml) return next();

        const transformedHtml = injectPlatformSeoIntoHtml(rawHtml, platformParam, baseUrl, platformApps);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.send(transformedHtml);
      }

      // 7. Homepage & Root Document Pre-Rendering: / or /index.html
      if (rawPath === '/' || rawPath === '/index.html') {
        const rawHtml = await getBaseTemplate();
        if (rawHtml) {
          const allApps = await getAllAppsServer(400);
          const transformedHtml = injectHomeSeoIntoHtml(rawHtml, baseUrl, allApps);
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          return res.send(transformedHtml);
        }
      }

      if (isProduction) {
        const rawHtml = await getBaseTemplate();
        if (rawHtml) {
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          return res.send(rawHtml);
        }
      }
      return next();
    } catch (err: any) {
      console.warn('[SEO] HTML serving error:', err.message);
      return next();
    }
  });

  // Guaranteed JSON 404 handler for any unhandled /api/* routes
  // Prevents returning HTML or text pages to JSON fetch clients
  app.all('/api/*', (req, res) => {
    res.status(404).json({
      success: false,
      error: `API endpoint not found: ${req.method} ${req.path}`,
      status: 404
    });
  });

  if (!isProduction && viteServer) {
    app.use(viteServer.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // Enable 1-year immutable caching for static hashed build assets (JS, CSS, fonts, images)
    app.use(express.static(distPath, {
      maxAge: '1y',
      immutable: true,
      setHeaders: (res, filePath) => {
        // HTML files must never be cached by browsers/CDNs to ensure instantaneous deployment updates
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        } else if (filePath.endsWith('.json') || filePath.endsWith('.webmanifest')) {
          res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
        }
      }
    }));
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);

    // Warm catalog cache in background without blocking startup
    getAllAppsServer(5000).catch(() => {});

    // Asynchronously bootstrap Meilisearch indexing
    ensureAppsIndexConfigured().then(async (configured) => {
      if (configured && serverDb) {
        try {
          const appsCol = serverCollection(serverDb, "apps");
          const snap = await serverGetDocs(appsCol);
          const apps: any[] = [];
          snap.forEach(d => apps.push({ id: d.id, ...d.data() }));
          if (apps.length > 0) {
            await indexApps(apps);
            console.log(`[Meilisearch] Bootstrapped & indexed ${apps.length} apps on server start`);
          }
        } catch (e: any) {
          console.warn("[Meilisearch] Startup bootstrap warning:", e.message);
        }
      }
    }).catch(e => console.warn("[Meilisearch] Setup warning:", e.message));
  });
}

startServer();
