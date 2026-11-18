import React, { useState, useEffect } from 'react';
import { MapPin, X, Check, Globe, ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react';
import { COUNTRIES } from '../lib/translations';
import { getGdprConsent, saveGdprConsent } from '../lib/gdpr';
import { GdprTabs, GdprTabBody } from './GdprContent';

function detectBrowserCountry(validIds = ['se', 'no', 'dk', 'fi', 'de', 'at', 'nl', 'fr', 'ca']) {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (tz.includes('Oslo')) return 'no';
    if (tz.includes('Copenhagen')) return 'dk';
    if (tz.includes('Helsinki')) return 'fi';
    if (tz.includes('Berlin')) return 'de';
    if (tz.includes('Vienna')) return 'at';
    if (tz.includes('Amsterdam')) return 'nl';
    if (tz.includes('Paris')) return 'fr';
    if (tz.includes('Toronto') || tz.includes('Vancouver') || tz.includes('Montreal')) return 'ca';
    if (tz.includes('Stockholm')) return 'se';
    const langs = navigator.languages || [navigator.language || ''];
    if (langs.some(l => l.startsWith('nb') || l.startsWith('nn') || l.startsWith('no'))) return 'no';
    if (langs.some(l => l.startsWith('da'))) return 'dk';
    if (langs.some(l => l.startsWith('fi'))) return 'fi';
    if (langs.some(l => l.startsWith('de-AT'))) return 'at';
    if (langs.some(l => l.startsWith('de'))) return 'de';
    if (langs.some(l => l.startsWith('nl'))) return 'nl';
    if (langs.some(l => l.startsWith('fr-CA') || l.startsWith('en-CA'))) return 'ca';
    if (langs.some(l => l.startsWith('fr'))) return 'fr';
  } catch {}
  return validIds[0] || 'se';
}

