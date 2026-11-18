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
  Globe
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
    <header className="fixed top-0 inset-x-0 z-40 w-full bg-[#FBFBFC] border-b border-[#E5E5EA] select-none font-vazir transition-colors" dir="rtl">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8">
        
        {/* MOBILE VIEW: Full-Width Search (Right) & City Selector (Left) Capsule */}
        <div className="relative flex md:hidden h-16 items-center">

          <div className="flex-1 flex items-center h-11 rounded-2xl bg-[#F5F5F7] border border-[#E5E5EA] px-3 gap-2.5 transition-all min-w-0 focus-within:bg-white focus-within:border-[#0066CC] focus-within:ring-2 focus-within:ring-[#0066CC]/15">

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
            <div className="absolute inset-x-0 top-[60px] bg-[#FBFBFC] border border-[#E5E5EA] rounded-2xl shadow-[0_14px_40px_rgba(29,29,31,0.16)] p-1.5 z-50 space-y-0.5">
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
                  alt={siteName}
                  onError={() => setFailedLogoUrl(logoUrl)}
                  className="h-10 w-auto max-w-[165px] object-contain shrink-0"
                />
              ) : (
                <span className="font-black text-lg text-[#1D1D1F] tracking-tight">{siteName}</span>
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
                        ? 'bg-slate-950 text-white shadow-2xs'
                        : 'text-slate-700 hover:text-slate-950 hover:bg-slate-100'
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
                  className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-full text-[13px] font-medium leading-none text-slate-600 hover:text-slate-950 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  <span className="leading-none">سایر دسته‌ها</span>
                  <ChevronDown size={14} strokeWidth={2} className={`block shrink-0 transition-transform duration-200 ${categoriesDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {categoriesDropdownOpen && (
                  <div className="absolute start-0 top-full mt-2 w-56 rounded-2xl bg-white border border-slate-200/90 shadow-[0_10px_35px_rgba(0,0,0,0.1)] p-2 z-50 animate-in fade-in-50 zoom-in-95 duration-150">
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
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                          }`}
                        >
                          <span className="flex h-4 w-4 items-center justify-center shrink-0">
                            <CatIcon size={14} strokeWidth={2} className={`block ${isCurr ? 'text-[#1D1D1F]' : 'text-slate-400'}`} />
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
                    ? 'bg-[#ECECEF] border-[#D2D2D7] text-[#1D1D1F]'
                    : 'bg-[#F5F5F7] hover:bg-[#ECECEF] border-[#E5E5EA] text-[#1D1D1F]'
                }`}
                aria-expanded={moreDropdownOpen}
                title="امکانات بیشتر"
              >
                <MoreHorizontal size={15} strokeWidth={2} className="block text-[#515154] shrink-0" />
                <span className="leading-none">بیشتر</span>
                <ChevronDown size={14} strokeWidth={2} className={`block text-[#6E6E73] shrink-0 transition-transform duration-200 ${moreDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {moreDropdownOpen && (
                <div className="absolute end-0 top-full mt-2 w-72 rounded-2xl bg-[#FBFBFC] border border-[#E5E5EA] shadow-[0_14px_40px_rgba(29,29,31,0.14)] p-2 z-50 animate-in fade-in-50 zoom-in-95 duration-150">
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMoreDropdownOpen(false);
                        onOpenCountryModal?.();
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl text-right text-xs font-semibold text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-[#F5F5F7] text-[#6E6E73] flex items-center justify-center shrink-0">
                          <Globe size={15} />
                        </div>
                        <div>
                          <span className="block font-bold">تغییر کشور</span>
                          <span className="text-[10.5px] text-[#6E6E73]">
                            کشور فعلی: {selectedCountryObj?.nameFa || 'سوئد'}
                          </span>
                        </div>
                      </div>
                      <ChevronLeft size={14} className="text-[#6E6E73]" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMoreDropdownOpen(false);
                        onOpenLegal?.('privacy');
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl text-right text-xs font-semibold text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-[#F5F5F7] text-[#6E6E73] flex items-center justify-center shrink-0">
                          <ShieldCheck size={15} />
                        </div>
                        <div>
                          <span className="block font-bold">حریم خصوصی و کوکی‌ها</span>
                          <span className="text-[10.5px] text-[#6E6E73]">تنظیمات GDPR و کوکی‌ها</span>
                        </div>
                      </div>
                      <ChevronLeft size={14} className="text-[#6E6E73]" />
                    </button>

                    <div className="pt-1.5 mt-1 border-t border-[#E5E5EA] space-y-1">
                      <span className="block px-2.5 pt-0.5 text-[10.5px] font-bold text-[#6E6E73]">سرویس‌های آینده</span>

                      <button
                        type="button"
                        onClick={() => {
                          setMoreDropdownOpen(false);
                          onOpenPodcast?.();
                        }}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl bg-rose-50/70 hover:bg-rose-100/70 border border-rose-200/70 transition-colors text-right cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0">
                            <Headphones size={15} />
                          </div>
                          <div>
                            <span className="block text-xs font-bold text-[#1D1D1F]">پادکست خبری</span>
                            <span className="block text-[10.5px] text-[#6E6E73]">فید خبری و ویدیوهای یوتیوب</span>
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
                <div className="absolute end-0 top-full mt-2 w-64 rounded-2xl bg-white border border-slate-200 shadow-[0_12px_36px_rgba(0,0,0,0.12)] p-2 z-50 animate-in fade-in-50 zoom-in-95 duration-150">
                  <div className="space-y-1">
                    
                    {/* Option 1: ثبت آگهی */}
                    <button
                      type="button"
                      onClick={() => {
                        onOpenPostAd();
                        setAdDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl text-right text-xs font-semibold text-slate-800 hover:bg-blue-50 hover:text-blue-900 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F5F5F7] text-[#6E6E73] group-hover:bg-[#EBEBF0] group-hover:text-[#1D1D1F] transition-colors">
                          <Plus size={16} strokeWidth={2.5} />
                        </div>
                        <div>
                          <span className="block font-bold text-slate-900">ثبت آگهی</span>
                          <span className="text-[10.5px] text-slate-500 font-normal">درج رایگان آگهی</span>
                        </div>
                      </div>
                      <ChevronLeft size={14} className="text-slate-400 group-hover:text-[#1D1D1F]" />
                    </button>

                    {/* Option 2: مدیریت آگهی */}
                    <button
                      type="button"
                      onClick={() => {
                        onOpenManageAd();
                        setAdDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl text-right text-xs font-semibold text-slate-800 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F5F5F7] text-[#6E6E73] group-hover:bg-[#EBEBF0] transition-colors">
                          <KeyRound size={15} />
                        </div>
                        <div>
                          <span className="block font-bold text-slate-900">مدیریت آگهی</span>
                          <span className="text-[10.5px] text-slate-500 font-normal">ویرایش یا حذف آگهی</span>
                        </div>
                      </div>
                      <ChevronLeft size={14} className="text-slate-400 group-hover:text-slate-600" />
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
