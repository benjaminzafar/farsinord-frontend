import React, { useState, useEffect } from 'react';
import { X, Headphones, Play, ExternalLink, Radio, Calendar, RefreshCw } from 'lucide-react';

export default function PodcastFeedModal({
  isOpen,
  podcastSettings = null,
  onClose,
}) {
  const [episodes, setEpisodes] = useState([]);
  const [activeVideo, setActiveVideo] = useState(null);
  const [channelUrl, setChannelUrl] = useState(podcastSettings?.youtubeChannelUrl || '');
  const [loading, setLoading] = useState(false);

  const title = podcastSettings?.title || 'پادکست خبری لینک شو';
  const subtitle = podcastSettings?.subtitle || 'تازه‌ترین گزارش‌ها و پادکست‌های خبری فارسی‌زبانان اروپا';

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const loadFeed = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/public?action=get_podcast_feed');
      if (res.ok) {
        const json = await res.json();
        if (json?.ok) {
          const list = Array.isArray(json.episodes) ? json.episodes : [];
          setEpisodes(list);
          if (list.length > 0) setActiveVideo(list[0]);
          if (json.settings?.youtubeChannelUrl) {
            setChannelUrl(json.settings.youtubeChannelUrl);
          }
          setLoading(false);
          return;
        }
      }
    } catch {}

    // Fallback to manualVideos from bootstrap settings if API unavailable
    const fallbackList = Array.isArray(podcastSettings?.manualVideos)
      ? podcastSettings.manualVideos
          .filter((v) => v && v.videoId)
          .map((v) => ({
            videoId: v.videoId,
            title: v.title || 'پادکست خبری',
            publishedAt: v.addedAt || '',
            description: '',
            thumbnail: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
            watchUrl: v.url || `https://www.youtube.com/watch?v=${v.videoId}`,
          }))
      : [];
    setEpisodes(fallbackList);
    if (fallbackList.length > 0) setActiveVideo(fallbackList[0]);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadFeed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const formatDate = (iso) => {
    if (!iso) return '';
    try {
      return new Intl.DateTimeFormat('fa-IR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(new Date(iso));
    } catch {
      return '';
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6 font-vazir select-none"
      dir="rtl"
    >
      <div
        className="fixed inset-0 bg-[#1D1D1F]/65 transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-4xl bg-[#FBFBFC] rounded-[28px] shadow-[0_24px_70px_rgba(29,29,31,0.28)] border border-[#E5E5EA] overflow-hidden z-10 flex flex-col max-h-[88dvh]">
        {/* Header */}
        <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-[#E5E5EA] bg-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-rose-500 to-rose-600 text-white flex items-center justify-center shrink-0 shadow-[0_6px_16px_rgba(225,29,72,0.25)]">
              <Headphones size={20} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[16px] sm:text-[18px] font-black text-[#1D1D1F] tracking-tight truncate">
                  {title}
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200/80 text-[10px] font-bold">
                  <Radio size={10} />
                  <span>فید خبری</span>
                </span>
              </div>
              <p className="text-[11px] sm:text-[11.5px] text-[#6E6E73] mt-0.5 truncate">
                {subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {channelUrl && (
              <a
                href={channelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-[#FF0000] hover:bg-[#DC0000] text-white text-xs font-bold transition-colors shadow-xs"
              >
                <span>کانال یوتیوب</span>
                <ExternalLink size={13} />
              </a>
            )}
            <button
              type="button"
              onClick={loadFeed}
              className="h-9 w-9 rounded-full flex items-center justify-center text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors cursor-pointer"
              title="بروزرسانی فید"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin text-[#0066CC]' : ''} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-9 w-9 rounded-full flex items-center justify-center text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#ECECEF] active:scale-95 transition-all cursor-pointer"
              title="بستن"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-5">
          {loading && episodes.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-center">
              <div className="h-10 w-10 rounded-full border-2 border-[#0066CC]/20 border-t-[#0066CC] animate-spin" />
              <p className="text-xs font-bold text-[#6E6E73]">در حال دریافت تازه‌ترین قسمت‌های پادکست خبری...</p>
            </div>
          ) : episodes.length === 0 ? (
            <div className="py-14 px-4 rounded-2xl border border-[#E5E5EA] bg-white text-center space-y-3">
              <div className="h-12 w-12 mx-auto rounded-2xl bg-[#F5F5F7] text-[#6E6E73] flex items-center justify-center">
                <Headphones size={22} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-[#1D1D1F]">هنوز پادکستی منتشر نشده است</h3>
                <p className="text-xs text-[#6E6E73] max-w-md mx-auto leading-relaxed">
                  لینک کانال یوتیوب یا قسمت‌های پادکست خبری از طریق پنل مدیریت تنظیم می‌شوند و بلافاصله در این بخش نمایش داده خواهند شد.
                </p>
              </div>
              {channelUrl && (
                <a
                  href={channelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-[#FF0000] hover:bg-[#DC0000] text-white text-xs font-bold transition-colors"
                >
                  <span>مشاهده کانال یوتیوب</span>
                  <ExternalLink size={13} />
                </a>
              )}
            </div>
          ) : (
            <>
              {/* Active Featured Video Player */}
              {activeVideo && (
                <div className="rounded-2xl border border-[#E5E5EA] bg-white overflow-hidden shadow-[0_6px_24px_rgba(29,29,31,0.06)]">
                  <div className="relative aspect-video w-full bg-black">
                    <iframe
                      key={activeVideo.videoId}
                      src={`https://www.youtube-nocookie.com/embed/${activeVideo.videoId}?rel=0`}
                      title={activeVideo.title}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                  <div className="p-4 sm:p-5 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm sm:text-base font-black text-[#1D1D1F] leading-snug">
                        {activeVideo.title}
                      </h3>
                      <a
                        href={activeVideo.watchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F5F5F7] hover:bg-[#ECECEF] text-[#1D1D1F] text-[11px] font-bold transition-colors"
                      >
                        <span>یوتیوب</span>
                        <ExternalLink size={11} />
                      </a>
                    </div>
                    {activeVideo.publishedAt && (
                      <div className="flex items-center gap-1.5 text-[11px] text-[#6E6E73]">
                        <Calendar size={12} />
                        <span>{formatDate(activeVideo.publishedAt)}</span>
                      </div>
                    )}
                    {activeVideo.description && (
                      <p className="text-xs text-[#515154] leading-relaxed line-clamp-3">
                        {activeVideo.description}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Episodes Feed Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-[#1D1D1F]">
                    همه قسمت‌ها ({episodes.length})
                  </h4>
                  {channelUrl && (
                    <a
                      href={channelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="sm:hidden inline-flex items-center gap-1 text-[11px] font-bold text-[#FF0000]"
                    >
                      <span>کانال یوتیوب</span>
                      <ExternalLink size={11} />
                    </a>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {episodes.map((ep) => {
                    const isPlaying = activeVideo?.videoId === ep.videoId;
                    return (
                      <button
                        key={ep.videoId}
                        type="button"
                        onClick={() => setActiveVideo(ep)}
                        className={`group flex items-center gap-3 p-2.5 rounded-2xl border text-right transition-all cursor-pointer ${
                          isPlaying
                            ? 'bg-rose-50/60 border-rose-300 shadow-xs'
                            : 'bg-white border-[#E5E5EA] hover:border-[#0066CC]/50 hover:bg-[#F5F5F7]/60'
                        }`}
                      >
                        <div className="relative w-28 sm:w-32 aspect-video rounded-xl overflow-hidden bg-stone-900 shrink-0">
                          <img
                            src={ep.thumbnail}
                            alt={ep.title}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                            <div
                              className={`h-8 w-8 rounded-full flex items-center justify-center transition-transform ${
                                isPlaying
                                  ? 'bg-rose-600 text-white scale-105'
                                  : 'bg-white/90 text-[#1D1D1F] group-hover:scale-110'
                              }`}
                            >
                              <Play size={14} className="fill-current ms-0.5" />
                            </div>
                          </div>
                        </div>

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-1.5">
                            {isPlaying && (
                              <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[9.5px] font-bold">
                                در حال پخش
                              </span>
                            )}
                            {ep.publishedAt && (
                              <span className="text-[10px] text-[#6E6E73]">
                                {formatDate(ep.publishedAt)}
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-bold text-[#1D1D1F] line-clamp-2 leading-snug">
                            {ep.title}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
