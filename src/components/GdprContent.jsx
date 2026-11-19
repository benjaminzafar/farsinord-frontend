import React, { useRef, useState, useEffect } from 'react';
import { ShieldCheck, Cookie, SlidersHorizontal, Lock } from 'lucide-react';

export const GDPR_TABS = [
  { id: 'privacy', label: 'حریم خصوصی', icon: ShieldCheck },
  { id: 'cookies', label: 'سیاست کوکی', icon: Cookie },
  { id: 'settings', label: 'تنظیمات کوکی', icon: SlidersHorizontal },
];

export function GdprTabs({ activeTab, onChangeTab }) {
  const tabRefs = useRef({});
  const [pill, setPill] = useState({ left: 0, width: 0, ready: false });

  useEffect(() => {
    const el = tabRefs.current[activeTab];
    if (!el) return;
    const update = () => {
      setPill({ left: el.offsetLeft, width: el.offsetWidth, ready: true });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [activeTab]);

  return (
    <div className="relative grid grid-cols-3 gap-1 p-1 rounded-2xl bg-[#F5F5F7] border border-[#E5E5EA]">
      {pill.ready && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1 bottom-1 rounded-xl bg-[#FBFBFC] border border-[#E5E5EA] shadow-xs transition-[transform,width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform"
          style={{
            width: `${pill.width}px`,
            transform: `translate3d(${pill.left}px, 0, 0)`,
            left: 0,
          }}
        />
      )}
      {GDPR_TABS.map((tab) => {
        const Icon = tab.icon;
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            ref={(el) => { if (el) tabRefs.current[tab.id] = el; }}
            type="button"
            onClick={() => onChangeTab(tab.id)}
            className={`relative z-10 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.95] cursor-pointer ${
              active
                ? (pill.ready ? 'text-[#1D1D1F]' : 'bg-[#FBFBFC] text-[#1D1D1F] shadow-xs border border-[#E5E5EA]')
                : 'text-[#6E6E73] hover:text-[#1D1D1F]'
            }`}
          >
            <Icon size={13.5} className={`transition-colors duration-200 ${active ? 'text-[#1D1D1F]' : 'text-[#86868B]'}`} />
            <span className="truncate">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function GdprTabBody({
  activeTab,
  siteName = 'لینک شو',
  analyticsEnabled,
  onToggleAnalytics,
}) {
  return (
    <div className="text-[12.5px] leading-relaxed text-[#515154]">
      {activeTab === 'privacy' && (
        <div className="rounded-2xl border border-[#E5E5EA] bg-[#FBFBFC] divide-y divide-[#E5E5EA] overflow-hidden">
          <div className="p-4 bg-[#F5F5F7]/70 space-y-1">
            <h3 className="font-bold text-[#1D1D1F] text-[13px]">
              تعهد به حریم خصوصی کاربران
            </h3>
            <p>
              {siteName} مطابق با مقررات حفاظت از داده‌های اتحادیه اروپا (EU GDPR) فعالیت می‌کند و تنها حداقل اطلاعات لازم برای انتشار و مدیریت آگهی‌های شما را نگهداری می‌کند.
            </p>
          </div>

          <div className="p-4 space-y-1.5">
            <h4 className="font-bold text-[#1D1D1F] text-[13px]">اطلاعات جمع‌آوری‌شده</h4>
            <ul className="space-y-1 text-[#515154]">
              <li>• اطلاعاتی که خودتان در آگهی ثبت می‌کنید (عنوان، متن، شهر، تصاویر و راه ارتباطی).</li>
              <li>• بدون نیاز به ساخت حساب کاربری؛ مدیریت و حذف آگهی با کد پیگیری و کد امنیتی اختصاصی شما انجام می‌شود.</li>
              <li>• اطلاعات بانکی پرداخت‌های اختیاری هرگز در سیستم ما ذخیره نمی‌شود.</li>
            </ul>
          </div>

          <div className="p-4 space-y-1.5">
            <h4 className="font-bold text-[#1D1D1F] text-[13px]">حقوق قانونی شما (GDPR)</h4>
            <ul className="space-y-1 text-[#515154]">
              <li>• حق مشاهده، ویرایش و حذف فوری آگهی و تصاویر در هر زمان.</li>
              <li>• حق تغییر یا لغو رضایت کوکی‌های تحلیلی از بخش «تنظیمات کوکی‌ها».</li>
            </ul>
          </div>
        </div>
      )}

      {activeTab === 'cookies' && (
        <div className="rounded-2xl border border-[#E5E5EA] bg-[#FBFBFC] divide-y divide-[#E5E5EA] overflow-hidden">
          <div className="p-4 bg-[#F5F5F7]/70 space-y-1">
            <h3 className="font-bold text-[#1D1D1F] text-[13px]">
              نحوه استفاده از کوکی‌ها
            </h3>
            <p>
              ما از کوکی‌ها برای عملکرد صحیح سایت، حفظ کشور انتخاب‌شده و در صورت رضایت شما، بهبود کیفیت خدمات استفاده می‌کنیم.
            </p>
          </div>

          <div className="p-4 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-[#1D1D1F] text-[13px]">کوکی‌های ضروری</span>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                همیشه فعال
              </span>
            </div>
            <p className="text-xs text-[#6E6E73]">
              برای نمایش صحیح آگهی‌ها، ذخیره کشور انتخاب‌شده، امنیت سایت و ثبت تنظیمات حریم خصوصی لازم هستند.
            </p>
          </div>

          <div className="p-4 space-y-1">
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
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-3">
          <p className="text-xs text-[#6E6E73]">
            تنظیمات دلخواه خود را انتخاب و ذخیره کنید:
          </p>

          <div className="rounded-2xl border border-[#E5E5EA] bg-[#FBFBFC] divide-y divide-[#E5E5EA] overflow-hidden">
            <div className="p-4 bg-[#F5F5F7]/60 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 font-bold text-[#1D1D1F] text-[13px]">
                  <Lock size={13.5} className="text-[#86868B] shrink-0" />
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

            <label className="p-4 hover:bg-[#F5F5F7]/70 flex items-center justify-between gap-4 cursor-pointer transition-colors">
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
              onChange={(e) => onToggleAnalytics(e.target.checked)}
              className="sr-only"
            />
            <span
              aria-hidden="true"
              className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors duration-200 ${
                analyticsEnabled ? 'bg-[#0066CC]' : 'bg-[#D2D2D7]'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-[#ffffff] shadow-xs transform transition-transform duration-200 ${
                  analyticsEnabled ? '-translate-x-4.5' : '-translate-x-0.5'
                }`}
              />
            </span>
          </label>
          </div>
        </div>
      )}
    </div>
  );
}
