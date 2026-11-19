import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Globe,
  Flag,
  X
} from 'lucide-react';
import CloudflareTurnstile from './CloudflareTurnstile';
import { publicApi } from '../lib/apiClient';
import { CATEGORIES, COUNTRIES, t } from '../lib/translations';

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
  const [zoomed, setZoomed] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('محتوای غیرمجاز یا نامناسب');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSending, setReportSending] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [renderNow] = useState(() => Date.now());
  const stageRef = useRef(null);
  const zoomImgRef = useRef(null);
  const zoomStateRef = useRef({ scale: 1, x: 0, y: 0 });
  const currentT = t[lang] || t.fa;

  const applyPhotoTransform = useCallback((scale, x, y, animate = false) => {
    const clampedScale = Math.min(4, Math.max(1, scale));
    const maxPan = (clampedScale - 1) * 260;
    const cx = clampedScale <= 1 ? 0 : Math.min(maxPan, Math.max(-maxPan, x));
    const cy = clampedScale <= 1 ? 0 : Math.min(maxPan, Math.max(-maxPan, y));
    zoomStateRef.current = { scale: clampedScale, x: cx, y: cy };
    if (zoomImgRef.current) {
      zoomImgRef.current.style.transition = animate
        ? 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)'
        : 'none';
      zoomImgRef.current.style.transform = `translate3d(${cx}px, ${cy}px, 0) scale(${clampedScale})`;
    }
    setZoomed(clampedScale > 1.05);
  }, []);

  const resetPhotoZoom = useCallback(() => {
    applyPhotoTransform(1, 0, 0, true);
  }, [applyPhotoTransform]);

  // Scroll to top when ad changes (state resets via key={ad.id})
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [ad?.id]);

  const imagesCount = (ad?.images && ad.images.length > 0) ? ad.images.length : 1;

  // Keyboard navigation & Escape in light photo modal
  useEffect(() => {
    if (!zoomOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        setZoomOpen(false);
      } else if (e.key === 'ArrowLeft' && imagesCount > 1) {
        setActiveImageIdx((prev) => (prev < imagesCount - 1 ? prev + 1 : 0));
        resetPhotoZoom();
      } else if (e.key === 'ArrowRight' && imagesCount > 1) {
        setActiveImageIdx((prev) => (prev > 0 ? prev - 1 : imagesCount - 1));
        resetPhotoZoom();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [zoomOpen, imagesCount, resetPhotoZoom]);

  // Non-passive 60fps two-finger pinch-to-zoom & pan ONLY on the photo
  useEffect(() => {
    const stage = stageRef.current;
    if (!zoomOpen || !stage) return;

    let mode = null; // 'pinch' | 'pan' | 'swipe'
    let startDist = 0;
    let startScale = 1;
    let startX = 0;
    let startY = 0;
    let origX = 0;
    let origY = 0;
    let moved = false;

    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        mode = 'pinch';
        moved = true;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        startDist = Math.hypot(dx, dy);
        startScale = zoomStateRef.current.scale;
        origX = zoomStateRef.current.x;
        origY = zoomStateRef.current.y;
      } else if (e.touches.length === 1) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        origX = zoomStateRef.current.x;
        origY = zoomStateRef.current.y;
        moved = false;
        mode = zoomStateRef.current.scale > 1.05 ? 'pan' : 'swipe';
      }
    };

    const onTouchMove = (e) => {
      if (mode === 'pinch' && e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        if (startDist > 0) {
          const nextScale = startScale * (dist / startDist);
          applyPhotoTransform(nextScale, origX, origY, false);
        }
      } else if (mode === 'pan' && e.touches.length === 1) {
        e.preventDefault();
        const dx = e.touches[0].clientX - startX;
        const dy = e.touches[0].clientY - startY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
        applyPhotoTransform(zoomStateRef.current.scale, origX + dx, origY + dy, false);
      } else if (mode === 'swipe' && e.touches.length === 1) {
        const dx = e.touches[0].clientX - startX;
        if (Math.abs(dx) > 10) moved = true;
      }
    };

    const onTouchEnd = (e) => {
      if (mode === 'pinch' && zoomStateRef.current.scale < 1.08) {
        resetPhotoZoom();
      } else if (mode === 'swipe' && imagesCount > 1 && e.changedTouches.length === 1 && moved) {
        const dx = e.changedTouches[0].clientX - startX;
        if (dx > 45) {
          setActiveImageIdx((prev) => (prev < imagesCount - 1 ? prev + 1 : 0));
          resetPhotoZoom();
        } else if (dx < -45) {
          setActiveImageIdx((prev) => (prev > 0 ? prev - 1 : imagesCount - 1));
          resetPhotoZoom();
        }
      }
      if (e.touches.length === 0) mode = null;
    };

    stage.addEventListener('touchstart', onTouchStart, { passive: false });
    stage.addEventListener('touchmove', onTouchMove, { passive: false });
    stage.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      stage.removeEventListener('touchstart', onTouchStart);
      stage.removeEventListener('touchmove', onTouchMove);
      stage.removeEventListener('touchend', onTouchEnd);
    };
  }, [zoomOpen, imagesCount, applyPhotoTransform, resetPhotoZoom]);

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

  const isVipActive = Boolean(
    ad.is_active_vip !== undefined
      ? ad.is_active_vip
      : (ad.is_featured && (!ad.promotion_expires_at || Date.parse(ad.promotion_expires_at) > renderNow))
  );

  const shareAd = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // Find 4 VIP Promoted ads strictly within the same country
  const adCountryCode = ad.country || 'se';
  const adCountryObj = COUNTRIES.find(c => c.id === adCountryCode) || COUNTRIES[0];
  const adCountryName = adCountryObj?.nameFa || 'سوئد';
  const sameCountryAds = allAds.filter(a => a.id !== ad.id && (a.country || 'se') === adCountryCode);
  const checkVip = (a) => Boolean(
    a.is_active_vip !== undefined
      ? a.is_active_vip
      : (a.is_featured && (!a.promotion_expires_at || Date.parse(a.promotion_expires_at) > renderNow))
  );
  const vipAds = sameCountryAds.filter(checkVip);
  const fallbackAds = sameCountryAds
    .filter(a => !checkVip(a))
    .sort((a, b) => (Date.parse(b.sort_timestamp || b.created_at || 0) || 0) - (Date.parse(a.sort_timestamp || a.created_at || 0) || 0));
  // Guarantee up to 4 VIP slots from the same country (featured ads first, then recent ads of that country)
  const displayVipAds = [...vipAds, ...fallbackAds].slice(0, 4);

  return (
    <div className="min-h-screen bg-[#FBFBFC] dark:bg-[#121317] text-[#1D1D1F] dark:text-[#F5F5F7] pb-20 font-vazir" dir="rtl">
      
      {/* Inline quiet navigation (no bar / no menu look) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 leading-none">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 -ms-1 px-1 h-8 text-[13px] font-semibold leading-none text-[#0066CC] hover:text-[#0055AA] transition-colors active:opacity-60 cursor-pointer shrink-0"
          >
            <ArrowRight size={15} strokeWidth={2} className="block shrink-0" />
            <span className="leading-none">بازگشت</span>
          </button>

          <div className="hidden sm:flex items-center gap-1.5 text-xs leading-none text-[#86868B] truncate">
            <span>/</span>
            <span>خانه</span>
            <span>/</span>
            <span className="text-[#1D1D1F] dark:text-[#F5F5F7] font-semibold">{catName}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={shareAd}
          aria-label="اشتراک‌گذاری"
          className="inline-flex items-center gap-1.5 px-1 h-8 text-[13px] font-semibold leading-none text-[#6E6E73] hover:text-[#1D1D1F] dark:text-[#98989F] dark:hover:text-white transition-colors active:opacity-60 cursor-pointer shrink-0"
        >
          {copiedLink ? (
            <Check size={15} strokeWidth={2} className="block shrink-0" />
          ) : (
            <Share2 size={15} strokeWidth={2} className="block shrink-0" />
          )}
          <span className="leading-none">{copiedLink ? currentT.copied : 'اشتراک‌گذاری'}</span>
        </button>
      </div>

      {/* Main Page Body: 2 Columns on Desktop, Single Column on Mobile */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-6 sm:pt-4 sm:pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          
          {/* MAIN CONTENT COLUMN (8 cols on Desktop) */}
          <main className="lg:col-span-8 space-y-5">
            
            {/* Frameless Image Gallery (Unified with page plane) */}
            <div className="space-y-2.5">
              {/* Big Stage Image (click to zoom) */}
              <div className="relative aspect-[16/10] sm:aspect-[16/9] w-full rounded-2xl sm:rounded-3xl overflow-hidden bg-[#F5F5F7] dark:bg-[#14161C] border border-[#F0F2F5] dark:border-white/[0.025] shadow-none group">
                <img
                  src={images[activeImageIdx]}
                  alt={ad.title}
                  onClick={() => {
                    zoomStateRef.current = { scale: 1, x: 0, y: 0 };
                    setZoomed(false);
                    setZoomOpen(true);
                  }}
                  className="w-full h-full object-cover cursor-zoom-in transition-transform duration-300 group-hover:scale-[1.015]"
                />

                {/* Subtle Circular Zoom Button */}
                <button
                  type="button"
                  onClick={() => {
                    zoomStateRef.current = { scale: 1, x: 0, y: 0 };
                    setZoomed(false);
                    setZoomOpen(true);
                  }}
                  className="absolute bottom-3 end-3 h-9 w-9 rounded-full bg-[#1D1D1F]/65 hover:bg-[#1D1D1F]/85 text-white flex items-center justify-center backdrop-blur-xs transition-all cursor-pointer"
                  title="مشاهده تمام‌صفحه"
                >
                  <ZoomIn size={16} />
                </button>

                {/* VIP / Featured Badge */}
                {isVipActive && (
                  <div className="absolute top-3 start-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0066CC] text-white text-xs font-bold backdrop-blur-xs">
                    <Crown size={13} className="text-white/90" />
                    <span>ویژه</span>
                  </div>
                )}

                {/* Category Badge */}
                <div className="absolute top-3 end-3 px-3 py-1 rounded-full bg-[#FBFBFC]/90 dark:bg-[#171920]/90 border border-[#ECEFF4]/60 dark:border-white/[0.08] backdrop-blur-md text-[#1D1D1F] dark:text-[#F5F5F7] text-xs font-bold">
                  {catName}
                </div>

                {/* Arrow navigation if multiple images */}
                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setActiveImageIdx((prev) => (prev > 0 ? prev - 1 : images.length - 1))}
                      className="absolute start-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-[#1D1D1F]/65 hover:bg-[#1D1D1F]/85 text-white flex items-center justify-center transition-all cursor-pointer backdrop-blur-xs"
                    >
                      <ChevronRight size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveImageIdx((prev) => (prev < images.length - 1 ? prev + 1 : 0))}
                      className="absolute end-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-[#1D1D1F]/65 hover:bg-[#1D1D1F]/85 text-white flex items-center justify-center transition-all cursor-pointer backdrop-blur-xs"
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
                      className={`relative h-14 sm:h-16 aspect-[4/3] rounded-xl overflow-hidden shrink-0 transition-all cursor-pointer border border-[#F0F2F5] dark:border-white/[0.025] ${
                        activeImageIdx === idx 
                          ? 'ring-2 ring-[#0066CC] opacity-100' 
                          : 'opacity-65 hover:opacity-100'
                      }`}
                    >
                      <img src={img} alt={`thumbnail-${idx}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Title, Price & Details Card (Unified Flat Surface, No Heavy Shadows) */}
            <div className="bg-[#FBFBFC] dark:bg-[#14161C] rounded-2xl sm:rounded-3xl border border-[#F0F2F5] dark:border-white/[0.025] p-5 sm:p-8 space-y-6 shadow-none">
              
              {/* Header: Title, Price & Unified Meta Row */}
              <div className="space-y-3.5 pb-6 border-b border-[#F0F2F5] dark:border-white/[0.025]">
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 sm:gap-4">
                  <h1 className="text-xl sm:text-2xl font-black text-[#1D1D1F] dark:text-white leading-snug">
                    {lang === 'fa' && ad.title_fa ? ad.title_fa : ad.title}
                  </h1>
                  
                  {/* Price Clean Display */}
                  <div className="shrink-0">
                    <span className="text-xl sm:text-2xl font-black text-[#0066CC] tabular-nums tracking-tight">
                      <bdi>{displayPrice}</bdi>
                    </span>
                  </div>
                </div>

                {/* Clean Inline Meta Row */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs leading-none text-[#6E6E73] dark:text-[#98989F]">
                  <span className="inline-flex items-center gap-1.5 font-semibold leading-none text-[#1D1D1F] dark:text-[#F5F5F7]">
                    <MapPin size={14} strokeWidth={2} className="block text-[#86868B] shrink-0" />
                    <span className="leading-none">{ad.city}{ad.area ? `، ${ad.area}` : ''}</span>
                  </span>

                  <span className="inline-flex items-center gap-1.5 leading-none">
                    <Clock size={14} strokeWidth={2} className="block text-[#86868B] shrink-0" />
                    <span className="leading-none">
                      انتشار: {dateStr}
                      {ad.last_boosted_at && ` • بروزشده`}
                    </span>
                  </span>

                  <span className="inline-flex items-center gap-1.5 leading-none">
                    <Eye size={14} strokeWidth={2} className="block text-[#86868B] shrink-0" />
                    <span className="leading-none">{ad.views_count || 1} بازدید</span>
                  </span>

                  {ad.reference_number && (
                    <span className="inline-flex items-center gap-1 leading-none text-[#86868B]">
                      <span className="leading-none">کد:</span>
                      <bdi className="font-mono font-semibold leading-none text-[#6E6E73] dark:text-[#98989F]">{ad.reference_number}</bdi>
                    </span>
                  )}
                </div>
              </div>

              {/* Description Section (Integrated Smoothly on Exact Same Visual Plane) */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold text-[#86868B] dark:text-[#98989F]">
                  توضیحات و مشخصات
                </h3>
                <div className="text-sm sm:text-[15px] text-[#1D1D1F] dark:text-[#E5E5EA] leading-relaxed sm:leading-loose whitespace-pre-wrap">
                  {ad.description}
                </div>
              </div>

              {/* Contact Seller Section (Flat, Integrated Flow — No "Card on Card") */}
              <div className="pt-6 border-t border-[#F0F2F5] dark:border-white/[0.025] flex flex-col items-center text-center space-y-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-extrabold text-[#1D1D1F] dark:text-white">اطلاعات تماس با آگهی‌دهنده</h3>
                  {ad.contact_name && (
                    <p className="text-xs text-[#6E6E73] dark:text-[#98989F]">
                      ثبت‌شده توسط <span className="font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">{ad.contact_name}</span>
                    </p>
                  )}
                </div>

                {!contactRevealed ? (
                  <div className="w-full max-w-md flex flex-col items-center text-center space-y-3.5 pt-1">
                    {!showTurnstileGate ? (
                      <>
                        <p className="text-xs text-[#6E6E73] dark:text-[#98989F]">
                          برای جلوگیری از ربات‌ها، راه‌های ارتباطی پس از کلیک نمایش داده می‌شود
                        </p>

                        <button
                          type="button"
                          onClick={() => {
                            if (turnstileSettings?.enabled === false) {
                              setContactRevealed(true);
                            } else {
                              setShowTurnstileGate(true);
                            }
                          }}
                          className="h-10 px-6 rounded-full bg-[#0066CC] hover:bg-[#0055AA] text-white text-xs sm:text-[13px] font-bold inline-flex items-center justify-center gap-2 transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.96] shadow-none cursor-pointer"
                        >
                          <Lock size={15} />
                          <span>نمایش اطلاعات تماس</span>
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center space-y-2.5 py-1 animate-in fade-in duration-200">
                        <p className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                          تایید امنیتی جهت نمایش اطلاعات تماس
                        </p>
                        <CloudflareTurnstile
                          theme="auto"
                          mode={turnstileSettings?.mode}
                          siteKey={turnstileSettings?.siteKey}
                          onVerify={() => setContactRevealed(true)}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full flex flex-col items-center justify-center space-y-3.5 animate-in fade-in duration-200">
                    <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
                      {/* Phone */}
                      {ad.contact_phone && (
                        <a
                          href={`tel:${ad.contact_phone.replace(/[^0-9+]/g, '')}`}
                          title="تماس تلفنی"
                          className="h-10 px-4 rounded-full bg-[#0066CC] hover:bg-[#0055AA] text-white text-xs font-bold inline-flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.96] shadow-none"
                        >
                          <Phone size={15} />
                          <bdi className="font-mono tracking-wide">{ad.contact_phone}</bdi>
                        </a>
                      )}

                      {/* WhatsApp */}
                      {ad.contact_whatsapp && (
                        <a
                          href={`https://wa.me/${ad.contact_whatsapp.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="پیام در واتساپ"
                          className="h-10 px-4 rounded-full bg-[#F5F5F7] dark:bg-white/[0.05] hover:bg-[#EBEBF0] dark:hover:bg-white/[0.08] text-[#1D1D1F] dark:text-[#F5F5F7] border border-[#ECEFF4] dark:border-white/[0.03] text-xs font-semibold inline-flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.96] shadow-none"
                        >
                          <MessageSquare size={15} className="text-[#6E6E73] dark:text-[#98989F]" />
                          <span>واتساپ</span>
                        </a>
                      )}

                      {/* Telegram */}
                      {ad.contact_telegram && (
                        <a
                          href={/^https?:\/\//i.test(ad.contact_telegram.trim()) ? ad.contact_telegram.trim() : `https://t.me/${ad.contact_telegram.trim().replace(/^@/, '').replace(/[^a-zA-Z0-9_]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="گفتگو در تلگرام"
                          className="h-10 px-4 rounded-full bg-[#F5F5F7] dark:bg-white/[0.05] hover:bg-[#EBEBF0] dark:hover:bg-white/[0.08] text-[#1D1D1F] dark:text-[#F5F5F7] border border-[#ECEFF4] dark:border-white/[0.03] text-xs font-semibold inline-flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.96] shadow-none"
                        >
                          <Send size={15} className="text-[#6E6E73] dark:text-[#98989F]" />
                          <span>تلگرام</span>
                        </a>
                      )}

                      {/* Email */}
                      {ad.contact_email && (
                        <a
                          href={`mailto:${ad.contact_email}?subject=پرسش درباره آگهی ${ad.reference_number}`}
                          title="ارسال ایمیل"
                          className="h-10 px-4 rounded-full bg-[#F5F5F7] dark:bg-white/[0.05] hover:bg-[#EBEBF0] dark:hover:bg-white/[0.08] text-[#1D1D1F] dark:text-[#F5F5F7] border border-[#ECEFF4] dark:border-white/[0.03] text-xs font-semibold inline-flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.96] shadow-none"
                        >
                          <Mail size={15} className="text-[#6E6E73] dark:text-[#98989F]" />
                          <span>ایمیل</span>
                        </a>
                      )}

                      {/* Website URL */}
                      {ad.contact_website && (() => {
                        const raw = ad.contact_website.trim();
                        if (/^(javascript|data|vbscript):/i.test(raw)) return null;
                        const safeHref = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
                        return (
                          <a
                            href={safeHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="مشاهده وب‌سایت"
                            className="h-10 px-4 rounded-full bg-[#F5F5F7] dark:bg-white/[0.05] hover:bg-[#EBEBF0] dark:hover:bg-white/[0.08] text-[#1D1D1F] dark:text-[#F5F5F7] border border-[#ECEFF4] dark:border-white/[0.03] text-xs font-semibold inline-flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.96] shadow-none"
                          >
                            <Globe size={15} className="text-[#6E6E73] dark:text-[#98989F]" />
                            <span>وب‌سایت</span>
                          </a>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {/* Safety Notice & Report Abuse Section */}
              <div className="pt-5 border-t border-[#F0F2F5] dark:border-white/[0.025] space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-[#6E6E73] dark:text-[#98989F]">
                    <ShieldCheck size={16} className="text-[#86868B] shrink-0" />
                    <span>قبل از هرگونه پرداخت، کالا یا مسکن را حضوری بررسی کنید.</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setReportOpen((v) => !v)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#F5F5F7] dark:bg-white/[0.05] hover:bg-[#EBEBF0] dark:hover:bg-white/[0.08] text-[#6E6E73] hover:text-[#1D1D1F] dark:text-[#98989F] dark:hover:text-white text-[11px] font-bold shrink-0 transition-colors cursor-pointer border border-[#ECEFF4] dark:border-white/[0.03] shadow-none"
                  >
                    <Flag size={12} className="text-[#86868B]" />
                    <span>گزارش آگهی</span>
                  </button>
                </div>

                {reportOpen && (
                  <div className="pt-3 border-t border-[#F0F2F5] dark:border-white/[0.025] space-y-2.5">
                    {reportSent ? (
                      <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                        گزارش شما با موفقیت برای بررسی مدیر ارسال شد. با تشکر از همکاری شما.
                      </p>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <select
                            value={reportReason}
                            onChange={(e) => setReportReason(e.target.value)}
                            className="h-9 rounded-xl border border-[#ECEFF4] dark:border-white/[0.08] bg-[#FBFBFC] dark:bg-[#1C202A] px-3 text-xs font-semibold text-[#1D1D1F] dark:text-white focus:outline-none"
                          >
                            <option value="محتوای غیرمجاز یا نامناسب">محتوای غیرمجاز یا نامناسب</option>
                            <option value="کلاهبرداری یا آگهی جعلی">کلاهبرداری یا آگهی جعلی</option>
                            <option value="اسپم یا آگهی تکراری">اسپم یا آگهی تکراری</option>
                            <option value="سایر موارد">سایر موارد</option>
                          </select>
                          <input
                            type="text"
                            value={reportDetails}
                            onChange={(e) => setReportDetails(e.target.value)}
                            placeholder="توضیح کوتاه (اختیاری)..."
                            className="h-9 rounded-xl border border-[#ECEFF4] dark:border-white/[0.08] bg-[#FBFBFC] dark:bg-[#1C202A] px-3 text-xs text-[#1D1D1F] dark:text-white focus:outline-none"
                          />
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setReportOpen(false)}
                            className="h-8 px-3 rounded-full text-xs font-semibold text-[#6E6E73] hover:text-[#1D1D1F] dark:text-[#98989F] dark:hover:text-white cursor-pointer"
                          >
                            انصراف
                          </button>
                          <button
                            type="button"
                            disabled={reportSending}
                            onClick={async () => {
                              setReportSending(true);
                              try {
                                await publicApi.reportAd({
                                  id: ad.id,
                                  reference_number: ad.reference_number,
                                  title: ad.title,
                                  reason: reportReason,
                                  details: reportDetails,
                                });
                                setReportSent(true);
                              } catch {}
                              setReportSending(false);
                            }}
                            className="h-8 px-4 rounded-full bg-[#0066CC] hover:bg-[#0055AA] disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer shadow-none"
                          >
                            {reportSending ? 'در حال ارسال...' : 'ارسال گزارش'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

            </div>

          </main>

          {/* SIDEBAR: 4 VIP PROMOTED ADS & MONETIZATION SLOTS (4 cols on Desktop) */}
          <aside className="lg:col-span-4 lg:sticky lg:top-32 space-y-5">
            
            {/* VIP Sponsored Ads List (Flat Unified Card, Hairline Dividers) */}
            <div className="bg-[#FBFBFC] dark:bg-[#14161C] rounded-2xl sm:rounded-3xl border border-[#F0F2F5] dark:border-white/[0.025] overflow-hidden shadow-none">
              
              <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-[#F0F2F5] dark:border-white/[0.025]">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F5F5F7] dark:bg-white/[0.05] text-[#6E6E73] dark:text-[#98989F]">
                    <Crown size={15} />
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold text-[#1D1D1F] dark:text-white">آگهی‌های ویژه {adCountryName}</h2>
                    <p className="text-[10px] text-[#86868B] dark:text-[#98989F] font-medium">برگزیده‌های ویژه در {adCountryName}</p>
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded-full bg-[#0066CC]/10 text-[#0066CC] text-[10px] font-bold">
                  VIP {adCountryName}
                </span>
              </div>

              {/* Flat Hairline-Divided Rows */}
              <div className="divide-y divide-[#F0F2F5] dark:divide-white/[0.025]">
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
                      className="group flex items-center gap-3.5 px-4 sm:px-5 py-3.5 hover:bg-[#F5F5F7]/80 dark:hover:bg-white/[0.04] active:bg-[#EBEBF0] transition-colors cursor-pointer"
                    >
                      {/* Clean Thumbnail */}
                      <div className="relative h-16 w-20 rounded-xl overflow-hidden shrink-0 bg-[#F5F5F7] dark:bg-white/[0.05] border border-[#F0F2F5] dark:border-white/[0.025]">
                        <img
                          src={vipCover}
                          alt={vipAd.title}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>

                      {/* Content */}
                      <div className="flex-1 flex flex-col justify-between min-w-0 gap-1.5">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-semibold text-[#86868B] dark:text-[#98989F] block truncate">
                            {vipCat?.fa || vipAd.category}
                          </span>
                          <h4 className="text-xs font-bold text-[#1D1D1F] dark:text-white group-hover:text-[#0066CC] transition-colors line-clamp-1 leading-snug">
                            {vipAd.title_fa || vipAd.title}
                          </h4>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums">
                            {vipPrice}
                          </span>
                          <span className="text-[10px] text-[#86868B] dark:text-[#98989F] flex items-center gap-0.5">
                            <MapPin size={9} className="text-[#86868B]" />
                            {vipAd.city}
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

            </div>

            {/* Monetization Promotion CTA Card (Unified Surface, Zero Box Shadow) */}
            <div className="bg-[#FBFBFC] dark:bg-[#14161C] rounded-2xl sm:rounded-3xl border border-[#F0F2F5] dark:border-white/[0.025] p-5 space-y-3.5 shadow-none">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F5F5F7] dark:bg-white/[0.05] text-[#6E6E73] dark:text-[#98989F]">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#1D1D1F] dark:text-white">آگهی شما در صدر {adCountryName} دیده شود!</h3>
                  <p className="text-[10px] text-[#86868B] dark:text-[#98989F]">جذب ۳ برابری مشتریان و بازدیدکنندگان در {adCountryName}</p>
                </div>
              </div>

              <p className="text-xs text-[#6E6E73] dark:text-[#98989F] leading-relaxed">
                با ارتقا به آگهی ویژه (VIP)، آگهی شما در بخش ویژه و بالای فهرست جستجوی فارسی‌زبانان در سراسر {adCountryName} نمایش داده می‌شود.
              </p>

              <button
                type="button"
                onClick={() => onOpenPromote?.(ad)}
                className="w-full h-10 rounded-full bg-[#0066CC] hover:bg-[#0055AA] text-white text-xs font-bold active:scale-[0.97] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-none"
              >
                <Crown size={15} className="text-white/90" />
                <span>{isVipActive ? `تمدید یا تغییر کشور ویژه (${adCountryName})` : `ارتقا و ویژه کردن در ${adCountryName}`}</span>
              </button>
            </div>

          </aside>

        </div>
      </div>

      {/* Light Apple-Style Clean Photo Modal (Native Pinch-Zoom & Scroll) */}
      {zoomOpen && (
        <div
          className="fixed inset-0 z-[70] bg-[#F5F5F7] flex flex-col select-none font-vazir"
          dir="rtl"
        >
          {/* Clean Top Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 h-14 bg-[#FBFBFC] border-b border-[#E5E5EA] shrink-0">
            <button
              type="button"
              onClick={() => setZoomOpen(false)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#ECECEF] hover:bg-[#E2E2E7] text-[#1D1D1F] text-xs font-bold transition-colors cursor-pointer"
            >
              <X size={15} />
              <span>بستن</span>
            </button>

            {images.length > 1 ? (
              <span className="px-3 py-1 rounded-full bg-[#F5F5F7] border border-[#E5E5EA] text-[#515154] text-xs font-semibold font-mono">
                {activeImageIdx + 1} / {images.length}
              </span>
            ) : (
              <span className="text-xs font-semibold text-[#6E6E73]">نمای کامل تصویر</span>
            )}

            <button
              type="button"
              onClick={() => {
                if (zoomed) {
                  resetPhotoZoom();
                } else {
                  applyPhotoTransform(2.2, 0, 0, true);
                }
              }}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#ECECEF] hover:bg-[#E2E2E7] text-[#1D1D1F] text-xs font-bold transition-colors cursor-pointer"
            >
              <ZoomIn size={14} />
              <span>{zoomed ? 'نمای عادی' : 'بزرگنمایی'}</span>
            </button>
          </div>

          {/* Photo-Only Pinch-Zoom & Pan Stage (Site UI never zooms) */}
          <div
            ref={stageRef}
            onWheel={(e) => {
              e.preventDefault();
              const delta = e.deltaY < 0 ? 0.3 : -0.3;
              applyPhotoTransform(
                zoomStateRef.current.scale + delta,
                zoomStateRef.current.x,
                zoomStateRef.current.y,
                false
              );
            }}
            className="relative flex-1 overflow-hidden flex items-center justify-center p-3 sm:p-6 touch-none"
          >
            <img
              ref={zoomImgRef}
              src={images[activeImageIdx]}
              alt={ad.title}
              draggable={false}
              onClick={() => {
                if (zoomStateRef.current.scale > 1.05) {
                  resetPhotoZoom();
                } else {
                  applyPhotoTransform(2.2, 0, 0, true);
                }
              }}
              className={`max-h-[78vh] max-w-[94vw] object-contain rounded-2xl will-change-transform ${
                zoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'
              }`}
            />

            {images.length > 1 && !zoomed && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setActiveImageIdx((prev) => (prev > 0 ? prev - 1 : images.length - 1));
                    resetPhotoZoom();
                  }}
                  className="flex fixed start-3 sm:start-6 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-[#FBFBFC] hover:bg-[#ECECEF] text-[#1D1D1F] border border-[#E5E5EA] shadow-md items-center justify-center transition-colors cursor-pointer"
                >
                  <ChevronRight size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveImageIdx((prev) => (prev < images.length - 1 ? prev + 1 : 0));
                    resetPhotoZoom();
                  }}
                  className="flex fixed end-3 sm:end-6 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-[#FBFBFC] hover:bg-[#ECECEF] text-[#1D1D1F] border border-[#E5E5EA] shadow-md items-center justify-center transition-colors cursor-pointer"
                >
                  <ChevronLeft size={20} />
                </button>
              </>
            )}
          </div>

          {/* Clean Bottom Thumbnail Strip */}
          {images.length > 1 && (
            <div className="px-4 py-3 bg-[#FBFBFC] border-t border-[#E5E5EA] flex items-center justify-center gap-2 overflow-x-auto no-scrollbar shrink-0">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setActiveImageIdx(idx);
                    resetPhotoZoom();
                  }}
                  className={`h-12 w-16 rounded-xl overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                    activeImageIdx === idx
                      ? 'border-[#0066CC] ring-2 ring-[#0066CC]/20 scale-105 opacity-100'
                      : 'border-[#E5E5EA] opacity-60 hover:opacity-100'
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
