export const CANONICAL_ORIGIN = (
  process.env.SITE_CANONICAL_URL || 'https://www.linksho.eu'
).replace(/\/+$/, '');

export const SEO_COUNTRIES = [
  {
    id: 'se',
    nameFa: 'سوئد',
    nameEn: 'Sweden',
    iso: 'SE',
    currency: 'SEK',
    defaultHero: '/images/cities/stockholm.jpg',
    topCities: ['استکهلم', 'گوتنبرگ', 'مالمو', 'اوپسالا'],
  },
  {
    id: 'no',
    nameFa: 'نروژ',
    nameEn: 'Norway',
    iso: 'NO',
    currency: 'NOK',
    defaultHero: '/images/cities/oslo.jpg',
    topCities: ['اسلو', 'برگن', 'تروندهایم', 'استاوانگر'],
  },
  {
    id: 'dk',
    nameFa: 'دانمارک',
    nameEn: 'Denmark',
    iso: 'DK',
    currency: 'DKK',
    defaultHero: '/images/cities/copenhagen.jpg',
    topCities: ['کپنهاگ', 'آرهوس', 'اودنسه', 'آلبورگ'],
  },
  {
    id: 'fi',
    nameFa: 'فنلاند',
    nameEn: 'Finland',
    iso: 'FI',
    currency: 'EUR',
    defaultHero: '/images/cities/helsinki.jpg',
    topCities: ['هلسینکی', 'اسپو', 'تامپره', 'تورکو'],
  },
  {
    id: 'de',
    nameFa: 'آلمان',
    nameEn: 'Germany',
    iso: 'DE',
    currency: 'EUR',
    defaultHero: 'https://images.unsplash.com/photo-1560969184-10fe8719e047?auto=format&fit=crop&w=1600&q=80',
    topCities: ['برلین', 'هامبورگ', 'مونیخ', 'فرانکفورت', 'کلن'],
  },
  {
    id: 'at',
    nameFa: 'اتریش',
    nameEn: 'Austria',
    iso: 'AT',
    currency: 'EUR',
    defaultHero: 'https://images.unsplash.com/photo-1516550893923-42d28e5677af?auto=format&fit=crop&w=1600&q=80',
    topCities: ['وین', 'گراتس', 'لینتس', 'زالتسبورگ'],
  },
  {
    id: 'nl',
    nameFa: 'هلند',
    nameEn: 'Netherlands',
    iso: 'NL',
    currency: 'EUR',
    defaultHero: 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?auto=format&fit=crop&w=1600&q=80',
    topCities: ['آمستردام', 'روتردام', 'لاهه', 'اوترخت'],
  },
  {
    id: 'fr',
    nameFa: 'فرانسه',
    nameEn: 'France',
    iso: 'FR',
    currency: 'EUR',
    defaultHero: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1600&q=80',
    topCities: ['پاریس', 'لیون', 'مارسی', 'تولوز'],
  },
];

