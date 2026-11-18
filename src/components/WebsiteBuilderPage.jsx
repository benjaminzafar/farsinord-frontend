import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  CreditCard,
  Lock,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  PhoneCall,
  Sparkles,
} from 'lucide-react';

const MONTHLY_PRICE = 260;
const MONTHLY_CURRENCY = 'SEK';

const SIMPLE_FAQS = [
  {
    q: 'آیا آدرس سایت (دامنه) و ایمیل هم با این پول است؟',
    a: 'نه، آدرس سایت (مثل .se یا .com) و ایمیل را خودتان از هر جایی که دوست دارید می‌خرید. اما اصلاً نگران نباشید! وقتی سایت آماده شد، تیم ما با شما تماس می‌گیرد و قدم‌به‌قدم کمکتان می‌کند آدرس سایت را وصل کنید.',
  },
  {
    q: 'چقدر طول می‌کشد سایت من آماده شود؟',
    a: 'خیلی سریع! حداکثر تا ۲۴ ساعت بعد از ثبت سفارش، ما سایت و پنل فروش شما را آماده می‌کنیم و همه اطلاعات ورود را به ایمیلتان می‌فرستیم.',
  },
  {
    q: 'سایت چقدر جا و سرعت دارد؟',
    a: '۵ گیگابایت فضای ابری دارد که برای هزاران محصول و عکس کافی است و خیلی سریع باز می‌شود (مناسب تا حدود ۱۰۰ هزار بازدید در روز). اگر فروشگاهتان خیلی شلوغ شد، کافی است به ما بگویید تا با هزینه بیشتر فضای آن را بزرگ‌تر کنیم.',
  },
  {
    q: 'این ۲۶۰ کرون برای همیشه است یا ماهانه؟',
    a: 'ماهانه است (هر ۳۰ روز یک بار). بعد از ثبت‌نام یک کد ۸ رقمی به شما می‌دهیم تا هر وقت خواستید با آن کد اشتراکتان را ببینید، تمدید کنید یا لغو نمایید.',
  },
];

