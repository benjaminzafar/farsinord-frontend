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
  const [zoomed, setZoomed] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('محتوای غیرمجاز یا نامناسب');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSending, setReportSending] = useState(false);
  const [reportSent, setReportSent] = useState(false);
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
              {copiedLink ? <Check size={14} className="text-[#86868B]" /> : <Share2 size={14} />}
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
            <div className="bg-[#FBFBFC] rounded-2xl sm:rounded-3xl border border-[#E5E5EA] p-3 sm:p-5 overflow-hidden space-y-3">
              {/* Big Stage Image (click to zoom) */}
              <div className="relative aspect-[16/10] sm:aspect-[16/9] w-full rounded-xl sm:rounded-2xl overflow-hidden bg-slate-950 group">
                <img
                  src={images[activeImageIdx]}
                  alt={ad.title}
                  onClick={() => {
                    zoomStateRef.current = { scale: 1, x: 0, y: 0 };
                    setZoomed(false);
                    setZoomOpen(true);
                  }}
                  className="w-full h-full object-contain sm:object-cover cursor-zoom-in transition-transform duration-300 group-hover:scale-[1.015]"
                />

                {/* Subtle Circular Zoom Button */}
                <button
                  type="button"
                  onClick={() => {
                    zoomStateRef.current = { scale: 1, x: 0, y: 0 };
                    setZoomed(false);
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
                    <Crown size={13} className="text-white/80" />
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
            <div className="bg-[#FBFBFC] rounded-2xl sm:rounded-3xl border border-[#E5E5EA] p-5 sm:p-7 space-y-5">
              
              {/* Header: Title & Price */}
              <div className="space-y-3 pb-5 border-b border-[#E5E5EA]">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-[#1D1D1F] leading-snug">
                    {lang === 'fa' && ad.title_fa ? ad.title_fa : ad.title}
                  </h1>
                  
                  {/* Price Clean Display */}
                  <div className="text-right sm:text-left shrink-0 pt-0.5">
                    <span className="text-2xl sm:text-3xl font-black text-[#0066CC] tabular-nums tracking-tight">
                      <bdi>{displayPrice}</bdi>
                    </span>
                  </div>
                </div>

                {/* Meta info tags */}
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold">
                    <MapPin size={13} className="text-[#86868B] shrink-0" />
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
              <div className="space-y-2.5 pt-1">
                <h3 className="text-sm font-bold text-[#1D1D1F] flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#0066CC]" />
                  <span>توضیحات و مشخصات کامل</span>
                </h3>
                <div className="text-sm sm:text-base text-[#1D1D1F]/85 leading-relaxed sm:leading-loose whitespace-pre-wrap">
                  {ad.description}
                </div>
              </div>

              {/* Contact Seller Action Buttons (Hidden & Protected with Cloudflare Turnstile) */}
              <div className="pt-5 border-t border-[#E5E5EA] space-y-3">
                <h3 className="text-sm font-bold text-[#1D1D1F]">راه‌های ارتباط با آگهی‌دهنده:</h3>

                {!contactRevealed ? (
                  <div className="pt-1 space-y-3.5">
                    {!showTurnstileGate ? (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F5F5F7] text-[#6E6E73]">
                            <Lock size={17} />
                          </div>
                          <div>
                            <p className="text-xs sm:text-[13px] font-bold text-[#1D1D1F]">
                              اطلاعات تماس برای جلوگیری از ربات‌ها محافظت شده است
                            </p>
                            <p className="text-[11px] text-[#86868B]">
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
                          className="h-11 px-5 rounded-full bg-[#0066CC] hover:bg-[#0055AA] text-white text-xs sm:text-[13px] font-bold inline-flex items-center justify-center gap-2 transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.94] cursor-pointer shrink-0"
                        >
                          <ShieldCheck size={16} />
                          <span>مشاهده اطلاعات تماس</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center space-y-2.5 py-2 animate-in fade-in duration-200">
                        <p className="text-xs font-bold text-[#1D1D1F]">
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
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Phone (Circle Icon Only) */}
                      {ad.contact_phone && (
                        <a
                          href={`tel:${ad.contact_phone.replace(/[^0-9+]/g, '')}`}
                          title="تماس مستقیم"
                          aria-label="تماس مستقیم"
                          className="h-12 w-12 rounded-full bg-[#0066CC] hover:bg-[#0055AA] text-white flex items-center justify-center shadow-sm transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.90]"
                        >
                          <Phone size={19} />
                        </a>
                      )}

                      {/* WhatsApp (Circle Icon Only) */}
                      {ad.contact_whatsapp && (
                        <a
                          href={`https://wa.me/${ad.contact_whatsapp.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="پیام در واتساپ"
                          aria-label="پیام در واتساپ"
                          className="h-12 w-12 rounded-full bg-[#25D366] hover:bg-[#20ba59] text-white flex items-center justify-center shadow-sm transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.90]"
                        >
                          <MessageSquare size={19} />
                        </a>
                      )}

                      {/* Telegram (Circle Icon Only) */}
                      {ad.contact_telegram && (
                        <a
                          href={/^https?:\/\//i.test(ad.contact_telegram.trim()) ? ad.contact_telegram.trim() : `https://t.me/${ad.contact_telegram.trim().replace(/^@/, '').replace(/[^a-zA-Z0-9_]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="گفتگو در تلگرام"
                          aria-label="گفتگو در تلگرام"
                          className="h-12 w-12 rounded-full bg-[#229ED9] hover:bg-[#1e8ec3] text-white flex items-center justify-center shadow-sm transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.90]"
                        >
                          <Send size={19} />
                        </a>
                      )}

                      {/* Email (Circle Icon Only) */}
                      {ad.contact_email && (
                        <a
                          href={`mailto:${ad.contact_email}?subject=پرسش درباره آگهی ${ad.reference_number}`}
                          title="ارسال ایمیل"
                          aria-label="ارسال ایمیل"
                          className="h-12 w-12 rounded-full bg-[#1D1D1F] hover:bg-[#3A3A3C] text-white flex items-center justify-center shadow-sm transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.90]"
                        >
                          <Mail size={19} />
                        </a>
                      )}

                      {/* Website URL (Circle Icon Only) */}
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
                            aria-label="مشاهده وب‌سایت"
                            className="h-12 w-12 rounded-full bg-[#F5F5F7] hover:bg-[#ECECEF] text-[#1D1D1F] border border-[#D2D2D7] flex items-center justify-center shadow-sm transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.90]"
                          >
                            <Globe size={19} />
                          </a>
                        );
                      })()}
                    </div>

                    {ad.contact_name && (
                      <p className="text-xs text-slate-500 pt-1 text-center sm:text-right">
                        نام آگهی‌دهنده: <span className="font-semibold text-slate-800">{ad.contact_name}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Safety Notice & Report Abuse Section */}
              <div className="pt-5 border-t border-[#E5E5EA] space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <ShieldCheck size={18} className="text-[#86868B] shrink-0 mt-0.5" />
                    <div className="space-y-0.5 text-xs">
                      <h4 className="font-bold text-[#1D1D1F]">راهنمای معامله امن</h4>
                      <p className="leading-relaxed text-[#6E6E73]">
                        همیشه قبل از واریز هرگونه بیعانه یا وجه، کالا یا مسکن را شخصاً بررسی فرمایید و از قراردادهای رسمی استفاده کنید.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setReportOpen((v) => !v)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#F5F5F7] hover:bg-rose-50 text-rose-700 text-[11px] font-bold shrink-0 transition-colors cursor-pointer"
                  >
                    <Flag size={12} />
                    <span>گزارش تخلف</span>
                  </button>
                </div>

                {reportOpen && (
                  <div className="pt-3 border-t border-[#E5E5EA] space-y-2.5">
                    {reportSent ? (
                      <p className="text-xs font-bold text-emerald-700">
                        گزارش شما با موفقیت برای بررسی مدیر ارسال شد. با تشکر از همکاری شما.
                      </p>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <select
                            value={reportReason}
                            onChange={(e) => setReportReason(e.target.value)}
                            className="h-9 rounded-xl border border-amber-200 bg-white px-3 text-xs font-semibold text-slate-800 focus:outline-none"
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
                            className="h-9 rounded-xl border border-amber-200 bg-white px-3 text-xs text-slate-800 focus:outline-none"
                          />
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setReportOpen(false)}
                            className="h-8 px-3 rounded-full text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
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
                            className="h-8 px-4 rounded-full bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer"
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
            
            {/* VIP Sponsored Ads List */}
            <div className="bg-[#FBFBFC] rounded-2xl sm:rounded-3xl border border-[#E5E5EA] overflow-hidden">
              
              <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-[#E5E5EA]">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F5F5F7] text-[#6E6E73]">
                    <Crown size={15} />
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold text-[#1D1D1F]">آگهی‌های ویژه و برگزیده</h2>
                    <p className="text-[10px] text-[#86868B] font-medium">۴ جایگاه اسپانسر شده (VIP)</p>
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded-full bg-[#0066CC]/10 text-[#0066CC] text-[10px] font-bold">
                  اسپانسر
                </span>
              </div>

              {/* Flat Hairline-Divided Rows */}
              <div className="divide-y divide-[#E5E5EA]">
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
                      className="group flex items-center gap-3.5 px-4 sm:px-5 py-3.5 hover:bg-[#F5F5F7] active:bg-[#EBEBF0] transition-colors cursor-pointer"
                    >
                      {/* Clean Thumbnail */}
                      <div className="relative h-16 w-20 rounded-xl overflow-hidden shrink-0 bg-[#F5F5F7]">
                        <img
                          src={vipCover}
                          alt={vipAd.title}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>

                      {/* Content */}
                      <div className="flex-1 flex flex-col justify-between min-w-0 gap-1.5">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-semibold text-[#86868B] block truncate">
                            {vipCat?.fa || vipAd.category}
                          </span>
                          <h4 className="text-xs font-bold text-[#1D1D1F] group-hover:text-[#0066CC] transition-colors line-clamp-1 leading-snug">
                            {vipAd.title_fa || vipAd.title}
                          </h4>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-[#1D1D1F] tabular-nums">
                            {vipPrice}
                          </span>
                          <span className="text-[10px] text-[#86868B] flex items-center gap-0.5">
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

            {/* Monetization Promotion CTA Card */}
            <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white rounded-2xl sm:rounded-3xl p-5 shadow-lg border border-slate-800 space-y-3.5 relative overflow-hidden">
              <div className="absolute -end-8 -top-8 w-28 h-28 bg-blue-500/20 rounded-full blur-2xl pointer-events-none" />
              
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white/70">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">آگهی شما اینجا دیده شود!</h3>
                  <p className="text-[10px] text-slate-300">جذب ۳ برابری مشتریان و بازدیدکنندگان</p>
                </div>
              </div>

              <p className="text-xs text-slate-200 leading-relaxed font-normal">
                با ارتقا به آگهی ویژه (VIP)، آگهی شما در بخش ویژه و بالای فهرست جستجوی تمام فارسی‌زبانان اسکاندیناوی نمایش داده می‌شود.
              </p>

              <button
                type="button"
                onClick={() => onOpenPromote?.(ad)}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white text-xs font-bold shadow-md hover:shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Crown size={15} className="text-white/80" />
                <span>ارتقا و ویژه کردن این آگهی (Stripe)</span>
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
              className={`max-h-[76vh] max-w-[94vw] object-contain rounded-2xl bg-[#FBFBFC] shadow-[0_12px_40px_rgba(29,29,31,0.10)] border border-[#E5E5EA] will-change-transform ${
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
