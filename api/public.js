import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import {
  detectDuplicates,
  prepareIncomingAdFingerprint,
} from './_lib/duplicateDetection.js';
import {
  computeVipPrice,
  resolveSafeRedirectOrigin,
  validateStripeSecretKeyForMode,
  verifyVerifiedCheckoutSession,
} from './_lib/stripeSecurity.js';
import { CANONICAL_ORIGIN } from './_lib/seoCore.js';
import { notifyIndexNow } from './_lib/indexNow.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://bezbnymjcnmazdonfzky.supabase.co';
const HAS_SERVICE_ROLE = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlemJueW1qY25tYXpkb25memt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ2OTM1NjksImV4cCI6MjExMDI2OTU2OX0.ylsHBAZ1zo1z_aKpHx7hgl-yZu2yt2puFNhR8jBm6S4';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PUBLIC_FETCH_TIMEOUT_MS = 6500;
function fetchWithTimeout(input, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PUBLIC_FETCH_TIMEOUT_MS);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { fetch: fetchWithTimeout },
});

const PUBLIC_AD_COLUMNS =
  'id, reference_number, title, title_fa, category, country, city, area, price, price_type, description, contact_name, contact_phone, contact_whatsapp, contact_telegram, contact_email, contact_website, images, is_featured, status, views_count, created_at, updated_at, last_boosted_at, last_meaningful_activity_at, sort_timestamp, next_free_boost_at, boost_count, duplicate_detection_status, cleanup_warning_sent_at, scheduled_deletion_at, deleted_at, promotion_expires_at';

// Lean list projection: omits all contact PII and heavy lifecycle fields (saves 60-80% egress & protects contact info)
const PUBLIC_AD_LIST_COLUMNS =
  'id, reference_number, title, title_fa, category, country, city, area, price, price_type, description, images, is_featured, views_count, created_at, sort_timestamp, promotion_expires_at';

const ALLOWED_VIP_COUNTRIES = new Set(['se', 'no', 'dk', 'fi', 'de', 'at', 'nl', 'fr']);
const GEOCODE_CACHE_TTL_MS = 10 * 60 * 1000;
const geocodeCache = new Map();

function getGeocodeCached(key) {
  const entry = geocodeCache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > GEOCODE_CACHE_TTL_MS) {
    geocodeCache.delete(key);
    return undefined;
  }
  return entry.val;
}

function setGeocodeCached(key, val) {
  if (geocodeCache.size >= 200) {
    const oldestKey = geocodeCache.keys().next().value;
    if (oldestKey !== undefined) geocodeCache.delete(oldestKey);
  }
  geocodeCache.set(key, { val, ts: Date.now() });
}

function normalizeAsciiDigits(str) {
  return String(str || '')
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

function isValidPublicWebsite(rawUrl) {
  if (!isSafeHttpUrl(rawUrl)) return false;
  try {
    const u = new URL(String(rawUrl).trim());
    return Boolean(u.hostname && u.hostname.includes('.') && !u.hostname.startsWith('.') && !u.hostname.endsWith('.'));
  } catch {
    return false;
  }
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a || ''), 'utf8');
  const bufB = Buffer.from(String(b || ''), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function normalizeListAd(ad) {
  const norm = normalizePublicAd(ad);
  if (!norm) return norm;
  const rawDesc = String(norm.description || '');
  const shortDesc = rawDesc.length > 200 ? `${rawDesc.slice(0, 197).trim()}...` : rawDesc;
  const coverOnly = Array.isArray(norm.images) && norm.images.length > 0 ? [norm.images[0]] : [];
  return {
    ...norm,
    description: shortDesc,
    images: coverOnly,
    _isSummary: true,
  };
}

const PROHIBITED_PATTERNS = [
  /\b(csam|cp|child\s*porn|underage\s*sex|pedo|pedophil|loli|shota)\b/i,
  /(کودک\s*آزاری|بچه\s*بازی|سکس\s*کودک|پورن\s*کودک)/i,
  /\b(barnpornografi|barnmisshandel|sex\s*med\s*barn)\b/i,
  /\b(escort|call\s*girl|prostitut|brothel|happy\s*ending|sex\s*service|porn|xxx|onlyfans)\b/i,
  /(سکس|پورن|روسپی|تن\s*فروشی|صیغه\s*ساعتی|ماساژ\s*جنسی|خدمات\s*جنسی|فیلم\s*سوپر|شهوانی|جنده)/i,
  /\b(eskort|sexköp|sexuella\s*tjänster|erotisk\s*massage|porr)\b/i,
];

function checkProhibitedText({ title = '', description = '', area = '', contact_name = '' } = {}) {
  const combined = [title, description, area, contact_name].filter(Boolean).join(' ');
  for (const pattern of PROHIBITED_PATTERNS) {
    if (pattern.test(combined)) {
      return 'محتوای آگهی شامل کلمات غیرمجاز یا مغایر با قوانین ایمنی پلتفرم است و امکان ثبت آن وجود ندارد.';
    }
  }
  return '';
}

function normalizePublicAd(ad) {
  if (!ad) return ad;
  const expMs = ad.promotion_expires_at ? Date.parse(ad.promotion_expires_at) : NaN;
  const isActiveVip = Boolean(ad.is_featured && (!ad.promotion_expires_at || (!Number.isNaN(expMs) && expMs > Date.now())));
  return {
    ...ad,
    is_featured: isActiveVip,
    is_active_vip: isActiveVip,
  };
}

function isSafeHttpUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.startsWith('/')) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function generateReferenceNumber() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += chars.charAt(crypto.randomInt(0, chars.length));
  }
  return `SP-${yy}${mm}-${rand}`;
}

function generatePinCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(crypto.randomInt(0, chars.length));
  }
  return code;
}

function getTrustedClientIp(req) {
  const xReal = String(req.headers?.['x-real-ip'] || '').trim();
  if (xReal) return xReal;
  const xVercel = String(req.headers?.['x-vercel-forwarded-for'] || '').split(',').pop()?.trim();
  if (xVercel) return xVercel;
  const xFwd = String(req.headers?.['x-forwarded-for'] || '').split(',').pop()?.trim();
  if (xFwd) return xFwd;
  return String(req.socket?.remoteAddress || 'unknown').trim();
}

// Per-IP rate limiter keyed on trusted edge client IP
const subRateLimitMap = new Map();
function checkSubRateLimit(req, { bucket = 'sub', maxAttempts = 15, windowMs = 15 * 60 * 1000, cost = 1 } = {}) {
  const key = `${bucket}:${getTrustedClientIp(req)}`;
  const now = Date.now();
  const safeCost = Math.max(1, Number(cost) || 1);
  const entry = subRateLimitMap.get(key);
  if (!entry || now - entry.windowStart > windowMs) {
    subRateLimitMap.set(key, { windowStart: now, count: safeCost });
    if (subRateLimitMap.size > 1000) {
      for (const [k, v] of subRateLimitMap.entries()) {
        if (now - v.windowStart > windowMs) subRateLimitMap.delete(k);
      }
    }
    return safeCost <= maxAttempts;
  }
  if (entry.count + safeCost > maxAttempts) return false;
  entry.count += safeCost;
  return true;
}

function generateUniqueManageCode(existingList = []) {
  const used = new Set(existingList.map((item) => String(item?.manageCode || '')));
  for (let i = 0; i < 20; i++) {
    const candidate = String(crypto.randomInt(10000000, 100000000));
    if (!used.has(candidate)) return candidate;
  }
  return String(crypto.randomInt(10000000, 100000000));
}

function sanitizePublicSubscription(item) {
  if (!item) return null;
  return {
    storeId: item.storeId,
    name: item.name,
    status: item.status,
    expiresAt: item.expiresAt,
    panelUrl: item.panelUrl || '',
    websiteUrl: item.websiteUrl || '',
    monthlyPrice: item.monthlyPrice || 260,
    renewRequestedAt: item.renewRequestedAt || '',
    paymentStatus: item.paymentStatus || 'pending',
  };
}

function validateWebsiteOrderFields(body) {
  const name = String(body.name || '').trim();
  const phone = String(body.phone || '').trim();
  const companyNumber = String(body.companyNumber || '').trim();
  const email = String(body.email || '').trim().toLowerCase();

  if (name.length < 2 || phone.length < 6 || companyNumber.length < 4 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      ok: false,
      error: 'لطفاً نام سایت، شماره تماس معتبر، شماره ثبت شرکت و ایمیل صحیح را وارد کنید.',
    };
  }
  return {
    ok: true,
    name: name.slice(0, 120),
    phone: phone.slice(0, 40),
    companyNumber: companyNumber.slice(0, 60),
    email: email.slice(0, 120),
  };
}

const DESCRIPTION_LINK_RE =
  /(?:https?:\/\/|ftp:\/\/|www\.)\S+|(?<![a-z0-9._%+-]+@)\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|se|eu|nu|org|net|io|co|me|info|biz|app|dev|xyz|online|site|store|shop|tech|ir|de|no|dk|fi|nl|at|fr|uk|ch|be|es|it|pl|ca|us|au|tv|gg|ly|gl|link|click|page|cloud|ai| club)(?:\/\S*|\b)/i;

function containsLinkInDescription(text) {
  if (!text) return false;
  return DESCRIPTION_LINK_RE.test(String(text));
}

function parseSafePrice(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const num = Number(raw);
  return Number.isFinite(num) && num >= 0 && num <= 1e9 ? num : null;
}

const PUBLIC_SETTINGS_KEYS = [
  'site_branding',
  'seo_settings',
  'portal_cities',
  'portal_countries',
  'stripe_settings',
  'turnstile_settings',
  'analytics_settings',
  'google_maps_settings',
  'ad_lifecycle_settings',
  'podcast_settings',
];
const PUBLIC_SETTINGS_TTL_MS = 3 * 60 * 1000;
let cachedSettingsMap = null;
let cachedSettingsAt = 0;

