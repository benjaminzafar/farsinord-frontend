import React from 'react';
import { MapPin, Eye, Clock } from 'lucide-react';
import { CATEGORIES } from '../lib/translations';

export default React.memo(function AdCard({ ad, lang, onSelect }) {
  const catObj = CATEGORIES.find(c => c.id === ad.category);
  const catName = catObj ? (lang === 'fa' ? catObj.fa : catObj.sv) : ad.category;
  
  // Format price in clean Persian
  const displayPrice = ad.price
    ? `${Number(ad.price).toLocaleString('fa-IR')} ${!ad.price_type || ad.price_type === 'kr' ? 'کرون' : ad.price_type}`
    : (ad.price_type && ad.price_type !== 'kr' ? ad.price_type : 'توافقی');

  const coverImage = (ad.images && ad.images.length > 0 && ad.images[0])
    ? ad.images[0]
    : 'https://images.unsplash.com/photo-1582407947304-fd86f028f716?auto=format&fit=crop&w=800&q=80';

  const dateStr = new Date(ad.created_at).toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'sv-SE', {
    month: 'short',
    day: 'numeric'
  });

  return (
    <article
      onClick={() => onSelect(ad)}
      className="group relative flex flex-col bg-[#FBFBFC] rounded-xl sm:rounded-2xl border border-[#E5E5EA] shadow-[0_1px_3px_rgba(29,29,31,0.04)] sm:hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(29,29,31,0.08)] hover:border-[#D2D2D7] transition-all duration-200 cursor-pointer overflow-hidden active:scale-[0.99]"
    >
      {/* Thumbnail */}
      <div className="relative aspect-[4/3] sm:aspect-[16/10] w-full overflow-hidden bg-[#ECECEF]">
        <img
          src={coverImage}
          alt={ad.title}
          className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
          loading="lazy"
          decoding="async"
        />

        {/* Featured pill (Apple Calibrated Blue "ویژه") */}
        {ad.is_featured && (
          <div className="absolute top-1.5 start-1.5 sm:top-2 sm:start-2 rounded-lg bg-[#0066CC] text-[#FBFBFC] px-2 py-0.5 text-[9.5px] sm:text-[10.5px] font-bold shadow-2xs">
            {lang === 'fa' ? 'ویژه' : 'Utvald'}
          </div>
        )}

        {/* Category Pill */}
        <div className="absolute top-1.5 end-1.5 sm:top-2.5 sm:end-2.5 rounded-full bg-[#FBFBFC] px-1.5 sm:px-2.5 py-0.5 text-[9px] sm:text-[10.5px] font-semibold text-[#1D1D1F] shadow-xs border border-[#E5E5EA] max-w-[85px] sm:max-w-none truncate">
          {catName}
        </div>

        {/* City Pill */}
        <div className="absolute bottom-1.5 start-1.5 sm:bottom-2.5 sm:start-2.5 flex items-center gap-0.5 sm:gap-1 rounded-full bg-slate-950/80 px-2 sm:px-2.5 py-0.5 text-[9.5px] sm:text-[11px] font-medium text-slate-200 backdrop-blur-xs max-w-[90%] truncate">
          <MapPin size={10} className="text-blue-400 shrink-0" />
          <span className="truncate">{ad.city}{ad.area ? ` • ${ad.area}` : ''}</span>
        </div>
      </div>

      {/* Body details */}
      <div className="flex flex-1 flex-col p-2.5 sm:p-4 justify-between space-y-2 sm:space-y-3">
        <div className="space-y-1 sm:space-y-1.5">
          {/* Price */}
          <div className="flex items-center justify-between gap-1">
            <span className="text-[13px] sm:text-[16.5px] font-extrabold text-[#0066CC] tabular-nums tracking-tight truncate">
              <bdi>{displayPrice}</bdi>
            </span>
          </div>

          {/* Title */}
          <h3 className="text-[12px] sm:text-[14px] font-bold text-[#1D1D1F] group-hover:text-[#0066CC] transition-colors line-clamp-2 leading-snug">
            {lang === 'fa' && ad.title_fa ? ad.title_fa : ad.title}
          </h3>

          {/* Description */}
          <p className="text-[11px] sm:text-[12px] text-[#515154] line-clamp-1 sm:line-clamp-2 leading-relaxed">
            {ad.description}
          </p>
        </div>

        {/* Footer info */}
        <div className="pt-2 sm:pt-2.5 border-t border-[#ECECEF] flex items-center justify-between text-[9.5px] sm:text-[11px] text-[#6E6E73] tabular-nums">
          <div className="flex items-center gap-0.5 sm:gap-1 font-medium truncate">
            <Clock size={10} className="shrink-0" />
            <span className="truncate">{dateStr}</span>
          </div>
          <div className="flex items-center gap-0.5 sm:gap-1 font-medium shrink-0">
            <Eye size={10} className="shrink-0" />
            <span>{ad.views_count || 1} {lang === 'fa' ? 'بازدید' : 'visningar'}</span>
          </div>
        </div>
      </div>
    </article>
  );
});
