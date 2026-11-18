import React, { useState, useEffect, useMemo, useRef, useDeferredValue, lazy, Suspense } from 'react';
import { 
  Search, 
  MapPin, 
  PlusCircle, 
  CheckCircle2, 
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
import { isSafeHttpUrl } from './lib/supabase';
import { publicApi } from './lib/apiClient';
import { COUNTRIES, CATEGORIES, mergePortalCountries, t } from './lib/translations';
import { getGdprConsent } from './lib/gdpr';
import { matchesSmartSearch, getSearchSuggestions } from './lib/smartSearch';

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



export default function App() {
  const lang = 'fa'; // Complete Persian Language
  const currentT = t.fa;

  // Ads state
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);

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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const cat = params.get('cat');
      if (cat) return cat;
    } catch {}
    return 'all';
  });
  const [selectedCity, setSelectedCity] = useState('all');

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
  const [siteName, setSiteName] = useState('لینک شو');
  const [logoUrl, setLogoUrl] = useState('');
  const [socialLinks, setSocialLinks] = useState({
    instagram: 'https://instagram.com',
    telegram: 'https://t.me',
    whatsapp: '',
    youtube: '',
    linkedin: '',
    email: ''
  });
  const [turnstileSettings, setTurnstileSettings] = useState({ enabled: true, mode: 'test', siteKey: '' });
  const [analyticsSettings, setAnalyticsSettings] = useState({ enabled: false, measurementId: '' });
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
          setSiteName(isLegacyName ? 'لینک شو' : rawName);
          if (branding.logoUrl && isSafeHttpUrl(branding.logoUrl)) setLogoUrl(branding.logoUrl);
          setSocialLinks({
            instagram: branding.socialInstagram ?? 'https://instagram.com',
            telegram: branding.socialTelegram || branding.supportTelegram || 'https://t.me',
            whatsapp: branding.socialWhatsapp || branding.supportPhone || '',
            youtube: branding.socialYoutube || '',
            linkedin: branding.socialLinkedin || '',
            email: branding.supportEmail || ''
          });
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
            vipBadgeText: stripe.vipBadgeText
          });
        }
        if (settings.turnstile_settings) {
          setTurnstileSettings(prev => ({ ...prev, ...settings.turnstile_settings }));
        }
        if (settings.analytics_settings) {
          setAnalyticsSettings(prev => ({ ...prev, ...settings.analytics_settings }));
        }
        if (settings.podcast_settings) {
          setPodcastSettings(settings.podcast_settings);
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Load Google Analytics (GA4) dynamically when enabled in Admin & user consented under EU GDPR
  useEffect(() => {
    const id = (analyticsSettings?.measurementId || '').trim().toUpperCase();
    if (!analyticsSettings?.enabled || !gdprConsent?.analytics || !/^G-[A-Z0-9]{4,}$/.test(id)) return;

    if (!window.dataLayer) window.dataLayer = [];
    if (!window.gtag) {
      window.gtag = function gtag() {
        window.dataLayer.push(arguments);
      };
    }

    const scriptId = `ga4-script-${id}`;
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
      document.head.appendChild(script);
      window.gtag('js', new Date());
    }

    window.gtag('config', id, {
      page_path: window.location.pathname + window.location.search,
      page_title: document.title,
    });
  }, [analyticsSettings.enabled, analyticsSettings.measurementId, gdprConsent?.analytics, selectedCountry, selectedCategory, activeAdDetail?.id]);

  // Dynamic Country SEO (Document Title + Meta Description + Keywords + OpenGraph + Twitter)
  useEffect(() => {
    const cObj = portalCountries.find(c => c.id === selectedCountry) || portalCountries[0] || COUNTRIES[0];
    const cName = cObj?.nameFa || 'سوئد';
    const activeSeo = seoSettings[selectedCountry] || {
      title: `${siteName} ${cName} | نیازمندی‌ها، مسکن، کاریابی و خدمات فارسی‌زبانان در ${cName}`,
      description: `${siteName} — محل رشد کسب و کار فارسی‌زبانان و مرجع آگهی‌های رایگان مسکن، رستوران، کاریابی و خدمات در سراسر ${cName}.`,
      keywords: `${siteName}, نیازمندیهای ${cName}, فارسی زبانان ${cName}, مسکن ${cName}, کار در ${cName}`,
    };

    const pageTitle = activeAdDetail
      ? `${activeAdDetail.title_fa || activeAdDetail.title} | ${siteName}`
      : activeSeo.title;
    const pageDesc = activeAdDetail
      ? (activeAdDetail.description || '').slice(0, 155)
      : activeSeo.description;

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

    setMeta('meta[name="description"]', 'name=description', pageDesc);
    setMeta('meta[name="keywords"]', 'name=keywords', activeSeo.keywords);
    setMeta('meta[property="og:site_name"]', 'property=og:site_name', siteName);
    setMeta('meta[property="og:type"]', 'property=og:type', activeAdDetail ? 'article' : 'website');
    setMeta('meta[property="og:url"]', 'property=og:url', window.location.href);
    setMeta('meta[property="og:title"]', 'property=og:title', activeSeo.ogTitle || pageTitle);
    setMeta('meta[property="og:description"]', 'property=og:description', activeSeo.ogDescription || pageDesc);
    if (activeAdDetail?.images?.[0]) {
      setMeta('meta[property="og:image"]', 'property=og:image', activeAdDetail.images[0]);
      setMeta('meta[name="twitter:image"]', 'name=twitter:image', activeAdDetail.images[0]);
    }
    setMeta('meta[name="twitter:title"]', 'name=twitter:title', activeSeo.ogTitle || pageTitle);
    setMeta('meta[name="twitter:description"]', 'name=twitter:description', activeSeo.ogDescription || pageDesc);

    let canonicalEl = document.querySelector('link[rel="canonical"]');
    if (!canonicalEl) {
      canonicalEl = document.createElement('link');
      canonicalEl.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalEl);
    }
    canonicalEl.setAttribute('href', window.location.href);
  }, [selectedCountry, seoSettings, activeAdDetail, siteName]);

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

  // Fetch ads from Secure Public API
  const fetchAds = async () => {
    setLoading(true);
    try {
      const data = await publicApi.fetchAds();
      setAds(data || []);
    } catch (err) {
      console.error('Error fetching ads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAds();
  }, []);

  // Immediate ad check on mount for direct link or browser refresh
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const adParam = params.get('ad');
      if (adParam) {
        publicApi.fetchAdByParam(adParam).then((data) => {
          if (data) setActiveAdDetail(data);
        });
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
        setCountryModalOpen(modal === 'country');
        setPodcastOpen(params.get('page') === 'podcast');
        setWebsiteBuilderOpen(params.get('page') === 'website-builder');
        if (modal !== 'pay') setPaymentAd(null);

        // 2. Ad Detail Page
        const adParam = params.get('ad');
        if (adParam) {
          const found = ads.find(a => a.reference_number === adParam || a.id === adParam);
          if (found) {
            setActiveAdDetail(found);
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
  }, [ads, selectedCategory]);

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

  const handleOpenManageAd = () => {
    setManageAdOpen(true);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('modal', 'manage');
      window.history.pushState({ modal: 'manage' }, '', url.toString());
    } catch {}
  };

  const handleCloseManageAd = () => {
    setManageAdOpen(false);
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('modal') === 'manage') {
        url.searchParams.delete('modal');
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
    const el = categoryPillRefs.current[selectedCategory];
    if (!el) return;
    const updatePill = () => {
      setPillStyle({ left: el.offsetLeft, width: el.offsetWidth, ready: true });
    };
    updatePill();
    try {
      el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    } catch {}
    window.addEventListener('resize', updatePill);
    return () => window.removeEventListener('resize', updatePill);
  }, [selectedCategory, activeAdDetail]);

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

  // When clicking an ad, open full page view and update URL history
  const handleSelectAd = (ad) => {
    setActiveAdDetail(ad);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('ad', ad.reference_number || ad.id);
      window.history.pushState({ view: 'ad', id: ad.reference_number || ad.id }, '', url.toString());
    } catch {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
    publicApi.incrementView(ad.id, ad.views_count);
  };

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
  const clearAdDetailForFilter = () => {
    if (!activeAdDetail) return;
    setActiveAdDetail(null);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('ad');
      window.history.replaceState({}, '', url.toString());
    } catch {}
  };

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    if (val && activeAdDetail) {
      clearAdDetailForFilter();
    }
  };

  const handleCityChange = (cityVal) => {
    setSelectedCity(cityVal);
    clearAdDetailForFilter();
  };

  // Active country details (from merged dynamic countries list)
  const currentCountryObj = portalCountries.find(c => c.id === selectedCountry) || portalCountries[0] || COUNTRIES[0];

  // Dynamic available cities for current country
  const availableCities = currentCountryObj.cities;

  // Dynamic Hero Background Photo (Per Country — customizable from Admin Panel)
  const activeHero = {
    image: currentCountryObj.heroImage || '/images/cities/stockholm.jpg',
    cityFa: currentCountryObj.nameFa,
    cityEn: currentCountryObj.nameNative || currentCountryObj.nameFa
  };

  // Dynamic Hero Titles based on selected country & synced SEO settings
  const activeCountrySeo = seoSettings[selectedCountry];
  const heroHeading = activeCountrySeo?.heroHeading || `نیازمندی‌های فارسی‌زبانان ${currentCountryObj.nameFa}`;
  const heroSubheading = activeCountrySeo?.heroSubheading || `مسکن، رستوران، خدمات و کاریابی در سراسر ${currentCountryObj.nameFa}`;

  const [sortBy, setSortBy] = useState(null); // null | 'newest' | 'most_viewed' | 'price_asc' | 'price_desc'

  useEffect(() => {
    if (!sortMenuOpen) return;
    const handleOutside = (e) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target)) {
        setSortMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [sortMenuOpen]);

  // Filter ads safely with zero-lag deferred smart search (typo-tolerant + Persian/Arabic normalization)
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [heroSearchFocused, setHeroSearchFocused] = useState(false);

  const countryAds = useMemo(
    () => ads.filter(ad => ad.country === selectedCountry || (!ad.country && selectedCountry === 'se')),
    [ads, selectedCountry]
  );

  const searchSuggestions = useMemo(
    () => getSearchSuggestions(deferredSearchQuery, { ads: countryAds, cities: availableCities, categories: CATEGORIES }),
    [deferredSearchQuery, countryAds, availableCities]
  );

  const filteredAds = useMemo(() => {
    return countryAds.filter(ad => {
      const matchCat = selectedCategory === 'all' || ad.category === selectedCategory;
      const matchCity = selectedCity === 'all' || ad.city === selectedCity;
      const matchSearch = matchesSmartSearch(ad, deferredSearchQuery);
      return matchCat && matchCity && matchSearch;
    });
  }, [countryAds, selectedCategory, selectedCity, deferredSearchQuery]);

  // Sort ads according to selected sort option
  const sortedAds = useMemo(() => {
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
    return copy;
  }, [filteredAds, sortBy]);

  // Featured ads subset
  const featuredAds = useMemo(() => filteredAds.filter(a => a.is_featured), [filteredAds]);

  return (
    <div className={`min-h-screen flex flex-col bg-[#F5F5F7] text-[#1D1D1F] overflow-x-clip w-full max-w-full pb-16 md:pb-0 ${lang === 'fa' ? 'font-vazir' : ''}`}>

      {/* Geolocation Country Detection Pop-Up Modal */}
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

      {/* Top Navbar */}
      <Navbar
        siteName={siteName}
        logoUrl={logoUrl}
        selectedCity={selectedCity}
        onSelectCity={handleCityChange}
        availableCities={availableCities}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
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

      {/* Floating Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-5 end-5 z-50 flex items-center gap-2 rounded-xl bg-stone-900 text-white px-3.5 py-2.5 shadow-lg border border-stone-800 text-xs font-medium animate-in slide-in-from-bottom-2 duration-150">
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
            turnstileSettings={turnstileSettings}
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
          <section className={`w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 sm:pt-5 pb-1 animate-in fade-in duration-200 ${selectedCategory !== 'all' ? 'hidden md:block' : 'block'}`}>
          <div className="relative min-h-[200px] sm:min-h-[300px] md:min-h-[350px] rounded-2xl sm:rounded-3xl flex flex-col items-center justify-center px-4 sm:px-8 py-8 sm:py-14 md:py-16">
            
            {/* Rounded Architectural Cityscape Backdrop */}
            <div className="absolute inset-0 z-0 rounded-2xl sm:rounded-3xl overflow-hidden border border-[#E5E5EA] bg-[#1D1D1F] pointer-events-none select-none">
              <img
                key={activeHero.image}
                src={activeHero.image}
                alt={activeHero.cityFa}
                className="w-full h-full object-cover object-center opacity-90 transition-all duration-700 ease-out"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/25 to-black/55" />
            </div>

            <div className="relative z-10 w-full max-w-3xl mx-auto text-center space-y-2.5 sm:space-y-4">
              <h1 className="text-2xl sm:text-4xl md:text-[42px] font-black tracking-tight text-white leading-snug sm:leading-tight px-1 break-words drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)]">
                {heroHeading}
              </h1>

              <p className="text-xs sm:text-[15px] text-white/90 max-w-lg mx-auto leading-relaxed px-2 font-medium drop-shadow-[0_1px_4px_rgba(0,0,0,0.45)]">
                {heroSubheading}
              </p>

              {/* Flat Unified Search Capsule — Hairline-Divided (No Box-in-Box) */}
              <div className="pt-2 sm:pt-3 px-1 hidden md:block">
                <div className="bg-[#FBFBFC] rounded-full p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.18)] border border-white/40 max-w-2xl mx-auto flex items-center gap-1.5 transition-all">
                  
                  {/* Keyword Input with Google-style Smart Autocomplete (Right side in RTL) */}
                  <div className="relative flex-1 flex items-center gap-2 h-10 px-3 min-w-0">
                    <span className="flex h-4 w-4 items-center justify-center shrink-0 text-[#86868B] pointer-events-none">
                      <Search size={15} strokeWidth={2} className="block" />
                    </span>
                    <input
                      type="text"
                      placeholder={currentT.searchPlaceholder}
                      value={searchQuery}
                      onFocus={() => setHeroSearchFocused(true)}
                      onBlur={() => setTimeout(() => setHeroSearchFocused(false), 150)}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full h-full bg-transparent border-0 text-xs font-medium leading-none text-[#1D1D1F] placeholder-[#86868B] focus:outline-none text-right min-w-0"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="flex h-6 w-6 items-center justify-center rounded-full text-[#86868B] hover:text-[#1D1D1F] cursor-pointer transition-colors shrink-0"
                        aria-label="پاک کردن جستجو"
                      >
                        <X size={14} strokeWidth={2} className="block" />
                      </button>
                    )}

                    {heroSearchFocused && searchQuery.trim() && searchSuggestions.length > 0 && (
                      <div className="absolute inset-x-0 top-full mt-2.5 bg-[#FBFBFC] border border-[#E5E5EA] rounded-2xl shadow-[0_14px_40px_rgba(29,29,31,0.16)] p-1.5 z-50 space-y-0.5 text-right">
                        {searchSuggestions.map((item, idx) => (
                          <button
                            key={`${item.label}-${idx}`}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setSearchQuery(item.label);
                              setHeroSearchFocused(false);
                            }}
                            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl hover:bg-[#F5F5F7] transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Search size={14} strokeWidth={2} className="block text-[#86868B] shrink-0" />
                              <span className="text-xs font-semibold leading-none text-[#1D1D1F] truncate">{item.label}</span>
                            </div>
                            <span className="text-[10px] font-bold leading-none px-2 py-1 rounded-full bg-[#F5F5F7] text-[#6E6E73] shrink-0">
                              {item.badge}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Clean Hairline Divider (No inner box) */}
                  <div className="h-5 w-px bg-[#E5E5EA] shrink-0" />

                  {/* Flat Borderless City Selector (Flex-aligned on exact same baseline) */}
                  <div className="relative flex items-center h-10 px-2.5 shrink-0">
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold leading-none text-[#1D1D1F]">
                      <span className="flex h-4 w-4 items-center justify-center shrink-0 text-[#86868B]">
                        <MapPin size={15} strokeWidth={2} className="block" />
                      </span>
                      <span className="truncate max-w-[96px] leading-none">
                        {availableCities.find(c => c.id === selectedCity)?.fa || 'همه شهرها'}
                      </span>
                      <span className="flex h-4 w-4 items-center justify-center shrink-0 text-[#86868B]">
                        <ChevronDown size={14} strokeWidth={2} className="block" />
                      </span>
                    </div>
                    <select
                      value={selectedCity}
                      onChange={(e) => setSelectedCity(e.target.value)}
                      aria-label="انتخاب شهر"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    >
                      {availableCities.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.fa}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* CTA Button */}
                  <button
                    type="button"
                    className="h-10 px-6 rounded-full bg-[#0066CC] hover:bg-[#0055AA] text-[#FBFBFC] text-xs font-bold leading-none transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.95] inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Search size={15} strokeWidth={2} className="block shrink-0" />
                    <span className="leading-none">{currentT.searchBtn}</span>
                  </button>

                </div>
              </div>

            </div>
          </div>
        </section>

      {/* Horizontal Sticky Category Strip with Apple-feel sliding pill */}
      <div className="sticky top-16 z-30 bg-[#F5F5F7]/90 backdrop-blur-md py-2.5 sm:py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 overflow-x-auto no-scrollbar scroll-smooth">
        <div
          ref={categoryStripRef}
          className="relative flex items-center gap-1 w-max mx-auto bg-[#FBFBFC] p-1 rounded-full border border-[#E5E5EA]"
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
                    : 'text-[#515154] hover:text-[#1D1D1F]'
                }`}
              >
                <span className="flex h-4 w-4 items-center justify-center shrink-0">
                  <CatIcon size={14} strokeWidth={2} className={`block transition-colors duration-200 ${isActive ? 'text-[#FBFBFC]' : 'text-[#86868B]'}`} />
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
        className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 overflow-visible"
      >
        <div key={selectedCategory} className="space-y-6 sm:space-y-8 animate-in fade-in duration-200 ease-out">
        
        {/* VIP / Featured Section */}
        {featuredAds.length > 0 && (
          <section className="space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                {currentT.featuredAds}
              </h2>
              <span className="text-[11px] sm:text-xs font-medium text-slate-500">
                {featuredAds.length} {lang === 'fa' ? 'آگهی' : 'annonser'}
              </span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-5">
              {featuredAds.map(ad => (
                <AdCard
                  key={ad.id}
                  ad={ad}
                  lang={lang}
                  onSelect={handleSelectAd}
                />
              ))}
            </div>
          </section>
        )}

        {/* Regular Stream / All Ads */}
        <section className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-[#1D1D1F] tracking-tight">
                {currentT.recentAds}
              </h2>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#FBFBFC] border border-[#E5E5EA] text-[#515154] text-[11px] font-bold tabular-nums">
                {sortedAds.length} آگهی
              </span>
              {selectedCategory !== 'all' && (
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#EAF2FB] text-[#0066CC] text-xs font-semibold border border-[#CDE0F5]">
                  <span>{CATEGORIES.find(c => c.id === selectedCategory)?.fa}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('all')}
                    className="hover:text-[#004C99] p-0.5 cursor-pointer"
                    title="حذف فیلتر دسته"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
              {(selectedCategory !== 'all' || selectedCity !== 'all' || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('all');
                    setSelectedCity('all');
                    setSearchQuery('');
                  }}
                  className="text-xs font-semibold text-[#515154] hover:text-[#1D1D1F] flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw size={12} />
                  <span>حذف فیلترها</span>
                </button>
              )}
            </div>

            {/* Compact Filter Trigger — Only opens when clicked */}
            <div ref={sortMenuRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setSortMenuOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#FBFBFC] hover:bg-[#ECECEF] border border-[#E5E5EA] text-[#1D1D1F] text-xs font-bold transition-colors active:scale-95 cursor-pointer select-none"
              >
                <span>فیلتر آگهی</span>
                <ChevronDown
                  size={14}
                  className={`text-[#86868B] transition-transform duration-200 ${sortMenuOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {sortMenuOpen && (
                <div className="absolute end-0 top-full mt-1.5 w-40 rounded-2xl bg-[#FBFBFC] border border-[#E5E5EA] shadow-[0_12px_32px_rgba(29,29,31,0.12)] divide-y divide-[#E5E5EA] overflow-hidden z-30 animate-in fade-in zoom-in-95 duration-150">
                  {[
                    { id: 'newest', label: 'جدیدترین' },
                    { id: 'most_viewed', label: 'پربازدیدترین' },
                    { id: 'price_asc', label: 'ارزان‌ترین' },
                    { id: 'price_desc', label: 'گران‌ترین' },
                  ].map((s) => {
                    const isSelected = sortBy === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSortBy(isSelected ? null : s.id);
                          setSortMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 text-right text-xs font-bold transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#F5F5F7] text-[#1D1D1F]'
                            : 'text-[#515154] hover:bg-[#F5F5F7] hover:text-[#1D1D1F]'
                        }`}
                      >
                        <span>{s.label}</span>
                        {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-[#1D1D1F]" />}
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
                <div key={i} className="h-56 sm:h-64 rounded-xl sm:rounded-2xl bg-[#E5E5EA]/70 animate-pulse" />
              ))}
            </div>
          ) : sortedAds.length === 0 ? (
            /* Empty State */
            <div className="rounded-2xl border border-dashed border-[#D2D2D7] bg-[#FBFBFC] p-10 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#ECECEF] text-[#6E6E73]">
                <Search size={20} />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm font-semibold text-[#1D1D1F]">
                  {currentT.noAdsFound}
                </h3>
                <p className="text-xs text-[#6E6E73]">
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
            /* Ads Grid */
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-5">
              {sortedAds.map(ad => (
                <AdCard
                  key={ad.id}
                  ad={ad}
                  lang={lang}
                  onSelect={handleSelectAd}
                />
              ))}
            </div>
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
            price={stripeSettings?.vipPrice || 99}
            currency={stripeSettings?.currency || 'SEK'}
            stripeSettings={stripeSettings}
            countries={portalCountries}
            selectedCountry={selectedCountry}
            onClose={handleClosePayment}
            onSuccess={(promotedAd) => {
              fetchAds();
              if (promotedAd?.country && promotedAd.country !== selectedCountry) {
                setSelectedCountry(promotedAd.country);
              }
              if (activeAdDetail && activeAdDetail.id === promotedAd.id) {
                setActiveAdDetail(promotedAd);
              }
              showToast(`آگهی «${promotedAd.title}» با موفقیت به رتبه ویژه (VIP) ارتقا یافت!`);
            }}
          />
        )}

        {/* MODAL 2: Post Ad */}
        {postAdOpen && (
          <PostAdModal
            lang={lang}
            initialCategory={postAdCategory}
            selectedCountry={selectedCountry}
            countries={portalCountries}
            onClose={handleClosePostAd}
            onCreated={(newAd, wantVip) => {
              fetchAds();
              if (wantVip) {
                handleClosePostAd();
                handleOpenPayment(newAd);
              } else {
                showToast(`آگهی با کد مرجع ${newAd.reference_number} ثبت شد و پس از تایید مدیر منتشر می‌شود.`);
              }
            }}
          />
        )}

        {/* MODAL 3: Manage / Delete Ad with Ref & PIN */}
        {manageAdOpen && (
          <ManageAdModal
            lang={lang}
            onClose={handleCloseManageAd}
            onDeleted={(deletedId) => {
              setAds(ads.filter(a => a.id !== deletedId));
              showToast(lang === 'fa' ? 'آگهی حذف شد.' : 'Annonsen har raderats.');
            }}
            onUpdated={(updatedAd) => {
              setAds(ads.map(a => a.id === updatedAd.id ? updatedAd : a));
              showToast(lang === 'fa' ? 'آگهی به‌روزرسانی شد.' : 'Annonsen har uppdaterats.');
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