const PODCAST_FEED_TTL_MS = 5 * 60 * 1000;
let cachedPodcastResponse = null;
let cachedPodcastAt = 0;
const resolvedYoutubeChannelIdCache = new Map();

async function getCachedPublicSettingsMap() {
  const now = Date.now();
  if (cachedSettingsMap && now - cachedSettingsAt < PUBLIC_SETTINGS_TTL_MS) {
    return cachedSettingsMap;
  }
  const { data, error } = await supabase
    .from('swedpersiska_settings')
    .select('key, value')
    .in('key', PUBLIC_SETTINGS_KEYS);
  if (error || !data) {
    return cachedSettingsMap || {};
  }
  const map = {};
  for (const row of data) {
    map[row.key] = row.value;
  }
  cachedSettingsMap = map;
  cachedSettingsAt = now;
  return map;
}

async function getStripeConfig() {
  const map = await getCachedPublicSettingsMap();
  const stripeCfg = map.stripe_settings && typeof map.stripe_settings === 'object' ? map.stripe_settings : {};
  const enabled = stripeCfg.enabled !== false;
  const mode = stripeCfg.mode === 'live' ? 'live' : 'test';
  const secretKey = String(process.env.STRIPE_SECRET_KEY || '').trim();
  return { enabled, mode, secretKey, stripeCfg };
}

async function createStripeCheckoutSession({ secretKey, amountOre, currency = 'sek', productName, successUrl, cancelUrl, customerEmail, metadata = {}, idempotencyKey = '' }) {
  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('success_url', successUrl);
  params.set('cancel_url', cancelUrl);
  params.set('expires_at', String(Math.floor(Date.now() / 1000) + 3600));
  if (customerEmail) params.set('customer_email', customerEmail);
  params.set('line_items[0][price_data][currency]', String(currency || 'sek').toLowerCase());
  params.set('line_items[0][price_data][unit_amount]', String(amountOre));
  params.set('line_items[0][price_data][product_data][name]', productName);
  params.set('line_items[0][quantity]', '1');
  for (const [k, v] of Object.entries(metadata)) {
    params.set(`metadata[${k}]`, String(v || ''));
  }

  const headers = {
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  const resp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers,
    body: params.toString(),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data?.url) {
    throw new Error(data?.error?.message || 'خطا در ایجاد نشست پرداخت Stripe');
  }
  return data;
}

