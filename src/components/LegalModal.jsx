import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Cookie, SlidersHorizontal, Lock } from 'lucide-react';
import { getGdprConsent, saveGdprConsent } from '../lib/gdpr';

const TABS = [
  { id: 'privacy', label: 'حریم خصوصی', icon: ShieldCheck },
  { id: 'cookies', label: 'سیاست کوکی‌ها', icon: Cookie },
  { id: 'settings', label: 'تنظیمات کوکی‌ها', icon: SlidersHorizontal },
];

export default function LegalModal({
  isOpen,
  initialTab = 'privacy',
  siteName = 'سوئد پرشیا',
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
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#1D1D1F]/55 transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-xl bg-[#FBFBFC] rounded-[28px] shadow-[0_24px_70px_rgba(29,29,31,0.22)] border border-[#E5E5EA] overflow-hidden z-10 flex flex-col max-h-[88vh]">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 space-y-4 border-b border-[#E5E5EA] shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-[#0066CC]/10 text-[#0066CC] flex items-center justify-center shrink-0">
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

          {/* Apple-style Segmented Control */}
          <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-[#F5F5F7] border border-[#E5E5EA]">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-[11.5px] sm:text-xs font-bold transition-all cursor-pointer ${
                    active
                      ? 'bg-[#FBFBFC] text-[#1D1D1F] shadow-xs border border-[#E5E5EA]'
                      : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                  }`}
                >
                  <Icon size={13.5} className={active ? 'text-[#0066CC]' : ''} />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-3.5 text-[12.5px] leading-relaxed text-[#515154]">

          {activeTab === 'privacy' && (
            <>
              <div className="p-4 rounded-2xl bg-[#F5F5F7] border border-[#E5E5EA] space-y-1.5">
                <h3 className="font-bold text-[#1D1D1F] text-[13px]">
                  تعهد به حریم خصوصی کاربران
                </h3>
                <p>
                  {siteName} مطابق با مقررات حفاظت از داده‌های اتحادیه اروپا (EU GDPR) فعالیت می‌کند و تنها حداقل اطلاعات لازم برای انتشار و مدیریت آگهی‌های شما را نگهداری می‌کند.
                </p>
              </div>

              <div className="p-4 rounded-2xl border border-[#E5E5EA] bg-[#FBFBFC] space-y-2">
                <h4 className="font-bold text-[#1D1D1F] text-[13px]">اطلاعات جمع‌آوری‌شده</h4>
                <ul className="space-y-1.5 text-[#515154]">
                  <li>• اطلاعاتی که خودتان در آگهی ثبت می‌کنید (عنوان، متن، شهر، تصاویر و راه ارتباطی).</li>
                  <li>• بدون نیاز به ساخت حساب کاربری؛ مدیریت و حذف آگهی تنها با کد و پین اختصاصی شما انجام می‌شود.</li>
                  <li>• اطلاعات بانکی پرداخت‌های اختیاری هرگز در سیستم ما ذخیره نمی‌شود.</li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl border border-[#E5E5EA] bg-[#FBFBFC] space-y-2">
                <h4 className="font-bold text-[#1D1D1F] text-[13px]">حقوق قانونی شما (GDPR)</h4>
                <ul className="space-y-1.5 text-[#515154]">
                  <li>• حق مشاهده، ویرایش و حذف فوری آگهی و تصاویر در هر زمان.</li>
                  <li>• حق تغییر یا لغو رضایت کوکی‌های تحلیلی از بخش «تنظیمات کوکی‌ها».</li>
                </ul>
              </div>
            </>
          )}

          {activeTab === 'cookies' && (
            <>
              <div className="p-4 rounded-2xl bg-[#F5F5F7] border border-[#E5E5EA] space-y-1.5">
                <h3 className="font-bold text-[#1D1D1F] text-[13px]">
                  نحوه استفاده از کوکی‌ها
                </h3>
                <p>
                  ما از کوکی‌ها برای عملکرد صحیح سایت، حفظ کشور انتخاب‌شده و در صورت رضایت شما، بهبود کیفیت خدمات استفاده می‌کنیم.
                </p>
              </div>

              <div className="p-4 rounded-2xl border border-[#E5E5EA] bg-[#FBFBFC] space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-[#1D1D1F] text-[13px]">کوکی‌های ضروری</span>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                    همیشه فعال
                  </span>
                </div>
                <p className="text-xs text-[#6E6E73]">
                  برای نمایش صحیح آگهی‌ها، ذخیره کشور انتخاب‌شده، امنیت سایت و ثبت تنظیمات حریم خصوصی لازم هستند و غیرقابل غیرفعال‌سازی می‌باشند.
                </p>
              </div>

              <div className="p-4 rounded-2xl border border-[#E5E5EA] bg-[#FBFBFC] space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-[#1D1D1F] text-[13px]">کوکی‌های آمار و بهبود تجربه</span>
                  <span className="text-[11px] font-bold text-[#0066CC] bg-[#0066CC]/10 px-2.5 py-0.5 rounded-full">
                    اختیاری
                  </span>
                </div>
                <p className="text-xs text-[#6E6E73]">
                  به ما کمک می‌کند بخش‌های پرطرفدار را بشناسیم و سرعت و کیفیت سایت را بهتر کنیم. تنها با رضایت شما فعال می‌شوند.
                </p>
              </div>
            </>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-3">
              <p className="text-xs text-[#6E6E73]">
                تنظیمات دلخواه خود را انتخاب و ذخیره کنید:
              </p>

              {/* Essential Row (Locked ON) */}
              <div className="p-4 rounded-2xl border border-[#E5E5EA] bg-[#F5F5F7] flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-bold text-[#1D1D1F] text-[13px]">
                    <Lock size={13.5} className="text-emerald-600 shrink-0" />
                    <span>کوکی‌های ضروری سایت</span>
                  </div>
                  <p className="text-[11.5px] text-[#6E6E73]">
                    لازم برای عملکرد اصلی، امنیت و ذخیره تنظیمات شما.
                  </p>
                </div>
                <span className="shrink-0 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                  همیشه فعال
                </span>
              </div>

              {/* Analytics iOS Toggle Row */}
              <label className="p-4 rounded-2xl border border-[#E5E5EA] bg-[#FBFBFC] hover:border-[#D2D2D7] flex items-center justify-between gap-4 cursor-pointer transition-colors">
                <div className="space-y-0.5">
                  <div className="font-bold text-[#1D1D1F] text-[13px]">
                    کوکی‌های آمار و بهبود سایت
                  </div>
                  <p className="text-[11.5px] text-[#6E6E73]">
                    تحلیل ناشناس بازدیدها برای ارتقای کیفیت پلتفرم.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={analyticsEnabled}
                  onChange={(e) => setAnalyticsEnabled(e.target.checked)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors duration-200 ${
                    analyticsEnabled ? 'bg-[#0066CC]' : 'bg-[#D2D2D7]'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow-xs transform transition-transform duration-200 ${
                      analyticsEnabled ? '-translate-x-4.5' : '-translate-x-0.5'
                    }`}
                  />
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Sticky Footer Actions */}
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
