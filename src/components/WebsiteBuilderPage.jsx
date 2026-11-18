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
  ChevronDown,
} from 'lucide-react';

const MONTHLY_PRICE = 260;
const MONTHLY_CURRENCY = 'SEK';

const WEBSITE_FAQS = [
  {
    q: 'آیا دامنه (Domain) و ایمیل اختصاصی شامل این اشتراک است؟',
    a: 'خیر، دامنه و ایمیل اختصاصی شامل این اشتراک نیستند. شما می‌توانید دامنه دلخواه خود را از هر شرکتی خریداری کنید؛ پس از ساخت دیتابیس و وب‌سایت، تیم پشتیبانی هنگام تماس با شما نحوه اتصال و نصب دامنه را به‌طور کامل راهنمایی می‌کند.',
  },
  {
    q: 'آماده‌سازی و تحویل وب‌سایت چقدر زمان می‌برد؟',
    a: 'حداکثر تا ۲۴ ساعت پس از ثبت سفارش، وب‌سایت و پنل فروش اختصاصی شما ساخته و دیپلوی می‌شود و تمام جزئیات دسترسی از طریق ایمیل برای شما ارسال خواهد شد.',
  },
  {
    q: 'قدرت پردازش و فضای ذخیره‌سازی چقدر است؟',
    a: 'هر وب‌سایت دارای ۵ گیگابایت فضای دیتابیس ابری اختصاصی، توان پردازش ۱۰۰,۰۰۰ درخواست روزانه و سرعت پاسخ‌گویی زیر ۵۰ میلی‌ثانیه است. در صورت مصرف یا بازدید بالا، برای ارتقای منابع با تیم پشتیبانی تماس بگیرید (ارتقا شامل هزینه بیشتر خواهد بود).',
  },
  {
    q: 'آیا هزینه ۲۶۰ کرون دائمی است یا ماهانه؟ چگونه مدیریت کنم؟',
    a: 'این پلن به‌صورت اشتراک ماهانه (اعتبار ۳۰ روزه و غیر دائمی) است. بلافاصله پس از ثبت‌نام یک کد ۸ رقمی دریافت می‌کنید که از طریق تب «مدیریت اشتراک» در همین صفحه می‌توانید وضعیت، تمدید ۳۰ روزه یا لغو اشتراک را انجام دهید.',
  },
  {
    q: 'چطور محصولات یا منوی رستوران را داخل آگهی‌های لینک شو نمایش دهم؟',
    a: 'پس از تحویل پنل فروش، یک لینک API اختصاصی دریافت می‌کنید. با قرار دادن آن لینک در فرم ثبت آگهی لینک شو، محصولات یا منوی شما مستقیماً داخل آگهی نمایش داده و فروخته می‌شوند.',
  },
];

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

  // FAQ Accordion State
  const [openFaqIdx, setOpenFaqIdx] = useState(0);

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
    <main className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8 font-vazir min-h-[70vh]" dir="rtl">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="h-9 px-4 rounded-full bg-white hover:bg-[#F5F5F7] border border-[#E5E5EA] text-[#1D1D1F] text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <ArrowRight size={15} />
          <span>بازگشت</span>
        </button>

        <div className="inline-flex items-center p-1 rounded-full bg-white border border-[#E5E5EA]">
          <button
            type="button"
            onClick={() => { setPageMode('order'); setErrorMsg(''); }}
            className={`px-4 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-all ${
              pageMode === 'order' ? 'bg-[#1D1D1F] text-white' : 'text-[#6E6E73] hover:text-[#1D1D1F]'
            }`}
          >
            سفارش وب‌سایت جدید
          </button>
          <button
            type="button"
            onClick={() => { setPageMode('manage'); setErrorMsg(''); }}
            className={`px-4 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-all ${
              pageMode === 'manage' ? 'bg-[#1D1D1F] text-white' : 'text-[#6E6E73] hover:text-[#1D1D1F]'
            }`}
          >
            مدیریت اشتراک (کد ۸ رقمی)
          </button>
        </div>
      </div>

      {pageMode === 'manage' ? (
        /* MANAGE SUBSCRIPTION WITH 8-DIGIT CODE (Flat, No Nested Boxes) */
        <div className="max-w-lg mx-auto rounded-3xl bg-white border border-[#E5E5EA] p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-1.5">
            <KeyRound size={26} className="mx-auto text-[#0066CC]" />
            <h2 className="text-lg font-black text-[#1D1D1F]">مدیریت اشتراک با کد ۸ رقمی</h2>
            <p className="text-xs text-[#6E6E73]">
              کد ۸ رقمی که هنگام ثبت‌نام دریافت کرده‌اید را وارد کنید.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs font-bold flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {manageMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold flex items-center gap-2">
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
              className="flex-1 h-11 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7] px-4 text-sm font-mono text-center tracking-[0.25em] focus:bg-white focus:border-[#0066CC] focus:outline-none"
            />
            <button
              type="submit"
              disabled={manageLoading}
              className="h-11 px-5 rounded-xl bg-[#0066CC] hover:bg-[#0055AA] text-white text-xs font-bold cursor-pointer disabled:opacity-60 shrink-0"
            >
              {manageLoading ? 'بررسی...' : 'ورود'}
            </button>
          </form>

          {managedSub && (
            <div className="pt-4 border-t border-[#E5E5EA] space-y-3 text-xs">
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

              <div className="flex items-center gap-2 pt-3">
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
                    className="h-10 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold cursor-pointer"
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
        <div className="max-w-xl mx-auto rounded-3xl bg-white border border-[#E5E5EA] p-6 sm:p-10 text-center space-y-6">
          <CheckCircle2 size={44} className="mx-auto text-emerald-600" />

          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-black text-[#1D1D1F]">
              سفارش شما ثبت شد!
            </h2>
            <p className="text-xs sm:text-sm text-[#515154] leading-relaxed">
              ساخت، دیپلوی و تحویل وب‌سایت و پنل فروش اختصاصی شما حداکثر ظرف <strong className="text-[#1D1D1F]">۲۴ ساعت آینده</strong> انجام می‌شود و تمامی جزئیات به ایمیل <strong className="font-mono text-[#0066CC]" dir="ltr">{submittedOrder.email}</strong> ارسال خواهد شد.
            </p>
          </div>

          <div className="py-4 border-y border-[#E5E5EA] space-y-2">
            <span className="text-xs font-bold text-[#6E6E73] block">کد ۸ رقمی مدیریت اشتراک شما (حتماً ذخیره کنید)</span>
            <div className="flex items-center justify-center gap-3">
              <span className="font-mono text-2xl font-black tracking-widest text-[#1D1D1F] select-all" dir="ltr">
                {submittedOrder.manageCode}
              </span>
              <button
                type="button"
                onClick={() => copyManageCode(submittedOrder.manageCode)}
                className="h-8 px-3 rounded-lg bg-[#F5F5F7] hover:bg-[#ECECEF] text-xs font-bold text-[#1D1D1F] inline-flex items-center gap-1 cursor-pointer"
              >
                {copiedCode ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiedCode ? 'کپی شد' : 'کپی'}</span>
              </button>
            </div>
          </div>

          <div className="space-y-2 text-xs text-right max-w-sm mx-auto">
            <div className="flex justify-between">
              <span className="text-[#6E6E73]">کد پیگیری:</span>
              <strong className="font-mono">{submittedOrder.storeId}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6E6E73]">نام سایت:</span>
              <strong>{submittedOrder.name}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6E6E73]">شماره ثبت شرکت:</span>
              <strong className="font-mono">{submittedOrder.companyNumber}</strong>
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
          {/* FLAT EDITORIAL HERO (No nested boxes) */}
          <div className="pb-6 border-b border-[#E5E5EA] flex flex-col md:flex-row md:items-end justify-between gap-5">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0066CC]">
                <MonitorSmartphone size={15} />
                <span>فروشگاه اینترنتی و منوی آنلاین رستوران</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-[#1D1D1F] tracking-tight">
                ساخت وب‌سایت و پنل فروش اختصاصی
              </h1>
              <p className="text-xs sm:text-sm text-[#6E6E73] leading-relaxed">
                مدیریت محصولات، هزینه ارسال، سفارش‌ها و درگاه پرداخت با زیرساخت ابری پرسرعت و اتصال مستقیم به آگهی‌های لینک شو.
              </p>

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <a
                  href="https://swedpersiska.vercel.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-9 px-4 rounded-full bg-white hover:bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F] text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                >
                  <span>دموی وب‌سایت (Frontend)</span>
                  <ExternalLink size={12} />
                </a>
                <a
                  href="https://linksho-seller.vercel.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-9 px-4 rounded-full bg-[#0066CC] hover:bg-[#0055AA] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                >
                  <span>دموی پنل فروش</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>

            <div className="shrink-0 text-right md:text-left">
              <span className="text-[11px] font-bold text-[#6E6E73] block">اشتراک ماهانه (غیر دائمی)</span>
              <div className="text-3xl sm:text-4xl font-black text-[#1D1D1F] tabular-nums" dir="ltr">
                {MONTHLY_PRICE} <span className="text-sm font-bold text-[#6E6E73]">{MONTHLY_CURRENCY}</span>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 mt-0.5">
                <Clock size={12} />
                <span>تحویل حداکثر تا ۲۴ ساعت</span>
              </span>
            </div>
          </div>

          {/* TWO-COLUMN LAYOUT: CLEAN FORM + FLAT SPECS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* RIGHT: ORDER & PAYMENT CARD (Single flat surface, no inner boxes) */}
            <form
              onSubmit={handleSubmit}
              className="lg:col-span-7 rounded-3xl bg-white border border-[#E5E5EA] p-6 sm:p-8 space-y-6"
            >
              <div>
                <h2 className="text-base font-black text-[#1D1D1F]">۱. مشخصات سایت و کسب‌وکار</h2>
                <p className="text-xs text-[#6E6E73] mt-0.5">اطلاعات دسترسی پس از ساخت به ایمیل شما ارسال می‌شود.</p>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs font-bold flex items-center gap-2">
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
                    className="w-full h-11 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7] px-3.5 text-xs focus:bg-white focus:border-[#0066CC] focus:outline-none"
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
                    className="w-full h-11 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7] px-3.5 text-xs font-mono text-left focus:bg-white focus:border-[#0066CC] focus:outline-none"
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
                    className="w-full h-11 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7] px-3.5 text-xs font-mono text-left focus:bg-white focus:border-[#0066CC] focus:outline-none"
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
                    className="w-full h-11 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7] px-3.5 text-xs font-mono text-left focus:bg-white focus:border-[#0066CC] focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-5 border-t border-[#E5E5EA] space-y-4">
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
                  className="w-full h-11 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7] px-3.5 text-xs focus:bg-white focus:border-[#0066CC] focus:outline-none"
                />
                <input
                  type="text"
                  required
                  dir="ltr"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  placeholder="4242 4242 4242 4242"
                  className="w-full h-11 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7] px-3.5 text-xs font-mono text-left focus:bg-white focus:border-[#0066CC] focus:outline-none"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    dir="ltr"
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(e.target.value)}
                    placeholder="MM/YY"
                    className="h-11 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7] px-3.5 text-xs font-mono text-left focus:bg-white focus:border-[#0066CC] focus:outline-none"
                  />
                  <input
                    type="text"
                    required
                    dir="ltr"
                    value={cardCvc}
                    onChange={(e) => setCardCvc(e.target.value)}
                    placeholder="CVC"
                    className="h-11 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7] px-3.5 text-xs font-mono text-left focus:bg-white focus:border-[#0066CC] focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-12 rounded-full bg-[#0066CC] hover:bg-[#0055AA] text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(0,102,204,0.22)] transition-all cursor-pointer disabled:opacity-60"
              >
                <Lock size={15} />
                <span>
                  {submitting
                    ? 'در حال ثبت سفارش...'
                    : `پرداخت ${MONTHLY_PRICE} ${MONTHLY_CURRENCY} و ثبت سفارش ساخت سایت`}
                </span>
              </button>
            </form>

            {/* LEFT: FLAT EDITORIAL SUMMARY (Zero nested boxes) */}
            <div className="lg:col-span-5 lg:sticky lg:top-20 space-y-6 pt-1">
              <div className="space-y-3">
                <h3 className="text-sm font-black text-[#1D1D1F]">مشخصات زیرساخت ابری</h3>
                <div className="divide-y divide-[#E5E5EA] text-xs">
                  <div className="py-3 flex items-center justify-between">
                    <span className="text-[#6E6E73] inline-flex items-center gap-2">
                      <HardDrive size={15} className="text-[#0066CC]" />
                      <span>فضای دیتابیس ابری</span>
                    </span>
                    <strong className="text-[#1D1D1F]">۵ گیگابایت اختصاصی</strong>
                  </div>
                  <div className="py-3 flex items-center justify-between">
                    <span className="text-[#6E6E73] inline-flex items-center gap-2">
                      <Cpu size={15} className="text-[#0066CC]" />
                      <span>توان پردازش</span>
                    </span>
                    <strong className="text-[#1D1D1F]">۱۰۰,۰۰۰ درخواست / روز</strong>
                  </div>
                  <div className="py-3 flex items-center justify-between">
                    <span className="text-[#6E6E73] inline-flex items-center gap-2">
                      <Zap size={15} className="text-[#0066CC]" />
                      <span>سرعت پاسخ‌گویی</span>
                    </span>
                    <strong className="text-[#1D1D1F]">زیر ۵۰ میلی‌ثانیه</strong>
                  </div>
                </div>
                <p className="text-[11.5px] text-[#6E6E73] leading-relaxed">
                  در صورت افزایش ترافیک یا مصرف بالا، برای <strong>ارتقای حافظه و توان پردازش</strong> با تیم پشتیبانی تماس بگیرید (ارتقا شامل هزینه بیشتر خواهد بود).
                </p>
              </div>

              <div className="pt-5 border-t border-[#E5E5EA] space-y-2.5">
                <h3 className="text-sm font-black text-[#1D1D1F] flex items-center gap-1.5">
                  <Globe size={15} className="text-amber-600" />
                  <span>دامنه (Domain) و ایمیل اختصاصی</span>
                </h3>
                <p className="text-xs text-[#515154] leading-relaxed">
                  دامنه و ایمیل اختصاصی <strong>شامل این پکیج نیستند</strong>. می‌توانید دامنه را از هر شرکتی خریداری کنید و پس از ساخت دیتابیس و وب‌سایت، <strong>تیم پشتیبانی هنگام تماس نحوه نصب دامنه را راهنمایی می‌کند</strong>.
                </p>
              </div>

              <div className="pt-5 border-t border-[#E5E5EA] space-y-2 text-xs">
                <div className="flex items-center gap-2 font-bold text-[#0066CC]">
                  <Mail size={14} className="shrink-0" />
                  <span>تحویل ۲۴ ساعته + کد ۸ رقمی مدیریت اشتراک</span>
                </div>
                <div className="flex items-center gap-2 text-[#6E6E73]">
                  <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
                  <span>اشتراک ماهانه (تمدید هر ۳۰ روز — غیر دائمی)</span>
                </div>
              </div>
            </div>
          </div>

          {/* CLEAN FLAT FAQ ACCORDION */}
          <section className="pt-6 border-t border-[#E5E5EA] space-y-4">
            <div>
              <h2 className="text-base sm:text-lg font-black text-[#1D1D1F]">سوالات متداول (FAQ)</h2>
              <p className="text-xs text-[#6E6E73] mt-0.5">پاسخ به پرسش‌های رایج درباره ساخت وب‌سایت، دامنه، منابع ابری و اشتراک ماهانه</p>
            </div>

            <div className="rounded-3xl bg-white border border-[#E5E5EA] divide-y divide-[#E5E5EA] overflow-hidden">
              {WEBSITE_FAQS.map((item, idx) => {
                const isOpen = openFaqIdx === idx;
                return (
                  <div key={idx}>
                    <button
                      type="button"
                      onClick={() => setOpenFaqIdx(isOpen ? -1 : idx)}
                      className="w-full px-5 py-4 flex items-center justify-between gap-3 text-right hover:bg-[#F5F5F7]/60 transition-colors cursor-pointer"
                    >
                      <span className="text-xs sm:text-sm font-bold text-[#1D1D1F]">{item.q}</span>
                      <ChevronDown
                        size={16}
                        className={`text-[#6E6E73] shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#0066CC]' : ''}`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4 text-xs text-[#515154] leading-relaxed">
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
