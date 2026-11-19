import { CATEGORIES, COUNTRIES } from './translations';

export const CANONICAL_SITE_ORIGIN = 'https://www.linksho.eu';

function isSafeHttpUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const u = new URL(url.trim());
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

function toAbsoluteUrl(rawUrl, origin = CANONICAL_SITE_ORIGIN) {
  const base = String(origin || CANONICAL_SITE_ORIGIN).replace(/\/+$/, '');
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return `${base}/images/cities/stockholm.jpg`;
  if (trimmed.startsWith('/')) return `${base}${trimmed}`;
  if (isSafeHttpUrl(trimmed)) return trimmed;
  return `${base}/images/cities/stockholm.jpg`;
}

function resolveCurrency(ad, countryObj) {
  if (ad?.currency && /^[A-Z]{3}$/.test(String(ad.currency).trim().toUpperCase())) {
    return String(ad.currency).trim().toUpperCase();
  }
  const cid = String(ad?.country || countryObj?.id || 'se').toLowerCase();
  if (cid === 'se') return 'SEK';
  if (cid === 'no') return 'NOK';
  if (cid === 'dk') return 'DKK';
  return 'EUR';
}

export function buildClientCanonicalUrl({
  origin = CANONICAL_SITE_ORIGIN,
  adRef,
  page,
  country,
  category,
  city,
} = {}) {
  const base = String(origin || CANONICAL_SITE_ORIGIN).replace(/\/+$/, '');
  if (adRef && String(adRef).trim()) {
    return `${base}/?ad=${encodeURIComponent(String(adRef).trim())}`;
  }
  if (page === 'podcast' || page === 'website-builder') {
    return `${base}/?page=${encodeURIComponent(page)}`;
  }

  const params = new URLSearchParams();
  const cleanCountry = String(country || '').trim().toLowerCase();
  if (/^[a-z0-9_-]{2,10}$/.test(cleanCountry) && cleanCountry !== 'all') {
    params.set('c', cleanCountry);
  }
  const cleanCat = String(category || '').trim();
  if (cleanCat && cleanCat !== 'all') {
    params.set('cat', cleanCat);
  }
  const cleanCity = String(city || '').trim();
  if (cleanCity && cleanCity !== 'all') {
    params.set('city', cleanCity);
  }
  const qs = params.toString();
  return qs ? `${base}/?${qs}` : `${base}/`;
}

export function buildClientFaqItems(countryObj) {
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
      question: 'آیا امکان طراحی وب‌سایت و معرفی کسب‌وکار در اروپا وجود دارد؟',
      answer: 'بله، صاحبان کسب‌وکارهای فارسی‌زبان در اروپا می‌توانند از طریق بخش طراحی وب‌سایت لینک شو، سایت اختصاصی و سئوشده خود را سفارش دهند.',
    },
  ];
}

