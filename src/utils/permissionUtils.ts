/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppDetails, AppPermissionGroup } from '../types';

export interface PermissionCategoryMeta {
  id: 'camera' | 'location' | 'microphone' | 'telephone' | 'storage' | 'other';
  label: string;
  emoji: string;
  defaultPlaceholder: string;
  examplePoints: string[];
}

export const PERMISSION_CATEGORIES: PermissionCategoryMeta[] = [
  {
    id: 'camera',
    label: 'Camera',
    emoji: '📷',
    defaultPlaceholder: 'e.g. take pictures and videos, scan QR codes (comma or enter to separate)',
    examplePoints: ['take pictures and videos'],
  },
  {
    id: 'location',
    label: 'Location',
    emoji: '📍',
    defaultPlaceholder: 'e.g. access precise location only in foreground, access approximate location',
    examplePoints: [
      'access precise location only in the foreground',
      'access approximate location only in the foreground',
    ],
  },
  {
    id: 'microphone',
    label: 'Microphone',
    emoji: '🎙️',
    defaultPlaceholder: 'e.g. record audio, voice search',
    examplePoints: ['record audio'],
  },
  {
    id: 'telephone',
    label: 'Telephone',
    emoji: '📞',
    defaultPlaceholder: 'e.g. directly call phone numbers, read phone status and identity',
    examplePoints: ['directly call phone numbers', 'read phone status and identity'],
  },
  {
    id: 'storage',
    label: 'Storage',
    emoji: '🖼️',
    defaultPlaceholder: 'e.g. read the contents of your shared storage, save media',
    examplePoints: ['read the contents of your shared storage'],
  },
  {
    id: 'other',
    label: 'Other',
    emoji: '❓',
    defaultPlaceholder: 'e.g. Advertising ID permission, run foreground service, view Wi-Fi connections',
    examplePoints: [
      'have full network access',
      'view network connections',
      'prevent phone from sleeping',
      'run at startup',
    ],
  },
];

/**
 * Parses user input where points can be separated by comma or newlines.
 * Cleans up leading bullets (•, -, *) and whitespace.
 */
export function parseBulletPoints(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  return text
    .split(/[\r\n,]+/)
    .map(p => p.trim().replace(/^[•\-\*]\s*/, ''))
    .filter(p => p.length > 0);
}

/**
 * Formats a list of points back into newline-separated or comma-separated string for editing.
 */
export function formatBulletPoints(items: string[]): string {
  if (!items || !Array.isArray(items)) return '';
  return items.join('\n');
}

/**
 * Intelligently extracts structured permission groups from an app object,
 * with full fallback for legacy un-grouped string lists.
 */
