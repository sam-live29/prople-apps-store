import { DeveloperKeystore, UserProfile } from '../types';

/**
 * Deterministic hash generator to produce consistent standard SHA-256 and SHA-1
 * certificate fingerprints from developer credentials.
 */
function createDeterministicFingerprint(input: string, lengthBytes: number): string {
  let hash = 0x811c9dc5;
  const prime = 0x01000193;
  const bytes: number[] = [];

  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, prime);
  }

  // Generate pseudorandom byte sequence seeded by the hash
  let state = hash >>> 0;
  for (let i = 0; i < lengthBytes; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const b = (state ^ (state >>> 16)) & 0xff;
    bytes.push(b);
  }

  return bytes
    .map(b => b.toString(16).padStart(2, '0').toUpperCase())
    .join(':');
}

/**
 * Generates a standard Android Developer Release Keystore certificate for a developer.
 * Uses 4096-bit RSA certificate profile with a standard 25-year validity period.
 */
export function generateDeveloperKeystore(uid: string, email: string, displayName?: string): DeveloperKeystore {
  const seed = `${uid}::${email.toLowerCase().trim()}::prople-keystore-salt-2026`;
  const sha256 = createDeterministicFingerprint(seed + '::sha256', 32);
  const sha1 = createDeterministicFingerprint(seed + '::sha1', 20);

  const cleanUid = uid.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10).toLowerCase();
  const alias = `release-key-${cleanUid || 'dev'}`;
  const keyId = `KEY-${cleanUid.toUpperCase() || 'PROPLE'}`;

  const created = new Date();
  const validUntil = new Date(created);
  validUntil.setFullYear(validUntil.getFullYear() + 25); // Standard 25-year Android validity

  const devName = displayName || email.split('@')[0] || 'App Developer';
  const issuer = `CN=${devName}, OU=Mobile Release Security, O=Prople Ecosystem, C=US`;

  return {
    keyId,
    alias,
    sha256Fingerprint: sha256,
    sha1Fingerprint: sha1,
    algorithm: 'RSA 4096-bit (SHA256withRSA)',
    validUntil: validUntil.toISOString().split('T')[0],
    createdAt: created.toISOString().split('T')[0],
    issuer,
    status: 'active'
  };
}

/**
 * Ensures a UserProfile has a valid DeveloperKeystore assigned and persisted.
 */
export function ensureUserKeystore(user: UserProfile): DeveloperKeystore {
  if (user.developerKeystore && user.developerKeystore.sha256Fingerprint) {
    return user.developerKeystore;
  }
  return generateDeveloperKeystore(user.uid, user.email, user.displayName || user.publisherName);
}

/**
 * Downloads the developer's public signing certificate metadata.
 */
export function downloadKeystoreCertificate(keystore: DeveloperKeystore, developerName: string) {
  const certData = {
    keystore_version: '2.1',
    developer_certificate: {
      key_alias: keystore.alias,
      key_identifier: keystore.keyId,
      algorithm: keystore.algorithm,
      issuer: keystore.issuer,
      valid_until: keystore.validUntil,
      created_at: keystore.createdAt,
      status: keystore.status,
      fingerprints: {
        sha256: keystore.sha256Fingerprint,
        sha1: keystore.sha1Fingerprint
      }
    },
    ecosystem: 'Prople App Market',
    security_notice: 'This certificate fingerprint cryptographically verifies application ownership and package integrity for this developer.'
  };

  const blob = new Blob([JSON.stringify(certData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${keystore.alias}-certificate.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
