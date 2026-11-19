import { createClient } from '@supabase/supabase-js';
import {
  CANONICAL_ORIGIN,
  SEO_COUNTRIES,
  SEO_CATEGORIES,
  escapeXml,
  isValidPublicHttpUrl,
  normalizeCanonicalCountry,
} from './_lib/seoCore.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://bezbnymjcnmazdonfzky.supabase.co';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlemJueW1qY25tYXpkb25memt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ2OTM1NjksImV4cCI6MjExMDI2OTU2OX0.ylsHBAZ1zo1z_aKpHx7hgl-yZu2yt2puFNhR8jBm6S4';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  const baseUrl = CANONICAL_ORIGIN;
  const todayIso = new Date().toISOString().slice(0, 10);

  let countryIds = SEO_COUNTRIES.map((c) => c.id);
  try {
    const { data: settingsRow } = await supabase
      .from('swedpersiska_settings')
      .select('value')
      .eq('key', 'portal_countries')
      .maybeSingle();

    if (Array.isArray(settingsRow?.value) && settingsRow.value.length > 0) {
      const enabledMap = new Map(SEO_COUNTRIES.map((c) => [c.id, true]));
      for (const item of settingsRow.value) {
        if (!item?.id) continue;
        enabledMap.set(item.id, item.enabled !== false);
      }
      countryIds = Array.from(enabledMap.entries())
        .filter(([, enabled]) => enabled)
        .map(([id]) => id);
    }
  } catch {}

  const urls = [
    { loc: `${baseUrl}/`, lastmod: todayIso, changefreq: 'hourly', priority: '1.0', alternates: true },
    { loc: `${baseUrl}/?page=podcast`, lastmod: todayIso, changefreq: 'daily', priority: '0.8' },
    { loc: `${baseUrl}/?page=website-builder`, lastmod: todayIso, changefreq: 'weekly', priority: '0.9' },
  ];

  const latestByCountry = new Map();
  const latestByCountryCategory = new Map();
  const adUrlEntries = [];

  try {
    const { data: ads } = await supabase
      .from('swedpersiska_ads')
      .select('id, reference_number, country, category, title, title_fa, images, updated_at, sort_timestamp, created_at')
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('sort_timestamp', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(2500);

    if (Array.isArray(ads)) {
      for (const ad of ads) {
        const slug = encodeURIComponent(ad.reference_number || ad.id);
        const mod = String(ad.updated_at || ad.sort_timestamp || ad.created_at || todayIso).slice(0, 10);
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

        const safeImages = (Array.isArray(ad.images) ? ad.images : [])
          .filter((img) => isValidPublicHttpUrl(img))
          .slice(0, 3);

        adUrlEntries.push({
          loc: `${baseUrl}/?ad=${slug}`,
          lastmod: mod,
          changefreq: 'weekly',
          priority: '0.7',
          title: String(ad.title_fa || ad.title || '').trim(),
          images: safeImages,
        });
      }
    }
  } catch {}

  for (const cid of countryIds) {
    urls.push({
      loc: `${baseUrl}/?c=${cid}`,
      lastmod: latestByCountry.get(cid) || todayIso,
      changefreq: 'daily',
      priority: '0.9',
      alternates: true,
    });
  }

  for (const cat of SEO_CATEGORIES) {
    urls.push({
      loc: `${baseUrl}/?cat=${cat.id}`,
      lastmod: todayIso,
      changefreq: 'daily',
      priority: '0.8',
    });
  }

  for (const cid of countryIds) {
    for (const cat of SEO_CATEGORIES) {
      urls.push({
        loc: `${baseUrl}/?c=${cid}&cat=${cat.id}`,
        lastmod: latestByCountryCategory.get(`${cid}|${cat.id}`) || latestByCountry.get(cid) || todayIso,
        changefreq: 'daily',
        priority: '0.8',
      });
    }
  }

  urls.push(...adUrlEntries);

  const hreflangLinks = [
    ...countryIds.map(
      (cid) =>
        `    <xhtml:link rel="alternate" hreflang="fa-${cid.toUpperCase()}" href="${escapeXml(`${baseUrl}/?c=${cid}`)}" />`
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
      <image:loc>${escapeXml(imgUrl)}</image:loc>${u.title ? `\n      <image:title>${escapeXml(u.title)}</image:title>` : ''}
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

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).send(xml);
}