async function retrieveStripeCheckoutSession(secretKey, sessionId) {
  const resp = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data?.id) {
    throw new Error(data?.error?.message || 'نشست پرداخت Stripe یافت نشد.');
  }
  return data;
}

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://www.linksho.eu,https://linksho.eu,https://swedpersiska.vercel.app,https://farsinord.vercel.app,https://farsinord-admin.vercel.app')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  const isDevLocalhost = process.env.VERCEL_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin || '');
  if (origin && (ALLOWED_ORIGINS.includes(origin) || isDevLocalhost)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const { action, id } = req.query || {};

      if (action === 'bootstrap') {
        const rawMap = await getCachedPublicSettingsMap();
        const bootstrapKeys = [
          'site_branding',
          'seo_settings',
          'portal_cities',
          'portal_countries',
          'stripe_settings',
          'turnstile_settings',
          'analytics_settings',
          'google_maps_settings',
          'ad_lifecycle_settings',
        ];

        const settings = {};
        for (const key of bootstrapKeys) {
          const val = rawMap[key];
          if (val === undefined) continue;
          if (key === 'stripe_settings' && val) {
            const stripeMode = val.mode === 'live' ? 'live' : 'test';
            const keyCheck = validateStripeSecretKeyForMode(process.env.STRIPE_SECRET_KEY, stripeMode);
            settings.stripe_settings = {
              enabled: val.enabled,
              mode: val.mode,
              publishableKey: val.publishableKey,
              vipPrice: val.vipPrice,
              currency: val.currency,
              vipDurationDays: val.vipDurationDays,
              vipBadgeText: val.vipBadgeText,
              stripeReady: Boolean(String(process.env.STRIPE_SECRET_KEY || '').trim()),
              stripeKeyMatchesMode: keyCheck.ok,
            };
          } else if (key === 'turnstile_settings' && val) {
            settings.turnstile_settings = {
              enabled: val.enabled,
              mode: val.mode === 'live' ? 'live' : 'test',
              siteKey: String(val.siteKey || '').replace(/[\s\u200B-\u200D\uFEFF]/g, ''),
              protectPostAd: val.protectPostAd,
            };
          } else if (key === 'site_branding' && val) {
            const rawName = (val.siteName || '').trim();
            const isLegacy = !rawName || /سوئد\s*پرشیا|سوید\s*پرشیا|پرشیا\s*سو|فارسی\s*نور|swedpersiska|farsi\s*nord|faris\s*nord/i.test(rawName);
            settings.site_branding = {
              ...val,
              siteName: isLegacy ? 'لینک شو' : rawName,
            };
          } else if (key === 'google_maps_settings' && val && typeof val === 'object') {
            const cleanKey = String(val.embedApiKey || '').replace(/[\p{Cc}\s\u200B-\u200D\uFEFF]/gu, '');
            const safeKey = /^AIza[0-9A-Za-z_-]{20,60}$/.test(cleanKey) ? cleanKey : '';
            const zoomNum = Number(val.defaultZoom);
            settings.google_maps_settings = {
              enabled: val.enabled !== false,
              embedApiKey: safeKey,
              defaultZoom: Number.isInteger(zoomNum) && zoomNum >= 1 && zoomNum <= 20 ? zoomNum : 14,
            };
          } else {
            settings[key] = val;
          }
        }

        res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=600, stale-while-revalidate=3600');
        return res.status(200).json({ ok: true, settings });
      }

      if (action === 'geocode') {
        if (!checkSubRateLimit(req, { bucket: 'geocode', maxAttempts: 40, windowMs: 15 * 60 * 1000 })) {
          return res.status(429).json({ ok: false, error: 'تعداد درخواست‌های نقشه زیاد است.' });
        }
        const q = String(req.query.q || '').trim().slice(0, 160);
        const cc = /^[a-z]{2}$/i.test(String(req.query.country || '')) ? String(req.query.country).toLowerCase() : '';
        if (q.length < 2) {
          return res.status(200).json({ ok: true, result: null });
        }
        const cacheKey = `g:${cc}:${q.toLowerCase()}`;
        const cached = getGeocodeCached(cacheKey);
        if (cached !== undefined) {
          res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
          return res.status(200).json({ ok: true, result: cached });
        }
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 3500);
        try {
          const qs = new URLSearchParams({
            q,
            format: 'jsonv2',
            limit: '1',
            addressdetails: '1',
          });
          if (cc) qs.set('countrycodes', cc);
          const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?${qs.toString()}`, {
            headers: {
              'User-Agent': 'LinkSho/1.0 (+https://www.linksho.eu)',
              'Accept-Language': 'en,sv,fa',
            },
            signal: ctrl.signal,
          });
          const geoJson = geoRes.ok ? await geoRes.json().catch(() => []) : [];
          const hit = Array.isArray(geoJson) && geoJson[0] ? geoJson[0] : null;
          const lat = hit ? Number(hit.lat) : NaN;
          const lng = hit ? Number(hit.lon) : NaN;
          const addr = hit?.address || {};
          const shortParts = [
            addr.road ? `${addr.road}${addr.house_number ? ` ${addr.house_number}` : ''}` : '',
            addr.suburb || addr.neighbourhood || addr.quarter || addr.city_district || '',
          ].filter(Boolean);
          const result = Number.isFinite(lat) && Number.isFinite(lng)
            ? {
                lat: Number(lat.toFixed(6)),
                lng: Number(lng.toFixed(6)),
                label: shortParts.join('، ') || String(hit.display_name || '').split(',').slice(0, 2).join('، ').trim(),
              }
            : null;
          setGeocodeCached(cacheKey, result);
          res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
          return res.status(200).json({ ok: true, result });
        } catch {
          return res.status(200).json({ ok: true, result: null });
        } finally {
          clearTimeout(timer);
        }
      }

      if (action === 'reverse_geocode') {
        if (!checkSubRateLimit(req, { bucket: 'geocode', maxAttempts: 40, windowMs: 15 * 60 * 1000 })) {
          return res.status(429).json({ ok: false, error: 'تعداد درخواست‌های نقشه زیاد است.' });
        }
        const lat = Number(req.query.lat);
        const lng = Number(req.query.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          return res.status(400).json({ ok: false, error: 'Invalid coordinates' });
        }
        const rLat = Number(lat.toFixed(4));
        const rLng = Number(lng.toFixed(4));
        const cacheKey = `r:${rLat},${rLng}`;
        const cached = getGeocodeCached(cacheKey);
        if (cached !== undefined) {
          res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
          return res.status(200).json({ ok: true, label: cached });
        }
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 3500);
        try {
          const qs = new URLSearchParams({
            lat: String(rLat),
            lon: String(rLng),
            format: 'jsonv2',
            zoom: '16',
            addressdetails: '1',
          });
          const revRes = await fetch(`https://nominatim.openstreetmap.org/reverse?${qs.toString()}`, {
            headers: {
              'User-Agent': 'LinkSho/1.0 (+https://www.linksho.eu)',
              'Accept-Language': 'en,sv,fa',
            },
            signal: ctrl.signal,
          });
          const revJson = revRes.ok ? await revRes.json().catch(() => null) : null;
          const addr = revJson?.address || {};
          // Privacy-safe area extraction: never auto-expose exact house_number in public listings
          const district =
            addr.suburb ||
            addr.neighbourhood ||
            addr.quarter ||
            addr.city_district ||
            addr.village ||
            addr.town ||
            addr.hamlet ||
            addr.municipality ||
            '';
          const parts = district
            ? [district]
            : [addr.road || ''].filter(Boolean);
          const label = parts.join('، ').slice(0, 120) || '';
          setGeocodeCached(cacheKey, label);
          res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
          return res.status(200).json({ ok: true, label });
        } catch {
          return res.status(200).json({ ok: true, label: '' });
        } finally {
          clearTimeout(timer);
        }
      }

      if (action === 'get_podcast_feed') {
        const now = Date.now();
        if (cachedPodcastResponse && now - cachedPodcastAt < PODCAST_FEED_TTL_MS) {
          res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
          return res.status(200).json(cachedPodcastResponse);
        }

        const rawMap = await getCachedPublicSettingsMap();
        const podcast = rawMap.podcast_settings || {
          enabled: true,
          title: 'پادکست خبری لینک شو',
          subtitle: 'گزارش‌ها و پادکست‌های خبری فارسی‌زبانان اروپا',
          youtubeChannelUrl: '',
          youtubeChannelId: '',
          manualVideos: [],
        };

        const YT_VID_RE = /^[a-zA-Z0-9_-]{11}$/;
        const manualList = Array.isArray(podcast.manualVideos)
          ? podcast.manualVideos
              .filter((v) => v && YT_VID_RE.test(String(v.videoId || '')))
              .map((v) => ({
                videoId: String(v.videoId),
                title: v.title || 'پادکست خبری',
                publishedAt: v.addedAt || '',
                description: '',
                thumbnail: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
                watchUrl: isSafeHttpUrl(v.url) ? v.url : `https://www.youtube.com/watch?v=${v.videoId}`,
                source: 'pinned',
              }))
          : [];

        let channelId = String(podcast.youtubeChannelId || '').trim();
        const chUrl = String(podcast.youtubeChannelUrl || '').trim();
        if (!/^UC[\w-]{10,}$/.test(channelId) && chUrl) {
          if (resolvedYoutubeChannelIdCache.has(chUrl)) {
            channelId = resolvedYoutubeChannelIdCache.get(chUrl);
          } else {
            const directMatch = chUrl.match(/youtube\.com\/channel\/(UC[\w-]{10,})/i);
            if (directMatch) {
              channelId = directMatch[1];
              resolvedYoutubeChannelIdCache.set(chUrl, channelId);
            } else {
              try {
                const parsedCh = new URL(chUrl);
                const validYtHost =
                  (parsedCh.protocol === 'https:' || parsedCh.protocol === 'http:') &&
                  !parsedCh.username &&
                  !parsedCh.password &&
                  ['www.youtube.com', 'youtube.com', 'm.youtube.com'].includes(parsedCh.hostname.toLowerCase());
                if (validYtHost) {
                  const ctrl = new AbortController();
                  const timer = setTimeout(() => ctrl.abort(), 5000);
                  const htmlRes = await fetch(parsedCh.toString(), {
                    signal: ctrl.signal,
                    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LinkShoBot/1.0)' },
                  });
                  clearTimeout(timer);
                  if (htmlRes.ok) {
                    const html = await htmlRes.text();
                    const idMatch =
                      html.match(/"channelId":"(UC[\w-]{10,})"/) ||
                      html.match(/"externalId":"(UC[\w-]{10,})"/) ||
                      html.match(/<link[^>]+rel="canonical"[^>]+href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{10,})"/i);
                    if (idMatch) {
                      channelId = idMatch[1];
                      resolvedYoutubeChannelIdCache.set(chUrl, channelId);
                    }
                  }
                }
              } catch {}
            }
          }
        }

        const rssEpisodes = [];
        if (/^UC[\w-]{10,}$/.test(channelId)) {
          try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 5000);
            const feedRes = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`, {
              signal: ctrl.signal,
            });
            clearTimeout(timer);
            if (feedRes.ok) {
              const xml = await feedRes.text();
              const decodeXml = (str) =>
                String(str || '')
                  .replace(/&amp;/g, '&')
                  .replace(/&lt;/g, '<')
                  .replace(/&gt;/g, '>')
                  .replace(/&quot;/g, '"')
                  .replace(/&#39;/g, "'");
              const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
              entries.slice(0, 15).forEach((entry) => {
                const vid = String((entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [])[1] || '').trim();
                const title = decodeXml((entry.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '');
                const published = (entry.match(/<published>([^<]+)<\/published>/) || [])[1] || '';
                const desc = decodeXml((entry.match(/<media:description>([\s\S]*?)<\/media:description>/) || [])[1] || '');
                if (YT_VID_RE.test(vid)) {
                  rssEpisodes.push({
                    videoId: vid,
                    title: title || 'پادکست خبری',
                    publishedAt: published,
                    description: desc.slice(0, 400),
                    thumbnail: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
                    watchUrl: `https://www.youtube.com/watch?v=${vid}`,
                    source: 'youtube',
                  });
                }
              });
            }
          } catch {}
        }

        // Merge pinned manual videos + live YouTube RSS episodes (deduped by videoId)
        const seen = new Set();
        const episodes = [];
        [...manualList, ...rssEpisodes].forEach((ep) => {
          if (!ep.videoId || seen.has(ep.videoId)) return;
          seen.add(ep.videoId);
          episodes.push(ep);
        });

        const payload = { ok: true, settings: podcast, channelId, episodes };
        cachedPodcastResponse = payload;
        cachedPodcastAt = Date.now();
        res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
        return res.status(200).json(payload);
      }

      if (action === 'ad' && id) {
        const clean = String(id).trim();
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);
        let query = supabase
          .from('swedpersiska_ads')
          .select(PUBLIC_AD_COLUMNS)
          .eq('status', 'active')
          .is('deleted_at', null);
        if (isUuid) {
          query = query.eq('id', clean);
        } else {
          const safeRef = clean.replace(/[^a-zA-Z0-9_-]/g, '');
          if (!safeRef) return res.status(400).json({ ok: false, error: 'Invalid ad reference' });
          query = query.eq('reference_number', safeRef);
        }
        const { data, error } = await query.maybeSingle();
        if (error) throw error;
        res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=120, stale-while-revalidate=600');
        return res.status(200).json({ ok: true, ad: normalizePublicAd(data) || null });
      }

      // Default GET: paginated active non-deleted public ads sorted by active VIP first, then sort_timestamp (or selected sort)
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(48, Math.max(1, Number(req.query.limit) || 16));
      const country = String(req.query.country || 'all').trim().toLowerCase();
      const category = String(req.query.category || 'all').trim();
      const city = String(req.query.city || 'all').trim();
      const search = String(req.query.q || '').trim().slice(0, 100);
      const sort = String(req.query.sort || '').trim();
      const featuredOnly = req.query.featuredOnly === 'true' || req.query.featuredOnly === '1';
      const includeFeatured = !featuredOnly && page === 1 && (req.query.includeFeatured === 'true' || req.query.includeFeatured === '1');
      const featuredLimit = Math.min(24, Math.max(1, Number(req.query.featuredLimit) || 12));

      const from = (page - 1) * limit;
      const needExactCount = !featuredOnly && page === 1;
      const to = needExactCount ? from + limit - 1 : from + limit;

      const sanitizedSearch = search
        ? search
            .replace(/[,()"'\\*%_]/g, ' ')
            .replace(/ي/g, 'ی')
            .replace(/ك/g, 'ک')
            .replace(/\s+/g, ' ')
            .trim()
        : '';

      const applyFilters = (baseQuery, isFeaturedQuery = false) => {
        let query = baseQuery.eq('status', 'active').is('deleted_at', null);
        if (country && country !== 'all') query = query.eq('country', country);
        if (category && category !== 'all') query = query.eq('category', category);
        if (city && city !== 'all') query = query.eq('city', city);
        if (isFeaturedQuery) {
          const nowIso = new Date().toISOString();
          query = query.eq('is_featured', true).or(`promotion_expires_at.is.null,promotion_expires_at.gt.${nowIso}`);
        }
        if (sanitizedSearch) {
          const term = `%${sanitizedSearch}%`;
          query = query.or(`title.ilike.${term},title_fa.ilike.${term},description.ilike.${term},city.ilike.${term},reference_number.ilike.${term}`);
        }
        return query;
      };

      let q = applyFilters(
        supabase
          .from('swedpersiska_ads')
          .select(PUBLIC_AD_LIST_COLUMNS, needExactCount ? { count: 'exact' } : undefined),
        featuredOnly
      );

      if (sort === 'most_viewed') {
        q = q
          .order('is_featured', { ascending: false })
          .order('views_count', { ascending: false })
          .order('created_at', { ascending: false })
          .order('id', { ascending: false });
      } else if (sort === 'price_asc') {
        q = q
          .order('is_featured', { ascending: false })
          .order('price', { ascending: true, nullsFirst: false })
          .order('sort_timestamp', { ascending: false })
          .order('id', { ascending: false });
      } else if (sort === 'price_desc') {
        q = q
          .order('is_featured', { ascending: false })
          .order('price', { ascending: false, nullsFirst: true })
          .order('sort_timestamp', { ascending: false })
          .order('id', { ascending: false });
      } else {
        q = q
          .order('is_featured', { ascending: false })
          .order('sort_timestamp', { ascending: false })
          .order('created_at', { ascending: false })
          .order('id', { ascending: false });
      }

      const canDeriveFeaturedFromMain =
        includeFeatured && (!sort || sort === 'newest') && limit >= featuredLimit;

      const mainQueryPromise = q.range(from, to);
      const featuredQueryPromise =
        includeFeatured && !canDeriveFeaturedFromMain
          ? applyFilters(
              supabase.from('swedpersiska_ads').select(PUBLIC_AD_LIST_COLUMNS),
              true
            )
              .order('sort_timestamp', { ascending: false })
              .order('created_at', { ascending: false })
              .order('id', { ascending: false })
              .range(0, featuredLimit - 1)
          : Promise.resolve(null);

      const [mainRes, featuredRes] = await Promise.all([mainQueryPromise, featuredQueryPromise]);
      if (mainRes.error) throw mainRes.error;

      const rawRows = mainRes.data || [];
      const hasMore = needExactCount ? to + 1 < (mainRes.count ?? rawRows.length) : rawRows.length > limit;
      const pageRows = needExactCount ? rawRows : rawRows.slice(0, limit);
      const normalizedAds = pageRows.map(normalizeListAd);
      const total = needExactCount ? (mainRes.count ?? normalizedAds.length) : undefined;

      const responseBody = {
        ok: true,
        ads: normalizedAds,
        page,
        limit,
        hasMore,
      };
      if (total !== undefined) responseBody.total = total;
      if (includeFeatured) {
        if (canDeriveFeaturedFromMain) {
          const activeVipsInMain = normalizedAds.filter((a) => a.is_active_vip);
          const allMainRowsWereFeatured = pageRows.length >= limit && pageRows.every((r) => r.is_featured);
          if (!allMainRowsWereFeatured || activeVipsInMain.length >= featuredLimit) {
            responseBody.featuredAds = activeVipsInMain.slice(0, featuredLimit);
          } else {
            const { data: fallbackFeatured } = await applyFilters(
              supabase.from('swedpersiska_ads').select(PUBLIC_AD_LIST_COLUMNS),
              true
            )
              .order('sort_timestamp', { ascending: false })
              .order('created_at', { ascending: false })
              .order('id', { ascending: false })
              .range(0, featuredLimit - 1);
            responseBody.featuredAds = (fallbackFeatured || []).map(normalizeListAd);
          }
        } else {
          responseBody.featuredAds = (featuredRes?.data || []).map(normalizeListAd);
        }
      }

      res.setHeader('Cache-Control', 'public, max-age=15, s-maxage=60, stale-while-revalidate=300');
      return res.status(200).json(responseBody);
    }

    if (req.method === 'POST') {
      res.setHeader('Cache-Control', 'no-store');
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const { action } = body;

      if (action === 'create_ad') {
        if (!checkSubRateLimit(req, { bucket: 'create_ad', maxAttempts: 10, windowMs: 15 * 60 * 1000 })) {
          return res.status(429).json({ ok: false, error: 'تعداد درخواست‌های ثبت آگهی زیاد است. لطفاً کمی بعد دوباره تلاش کنید.' });
        }
        const {
          title,
          category,
          country,
          city,
          area,
          price,
          price_type,
          description,
          contact_name,
          contact_phone,
          contact_whatsapp,
          contact_telegram,
          contact_email,
          images,
          image_hashes,
          requestDuplicateReview,
          turnstileToken,
        } = body;

        const cleanTitle = String(title || '').trim().slice(0, 160);
        const cleanDesc = String(description || '').trim().slice(0, 4000);
        const cleanName = String(contact_name || '').trim().slice(0, 100) || 'آگهی‌دهنده';
        const cleanArea = area ? String(area).trim().slice(0, 160) : null;
        const cleanPhone = contact_phone ? normalizeAsciiDigits(contact_phone).trim().slice(0, 40) : null;
        const cleanWa = contact_whatsapp ? normalizeAsciiDigits(contact_whatsapp).trim().slice(0, 80) : null;
        const cleanTg = contact_telegram ? String(contact_telegram).trim().slice(0, 80) : null;
        const cleanEmail = contact_email ? String(contact_email).trim().slice(0, 120) : null;
        const rawSite = body.contact_website ? String(body.contact_website).trim() : '';
        const normalizedSite = rawSite ? (/^https?:\/\//i.test(rawSite) ? rawSite : `https://${rawSite}`) : '';
        const cleanWebsite = normalizedSite && isValidPublicWebsite(normalizedSite) ? normalizedSite.slice(0, 300) : null;

        if (!cleanTitle || !cleanDesc) {
          return res.status(400).json({ ok: false, error: 'عنوان و توضیحات آگهی الزامی است.' });
        }

        if (containsLinkInDescription(cleanDesc)) {
          return res.status(400).json({ ok: false, error: 'درج لینک در توضیحات مجاز نیست. آدرس سایت را در بخش وب‌سایت وارد کنید.' });
        }

        if (rawSite && !cleanWebsite) {
          return res.status(400).json({ ok: false, error: 'آدرس وب‌سایت واردشده معتبر نیست.' });
        }
        if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
          return res.status(400).json({ ok: false, error: 'آدرس ایمیل واردشده معتبر نیست.' });
        }
        if (cleanPhone && cleanPhone.replace(/\D/g, '').length < 6) {
          return res.status(400).json({ ok: false, error: 'شماره تلفن واردشده معتبر نیست.' });
        }
        if (cleanTg) {
          const tgCheck = cleanTg.replace(/^https?:\/\/(?:www\.)?(?:t\.me|telegram\.me)\//i, '').replace(/^@+/, '').split(/[/?#]/)[0].replace(/[^a-zA-Z0-9_]/g, '');
          if (tgCheck.length < 3) {
            return res.status(400).json({ ok: false, error: 'نام کاربری تلگرام واردشده معتبر نیست.' });
          }
        }
        if (cleanWa) {
          const waBase = cleanWa.replace(/^https?:\/\/(?:www\.)?(?:wa\.me|api\.whatsapp\.com\/send\?phone=)\/?/i, '').split(/[?#]/)[0].replace(/^@+/, '');
          const waDigits = waBase.replace(/\D/g, '');
          const waHandle = waBase.replace(/[^a-zA-Z0-9._-]/g, '');
          if (waDigits.length < 6 && (!/[a-zA-Z]/.test(waHandle) || waHandle.length < 3)) {
            return res.status(400).json({ ok: false, error: 'نام کاربری یا شماره واتساپ واردشده معتبر نیست.' });
          }
        }
        if (!cleanPhone && !cleanWa && !cleanTg && !cleanEmail && !cleanWebsite) {
          return res.status(400).json({ ok: false, error: 'ثبت حداقل یک روش تماس (تلگرام، ایمیل، واتساپ، شماره تلفن یا وب‌سایت) الزامی است.' });
        }

        const modReason = checkProhibitedText({ title: cleanTitle, description: cleanDesc, area: cleanArea, contact_name: cleanName });
        if (modReason) {
          return res.status(400).json({ ok: false, error: modReason });
        }

        const settingsMap = await getCachedPublicSettingsMap();

        // Strict server-side Turnstile verification when live mode & secret key are configured
        const turnstileSecret = String(process.env.TURNSTILE_SECRET_KEY || '').trim();
        if (turnstileSecret) {
          let requireLiveTurnstile = true;
          const tsCfg = settingsMap.turnstile_settings;
          if (tsCfg && (tsCfg.enabled === false || tsCfg.protectPostAd === false || tsCfg.mode !== 'live')) {
            requireLiveTurnstile = false;
          }

          if (requireLiveTurnstile) {
            const cleanToken = String(turnstileToken || '').trim();
            if (!cleanToken) {
              return res.status(403).json({ ok: false, error: 'تایید امنیتی کپچا الزامی است. لطفاً مجدداً امتحان کنید.' });
            }
            const tsCtrl = new AbortController();
            const tsTimer = setTimeout(() => tsCtrl.abort(), 6000);
            try {
              const verifyBody = new URLSearchParams({
                secret: turnstileSecret,
                response: cleanToken,
                remoteip: getTrustedClientIp(req),
              });
              const tsRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
                method: 'POST',
                body: verifyBody,
                signal: tsCtrl.signal,
              });
              const tsJson = await tsRes.json().catch(() => ({}));
              if (!tsRes.ok || !tsJson.success) {
                return res.status(403).json({ ok: false, error: 'تایید امنیتی کپچا معتبر نیست. لطفاً مجدداً امتحان کنید.' });
              }
            } catch {
              return res.status(503).json({ ok: false, error: 'خطا در بررسی امنیتی کپچا. لطفاً لحظاتی بعد دوباره تلاش کنید.' });
            } finally {
              clearTimeout(tsTimer);
            }
          }
        }

        const cleanCountry = /^[a-z0-9_-]{2,10}$/i.test(String(country || '')) ? String(country).toLowerCase() : 'se';
        const cleanCategory = category || 'bostad';
        const cleanCity = String(city || 'Stockholm').trim().slice(0, 80);
        const r2PublicBase = String(process.env.R2_PUBLIC_URL || '').trim().replace(/\/+$/, '');
        const safeImages = (Array.isArray(images) ? images : [])
          .filter(isSafeHttpUrl)
          .map((u) => {
            const trimmed = String(u).trim();
            // Strip query/hash on own-R2 URLs so shared-reference deletion checks cannot be bypassed
            if (r2PublicBase && trimmed.startsWith(`${r2PublicBase}/`)) {
              return trimmed.split('?')[0].split('#')[0];
            }
            return trimmed;
          })
          .slice(0, 6);
        const finalImages = safeImages.length > 0
          ? safeImages
          : ['https://images.unsplash.com/photo-1582407947304-fd86f028f716?auto=format&fit=crop&w=1200&q=80'];
        const safeImgHashes = Array.isArray(image_hashes)
          ? image_hashes.map((h) => String(h || '').trim().toLowerCase()).filter((h) => /^[a-f0-9]{16,128}$/.test(h)).slice(0, 10)
          : [];

        const incomingAd = {
          title: cleanTitle,
          description: cleanDesc,
          category: cleanCategory,
          country: cleanCountry,
          city: cleanCity,
          area: cleanArea,
          price: parseSafePrice(price),
          contact_phone: cleanPhone,
          contact_whatsapp: cleanWa,
          contact_telegram: cleanTg,
          contact_email: cleanEmail,
          contact_website: cleanWebsite,
          images: finalImages,
          image_hashes: safeImgHashes,
        };

        const prepared = prepareIncomingAdFingerprint(incomingAd);

        const { data: candidatesRaw } = await supabase.rpc('get_duplicate_candidates', {
          p_country: cleanCountry,
          p_category: cleanCategory,
          p_owner_hashes: prepared.contactHashes,
          p_image_hashes: prepared.imageSignatures,
          p_content_hash: prepared.contentHash,
          p_exclude_ad_id: null,
        });

        const lifecycleConfig = settingsMap.ad_lifecycle_settings || {};
        const candidates = Array.isArray(candidatesRaw) ? candidatesRaw : [];
        const dupResult = detectDuplicates(incomingAd, candidates, lifecycleConfig);

        if (dupResult.decision === 'block' && !requestDuplicateReview) {
          return res.status(409).json({
            ok: false,
            code: 'DUPLICATE_AD',
            error: 'آگهی مشابهی هم‌اکنون در سامانه فعال یا در انتظار تایید است. به جای ثبت آگهی تکراری، می‌توانید آگهی قبلی را ویرایش یا بوست رایگان کنید.',
            duplicateMatch: dupResult.topMatch,
            reasons: dupResult.reasons,
          });
        }

        const dupStatus = dupResult.decision === 'block' && requestDuplicateReview
          ? 'flagged_review'
          : (dupResult.decision === 'suspected' ? 'suspected' : 'clean');

        const refNum = generateReferenceNumber();
        const rawCustomPin = String(body.pin_code || '')
          .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
          .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
          .trim();
        const finalPin = /^[0-9A-Za-z]{6,12}$/.test(rawCustomPin) ? rawCustomPin : generatePinCode();

        const { data: createRes, error: createErr } = await supabase.rpc('create_ad_secure', {
          p_payload: {
            reference_number: refNum,
            pin_code: finalPin,
            title: cleanTitle,
            title_fa: cleanTitle,
            category: cleanCategory,
            country: cleanCountry,
            city: cleanCity,
            area: cleanArea,
            price: incomingAd.price,
            price_type: price_type || 'kr',
            description: cleanDesc,
            contact_name: cleanName,
            contact_phone: cleanPhone,
            contact_whatsapp: cleanWa,
            contact_telegram: cleanTg,
            contact_email: cleanEmail,
            contact_website: cleanWebsite,
            images: finalImages,
            request_duplicate_review: Boolean(requestDuplicateReview),
            duplicate_detection_status: dupStatus,
            duplicate_score: dupResult.score || null,
            duplicate_of_ad_id: dupResult.topMatch?.id || null,
            duplicate_reasons: dupResult.reasons || [],
            duplicate_same_owner: Boolean(dupResult.sameOwner),
            normalized_title: dupResult.normalizedTitle,
            normalized_text: dupResult.normalizedText,
            content_hash: dupResult.contentHash,
            owner_fingerprint: dupResult.ownerFingerprint,
            owner_contact_hashes: dupResult.ownerContactHashes,
            image_hashes: dupResult.imageHashes,
          },
        });

        if (createErr) throw createErr;

        if (!createRes?.ok) {
          if (createRes?.error_code === 'DUPLICATE_AD') {
            return res.status(409).json({
              ok: false,
              code: 'DUPLICATE_AD',
              error: 'این آگهی هم‌زمان یا پیش‌تر ثبت شده است. لطفاً آگهی موجود را ویرایش یا بوست کنید.',
              duplicateMatch: createRes.duplicate_match,
              reasons: ['تطابق کامل محتوا در بررسی هم‌زمان'],
            });
          }
          return res.status(400).json({ ok: false, error: createRes?.error || 'خطا در ثبت آگهی' });
        }

        if (createRes?.ad?.status === 'active') {
          const slug = encodeURIComponent(refNum || createRes.ad.id);
          await notifyIndexNow(
            [
              `${CANONICAL_ORIGIN}/?ad=${slug}`,
              `${CANONICAL_ORIGIN}/?c=${encodeURIComponent(cleanCountry)}`,
              `${CANONICAL_ORIGIN}/?c=${encodeURIComponent(cleanCountry)}&cat=${encodeURIComponent(cleanCategory)}`,
              `${CANONICAL_ORIGIN}/`,
            ],
            { origin: CANONICAL_ORIGIN, timeoutMs: 1200 }
          ).catch(() => {});
        }

        return res.status(200).json({
          ok: true,
          ad: createRes.ad,
          reference_number: refNum,
          pin_code: finalPin,
          duplicateReviewFlagged: dupStatus !== 'clean',
        });
      }

        if (action === 'verify_pin') {
        if (!checkSubRateLimit(req)) {
          return res.status(429).json({ ok: false, error: 'تعداد تلاش‌های شما زیاد است. لطفاً چند دقیقه دیگر دوباره تلاش کنید.' });
        }
        const cleanRef = normalizeAsciiDigits(body.reference_number || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
        const cleanPin = normalizeAsciiDigits(body.pin_code || '').trim();
        if (!cleanRef || !cleanPin) {
          return res.status(400).json({ ok: false, error: 'لطفاً کد آگهی و کد مدیریت را وارد کنید.' });
        }

        const { data, error } = await supabase.rpc('owner_verify_ad', {
          p_reference_number: cleanRef,
          p_pin_code: cleanPin,
        });
        if (error) throw error;
        if (!data?.ok) {
          return res.status(401).json({ ok: false, error: data?.error || 'کد آگهی یا کد مدیریت واردشده صحیح نیست.' });
        }
        return res.status(200).json({
          ok: true,
          deleted: Boolean(data.deleted),
          ad: data.ad,
          notifications: data.notifications || [],
        });
      }

      if (action === 'owner_list_ads') {
        const rawCreds = Array.isArray(body.credentials) ? body.credentials.slice(0, 20) : [];
        const seenRefs = new Set();
        const creds = [];
        for (const item of rawCreds) {
          const ref = normalizeAsciiDigits(item?.reference_number || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32);
          const pin = normalizeAsciiDigits(item?.pin_code || '').trim().slice(0, 16);
          if (ref && pin && !seenRefs.has(ref)) {
            seenRefs.add(ref);
            creds.push({ reference_number: ref, pin_code: pin });
          }
        }
        if (!checkSubRateLimit(req, { bucket: 'owner_list', maxAttempts: 40, windowMs: 15 * 60 * 1000, cost: Math.max(1, creds.length) })) {
          return res.status(429).json({ ok: false, error: 'تعداد درخواست‌ها زیاد است.' });
        }
        if (creds.length === 0) {
          return res.status(200).json({ ok: true, ads: [], count: 0 });
        }
        const { data, error } = await supabase.rpc('owner_list_ads', { p_credentials: creds });
        if (error) throw error;
        return res.status(200).json({ ok: true, ads: data?.ads || [], count: data?.count || 0 });
      }

      if (action === 'boost_ad') {
        if (!checkSubRateLimit(req, { bucket: 'pin_mut', maxAttempts: 20 })) {
          return res.status(429).json({ ok: false, error: 'تعداد درخواست‌ها زیاد است. لطفاً کمی بعد تلاش کنید.' });
        }
        const { id, pin_code } = body;
        const cleanPin = normalizeAsciiDigits(pin_code || '').trim();
        if (!id || !cleanPin) {
          return res.status(400).json({ ok: false, error: 'شناسه آگهی و کد مدیریت الزامی است.' });
        }

        const { data, error } = await supabase.rpc('boost_ad_free', {
          p_ad_id: id,
          p_pin_code: cleanPin,
        });
        if (error) throw error;

        if (!data?.ok) {
          const code = data?.error_code;
          const status = code === 'INVALID_CREDENTIALS' ? 401 : code === 'BOOST_COOLDOWN_ACTIVE' ? 429 : 403;
          return res.status(status).json({
            ok: false,
            code,
            error: data?.error || 'امکان بوست آگهی در حال حاضر وجود ندارد.',
            next_free_boost_at: data?.next_free_boost_at || null,
            last_boosted_at: data?.last_boosted_at || null,
            cooldown_remaining_seconds: data?.cooldown_remaining_seconds || 0,
          });
        }

        if (data?.ad) {
          const slug = encodeURIComponent(data.ad.reference_number || data.ad.id || id);
          const boostedCountry = encodeURIComponent(data.ad.country || 'se');
          await notifyIndexNow(
            [
              `${CANONICAL_ORIGIN}/?ad=${slug}`,
              `${CANONICAL_ORIGIN}/?c=${boostedCountry}`,
              `${CANONICAL_ORIGIN}/`,
            ],
            { origin: CANONICAL_ORIGIN, timeoutMs: 1200 }
          ).catch(() => {});
        }

        return res.status(200).json({
          ok: true,
          ad: data.ad,
          is_vip_exempt: Boolean(data.is_vip_exempt),
          message: data.message,
        });
      }

      if (action === 'update_ad') {
        if (!checkSubRateLimit(req, { bucket: 'pin_mut', maxAttempts: 20 })) {
          return res.status(429).json({ ok: false, error: 'تعداد درخواست‌ها زیاد است. لطفاً کمی بعد تلاش کنید.' });
        }
        const { id, pin_code, title, price, area, description, status, contact_phone } = body;
        const cleanPin = normalizeAsciiDigits(pin_code || '').trim();
        if (!id || !cleanPin) {
          return res.status(400).json({ ok: false, error: 'شناسه آگهی و کد مدیریت الزامی است.' });
        }
        // Only allow owner-safe terminal statuses; never allow self-approving pending/rejected ads to 'active'
        const safeOwnerStatus = status === 'sold' || status === 'rented' ? status : undefined;

        const cleanTitle = String(title || '').trim().slice(0, 160);
        const cleanDesc = String(description || '').trim().slice(0, 4000);
        const cleanArea = area !== undefined ? String(area || '').trim().slice(0, 160) : undefined;
        const cleanPhone = contact_phone !== undefined ? normalizeAsciiDigits(contact_phone || '').trim().slice(0, 40) : undefined;
        const safePrice = parseSafePrice(price);

        if (containsLinkInDescription(cleanDesc)) {
          return res.status(400).json({ ok: false, error: 'درج لینک در توضیحات مجاز نیست. آدرس سایت را در بخش وب‌سایت وارد کنید.' });
        }

        const modReason = checkProhibitedText({ title: cleanTitle, description: cleanDesc, area: cleanArea });
        if (modReason) {
          return res.status(400).json({ ok: false, error: modReason });
        }

        let targetMeta = null;
        if (body.country && body.category && body.city && cleanTitle && cleanDesc) {
          targetMeta = {
            country: String(body.country).toLowerCase().slice(0, 10),
            category: String(body.category).slice(0, 40),
            city: String(body.city).slice(0, 80),
            title: cleanTitle,
            description: cleanDesc,
          };
        } else {
          const { data: existingAd } = await supabase
            .from('swedpersiska_ads')
            .select('country, category, city, title, description')
            .eq('id', id)
            .maybeSingle();
          targetMeta = existingAd || {
            country: body.country || 'se',
            category: body.category || 'bostad',
            city: body.city || 'Stockholm',
          };
        }

        const incomingUpdated = {
          id,
          title: cleanTitle || targetMeta?.title || '',
          description: cleanDesc || targetMeta?.description || '',
          category: targetMeta?.category || 'bostad',
          country: targetMeta?.country || 'se',
          city: targetMeta?.city || 'Stockholm',
          area: cleanArea,
          price: safePrice,
          contact_phone: cleanPhone,
        };
        const prepared = prepareIncomingAdFingerprint(incomingUpdated);

        if (cleanTitle && cleanDesc) {
          const { data: candidatesRaw } = await supabase.rpc('get_duplicate_candidates', {
            p_country: incomingUpdated.country,
            p_category: incomingUpdated.category,
            p_owner_hashes: prepared.contactHashes,
            p_image_hashes: [],
            p_content_hash: prepared.contentHash,
            p_exclude_ad_id: id,
          });
          const dupCheck = detectDuplicates(incomingUpdated, Array.isArray(candidatesRaw) ? candidatesRaw : [], {});
          if (dupCheck.decision === 'block' && dupCheck.score >= 0.85) {
            return res.status(409).json({
              ok: false,
              code: 'DUPLICATE_AD',
              error: 'تغییرات جدید با یک آگهی دیگر کاملاً تکراری است. لطفاً متن آگهی را منحصربه‌فرد نگه دارید.',
              duplicateMatch: dupCheck.topMatch,
            });
          }
        }

        const { data, error } = await supabase.rpc('owner_update_ad', {
          p_ad_id: id,
          p_pin_code: cleanPin,
          p_updates: {
            title: cleanTitle,
            price: safePrice,
            area: cleanArea,
            description: cleanDesc,
            status: safeOwnerStatus,
            contact_phone: cleanPhone,
            normalized_title: prepared.titleNorm,
            normalized_text: prepared.normalizedText,
            content_hash: prepared.contentHash,
          },
        });

        if (error) throw error;
        if (!data?.ok) {
          return res.status(data?.error_code === 'INVALID_CREDENTIALS' ? 401 : 400).json({
            ok: false,
            error: data?.error || 'عدم دسترسی یا پین نامعتبر.',
          });
        }
        return res.status(200).json({
          ok: true,
          ad: data.ad,
          meaningful_activity_recorded: Boolean(data.meaningful_activity_recorded),
        });
      }

      if (action === 'delete_ad') {
        if (!checkSubRateLimit(req, { bucket: 'pin_mut', maxAttempts: 20 })) {
          return res.status(429).json({ ok: false, error: 'تعداد درخواست‌ها زیاد است. لطفاً کمی بعد تلاش کنید.' });
        }
        const { id, pin_code } = body;
        const cleanPin = normalizeAsciiDigits(pin_code || '').trim();
        if (!id || !cleanPin) {
          return res.status(400).json({ ok: false, error: 'شناسه آگهی و کد مدیریت الزامی است.' });
        }

        const { data, error } = await supabase.rpc('owner_soft_delete_ad', {
          p_ad_id: id,
          p_pin_code: cleanPin,
        });
        if (error) throw error;
        if (!data?.ok) {
          const st = data?.error_code === 'INVALID_CREDENTIALS' ? 401 : data?.error_code === 'AD_PROTECTED' ? 409 : 400;
          return res.status(st).json({ ok: false, error: data?.error || 'امکان حذف آگهی وجود ندارد.' });
        }
        return res.status(200).json({ ok: true, softDeleted: true });
      }

      if (action === 'submit_website_order') {
        if (!checkSubRateLimit(req, { bucket: 'web_order', maxAttempts: 10 })) {
          return res.status(429).json({ ok: false, error: 'تعداد درخواست‌ها زیاد است.' });
        }
        if (!HAS_SERVICE_ROLE) {
          return res.status(503).json({ ok: false, error: 'تنظیمات امنیتی سرور تکمیل نشده است.' });
        }
        const validated = validateWebsiteOrderFields(body);
        if (!validated.ok) {
          return res.status(400).json({ ok: false, error: validated.error });
        }

        const { mode: stripeMode, secretKey } = await getStripeConfig();
        if (
          stripeMode === 'live' ||
          Boolean(secretKey) ||
          (process.env.VERCEL_ENV === 'production' && process.env.ALLOW_SIMULATED_TEST_PAYMENTS !== 'true')
        ) {
          return res.status(403).json({
            ok: false,
            error: 'ثبت سفارش فقط پس از تایید پرداخت در درگاه رسمی Stripe انجام می‌شود.',
          });
        }

        const { data: existingRow } = await supabase
          .from('swedpersiska_settings')
          .select('value')
          .eq('key', 'seller_deployments')
          .maybeSingle();
        const prev = Array.isArray(existingRow?.value) ? existingRow.value : [];

        const orderId = `WEB-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        const manageCode = generateUniqueManageCode(prev);
        const createdAt = new Date().toISOString();
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        const newOrder = {
          storeId: orderId,
          manageCode,
          workerName: `sub_${orderId.toLowerCase()}`,
          dbId: '',
          name: validated.name,
          phone: validated.phone,
          companyNumber: validated.companyNumber,
          email: validated.email,
          websiteUrl: '',
          panelUrl: '',
          storefrontApiUrl: '',
          adminNotes: '',
          status: 'pending_setup',
          paymentStatus: 'test_paid',
          setupPrice: 1500,
          monthlyPrice: 260,
          expiresAt,
          createdAt,
        };

        const { error: upsertErr } = await supabase.from('swedpersiska_settings').upsert({
          key: 'seller_deployments',
          value: [newOrder, ...prev].slice(0, 500),
          updated_at: createdAt,
        });
        if (upsertErr) throw upsertErr;

        return res.status(200).json({ ok: true, order: newOrder });
      }

      if (action === 'create_website_checkout') {
        if (!checkSubRateLimit(req, { bucket: 'stripe_api', maxAttempts: 15, windowMs: 15 * 60 * 1000 })) {
          return res.status(429).json({ ok: false, error: 'تعداد درخواست‌های پرداخت زیاد است. لطفاً کمی بعد تلاش کنید.' });
        }
        const validated = validateWebsiteOrderFields(body);
        if (!validated.ok) {
          return res.status(400).json({ ok: false, error: validated.error });
        }

        const { enabled, mode, secretKey } = await getStripeConfig();
        if (!enabled) {
          return res.status(403).json({ ok: false, error: 'درگاه پرداخت در حال حاضر غیرفعال است.' });
        }
        const keyCheck = validateStripeSecretKeyForMode(secretKey, mode);
        if (!keyCheck.ok) {
          return res.status(503).json({ ok: false, error: keyCheck.error });
        }

        const safeOrigin = resolveSafeRedirectOrigin(req, ALLOWED_ORIGINS, 'https://www.linksho.eu');
        const session = await createStripeCheckoutSession({
          secretKey,
          amountOre: 150000, // 1,500 SEK
          productName: `راه‌اندازی وب‌سایت اختصاصی (${validated.name})`,
          successUrl: `${safeOrigin}/?page=website-builder&stripe_session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${safeOrigin}/?page=website-builder&cancelled=1`,
          customerEmail: validated.email,
          metadata: {
            type: 'website_builder_setup',
            name: validated.name,
            phone: validated.phone,
            companyNumber: validated.companyNumber,
            email: validated.email,
          },
        });

        return res.status(200).json({ ok: true, checkoutUrl: session.url, sessionId: session.id });
      }

      if (action === 'verify_website_checkout') {
        if (!checkSubRateLimit(req, { bucket: 'stripe_api', maxAttempts: 15, windowMs: 15 * 60 * 1000 })) {
          return res.status(429).json({ ok: false, error: 'تعداد درخواست‌ها زیاد است. لطفاً کمی بعد تلاش کنید.' });
        }
        if (!HAS_SERVICE_ROLE) {
          return res.status(503).json({ ok: false, error: 'تنظیمات امنیتی سرور تکمیل نشده است.' });
        }
        const sessionId = String(body.sessionId || '').trim();
        if (!sessionId || !/^cs_[a-zA-Z0-9_]+$/.test(sessionId)) {
          return res.status(400).json({ ok: false, error: 'شناسه پرداخت Stripe نامعتبر است.' });
        }

        const { mode, secretKey } = await getStripeConfig();
        const keyCheck = validateStripeSecretKeyForMode(secretKey, mode);
        if (!keyCheck.ok) {
          return res.status(503).json({ ok: false, error: keyCheck.error });
        }

        const { data: existingRow } = await supabase
          .from('swedpersiska_settings')
          .select('value')
          .eq('key', 'seller_deployments')
          .maybeSingle();
        const prev = Array.isArray(existingRow?.value) ? existingRow.value : [];

        // Idempotency: return sanitized order + manageCode/email if this session was already redeemed (never leak admin-populated credentials/notes)
        const existingOrder = prev.find((item) => item?.stripeSessionId === sessionId);
        if (existingOrder) {
          return res.status(200).json({
            ok: true,
            order: {
              ...sanitizePublicSubscription(existingOrder),
              manageCode: existingOrder.manageCode,
              email: existingOrder.email,
            },
          });
        }

        const session = await retrieveStripeCheckoutSession(secretKey, sessionId);
        const sessionCheck = verifyVerifiedCheckoutSession(session, {
          expectedType: 'website_builder_setup',
          expectedMode: mode,
          expectedMinAmountMinor: 150000,
          expectedCurrency: 'sek',
        });
        if (!sessionCheck.ok) {
          return res.status(402).json({ ok: false, error: sessionCheck.error || 'پرداخت هنوز تایید نشده است.' });
        }

        const orderId = `WEB-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        const manageCode = generateUniqueManageCode(prev);
        const createdAt = new Date().toISOString();
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        const newOrder = {
          storeId: orderId,
          manageCode,
          workerName: `sub_${orderId.toLowerCase()}`,
          dbId: '',
          name: String(session.metadata?.name || 'وب‌سایت جدید').slice(0, 120),
          phone: String(session.metadata?.phone || '').slice(0, 40),
          companyNumber: String(session.metadata?.companyNumber || '').slice(0, 60),
          email: String(session.metadata?.email || session.customer_email || '').slice(0, 120),
          websiteUrl: '',
          panelUrl: '',
          storefrontApiUrl: '',
          adminNotes: '',
          status: 'pending_setup',
          paymentStatus: 'paid',
          stripeSessionId: session.id,
          setupPrice: 1500,
          monthlyPrice: 260,
          expiresAt,
          createdAt,
        };

        const { error: upsertErr } = await supabase.from('swedpersiska_settings').upsert({
          key: 'seller_deployments',
          value: [newOrder, ...prev].slice(0, 500),
          updated_at: createdAt,
        });
        if (upsertErr) throw upsertErr;

        return res.status(200).json({ ok: true, order: newOrder });
      }

      if (action === 'manage_website_subscription') {
        if (!checkSubRateLimit(req)) {
          return res.status(429).json({
            ok: false,
            error: 'تعداد درخواست‌های شما زیاد است. لطفاً چند دقیقه دیگر دوباره تلاش کنید.',
          });
        }
        if (!HAS_SERVICE_ROLE) {
          return res.status(503).json({ ok: false, error: 'تنظیمات امنیتی سرور تکمیل نشده است.' });
        }

        const cleanCode = String(body.manageCode || '').replace(/\D/g, '').trim();
        const subAction = String(body.subAction || 'lookup').trim();
        if (cleanCode.length !== 8) {
          return res.status(400).json({ ok: false, error: 'لطفاً کد مدیریت ۸ رقمی معتبر وارد کنید.' });
        }

        const { data: existingRow } = await supabase
          .from('swedpersiska_settings')
          .select('value')
          .eq('key', 'seller_deployments')
          .maybeSingle();
        const list = Array.isArray(existingRow?.value) ? existingRow.value : [];
        const idx = list.findIndex((item) => safeEqual(String(item.manageCode || ''), cleanCode));
        if (idx === -1) {
          return res.status(404).json({ ok: false, error: 'اشتراکی با این کد ۸ رقمی یافت نشد.' });
        }

        const current = list[idx];
        if (subAction === 'renew') {
          const { mode: stripeMode, secretKey } = await getStripeConfig();
          const requireStripeCheckout =
            stripeMode === 'live' ||
            Boolean(secretKey) ||
            (process.env.VERCEL_ENV === 'production' && process.env.ALLOW_SIMULATED_TEST_PAYMENTS !== 'true');
          if (requireStripeCheckout) {
            if (secretKey) {
              const keyCheck = validateStripeSecretKeyForMode(secretKey, stripeMode);
              if (!keyCheck.ok) {
                return res.status(503).json({ ok: false, error: keyCheck.error });
              }
              const safeOrigin = resolveSafeRedirectOrigin(req, ALLOWED_ORIGINS, 'https://www.linksho.eu');
              const session = await createStripeCheckoutSession({
                secretKey,
                amountOre: 26000, // 260 SEK
                productName: `تمدید ماهانه اشتراک وب‌سایت (${current.name})`,
                successUrl: `${safeOrigin}/?page=website-builder&renew_session_id={CHECKOUT_SESSION_ID}`,
                cancelUrl: `${safeOrigin}/?page=website-builder&cancelled=1`,
                customerEmail: current.email || '',
                metadata: {
                  type: 'website_builder_renew',
                  manageCode: cleanCode,
                },
              });
              return res.status(200).json({
                ok: true,
                requiresStripeCheckout: true,
                checkoutUrl: session.url,
                subscription: sanitizePublicSubscription(current),
              });
            }
            const updated = {
              ...current,
              renewRequestedAt: new Date().toISOString(),
            };
            const nextList = list.map((x, i) => (i === idx ? updated : x));
            const { error: upsertErr } = await supabase.from('swedpersiska_settings').upsert({
              key: 'seller_deployments',
              value: nextList,
              updated_at: new Date().toISOString(),
            });
            if (upsertErr) throw upsertErr;
            return res.status(200).json({
              ok: true,
              subscription: sanitizePublicSubscription(updated),
              message: 'درخواست تمدید ثبت شد؛ پس از پرداخت فاکتور ۲۶۰ کرون و تایید پشتیبانی، اشتراک شما فعال می‌شود.',
            });
          }

          const baseTime = current.expiresAt && new Date(current.expiresAt).getTime() > Date.now()
            ? new Date(current.expiresAt).getTime()
            : Date.now();
          const updated = {
            ...current,
            status: current.status === 'cancelled' ? 'active' : current.status,
            expiresAt: new Date(baseTime + 30 * 24 * 60 * 60 * 1000).toISOString(),
            renewRequestedAt: '',
          };
          const nextList = list.map((x, i) => (i === idx ? updated : x));
          const { error: upsertErr } = await supabase.from('swedpersiska_settings').upsert({
            key: 'seller_deployments',
            value: nextList,
            updated_at: new Date().toISOString(),
          });
          if (upsertErr) throw upsertErr;
          return res.status(200).json({ ok: true, subscription: sanitizePublicSubscription(updated) });
        }

        if (subAction === 'cancel') {
          const updated = {
            ...current,
            status: 'cancelled',
            cancelledAt: new Date().toISOString(),
          };
          const nextList = list.map((x, i) => (i === idx ? updated : x));
          const { error: upsertErr } = await supabase.from('swedpersiska_settings').upsert({
            key: 'seller_deployments',
            value: nextList,
            updated_at: new Date().toISOString(),
          });
          if (upsertErr) throw upsertErr;
          return res.status(200).json({ ok: true, subscription: sanitizePublicSubscription(updated) });
        }

        return res.status(200).json({ ok: true, subscription: sanitizePublicSubscription(current) });
      }

      if (action === 'verify_website_renew') {
        if (!checkSubRateLimit(req, { bucket: 'stripe_api', maxAttempts: 15, windowMs: 15 * 60 * 1000 })) {
          return res.status(429).json({ ok: false, error: 'تعداد درخواست‌ها زیاد است. لطفاً کمی بعد تلاش کنید.' });
        }
        if (!HAS_SERVICE_ROLE) {
          return res.status(503).json({ ok: false, error: 'تنظیمات امنیتی سرور تکمیل نشده است.' });
        }
        const sessionId = String(body.sessionId || '').trim();
        if (!sessionId || !/^cs_[a-zA-Z0-9_]+$/.test(sessionId)) {
          return res.status(400).json({ ok: false, error: 'شناسه پرداخت Stripe نامعتبر است.' });
        }

        const { mode, secretKey } = await getStripeConfig();
        const keyCheck = validateStripeSecretKeyForMode(secretKey, mode);
        if (!keyCheck.ok) {
          return res.status(503).json({ ok: false, error: keyCheck.error });
        }

        const session = await retrieveStripeCheckoutSession(secretKey, sessionId);
        const sessionCheck = verifyVerifiedCheckoutSession(session, {
          expectedType: 'website_builder_renew',
          expectedMode: mode,
          expectedMinAmountMinor: 26000,
          expectedCurrency: 'sek',
        });
        if (!sessionCheck.ok) {
          return res.status(402).json({ ok: false, error: sessionCheck.error || 'پرداخت تمدید هنوز تایید نشده است.' });
        }

        const cleanCode = String(session.metadata?.manageCode || '').replace(/\D/g, '').trim();
        const { data: existingRow } = await supabase
          .from('swedpersiska_settings')
          .select('value')
          .eq('key', 'seller_deployments')
          .maybeSingle();
        const list = Array.isArray(existingRow?.value) ? existingRow.value : [];
        const idx = list.findIndex((item) => safeEqual(String(item.manageCode || ''), cleanCode));
        if (idx === -1) {
          return res.status(404).json({ ok: false, error: 'اشتراک مرتبط یافت نشد.' });
        }

        const current = list[idx];
        const prevRedeemed = Array.isArray(current.redeemedRenewSessionIds) ? current.redeemedRenewSessionIds : [];
        if (current.lastRenewSessionId === session.id || prevRedeemed.includes(session.id)) {
          return res.status(200).json({ ok: true, subscription: sanitizePublicSubscription(current) });
        }

        const baseTime = current.expiresAt && new Date(current.expiresAt).getTime() > Date.now()
          ? new Date(current.expiresAt).getTime()
          : Date.now();
        const updated = {
          ...current,
          status: current.status === 'cancelled' ? 'active' : current.status,
          expiresAt: new Date(baseTime + 30 * 24 * 60 * 60 * 1000).toISOString(),
          lastRenewSessionId: session.id,
          redeemedRenewSessionIds: [...prevRedeemed, session.id].slice(-50),
          renewRequestedAt: '',
        };
        const nextList = list.map((x, i) => (i === idx ? updated : x));
        const { error: upsertErr } = await supabase.from('swedpersiska_settings').upsert({
          key: 'seller_deployments',
          value: nextList,
          updated_at: new Date().toISOString(),
        });
        if (upsertErr) throw upsertErr;

        return res.status(200).json({ ok: true, subscription: sanitizePublicSubscription(updated) });
      }

      if (action === 'increment_view') {
        if (!checkSubRateLimit(req, { bucket: 'inc_view', maxAttempts: 60, windowMs: 5 * 60 * 1000 })) {
          return res.status(200).json({ ok: true });
        }
        const { id } = body;
        if (id && UUID_RE.test(String(id).trim())) {
          await supabase.rpc('increment_ad_view', { p_ad_id: String(id).trim() });
        }
        return res.status(200).json({ ok: true });
      }

      if (action === 'promote_ad') {
        if (!checkSubRateLimit(req, { bucket: 'stripe_api', maxAttempts: 15, windowMs: 15 * 60 * 1000 })) {
          return res.status(429).json({ ok: false, error: 'تعداد درخواست‌ها زیاد است. لطفاً کمی بعد تلاش کنید.' });
        }
        if (!HAS_SERVICE_ROLE) {
          return res.status(503).json({ ok: false, error: 'تنظیمات امنیتی سرور پرداخت تکمیل نشده است.' });
        }

        const { id, country } = body;
        if (!id || !UUID_RE.test(String(id).trim())) {
          return res.status(400).json({ ok: false, error: 'شناسه آگهی نامعتبر است.' });
        }

        const { enabled, mode, secretKey } = await getStripeConfig();
        if (!enabled) {
          return res.status(403).json({ ok: false, error: 'درگاه پرداخت ویژه در حال حاضر غیرفعال است.' });
        }
        if (
          mode === 'live' ||
          Boolean(secretKey) ||
          (process.env.VERCEL_ENV === 'production' && process.env.ALLOW_SIMULATED_TEST_PAYMENTS !== 'true')
        ) {
          return res.status(403).json({
            ok: false,
            code: 'STRIPE_CHECKOUT_REQUIRED',
            error: 'ارتقای ویژه فقط از طریق درگاه پرداخت رسمی Stripe انجام می‌شود.',
          });
        }

        const targetCountry = country && /^[a-z0-9_-]{2,10}$/i.test(String(country))
          ? String(country).toLowerCase()
          : 'se';
        const sessionToken = `test_vip_${crypto.randomUUID()}`;

        const { data, error } = await supabase.rpc('activate_ad_promotion_from_payment', {
          p_ad_id: id,
          p_target_country: targetCountry,
          p_provider: 'stripe_test',
          p_session_id: sessionToken,
        });
        if (error) throw error;
        if (!data?.ok) {
          const st = data?.error_code === 'LIVE_PAYMENT_REQUIRED' ? 403 : 400;
          return res.status(st).json({ ok: false, code: data?.error_code, error: data?.error || 'خطا در ارتقای آگهی' });
        }
        return res.status(200).json({ ok: true, ad: data.ad, expires_at: data.expires_at });
      }

      if (action === 'create_vip_checkout') {
        if (!checkSubRateLimit(req, { bucket: 'vip_checkout', maxAttempts: 12, windowMs: 15 * 60 * 1000 })) {
          return res.status(429).json({ ok: false, error: 'تعداد درخواست‌های پرداخت زیاد است. لطفاً کمی بعد تلاش کنید.' });
        }
        if (!HAS_SERVICE_ROLE) {
          return res.status(503).json({ ok: false, error: 'متغیر امنیتی SUPABASE_SERVICE_ROLE_KEY روی سرور تنظیم نشده است.' });
        }

        const { id, country } = body;
        if (!id || !UUID_RE.test(String(id).trim())) {
          return res.status(400).json({ ok: false, error: 'شناسه آگهی نامعتبر است.' });
        }

        const rawCountry = String(country || 'se').trim().toLowerCase();
        const targetCountry = ALLOWED_VIP_COUNTRIES.has(rawCountry) ? rawCountry : 'se';

        const [{ enabled, mode, secretKey, stripeCfg }, { data: adRow }] = await Promise.all([
          getStripeConfig(),
          supabase
            .from('swedpersiska_ads')
            .select('id, reference_number, title, title_fa, status')
            .eq('id', String(id).trim())
            .is('deleted_at', null)
            .maybeSingle(),
        ]);

        if (!enabled) {
          return res.status(403).json({ ok: false, error: 'درگاه پرداخت ویژه در حال حاضر غیرفعال است.' });
        }
        const keyCheck = validateStripeSecretKeyForMode(secretKey, mode);
        if (!keyCheck.ok) {
          return res.status(503).json({ ok: false, error: keyCheck.error });
        }
        if (!adRow) {
          return res.status(404).json({ ok: false, error: 'آگهی یافت نشد.' });
        }
        if (adRow.status === 'rejected') {
          return res.status(400).json({ ok: false, error: 'آگهی ردشده امکان ارتقای ویژه ندارد.' });
        }

        const pricing = computeVipPrice({ stripeCfg, targetCountry });
        const safeOrigin = resolveSafeRedirectOrigin(req, ALLOWED_ORIGINS, 'https://www.linksho.eu');
        const minuteBucket = Math.floor(Date.now() / 60000);
        const session = await createStripeCheckoutSession({
          secretKey,
          amountOre: pricing.amountMinor,
          currency: pricing.currency.toLowerCase(),
          productName: `ارتقای ویژه (VIP) آگهی ${adRow.reference_number} (${pricing.durationDays} روز)`,
          successUrl: `${safeOrigin}/?vip_session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${safeOrigin}/?vip_cancelled=1`,
          idempotencyKey: `vip_${adRow.id}_${pricing.targetCountry}_${minuteBucket}`,
          metadata: {
            type: 'ad_vip_promotion',
            adId: adRow.id,
            targetCountry: pricing.targetCountry,
            durationDays: String(pricing.durationDays),
          },
        });

        const { error: pendErr } = await supabase.rpc('create_pending_ad_payment', {
          p_ad_id: adRow.id,
          p_target_country: pricing.targetCountry,
          p_session_id: session.id,
          p_amount: pricing.amountMajor,
          p_currency: pricing.currency,
          p_duration_days: pricing.durationDays,
        });
        if (pendErr) throw pendErr;

        return res.status(200).json({ ok: true, checkoutUrl: session.url, sessionId: session.id, mode });
      }

      if (action === 'verify_vip_checkout') {
        if (!checkSubRateLimit(req, { bucket: 'stripe_api', maxAttempts: 15, windowMs: 15 * 60 * 1000 })) {
          return res.status(429).json({ ok: false, error: 'تعداد درخواست‌ها زیاد است. لطفاً کمی بعد تلاش کنید.' });
        }
        if (!HAS_SERVICE_ROLE) {
          return res.status(503).json({ ok: false, error: 'متغیر امنیتی SUPABASE_SERVICE_ROLE_KEY روی سرور تنظیم نشده است.' });
        }

        const sessionId = String(body.sessionId || '').trim();
        if (!sessionId || !/^cs_[a-zA-Z0-9_]+$/.test(sessionId)) {
          return res.status(400).json({ ok: false, error: 'شناسه پرداخت Stripe نامعتبر است.' });
        }
        const { mode, secretKey, stripeCfg } = await getStripeConfig();
        const keyCheck = validateStripeSecretKeyForMode(secretKey, mode);
        if (!keyCheck.ok) {
          return res.status(503).json({ ok: false, error: keyCheck.error });
        }

        const session = await retrieveStripeCheckoutSession(secretKey, sessionId);
        const targetCountry = String(session.metadata?.targetCountry || 'se').trim().toLowerCase();
        const pricing = computeVipPrice({ stripeCfg, targetCountry });

        const sessionCheck = verifyVerifiedCheckoutSession(session, {
          expectedType: 'ad_vip_promotion',
          expectedMode: mode,
          expectedMinAmountMinor: pricing.amountMinor,
          expectedCurrency: pricing.currency,
        });
        if (!sessionCheck.ok) {
          return res.status(402).json({ ok: false, error: sessionCheck.error || 'پرداخت ارتقای ویژه هنوز تایید نشده است.' });
        }

        const adId = String(session.metadata?.adId || '').trim();
        if (!UUID_RE.test(adId)) {
          return res.status(400).json({ ok: false, error: 'شناسه آگهی مرتبط با پرداخت نامعتبر است.' });
        }

        const amountPaid = session.amount_total ? Number(session.amount_total) / 100 : pricing.amountMajor;
        const paidCurrency = session.currency ? String(session.currency).toUpperCase() : pricing.currency;

        const { data, error } = await supabase.rpc('activate_ad_promotion_from_payment', {
          p_ad_id: adId,
          p_target_country: pricing.targetCountry,
          p_provider: mode === 'live' ? 'stripe_live' : 'stripe_test',
          p_session_id: session.id,
          p_amount: amountPaid,
          p_currency: paidCurrency,
        });
        if (error) throw error;
        if (!data?.ok) {
          return res.status(400).json({ ok: false, error: data?.error || 'خطا در فعال‌سازی آگهی ویژه' });
        }

        if (session.payment_intent) {
          try {
            await supabase.rpc('sync_ad_payment_webhook_event', {
              p_event_type: 'attach_payment_intent',
              p_session_id: session.id,
              p_payment_intent_id: String(session.payment_intent),
              p_reason: null,
            });
          } catch {}
        }

        return res.status(200).json({ ok: true, ad: data.ad, expires_at: data.expires_at });
      }

      if (action === 'report_ad') {
        if (!checkSubRateLimit(req, { bucket: 'report_ad', maxAttempts: 10, windowMs: 15 * 60 * 1000 })) {
          return res.status(429).json({ ok: false, error: 'تعداد گزارش‌های شما بیش از حد مجاز است.' });
        }
        const { id, reason, details } = body;
        if (!id || !UUID_RE.test(String(id).trim()) || !reason) return res.status(400).json({ ok: false, error: 'Missing report fields' });

        const { data, error } = await supabase.rpc('report_ad_secure', {
          p_ad_id: String(id).trim(),
          p_reason: String(reason).slice(0, 80),
          p_details: String(details || '').slice(0, 400),
        });
        if (error) throw error;
        if (!data?.ok) {
          return res.status(400).json({ ok: false, error: data?.error || 'خطا در ثبت گزارش' });
        }
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ ok: false, error: 'Unknown action' });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('[public] error:', err?.message || err);
    return res.status(500).json({ ok: false, error: 'خطای داخلی سرور. لطفاً دوباره تلاش کنید.' });
  }
}
