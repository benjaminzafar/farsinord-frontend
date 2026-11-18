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

  return {
    ...val,
    publicUrl: String(val.publicUrl).trim().replace(/\/+$/, ''),
  };
}

function extractOwnedObjectKey(url, r2PublicUrl) {
  const cleanUrl = String(url || '').trim();
  const base = String(r2PublicUrl || '').trim().replace(/\/+$/, '');
  if (!cleanUrl || !base || !cleanUrl.startsWith(`${base}/`)) {
    return null;
  }
  const rel = cleanUrl.slice(base.length + 1).split('?')[0].split('#')[0];
  if (!rel || rel.includes('..')) return null;
  return decodeURIComponent(rel);
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
export async function deleteR2ObjectsForAd(supabase, imageUrls = [], excludeAdId = null) {
  const urls = Array.isArray(imageUrls) ? imageUrls.filter(Boolean) : [];
  if (urls.length === 0) {
    return { deletedKeys: [], failedKeys: [], skippedExternal: 0 };
  }

  const r2 = await resolveR2Config(supabase);
  if (!r2) {
    return { deletedKeys: [], failedKeys: [], skippedExternal: urls.length };
  }

  const deletedKeys = [];
  const failedKeys = [];
  let skippedExternal = 0;

  for (const url of urls) {
    const objectKey = extractOwnedObjectKey(url, r2.publicUrl);
    if (!objectKey) {
      skippedExternal++;
      continue;
    }

    // Never delete if another ad still references this image URL
    if (supabase && excludeAdId) {
      try {
        const { count } = await supabase
          .from('swedpersiska_ads')
          .select('id', { count: 'exact', head: true })
          .neq('id', excludeAdId)
          .contains('images', [url]);
        if ((count || 0) > 0) continue;
      } catch {}
    }

    try {
      const { endpoint, headers } = createR2SignedDeleteHeaders({
        accountId: r2.accountId,
        accessKeyId: r2.accessKeyId,
        secretAccessKey: r2.secretAccessKey,
        bucketName: r2.bucketName,
        objectKey,
      });
      const delRes = await fetch(endpoint, { method: 'DELETE', headers });
      if (delRes.ok || delRes.status === 204 || delRes.status === 404) {
        deletedKeys.push(objectKey);
      } else {
        failedKeys.push(objectKey);
      }
    } catch {
      failedKeys.push(objectKey);
    }
  }

  return { deletedKeys, failedKeys, skippedExternal };
}
