import React, { useState, useEffect } from 'react';
import { MapPin } from 'lucide-react';

export default function GoogleMapEmbed({
  embedUrl,
  title = 'نقشه',
  heightClass = 'h-[240px] sm:h-[260px]',
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
      className={`relative w-full ${heightClass} bg-[#ECECEF] overflow-hidden isolate [transform:translateZ(0)] ${className}`}
    >
      {/* Calm flat skeleton prevents layout shift (CLS = 0) */}
      {!isLoaded && (
        <div
          aria-hidden="true"
          className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-[#86868B] animate-pulse pointer-events-none"
        >
          <MapPin size={16} strokeWidth={1.75} className="block shrink-0" />
          <span className="text-[11px] font-semibold leading-none">بارگذاری نقشه...</span>
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
          className={`w-full h-full border-0 rounded-[inherit] transition-opacity duration-300 ${
            isLoaded ? 'opacity-100 dark:brightness-[0.9] dark:contrast-[1.05]' : 'opacity-0'
          }`}
        />
      )}

      {/* Mobile Scroll-Trap Guard: positioned top-start so it never collides with bottom floating dock */}
      {mobileScrollGuard && !mobileInteractive && (
        <button
          type="button"
          onClick={() => setMobileInteractive(true)}
          aria-label="جابه‌جایی نقشه"
          className="lg:hidden absolute inset-0 z-10 flex items-start justify-start p-3 bg-transparent cursor-pointer focus-visible:outline-none"
        >
          <span className="inline-flex items-center px-3 h-7 rounded-full bg-[#1D1D1F]/70 backdrop-blur-md text-white text-[11px] font-semibold leading-none">
            لمس برای حرکت
          </span>
        </button>
      )}
    </div>
  );
}
