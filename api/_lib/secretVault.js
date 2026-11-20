import crypto from 'node:crypto';

const PROJECT_SALT_SCOPE = 'bezbnymjcnmazdonfzky';
const VAULT_CACHE_TTL_MS = 45_000;
const PEPPER_CACHE_TTL_MS = 15_000;

export class SecretVaultDecryptionError extends Error {
  constructor(message, { secretKey = '', keyVersion = null } = {}) {
    super(message);
    this.name = 'SecretVaultDecryptionError';
    this.secretKey = secretKey;
    this.keyVersion = keyVersion;
  }
}

export function safeTimingEqual(a, b) {
  const bufA = Buffer.from(String(a ?? ''), 'utf8');
  const bufB = Buffer.from(String(b ?? ''), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
}

export function getMasterIkm() {
  return String(process.env.SECRETS_MASTER_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
}

export function getPreviousMasterIkm() {
  return String(process.env.SECRETS_MASTER_KEY_PREV || process.env.SUPABASE_SERVICE_ROLE_KEY_PREV || '').trim();
}

export function computeKeyId(ikm = getMasterIkm()) {
  const clean = String(ikm || '').trim();
  if (!clean) return '';
  return Buffer.from(
    crypto.hkdfSync(
      'sha256',
      Buffer.from(clean, 'utf8'),
      `linksho:v1:kid-salt:${PROJECT_SALT_SCOPE}`,
      'linksho:v1:kid',
      4
    )
  ).toString('hex');
}

function deriveKek(ikm) {
  return Buffer.from(
    crypto.hkdfSync(
      'sha256',
      Buffer.from(ikm, 'utf8'),
      `linksho:v1:kek-salt:${PROJECT_SALT_SCOPE}`,
      'linksho:v1:secrets-kek',
      32
    )
  );
}

function deriveRecordDek(kek, saltBuf, secretKey) {
  return Buffer.from(
    crypto.hkdfSync('sha256', kek, saltBuf, `linksho:v1:dek:${secretKey}`, 32)
  );
}

function deriveJwtBaseKey(ikm) {
  return Buffer.from(
    crypto.hkdfSync(
      'sha256',
      Buffer.from(ikm, 'utf8'),
      `linksho:v1:jwt-salt:${PROJECT_SALT_SCOPE}`,
      'linksho:v1:admin-jwt-base',
      32
    )
  );
}

/**
 * Encrypts a secret using AES-256-GCM with per-record HKDF-derived DEK
 * and AAD bound to (v1|secretKey|keyVersion|kid) to prevent row-swap/rollback.
 */
export function encryptSecretValue(secretKey, plaintext, { keyVersion = 1, ikm = getMasterIkm() } = {}) {
  const cleanIkm = String(ikm || '').trim();
  if (!cleanIkm) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY (or SECRETS_MASTER_KEY) is required to encrypt secrets.');
  }
  const cleanPlain = String(plaintext ?? '');
  if (!cleanPlain) {
    throw new Error('Cannot encrypt an empty secret value.');
  }
  const ver = Math.max(1, Math.floor(Number(keyVersion) || 1));
  const kid = computeKeyId(cleanIkm);
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const kek = deriveKek(cleanIkm);
  const dek = deriveRecordDek(kek, salt, secretKey);

  try {
    const aad = Buffer.from(`v1|${secretKey}|${ver}|${kid}`, 'utf8');
    const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);
    cipher.setAAD(aad);
    const ct = Buffer.concat([cipher.update(cleanPlain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      ciphertext: `v1.${kid}.${salt.toString('base64url')}.${ct.toString('base64url')}`,
      iv: iv.toString('base64url'),
      auth_tag: tag.toString('base64url'),
      key_id: kid,
      key_version: ver,
    };
  } finally {
    kek.fill(0);
    dek.fill(0);
  }
}

/**
 * Decrypts a vault row and verifies GCM auth tag + AAD binding.
 * Fails closed (throws SecretVaultDecryptionError) on tamper, key mismatch, or corruption.
 */
export function decryptSecretValue(
  secretKey,
  row,
  { activeIkm = getMasterIkm(), prevIkm = getPreviousMasterIkm() } = {}
) {
  if (!row || typeof row !== 'object') {
    throw new SecretVaultDecryptionError('Missing encrypted secret record.', { secretKey });
  }
  const parts = String(row.ciphertext || '').split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new SecretVaultDecryptionError('Malformed encrypted secret envelope.', {
      secretKey,
      keyVersion: row.key_version,
    });
  }
  const [, kid, saltB64, ctB64] = parts;
  const activeKid = activeIkm ? computeKeyId(activeIkm) : '';
  const prevKid = prevIkm ? computeKeyId(prevIkm) : '';

  let selectedIkm = '';
  if (activeIkm && kid === activeKid) {
    selectedIkm = activeIkm;
  } else if (prevIkm && kid === prevKid) {
    selectedIkm = prevIkm;
  } else {
    throw new SecretVaultDecryptionError(
      'Master key mismatch: cannot decrypt secret with current SUPABASE_SERVICE_ROLE_KEY.',
      { secretKey, keyVersion: row.key_version }
    );
  }

  const salt = Buffer.from(saltB64, 'base64url');
  const iv = Buffer.from(String(row.iv || ''), 'base64url');
  const tag = Buffer.from(String(row.auth_tag || ''), 'base64url');
  const ct = Buffer.from(ctB64, 'base64url');

  if (salt.length !== 16 || iv.length !== 12 || tag.length !== 16) {
    throw new SecretVaultDecryptionError('Invalid cryptographic parameters in vault record.', {
      secretKey,
      keyVersion: row.key_version,
    });
  }

  const ver = Math.max(1, Math.floor(Number(row.key_version) || 1));
  const kek = deriveKek(selectedIkm);
  const dek = deriveRecordDek(kek, salt, secretKey);

  try {
    const aad = Buffer.from(`v1|${secretKey}|${ver}|${kid}`, 'utf8');
    const decipher = crypto.createDecipheriv('aes-256-gcm', dek, iv);
    decipher.setAAD(aad);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return {
      plaintext: pt.toString('utf8'),
      keyId: kid,
      usedPreviousKey: selectedIkm === prevIkm && kid !== activeKid,
    };
  } catch {
    throw new SecretVaultDecryptionError('Secret authentication tag verification failed.', {
      secretKey,
      keyVersion: ver,
    });
  } finally {
    kek.fill(0);
    dek.fill(0);
  }
}

export function extractEnvelopeKeyId(ciphertext) {
  const parts = String(ciphertext || '').split('.');
  return parts.length === 4 && parts[0] === 'v1' ? parts[1] : '';
}

// ============================================================================
// Password Hashing for Admin Credentials (salted scrypt_v1 + timing-safe verify)
// ============================================================================

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 };