export default function WebsiteBuilderPage({
  stripeSettings = null,
  onBack,
}) {
  const [pageMode, setPageMode] = useState('order'); // 'order' | 'manage'
  const [step, setStep] = useState(1); // 1: توضیح ساده | 2: اطلاعات شما | 3: پرداخت

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

  // Manage Subscription by 8-Digit Code
  const [manageCodeInput, setManageCodeInput] = useState('');
  const [managedSub, setManagedSub] = useState(null);
  const [manageLoading, setManageLoading] = useState(false);
  const [manageMsg, setManageMsg] = useState('');

  // Collapsed by default so page stays calm
  const [openFaqIdx, setOpenFaqIdx] = useState(-1);

  const isTestMode = stripeSettings?.mode !== 'live';

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step, pageMode]);

  const copyManageCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {}
  };

  const handleStep2Next = (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!storeName.trim() || !phone.trim() || !companyNumber.trim() || !email.trim()) {
      setErrorMsg('لطفاً همه ۴ کادر بالا را پر کنید تا بتوانیم سایت را بسازیم و به شما خبر دهیم.');
      return;
    }
    setStep(3);
  };

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!cardHolder.trim() || !cardNumber.trim() || !cardExpiry.trim() || !cardCvc.trim()) {
      setErrorMsg('لطفاً مشخصات کارت بانکی را کامل وارد کنید.');
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
        setErrorMsg(json?.error || 'مشکلی پیش آمد. لطفاً دوباره امتحان کنید.');
        return;
      }
      setSubmittedOrder(json.order);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setErrorMsg('اتصال به سرور برقرار نشد. لطفاً دوباره امتحان کنید.');
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
      setErrorMsg('کد مدیریت باید دقیقاً ۸ رقم باشد.');
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
        setErrorMsg(json?.error || 'این کد پیدا نشد.');
        setManagedSub(null);
        return;
      }
      setManagedSub(json.subscription);
      if (subAction === 'renew') setManageMsg('اشتراک شما برای ۳۰ روز دیگر تمدید شد.');
      if (subAction === 'cancel') setManageMsg('اشتراک شما لغو شد.');
    } catch {
      setErrorMsg('خطا در ارتباط با سرور.');
    } finally {
      setManageLoading(false);
    }
  };

  return (
    <main className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8 font-vazir min-h-[70vh]" dir="rtl">
      {/* Top Simple Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="h-9 px-4 rounded-full bg-white hover:bg-[#F5F5F7] border border-[#E5E5EA] text-[#1D1D1F] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowRight size={14} />
          <span>بازگشت</span>
        </button>

        <div className="inline-flex items-center p-1 rounded-full bg-white border border-[#E5E5EA]">
          <button
            type="button"
            onClick={() => { setPageMode('order'); setErrorMsg(''); }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-colors ${
              pageMode === 'order' ? 'bg-[#1D1D1F] text-white' : 'text-[#6E6E73]'
            }`}
          >
            ساخت سایت جدید
          </button>
          <button
            type="button"
            onClick={() => { setPageMode('manage'); setErrorMsg(''); }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-colors ${
              pageMode === 'manage' ? 'bg-[#1D1D1F] text-white' : 'text-[#6E6E73]'
            }`}
          >
            مدیریت اشتراک (کد ۸ رقمی)
          </button>
        </div>
      </div>

      {pageMode === 'manage' ? (
        /* MANAGE SUBSCRIPTION */
        <div className="rounded-3xl bg-white border border-[#E5E5EA] p-6 sm:p-8 space-y-5">
          <div className="text-center space-y-1.5">
            <KeyRound size={26} className="mx-auto text-[#0066CC]" />
            <h1 className="text-lg font-black text-[#1D1D1F]">مدیریت اشتراک شما</h1>
            <p className="text-xs text-[#6E6E73]">کد ۸ رقمی خود را بنویسید تا وضعیت سایتتان را ببینید.</p>
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
              className="h-11 px-5 rounded-xl bg-[#0066CC] text-white text-xs font-bold cursor-pointer shrink-0"
            >
              {manageLoading ? 'صبر کنید...' : 'مشاهده'}
            </button>
          </form>

          {managedSub && (
            <div className="pt-4 border-t border-[#E5E5EA] space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-[#6E6E73]">نام سایت:</span>
                <strong>{managedSub.name}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6E6E73]">وضعیت:</span>
                <strong className={managedSub.status === 'cancelled' ? 'text-rose-600' : 'text-emerald-700'}>
                  {managedSub.status === 'cancelled'
                    ? 'لغو شده'
                    : managedSub.status === 'pending_setup'
                    ? 'در حال ساخت (تحویل تا ۲۴ ساعت)'
                    : 'فعال'}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6E6E73]">تاریخ پایان دوره:</span>
                <strong>{managedSub.expiresAt ? new Date(managedSub.expiresAt).toLocaleDateString('fa-IR') : '-'}</strong>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  disabled={manageLoading}
                  onClick={() => handleManageAction('renew')}
                  className="flex-1 h-10 rounded-xl bg-emerald-600 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw size={13} />
                  <span>تمدید ۱ ماهه (۲۶۰ کرون)</span>
                </button>
                {managedSub.status !== 'cancelled' && (
                  <button
                    type="button"
                    disabled={manageLoading}
                    onClick={() => handleManageAction('cancel')}
                    className="h-10 px-4 rounded-xl bg-rose-50 text-rose-700 text-xs font-bold cursor-pointer"
                  >
                    لغو اشتراک
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ) : submittedOrder ? (
        /* FINAL CONFIRMATION SCREEN */
        <div className="rounded-3xl bg-white border border-[#E5E5EA] p-6 sm:p-10 text-center space-y-6">
          <CheckCircle2 size={46} className="mx-auto text-emerald-600" />
          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-black text-[#1D1D1F]">تبریک! سفارش شما ثبت شد</h1>
            <p className="text-xs sm:text-sm text-[#515154] leading-relaxed">
              تیم ما ظرف <strong className="text-[#1D1D1F]">۲۴ ساعت آینده</strong> سایت و پنل فروش شما را آماده می‌کند، با شما تماس می‌گیرد و اطلاعات ورود را به ایمیل{' '}
              <strong className="font-mono text-[#0066CC]" dir="ltr">{submittedOrder.email}</strong> می‌فرستد.
            </p>
          </div>

          <div className="py-4 border-y border-[#E5E5EA] space-y-2">
            <span className="text-xs font-bold text-[#6E6E73] block">کد ۸ رقمی مدیریت اشتراک شما (این کد را نگه دارید)</span>
            <div className="flex items-center justify-center gap-3">
              <span className="font-mono text-2xl font-black tracking-widest text-[#1D1D1F] select-all" dir="ltr">
                {submittedOrder.manageCode}
              </span>
              <button
                type="button"
                onClick={() => copyManageCode(submittedOrder.manageCode)}
                className="h-8 px-3 rounded-lg bg-[#F5F5F7] text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                {copiedCode ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiedCode ? 'کپی شد' : 'کپی'}</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onBack}
            className="h-11 px-8 rounded-full bg-[#0066CC] text-white text-xs font-bold cursor-pointer"
          >
            بازگشت به صفحه اصلی
          </button>
        </div>
      ) : (
        /* SIMPLE 3-STEP WIZARD */
        <div className="rounded-3xl bg-white border border-[#E5E5EA] p-6 sm:p-8 space-y-6">
          {/* Calm Step Progress Bar */}
          <div className="flex items-center justify-between text-xs font-bold border-b border-[#F0F0F2] pb-4">
            <span className={step === 1 ? 'text-[#0066CC]' : 'text-[#86868B]'}>۱. آشنایی و دمو</span>
            <span className="text-[#D2D2D7]">←</span>
            <span className={step === 2 ? 'text-[#0066CC]' : 'text-[#86868B]'}>۲. مشخصات شما</span>
            <span className="text-[#D2D2D7]">←</span>
            <span className={step === 3 ? 'text-[#0066CC]' : 'text-[#86868B]'}>۳. پرداخت (۲۶۰ کرون)</span>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs font-bold flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: EXPLAIN LIKE TO A CHILD (SIMPLE, CALM, CLEAR) */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h1 className="text-xl sm:text-2xl font-black text-[#1D1D1F] leading-snug">
                  می‌خواهید برای رستوران یا فروشگاهتان سایت فروش آنلاین داشته باشید؟
                </h1>
                <p className="text-xs sm:text-sm text-[#6E6E73] leading-relaxed">
                  همه‌چیز خیلی ساده است! فقط <strong>ماهی {MONTHLY_PRICE} کرون</strong> می‌دهید و ما سایت کامل شما را می‌سازیم.
                </p>
              </div>

              {/* 3 Kid-Friendly Steps */}
              <div className="space-y-4 text-xs sm:text-[13px] text-[#515154]">
                <div className="flex items-start gap-3">
                  <span className="h-7 w-7 rounded-full bg-blue-50 text-[#0066CC] font-black flex items-center justify-center shrink-0">۱</span>
                  <div className="pt-0.5">
                    <strong className="text-[#1D1D1F] block">فقط ۴ مشخصات ساده را می‌نویسید</strong>
                    <span>نام مغازه یا رستوران، شماره تماس، شماره ثبت شرکت و ایمیلتان.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="h-7 w-7 rounded-full bg-blue-50 text-[#0066CC] font-black flex items-center justify-center shrink-0">۲</span>
                  <div className="pt-0.5">
                    <strong className="text-[#1D1D1F] block">تا ۲۴ ساعت سایت شما آماده می‌شود</strong>
                    <span>ما سایت و پنل فروش را می‌سازیم و اطلاعاتش را به ایمیلتان می‌فرستیم.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="h-7 w-7 rounded-full bg-blue-50 text-[#0066CC] font-black flex items-center justify-center shrink-0">۳</span>
                  <div className="pt-0.5">
                    <strong className="text-[#1D1D1F] block">تیم ما برای وصل کردن آدرس سایت کمکتان می‌کند</strong>
                    <span>آدرس سایت (دامنه) و ایمیل جداگانه است؛ تیم پشتیبانی با شما تماس می‌گیرد و نصبش را یادتان می‌دهد.</span>
                  </div>
                </div>
              </div>

              {/* Simple Cloud Specs & Notes */}
              <div className="pt-4 border-t border-[#F0F0F2] space-y-2 text-xs text-[#6E6E73]">
                <p className="flex items-center gap-2">
                  <Sparkles size={14} className="text-[#0066CC] shrink-0" />
                  <span>فضای ابری سایت: <strong>۵ گیگابایت</strong> حافظه و سرعت عالی برای حدود <strong>۱۰۰ هزار بازدید روزانه</strong> (اگر بیشتر شد، با تماس قابل ارتقاست).</span>
                </p>
                <p className="flex items-center gap-2">
                  <PhoneCall size={14} className="text-emerald-600 shrink-0" />
                  <span>پشتیبانی کامل و راهنمایی اتصال دامنه بعد از آماده‌شدن سایت.</span>
                </p>
                <p className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-[#0066CC] shrink-0" />
                  <span>بعد از کامل شدن وب‌سایت، می‌توانید آدرس سایت خود را داخل آگهی لینک شو نمایش دهید.</span>
                </p>
              </div>

              {/* Demo Links */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <a
                  href="https://swedpersiska.vercel.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-9 px-4 rounded-full bg-[#F5F5F7] hover:bg-[#ECECEF] text-[#1D1D1F] text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <span>دیدن نمونه سایت</span>
                  <ExternalLink size={12} />
                </a>
                <a
                  href="https://linksho-seller.vercel.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-9 px-4 rounded-full bg-[#F5F5F7] hover:bg-[#ECECEF] text-[#1D1D1F] text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <span>دیدن نمونه پنل فروش</span>
                  <ExternalLink size={12} />
                </a>
              </div>

              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full h-12 rounded-full bg-[#0066CC] hover:bg-[#0055AA] text-white text-sm font-bold inline-flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(0,102,204,0.22)] cursor-pointer"
              >
                <span>شروع ساخت سایت ({MONTHLY_PRICE} کرون در ماه)</span>
                <ArrowLeft size={16} />
              </button>
            </div>
          )}

          {/* STEP 2: ONLY 4 SIMPLE FIELDS */}
          {step === 2 && (
            <form onSubmit={handleStep2Next} className="space-y-5">
              <div>
                <h2 className="text-lg font-black text-[#1D1D1F]">مشخصات خودتان را بنویسید</h2>
                <p className="text-xs text-[#6E6E73] mt-0.5">فقط همین ۴ مورد لازم است:</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#1D1D1F] mb-1.5">۱. نام سایت یا فروشگاه شما *</label>
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
                  <label className="block text-xs font-bold text-[#1D1D1F] mb-1.5">۲. شماره تماس شما *</label>
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
                  <label className="block text-xs font-bold text-[#1D1D1F] mb-1.5">۳. شماره ثبت شرکت (Org.nr) *</label>
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
                  <label className="block text-xs font-bold text-[#1D1D1F] mb-1.5">۴. ایمیل شما (اطلاعات سایت به این ایمیل می‌آید) *</label>
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

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="h-11 px-5 rounded-full bg-[#F5F5F7] text-[#1D1D1F] text-xs font-bold cursor-pointer"
                >
                  قبلی
                </button>
                <button
                  type="submit"
                  className="flex-1 h-11 rounded-full bg-[#0066CC] hover:bg-[#0055AA] text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>مرحله بعد: پرداخت ۲۶۰ کرون</span>
                  <ArrowLeft size={15} />
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: CLEAN PAYMENT */}
          {step === 3 && (
            <form onSubmit={handleSubmitOrder} className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-[#1D1D1F]">پرداخت اشتراک ماهانه</h2>
                  <p className="text-xs text-[#6E6E73] mt-0.5">مبلغ: {MONTHLY_PRICE} {MONTHLY_CURRENCY} در ماه (تحویل تا ۲۴ ساعت)</p>
                </div>
                {isTestMode && (
                  <button
                    type="button"
                    onClick={() => {
                      setCardHolder('Ali Rezaei');
                      setCardNumber('4242 4242 4242 4242');
                      setCardExpiry('12/28');
                      setCardCvc('424');
                    }}
                    className="text-xs font-bold text-[#0066CC] cursor-pointer"
                  >
                    پر کردن کارت تست
                  </button>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#1D1D1F]">
                  <CreditCard size={15} className="text-[#0066CC]" />
                  <span>مشخصات کارت بانکی</span>
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

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="h-11 px-5 rounded-full bg-[#F5F5F7] text-[#1D1D1F] text-xs font-bold cursor-pointer"
                >
                  قبلی
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 h-12 rounded-full bg-[#0066CC] hover:bg-[#0055AA] text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(0,102,204,0.22)] cursor-pointer disabled:opacity-60"
                >
                  <Lock size={15} />
                  <span>{submitting ? 'در حال ثبت...' : `پرداخت ${MONTHLY_PRICE} کرون و ثبت سفارش`}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* SIMPLE FAQ ACCORDION (Collapsed by default so page stays calm) */}
      <section className="space-y-3">
        <h2 className="text-sm font-black text-[#1D1D1F] px-1">سوالات متداول</h2>
        <div className="rounded-3xl bg-white border border-[#E5E5EA] divide-y divide-[#E5E5EA] overflow-hidden">
          {SIMPLE_FAQS.map((item, idx) => {
            const isOpen = openFaqIdx === idx;
            return (
              <div key={idx}>
                <button
                  type="button"
                  onClick={() => setOpenFaqIdx(isOpen ? -1 : idx)}
                  className="w-full px-5 py-3.5 flex items-center justify-between gap-3 text-right hover:bg-[#F5F5F7]/60 transition-colors cursor-pointer"
                >
                  <span className="text-xs font-bold text-[#1D1D1F]">{item.q}</span>
                  <ChevronDown
                    size={15}
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
    </main>
  );
}
