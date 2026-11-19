import React, { useState, useEffect } from 'react';
import { MapPin, Hand } from 'lucide-react';

export default function GoogleMapEmbed({
  embedUrl,
  title = 'موقعیت مکانی روی نقشه گوگل',
  heightClass = 'h-[210px] sm:h-[220px]',
  deferForLcp = false,
  mobileScrollGuard = false,
  className = '',
}) {
  const [loadedUrl, setLoadedUrl] = useState('');
  const [readyToMount, setReadyToMount] = useState(!deferForLcp);
  const [mobileInteractive, setMobileInteractive] = useState(false);

  const isLoaded = Boolean(embedUrl && loadedUrl === embedUrl);

  useEffect(() => {
    if (!deferForLcp || readyToMount) return undefined;
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(() => setReadyToMount(true), { timeout: 220 });
      return () => window.cancelIdleCallback(idleId);
    }
    const timer = setTimeout(() => setReadyToMount(true), 150);
    return () => clearTimeout(timer);
  }, [deferForLcp, readyToMount]);

  if (!embedUrl) return null;

  return (
    <div
      className={`relative w-full ${heightClass} bg-[#F5F5F7] dark:!bg-[#1A1D25] overflow-hidden ${className}`}
    >
      {/* Fixed-height skeleton prevents layout shift (CLS = 0) */}
      {!isLoaded && (
        <div
          aria-hidden="true"
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#86868B] dark:!text-[#98989F] animate-pulse pointer-events-none"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ECECEF] dark:!bg-white/[0.06]">
            <MapPin className="w-4 h-4 block shrink-0 text-[#0066CC]" strokeWidth={2} />
          </div>
          <span className="text-[11px] font-semibold leading-none">در حال بارگذاری نقشه گوگل...</span>
        </div>
      )}

      {readyToMount && (
        <iframe
          key={embedUrl}
          title={title}
          src={embedUrl}
          loading="lazy"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => setLoadedUrl(embedUrl)}
          className={`w-full h-full border-0 transition-opacity duration-300 ${
            isLoaded ? 'opacity-100 dark:opacity-95' : 'opacity-0'
          }`}
        />
      )}

      {/* Mobile Scroll-Trap Guard: prevents iframe hijacking vertical page swipes until tapped */}
      {mobileScrollGuard && !mobileInteractive && (
        <button
          type="button"
          onClick={() => setMobileInteractive(true)}
          aria-label="فعال‌سازی جابه‌جایی نقشه"
          className="lg:hidden absolute inset-0 z-10 flex items-end justify-start p-2.5 bg-transparent cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]"
        >
          <span className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full bg-[#1D1D1F]/75 backdrop-blur-xs text-white text-[10.5px] font-bold leading-none shadow-xs">
            <Hand className="w-3 h-3 block shrink-0" strokeWidth={2} aria-hidden="true" />
            <span className="leading-none">لمس برای جابه‌جایی نقشه</span>
          </span>
        </button>
      )}
    </div>
  );
}
