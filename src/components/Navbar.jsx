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
  Globe2,
  MapPin,
  Search,
  X
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
  siteName = 'سوئد پرشیا',
  logoUrl,
  selectedCity = 'all',
  onSelectCity,
  availableCities = [],
  searchQuery = '',
  onSearchChange,
  onOpenCountryModal,
  onOpenPostAd, 
  onOpenManageAd,
  onSelectCategory,
  selectedCategory = 'all',
  selectedCountryObj = null
}) {
  const [adDropdownOpen, setAdDropdownOpen] = useState(false);
  const [categoriesDropdownOpen, setCategoriesDropdownOpen] = useState(false);

  const adMenuRef = useRef(null);
  const categoriesMenuRef = useRef(null);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (adMenuRef.current && !adMenuRef.current.contains(event.target)) {
        setAdDropdownOpen(false);
      }
      if (categoriesMenuRef.current && !categoriesMenuRef.current.contains(event.target)) {
        setCategoriesDropdownOpen(false);
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
    <header className="fixed top-0 inset-x-0 z-40 w-full bg-[#FBFBFC] border-b border-[#E5E5EA] select-none font-vazir shadow-[0_1px_2px_rgba(29,29,31,0.03)] transition-colors" dir="rtl">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8">
        
        {/* MOBILE VIEW: Soft Nordic Clean Palette (Search Capsule Right + Logo Left) */}
        <div className="flex md:hidden h-16 items-center gap-2.5">
          
          {/* Integrated City Selector & Search Capsule (Soft Pearl Gray Card) */}
          <div className="flex-1 flex items-center h-11 sm:h-12 rounded-2xl bg-slate-100/90 border border-slate-200/90 px-2.5 gap-2 transition-all min-w-0 focus-within:bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
            
            {/* City Selector Pill with native select overlay */}
            <div className="relative shrink-0 flex items-center">
              <div className="flex items-center gap-1.5 ps-2.5 pe-2 py-1.5 rounded-xl bg-white text-slate-800 text-[11.5px] font-bold border border-slate-200 shadow-2xs">
                <MapPin size={12} className="text-blue-600 shrink-0" />
                <span className="truncate max-w-[68px]">
                  {cityLabel}
                </span>
                <ChevronDown size={12} className="text-slate-400 shrink-0" />
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

            {/* Vertical separator */}
            <div className="h-4.5 w-px bg-slate-300/80 shrink-0" />

            {/* Search Input */}
            <div className="relative flex-1 flex items-center min-w-0">
              <Search size={15} className="text-slate-400 shrink-0 pointer-events-none me-1" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder="جستجو در نیازمندی‌ها..."
                className="w-full h-9 bg-transparent text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none min-w-0"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange?.('')}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-700 active:scale-95 shrink-0"
                  aria-label="پاک کردن متن جستجو"
                >
                  <X size={13} />
                </button>
              )}
            </div>

          </div>

          {/* Logo on Left (Clean Nordic Badge) */}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              if (onSelectCategory) onSelectCategory('all');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center shrink-0 cursor-pointer"
            title={siteName}
          >
            {logoUrl ? (
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-2xs">
                <img src={logoUrl} alt={siteName} className="h-full w-full object-contain" />
              </div>
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white font-extrabold text-xs shadow-2xs border border-slate-800 transition-transform active:scale-95">
                <span className="font-mono text-emerald-400 font-black">SP</span>
              </div>
            )}
          </a>

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
              {logoUrl ? (
                <div className="flex h-9 w-9 items-center justify-center rounded-xl overflow-hidden bg-white shadow-xs border border-slate-200 shrink-0">
                  <img src={logoUrl} alt={siteName} className="h-full w-full object-contain" />
                </div>
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white font-extrabold text-xs shadow-xs border border-slate-800 transition-all duration-150 group-hover:scale-105 active:scale-95 shrink-0">
                  <span className="font-mono text-emerald-400 font-black">SP</span>
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <span className="font-extrabold text-[17px] tracking-tight text-[#1D1D1F] group-hover:text-[#0066CC] transition-colors">
                  {siteName}
                </span>
                <span className="text-[11px] text-[#6E6E73] font-medium">
                  نیازمندی‌های فارسی اسکاندیناوی
                </span>
              </div>
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
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[13px] font-medium text-slate-600 hover:text-slate-950 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  <span>سایر دسته‌ها</span>
                  <ChevronDown size={14} className={`transition-transform duration-200 ${categoriesDropdownOpen ? 'rotate-180' : ''}`} />
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
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors text-right cursor-pointer ${
                            isCurr
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                          }`}
                        >
                          <CatIcon size={14} className={isCurr ? 'text-blue-600 shrink-0' : 'text-slate-400 shrink-0'} />
                          <span>{cat.fa}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </nav>
          </div>

          {/* Desktop Right Action: "انتخاب کشور" + "آگهی" */}
          <div className="flex items-center gap-2.5">
            {/* Country Selector Button with Globe icon */}
            <button
              type="button"
              onClick={onOpenCountryModal}
              className="flex items-center gap-1.5 h-10 px-3.5 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200/90 text-slate-700 hover:text-slate-950 text-[13px] font-semibold transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.94] cursor-pointer shadow-2xs group"
              title="انتخاب کشور در اسکاندیناوی"
            >
              <Globe2 size={15} className="text-slate-500 group-hover:text-[#1877F2] transition-colors" />
              <span>{selectedCountryObj?.nameFa || 'انتخاب کشور'}</span>
              <ChevronDown size={13} className="text-slate-400" />
            </button>

            <div className="relative" ref={adMenuRef}>
              <button
                type="button"
                onClick={() => setAdDropdownOpen(!adDropdownOpen)}
                className={`flex items-center gap-2 h-10 px-4 rounded-full text-[13px] font-bold text-[#FBFBFC] transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer shadow-xs active:scale-[0.94] ${
                  adDropdownOpen 
                    ? 'bg-[#0055AA] ring-2 ring-[#0066CC]/30' 
                    : 'bg-[#0066CC] hover:bg-[#0055AA]'
                }`}
                aria-expanded={adDropdownOpen}
              >
                <Plus size={16} strokeWidth={2.5} />
                <span>آگهی</span>
                <ChevronDown size={14} className={`transition-transform duration-200 text-white/80 ${adDropdownOpen ? 'rotate-180' : ''}`} />
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
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-[#1877F2] group-hover:bg-[#1877F2] group-hover:text-white transition-colors">
                          <Plus size={16} strokeWidth={2.5} />
                        </div>
                        <div>
                          <span className="block font-bold text-slate-900">ثبت آگهی</span>
                          <span className="text-[10.5px] text-slate-500 font-normal">درج رایگان آگهی</span>
                        </div>
                      </div>
                      <ChevronLeft size={14} className="text-slate-400 group-hover:text-blue-600" />
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
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700 group-hover:bg-amber-100 transition-colors">
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
