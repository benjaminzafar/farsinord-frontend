import React, { useState, useEffect, useMemo, useRef, useCallback, useDeferredValue, lazy, Suspense } from 'react';
import { 
  Search, 
  MapPin, 
  PlusCircle, 
  CheckCircle2, 
  Check,
  RefreshCw,
  X,
  ChevronDown,
  LayoutGrid,
  Home,
  Utensils,
  Briefcase,
  GraduationCap,
  ShoppingBag,
  Car,
  Laptop,
  Calendar,
  Tag
} from 'lucide-react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import MobileBottomNav from './components/MobileBottomNav';
import AdCard from './components/AdCard';
import { isSafeHttpUrl } from './lib/urlUtils';
import { publicApi } from './lib/apiClient';
import { COUNTRIES, CATEGORIES, mergePortalCountries, t } from './lib/translations';
import { getGdprConsent } from './lib/gdpr';
import { getInitialTheme, applyThemeToDocument } from './lib/theme';
import { matchesSmartSearch, getSearchSuggestions, scoreSmartSearchMatch } from './lib/smartSearch';
import { CANONICAL_SITE_ORIGIN, buildClientCanonicalUrl, buildClientSeoGraph } from './lib/seoSchema';

function readCachedBranding() {
  try {
    const raw = localStorage.getItem('swedpersiska_site_branding');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

const CountryBanner = lazy(() => import('./components/CountryBanner'));
const LegalModal = lazy(() => import('./components/LegalModal'));
const AdDetailPage = lazy(() => import('./components/AdDetailPage'));
const PaymentModal = lazy(() => import('./components/PaymentModal'));
const PostAdModal = lazy(() => import('./components/PostAdModal'));
const ManageAdModal = lazy(() => import('./components/ManageAdModal'));
const PodcastPage = lazy(() => import('./components/PodcastPage'));
const WebsiteBuilderPage = lazy(() => import('./components/WebsiteBuilderPage'));

const CATEGORY_ICONS = {
  all: LayoutGrid,
  bostad: Home,
  restaurang: Utensils,
  tjanster: Briefcase,
  jobb: GraduationCap,
  'kop-salj': ShoppingBag,
  fordon: Car,
  elektronik: Laptop,
  evenemang: Calendar,
  ovrigt: Tag,
};



const FEED_PAGE_SIZE = 16;

const SORT_LABELS = {
  newest: 'جدیدترین',
  most_viewed: 'پربازدیدترین',
  price_asc: 'ارزان‌ترین',
  price_desc: 'گران‌ترین',
};

function getInitialAdParamFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const pathMatch = String(window.location.pathname || '').match(/^\/ad\/([A-Za-z0-9_-]+)\/?$/);
    return params.get('ad') || (pathMatch ? pathMatch[1] : '') || '';
  } catch {
    return '';
  }
}

