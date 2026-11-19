import React, { useState, useRef, useEffect } from 'react';
import { X, AlertCircle, Lock, ChevronDown, Check, ExternalLink } from 'lucide-react';
import { publicApi } from '../lib/apiClient';
import { getSavedAdCredentials } from '../lib/myAdsStorage';
import { computeClientVipPrice } from '../lib/vipPricing';
import { COUNTRIES } from '../lib/translations';

const SUPPORTED_VIP_COUNTRIES = new Set(['se', 'no', 'dk', 'fi', 'de', 'at', 'nl', 'fr']);

export default function PaymentModal({
  ad,
  stripeSettings = null,
  countries = COUNTRIES,
  selectedCountry = 'se',
  onClose,
}) {
  const activeCountries = (
    Array.isArray(countries) && countries.length > 0
      ? countries.filter((c) => c.enabled !== false)
      : COUNTRIES
  ).filter((c) => SUPPORTED_VIP_COUNTRIES.has(c.id));

  const savedCred = getSavedAdCredentials().find(
    (item) =>
      ad?.reference_number &&
      String(item.reference_number).toUpperCase() === String(ad.reference_number).toUpperCase()
  );

  const initialCountry = SUPPORTED_VIP_COUNTRIES.has(ad?.country)
    ? ad.country
    : SUPPORTED_VIP_COUNTRIES.has(selectedCountry)
      ? selectedCountry
      : 'se';

  const [targetCountry, setTargetCountry] = useState(initialCountry);
  const [countryOpen, setCountryOpen] = useState(false);
  const [ownerPin, setOwnerPin] = useState(() => savedCred?.pin_code || '');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const countryRef = useRef(null);

  const hasSavedPin = Boolean(savedCred?.pin_code);
  const targetCountryObj =
    activeCountries.find((c) => c.id === targetCountry) || activeCountries[0] || COUNTRIES[0];

  const pricing = computeClientVipPrice({
    stripeSettings: stripeSettings || {},
    targetCountry,
  });

  const isGatewayReady = Boolean(
    stripeSettings &&
      stripeSettings.enabled !== false &&
      stripeSettings.checkoutAvailable !== false
  );
  const isTestMode = stripeSettings?.mode === 'test';
  const isAlreadyActiveVip = Boolean(ad?.is_active_vip);
  const isAdActive = !ad?.status || ad.status === 'active';

  useEffect(() => {
    const handleOutside = (e) => {
      if (countryRef.current && !countryRef.current.contains(e.target)) {
        setCountryOpen(false);
      }
    };
    const handleEsc = (e) => {
      if (e.key !== 'Escape') return;
      if (countryOpen) {
        setCountryOpen(false);
      } else {
        onClose?.();
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [countryOpen, onClose]);

  const handleStartStripeCheckout = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!isGatewayReady) {
      setErrorMsg('درگاه پرداخت غیرفعال است.');
      return;
    }

    if (!ad?.id || !isAdActive) {
      setErrorMsg('فقط آگهی فعال امکان ارتقا دارد.');
      return;
    }

    const cleanPin = String(ownerPin || '').trim();
    if (!cleanPin) {
      setErrorMsg('کد مدیریت آگهی را وارد کنید.');
      return;
    }

    setLoading(true);
    try {
      const res = await publicApi.createVipCheckout(ad.id, targetCountry, cleanPin);
      if (res?.checkoutUrl) {
        let parsedUrl;
        try {
          parsedUrl = new URL(res.checkoutUrl);
        } catch {
          throw new Error('لینک پرداخت معتبر نیست.');
        }
        if (parsedUrl.origin !== 'https://checkout.stripe.com') {
          throw new Error('لینک درگاه رسمی Stripe تایید نشد.');
        }
        window.location.href = parsedUrl.toString();
        return;
      }
      throw new Error('لینک پرداخت دریافت نشد.');
    } catch (err) {
      setErrorMsg(err.message || 'اتصال به درگاه برقرار نشد.');
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto no-scrollbar font-vazir select-none"
      dir="rtl"
    >
      <div
        className="fixed inset-0 bg-[#1D1D1F]/55 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-modal-title"
        className="relative w-full max-w-[440px] max-h-[90dvh] flex flex-col bg-[#FBFBFC] rounded-[24px] sm:rounded-[28px] border border-[#ECEFF4] shadow-[0_24px_70px_rgba(29,29,31,0.22)] dark:shadow-[0_24px_70px_rgba(0,0,0,0.6)] overflow-hidden z-10"
      >
        {/* Clean Minimal Header (No oversized icon box) */}
        <div className="px-5 sm:px-6 pt-4 pb-3.5 border-b border-[#F0F2F5] flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2
              id="payment-modal-title"
              className="text-[16px] font-black text-[#1D1D1F] leading-none truncate"
            >
              ارتقا به VIP
            </h2>
            <p className="text-[11px] text-[#6E6E73] mt-1 truncate">
              نمایش در صدر فهرست
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="h-8 w-8 rounded-full text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#ECECEF] flex items-center justify-center active:scale-95 transition-colors cursor-pointer shrink-0"
          >
            <X size={16} strokeWidth={1.75} className="block" />
          </button>
        </div>

        {/* Body */}
        <form
          onSubmit={handleStartStripeCheckout}
          className="overflow-y-auto no-scrollbar px-5 sm:px-6 py-4 space-y-4"
        >
          {/* Order Summary + Clear VIP Plan Benefits */}
          <div className="rounded-2xl bg-[#F5F5F7] p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <span className="block text-[11px] font-bold text-[#0066CC] leading-none">
                  اشتراک ویژه {targetCountryObj.nameFa} ({pricing.durationDays.toLocaleString('fa-IR')} روز)
                </span>
                <h4 className="text-xs font-bold text-[#1D1D1F] truncate">
                  {ad?.title_fa || ad?.title || 'آگهی شما'}
                </h4>
              </div>

              <div
                className="text-left shrink-0 bg-[#FBFBFC] px-3 py-1.5 rounded-xl border border-[#ECEFF4]"
                dir="ltr"
              >
                <span className="text-base font-black text-[#0066CC] tabular-nums">
                  {pricing.amountMajor}
                </span>
                <span className="text-[11px] font-bold text-[#6E6E73] ms-1">
                  {pricing.currency}
                </span>
              </div>
            </div>

            <ul className="pt-2.5 border-t border-[#F0F2F5] space-y-1.5 text-[11.5px] text-[#515154] leading-relaxed list-disc ps-4">
              <li>نمایش ثابت در صدر فهرست و بخش ویژه کشور {targetCountryObj.nameFa} به مدت {pricing.durationDays.toLocaleString('fa-IR')} روز</li>
              <li>نشان متمایز VIP و دیده‌شدن تا ۳ برابر بیشتر توسط بازدیدکنندگان</li>
              <li>معاف از حذف خودکار و بدون محدودیت ۷ روزه بوست</li>
            </ul>
          </div>

          {/* Country Dropdown (Matches LinkSho Dropdown Spec) */}
          <div className="space-y-1.5" ref={countryRef}>
            <div className="h-5 flex items-center justify-between">
              <label className="text-xs font-bold text-[#1D1D1F] leading-none">کشور</label>
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setCountryOpen((o) => !o)}
                aria-expanded={countryOpen}
                className={`w-full h-11 rounded-xl border px-3.5 text-[13px] font-semibold text-[#1D1D1F] flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                  countryOpen
                    ? 'bg-white dark:!bg-[#1B1D24] border-[#0066CC] dark:border-[#0A84FF] ring-2 ring-[#0066CC]/15'
                    : 'bg-[#F5F5F7] border-[#ECEFF4] hover:border-[#D2D2D7]'
                }`}
              >
                <span className="leading-none truncate">{targetCountryObj.nameFa}</span>
                <ChevronDown
                  size={15}
                  strokeWidth={1.75}
                  className={`block shrink-0 transition-transform duration-200 ${
                    countryOpen ? 'rotate-180 text-[#0066CC]' : 'text-[#86868B]'
                  }`}
                />
              </button>

              {countryOpen && (
                <div className="absolute z-30 inset-x-0 top-full mt-1.5 rounded-2xl bg-white dark:!bg-[#1B1E27] border border-[#ECEFF4] dark:!border-white/[0.09] shadow-[0_18px_45px_rgba(15,23,42,0.14)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.65)] p-1.5 max-h-52 overflow-y-auto no-scrollbar space-y-0.5">
                  {activeCountries.map((c) => {
                    const active = c.id === targetCountry;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setTargetCountry(c.id);
                          setCountryOpen(false);
                        }}
                        className={`w-full h-9 px-3 rounded-xl text-[12.5px] flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#EAF2FB] text-[#0066CC] font-bold'
                            : 'text-[#1D1D1F] hover:bg-[#F5F5F7] font-medium'
                        }`}
                      >
                        <span className="truncate">{c.nameFa}</span>
                        {active && <Check size={14} strokeWidth={2.25} className="block shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Owner PIN Verification (Required when not already stored in this browser) */}
          {!hasSavedPin && (
            <div className="space-y-1.5">
              <div className="h-5 flex items-center justify-between">
                <label
                  htmlFor="vip-owner-pin"
                  className="text-xs font-bold text-[#1D1D1F] leading-none"
                >
                  کد مدیریت <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-[#86868B]">تایید مالک آگهی</span>
              </div>
              <input
                id="vip-owner-pin"
                type="text"
                dir="ltr"
                maxLength={12}
                required
                placeholder="کد ۶ تا ۱۲ کاراکتری"
                value={ownerPin}
                onChange={(e) => setOwnerPin(e.target.value)}
                className="w-full h-11 rounded-xl border border-[#ECEFF4] bg-[#F5F5F7] px-3.5 text-[13px] font-mono font-bold text-[#1D1D1F] placeholder:text-[#86868B] placeholder:font-vazir placeholder:font-normal focus:bg-white focus:border-[#0066CC] dark:focus:border-[#0A84FF] focus:ring-2 focus:ring-[#0066CC]/15 focus:outline-none transition-colors"
              />
            </div>
          )}

          {isAlreadyActiveVip && (
            <p className="rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs text-emerald-700 font-medium">
              ویژه فعال است؛ {pricing.durationDays.toLocaleString('fa-IR')} روز تمدید می‌شود.
            </p>
          )}

          {isTestMode && (
            <p className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2 text-[11px] text-amber-800">
              حالت آزمایشی فعال است (کارت تست Stripe).
            </p>
          )}

          {!isGatewayReady && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs text-rose-700 font-semibold flex items-center gap-2">
              <AlertCircle size={15} strokeWidth={1.75} className="block shrink-0" />
              <span>درگاه پرداخت غیرفعال است.</span>
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs text-rose-700 font-semibold flex items-center gap-2"
            >
              <AlertCircle size={15} strokeWidth={1.75} className="block shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="pt-1 space-y-2.5">
            <button
              type="submit"
              disabled={loading || !isGatewayReady || !isAdActive}
              className="w-full h-11 rounded-full bg-[#0066CC] hover:bg-[#0055AA] disabled:opacity-45 disabled:cursor-not-allowed text-[#FBFBFC] font-bold text-[13px] leading-none shadow-[0_4px_14px_rgba(0,102,204,0.22)] active:scale-[0.97] transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Lock size={14} strokeWidth={1.75} className="block shrink-0" />
              <span className="leading-none">
                {loading
                  ? 'انتقال به درگاه...'
                  : `پرداخت ${pricing.amountMajor} ${pricing.currency}`}
              </span>
              {!loading && <ExternalLink size={13} strokeWidth={1.75} className="block shrink-0 opacity-85" />}
            </button>

            <p className="text-center text-[10.5px] text-[#86868B]">
              SSL • Visa, Mastercard, Apple Pay
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
