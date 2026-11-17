import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowRight, 
  MapPin, 
  Clock, 
  Eye, 
  Phone, 
  Mail, 
  Send, 
  MessageSquare, 
  ShieldCheck, 
  Share2, 
  Check, 
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Crown,
  Lock,
  ZoomIn,
  X
} from 'lucide-react';
import CloudflareTurnstile from './CloudflareTurnstile';
import { CATEGORIES, t } from '../lib/translations';

export default function AdDetailPage({ 
  ad, 
  allAds = [], 
  lang = 'fa', 
  turnstileSettings = { enabled: true, mode: 'test', siteKey: '' },
  onBack, 
  onSelectAd,
  onOpenPromote 
}) {
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);
  const [contactRevealed, setContactRevealed] = useState(false);
  const [showTurnstileGate, setShowTurnstileGate] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ active: false, moved: false, startX: 0, startY: 0, origX: 0, origY: 0 });
  const touchRef = useRef({ mode: null, startDist: 0, startScale: 1, startX: 0, startY: 0, origX: 0, origY: 0, moved: false });
  const currentT = t[lang] || t.fa;

  // Scroll to top when ad changes (state resets via key={ad.id})
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [ad?.id]);

  const imagesCount = (ad?.images && ad.images.length > 0) ? ad.images.length : 1;

  // Keyboard navigation & Escape in photo zoom lightbox
  useEffect(() => {
    if (!zoomOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        setZoomOpen(false);
      } else if (e.key === 'ArrowLeft' && imagesCount > 1) {
        setActiveImageIdx((prev) => (prev < imagesCount - 1 ? prev + 1 : 0));
        setZoomScale(1);
        setPan({ x: 0, y: 0 });
      } else if (e.key === 'ArrowRight' && imagesCount > 1) {
        setActiveImageIdx((prev) => (prev > 0 ? prev - 1 : imagesCount - 1));
        setZoomScale(1);
        setPan({ x: 0, y: 0 });
      } else if (e.key === '+' || e.key === '=') {
        setZoomScale((s) => Math.min(3, Number((s + 0.5).toFixed(2))));
      } else if (e.key === '-') {
        setZoomScale((s) => {
          const next = Math.max(1, Number((s - 0.5).toFixed(2)));
          if (next === 1) setPan({ x: 0, y: 0 });
          return next;
        });
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [zoomOpen, imagesCount]);

  if (!ad) return null;

  const images = (ad.images && ad.images.length > 0)
    ? ad.images
    : ['https://images.unsplash.com/photo-1582407947304-fd86f028f716?auto=format&fit=crop&w=1200&q=80'];

  const catObj = CATEGORIES.find(c => c.id === ad.category);
  const catName = catObj ? (lang === 'fa' ? catObj.fa : catObj.sv) : ad.category;

  const displayPrice = ad.price 
    ? `${Number(ad.price).toLocaleString('sv-SE')} ${ad.price_type || 'kr'}`
    : (ad.price_type || (lang === 'fa' ? 'توافقی' : 'Enligt överenskommelse'));

  const dateStr = ad.created_at 
    ? new Date(ad.created_at).toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'sv-SE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : '';

  const shareAd = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // Find 4 VIP Promoted ads (or fallback to top featured/recent ads)
  const otherAds = allAds.filter(a => a.id !== ad.id);
  const vipAds = otherAds.filter(a => a.is_featured);
  const fallbackAds = otherAds.filter(a => !a.is_featured);
  // Guarantee exactly 4 VIP slots (using featured ads first, then other ads to fill)
  const displayVipAds = [...vipAds, ...fallbackAds].slice(0, 4);

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] pb-20 font-vazir" dir="rtl">
      
      {/* Top Bar / Breadcrumb Navigation */}
      <div className="bg-[#FBFBFC] border-b border-[#E5E5EA] sticky top-16 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-3">
          
          {/* Back button & Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all active:scale-95 cursor-pointer shrink-0"
            >
              <ArrowRight size={15} />
              <span>بازگشت به آگهی‌ها</span>
            </button>

            <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#6E6E73] truncate">
              <span>خانه</span>
              <span>/</span>
              <span className="text-[#1D1D1F] font-semibold">{catName}</span>
            </div>
          </div>

          {/* Right actions: Reference Code & Share */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden xs:inline-flex font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
              <bdi>{ad.reference_number}</bdi>
            </span>

            <button
              type="button"
              onClick={shareAd}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-2xs"
            >
              {copiedLink ? <Check size={14} className="text-emerald-600" /> : <Share2 size={14} />}
              <span>{copiedLink ? currentT.copied : 'اشتراک‌گذاری'}</span>
            </button>
          </div>

        </div>
      </div>

      {/* Main Page Body: 2 Columns on Desktop, Single Column on Mobile */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          
          {/* MAIN CONTENT COLUMN (8 cols on Desktop) */}
          <main className="lg:col-span-8 space-y-6">
            
            {/* Gallery Card */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-3 sm:p-5 shadow-xs overflow-hidden space-y-3">
              {/* Big Stage Image (click to zoom) */}
              <div className="relative aspect-[16/10] sm:aspect-[16/9] w-full rounded-xl sm:rounded-2xl overflow-hidden bg-slate-950 group">
                <img
                  src={images[activeImageIdx]}
                  alt={ad.title}
                  onClick={() => {
                    setZoomScale(1);
                    setPan({ x: 0, y: 0 });
                    setZoomOpen(true);
                  }}
                  className="w-full h-full object-contain sm:object-cover cursor-zoom-in transition-transform duration-300 group-hover:scale-[1.015]"
                />

                {/* Subtle Circular Zoom Button */}
                <button
                  type="button"
                  onClick={() => {
                    setZoomScale(1);
                    setPan({ x: 0, y: 0 });
                    setZoomOpen(true);
                  }}
                  className="absolute bottom-3 end-3 h-9 w-9 rounded-full bg-[#1D1D1F]/70 hover:bg-[#1D1D1F] text-white flex items-center justify-center shadow-md transition-all cursor-pointer"
                  title="مشاهده تمام‌صفحه"
                >
                  <ZoomIn size={16} />
                </button>

                {/* VIP / Featured Badge */}
                {ad.is_featured && (
                  <div className="absolute top-3 start-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1877F2] text-white text-xs font-black shadow-md backdrop-blur-xs">
                    <Crown size={13} className="text-amber-300" />
                    <span>آگهی ویژه (VIP)</span>
                  </div>
                )}

                {/* Category Badge */}
                <div className="absolute top-3 end-3 px-3 py-1 rounded-full bg-[#FBFBFC] text-[#1D1D1F] text-xs font-bold shadow-md border border-[#E5E5EA]">
                  {catName}
                </div>

                {/* Arrow navigation if multiple images */}
                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setActiveImageIdx((prev) => (prev > 0 ? prev - 1 : images.length - 1))}
                      className="absolute start-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white flex items-center justify-center transition-all cursor-pointer backdrop-blur-xs shadow-md"
                    >
                      <ChevronRight size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveImageIdx((prev) => (prev < images.length - 1 ? prev + 1 : 0))}
                      className="absolute end-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white flex items-center justify-center transition-all cursor-pointer backdrop-blur-xs shadow-md"
                    >
                      <ChevronLeft size={18} />
                    </button>
                  </>
                )}
              </div>

              {/* Thumbnails row */}
              {images.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveImageIdx(idx)}
                      className={`relative h-16 sm:h-20 aspect-[4/3] rounded-xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                        activeImageIdx === idx 
                          ? 'border-blue-600 ring-2 ring-blue-200 scale-95' 
                          : 'border-slate-200 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={img} alt={`thumbnail-${idx}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Title, Price & Details Card */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-5">
              
              {/* Header: Title & Price */}
              <div className="space-y-3 pb-5 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-950 leading-snug">
                    {lang === 'fa' && ad.title_fa ? ad.title_fa : ad.title}
                  </h1>
                  
                  {/* Price Big Badge */}
                  <div className="px-4 py-2 rounded-2xl bg-slate-50 border border-slate-200/90 text-right sm:text-left shrink-0">
                    <span className="text-2xl sm:text-3xl font-black text-[#1877F2] tabular-nums tracking-tight">
                      <bdi>{displayPrice}</bdi>
                    </span>
                  </div>
                </div>

                {/* Meta info tags */}
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold">
                    <MapPin size={13} className="text-blue-600 shrink-0" />
                    <span>{ad.city}{ad.area ? ` • ${ad.area}` : ''}</span>
                  </div>

                  <div className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-500">
                    <Clock size={13} className="shrink-0" />
                    <span>ثبت: {dateStr}</span>
                  </div>

                  <div className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-500">
                    <Eye size={13} className="shrink-0" />
                    <span>{ad.views_count || 1} بازدید</span>
                  </div>

                  <div className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                    <span>کد مرجع:</span>
                    <bdi className="font-mono font-bold text-slate-600">{ad.reference_number}</bdi>
                  </div>
                </div>
              </div>

              {/* Description Section */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-600" />
                  <span>توضیحات و مشخصات کامل</span>
                </h3>
                <div className="text-sm sm:text-base text-slate-700 leading-relaxed sm:leading-loose whitespace-pre-wrap bg-slate-50/60 p-4 sm:p-5 rounded-2xl border border-slate-100">
                  {ad.description}
                </div>
              </div>

              {/* Contact Seller Action Buttons (Hidden & Protected with Cloudflare Turnstile) */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <h3 className="text-sm font-bold text-slate-900">راه‌های ارتباط با آگهی‌دهنده:</h3>

                {!contactRevealed ? (
                  <div className="rounded-2xl bg-slate-50/90 border border-slate-200/80 p-4 sm:p-5 space-y-3.5">
                    {!showTurnstileGate ? (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 border border-blue-200/70">
                            <Lock size={17} />
                          </div>
                          <div>
                            <p className="text-xs sm:text-[13px] font-bold text-slate-900">
                              اطلاعات تماس برای جلوگیری از ربات‌ها محافظت شده است
                            </p>
                            <p className="text-[11px] text-slate-500">
                              برای مشاهده دکمه‌های ارتباطی کلیک کنید
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (turnstileSettings?.enabled === false) {
                              setContactRevealed(true);
                            } else {
                              setShowTurnstileGate(true);
                            }
                          }}
                          className="h-11 px-5 rounded-full bg-[#1877F2] hover:bg-[#166fe5] text-white text-xs sm:text-[13px] font-bold inline-flex items-center justify-center gap-2 shadow-sm transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.94] cursor-pointer shrink-0"
                        >
                          <ShieldCheck size={16} />
                          <span>مشاهده اطلاعات تماس</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center space-y-2.5 py-1 animate-in fade-in duration-200">
                        <p className="text-xs font-bold text-slate-700">
                          تایید امنیتی جهت نمایش اطلاعات تماس آگهی‌دهنده
                        </p>
                        <CloudflareTurnstile
                          theme="light"
                          siteKey={turnstileSettings?.mode === 'live' ? turnstileSettings?.siteKey : undefined}
                          onVerify={() => setContactRevealed(true)}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3 animate-in fade-in duration-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Phone (No raw phone number displayed) */}
                      {ad.contact_phone && (
                        <a
                          href={`tel:${ad.contact_phone.replace(/[^0-9+]/g, '')}`}
                          className="flex items-center justify-center gap-2 h-12 px-5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-xs transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.94]"
                        >
                          <Phone size={17} />
                          <span>تماس مستقیم</span>
                        </a>
                      )}

                      {/* WhatsApp */}
                      {ad.contact_whatsapp && (
                        <a
                          href={`https://wa.me/${ad.contact_whatsapp.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 h-12 px-5 rounded-full bg-[#25D366] hover:bg-[#20ba59] text-white text-sm font-bold shadow-xs transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.94]"
                        >
                          <MessageSquare size={17} />
                          <span>پیام در واتساپ</span>
                        </a>
                      )}

                      {/* Telegram */}
                      {ad.contact_telegram && (
                        <a
                          href={/^https?:\/\//i.test(ad.contact_telegram.trim()) ? ad.contact_telegram.trim() : `https://t.me/${ad.contact_telegram.trim().replace(/^@/, '').replace(/[^a-zA-Z0-9_]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 h-12 px-5 rounded-full bg-[#229ED9] hover:bg-[#1e8ec3] text-white text-sm font-bold shadow-xs transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.94]"
                        >
                          <Send size={17} />
                          <span>گفتگو در تلگرام</span>
                        </a>
                      )}

                      {/* Email */}
                      {ad.contact_email && (
                        <a
                          href={`mailto:${ad.contact_email}?subject=پرسش درباره آگهی ${ad.reference_number}`}
                          className="flex items-center justify-center gap-2 h-12 px-5 rounded-full bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold shadow-xs transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.94]"
                        >
                          <Mail size={17} />
                          <span>ارسال ایمیل</span>
                        </a>
                      )}
                    </div>

                    {ad.contact_name && (
                      <p className="text-xs text-slate-500 pt-1 text-center sm:text-right">
                        نام آگهی‌دهنده: <span className="font-semibold text-slate-800">{ad.contact_name}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Safety Notice Card */}
              <div className="rounded-2xl bg-amber-50/80 border border-amber-200/80 p-4 flex items-start gap-3">
                <ShieldCheck size={20} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs text-amber-900">
                  <h4 className="font-bold">راهنمای معامله امن:</h4>
                  <p className="leading-relaxed text-amber-800">
                    همیشه قبل از واریز هرگونه بیعانه یا وجه، کالا یا مسکن را شخصاً بررسی فرمایید و از قراردادهای رسمی استفاده کنید. سایت سوئد پرشیا بستر ثبت آگهی‌های رایگان جامعه فارسی‌زبان است.
                  </p>
                </div>
              </div>

            </div>

          </main>

          {/* SIDEBAR: 4 VIP PROMOTED ADS & MONETIZATION SLOTS (4 cols on Desktop) */}
          <aside className="lg:col-span-4 lg:sticky lg:top-32 space-y-5">
            
            {/* VIP Sponsored Ads Box */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-4">
              
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                    <Crown size={15} />
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold text-slate-950">آگهی‌های ویژه و برگزیده</h2>
                    <p className="text-[10px] text-slate-400 font-medium">۴ جایگاه اسپانسر شده (VIP)</p>
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200">
                  اسپانسر
                </span>
              </div>

              {/* The 4 VIP Cards Grid */}
              <div className="space-y-3">
                {displayVipAds.map((vipAd) => {
                  const vipCat = CATEGORIES.find(c => c.id === vipAd.category);
                  const vipCover = (vipAd.images && vipAd.images.length > 0)
                    ? vipAd.images[0]
                    : 'https://images.unsplash.com/photo-1582407947304-fd86f028f716?auto=format&fit=crop&w=400&q=80';
                  const vipPrice = vipAd.price 
                    ? `${Number(vipAd.price).toLocaleString('sv-SE')} ${vipAd.price_type || 'kr'}`
                    : (vipAd.price_type || 'توافقی');

                  return (
                    <article
                      key={vipAd.id}
                      onClick={() => onSelectAd?.(vipAd)}
                      className="group flex gap-3 p-2.5 rounded-xl border border-slate-200/70 hover:border-blue-400 bg-slate-50/50 hover:bg-white transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-[0.99]"
                    >
                      {/* Image */}
                      <div className="relative h-20 w-24 rounded-lg overflow-hidden shrink-0 bg-slate-200">
                        <img
                          src={vipCover}
                          alt={vipAd.title}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute top-1 start-1 px-1.5 py-0.5 rounded bg-[#1877F2] text-white text-[8px] font-black shadow-xs">
                          ویژه
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 flex flex-col justify-between min-w-0">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-semibold text-slate-400 block truncate">
                            {vipCat?.fa || vipAd.category}
                          </span>
                          <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1 leading-snug">
                            {vipAd.title_fa || vipAd.title}
                          </h4>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-xs font-black text-slate-950 tabular-nums">
                            {vipPrice}
                          </span>
                          <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                            <MapPin size={9} className="text-slate-400" />
                            {vipAd.city}
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

            </div>

            {/* Monetization Promotion CTA Card */}
            <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white rounded-2xl sm:rounded-3xl p-5 shadow-lg border border-slate-800 space-y-3.5 relative overflow-hidden">
              <div className="absolute -end-8 -top-8 w-28 h-28 bg-blue-500/20 rounded-full blur-2xl pointer-events-none" />
              
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-400/20 text-amber-300">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">آگهی شما اینجا دیده شود!</h3>
                  <p className="text-[10px] text-slate-300">جذب ۳ برابری مشتریان و بازدیدکنندگان</p>
                </div>
              </div>

              <p className="text-xs text-slate-200 leading-relaxed font-normal">
                با ارتقا به آگهی ویژه (VIP)، آگهی شما در سایدبار تمام صفحات آگهی‌ها و صدر نتایج جستجوی هزاران فارسی‌زبان سراسر اسکاندیناوی نمایش داده می‌شود.
              </p>

              <button
                type="button"
                onClick={() => onOpenPromote?.(ad)}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white text-xs font-bold shadow-md hover:shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Crown size={15} className="text-amber-300" />
                <span>ارتقا و ویژه کردن این آگهی (Stripe)</span>
              </button>
            </div>

          </aside>

        </div>
      </div>

      {/* Apple-Style Full-Screen Photo Gallery & Pinch-Zoom Lightbox */}
      {zoomOpen && (
        <div
          className="fixed inset-0 z-[70] bg-black/95 flex flex-col select-none font-vazir"
          dir="rtl"
          onWheel={(e) => {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 0.25 : -0.25;
            setZoomScale((s) => {
              const next = Math.min(3.5, Math.max(1, Number((s + delta).toFixed(2))));
              if (next === 1) setPan({ x: 0, y: 0 });
              return next;
            });
          }}
        >
          {/* Floating Minimal Top Bar */}
          <div className="flex items-center justify-between px-4 sm:px-6 pt-4 pb-2 shrink-0 z-10">
            <button
              type="button"
              onClick={() => setZoomOpen(false)}
              className="h-10 w-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors cursor-pointer"
              title="بستن"
            >
              <X size={20} />
            </button>

            {images.length > 1 && (
              <span className="px-3 py-1 rounded-full bg-white/15 text-white text-xs font-semibold font-mono">
                {activeImageIdx + 1} / {images.length}
              </span>
            )}
          </div>

          {/* Interactive Stage: Pinch-to-Zoom + Swipe on Mobile, Click-Zoom + Drag on Desktop */}
          <div
            className="relative flex-1 flex items-center justify-center overflow-hidden px-2 sm:px-6 touch-none"
            onClick={(e) => {
              if (e.target === e.currentTarget && zoomScale === 1) setZoomOpen(false);
            }}
            onTouchStart={(e) => {
              if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                setIsDragging(true);
                touchRef.current = {
                  mode: 'pinch',
                  startDist: Math.hypot(dx, dy),
                  startScale: zoomScale,
                  startX: 0,
                  startY: 0,
                  origX: pan.x,
                  origY: pan.y,
                  moved: true,
                };
              } else if (e.touches.length === 1) {
                setIsDragging(true);
                touchRef.current = {
                  mode: zoomScale > 1 ? 'pan' : 'swipe',
                  startDist: 0,
                  startScale: zoomScale,
                  startX: e.touches[0].clientX,
                  startY: e.touches[0].clientY,
                  origX: pan.x,
                  origY: pan.y,
                  moved: false,
                };
              }
            }}
            onTouchMove={(e) => {
              const tState = touchRef.current;
              if (tState.mode === 'pinch' && e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const dist = Math.hypot(dx, dy);
                if (tState.startDist > 0) {
                  const next = Math.min(3.5, Math.max(1, Number((tState.startScale * (dist / tState.startDist)).toFixed(2))));
                  setZoomScale(next);
                  if (next === 1) setPan({ x: 0, y: 0 });
                }
              } else if (tState.mode === 'pan' && e.touches.length === 1) {
                const dx = e.touches[0].clientX - tState.startX;
                const dy = e.touches[0].clientY - tState.startY;
                if (Math.abs(dx) > 4 || Math.abs(dy) > 4) tState.moved = true;
                setPan({ x: tState.origX + dx, y: tState.origY + dy });
              } else if (tState.mode === 'swipe' && e.touches.length === 1) {
                const dx = e.touches[0].clientX - tState.startX;
                if (Math.abs(dx) > 10) tState.moved = true;
              }
            }}
            onTouchEnd={(e) => {
              const tState = touchRef.current;
              setIsDragging(false);
              if (tState.mode === 'swipe' && images.length > 1 && e.changedTouches.length === 1) {
                const dx = e.changedTouches[0].clientX - tState.startX;
                if (dx > 45) {
                  setActiveImageIdx((prev) => (prev < images.length - 1 ? prev + 1 : 0));
                } else if (dx < -45) {
                  setActiveImageIdx((prev) => (prev > 0 ? prev - 1 : images.length - 1));
                }
              }
              touchRef.current.mode = null;
            }}
            onPointerDown={(e) => {
              if (e.pointerType === 'touch' || zoomScale <= 1) return;
              setIsDragging(true);
              dragRef.current = {
                active: true,
                moved: false,
                startX: e.clientX,
                startY: e.clientY,
                origX: pan.x,
                origY: pan.y,
              };
            }}
            onPointerMove={(e) => {
              if (e.pointerType === 'touch' || !dragRef.current.active) return;
              const dx = e.clientX - dragRef.current.startX;
              const dy = e.clientY - dragRef.current.startY;
              if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragRef.current.moved = true;
              setPan({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy });
            }}
            onPointerUp={(e) => {
              if (e.pointerType === 'touch') return;
              dragRef.current.active = false;
              setIsDragging(false);
            }}
          >
            <img
              src={images[activeImageIdx]}
              alt={ad.title}
              draggable={false}
              onClick={(e) => {
                e.stopPropagation();
                if (dragRef.current.moved || touchRef.current.moved) {
                  dragRef.current.moved = false;
                  touchRef.current.moved = false;
                  return;
                }
                if (zoomScale > 1) {
                  setZoomScale(1);
                  setPan({ x: 0, y: 0 });
                } else {
                  setZoomScale(2.2);
                }
              }}
              style={{
                transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoomScale})`,
                transition: isDragging ? 'none' : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
              className={`max-h-[76vh] max-w-[94vw] object-contain rounded-lg ${
                zoomScale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'
              }`}
            />

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImageIdx((prev) => (prev > 0 ? prev - 1 : images.length - 1));
                    setZoomScale(1);
                    setPan({ x: 0, y: 0 });
                  }}
                  className="hidden sm:flex absolute start-4 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/15 hover:bg-white/25 text-white items-center justify-center transition-colors cursor-pointer"
                >
                  <ChevronRight size={22} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImageIdx((prev) => (prev < images.length - 1 ? prev + 1 : 0));
                    setZoomScale(1);
                    setPan({ x: 0, y: 0 });
                  }}
                  className="hidden sm:flex absolute end-4 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/15 hover:bg-white/25 text-white items-center justify-center transition-colors cursor-pointer"
                >
                  <ChevronLeft size={22} />
                </button>
              </>
            )}
          </div>

          {/* Bottom Thumbnail Strip */}
          {images.length > 1 && (
            <div className="px-4 pb-5 pt-2 flex items-center justify-center gap-2 overflow-x-auto no-scrollbar shrink-0">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setActiveImageIdx(idx);
                    setZoomScale(1);
                    setPan({ x: 0, y: 0 });
                  }}
                  className={`h-12 w-16 rounded-lg overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                    activeImageIdx === idx
                      ? 'border-white scale-105 opacity-100'
                      : 'border-transparent opacity-50 hover:opacity-80'
                  }`}
                >
                  <img src={img} alt={`thumb-${idx}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