export const SEO_CATEGORIES = [
  { id: 'bostad', fa: 'مسکن و هم‌خانه', en: 'Housing', keywordsFa: 'اجاره خانه، آپارتمان، اتاق و هم‌خانه فارسی‌زبان' },
  { id: 'restaurang', fa: 'رستوران و غذا', en: 'Restaurants & Food', keywordsFa: 'رستوران ایرانی، کترینگ، شیرینی و غذای خانگی' },
  { id: 'tjanster', fa: 'خدمات تخصصی', en: 'Services', keywordsFa: 'حسابداری، مترجمی، تعمیرات، زیبایی و خدمات ایرانی' },
  { id: 'jobb', fa: 'کار و استخدام', en: 'Jobs', keywordsFa: 'استخدام، کاریابی و فرصت‌های شغلی فارسی‌زبانان' },
  { id: 'kop-salj', fa: 'خرید و فروش', en: 'Buy & Sell', keywordsFa: 'خرید و فروش لوازم خانگی و کالای نو و دست دوم' },
  { id: 'fordon', fa: 'خودرو و حمل‌ونقل', en: 'Vehicles & Transport', keywordsFa: 'خرید و فروش خودرو و خدمات باربری و اسباب‌کشی' },
  { id: 'elektronik', fa: 'لوازم الکترونیکی', en: 'Electronics', keywordsFa: 'موبایل، لپ‌تاپ و تجهیزات دیجیتال' },
  { id: 'evenemang', fa: 'رویداد و فرهنگی', en: 'Events & Culture', keywordsFa: 'کنسرت، همایش، کلاس و برنامه‌های فرهنگی ایرانی' },
  { id: 'ovrigt', fa: 'متفرقه', en: 'Other', keywordsFa: 'سایر آگهی‌ها و نیازمندی‌ها' },
];

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeXml(str) {
  return String(str ?? '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function normalizeCanonicalCountry(rawCountry) {
  const clean = String(rawCountry || '').trim().toLowerCase();
  if (/^[a-z0-9_-]{2,10}$/.test(clean) && clean !== 'all') {
    return clean;
  }
  return null;
}

export function normalizePublicHttpUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const cleaned = rawUrl.replace(/[\x00-\x1F\x7F]/g, '').trim();
  if (!cleaned) return null;
  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function isValidPublicHttpUrl(rawUrl) {
  return Boolean(normalizePublicHttpUrl(rawUrl));
}

export function toAbsoluteMediaUrl(rawUrl, origin = CANONICAL_ORIGIN) {
  const base = String(origin || CANONICAL_ORIGIN).replace(/\/+$/, '');
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return `${base}/images/cities/stockholm.jpg`;
  if (trimmed.startsWith('/')) return `${base}${trimmed}`;
  const normalized = normalizePublicHttpUrl(trimmed);
  if (normalized) return normalized;
  return `${base}/images/cities/stockholm.jpg`;
}

export function buildCanonicalUrl({
  origin = CANONICAL_ORIGIN,
  adRef,
  page,
  country,
  category,
  city,
} = {}) {
  const base = String(origin || CANONICAL_ORIGIN).replace(/\/+$/, '');
  const cleanAdRef = String(adRef || '').trim();
  if (cleanAdRef) {
    return `${base}/?ad=${encodeURIComponent(cleanAdRef)}`;
  }

  const cleanPage = String(page || '').trim();
  if (cleanPage === 'podcast' || cleanPage === 'website-builder') {
    return `${base}/?page=${encodeURIComponent(cleanPage)}`;
  }

  const cleanCountry = normalizeCanonicalCountry(country);
  const cleanCategory = String(category || '').trim();
  const cleanCity = String(city || '').trim();

  const params = new URLSearchParams();
  if (cleanCountry) params.set('c', cleanCountry);
  if (cleanCategory && cleanCategory !== 'all') params.set('cat', cleanCategory);
  if (cleanCity && cleanCity !== 'all') params.set('city', cleanCity);

  const qs = params.toString();
  return qs ? `${base}/?${qs}` : `${base}/`;
}

export function resolveCountryMeta(countryId, countriesList = SEO_COUNTRIES) {
  const clean = normalizeCanonicalCountry(countryId) || 'se';
  const found = (countriesList || []).find((c) => c.id === clean);
  if (found) {
    return {
      iso: String(found.iso || clean).toUpperCase(),
      currency:
        found.iso === 'SE' || found.id === 'se'
          ? 'SEK'
          : found.iso === 'NO' || found.id === 'no'
            ? 'NOK'
            : found.iso === 'DK' || found.id === 'dk'
              ? 'DKK'
              : found.currency && /^[A-Z]{3}$/.test(found.currency)
                ? found.currency
                : 'EUR',
      ...found,
    };
  }
  return SEO_COUNTRIES[0];
}

export function resolveCategoryMeta(categoryId, categoriesList = SEO_CATEGORIES) {
  const clean = String(categoryId || '').trim();
  if (!clean || clean === 'all') return null;
  return (categoriesList || []).find((c) => c.id === clean) || null;
}

export function buildFaqItems(countryObj) {
  const cName = countryObj?.nameFa || 'اروپا';
  return [
    {
      question: `آیا ثبت آگهی در لینک شو برای ${cName} رایگان است؟`,
      answer: `بله، ثبت و انتشار آگهی‌های استاندارد مسکن، کاریابی، رستوران، خدمات و خرید و فروش در لینک شو کاملاً رایگان است.`,
    },
    {
      question: 'لینک شو کدام کشورها را پوشش می‌دهد؟',
      answer: 'لینک شو مرجع نیازمندی‌های فارسی‌زبانان در ۸ کشور اروپایی سوئد، نروژ، دانمارک، فنلاند، آلمان، اتریش، هلند و فرانسه است.',
    },
    {
      question: 'قابلیت بوست رایگان (Free Boost) چگونه کار می‌کند؟',
      answer: 'هر آگهی فعال و تاییدشده می‌تواند هر ۷ روز یک‌بار بدون هزینه بوست شود تا بدون نیاز به ثبت آگهی تکراری، دوباره در صدر فهرست‌ها نمایش داده شود.',
    },
    {
      question: 'چرا آگهی‌های تکراری در لینک شو محدود شده‌اند؟',
      answer: 'سیستم هوشمند تشخیص آگهی تکراری از شلوغ شدن نتایج و هرزنامه جلوگیری می‌کند تا کاربران سریع‌تر به آگهی‌های واقعی و معتبر دسترسی داشته باشند.',
    },
    {
      question: 'آیا امکان طراحی وب‌سایت و معرفی کسب‌وکار در اروپا وجود دارد؟',
      answer: 'بله، صاحبان کسب‌وکارهای فارسی‌زبان در اروپا می‌توانند از طریق بخش طراحی وب‌سایت لینک شو، سایت اختصاصی و سئوشده خود را سفارش دهند.',
    },
  ];
}

function getPriceCurrency(ad, countryObj) {
  if (ad?.currency && /^[A-Z]{3}$/.test(String(ad.currency).trim().toUpperCase())) {
    return String(ad.currency).trim().toUpperCase();
  }
  const cId = normalizeCanonicalCountry(ad?.country) || countryObj?.id || 'se';
  if (cId === 'se') return 'SEK';
  if (cId === 'no') return 'NOK';
  if (cId === 'dk') return 'DKK';
  return 'EUR';
}

function formatAdPriceText(ad, countryObj) {
  const num = Number(ad?.price);
  if (Number.isFinite(num) && num > 0) {
    const unit =
      !ad.price_type || ad.price_type === 'kr'
        ? (getPriceCurrency(ad, countryObj) === 'EUR' ? 'یورو' : 'کرون')
        : ad.price_type;
    return `${num.toLocaleString('fa-IR')} ${unit}`;
  }
  if (ad?.price_type && ad.price_type !== 'kr') return String(ad.price_type);
  return 'توافقی';
}

function formatIsoDate(raw, fallback = new Date().toISOString()) {
  const ts = Date.parse(raw || '');
  return Number.isFinite(ts) ? new Date(ts).toISOString() : fallback;
}

function buildSafeSameAs(socialLinks = {}) {
  const urls = [];
  if (!socialLinks || typeof socialLinks !== 'object') return urls;
  for (const val of Object.values(socialLinks)) {
    if (isValidPublicHttpUrl(val) && !urls.includes(val.trim())) {
      urls.push(val.trim());
    }
  }
  return urls;
}

export function buildSeoJsonLdGraph({
  origin = CANONICAL_ORIGIN,
  siteName = 'لینک شو',
  logoUrl = '',
  socialLinks = {},
  countryObj = SEO_COUNTRIES[0],
  categoryObj = null,
  activeAd = null,
  adsList = [],
  pageMode = 'feed',
  pageTitle = '',
  pageDesc = '',
  canonicalUrl = '',
} = {}) {
  const base = String(origin || CANONICAL_ORIGIN).replace(/\/+$/, '');
  const resolvedCanonical =
    canonicalUrl ||
    buildCanonicalUrl({
      origin: base,
      adRef: activeAd ? activeAd.reference_number || activeAd.id : '',
      page: pageMode === 'podcast' || pageMode === 'website-builder' ? pageMode : '',
      country: activeAd?.country || countryObj?.id,
      category: activeAd ? '' : categoryObj?.id,
    });

  const orgId = `${base}/#organization`;
  const siteId = `${base}/#website`;
  const breadcrumbId = `${base}/#breadcrumb`;
  const cName = countryObj?.nameFa || 'اروپا';
  const cIso = String(countryObj?.iso || countryObj?.id || 'SE').toUpperCase();
  const absLogo = toAbsoluteMediaUrl(logoUrl || '/favicon.svg', base);
  const sameAs = buildSafeSameAs(socialLinks);

  const organizationNode = {
    '@type': 'Organization',
    '@id': orgId,
    name: siteName,
    alternateName: ['LinkSho', 'لینک شو اروپا'],
    url: `${base}/`,
    logo: {
      '@type': 'ImageObject',
      url: absLogo,
    },
    ...(sameAs.length > 0 ? { sameAs } : {}),
    areaServed: SEO_COUNTRIES.map((c) => ({
      '@type': 'Country',
      name: c.nameEn,
      identifier: c.iso,
    })),
    knowsLanguage: ['fa', 'sv', 'no', 'da', 'fi', 'de', 'nl', 'fr', 'en'],
  };

  const websiteNode = {
    '@type': 'WebSite',
    '@id': siteId,
    name: `${siteName} | LinkSho`,
    url: `${base}/`,
    inLanguage: 'fa',
    publisher: { '@id': orgId },
    potentialAction: {
      '@type': 'SearchAction',
      target: `${base}/?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  const breadcrumbItems = [
    {
      '@type': 'ListItem',
      position: 1,
      name: siteName,
      item: `${base}/`,
    },
  ];

  if (pageMode === 'podcast') {
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 2,
      name: 'پادکست خبری و یوتیوب',
      item: `${base}/?page=podcast`,
    });
  } else if (pageMode === 'website-builder') {
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 2,
      name: 'طراحی وب‌سایت و سئو در اروپا',
      item: `${base}/?page=website-builder`,
    });
  } else {
    if (countryObj?.id) {
      breadcrumbItems.push({
        '@type': 'ListItem',
        position: breadcrumbItems.length + 1,
        name: cName,
        item: `${base}/?c=${encodeURIComponent(countryObj.id)}`,
      });
    }
    const effectiveCat = activeAd
      ? resolveCategoryMeta(activeAd.category)
      : categoryObj;
    if (effectiveCat) {
      breadcrumbItems.push({
        '@type': 'ListItem',
        position: breadcrumbItems.length + 1,
        name: effectiveCat.fa,
        item: `${base}/?c=${encodeURIComponent(countryObj?.id || 'se')}&cat=${encodeURIComponent(effectiveCat.id)}`,
      });
    }
    if (activeAd) {
      const adSlug = encodeURIComponent(activeAd.reference_number || activeAd.id);
      breadcrumbItems.push({
        '@type': 'ListItem',
        position: breadcrumbItems.length + 1,
        name: String(activeAd.title_fa || activeAd.title || 'آگهی').slice(0, 120),
        item: `${base}/?ad=${adSlug}`,
      });
    }
  }

  const breadcrumbNode = {
    '@type': 'BreadcrumbList',
    '@id': breadcrumbId,
    itemListElement: breadcrumbItems,
  };

  const graph = [organizationNode, websiteNode, breadcrumbNode];

  if (activeAd) {
    const adTitle = String(activeAd.title_fa || activeAd.title || 'آگهی').trim();
    const adDesc = String(activeAd.description || pageDesc || adTitle).trim().slice(0, 500);
    const adUrl = buildCanonicalUrl({
      origin: base,
      adRef: activeAd.reference_number || activeAd.id,
    });
    const adImages = (Array.isArray(activeAd.images) ? activeAd.images : [])
      .filter((img) => isValidPublicHttpUrl(img) || String(img || '').startsWith('/'))
      .map((img) => toAbsoluteMediaUrl(img, base));
    if (adImages.length === 0) {
      adImages.push(toAbsoluteMediaUrl(countryObj?.defaultHero || '/images/cities/stockholm.jpg', base));
    }
    const numericPrice = Number(activeAd.price);
    const hasValidPrice = Number.isFinite(numericPrice) && numericPrice > 0;
    const priceCurrency = getPriceCurrency(activeAd, countryObj);
    const priceValidUntil = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const offerObj = hasValidPrice
      ? {
          '@type': 'Offer',
          price: numericPrice,
          priceCurrency,
          availability: 'https://schema.org/InStock',
          url: adUrl,
          priceValidUntil,
        }
      : null;

    const adCountryIso = String(
      resolveCountryMeta(activeAd.country || countryObj?.id).iso || cIso
    ).toUpperCase();
    const adCountryName = resolveCountryMeta(activeAd.country || countryObj?.id).nameFa || cName;

    let entityNode;
    if (activeAd.category === 'restaurang') {
      entityNode = {
        '@type': 'FoodEstablishment',
        '@id': `${adUrl}#listing`,
        name: adTitle,
        description: adDesc,
        image: adImages,
        url: adUrl,
        servesCuisine: 'Persian',
        inLanguage: `fa-${adCountryIso}`,
        address: {
          '@type': 'PostalAddress',
          addressLocality: activeAd.city || adCountryName,
          addressCountry: adCountryIso,
        },
      };
    } else if (activeAd.category === 'tjanster') {
      entityNode = {
        '@type': 'Service',
        '@id': `${adUrl}#listing`,
        name: adTitle,
        description: adDesc,
        image: adImages,
        url: adUrl,
        serviceType: 'خدمات تخصصی فارسی‌زبانان',
        inLanguage: `fa-${adCountryIso}`,
        provider: { '@id': orgId },
        areaServed: {
          '@type': activeAd.city ? 'City' : 'Country',
          name: activeAd.city ? `${activeAd.city}, ${adCountryName}` : adCountryName,
        },
        ...(offerObj ? { offers: offerObj } : {}),
      };
    } else if (activeAd.category === 'bostad') {
      entityNode = {
        '@type': 'RealEstateListing',
        '@id': `${adUrl}#listing`,
        name: adTitle,
        description: adDesc,
        image: adImages,
        url: adUrl,
        datePosted: formatIsoDate(activeAd.created_at),
        inLanguage: `fa-${adCountryIso}`,
        areaServed: {
          '@type': 'Country',
          name: adCountryName,
        },
        ...(offerObj ? { offers: offerObj } : {}),
      };
    } else if (hasValidPrice) {
      entityNode = {
        '@type': 'Product',
        '@id': `${adUrl}#listing`,
        name: adTitle,
        description: adDesc,
        image: adImages,
        url: adUrl,
        sku: activeAd.reference_number || String(activeAd.id || ''),
        category: resolveCategoryMeta(activeAd.category)?.fa || activeAd.category || 'نیازمندی‌ها',
        inLanguage: `fa-${adCountryIso}`,
        offers: offerObj,
      };
    } else {
      entityNode = {
        '@type': 'Offer',
        '@id': `${adUrl}#listing`,
        name: adTitle,
        description: adDesc,
        url: adUrl,
        availability: 'https://schema.org/InStock',
        areaServed: {
          '@type': 'Country',
          name: adCountryName,
        },
        itemOffered: {
          '@type': 'Thing',
          name: adTitle,
          description: adDesc,
          image: adImages,
        },
      };
    }

    graph.push({
      '@type': 'WebPage',
      '@id': `${adUrl}#webpage`,
      url: adUrl,
      name: pageTitle || adTitle,
      description: adDesc,
      inLanguage: `fa-${adCountryIso}`,
      isPartOf: { '@id': siteId },
      breadcrumb: { '@id': breadcrumbId },
      mainEntity: { '@id': `${adUrl}#listing` },
      datePublished: formatIsoDate(activeAd.created_at),
      dateModified: formatIsoDate(activeAd.updated_at || activeAd.sort_timestamp || activeAd.created_at),
    });
    graph.push(entityNode);
  } else if (pageMode === 'podcast') {
    const podcastUrl = `${base}/?page=podcast`;
    graph.push({
      '@type': 'CollectionPage',
      '@id': `${podcastUrl}#webpage`,
      url: podcastUrl,
      name: pageTitle || `پادکست خبری و ویدیوهای فارسی | ${siteName}`,
      description: pageDesc || 'شنیدن آخرین اخبار و پادکست‌های فارسی‌زبانان اروپا در لینک شو.',
      inLanguage: 'fa',
      isPartOf: { '@id': siteId },
      breadcrumb: { '@id': breadcrumbId },
      mainEntity: {
        '@type': 'PodcastSeries',
        name: `پادکست خبری ${siteName}`,
        url: podcastUrl,
        inLanguage: 'fa',
        publisher: { '@id': orgId },
      },
    });
  } else if (pageMode === 'website-builder') {
    const wbUrl = `${base}/?page=website-builder`;
    const faqs = buildFaqItems(countryObj);
    graph.push({
      '@type': 'WebPage',
      '@id': `${wbUrl}#webpage`,
      url: wbUrl,
      name: pageTitle || `طراحی وب‌سایت و سئو تخصصی در اروپا | ${siteName}`,
      description: pageDesc || 'طراحی وب‌سایت حرفه‌ای، فروشگاه آنلاین و بهینه‌سازی سئو برای کسب‌وکارهای فارسی‌زبان در اروپا.',
      inLanguage: 'fa',
      isPartOf: { '@id': siteId },
      breadcrumb: { '@id': breadcrumbId },
      mainEntity: {
        '@type': 'Service',
        name: `طراحی وب‌سایت حرفه‌ای ${siteName}`,
        description: 'طراحی وب‌سایت سریع، ریسپانسیو و سئوشده برای کسب‌وکارهای فارسی‌زبان در سوئد، آلمان و سراسر اروپا.',
        provider: { '@id': orgId },
        areaServed: SEO_COUNTRIES.map((c) => ({ '@type': 'Country', name: c.nameEn })),
      },
    });
    graph.push({
      '@type': 'FAQPage',
      '@id': `${wbUrl}#faq`,
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    });
  } else {
    const listItems = (adsList || []).slice(0, 24).map((ad, idx) => {
      const slug = encodeURIComponent(ad.reference_number || ad.id);
      const itemUrl = `${base}/?ad=${slug}`;
      return {
        '@type': 'ListItem',
        position: idx + 1,
        url: itemUrl,
        name: String(ad.title_fa || ad.title || 'آگهی').trim(),
      };
    });

    graph.push({
      '@type': 'CollectionPage',
      '@id': `${resolvedCanonical}#webpage`,
      url: resolvedCanonical,
      name: pageTitle || `${siteName} ${cName}`,
      description: pageDesc || `مرجع نیازمندی‌های فارسی‌زبانان در ${cName}`,
      inLanguage: `fa-${cIso}`,
      isPartOf: { '@id': siteId },
      breadcrumb: { '@id': breadcrumbId },
      about: { '@type': 'Country', name: cName },
      mainEntity: {
        '@type': 'ItemList',
        itemListOrder: 'https://schema.org/ItemListOrderDescending',
        numberOfItems: listItems.length,
        itemListElement: listItems,
      },
    });

    const faqs = buildFaqItems(countryObj);
    graph.push({
      '@type': 'FAQPage',
      '@id': `${resolvedCanonical}#faq`,
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    });
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}

export function renderCrawlerHtml({
  origin = CANONICAL_ORIGIN,
  siteName = 'لینک شو',
  logoUrl = '',
  socialLinks = {},
  pageTitle = '',
  pageDesc = '',
  keywords = '',
  canonicalUrl = '',
  ogImage = '',
  ogType = 'website',
  countryObj = SEO_COUNTRIES[0],
  categoryObj = null,
  activeAd = null,
  adsList = [],
  countries = SEO_COUNTRIES,
  categories = SEO_CATEGORIES,
  pageMode = 'feed',
  isNotFound = false,
} = {}) {
  const base = String(origin || CANONICAL_ORIGIN).replace(/\/+$/, '');
  const cName = countryObj?.nameFa || 'سوئد';
  const cIso = String(countryObj?.iso || countryObj?.id || 'SE').toUpperCase();
  const effectiveCanonical =
    canonicalUrl ||
    buildCanonicalUrl({
      origin: base,
      adRef: activeAd ? activeAd.reference_number || activeAd.id : '',
      page: pageMode === 'podcast' || pageMode === 'website-builder' ? pageMode : '',
      country: activeAd?.country || countryObj?.id,
      category: categoryObj?.id,
    });

  const resolvedTitle =
    pageTitle ||
    (activeAd
      ? `${activeAd.title_fa || activeAd.title} | ${cName} | ${siteName}`
      : categoryObj
        ? `${categoryObj.fa} در ${cName} | ${siteName}`
        : `${siteName} ${cName} | نیازمندی‌ها، مسکن، کاریابی و خدمات فارسی‌زبانان`);

  const resolvedDesc =
    pageDesc ||
    (activeAd
      ? String(activeAd.description || '').replace(/\s+/g, ' ').trim().slice(0, 160)
      : `مرجع نیازمندی‌های رایگان فارسی‌زبانان در ${cName}: مسکن، رستوران، استخدام، خرید و فروش و خدمات تخصصی در لینک شو.`);

  const resolvedKeywords =
    keywords ||
    `${siteName}, LinkSho, نیازمندیهای ${cName}, فارسی زبانان ${cName}, ${categoryObj?.fa || 'مسکن و کار در اروپا'}`;

  const resolvedImage = toAbsoluteMediaUrl(
    ogImage || activeAd?.images?.[0] || countryObj?.defaultHero || '/images/cities/stockholm.jpg',
    base
  );

  const robotsContent = isNotFound
    ? 'noindex, nofollow'
    : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

  const jsonLd = isNotFound
    ? null
    : buildSeoJsonLdGraph({
        origin: base,
        siteName,
        logoUrl,
        socialLinks,
        countryObj,
        categoryObj,
        activeAd,
        adsList,
        pageMode,
        pageTitle: resolvedTitle,
        pageDesc: resolvedDesc,
        canonicalUrl: effectiveCanonical,
      });

  const showCountryHreflang = !activeAd && !categoryObj && pageMode === 'feed' && !isNotFound;
  const hreflangTags = showCountryHreflang
    ? [
        ...(countries || SEO_COUNTRIES).map(
          (c) =>
            `  <link rel="alternate" hreflang="fa-${escapeHtml(String(c.iso || c.id).toUpperCase())}" href="${escapeHtml(`${base}/?c=${encodeURIComponent(c.id)}`)}" />`
        ),
        `  <link rel="alternate" hreflang="x-default" href="${escapeHtml(`${base}/`)}" />`,
      ].join('\n')
    : '';

  const safeJsonLd = jsonLd
    ? JSON.stringify(jsonLd).replace(/</g, '\\u003c')
    : '';

  const faqs = buildFaqItems(countryObj);

  const countryNavHtml = (countries || SEO_COUNTRIES)
    .map(
      (c) =>
        `<li><a href="${escapeHtml(`${base}/?c=${encodeURIComponent(c.id)}`)}">نیازمندی‌های فارسی‌زبانان ${escapeHtml(c.nameFa)}</a></li>`
    )
    .join('\n      ');

  const categoryNavHtml = (categories || SEO_CATEGORIES)
    .map(
      (cat) =>
        `<li><a href="${escapeHtml(`${base}/?c=${encodeURIComponent(countryObj?.id || 'se')}&cat=${encodeURIComponent(cat.id)}`)}">${escapeHtml(cat.fa)} در ${escapeHtml(cName)}</a></li>`
    )
    .join('\n      ');

  let mainBodyHtml = '';
  if (isNotFound) {
    mainBodyHtml = `
    <article>
      <h1>آگهی درخواستی یافت نشد</h1>
      <p>این آگهی ممکن است منقضی یا حذف شده باشد. می‌توانید جدیدترین آگهی‌ها را در صفحه اصلی ${escapeHtml(siteName)} مشاهده کنید.</p>
      <p><a href="${escapeHtml(`${base}/`)}">بازگشت به صفحه اصلی ${escapeHtml(siteName)}</a></p>
    </article>`;
  } else if (activeAd) {
    const adTitle = activeAd.title_fa || activeAd.title || '';
    const adCat = resolveCategoryMeta(activeAd.category);
    const adPrice = formatAdPriceText(activeAd, countryObj);
    const adImgHtml = (Array.isArray(activeAd.images) ? activeAd.images : [])
      .filter((img) => isValidPublicHttpUrl(img) || String(img || '').startsWith('/'))
      .slice(0, 4)
      .map(
        (img) =>
          `<img src="${escapeHtml(toAbsoluteMediaUrl(img, base))}" alt="${escapeHtml(adTitle)}" loading="lazy" />`
      )
      .join('\n      ');
    mainBodyHtml = `
    <article>
      <h1>${escapeHtml(adTitle)}</h1>
      <p><strong>کشور:</strong> ${escapeHtml(resolveCountryMeta(activeAd.country || countryObj?.id).nameFa)} | <strong>شهر:</strong> ${escapeHtml(activeAd.city || cName)}${activeAd.area ? ` (${escapeHtml(activeAd.area)})` : ''} | <strong>دسته‌بندی:</strong> ${escapeHtml(adCat?.fa || activeAd.category || 'عمومی')} | <strong>قیمت:</strong> ${escapeHtml(adPrice)}</p>
      ${adImgHtml ? `<div>${adImgHtml}</div>` : ''}
      <p>${escapeHtml(activeAd.description || '')}</p>
      <p><a href="${escapeHtml(`${base}/?c=${encodeURIComponent(activeAd.country || countryObj?.id || 'se')}`)}">مشاهده همه آگهی‌های ${escapeHtml(resolveCountryMeta(activeAd.country || countryObj?.id).nameFa)}</a></p>
    </article>`;
  } else {
    const cardsHtml = (adsList || [])
      .slice(0, 24)
      .map((ad) => {
        const title = ad.title_fa || ad.title || '';
        const slug = encodeURIComponent(ad.reference_number || ad.id);
        const adHref = `${base}/?ad=${slug}`;
        const priceText = formatAdPriceText(ad, countryObj);
        const catMeta = resolveCategoryMeta(ad.category);
        const excerpt = String(ad.description || '').replace(/\s+/g, ' ').trim().slice(0, 180);
        return `
      <article>
        <h2><a href="${escapeHtml(adHref)}">${escapeHtml(title)}</a></h2>
        <p>${escapeHtml(catMeta?.fa || ad.category || '')} — ${escapeHtml(ad.city || cName)} — ${escapeHtml(priceText)}</p>
        <p>${escapeHtml(excerpt)}</p>
      </article>`;
      })
      .join('\n');

    mainBodyHtml = `
    <section>
      <h1>${escapeHtml(resolvedTitle)}</h1>
      <p>${escapeHtml(resolvedDesc)}</p>
      ${cardsHtml || `<p>هم‌اکنون آگهی خود را به صورت رایگان در ${escapeHtml(siteName)} ثبت کنید.</p>`}
    </section>
    <section>
      <h2>سوالات متداول</h2>
      ${faqs
        .map(
          (f) => `
      <div>
        <h3>${escapeHtml(f.question)}</h3>
        <p>${escapeHtml(f.answer)}</p>
      </div>`
        )
        .join('\n')}
    </section>`;
  }

  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="${robotsContent}" />
  <title>${escapeHtml(resolvedTitle)}</title>
  <meta name="description" content="${escapeHtml(resolvedDesc)}" />
  <meta name="keywords" content="${escapeHtml(resolvedKeywords)}" />
  <meta name="geo.region" content="${escapeHtml(cIso)}" />
  <meta name="geo.placename" content="${escapeHtml(cName)}" />
  <link rel="canonical" href="${escapeHtml(effectiveCanonical)}" />
  <link rel="sitemap" type="application/xml" title="Sitemap" href="${escapeHtml(`${base}/sitemap.xml`)}" />
  <link rel="alternate" type="text/plain" title="LLMs.txt" href="${escapeHtml(`${base}/llms.txt`)}" />
  <link rel="alternate" type="application/rss+xml" title="${escapeHtml(siteName)} RSS Feed" href="${escapeHtml(`${base}/feed.xml`)}" />
${hreflangTags}
  <meta property="og:type" content="${escapeHtml(ogType || (activeAd ? 'article' : 'website'))}" />
  <meta property="og:site_name" content="${escapeHtml(siteName)}" />
  <meta property="og:locale" content="fa_${escapeHtml(cIso)}" />
  <meta property="og:url" content="${escapeHtml(effectiveCanonical)}" />
  <meta property="og:title" content="${escapeHtml(resolvedTitle)}" />
  <meta property="og:description" content="${escapeHtml(resolvedDesc)}" />
  <meta property="og:image" content="${escapeHtml(resolvedImage)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(resolvedTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(resolvedDesc)}" />
  <meta name="twitter:image" content="${escapeHtml(resolvedImage)}" />
${safeJsonLd ? `  <script type="application/ld+json">${safeJsonLd}</script>` : ''}
</head>
<body>
  <header>
    <p><a href="${escapeHtml(`${base}/`)}">${escapeHtml(siteName)} | LinkSho</a></p>
    <nav aria-label="کشورها">
      <ul>
      ${countryNavHtml}
      </ul>
    </nav>
    <nav aria-label="دسته‌بندی‌ها">
      <ul>
      ${categoryNavHtml}
      <li><a href="${escapeHtml(`${base}/?page=podcast`)}">پادکست خبری و یوتیوب</a></li>
      <li><a href="${escapeHtml(`${base}/?page=website-builder`)}">طراحی وب‌سایت کسب‌وکارها در اروپا</a></li>
      </ul>
    </nav>
  </header>
  <main>
${mainBodyHtml}
  </main>
  <footer>
    <p>${escapeHtml(siteName)} — مرجع نیازمندی‌ها، مسکن، کاریابی و خدمات فارسی‌زبانان در اروپا.</p>
    <p><a href="${escapeHtml(`${base}/llms.txt`)}">llms.txt</a> | <a href="${escapeHtml(`${base}/sitemap.xml`)}">sitemap.xml</a> | <a href="${escapeHtml(`${base}/feed.xml`)}">feed.xml</a></p>
  </footer>
</body>
</html>`;
}

export function renderLlmsTxt({
  origin = CANONICAL_ORIGIN,
  siteName = 'لینک شو',
  countries = SEO_COUNTRIES,
  categories = SEO_CATEGORIES,
  countryCounts = {},
  categoryCounts = {},
  totalActive = 0,
} = {}) {
  const base = String(origin || CANONICAL_ORIGIN).replace(/\/+$/, '');
  const countryLines = (countries || SEO_COUNTRIES)
    .map((c) => {
      const cnt = Number(countryCounts[c.id] || 0);
      const citiesNote = Array.isArray(c.topCities) && c.topCities.length > 0 ? ` (${c.topCities.join('، ')})` : '';
      return `- [${c.nameFa} (${c.nameEn || c.id.toUpperCase()})](${base}/?c=${c.id}): نیازمندی‌های فارسی‌زبانان در ${c.nameFa}${citiesNote}${cnt > 0 ? ` — ${cnt} آگهی فعال` : ''}`;
    })
    .join('\n');

  const categoryLines = (categories || SEO_CATEGORIES)
    .map((cat) => {
      const cnt = Number(categoryCounts[cat.id] || 0);
      return `- [${cat.fa} (${cat.en})](${base}/?cat=${cat.id}): ${cat.keywordsFa}${cnt > 0 ? ` — ${cnt} آگهی فعال` : ''}`;
    })
    .join('\n');

  return `# ${siteName} (LinkSho)

> مرجع جامع نیازمندی‌ها، مسکن، کاریابی، رستوران‌ها و خدمات تخصصی فارسی‌زبانان در ۸ کشور اروپایی (سوئد، نروژ، دانمارک، فنلاند، آلمان، اتریش، هلند و فرانسه). هم‌اکنون ${totalActive} آگهی فعال و تاییدشده در سامانه منتشر شده است.

## ویژگی‌های کلیدی پلتفرم
- ثبت آگهی رایگان برای فارسی‌زبانان مقیم اروپا با مدیریت آنلاین از طریق کد مرجع و پین.
- سیستم هوشمند جلوگیری از انتشار آگهی‌های تکراری و هرزنامه.
- قابلیت **بوست رایگان (Free Boost)** هر ۷ روز یک‌بار برای به‌روزرسانی جایگاه آگهی.
- بخش معرفی کسب‌وکارها و سفارش طراحی وب‌سایت و سئو برای ایرانیان مقیم اروپا.

## صفحات کشورها
${countryLines}

## دسته‌بندی‌های اصلی
${categoryLines}

## سرویس‌ها و منابع ماشینی
- [کاتالوگ کامل آگهی‌های فعال (llms-full.txt)](${base}/llms-full.txt): فهرست کامل عنوان، دسته‌بندی، شهر، قیمت و لینک مستقیم آگهی‌های فعال.
- [نقشه سایت XML (Sitemap)](${base}/sitemap.xml): شاخص به‌روز تمام کشورها، دسته‌بندی‌ها و آگهی‌های فعال.
- [فید RSS (feed.xml)](${base}/feed.xml): تازه‌ترین آگهی‌های منتشرشده در اروپا.
- [طراحی وب‌سایت و سئو در اروپا](${base}/?page=website-builder): خدمات طراحی سایت کسب‌وکارهای فارسی‌زبان.
- [پادکست خبری و یوتیوب](${base}/?page=podcast): فید خبری و ویدیوهای منتخب فارسی‌زبانان اروپا.
`;
}

export function renderLlmsFullTxt({
  origin = CANONICAL_ORIGIN,
  siteName = 'لینک شو',
  ads = [],
  countries = SEO_COUNTRIES,
  categories = SEO_CATEGORIES,
} = {}) {
  const base = String(origin || CANONICAL_ORIGIN).replace(/\/+$/, '');
  const countryMap = new Map((countries || SEO_COUNTRIES).map((c) => [c.id, c]));
  const grouped = new Map();

  for (const ad of (ads || []).slice(0, 250)) {
    const cid = normalizeCanonicalCountry(ad.country) || 'se';
    if (!grouped.has(cid)) grouped.set(cid, []);
    grouped.get(cid).push(ad);
  }

  const sections = [];
  for (const [cid, list] of grouped.entries()) {
    const cObj = countryMap.get(cid) || resolveCountryMeta(cid, countries);
    const items = list
      .map((ad) => {
        const title = String(ad.title_fa || ad.title || 'آگهی').replace(/\s+/g, ' ').trim();
        const catObj = resolveCategoryMeta(ad.category, categories);
        const slug = encodeURIComponent(ad.reference_number || ad.id);
        const adUrl = `${base}/?ad=${slug}`;
        const priceText = formatAdPriceText(ad, cObj);
        const dateStr = formatIsoDate(ad.sort_timestamp || ad.created_at).slice(0, 10);
        const excerpt = String(ad.description || '').replace(/\s+/g, ' ').trim().slice(0, 220);
        return `### [${title}](${adUrl})
- دسته: ${catObj?.fa || ad.category || 'عمومی'} | شهر: ${ad.city || cObj.nameFa}${ad.area ? ` (${ad.area})` : ''} | قیمت: ${priceText} | تاریخ: ${dateStr}
- خلاصه: ${excerpt}`;
      })
      .join('\n\n');

    sections.push(`## ${cObj.nameFa} (${list.length} آگهی)\n\n${items}`);
  }

  return `# ${siteName} (LinkSho) — فهرست کامل آگهی‌های فعال اروپا

> فهرست ساختاریافته برای موتورهای جستجوی هوش مصنوعی. اطلاعات تماس شخصی کاربران به دلایل حریم خصوصی در این خروجی درج نشده است؛ برای مشاهده جزئیات کامل و تماس با آگهی‌دهنده از لینک مستقیم هر آگهی استفاده کنید.

${sections.join('\n\n') || 'در حال حاضر آگهی فعالی ثبت نشده است.'}
`;
}

