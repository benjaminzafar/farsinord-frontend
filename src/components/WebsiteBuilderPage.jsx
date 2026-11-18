import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  MonitorSmartphone,
  CreditCard,
  Lock,
  CheckCircle2,
  Clock,
  Mail,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  KeyRound,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';

const MONTHLY_PRICE = 260;
const MONTHLY_CURRENCY = 'SEK';

export default function WebsiteBuilderPage({
  stripeSettings = null,
  onBack,
}) {
  const [pageMode, setPageMode] = useState('order'); // 'order' | 'manage'

  const [storeName, setStoreName] = useState('');
  const [phone, setPhone] = useState('');
  const [companyNumber, setCompanyNumber] = useState('');
  const [email, setEmail] = useState('');

  const [cardHolder, setCardHolder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  // Subscription Management by 8-Digit Code
  const [manageCodeInput, setManageCodeInput] = useState('');
  const [managedSub, setManagedSub] = useState(null);
  const [manageLoading, setManageLoading] = useState(false);
  const [manageMsg, setManageMsg] = useState('');

  const isTestMode = stripeSettings?.mode !== 'live';

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const copyManageCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {}
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!storeName.trim() || !phone.trim() || !companyNumber.trim() || !email.trim()) {
      setErrorMsg('لطفاً نام سایت، شماره تماس، شماره ثبت شرکت و ایمیل را کامل وارد کنید.');
      return;
    }
    if (!cardHolder.trim() || !cardNumber.trim() || !cardExpiry.trim() || !cardCvc.trim()) {
      setErrorMsg('لطفاً مشخصات کارت بانکی را برای فعال‌سازی اشتراک ماهانه وارد کنید.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit_website_order',
          name: storeName.trim(),
          phone: phone.trim(),
          companyNumber: companyNumber.trim(),
          email: email.trim(),
        }),
      });
      const json = await res.json();
      if (!json?.ok) {
        setErrorMsg(json?.error || 'خطا در ثبت سفارش ساخت وب‌سایت. لطفاً دوباره تلاش کنید.');
        return;
      }
      setSubmittedOrder(json.order);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setErrorMsg('خطا در ارتباط با سرور. لطفاً دوباره تلاش کنید.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleManageAction = async (subAction = 'lookup', e = null) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setManageMsg('');
    const clean = manageCodeInput.replace(/\D/g, '').trim();
    if (clean.length !== 8) {
      setErrorMsg('لطفاً کد مدیریت ۸ رقمی را به‌صورت کامل وارد کنید.');
      return;
    }
    setManageLoading(true);
    try {
      const res = await fetch('/api/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'manage_website_subscription',
          manageCode: clean,
          subAction,
        }),
      });
      const json = await res.json();
      if (!json?.ok) {
        setErrorMsg(json?.error || 'کد مدیریت یافت نشد.');
        setManagedSub(null);
        return;
      }
      setManagedSub(json.subscription);
      if (subAction === 'renew') setManageMsg('اشتراک ماهانه شما به مدت ۳۰ روز تمدید شد.');
      if (subAction === 'cancel') setManageMsg('اشتراک شما لغو شد.');
    } catch {
      setErrorMsg('خطا در ارتباط با سرور.');
    } finally {
      setManageLoading(false);
    }
  };

  return (
    <main className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6 font-vazir min-h-[70vh]" dir="rtl">
      {/* Top Page Header */}
      <div className="rounded-3xl bg-white border border-[#E5E5EA] p-4 sm:p-6 shadow-[0_2px_12px_rgba(29,29,31,0.04)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="h-10 px-3.5 rounded-full bg-[#F5F5F7] hover:bg-[#ECECEF] text-[#1D1D1F] text-xs font-bold inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
          >
            <ArrowRight size={15} />
            <span>بازگشت</span>
          </button>

          <div className="h-11 w-11 rounded-2xl bg-[#0066CC] text-white flex items-center justify-center shrink-0 shadow-[0_6px_16px_rgba(0,102,204,0.22)]">
            <MonitorSmartphone size={20} />
          </div>

          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-black text-[#1D1D1F] tracking-tight truncate">
              ساخت وب‌سایت و پنل فروش اختصاصی
            </h1>
            <p className="text-xs text-[#6E6E73] mt-0.5 truncate">
              فروشگاه آنلاین و منوی رستوران • اشتراک ماهانه ۲۶۰ کرون (تحویل تا ۲۴ ساعت)
            </p>
          </div>
        </div>

        {/* Mode Switcher: New Subscription vs Manage with 8-Digit Code */}
        <div className="inline-flex items-center p-1 rounded-2xl bg-[#F5F5F7] border border-[#E5E5EA] self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => { setPageMode('order'); setErrorMsg(''); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
              pageMode === 'order' ? 'bg-white text-[#1D1D1F] shadow-xs' : 'text-[#6E6E73]'
            }`}
          >
            ثبت سفارش جدید
          </button>
          <button
            type="button"
            onClick={() => { setPageMode('manage'); setErrorMsg(''); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
              pageMode === 'manage' ? 'bg-white text-[#1D1D1F] shadow-xs' : 'text-[#6E6E73]'
            }`}
          >
            مدیریت اشتراک (کد ۸ رقمی)
          </button>
        </div>
      </div>

      {pageMode === 'manage' ? (
        /* MANAGE SUBSCRIPTION WITH 8-DIGIT CODE */
        <div className="max-w-xl mx-auto rounded-3xl bg-white border border-[#E5E5EA] p-5 sm:p-7 space-y-5 shadow-[0_2px_12px_rgba(29,29,31,0.04)]">
          <div className="space-y-1">
            <h2 className="text-base font-black text-[#1D1D1F] flex items-center gap-2">
              <KeyRound size={18} className="text-[#0066CC]" />
              <span>مدیریت اشتراک وب‌سایت با کد ۸ رقمی</span>
            </h2>
            <p className="text-xs text-[#6E6E73]">
              کد ۸ رقمی اختصاصی که هنگام ثبت اشتراک دریافت کرده‌اید را وارد کنید.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {manageMsg && (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 size={15} className="shrink-0" />
              <span>{manageMsg}</span>
            </div>
          )}

          <form onSubmit={(e) => handleManageAction('lookup', e)} className="flex gap-2">
            <input
              type="text"
              dir="ltr"
              maxLength={8}
              value={manageCodeInput}
              onChange={(e) => setManageCodeInput(e.target.value.replace(/\D/g, ''))}
              placeholder="12345678"
              className="flex-1 h-11 rounded-2xl bg-[#F5F5F7] border border-[#D2D2D7] px-4 text-sm font-mono text-center tracking-widest focus:bg-white focus:border-[#0066CC] focus:outline-none"
            />
            <button
              type="submit"
              disabled={manageLoading}
              className="h-11 px-5 rounded-2xl bg-[#0066CC] hover:bg-[#0055AA] text-white text-xs font-bold cursor-pointer disabled:opacity-60"
            >
              {manageLoading ? 'در حال بررسی...' : 'مشاهده اشتراک'}
            </button>
          </form>

          {managedSub && (
            <div className="rounded-2xl bg-[#F5F5F7] border border-[#E5E5EA] p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#6E6E73]">نام سایت:</span>
                <strong className="text-[#1D1D1F]">{managedSub.name}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#6E6E73]">شماره ثبت شرکت:</span>
                <strong className="font-mono">{managedSub.companyNumber}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#6E6E73]">وضعیت:</span>
                <strong className={managedSub.status === 'cancelled' ? 'text-rose-600' : 'text-emerald-700'}>
                  {managedSub.status === 'cancelled'
                    ? 'لغو شده'
                    : managedSub.status === 'pending_setup'
                    ? 'در حال آماده‌سازی (تحویل تا ۲۴ ساعت)'
                    : 'فعال'}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#6E6E73]">تاریخ انقضای اشتراک:</span>
                <strong className="text-[#1D1D1F]">
                  {managedSub.expiresAt ? new Date(managedSub.expiresAt).toLocaleDateString('fa-IR') : '-'}
                </strong>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-[#E5E5EA]">
                <button
                  type="button"
                  disabled={manageLoading}
                  onClick={() => handleManageAction('renew')}
                  className="flex-1 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw size={13} />
                  <span>تمدید ۳۰ روزه (۲۶۰ کرون)</span>
                </button>
                {managedSub.status !== 'cancelled' && (
                  <button
                    type="button"
                    disabled={manageLoading}
                    onClick={() => handleManageAction('cancel')}
                    className="h-9 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold cursor-pointer"
                  >
                    لغو اشتراک
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ) : submittedOrder ? (
        /* 24-HOUR DELIVERY CONFIRMATION VIEW WITH 8-DIGIT MANAGEMENT CODE */
        <div className="rounded-3xl bg-white border border-[#E5E5EA] p-6 sm:p-10 text-center space-y-5 shadow-[0_6px_28px_rgba(29,29,31,0.06)]">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
            <CheckCircle2 size={34} />
          </div>

          <div className="space-y-2 max-w-xl mx-auto">
            <h2 className="text-lg sm:text-2xl font-black text-[#1D1D1F]">
              سفارش و اشتراک شما با موفقیت ثبت شد!
            </h2>
            <p className="text-xs sm:text-sm text-[#515154] leading-relaxed">
              ساخت، دیپلوی و راه‌اندازی کامل وب‌سایت و پنل فروش اختصاصی شما حداکثر ظرف <strong className="text-[#1D1D1F]">۲۴ ساعت آینده</strong> انجام می‌شود و پس از آماده‌سازی، تمامی جزئیات پنل و دسترسی‌ها به ایمیل <strong className="font-mono text-[#0066CC]" dir="ltr">{submittedOrder.email}</strong> ارسال خواهد شد.
            </p>
          </div>

          {/* 8-Digit Strong Management Code Box */}
          <div className="max-w-md mx-auto rounded-2xl bg-amber-50/80 border border-amber-200 p-4 space-y-2">
            <div className="flex items-center justify-center gap-1.5 text-xs font-black text-amber-950">
              <KeyRound size={15} className="text-amber-700" />
              <span>کد ۸ رقمی مدیریت اشتراک شما (حتماً ذخیره کنید)</span>
            </div>
            <div className="flex items-center justify-center gap-3">
              <span className="font-mono text-2xl font-black tracking-widest text-amber-900 select-all" dir="ltr">
                {submittedOrder.manageCode}
              </span>
              <button
                type="button"
                onClick={() => copyManageCode(submittedOrder.manageCode)}
                className="h-8 px-3 rounded-lg bg-white border border-amber-300 text-xs font-bold text-amber-900 inline-flex items-center gap-1 cursor-pointer"
              >
                {copiedCode ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiedCode ? 'کپی شد' : 'کپی'}</span>
              </button>
            </div>
            <p className="text-[11px] text-amber-800">
              از این کد در بخش «مدیریت اشتراک» برای مشاهده وضعیت، تمدید ماهانه یا لغو اشتراک استفاده کنید.
            </p>
          </div>

          <div className="max-w-md mx-auto rounded-2xl bg-[#F5F5F7] border border-[#E5E5EA] p-4 text-right space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#6E6E73]">کد پیگیری سفارش:</span>
              <strong className="font-mono text-[#1D1D1F]">{submittedOrder.storeId}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#6E6E73]">نام سایت / فروشگاه:</span>
              <strong className="text-[#1D1D1F]">{submittedOrder.name}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#6E6E73]">شماره ثبت شرکت:</span>
              <strong className="font-mono text-[#1D1D1F]">{submittedOrder.companyNumber}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#6E6E73]">زمان تحویل:</span>
              <strong className="text-emerald-700 flex items-center gap-1">
                <Clock size={13} />
                <span>حداکثر ۲۴ ساعت (ارسال از طریق ایمیل)</span>
              </strong>
            </div>
          </div>

          <button
            type="button"
            onClick={onBack}
            className="h-11 px-7 rounded-full bg-[#0066CC] hover:bg-[#0055AA] text-white text-xs font-bold cursor-pointer"
          >
            بازگشت به صفحه اصلی
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* RIGHT COLUMN: HOW IT WORKS & SERVICE INFO */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-3xl bg-white border border-[#E5E5EA] p-5 sm:p-6 space-y-4 shadow-[0_2px_12px_rgba(29,29,31,0.04)]">
              <div className="flex items-center gap-2">
                <Sparkles size={17} className="text-[#0066CC]" />
                <h2 className="text-sm sm:text-base font-black text-[#1D1D1F]">نحوه کار و امکانات وب‌سایت شما</h2>
              </div>

              <div className="space-y-3 text-xs text-[#515154] leading-relaxed">
                <div className="p-3.5 rounded-2xl bg-[#F5F5F7] border border-[#E5E5EA] space-y-1">
                  <span className="font-black text-[#1D1D1F] block">۱. پنل فروش و وب‌سایت اختصاصی</span>
                  <p>
                    مناسب برای رستوران‌ها، کافه‌ها و فروشگاه‌های اینترنتی؛ شامل مدیریت محصولات، منوی غذا، تنظیم هزینه ارسال، دریافت سفارش و درگاه پرداخت Stripe.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#F5F5F7] border border-[#E5E5EA] space-y-1">
                  <span className="font-black text-[#1D1D1F] block">۲. اتصال مستقیم به آگهی‌های لینک شو</span>
                  <p>
                    پس از دریافت لینک API اختصاصی، می‌توانید آن را در آگهی‌های خود قرار دهید تا مشتریان مستقیماً از داخل آگهی خرید کنند.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200/80 space-y-1">
                  <span className="font-black text-[#0066CC] flex items-center gap-1.5">
                    <Clock size={14} />
                    <span>۳. ساخت، دیپلوی و تحویل ظرف ۲۴ ساعت</span>
                  </span>
                  <p className="text-[#1D1D1F]">
                    تیم فنی ما وب‌سایت شما را ظرف ۲۴ ساعت راه‌اندازی و دیپلوی کرده و تمام اطلاعات ورود را به ایمیل شما ارسال می‌کند. همچنین یک کد ۸ رقمی برای مدیریت اشتراک دریافت می‌کنید.
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-[#F0F0F2] flex items-center justify-between text-xs">
                <span className="text-[#6E6E73] flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-emerald-600" />
                  <span>اشتراک ماهانه (غیر دائمی)</span>
                </span>
                <strong className="text-sm font-black text-[#1D1D1F]" dir="ltr">
                  {MONTHLY_PRICE} {MONTHLY_CURRENCY} / ماه
                </strong>
              </div>
            </div>
          </div>

          {/* LEFT COLUMN: USER INFO & SUBSCRIPTION FORM */}
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-7 rounded-3xl bg-white border border-[#E5E5EA] p-5 sm:p-6 space-y-5 shadow-[0_2px_12px_rgba(29,29,31,0.04)]"
          >
            <div className="border-b border-[#F0F0F2] pb-3">
              <h2 className="text-sm sm:text-base font-black text-[#1D1D1F]">ثبت مشخصات و فعال‌سازی اشتراک</h2>
              <p className="text-xs text-[#6E6E73] mt-0.5">
                اطلاعات زیر را وارد کنید تا وب‌سایت شما آماده و به ایمیلتان ارسال شود.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-[#1D1D1F] mb-1">نام سایت / فروشگاه *</label>
                <input
                  type="text"
                  required
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="مثلاً: رستوران زعفران"
                  className="w-full h-10 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7] px-3 text-xs focus:bg-white focus:border-[#0066CC] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1D1D1F] mb-1">شماره تماس *</label>
                <input
                  type="tel"
                  required
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+46 70 000 00 00"
                  className="w-full h-10 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7] px-3 text-xs font-mono text-left focus:bg-white focus:border-[#0066CC] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1D1D1F] mb-1">شماره ثبت شرکت (Org.nr) *</label>
                <input
                  type="text"
                  required
                  dir="ltr"
                  value={companyNumber}
                  onChange={(e) => setCompanyNumber(e.target.value)}
                  placeholder="559000-0000"
                  className="w-full h-10 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7] px-3 text-xs font-mono text-left focus:bg-white focus:border-[#0066CC] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1D1D1F] mb-1">ایمیل (جهت ارسال اطلاعات سایت) *</label>
                <input
                  type="email"
                  required
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="info@example.com"
                  className="w-full h-10 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7] px-3 text-xs font-mono text-left focus:bg-white focus:border-[#0066CC] focus:outline-none"
                />
              </div>
            </div>

            {/* Stripe Subscription Payment Box */}
            <div className="rounded-2xl bg-[#F5F5F7] border border-[#E5E5EA] p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#1D1D1F] flex items-center gap-1.5">
                  <CreditCard size={15} className="text-[#0066CC]" />
                  <span>پرداخت اشتراک ماهانه ({MONTHLY_PRICE} {MONTHLY_CURRENCY})</span>
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
                className="w-full h-10 rounded-xl bg-white border border-[#D2D2D7] px-3 text-xs"
              />
              <input
                type="text"
                required
                dir="ltr"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                placeholder="4242 4242 4242 4242"
                className="w-full h-10 rounded-xl bg-white border border-[#D2D2D7] px-3 text-xs font-mono text-left"
              />
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  type="text"
                  required
                  dir="ltr"
                  value={cardExpiry}
                  onChange={(e) => setCardExpiry(e.target.value)}
                  placeholder="MM/YY"
                  className="h-10 rounded-xl bg-white border border-[#D2D2D7] px-3 text-xs font-mono text-left"
                />
                <input
                  type="text"
                  required
                  dir="ltr"
                  value={cardCvc}
                  onChange={(e) => setCardCvc(e.target.value)}
                  placeholder="CVC"
                  className="h-10 rounded-xl bg-white border border-[#D2D2D7] px-3 text-xs font-mono text-left"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-1.5 text-[11px] text-[#6E6E73]">
                <Mail size={13} className="text-[#0066CC] shrink-0" />
                <span>تحویل حداکثر تا ۲۴ ساعت از طریق ایمیل</span>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="h-11 px-7 rounded-full bg-[#0066CC] hover:bg-[#0055AA] text-white text-xs font-bold inline-flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-60"
              >
                <Lock size={14} />
                <span>
                  {submitting
                    ? 'در حال ثبت سفارش...'
                    : `پرداخت ${MONTHLY_PRICE} ${MONTHLY_CURRENCY} و ثبت سفارش`}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
