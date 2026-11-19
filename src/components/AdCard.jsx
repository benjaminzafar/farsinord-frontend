import React from 'react';
import { MapPin, Eye, Clock } from 'lucide-react';
import { CATEGORIES } from '../lib/translations';

const IGNORED_EMPTY_PRICE_TYPES = new Set(['kr', '€', 'sek', 'nok', 'dkk', 'eur', 'usd', '$', 'کرون', 'یورو', 'توافقی']);
const CATEGORY_MAP = new Map(CATEGORIES.map((c) => [c.id, c]));
const FA_DATE_FMT = new Intl.DateTimeFormat('fa-IR', { month: 'short', day: 'numeric' });
const SV_DATE_FMT = new Intl.DateTimeFormat('sv-SE', { month: 'short', day: 'numeric' });
const FA_NUM_FMT = new Intl.NumberFormat('fa-IR');

export default React.memo(function AdCard({ ad, lang, onSelect, priority = false }) {
  const catObj = CATEGORY_MAP.get(ad.category);
  const catName = catObj ? (lang === 'fa' ? catObj.fa : catObj.sv) : ad.category;
  
  // Format price only if specified (or if user explicitly entered توافقی)
  const rawPriceType = String(ad.price_type || '').trim();
  const numericPrice = Number(ad.price);
  const hasExplicitUserTavafoghi =
    rawPriceType === 'توافقی_کاربر' ||
    /توافقی/.test(`${ad.title || ''} ${ad.title_fa || ''} ${ad.description || ''}`);
  const displayPrice = Number.isFinite(numericPrice) && numericPrice > 0
    ? `${FA_NUM_FMT.format(numericPrice)} ${!rawPriceType || rawPriceType === 'kr' || rawPriceType === 'توافقی' || rawPriceType === 'توافقی_کاربر' ? 'کرون' : rawPriceType}`
    : (hasExplicitUserTavafoghi
        ? 'توافقی'
        : (rawPriceType && !IGNORED_EMPTY_PRICE_TYPES.has(rawPriceType.toLowerCase()) ? rawPriceType : ''));

  const coverImage = (ad.images && ad.images.length > 0 && ad.images[0])
    ? ad.images[0]
    : 'https://images.unsplash.com/photo-1582407947304-fd86f028f716?auto=format&fit=crop&w=800&q=80';

  const createdTs = Date.parse(ad.created_at || '');
  const dateStr = Number.isFinite(createdTs)
    ? (lang === 'fa' ? FA_DATE_FMT : SV_DATE_FMT).format(new Date(createdTs))
    : '';

  const [renderNow] = React.useState(() => Date.now());
  const isVipActive = Boolean(
    ad.is_active_vip !== undefined
      ? ad.is_active_vip
      : (ad.is_featured && (!ad.promotion_expires_at || Date.parse(ad.promotion_expires_at) > renderNow))
  );

  return (
    <article
      onClick={() => onSelect(ad)}
      className="ad-card-perf group relative flex flex-col bg-[#FBFBFC] dark:bg-[#171920] rounded-xl sm:rounded-2xl border border-[#ECEFF4] dark:border-white/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:shadow-[0_10px_28px_rgba(15,23,42,0.07)] dark:hover:shadow-[0_10px_28px_rgba(0,0,0,0.38)] hover:border-[#D2D2D7] dark:hover:border-white/[0.14] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden active:scale-[0.99]"
    >
      {/* Thumbnail */}
      <div className="relative aspect-[4/3] sm:aspect-[16/10] w-full overflow-hidden bg-[#ECECEF] dark:bg-[#1E2028]">
        <img
          src={coverImage}
          alt={ad.title}
          width="400"
          height="300"
          className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
        />

        {/* Featured pill (Apple Calibrated Blue "ویژه") */}
        {isVipActive && (
          <div className="absolute top-2 start-2 sm:top-2.5 sm:start-2.5 h-5 sm:h-6 inline-flex items-center rounded-full bg-[#0066CC] text-[#FBFBFC] px-2 sm:px-2.5 text-[9.5px] sm:text-[10.5px] font-bold leading-none shadow-2xs">
            {lang === 'fa' ? 'ویژه' : 'Utvald'}
          </div>
        )}

        {/* Category Pill */}
        <div className="absolute top-2 end-2 sm:top-2.5 sm:end-2.5 h-5 sm:h-6 inline-flex items-center rounded-full bg-[#FBFBFC] dark:bg-[#171920] px-2 sm:px-2.5 text-[9.5px] sm:text-[10.5px] font-semibold leading-none text-[#1D1D1F] dark:text-[#F5F5F7] shadow-none border border-[#ECEFF4] dark:border-white/[0.06] max-w-[92px] sm:max-w-none truncate">
          <span className="truncate">{catName}</span>
        </div>

        {/* City Pill */}
        <div className="absolute bottom-1.5 start-1.5 sm:bottom-2.5 sm:start-2.5 inline-flex items-center gap-1 rounded-full bg-slate-950/80 px-2 sm:px-2.5 h-5 sm:h-6 text-[9.5px] sm:text-[11px] font-medium leading-none text-slate-200 backdrop-blur-xs max-w-[90%] truncate">
          <span className="flex h-3.5 w-3.5 items-center justify-center shrink-0">
            <MapPin size={11} strokeWidth={2} className="block text-[#86868B]" />
          </span>
          <span className="truncate leading-none">{ad.city}{ad.area ? ` • ${ad.area}` : ''}</span>
        </div>
      </div>

      {/* Body details */}
      <div className="flex flex-1 flex-col p-2.5 sm:p-4 justify-between space-y-2 sm:space-y-3">
        <div className="space-y-1 sm:space-y-1.5">
          {/* Price */}
          {displayPrice && (
            <div className="flex items-center justify-between gap-1">
              <span className="text-[13px] sm:text-[16.5px] font-extrabold text-[#0066CC] dark:text-[#388BFD] tabular-nums tracking-tight truncate">
                <bdi>{displayPrice}</bdi>
              </span>
            </div>
          )}

          {/* Title */}
          <h3 className="text-[12px] sm:text-[14px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7] group-hover:text-[#0066CC] dark:group-hover:text-[#388BFD] transition-colors line-clamp-2 leading-snug">
            {lang === 'fa' && ad.title_fa ? ad.title_fa : ad.title}
          </h3>

          {/* Description */}
          <p className="text-[11px] sm:text-[12px] text-[#515154] dark:text-[#A1A1A6] line-clamp-1 sm:line-clamp-2 leading-relaxed">
            {ad.description}
          </p>
        </div>

        {/* Footer info */}
        <div className="pt-2 sm:pt-2.5 border-t border-[#F0F2F5] dark:border-white/[0.03] flex items-center justify-between gap-2 text-[9.5px] sm:text-[11px] leading-none text-[#6E6E73] dark:text-[#98989F] tabular-nums">
          <div className="inline-flex items-center gap-1 font-medium min-w-0 truncate">
            <span className="flex h-3.5 w-3.5 items-center justify-center shrink-0">
              <Clock size={11} strokeWidth={2} className="block text-[#86868B]" />
            </span>
            <span className="truncate leading-none">{dateStr}</span>
          </div>
          <div className="inline-flex items-center gap-1 font-medium shrink-0">
            <span className="flex h-3.5 w-3.5 items-center justify-center shrink-0">
              <Eye size={11} strokeWidth={2} className="block text-[#86868B]" />
            </span>
            <span className="leading-none">{FA_NUM_FMT.format(ad.views_count || 1)} {lang === 'fa' ? 'بازدید' : 'visningar'}</span>
          </div>
        </div>
      </div>
    </article>
  );
});