export function hashAdminPassword(password) {
  const clean = String(password || '');
  if (clean.length < 10) {
    throw new Error('رمز عبور مدیر باید حداقل ۱۰ کاراکتر باشد.');
  }
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(clean, salt, 64, SCRYPT_PARAMS);
  return {
    password_hash: derived.toString('base64url'),
    password_salt: salt.toString('base64url'),
    hash_algorithm: 'scrypt_v1',
  };
}

export function verifyAdminPassword(password, storedHashB64, storedSaltB64) {
  try {
    const salt = Buffer.from(String(storedSaltB64 || ''), 'base64url');
    const expected = Buffer.from(String(storedHashB64 || ''), 'base64url');
    if (salt.length < 16 || expected.length !== 64) return false;
    const actual = crypto.scryptSync(String(password || ''), salt, 64, SCRYPT_PARAMS);
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

// Fixed valid scrypt salt+hash used to equalize login timing when email is not found
export const DUMMY_SCRYPT_CREDENTIALS = Object.freeze({
  password_salt: 'AAAAAAAAAAAAAAAAAAAAAA',
  password_hash:
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
});

// ============================================================================
// Entropy-Safe Masking & Allowlisted Secret Specifications
// ============================================================================

function tail4(str) {
  return str.length >= 16 ? str.slice(-4) : '';
}

export function maskSecretValue(secretKey, plaintext) {
  const v = String(plaintext || '').trim();
  if (!v) return '';
  if (secretKey === 'internal_jwt_pepper') return '••••••••';
  if (secretKey === 'notification_from_email') {
    return v.slice(0, 80); // Sender display name/email is non-secret config
  }
  if (v.length < 16) return '••••••••';

  const last4 = tail4(v);
  if (secretKey === 'stripe_secret_key_live' || secretKey === 'stripe_secret_key_test') {
    const m = v.match(/^((?:sk|rk)_(?:live|test)_)/);
    return m ? `${m[1]}••••${last4}` : `••••••••${last4}`;
  }
  if (secretKey === 'stripe_webhook_secret_live' || secretKey === 'stripe_webhook_secret_test') {
    return v.startsWith('whsec_') ? `whsec_••••${last4}` : `••••••••${last4}`;
  }
  if (secretKey === 'resend_api_key') {
    return v.startsWith('re_') ? `re_••••${last4}` : `••••••••${last4}`;
  }
  if (secretKey === 'turnstile_secret_key' || secretKey === 'r2_access_key_id') {
    return `${v.slice(0, 4)}••••${last4}`;
  }
  // High-entropy opaque secrets (R2 Secret Access Key, Cloudflare API Token, Cron Secret):
  // never expose prefix
  return `••••••••${last4}`;
}

export const VAULT_SECRET_SPECS = Object.freeze({
  stripe_secret_key_live: {
    label: 'کلید محرمانه Stripe (حالت عملیاتی Live)',
    envKeys: ['STRIPE_SECRET_KEY_LIVE', 'STRIPE_SECRET_KEY'],
    envMatchesMode: (val) => /^(sk|rk)_live_/.test(val),
    validate(val) {
      if (val.startsWith('pk_')) {
        return { ok: false, error: 'کلید عمومی (pk_) را در فیلد کلید محرمانه وارد نکنید. کلید باید با sk_live_ یا rk_live_ شروع شود.' };
      }
      if (/^(sk|rk)_test_/.test(val)) {
        return { ok: false, error: 'این کلید آزمایشی (Test) است. آن را در بخش «حالت آزمایشی Test» وارد کنید.' };
      }
      if (!/^(sk|rk)_live_[A-Za-z0-9]{16,}$/.test(val)) {
        return { ok: false, error: 'فرمت کلید عملیاتی Stripe نامعتبر است (باید با sk_live_ یا rk_live_ شروع شود).' };
      }
      return { ok: true, metadata: { stripeKeyMode: 'live' } };
    },
  },
  stripe_secret_key_test: {
    label: 'کلید محرمانه Stripe (حالت آزمایشی Test)',
    envKeys: ['STRIPE_SECRET_KEY_TEST', 'STRIPE_SECRET_KEY'],
    envMatchesMode: (val) => /^(sk|rk)_test_/.test(val),
    validate(val) {
      if (val.startsWith('pk_')) {
        return { ok: false, error: 'کلید عمومی (pk_) را در فیلد کلید محرمانه وارد نکنید. کلید باید با sk_test_ شروع شود.' };
      }
      if (/^(sk|rk)_live_/.test(val)) {
        return { ok: false, error: 'این کلید عملیاتی (Live) است. آن را در بخش «حالت عملیاتی Live» وارد کنید.' };
      }
      if (!/^(sk|rk)_test_[A-Za-z0-9]{16,}$/.test(val)) {
        return { ok: false, error: 'فرمت کلید آزمایشی Stripe نامعتبر است (باید با sk_test_ یا rk_test_ شروع شود).' };
      }
      return { ok: true, metadata: { stripeKeyMode: 'test' } };
    },
  },
  stripe_webhook_secret_live: {
    label: 'کلید امضای وب‌هوک Stripe (Live)',
    envKeys: ['STRIPE_WEBHOOK_SECRET_LIVE', 'STRIPE_WEBHOOK_SECRET'],
    validate(val) {
      if (!/^whsec_[A-Za-z0-9]{16,}$/.test(val)) {
        return { ok: false, error: 'فرمت Webhook Secret نامعتبر است (باید با whsec_ شروع شود).' };
      }
      return { ok: true, metadata: { stripeKeyMode: 'live' } };
    },
  },
  stripe_webhook_secret_test: {
    label: 'کلید امضای وب‌هوک Stripe (Test)',
    envKeys: ['STRIPE_WEBHOOK_SECRET_TEST', 'STRIPE_WEBHOOK_SECRET'],
    validate(val) {
      if (!/^whsec_[A-Za-z0-9]{16,}$/.test(val)) {
        return { ok: false, error: 'فرمت Webhook Secret آزمایشی نامعتبر است (باید با whsec_ شروع شود).' };
      }
      return { ok: true, metadata: { stripeKeyMode: 'test' } };
    },
  },
  turnstile_secret_key: {
    label: 'کلید محرمانه Cloudflare Turnstile',
    envKeys: ['TURNSTILE_SECRET_KEY'],
    validate(val) {
      if (val.length < 28) {
        return { ok: false, error: 'مقدار واردشده شبیه Site Key است نه Secret Key! کلید محرمانه Turnstile حداقل ۲۸ کاراکتر دارد.' };
      }
      if (!/^[0-9A-Za-z_-]{28,96}$/.test(val)) {
        return { ok: false, error: 'فرمت Secret Key کلودفلر Turnstile نامعتبر است.' };
      }
      return { ok: true, metadata: {} };
    },
  },
  r2_access_key_id: {
    label: 'شناسه کلید دسترسی Cloudflare R2 (Access Key ID)',
    envKeys: ['R2_ACCESS_KEY_ID', 'CLOUDFLARE_R2_ACCESS_KEY_ID'],
    validate(val) {
      if (!/^[A-Za-z0-9_-]{16,128}$/.test(val)) {
        return { ok: false, error: 'فرمت R2 Access Key ID نامعتبر است (حداقل ۱۶ کاراکتر مجاز).' };
      }
      return { ok: true, metadata: {} };
    },
  },
  r2_secret_access_key: {
    label: 'کلید محرمانه Cloudflare R2 (Secret Access Key)',
    envKeys: ['R2_SECRET_ACCESS_KEY', 'CLOUDFLARE_R2_SECRET_ACCESS_KEY'],
    validate(val) {
      if (!/^[A-Za-z0-9+/=_-]{24,160}$/.test(val)) {
        return { ok: false, error: 'فرمت R2 Secret Access Key نامعتبر است (حداقل ۲۴ کاراکتر).' };
      }
      return { ok: true, metadata: {} };
    },
  },
  cloudflare_api_token: {
    label: 'توکن API کلودفلر (Workers & D1)',
    envKeys: ['CLOUDFLARE_API_TOKEN'],
    validate(val) {
      if (!/^[A-Za-z0-9_-]{24,128}$/.test(val)) {
        return { ok: false, error: 'فرمت توکن API کلودفلر نامعتبر است (حداقل ۲۴ کاراکتر).' };
      }
      return { ok: true, metadata: {} };
    },
  },
  resend_api_key: {
    label: 'کلید API ایمیل Resend',
    envKeys: ['RESEND_API_KEY'],
    validate(val) {
      if (!/^re_[A-Za-z0-9_]{16,}$/.test(val)) {
        return { ok: false, error: 'فرمت کلید Resend نامعتبر است (باید با re_ شروع شود).' };
      }
      return { ok: true, metadata: {} };
    },
  },
  notification_from_email: {
    label: 'آدرس فرستنده ایمیل‌های سیستم',
    envKeys: ['NOTIFICATION_FROM_EMAIL'],
    validate(val) {
      if (val.length < 5 || val.length > 140 || !val.includes('@') || /[\r\n]/.test(val)) {
        return { ok: false, error: 'فرمت ایمیل فرستنده نامعتبر است (مثال: LinkSho <noreply@linksho.eu>).' };
      }
      return { ok: true, metadata: {} };
    },
  },
  cron_secret: {
    label: 'کلید امنیتی اجرای خودکار پاکسازی (CRON_SECRET)',
    envKeys: ['CRON_SECRET'],
    validate(val) {
      if (val.length < 24 || val.length > 160 || /\s/.test(val)) {
        return { ok: false, error: 'کلید Cron باید حداقل ۲۴ کاراکتر و بدون فاصله باشد.' };
      }
      return { ok: true, metadata: {} };
    },
  },
  internal_jwt_pepper: {
    label: 'فلفل امضای نشست مدیر (داخلی)',
    internalOnly: true,
    envKeys: [],
    validate(val) {
      if (!/^[a-f0-9]{64}$/i.test(val)) {
        return { ok: false, error: 'Invalid internal JWT pepper format.' };
      }
      return { ok: true, metadata: {} };
    },
  },
});

export function isVaultTableMissingError(error) {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || '');
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    msg.includes('app_encrypted_secrets') ||
    msg.includes('admin_credentials') ||
    msg.includes('admin_bootstrap_tokens')
  );
}