export default function App() {
  const lang = 'fa'; // Complete Persian Language
  const currentT = t.fa;

  const [theme, setTheme] = useState(() => getInitialTheme());
  const handleToggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  // Paginated ads state
  const [ads, setAds] = useState([]);
  const [featuredAdsList, setFeaturedAdsList] = useState([]);
  const [totalAdsCount, setTotalAdsCount] = useState(0);
  const [feedPage, setFeedPage] = useState(1);
  const [hasMoreAds, setHasMoreAds] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [renderNow] = useState(() => Date.now());
  const feedSentinelRef = useRef(null);
  const feedRequestSeqRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const loadMoreActionRef = useRef(null);
  const fetchAdsRef = useRef(null);

  // Country & URL synchronization (Address bar: /?c=se, /?c=de, /?c=ca, etc.)
  const [customCountries, setCustomCountries] = useState(() => {
    try {
      const saved = localStorage.getItem('swedpersiska_portal_countries');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });
  const [customCities, setCustomCities] = useState(() => {
    try {
      const saved = localStorage.getItem('swedpersiska_portal_cities');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });
  const portalCountries = useMemo(
    () => mergePortalCountries(customCountries, customCities).filter(c => c.enabled !== false),
    [customCountries, customCities]
  );

  const [selectedCountry, setSelectedCountry] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlC = (params.get('c') || params.get('country') || '').toLowerCase();
      if (/^[a-z0-9_-]{2,10}$/.test(urlC)) {
        return urlC;
      }
    } catch {}
    const saved = localStorage.getItem('scandi_country_selected');
    if (saved && /^[a-z0-9_-]{2,10}$/.test(saved)) {
      return saved;
    }
    return 'se';
  });
  // Google-Style Search Architecture:
  // searchDraft: What the user is actively typing in the search box (drives smart autocomplete predictions).
  // searchQuery: The committed search query that filters ads & queries the backend. ONLY updates on Enter, Search button click, or suggestion click.
  const [searchDraft, setSearchDraft] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('q') || '';
    } catch {}
    return '';
  });
  const [searchQuery, setSearchQuery] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('q') || '';
    } catch {}
    return '';
  });
  const [selectedCategory, setSelectedCategory] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const cat = params.get('cat');
      if (cat) return cat;
    } catch {}
    return 'all';
  });
  const [selectedCity, setSelectedCity] = useState('all');
  const [sortBy, setSortBy] = useState(null); // null | 'newest' | 'most_viewed' | 'price_asc' | 'price_desc'
  const deferredSearchDraft = useDeferredValue(searchDraft);
  const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] = useState(-1);
  const [initialAdResolved, setInitialAdResolved] = useState(() => !getInitialAdParamFromUrl());
  const lastVipFilterKeyRef = useRef('');
  const lastTrackedPathRef = useRef('');

  const handleCountryChange = (c) => {
    const valid = portalCountries.some(x => x.id === c) ? c : (portalCountries[0]?.id || 'se');
    setSelectedCountry(valid);
    setSelectedCity('all');
    localStorage.setItem('scandi_country_selected', valid);
    // Update address bar with country code
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('c', valid);
      window.history.replaceState({}, '', url.toString());
    } catch {}
  };

  // Sync address bar on mount
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.get('c')) {
        url.searchParams.set('c', selectedCountry);
        window.history.replaceState({}, '', url.toString());
      }
    } catch {}
  }, [selectedCountry]);

  // Modals & Pages
  const [gdprConsent, setGdprConsent] = useState(() => getGdprConsent());
  const [legalModalTab, setLegalModalTab] = useState(null);
  const [websiteBuilderOpen, setWebsiteBuilderOpen] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get('page') === 'website-builder';
    } catch {
      return false;
    }
  });

  const handleOpenWebsiteBuilder = () => {
    setActiveAdDetail(null);
    setPodcastOpen(false);
    setWebsiteBuilderOpen(true);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('ad');
      url.searchParams.set('page', 'website-builder');
      window.history.pushState({ page: 'website-builder' }, '', url.toString());
    } catch {}
  };

  const handleCloseWebsiteBuilder = () => {
    setWebsiteBuilderOpen(false);
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('page') === 'website-builder') {
        url.searchParams.delete('page');
        window.history.pushState({}, '', url.toString());
      }
    } catch {}
  };
  const [podcastOpen, setPodcastOpen] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get('page') === 'podcast';
    } catch {
      return false;
    }
  });
  const [podcastSettings, setPodcastSettings] = useState(null);

  const handleOpenPodcast = () => {
    setActiveAdDetail(null);
    setPodcastOpen(true);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('ad');
      url.searchParams.set('page', 'podcast');
      window.history.pushState({ page: 'podcast' }, '', url.toString());
    } catch {}
  };

  const handleClosePodcast = () => {
    setPodcastOpen(false);
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('page') === 'podcast') {
        url.searchParams.delete('page');
        window.history.pushState({}, '', url.toString());
      }
    } catch {}
  };
  const [countryModalOpen, setCountryModalOpen] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('modal') === 'country') return true;
    } catch {}
    return !getGdprConsent()?.accepted || !localStorage.getItem('scandi_country_popup_seen');
  });
  const [activeAdDetail, setActiveAdDetail] = useState(null);
  const [paymentAd, setPaymentAd] = useState(null);
  const [stripeSettings, setStripeSettings] = useState(null);
  const [lifecycleSettings, setLifecycleSettings] = useState(null);
  const [postAdOpen, setPostAdOpen] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('modal') === 'post';
    } catch {
      return false;
    }
  });
  const [postAdCategory, setPostAdCategory] = useState('bostad');
  const [manageAdOpen, setManageAdOpen] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('modal') === 'manage';
    } catch {
      return false;
    }
  });
  const [manageInitialRef, setManageInitialRef] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get('ref') || '';
    } catch {
      return '';
    }
  });
  const [siteName, setSiteName] = useState(() => readCachedBranding()?.siteName || 'لینک شو');
  const [logoUrl, setLogoUrl] = useState(() => {
    const cachedUrl = readCachedBranding()?.logoUrl;
    return cachedUrl && isSafeHttpUrl(cachedUrl) ? cachedUrl : '';
  });
  const [brandingReady, setBrandingReady] = useState(() => Boolean(readCachedBranding()?.logoUrl));
  const [socialLinks, setSocialLinks] = useState(() => readCachedBranding()?.socialLinks || {
    instagram: 'https://instagram.com',
    telegram: 'https://t.me',
    whatsapp: '',
    youtube: '',
    linkedin: '',
    email: ''
  });
  const [turnstileSettings, setTurnstileSettings] = useState({ enabled: true, mode: 'test', siteKey: '' });
  const [analyticsSettings, setAnalyticsSettings] = useState({ enabled: false, measurementId: '' });
  const [googleMapsSettings, setGoogleMapsSettings] = useState({ enabled: true, embedApiKey: '', defaultZoom: 14 });
  const [seoSettings, setSeoSettings] = useState({
    se: {
      title: 'لینک شو سوئد | نیازمندی‌ها، مسکن، کاریابی و خدمات فارسی‌زبانان در سوئد',
      description: 'لینک شو — مرجع نیازمندی‌ها و آگهی‌های رایگان فارسی‌زبانان در سوئد (استکهلم، گوتنبرگ، مالمو، اوپسالا). اجاره مسکن، رستوران، استخدام و خدمات تخصصی.',
      keywords: 'لینک شو, نیازمندیهای سوئد, فارسی زبانان سوئد, اجاره خانه استکهلم, کار در سوئد, رستوران ایرانی گوتنبرگ',
      heroHeading: 'نیازمندی‌های فارسی‌زبانان سوئد',
      heroSubheading: 'مسکن، رستوران، خدمات و کاریابی در سراسر سوئد'
    },
    no: {
      title: 'لینک شو نروژ | نیازمندی‌ها، مسکن، کاریابی و خدمات فارسی‌زبانان در نروژ',
      description: 'لینک شو — مرجع نیازمندی‌ها و آگهی‌های رایگان فارسی‌زبانان در نروژ (اسلو، برگن، استاوانگر، تروندهایم). مسکن، کاریابی، رستوران و خدمات.',
      keywords: 'لینک شو, نیازمندیهای نروژ, فارسی زبانان نروژ, اجاره خانه اسلو, کار در نروژ, خدمات ایرانی نروژ',
      heroHeading: 'نیازمندی‌های فارسی‌زبانان نروژ',
      heroSubheading: 'مسکن، رستوران، خدمات و کاریابی در سراسر نروژ'
    },
    dk: {
      title: 'لینک شو دانمارک | نیازمندی‌ها، مسکن، کاریابی و خدمات فارسی‌زبانان در دانمارک',
      description: 'لینک شو — مرجع نیازمندی‌ها و آگهی‌های رایگان فارسی‌زبانان در دانمارک (کپنهاگ، آرهوس، اودنسه، آلبورگ). مسکن، استخدام، رستوران و خدمات.',
      keywords: 'لینک شو, نیازمندیهای دانمارک, فارسی زبانان دانمارک, مسکن کپنهاگ, کار در دانمارک, خدمات ایرانی کپنهاگ',
      heroHeading: 'نیازمندی‌های فارسی‌زبانان دانمارک',
      heroSubheading: 'مسکن، رستوران، خدمات و کاریابی در سراسر دانمارک'
    },
    fi: {
      title: 'لینک شو فنلاند | نیازمندی‌ها، مسکن، کاریابی و خدمات فارسی‌زبانان در فنلاند',
      description: 'لینک شو — مرجع نیازمندی‌ها و آگهی‌های رایگان فارسی‌زبانان در فنلاند (هلسینکی، اسپو، تامپره، تورکو). مسکن، کاریابی، رستوران و خدمات.',
      keywords: 'لینک شو, نیازمندیهای فنلاند, فارسی زبانان فنلاند, مسکن هلسینکی, کار در فنلاند, خدمات ایرانی هلسینکی',
      heroHeading: 'نیازمندی‌های فارسی‌زبانان فنلاند',
      heroSubheading: 'مسکن، رستوران، خدمات و کاریابی در سراسر فنلاند'
    }
  });

  // Fetch Site Branding & Public Settings via Secure Public API
  const fetchSettings = async () => {
    try {
      const settings = await publicApi.fetchBootstrap();
      if (settings) {
        const branding = settings.site_branding;
        if (branding) {
          const rawName = (branding.siteName || '').trim();
          const isLegacyName = !rawName || /سوئد\s*پرشیا|سوید\s*پرشیا|پرشیا\s*سو|فارسی\s*نور|swedpersiska|farsi\s*nord|faris\s*nord/i.test(rawName);
          const nextSiteName = isLegacyName ? 'لینک شو' : rawName;
          const nextLogoUrl = (branding.logoUrl && isSafeHttpUrl(branding.logoUrl)) ? branding.logoUrl : '';
          const nextSocialLinks = {
            instagram: branding.socialInstagram ?? 'https://instagram.com',
            telegram: branding.socialTelegram || branding.supportTelegram || 'https://t.me',
            whatsapp: branding.socialWhatsapp || branding.supportPhone || '',
            youtube: branding.socialYoutube || '',
            linkedin: branding.socialLinkedin || '',
            email: branding.supportEmail || ''
          };
          setSiteName(nextSiteName);
          setLogoUrl(nextLogoUrl);
          setSocialLinks(nextSocialLinks);
          try {
            localStorage.setItem(
              'swedpersiska_site_branding',
              JSON.stringify({ siteName: nextSiteName, logoUrl: nextLogoUrl, socialLinks: nextSocialLinks })
            );
          } catch {}
          if (branding.faviconUrl && isSafeHttpUrl(branding.faviconUrl)) {
            let link = document.querySelector("link[rel~='icon']");
            if (!link) {
              link = document.createElement('link');
              link.rel = 'icon';
              document.head.appendChild(link);
            }
            link.href = branding.faviconUrl;
          }
        }
        if (settings.seo_settings && typeof settings.seo_settings === 'object') {
          const sanitizeBrandText = (str) =>
            typeof str === 'string'
              ? str.replace(/سوئد\s*پرشیا|سوید\s*پرشیا|فارسی\s*نورد|فارسی‌نورد|SwedPersiska|Farsi\s*Nord|Faris\s*Nord/gi, 'لینک شو')
              : str;
          setSeoSettings(prev => {
            const next = { ...prev };
            Object.keys(settings.seo_settings).forEach((cid) => {
              const incoming = settings.seo_settings[cid];
              if (incoming && typeof incoming === 'object') {
                const base = prev[cid] || {};
                next[cid] = {
                  ...base,
                  ...incoming,
                  title: sanitizeBrandText(incoming.title) || base.title,
                  description: sanitizeBrandText(incoming.description) || base.description,
                  keywords: sanitizeBrandText(incoming.keywords) || base.keywords,
                  heroHeading: sanitizeBrandText(incoming.heroHeading) || base.heroHeading,
                  heroSubheading: sanitizeBrandText(incoming.heroSubheading) || base.heroSubheading,
                };
              }
            });
            return next;
          });
        }
        if (Array.isArray(settings.portal_countries) && settings.portal_countries.length > 0) {
          setCustomCountries(settings.portal_countries);
          try {
            localStorage.setItem('swedpersiska_portal_countries', JSON.stringify(settings.portal_countries));
          } catch {}
        }
        if (settings.portal_cities && typeof settings.portal_cities === 'object' && !Array.isArray(settings.portal_cities)) {
          setCustomCities(settings.portal_cities);
          try {
            localStorage.setItem('swedpersiska_portal_cities', JSON.stringify(settings.portal_cities));
          } catch {}
        }
        const stripe = settings.stripe_settings;
        if (stripe) {
          setStripeSettings({
            enabled: stripe.enabled,
            mode: stripe.mode,
            publishableKey: stripe.publishableKey,
            vipPrice: stripe.vipPrice,
            currency: stripe.currency,
            vipDurationDays: stripe.vipDurationDays,
            vipBadgeText: stripe.vipBadgeText,
            checkoutAvailable: Boolean(stripe.checkoutAvailable),
            stripeReady: Boolean(stripe.stripeReady ?? stripe.checkoutAvailable),
          });
        }
        if (settings.turnstile_settings) {
          setTurnstileSettings(prev => ({ ...prev, ...settings.turnstile_settings }));
          try {
            const existing = JSON.parse(localStorage.getItem('swedpersiska_turnstile_settings') || '{}');
            localStorage.setItem(
              'swedpersiska_turnstile_settings',
              JSON.stringify({ ...existing, ...settings.turnstile_settings })
            );
          } catch {}
        }
        if (settings.analytics_settings) {
          setAnalyticsSettings(prev => ({ ...prev, ...settings.analytics_settings }));
        }
        if (settings.google_maps_settings && typeof settings.google_maps_settings === 'object') {
          setGoogleMapsSettings(prev => ({ ...prev, ...settings.google_maps_settings }));
        }
        if (settings.podcast_settings) {
          setPodcastSettings(settings.podcast_settings);
        }
        if (settings.ad_lifecycle_settings) {
          setLifecycleSettings(settings.ad_lifecycle_settings);
        }
      }
    } catch {} finally {
      setBrandingReady(true);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Google Analytics (GA4) with Consent Mode v2: tag is always present (so Google detects it),
  // but analytics_storage stays 'denied' until the visitor accepts analytics under EU GDPR.
  useEffect(() => {
    const id = (analyticsSettings?.measurementId || '').trim().toUpperCase();
    if (!analyticsSettings?.enabled || !/^G-[A-Z0-9]{4,}$/.test(id)) return;

    if (!window.dataLayer) window.dataLayer = [];
    if (!window.gtag) {
      window.gtag = function gtag() {
        window.dataLayer.push(arguments);
      };
    }

    if (!window.__lsGtagBooted) {
      window.gtag('consent', 'default', {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        analytics_storage: 'denied',
      });
      window.gtag('js', new Date());
      window.__lsGtagBooted = true;
    }

    window.gtag('consent', 'update', {
      analytics_storage: gdprConsent?.analytics ? 'granted' : 'denied',
    });

    const alreadyLoaded = Array.from(document.scripts).some((s) =>
      (s.src || '').includes(`googletagmanager.com/gtag/js?id=${id}`)
    );
    if (!alreadyLoaded) {
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
      document.head.appendChild(script);
    }

    let safeSearch = '';
    try {
      const sp = new URLSearchParams(window.location.search);
      ['vip_session_id', 'vip_cancelled', 'stripe_session_id', 'renew_session_id', 'cancelled'].forEach((k) => sp.delete(k));
      const qs = sp.toString();
      safeSearch = qs ? `?${qs}` : '';
    } catch {}
    const safePagePath = window.location.pathname + safeSearch;
    const currentTrackKey = `${id}|${safePagePath}`;
    if (lastTrackedPathRef.current === currentTrackKey) return;
    lastTrackedPathRef.current = currentTrackKey;

    window.gtag('config', id, {
      page_path: safePagePath,
      page_title: document.title,
    });
  }, [analyticsSettings.enabled, analyticsSettings.measurementId, gdprConsent?.analytics, selectedCountry, selectedCategory, activeAdDetail?.id]);

  const top20AdIdsKey = useMemo(
    () => ads.slice(0, 20).map((a) => a.id).join(','),
    [ads]
  );
  const adsForSeoRef = useRef(ads);
  useEffect(() => {
    adsForSeoRef.current = ads;
  }, [ads]);

  // Dynamic Country, Category & Ad SEO (Title + Meta + OpenGraph + Clean Canonical + JSON-LD @graph)
  useEffect(() => {
    const cObj = portalCountries.find(c => c.id === selectedCountry) || portalCountries[0] || COUNTRIES[0];
    const cName = cObj?.nameFa || 'سوئد';
    const catObj = selectedCategory && selectedCategory !== 'all'
      ? CATEGORIES.find(c => c.id === selectedCategory)
      : null;
    const activeSeo = seoSettings[selectedCountry] || {
      title: `${siteName} ${cName} | نیازمندی‌ها، مسکن، کاریابی و خدمات فارسی‌زبانان در ${cName}`,
      description: `${siteName} — محل رشد کسب و کار فارسی‌زبانان و مرجع آگهی‌های رایگان مسکن، رستوران، کاریابی و خدمات در سراسر ${cName}.`,
      keywords: `${siteName}, نیازمندیهای ${cName}, فارسی زبانان ${cName}, مسکن ${cName}, کار در ${cName}`,
    };

    const pageMode = podcastOpen
      ? 'podcast'
      : websiteBuilderOpen
        ? 'website-builder'
        : 'feed';

    let pageTitle = activeSeo.title;
    let pageDesc = activeSeo.description;
    if (activeAdDetail) {
      pageTitle = `${activeAdDetail.title_fa || activeAdDetail.title} | ${siteName}`;
      pageDesc = (activeAdDetail.description || '').replace(/\s+/g, ' ').trim().slice(0, 160);
    } else if (pageMode === 'podcast') {
      pageTitle = `پادکست خبری و ویدیوهای فارسی‌زبانان اروپا | ${siteName}`;
      pageDesc = `شنیدن جدیدترین پادکست‌های خبری و ویدیوهای منتخب فارسی‌زبانان اروپا در ${siteName}.`;
    } else if (pageMode === 'website-builder') {
      pageTitle = `طراحی وب‌سایت و سئو تخصصی در اروپا | ${siteName}`;
      pageDesc = `طراحی وب‌سایت سریع، ریسپانسیو و سئوشده برای کسب‌وکارهای فارسی‌زبان در اروپا توسط ${siteName}.`;
    } else if (catObj) {
      pageTitle = `${catObj.fa} در ${cName} | ${siteName}`;
      pageDesc = `جدیدترین آگهی‌های ${catObj.fa} برای فارسی‌زبانان در ${cName} — ثبت رایگان در ${siteName}.`;
    }

    document.title = pageTitle;

    const setMeta = (selector, attr, val) => {
      if (!val) return;
      let el = document.querySelector(selector);
      if (!el) {
        el = document.createElement('meta');
        const [k, v] = attr.split('=');
        el.setAttribute(k, v);
        document.head.appendChild(el);
      }
      el.setAttribute('content', val);
    };

    const countryIso = (selectedCountry || 'se').toUpperCase();
    const origin =
      typeof window !== 'undefined' && /^https?:\/\/(www\.)?linksho\.eu$/i.test(window.location.origin)
        ? CANONICAL_SITE_ORIGIN
        : (window.location.origin || CANONICAL_SITE_ORIGIN);
    const canonicalUrl = buildClientCanonicalUrl({
      origin,
      adRef: activeAdDetail ? (activeAdDetail.reference_number || activeAdDetail.id) : '',
      page: pageMode === 'feed' ? '' : pageMode,
      country: activeAdDetail ? activeAdDetail.country : selectedCountry,
      category: activeAdDetail ? '' : selectedCategory,
      city: activeAdDetail ? '' : selectedCity,
    });
    const shareImage =
      activeAdDetail?.images?.[0] ||
      cObj?.heroImage ||
      `${origin}/images/cities/stockholm.jpg`;

    setMeta('meta[name="description"]', 'name=description', pageDesc);
    setMeta('meta[name="keywords"]', 'name=keywords', activeSeo.keywords);
    setMeta('meta[name="geo.region"]', 'name=geo.region', countryIso);
    setMeta('meta[name="geo.placename"]', 'name=geo.placename', cName);
    setMeta('meta[property="og:site_name"]', 'property=og:site_name', siteName);
    setMeta('meta[property="og:locale"]', 'property=og:locale', `fa_${countryIso}`);
    setMeta('meta[property="og:type"]', 'property=og:type', activeAdDetail ? 'article' : 'website');
    setMeta('meta[property="og:url"]', 'property=og:url', canonicalUrl);
    setMeta('meta[property="og:title"]', 'property=og:title', (!activeAdDetail && !catObj && pageMode === 'feed' && activeSeo.ogTitle) ? activeSeo.ogTitle : pageTitle);
    setMeta('meta[property="og:description"]', 'property=og:description', (!activeAdDetail && !catObj && pageMode === 'feed' && activeSeo.ogDescription) ? activeSeo.ogDescription : pageDesc);
    setMeta('meta[property="og:image"]', 'property=og:image', shareImage.startsWith('/') ? `${origin}${shareImage}` : shareImage);
    setMeta('meta[name="twitter:image"]', 'name=twitter:image', shareImage.startsWith('/') ? `${origin}${shareImage}` : shareImage);
    setMeta('meta[name="twitter:title"]', 'name=twitter:title', (!activeAdDetail && !catObj && pageMode === 'feed' && activeSeo.ogTitle) ? activeSeo.ogTitle : pageTitle);
    setMeta('meta[name="twitter:description"]', 'name=twitter:description', (!activeAdDetail && !catObj && pageMode === 'feed' && activeSeo.ogDescription) ? activeSeo.ogDescription : pageDesc);

    let canonicalEl = document.querySelector('link[rel="canonical"]');
    if (!canonicalEl) {
      canonicalEl = document.createElement('link');
      canonicalEl.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalEl);
    }
    canonicalEl.setAttribute('href', canonicalUrl);

    // Localized hreflang alternate links only on homepage / country landing views (avoid invalid non-reciprocal tags on ad/subpages)
    const countriesList = (portalCountries && portalCountries.length > 0) ? portalCountries : COUNTRIES;
    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove());
    if (!activeAdDetail && !catObj && pageMode === 'feed') {
      const appendHreflang = (hreflang, href) => {
        const linkEl = document.createElement('link');
        linkEl.setAttribute('rel', 'alternate');
        linkEl.setAttribute('hreflang', hreflang);
        linkEl.setAttribute('href', href);
        linkEl.setAttribute('data-linksho-hreflang', '1');
        document.head.appendChild(linkEl);
      };
      countriesList.forEach((c) => {
        appendHreflang(`fa-${String(c.iso || c.id || 'se').toUpperCase()}`, `${origin}/?c=${c.id}`);
      });
      appendHreflang('x-default', `${origin}/`);
    }

    // Rich @graph structured data for Google & AI search engines
    let ldEl = document.getElementById('linksho-dynamic-ld');
    if (!ldEl) {
      ldEl = document.createElement('script');
      ldEl.id = 'linksho-dynamic-ld';
      ldEl.type = 'application/ld+json';
      document.head.appendChild(ldEl);
    }
    const ldData = buildClientSeoGraph({
      origin,
      siteName,
      logoUrl,
      socialLinks,
      countryObj: cObj,
      categoryId: selectedCategory,
      activeAd: activeAdDetail,
      adsList: adsForSeoRef.current,
      pageMode,
      pageTitle,
      pageDesc,
      canonicalUrl,
      nowMs: renderNow,
    });
    ldEl.textContent = JSON.stringify(ldData);
  }, [selectedCountry, selectedCategory, selectedCity, seoSettings, activeAdDetail, podcastOpen, websiteBuilderOpen, siteName, logoUrl, socialLinks, portalCountries, top20AdIdsKey, renderNow]);

  // Success Toast
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  // Strict Persian RTL
  useEffect(() => {
    document.documentElement.dir = 'rtl';
    document.documentElement.lang = 'fa';
  }, []);

  // Fetch paginated ads + VIP showcase in a single combined request on page 1
  const fetchAds = async () => {
    const reqSeq = ++feedRequestSeqRef.current;
    setLoading(true);
    loadingMoreRef.current = false;
    setLoadingMore(false);
    try {
      const mainRes = await publicApi.fetchAdsPage({
        page: 1,
        limit: FEED_PAGE_SIZE,
        country: selectedCountry,
        category: selectedCategory,
        city: selectedCity,
        q: searchQuery.trim(),
        sort: sortBy || '',
        includeFeatured: true,
      });
      if (reqSeq !== feedRequestSeqRef.current) return;
      setAds(mainRes.ads || []);
      setTotalAdsCount(mainRes.total || 0);
      setFeedPage(1);
      setHasMoreAds(Boolean(mainRes.hasMore));
      if (Array.isArray(mainRes.featuredAds)) {
        setFeaturedAdsList(mainRes.featuredAds);
      }
      lastVipFilterKeyRef.current = `${selectedCountry}|${selectedCategory}|${selectedCity}|${searchQuery.trim()}`;
    } catch (err) {
      console.error('Error fetching ads:', err);
    } finally {
      if (reqSeq === feedRequestSeqRef.current) {
        setLoading(false);
      }
    }
  };

  const isFeedActiveView = !activeAdDetail && !podcastOpen && !websiteBuilderOpen && initialAdResolved;

  useEffect(() => {
    if (!isFeedActiveView) return;
    let cancelled = false;
    const reqSeq = ++feedRequestSeqRef.current;
    const vipFilterKey = `${selectedCountry}|${selectedCategory}|${selectedCity}|${searchQuery.trim()}`;
    const shouldIncludeFeatured = lastVipFilterKeyRef.current !== vipFilterKey;

    const loadPageOne = async () => {
      await Promise.resolve();
      if (cancelled || reqSeq !== feedRequestSeqRef.current) return;
      setLoading(true);
      loadingMoreRef.current = false;
      setLoadingMore(false);

      try {
        const mainRes = await publicApi.fetchAdsPage({
          page: 1,
          limit: FEED_PAGE_SIZE,
          country: selectedCountry,
          category: selectedCategory,
          city: selectedCity,
          q: searchQuery.trim(),
          sort: sortBy || '',
          includeFeatured: shouldIncludeFeatured,
        });
        if (cancelled || reqSeq !== feedRequestSeqRef.current) return;
        setAds(mainRes.ads || []);
        setTotalAdsCount(mainRes.total || 0);
        setFeedPage(1);
        setHasMoreAds(Boolean(mainRes.hasMore));
        if (shouldIncludeFeatured && Array.isArray(mainRes.featuredAds)) {
          setFeaturedAdsList(mainRes.featuredAds);
          lastVipFilterKeyRef.current = vipFilterKey;
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error fetching paginated ads:', err);
        }
      } finally {
        if (!cancelled && reqSeq === feedRequestSeqRef.current) {
          setLoading(false);
        }
      }
    };

    loadPageOne();
    return () => {
      cancelled = true;
    };
  }, [selectedCountry, selectedCategory, selectedCity, searchQuery, sortBy, isFeedActiveView]);

  const loadMoreAds = async () => {
    if (loading || loadingMoreRef.current || !hasMoreAds) return;
    const reqSeq = feedRequestSeqRef.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const nextPage = feedPage + 1;
    try {
      const res = await publicApi.fetchAdsPage({
        page: nextPage,
        limit: FEED_PAGE_SIZE,
        country: selectedCountry,
        category: selectedCategory,
        city: selectedCity,
        q: searchQuery.trim(),
        sort: sortBy || '',
      });
      if (reqSeq !== feedRequestSeqRef.current) return;
      const incoming = res.ads || [];
      setAds((prev) => {
        const existingIds = new Set(prev.map((item) => item.id));
        const uniqueNew = incoming.filter((item) => !existingIds.has(item.id));
        return uniqueNew.length > 0 ? [...prev, ...uniqueNew] : prev;
      });
      if (typeof res.total === 'number') {
        setTotalAdsCount(res.total);
      }
      setFeedPage(nextPage);
      setHasMoreAds(Boolean(res.hasMore));
    } catch (err) {
      console.error('Error loading more ads:', err);
    } finally {
      if (reqSeq === feedRequestSeqRef.current) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  };

  useEffect(() => {
    loadMoreActionRef.current = loadMoreAds;
    fetchAdsRef.current = fetchAds;
  });

  useEffect(() => {
    if (loading || !hasMoreAds || activeAdDetail || podcastOpen || websiteBuilderOpen) return;
    const node = feedSentinelRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMoreActionRef.current?.();
        }
      },
      { rootMargin: '450px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loading, hasMoreAds, activeAdDetail, podcastOpen, websiteBuilderOpen, ads.length]);

  // Immediate ad & live Stripe VIP checkout check on mount
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const adParam = getInitialAdParamFromUrl();
      if (adParam) {
        publicApi.fetchAdByParam(adParam)
          .then((data) => {
            if (data) setActiveAdDetail(data);
          })
          .finally(() => {
            setInitialAdResolved(true);
          });
      }
      const vipSessionId = params.get('vip_session_id');
      const vipCancelled = params.get('vip_cancelled') === '1';
      if (vipSessionId) {
        // Strip sensitive session_id synchronously BEFORE network fetch so it never leaks to history/analytics
        try {
          const clean = new URL(window.location.href);
          clean.searchParams.delete('vip_session_id');
          window.history.replaceState({}, '', clean.toString());
        } catch {}
        publicApi.verifyVipCheckout(vipSessionId)
          .then((res) => {
            if (res?.ad) {
              fetchAdsRef.current?.();
              if (res.ad.country) {
                setSelectedCountry(res.ad.country);
              }
              setActiveAdDetail((curr) => (curr && curr.id === res.ad.id ? res.ad : curr));
              setToastMsg(`آگهی «${res.ad.title_fa || res.ad.title}» ویژه (VIP) شد.`);
              setTimeout(() => setToastMsg(''), 4000);
            }
          })
          .catch((err) => {
            setToastMsg(err?.message || 'تایید پرداخت انجام نشد.');
            setTimeout(() => setToastMsg(''), 5000);
          });
      } else if (vipCancelled) {
        Promise.resolve().then(() => {
          setToastMsg('پرداخت لغو شد.');
          setTimeout(() => setToastMsg(''), 4000);
        });
        try {
          const clean = new URL(window.location.href);
          clean.searchParams.delete('vip_cancelled');
          window.history.replaceState({}, '', clean.toString());
        } catch {}
      }
    } catch {}
  }, []);

  // Handle browser Back / Forward history navigation (mobile swipe-back & desktop back button)
  useEffect(() => {
    const handlePopState = () => {
      try {
        const params = new URLSearchParams(window.location.search);

        // 1. Modals & Sub-Pages
        const modal = params.get('modal');
        setPostAdOpen(modal === 'post');
        setManageAdOpen(modal === 'manage');
        setManageInitialRef(modal === 'manage' ? (params.get('ref') || '') : '');
        setCountryModalOpen(modal === 'country');
        setPodcastOpen(params.get('page') === 'podcast');
        setWebsiteBuilderOpen(params.get('page') === 'website-builder');
        if (modal !== 'pay') setPaymentAd(null);

        // 2. Ad Detail Page
        const adParam = params.get('ad');
        if (adParam) {
          const found = [...featuredAdsList, ...ads].find(a => a.reference_number === adParam || a.id === adParam);
          if (found) {
            setActiveAdDetail(found);
            if (found._isSummary) {
              publicApi.fetchAdByParam(found.id).then((fullData) => {
                if (fullData) {
                  setActiveAdDetail((curr) => (curr && curr.id === found.id ? { ...curr, ...fullData, _isSummary: false } : curr));
                }
              });
            }
          } else {
            publicApi.fetchAdByParam(adParam).then((data) => {
              if (data) setActiveAdDetail(data);
            });
          }
        } else {
          setActiveAdDetail(null);
        }

        // 4. Category
        const cat = params.get('cat');
        if (cat) {
          setSelectedCategory(cat);
        } else if (!params.has('cat') && selectedCategory !== 'all') {
          setSelectedCategory('all');
        }
      } catch (err) {
        console.error('Error in popstate handler:', err);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [ads, featuredAdsList, selectedCategory]);

  // Modal Open / Close Handlers with Browser History Support
  const handleOpenPostAd = (catId = 'bostad') => {
    setPostAdCategory(catId);
    setPostAdOpen(true);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('modal', 'post');
      window.history.pushState({ modal: 'post' }, '', url.toString());
    } catch {}
  };

  const handleClosePostAd = () => {
    setPostAdOpen(false);
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('modal') === 'post') {
        url.searchParams.delete('modal');
        window.history.replaceState({}, '', url.toString());
      }
    } catch {}
  };

  const handleOpenManageAd = (initialRef = '') => {
    const cleanRef = typeof initialRef === 'string' ? initialRef.trim().toUpperCase() : '';
    setManageInitialRef(cleanRef);
    setManageAdOpen(true);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('modal', 'manage');
      if (cleanRef) url.searchParams.set('ref', cleanRef);
      else url.searchParams.delete('ref');
      window.history.pushState({ modal: 'manage', ref: cleanRef }, '', url.toString());
    } catch {}
  };

  const handleCloseManageAd = () => {
    setManageAdOpen(false);
    setManageInitialRef('');
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('modal') === 'manage') {
        url.searchParams.delete('modal');
        url.searchParams.delete('ref');
        window.history.replaceState({}, '', url.toString());
      }
    } catch {}
  };

  const handleOpenCountryModal = () => {
    setCountryModalOpen(true);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('modal', 'country');
      window.history.pushState({ modal: 'country' }, '', url.toString());
    } catch {}
  };

  const handleCloseCountryModal = () => {
    setCountryModalOpen(false);
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('modal') === 'country') {
        url.searchParams.delete('modal');
        window.history.replaceState({}, '', url.toString());
      }
    } catch {}
  };

  const handleOpenPayment = (ad) => {
    setPaymentAd(ad);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('modal', 'pay');
      window.history.pushState({ modal: 'pay' }, '', url.toString());
    } catch {}
  };

  const handleClosePayment = () => {
    setPaymentAd(null);
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('modal') === 'pay') {
        url.searchParams.delete('modal');
        window.history.replaceState({}, '', url.toString());
      }
    } catch {}
  };

  const handleCategoryChange = (catId) => {
    if (activeAdDetail) handleBackToFeed();
    if (podcastOpen) handleClosePodcast();
    if (websiteBuilderOpen) handleCloseWebsiteBuilder();
    setSelectedCategory(catId);
    try {
      const url = new URL(window.location.href);
      if (catId === 'all') {
        url.searchParams.delete('cat');
      } else {
        url.searchParams.set('cat', catId);
      }
      window.history.replaceState({}, '', url.toString());
    } catch {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Apple-like sliding active category pill & touch-swipe navigation refs
  const categoryStripRef = useRef(null);
  const categoryPillRefs = useRef({});
  const sortMenuRef = useRef(null);
  const touchSwipeRef = useRef({ x: 0, y: 0 });
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0, ready: false });
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  useEffect(() => {
    if (activeAdDetail || podcastOpen || websiteBuilderOpen) return;
    const el = categoryPillRefs.current[selectedCategory];
    if (!el) return;

    let cancelled = false;
    let rafId = 0;

    const measurePill = () => {
      if (cancelled) return;
      const currentEl = categoryPillRefs.current[selectedCategory];
      if (!currentEl) return;
      setPillStyle({ left: currentEl.offsetLeft, width: currentEl.offsetWidth, ready: true });
    };

    const scheduleMeasure = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(measurePill);
    };

    scheduleMeasure();
    try {
      el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    } catch {}

    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(scheduleMeasure);
      if (categoryStripRef.current) ro.observe(categoryStripRef.current);
      ro.observe(el);
    }
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(scheduleMeasure).catch(() => {});
    }
    window.addEventListener('resize', scheduleMeasure);
    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (ro) ro.disconnect();
      window.removeEventListener('resize', scheduleMeasure);
    };
  }, [selectedCategory, activeAdDetail, podcastOpen, websiteBuilderOpen]);

  const handleFeedTouchStart = (e) => {
    if (e.touches && e.touches.length === 1) {
      touchSwipeRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleFeedTouchEnd = (e) => {
    if (!e.changedTouches || e.changedTouches.length !== 1) return;
    const dx = e.changedTouches[0].clientX - touchSwipeRef.current.x;
    const dy = e.changedTouches[0].clientY - touchSwipeRef.current.y;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
    const currIdx = CATEGORIES.findIndex(c => c.id === selectedCategory);
    if (currIdx === -1) return;
    // In RTL: swiping finger right-to-left (dx < 0) goes back toward index 0; left-to-right (dx > 0) advances to next category
    const nextIdx = dx > 0 ? currIdx + 1 : currIdx - 1;
    if (nextIdx >= 0 && nextIdx < CATEGORIES.length) {
      handleCategoryChange(CATEGORIES[nextIdx].id);
    }
  };

  // When clicking an ad, open full page view immediately and hydrate full contact/description details if summary
  const handleSelectAd = useCallback((ad) => {
    setActiveAdDetail(ad);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('ad', ad.reference_number || ad.id);
      window.history.pushState({ view: 'ad', id: ad.reference_number || ad.id }, '', url.toString());
    } catch {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
    publicApi.incrementView(ad.id, ad.views_count);

    if (ad?._isSummary) {
      publicApi.fetchAdByParam(ad.id).then((fullData) => {
        if (fullData) {
          setActiveAdDetail((curr) => (curr && curr.id === ad.id ? { ...curr, ...fullData, _isSummary: false } : curr));
        }
      });
    }
  }, []);

  // Back to ads feed
  const handleBackToFeed = () => {
    if (window.history.state && window.history.state.view === 'ad') {
      window.history.back();
    } else {
      setActiveAdDetail(null);
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('ad');
        window.history.replaceState({}, '', url.toString());
      } catch {}
    }
  };

  // Auto-return to feed when user searches or changes city while viewing an ad detail page
  const clearAdDetailForFilter = useCallback(() => {
    setActiveAdDetail(null);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('ad');
      window.history.replaceState({}, '', url.toString());
    } catch {}
  }, []);

  const [heroSearchFocused, setHeroSearchFocused] = useState(false);
  const [heroCityOpen, setHeroCityOpen] = useState(false);
  const heroCityRef = useRef(null);
  const feedSectionRef = useRef(null);

  const handleSearchDraftChange = useCallback((val) => {
    setSearchDraft(val);
    setHighlightedSuggestionIndex(-1);
  }, []);

  const handleCommitSearch = useCallback((rawQuery) => {
    const text = String(rawQuery !== undefined ? rawQuery : searchDraft).trim();
    setSearchDraft(text);
    setSearchQuery(text);
    setHeroSearchFocused(false);
    setHeroCityOpen(false);
    setHighlightedSuggestionIndex(-1);

    try {
      const url = new URL(window.location.href);
      if (text) {
        url.searchParams.set('q', text);
      } else {
        url.searchParams.delete('q');
      }
      window.history.replaceState({}, '', url.toString());
    } catch {}

    clearAdDetailForFilter();

    if (feedSectionRef.current) {
      feedSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [searchDraft, clearAdDetailForFilter]);

  const handleClearSearch = useCallback(() => {
    setSearchDraft('');
    setSearchQuery('');
    setHeroSearchFocused(false);
    setHighlightedSuggestionIndex(-1);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('q');
      window.history.replaceState({}, '', url.toString());
    } catch {}
  }, []);

  const handleCityChange = (cityVal) => {
    setSelectedCity(cityVal);
    clearAdDetailForFilter();
  };

  // Active country details (from merged dynamic countries list)
  const currentCountryObj = portalCountries.find(c => c.id === selectedCountry) || portalCountries[0] || COUNTRIES[0];

  // Dynamic available cities for current country
  const availableCities = currentCountryObj.cities;

  // Dynamic Hero Background Photo (Per Country — customizable from Admin Panel)
  const heroImageSrc = currentCountryObj.heroImage || '/images/cities/stockholm.jpg';
  const localCityHeroMatch = heroImageSrc.match(/^\/images\/cities\/(stockholm|oslo|copenhagen|helsinki)\.jpg$/);
  const activeHero = {
    image: heroImageSrc,
    srcSet: localCityHeroMatch
      ? `/images/cities/${localCityHeroMatch[1]}-768.jpg 768w, ${heroImageSrc} 1376w`
      : undefined,
    cityFa: currentCountryObj.nameFa,
    cityEn: currentCountryObj.nameNative || currentCountryObj.nameFa
  };

  // Dynamic Hero Titles based on selected country & synced SEO settings
  const activeCountrySeo = seoSettings[selectedCountry];
  const heroHeading = activeCountrySeo?.heroHeading || `نیازمندی‌های فارسی‌زبانان ${currentCountryObj.nameFa}`;
  const heroSubheading = activeCountrySeo?.heroSubheading || `مسکن، رستوران، خدمات و کاریابی در سراسر ${currentCountryObj.nameFa}`;

  const handleHeroSearchSubmit = useCallback(() => {
    handleCommitSearch(searchDraft);
  }, [handleCommitSearch, searchDraft]);

  useEffect(() => {
    if (!sortMenuOpen && !heroCityOpen) return;
    const handleOutside = (e) => {
      if (sortMenuOpen && sortMenuRef.current && !sortMenuRef.current.contains(e.target)) {
        setSortMenuOpen(false);
      }
      if (heroCityOpen && heroCityRef.current && !heroCityRef.current.contains(e.target)) {
        setHeroCityOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSortMenuOpen(false);
        setHeroCityOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [sortMenuOpen, heroCityOpen]);

  const countryAds = useMemo(
    () => ads.filter(ad => ad.country === selectedCountry || (!ad.country && selectedCountry === 'se')),
    [ads, selectedCountry]
  );

  const scopedAdsForSearch = useMemo(() => {
    const seenIds = new Set();
    const combined = [];
    const addIfScoped = (ad) => {
      if (!ad) return;
      const key = ad.id || ad.reference_number;
      if (key && seenIds.has(key)) return;
      const matchCountry = ad.country === selectedCountry || (!ad.country && selectedCountry === 'se');
      const matchCat = selectedCategory === 'all' || ad.category === selectedCategory;
      const matchCity = selectedCity === 'all' || ad.city === selectedCity;
      if (matchCountry && matchCat && matchCity) {
        if (key) seenIds.add(key);
        combined.push(ad);
      }
    };
    for (const ad of featuredAdsList) addIfScoped(ad);
    for (const ad of countryAds) addIfScoped(ad);
    return combined;
  }, [featuredAdsList, countryAds, selectedCountry, selectedCategory, selectedCity]);

  const searchSuggestions = useMemo(
    () => getSearchSuggestions(deferredSearchDraft, { ads: scopedAdsForSearch }),
    [deferredSearchDraft, scopedAdsForSearch]
  );

  const filteredAds = useMemo(() => {
    return countryAds.filter(ad => {
      const matchCat = selectedCategory === 'all' || ad.category === selectedCategory;
      const matchCity = selectedCity === 'all' || ad.city === selectedCity;
      const matchSearch = matchesSmartSearch(ad, searchQuery);
      return matchCat && matchCity && matchSearch;
    });
  }, [countryAds, selectedCategory, selectedCity, searchQuery]);

  // Sort ads according to selected sort option while preserving Paid VIP ranking & boost sort_timestamp
  const sortedAds = useMemo(() => {
    const isVip = (a) => Boolean(
      a?.is_active_vip !== undefined
        ? a.is_active_vip
        : (a?.is_featured && (!a.promotion_expires_at || Date.parse(a.promotion_expires_at) > renderNow))
    );
    const copy = [...filteredAds];
    if (sortBy === 'most_viewed') {
      return copy.sort((a, b) => (b.views_count || 0) - (a.views_count || 0));
    }
    if (sortBy === 'price_asc') {
      return copy.sort((a, b) => {
        const pa = a.price ? Number(a.price) : Infinity;
        const pb = b.price ? Number(b.price) : Infinity;
        return pa - pb;
      });
    }
    if (sortBy === 'price_desc') {
      return copy.sort((a, b) => {
        const pa = a.price ? Number(a.price) : -1;
        const pb = b.price ? Number(b.price) : -1;
        return pb - pa;
      });
    }
    const tsMap = new Map();
    const getSortTs = (ad) => {
      let ts = tsMap.get(ad);
      if (ts === undefined) {
        ts = Date.parse(ad.sort_timestamp || ad.created_at || 0) || 0;
        tsMap.set(ad, ts);
      }
      return ts;
    };
    const hasSearchQuery = Boolean(searchQuery.trim());
    return copy.sort((a, b) => {
      const vA = isVip(a);
      const vB = isVip(b);
      if (vA !== vB) return vB ? 1 : -1;
      if (hasSearchQuery) {
        const sA = scoreSmartSearchMatch(a, searchQuery);
        const sB = scoreSmartSearchMatch(b, searchQuery);
        if (sA !== sB) return sB - sA;
      }
      return getSortTs(b) - getSortTs(a);
    });
  }, [filteredAds, sortBy, renderNow, searchQuery]);

  // Active Featured (VIP) ads subset
  const featuredAds = useMemo(
    () =>
      featuredAdsList.filter((a) => {
        const matchCountry = a.country === selectedCountry || (!a.country && selectedCountry === 'se');
        const matchCat = selectedCategory === 'all' || a.category === selectedCategory;
        const matchCity = selectedCity === 'all' || a.city === selectedCity;
        const matchSearch = matchesSmartSearch(a, searchQuery);
        const vipActive =
          a.is_active_vip !== undefined
            ? Boolean(a.is_active_vip)
            : Boolean(a.is_featured && (!a.promotion_expires_at || Date.parse(a.promotion_expires_at) > renderNow));
        return matchCountry && matchCat && matchCity && matchSearch && vipActive;
      }),
    [featuredAdsList, selectedCountry, selectedCategory, selectedCity, searchQuery, renderNow]
  );

  return (
    <div className={`min-h-screen flex flex-col bg-[#FBFBFC] dark:bg-[#121317] text-[#1D1D1F] dark:text-[#F5F5F7] overflow-x-clip w-full max-w-full pb-16 md:pb-0 ${lang === 'fa' ? 'font-vazir' : ''}`}>

      {/* Geolocation Country Detection Pop-Up Modal (Only loaded when open) */}
      {countryModalOpen && (
        <Suspense fallback={null}>
          <CountryBanner
            isOpen={countryModalOpen}
            onClose={handleCloseCountryModal}
            selectedCountry={selectedCountry}
            onSelectCountry={handleCountryChange}
            onConsentSaved={setGdprConsent}
            siteName={siteName}
            countries={portalCountries}
          />
        </Suspense>
      )}

      {/* Top Navbar */}
      <Navbar
        siteName={siteName}
        logoUrl={logoUrl}
        brandingReady={brandingReady}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        selectedCity={selectedCity}
        onSelectCity={handleCityChange}
        availableCities={availableCities}
        searchDraft={searchDraft}
        searchQuery={searchDraft}
        onSearchDraftChange={handleSearchDraftChange}
        onSearchChange={handleSearchDraftChange}
        onCommitSearch={handleCommitSearch}
        onClearSearch={handleClearSearch}
        searchSuggestions={searchSuggestions}
        onOpenPostAd={handleOpenPostAd}
        onOpenManageAd={handleOpenManageAd}
        onSelectCategory={handleCategoryChange}
        selectedCategory={selectedCategory}
        onOpenCountryModal={handleOpenCountryModal}
        onOpenLegal={setLegalModalTab}
        onOpenPodcast={handleOpenPodcast}
        onOpenWebsiteBuilder={handleOpenWebsiteBuilder}
        selectedCountryObj={currentCountryObj}
      />

      {/* Spacer for Fixed Top Navbar */}
      <div className="h-16 md:h-16 shrink-0" aria-hidden="true" />

      {/* Floating Toast Notification (Clears mobile bottom nav on small screens) */}
      {toastMsg && (
        <div className="fixed bottom-20 md:bottom-5 inset-x-4 md:inset-x-auto md:end-5 md:max-w-sm z-50 flex items-center gap-2 rounded-xl bg-stone-900 text-white px-3.5 py-2.5 shadow-lg border border-stone-800 text-xs font-medium animate-in slide-in-from-bottom-2 duration-150">
          <CheckCircle2 size={15} className="text-white/60 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Full Page Ad View / Podcast Page OR Home Feed */}
      {activeAdDetail ? (
        <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-12 text-center text-xs text-slate-400">در حال بارگذاری جزئیات آگهی...</div>}>
          <AdDetailPage
            key={activeAdDetail.id}
            ad={activeAdDetail}
            allAds={ads}
            lang={lang}
            countries={portalCountries}
            turnstileSettings={turnstileSettings}
            googleMapsSettings={googleMapsSettings}
            onBack={handleBackToFeed}
            onSelectAd={handleSelectAd}
            onOpenPromote={(targetAd) => handleOpenPayment(targetAd)}
          />
      </Suspense>
      ) : podcastOpen ? (
        <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-12 text-center text-xs text-slate-400">در حال بارگذاری پادکست خبری...</div>}>
          <PodcastPage
            podcastSettings={podcastSettings}
            onBack={handleClosePodcast}
          />
        </Suspense>
      ) : websiteBuilderOpen ? (
        <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-12 text-center text-xs text-slate-400">در حال بارگذاری صفحه ساخت وب‌سایت...</div>}>
          <WebsiteBuilderPage
            stripeSettings={stripeSettings}
            onBack={handleCloseWebsiteBuilder}
          />
        </Suspense>
      ) : (
        <>
          {/* Hero Section - Always visible on Desktop; hidden on Mobile when filtering by category */}
          <section className={`relative z-[35] w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 sm:pt-5 pb-1 animate-in fade-in duration-200 ${selectedCategory !== 'all' ? 'hidden md:block' : 'block'}`}>
          <div className="group relative min-h-[190px] sm:min-h-[290px] md:min-h-[350px] lg:min-h-[370px] rounded-2xl sm:rounded-3xl flex flex-col items-center justify-center px-4 sm:px-8 py-8 sm:py-12 md:py-16">
            
            {/* Rounded Architectural Cityscape Backdrop with Smooth Hover Zoom & Balanced Contrast Scrim */}
            <div className="absolute inset-0 z-0 rounded-2xl sm:rounded-3xl overflow-hidden border border-[#ECEFF4] dark:border-white/[0.06] bg-[#1D1D1F] pointer-events-none select-none">
              <img
                key={activeHero.image}
                src={activeHero.image}
                srcSet={activeHero.srcSet}
                sizes={activeHero.srcSet ? '(max-width: 768px) 100vw, 1280px' : undefined}
                width="1376"
                height="768"
                alt={activeHero.cityFa}
                decoding="async"
                fetchPriority="high"
                className="w-full h-full object-cover object-center opacity-95 scale-100 group-hover:scale-[1.025] transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/25 to-black/50" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_65%_55%_at_50%_42%,rgba(0,0,0,0.38)_0%,transparent_100%)]" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors duration-300" />
            </div>

            <div className="relative z-20 w-full max-w-3xl mx-auto text-center space-y-2 sm:space-y-4">
              <h1 className="text-2xl sm:text-4xl md:text-[42px] font-black tracking-tight text-white leading-snug sm:leading-tight px-2 break-words [text-shadow:0_2px_14px_rgba(0,0,0,0.6),0_1px_3px_rgba(0,0,0,0.8)]">
                {heroHeading}
              </h1>

              <p className="text-xs sm:text-[15px] text-white/95 max-w-lg mx-auto leading-relaxed px-2 font-semibold [text-shadow:0_1px_10px_rgba(0,0,0,0.7),0_1px_2px_rgba(0,0,0,0.85)]">
                {heroSubheading}
              </p>

              {/* Flat Unified Search Capsule — Hairline-Divided (No Box-in-Box) */}
              <div className="pt-2 sm:pt-3 px-1 hidden md:block">
                <div className="bg-[#FBFBFC] dark:bg-[#171920] rounded-full p-1.5 shadow-[0_12px_36px_rgba(0,0,0,0.24)] border border-white/50 dark:border-white/[0.08] max-w-2xl mx-auto flex items-center gap-1.5 transition-all focus-within:ring-2 focus-within:ring-[#0066CC]/30">
                  
                  {/* Keyword Input with Google-style Smart Autocomplete (Right side in RTL) */}
                  <div className="relative flex-1 flex items-center gap-2 h-10 px-3 min-w-0">
                    <span className="flex h-4 w-4 items-center justify-center shrink-0 text-[#86868B] pointer-events-none">
                      <Search size={15} strokeWidth={2} className="block" />
                    </span>
                    <input
                      type="text"
                      placeholder={currentT.searchPlaceholder}
                      value={searchDraft}
                      onFocus={() => {
                        setHeroSearchFocused(true);
                        setHeroCityOpen(false);
                        setHighlightedSuggestionIndex(-1);
                      }}
                      onBlur={() => setTimeout(() => {
                        setHeroSearchFocused(false);
                        setHighlightedSuggestionIndex(-1);
                      }, 180)}
                      onChange={(e) => handleSearchDraftChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          if (searchSuggestions.length > 0) {
                            setHeroSearchFocused(true);
                            setHighlightedSuggestionIndex((prev) =>
                              prev + 1 < searchSuggestions.length ? prev + 1 : 0
                            );
                          }
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          if (searchSuggestions.length > 0) {
                            setHeroSearchFocused(true);
                            setHighlightedSuggestionIndex((prev) =>
                              prev > 0 ? prev - 1 : searchSuggestions.length - 1
                            );
                          }
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          if (highlightedSuggestionIndex >= 0 && searchSuggestions[highlightedSuggestionIndex]) {
                            handleCommitSearch(searchSuggestions[highlightedSuggestionIndex].label);
                          } else {
                            handleHeroSearchSubmit();
                          }
                        } else if (e.key === 'Escape') {
                          setHeroSearchFocused(false);
                          setHighlightedSuggestionIndex(-1);
                        }
                      }}
                      className="w-full h-full bg-transparent border-0 text-xs font-medium leading-normal text-[#1D1D1F] dark:text-[#F5F5F7] placeholder-[#86868B] focus:outline-none text-right min-w-0"
                    />
                    {searchDraft && (
                      <button
                        type="button"
                        onClick={handleClearSearch}
                        className="flex h-6 w-6 items-center justify-center rounded-full text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-white cursor-pointer transition-colors shrink-0"
                        aria-label="پاک کردن جستجو"
                      >
                        <X size={14} strokeWidth={2} className="block" />
                      </button>
                    )}

                    {heroSearchFocused && searchDraft.trim() && searchSuggestions.length > 0 && (
                      <div className="absolute inset-x-0 top-full mt-2.5 bg-[#FBFBFC] dark:bg-[#171920] border border-[#ECEFF4] dark:border-white/[0.08] rounded-2xl shadow-[0_18px_45px_rgba(15,23,42,0.16)] dark:shadow-[0_18px_45px_rgba(0,0,0,0.55)] p-1.5 z-50 space-y-0.5 text-right">
                        {searchSuggestions.map((item, idx) => {
                          const isHighlighted = idx === highlightedSuggestionIndex;
                          return (
                            <button
                              key={`${item.label}-${idx}`}
                              type="button"
                              onMouseEnter={() => setHighlightedSuggestionIndex(idx)}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleCommitSearch(item.label);
                              }}
                              className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl transition-colors cursor-pointer ${
                                isHighlighted
                                  ? 'bg-[#0066CC]/10 dark:bg-[#0066CC]/20 text-[#0066CC] dark:text-[#58A6FF]'
                                  : 'hover:bg-[#F5F5F7] dark:hover:bg-white/[0.06] text-[#1D1D1F] dark:text-white'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <Search size={14} strokeWidth={2} className={`block shrink-0 ${isHighlighted ? 'text-[#0066CC] dark:text-[#58A6FF]' : 'text-[#86868B]'}`} />
                                <span className="text-xs font-semibold leading-none truncate">{item.label}</span>
                              </div>
                              <span className="text-[10px] font-bold leading-none px-2 py-1 rounded-full bg-[#F5F5F7] dark:bg-white/[0.06] text-[#6E6E73] dark:text-[#98989F] shrink-0">
                                {item.badge}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Custom Modern City Selector Popover (Unified Brand Blue Pill on Desktop) */}
                  <div ref={heroCityRef} className="relative flex items-center h-10 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setHeroCityOpen((prev) => {
                          const next = !prev;
                          if (next) setHeroSearchFocused(false);
                          return next;
                        });
                      }}
                      aria-expanded={heroCityOpen}
                      aria-haspopup="listbox"
                      aria-label="انتخاب شهر"
                      className={`inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-full text-[13.5px] font-semibold leading-none text-[#FBFBFC] transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.95] cursor-pointer select-none shadow-xs ${
                        heroCityOpen
                          ? 'bg-[#0055AA] ring-2 ring-[#0066CC]/30'
                          : 'bg-[#0066CC] hover:bg-[#0055AA]'
                      }`}
                    >
                      <span className="flex h-4 w-4 items-center justify-center shrink-0 text-white/95">
                        <MapPin size={15} strokeWidth={2} className="block" />
                      </span>
                      <span className="truncate max-w-[110px] leading-none">
                        {availableCities.find(c => c.id === selectedCity)?.fa || 'همه شهرها'}
                      </span>
                      <span className="flex h-4 w-4 items-center justify-center shrink-0 text-white/85">
                        <ChevronDown size={14} strokeWidth={2} className={`block transition-transform duration-200 ${heroCityOpen ? 'rotate-180' : ''}`} />
                      </span>
                    </button>

                    {heroCityOpen && (
                      <div
                        role="listbox"
                        aria-label="فهرست شهرها"
                        className="absolute end-0 top-full mt-2.5 w-72 sm:w-80 rounded-2xl bg-white dark:bg-[#161720] border border-[#ECEFF4] dark:border-white/[0.08] shadow-[0_18px_45px_rgba(0,0,0,0.12)] dark:shadow-[0_22px_55px_rgba(0,0,0,0.65)] p-2 z-50 flex flex-col gap-1 text-right animate-in fade-in zoom-in-95 duration-150"
                        dir="rtl"
                      >
                        <div className="max-h-72 overflow-y-auto custom-scrollbar flex flex-col gap-1 pr-0.5">
                          {availableCities.map((c) => {
                            const isSelected = selectedCity === c.id;
                            return (
                              <button
                                key={c.id}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                onClick={() => {
                                  handleCityChange(c.id);
                                  setHeroCityOpen(false);
                                }}
                                  className={`w-full flex items-center justify-between py-2.5 px-3.5 rounded-xl transition-colors cursor-pointer text-right ${
                                    isSelected
                                      ? 'bg-[#EAF2FB] text-[#0066CC] dark:bg-[#0066CC]/20 dark:text-[#58A6FF] font-semibold'
                                      : 'text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-[#F5F5F7] dark:hover:bg-white/[0.06] active:bg-[#0066CC]/15 font-medium'
                                  }`}
                                >
                                  <span className="text-[14.5px] leading-relaxed truncate">
                                    {c.fa}
                                  </span>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {c.id !== 'all' && (
                                      <span className="text-[12px] font-normal text-[#86868B] dark:text-[#8E8E93] leading-none" dir="ltr">
                                        {c.id}
                                      </span>
                                    )}
                                    {isSelected && (
                                      <Check size={16} strokeWidth={2.2} className="text-[#0066CC] dark:text-[#58A6FF] shrink-0" />
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Dedicated Search Action Button (Google model: executes search) */}
                  <button
                    type="button"
                    onClick={handleHeroSearchSubmit}
                    className="inline-flex items-center justify-center gap-1.5 h-10 px-5 rounded-full bg-[#0066CC] hover:bg-[#0055AA] text-white text-xs font-bold transition-all duration-200 active:scale-95 cursor-pointer shadow-xs select-none shrink-0"
                    aria-label="جستجو در آگهی‌ها"
                  >
                    <Search size={14} strokeWidth={2.5} className="block" />
                    <span>جستجو</span>
                  </button>

                </div>
              </div>

            </div>
          </div>
        </section>

      {/* Horizontal Sticky Category Strip with Apple-feel sliding pill (Desktop Only) */}
      <div className="hidden md:block sticky top-16 z-30 bg-[#FBFBFC]/90 dark:bg-[#121317]/90 backdrop-blur-md py-2.5 sm:py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 overflow-x-auto no-scrollbar scroll-smooth">
        <div
          ref={categoryStripRef}
          className="relative flex items-center gap-1 w-max mx-auto bg-[#FBFBFC] dark:bg-[#171920] p-1 rounded-full border border-[#ECEFF4] dark:border-white/[0.06] shadow-none"
        >
          {pillStyle.ready && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-1 bottom-1 rounded-full bg-[#0066CC] transition-[transform,width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform"
              style={{
                width: `${pillStyle.width}px`,
                transform: `translate3d(${pillStyle.left}px, 0, 0)`,
                left: 0,
              }}
            />
          )}
          {CATEGORIES.map(cat => {
            const isActive = selectedCategory === cat.id;
            const CatIcon = CATEGORY_ICONS[cat.id] || Tag;
            return (
              <button
                key={cat.id}
                ref={(el) => { if (el) categoryPillRefs.current[cat.id] = el; }}
                type="button"
                onClick={() => handleCategoryChange(cat.id)}
                className={`relative z-10 h-8 inline-flex items-center justify-center gap-1.5 px-3.5 rounded-full text-xs font-bold leading-none whitespace-nowrap transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer shrink-0 active:scale-[0.94] select-none ${
                  isActive
                    ? (pillStyle.ready ? 'text-[#FBFBFC]' : 'bg-[#0066CC] text-[#FBFBFC] shadow-2xs')
                    : 'text-[#515154] hover:text-[#1D1D1F] hover:bg-[#F5F5F7]/80 dark:text-[#A1A1A6] dark:hover:text-[#F5F5F7] dark:hover:bg-white/[0.06]'
                }`}
              >
                <span className="flex h-4 w-4 items-center justify-center shrink-0">
                  <CatIcon size={14} strokeWidth={2} className={`block transition-colors duration-200 ${isActive ? 'text-[#FBFBFC]' : 'text-[#86868B] dark:text-[#98989F]'}`} />
                </span>
                <span className="leading-none">{cat.fa}</span>
              </button>
            );
          })}
        </div>
        </div>
      </div>

      

      {/* Main Content Area */}
      <main
        onTouchStart={handleFeedTouchStart}
        onTouchEnd={handleFeedTouchEnd}
        className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 overflow-visible"
      >
        <div key={selectedCategory} className="space-y-6 sm:space-y-8 animate-in fade-in duration-200 ease-out">
        
        {/* VIP / Featured Section */}
        {featuredAds.length > 0 && (
          <section className="space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-base sm:text-lg font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
                {currentT.featuredAds}
              </h2>
              <span className="text-[11px] sm:text-xs font-medium text-[#6E6E73] dark:text-[#A1A1A6] tabular-nums">
                {featuredAds.length.toLocaleString('fa-IR')} آگهی
              </span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-5">
              {featuredAds.map((ad, idx) => (
                <AdCard
                  key={ad.id}
                  ad={ad}
                  lang={lang}
                  onSelect={handleSelectAd}
                  priority={idx < 4}
                />
              ))}
            </div>
          </section>
        )}

        {/* Regular Stream / All Ads */}
        <section ref={feedSectionRef} className="space-y-3 sm:space-y-4 scroll-mt-28">
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
                {currentT.recentAds}
              </h2>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#FBFBFC] dark:bg-[#171920] border border-[#ECEFF4] dark:border-white/[0.06] text-[#515154] dark:text-[#A1A1A6] text-[11px] font-bold tabular-nums">
                {(searchQuery.trim() ? sortedAds.length : totalAdsCount).toLocaleString('fa-IR')} آگهی
              </span>
              {selectedCategory !== 'all' && (
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#EAF2FB] dark:bg-[#0066CC]/20 text-[#0066CC] dark:text-[#58A6FF] text-xs font-semibold border border-[#CDE0F5] dark:border-[#0066CC]/30">
                  <span>{CATEGORIES.find(c => c.id === selectedCategory)?.fa}</span>
                  <button
                    type="button"
                    onClick={() => handleCategoryChange('all')}
                    className="hover:text-[#004C99] dark:hover:text-white p-0.5 cursor-pointer"
                    title="حذف فیلتر دسته"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
              {selectedCity !== 'all' && (
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#EAF2FB] dark:bg-[#0066CC]/20 text-[#0066CC] dark:text-[#58A6FF] text-xs font-semibold border border-[#CDE0F5] dark:border-[#0066CC]/30">
                  <MapPin size={11} className="shrink-0" />
                  <span>{availableCities.find(c => c.id === selectedCity)?.fa || selectedCity}</span>
                  <button
                    type="button"
                    onClick={() => handleCityChange('all')}
                    className="hover:text-[#004C99] dark:hover:text-white p-0.5 cursor-pointer"
                    title="حذف فیلتر شهر"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
              {searchQuery.trim() && (
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#F5F5F7] dark:bg-white/[0.06] text-[#1D1D1F] dark:text-[#F5F5F7] text-xs font-semibold border border-[#ECEFF4] dark:border-white/[0.08]">
                  <span className="truncate max-w-[140px]">«{searchQuery.trim()}»</span>
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-white p-0.5 cursor-pointer"
                    title="حذف جستجو"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
              {(selectedCategory !== 'all' || selectedCity !== 'all' || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    handleCategoryChange('all');
                    handleCityChange('all');
                    handleClearSearch();
                  }}
                  className="text-xs font-semibold text-[#515154] hover:text-[#1D1D1F] dark:text-[#A1A1A6] dark:hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw size={12} />
                  <span>پاک‌سازی</span>
                </button>
              )}
            </div>

            {/* Compact Sort Trigger — Shows active sort option */}
            <div ref={sortMenuRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setSortMenuOpen((v) => !v)}
                aria-expanded={sortMenuOpen}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-bold transition-colors active:scale-95 cursor-pointer select-none ${
                  sortBy
                    ? 'bg-[#EAF2FB] border-[#CDE0F5] text-[#0066CC] dark:bg-[#0066CC]/20 dark:border-[#0066CC]/30 dark:text-[#58A6FF]'
                    : 'bg-[#FBFBFC] dark:bg-[#171920] hover:bg-[#ECECEF] dark:hover:bg-white/[0.06] border-[#ECEFF4] dark:border-white/[0.06] text-[#1D1D1F] dark:text-[#F5F5F7]'
                }`}
              >
                <span>{SORT_LABELS[sortBy] || 'مرتب‌سازی'}</span>
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${sortMenuOpen ? 'rotate-180' : ''} ${sortBy ? 'text-[#0066CC] dark:text-[#58A6FF]' : 'text-[#86868B]'}`}
                />
              </button>

              {sortMenuOpen && (
                <div className="absolute end-0 top-full mt-1.5 w-44 rounded-2xl bg-[#FBFBFC] dark:bg-[#171920] border border-[#ECEFF4] dark:border-white/[0.08] shadow-[0_14px_36px_rgba(29,29,31,0.12)] dark:shadow-[0_14px_36px_rgba(0,0,0,0.55)] p-1.5 z-30 animate-in fade-in zoom-in-95 duration-150 space-y-0.5">
                  {[
                    { id: 'newest', label: 'جدیدترین' },
                    { id: 'most_viewed', label: 'پربازدیدترین' },
                    { id: 'price_asc', label: 'ارزان‌ترین' },
                    { id: 'price_desc', label: 'گران‌ترین' },
                  ].map((s) => {
                    const isSelected = sortBy === s.id || (!sortBy && s.id === 'newest');
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSortBy(s.id === 'newest' && sortBy === 'newest' ? null : s.id);
                          setSortMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-right text-xs font-bold transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#EAF2FB] text-[#0066CC] dark:bg-[#0066CC]/20 dark:text-[#58A6FF]'
                            : 'text-[#515154] dark:text-[#C7C7CC] hover:bg-[#F5F5F7] dark:hover:bg-white/[0.06] hover:text-[#1D1D1F] dark:hover:text-white'
                        }`}
                      >
                        <span>{s.label}</span>
                        {isSelected && <Check size={14} strokeWidth={2.5} className="text-[#0066CC] dark:text-[#58A6FF] shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {loading ? (
            /* Loading skeletons */
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-5">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <div key={i} className="h-56 sm:h-64 rounded-xl sm:rounded-2xl bg-[#E5E5EA]/70 dark:bg-white/[0.06] animate-pulse" />
              ))}
            </div>
          ) : sortedAds.length === 0 ? (
            /* Empty State */
            <div className="rounded-2xl border border-dashed border-[#D2D2D7] dark:border-white/[0.1] bg-[#FBFBFC] dark:bg-[#171920] p-10 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#ECECEF] dark:bg-white/[0.06] text-[#6E6E73] dark:text-[#A1A1A6]">
                <Search size={20} />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {currentT.noAdsFound}
                </h3>
                <p className="text-xs text-[#6E6E73] dark:text-[#A1A1A6]">
                  فیلترها را تغییر دهید یا اولین آگهی را ثبت کنید.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPostAdOpen(true)}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#0066CC] hover:bg-[#0055AA] text-[#FBFBFC] font-bold text-xs shadow-xs transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.95] cursor-pointer"
              >
                <PlusCircle size={14} />
                <span>{currentT.postAdBtn}</span>
              </button>
            </div>
          ) : (
            /* Ads Grid with Scroll-Triggered Pagination */
            <>
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-5">
                {sortedAds.map((ad, idx) => (
                  <AdCard
                    key={ad.id}
                    ad={ad}
                    lang={lang}
                    onSelect={handleSelectAd}
                    priority={idx < 4 && featuredAds.length === 0}
                  />
                ))}
              </div>
              {loadingMore && (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-5 pt-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={`more-sk-${i}`} className="h-56 sm:h-64 rounded-xl sm:rounded-2xl bg-[#E5E5EA]/70 dark:bg-white/[0.06] animate-pulse" />
                  ))}
                </div>
              )}
              {hasMoreAds && (
                <div ref={feedSentinelRef} className="pt-4 pb-2 flex justify-center">
                  <button
                    type="button"
                    disabled={loadingMore}
                    onClick={loadMoreAds}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#FBFBFC] hover:bg-[#ECECEF] dark:bg-[#171920] dark:hover:bg-white/[0.08] border border-[#E5E5EA] dark:border-white/[0.08] text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7] shadow-2xs transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
                  >
                    {loadingMore
                      ? 'در حال بارگذاری...'
                      : `مشاهده آگهی‌های بیشتر${totalAdsCount > sortedAds.length ? ` (${totalAdsCount - sortedAds.length} باقی‌مانده)` : ''}`}
                  </button>
                </div>
              )}
            </>
          )}

        </section>
        </div>
      </main>
        </>
      )}

      {/* Community Footer */}
      <Footer
        siteName={siteName}
        logoUrl={logoUrl}
        brandingReady={brandingReady}
        socialLinks={socialLinks}
        selectedCountryObj={currentCountryObj}
        onOpenCountryModal={handleOpenCountryModal}
        onSelectCategory={handleCategoryChange}
        onOpenPostAd={() => handleOpenPostAd('bostad')}
        onOpenManageAd={handleOpenManageAd}
        onOpenLegal={setLegalModalTab}
        onOpenPodcast={handleOpenPodcast}
        onOpenWebsiteBuilder={handleOpenWebsiteBuilder}
      />

      {/* Mobile Sticky Bottom Menu for Collections & Quick Actions */}
      <MobileBottomNav
        selectedCategory={selectedCategory}
        selectedCountry={selectedCountry}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onSelectCategory={handleCategoryChange}
        onOpenCountryModal={handleOpenCountryModal}
        onOpenPostAd={() => handleOpenPostAd('bostad')}
        onOpenManageAd={handleOpenManageAd}
        onOpenLegal={setLegalModalTab}
        onOpenPodcast={handleOpenPodcast}
        onOpenWebsiteBuilder={handleOpenWebsiteBuilder}
      />

      <Suspense fallback={null}>
        {/* MODAL: Stripe Payment for VIP Ad Promotion */}
        {paymentAd && (
          <PaymentModal
            ad={paymentAd}
            stripeSettings={stripeSettings}
            countries={portalCountries}
            selectedCountry={selectedCountry}
            onClose={handleClosePayment}
          />
        )}

        {/* MODAL 2: Post Ad */}
        {postAdOpen && (
          <PostAdModal
            lang={lang}
            initialCategory={postAdCategory}
            selectedCountry={selectedCountry}
            countries={portalCountries}
            lifecycleSettings={lifecycleSettings}
            turnstileSettings={turnstileSettings}
            googleMapsSettings={googleMapsSettings}
            stripeSettings={stripeSettings}
            onClose={handleClosePostAd}
            onOpenManageExisting={(refNum) => {
              handleClosePostAd();
              handleOpenManageAd(refNum);
            }}
            onProceedToVip={(targetAd) => {
              handleClosePostAd();
              handleOpenPayment(targetAd);
            }}
            onCreated={(newAd, wantVip) => {
              fetchAds();
              if (!wantVip) {
                showToast(`آگهی ثبت شد (کد: ${newAd.reference_number}).`);
              }
            }}
          />
        )}

        {/* MODAL 3: Manage / Boost / Delete Ad with Ref & PIN */}
        {manageAdOpen && (
          <ManageAdModal
            lang={lang}
            initialRef={manageInitialRef}
            lifecycleSettings={lifecycleSettings}
            onClose={handleCloseManageAd}
            onOpenPromote={handleOpenPayment}
            onDeleted={(deletedId) => {
              setAds(ads.filter(a => a.id !== deletedId));
              showToast('آگهی حذف شد.');
            }}
            onUpdated={(updatedAd) => {
              setAds(ads.map(a => a.id === updatedAd.id ? updatedAd : a));
              showToast('آگهی به‌روزرسانی شد.');
            }}
            onBoosted={(boostedAd) => {
              setAds((prev) => prev.map((a) => (a.id === boostedAd.id ? boostedAd : a)));
              fetchAds();
              showToast('آگهی بوست شد و به صدر فهرست رفت.');
            }}
          />
        )}
        {/* MODAL 4: EU GDPR Privacy, Cookie Policy & Cookie Settings */}
        {legalModalTab && (
          <LegalModal
            isOpen={Boolean(legalModalTab)}
            initialTab={legalModalTab}
            siteName={siteName}
            onClose={() => setLegalModalTab(null)}
            onConsentSaved={setGdprConsent}
          />
        )}
      </Suspense>

    </div>
  );
}
