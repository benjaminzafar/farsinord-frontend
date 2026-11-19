import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, Plus, Minus, LocateFixed, Check, Search, Loader2 } from 'lucide-react';

export const CITY_COORDS = {
  // Sweden
  Stockholm: { lat: 59.3293, lng: 18.0686 },
  'Göteborg': { lat: 57.7089, lng: 11.9746 },
  'Malmö': { lat: 55.605, lng: 13.0038 },
  Uppsala: { lat: 59.8586, lng: 17.6389 },
  'Västerås': { lat: 59.6099, lng: 16.5448 },
  'Örebro': { lat: 59.2753, lng: 15.2134 },
  'Linköping': { lat: 58.4108, lng: 15.6214 },
  Helsingborg: { lat: 56.0465, lng: 12.6945 },
  'Jönköping': { lat: 57.7826, lng: 14.1618 },
  'Norrköping': { lat: 58.5877, lng: 16.1924 },
  Lund: { lat: 55.7047, lng: 13.191 },
  'Umeå': { lat: 63.8258, lng: 20.263 },
  'Gävle': { lat: 60.6749, lng: 17.1413 },
  'Borås': { lat: 57.721, lng: 12.9401 },
  'Södertälje': { lat: 59.1955, lng: 17.6253 },
  Eskilstuna: { lat: 59.3712, lng: 16.5098 },
  Karlstad: { lat: 59.3793, lng: 13.5036 },
  'Växjö': { lat: 56.879, lng: 14.8059 },
  Halmstad: { lat: 56.6745, lng: 12.8578 },
  Sundsvall: { lat: 62.3908, lng: 17.3069 },
  'Luleå': { lat: 65.5848, lng: 22.1567 },
  // Norway
  Oslo: { lat: 59.9139, lng: 10.7522 },
  Bergen: { lat: 60.3913, lng: 5.3221 },
  Trondheim: { lat: 63.4305, lng: 10.3951 },
  Stavanger: { lat: 58.97, lng: 5.7331 },
  Drammen: { lat: 59.744, lng: 10.2045 },
  'Tromsø': { lat: 69.6492, lng: 18.9553 },
  Kristiansand: { lat: 58.1599, lng: 8.0182 },
  Fredrikstad: { lat: 59.2181, lng: 10.9298 },
  Sandnes: { lat: 58.8524, lng: 5.7352 },
  'Lillestrøm': { lat: 59.956, lng: 11.0504 },
  'Ålesund': { lat: 62.4722, lng: 6.1495 },
  'Tønsberg': { lat: 59.2675, lng: 10.4076 },
  Moss: { lat: 59.434, lng: 10.6577 },
  'Bodø': { lat: 67.2804, lng: 14.4049 },
  Sandefjord: { lat: 59.1312, lng: 10.2167 },
  // Denmark
  'København': { lat: 55.6761, lng: 12.5683 },
  Aarhus: { lat: 56.1629, lng: 10.2039 },
  Odense: { lat: 55.4038, lng: 10.4024 },
  Aalborg: { lat: 57.0488, lng: 9.9217 },
  Esbjerg: { lat: 55.4765, lng: 8.4594 },
  Randers: { lat: 56.4607, lng: 10.0364 },
  Vejle: { lat: 55.7113, lng: 9.5364 },
  Kolding: { lat: 55.4904, lng: 9.4722 },
  Horsens: { lat: 55.8607, lng: 9.8503 },
  Roskilde: { lat: 55.6415, lng: 12.0803 },
  Herning: { lat: 56.1362, lng: 8.9766 },
  'Helsingør': { lat: 56.0361, lng: 12.6136 },
  Silkeborg: { lat: 56.1697, lng: 9.5451 },
  // Finland
  Helsinki: { lat: 60.1699, lng: 24.9384 },
  Espoo: { lat: 60.2055, lng: 24.6559 },
  Tampere: { lat: 61.4978, lng: 23.761 },
  Vantaa: { lat: 60.2934, lng: 25.0378 },
  Oulu: { lat: 65.0121, lng: 25.4651 },
  Turku: { lat: 60.4518, lng: 22.2666 },
  'Jyväskylä': { lat: 62.2426, lng: 25.7473 },
  Lahti: { lat: 60.9827, lng: 25.6612 },
  Kuopio: { lat: 62.8924, lng: 27.677 },
  Pori: { lat: 61.4851, lng: 21.7974 },
  Kouvola: { lat: 60.8679, lng: 26.7042 },
  Vaasa: { lat: 63.0951, lng: 21.6165 },
  Joensuu: { lat: 62.601, lng: 29.7636 },
  Lappeenranta: { lat: 61.0587, lng: 28.1887 },
  // Germany
  Berlin: { lat: 52.52, lng: 13.405 },
  Hamburg: { lat: 53.5511, lng: 9.9937 },
  'München': { lat: 48.1351, lng: 11.582 },
  'Köln': { lat: 50.9375, lng: 6.9603 },
  Frankfurt: { lat: 50.1109, lng: 8.6821 },
  Stuttgart: { lat: 48.7758, lng: 9.1829 },
  'Düsseldorf': { lat: 51.2277, lng: 6.7735 },
  Leipzig: { lat: 51.3397, lng: 12.3731 },
  Dortmund: { lat: 51.5136, lng: 7.4653 },
  Essen: { lat: 51.4556, lng: 7.0116 },
  Bremen: { lat: 53.0793, lng: 8.8017 },
  Dresden: { lat: 51.0504, lng: 13.7373 },
  Hannover: { lat: 52.3759, lng: 9.732 },
  'Nürnberg': { lat: 49.4521, lng: 11.0767 },
  Duisburg: { lat: 51.4344, lng: 6.7623 },
  Bochum: { lat: 51.4818, lng: 7.2162 },
  Wuppertal: { lat: 51.2562, lng: 7.1508 },
  Bielefeld: { lat: 52.0302, lng: 8.5325 },
  // Austria
  Wien: { lat: 48.2082, lng: 16.3738 },
  Graz: { lat: 47.0707, lng: 15.4395 },
  Linz: { lat: 48.3069, lng: 14.2858 },
  Salzburg: { lat: 47.8095, lng: 13.055 },
  Innsbruck: { lat: 47.2692, lng: 11.4041 },
  // Netherlands
  Amsterdam: { lat: 52.3676, lng: 4.9041 },
  Rotterdam: { lat: 51.9244, lng: 4.4777 },
  'Den Haag': { lat: 52.0705, lng: 4.3007 },
  Utrecht: { lat: 52.0907, lng: 5.1214 },
  Eindhoven: { lat: 51.4416, lng: 5.4697 },
  // France
  Paris: { lat: 48.8566, lng: 2.3522 },
  Lyon: { lat: 45.764, lng: 4.8357 },
  Marseille: { lat: 43.2965, lng: 5.3698 },
  Toulouse: { lat: 43.6047, lng: 1.4442 },
  Nice: { lat: 43.7102, lng: 7.262 },
};

