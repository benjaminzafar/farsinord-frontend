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
  AlertCircle,
  KeyRound,
  Copy,
  Check,
  RefreshCw,
  Globe,
  Cpu,
  HardDrive,
  ExternalLink,
  Zap,
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
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="h-10 px-4 rounded-full bg-white hover:bg-[#F5F5F7] border border-[#E5E5EA] text-[#1D1D1F] text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
        >
          <ArrowRight size={15} />
          <span>بازگشت به آگهی‌ها</span>
        </button>

        <div className="inline-flex items-center p-1 rounded-2xl bg-white border border-[#E5E5EA] shadow-2xs">
          <button
            type="button"
            onClick={() => { setPageMode('order'); setErrorMsg(''); }}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
              pageMode === 'order' ? 'bg-[#1D1D1F] text-white' : 'text-[#6E6E73] hover:text-[#1D1D1F]'
            }`}
          >
            سفارش وب‌سایت جدید
          </button>
          <button
            type="button"
            onClick={() => { setPageMode('manage'); setErrorMsg(''); }}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
              pageMode === 'manage' ? 'bg-[#1D1D1F] text-white' : 'text-[#6E6E73] hover:text-[#1D1D1F]'
            }`}
          >
            مدیریت اشتراک (کد ۸ رقمی)
          </button>
        </div>
      </div>

      {pageMode === 'manage' ? (
        /* MANAGE SUBSCRIPTION WITH 8-DIGIT CODE */
        <div className="max-w-lg mx-auto rounded-[28px] bg-white border border-[#E5E5EA] p-6 sm:p-8 space-y-5 shadow-[0_8px_30px_rgba(29,29,31,0.05)]">
          <div className="text-center space-y-1.5">
            <div className="h-12 w-12 mx-auto rounded-2xl bg-blue-50 text-[#0066CC] flex items-center justify-center">
              <KeyRound size={22} />
            </div>
            <h2 className="text-lg font-black text-[#1D1D1F]">مدیریت اشتراک وب‌سایت</h2>
            <p className="text-xs text-[#6E6E73]">
              کد ۸ رقمی که هنگام ثبت‌نام دریافت کرده‌اید را وارد کنید.
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
              className="flex-1 h-11 rounded-2xl bg-[#F5F5F7] border border-[#D2D2D7] px-4 text-sm font-mono text-center tracking-[0.25em] focus:bg-white focus:border-[#0066CC] focus:outline-none"
            />
            <button
              type="submit"
              disabled={manageLoading}
              className="h-11 px-5 rounded-2xl bg-[#0066CC] hover:bg-[#0055AA] text-white text-xs font-bold cursor-pointer disabled:opacity-60 shrink-0"
            >
              {manageLoading ? 'بررسی...' : 'ورود'}
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
                <span className="text-[#6E6E73]">تاریخ انقضا:</span>
                <strong className="text-[#1D1D1F]">
                  {managedSub.expiresAt ? new Date(managedSub.expiresAt).toLocaleDateString('fa-IR') : '-'}
                </strong>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-[#E5E5EA]">
                <button
                  type="button"
                  disabled={manageLoading}
                  onClick={() => handleManageAction('renew')}
                  className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw size={13} />
                  <span>تمدید ۳۰ روزه (۲۶۰ کرون)</span>
                </button>
                {managedSub.status !== 'cancelled' && (
                  <button
                    type="button"
                    disabled={manageLoading}
                    onClick={() => handleManageAction('cancel')}
                    className="h-10 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold cursor-pointer"
                  >
                    لغو اشتراک
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ) : submittedOrder ? (
        /* 24-HOUR DELIVERY CONFIRMATION VIEW */
        <div className="max-w-xl mx-auto rounded-[28px] bg-white border border-[#E5E5EA] p-6 sm:p-10 text-center space-y-6 shadow-[0_8px_30px_rgba(29,29,31,0.06)]">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
            <CheckCircle2 size={34} />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-black text-[#1D1D1F]">
              سفارش شما ثبت شد!
            </h2>
            <p className="text-xs sm:text-sm text-[#515154] leading-relaxed">
              ساخت، دیپلوی و تحویل وب‌سایت و پنل فروش اختصاصی شما حداکثر ظرف <strong className="text-[#1D1D1F]">۲۴ ساعت آینده</strong> انجام می‌شود و تمامی جزئیات به ایمیل <strong className="font-mono text-[#0066CC]" dir="ltr">{submittedOrder.email}</strong> ارسال خواهد شد.
            </p>
          </div>

          <div className="rounded-2xl bg-amber-50/80 border border-amber-200 p-4 space-y-2">
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
          </div>

          <div className="rounded-2xl bg-[#F5F5F7] border border-[#E5E5EA] p-4 text-right space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#6E6E73]">کد پیگیری:</span>
              <strong className="font-mono">{submittedOrder.storeId}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#6E6E73]">نام سایت:</span>
              <strong>{submittedOrder.name}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#6E6E73]">شماره ثبت شرکت:</span>
              <strong className="font-mono">{submittedOrder.companyNumber}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#6E6E73]">زمان تحویل:</span>
              <strong className="text-emerald-700">حداکثر ۲۴ ساعت (ارسال از طریق ایمیل)</strong>
            </div>
          </div>

          <button
            type="button"
            onClick={onBack}
            className="h-11 px-8 rounded-full bg-[#0066CC] hover:bg-[#0055AA] text-white text-xs font-bold cursor-pointer"
          >
            بازگشت به صفحه اصلی
          </button>
        </div>
      ) : (
        <>
          {/* CLEAN HERO BANNER WITH PRICE + DEMO LINKS */}
          <div className="rounded-[28px] bg-white border border-[#E5E5EA] p-6 sm:p-8 shadow-[0_4px_20px_rgba(29,29,31,0.04)] flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-[#0066CC] text-[11px] font-bold">
                <MonitorSmartphone size={14} />
                <span>سرویس اختصاصی فروشگاه اینترنتی و منوی رستوران</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-[#1D1D1F] tracking-tight">
                وب‌سایت و پنل فروش اختصاصی خود را راه‌اندازی کنید
              </h1>
              <p className="text-xs sm:text-sm text-[#6E6E73] leading-relaxed">
                مدیریت کامل محصولات، هزینه ارسال، سفارش‌ها و درگاه پرداخت با زیرساخت ابری پرسرعت و اتصال مستقیم به آگهی‌های لینک شو.
              </p>

              {/* Demo Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <a
                  href="https://swedpersiska.vercel.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-9 px-4 rounded-full bg-[#F5F5F7] hover:bg-[#ECECEF] border border-[#D2D2D7] text-[#1D1D1F] text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                >
                  <span>مشاهده دموی وب‌سایت (Frontend)</span>
                  <ExternalLink size={12} />
                </a>
                <a
                  href="https://linksho-seller.vercel.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-9 px-4 rounded-full bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[#0066CC] text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                >
                  <span>مشاهده دموی پنل فروش</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>

            {/* Price Pill Card */}
            <div className="shrink-0 rounded-2xl bg-[#F5F5F7] border border-[#E5E5EA] px-6 py-5 text-center space-y-1 min-w-[190px]">
              <span className="text-[11px] font-bold text-[#6E6E73] block">اشتراک ماهانه (غیر دائمی)</span>
              <div className="text-3xl font-black text-[#1D1D1F] tabular-nums" dir="ltr">
                {MONTHLY_PRICE} <span className="text-sm font-bold text-[#6E6E73]">{MONTHLY_CURRENCY}</span>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                <Clock size={12} />
                <span>تحویل حداکثر ۲۴ ساعت</span>
              </span>
            </div>
          </div>

          {/* TWO-COLUMN CHECKOUT + SPECS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* RIGHT: CLEAN ORDER & STRIPE PAYMENT FORM */}
            <form
              onSubmit={handleSubmit}
              className="lg:col-span-7 rounded-[28px] bg-white border border-[#E5E5EA] p-6 sm:p-7 space-y-5 shadow-[0_4px_20px_rgba(29,29,31,0.04)]"
            >
              <div>
                <h2 className="text-base font-black text-[#1D1D1F]">۱. مشخصات سایت و کسب‌وکار</h2>
                <p className="text-xs text-[#6E6E73] mt-0.5">اطلاعات دسترسی و پنل پس از ساخت به ایمیل شما ارسال می‌شود.</p>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#1D1D1F] mb-1.5">نام سایت / فروشگاه *</label>
                  <input
                    type="text"
                    required
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="مثلاً: رستوران زعفران"
                    className="w-full h-11 rounded-2xl bg-[#F5F5F7] border border-[#D2D2D7] px-3.5 text-xs focus:bg-white focus:border-[#0066CC] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1D1D1F] mb-1.5">شماره تماس *</label>
                  <input
                    type="tel"
                    required
                    dir="ltr"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+46 70 000 00 00"
                    className="w-full h-11 rounded-2xl bg-[#F5F5F7] border border-[#D2D2D7] px-3.5 text-xs font-mono text-left focus:bg-white focus:border-[#0066CC] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1D1D1F] mb-1.5">شماره ثبت شرکت (Org.nr) *</label>
                  <input
                    type="text"
                    required
                    dir="ltr"
                    value={companyNumber}
                    onChange={(e) => setCompanyNumber(e.target.value)}
                    placeholder="559000-0000"
                    className="w-full h-11 rounded-2xl bg-[#F5F5F7] border border-[#D2D2D7] px-3.5 text-xs font-mono text-left focus:bg-white focus:border-[#0066CC] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1D1D1F] mb-1.5">ایمیل *</label>
                  <input
                    type="email"
                    required
                    dir="ltr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="info@example.com"
                    className="w-full h-11 rounded-2xl bg-[#F5F5F7] border border-[#D2D2D7] px-3.5 text-xs font-mono text-left focus:bg-white focus:border-[#0066CC] focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-[#F0F0F2] space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-[#1D1D1F] flex items-center gap-1.5">
                    <CreditCard size={16} className="text-[#0066CC]" />
                    <span>۲. پرداخت اشتراک ماهانه ({MONTHLY_PRICE} {MONTHLY_CURRENCY})</span>
                  </h3>
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
                  className="w-full h-11 rounded-2xl bg-[#F5F5F7] border border-[#D2D2D7] px-3.5 text-xs focus:bg-white focus:border-[#0066CC] focus:outline-none"
                />
                <input
                  type="text"
                  required
                  dir="ltr"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  placeholder="4242 4242 4242 4242"
                  className="w-full h-11 rounded-2xl bg-[#F5F5F7] border border-[#D2D2D7] px-3.5 text-xs font-mono text-left focus:bg-white focus:border-[#0066CC] focus:outline-none"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    dir="ltr"
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(e.target.value)}
                    placeholder="MM/YY"
                    className="h-11 rounded-2xl bg-[#F5F5F7] border border-[#D2D2D7] px-3.5 text-xs font-mono text-left focus:bg-white focus:border-[#0066CC] focus:outline-none"
                  />
                  <input
                    type="text"
                    required
                    dir="ltr"
                    value={cardCvc}
                    onChange={(e) => setCardCvc(e.target.value)}
                    placeholder="CVC"
                    className="h-11 rounded-2xl bg-[#F5F5F7] border border-[#D2D2D7] px-3.5 text-xs font-mono text-left focus:bg-white focus:border-[#0066CC] focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-12 rounded-full bg-[#0066CC] hover:bg-[#0055AA] text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(0,102,204,0.25)] transition-all cursor-pointer disabled:opacity-60"
              >
                <Lock size={15} />
                <span>
                  {submitting
                    ? 'در حال ثبت سفارش...'
                    : `پرداخت ${MONTHLY_PRICE} ${MONTHLY_CURRENCY} و ثبت سفارش ساخت سایت`}
                </span>
              </button>
            </form>

            {/* LEFT: COMPACT SPECS, DOMAIN NOTICE & DELIVERY */}
            <div className="lg:col-span-5 lg:sticky lg:top-20 space-y-4">
              {/* Cloud Specs Card (No Cloudflare mention) */}
              <div className="rounded-[28px] bg-white border border-[#E5E5EA] p-5 sm:p-6 space-y-3.5 shadow-[0_4px_20px_rgba(29,29,31,0.04)]">
                <h3 className="text-sm font-black text-[#1D1D1F]">مشخصات فنی زیرساخت ابری</h3>

                <div className="divide-y divide-[#F0F0F2] text-xs">
                  <div className="py-2.5 flex items-center justify-between gap-2">
                    <span className="text-[#6E6E73] inline-flex items-center gap-1.5">
                      <HardDrive size={14} className="text-[#0066CC]" />
                      <span>حافظه دیتابیس ابری</span>
                    </span>
                    <strong className="text-[#1D1D1F]">۵ گیگابایت اختصاصی</strong>
                  </div>
                  <div className="py-2.5 flex items-center justify-between gap-2">
                    <span className="text-[#6E6E73] inline-flex items-center gap-1.5">
                      <Cpu size={14} className="text-[#0066CC]" />
                      <span>توان پردازش</span>
                    </span>
                    <strong className="text-[#1D1D1F]">۱۰۰,۰۰۰ درخواست / روز</strong>
                  </div>
                  <div className="py-2.5 flex items-center justify-between gap-2">
                    <span className="text-[#6E6E73] inline-flex items-center gap-1.5">
                      <Zap size={14} className="text-[#0066CC]" />
                      <span>سرعت پاسخ‌گویی</span>
                    </span>
                    <strong className="text-[#1D1D1F]">زیر ۵۰ میلی‌ثانیه</strong>
                  </div>
                </div>

                <p className="text-[11px] text-[#6E6E73] bg-[#F5F5F7] p-3 rounded-xl leading-relaxed">
                  در صورت افزایش ترافیک یا مصرف بالا، برای <strong>ارتقای حافظه و توان پردازش</strong> با تیم پشتیبانی تماس بگیرید (ارتقا با هزینه بیشتر انجام می‌شود).
                </p>
              </div>

              {/* Domain & Support Notice */}
              <div className="rounded-[28px] bg-white border border-[#E5E5EA] p-5 sm:p-6 space-y-3 shadow-[0_4px_20px_rgba(29,29,31,0.04)]">
                <h3 className="text-sm font-black text-[#1D1D1F] flex items-center gap-1.5">
                  <Globe size={15} className="text-amber-600" />
                  <span>دامنه (Domain) و ایمیل</span>
                </h3>
                <p className="text-xs text-[#515154] leading-relaxed">
                  دامنه و ایمیل اختصاصی <strong>شامل این پکیج نیستند</strong>. شما می‌توانید دامنه را از هر شرکتی خریداری کنید و پس از ساخت دیتابیس و وب‌سایت، <strong>تیم پشتیبانی هنگام تماس نحوه اتصال دامنه را به شما آموزش می‌دهد</strong>.
                </p>

                <div className="pt-2 border-t border-[#F0F0F2] flex items-center gap-2 text-[11.5px] font-bold text-[#0066CC]">
                  <Mail size={14} className="shrink-0" />
                  <span>تحویل ۲۴ ساعته + ارسال کد ۸ رقمی مدیریت اشتراک</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-[#6E6E73]">
                  <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
                  <span>اشتراک ماهانه (تمدید هر ۳۰ روز — غیر دائمی)</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
