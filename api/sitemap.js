import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://bezbnymjcnmazdonfzky.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlemJueW1qY25tYXpkb25memt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ2OTM1NjksImV4cCI6MjExMDI2OTU2OX0.ylsHBAZ1zo1z_aKpHx7hgl-yZu2yt2puFNhR8jBm6S4';
const supabase = createClient(supabaseUrl, supabaseKey);

const COUNTRY_IDS = ['se', 'no', 'dk', 'fi', 'de', 'at', 'nl', 'fr'];
const CATEGORY_IDS = ['bostad', 'restaurang', 'tjanster', 'jobb', 'kop-salj', 'fordon', 'elektronik', 'evenemang', 'ovrigt'];

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export default async function handler(req, res) {
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'swedpersiska.vercel.app').split(',')[0].trim();
  const baseUrl = `${proto}://${host}`;
  const todayIso = new Date().toISOString().slice(0, 10);

  const urls = [
    { loc: `${baseUrl}/`, lastmod: todayIso, changefreq: 'hourly', priority: '1.0', alternates: true },
    { loc: `${baseUrl}/?page=website-builder`, lastmod: todayIso, changefreq: 'weekly', priority: '0.8' },
    { loc: `${baseUrl}/?page=podcast`, lastmod: todayIso, changefreq: 'daily', priority: '0.8' },
  ];

  for (const c of COUNTRY_IDS) {
    urls.push({ loc: `${baseUrl}/?c=${c}`, lastmod: todayIso, changefreq: 'daily', priority: '0.9', alternates: true });
  }
  for (const cat of CATEGORY_IDS) {
    urls.push({ loc: `${baseUrl}/?cat=${cat}`, lastmod: todayIso, changefreq: 'daily', priority: '0.8' });
  }

  try {
    const { data: ads } = await supabase
      .from('swedpersiska_ads')
      .select('id, reference_number, updated_at, created_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (Array.isArray(ads)) {
      for (const ad of ads) {
        const slug = encodeURIComponent(ad.reference_number || ad.id);
        const mod = (ad.updated_at || ad.created_at || todayIso).slice(0, 10);
        urls.push({
          loc: `${baseUrl}/?ad=${slug}`,
          lastmod: mod,
          changefreq: 'weekly',
          priority: '0.7',
        });
      }
    }
  } catch {}

  const hreflangLinks = [
    ...COUNTRY_IDS.map(
      (cid) =>
        `    <xhtml:link rel="alternate" hreflang="fa-${cid.toUpperCase()}" href="${escapeXml(`${baseUrl}/?c=${cid}`)}" />`
    ),
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(`${baseUrl}/`)}" />`,
  ].join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls
  .map(
    (u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <lastmod>${escapeXml(u.lastmod)}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>${u.alternates ? `\n${hreflangLinks}` : ''}
  </url>`
  )
  .join('\n')}
</urlset>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).send(xml);
}