export function buildClientSeoGraph({
  origin = CANONICAL_SITE_ORIGIN,
  siteName = 'لینک شو',
  logoUrl = '',
  socialLinks = {},
  countryObj = COUNTRIES[0],
  categoryId = 'all',
  activeAd = null,
  adsList = [],
  pageMode = 'feed',
  pageTitle = '',
  pageDesc = '',
  canonicalUrl = '',
  nowMs = Date.now(),
} = {}) {
  const base = String(origin || CANONICAL_SITE_ORIGIN).replace(/\/+$/, '');
  const cId = String(countryObj?.id || 'se').toLowerCase();
  const cIso = cId.toUpperCase();
  const cName = countryObj?.nameFa || 'سوئد';
  const catObj = categoryId && categoryId !== 'all' ? CATEGORIES.find((c) => c.id === categoryId) : null;
  const resolvedCanonical =
    canonicalUrl ||
    buildClientCanonicalUrl({
      origin: base,
      adRef: activeAd ? activeAd.reference_number || activeAd.id : '',
      page: pageMode === 'podcast' || pageMode === 'website-builder' ? pageMode : '',
      country: activeAd?.country || cId,
      category: activeAd ? '' : categoryId,
    });

  const orgId = `${base}/#organization`;
  const siteId = `${base}/#website`;
  const breadcrumbId = `${base}/#breadcrumb`;
  const sameAs = Object.values(socialLinks || {}).filter((v) => isSafeHttpUrl(v));

  const organizationNode = {
    '@type': 'Organization',
    '@id': orgId,
    name: siteName,
    alternateName: ['LinkSho', 'لینک شو اروپا'],
    url: `${base}/`,
    logo: {
      '@type': 'ImageObject',
      url: toAbsoluteUrl(logoUrl || '/favicon.svg', base),
    },
    ...(sameAs.length > 0 ? { sameAs } : {}),
    areaServed: COUNTRIES.map((c) => ({
      '@type': 'Country',
      name: c.nameFa,
      identifier: String(c.id || '').toUpperCase(),
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

  const breadcrumbs = [{ '@type': 'ListItem', position: 1, name: siteName, item: `${base}/` }];
  if (pageMode === 'podcast') {
    breadcrumbs.push({ '@type': 'ListItem', position: 2, name: 'پادکست خبری و یوتیوب', item: `${base}/?page=podcast` });
  } else if (pageMode === 'website-builder') {
    breadcrumbs.push({ '@type': 'ListItem', position: 2, name: 'طراحی وب‌سایت و سئو', item: `${base}/?page=website-builder` });
  } else {
    breadcrumbs.push({ '@type': 'ListItem', position: 2, name: cName, item: `${base}/?c=${cId}` });
    const adOrSelectedCat = activeAd ? CATEGORIES.find((c) => c.id === activeAd.category) : catObj;
    if (adOrSelectedCat) {
      breadcrumbs.push({
        '@type': 'ListItem',
        position: breadcrumbs.length + 1,
        name: adOrSelectedCat.fa,
        item: `${base}/?c=${cId}&cat=${adOrSelectedCat.id}`,
      });
    }
    if (activeAd) {
      const slug = encodeURIComponent(activeAd.reference_number || activeAd.id);
      breadcrumbs.push({
        '@type': 'ListItem',
        position: breadcrumbs.length + 1,
        name: String(activeAd.title_fa || activeAd.title || 'آگهی').slice(0, 120),
        item: `${base}/?ad=${slug}`,
      });
    }
  }

  const graph = [
    organizationNode,
    websiteNode,
    { '@type': 'BreadcrumbList', '@id': breadcrumbId, itemListElement: breadcrumbs },
  ];

  if (activeAd) {
    const adTitle = String(activeAd.title_fa || activeAd.title || 'آگهی').trim();
    const adDesc = String(activeAd.description || pageDesc || adTitle).trim().slice(0, 500);
    const slug = encodeURIComponent(activeAd.reference_number || activeAd.id);
    const adUrl = `${base}/?ad=${slug}`;
    const adImages = (Array.isArray(activeAd.images) ? activeAd.images : [])
      .filter((img) => isSafeHttpUrl(img) || String(img || '').startsWith('/'))
      .map((img) => toAbsoluteUrl(img, base));
    if (adImages.length === 0) {
      adImages.push(toAbsoluteUrl(countryObj?.heroImage || '/images/cities/stockholm.jpg', base));
    }
    const numericPrice = Number(activeAd.price);
    const hasValidPrice = Number.isFinite(numericPrice) && numericPrice > 0;
    const priceCurrency = resolveCurrency(activeAd, countryObj);
    const priceValidUntil = new Date(nowMs + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
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

    let listingEntity;
    if (activeAd.category === 'restaurang') {
      listingEntity = {
        '@type': 'FoodEstablishment',
        '@id': `${adUrl}#listing`,
        name: adTitle,
        description: adDesc,
        image: adImages,
        url: adUrl,
        servesCuisine: 'Persian',
        inLanguage: `fa-${cIso}`,
        address: {
          '@type': 'PostalAddress',
          addressLocality: activeAd.city || cName,
          addressCountry: cIso,
        },
      };
    } else if (activeAd.category === 'tjanster') {
      listingEntity = {
        '@type': 'Service',
        '@id': `${adUrl}#listing`,
        name: adTitle,
        description: adDesc,
        image: adImages,
        url: adUrl,
        serviceType: 'خدمات تخصصی فارسی‌زبانان',
        inLanguage: `fa-${cIso}`,
        provider: { '@id': orgId },
        areaServed: { '@type': activeAd.city ? 'City' : 'Country', name: activeAd.city || cName },
        ...(offerObj ? { offers: offerObj } : {}),
      };
    } else if (activeAd.category === 'bostad') {
      listingEntity = {
        '@type': 'RealEstateListing',
        '@id': `${adUrl}#listing`,
        name: adTitle,
        description: adDesc,
        image: adImages,
        url: adUrl,
        inLanguage: `fa-${cIso}`,
        areaServed: { '@type': 'Country', name: cName },
        ...(offerObj ? { offers: offerObj } : {}),
      };
    } else if (hasValidPrice) {
      listingEntity = {
        '@type': 'Product',
        '@id': `${adUrl}#listing`,
        name: adTitle,
        description: adDesc,
        image: adImages,
        url: adUrl,
        sku: activeAd.reference_number || String(activeAd.id || ''),
        inLanguage: `fa-${cIso}`,
        offers: offerObj,
      };
    } else {
      listingEntity = {
        '@type': 'Offer',
        '@id': `${adUrl}#listing`,
        name: adTitle,
        description: adDesc,
        url: adUrl,
        availability: 'https://schema.org/InStock',
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
      inLanguage: `fa-${cIso}`,
      isPartOf: { '@id': siteId },
      breadcrumb: { '@id': breadcrumbId },
      mainEntity: { '@id': `${adUrl}#listing` },
    });
    graph.push(listingEntity);
  } else if (pageMode === 'podcast') {
    const pUrl = `${base}/?page=podcast`;
    graph.push({
      '@type': 'CollectionPage',
      '@id': `${pUrl}#webpage`,
      url: pUrl,
      name: pageTitle || `پادکست خبری و ویدیوها | ${siteName}`,
      description: pageDesc,
      inLanguage: 'fa',
      isPartOf: { '@id': siteId },
      breadcrumb: { '@id': breadcrumbId },
      mainEntity: {
        '@type': 'PodcastSeries',
        name: `پادکست خبری ${siteName}`,
        url: pUrl,
        inLanguage: 'fa',
        publisher: { '@id': orgId },
      },
    });
  } else if (pageMode === 'website-builder') {
    const wbUrl = `${base}/?page=website-builder`;
    const faqs = buildClientFaqItems(countryObj);
    graph.push({
      '@type': 'WebPage',
      '@id': `${wbUrl}#webpage`,
      url: wbUrl,
      name: pageTitle || `طراحی وب‌سایت و سئو در اروپا | ${siteName}`,
      description: pageDesc,
      inLanguage: 'fa',
      isPartOf: { '@id': siteId },
      breadcrumb: { '@id': breadcrumbId },
      mainEntity: {
        '@type': 'Service',
        name: `طراحی وب‌سایت حرفه‌ای ${siteName}`,
        description: 'طراحی وب‌سایت سریع، ریسپانسیو و سئوشده برای کسب‌وکارهای فارسی‌زبان در اروپا.',
        provider: { '@id': orgId },
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
    const listItems = (adsList || []).slice(0, 20).map((ad, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: String(ad.title_fa || ad.title || 'آگهی').trim(),
      url: `${base}/?ad=${encodeURIComponent(ad.reference_number || ad.id)}`,
    }));

    graph.push({
      '@type': 'CollectionPage',
      '@id': `${resolvedCanonical}#webpage`,
      url: resolvedCanonical,
      name: pageTitle || `${siteName} ${cName}`,
      description: pageDesc,
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

    const faqs = buildClientFaqItems(countryObj);
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