export function renderRssFeed({
  origin = CANONICAL_ORIGIN,
  siteName = 'لینک شو',
  ads = [],
  countries = SEO_COUNTRIES,
  categories = SEO_CATEGORIES,
} = {}) {
  const base = String(origin || CANONICAL_ORIGIN).replace(/\/+$/, '');
  const feedUrl = `${base}/feed.xml`;
  const lastBuildDate = new Date().toUTCString();

  const itemsXml = (ads || [])
    .slice(0, 100)
    .map((ad) => {
      const cObj = resolveCountryMeta(ad.country, countries);
      const catObj = resolveCategoryMeta(ad.category, categories);
      const title = String(ad.title_fa || ad.title || 'آگهی').trim();
      const slug = encodeURIComponent(ad.reference_number || ad.id);
      const link = `${base}/?ad=${slug}`;
      const pubDate = new Date(Date.parse(ad.sort_timestamp || ad.created_at || '') || Date.now()).toUTCString();
      const priceText = formatAdPriceText(ad, cObj);
      const desc = `${cObj.nameFa}${ad.city ? ` (${ad.city})` : ''} | ${catObj?.fa || ad.category || ''} | ${priceText} — ${String(ad.description || '').replace(/\s+/g, ' ').trim().slice(0, 280)}`;
      const cover = (Array.isArray(ad.images) ? ad.images[0] : '') || '';
      const mediaTag = isValidPublicHttpUrl(cover)
        ? `\n      <media:content url="${escapeXml(cover)}" medium="image" />`
        : '';
      return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${escapeXml(pubDate)}</pubDate>
      <category>${escapeXml(catObj?.fa || ad.category || 'نیازمندی‌ها')}</category>
      <description>${escapeXml(desc)}</description>${mediaTag}
    </item>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${escapeXml(`${siteName} | جدیدترین آگهی‌های فارسی‌زبانان اروپا`)}</title>
    <link>${escapeXml(`${base}/`)}</link>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
    <description>${escapeXml('جدیدترین آگهی‌های مسکن، کاریابی، رستوران و خدمات تخصصی فارسی‌زبانان در سراسر اروپا')}</description>
    <language>fa</language>
    <lastBuildDate>${escapeXml(lastBuildDate)}</lastBuildDate>
    <ttl>30</ttl>
${itemsXml}
  </channel>
</rss>`;
}
