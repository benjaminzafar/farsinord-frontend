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
  Check,
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
  searchDraft = '',
  searchQuery = '',
  onSearchDraftChange,
  onSearchChange,
  onCommitSearch,
  onClearSearch,
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
  const [mobileCityOpen, setMobileCityOpen] = useState(false);
  const [failedLogoUrl, setFailedLogoUrl] = useState('');

  const adMenuRef = useRef(null);
  const categoriesMenuRef = useRef(null);
  const moreMenuRef = useRef(null);
  const mobileSearchRef = useRef(null);
  const mobileSearchInputRef = useRef(null);
  const mobileCityRef = useRef(null);
  const mobileCityDropdownRef = useRef(null);

  const currentDraft = searchDraft || searchQuery || '';
  const isSearchActive = mobileSearchFocused || Boolean(currentDraft.trim());

  const handleDraftInput = (val) => {
    onSearchDraftChange?.(val);
    onSearchChange?.(val);
  };
  const handleCommit = (val) => {
    const text = val !== undefined ? val : currentDraft;
    onCommitSearch?.(text);
  };
  const handleClear = () => {
    if (onClearSearch) {
      onClearSearch();
    } else {
      handleDraftInput('');
    }
  };
  const handleExitSearch = () => {
    handleClear();
    setMobileSearchFocused(false);
    mobileSearchInputRef.current?.blur();
  };

  // Close dropdowns on click outside or Escape
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
      if (mobileSearchRef.current && !mobileSearchRef.current.contains(event.target)) {
        setMobileSearchFocused(false);
      }
      if (
        mobileCityRef.current &&
        !mobileCityRef.current.contains(event.target) &&
        (!mobileCityDropdownRef.current || !mobileCityDropdownRef.current.contains(event.target))
      ) {
        setMobileCityOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setAdDropdownOpen(false);
        setCategoriesDropdownOpen(false);
        setMoreDropdownOpen(false);
        setMobileCityOpen(false);
        setMobileSearchFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
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
    <header className="fixed top-0 inset-x-0 z-40 w-full pointer-events-none md:pointer-events-auto bg-transparent border-0 md:bg-[#FBFBFC] md:border-b md:border-[#ECEFF4] md:dark:bg-[#121317] md:dark:border-white/[0.04] select-none font-vazir transition-colors" dir="rtl">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8">
        
        {/* MOBILE VIEW: Unified Modern Search Bar (Right: Search, Left: Close) */}
        <div ref={mobileSearchRef} className="relative flex md:hidden h-16 items-center">

          <div
            className={`pointer-events-auto flex-1 flex items-center h-12 rounded-full backdrop-blur-md px-3.5 gap-2.5 transition-all min-w-0 ${
              isSearchActive
                ? 'bg-white dark:bg-[#181A22] border border-[#0066CC] ring-2 ring-[#0066CC]/20 shadow-[0_4px_20px_rgba(0,102,204,0.18)] dark:shadow-[0_4px_24px_rgba(0,102,204,0.28)]'
                : 'bg-white/95 dark:bg-[#171920]/95 border border-[#ECEFF4] dark:border-white/[0.06] shadow-[0_1px_4px_rgba(0,0,0,0.03)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.18)]'
            }`}
          >

            {/* 1. RIGHT: Search Icon (Clickable to focus or commit) */}
            <button
              type="button"
              onClick={() => {
                if (currentDraft.trim()) {
                  handleCommit(currentDraft);
                  setMobileSearchFocused(false);
                } else {
                  mobileSearchInputRef.current?.focus();
                  setMobileSearchFocused(true);
                }
              }}
              className="flex h-6 w-6 items-center justify-center shrink-0 text-[#86868B] hover:text-[#0066CC] dark:hover:text-[#58A6FF] active:scale-95 cursor-pointer transition-colors"
              aria-label="جستجو"
            >
              <Search
                size={16}
                strokeWidth={2.2}
                className={`block transition-colors ${
                  isSearchActive ? 'text-[#0066CC] dark:text-[#58A6FF]' : 'text-[#86868B]'
                }`}
              />
            </button>

            {/* 2. CENTER: Unified Search Input */}
            <div className="relative flex-1 flex items-center min-w-0 h-full">
              <input
                ref={mobileSearchInputRef}
                type="text"
                value={currentDraft}
                onFocus={() => {
                  setMobileSearchFocused(true);
                  setMobileCityOpen(false);
                }}
                onChange={(e) => handleDraftInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCommit(currentDraft);
                    setMobileSearchFocused(false);
                    mobileSearchInputRef.current?.blur();
                  } else if (e.key === 'Escape') {
                    handleExitSearch();
                  }
                }}
                placeholder="جستجو در آگهی‌ها..."
                className="w-full h-full bg-transparent text-[14.5px] font-medium leading-normal text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#86868B] placeholder:text-[13.5px] focus:outline-none min-w-0 text-right"
                dir="rtl"
              />
            </div>

            {/* 3. LEFT: Close (×) icon ONLY when search is active */}
            {isSearchActive && (
              <button
                type="button"
                onClick={handleExitSearch}
                className="flex h-7 w-7 items-center justify-center rounded-full text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 active:scale-90 shrink-0 cursor-pointer transition-colors"
                aria-label="بستن و پاک کردن جستجو"
              >
                <X size={16} strokeWidth={2.2} className="block" />
              </button>
            )}

            {/* When search is NOT active: Show Divider and City Selector */}
            {!isSearchActive && (
              <>
                <div className="h-5 w-px bg-[#F0F2F5] dark:bg-white/[0.06] shrink-0" />

                {/* City Selector on Left */}
                <div ref={mobileCityRef} className="relative shrink-0 flex items-center h-full">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileCityOpen((prev) => {
                        const next = !prev;
                        if (next) setMobileSearchFocused(false);
                        return next;
                      });
                    }}
                    aria-expanded={mobileCityOpen}
                    aria-haspopup="listbox"
                    aria-label="انتخاب شهر"
                    className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[13.5px] font-semibold leading-none transition-colors cursor-pointer select-none ${
                      mobileCityOpen || selectedCity !== 'all'
                        ? 'bg-[#EAF2FB] text-[#0066CC] dark:bg-[#0066CC]/20 dark:text-[#58A6FF]'
                        : 'text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    <span className={`flex h-4 w-4 items-center justify-center shrink-0 ${selectedCity !== 'all' || mobileCityOpen ? 'text-[#0066CC] dark:text-[#58A6FF]' : 'text-[#86868B]'}`}>
                      <MapPin size={15} strokeWidth={2} className="block" />
                    </span>
                    <span className="truncate max-w-[96px] leading-none">
                      {cityLabel}
                    </span>
                    <span className="flex h-4 w-4 items-center justify-center shrink-0 text-[#86868B]">
                      <ChevronDown size={14} strokeWidth={2} className={`block transition-transform duration-200 ${mobileCityOpen ? 'rotate-180 text-[#0066CC] dark:text-[#58A6FF]' : ''}`} />
                    </span>
                  </button>
                </div>
              </>
            )}

          </div>

          {/* Minimal Modern Autocomplete Suggestions (Mobile) */}
          {mobileSearchFocused && currentDraft.trim() && searchSuggestions.length > 0 && (
            <div
              className="pointer-events-auto absolute inset-x-0 top-[60px] bg-white dark:bg-[#161720] border border-[#ECEFF4] dark:border-white/[0.08] rounded-2xl shadow-[0_18px_45px_rgba(0,0,0,0.12)] dark:shadow-[0_22px_55px_rgba(0,0,0,0.65)] p-2 z-50 flex flex-col gap-1"
              dir="rtl"
            >
              {searchSuggestions.map((item, idx) => (
                <button
                  key={`${item.label}-${idx}`}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleCommit(item.label);
                    setMobileSearchFocused(false);
                    mobileSearchInputRef.current?.blur();
                  }}
                  className="w-full text-right py-3 px-4 rounded-xl hover:bg-[#F5F5F7] dark:hover:bg-white/[0.06] active:bg-[#0066CC]/15 dark:active:bg-[#0066CC]/25 transition-colors cursor-pointer"
                >
                  <span className="block text-[14.5px] font-medium leading-relaxed text-[#1D1D1F] dark:text-[#F5F5F7] truncate">
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* City Selection Dropdown (Mobile) - Exact Same Visual Language & Alignment */}
          {!isSearchActive && mobileCityOpen && (
            <div
              ref={mobileCityDropdownRef}
              role="listbox"
              aria-label="فهرست شهرها"
              className="pointer-events-auto absolute inset-x-0 top-[60px] bg-white dark:bg-[#161720] border border-[#ECEFF4] dark:border-white/[0.08] rounded-2xl shadow-[0_18px_45px_rgba(0,0,0,0.12)] dark:shadow-[0_22px_55px_rgba(0,0,0,0.65)] p-2 z-50 flex flex-col gap-1 text-right animate-in fade-in zoom-in-95 duration-150"
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
                        onSelectCity?.(c.id);
                        setMobileCityOpen(false);
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

        {/* DESKTOP VIEW: Logo + Brand + Categories + More + Ad Button */}
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
                  decoding="async"
                  onError={() => setFailedLogoUrl(logoUrl)}
                  className="h-7 w-auto max-w-[120px] object-contain shrink-0"
                />
              ) : brandingReady ? (
                <span className="font-black text-lg text-[#1D1D1F] dark:text-white tracking-tight">{siteName}</span>
              ) : (
                <span className="inline-block h-7 w-24 rounded-lg bg-[#ECECEF]/80 dark:bg-white/[0.08] animate-pulse" aria-hidden="true" />
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
                    className={`h-9 inline-flex items-center justify-center px-3.5 rounded-full text-[13px] font-semibold leading-none transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.94] cursor-pointer ${
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
                className={`inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-full border text-[13px] font-semibold leading-none transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer active:scale-[0.94] ${
                  moreDropdownOpen
                    ? 'bg-[#ECECEF] border-[#D2D2D7] text-[#1D1D1F] dark:bg-[#252833] dark:border-white/[0.12] dark:text-white'
                    : 'bg-[#F5F5F7] hover:bg-[#ECECEF] border-[#E5E5EA] text-[#1D1D1F] dark:bg-[#171920] dark:hover:bg-white/[0.06] dark:border-white/[0.08] dark:text-[#E5E5EA]'
                }`}
                aria-expanded={moreDropdownOpen}
                title="تنظیمات و امکانات"
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
                          <span className="block font-bold">حالت تیره</span>
                          <span className="text-[10.5px] text-[#6E6E73] dark:text-[#86868B]">
                            {theme === 'dark' ? 'فعال' : 'غیرفعال'}
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
                          <span className="block font-bold">کشور</span>
                          <span className="text-[10.5px] text-[#6E6E73] dark:text-[#86868B]">
                            {selectedCountryObj?.nameFa || 'سوئد'}
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
                          <span className="text-[10.5px] text-[#6E6E73] dark:text-[#86868B]">تنظیمات GDPR</span>
                        </div>
                      </div>
                      <ChevronLeft size={14} className="text-[#6E6E73] dark:text-[#86868B]" />
                    </button>

                    <div className="pt-1.5 mt-1 border-t border-[#E5E5EA] dark:border-white/[0.06] space-y-1">
                      <span className="block px-2.5 pt-0.5 text-[10.5px] font-bold text-[#6E6E73] dark:text-[#86868B]">رسانه</span>

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
                            <span className="block text-[10.5px] text-[#6E6E73] dark:text-rose-300/70">خبرها و ویدیوهای یوتیوب</span>
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
                className={`inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-full text-[13px] font-bold leading-none text-[#FBFBFC] transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer shadow-xs active:scale-[0.94] ${
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
