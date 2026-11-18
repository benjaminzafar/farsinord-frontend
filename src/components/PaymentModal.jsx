import React, { useState } from 'react';
import { 
  X, 
  CreditCard, 
  ShieldCheck, 
  Lock, 
  CheckCircle2, 
  Crown, 
  AlertCircle,
  MapPin
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
  onSuccess 
}) {
  const activeCountries = Array.isArray(countries) && countries.length > 0
    ? countries.filter(c => c.enabled !== false)
    : COUNTRIES;

  const [targetCountry, setTargetCountry] = useState(() => ad?.country || selectedCountry || 'se');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [cardName, setCardName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isPaid, setIsPaid] = useState(false);

  const targetCountryObj = activeCountries.find(c => c.id === targetCountry) || activeCountries[0] || COUNTRIES[0];
  const resolvedCurrency = COUNTRY_CURRENCY_CODE[targetCountry] || currency || 'SEK';
  const durationDays = Number(stripeSettings?.vipDurationDays) || 30;
  const basePrice = Number(price) || 99;
  const displayPrice =
    resolvedCurrency === 'EUR' && currency !== 'EUR' && basePrice >= 50
      ? Math.max(9, Math.round(basePrice / 10))
      : basePrice;

  // Format Card Number (XXXX XXXX XXXX XXXX)
  const handleCardNumberChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 16);
    const formatted = val.match(/.{1,4}/g)?.join(' ') || val;
    setCardNumber(formatted);
  };

  // Format Expiry (MM/YY)
  const handleExpiryChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (val.length >= 2) {
      setExpiry(`${val.slice(0, 2)}/${val.slice(2)}`);
    } else {
      setExpiry(val);
    }
  };

  // Quick fill test card
  const handleFillTestCard = () => {
    setCardNumber('4242 4242 4242 4242');
    setExpiry('12/28');
    setCvc('123');
    setCardName('Ali Rezaei');
    setErrorMsg('');
  };

  const isTestMode = stripeSettings?.mode !== 'live';

  // Process Stripe Payment & Promote Ad for Target Country
  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!isTestMode) {
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
        throw new Error('لینک پرداخت Stripe دریافت نشد.');
      } catch (err) {
        setErrorMsg(err.message || 'خطا در اتصال به درگاه پرداخت Stripe');
        setLoading(false);
      }
      return;
    }

    if (!cardName.trim()) {
      setErrorMsg('لطفاً نام دارنده کارت را وارد فرمایید.');
      return;
    }
    if (cardNumber.replace(/\s/g, '').length < 16) {
      setErrorMsg('شماره کارت ۱۶ رقمی معتبر وارد فرمایید.');
      return;
    }
    if (expiry.length < 5) {
      setErrorMsg('تاریخ انقضا (MM/YY) معتبر وارد فرمایید.');
      return;
    }
    if (cvc.length < 3) {
      setErrorMsg('کد امنیتی (CVC) معتبر وارد فرمایید.');
      return;
    }

    setLoading(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 900));

      if (ad && ad.id) {
        const updatedAd = await publicApi.promoteAd(ad.id, targetCountry);
        setIsPaid(true);
        if (onSuccess) {
          onSuccess(updatedAd || { ...ad, is_featured: true, is_active_vip: true, country: targetCountry });
        }
      } else {
        setIsPaid(true);
      }
    } catch (err) {
      console.error('Payment Error:', err);
      setErrorMsg(err.message || 'پرداخت با خطا مواجه شد. لطفاً دوباره تلاش فرمایید.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto font-vazir select-none" dir="rtl">
      {/* Calm Dimmed Backdrop */}
      <div 
        className="fixed inset-0 bg-[#1D1D1F]/55 transition-opacity"
        onClick={onClose}
      />

      {/* Clean Apple-Style Modal Card */}
      <div className="relative w-full max-w-[440px] max-h-[90vh] flex flex-col bg-[#FBFBFC] rounded-[24px] shadow-[0_24px_70px_rgba(29,29,31,0.22)] border border-[#E5E5EA] overflow-hidden z-10 animate-in zoom-in-95 duration-200">
        
        {/* Clean Light Header */}
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
                درگاه پرداخت امن Stripe • نمایش در صدر آگهی‌های کشور
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 rounded-full hover:bg-[#ECECEF] text-[#6E6E73] hover:text-[#1D1D1F] flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="بستن"
          >
            <X size={15} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto p-4 sm:p-5 space-y-3.5">

          {isPaid ? (
            <div className="text-center py-4 space-y-4 animate-in zoom-in-95">
              <div className="h-14 w-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 size={30} />
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-black text-[#1D1D1F]">ارتقای ویژه با موفقیت انجام شد!</h3>
                <p className="text-xs text-[#6E6E73] max-w-xs mx-auto leading-relaxed">
                  آگهی شما به بسته <span className="font-bold text-[#0066CC]">ویژه (VIP)</span> در کشور{' '}
                  <span className="font-bold text-[#1D1D1F]">{targetCountryObj.nameFa}</span> ارتقا یافت و در صدر آگهی‌ها قرار گرفت.
                </p>
              </div>

              <div className="bg-[#F5F5F7] rounded-2xl divide-y divide-[#E5E5EA] text-xs text-right font-medium overflow-hidden">
                <div className="flex justify-between px-4 py-2.5 text-[#6E6E73]">
                  <span>کشور نمایش ویژه:</span>
                  <span className="font-bold text-[#1D1D1F]">{targetCountryObj.nameFa}</span>
                </div>
                <div className="flex justify-between px-4 py-2.5 text-[#6E6E73]">
                  <span>مبلغ پرداختی:</span>
                  <span className="font-bold text-[#1D1D1F]" dir="ltr">{displayPrice} {resolvedCurrency}</span>
                </div>
                <div className="flex justify-between px-4 py-2.5 text-[#6E6E73]">
                  <span>مدت نمایش ویژه:</span>
                  <span className="font-bold text-emerald-600">{durationDays} روز (فعال)</span>
                </div>
                {ad?.reference_number && (
                  <div className="flex justify-between px-4 py-2.5 text-[#6E6E73]">
                    <span>کد مرجع آگهی:</span>
                    <span className="font-mono font-bold text-[#1D1D1F]" dir="ltr">{ad.reference_number}</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full h-10 rounded-full bg-[#0066CC] hover:bg-[#0055AA] text-white font-bold text-xs transition-all cursor-pointer"
              >
                مشاهده آگهی ویژه در {targetCountryObj.nameFa}
              </button>
            </div>
          ) : (
            <>
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
                  کشور هدف برای نمایش در بخش آگهی‌های ویژه (VIP):
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {activeCountries.map(c => {
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

              {/* Test Mode Quick Fill Bar */}
              {isTestMode && (
                <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#F5F5F7] border border-[#E5E5EA] text-[11px] text-[#515154]">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle size={13} className="text-[#86868B] shrink-0" />
                    <span>حالت آزمایشی درگاه Stripe فعال است</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleFillTestCard}
                    className="font-bold text-[#0066CC] hover:underline cursor-pointer shrink-0"
                  >
                    تکمیل خودکار کارت تست
                  </button>
                </div>
              )}

              {/* Error Notice */}
              {errorMsg && (
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Credit Card Form (Test Mode) or Stripe Checkout Redirect (Live Mode) */}
              <form onSubmit={handleSubmitPayment} className="space-y-3">
                {isTestMode ? (
                  <>
                <div>
                  <label className="block text-[11.5px] font-bold text-[#1D1D1F] mb-1">
                    نام دارنده کارت
                  </label>
                  <input
                    type="text"
                    required
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    placeholder="Ali Rezaei"
                    dir="ltr"
                    className="w-full h-10 rounded-xl bg-[#F5F5F7] border border-[#E5E5EA] px-3 text-xs text-[#1D1D1F] placeholder-[#86868B] focus:bg-[#FBFBFC] focus:border-[#0066CC] focus:outline-none transition-all text-left font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11.5px] font-bold text-[#1D1D1F] mb-1">
                    شماره کارت بانکی (Visa / Mastercard)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={cardNumber}
                      onChange={handleCardNumberChange}
                      placeholder="4242 •••• •••• 4242"
                      dir="ltr"
                      className="w-full h-10 rounded-xl bg-[#F5F5F7] border border-[#E5E5EA] ps-9 pe-3 text-xs font-mono text-[#1D1D1F] placeholder-[#86868B] tracking-wider focus:bg-[#FBFBFC] focus:border-[#0066CC] focus:outline-none transition-all text-left"
                    />
                    <CreditCard size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-[#86868B] pointer-events-none" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11.5px] font-bold text-[#1D1D1F] mb-1">
                      تاریخ انقضا (MM/YY)
                    </label>
                    <input
                      type="text"
                      required
                      value={expiry}
                      onChange={handleExpiryChange}
                      placeholder="12/28"
                      dir="ltr"
                      className="w-full h-10 rounded-xl bg-[#F5F5F7] border border-[#E5E5EA] px-3 text-xs font-mono text-[#1D1D1F] placeholder-[#86868B] text-center focus:bg-[#FBFBFC] focus:border-[#0066CC] focus:outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[11.5px] font-bold text-[#1D1D1F] mb-1">
                      کد امنیتی (CVC)
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={4}
                      value={cvc}
                      onChange={(e) => setCvc(e.target.value.replace(/\D/g, ''))}
                      placeholder="123"
                      dir="ltr"
                      className="w-full h-10 rounded-xl bg-[#F5F5F7] border border-[#E5E5EA] px-3 text-xs font-mono text-[#1D1D1F] placeholder-[#86868B] text-center focus:bg-[#FBFBFC] focus:border-[#0066CC] focus:outline-none transition-all"
                    />
                  </div>
                </div>
                  </>
                ) : (
                  <div className="rounded-xl bg-[#F5F5F7] border border-[#E5E5EA] p-3 text-xs text-[#515154] leading-relaxed">
                    برای پرداخت امن و واقعی، به صفحه رسمی Stripe Checkout منتقل خواهید شد و بلافاصله پس از تایید پرداخت، آگهی شما به مدت {durationDays} روز ویژه (VIP) می‌شود.
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-10 rounded-full bg-[#0066CC] hover:bg-[#0055AA] disabled:opacity-50 text-white font-bold text-xs shadow-[0_4px_14px_rgba(0,102,204,0.24)] active:scale-[0.97] transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                >
                  <Lock size={14} />
                  <span>
                    {loading
                      ? 'در حال پردازش پرداخت...'
                      : `پرداخت امن ${displayPrice} ${resolvedCurrency} و ویژه کردن در ${targetCountryObj.nameFa}`}
                  </span>
                </button>
              </form>

              {/* Compact Security Footer */}
              <div className="pt-1 flex items-center justify-center gap-2 text-[10.5px] text-[#86868B]">
                <ShieldCheck size={13} className="text-[#86868B] shrink-0" />
                <span>پرداخت رمزنگاری‌شده SSL • پشتیبانی از Visa و Mastercard</span>
              </div>
            </>
          )}

        </div>

      </div>
    </div>
  );
}