export function extractPermissionGroups(app?: Partial<AppDetails> | null): AppPermissionGroup[] {
  if (!app) return [];

  // 1. Direct permissionGroups on root or dataSafety
  const existingGroups: AppPermissionGroup[] = (
    (app.permissionGroups && Array.isArray(app.permissionGroups) && app.permissionGroups.length > 0)
      ? app.permissionGroups
      : (app.dataSafety?.permissionGroups && Array.isArray(app.dataSafety.permissionGroups) && app.dataSafety.permissionGroups.length > 0)
        ? app.dataSafety.permissionGroups
        : []
  );

  if (existingGroups.length > 0) {
    // Clean and return only groups that have valid items
    return existingGroups
      .map(g => ({
        id: g.id || 'other',
        name: g.name || 'Other',
        items: Array.isArray(g.items) ? g.items.map(i => String(i).trim()).filter(Boolean) : [],
      }))
      .filter(g => g.items.length > 0);
  }

  // 2. Legacy fallback from flat array / string
  const rawList: string[] = (
    (app.dataSafety?.permissions && Array.isArray(app.dataSafety.permissions))
      ? app.dataSafety.permissions
      : (app.permissions && Array.isArray(app.permissions))
        ? app.permissions
        : ((app as any)?.permissionsRequired && Array.isArray((app as any).permissionsRequired))
          ? (app as any).permissionsRequired
          : []
  );

  if (rawList.length === 0) return [];

  const camera: string[] = [];
  const location: string[] = [];
  const microphone: string[] = [];
  const telephone: string[] = [];
  const storage: string[] = [];
  const other: string[] = [];

  rawList.forEach(rawItem => {
    if (!rawItem) return;
    const str = String(rawItem).trim().replace(/^[•\-\*]\s*/, '');
    if (!str) return;

    const lower = str.toLowerCase();

    // Check if it's explicitly formatted like "Camera: take pictures" or "Camera - take pictures"
    if (lower.startsWith('camera:') || lower.startsWith('camera -') || lower.includes('camera')) {
      const clean = str.replace(/^camera\s*[:-]\s*/i, '').trim();
      camera.push(clean || 'take pictures and videos');
    } else if (lower.startsWith('location:') || lower.startsWith('location -') || lower.includes('location') || lower.includes('gps')) {
      const clean = str.replace(/^location\s*[:-]\s*/i, '').trim();
      location.push(clean || 'access precise location');
    } else if (lower.startsWith('microphone:') || lower.startsWith('microphone -') || lower.includes('microphone') || lower.includes('audio recording') || lower.includes('record audio')) {
      const clean = str.replace(/^microphone\s*[:-]\s*/i, '').trim();
      microphone.push(clean || 'record audio');
    } else if (lower.startsWith('telephone:') || lower.startsWith('phone:') || lower.includes('phone') || lower.includes('call') || lower.includes('telephony')) {
      const clean = str.replace(/^(telephone|phone)\s*[:-]\s*/i, '').trim();
      telephone.push(clean || 'read phone status and identity');
    } else if (lower.startsWith('storage:') || lower.startsWith('storage -') || lower.includes('storage') || lower.includes('photos') || lower.includes('files')) {
      const clean = str.replace(/^storage\s*[:-]\s*/i, '').trim();
      storage.push(clean || 'read the contents of shared storage');
    } else {
      other.push(str);
    }
  });

  const result: AppPermissionGroup[] = [];
  if (camera.length > 0) result.push({ id: 'camera', name: 'Camera', items: camera });
  if (location.length > 0) result.push({ id: 'location', name: 'Location', items: location });
  if (microphone.length > 0) result.push({ id: 'microphone', name: 'Microphone', items: microphone });
  if (telephone.length > 0) result.push({ id: 'telephone', name: 'Telephone', items: telephone });
  if (storage.length > 0) result.push({ id: 'storage', name: 'Storage', items: storage });
  if (other.length > 0) result.push({ id: 'other', name: 'Other', items: other });

  return result;
}

/**
 * Flatten permission groups into an array of readable strings for legacy consumers
 */
export function flattenPermissionGroups(groups: AppPermissionGroup[]): string[] {
  const result: string[] = [];
  groups.forEach(g => {
    g.items.forEach(item => {
      const clean = item.trim();
      if (!clean) return;
      if (clean.toLowerCase() === 'no access required') return;
      if (g.id === 'other') {
        result.push(clean);
      } else {
        result.push(`${g.name}: ${clean}`);
      }
    });
  });
  return result;
}

/**
 * Triggers native browser prompt to request microphone permission
 * without altering or disturbing the UI.
 */
export async function requestBrowserMicrophonePermission(): Promise<'granted' | 'denied' | 'prompt' | null> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return null;

  // 1. Check if Permissions API is supported
  try {
    if (navigator.permissions && navigator.permissions.query) {
      const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      if (status.state === 'granted') {
        return 'granted';
      }
      if (status.state === 'denied') {
        return 'denied';
      }
    }
  } catch {
    // Some browsers do not support query({ name: 'microphone' })
  }

  // 2. Trigger native browser permission dialog via getUserMedia
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return 'granted';
    } catch (err: any) {
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        return 'denied';
      }
      return null;
    }
  }

  return null;
}

/**
 * Gets current browser microphone permission status without popping prompt
 */
export async function getBrowserMicrophonePermissionStatus(): Promise<'granted' | 'denied' | 'prompt' | null> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return null;
  try {
    if (navigator.permissions && navigator.permissions.query) {
      const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      return status.state;
    }
  } catch {}
  return null;
}

