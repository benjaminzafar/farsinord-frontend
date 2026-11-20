import crypto from 'crypto';
import { resolveR2VaultConfig } from './_lib/secretVault.js';

export const MAX_FILE_BYTES = 1048576; // Strict 1 MB limit per photo
const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const ALLOWED_MIME_TYPES = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

const DEFAULT_ORIGINS = [
  'https://www.linksho.eu',
  'https://linksho.eu',
  'https://www.swedpersiska.se',
  'https://swedpersiska.se',
  'https://swedpersiska.vercel.app',
  'https://farsinord.vercel.app',
  'https://farsinord-frontend.vercel.app',
  'https://farsinord-admin.vercel.app',
];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  const envRaw = process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || '';
  const extra = envRaw
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o && o !== '*');
  const allowList = [...DEFAULT_ORIGINS, ...extra];
  if (allowList.includes(origin)) return true;
  if (process.env.VERCEL_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
    return true;
  }
  return false;
}

function setCorsHeaders(req, res) {
  const origin = req.headers?.origin || '';
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

const uploadRateMap = new Map();
function checkUploadRateLimit(req) {
  const realIp = req?.headers?.['x-real-ip'];
  const vercelFwd = req?.headers?.['x-vercel-forwarded-for']?.split(',').pop()?.trim();
  const fwd = req?.headers?.['x-forwarded-for']?.split(',').pop()?.trim();
  const ip = String(realIp || vercelFwd || fwd || 'unknown').trim();
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const maxReqs = 24;
  let entry = uploadRateMap.get(ip);
  if (!entry || now - entry.start > windowMs) {
    entry = { count: 1, start: now };
  } else {
    entry.count += 1;
  }
  uploadRateMap.set(ip, entry);
  if (uploadRateMap.size > 500) {
    for (const [k, v] of uploadRateMap.entries()) {
      if (now - v.start > windowMs) uploadRateMap.delete(k);
    }
  }
  return entry.count <= maxReqs;
}

function hmacSha256(key, data) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

function encodeRfc3986(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

/**
 * Generate an AWS S3 SigV4 presigned PUT URL for Cloudflare R2 using Node crypto.
 * Zero external SDK dependencies for fast cold starts.
 */
export function createR2PresignedPutUrl({
  accountId,
  accessKeyId,
  secretAccessKey,
  bucketName,
  objectKey,
  contentType,
  contentLength,
  cacheControl,
  expiresSeconds = 300,
}) {
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const region = 'auto';
  const service = 's3';
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalUri = `/${bucketName}/${objectKey.split('/').map(encodeRfc3986).join('/')}`;

  const headerPairs = [
    ['content-type', contentType],
    ['host', host],
  ];
  const parsedLen = Number(contentLength);
  if (Number.isInteger(parsedLen) && parsedLen > 0) {
    headerPairs.push(['content-length', String(parsedLen)]);
  }
  if (cacheControl && typeof cacheControl === 'string') {
    headerPairs.push(['cache-control', cacheControl.trim()]);
  }
  headerPairs.sort((a, b) => a[0].localeCompare(b[0]));

  const signedHeaders = headerPairs.map(([k]) => k).join(';');
  const canonicalHeaders = headerPairs.map(([k, v]) => `${k}:${v}\n`).join('');

  const queryParams = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresSeconds),
    'X-Amz-SignedHeaders': signedHeaders,
  };

  const canonicalQuery = Object.keys(queryParams)
    .sort()
    .map((k) => `${encodeRfc3986(k)}=${encodeRfc3986(queryParams[k])}`)
    .join('&');

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

let cachedR2Config = null;
let cachedR2At = 0;
const R2_CACHE_TTL_MS = 60 * 1000;

async function resolveR2Config() {
  if (cachedR2Config && Date.now() - cachedR2At < R2_CACHE_TTL_MS) {
    return cachedR2Config;
  }

  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    'https://bezbnymjcnmazdonfzky.supabase.co';
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  let supabase = null;
  if (supabaseUrl && serviceRoleKey) {
    const { createClient } = await import('@supabase/supabase-js');
    supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  const resolved = await resolveR2VaultConfig(supabase);
  if (!resolved?.configured) {
    return {
      configured: false,
      missingServiceRole: !serviceRoleKey,
      ...(resolved || {})
    };
  }

  cachedR2Config = resolved;
  cachedR2At = Date.now();
  return cachedR2Config;
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  const origin = req.headers?.origin || '';
  if (origin && !isAllowedOrigin(origin)) {
    return res.status(403).json({ ok: false, error: 'Origin not allowed' });
  }

  if (!checkUploadRateLimit(req)) {
    return res.status(429).json({ ok: false, error: 'تعداد درخواست‌های آپلود بیش از حد مجاز است. لطفاً کمی بعد دوباره تلاش کنید.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const contentType = String(body.contentType || '').toLowerCase().trim();
    const fileSize = Number(body.fileSize || 0);

    const ext = ALLOWED_MIME_TYPES[contentType];
    if (!ext) {
      return res.status(400).json({ ok: false, error: 'فقط فرمت‌های تصویری مجاز هستند (JPG, PNG, WebP).' });
    }

    if (!Number.isInteger(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_BYTES) {
      return res.status(400).json({ ok: false, error: 'حجم هر تصویر باید حداکثر ۱ مگابایت باشد.' });
    }

    const r2 = await resolveR2Config();
    if (!r2?.configured || !r2.enabled || !r2.accountId || !r2.accessKeyId || !r2.secretAccessKey || !r2.bucketName || !r2.publicUrl) {
      if (r2?.missingServiceRole) {
        return res.status(503).json({
          ok: false,
          error: 'متغیر SUPABASE_SERVICE_ROLE_KEY روی سرور (Vercel در پروژه farsinord-frontend یا linksho.eu) تنظیم نشده است.'
        });
      }
      return res.status(503).json({
        ok: false,
        error: 'فضای ابری تصاویر (کلودفلر) هنوز در پنل مدیریت فعال و تنظیم نشده است.'
      });
    }

    const randomToken = crypto.randomBytes(8).toString('hex');
    const objectKey = `ads/${Date.now()}-${randomToken}.${ext}`;

    const uploadUrl = createR2PresignedPutUrl({
      accountId: r2.accountId,
      accessKeyId: r2.accessKeyId,
      secretAccessKey: r2.secretAccessKey,
      bucketName: r2.bucketName,
      objectKey,
      contentType,
      contentLength: fileSize,
      cacheControl: IMMUTABLE_CACHE_CONTROL,
      expiresSeconds: 300,
    });

    const publicUrl = `${r2.publicUrl.replace(/\/+$/, '')}/${objectKey}`;
    return res.status(200).json({
      ok: true,
      uploadUrl,
      publicUrl,
      key: objectKey,
      maxBytes: MAX_FILE_BYTES,
      cacheControl: IMMUTABLE_CACHE_CONTROL,
    });
  } catch (err) {
    console.error('[upload] error:', err?.message || err);
    if (
      err?.name === 'SecretVaultDecryptionError' ||
      err?.message?.includes('Master key mismatch') ||
      err?.message?.includes('cannot decrypt secret') ||
      err?.message?.includes('authentication tag verification failed')
    ) {
      return res.status(500).json({
        ok: false,
        error: 'کلید SUPABASE_SERVICE_ROLE_KEY در ورسل اشتباه است. مقدار آن باید کد طولانی service_role از سوپابیس باشد (نه آدرس اینترنتی).'
      });
    }
    return res.status(500).json({ ok: false, error: err?.message || 'خطا در آماده‌سازی آپلود تصویر' });
  }
}