// ============================================================================
// Isolate-Scoped In-Memory Cache (Never placed on globalThis)
// ============================================================================

let vaultRowsCache = null; // Map<string, row>
let vaultRowsCacheExpiresAt = 0;
let vaultTableMissingFlag = false;

let pepperCache = null; // { pepperHex, pepperVersion, expiresAt }

export function invalidateSecretVaultCache() {
  vaultRowsCache = null;
  vaultRowsCacheExpiresAt = 0;
  pepperCache = null;
}

async function fetchAllVaultRows(supabase, { fresh = false } = {}) {
  const now = Date.now();
  if (!fresh && vaultRowsCache && now < vaultRowsCacheExpiresAt) {
    return { rows: vaultRowsCache, tableMissing: false };
  }
  if (!supabase || !getMasterIkm()) {
    return { rows: new Map(), tableMissing: false };
  }

  const { data, error } = await supabase
    .from('app_encrypted_secrets')
    .select('secret_key, ciphertext, iv, auth_tag, key_version, masked_value, metadata, is_configured, updated_at, updated_by');

  if (error) {
    if (isVaultTableMissingError(error)) {
      vaultTableMissingFlag = true;
      return { rows: new Map(), tableMissing: true };
    }
    // Network/auth failure (e.g., offline unit tests with dummy service role key)
    return { rows: new Map(), tableMissing: false, queryError: error };
  }

  vaultTableMissingFlag = false;
  const map = new Map();
  for (const row of data || []) {
    if (row?.secret_key && row.is_configured !== false) {
      map.set(row.secret_key, row);
    }
  }
  vaultRowsCache = map;
  vaultRowsCacheExpiresAt = now + VAULT_CACHE_TTL_MS;
  return { rows: map, tableMissing: false };
}

