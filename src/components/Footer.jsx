import React, { useState } from 'react';
import { ShieldCheck, PlusCircle, KeyRound, Globe, ChevronDown } from 'lucide-react';
import { CATEGORIES } from '../lib/translations';

const currentYear = new Date().getFullYear();

export default function Footer({ 
  siteName = 'لینک شو',
  logoUrl = '',
  selectedCountryObj = null,
  onOpenCountryModal,
  onSelectCategory, 
  onSelectCity, 
  onOpenPostAd,
  onOpenManageAd,
  onOpenLegal
}) {
  const [failedLogoUrl, setFailedLogoUrl] = useState('');

  const allCategories = CATEGORIES.filter(c => c.id !== 'all');
  const activeCountryCities = (selectedCountryObj?.cities || [])
    .filter(c => c.id !== 'all')
    .slice(0, 6);

  return (
    <footer className="border-t border-[#E5E5EA] bg-[#FBFBFC] pt-10 pb-8 text-[#515154] text-xs select-none font-vazir" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Brand Header & Concise Professional Introduction */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#E5E5EA]">
          <div className="space-y-1.5 max-w-xl">
            <div className="flex items-center gap-3">
              {logoUrl && failedLogoUrl !== logoUrl ? (
                <img 
                  src={logoUrl} 
                  alt={siteName} 
                  className="h-9 w-auto max-w-[155px] object-contain"
                  onError={() => setFailedLogoUrl(logoUrl)}
                />
              ) : (
                <span className="font-black text-base text-[#1D1D1F] tracking-tight">{siteName}</span>
              )}
              <span className="text-[11px] font-semibold text-[#86868B]">
                • نیازمندی‌های فارسی‌زبانان اسکاندیناوی
              </span>
            </div>
            <p className="text-xs text-[#6E6E73] leading-relaxed">
              پلتفرم تخصصی ثبت و جستجوی مستقیم آگهی‌های مسکن، رستوران، کاریابی، خدمات و کسب‌وکارهای فارسی‌زبان در سوئد، نروژ، دانمارک و فنلاند.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#6E6E73] shrink-0">
            <span>سوئد • نروژ • دانمارک • فنلاند</span>
            {onOpenCountryModal && (
              <button
                type="button"
                onClick={onOpenCountryModal}
                className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-[#F5F5F7] hover:bg-[#ECECEF] border border-[#E5E5EA] text-[#1D1D1F] text-xs font-bold transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.95] cursor-pointer"
                title="تغییر کشور"
              >
                <Globe size={13.5} className="text-[#86868B]" />
                <span>{selectedCountryObj?.nameFa || 'انتخاب کشور'}</span>
                <ChevronDown size={12} className="text-[#86868B]" />
              </button>
            )}
          </div>
        </div>

        {/* 4-Column Footer Grid */}
        <div className="grid grid-cols-2 md:grid-cols-12 gap-6 sm:gap-8">
          
          {/* Column 1: دسته‌بندی آگهی‌ها (All 9 Categories in 2 sub-columns) */}
          <div className="col-span-2 sm:col-span-1 md:col-span-4 space-y-3">
            <h4 className="font-extrabold text-[#1D1D1F] text-xs">
              دسته‌بندی آگهی‌ها
            </h4>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-[#6E6E73]">
              {allCategories.map(cat => (
                <li key={cat.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectCategory?.(cat.id);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="hover:text-[#1D1D1F] transition-colors text-right cursor-pointer"
                  >
                    {cat.fa}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 2: شهرهای کشور انتخاب‌شده */}
          <div className="col-span-1 md:col-span-3 space-y-3">
            <h4 className="font-extrabold text-[#1D1D1F] text-xs">
              شهرهای {selectedCountryObj?.nameFa || 'اسکاندیناوی'}
            </h4>
            <ul className="space-y-2 text-xs text-[#6E6E73]">
              {activeCountryCities.map(city => (
                <li key={city.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectCity?.(city.id);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="hover:text-[#1D1D1F] transition-colors text-right cursor-pointer"
                  >
                    {city.fa}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: دسترسی سریع و مدیریت */}
          <div className="col-span-1 md:col-span-2 space-y-3">
            <h4 className="font-extrabold text-[#1D1D1F] text-xs">
              ثبت و مدیریت
            </h4>
            <ul className="space-y-2.5 text-xs text-[#6E6E73]">
              {onOpenPostAd && (
                <li>
                  <button
                    type="button"
                    onClick={onOpenPostAd}
                    className="flex items-center gap-1.5 hover:text-[#1D1D1F] transition-colors cursor-pointer"
                  >
                    <PlusCircle size={13} className="text-[#86868B] shrink-0" />
                    <span>ثبت رایگان آگهی</span>
                  </button>
                </li>
              )}
              {onOpenManageAd && (
                <li>
                  <button
                    type="button"
                    onClick={onOpenManageAd}
                    className="flex items-center gap-1.5 hover:text-[#1D1D1F] transition-colors cursor-pointer"
                  >
                    <KeyRound size={13} className="text-[#86868B] shrink-0" />
                    <span>ویرایش و مدیریت آگهی</span>
                  </button>
                </li>
              )}
            </ul>
          </div>

          {/* Column 4: امنیت و راهنمای معاملات */}
          <div className="col-span-2 md:col-span-3 space-y-3">
            <h4 className="font-extrabold text-[#1D1D1F] text-xs">
              معاملات مستقیم و امن
            </h4>
            <div className="space-y-1.5 text-xs leading-relaxed">
              <div className="flex items-center gap-1.5 font-semibold text-[#1D1D1F]">
                <ShieldCheck size={14} className="text-[#86868B] shrink-0" />
                <span>بدون واسطه و بدون نیاز به ثبت‌نام</span>
              </div>
              <p className="text-[#6E6E73] text-[11px] leading-relaxed">
                هر آگهی پس از ثبت دارای کد پیگیری و پین امنیتی ۶ کاراکتری اختصاصی جهت ویرایش یا حذف فوری در هر زمان است.
              </p>
            </div>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="border-t border-[#E5E5EA] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-[#86868B]">
          <div>
            © {currentYear} {siteName} • مرجع نیازمندی‌های فارسی‌زبانان اسکاندیناوی
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] font-semibold text-[#6E6E73]">
            <button
              type="button"
              onClick={() => onOpenLegal?.('privacy')}
              className="hover:text-[#1D1D1F] transition-colors cursor-pointer"
            >
              حریم خصوصی (GDPR)
            </button>
            <button
              type="button"
              onClick={() => onOpenLegal?.('cookies')}
              className="hover:text-[#1D1D1F] transition-colors cursor-pointer"
            >
              سیاست کوکی‌ها
            </button>
            <button
              type="button"
              onClick={() => onOpenLegal?.('settings')}
              className="hover:text-[#1D1D1F] transition-colors cursor-pointer"
            >
              تنظیمات کوکی‌ها
            </button>
          </div>
        </div>

      </div>
    </footer>
  );
}