const COUNTRY_FALLBACK_COORDS = {
  se: { lat: 59.3293, lng: 18.0686 },
  no: { lat: 59.9139, lng: 10.7522 },
  dk: { lat: 55.6761, lng: 12.5683 },
  fi: { lat: 60.1699, lng: 24.9384 },
  de: { lat: 52.52, lng: 13.405 },
  at: { lat: 48.2082, lng: 16.3738 },
  nl: { lat: 52.3676, lng: 4.9041 },
  fr: { lat: 48.8566, lng: 2.3522 },
};

export function getCityDefaultCoords(cityId, countryId = 'se') {
  if (cityId && CITY_COORDS[cityId]) return CITY_COORDS[cityId];
  return COUNTRY_FALLBACK_COORDS[countryId] || COUNTRY_FALLBACK_COORDS.se;
}

const TILE_SIZE = 256;
const MIN_ZOOM = 7;
const MAX_ZOOM = 17;

function latLngToWorldPx(lat, lng, zoom) {
  const scale = TILE_SIZE * 2 ** zoom;
  const x = ((lng + 180) / 360) * scale;
  const clampedLat = Math.max(-85.0511, Math.min(85.0511, lat));
  const rad = (clampedLat * Math.PI) / 180;
  const y = (0.5 - Math.log((1 + Math.sin(rad)) / (1 - Math.sin(rad))) / (4 * Math.PI)) * scale;
  return { x, y };
}

function worldPxToLatLng(x, y, zoom) {
  const scale = TILE_SIZE * 2 ** zoom;
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return {
    lat: Math.max(-85.0511, Math.min(85.0511, lat)),
    lng: ((lng + 540) % 360) - 180,
  };
}

