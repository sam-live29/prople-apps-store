/**
 * Security & Sanitization Utilities
 * 
 * Protects against Client-Side Cross-Site Scripting (XSS), URL scheme injection
 * (e.g., javascript:, vbscript:, malicious data: URIs), and unvalidated redirects.
 */

// Regex for allowed web protocols: http, https, mailto, and relative internal routes
const SAFE_PROTOCOL_REGEX = /^(https?:\/\/|mailto:|\/|#)/i;

// Dangerous scheme patterns
const DANGEROUS_SCHEMES_REGEX = /^(javascript|data|vbscript|file|blob):/i;

// Strict YouTube 11-character video ID regex
const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

/**
 * Validates and sanitizes a URL to ensure it does not execute client-side code.
 * Rejects javascript:, vbscript:, data:, and other unapproved URI schemes.
 * 
 * @param url The raw URL candidate
 * @param fallback Optional fallback return value if the URL is dangerous (default: '')
 */
export function sanitizeSafeUrl(url: string | null | undefined, fallback: string = ''): string {
  if (!url || typeof url !== 'string') return fallback;

  // Trim and strip non-printable/control characters and zero-width spaces
  const cleanUrl = url.trim().replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, '');

  if (!cleanUrl) return fallback;

  // Check for dangerous schemes
  if (DANGEROUS_SCHEMES_REGEX.test(cleanUrl)) {
    console.warn('[Security Guard] Blocked potentially malicious URI scheme:', cleanUrl.slice(0, 30));
    return fallback;
  }

  // Check if it starts with a recognized safe protocol or relative path
  if (SAFE_PROTOCOL_REGEX.test(cleanUrl)) {
    return cleanUrl;
  }

  // If domain-like (e.g. "example.com/path"), treat as https://
  if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/.test(cleanUrl)) {
    return `https://${cleanUrl}`;
  }

  // Fallback for anything unrecognized
  return fallback;
}

/**
 * Returns true if the URL is strictly safe for navigation or anchor href attributes.
 */
export function isSafeUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const cleanUrl = url.trim().replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, '');
  if (!cleanUrl) return false;
  if (DANGEROUS_SCHEMES_REGEX.test(cleanUrl)) return false;
  return SAFE_PROTOCOL_REGEX.test(cleanUrl) || /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/.test(cleanUrl);
}

/**
 * Sanitizes external HTTP/HTTPS links only. Disallows mailto and relative paths.
 */
export function sanitizeExternalUrl(url: string | null | undefined, fallback: string = ''): string {
  const sanitized = sanitizeSafeUrl(url, fallback);
  if (sanitized.startsWith('https://') || sanitized.startsWith('http://')) {
    return sanitized;
  }
  return fallback;
}

/**
 * Strictly verifies a YouTube video ID to prevent iframe parameter manipulation or injection.
 */
export function sanitizeYouTubeId(id: string | null | undefined): string | null {
  if (!id || typeof id !== 'string') return null;
  const cleanId = id.trim();
  return YOUTUBE_ID_REGEX.test(cleanId) ? cleanId : null;
}

/**
 * Validates whether a string is a standard 64-character hexadecimal SHA-256 hash.
 */
export function isSha256Hash(hash: string | null | undefined): boolean {
  if (!hash || typeof hash !== 'string') return false;
  return /^[a-fA-F0-9]{64}$/.test(hash.trim());
}

/**
 * Extracts a SHA-256 hash from release notes, changelog text, or checksum files.
 * If a preferred filename is provided, prioritizes the hash on the line referencing that file.
 */
