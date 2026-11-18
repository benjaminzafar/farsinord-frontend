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
  onOpenPostAd,
  onOpenManageAd,
  onOpenLegal
}) {
  const [failedLogoUrl, setFailedLogoUrl] = useState('');

  const allCategories = CATEGORIES.filter(c => c.id !== 'all');
  const primaryCategories = allCategories.slice(0, 5);
  const secondaryCategories = allCategories.slice(5);

  return (
    <footer className="border-t border-[#E5E5EA] bg-[#FBFBFC] pt-10 pb-8 text-[#515154] text-xs select-none font-vazir" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Brand Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E5E5EA]">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
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
            </div>
            <p className="text-xs font-medium text-[#6E6E73]">
              محل رشد کسب و کار فارسی‌زبانان
            </p>
          </div>
          
          {onOpenCountryModal && (
            <div className="flex items-center shrink-0">
              <button
                type="button"
                onClick={onOpenCountryModal}
                className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-[#F5F5F7] hover:bg-[#ECECEF] border border-[#E5E5EA] text-[#1D1D1F] text-xs font-bold transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.95] cursor-pointer"
                title="تغییر موقعیت"
              >
                <Globe size={13.5} className="text-[#86868B]" />
                <span>{selectedCountryObj?.nameFa || 'انتخاب موقعیت'}</span>
                <ChevronDown size={12} className="text-[#86868B]" />
              </button>
            </div>
          )}
        </div>

        {/* 4-Column Universal Footer Grid (Not restricted to specific countries) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
          
          {/* Column 1: دسته‌بندی‌های اصلی */}
          <div className="space-y-3">
            <h4 className="font-extrabold text-[#1D1D1F] text-xs">
              دسته‌بندی‌ها
            </h4>
            <ul className="space-y-2 text-xs text-[#6E6E73]">
              {primaryCategories.map(cat => (
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

          {/* Column 2: سایر دسته‌بندی‌ها */}
          <div className="space-y-3">
            <h4 className="font-extrabold text-[#1D1D1F] text-xs">
              سایر بخش‌ها
            </h4>
            <ul className="space-y-2 text-xs text-[#6E6E73]">
              {secondaryCategories.map(cat => (
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

          {/* Column 3: ثبت و مدیریت */}
          <div className="space-y-3">
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
          <div className="space-y-3">
            <h4 className="font-extrabold text-[#1D1D1F] text-xs">
              معاملات مستقیم و امن
            </h4>
            <div className="space-y-1.5 text-xs leading-relaxed">
              <div className="flex items-center gap-1.5 font-semibold text-[#1D1D1F]">
                <ShieldCheck size={14} className="text-[#86868B] shrink-0" />
                <span>ارتباط مستقیم و بی‌واسطه</span>
              </div>
              <p className="text-[#6E6E73] text-[11px] leading-relaxed">
                هر آگهی پس از ثبت دارای کد پیگیری و پین امنیتی ۶ کاراکتری اختصاصی جهت ویرایش یا حذف در هر زمان است.
              </p>
            </div>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="border-t border-[#E5E5EA] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-[#86868B]">
          <div>
            © {currentYear} {siteName} • محل رشد کسب و کار فارسی‌زبانان
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
