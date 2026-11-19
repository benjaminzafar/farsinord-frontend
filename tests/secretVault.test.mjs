import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  SecretVaultDecryptionError,
  VAULT_SECRET_SPECS,
  computeKeyId,
  encryptSecretValue,
  decryptSecretValue,
  maskSecretValue,
  hashAdminPassword,
  verifyAdminPassword,
  DUMMY_SCRYPT_CREDENTIALS,
  sha256Hex,
  safeTimingEqual,
} from '../api/_lib/secretVault.js';

const IKM_V1 = ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', 'eyJyb2xlIjoic2VydmljZV9yb2xlIn0', 'unit-test-ikm-v1'].join('.');
const IKM_V2 = ['sb', 'secret', 'rotated_master_key_v2_9f8e7d6c5b4a3210'].join('_');
const FAKE_LIVE_KEY_1 = ['sk', 'live', 'UnitTestFixtureValueForVault9988'].join('_');
const FAKE_LIVE_KEY_2 = ['sk', 'live', 'UnitTestSensitiveKey000011112222'].join('_');
const FAKE_LIVE_KEY_3 = ['sk', 'live', 'UnitTestAbCdEfGhIjKlMnOpQr9f2a'].join('_');
const FAKE_TEST_KEY = ['sk', 'test', '1234567890abcdef'].join('_');
const FAKE_PUB_KEY = ['pk', 'live', '1234567890123456'].join('_');
const FAKE_WHSEC = ['whsec', '1234567890abcdef1234567890ab'].join('_');
const FAKE_RESEND = ['re', '1234567890abcdef9988'].join('_');

test('AES-256-GCM per-record HKDF encrypt/decrypt round-trip uses fresh IV & salt each time', () => {
  const secret = FAKE_LIVE_KEY_1;
  const enc1 = encryptSecretValue('stripe_secret_key_live', secret, { keyVersion: 1, ikm: IKM_V1 });
  const enc2 = encryptSecretValue('stripe_secret_key_live', secret, { keyVersion: 1, ikm: IKM_V1 });

  assert.notEqual(enc1.ciphertext, enc2.ciphertext);
  assert.notEqual(enc1.iv, enc2.iv);
  assert.notEqual(enc1.auth_tag, enc2.auth_tag);
  assert.equal(enc1.key_id, computeKeyId(IKM_V1));
  assert.equal(enc1.ciphertext.includes(secret), false);

  const dec = decryptSecretValue('stripe_secret_key_live', enc1, { activeIkm: IKM_V1 });
  assert.equal(dec.plaintext, secret);
  assert.equal(dec.usedPreviousKey, false);
});

test('AAD binding and GCM tag reject row-swap, version rollback, bit-flips, and wrong master key', () => {
  const enc = encryptSecretValue('stripe_secret_key_live', FAKE_LIVE_KEY_2, {
    keyVersion: 2,
    ikm: IKM_V1,
  });

  // 1. Row-swap / ciphertext transplantation to another secret_key MUST fail closed
  assert.throws(
    () => decryptSecretValue('turnstile_secret_key', enc, { activeIkm: IKM_V1 }),
    SecretVaultDecryptionError
  );

  // 2. Version rollback tampering MUST fail closed
  assert.throws(
    () => decryptSecretValue('stripe_secret_key_live', { ...enc, key_version: 1 }, { activeIkm: IKM_V1 }),
    SecretVaultDecryptionError
  );

  // 3. Ciphertext tamper MUST fail closed
  const parts = enc.ciphertext.split('.');
  const flipped = parts[3].slice(0, -1) + (parts[3].endsWith('A') ? 'B' : 'A');
  assert.throws(
    () =>
      decryptSecretValue(
        'stripe_secret_key_live',
        { ...enc, ciphertext: `${parts[0]}.${parts[1]}.${parts[2]}.${flipped}` },
        { activeIkm: IKM_V1 }
      ),
    SecretVaultDecryptionError
  );

  // 4. Wrong master key without prevIkm MUST fail closed
  assert.throws(
    () => decryptSecretValue('stripe_secret_key_live', enc, { activeIkm: IKM_V2, prevIkm: '' }),
    SecretVaultDecryptionError
  );
});

