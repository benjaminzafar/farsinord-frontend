import React, { useState, useEffect } from 'react';
import { X, ShieldCheck } from 'lucide-react';
import { getGdprConsent, saveGdprConsent } from '../lib/gdpr';
import { GdprTabs, GdprTabBody } from './GdprContent';

export default function LegalModal({
  isOpen,
  initialTab = 'privacy',
  siteName = 'لینک شو',
  onClose,
  onConsentSaved,
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(() => {
    const existing = getGdprConsent();
    return existing ? existing.analytics : false;
  });

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab || 'privacy');
      const existing = getGdprConsent();
      setAnalyticsEnabled(existing ? existing.analytics : false);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = (analyticsValue) => {
    const saved = saveGdprConsent({ analytics: analyticsValue });
    onConsentSaved?.(saved);
    onClose?.();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 overflow-y-auto font-vazir select-none"
      dir="rtl"
    >
      <div
        className="fixed inset-0 bg-[#1D1D1F]/55 transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-xl bg-[#FBFBFC] rounded-[28px] shadow-[0_24px_70px_rgba(29,29,31,0.22)] border border-[#E5E5EA] overflow-hidden z-10 flex flex-col max-h-[88vh]">

        <div className="px-6 pt-6 pb-4 space-y-4 border-b border-[#E5E5EA] shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-[#F5F5F7] text-[#6E6E73] flex items-center justify-center shrink-0">
                <ShieldCheck size={20} strokeWidth={1.9} />
              </div>
              <div>
                <h2 className="text-[17px] sm:text-[18px] font-black text-[#1D1D1F] tracking-tight">
                  حریم خصوصی و کوکی‌ها (GDPR)
                </h2>
                <p className="text-[11.5px] text-[#6E6E73] mt-0.5">
                  {siteName} — مطابق با قوانین حفاظت از داده‌های اتحادیه اروپا
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 rounded-full flex items-center justify-center text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#ECECEF] active:scale-95 transition-all cursor-pointer shrink-0"
              title="بستن"
            >
              <X size={17} />
            </button>
          </div>

          <GdprTabs activeTab={activeTab} onChangeTab={setActiveTab} />
        </div>

        <div className="p-6 overflow-y-auto">
          <GdprTabBody
            activeTab={activeTab}
            siteName={siteName}
            analyticsEnabled={analyticsEnabled}
            onToggleAnalytics={setAnalyticsEnabled}
          />
        </div>

        <div className="px-6 py-4 border-t border-[#E5E5EA] bg-[#F5F5F7] flex items-center justify-between gap-3 shrink-0">
          {activeTab === 'settings' ? (
            <>
              <button
                type="button"
                onClick={() => handleSave(analyticsEnabled)}
                className="flex-1 h-11 rounded-full bg-[#ECECEF] hover:bg-[#E5E5EA] text-[#1D1D1F] text-xs font-bold transition-colors cursor-pointer"
              >
                ذخیره انتخاب من
              </button>
              <button
                type="button"
                onClick={() => handleSave(true)}
                className="flex-1 h-11 rounded-full bg-[#0066CC] hover:bg-[#0055AA] text-white text-xs font-bold shadow-[0_4px_14px_rgba(0,102,204,0.22)] transition-all cursor-pointer"
              >
                پذیرش همه
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className="text-xs font-bold text-[#0066CC] hover:underline cursor-pointer"
              >
                تنظیمات کوکی‌ها
              </button>
              <button
                type="button"
                onClick={onClose}
                className="h-10 px-6 rounded-full bg-[#0066CC] hover:bg-[#0055AA] text-white text-xs font-bold shadow-[0_4px_14px_rgba(0,102,204,0.22)] transition-all cursor-pointer"
              >
                بستن
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
