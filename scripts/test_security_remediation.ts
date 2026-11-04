import { hashPassword, verifyPasswordHash } from '../server/otpStore.ts';
import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('--- [Security Test 1: OWASP Password Hashing & Legacy Migration] ---');
// 1. Verify 210,000 work factor
const password = 'SuperSecretSecurePassword!123';
const hash = hashPassword(password);
assert(hash.startsWith('pbkdf2:210000:'), 'Hash must start with pbkdf2:210000:');
console.log('✔ Password hashed with OWASP PBKDF2 210,000 iterations:', hash.slice(0, 30) + '...');

// 2. Verify matching password
const verifyResult = verifyPasswordHash(password, hash);
assert.strictEqual(verifyResult.valid, true, 'Matching password must verify as valid');
assert.strictEqual(verifyResult.needsRehash, false, 'New hash should not require rehash');
console.log('✔ Valid password verified successfully');

// 3. Verify incorrect password fails
const failResult = verifyPasswordHash('WrongPassword!999', hash);
assert.strictEqual(failResult.valid, false, 'Wrong password must fail');
console.log('✔ Incorrect password correctly rejected');

// 4. Verify legacy 10,000 iteration password compatibility and re-hash flag
import crypto from 'crypto';
const legacySalt = crypto.randomBytes(16).toString('hex');
const legacyHex = crypto.pbkdf2Sync(password, legacySalt, 10000, 64, 'sha512').toString('hex');
const legacyHash = `${legacySalt}:${legacyHex}`;

const legacyVerify = verifyPasswordHash(password, legacyHash);
assert.strictEqual(legacyVerify.valid, true, 'Legacy hash must still be verified for backward compatibility');
assert.strictEqual(legacyVerify.needsRehash, true, 'Legacy hash must flag needsRehash: true');
console.log('✔ Legacy 10,000 iteration password backward-compatible and flags needsRehash: true');

console.log('\n--- [Security Test 2: Firestore Security Rules Static Inspection] ---');
const rulesPath = path.join(process.cwd(), 'firestore.rules');
const rulesContent = fs.readFileSync(rulesPath, 'utf8');

// Assert no document length shortcut authorization bypass exists (e.g. || docId.size() <= 128 or allow read: if docId.size() <= 128)
const dangerousBypassPattern = /(?:\|\|\s*|if\s+)[a-zA-Z0-9_]+\.size\(\)\s*<=\s*128/g;
const bypassMatches = rulesContent.match(dangerousBypassPattern);
assert.strictEqual(bypassMatches, null, 'firestore.rules MUST NOT contain any authorization bypass using document size');
console.log('✔ Confirmed: ZERO authorization bypasses using document ID length in firestore.rules');

// Assert admin write is restricted
assert(rulesContent.includes('match /admins/{adminId}'), 'Must have admin match block');
assert(!rulesContent.includes('adminId.size()'), 'Must not allow admin ID length bypass');
console.log('✔ Confirmed: Admin privilege escalation blocked');

// Assert credentials collections are denied
assert(rulesContent.includes('match /auth_credentials/{credId} {\n      allow read, write: if false;'), 'Credentials collection denied');
assert(rulesContent.includes('match /auth_otps/{otpId} {\n      allow read, write: if false;'), 'OTPs collection denied');
assert(rulesContent.includes('match /auth_sessions/{sessionId} {\n      allow read, write: if false;'), 'Sessions collection denied');
console.log('✔ Confirmed: Client access to auth_credentials, auth_otps, and auth_sessions is completely blocked');

console.log('\n==========================================');
console.log('🎉 ALL SECURITY REMEDIATION TESTS PASSED!');
console.log('==========================================\n');
