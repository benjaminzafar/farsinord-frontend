import crypto from 'node:crypto';

function hmacSha256(key, data) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

function encodeRfc3986(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

const R2_CONFIG_TTL_MS = 3 * 60 * 1000;
let cachedR2Config = null;
let cachedR2ConfigAt = 0;

export async function resolveR2Config(supabase) {
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

  const now = Date.now();
  if (cachedR2Config && now - cachedR2ConfigAt < R2_CONFIG_TTL_MS) {
    return cachedR2Config;
  }

  if (!supabase) return null;
  const { data } = await supabase
    .from('swedpersiska_settings')
    .select('value')
    .eq('key', 'r2_settings')
    .maybeSingle();

  const val = data?.value;
  if (!val?.enabled || !val.accountId || !val.accessKeyId || !val.secretAccessKey || !val.bucketName || !val.publicUrl) {
    return null;
  }

  const resolved = {
    ...val,
    accountId: String(val.accountId).trim(),
    accessKeyId: String(val.accessKeyId).trim(),
    secretAccessKey: String(val.secretAccessKey).trim(),
    bucketName: String(val.bucketName).trim(),
    publicUrl: String(val.publicUrl).trim().replace(/\/+$/, ''),
  };
  cachedR2Config = resolved;
  cachedR2ConfigAt = now;
  return resolved;
}

const STRICT_AD_OBJECT_KEY_RE = /^ads\/\d+-[a-f0-9]{16}\.(jpg|png|webp|avif)$/i;

function extractOwnedObjectKey(url, r2PublicUrl) {
  const cleanUrl = String(url || '').trim();
  const base = String(r2PublicUrl || '').trim().replace(/\/+$/, '');
  if (!cleanUrl || !base || !cleanUrl.startsWith(`${base}/`)) {
    return null;
  }
  const rawRel = cleanUrl.slice(base.length + 1).split('?')[0].split('#')[0];
  if (!rawRel) return null;
  let decoded = '';
  try {
    decoded = decodeURIComponent(rawRel);
  } catch {
    return null;
  }
  if (!decoded || decoded.includes('..') || decoded.includes('\\')) return null;
  if (!STRICT_AD_OBJECT_KEY_RE.test(decoded)) return null;
  return decoded;
}

function createR2SignedDeleteHeaders({ accountId, accessKeyId, secretAccessKey, bucketName, objectKey }) {
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const region = 'auto';
  const service = 's3';
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalUri = `/${bucketName}/${objectKey.split('/').map(encodeRfc3986).join('/')}`;
  const payloadHash = sha256Hex('');

  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = ['DELETE', canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256Hex(canonicalRequest)].join('\n');

  const kDate = hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

  return {
    endpoint: `https://${host}${canonicalUri}`,
    headers: {
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
}

/**
 * Safely deletes Cloudflare R2 images owned by a purged ad,
 * skipping external URLs (Unsplash, etc.) and images still referenced by any other ad.
 */
export async function deleteR2ObjectsForAd(supabase, imageUrls = [], excludeAdId = null, preResolvedR2 = null) {
  const urls = Array.isArray(imageUrls) ? imageUrls.filter(Boolean) : [];
  if (urls.length === 0) {
    return { deletedKeys: [], failedKeys: [], skippedExternal: 0 };
  }

  const r2 = preResolvedR2 || (await resolveR2Config(supabase));
  if (!r2) {
    return { deletedKeys: [], failedKeys: [], skippedExternal: urls.length };
  }

  const deletedKeys = [];
  const failedKeys = [];
  let skippedExternal = 0;

  await Promise.all(
    urls.map(async (url) => {
      const objectKey = extractOwnedObjectKey(url, r2.publicUrl);
      if (!objectKey) {
        skippedExternal++;
        return;
      }

      const canonicalUrl = `${r2.publicUrl}/${objectKey}`;

      // Never delete if another ad still references either the canonical URL or raw URL
      if (supabase && excludeAdId) {
        try {
          const urlsToCheck = canonicalUrl === url ? [canonicalUrl] : [canonicalUrl, url];
          const refChecks = await Promise.all(
            urlsToCheck.map((checkUrl) =>
              supabase
                .from('swedpersiska_ads')
                .select('id', { count: 'exact', head: true })
                .neq('id', excludeAdId)
                .contains('images', [checkUrl])
            )
          );
          if (refChecks.some((r) => (r?.count || 0) > 0)) {
            return;
          }
        } catch {
          // Fail safe: skip deletion if we cannot verify shared references
          return;
        }
      }

      try {
        const { endpoint, headers } = createR2SignedDeleteHeaders({
          accountId: r2.accountId,
          accessKeyId: r2.accessKeyId,
          secretAccessKey: r2.secretAccessKey,
          bucketName: r2.bucketName,
          objectKey,
        });
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);
        try {
          const delRes = await fetch(endpoint, { method: 'DELETE', headers, signal: ctrl.signal });
          if (delRes.ok || delRes.status === 204 || delRes.status === 404) {
            deletedKeys.push(objectKey);
          } else {
            failedKeys.push(objectKey);
          }
        } finally {
          clearTimeout(timer);
        }
      } catch {
        failedKeys.push(objectKey);
      }
    })
  );

  return { deletedKeys, failedKeys, skippedExternal };
}