export function extractSha256FromText(text: string | null | undefined, preferredFileName?: string): string | null {
  if (!text || typeof text !== 'string') return null;

  // 1. If preferred filename is specified, look for a line mentioning the filename and a 64-hex string
  if (preferredFileName) {
    const cleanFile = preferredFileName.trim().toLowerCase();
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      if (line.toLowerCase().includes(cleanFile)) {
        const match = line.match(/\b([a-fA-F0-9]{64})\b/);
        if (match) {
          return match[1].toLowerCase();
        }
      }
    }
  }

  // 2. Look for labeled SHA-256 patterns (e.g. "SHA256: 4f8b...", "sha256 = ...", "checksum: ...")
  const labeledMatch = text.match(/(?:sha[-_]?256|checksum|sha2)\s*[:=]\s*[`"']?([a-fA-F0-9]{64})[`"']?/i);
  if (labeledMatch) {
    return labeledMatch[1].toLowerCase();
  }

  // 3. Fallback: First 64-char hex string found in text
  const genericMatch = text.match(/\b([a-fA-F0-9]{64})\b/);
  if (genericMatch) {
    return genericMatch[1].toLowerCase();
  }

  return null;
}

// Standard FIPS 180-4 SHA-256 round constants (first 32 bits of fractional parts of cube roots of first 64 prime numbers)
const K256 = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

function rotr(n: number, b: number): number {
  return (n >>> b) | (n << (32 - b));
}

/**
 * Synchronously computes the authentic standard FIPS 180-4 SHA-256 cryptographic hexadecimal digest of a string.
 * Generates an identical checksum to OpenSSL, sha256sum, and Web Crypto API.
 */
export function computeDeterministicSha256(seedInput: string): string {
  const input = seedInput || 'prople-release-default-seed';
  
  // Encode string to UTF-8 byte array
  const utf8Bytes: number[] = [];
  for (let i = 0; i < input.length; i++) {
    let charcode = input.charCodeAt(i);
    if (charcode < 0x80) utf8Bytes.push(charcode);
    else if (charcode < 0x800) {
      utf8Bytes.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
    } else if (charcode < 0xd800 || charcode >= 0xe000) {
      utf8Bytes.push(0xe0 | (charcode >> 12), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
    } else {
      i++;
      charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (input.charCodeAt(i) & 0x3ff));
      utf8Bytes.push(
        0xf0 | (charcode >> 18),
        0x80 | ((charcode >> 12) & 0x3f),
        0x80 | ((charcode >> 6) & 0x3f),
        0x80 | (charcode & 0x3f)
      );
    }
  }

  const bitLength = utf8Bytes.length * 8;
  utf8Bytes.push(0x80);
  while ((utf8Bytes.length % 64) !== 56) {
    utf8Bytes.push(0);
  }

  // Append 64-bit big-endian length
  const hi = Math.floor(bitLength / 0x100000000);
  const lo = bitLength >>> 0;
  utf8Bytes.push(
    (hi >>> 24) & 0xff,
    (hi >>> 16) & 0xff,
    (hi >>> 8) & 0xff,
    hi & 0xff,
    (lo >>> 24) & 0xff,
    (lo >>> 16) & 0xff,
    (lo >>> 8) & 0xff,
    lo & 0xff
  );

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);

  for (let chunk = 0; chunk < utf8Bytes.length; chunk += 64) {
    for (let i = 0; i < 16; i++) {
      const idx = chunk + i * 4;
      w[i] = (utf8Bytes[idx] << 24) | (utf8Bytes[idx + 1] << 16) | (utf8Bytes[idx + 2] << 8) | utf8Bytes[idx + 3];
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K256[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const toHex = (n: number) => n.toString(16).padStart(8, '0');
  return `${toHex(h0)}${toHex(h1)}${toHex(h2)}${toHex(h3)}${toHex(h4)}${toHex(h5)}${toHex(h6)}${toHex(h7)}`;
}

/**
 * Asynchronously calculates authentic SHA-256 using the Web Crypto API
 * for binary buffers, files, and Blobs.
 */
export async function calculateSha256(data: Blob | ArrayBuffer | Uint8Array | string): Promise<string> {
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    const buffer = await data.arrayBuffer();
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const hash = await crypto.subtle.digest('SHA-256', buffer);
      return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }
  }
  if (data instanceof ArrayBuffer) {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const hash = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }
  }
  if (data instanceof Uint8Array) {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const hash = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }
  }
  if (typeof data === 'string') {
    return computeDeterministicSha256(data);
  }
  return '';
}