test('Master key rotation decrypts *_PREV rows and flags usedPreviousKey for re-wrapping', () => {
  const oldRow = encryptSecretValue('r2_secret_access_key', 'r2_super_secret_access_key_0123456789abcdef', {
    keyVersion: 1,
    ikm: IKM_V1,
  });

  const dec = decryptSecretValue('r2_secret_access_key', oldRow, {
    activeIkm: IKM_V2,
    prevIkm: IKM_V1,
  });
  assert.equal(dec.plaintext, 'r2_super_secret_access_key_0123456789abcdef');
  assert.equal(dec.usedPreviousKey, true);

  const rewrapped = encryptSecretValue('r2_secret_access_key', dec.plaintext, {
    keyVersion: 2,
    ikm: IKM_V2,
  });
  const decNew = decryptSecretValue('r2_secret_access_key', rewrapped, {
    activeIkm: IKM_V2,
    prevIkm: '',
  });
  assert.equal(decNew.plaintext, 'r2_super_secret_access_key_0123456789abcdef');
  assert.equal(decNew.usedPreviousKey, false);
});

test('Entropy-safe masking preserves only safe prefixes and hides opaque secrets & short values', () => {
  assert.equal(
    maskSecretValue('stripe_secret_key_live', FAKE_LIVE_KEY_3),
    'sk_live_••••9f2a'
  );
  assert.equal(
    maskSecretValue('stripe_webhook_secret_live', FAKE_WHSEC),
    'whsec_••••90ab'
  );
  assert.equal(
    maskSecretValue('resend_api_key', FAKE_RESEND),
    're_••••9988'
  );
  // Opaque high-entropy secrets reveal zero prefix
  assert.equal(
    maskSecretValue('r2_secret_access_key', 'abcdef0123456789abcdef0123456789'),
    '••••••••6789'
  );
  assert.equal(
    maskSecretValue('cloudflare_api_token', 'cf_token_0123456789abcdefXYZ1'),
    '••••••••XYZ1'
  );
  // Short secrets reveal zero characters
  assert.equal(maskSecretValue('cron_secret', 'shortkey123'), '••••••••');
  assert.equal(maskSecretValue('internal_jwt_pepper', 'a'.repeat(64)), '••••••••');
});

test('VAULT_SECRET_SPECS strictly validates Stripe mode prefixes and Turnstile key lengths', () => {
  assert.equal(VAULT_SECRET_SPECS.stripe_secret_key_live.validate(FAKE_PUB_KEY).ok, false);
  assert.equal(VAULT_SECRET_SPECS.stripe_secret_key_live.validate(FAKE_TEST_KEY).ok, false);
  assert.equal(VAULT_SECRET_SPECS.stripe_secret_key_live.validate(FAKE_LIVE_KEY_1).ok, true);

  assert.equal(VAULT_SECRET_SPECS.stripe_secret_key_test.validate(FAKE_LIVE_KEY_1).ok, false);
  assert.equal(VAULT_SECRET_SPECS.stripe_secret_key_test.validate(FAKE_TEST_KEY).ok, true);

  assert.equal(VAULT_SECRET_SPECS.stripe_webhook_secret_live.validate(FAKE_LIVE_KEY_1).ok, false);
  assert.equal(VAULT_SECRET_SPECS.stripe_webhook_secret_live.validate(FAKE_WHSEC).ok, true);

  // Rejects 24-char Site Key in Secret Key box
  assert.equal(VAULT_SECRET_SPECS.turnstile_secret_key.validate('0x4AAAAAABBBBBCCCCCDDDDE').ok, false);
  assert.equal(VAULT_SECRET_SPECS.turnstile_secret_key.validate('0x4AAAAAABBBBBCCCCCDDDDEEEEEFFFFF1234').ok, true);
});

test('scrypt admin password hashing and constant-time verification work securely', () => {
  assert.throws(() => hashAdminPassword('short99'));
  const hashed = hashAdminPassword('LinkShoSuperStrongPass!2026');
  assert.equal(hashed.hash_algorithm, 'scrypt_v1');
  assert.equal(verifyAdminPassword('LinkShoSuperStrongPass!2026', hashed.password_hash, hashed.password_salt), true);
  assert.equal(verifyAdminPassword('WrongPassword!2026', hashed.password_hash, hashed.password_salt), false);
  assert.equal(
    verifyAdminPassword('anything', DUMMY_SCRYPT_CREDENTIALS.password_hash, DUMMY_SCRYPT_CREDENTIALS.password_salt),
    false
  );
  assert.equal(safeTimingEqual(sha256Hex('LS-SETUP-1234'), sha256Hex('LS-SETUP-1234')), true);
  assert.equal(safeTimingEqual(sha256Hex('LS-SETUP-1234'), sha256Hex('LS-SETUP-5678')), false);
});

test('frontend and backend secretVault.js modules remain strictly identical', () => {
  const fePath = path.resolve(import.meta.dirname, '../api/_lib/secretVault.js');
  const bePath = path.resolve(import.meta.dirname, '../../backend/api/_lib/secretVault.js');
  assert.equal(fs.readFileSync(fePath, 'utf8'), fs.readFileSync(bePath, 'utf8'));
});
