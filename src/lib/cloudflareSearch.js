/**
 * Cloudflare AI Search Client
 * Primary search provider for Linksho with automatic fallback to existing backend.
 * Endpoint: https://search.linksho.eu/search
 */

export const CLOUDFLARE_SEARCH_ENDPOINT =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUDFLARE_SEARCH_ENDPOINT) ||
  'https://search.linksho.eu/search';

export const CLOUDFLARE_SEARCH_TIMEOUT_MS = 3500;
const CACHE_TTL_MS = 60_000; // 60 seconds TTL (aligns with 120 req/60s rate limit)

// Lightweight in-memory query cache
const searchCache = new Map();

/**
 * Clean up query string
 */
function cleanQuery(str) {
  return String(str || '').trim().slice(0, 120);
}

/**
 * Determine if a chunk represents a legitimate classified ad result
 * (Rejects generic homepage, sitemaps, index files, or navigation pages)
 */
export function isUsableAdChunk(chunk) {
  if (!chunk || typeof chunk !== 'object') return false;
  const key = String(chunk.item?.key || '').trim();
  const text = String(chunk.text || '');

  // 1. Explicit ad reference query parameter in key URL: ?ad=SP-...
  if (/[?&]ad=([^&#]+)/i.test(key) || /\/ad\/([^/?#]+)/i.test(key)) {
    return true;
  }

  // 2. Contains Linksho reference number format: SP-2611-1002
  if (/SP-\d{4}-\d{4}/i.test(text) || /SP-\d{4}-\d{4}/i.test(key)) {
    return true;
  }

  // 3. Reject generic root, sitemap, or category-only URLs
  if (
    !key ||
    /^(?:https?:\/\/[^/]+)?(?:\/(?:sitemap.*|index.*|\?c=[a-z]{2})?)?$/i.test(key) ||
    key.endsWith('/sitemap-index.xml') ||
    key.endsWith('/sitemap-static.xml') ||
    key.endsWith('/sitemap-ads.xml')
  ) {
    return false;
  }

  // 4. Must have a non-empty title that is not the generic site title
  const metaTitle = String(chunk.item?.metadata?.title || '').trim();
  const genericTitles = [
    'لینک شو',
    'linksho',
    'لینک شو سوئد',
    'نیازمندی‌های فارسی‌زبانان سوئد',
    'نیازمندی‌های فارسی‌زبانان نروژ',
    'نیازمندی‌های فارسی‌زبانان دانمارک',
    'نیازمندی‌های فارسی‌زبانان فنلاند',
  ];
  if (metaTitle && genericTitles.some((t) => metaTitle.toLowerCase() === t.toLowerCase())) {
    return false;
  }

  return Boolean(metaTitle || text.length > 30);
}

/**
 * Map a single Cloudflare AI Search chunk into Linksho's standard Ad structure
 */
export function mapCloudflareChunkToAd(chunk, { country = 'all', category = 'all', city = 'all' } = {}) {
  if (!isUsableAdChunk(chunk)) return null;

  const key = String(chunk.item?.key || '').trim();
  const text = String(chunk.text || '');
  const meta = chunk.item?.metadata || {};

  // Extract ad reference / identifier
  let adRef = '';
  const urlMatch = key.match(/[?&]ad=([^&#]+)/i) || key.match(/\/ad\/([^/?#]+)/i);
  if (urlMatch) {
    adRef = decodeURIComponent(urlMatch[1]);
  }
  if (!adRef) {
    const textRefMatch = text.match(/SP-\d{4}-\d{4}/i);
    if (textRefMatch) adRef = textRefMatch[0];
  }
  if (!adRef) {
    adRef = chunk.id ? `cf-${chunk.id.slice(0, 12)}` : `cf-${Date.now()}`;
  }

  // Extract clean title
  let rawTitle = meta.title || '';
  if (!rawTitle && text) {
    const titleMatch = text.match(/^title:\s*(.+)$/m) || text.match(/^#+\s*(.+)$/m);
    if (titleMatch) rawTitle = titleMatch[1].trim();
  }
  const cleanTitle = String(rawTitle || '')
    .replace(/\s*\|\s*(?:سوئد|نروژ|دانمارک|فنلاند|لینک\s*شو|LinkSho).*/gi, '')
    .trim();

  if (!cleanTitle) return null;

  // Extract description
  let rawDesc = meta.description || '';
  if (!rawDesc && text) {
    const descMatch = text.match(/^description:\s*(.+)$/m);
    if (descMatch) {
      rawDesc = descMatch[1].trim();
    } else {
      rawDesc = text.replace(/^---[\s\S]*?---/, '').replace(/#+.*$/gm, '').trim();
    }
  }
  const cleanDesc = String(rawDesc || '').replace(/\s+/g, ' ').trim().slice(0, 4000);

  // Extract image
  let image = meta.image || '';
  if (!image && text) {
    const imgMatch = text.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/i);
    if (imgMatch) image = imgMatch[1];
  }

  // Extract country from URL (?c=se) or default
  let adCountry = 'se';
  const countryMatch = key.match(/[?&]c=([a-z]{2})/i);
  if (countryMatch) {
    adCountry = countryMatch[1].toLowerCase();
  }

  // Filter out if specific country requested and mismatch
  if (country && country !== 'all' && adCountry !== country.toLowerCase()) {
    return null;
  }

  // Extract category
  let adCategory = 'general';
  const catMatch = key.match(/[?&]cat=([^&#]+)/i);
  if (catMatch) {
    adCategory = decodeURIComponent(catMatch[1]);
  }
  if (category && category !== 'all' && adCategory !== category) {
    return null;
  }

  // Extract city
  let adCity = 'Stockholm';
  const cityMatch = key.match(/[?&]city=([^&#]+)/i);
  if (cityMatch) {
    adCity = decodeURIComponent(cityMatch[1]);
  }
  if (city && city !== 'all' && adCity !== city) {
    return null;
  }

  const createdIso = chunk.item?.timestamp
    ? new Date(chunk.item.timestamp).toISOString()
    : new Date().toISOString();

  return {
    id: adRef,
    reference_number: adRef.startsWith('SP-') ? adRef : (adRef.startsWith('cf-') ? adRef : `SP-${adRef}`),
    title: cleanTitle,
    title_fa: cleanTitle,
    description: cleanDesc,
    category: adCategory,
    city: adCity,
    country: adCountry,
    price: null,
    price_type: 'توافقی',
    images: image ? [image] : [],
    is_featured: false,
    is_active_vip: false,
    views_count: 0,
    created_at: createdIso,
    sort_timestamp: createdIso,
    _isSummary: true,
    _source: 'cloudflare_ai',
  };
}

/**
 * Send search query to Cloudflare AI Search (POST https://search.linksho.eu/search)
 * Returns formatted { ok: true, ads, total, source: 'cloudflare_ai' } if usable,
 * or null if Cloudflare fails, times out, rate limits, or has no usable results.
 */
export async function searchWithCloudflareAi({
  query = '',
  country = 'all',
  category = 'all',
  city = 'all',
  limit = 16,
  timeoutMs = CLOUDFLARE_SEARCH_TIMEOUT_MS,
  endpoint = CLOUDFLARE_SEARCH_ENDPOINT,
} = {}) {
  const q = cleanQuery(query);
  if (!q) return null;

  const cacheKey = `${q}|${country}|${category}|${city}|${limit}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(500, timeoutMs));

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query: q,
        limit: Math.min(48, Math.max(1, Number(limit) || 16)),
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    // Non-200 status (e.g. 429 rate limit, 503 unavailable, 404, etc.) triggers fallback
    if (!res.ok) {
      return null;
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return null;
    }

    const json = await res.json().catch(() => null);
    if (!json || json.success === false || !Array.isArray(json.result?.chunks)) {
      return null;
    }

    const chunks = json.result.chunks;
    if (chunks.length === 0) {
      return null;
    }

    // Map chunks to Linksho ad objects
    const mappedAds = [];
    const seenIds = new Set();

    for (const chunk of chunks) {
      const ad = mapCloudflareChunkToAd(chunk, { country, category, city });
      if (!ad) continue;
      const keyId = ad.id || ad.reference_number;
      if (seenIds.has(keyId)) continue;
      seenIds.add(keyId);
      mappedAds.push(ad);
    }

    // If no usable classified ads could be extracted, return null to trigger fallback
    if (mappedAds.length === 0) {
      return null;
    }

    const out = {
      ok: true,
      ads: mappedAds,
      total: mappedAds.length,
      page: 1,
      limit: Number(limit) || 16,
      hasMore: false,
      source: 'cloudflare_ai',
    };

    searchCache.set(cacheKey, { timestamp: Date.now(), data: out });
    return out;
  } catch {
    clearTimeout(timer);
    // Silent fallback on abort, network drop, CORS or timeout
    return null;
  }
}

/**
 * Clear search cache (useful for tests or refresh)
 */
export function clearCloudflareSearchCache() {
  searchCache.clear();
}