function readEnvFallback(secretKey) {
  const spec = VAULT_SECRET_SPECS[secretKey];
  if (!spec || !Array.isArray(spec.envKeys)) return '';
  for (const envName of spec.envKeys) {
    const val = String(process.env[envName] || '').trim();
    if (!val) continue;
    if (typeof spec.envMatchesMode === 'function' && !spec.envMatchesMode(val)) {
      continue;
    }
    return val;
  }
  return '';
}

/**
 * Resolves a single secret with strict precedence:
 *   1. Encrypted DB Vault (app_encrypted_secrets) — throws on tamper/decryption failure!
 *   2. Legacy Vercel Environment Variable fallback (optional, default enabled)
 */
export async function getVaultSecret(supabase, secretKey, { fresh = false, allowEnvFallback = true } = {}) {
  const spec = VAULT_SECRET_SPECS[secretKey];
  if (!spec) {
    return { value: '', source: 'none', masked: '', updatedAt: null, metadata: {} };
  }

  const { rows } = await fetchAllVaultRows(supabase, { fresh });
  const row = rows.get(secretKey);

  if (row) {
    // Fail-closed: decryption error on an existing DB row MUST propagate (never silently downgrade)
    const { plaintext, usedPreviousKey } = decryptSecretValue(secretKey, row);
    return {
      value: plaintext,
      source: 'vault',
      masked: row.masked_value || maskSecretValue(secretKey, plaintext),
      updatedAt: row.updated_at || null,
      keyVersion: row.key_version || 1,
      metadata: row.metadata || {},
      usedPreviousKey,
    };
  }

  if (allowEnvFallback) {
    const envVal = readEnvFallback(secretKey);
    if (envVal) {
      return {
        value: envVal,
        source: 'env',
        masked: maskSecretValue(secretKey, envVal),
        updatedAt: null,
        keyVersion: null,
        metadata: {},
        usedPreviousKey: false,
      };
    }
  }

  return { value: '', source: 'none', masked: '', updatedAt: null, keyVersion: null, metadata: {}, usedPreviousKey: false };
}

