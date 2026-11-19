import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, 
  KeyRound, 
  ChevronDown,
  ChevronLeft,
  Home,
  Utensils,
  Briefcase,
  GraduationCap,
  ShoppingBag,
  Car,
  Laptop,
  Calendar,
  Tag,
  MapPin,
  Search,
  X,
  MoreHorizontal,
  Headphones,
  ShieldCheck,
  Globe,
  Sun,
  Moon
} from 'lucide-react';
import { CATEGORIES } from '../lib/translations';

const DROPDOWN_ICON_MAP = {
  ShoppingBag,
  Car,
  Laptop,
  Calendar,
  Tag,
};

export default function Navbar({ 
  siteName = 'لینک شو',
  logoUrl,
  brandingReady = true,
  theme = 'light',
  onToggleTheme,
  selectedCity = 'all',
  onSelectCity,
  availableCities = [],
  searchQuery = '',
  onSearchChange,
  searchSuggestions = [],
  onOpenPostAd, 
  onOpenManageAd,
  onSelectCategory,
  selectedCategory = 'all',
  onOpenCountryModal,
  onOpenLegal,
  onOpenPodcast,
  selectedCountryObj = null
}) {
  const [adDropdownOpen, setAdDropdownOpen] = useState(false);
  const [categoriesDropdownOpen, setCategoriesDropdownOpen] = useState(false);
  const [moreDropdownOpen, setMoreDropdownOpen] = useState(false);
  const [mobileSearchFocused, setMobileSearchFocused] = useState(false);
  const [failedLogoUrl, setFailedLogoUrl] = useState('');

  const adMenuRef = useRef(null);
  const categoriesMenuRef = useRef(null);
  const moreMenuRef = useRef(null);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (adMenuRef.current && !adMenuRef.current.contains(event.target)) {
        setAdDropdownOpen(false);
      }
      if (categoriesMenuRef.current && !categoriesMenuRef.current.contains(event.target)) {
        setCategoriesDropdownOpen(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target)) {
        setMoreDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const mainNavItems = [
    { id: 'bostad', title: 'مسکن', Icon: Home },
    { id: 'restaurang', title: 'رستوران', Icon: Utensils },
    { id: 'tjanster', title: 'خدمات', Icon: Briefcase },
    { id: 'jobb', title: 'استخدام', Icon: GraduationCap },
  ];

  // Selected city display label
  const selectedCityObj = availableCities.find(c => c.id === selectedCity);
  const cityLabel = selectedCityObj 
    ? (selectedCity === 'all' ? 'همه شهرها' : selectedCityObj.fa) 
    : 'همه شهرها';

  return (
    <header className="fixed top-0 inset-x-0 z-40 w-full pointer-events-none md:pointer-events-auto bg-transparent border-b border-transparent md:bg-[#FBFBFC] md:border-[#E5E5EA] md:dark:bg-[#121317] md:dark:border-white/[0.04] select-none font-vazir transition-colors" dir="rtl">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8">
        
        {/* MOBILE VIEW: Full-Width Search (Right) & City Selector (Left) Capsule */}
        <div className="relative flex md:hidden h-16 items-center">

          <div className="pointer-events-auto flex-1 flex items-center h-12 rounded-full bg-white/95 dark:bg-[#171920]/95 backdrop-blur-md border border-[#E5E5EA] dark:border-white/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_14px_rgba(0,0,0,0.35)] px-3.5 gap-2.5 transition-all min-w-0 focus-within:bg-white focus-within:border-[#0066CC] focus-within:ring-2 focus-within:ring-[#0066CC]/15">

            {/* Search Input (Icon on Right — exact same vertical center as City Selector) */}
            <div className="relative flex-1 flex items-center gap-2 min-w-0 h-full">
              <span className="flex h-5 w-5 items-center justify-center shrink-0 text-[#86868B] pointer-events-none">
                <Search size={15} strokeWidth={2} className="block" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setMobileSearchFocused(true)}
                onBlur={() => setTimeout(() => setMobileSearchFocused(false), 150)}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder="جستجو در نیازمندی‌ها..."
                className="w-full h-full bg-transparent text-[13px] leading-none text-[#1D1D1F] placeholder:text-[#86868B] focus:outline-none min-w-0"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange?.('')}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-[#86868B] hover:text-[#1D1D1F] active:scale-95 shrink-0"
                  aria-label="پاک کردن متن جستجو"
                >
                  <X size={14} strokeWidth={2} className="block" />
                </button>
              )}
            </div>

            {/* Vertical separator */}
            <div className="h-5 w-px bg-[#E5E5EA] shrink-0" />

            {/* City Selector on Left (Flat, aligned on exact same horizontal axis) */}
            <div className="relative shrink-0 flex items-center h-full">
              <div className="inline-flex items-center gap-1.5 h-8 px-2 rounded-xl text-[#1D1D1F] text-xs font-bold leading-none">
                <span className="flex h-4 w-4 items-center justify-center shrink-0 text-[#86868B]">
                  <MapPin size={14} strokeWidth={2} className="block" />
                </span>
                <span className="truncate max-w-[72px] leading-none">
                  {cityLabel}
                </span>
                <span className="flex h-4 w-4 items-center justify-center shrink-0 text-[#86868B]">
                  <ChevronDown size={14} strokeWidth={2} className="block" />
                </span>
              </div>

              {/* Invisible native select over pill */}
              <select
                value={selectedCity}
                onChange={(e) => onSelectCity?.(e.target.value)}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                aria-label="انتخاب شهر"
              >
                {availableCities.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.fa}
                  </option>
                ))}
              </select>
            </div>

          </div>

          {/* Google-style Smart Autocomplete Suggestions (Mobile) */}
          {mobileSearchFocused && searchQuery.trim() && searchSuggestions.length > 0 && (
            <div className="pointer-events-auto absolute inset-x-0 top-[62px] bg-[#FBFBFC] dark:bg-[#171920] border border-[#E5E5EA] dark:border-white/[0.06] rounded-2xl shadow-[0_14px_40px_rgba(29,29,31,0.16)] dark:shadow-[0_14px_40px_rgba(0,0,0,0.5)] p-1.5 z-50 space-y-0.5">
              {searchSuggestions.map((item, idx) => (
                <button
                  key={`${item.label}-${idx}`}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSearchChange?.(item.label);
                    setMobileSearchFocused(false);
                  }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl hover:bg-[#F5F5F7] text-right transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-4 w-4 items-center justify-center shrink-0">
                      <Search size={13} strokeWidth={2} className="block text-[#6E6E73]" />
                    </span>
                    <span className="text-xs font-semibold text-[#1D1D1F] leading-none truncate">{item.label}</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#ECECEF] text-[#515154] shrink-0">
                    {item.badge}
                  </span>
                </button>
              ))}
            </div>
          )}

        </div>

        {/* DESKTOP VIEW: Logo + Brand + Categories + Country Button + Ad Button */}
        <div className="hidden md:flex h-16 items-center justify-between gap-6">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-6 shrink-0">
            <a
              href="/"
              aria-label={siteName}
              onClick={(e) => {
                e.preventDefault();
                if (onSelectCategory) onSelectCategory('all');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="flex items-center gap-2.5 group shrink-0 cursor-pointer"
            >
              {logoUrl && failedLogoUrl !== logoUrl ? (
                <img
                  src={logoUrl}
                  alt=""
                  loading="eager"
                  decoding="sync"
                  fetchPriority="high"
                  onError={() => setFailedLogoUrl(logoUrl)}
                  className="h-7 w-auto max-w-[120px] object-contain shrink-0"
                />
              ) : brandingReady ? (
                <span className="font-black text-lg text-[#1D1D1F] dark:text-white tracking-tight">{siteName}</span>
              ) : (
                <span className="inline-block h-7 w-24 rounded-lg bg-[#ECECEF]/80 animate-pulse" aria-hidden="true" />
              )}
            </a>

            {/* Desktop Category Navigation */}
            <nav className="hidden xl:flex items-center gap-1">
              {mainNavItems.map(item => {
                const isCurr = selectedCategory === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (onSelectCategory) onSelectCategory(item.id);
                    }}
                    className={`px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-all duration-250 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.94] cursor-pointer ${
                      isCurr
                        ? 'bg-slate-950 text-white shadow-2xs dark:bg-white dark:text-slate-950'
                        : 'text-slate-700 hover:text-slate-950 hover:bg-slate-100 dark:text-[#A1A1A6] dark:hover:text-white dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    {item.title}
                  </button>
                );
              })}

              {/* More Categories Dropdown */}
              <div className="relative" ref={categoriesMenuRef}>
                <button
                  type="button"
                  onClick={() => setCategoriesDropdownOpen(!categoriesDropdownOpen)}
                  className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-full text-[13px] font-medium leading-none text-slate-600 hover:text-slate-950 hover:bg-slate-100 dark:text-[#A1A1A6] dark:hover:text-white dark:hover:bg-white/[0.06] transition-all cursor-pointer"
                >
                  <span className="leading-none">سایر دسته‌ها</span>
                  <ChevronDown size={14} strokeWidth={2} className={`block shrink-0 transition-transform duration-200 ${categoriesDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {categoriesDropdownOpen && (
                  <div className="absolute start-0 top-full mt-2 w-56 rounded-2xl bg-white dark:bg-[#171920] border border-slate-200/90 dark:border-white/[0.08] shadow-[0_10px_35px_rgba(0,0,0,0.1)] dark:shadow-[0_10px_35px_rgba(0,0,0,0.5)] p-2 z-50 animate-in fade-in-50 zoom-in-95 duration-150">
                    {CATEGORIES.filter(c => !mainNavItems.some(m => m.id === c.id) && c.id !== 'all').map(cat => {
                      const CatIcon = DROPDOWN_ICON_MAP[cat.icon] || Tag;
                      const isCurr = selectedCategory === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            if (onSelectCategory) onSelectCategory(cat.id);
                            setCategoriesDropdownOpen(false);
                          }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold leading-none transition-colors text-right cursor-pointer ${
                            isCurr
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-600/20 dark:text-blue-400'
                              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-[#E5E5EA] dark:hover:bg-white/[0.06] dark:hover:text-white'
                          }`}
                        >
                          <span className="flex h-4 w-4 items-center justify-center shrink-0">
                            <CatIcon size={14} strokeWidth={2} className={`block ${isCurr ? 'text-[#1D1D1F] dark:text-blue-400' : 'text-slate-400 dark:text-[#6E6E73]'}`} />
                          </span>
                          <span className="leading-none">{cat.fa}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </nav>
          </div>

          {/* Desktop Right Action: "بیشتر" + "آگهی" */}
          <div className="flex items-center gap-2.5">
            {/* Desktop "بیشتر" (More) Dropdown */}
            <div className="relative" ref={moreMenuRef}>
              <button
                type="button"
                onClick={() => setMoreDropdownOpen(!moreDropdownOpen)}
                className={`inline-flex items-center justify-center gap-1.5 h-10 px-3.5 rounded-full border text-[13px] font-semibold leading-none transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer active:scale-[0.94] ${
                  moreDropdownOpen
                    ? 'bg-[#ECECEF] border-[#D2D2D7] text-[#1D1D1F] dark:bg-[#252833] dark:border-white/[0.12] dark:text-white'
                    : 'bg-[#F5F5F7] hover:bg-[#ECECEF] border-[#E5E5EA] text-[#1D1D1F] dark:bg-[#171920] dark:hover:bg-white/[0.06] dark:border-white/[0.08] dark:text-[#E5E5EA]'
                }`}
                aria-expanded={moreDropdownOpen}
                title="امکانات بیشتر"
              >
                <MoreHorizontal size={15} strokeWidth={2} className="block text-[#515154] dark:text-[#A1A1A6] shrink-0" />
                <span className="leading-none">بیشتر</span>
                <ChevronDown size={14} strokeWidth={2} className={`block text-[#6E6E73] dark:text-[#A1A1A6] shrink-0 transition-transform duration-200 ${moreDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {moreDropdownOpen && (
                <div className="absolute end-0 top-full mt-2 w-72 rounded-2xl bg-[#FBFBFC] dark:bg-[#171920] border border-[#E5E5EA] dark:border-white/[0.08] shadow-[0_14px_40px_rgba(29,29,31,0.14)] dark:shadow-[0_14px_40px_rgba(0,0,0,0.5)] p-2 z-50 animate-in fade-in-50 zoom-in-95 duration-150">
                  <div className="space-y-1">
                    <button
                      type="button"
                      aria-pressed={theme === 'dark'}
                      onClick={() => onToggleTheme?.()}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl text-right text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-[#F5F5F7] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-[#F5F5F7] dark:bg-white/[0.06] text-[#0066CC] dark:text-[#388BFD] flex items-center justify-center shrink-0">
                          {theme === 'dark' ? <Moon size={15} /> : <Sun size={15} />}
                        </div>
                        <div>
                          <span className="block font-bold">حالت شب / روز</span>
                          <span className="text-[10.5px] text-[#6E6E73] dark:text-[#86868B]">
                            {theme === 'dark' ? 'حالت تاریک فعال است' : 'حالت روشن فعال است'}
                          </span>
                        </div>
                      </div>
                      <span
                        aria-hidden="true"
                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${
                          theme === 'dark' ? 'bg-[#0066CC]' : 'bg-[#D2D2D7]'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 rounded-full bg-[#ffffff] shadow-2xs transition-transform ${
                            theme === 'dark' ? '-translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMoreDropdownOpen(false);
                        onOpenCountryModal?.();
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl text-right text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-[#F5F5F7] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-[#F5F5F7] dark:bg-white/[0.06] text-[#6E6E73] dark:text-[#A1A1A6] flex items-center justify-center shrink-0">
                          <Globe size={15} />
                        </div>
                        <div>
                          <span className="block font-bold">تغییر کشور</span>
                          <span className="text-[10.5px] text-[#6E6E73] dark:text-[#86868B]">
                            کشور فعلی: {selectedCountryObj?.nameFa || 'سوئد'}
                          </span>
                        </div>
                      </div>
                      <ChevronLeft size={14} className="text-[#6E6E73] dark:text-[#86868B]" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMoreDropdownOpen(false);
                        onOpenLegal?.('privacy');
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl text-right text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-[#F5F5F7] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-[#F5F5F7] dark:bg-white/[0.06] text-[#6E6E73] dark:text-[#A1A1A6] flex items-center justify-center shrink-0">
                          <ShieldCheck size={15} />
                        </div>
                        <div>
                          <span className="block font-bold">حریم خصوصی و کوکی‌ها</span>
                          <span className="text-[10.5px] text-[#6E6E73] dark:text-[#86868B]">تنظیمات GDPR و کوکی‌ها</span>
                        </div>
                      </div>
                      <ChevronLeft size={14} className="text-[#6E6E73] dark:text-[#86868B]" />
                    </button>

                    <div className="pt-1.5 mt-1 border-t border-[#E5E5EA] dark:border-white/[0.06] space-y-1">
                      <span className="block px-2.5 pt-0.5 text-[10.5px] font-bold text-[#6E6E73] dark:text-[#86868B]">سرویس‌های آینده</span>

                      <button
                        type="button"
                        onClick={() => {
                          setMoreDropdownOpen(false);
                          onOpenPodcast?.();
                        }}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl bg-rose-50/70 hover:bg-rose-100/70 border border-rose-200/70 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 dark:border-rose-800/40 transition-colors text-right cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0">
                            <Headphones size={15} />
                          </div>
                          <div>
                            <span className="block text-xs font-bold text-[#1D1D1F] dark:text-rose-100">پادکست خبری</span>
                            <span className="block text-[10.5px] text-[#6E6E73] dark:text-rose-300/70">فید خبری و ویدیوهای یوتیوب</span>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold">
                          پخش
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="relative" ref={adMenuRef}>
              <button
                type="button"
                onClick={() => setAdDropdownOpen(!adDropdownOpen)}
                className={`inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-full text-[13px] font-bold leading-none text-[#FBFBFC] transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer shadow-xs active:scale-[0.94] ${
                  adDropdownOpen 
                    ? 'bg-[#0055AA] ring-2 ring-[#0066CC]/30' 
                    : 'bg-[#0066CC] hover:bg-[#0055AA]'
                }`}
                aria-expanded={adDropdownOpen}
              >
                <Plus size={15} strokeWidth={2.4} className="block shrink-0" />
                <span className="leading-none">آگهی</span>
                <ChevronDown size={14} strokeWidth={2} className={`block shrink-0 transition-transform duration-200 text-white/80 ${adDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Single Dropdown Menu with "ثبت آگهی" and "مدیریت آگهی" */}
              {adDropdownOpen && (
                <div className="absolute end-0 top-full mt-2 w-64 rounded-2xl bg-white dark:bg-[#171920] border border-slate-200 dark:border-white/[0.08] shadow-[0_12px_36px_rgba(0,0,0,0.12)] dark:shadow-[0_12px_36px_rgba(0,0,0,0.5)] p-2 z-50 animate-in fade-in-50 zoom-in-95 duration-150">
                  <div className="space-y-1">
                    
                    {/* Option 1: ثبت آگهی */}
                    <button
                      type="button"
                      onClick={() => {
                        onOpenPostAd();
                        setAdDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl text-right text-xs font-semibold text-slate-800 dark:text-[#F5F5F7] hover:bg-blue-50 hover:text-blue-900 dark:hover:bg-blue-600/15 dark:hover:text-blue-400 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F5F5F7] dark:bg-white/[0.06] text-[#6E6E73] dark:text-[#A1A1A6] group-hover:bg-[#EBEBF0] dark:group-hover:bg-white/[0.1] group-hover:text-[#1D1D1F] dark:group-hover:text-white transition-colors">
                          <Plus size={16} strokeWidth={2.5} />
                        </div>
                        <div>
                          <span className="block font-bold text-slate-900 dark:text-white">ثبت آگهی</span>
                          <span className="text-[10.5px] text-slate-500 dark:text-[#86868B] font-normal">درج رایگان آگهی</span>
                        </div>
                      </div>
                      <ChevronLeft size={14} className="text-slate-400 dark:text-[#6E6E73] group-hover:text-[#1D1D1F] dark:group-hover:text-white" />
                    </button>

                    {/* Option 2: مدیریت آگهی */}
                    <button
                      type="button"
                      onClick={() => {
                        onOpenManageAd();
                        setAdDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl text-right text-xs font-semibold text-slate-800 dark:text-[#F5F5F7] hover:bg-slate-50 hover:text-slate-900 dark:hover:bg-white/[0.06] dark:hover:text-white transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F5F5F7] dark:bg-white/[0.06] text-[#6E6E73] dark:text-[#A1A1A6] group-hover:bg-[#EBEBF0] dark:group-hover:bg-white/[0.1] transition-colors">
                          <KeyRound size={15} />
                        </div>
                        <div>
                          <span className="block font-bold text-slate-900 dark:text-white">مدیریت آگهی</span>
                          <span className="text-[10.5px] text-slate-500 dark:text-[#86868B] font-normal">ویرایش یا حذف آگهی</span>
                        </div>
                      </div>
                      <ChevronLeft size={14} className="text-slate-400 dark:text-[#6E6E73] group-hover:text-slate-600 dark:group-hover:text-white" />
                    </button>

                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </header>
  );
}
