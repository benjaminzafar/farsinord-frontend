import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Cookie, SlidersHorizontal, Check, Lock } from 'lucide-react';
import { getGdprConsent, saveGdprConsent } from '../lib/gdpr';

const TABS = [
  { id: 'privacy', label: 'حریم خصوصی (GDPR)', icon: ShieldCheck },
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
      <div
        className="fixed inset-0 bg-[#1D1D1F]/55 transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-2xl bg-[#FBFBFC] rounded-3xl shadow-[0_24px_64px_rgba(29,29,31,0.22)] border border-[#E5E5EA] overflow-hidden z-10 flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#E5E5EA] bg-[#FBFBFC] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-[#0066CC]/10 text-[#0066CC] flex items-center justify-center">
              <ShieldCheck size={19} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-[#1D1D1F]">
                قوانین حریم خصوصی و کوکی‌ها (EU GDPR)
              </h2>
              <p className="text-[11px] text-[#6E6E73]">
                {siteName} — مطابق با مقررات حفاظت از داده‌های اتحادیه اروپا
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#ECECEF] transition-colors cursor-pointer"
            title="بستن"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 px-5 sm:px-6 py-3 bg-[#F5F5F7] border-b border-[#E5E5EA] overflow-x-auto shrink-0">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  active
                    ? 'bg-[#0066CC] text-white shadow-xs'
                    : 'bg-[#FBFBFC] text-[#515154] border border-[#E5E5EA] hover:text-[#1D1D1F] hover:border-[#D2D2D7]'
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs sm:text-[13px] leading-relaxed text-[#515154]">
          {activeTab === 'privacy' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#F5F5F7] border border-[#E5E5EA] space-y-1.5">
                <h3 className="font-extrabold text-[#1D1D1F] text-sm">
                  ۱. تعهد به مقررات GDPR اتحادیه اروپا
                </h3>
                <p>
                  سامانه {siteName} مطابق با قانون عمومی حفاظت از داده‌های اتحادیه اروپا (GDPR) عمل می‌کند. ما تنها حداقل اطلاعات لازم برای نمایش و مدیریت آگهی‌های شما در اسکاندیناوی (سوئد، نروژ، دانمارک و فنلاند) را پردازش می‌کنیم.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-[#1D1D1F]">۲. چه اطلاعاتی ذخیره می‌شود؟</h4>
                <ul className="list-disc ps-5 space-y-1.5">
                  <li>اطلاعاتی که خودتان هنگام ثبت آگهی وارد می‌کنید (عنوان، توضیحات، شهر، کشور، تصاویر آگهی و راه‌های ارتباطی دلخواه).</li>
                  <li>سایت نیازی به ساخت حساب کاربری یا ذخیره رمز عبور شخصی ندارد؛ هر آگهی فقط یک کد مرجع و پین ۴ رقمی برای ویرایش یا حذف توسط خودتان دارد.</li>
                  <li>تصاویر آگهی‌ها روی فضای امن Cloudflare R2 نگهداری می‌شوند و هنگام حذف آگهی پاک می‌شوند.</li>
                  <li>پرداخت‌های اختیاری ارتقای آگهی از طریق درگاه امن Stripe انجام می‌شود و اطلاعات کارت بانکی هرگز در سرورهای ما ذخیره نمی‌شود.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-[#1D1D1F]">۳. حقوق قانونی شما تحت GDPR</h4>
                <ul className="list-disc ps-5 space-y-1.5">
                  <li><strong className="text-[#1D1D1F]">حق دسترسی و ویرایش:</strong> در هر لحظه می‌توانید با کد مرجع و پین خود آگهی‌تان را ویرایش کنید.</li>
                  <li><strong className="text-[#1D1D1F]">حق حذف کامل (Right to Erasure):</strong> از بخش «مدیریت آگهی» می‌توانید آگهی و اطلاعات مرتبط با آن را فوراً حذف کنید.</li>
                  <li><strong className="text-[#1D1D1F]">حق لغو رضایت کوکی‌ها:</strong> هر زمان از بخش «تنظیمات کوکی‌ها» می‌توانید رضایت آمار و تحلیل را تغییر دهید یا غیرفعال کنید.</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'cookies' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#F5F5F7] border border-[#E5E5EA] space-y-1.5">
                <h3 className="font-extrabold text-[#1D1D1F] text-sm">
                  کوکی‌ها و حافظه محلی مرورگر (Cookies & Local Storage)
                </h3>
                <p>
                  برای اجرای روان سایت، به خاطر سپردن کشور انتخاب‌شده و جلوگیری از ثبت آگهی‌های رباتی، از حافظه مرورگر و کوکی‌های استاندارد استفاده می‌کنیم.
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="p-3.5 rounded-2xl border border-[#E5E5EA] bg-[#F5F5F7]/60 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#1D1D1F]">کوکی‌ها و حافظه ضروری (Essential)</span>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      همیشه فعال
                    </span>
                  </div>
                  <p className="text-xs text-[#6E6E73]">
                    شامل ذخیره کشور انتخاب‌شده (`scandi_country_selected`)، وضعیت تایید قوانین (`scandi_gdpr_consent`) و بررسی امنیتی ضد ربات Cloudflare Turnstile. بدون این موارد سایت عملکرد درستی ندارد.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl border border-[#E5E5EA] bg-[#F5F5F7]/60 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#1D1D1F]">کوکی‌های آمار و تحلیل (Analytics)</span>
                    <span className="text-[11px] font-bold text-[#0066CC] bg-[#0066CC]/10 px-2 py-0.5 rounded-full">
                      اختیاری (نیازمند رضایت)
                    </span>
                  </div>
                  <p className="text-xs text-[#6E6E73]">
                    در صورت فعال بودن، ابزار Google Analytics به صورت ناشناس برای بهبود کیفیت دسته‌بندی‌ها و سرعت سایت استفاده می‌شود. بدون تیک و تایید شما بارگذاری نخواهد شد.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-4">
              <p className="text-xs text-[#515154]">
                در این بخش می‌توانید نحوه استفاده از کوکی‌ها و ابزارهای تحلیلی را مطابق قانون GDPR اتحادیه اروپا مدیریت کنید:
              </p>

              {/* Essential Toggle (Locked ON) */}
              <div className="p-4 rounded-2xl border border-[#E5E5EA] bg-[#F5F5F7] flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-[#1D1D1F]">
                    <Lock size={14} className="text-emerald-600" />
                    <span>کوکی‌ها و حافظه ضروری سایت</span>
                  </div>
                  <p className="text-[11.5px] text-[#6E6E73]">
                    برای انتخاب کشور، نمایش صحیح آگهی‌ها، ذخیره تنظیمات شما و امنیت Cloudflare Turnstile الزامی است.
                  </p>
                </div>
                <div className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                  <Check size={12} strokeWidth={3} />
                  <span>همیشه فعال</span>
                </div>
              </div>

              {/* Analytics Toggle */}
              <label className="p-4 rounded-2xl border border-[#E5E5EA] bg-[#FBFBFC] hover:border-[#D2D2D7] flex items-start justify-between gap-4 cursor-pointer transition-colors">
                <div className="space-y-1">
                  <div className="font-bold text-[#1D1D1F]">
                    کوکی‌های آمار و تحلیل بازدید (Google Analytics)
                  </div>
                  <p className="text-[11.5px] text-[#6E6E73]">
                    به ما کمک می‌کند پربازدیدترین بخش‌ها و شهرها را بشناسیم و تجربه کاربری بهتری بسازیم.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={analyticsEnabled}
                  onChange={(e) => setAnalyticsEnabled(e.target.checked)}
                  className="mt-1 h-5 w-5 rounded border-[#D2D2D7] text-[#0066CC] focus:ring-[#0066CC] cursor-pointer shrink-0 accent-[#0066CC]"
                />
              </label>

              <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => handleSave(true)}
                  className="flex-1 h-10 rounded-full bg-[#0066CC] hover:bg-[#0055AA] text-white text-xs font-bold transition-all cursor-pointer"
                >
                  پذیرش همه و ذخیره
                </button>
                <button
                  type="button"
                  onClick={() => handleSave(analyticsEnabled)}
                  className="flex-1 h-10 rounded-full bg-[#ECECEF] hover:bg-[#E5E5EA] text-[#1D1D1F] text-xs font-bold transition-all cursor-pointer"
                >
                  ذخیره انتخاب من
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {activeTab !== 'settings' && (
          <div className="px-5 sm:px-6 py-3.5 border-t border-[#E5E5EA] bg-[#F5F5F7] flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className="text-xs font-bold text-[#0066CC] hover:underline cursor-pointer"
            >
              مدیریت تنظیمات کوکی‌ها
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-5 rounded-full bg-[#0066CC] hover:bg-[#0055AA] text-white text-xs font-bold transition-colors cursor-pointer"
            >
              متوجه شدم
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