/**
 * Validates, encrypts with AES-256-GCM + AAD, saves to app_encrypted_secrets,
 * records an audit row, invalidates isolate cache, and returns ONLY safe masked metadata.
 */
export async function saveVaultSecret(
  supabase,
  secretKey,
  plaintext,
  adminEmail = 'admin',
  { allowInternal = false, auditAction = 'set' } = {}
) {
  const spec = VAULT_SECRET_SPECS[secretKey];
  if (!spec || (spec.internalOnly && !allowInternal)) {
    return { ok: false, status: 400, error: 'کلید امنیتی درخواستی مجاز نیست.' };
  }
  if (!getMasterIkm()) {
    return {
      ok: false,
      status: 503,
      error: 'متغیر SUPABASE_SERVICE_ROLE_KEY روی سرور تنظیم نشده است.',
    };
  }

  const cleanPlain = String(plaintext || '').trim();
  if (!cleanPlain) {
    return { ok: false, status: 400, error: 'مقدار کلید نمی‌تواند خالی باشد.' };
  }

  const check = spec.validate(cleanPlain);
  if (!check.ok) {
    return { ok: false, status: 400, error: check.error };
  }

  // Determine next key_version safely
  const { data: existing, error: selErr } = await supabase
    .from('app_encrypted_secrets')
    .select('key_version')
    .eq('secret_key', secretKey)
    .maybeSingle();

  if (selErr) {
    if (isVaultTableMissingError(selErr)) {
      return {
        ok: false,
        status: 503,
        error: 'جدول خزانه رمزنگاری‌شده (app_encrypted_secrets) هنوز در Supabase ایجاد نشده است. لطفاً فایل SQL مهاجرت را یک‌بار اجرا کنید.',
      };
    }
    throw selErr;
  }

  const nextVersion = existing?.key_version ? Number(existing.key_version) + 1 : 1;
  const encrypted = encryptSecretValue(secretKey, cleanPlain, { keyVersion: nextVersion });
  const masked = maskSecretValue(secretKey, cleanPlain);
  const nowIso = new Date().toISOString();

  const { error: upsertErr } = await supabase.from('app_encrypted_secrets').upsert(
    {
      secret_key: secretKey,
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      auth_tag: encrypted.auth_tag,
      key_version: nextVersion,
      masked_value: masked,
      metadata: check.metadata || {},
      is_configured: true,
      updated_at: nowIso,
      updated_by: String(adminEmail || 'admin').slice(0, 160),
    },
    { onConflict: 'secret_key' }
  );

  if (upsertErr) throw upsertErr;

  // Best-effort audit record (never stores plaintext or ciphertext)
  try {
    await supabase.from('app_secrets_audit').insert({
      secret_key: secretKey,
      action: existing ? (auditAction === 'set' ? 'rotate' : auditAction) : auditAction,
      key_version: nextVersion,
      masked_value: masked,
      admin_email: String(adminEmail || 'admin').slice(0, 160),
    });
  } catch {
    // Non-fatal if audit table has not been created separately
  }

  invalidateSecretVaultCache();

  return {
    ok: true,
    secret: {
      secretKey,
      configured: true,
      vaultConfigured: true,
      source: 'vault',
      masked,
      keyVersion: nextVersion,
      metadata: check.metadata || {},
      updatedAt: nowIso,
    },
  };
}

