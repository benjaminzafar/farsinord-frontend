import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, Plus, Minus, LocateFixed, Check, Loader2 } from 'lucide-react';

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
  confirming = false,
  cityLabel = '',
  resolvedArea = '',
  onChangeCoords,
  onChangeZoom,
  onConfirm,
  onUnconfirm,
}) {
  const containerRef = useRef(null);
  const dragRef = useRef(null);
  const [viewport, setViewport] = useState({ w: 480, h: 192 });
  const [isDragging, setIsDragging] = useState(false);
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false
  );

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

    const mo =
      typeof MutationObserver !== 'undefined'
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

  const handlePointerCancel = useCallback((e) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setIsDragging(false);
  }, []);

  const handleZoom = (delta) => {
    const nextZ = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + delta));
    onChangeZoom?.(nextZ);
  };

  return (
    <div
      className={`rounded-2xl border overflow-hidden transition-colors bg-[#F5F5F7] dark:bg-[#111318] ${
        confirmed
          ? 'border-emerald-400/80 dark:border-emerald-500/45'
          : 'border-[#ECEFF4] dark:border-white/[0.1]'
      }`}
    >
      {/* Interactive Tile Canvas */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        role="application"
        aria-label="نقشه انتخاب محدوده آگهی"
        className={`relative h-[184px] sm:h-[208px] w-full overflow-hidden select-none touch-none ${
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

        {/* Precision Center Pin Marker (Head + Stem + Ground Target Dot) */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
          <div className="relative flex flex-col items-center">
            <div
              className={`absolute bottom-0 flex flex-col items-center transition-transform duration-150 ${
                isDragging ? '-translate-y-2 scale-105' : 'translate-y-0 scale-100'
              }`}
            >
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full shadow-lg border-2 border-white transition-all duration-200 ${
                  confirmed
                    ? 'bg-emerald-600 text-white ring-4 ring-emerald-500/25'
                    : 'bg-[#0066CC] text-white'
                }`}
              >
                {confirmed ? (
                  <Check size={16} strokeWidth={2.75} className="block shrink-0" />
                ) : (
                  <MapPin size={16} strokeWidth={2.4} className="block shrink-0" />
                )}
              </div>
              <div
                className={`w-0.5 h-2.5 -mt-0.5 rounded-b-full ${
                  confirmed ? 'bg-emerald-700' : 'bg-[#0055AA]'
                }`}
              />
            </div>
            <div
              className={`h-2 w-2 rounded-full border border-white shadow-xs ${
                confirmed ? 'bg-emerald-600' : 'bg-[#0066CC]'
              }`}
            />
          </div>
        </div>

        {/* Floating Top-Start Status Pill */}
        <div className="pointer-events-none absolute top-2.5 start-2.5 z-20">
          {confirmed ? (
            <span className="inline-flex items-center gap-1 px-2.5 h-6 rounded-full bg-emerald-600/95 text-white text-[10.5px] font-bold leading-none shadow-xs">
              <Check size={11} strokeWidth={3} className="block shrink-0" />
              <span className="leading-none">محدوده تایید شد</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 h-6 rounded-full bg-[#FFFFFF]/90 dark:bg-[#171920]/90 backdrop-blur-md border border-black/5 dark:border-white/[0.1] text-[10.5px] font-bold leading-none text-[#1D1D1F] dark:text-[#F5F5F7] shadow-xs">
              <LocateFixed size={11} className="block shrink-0 text-[#0066CC] dark:text-[#58A6FF]" />
              <span className="leading-none">نقشه را جابه‌جا یا لمس کنید</span>
            </span>
          )}
        </div>

        {/* Unified Vertical Zoom Control Capsule */}
        <div className="absolute top-2.5 end-2.5 z-20 flex flex-col rounded-xl overflow-hidden border border-black/10 dark:border-white/[0.12] bg-[#FFFFFF]/95 dark:bg-[#171920]/95 backdrop-blur-md shadow-xs divide-y divide-black/10 dark:divide-white/[0.08]">
          <button
            type="button"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => handleZoom(1)}
            aria-label="بزرگ‌نمایی نقشه"
            className="flex h-8 w-8 items-center justify-center text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-[#F5F5F7] dark:hover:bg-white/[0.08] active:scale-95 disabled:opacity-35 disabled:cursor-default transition-all cursor-pointer"
          >
            <Plus size={14} strokeWidth={2.2} className="block shrink-0" />
          </button>
          <button
            type="button"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => handleZoom(-1)}
            aria-label="کوچک‌نمایی نقشه"
            className="flex h-8 w-8 items-center justify-center text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-[#F5F5F7] dark:hover:bg-white/[0.08] active:scale-95 disabled:opacity-35 disabled:cursor-default transition-all cursor-pointer"
          >
            <Minus size={14} strokeWidth={2.2} className="block shrink-0" />
          </button>
        </div>

        {/* OSM + CARTO Attribution */}
        <div
          className="pointer-events-none absolute bottom-1.5 end-2 z-10 px-1.5 py-0.5 rounded bg-[#FFFFFF]/80 dark:bg-[#121317]/80 text-[9px] leading-none text-[#6E6E73] dark:text-[#98989F]"
          dir="ltr"
        >
          © OpenStreetMap © CARTO
        </div>
      </div>

      {/* Clean Single-Row Confirmation Bar */}
      <div className="px-3 py-2.5 bg-[#FBFBFC] dark:bg-[#171920] border-t border-[#ECEFF4] dark:border-white/[0.06] flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {confirmed ? (
            <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold leading-none text-emerald-700 dark:text-emerald-400 truncate">
              <Check size={13} strokeWidth={2.5} className="block shrink-0" />
              <span className="truncate leading-none">
                {resolvedArea ? `محدوده: ${resolvedArea}` : 'محدوده روی نقشه تایید شد'}
              </span>
            </span>
          ) : (
            <span className="text-[11px] font-medium leading-none text-[#6E6E73] dark:text-[#A1A1A6] truncate">
              {cityLabel ? `محدوده ${cityLabel}` : 'پین را روی محدوده دلخواه قرار دهید'}
            </span>
          )}
        </div>

        <div className="shrink-0">
          {confirmed ? (
            <button
              type="button"
              onClick={onUnconfirm}
              className="h-8 px-3 rounded-full bg-[#F5F5F7] hover:bg-[#ECECEF] dark:bg-white/[0.08] dark:hover:bg-white/[0.12] text-[11px] font-bold leading-none text-[#515154] dark:text-[#E5E5EA] transition-all active:scale-95 cursor-pointer"
            >
              تغییر
            </button>
          ) : (
            <button
              type="button"
              disabled={confirming}
              onClick={onConfirm}
              className="h-8 px-3.5 rounded-full bg-[#0066CC] hover:bg-[#0055AA] text-white text-[11px] font-bold leading-none inline-flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 cursor-pointer disabled:opacity-60"
            >
              {confirming ? (
                <Loader2 size={12} className="block shrink-0 animate-spin" />
              ) : (
                <Check size={13} strokeWidth={2.5} className="block shrink-0" />
              )}
              <span className="leading-none">تایید محدوده</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
