import React, { useState, useEffect } from 'react';
import { MapPin, X, Check, Globe, ArrowLeft, ShieldCheck, Cookie, SlidersHorizontal } from 'lucide-react';
import { COUNTRIES } from '../lib/translations';
import { getGdprConsent, saveGdprConsent } from '../lib/gdpr';

function detectBrowserCountry() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (tz.includes('Oslo')) return 'no';
    if (tz.includes('Copenhagen')) return 'dk';
    if (tz.includes('Helsinki')) return 'fi';
    if (tz.includes('Stockholm')) return 'se';
    const langs = navigator.languages || [navigator.language || ''];
    if (langs.some(l => l.startsWith('nb') || l.startsWith('nn') || l.startsWith('no'))) return 'no';
    if (langs.some(l => l.startsWith('da'))) return 'dk';
    if (langs.some(l => l.startsWith('fi'))) return 'fi';
  } catch {}
  return 'se';
}

export default function CountryBanner({
  isOpen,
  onClose,
  selectedCountry,
  onSelectCountry,
  onOpenLegal,
  onConsentSaved,
}) {
  const [detectedCountryId, setDetectedCountryId] = useState(detectBrowserCountry);
  const [activeChoice, setActiveChoice] = useState(() => {
    if (selectedCountry && selectedCountry !== 'all') return selectedCountry;
    return detectBrowserCountry();
  });

  const existingConsent = getGdprConsent();
  const [hasConsented, setHasConsented] = useState(() => Boolean(existingConsent?.accepted));
  const [gdprChecked, setGdprChecked] = useState(() => Boolean(existingConsent?.accepted));
  const [analyticsChecked, setAnalyticsChecked] = useState(() => Boolean(existingConsent?.analytics));
  const [gdprError, setGdprError] = useState(false);

  // Sync consent state whenever modal opens
  useEffect(() => {
    if (isOpen) {
      const latest = getGdprConsent();
      setHasConsented(Boolean(latest?.accepted));
      setGdprChecked(Boolean(latest?.accepted));
      setAnalyticsChecked(Boolean(latest?.analytics));
      setGdprError(false);
    }
  }, [isOpen]);

  // Progressive IP check (async only)
  useEffect(() => {
    let active = true;
    fetch('https://api.country.is/')
      .then(res => res.json())
      .then(data => {
        if (!active || !data || !data.country) return;
        const code = data.country.toLowerCase();
        if (['se', 'no', 'dk', 'fi'].includes(code)) {
          setDetectedCountryId(code);
          if (!localStorage.getItem('scandi_country_selected')) {
            setActiveChoice(code);
          }
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const handleConfirm = (countryId) => {
    if (!gdprChecked) {
      setGdprError(true);
      return;
    }
    const finalId = countryId || activeChoice || 'se';
    setActiveChoice(finalId);
    const saved = saveGdprConsent({ analytics: analyticsChecked });
    setHasConsented(true);
    onConsentSaved?.(saved);
    if (onSelectCountry) onSelectCountry(finalId);
    localStorage.setItem('scandi_country_selected', finalId);
    localStorage.setItem('scandi_country_popup_seen', 'true');
    if (onClose) onClose();
  };

  const handleDismiss = () => {
    if (!hasConsented) {
      setGdprError(true);
      return;
    }
    localStorage.setItem('scandi_country_popup_seen', 'true');
    if (onClose) onClose();
  };

  // Close on Escape key only if GDPR consent was already granted
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && hasConsented) {
        localStorage.setItem('scandi_country_popup_seen', 'true');
        if (onClose) onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, hasConsented, onClose]);

  if (!isOpen) return null;

  const detectedObj = COUNTRIES.find(c => c.id === detectedCountryId) || COUNTRIES[0];
  const chosenObj = COUNTRIES.find(c => c.id === activeChoice) || COUNTRIES[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto font-vazir select-none" dir="rtl">

      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#1D1D1F]/60 transition-opacity duration-200"
        onClick={handleDismiss}
      />

      {/* Pop-Up Modal Card */}
      <div className="relative w-full max-w-md bg-[#FBFBFC] rounded-3xl shadow-[0_20px_60px_rgba(29,29,31,0.22)] border border-[#E5E5EA] overflow-hidden z-10 p-5 sm:p-7 space-y-4">

        {/* Close Button (shown after initial GDPR consent) */}
        {hasConsented && (
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute top-5 start-5 p-2 rounded-full text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#ECECEF] active:scale-95 transition-all cursor-pointer"
            title="بستن پنجره"
          >
            <X size={18} />
          </button>
        )}

        {/* Header */}
        <div className="text-center space-y-2 pt-1">
          <div className="inline-flex items-center justify-center h-11 w-11 rounded-2xl bg-[#0066CC]/10 text-[#0066CC] border border-[#0066CC]/15">
            <Globe size={22} />
          </div>

          <div className="space-y-1">
            <span className="text-[10.5px] font-bold text-[#0066CC] bg-[#0066CC]/10 px-2.5 py-0.5 rounded-full">
              پرتال جامع نیازمندی‌های فارسی‌زبانان اسکاندیناوی
            </span>
            <h2 className="text-lg sm:text-xl font-black text-[#1D1D1F] tracking-tight pt-1">
              انتخاب کشور و تایید قوانین (GDPR)
            </h2>
          </div>

          <div className="p-2 rounded-2xl bg-[#F5F5F7] border border-[#E5E5EA] text-xs text-[#515154] flex items-center justify-center gap-2">
            <MapPin size={14} className="text-[#0066CC] shrink-0" />
            <span>
              موقعیت شناسایی‌شده شما:{' '}
              <strong className="font-extrabold text-[#1D1D1F] mx-0.5 px-2 py-0.5 rounded-lg bg-[#FBFBFC] border border-[#E5E5EA]">
                {detectedObj.nameFa}
              </strong>
            </span>
          </div>
        </div>

        {/* 4 Scandinavian Countries Selection Grid */}
        <div className="grid grid-cols-2 gap-2">
          {COUNTRIES.map(country => {
            const isSelected = activeChoice === country.id;
            const isDetected = detectedCountryId === country.id;

            return (
              <button
                key={country.id}
                type="button"
                onClick={() => setActiveChoice(country.id)}
                className={`relative flex items-center justify-between p-3 rounded-2xl border text-right transition-all cursor-pointer active:scale-[0.98] ${
                  isSelected
                    ? 'border-[#0066CC] bg-[#0066CC]/6 ring-1 ring-[#0066CC]'
                    : 'border-[#E5E5EA] bg-[#FBFBFC] hover:bg-[#F5F5F7] hover:border-[#D2D2D7]'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[13.5px] font-bold ${isSelected ? 'text-[#0066CC]' : 'text-[#1D1D1F]'}`}>
                      {country.nameFa}
                    </span>
                    {isDetected && (
                      <span className="text-[9.5px] font-semibold px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800">
                        شما
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-[#6E6E73] font-medium block pt-0.5">
                    {country.nameNative}
                  </span>
                </div>

                <div className={`flex h-5 w-5 items-center justify-center rounded-full border transition-all shrink-0 ${
                  isSelected
                    ? 'border-[#0066CC] bg-[#0066CC] text-white'
                    : 'border-[#D2D2D7] bg-[#FBFBFC]'
                }`}>
                  {isSelected && <Check size={12} strokeWidth={3} />}
                </div>
              </button>
            );
          })}
        </div>

        {/* EU GDPR & Cookies Acceptance Box */}
        <div className={`p-3.5 rounded-2xl border space-y-2.5 transition-colors ${
          gdprError && !gdprChecked
            ? 'border-red-400 bg-red-50/70'
            : 'border-[#E5E5EA] bg-[#F5F5F7]'
        }`}>
          <label className="flex items-start gap-2.5 cursor-pointer text-xs leading-relaxed">
            <input
              type="checkbox"
              checked={gdprChecked}
              onChange={(e) => {
                setGdprChecked(e.target.checked);
                if (e.target.checked) setGdprError(false);
              }}
              className="mt-0.5 h-4 w-4 rounded border-[#D2D2D7] text-[#0066CC] focus:ring-[#0066CC] cursor-pointer shrink-0 accent-[#0066CC]"
            />
            <span className="text-[#1D1D1F] font-semibold">
              قوانین حفاظت از داده‌های اتحادیه اروپا (<span className="text-[#0066CC]">EU GDPR</span>) و کوکی‌های ضروری سایت را مطالعه کرده و می‌پذیرم.
              <span className="text-red-500 ms-1">*</span>
            </span>
          </label>

          <label className="flex items-start gap-2.5 cursor-pointer text-[11.5px] leading-relaxed">
            <input
              type="checkbox"
              checked={analyticsChecked}
              onChange={(e) => setAnalyticsChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-[#D2D2D7] text-[#0066CC] focus:ring-[#0066CC] cursor-pointer shrink-0 accent-[#0066CC]"
            />
            <span className="text-[#515154]">
              اجازه استفاده از کوکی‌های آمار و تحلیل (Google Analytics) برای بهبود تجربه کاربری (اختیاری)
            </span>
          </label>

          {gdprError && !gdprChecked && (
            <p className="text-[11px] font-bold text-red-600">
              برای ورود به سایت، لطفاً ابتدا کادر تایید قوانین EU GDPR را تیک بزنید.
            </p>
          )}

          {/* Quick links to Privacy Policy, Cookie Policy & Cookie Settings */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1.5 border-t border-[#E5E5EA] text-[11px] font-bold text-[#0066CC]">
            <button
              type="button"
              onClick={() => onOpenLegal?.('privacy')}
              className="inline-flex items-center gap-1 hover:underline cursor-pointer"
            >
              <ShieldCheck size={12} />
              <span>حریم خصوصی (GDPR)</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenLegal?.('cookies')}
              className="inline-flex items-center gap-1 hover:underline cursor-pointer"
            >
              <Cookie size={12} />
              <span>سیاست کوکی‌ها</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenLegal?.('settings')}
              className="inline-flex items-center gap-1 hover:underline cursor-pointer"
            >
              <SlidersHorizontal size={12} />
              <span>تنظیمات کوکی‌ها</span>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-1.5 pt-0.5">
          <button
            type="button"
            onClick={() => handleConfirm(activeChoice)}
            className={`w-full h-11 rounded-full text-white text-xs sm:text-sm font-bold active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer ${
              gdprChecked
                ? 'bg-[#0066CC] hover:bg-[#0055AA] shadow-sm'
                : 'bg-[#0066CC]/60 hover:bg-[#0066CC]/75'
            }`}
          >
            <span>
              تایید و ورود به بخش {chosenObj.nameFa}
            </span>
            <ArrowLeft size={16} />
          </button>

          {hasConsented && (
            <button
              type="button"
              onClick={handleDismiss}
              className="w-full h-8 rounded-full text-xs font-semibold text-[#6E6E73] hover:text-[#1D1D1F] transition-colors cursor-pointer"
            >
              بستن پنجره
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
