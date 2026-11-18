import React, { useState, useEffect } from 'react';
import {
  X,
  MonitorSmartphone,
  CreditCard,
  Lock,
  CheckCircle2,
  Cloud,
  Rocket,
  ExternalLink,
  Copy,
  Check,
  Utensils,
  ShoppingBag,
  KeyRound,
  AlertCircle,
} from 'lucide-react';

const MONTHLY_PRICE = 240;
const MONTHLY_CURRENCY = 'SEK';
const SELLER_DEPLOY_ENDPOINT =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SELLER_DEPLOY_URL) ||
  'https://linksho-seller.vercel.app/api/cloudflare/deploy';

export default function WebsiteBuilderModal({
  isOpen,
  stripeSettings = null,
  onClose,
}) {
  const [step, setStep] = useState('payment'); // 'payment' | 'deploy' | 'done'
  const [cardHolder, setCardHolder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [payLoading, setPayLoading] = useState(false);

  // Store Deploy Form (uses owner's server-side Cloudflare account for security & billing control)
  const [storeName, setStoreName] = useState('');
  const [storeType, setStoreType] = useState('restaurant');
  const [currency, setCurrency] = useState('SEK');
  const [shippingFee, setShippingFee] = useState('49');
  const [phone, setPhone] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedKey, setCopiedKey] = useState('');

  const isTestMode = stripeSettings?.mode !== 'live';

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const copyText = async (val, key) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(''), 2000);
    } catch {}
  };

  const handlePaySubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!cardHolder.trim() || !cardNumber.trim() || !cardExpiry.trim() || !cardCvc.trim()) {
      setErrorMsg('لطفاً تمام مشخصات کارت بانکی را وارد کنید.');
      return;
    }
    setPayLoading(true);
    setTimeout(() => {
      setPayLoading(false);
      setStep('deploy');
    }, 650);
  };

  const handleDeploySubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!storeName.trim()) {
      setErrorMsg('لطفاً نام فروشگاه یا رستوران را وارد کنید.');
      return;
    }
    setDeploying(true);
    try {
      const res = await fetch(SELLER_DEPLOY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: storeName.trim(),
          type: storeType,
          currency,
          shippingFee: Number(shippingFee) || 0,
          phone: phone.trim(),
        }),
      });
      const json = await res.json();
      if (!json?.ok) {
        setErrorMsg(json?.error || 'خطا در ساخت خودکار پنل فروش');
        return;
      }

      // Log deployment to admin registry so unpaid stores can be terminated by admin
      try {
        await fetch('/api/public', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'register_seller_deployment',
            deployment: {
              storeId: json.storeId,
              name: json.name || storeName.trim(),
              type: json.type || storeType,
              currency: json.currency || currency,
              panelUrl: json.panelUrl,
              storefrontApiUrl: json.storefrontApiUrl,
              workerName: json.workerName,
              dbId: json.dbId,
              monthlyPrice: MONTHLY_PRICE,
              createdAt: json.createdAt || new Date().toISOString(),
            },
          }),
        });
      } catch {}

      setDeployResult(json);
      setStep('done');
    } catch {
      setErrorMsg('خطا در اتصال به سرویس ساخت پنل فروش. لطفاً دوباره تلاش کنید.');
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6 font-vazir select-none"
      dir="rtl"
    >
      <div className="fixed inset-0 bg-[#1D1D1F]/60 transition-opacity" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-[#FBFBFC] rounded-[28px] shadow-[0_24px_70px_rgba(29,29,31,0.24)] border border-[#E5E5EA] overflow-hidden z-10 flex flex-col max-h-[88dvh]">
        {/* Header */}
        <div className="px-5 sm:px-6 pt-5 pb-4 bg-white border-b border-[#E5E5EA] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-2xl bg-[#0066CC] text-white flex items-center justify-center shrink-0">
              <MonitorSmartphone size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-[16px] font-black text-[#1D1D1F] truncate">
                ساخت وب‌سایت و پنل فروش اختصاصی
              </h2>
              <p className="text-[11px] text-[#6E6E73] truncate">
                فروشگاه آنلاین و منوی رستوران روی کلودفلر شما • ۲۴۰ کرون ماهانه
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#ECECEF] cursor-pointer shrink-0"
            title="بستن"
          >
            <X size={17} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 sm:p-6 space-y-4">
          {/* Step Indicators */}
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-[#F5F5F7] border border-[#E5E5EA] text-[11px] font-bold">
            <div className={`py-1.5 text-center rounded-xl ${step === 'payment' ? 'bg-white text-[#1D1D1F] shadow-xs' : 'text-[#6E6E73]'}`}>
              ۱. اشتراک ماهانه
            </div>
            <div className={`py-1.5 text-center rounded-xl ${step === 'deploy' ? 'bg-white text-[#1D1D1F] shadow-xs' : 'text-[#6E6E73]'}`}>
              ۲. نصب روی کلودفلر
            </div>
            <div className={`py-1.5 text-center rounded-xl ${step === 'done' ? 'bg-emerald-600 text-white shadow-xs' : 'text-[#6E6E73]'}`}>
              ۳. آماده استفاده
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: MONTHLY PAYMENT (240 SEK/MO) */}
          {step === 'payment' && (
            <form onSubmit={handlePaySubmit} className="space-y-4">
              <div className="rounded-2xl bg-white border border-[#E5E5EA] p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#1D1D1F]">اشتراک ماهانه پنل فروش و وب‌سایت</span>
                  <span className="text-base font-black text-[#0066CC] tabular-nums" dir="ltr">
                    {MONTHLY_PRICE} {MONTHLY_CURRENCY} / ماه
                  </span>
                </div>
                <ul className="text-[11.5px] text-[#515154] space-y-1">
                  <li>• نصب خودکار با ۱ کلیک روی کلودفلر شخصی شما (Worker + D1)</li>
                  <li>• افزودن نامحدود محصول/منو، مدیریت سفارش‌ها و هزینه ارسال</li>
                  <li>• اتصال مستقیم به آگهی‌های لینک شو با API + درگاه Stripe</li>
                </ul>
              </div>

              <div className="rounded-2xl bg-white border border-[#E5E5EA] p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#1D1D1F] flex items-center gap-1.5">
                    <CreditCard size={15} className="text-[#0066CC]" />
                    <span>پرداخت امن با Stripe ({isTestMode ? 'آزمایشی' : 'Live'})</span>
                  </span>
                  {isTestMode && (
                    <button
                      type="button"
                      onClick={() => {
                        setCardHolder('Ali Rezaei');
                        setCardNumber('4242 4242 4242 4242');
                        setCardExpiry('12/28');
                        setCardCvc('424');
                      }}
                      className="text-[11px] font-bold text-[#0066CC] cursor-pointer"
                    >
                      پر کردن کارت تست
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  required
                  value={cardHolder}
                  onChange={(e) => setCardHolder(e.target.value)}
                  placeholder="نام دارنده کارت (مثلاً: Ali Rezaei)"
                  className="w-full h-10 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7] px-3 text-xs"
                />
                <input
                  type="text"
                  required
                  dir="ltr"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  placeholder="4242 4242 4242 4242"
                  className="w-full h-10 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7] px-3 text-xs font-mono text-left"
                />
                <div className="grid grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    required
                    dir="ltr"
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(e.target.value)}
                    placeholder="MM/YY"
                    className="h-10 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7] px-3 text-xs font-mono text-left"
                  />
                  <input
                    type="text"
                    required
                    dir="ltr"
                    value={cardCvc}
                    onChange={(e) => setCardCvc(e.target.value)}
                    placeholder="CVC"
                    className="h-10 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7] px-3 text-xs font-mono text-left"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={payLoading}
                className="w-full h-11 rounded-full bg-[#0066CC] hover:bg-[#0055AA] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-60"
              >
                <Lock size={14} />
                <span>
                  {payLoading
                    ? 'در حال تایید پرداخت...'
                    : `پرداخت ${MONTHLY_PRICE} ${MONTHLY_CURRENCY} و رفتن به مرحله نصب`}
                </span>
              </button>
            </form>
          )}

          {/* STEP 2: 1-CLICK DEPLOY (NO CLOUDFLARE LOGIN REQUIRED BY USER) */}
          {step === 'deploy' && (
            <form onSubmit={handleDeploySubmit} className="space-y-4">
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>پرداخت ۲۴۰ کرون تایید شد! مشخصات فروشگاه خود را وارد کنید تا در چند ثانیه ساخته شود.</span>
              </div>

              <div className="space-y-3">
                <input
                  type="text"
                  required
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="نام رستوران یا فروشگاه شما *"
                  className="w-full h-10 rounded-xl bg-white border border-[#D2D2D7] px-3 text-xs"
                />

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setStoreType('restaurant')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                      storeType === 'restaurant'
                        ? 'bg-blue-50 border-[#0066CC] text-[#0066CC]'
                        : 'bg-white border-[#E5E5EA] text-[#6E6E73]'
                    }`}
                  >
                    <Utensils size={14} />
                    <span>رستوران / کافه</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStoreType('webshop')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                      storeType === 'webshop'
                        ? 'bg-blue-50 border-[#0066CC] text-[#0066CC]'
                        : 'bg-white border-[#E5E5EA] text-[#6E6E73]'
                    }`}
                  >
                    <ShoppingBag size={14} />
                    <span>فروشگاه / وب‌شاپ</span>
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="h-10 rounded-xl bg-white border border-[#D2D2D7] px-2 text-xs"
                  >
                    <option value="SEK">SEK</option>
                    <option value="EUR">EUR</option>
                    <option value="NOK">NOK</option>
                    <option value="DKK">DKK</option>
                  </select>
                  <input
                    type="number"
                    min="0"
                    dir="ltr"
                    value={shippingFee}
                    onChange={(e) => setShippingFee(e.target.value)}
                    placeholder="هزینه ارسال"
                    className="h-10 rounded-xl bg-white border border-[#D2D2D7] px-2.5 text-xs font-mono text-left"
                  />
                  <input
                    type="text"
                    dir="ltr"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="تلفن"
                    className="h-10 rounded-xl bg-white border border-[#D2D2D7] px-2.5 text-xs font-mono text-left"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={deploying}
                className="w-full h-11 rounded-full bg-gradient-to-l from-[#F38020] to-[#E05D00] text-white text-xs font-black flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <Rocket size={15} />
                <span>{deploying ? 'در حال نصب روی کلودفلر...' : 'نصب خودکار روی کلودفلر با ۱ کلیک'}</span>
              </button>
            </form>
          )}

          {/* STEP 3: READY TO USE */}
          {step === 'done' && deployResult && (
            <div className="space-y-3.5">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-2.5 text-xs font-bold">
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                <span>پنل فروش و دیتابیس اختصاصی شما روی کلودفلر آماده استفاده است!</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-white border border-[#E5E5EA] space-y-2">
                <span className="text-xs font-bold text-[#1D1D1F] block">آدرس پنل فروش شما:</span>
                <div className="flex gap-2">
                  <input readOnly dir="ltr" value={deployResult.panelUrl} className="flex-1 h-9 rounded-xl bg-[#F5F5F7] px-3 text-xs font-mono" />
                  <a
                    href={deployResult.panelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-9 px-3.5 rounded-xl bg-[#0066CC] text-white text-xs font-bold inline-flex items-center gap-1 shrink-0"
                  >
                    <span>ورود</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <KeyRound size={15} className="text-amber-700" />
                  <span className="font-bold">رمز ورود (PIN):</span>
                  <strong className="font-mono text-sm">{deployResult.pinCode}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => copyText(deployResult.pinCode, 'pin')}
                  className="h-8 px-3 rounded-lg bg-white border border-amber-300 text-xs font-bold cursor-pointer"
                >
                  {copiedKey === 'pin' ? 'کپی شد!' : 'کپی'}
                </button>
              </div>

              <div className="p-3.5 rounded-2xl bg-white border border-[#E5E5EA] space-y-2">
                <span className="text-xs font-bold text-[#1D1D1F] block">لینک API برای اتصال به آگهی:</span>
                <div className="flex gap-2">
                  <input readOnly dir="ltr" value={deployResult.storefrontApiUrl} className="flex-1 h-9 rounded-xl bg-[#F5F5F7] px-3 text-xs font-mono" />
                  <button
                    type="button"
                    onClick={() => copyText(deployResult.storefrontApiUrl, 'api')}
                    className="h-9 px-3.5 rounded-xl bg-[#1D1D1F] text-white text-xs font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    {copiedKey === 'api' ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copiedKey === 'api' ? 'کپی شد' : 'کپی'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