export default function LocationMapPicker({
  lat,
  lng,
  zoom = 13,
  confirmed = false,
  searching = false,
  confirming = false,
  cityLabel = '',
  onChangeCoords,
  onChangeZoom,
  onConfirm,
  onUnconfirm,
  onSearchAddress,
  canSearchAddress = false,
}) {
  const containerRef = useRef(null);
  const dragRef = useRef(null);
  const [viewport, setViewport] = useState({ w: 480, h: 196 });
  const [isDragging, setIsDragging] = useState(false);
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false
  );

  // Track viewport size and document dark-mode class
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setViewport({ w: rect.width, h: rect.height });
      }
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(el);

    const mo = typeof MutationObserver !== 'undefined'
      ? new MutationObserver(() => {
          setIsDark(document.documentElement.classList.contains('dark'));
        })
      : null;
    if (mo) {
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    }
    return () => {
      ro?.disconnect();
      mo?.disconnect();
    };
  }, []);

  const centerWorld = latLngToWorldPx(lat, lng, zoom);
  const tlX = centerWorld.x - viewport.w / 2;
  const tlY = centerWorld.y - viewport.h / 2;

  const tileCount = 2 ** zoom;
  const minTx = Math.floor(tlX / TILE_SIZE) - 1;
  const maxTx = Math.floor((tlX + viewport.w) / TILE_SIZE) + 1;
  const minTy = Math.floor(tlY / TILE_SIZE) - 1;
  const maxTy = Math.floor((tlY + viewport.h) / TILE_SIZE) + 1;

  const tiles = [];
  const subs = ['a', 'b', 'c'];
  for (let tx = minTx; tx <= maxTx; tx++) {
    for (let ty = minTy; ty <= maxTy; ty++) {
      if (ty < 0 || ty >= tileCount) continue;
      const wrappedTx = ((tx % tileCount) + tileCount) % tileCount;
      const sub = subs[Math.abs(wrappedTx + ty) % 3];
      const stylePath = isDark ? 'dark_all' : 'rastertiles/voyager';
      tiles.push({
        key: `${zoom}-${tx}-${ty}-${isDark ? 'd' : 'l'}`,
        left: tx * TILE_SIZE - tlX,
        top: ty * TILE_SIZE - tlY,
        src: `https://${sub}.basemaps.cartocdn.com/${stylePath}/${zoom}/${wrappedTx}/${ty}.png`,
        fallbackSrc: `https://tile.openstreetmap.org/${zoom}/${wrappedTx}/${ty}.png`,
      });
    }
  }

  const handlePointerDown = useCallback(
    (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      if (e.target.closest('button')) return;
      e.currentTarget.setPointerCapture?.(e.pointerId);
      const startCenter = latLngToWorldPx(lat, lng, zoom);
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startWorldX: startCenter.x,
        startWorldY: startCenter.y,
        moved: false,
      };
      setIsDragging(true);
    },
    [lat, lng, zoom]
  );

  const handlePointerMove = useCallback(
    (e) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        drag.moved = true;
      }
      if (!drag.moved) return;
      const next = worldPxToLatLng(drag.startWorldX - dx, drag.startWorldY - dy, zoom);
      onChangeCoords?.({
        lat: Number(next.lat.toFixed(6)),
        lng: Number(next.lng.toFixed(6)),
      });
    },
    [zoom, onChangeCoords]
  );

  const handlePointerUp = useCallback(
    (e) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      dragRef.current = null;
      setIsDragging(false);

      // Tap / click moves pin directly to the tapped spot
      if (!drag.moved && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        const next = worldPxToLatLng(tlX + clickX, tlY + clickY, zoom);
        onChangeCoords?.({
          lat: Number(next.lat.toFixed(6)),
          lng: Number(next.lng.toFixed(6)),
        });
      }
    },
    [tlX, tlY, zoom, onChangeCoords]
  );

  const handleZoom = (delta) => {
    const nextZ = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + delta));
    onChangeZoom?.(nextZ);
  };

  return (
    <div className="rounded-2xl border border-[#E5E5EA] dark:border-white/[0.08] bg-[#F5F5F7] dark:bg-[#121317] overflow-hidden">
      {/* Interactive Tile Canvas */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="application"
        aria-label="نقشه انتخاب موقعیت آگهی"
        className={`relative h-[188px] sm:h-[212px] w-full overflow-hidden select-none touch-none ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        {/* Slippy Map Tiles */}
        <div className="absolute inset-0 pointer-events-none">
          {tiles.map((t) => (
            <img
              key={t.key}
              src={t.src}
              alt=""
              draggable={false}
              loading="eager"
              onError={(e) => {
                if (e.currentTarget.dataset.fb) return;
                e.currentTarget.dataset.fb = '1';
                e.currentTarget.src = t.fallbackSrc;
              }}
              style={{
                position: 'absolute',
                left: `${Math.round(t.left)}px`,
                top: `${Math.round(t.top)}px`,
                width: `${TILE_SIZE}px`,
                height: `${TILE_SIZE}px`,
              }}
              className="max-w-none select-none"
            />
          ))}
        </div>

        {/* Center Pin Marker */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
          <div className="relative -translate-y-4 flex flex-col items-center">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full shadow-lg border-2 border-white transition-all duration-200 ${
                confirmed
                  ? 'bg-emerald-600 text-white scale-105'
                  : isDragging
                    ? 'bg-[#0066CC] text-white -translate-y-1.5 scale-110'
                    : 'bg-[#0066CC] text-white'
              }`}
            >
              {confirmed ? <Check size={17} strokeWidth={2.75} /> : <MapPin size={17} strokeWidth={2.4} />}
            </div>
            <div
              className={`h-1.5 w-3 rounded-full bg-black/35 blur-[1px] transition-transform duration-200 ${
                isDragging ? 'scale-75 opacity-60' : 'scale-100'
              }`}
            />
          </div>
        </div>

        {/* Floating Top-Right Instruction Pill */}
        <div className="pointer-events-none absolute top-2.5 start-2.5 z-20">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/90 dark:bg-[#171920]/90 backdrop-blur-md border border-black/5 dark:border-white/[0.08] text-[10.5px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7] shadow-xs">
            <LocateFixed size={11} className="text-[#0066CC] dark:text-[#58A6FF] shrink-0" />
            <span>نقشه را جابه‌جا یا لمس کنید</span>
          </span>
        </div>

        {/* Zoom Controls (Top-Left in RTL) */}
        <div className="absolute top-2.5 end-2.5 z-20 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => handleZoom(1)}
            aria-label="بزرگ‌نمایی نقشه"
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/95 dark:bg-[#171920]/95 hover:bg-white dark:hover:bg-[#222530] text-[#1D1D1F] dark:text-[#F5F5F7] border border-black/10 dark:border-white/[0.1] shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            <Plus size={14} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            onClick={() => handleZoom(-1)}
            aria-label="کوچک‌نمایی نقشه"
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/95 dark:bg-[#171920]/95 hover:bg-white dark:hover:bg-[#222530] text-[#1D1D1F] dark:text-[#F5F5F7] border border-black/10 dark:border-white/[0.1] shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            <Minus size={14} strokeWidth={2.2} />
          </button>
        </div>

        {/* Subtle Attribution */}
        <div className="pointer-events-none absolute bottom-1.5 end-2 z-10 px-1.5 py-0.5 rounded bg-white/75 dark:bg-[#121317]/75 text-[9px] text-[#6E6E73] dark:text-[#98989F]" dir="ltr">
          © OpenStreetMap
        </div>
      </div>

      {/* Confirmation Action Bar */}
      <div className="px-3 py-2.5 bg-[#FBFBFC] dark:bg-[#171920] border-t border-[#E5E5EA] dark:border-white/[0.06] flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          {confirmed ? (
            <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-emerald-700 dark:text-emerald-400">
              <Check size={14} strokeWidth={2.5} className="shrink-0" />
              <span className="truncate">موقعیت دقیق روی نقشه تایید شد</span>
            </span>
          ) : (
            <span className="text-[11px] font-medium text-[#6E6E73] dark:text-[#A1A1A6] truncate">
              {cityLabel ? `محدوده ${cityLabel}` : 'پین را روی محل دقیق تنظیم کنید'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {canSearchAddress && !confirmed && (
            <button
              type="button"
              disabled={searching}
              onClick={onSearchAddress}
              className="h-8 px-2.5 rounded-full bg-[#F5F5F7] hover:bg-[#EBEBF0] dark:bg-white/[0.06] dark:hover:bg-white/[0.1] border border-[#E5E5EA] dark:border-white/[0.08] text-[11px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7] inline-flex items-center gap-1 transition-all active:scale-95 cursor-pointer disabled:opacity-60"
            >
              {searching ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
              <span>یافتن آدرس</span>
            </button>
          )}

          {confirmed ? (
            <button
              type="button"
              onClick={onUnconfirm}
              className="h-8 px-3 rounded-full bg-[#F5F5F7] hover:bg-[#EBEBF0] dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-[11px] font-bold text-[#515154] dark:text-[#A1A1A6] transition-all active:scale-95 cursor-pointer"
            >
              تغییر موقعیت
            </button>
          ) : (
            <button
              type="button"
              disabled={confirming}
              onClick={onConfirm}
              className="h-8 px-3.5 rounded-full bg-[#0066CC] hover:bg-[#0055AA] text-white text-[11px] font-bold inline-flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 cursor-pointer disabled:opacity-60"
            >
              {confirming ? <Loader2 size={12} className="animate-spin" /> : <Check size={13} strokeWidth={2.5} />}
              <span>تایید موقعیت روی نقشه</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
