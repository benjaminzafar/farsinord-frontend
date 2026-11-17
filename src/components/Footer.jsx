import React from 'react';
import { ShieldCheck, PlusCircle, KeyRound, Globe, ChevronDown } from 'lucide-react';
import { CATEGORIES } from '../lib/translations';

const currentYear = new Date().getFullYear();

export default function Footer({ 
  siteName = 'فارسی نورد',
  logoUrl = '',
  selectedCountryObj = null,
  onOpenCountryModal,
  onSelectCategory, 
  onSelectCity, 
  onOpenPostAd,
  onOpenManageAd,
  onOpenLegal
}) {
  // Scandinavian cities without emoji flags to prevent Windows raw ISO code rendering
  const scandiCities = [
    { name: 'استکهلم (سوئد)', id: 'Stockholm' },
    { name: 'اسلو (نروژ)', id: 'Oslo' },
    { name: 'کپنهاگ (دانمارک)', id: 'København' },
    { name: 'گوتنبرگ (سوئد)', id: 'Göteborg' },
    { name: 'مالمو (سوئد)', id: 'Malmö' },
    { name: 'هلسینکی (فنلاند)', id: 'Helsinki' },
  ];

  return (
    <footer className="border-t border-[#E5E5EA] bg-[#FBFBFC] pt-10 pb-8 text-[#515154] text-xs select-none font-vazir" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Brand Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img 
                src={logoUrl} 
                alt={siteName} 
                className="h-9 w-auto max-w-[155px] object-contain"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#0066CC] text-white font-extrabold text-xs">
                  <span className="font-mono">FN</span>
                </div>
                <span className="font-extrabold text-base text-[#1D1D1F] tracking-tight">{siteName}</span>
              </>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#515154]">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
              <span>پوشش ۴ کشور: سوئد • نروژ • دانمارک • فنلاند</span>
            </div>
            {onOpenCountryModal && (
              <button
                type="button"
                onClick={onOpenCountryModal}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-[#F5F5F7] hover:bg-[#ECECEF] border border-[#E5E5EA] text-[#1D1D1F] text-xs font-bold transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.95] cursor-pointer"
                title="تغییر کشور"
              >
                <Globe size={13.5} className="text-[#0066CC]" />
                <span>{selectedCountryObj?.nameFa || 'انتخاب کشور'}</span>
                <ChevronDown size={12} className="text-[#6E6E73]" />
              </button>
            )}
          </div>
        </div>

        {/* 2x2 Grid on Mobile, 4 Columns on Desktop */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
          
          {/* Column 1: دسته‌های پرطرفدار */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600 shrink-0" />
              <span>دسته‌های پرطرفدار</span>
            </h4>
            <ul className="space-y-2 text-xs">
              {CATEGORIES.slice(1, 6).map(cat => (
                <li key={cat.id}>
                  <button
                    type="button"
                    onClick={() => onSelectCategory?.(cat.id)}
                    className="hover:text-blue-600 transition-colors text-right cursor-pointer"
                  >
                    {cat.fa}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 2: شهرهای اسکاندیناوی */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600 shrink-0" />
              <span>شهرهای اصلی</span>
            </h4>
            <ul className="space-y-2 text-xs">
              {scandiCities.map(city => (
                <li key={city.id}>
                  <button
                    type="button"
                    onClick={() => onSelectCity?.(city.id)}
                    className="hover:text-blue-600 transition-colors text-right cursor-pointer"
                  >
                    {city.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: دسترسی سریع و مدیریت */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600 shrink-0" />
              <span>دسترسی و مدیریت</span>
            </h4>
            <ul className="space-y-2 text-xs">
              {onOpenPostAd && (
                <li>
                  <button
                    type="button"
                    onClick={onOpenPostAd}
                    className="flex items-center gap-1.5 text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
                  >
                    <PlusCircle size={13} className="text-blue-500 shrink-0" />
                    <span>ثبت رایگان آگهی</span>
                  </button>
                </li>
              )}
              {onOpenManageAd && (
                <li>
                  <button
                    type="button"
                    onClick={onOpenManageAd}
                    className="flex items-center gap-1.5 text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
                  >
                    <KeyRound size={13} className="text-amber-500 shrink-0" />
                    <span>مدیریت با پین کد</span>
                  </button>
                </li>
              )}
            </ul>
          </div>

          {/* Column 4: امنیت و راهنمای معاملات */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 shrink-0" />
              <span>معاملات امن</span>
            </h4>
            <div className="space-y-1.5 text-xs leading-relaxed">
              <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
                <span>ارتباط مستقیم و بی‌واسطه</span>
              </div>
              <p className="text-slate-500 text-[11px]">
                هر آگهی دارای کد پیگیری اختصاصی و کد امنیتی ۶ کاراکتری برای ویرایش یا حذف در هر زمان است.
              </p>
            </div>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="border-t border-slate-100 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400">
          <div>
            © {currentYear} {siteName} • سامانه نیازمندی‌های فارسی‌زبانان اسکاندیناوی
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] font-semibold text-[#515154]">
            <button
              type="button"
              onClick={() => onOpenLegal?.('privacy')}
              className="hover:text-[#0066CC] transition-colors cursor-pointer"
            >
              حریم خصوصی (GDPR)
            </button>
            <button
              type="button"
              onClick={() => onOpenLegal?.('cookies')}
              className="hover:text-[#0066CC] transition-colors cursor-pointer"
            >
              سیاست کوکی‌ها
            </button>
            <button
              type="button"
              onClick={() => onOpenLegal?.('settings')}
              className="hover:text-[#0066CC] transition-colors cursor-pointer"
            >
              تنظیمات کوکی‌ها
            </button>
            <span className="hidden md:inline text-[#6E6E73]">سوئد • نروژ • دانمارک • فنلاند</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
