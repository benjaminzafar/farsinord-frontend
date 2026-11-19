import { createClient } from '@supabase/supabase-js';
import {
  CANONICAL_ORIGIN,
  SEO_COUNTRIES,
  SEO_CATEGORIES,
  buildCanonicalUrl,
  normalizeCanonicalCountry,
  resolveCountryMeta,
  resolveCategoryMeta,
  renderCrawlerHtml,
  renderLlmsTxt,
  renderLlmsFullTxt,
  renderRssFeed,
} from './_lib/seoCore.js';
import { getIndexNowKey } from './_lib/indexNow.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://bezbnymjcnmazdonfzky.supabase.co';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlemJueW1qY25tYXpkb25memt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ2OTM1NjksImV4cCI6MjExMDI2OTU2OX0.ylsHBAZ1zo1z_aKpHx7hgl-yZu2yt2puFNhR8jBm6S4';

const supabase = createClient(supabaseUrl, supabaseKey);

// Strictly public columns — never expose contact_phone, contact_email, whatsapp, telegram, or pin_code
const SAFE_PUBLIC_SEO_COLUMNS = [
  'id',
  'reference_number',
  'title',
  'title_fa',
  'description',
  'category',
  'country',
  'city',
  'area',
  'price',
  'price_type',
  'images',
  'is_featured',
  'promotion_expires_at',
  'sort_timestamp',
  'created_at',
  'updated_at',
].join(',');

function mergeCountriesForSeo(rawCustom) {
  const baseMap = new Map(SEO_COUNTRIES.map((c) => [c.id, { ...c, enabled: true }]));
  if (Array.isArray(rawCustom)) {
    for (const c of rawCustom) {
      if (!c?.id) continue;
      const prev = baseMap.get(c.id) || {};
      baseMap.set(c.id, { ...prev, ...c });
    }
  }
  return Array.from(baseMap.values()).filter((c) => c.enabled !== false);
}

