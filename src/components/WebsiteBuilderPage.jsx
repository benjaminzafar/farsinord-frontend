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
import { isSafeHttpUrl } from '../lib/urlUtils';

const SETUP_PRICE = 1500;
const MONTHLY_PRICE = 260;
const FA_SUB_DATE_FMT = new Intl.DateTimeFormat('fa-IR');
const FA_NUM_FMT = new Intl.NumberFormat('fa-IR');

const SIMPLE_FAQS = [
  {
    q: 'تعرفه ۱,۵۰۰ کرون راه‌اندازی و ۲۶۰ کرون ماهانه شامل چه خدماتی است؟',
    a: '۱,۵۰۰ کرون هزینه یک‌بار طراحی سایت، اتصال ربات تلگرام و درگاه Stripe است. اشتراک نگهداری ماهانه ۲۶۰ کرون بوده و فاکتور تمدید پیش از پایان هر دوره ارسال می‌شود.',
  },
  {
    q: 'اتصال ربات تلگرام و درگاه پرداخت Stripe چگونه انجام می‌شود؟',
    a: 'تیم فنی ما ساخت ربات تلگرام اختصاصی را به شما آموزش داده و آن را برای دریافت آنی سفارش‌ها به سایت متصل می‌کند. درگاه پرداخت Stripe نیز هم‌زمان فعال می‌شود.',
  },
  {
    q: 'آیا دامنه (Domain) و ایمیل اختصاصی شامل این پکیج هستند؟',
    a: 'خیر؛ دامنه دلخواه خود را می‌توانید از هر ثبت‌کننده‌ای تهیه کنید. پس از آماده‌سازی سایت، تیم پشتیبانی اتصال دامنه را گام‌به‌گام با شما انجام می‌دهد.',
  },
  {
    q: 'راه‌اندازی و تحویل وب‌سایت چقدر زمان می‌برد؟',
    a: 'وب‌سایت و پنل مدیریت حداکثر ظرف ۲۴ ساعت پس از ثبت سفارش آماده شده و اطلاعات ورود به ایمیل شما ارسال می‌شود.',
  },
  {
    q: 'ظرفیت فضای ابری و میزان ترافیک مجاز چقدر است؟',
    a: 'پکیج پایه شامل ۵ گیگابایت دیتابیس ابری، ۹ گیگابایت فضای تصاویر و تا ۱۰۰,۰۰۰ درخواست روزانه است و در صورت رشد کسب‌وکار قابل ارتقاست.',
  },
];

