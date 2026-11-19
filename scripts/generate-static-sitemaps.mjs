import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CANONICAL_ORIGIN,
  SEO_COUNTRIES,
  SEO_CATEGORIES,
  escapeXml,
} from '../api/_lib/seoCore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../dist');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const baseUrl = CANONICAL_ORIGIN;
const buildDateIso = new Date().toISOString().slice(0, 10);

const hreflangLinks = [
  ...SEO_COUNTRIES.map(
    (c) =>
      `    <xhtml:link rel="alternate" hreflang="fa-${c.iso}" href="${escapeXml(`${baseUrl}/?c=${encodeURIComponent(c.id)}`)}" />`
  ),
  `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(`${baseUrl}/`)}" />`,
].join('\n');

const staticUrls = [
  { loc: `${baseUrl}/`, lastmod: buildDateIso, changefreq: 'hourly', priority: '1.0', alternates: true },
  { loc: `${baseUrl}/?page=podcast`, lastmod: buildDateIso, changefreq: 'daily', priority: '0.8' },
  { loc: `${baseUrl}/?page=website-builder`, lastmod: buildDateIso, changefreq: 'weekly', priority: '0.9' },
];

for (const c of SEO_COUNTRIES) {
  staticUrls.push({
    loc: `${baseUrl}/?c=${encodeURIComponent(c.id)}`,
    lastmod: buildDateIso,
    changefreq: 'daily',
    priority: '0.9',
    alternates: true,
  });
}

for (const c of SEO_COUNTRIES) {
  for (const cat of SEO_CATEGORIES) {
    staticUrls.push({
      loc: `${baseUrl}/?c=${encodeURIComponent(c.id)}&cat=${encodeURIComponent(cat.id)}`,
      lastmod: buildDateIso,
      changefreq: 'daily',
      priority: '0.8',
    });
  }
}

const staticSitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${staticUrls
  .map(
    (u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>${u.alternates ? `\n${hreflangLinks}` : ''}
  </url>`
  )
  .join('\n')}
</urlset>
`;

const sitemapIndexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${escapeXml(`${baseUrl}/sitemap-static.xml`)}</loc>
    <lastmod>${buildDateIso}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${escapeXml(`${baseUrl}/sitemap-ads.xml`)}</loc>
    <lastmod>${buildDateIso}</lastmod>
  </sitemap>
</sitemapindex>
`;

fs.writeFileSync(path.join(distDir, 'sitemap-static.xml'), staticSitemapXml, 'utf8');
fs.writeFileSync(path.join(distDir, 'sitemap-index.xml'), sitemapIndexXml, 'utf8');
console.log(`Generated static edge sitemaps in dist/: sitemap-index.xml + sitemap-static.xml (${staticUrls.length} URLs)`);