async function fetchSeoPortalSettings() {
  try {
    const { data } = await supabase
      .from('swedpersiska_settings')
      .select('key, value')
      .in('key', ['site_settings', 'seo_settings', 'portal_countries']);

    const map = {};
    for (const row of data || []) {
      map[row.key] = row.value;
    }
    return map;
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end('Method Not Allowed');
  }

  const mode = String(req.query?.mode || 'html').trim().toLowerCase();

  try {
    if (mode === 'indexnow-key') {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
      return res.status(200).send(getIndexNowKey());
    }

    const settingsMap = await fetchSeoPortalSettings();
    const siteSettings = settingsMap.site_settings || {};
    const seoSettings = settingsMap.seo_settings || {};
    const countries = mergeCountriesForSeo(settingsMap.portal_countries);
    const siteName = String(siteSettings.siteName || 'لینک شو').trim() || 'لینک شو';
    const logoUrl = String(siteSettings.logoUrl || '').trim();
    const socialLinks = siteSettings.socialLinks || {};

    if (mode === 'llms') {
      const { data: metaAds } = await supabase
        .from('swedpersiska_ads')
        .select('country, category')
        .eq('status', 'active')
        .is('deleted_at', null)
        .limit(1000);

      const countryCounts = {};
      const categoryCounts = {};
      let totalActive = 0;
      for (const row of metaAds || []) {
        totalActive++;
        const cid = normalizeCanonicalCountry(row.country) || 'se';
        countryCounts[cid] = (countryCounts[cid] || 0) + 1;
        if (row.category) {
          categoryCounts[row.category] = (categoryCounts[row.category] || 0) + 1;
        }
      }

      const body = renderLlmsTxt({
        origin: CANONICAL_ORIGIN,
        siteName,
        countries,
        categories: SEO_CATEGORIES,
        countryCounts,
        categoryCounts,
        totalActive,
      });

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');
      return res.status(200).send(body);
    }

    if (mode === 'llms-full') {
      const { data: ads } = await supabase
        .from('swedpersiska_ads')
        .select(SAFE_PUBLIC_SEO_COLUMNS)
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('sort_timestamp', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(250);

      const body = renderLlmsFullTxt({
        origin: CANONICAL_ORIGIN,
        siteName,
        ads: ads || [],
        countries,
        categories: SEO_CATEGORIES,
      });

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');
      return res.status(200).send(body);
    }

    if (mode === 'feed') {
      const { data: ads } = await supabase
        .from('swedpersiska_ads')
        .select(SAFE_PUBLIC_SEO_COLUMNS)
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('sort_timestamp', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100);

      const xml = renderRssFeed({
        origin: CANONICAL_ORIGIN,
        siteName,
        ads: ads || [],
        countries,
        categories: SEO_CATEGORIES,
      });

      res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=3600');
      return res.status(200).send(xml);
    }

    // Default HTML mode for Search Engines & AI Crawlers
    res.setHeader('Vary', 'User-Agent');
    const rawAdParam = String(req.query?.ad || '').trim();
    const rawPage = String(req.query?.page || '').trim();
    const rawCountry = req.query?.c || req.query?.country || '';
    const requestedCountry = normalizeCanonicalCountry(rawCountry);
    const rawCategory = String(req.query?.cat || '').trim();
    const rawCity = String(req.query?.city || '').trim();

    if (rawAdParam) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawAdParam);
      let q = supabase
        .from('swedpersiska_ads')
        .select(SAFE_PUBLIC_SEO_COLUMNS)
        .eq('status', 'active')
        .is('deleted_at', null);

      if (isUuid) {
        q = q.eq('id', rawAdParam);
      } else {
        const safeRef = rawAdParam.replace(/[^a-zA-Z0-9_-]/g, '');
        q = q.eq('reference_number', safeRef || '__none__');
      }

      const { data: adRow } = await q.maybeSingle();
      if (!adRow) {
        const notFoundHtml = renderCrawlerHtml({
          origin: CANONICAL_ORIGIN,
          siteName,
          logoUrl,
          socialLinks,
          countries,
          categories: SEO_CATEGORIES,
          isNotFound: true,
        });
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600');
        return res.status(404).send(notFoundHtml);
      }

      const adCountryObj = resolveCountryMeta(adRow.country || 'se', countries);
      const html = renderCrawlerHtml({
        origin: CANONICAL_ORIGIN,
        siteName,
        logoUrl,
        socialLinks,
        countryObj: adCountryObj,
        categoryObj: resolveCategoryMeta(adRow.category, SEO_CATEGORIES),
        activeAd: adRow,
        countries,
        categories: SEO_CATEGORIES,
        ogType: 'article',
        ogImage: adRow.images?.[0] || adCountryObj.defaultHero,
      });

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
      return res.status(200).send(html);
    }

    const activeCountryObj = resolveCountryMeta(requestedCountry || 'se', countries);
    const activeCategoryObj = resolveCategoryMeta(rawCategory, SEO_CATEGORIES);
    const pageMode =
      rawPage === 'podcast' || rawPage === 'website-builder' ? rawPage : 'feed';

    let adsList = [];
    if (pageMode === 'feed') {
      let q = supabase
        .from('swedpersiska_ads')
        .select(SAFE_PUBLIC_SEO_COLUMNS)
        .eq('status', 'active')
        .is('deleted_at', null);

      if (requestedCountry) {
        q = q.eq('country', requestedCountry);
      } else if (!activeCategoryObj) {
        q = q.eq('country', 'se');
      }
      if (activeCategoryObj) q = q.eq('category', activeCategoryObj.id);
      if (rawCity && rawCity !== 'all') q = q.eq('city', rawCity);

      const { data } = await q
        .order('is_featured', { ascending: false })
        .order('sort_timestamp', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(24);
      adsList = data || [];
    }

    const customCountrySeo = seoSettings[activeCountryObj.id] || {};
    let pageTitle = '';
    let pageDesc = '';

    if (pageMode === 'podcast') {
      pageTitle = `پادکست خبری و ویدیوهای فارسی‌زبانان اروپا | ${siteName}`;
      pageDesc = `شنیدن جدیدترین پادکست‌های خبری، گزارش‌ها و ویدیوهای یوتیوب فارسی‌زبانان در اروپا در ${siteName}.`;
    } else if (pageMode === 'website-builder') {
      pageTitle = `طراحی وب‌سایت و سئو تخصصی کسب‌وکارها در اروپا | ${siteName}`;
      pageDesc = `طراحی وب‌سایت سریع، چندزبانه و سئوشده برای کسب‌وکارهای فارسی‌زبان در سوئد، آلمان و سراسر اروپا.`;
    } else if (activeCategoryObj) {
      const cLabel = requestedCountry ? activeCountryObj.nameFa : 'اروپا';
      pageTitle = `${activeCategoryObj.fa} در ${cLabel} | ${siteName}`;
      pageDesc = `جدیدترین آگهی‌های ${activeCategoryObj.fa} (${activeCategoryObj.keywordsFa}) برای فارسی‌زبانان در ${cLabel} — ثبت رایگان در ${siteName}.`;
    } else {
      pageTitle =
        customCountrySeo.title ||
        `${siteName} ${activeCountryObj.nameFa} | نیازمندی‌ها، مسکن، کاریابی و خدمات فارسی‌زبانان`;
      pageDesc =
        customCountrySeo.description ||
        `${siteName} — مرجع آگهی‌های رایگان مسکن، رستوران، کاریابی و خدمات تخصصی فارسی‌زبانان در ${activeCountryObj.nameFa}.`;
    }

    const canonicalUrl = buildCanonicalUrl({
      origin: CANONICAL_ORIGIN,
      page: pageMode === 'feed' ? '' : pageMode,
      country: requestedCountry || '',
      category: activeCategoryObj?.id || '',
      city: rawCity && rawCity !== 'all' ? rawCity : '',
    });

    const html = renderCrawlerHtml({
      origin: CANONICAL_ORIGIN,
      siteName,
      logoUrl,
      socialLinks,
      pageTitle,
      pageDesc,
      keywords: customCountrySeo.keywords || '',
      canonicalUrl,
      ogImage: activeCountryObj.heroImage || activeCountryObj.defaultHero,
      countryObj: activeCountryObj,
      categoryObj: activeCategoryObj,
      adsList,
      countries,
      categories: SEO_CATEGORIES,
      pageMode,
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    return res.status(200).send(html);
  } catch (err) {
    console.error('SEO endpoint error:', err);
    const fallbackHtml = renderCrawlerHtml({
      origin: CANONICAL_ORIGIN,
      siteName: 'لینک شو',
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Vary', 'User-Agent');
    return res.status(200).send(fallbackHtml);
  }
}