const WebsiteBuilderFaqSection = React.memo(function WebsiteBuilderFaqSection() {
  const [openFaqIdx, setOpenFaqIdx] = useState(-1);
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-black text-[#1D1D1F] px-1">سوالات متداول</h2>
      <div className="rounded-2xl sm:rounded-3xl bg-[#FBFBFC] dark:bg-[#171920] border border-[#ECEFF4] dark:border-white/[0.06] divide-y divide-[#ECEFF4] dark:divide-white/[0.038] overflow-hidden">
        {SIMPLE_FAQS.map((item, idx) => {
          const isOpen = openFaqIdx === idx;
          return (
            <div key={idx}>
              <button
                type="button"
                onClick={() => setOpenFaqIdx(isOpen ? -1 : idx)}
                className="w-full px-5 py-4 flex items-center justify-between gap-3 text-right hover:bg-[#F5F5F7]/75 transition-colors cursor-pointer"
              >
                <span className="text-xs sm:text-[13px] font-bold text-[#1D1D1F]">{item.q}</span>
                <ChevronDown
                  size={15}
                  className={`block text-[#86868B] shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#0066CC]' : ''}`}
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
  );
});

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

  // Use Stripe Hosted Checkout whenever Stripe is in live mode or server has Stripe configured (PCI-DSS SAQ-A safe)
  const useHostedStripeCheckout = stripeSettings?.mode === 'live' || stripeSettings?.stripeReady !== false;
  const isOfflineDemoMode = !useHostedStripeCheckout;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step, pageMode]);

  // Verify Stripe Checkout return (setup or monthly renewal)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const setupSessionId = params.get('stripe_session_id');
    const renewSessionId = params.get('renew_session_id');
    const isCancelled = params.get('cancelled') === '1';

    if (!setupSessionId && !renewSessionId && !isCancelled) return;

    const cleanUrl = () => {
      try {
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.delete('stripe_session_id');
        nextUrl.searchParams.delete('renew_session_id');
        nextUrl.searchParams.delete('cancelled');
        window.history.replaceState({}, '', nextUrl.toString());
      } catch {}
    };

    if (isCancelled) {
      setErrorMsg('پرداخت لغو شد.');
      cleanUrl();
      return;
    }

    if (setupSessionId) {
      setSubmitting(true);
      fetch('/api/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_website_checkout', sessionId: setupSessionId }),
      })
        .then((r) => r.json())
        .then((json) => {
          if (json?.ok && json.order) {
            setSubmittedOrder(json.order);
          } else {
            setErrorMsg(json?.error || 'تایید پرداخت Stripe با خطا مواجه شد.');
          }
        })
        .catch(() => setErrorMsg('خطا در تایید پرداخت Stripe.'))
        .finally(() => {
          setSubmitting(false);
          cleanUrl();
        });
      return;
    }

    if (renewSessionId) {
      setPageMode('manage');
      setManageLoading(true);
      fetch('/api/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_website_renew', sessionId: renewSessionId }),
      })
        .then((r) => r.json())
        .then((json) => {
          if (json?.ok && json.subscription) {
            setManagedSub(json.subscription);
            setManageMsg('پرداخت تایید و اشتراک شما ۳۰ روز تمدید شد.');
          } else {
            setErrorMsg(json?.error || 'تایید پرداخت تمدید با خطا مواجه شد.');
          }
        })
        .catch(() => setErrorMsg('خطا در تایید پرداخت تمدید.'))
        .finally(() => {
          setManageLoading(false);
          cleanUrl();
        });
    }
  }, []);

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
      setErrorMsg('لطفاً تمام موارد الزامی را تکمیل کنید.');
      return;
    }
    setStep(3);
  };

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (isOfflineDemoMode && (!cardHolder.trim() || !cardNumber.trim() || !cardExpiry.trim() || !cardCvc.trim())) {
      setErrorMsg('لطفاً مشخصات کارت بانکی را کامل وارد کنید.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        action: isOfflineDemoMode ? 'submit_website_order' : 'create_website_checkout',
        name: storeName.trim(),
        phone: phone.trim(),
        companyNumber: companyNumber.trim(),
        email: email.trim(),
      };
      const res = await fetch('/api/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json?.ok) {
        setErrorMsg(json?.error || 'خطا در ثبت سفارش. لطفاً دوباره تلاش کنید.');
        return;
      }
      if (json.checkoutUrl && isSafeHttpUrl(json.checkoutUrl)) {
        window.location.href = json.checkoutUrl;
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
      setErrorMsg('کد مدیریت باید ۸ رقم باشد.');
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
        setErrorMsg(json?.error || 'اشتراکی با این کد یافت نشد.');
        setManagedSub(null);
        return;
      }
      if (json.requiresStripeCheckout && json.checkoutUrl && isSafeHttpUrl(json.checkoutUrl)) {
        window.location.href = json.checkoutUrl;
        return;
      }
      setManagedSub(json.subscription);
      if (json.message) {
        setManageMsg(json.message);
      } else if (subAction === 'renew') {
        setManageMsg('اشتراک شما برای ۳۰ روز دیگر تمدید شد.');
      } else if (subAction === 'cancel') {
        setManageMsg('اشتراک شما لغو شد.');
      }
    } catch {
      setErrorMsg('خطا در ارتباط با سرور.');
    } finally {
      setManageLoading(false);
    }
  };

  const safeWebsiteUrl = managedSub?.websiteUrl && isSafeHttpUrl(managedSub.websiteUrl) ? managedSub.websiteUrl : '';
  const safePanelUrl = managedSub?.panelUrl && isSafeHttpUrl(managedSub.panelUrl) ? managedSub.panelUrl : '';

  return (
    <div className="min-h-screen bg-[#FBFBFC] dark:bg-[#121317] text-[#1D1D1F] dark:text-[#F5F5F7] pb-20 font-vazir" dir="rtl">
      {/* Inline Quiet Breadcrumb Navigation (Matches AdDetailPage) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 sm:pt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 leading-none">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 -ms-1 px-1.5 h-10 sm:h-8 text-[13px] font-semibold leading-none text-[#0066CC] hover:text-[#0055AA] transition-colors active:opacity-60 cursor-pointer shrink-0"
          >
            <ArrowRight size={15} strokeWidth={2} className="block shrink-0" />
            <span className="leading-none">بازگشت</span>
          </button>

          <div className="hidden sm:flex items-center gap-1.5 text-xs leading-none text-[#86868B] truncate">
            <span>/</span>
            <span>خانه</span>
            <span>/</span>
            <span className="text-[#1D1D1F] dark:text-[#F5F5F7] font-semibold">ساخت وب‌سایت اختصاصی</span>
          </div>
        </div>

        <div className="inline-flex items-center p-1 rounded-full bg-[#F5F5F7] dark:bg-[#171920] border border-[#ECEFF4] dark:border-white/[0.06]">
          <button
            type="button"
            onClick={() => { setPageMode('order'); setErrorMsg(''); }}
            className={`h-8 px-3.5 rounded-full text-xs font-bold leading-none inline-flex items-center justify-center cursor-pointer transition-colors ${
              pageMode === 'order' ? 'bg-[#0066CC] text-white' : 'text-[#6E6E73] hover:text-[#1D1D1F]'
            }`}
          >
            ساخت سایت جدید
          </button>
          <button
            type="button"
            onClick={() => { setPageMode('manage'); setErrorMsg(''); }}
            className={`h-8 px-3.5 rounded-full text-xs font-bold leading-none inline-flex items-center justify-center cursor-pointer transition-colors ${
              pageMode === 'manage' ? 'bg-[#0066CC] text-white' : 'text-[#6E6E73] hover:text-[#1D1D1F]'
            }`}
          >
            مدیریت اشتراک
          </button>
        </div>
      </div>

      {/* Main Centered Page Body (Single Clean Flow, No Duplicate Sidebar) */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-4 pb-6 sm:pt-5 sm:pb-8">
        <main className="space-y-6">
            {pageMode === 'manage' ? (
              /* MANAGE SUBSCRIPTION */
              <div className="rounded-2xl sm:rounded-3xl bg-[#FBFBFC] dark:bg-[#171920] border border-[#ECEFF4] dark:border-white/[0.06] p-5 sm:p-8 space-y-5">
                <div className="text-center space-y-2">
                  <div className="h-11 w-11 mx-auto rounded-2xl bg-[#F5F5F7] dark:bg-white/[0.06] text-[#0066CC] flex items-center justify-center">
                    <KeyRound size={20} className="block" />
                  </div>
                  <div className="space-y-1">
                    <h1 className="text-lg sm:text-xl font-black text-[#1D1D1F]">مدیریت اشتراک وب‌سایت</h1>
                    <p className="text-xs text-[#6E6E73]">کد ۸ رقمی اشتراک را برای مشاهده وضعیت یا تمدید وارد کنید.</p>
                  </div>
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
                    className="h-11 px-5 rounded-full bg-[#0066CC] hover:bg-[#0055AA] text-white text-xs font-bold leading-none inline-flex items-center justify-center cursor-pointer shrink-0 transition-colors"
                  >
                    {manageLoading ? 'در حال بررسی...' : 'مشاهده وضعیت'}
                  </button>
                </form>

                {managedSub && (
                  <div className="pt-4 border-t border-[#ECEFF4] dark:border-white/[0.06] space-y-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#6E6E73]">نام سایت:</span>
                      <strong>{managedSub.name}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6E6E73]">وضعیت:</span>
                      <strong className={managedSub.status === 'cancelled' ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700'}>
                        {managedSub.status === 'cancelled'
                          ? 'لغو شده'
                          : managedSub.status === 'pending_setup'
                          ? 'در حال ساخت (تحویل تا ۲۴ ساعت)'
                          : 'فعال'}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6E6E73]">تاریخ پایان دوره:</span>
                      <strong>
                        {managedSub.expiresAt && Number.isFinite(Date.parse(managedSub.expiresAt))
                          ? FA_SUB_DATE_FMT.format(new Date(managedSub.expiresAt))
                          : '-'}
                      </strong>
                    </div>

                    {(safeWebsiteUrl || safePanelUrl) && (
                      <div className="pt-2 flex flex-wrap gap-2">
                        {safeWebsiteUrl && (
                          <a
                            href={safeWebsiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-10 px-4 rounded-full bg-[#F5F5F7] hover:bg-[#ECECEF] border border-[#ECEFF4] dark:border-white/[0.06] text-[#1D1D1F] text-xs font-semibold leading-none inline-flex items-center gap-1.5 transition-colors"
                          >
                            <span className="leading-none">مشاهده وب‌سایت</span>
                            <ExternalLink size={12} className="block text-[#0066CC] shrink-0" />
                          </a>
                        )}
                        {safePanelUrl && (
                          <a
                            href={safePanelUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-10 px-4 rounded-full bg-[#F5F5F7] hover:bg-[#ECECEF] border border-[#ECEFF4] dark:border-white/[0.06] text-[#1D1D1F] text-xs font-semibold leading-none inline-flex items-center gap-1.5 transition-colors"
                          >
                            <span className="leading-none">ورود به پنل فروش</span>
                            <ExternalLink size={12} className="block text-[#0066CC] shrink-0" />
                          </a>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2 pt-3">
                      <button
                        type="button"
                        disabled={manageLoading}
                        onClick={() => handleManageAction('renew')}
                        className="flex-1 h-10 rounded-full bg-[#0066CC] hover:bg-[#0055AA] text-white text-xs font-bold leading-none inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <RefreshCw size={13} className="block shrink-0" />
                        <span className="leading-none">تمدید ماهانه ({FA_NUM_FMT.format(MONTHLY_PRICE)} کرون)</span>
                      </button>
                      {managedSub.status !== 'cancelled' && (
                        <button
                          type="button"
                          disabled={manageLoading}
                          onClick={() => handleManageAction('cancel')}
                          className="h-10 px-4 rounded-full bg-[#F5F5F7] hover:bg-rose-50 text-rose-700 dark:text-rose-300 border border-[#ECEFF4] dark:border-white/[0.06] text-xs font-bold leading-none inline-flex items-center justify-center cursor-pointer transition-colors"
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
              <div className="rounded-2xl sm:rounded-3xl bg-[#FBFBFC] dark:bg-[#171920] border border-[#ECEFF4] dark:border-white/[0.06] p-6 sm:p-10 text-center space-y-6">
                <div className="h-14 w-14 mx-auto rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <CheckCircle2 size={28} className="block" />
                </div>
                <div className="space-y-2">
                  <h1 className="text-xl sm:text-2xl font-black text-[#1D1D1F]">سفارش شما با موفقیت ثبت شد</h1>
                  <p className="text-xs sm:text-sm text-[#515154] leading-relaxed">
                    وب‌سایت و پنل فروش شما حداکثر ظرف <strong className="text-[#1D1D1F]">۲۴ ساعت</strong> آماده شده و اطلاعات ورود به ایمیل{' '}
                    <strong className="font-mono text-[#0066CC]" dir="ltr">{submittedOrder.email}</strong> ارسال می‌شود.
                  </p>
                </div>

                <div className="py-4 border-y border-[#ECEFF4] dark:border-white/[0.06] space-y-2">
                  <span className="text-xs font-bold text-[#6E6E73] block">کد ۸ رقمی مدیریت اشتراک (ذخیره کنید)</span>
                  <div className="flex items-center justify-center gap-3">
                    <span className="font-mono text-2xl font-black tracking-widest text-[#1D1D1F] select-all" dir="ltr">
                      {submittedOrder.manageCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyManageCode(submittedOrder.manageCode)}
                      className="h-9 px-3.5 rounded-full bg-[#F5F5F7] hover:bg-[#ECECEF] border border-[#ECEFF4] dark:border-white/[0.06] text-xs font-bold leading-none inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      {copiedCode ? <Check size={13} className="block shrink-0" /> : <Copy size={13} className="block shrink-0" />}
                      <span className="leading-none">{copiedCode ? 'کپی شد' : 'کپی'}</span>
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onBack}
                  className="h-11 px-8 rounded-full bg-[#0066CC] hover:bg-[#0055AA] text-white text-xs font-bold leading-none inline-flex items-center justify-center cursor-pointer transition-colors"
                >
                  بازگشت به صفحه اصلی
                </button>
              </div>
            ) : (
              /* SIMPLE 3-STEP WIZARD */
              <div className="rounded-2xl sm:rounded-3xl bg-[#FBFBFC] dark:bg-[#171920] border border-[#ECEFF4] dark:border-white/[0.06] p-5 sm:p-8 space-y-6">
                {/* Calm Step Progress Bar */}
                <div className="flex items-center justify-between text-xs font-bold border-b border-[#ECEFF4] dark:border-white/[0.06] pb-4">
                  <span className={step === 1 ? 'text-[#0066CC]' : 'text-[#86868B]'}>۱. معرفی و دمو</span>
                  <ArrowLeft size={13} className="block text-[#86868B] shrink-0" />
                  <span className={step === 2 ? 'text-[#0066CC]' : 'text-[#86868B]'}>۲. مشخصات کسب‌وکار</span>
                  <ArrowLeft size={13} className="block text-[#86868B] shrink-0" />
                  <span className={step === 3 ? 'text-[#0066CC]' : 'text-[#86868B]'}>۳. پرداخت ({FA_NUM_FMT.format(SETUP_PRICE)} کرون)</span>
                </div>

                {errorMsg && (
                  <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs font-bold flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* STEP 1: EXPLAIN CLEARLY */}
                {step === 1 && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <h1 className="text-xl sm:text-2xl font-black text-[#1D1D1F] leading-snug">
                        راه‌اندازی وب‌سایت و فروشگاه آنلاین اختصاصی
                      </h1>
                      <p className="text-xs sm:text-sm text-[#6E6E73] leading-relaxed">
                        هزینه طراحی و راه‌اندازی اولیه <strong>{FA_NUM_FMT.format(SETUP_PRICE)} کرون</strong> و اشتراک ماهانه نگهداری <strong>{FA_NUM_FMT.format(MONTHLY_PRICE)} کرون</strong> است.
                      </p>
                    </div>

                    {/* Prominent Live Demo Buttons (Shown First) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <a
                        href="https://swedpersiska.vercel.app"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-11 px-4 rounded-2xl bg-[#F5F5F7] hover:bg-[#ECECEF] border border-[#ECEFF4] dark:border-white/[0.06] text-[#1D1D1F] text-xs font-bold leading-none inline-flex items-center justify-between transition-colors"
                      >
                        <span className="leading-none">مشاهده دمو وب‌سایت</span>
                        <ExternalLink size={14} className="block text-[#0066CC] shrink-0" />
                      </a>
                      <a
                        href="https://linksho-seller.vercel.app"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-11 px-4 rounded-2xl bg-[#F5F5F7] hover:bg-[#ECECEF] border border-[#ECEFF4] dark:border-white/[0.06] text-[#1D1D1F] text-xs font-bold leading-none inline-flex items-center justify-between transition-colors"
                      >
                        <span className="leading-none">مشاهده دمو پنل فروش</span>
                        <ExternalLink size={14} className="block text-[#0066CC] shrink-0" />
                      </a>
                    </div>

                    {/* 3 Professional Clear Steps */}
                    <div className="space-y-4 text-xs sm:text-[13px] text-[#515154]">
                      <div className="flex items-start gap-3">
                        <span className="h-7 w-7 rounded-full bg-[#0066CC]/10 text-[#0066CC] font-black flex items-center justify-center shrink-0">۱</span>
                        <div className="pt-0.5">
                          <strong className="text-[#1D1D1F] block">ثبت مشخصات کسب‌وکار</strong>
                          <span>نام برند یا فروشگاه، شماره تماس، شماره ثبت شرکت و ایمیل رسمی خود را وارد کنید.</span>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <span className="h-7 w-7 rounded-full bg-[#0066CC]/10 text-[#0066CC] font-black flex items-center justify-center shrink-0">۲</span>
                        <div className="pt-0.5">
                          <strong className="text-[#1D1D1F] block">آماده‌سازی وب‌سایت، ربات تلگرام و درگاه Stripe</strong>
                          <span>وب‌سایت شما حداکثر ظرف ۲۴ ساعت با گواهی SSL، ربات تلگرام دریافت سفارش و درگاه پرداخت Stripe آماده می‌شود.</span>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <span className="h-7 w-7 rounded-full bg-[#0066CC]/10 text-[#0066CC] font-black flex items-center justify-center shrink-0">۳</span>
                        <div className="pt-0.5">
                          <strong className="text-[#1D1D1F] block">اتصال دامنه اختصاصی</strong>
                          <span>پس از تحویل سایت، تیم پشتیبانی اتصال دامنه اختصاصی شما را گام‌به‌گام انجام می‌دهد.</span>
                        </div>
                      </div>
                    </div>

                    {/* Cloud Specs, SSL & Ad Link Note */}
                    <div className="pt-4 border-t border-[#ECEFF4] dark:border-white/[0.06] space-y-2.5 text-xs text-[#6E6E73]">
                      <p className="flex items-start gap-2.5">
                        <Sparkles size={14} className="mt-0.5 block text-[#0066CC] shrink-0" />
                        <span>زیرساخت ابری اختصاصی: <strong>۵ گیگابایت</strong> دیتابیس ابری، <strong>۹ گیگابایت</strong> فضای تصاویر و ظرفیت <strong>۱۰۰,۰۰۰ درخواست روزانه</strong>.</span>
                      </p>
                      <p className="flex items-start gap-2.5">
                        <Lock size={14} className="mt-0.5 block text-emerald-600 shrink-0" />
                        <span>مجهز به <strong>گواهی امنیتی SSL (HTTPS)</strong> و درگاه پرداخت رسمی <strong>Stripe</strong>.</span>
                      </p>
                      <p className="flex items-start gap-2.5">
                        <PhoneCall size={14} className="mt-0.5 block text-emerald-600 shrink-0" />
                        <span>پشتیبانی اختصاصی اتصال دامنه و کد ۸ رقمی مدیریت اشتراک.</span>
                      </p>
                      <p className="flex items-start gap-2.5">
                        <CheckCircle2 size={14} className="mt-0.5 block text-[#0066CC] shrink-0" />
                        <span>امکان درج لینک مستقیم وب‌سایت شما در آگهی‌های لینک شو.</span>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="w-full h-11 sm:h-12 rounded-full bg-[#0066CC] hover:bg-[#0055AA] text-white text-xs sm:text-sm font-bold leading-none inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
                    >
                      <span className="leading-none">شروع سفارش وب‌سایت</span>
                      <ArrowLeft size={16} className="block shrink-0" />
                    </button>
                  </div>
                )}

                {/* STEP 2: ONLY 4 SIMPLE FIELDS */}
                {step === 2 && (
                  <form onSubmit={handleStep2Next} className="space-y-5">
                    <div>
                      <h2 className="text-lg font-black text-[#1D1D1F]">مشخصات کسب‌وکار</h2>
                      <p className="text-xs text-[#6E6E73] mt-0.5">اطلاعات زیر را برای راه‌اندازی وب‌سایت تکمیل کنید:</p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-[#1D1D1F] mb-1.5">۱. نام وب‌سایت یا فروشگاه *</label>
                        <input
                          type="text"
                          required
                          value={storeName}
                          onChange={(e) => setStoreName(e.target.value)}
                          placeholder="مثال: رستوران زعفران"
                          className="w-full h-11 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7] px-3.5 text-xs focus:bg-white focus:border-[#0066CC] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#1D1D1F] mb-1.5">۲. شماره تماس *</label>
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
                        <label className="block text-xs font-bold text-[#1D1D1F] mb-1.5">۴. ایمیل رسمی (دریافت اطلاعات دسترسی) *</label>
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
                        className="h-11 px-5 rounded-full bg-[#F5F5F7] hover:bg-[#ECECEF] border border-[#ECEFF4] dark:border-white/[0.06] text-[#1D1D1F] text-xs font-bold leading-none inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <ArrowRight size={15} className="block shrink-0" />
                        <span className="leading-none">قبلی</span>
                      </button>
                      <button
                        type="submit"
                        className="flex-1 h-11 rounded-full bg-[#0066CC] hover:bg-[#0055AA] text-white text-xs sm:text-sm font-bold leading-none inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
                      >
                        <span className="leading-none">ادامه به پرداخت</span>
                        <ArrowLeft size={15} className="block shrink-0" />
                      </button>
                    </div>
                  </form>
                )}

                {/* STEP 3: CLEAN PAYMENT */}
                {step === 3 && (
                  <form onSubmit={handleSubmitOrder} className="space-y-5">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h2 className="text-lg font-black text-[#1D1D1F]">تایید و پرداخت</h2>
                        <p className="text-xs text-[#6E6E73] mt-0.5">
                          هزینه راه‌اندازی: {FA_NUM_FMT.format(SETUP_PRICE)} کرون • اشتراک ماهانه: {FA_NUM_FMT.format(MONTHLY_PRICE)} کرون
                        </p>
                      </div>
                      {isOfflineDemoMode && (
                        <button
                          type="button"
                          onClick={() => {
                            setCardHolder('Ali Rezaei');
                            setCardNumber('4242 4242 4242 4242');
                            setCardExpiry('12/28');
                            setCardCvc('424');
                          }}
                          className="text-xs font-bold text-[#0066CC] hover:text-[#0055AA] cursor-pointer shrink-0"
                        >
                          پر کردن کارت تست
                        </button>
                      )}
                    </div>

                    {isOfflineDemoMode ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#1D1D1F]">
                          <CreditCard size={15} className="text-[#0066CC]" />
                          <span>مشخصات کارت بانکی (حالت تست)</span>
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
                    ) : (
                      <div className="p-4 rounded-2xl bg-[#F5F5F7] border border-[#ECEFF4] dark:border-white/[0.06] space-y-1.5 text-xs text-[#515154]">
                        <div className="flex items-center gap-1.5 font-bold text-[#1D1D1F]">
                          <Lock size={14} className="block text-emerald-600 shrink-0" />
                          <span>درگاه رسمی Stripe</span>
                        </div>
                        <p className="leading-relaxed">
                          پرداخت در صفحه رمزنگاری‌شده Stripe انجام می‌شود و بلافاصله پس از تایید، کد ۸ رقمی مدیریت اشتراک شما صادر خواهد شد.
                        </p>
                      </div>
                    )}

                    <div className="flex items-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        className="h-11 px-5 rounded-full bg-[#F5F5F7] hover:bg-[#ECECEF] border border-[#ECEFF4] dark:border-white/[0.06] text-[#1D1D1F] text-xs font-bold leading-none inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <ArrowRight size={15} className="block shrink-0" />
                        <span className="leading-none">قبلی</span>
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="flex-1 h-11 sm:h-12 rounded-full bg-[#0066CC] hover:bg-[#0055AA] text-white text-xs sm:text-sm font-bold leading-none inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60"
                      >
                        <Lock size={15} className="block shrink-0" />
                        <span className="leading-none">{submitting ? 'در حال انتقال...' : `پرداخت ${FA_NUM_FMT.format(SETUP_PRICE)} کرون`}</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Memoized FAQ Accordion */}
            <WebsiteBuilderFaqSection />
          </main>
      </div>
    </div>
  );
}
