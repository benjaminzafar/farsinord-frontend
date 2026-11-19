import React, { useState } from 'react';
import { 
  Home, 
  LayoutGrid, 
  Globe, 
  Plus, 
  KeyRound, 
  X, 
  ChevronLeft,
  Utensils,
  Briefcase,
  GraduationCap,
  ShoppingBag,
  Car,
  Laptop,
  Calendar,
  Tag,
  Layers,
  Check,
  MoreHorizontal,
  Headphones,
  ShieldCheck,
  Sun,
  Moon
} from 'lucide-react';
import { CATEGORIES, COUNTRIES } from '../lib/translations';

// Map icon strings to Lucide components with semantic colors
const CATEGORY_META = {
  all: { Icon: Layers, bg: 'bg-[#F5F5F7] text-[#6E6E73] border-[#E5E5EA]' },
  bostad: { Icon: Home, bg: 'bg-[#F5F5F7] text-[#6E6E73] border-[#E5E5EA]' },
  restaurang: { Icon: Utensils, bg: 'bg-[#F5F5F7] text-[#6E6E73] border-[#E5E5EA]' },
  tjanster: { Icon: Briefcase, bg: 'bg-[#F5F5F7] text-[#6E6E73] border-[#E5E5EA]' },
  jobb: { Icon: GraduationCap, bg: 'bg-[#F5F5F7] text-[#6E6E73] border-[#E5E5EA]' },
  'kop-salj': { Icon: ShoppingBag, bg: 'bg-[#F5F5F7] text-[#6E6E73] border-[#E5E5EA]' },
  fordon: { Icon: Car, bg: 'bg-[#F5F5F7] text-[#6E6E73] border-[#E5E5EA]' },
  elektronik: { Icon: Laptop, bg: 'bg-[#F5F5F7] text-[#6E6E73] border-[#E5E5EA]' },
  evenemang: { Icon: Calendar, bg: 'bg-[#F5F5F7] text-[#6E6E73] border-[#E5E5EA]' },
  ovrigt: { Icon: Tag, bg: 'bg-[#F5F5F7] text-[#6E6E73] border-[#E5E5EA]' },
};