export async function deleteVaultSecret(supabase, secretKey, adminEmail = 'admin') {
  const spec = VAULT_SECRET_SPECS[secretKey];
  if (!spec || spec.internalOnly) {
    return { ok: false, status: 400, error: 'امکان حذف این کلید وجود ندارد.' };
  }

  const { error } = await supabase
    .from('app_encrypted_secrets')
    .delete()
    .eq('secret_key', secretKey);

  if (error) {
    if (isVaultTableMissingError(error)) {
      return { ok: false, status: 503, error: 'جدول خزانه رمزنگاری‌شده هنوز ایجاد نشده است.' };
    }
    throw error;
  }

  try {
    await supabase.from('app_secrets_audit').insert({
      secret_key: secretKey,
      action: 'delete',
      key_version: 1,
      masked_value: '',
      admin_email: String(adminEmail || 'admin').slice(0, 160),
    });
  } catch {}

  invalidateSecretVaultCache();
  return { ok: true };
}

/**
 * Re-encrypts any secrets currently encrypted under *_PREV master key to the active master key.
 */
export async function rewrapAllVaultSecrets(supabase, adminEmail = 'admin') {
  const activeIkm = getMasterIkm();
  const prevIkm = getPreviousMasterIkm();
  if (!activeIkm) {
    return { ok: false, status: 503, error: 'کلید اصلی سرور تنظیم نشده است.' };
  }
  const activeKid = computeKeyId(activeIkm);
  const { rows, tableMissing } = await fetchAllVaultRows(supabase, { fresh: true });
  if (tableMissing) {
    return { ok: false, status: 503, error: 'جدول خزانه رمزنگاری‌شده هنوز ایجاد نشده است.' };
  }

  let rewrappedCount = 0;
  let remainingLegacyCount = 0;

  for (const [secretKey, row] of rows.entries()) {
    const rowKid = extractEnvelopeKeyId(row.ciphertext);
    if (rowKid === activeKid) continue;

    if (!prevIkm) {
      remainingLegacyCount += 1;
      continue;
    }

    const { plaintext } = decryptSecretValue(secretKey, row, { activeIkm, prevIkm });
    const nextVersion = Number(row.key_version || 1) + 1;
    const encrypted = encryptSecretValue(secretKey, plaintext, {
      keyVersion: nextVersion,
      ikm: activeIkm,
    });
    const { error } = await supabase
      .from('app_encrypted_secrets')
      .update({
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        auth_tag: encrypted.auth_tag,
        key_version: nextVersion,
        updated_at: new Date().toISOString(),
        updated_by: String(adminEmail || 'admin').slice(0, 160),
      })
      .eq('secret_key', secretKey);
    if (error) throw error;

    try {
      await supabase.from('app_secrets_audit').insert({
        secret_key: secretKey,
        action: 'rewrap',
        key_version: nextVersion,
        masked_value: row.masked_value || '',
        admin_email: String(adminEmail || 'admin').slice(0, 160),
      });
    } catch {}
    rewrappedCount += 1;
  }

  invalidateSecretVaultCache();
  return { ok: true, rewrappedCount, remainingLegacyCount };
}

/**
 * Returns ONLY non-secret masked status metadata for the Admin Panel.
 * NEVER decrypts any secret!
 */
