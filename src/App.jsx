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
import { COUNTRIES, CATEGORIES, t } from './lib/translations';
import { getGdprConsent } from './lib/gdpr';
import { matchesSmartSearch, getSearchSuggestions } from './lib/smartSearch';

const CountryBanner = lazy(() => import('./components/CountryBanner'));
const LegalModal = lazy(() => import('./components/LegalModal'));
const AdDetailPage = lazy(() => import('./components/AdDetailPage'));
const PaymentModal = lazy(() => import('./components/PaymentModal'));
const PostAdModal = lazy(() => import('./components/PostAdModal'));
const ManageAdModal = lazy(() => import('./components/ManageAdModal'));

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

  // Country & URL synchronization (Address bar: /?c=se, /?c=no, etc.)
  const [selectedCountry, setSelectedCountry] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlC = (params.get('c') || params.get('country') || '').toLowerCase();
      if (['se', 'no', 'dk', 'fi'].includes(urlC)) {
        return urlC;
      }
    } catch {}
    const saved = localStorage.getItem('scandi_country_selected');
    if (['se', 'no', 'dk', 'fi'].includes(saved)) {
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
    const valid = ['se', 'no', 'dk', 'fi'].includes(c) ? c : 'se';
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
  const [turnstileSettings, setTurnstileSettings] = useState({ enabled: true, mode: 'test', siteKey: '' });
  const [analyticsSettings, setAnalyticsSettings] = useState({ enabled: false, measurementId: '' });

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

  // Dynamic Country SEO Document Title
  useEffect(() => {
    const titles = {
      se: 'نیازمندی‌ها، مسکن و خدمات فارسی‌زبانان در سوئد | لینک شو',
      no: 'نیازمندی‌ها، مسکن و مشاغل فارسی‌زبانان در نروژ | لینک شو',
      dk: 'نیازمندی‌ها، مسکن و خدمات فارسی‌زبانان در دانمارک | لینک شو',
      fi: 'نیازمندی‌ها، مسکن و مشاغل فارسی‌زبانان در فنلاند | لینک شو'
    };
    document.title = titles[selectedCountry] || titles.se;
  }, [selectedCountry]);

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

        // 1. Modals
        const modal = params.get('modal');
        setPostAdOpen(modal === 'post');
        setManageAdOpen(modal === 'manage');
        setCountryModalOpen(modal === 'country');
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

  // Active country details
  const currentCountryObj = COUNTRIES.find(c => c.id === selectedCountry) || COUNTRIES[0];

  // Dynamic available cities for current country
  const availableCities = currentCountryObj.cities;

  // Dynamic Hero Architectural Cityscape Backgrounds
  const HERO_BACKGROUNDS = {
    se: {
      image: '/images/cities/stockholm.jpg',
      cityFa: 'استکهلم، سوئد',
      cityEn: 'Stockholm, Sweden'
    },
    no: {
      image: '/images/cities/oslo.jpg',
      cityFa: 'اسلو، نروژ',
      cityEn: 'Oslo, Norway'
    },
    dk: {
      image: '/images/cities/copenhagen.jpg',
      cityFa: 'کپنهاگ، دانمارک',
      cityEn: 'Copenhagen, Denmark'
    },
    fi: {
      image: '/images/cities/helsinki.jpg',
      cityFa: 'هلسینکی، فنلاند',
      cityEn: 'Helsinki, Finland'
    }
  };

  const activeHero = HERO_BACKGROUNDS[selectedCountry] || HERO_BACKGROUNDS.se;

  // Dynamic Hero Titles based on selected country (natural, concise Persian)
  let heroHeading = 'نیازمندی‌های فارسی‌زبانان سوئد';
  let heroSubheading = 'مسکن، رستوران، خدمات و کاریابی در سراسر سوئد';

  if (selectedCountry === 'no') {
    heroHeading = 'نیازمندی‌های فارسی‌زبانان نروژ';
    heroSubheading = 'مسکن، رستوران، خدمات و کاریابی در سراسر نروژ';
  } else if (selectedCountry === 'dk') {
    heroHeading = 'نیازمندی‌های فارسی‌زبانان دانمارک';
    heroSubheading = 'مسکن، رستوران، خدمات و کاریابی در سراسر دانمارک';
  } else if (selectedCountry === 'fi') {
    heroHeading = 'نیازمندی‌های فارسی‌زبانان فنلاند';
    heroSubheading = 'مسکن، رستوران، خدمات و کاریابی در سراسر فنلاند';
  }

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

      {/* Geolocation Scandinavian Detection Pop-Up Modal */}
      <Suspense fallback={null}>
        <CountryBanner
          isOpen={countryModalOpen}
          onClose={handleCloseCountryModal}
          selectedCountry={selectedCountry}
          onSelectCountry={handleCountryChange}
          onConsentSaved={setGdprConsent}
          siteName={siteName}
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

      {/* Full Page Ad View (Lazy-loaded for fast initial paint) OR Home Feed */}
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
      ) : (
        <>
          {/* Hero Section - Displayed only on Home (selectedCategory === 'all') */}
          {selectedCategory === 'all' && (
            <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 sm:pt-5 pb-1 animate-in fade-in duration-200">
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
                <div className="bg-[#FBFBFC] rounded-full p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.18)] border border-white/40 max-w-2xl mx-auto flex items-center gap-1 transition-all">
                  
                  {/* Keyword Input with Google-style Smart Autocomplete (Right side in RTL) */}
                  <div className="relative flex-1 min-w-0">
                    <Search size={15} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-[#86868B] pointer-events-none" />
                    <input
                      type="text"
                      placeholder={currentT.searchPlaceholder}
                      value={searchQuery}
                      onFocus={() => setHeroSearchFocused(true)}
                      onBlur={() => setTimeout(() => setHeroSearchFocused(false), 150)}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full h-10 rounded-full bg-transparent border-0 ps-9 pe-8 text-xs font-medium text-[#1D1D1F] placeholder-[#86868B] focus:outline-none text-right"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute end-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-[#86868B] hover:text-[#1D1D1F] cursor-pointer transition-colors"
                        aria-label="پاک کردن جستجو"
                      >
                        <X size={14} />
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
                              <Search size={13} className="text-[#86868B] shrink-0" />
                              <span className="text-xs font-semibold text-[#1D1D1F] truncate">{item.label}</span>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F5F5F7] text-[#6E6E73] shrink-0">
                              {item.badge}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Clean Hairline Divider (No inner box) */}
                  <div className="h-5 w-px bg-[#E5E5EA] shrink-0" />

                  {/* Flat Borderless City Selector */}
                  <div className="relative w-40 shrink-0">
                    <MapPin size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-[#86868B] pointer-events-none" />
                    <select
                      value={selectedCity}
                      onChange={(e) => setSelectedCity(e.target.value)}
                      className="w-full h-10 bg-transparent ps-8 pe-7 text-xs font-semibold text-[#1D1D1F] border-0 focus:outline-none cursor-pointer appearance-none text-right"
                    >
                      {availableCities.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.fa}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="absolute end-2.5 top-1/2 -translate-y-1/2 text-[#86868B] pointer-events-none" />
                  </div>

                  {/* CTA Button */}
                  <button
                    type="button"
                    className="h-10 px-6 rounded-full bg-[#0066CC] hover:bg-[#0055AA] text-[#FBFBFC] text-xs font-bold transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.95] flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Search size={14} />
                    <span>{currentT.searchBtn}</span>
                  </button>

                </div>
              </div>

            </div>
          </div>
        </section>
      )}

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
                className={`relative z-10 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer shrink-0 active:scale-[0.94] select-none ${
                  isActive
                    ? (pillStyle.ready ? 'text-[#FBFBFC]' : 'bg-[#0066CC] text-[#FBFBFC] shadow-2xs')
                    : 'text-[#515154] hover:text-[#1D1D1F]'
                }`}
              >
                <CatIcon size={13} className={`shrink-0 transition-colors duration-200 ${isActive ? 'text-[#FBFBFC]' : 'text-[#86868B]'}`} />
                <span>{cat.fa}</span>
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
        selectedCountryObj={currentCountryObj}
        onOpenCountryModal={handleOpenCountryModal}
        onSelectCategory={handleCategoryChange}
        onSelectCity={(cityId) => {
          setSelectedCity(cityId);
          window.scrollTo({ top: 380, behavior: 'smooth' });
        }}
        onOpenPostAd={() => handleOpenPostAd('bostad')}
        onOpenManageAd={handleOpenManageAd}
        onOpenLegal={setLegalModalTab}
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
      />

      <Suspense fallback={null}>
        {/* MODAL: Stripe Payment for VIP Ad Promotion */}
        {paymentAd && (
          <PaymentModal
            ad={paymentAd}
            price={stripeSettings?.vipPrice || 99}
            currency={stripeSettings?.currency || 'SEK'}
            stripeSettings={stripeSettings}
            onClose={handleClosePayment}
            onSuccess={(promotedAd) => {
              fetchAds();
              if (activeAdDetail && activeAdDetail.id === promotedAd.id) {
                setActiveAdDetail(promotedAd);
              }
              showToast(`آگهی "${promotedAd.title}" با موفقیت به رتبه ویژه (VIP) ارتقا یافت!`);
            }}
          />
        )}

        {/* MODAL 2: Post Ad */}
        {postAdOpen && (
          <PostAdModal
            lang={lang}
            initialCategory={postAdCategory}
            selectedCountry={selectedCountry}
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