export default function MobileBottomNav({
  selectedCategory = 'all',
  selectedCountry = 'se',
  theme = 'light',
  onToggleTheme,
  onSelectCategory,
  onOpenCountryModal,
  onOpenPostAd,
  onOpenManageAd,
  onOpenLegal,
  onOpenPodcast,
}) {
  const [collectionSheetOpen, setCollectionSheetOpen] = useState(false);
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);

  // Find country name
  const currentCountryObj = COUNTRIES.find(c => c.id === selectedCountry) || COUNTRIES[0];

  const handleCategoryClick = (catId) => {
    onSelectCategory?.(catId);
    setCollectionSheetOpen(false);
    setMoreSheetOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoHome = () => {
    onSelectCategory?.('all');
    setCollectionSheetOpen(false);
    setMoreSheetOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isHomeActive = selectedCategory === 'all' && !collectionSheetOpen && !moreSheetOpen;
  const isCollectionActive = collectionSheetOpen || selectedCategory !== 'all';

  return (
    <>
      {/* 1. Sleek Compact Mobile Bottom Navigation Bar (Apple Frosted Spring Feel) */}
      <nav 
        className="fixed bottom-0 inset-x-0 z-40 md:hidden rounded-t-[22px] bg-[#FBFBFC]/95 dark:bg-[#171920]/95 backdrop-blur-md border-t border-x border-[#ECEFF4] dark:border-white/[0.045] shadow-none px-2 pt-1 pb-[max(env(safe-area-inset-bottom),0.25rem)] font-vazir select-none overflow-hidden"
        dir="rtl"
        aria-label="منوی دسترسی موبایل"
      >
        <div className="grid grid-cols-5 items-stretch max-w-lg mx-auto">
          
          {/* Tab 1: خانه (Home) */}
          <button
            type="button"
            onClick={handleGoHome}
            className={`h-12 flex flex-col items-center justify-center gap-1 rounded-xl transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.88] cursor-pointer ${
              isHomeActive 
                ? 'text-[#0066CC] font-bold' 
                : 'text-[#6E6E73] hover:text-[#1D1D1F] font-medium'
            }`}
          >
            <span className="flex h-6 w-6 items-center justify-center shrink-0">
              <Home size={19} strokeWidth={isHomeActive ? 2.2 : 1.85} className="block" />
            </span>
            <span className="text-[10px] leading-none whitespace-nowrap">خانه</span>
          </button>

          {/* Tab 2: دسته‌بندی‌ها (Categories) */}
          <button
            type="button"
            onClick={() => setCollectionSheetOpen(true)}
            className={`relative h-12 flex flex-col items-center justify-center gap-1 rounded-xl transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.88] cursor-pointer ${
              isCollectionActive 
                ? 'text-[#0066CC] font-bold' 
                : 'text-[#6E6E73] hover:text-[#1D1D1F] font-medium'
            }`}
          >
            <span className="relative flex h-6 w-6 items-center justify-center shrink-0">
              <LayoutGrid size={19} strokeWidth={isCollectionActive ? 2.2 : 1.85} className="block" />
              {selectedCategory !== 'all' && (
                <span className="absolute -top-0.5 -end-0.5 h-1.5 w-1.5 rounded-full bg-[#0066CC] ring-2 ring-[#FBFBFC]" />
              )}
            </span>
            <span className="text-[10px] leading-none whitespace-nowrap">دسته‌بندی‌ها</span>
          </button>

          {/* Tab 3: دکمه مرکزی ثبت آگهی (Post Ad — aligned on exact same baseline) */}
          <button
            type="button"
            onClick={onOpenPostAd}
            className="h-12 flex flex-col items-center justify-center gap-1 rounded-xl text-[#1D1D1F] font-bold cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.88]"
            title="ثبت رایگان آگهی"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0066CC] text-[#FBFBFC] shrink-0">
              <Plus size={14} strokeWidth={2.5} className="block" />
            </span>
            <span className="text-[10px] leading-none whitespace-nowrap">ثبت آگهی</span>
          </button>

          {/* Tab 4: مدیریت آگهی (Manage Ad) */}
          <button
            type="button"
            onClick={onOpenManageAd}
            className="h-12 flex flex-col items-center justify-center gap-1 rounded-xl text-[#6E6E73] hover:text-[#1D1D1F] font-medium transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.88] cursor-pointer"
            title="مدیریت یا حذف آگهی با کد امنیتی"
          >
            <span className="flex h-6 w-6 items-center justify-center shrink-0">
              <KeyRound size={19} strokeWidth={1.85} className="block" />
            </span>
            <span className="text-[10px] leading-none whitespace-nowrap">مدیریت</span>
          </button>

          {/* Tab 5: بیشتر (More) */}
          <button
            type="button"
            onClick={() => {
              setCollectionSheetOpen(false);
              setMoreSheetOpen(true);
            }}
            className={`h-12 flex flex-col items-center justify-center gap-1 rounded-xl transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.88] cursor-pointer ${
              moreSheetOpen
                ? 'text-[#0066CC] font-bold'
                : 'text-[#6E6E73] hover:text-[#1D1D1F] font-medium'
            }`}
            title="امکانات بیشتر"
          >
            <span className="flex h-6 w-6 items-center justify-center shrink-0">
              <MoreHorizontal size={19} strokeWidth={moreSheetOpen ? 2.2 : 1.85} className="block" />
            </span>
            <span className="text-[10px] leading-none whitespace-nowrap">بیشتر</span>
          </button>

        </div>
      </nav>

      {/* 2. Collections Bottom Sheet Drawer (Always mounted for Apple spring open/close) */}
      <div
        className={`fixed inset-0 z-50 flex flex-col justify-end md:hidden font-vazir transition-[visibility] duration-300 ${
          collectionSheetOpen ? 'pointer-events-auto visible' : 'pointer-events-none invisible'
        }`}
        dir="rtl"
        aria-hidden={!collectionSheetOpen}
      >
        {/* Backdrop Overlay */}
        <div
          className={`fixed inset-0 bg-slate-950/55 backdrop-blur-xs transition-opacity duration-300 ease-out ${
            collectionSheetOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setCollectionSheetOpen(false)}
        />

        {/* Bottom Sheet Card */}
        <div
          className={`relative w-full bg-[#FBFBFC] dark:bg-[#171920] rounded-t-[28px] border-t border-[#ECEFF4] dark:border-white/[0.05] p-5 pb-8 space-y-4 shadow-2xl z-10 max-h-[85vh] overflow-y-auto custom-scrollbar transform transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform ${
            collectionSheetOpen ? 'translate-y-0' : 'translate-y-full'
          }`}
        >
            
            {/* Grab Handle Pill */}
            <div className="w-12 h-1.5 bg-slate-300 dark:bg-white/10 rounded-full mx-auto mb-2 shrink-0" />

            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#F0F2F5] dark:border-white/[0.038]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F5F5F7] text-[#6E6E73]">
                  <LayoutGrid size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-950">
                    دسته‌بندی‌های نیازمندی‌ها
                  </h3>
                  <span className="text-[11px] text-slate-500 font-medium">
                    دسته‌بندی موضوعی آگهی‌های جامعه فارسی‌زبانان اروپا
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCollectionSheetOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Collections Grid */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              {CATEGORIES.map(cat => {
                const meta = CATEGORY_META[cat.id] || CATEGORY_META.ovrigt;
                const IconComponent = meta.Icon;
                const isSelected = selectedCategory === cat.id;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategoryClick(cat.id)}
                    className={`flex items-center justify-between p-3 rounded-2xl border text-right transition-all cursor-pointer active:scale-[0.98] ${
                      isSelected
                        ? 'border-[#1877F2] bg-blue-50/80 shadow-2xs ring-1 ring-[#1877F2]'
                        : 'border-slate-200/80 bg-slate-50/60 hover:bg-slate-100/80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-xl border shrink-0 ${meta.bg}`}>
                        <IconComponent size={17} strokeWidth={2} className="block" />
                      </div>
                      <span className={`text-xs leading-none truncate ${isSelected ? 'font-black text-blue-900' : 'font-bold text-slate-800'}`}>
                        {cat.fa}
                      </span>
                    </div>

                    {isSelected && (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1877F2] text-white shrink-0 ms-1">
                        <Check size={11} strokeWidth={2.75} className="block" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Bottom Actions within sheet */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <button
                type="button"
                onClick={() => {
                  setCollectionSheetOpen(false);
                  onOpenCountryModal?.();
                }}
                className="inline-flex items-center gap-1.5 hover:text-blue-600 transition-colors cursor-pointer font-medium leading-none"
              >
                <span className="flex h-4 w-4 items-center justify-center shrink-0">
                  <Globe size={14} strokeWidth={2} className="block text-slate-400" />
                </span>
                <span className="leading-none">تغییر کشور ({currentCountryObj.nameFa})</span>
              </button>
            </div>

          </div>
        </div>

      {/* 3. More ("بیشتر") Bottom Sheet Drawer for Future Features & Settings */}
      <div
        className={`fixed inset-0 z-50 flex flex-col justify-end md:hidden font-vazir transition-[visibility] duration-300 ${
          moreSheetOpen ? 'pointer-events-auto visible' : 'pointer-events-none invisible'
        }`}
        dir="rtl"
        aria-hidden={!moreSheetOpen}
      >
        <div
          className={`fixed inset-0 bg-[#1D1D1F]/55 transition-opacity duration-300 ease-out ${
            moreSheetOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setMoreSheetOpen(false)}
        />

        <div
          className={`relative w-full bg-[#FBFBFC] dark:bg-[#171920] rounded-t-[28px] border-t border-[#ECEFF4] dark:border-white/[0.05] p-5 pb-8 space-y-4 shadow-2xl z-10 max-h-[85vh] overflow-y-auto custom-scrollbar transform transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform ${
            moreSheetOpen ? 'translate-y-0' : 'translate-y-full'
          }`}
        >
          <div className="w-12 h-1.5 bg-[#D2D2D7] dark:bg-white/10 rounded-full mx-auto mb-2 shrink-0" />

          <div className="flex items-center justify-between pb-2 border-b border-[#F0F2F5] dark:border-white/[0.038]">
            <div>
              <h3 className="text-base font-black text-[#1D1D1F] dark:text-white">امکانات بیشتر</h3>
              <p className="text-[11px] text-[#6E6E73] dark:text-[#98989F]">بخش‌های کاربردی و سرویس‌های آینده</p>
            </div>
            <button
              type="button"
              onClick={() => setMoreSheetOpen(false)}
              className="p-2 rounded-full bg-[#F5F5F7] dark:bg-white/[0.06] text-[#515154] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          <div className="space-y-2">
            {/* Dark / Light Mode Toggle */}
            <button
              type="button"
              aria-pressed={theme === 'dark'}
              onClick={() => onToggleTheme?.()}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#F5F5F7] dark:bg-white/[0.04] hover:bg-[#ECECEF] dark:hover:bg-white/[0.08] border border-[#ECEFF4] dark:border-white/[0.05] transition-all active:scale-[0.98] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-[#FBFBFC] dark:bg-[#171920] text-[#0066CC] dark:text-[#388BFD] border border-[#ECEFF4] dark:border-white/[0.05] flex items-center justify-center shrink-0">
                  {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                </div>
                <div className="text-right">
                  <span className="block text-[13px] font-bold text-[#1D1D1F]">حالت تاریک / روشن</span>
                  <span className="block text-[11px] text-[#6E6E73]">
                    {theme === 'dark' ? 'ظاهر تاریک فعال است' : 'ظاهر روشن فعال است'}
                  </span>
                </div>
              </div>
              <span
                aria-hidden="true"
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${
                  theme === 'dark' ? 'bg-[#0066CC]' : 'bg-[#D2D2D7]'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-[#ffffff] shadow-2xs transition-transform ${
                    theme === 'dark' ? '-translate-x-5' : 'translate-x-0'
                  }`}
                />
              </span>
            </button>

            {/* Country Switcher */}
            <button
              type="button"
              onClick={() => {
                setMoreSheetOpen(false);
                onOpenCountryModal?.();
              }}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#F5F5F7] hover:bg-[#ECECEF] border border-[#E5E5EA] transition-all active:scale-[0.98] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-[#F5F5F7] text-[#6E6E73] flex items-center justify-center">
                  <Globe size={18} />
                </div>
                <div className="text-right">
                  <span className="block text-[13px] font-bold text-[#1D1D1F]">تغییر کشور</span>
                  <span className="block text-[11px] text-[#6E6E73]">کشور فعلی: {currentCountryObj.nameFa}</span>
                </div>
              </div>
              <ChevronLeft size={16} className="text-[#6E6E73]" />
            </button>

            {/* GDPR & Cookies */}
            <button
              type="button"
              onClick={() => {
                setMoreSheetOpen(false);
                onOpenLegal?.('privacy');
              }}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#F5F5F7] hover:bg-[#ECECEF] border border-[#E5E5EA] transition-all active:scale-[0.98] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-[#F5F5F7] text-[#6E6E73] flex items-center justify-center">
                  <ShieldCheck size={18} />
                </div>
                <div className="text-right">
                  <span className="block text-[13px] font-bold text-[#1D1D1F]">حریم خصوصی و کوکی‌ها</span>
                  <span className="block text-[11px] text-[#6E6E73]">تنظیمات GDPR و سیاست کوکی‌ها</span>
                </div>
              </div>
              <ChevronLeft size={16} className="text-[#6E6E73]" />
            </button>

            {/* Upcoming Future Services */}
            <div className="pt-2 space-y-2">
              <span className="block text-[11px] font-bold text-[#6E6E73] px-1">سرویس‌های آینده</span>

              <button
                type="button"
                onClick={() => {
                  setMoreSheetOpen(false);
                  onOpenPodcast?.();
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-rose-50/70 hover:bg-rose-100/70 border border-rose-200/80 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-rose-600 text-white flex items-center justify-center">
                    <Headphones size={18} />
                  </div>
                  <div className="text-right">
                    <span className="block text-[13px] font-bold text-[#1D1D1F]">پادکست خبری</span>
                    <span className="block text-[11px] text-[#6E6E73]">فید خبری و ویدیوهای یوتیوب</span>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold">
                  پخش
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
