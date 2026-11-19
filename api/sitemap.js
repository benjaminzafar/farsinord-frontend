import { createClient } from '@supabase/supabase-js';
import {
  CANONICAL_ORIGIN,
  SEO_COUNTRIES,
  SEO_CATEGORIES,
  escapeXml,
  normalizeCanonicalCountry,
  normalizePublicHttpUrl,
} from './_lib/seoCore.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://bezbnymjcnmazdonfzky.supabase.co';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlemJueW1qY25tYXpkb25memt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ2OTM1NjksImV4cCI6MjExMDI2OTU2OX0.ylsHBAZ1zo1z_aKpHx7hgl-yZu2yt2puFNhR8jBm6S4';
const supabase = createClient(supabaseUrl, supabaseKey);

const COUNTRY_ISO_MAP = new Map(SEO_COUNTRIES.map((c) => [c.id, c.iso || c.id.toUpperCase()]));
const SITEMAP_CACHE_TTL_MS = 10 * 60 * 1000;
const SITEMAP_DEGRADED_TTL_MS = 60 * 1000;
const sitemapMemoryCache = new Map(); // cacheKey -> { xml, lastModDate, degraded, expiresAt }

async function runWithAbortTimeout(buildQuery, ms = 4500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const query = buildQuery(controller.signal);
    const result = await query;
    return { data: result?.data ?? null, error: result?.error ?? null, timedOut: false };
  } catch (err) {
    const timedOut = err?.name === 'AbortError' || controller.signal.aborted;
    return { data: null, error: err || new Error('Query failed'), timedOut };
  } finally {
    clearTimeout(timer);
  }
}