export async function listVaultSecretsStatus(supabase) {
  const activeKid = computeKeyId();
  const { rows, tableMissing } = await fetchAllVaultRows(supabase, { fresh: true });
  const secrets = {};
  let needsRewrapCount = 0;

  for (const [secretKey, spec] of Object.entries(VAULT_SECRET_SPECS)) {
    if (spec.internalOnly) continue;
    const row = rows.get(secretKey);
    const envVal = readEnvFallback(secretKey);
    const vaultConfigured = Boolean(row);
    const envConfigured = Boolean(envVal);
    const rowKid = row ? extractEnvelopeKeyId(row.ciphertext) : '';
    const needsRewrap = Boolean(row && activeKid && rowKid && rowKid !== activeKid);
    if (needsRewrap) needsRewrapCount += 1;

    const source = vaultConfigured ? 'vault' : envConfigured ? 'env' : 'none';
    const masked = vaultConfigured
      ? row.masked_value || '••••••••'
      : envConfigured
        ? maskSecretValue(secretKey, envVal)
        : '';

    secrets[secretKey] = {
      secretKey,
      configured: source !== 'none',
      vaultConfigured,
      envConfigured,
      source,
      masked,
      keyVersion: row?.key_version || null,
      metadata: row?.metadata || {},
      updatedAt: row?.updated_at || null,
      updatedBy: row?.updated_by || null,
      needsRewrap,
    };
  }

  const pepperRow = rows.get('internal_jwt_pepper');
  return {
    vaultReady: !tableMissing && Boolean(activeKid),
    vaultTableMissing: tableMissing || vaultTableMissingFlag,
    activeKeyId: activeKid,
    hasMasterKeyOverride: Boolean(process.env.SECRETS_MASTER_KEY),
    needsRewrapCount,
    jwtPepperVersion: pepperRow?.key_version || 0,
    jwtPepperUpdatedAt: pepperRow?.updated_at || null,
    secrets,
  };
}

// ============================================================================
// Domain-Separated Admin JWT Signing Key + DB Pepper
// ============================================================================

export async function getAdminJwtSigningContext(
  supabase,
  { fresh = false, ensurePepper = false, adminEmail = 'system' } = {}
) {
  const baseIkm = String(process.env.ADMIN_JWT_SECRET || getMasterIkm() || '').trim();
  if (!baseIkm) {
    return { signingKey: null, pepperVersion: 0, hasDbPepper: false };
  }

  const baseKey = deriveJwtBaseKey(baseIkm);
  const now = Date.now();

  if (!fresh && pepperCache && now < pepperCache.expiresAt) {
    const signingKey = pepperCache.pepperHex
      ? Buffer.from(
          crypto.hkdfSync(
            'sha256',
            baseKey,
            Buffer.from(pepperCache.pepperHex, 'hex'),
            `linksho:v1:admin-jwt-sign:v${pepperCache.pepperVersion}`,
            32
          )
        )
      : baseKey;
    return {
      signingKey,
      pepperVersion: pepperCache.pepperVersion,
      hasDbPepper: Boolean(pepperCache.pepperHex),
    };
  }

  let pepperHex = '';
  let pepperVersion = 0;

  try {
    const res = await getVaultSecret(supabase, 'internal_jwt_pepper', {
      fresh,
      allowEnvFallback: false,
    });
    if (res.source === 'vault' && res.value) {
      pepperHex = res.value;
      pepperVersion = Number(res.keyVersion || 1);
    } else if (ensurePepper && supabase && getMasterIkm()) {
      const freshHex = crypto.randomBytes(32).toString('hex');
      const saved = await saveVaultSecret(supabase, 'internal_jwt_pepper', freshHex, adminEmail, {
        allowInternal: true,
        auditAction: 'set',
      });
      if (saved.ok) {
        pepperHex = freshHex;
        pepperVersion = Number(saved.secret?.keyVersion || 1);
      }
    }
  } catch (err) {
    if (err instanceof SecretVaultDecryptionError) throw err;
    // Pre-migration fallback: use domain-separated baseKey (pv = 0)
  }

  pepperCache = {
    pepperHex,
    pepperVersion,
    expiresAt: now + PEPPER_CACHE_TTL_MS,
  };

  const signingKey = pepperHex
    ? Buffer.from(
        crypto.hkdfSync(
          'sha256',
          baseKey,
          Buffer.from(pepperHex, 'hex'),
          `linksho:v1:admin-jwt-sign:v${pepperVersion}`,
          32
        )
      )
    : baseKey;

  return {
    signingKey,
    pepperVersion,
    hasDbPepper: Boolean(pepperHex),
  };
}

export async function rotateAdminJwtPepper(supabase, adminEmail = 'admin') {
  const freshHex = crypto.randomBytes(32).toString('hex');
  const saved = await saveVaultSecret(supabase, 'internal_jwt_pepper', freshHex, adminEmail, {
    allowInternal: true,
    auditAction: 'rotate',
  });
  if (!saved.ok) return saved;
  return { ok: true, pepperVersion: Number(saved.secret?.keyVersion || 1) };
}

// ============================================================================
// High-Level Service Resolvers (Stripe, Turnstile, R2, Cloudflare, Resend, Cron)
// ============================================================================

