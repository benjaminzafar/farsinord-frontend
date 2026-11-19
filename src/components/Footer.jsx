import React, { useState } from 'react';
import {
  PlusCircle,
  KeyRound,
  Globe,
  Send,
  MessageCircle,
  Mail,
} from 'lucide-react';
import { CATEGORIES } from '../lib/translations';

const currentYear = new Date().getFullYear();

const InstagramIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="block">
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

const YoutubeIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="block">
    <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
    <path d="m10 15 5-3-5-3z" />
  </svg>
);

const LinkedinIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="block">
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect width="4" height="12" x="2" y="9" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

function buildSocialHref(type, raw) {
  if (!raw || typeof raw !== 'string') return '';
  const val = raw.trim();
  if (!val) return '';
  if (/^(javascript|data|vbscript):/i.test(val)) return '';
  if (/^https?:\/\//i.test(val)) return val;

  if (type === 'instagram') {
    return `https://instagram.com/${val.replace(/^@/, '')}`;
  }
  if (type === 'telegram') {
    return `https://t.me/${val.replace(/^@/, '')}`;
  }
  if (type === 'whatsapp') {
    const digits = val.replace(/[^0-9]/g, '');
    return digits ? `https://wa.me/${digits}` : '';
  }
  if (type === 'youtube') {
    return val.startsWith('@') ? `https://youtube.com/${val}` : `https://${val}`;
  }
  if (type === 'linkedin') {
    return `https://${val.replace(/^\/+/, '')}`;
  }
  if (type === 'email') {
    return `mailto:${val}`;
  }
  return `https://${val}`;
}

export default function Footer({ 
  siteName = 'لینک شو',
  logoUrl = '',
  brandingReady = true,
  socialLinks = {},
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

  const socialItems = [
    {
      id: 'instagram',
      label: 'اینستاگرام',
      Icon: InstagramIcon,
      href: buildSocialHref('instagram', socialLinks?.instagram),
    },
    {
      id: 'telegram',
      label: 'تلگرام',
      Icon: Send,
      href: buildSocialHref('telegram', socialLinks?.telegram),
    },
    {
      id: 'whatsapp',
      label: 'واتساپ',
      Icon: MessageCircle,
      href: buildSocialHref('whatsapp', socialLinks?.whatsapp),
    },
    {
      id: 'youtube',
      label: 'یوتیوب',
      Icon: YoutubeIcon,
      href: buildSocialHref('youtube', socialLinks?.youtube),
    },
    {
      id: 'linkedin',
      label: 'لینکدین',
      Icon: LinkedinIcon,
      href: buildSocialHref('linkedin', socialLinks?.linkedin),
    },
    {
      id: 'email',
      label: 'ایمیل',
      Icon: Mail,
      href: buildSocialHref('email', socialLinks?.email),
    },
  ].filter(item => Boolean(item.href));

  return (
    <footer className="border-t border-[#E5E5EA] bg-[#FBFBFC] pt-10 pb-12 md:pb-8 text-[#515154] text-xs select-none font-vazir" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Main Footer Grid: Brand + Socials on Right, Navigation & Legal Columns on Left */}
        <div className="grid grid-cols-2 md:grid-cols-12 gap-8">
          
          {/* Column 1 (4 cols on desktop): Brand Logo + Slogan + Social Media Icons Under Logo */}
          <div className="col-span-2 md:col-span-4 space-y-3.5">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5" aria-label={siteName}>
                {logoUrl && failedLogoUrl !== logoUrl ? (
                  <img 
                    src={logoUrl} 
                    alt="" 
                    loading="lazy"
                    decoding="async"
                    className="h-7 w-auto max-w-[115px] object-contain"
                    onError={() => setFailedLogoUrl(logoUrl)}
                  />
                ) : brandingReady ? (
                  <span className="font-black text-lg text-[#1D1D1F] tracking-tight">{siteName}</span>
                ) : (
                  <span className="inline-block h-7 w-24 rounded-lg bg-[#ECECEF]/80 animate-pulse" aria-hidden="true" />
                )}
              </div>
              <p className="text-xs font-medium text-[#6E6E73]">
                محل رشد کسب و کار فارسی‌زبانان
              </p>
            </div>

            {/* Social Media Icons Directly Under Logo & Slogan */}
            {socialItems.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {socialItems.map(({ id, label, Icon, href }) => (
                  <a
                    key={id}
                    href={href}
                    target={id === 'email' ? undefined : '_blank'}
                    rel={id === 'email' ? undefined : 'noopener noreferrer'}
                    title={label}
                    aria-label={label}
                    className="h-9 w-9 rounded-full bg-[#F5F5F7] hover:bg-[#EBEBF0] border border-[#E5E5EA] text-[#6E6E73] hover:text-[#1D1D1F] flex items-center justify-center transition-colors active:scale-95"
                  >
                    <Icon size={15} className="block" />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Column 2 (2 cols): دسته‌بندی‌ها */}
          <div className="col-span-1 md:col-span-2 space-y-3">
            <h4 className="font-extrabold text-[#1D1D1F] text-xs">
              دسته‌بندی‌ها
            </h4>
            <ul className="space-y-1.5 text-xs text-[#6E6E73]">
              {primaryCategories.map(cat => (
                <li key={cat.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectCategory?.(cat.id);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="py-1 hover:text-[#1D1D1F] transition-colors text-right cursor-pointer"
                  >
                    {cat.fa}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3 (2 cols): سایر بخش‌ها */}
          <div className="col-span-1 md:col-span-2 space-y-3">
            <h4 className="font-extrabold text-[#1D1D1F] text-xs">
              سایر بخش‌ها
            </h4>
            <ul className="space-y-1.5 text-xs text-[#6E6E73]">
              {secondaryCategories.map(cat => (
                <li key={cat.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectCategory?.(cat.id);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="py-1 hover:text-[#1D1D1F] transition-colors text-right cursor-pointer"
                  >
                    {cat.fa}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4 (2 cols): ثبت و مدیریت */}
          <div className="col-span-1 md:col-span-2 space-y-3">
            <h4 className="font-extrabold text-[#1D1D1F] text-xs">
              ثبت و مدیریت
            </h4>
            <ul className="space-y-1.5 text-xs text-[#6E6E73]">
              {onOpenPostAd && (
                <li>
                  <button
                    type="button"
                    onClick={onOpenPostAd}
                    className="py-1 inline-flex items-center gap-2 leading-none hover:text-[#1D1D1F] transition-colors cursor-pointer"
                  >
                    <PlusCircle size={14} strokeWidth={2} className="block text-[#86868B] shrink-0" />
                    <span className="leading-none">ثبت آگهی رایگان</span>
                  </button>
                </li>
              )}
              {onOpenManageAd && (
                <li>
                  <button
                    type="button"
                    onClick={onOpenManageAd}
                    className="py-1 inline-flex items-center gap-2 leading-none hover:text-[#1D1D1F] transition-colors cursor-pointer"
                  >
                    <KeyRound size={14} strokeWidth={2} className="block text-[#86868B] shrink-0" />
                    <span className="leading-none">مدیریت آگهی</span>
                  </button>
                </li>
              )}
              {onOpenCountryModal && (
                <li>
                  <button
                    type="button"
                    onClick={onOpenCountryModal}
                    className="py-1 inline-flex items-center gap-2 leading-none hover:text-[#1D1D1F] transition-colors cursor-pointer"
                  >
                    <Globe size={14} strokeWidth={2} className="block text-[#86868B] shrink-0" />
                    <span className="leading-none">کشور ({selectedCountryObj?.nameFa || 'انتخاب'})</span>
                  </button>
                </li>
              )}
            </ul>
          </div>

          {/* Column 5 (2 cols): قوانین و حریم خصوصی */}
          <div className="col-span-1 md:col-span-2 space-y-3">
            <h4 className="font-extrabold text-[#1D1D1F] text-xs">
              قوانین و حریم خصوصی
            </h4>
            <ul className="space-y-1.5 text-xs text-[#6E6E73]">
              <li>
                <button
                  type="button"
                  onClick={() => onOpenLegal?.('privacy')}
                  className="py-1 hover:text-[#1D1D1F] transition-colors text-right cursor-pointer"
                >
                  حریم خصوصی
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenLegal?.('cookies')}
                  className="py-1 hover:text-[#1D1D1F] transition-colors text-right cursor-pointer"
                >
                  سیاست کوکی‌ها
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenLegal?.('settings')}
                  className="py-1 hover:text-[#1D1D1F] transition-colors text-right cursor-pointer"
                >
                  تنظیمات کوکی‌ها
                </button>
              </li>
              <li>
                <a
                  href="/sitemap-index.xml"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-1 hover:text-[#1D1D1F] transition-colors inline-block"
                >
                  نقشه سایت
                </a>
              </li>
            </ul>
          </div>

        </div>

        {/* Clean Minimal Bottom Copyright Bar — Text Only */}
        <div className="border-t border-[#E5E5EA] pt-5 text-center text-[11px] text-[#86868B]">
          © {currentYear} {siteName} • تمامی حقوق محفوظ است.
        </div>

      </div>
    </footer>
  );
}