export default function CountryBanner({
  isOpen,
  onClose,
  selectedCountry,
  onSelectCountry,
  onConsentSaved,
  siteName = 'لینک شو',
  countries = COUNTRIES,
}) {
  const activeCountries = Array.isArray(countries) && countries.length > 0
    ? countries.filter(c => c.enabled !== false)
    : COUNTRIES;
  const validCountryIds = activeCountries.map(c => c.id);
  const [detectedCountryId, setDetectedCountryId] = useState(() => detectBrowserCountry(validCountryIds));
  const [activeChoice, setActiveChoice] = useState(() => {
    if (selectedCountry && selectedCountry !== 'all') return selectedCountry;
    return detectBrowserCountry(validCountryIds);
  });

  const existingConsent = getGdprConsent();
  const [hasConsented, setHasConsented] = useState(() => Boolean(existingConsent?.accepted));
  const [gdprChecked, setGdprChecked] = useState(() => Boolean(existingConsent?.accepted));
  const [analyticsChecked, setAnalyticsChecked] = useState(() => Boolean(existingConsent?.analytics));
  const [gdprError, setGdprError] = useState(false);

  // Inline view switching: 'main' | 'privacy' | 'cookies' | 'settings' (never stacks modals)
  const [activeSubView, setActiveSubView] = useState('main');

  useEffect(() => {
    if (isOpen) {
      const latest = getGdprConsent();
      setHasConsented(Boolean(latest?.accepted));
      setGdprChecked(Boolean(latest?.accepted));
      setAnalyticsChecked(Boolean(latest?.analytics));
      setGdprError(false);
      setActiveSubView('main');
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
        if (validCountryIds.includes(code)) {
          setDetectedCountryId(code);
          if (!localStorage.getItem('scandi_country_selected')) {
            setActiveChoice(code);
          }
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [validCountryIds]);

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
      if (activeSubView !== 'main') setActiveSubView('main');
      return;
    }
    localStorage.setItem('scandi_country_popup_seen', 'true');
    if (onClose) onClose();
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        if (activeSubView !== 'main') {
          setActiveSubView('main');
        } else if (hasConsented) {
          localStorage.setItem('scandi_country_popup_seen', 'true');
          if (onClose) onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, hasConsented, activeSubView, onClose]);

  if (!isOpen) return null;

  const detectedObj = activeCountries.find(c => c.id === detectedCountryId) || activeCountries[0];
  const chosenObj = activeCountries.find(c => c.id === activeChoice) || activeCountries[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto font-vazir select-none" dir="rtl">

      {/* Calm Dimmed Backdrop */}
      <div
        className="fixed inset-0 bg-[#1D1D1F]/55 transition-opacity duration-200"
        onClick={handleDismiss}
      />

      {/* Single Modal Surface (switches views inline, zero stacked modals) */}
      <div className="relative w-full max-w-[460px] max-h-[92vh] flex flex-col bg-[#FBFBFC] rounded-[28px] shadow-[0_24px_70px_rgba(29,29,31,0.22)] border border-[#E5E5EA] z-10 overflow-hidden">

        {activeSubView === 'main' ? (
          <div className="overflow-y-auto p-6 sm:p-7 space-y-5">
            {/* Close Button (shown after initial GDPR consent) */}
            {hasConsented && (
              <button
                type="button"
                onClick={handleDismiss}
                className="absolute top-5 start-5 h-8 w-8 rounded-full flex items-center justify-center text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#ECECEF] active:scale-95 transition-all cursor-pointer"
                title="بستن پنجره"
              >
                <X size={17} />
              </button>
            )}

            {/* Header */}
            <div className="text-center space-y-2.5">
              <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-[#F5F5F7] text-[#6E6E73]">
                <Globe size={22} strokeWidth={1.9} />
              </div>

              <div className="space-y-1">
                <h2 className="text-[20px] sm:text-[22px] font-black text-[#1D1D1F] tracking-tight">
                  کشور خود را انتخاب کنید
                </h2>
                <p className="text-xs text-[#6E6E73]">
                  محل رشد کسب و کار فارسی‌زبانان
                </p>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F5F5F7] border border-[#E5E5EA] text-[11.5px] text-[#515154]">
                <MapPin size={13} className="text-[#86868B] shrink-0" />
                <span>موقعیت شما:</span>
                <strong className="font-bold text-[#1D1D1F]">{detectedObj.nameFa}</strong>
              </div>
            </div>

            {/* Country Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {activeCountries.map(country => {
                const isSelected = activeChoice === country.id;
                const isDetected = detectedCountryId === country.id;

                return (
                  <button
                    key={country.id}
                    type="button"
                    onClick={() => setActiveChoice(country.id)}
                    className={`group relative flex items-center justify-between px-3.5 py-3 rounded-2xl border text-right transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer active:scale-[0.95] ${
                      isSelected
                        ? 'border-[#0066CC] bg-[#0066CC]/[0.06] shadow-[0_0_0_1px_#0066CC,0_4px_14px_rgba(0,102,204,0.12)]'
                        : 'border-[#E5E5EA] bg-[#FBFBFC] hover:bg-[#F5F5F7] hover:border-[#D2D2D7]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[14px] font-bold truncate ${isSelected ? 'text-[#0066CC]' : 'text-[#1D1D1F]'}`}>
                          {country.nameFa}
                        </span>
                        {isDetected && (
                          <span
                            className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0"
                            title="موقعیت فعلی شما"
                          />
                        )}
                      </div>
                      <span className="text-[11px] text-[#6E6E73] font-medium block mt-0.5">
                        {country.nameNative}
                      </span>
                    </div>

                    <div className={`flex h-5 w-5 items-center justify-center rounded-full border transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] shrink-0 ${
                      isSelected
                        ? 'border-[#0066CC] bg-[#0066CC] text-white scale-105 shadow-[0_2px_6px_rgba(0,102,204,0.3)]'
                        : 'border-[#D2D2D7] bg-[#FBFBFC] scale-95 group-hover:border-[#AEAEB2]'
                    }`}>
                      {isSelected && <Check size={11.5} strokeWidth={3} />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* EU GDPR & Cookies Card (shown only once before initial acceptance; always accessible in Footer) */}
            {!hasConsented && (
            <div className={`rounded-2xl border p-4 space-y-3 transition-colors ${
              gdprError && !gdprChecked
                ? 'border-red-400 bg-red-50/70'
                : 'border-[#E5E5EA] bg-[#F5F5F7]'
            }`}>
              {/* Required GDPR Checkbox Row */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={gdprChecked}
                  onChange={(e) => {
                    setGdprChecked(e.target.checked);
                    if (e.target.checked) setGdprError(false);
                  }}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`mt-0.5 h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                    gdprChecked
                      ? 'bg-[#0066CC] border-[#0066CC] text-white shadow-2xs'
                      : gdprError
                        ? 'bg-[#FBFBFC] border-red-400'
                        : 'bg-[#FBFBFC] border-[#C7C7CC] group-hover:border-[#0066CC]'
                  }`}
                >
                  {gdprChecked && <Check size={13} strokeWidth={3} />}
                </span>
                <span className="text-[12px] leading-relaxed text-[#1D1D1F] font-semibold">
                  قوانین حریم خصوصی (<span className="text-[#0066CC] font-bold">EU GDPR</span>) و کوکی‌های ضروری سایت را می‌پذیرم.
                  <span className="text-red-500 ms-1">*</span>
                </span>
              </label>

              {/* Optional Analytics Toggle Row */}
              <label className="flex items-center justify-between gap-3 pt-2.5 border-t border-[#E5E5EA] cursor-pointer">
                <span className="text-[11.5px] text-[#515154] leading-snug">
                  کوکی‌های آمار و بهبود سایت (اختیاری)
                </span>
                <input
                  type="checkbox"
                  checked={analyticsChecked}
                  onChange={(e) => setAnalyticsChecked(e.target.checked)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ${
                    analyticsChecked ? 'bg-[#0066CC]' : 'bg-[#D2D2D7]'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow-xs transform transition-transform duration-200 ${
                      analyticsChecked ? '-translate-x-4.5' : '-translate-x-0.5'
                    }`}
                  />
                </span>
              </label>

              {gdprError && !gdprChecked && (
                <p className="text-[11px] font-bold text-red-600 flex items-center gap-1.5 pt-0.5">
                  <ShieldCheck size={13} className="shrink-0" />
                  <span>برای ورود به سایت، ابتدا تایید قوانین EU GDPR را انتخاب کنید.</span>
                </p>
              )}

              {/* Inline Navigation Links (switches inside this same modal) */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-[#E5E5EA] text-[11px] font-semibold text-[#0066CC]">
                <button
                  type="button"
                  onClick={() => setActiveSubView('privacy')}
                  className="hover:underline cursor-pointer"
                >
                  حریم خصوصی (GDPR)
                </button>
                <span className="text-[#C7C7CC]">•</span>
                <button
                  type="button"
                  onClick={() => setActiveSubView('cookies')}
                  className="hover:underline cursor-pointer"
                >
                  سیاست کوکی‌ها
                </button>
                <span className="text-[#C7C7CC]">•</span>
                <button
                  type="button"
                  onClick={() => setActiveSubView('settings')}
                  className="hover:underline cursor-pointer"
                >
                  تنظیمات کوکی‌ها
                </button>
              </div>
            </div>
            )}

            {/* Primary CTA */}
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => handleConfirm(activeChoice)}
                className={`w-full h-12 rounded-full text-white text-[13.5px] font-bold active:scale-[0.96] transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] flex items-center justify-center gap-2 cursor-pointer ${
                  gdprChecked
                    ? 'bg-[#0066CC] hover:bg-[#0055AA] shadow-[0_6px_18px_rgba(0,102,204,0.28)]'
                    : 'bg-[#0066CC]/55 hover:bg-[#0066CC]/70'
                }`}
              >
                <span>تایید و ورود به {chosenObj.nameFa}</span>
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
        ) : (
          /* Inline Legal / Cookies / Settings Sub-View (same single modal!) */
          <>
            <div className="px-6 pt-5 pb-4 space-y-3.5 border-b border-[#E5E5EA] shrink-0">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setActiveSubView('main')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F5F5F7] hover:bg-[#ECECEF] text-[#1D1D1F] text-xs font-bold transition-colors cursor-pointer"
                >
                  <ArrowRight size={14} />
                  <span>بازگشت</span>
                </button>
                <span className="text-xs font-extrabold text-[#1D1D1F]">
                  قوانین و تنظیمات کوکی (GDPR)
                </span>
                <div className="w-14" aria-hidden="true" />
              </div>

              <GdprTabs activeTab={activeSubView} onChangeTab={setActiveSubView} />
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto">
              <GdprTabBody
                activeTab={activeSubView}
                siteName={siteName}
                analyticsEnabled={analyticsChecked}
                onToggleAnalytics={setAnalyticsChecked}
              />
            </div>

            <div className="px-6 py-4 border-t border-[#E5E5EA] bg-[#F5F5F7] flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setGdprChecked(true);
                  setGdprError(false);
                  setActiveSubView('main');
                }}
                className="flex-1 h-11 rounded-full bg-[#0066CC] hover:bg-[#0055AA] text-white text-xs font-bold shadow-[0_4px_14px_rgba(0,102,204,0.22)] transition-all cursor-pointer"
              >
                تایید و بازگشت به انتخاب کشور
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