function sendXmlResponse(req, res, xml, { lastModDate, degraded = false } = {}) {
  const byteLength = Buffer.byteLength(xml, 'utf8');
  const lastModHttp = (lastModDate instanceof Date && !Number.isNaN(lastModDate.getTime())
    ? lastModDate
    : new Date()
  ).toUTCString();

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Content-Length', String(byteLength));
  res.setHeader('Last-Modified', lastModHttp);
  res.setHeader(
    'Cache-Control',
    degraded
      ? 'public, max-age=60, s-maxage=60'
      : 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400'
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'HEAD') {
    return res.status(200).end();
  }
  return res.status(200).send(xml);
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end('Method Not Allowed');
  }

  const baseUrl = CANONICAL_ORIGIN;
  const todayIso = new Date().toISOString().slice(0, 10);
  const rawMode = String(req.query?.mode || '').trim().toLowerCase();
  const mode = rawMode === 'index' || rawMode === 'static' || rawMode === 'ads' ? rawMode : 'full';

  if (mode === 'index') {
    const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${escapeXml(`${baseUrl}/sitemap-static.xml`)}</loc>
    <lastmod>${todayIso}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${escapeXml(`${baseUrl}/sitemap-ads.xml`)}</loc>
    <lastmod>${todayIso}</lastmod>
  </sitemap>
</sitemapindex>`;

    return sendXmlResponse(req, res, indexXml, { lastModDate: new Date(), degraded: false });
  }

  const now = Date.now();
  const cachedEntry = sitemapMemoryCache.get(mode);
  if (cachedEntry && cachedEntry.expiresAt > now) {
    return sendXmlResponse(req, res, cachedEntry.xml, {
      lastModDate: cachedEntry.lastModDate,
      degraded: cachedEntry.degraded,
    });
  }

  let countries = SEO_COUNTRIES.map((c) => ({ id: c.id, iso: c.iso }));
  const latestByCountry = new Map();
  const latestByCountryCategory = new Map();
  const adUrlEntries = [];
  let latestGlobalMod = '';
  let latestGlobalTs = 0;
  let degraded = false;
  const selectColumns =
    mode === 'static'
      ? 'country, category, updated_at, sort_timestamp, created_at'
      : 'id, reference_number, country, category, images, updated_at, sort_timestamp, created_at';

  try {
    const [settingsResult, adsResult] = await Promise.all([
      mode === 'ads'
        ? Promise.resolve({ data: null, error: null, timedOut: false })
        : runWithAbortTimeout(
            (signal) =>
              supabase
                .from('swedpersiska_settings')
                .select('value')
                .eq('key', 'portal_countries')
                .abortSignal(signal)
                .maybeSingle(),
            4500
          ),
      runWithAbortTimeout(
        (signal) =>
          supabase
            .from('swedpersiska_ads')
            .select(selectColumns)
            .eq('status', 'active')
            .is('deleted_at', null)
            .order('sort_timestamp', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(2500)
            .abortSignal(signal),
        4500
      ),
    ]);

    if (adsResult.error || adsResult.timedOut) {
      degraded = true;
    }

    const settingsRow = settingsResult?.data;
    if (Array.isArray(settingsRow?.value) && settingsRow.value.length > 0) {
      const enabledMap = new Map(SEO_COUNTRIES.map((c) => [c.id, { id: c.id, iso: c.iso, enabled: true }]));
      for (const item of settingsRow.value) {
        const cid = normalizeCanonicalCountry(item?.id);
        if (!cid) continue;
        const isoCandidate = String(item?.iso || COUNTRY_ISO_MAP.get(cid) || '').trim().toUpperCase();
        const iso = /^[A-Z]{2}$/.test(isoCandidate) ? isoCandidate : (COUNTRY_ISO_MAP.get(cid) || null);
        enabledMap.set(cid, { id: cid, iso, enabled: item.enabled !== false });
      }
      const enabledList = Array.from(enabledMap.values()).filter((c) => c.enabled);
      if (enabledList.length > 0) {
        countries = enabledList.map(({ id, iso }) => ({ id, iso }));
      }
    }

    const seenAdLocs = new Set();
    const ads = adsResult?.data;
    if (Array.isArray(ads)) {
      for (const ad of ads) {
        const rawTimestamp = ad.updated_at || ad.sort_timestamp || ad.created_at || '';
        const parsedTs = Date.parse(rawTimestamp);
        if (Number.isFinite(parsedTs) && parsedTs > latestGlobalTs) {
          latestGlobalTs = parsedTs;
        }
        const rawMod = String(rawTimestamp || todayIso).slice(0, 10);
        const mod = /^\d{4}-\d{2}-\d{2}$/.test(rawMod) ? rawMod : todayIso;
        if (!latestGlobalMod || mod > latestGlobalMod) {
          latestGlobalMod = mod;
        }

        const cid = normalizeCanonicalCountry(ad.country) || 'se';
        if (!latestByCountry.has(cid) || mod > latestByCountry.get(cid)) {
          latestByCountry.set(cid, mod);
        }
        if (ad.category) {
          const comboKey = `${cid}|${ad.category}`;
          if (!latestByCountryCategory.has(comboKey) || mod > latestByCountryCategory.get(comboKey)) {
            latestByCountryCategory.set(comboKey, mod);
          }
        }

        if (mode !== 'static') {
          const slug = encodeURIComponent(ad.reference_number || ad.id);
          const loc = `${baseUrl}/?ad=${slug}`;
          if (seenAdLocs.has(loc)) continue;
          seenAdLocs.add(loc);

          const safeImages = (Array.isArray(ad.images) ? ad.images : [])
            .map((img) => normalizePublicHttpUrl(img))
            .filter(Boolean)
            .slice(0, 3);

          adUrlEntries.push({
            loc,
            lastmod: mod,
            changefreq: 'weekly',
            priority: '0.7',
            images: safeImages,
          });
        }
      }
    }
  } catch {
    degraded = true;
  }

  const effectiveLastMod = latestGlobalMod || todayIso;
  const lastModDate = latestGlobalTs > 0 ? new Date(latestGlobalTs) : new Date();

  const seenLocs = new Set();
  const urls = [];
  const pushUnique = (entry) => {
    if (!entry?.loc || seenLocs.has(entry.loc)) return;
    seenLocs.add(entry.loc);
    urls.push(entry);
  };

  if (mode !== 'ads') {
    pushUnique({ loc: `${baseUrl}/`, lastmod: effectiveLastMod, changefreq: 'hourly', priority: '1.0', alternates: true });
    pushUnique({ loc: `${baseUrl}/?page=podcast`, lastmod: effectiveLastMod, changefreq: 'daily', priority: '0.8' });
    pushUnique({ loc: `${baseUrl}/?page=website-builder`, lastmod: effectiveLastMod, changefreq: 'weekly', priority: '0.9' });

    for (const c of countries) {
      pushUnique({
        loc: `${baseUrl}/?c=${encodeURIComponent(c.id)}`,
        lastmod: latestByCountry.get(c.id) || effectiveLastMod,
        changefreq: 'daily',
        priority: '0.9',
        alternates: true,
      });
    }

    for (const c of countries) {
      for (const cat of SEO_CATEGORIES) {
        pushUnique({
          loc: `${baseUrl}/?c=${encodeURIComponent(c.id)}&cat=${encodeURIComponent(cat.id)}`,
          lastmod: latestByCountryCategory.get(`${c.id}|${cat.id}`) || latestByCountry.get(c.id) || effectiveLastMod,
          changefreq: 'daily',
          priority: '0.8',
        });
      }
    }
  }

  for (const adEntry of adUrlEntries) {
    pushUnique(adEntry);
  }

  const hreflangLinks = [
    ...countries
      .filter((c) => c.iso && /^[A-Z]{2}$/.test(c.iso))
      .map(
        (c) =>
          `    <xhtml:link rel="alternate" hreflang="fa-${c.iso}" href="${escapeXml(`${baseUrl}/?c=${encodeURIComponent(c.id)}`)}" />`
      ),
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(`${baseUrl}/`)}" />`,
  ].join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls
  .map((u) => {
    const imgTags = Array.isArray(u.images) && u.images.length > 0
      ? '\n' +
        u.images
          .map(
            (imgUrl) => `    <image:image>
      <image:loc>${escapeXml(imgUrl)}</image:loc>
    </image:image>`
          )
          .join('\n')
      : '';
    return `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <lastmod>${escapeXml(u.lastmod)}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>${u.alternates ? `\n${hreflangLinks}` : ''}${imgTags}
  </url>`;
  })
  .join('\n')}
</urlset>`;

  sitemapMemoryCache.set(mode, {
    xml,
    lastModDate,
    degraded,
    expiresAt: Date.now() + (degraded ? SITEMAP_DEGRADED_TTL_MS : SITEMAP_CACHE_TTL_MS),
  });

  return sendXmlResponse(req, res, xml, { lastModDate, degraded });
}
