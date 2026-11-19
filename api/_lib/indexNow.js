export const DEFAULT_INDEXNOW_KEY = 'linksho8f4c2e9a7b1d4e6f9a3c5b7d2e8f';
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

export function getIndexNowKey() {
  const custom = String(process.env.INDEXNOW_KEY || '').trim();
  if (/^[a-zA-Z0-9-]{8,128}$/.test(custom)) {
    return custom;
  }
  return DEFAULT_INDEXNOW_KEY;
}

export function buildIndexNowPayload(
  urls,
  {
    origin = process.env.SITE_CANONICAL_URL || 'https://www.linksho.eu',
    key = getIndexNowKey(),
  } = {}
) {
  const cleanOrigin = String(origin || 'https://www.linksho.eu').replace(/\/+$/, '');
  const parsedOrigin = new URL(cleanOrigin);
  const host = parsedOrigin.host;
  const keyLocation = `${cleanOrigin}/${key}.txt`;

  const uniqueUrls = [];
  const seen = new Set();

  for (const raw of Array.isArray(urls) ? urls : [urls]) {
    if (!raw || typeof raw !== 'string') continue;
    try {
      const target = raw.startsWith('/') ? new URL(raw, cleanOrigin) : new URL(raw);
      if (target.host !== host) continue;
      const href = target.toString();
      if (!seen.has(href)) {
        seen.add(href);
        uniqueUrls.push(href);
        if (uniqueUrls.length >= 10000) break;
      }
    } catch {
      // Skip malformed URLs
    }
  }

  return {
    host,
    key,
    keyLocation,
    urlList: uniqueUrls,
  };
}

export async function notifyIndexNow(
  urls,
  {
    origin = process.env.SITE_CANONICAL_URL || 'https://www.linksho.eu',
    key = getIndexNowKey(),
    fetchImpl = typeof fetch === 'function' ? fetch : null,
    timeoutMs = 4000,
  } = {}
) {
  const payload = buildIndexNowPayload(urls, { origin, key });
  if (payload.urlList.length === 0) {
    return {
      ok: false,
      skipped: true,
      status: 0,
      submittedCount: 0,
      keyLocation: payload.keyLocation,
    };
  }

  if (!fetchImpl) {
    return {
      ok: false,
      skipped: true,
      status: 0,
      submittedCount: 0,
      keyLocation: payload.keyLocation,
    };
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const res = await fetchImpl(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(payload),
      ...(controller ? { signal: controller.signal } : {}),
    });

    return {
      ok: res.ok || res.status === 202,
      skipped: false,
      status: res.status,
      submittedCount: payload.urlList.length,
      keyLocation: payload.keyLocation,
    };
  } catch (err) {
    return {
      ok: false,
      skipped: false,
      status: 0,
      submittedCount: 0,
      keyLocation: payload.keyLocation,
      error: err?.message || 'IndexNow request failed',
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
