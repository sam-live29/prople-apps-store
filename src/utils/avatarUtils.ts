/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Authentic Google / Gmail Account Avatar Palette.
 * These match Google's refined Material 500/600 avatar tones seen across Gmail, Google Drive,
 * and Google Contacts. Balanced, warm, high-contrast, avoiding harsh electric deep blues
 * or jarring neon colors that clash with dark or light backgrounds.
 */
export const GMAIL_AVATAR_PALETTE: Array<{ bg: string; text: string }> = [
  { bg: '#c5221f', text: '#ffffff' }, // Google Coral Red
  { bg: '#137333', text: '#ffffff' }, // Google Green
  { bg: '#b06000', text: '#ffffff' }, // Warm Ochre / Amber
  { bg: '#7627bb', text: '#ffffff' }, // Google Violet Purple
  { bg: '#007b83', text: '#ffffff' }, // Deep Teal
  { bg: '#b80672', text: '#ffffff' }, // Berry Pink
  { bg: '#0288d1', text: '#ffffff' }, // Soft Sky Cerulean
  { bg: '#00897b', text: '#ffffff' }, // Persian Green
  { bg: '#d84315', text: '#ffffff' }, // Warm Terracotta
  { bg: '#5c6bc0', text: '#ffffff' }, // Soft Indigo Slate
  { bg: '#2e7d32', text: '#ffffff' }, // Medium Forest
  { bg: '#8e24aa', text: '#ffffff' }, // Amethyst Purple
];

/**
 * Deterministically retrieves a consistent Gmail avatar color based on user identifier
 * (email, name, or UID). Same user always gets the exact same color.
 */
export function getGmailAvatarColor(identifier?: string | null): { bg: string; text: string } {
  if (!identifier || typeof identifier !== 'string') {
    return GMAIL_AVATAR_PALETTE[0];
  }

  const clean = identifier.trim().toLowerCase();
  if (!clean) return GMAIL_AVATAR_PALETTE[0];

  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash * 31 + clean.charCodeAt(i)) >>> 0;
  }

  return GMAIL_AVATAR_PALETTE[hash % GMAIL_AVATAR_PALETTE.length];
}

/**
 * Extracts a single uppercase initial letter following Gmail profile convention:
 * Priority: Display Name -> Publisher Name -> Email local-part -> fallback 'U'.
 * Always searches for the first alphanumeric character.
 */
export function getAvatarInitial(name?: string | null, email?: string | null): string {
  const raw = (name || '').trim();
  const lower = raw.toLowerCase();
  const isExcluded = lower === 'sam' || lower === 'sammy' || lower === 'guest' || lower === 'user';
  const candidate = (!isExcluded ? raw : '') || (email || '').trim();
  if (!candidate) return 'U';

  // Search for the first alphanumeric character
  for (let i = 0; i < candidate.length; i++) {
    const char = candidate[i];
    if (/[a-zA-Z0-9]/.test(char)) {
      return char.toUpperCase();
    }
  }

  return candidate.charAt(0).toUpperCase() || 'U';
}

/**
 * Generates a friendly display name for greetings and profile cards:
 * If displayName or publisherName is set, returns that.
 * Otherwise, extracts the local-part from email (e.g. sahinurmolla1979@gmail.com -> Sahinurmolla1979)
 * instead of leaving an empty gap like "Hi, !". Defaults to "User" for un-logged in users.
 */
export function getFriendlyDisplayName(user?: { 
  displayName?: string | null; 
  publisherName?: string | null; 
  email?: string | null;
} | null): string {
  if (!user) return 'User';

  const isInvalid = (val?: string | null) => {
    if (!val) return true;
    const l = val.trim().toLowerCase();
    return l === 'sam' || l === 'sammy' || l === 'guest' || l === 'user' || l === 'undefined' || l === 'null';
  };

  const publisher = (user.publisherName || '').trim();
  if (publisher && !isInvalid(publisher)) return publisher;

  const display = (user.displayName || '').trim();
  if (display && !isInvalid(display)) return display;

  const email = (user.email || '').trim();
  if (email && email.includes('@')) {
    const localPart = email.split('@')[0].trim();
    if (localPart && !isInvalid(localPart)) {
      // Capitalize first letter of email username
      return localPart.charAt(0).toUpperCase() + localPart.slice(1);
    }
  }

  return 'User';
}
