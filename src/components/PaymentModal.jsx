import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  Lock,
  CheckCircle2,
  Crown,
  AlertCircle,
  MapPin,
  ExternalLink,
} from 'lucide-react';
import { publicApi } from '../lib/apiClient';
import { COUNTRIES } from '../lib/translations';

const COUNTRY_CURRENCY_CODE = {
  se: 'SEK',
  no: 'NOK',
  dk: 'DKK',
  fi: 'EUR',
  de: 'EUR',
  at: 'EUR',
  nl: 'EUR',
  fr: 'EUR',
};

export default function PaymentModal({
  ad,
  price = 99,
  currency = 'SEK',
  stripeSettings = null,
  countries = COUNTRIES,
  selectedCountry = 'se',
  onClose,
}) {
  const activeCountries = Array.isArray(countries) && countries.length > 0
    ? countries.filter((c) => c.enabled !== false)
    : COUNTRIES;

  const [targetCountry, setTargetCountry] = useState(() => ad?.country || selectedCountry || 'se');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const targetCountryObj = activeCountries.find((c) => c.id === targetCountry) || activeCountries[0] || COUNTRIES[0];
  const resolvedCurrency = COUNTRY_CURRENCY_CODE[targetCountry] || currency || 'SEK';
  const durationDays = Number(stripeSettings?.vipDurationDays) || 30;
  const basePrice = Number(price) || 99;
  const displayPrice =
    resolvedCurrency === 'EUR' && currency !== 'EUR' && basePrice >= 50
      ? Math.max(9, Math.round(basePrice / 10))
      : basePrice;

  const isGatewayEnabled = stripeSettings?.enabled !== false;
  const isTestMode = stripeSettings?.mode === 'test';
  const isAlreadyActiveVip = Boolean(ad?.is_active_vip);

  // Redirect strictly to official Stripe Hosted Checkout (PCI-DSS SAQ-A safe: card data never enters our domain)
  const handleStartStripeCheckout = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!isGatewayEnabled) {
      setErrorMsg('درگاه پرداخت ویژه در حال حاضر توسط مدیریت غیرفعال شده است.');
      return;
    }

    if (!ad?.id) {
      setErrorMsg('آگهی انتخابی معتبر نیست.');
      return;
    }

    setLoading(true);
    try {
      const res = await publicApi.createVipCheckout(ad.id, targetCountry);
      if (res?.checkoutUrl) {
        window.location.href = res.checkoutUrl;
        return;
      }
      throw new Error('لینک درگاه پرداخت Stripe دریافت نشد.');
    } catch (err) {
      setErrorMsg(err.message || 'خطا در اتصال به درگاه پرداخت Stripe');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto font-vazir select-none" dir="rtl">
      <div
        className="fixed inset-0 bg-[#1D1D1F]/55 transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-[440px] max-h-[90vh] flex flex-col bg-[#FBFBFC] rounded-[24px] shadow-[0_24px_70px_rgba(29,29,31,0.22)] border border-[#E5E5EA] overflow-hidden z-10 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 pt-4 pb-3.5 border-b border-[#E5E5EA] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-[#F5F5F7] text-[#6E6E73] flex items-center justify-center shrink-0">
              <Crown size={18} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h2 className="text-[15px] font-black text-[#1D1D1F] tracking-tight truncate">
                ارتقای آگهی به ویژه (VIP)
              </h2>
              <p className="text-[11px] text-[#6E6E73] truncate">
                نمایش در صدر فهرست و بخش ویژه کشور انتخابی
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="h-9 w-9 sm:h-8 sm:w-8 rounded-full hover:bg-[#ECECEF] text-[#6E6E73] hover:text-[#1D1D1F] flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="بستن"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto p-4 sm:p-5 space-y-3.5">
          {/* Compact Order Summary */}
          <div className="bg-[#F5F5F7] rounded-2xl p-3.5 flex items-center justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#0066CC]">
                <MapPin size={12} className="shrink-0" />
                <span>ویژه در کشور {targetCountryObj.nameFa} ({durationDays} روز)</span>
              </div>
              <h4 className="text-xs font-extrabold text-[#1D1D1F] truncate">
                {ad?.title_fa || ad?.title || 'آگهی انتخابی شما'}
              </h4>
            </div>

            <div className="text-left shrink-0 bg-[#FBFBFC] px-3 py-1.5 rounded-xl border border-[#E5E5EA]" dir="ltr">
              <span className="text-lg font-black text-[#0066CC] tabular-nums">
                {displayPrice}
              </span>
              <span className="text-[11px] font-bold text-[#6E6E73] ms-1">{resolvedCurrency}</span>
            </div>
          </div>

          {/* Country-Specific VIP Target Selector */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-[#6E6E73]">
              کشور هدف نمایش ویژه (VIP):
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {activeCountries.map((c) => {
                const isSelected = targetCountry === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setTargetCountry(c.id)}
                    className={`py-1.5 px-2 rounded-xl text-[11.5px] font-bold border transition-all cursor-pointer truncate ${
                      isSelected
                        ? 'border-[#0066CC] bg-[#0066CC]/[0.08] text-[#0066CC]'
                        : 'border-[#E5E5EA] bg-[#FBFBFC] text-[#1D1D1F] hover:bg-[#F5F5F7]'
                    }`}
                  >
                    {c.nameFa}
                  </button>
                );
              })}
            </div>
          </div>

          {isAlreadyActiveVip && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900 flex items-start gap-2">
              <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
              <span>این آگهی هم‌اکنون ویژه (VIP) است؛ با پرداخت جدید، مدت آن به‌صورت خودکار {durationDays} روز دیگر تمدید می‌شود.</span>
            </div>
          )}

          {isTestMode && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-950 flex items-center gap-2">
              <AlertCircle size={14} className="text-amber-700 shrink-0" />
              <span>حالت آزمایشی (Stripe Test Mode) فعال است؛ از کارت آزمایشی در صفحه امن Stripe استفاده کنید.</span>
            </div>
          )}

          {!isGatewayEnabled && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2.5 text-xs text-rose-800 font-bold flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>درگاه پرداخت ویژه در حال حاضر غیرفعال است.</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleStartStripeCheckout} className="space-y-3">
            <div className="rounded-xl bg-[#F5F5F7] border border-[#E5E5EA] p-3 text-xs text-[#515154] leading-relaxed space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-[#1D1D1F]">
                <Lock size={13} className="text-[#0066CC]" />
                <span>درگاه رسمی Stripe</span>
              </div>
              <p className="text-[11px] text-[#6E6E73]">
                پرداخت در صفحه رمزنگاری‌شده Stripe انجام می‌شود و بلافاصله پس از تایید، نشان ویژه (VIP) برای {durationDays} روز فعال خواهد شد.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !isGatewayEnabled}
              className="w-full h-11 rounded-full bg-[#0066CC] hover:bg-[#0055AA] disabled:opacity-50 text-white font-bold text-xs shadow-[0_4px_14px_rgba(0,102,204,0.24)] active:scale-[0.97] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Lock size={14} />
              <span>
                {loading
                  ? 'در حال انتقال به درگاه...'
                  : `پرداخت ${displayPrice} ${resolvedCurrency}`}
              </span>
              {!loading && <ExternalLink size={13} />}
            </button>
          </form>

          {/* Compact Security Footer */}
          <div className="pt-1 flex items-center justify-center gap-2 text-[10.5px] text-[#86868B]">
            <ShieldCheck size={13} className="text-[#86868B] shrink-0" />
            <span>حفاظت PCI-DSS و رمزنگاری SSL • Visa, Mastercard, Apple Pay</span>
          </div>
        </div>
      </div>
    </div>
  );
}