export async function resolveStripeSecretKey(supabase, mode = 'test', { fresh = false } = {}) {
  const safeMode = mode === 'live' ? 'live' : 'test';
  const primaryKey = safeMode === 'live' ? 'stripe_secret_key_live' : 'stripe_secret_key_test';
  const resolved = await getVaultSecret(supabase, primaryKey, { fresh });
  if (resolved.value) return resolved;

  // Fallback check: if generic STRIPE_SECRET_KEY env is set with mismatched mode,
  // still expose it so validateStripeSecretKeyForMode produces the clear mode-mismatch error.
  const genericEnv = String(process.env.STRIPE_SECRET_KEY || '').trim();
  if (genericEnv) {
    return {
      value: genericEnv,
      source: 'env',
      masked: maskSecretValue(primaryKey, genericEnv),
      updatedAt: null,
      keyVersion: null,
      metadata: {},
    };
  }
  return resolved;
}

export async function resolveStripeWebhookSecret(supabase, mode = 'live', { fresh = false } = {}) {
  const safeMode = mode === 'live' ? 'live' : 'test';
  const primaryKey = safeMode === 'live' ? 'stripe_webhook_secret_live' : 'stripe_webhook_secret_test';
  const secondaryKey = safeMode === 'live' ? 'stripe_webhook_secret_test' : 'stripe_webhook_secret_live';

  const primary = await getVaultSecret(supabase, primaryKey, { fresh });
  if (primary.value) return primary;

  // Secondary fallback strictly in test mode to assist dev setups (never fallback test secrets into live mode)
  if (safeMode === 'test') {
    const secondary = await getVaultSecret(supabase, secondaryKey, { fresh, allowEnvFallback: false });
    if (secondary.value) return secondary;
  }

  return primary;
}

export async function resolveR2VaultConfig(supabase, { fresh = false } = {}) {
  let dbPublic = {};
  if (supabase) {
    try {
      const { data } = await supabase
        .from('swedpersiska_settings')
        .select('value')
        .eq('key', 'r2_settings')
        .maybeSingle();
      if (data?.value && typeof data.value === 'object') {
        dbPublic = data.value;
      }
    } catch {}
  }

  const [vaultAccessKey, vaultSecretKey] = await Promise.all([
    getVaultSecret(supabase, 'r2_access_key_id', { fresh }),
    getVaultSecret(supabase, 'r2_secret_access_key', { fresh }),
  ]);

  const accountId = String(
    dbPublic.accountId || process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_R2_ACCOUNT_ID || ''
  ).trim();
  const bucketName = String(
    dbPublic.bucketName || process.env.R2_BUCKET_NAME || process.env.CLOUDFLARE_R2_BUCKET_NAME || ''
  ).trim();
  const publicUrl = String(
    dbPublic.publicUrl || process.env.R2_PUBLIC_URL || process.env.CLOUDFLARE_R2_PUBLIC_URL || ''
  )
    .trim()
    .replace(/\/+$/, '');

  // Precedence for secrets: Vault > Env > legacy plaintext r2_settings (transition only)
  const accessKeyId = String(vaultAccessKey.value || dbPublic.accessKeyId || '').trim();
  const secretAccessKey = String(vaultSecretKey.value || dbPublic.secretAccessKey || '').trim();

  const hasAllRequired = Boolean(accountId && accessKeyId && secretAccessKey && bucketName && publicUrl);
  const enabled = dbPublic.enabled !== undefined ? Boolean(dbPublic.enabled) : hasAllRequired;

  return {
    enabled,
    configured: enabled && hasAllRequired,
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    publicUrl,
    hasLegacyPlaintext: Boolean(dbPublic.accessKeyId || dbPublic.secretAccessKey),
    secretSource:
      vaultAccessKey.source === 'vault' && vaultSecretKey.source === 'vault'
        ? 'vault'
        : vaultAccessKey.source === 'env' || vaultSecretKey.source === 'env'
          ? 'env'
          : dbPublic.accessKeyId || dbPublic.secretAccessKey
            ? 'legacy_plaintext'
            : 'none',
  };
}

export async function resolveCloudflareDeployConfig(supabase, { fresh = false } = {}) {
  let dbPublic = {};
  if (supabase) {
    try {
      const { data } = await supabase
        .from('swedpersiska_settings')
        .select('value')
        .eq('key', 'cloudflare_deploy_settings')
        .maybeSingle();
      if (data?.value && typeof data.value === 'object') {
        dbPublic = data.value;
      }
    } catch {}
  }

  const vaultToken = await getVaultSecret(supabase, 'cloudflare_api_token', { fresh });
  const apiToken = String(vaultToken.value || dbPublic.apiToken || '').trim();
  const accountId = String(dbPublic.accountId || process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  const deployUrl = String(dbPublic.deployUrl || '').trim();

  return {
    accountId,
    apiToken,
    deployUrl,
    hasToken: Boolean(apiToken),
    hasLegacyPlaintext: Boolean(dbPublic.apiToken),
    secretSource:
      vaultToken.source === 'vault'
        ? 'vault'
        : vaultToken.source === 'env'
          ? 'env'
          : dbPublic.apiToken
            ? 'legacy_plaintext'
            : 'none',
  };
}
