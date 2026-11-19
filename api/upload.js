import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

export const MAX_FILE_BYTES = 1048576; // Strict 1 MB limit per photo
const ALLOWED_MIME_TYPES = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
  if (allowedOrigin === '*') {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (origin && allowedOrigin.split(',').map((o) => o.trim()).includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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

async function resolveR2Config() {
  if (
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME &&
    process.env.R2_PUBLIC_URL
  ) {
    return {
      enabled: true,
      accountId: process.env.R2_ACCOUNT_ID.trim(),
      accessKeyId: process.env.R2_ACCESS_KEY_ID.trim(),
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY.trim(),
      bucketName: process.env.R2_BUCKET_NAME.trim(),
      publicUrl: process.env.R2_PUBLIC_URL.trim().replace(/\/+$/, ''),
    };
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data } = await supabase
    .from('swedpersiska_settings')
    .select('value')
    .eq('key', 'r2_settings')
    .maybeSingle();

  if (!data || !data.value || !data.value.enabled) return null;
  return data.value;
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
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
    if (!r2 || !r2.enabled || !r2.accountId || !r2.accessKeyId || !r2.secretAccessKey || !r2.bucketName || !r2.publicUrl) {
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
      expiresSeconds: 300,
    });

    const publicUrl = `${r2.publicUrl.replace(/\/+$/, '')}/${objectKey}`;
    return res.status(200).json({ ok: true, uploadUrl, publicUrl, key: objectKey, maxBytes: MAX_FILE_BYTES });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'خطا در آماده‌سازی آپلود تصویر' });
  }
}
