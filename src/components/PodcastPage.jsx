import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  Headphones,
  Play,
  ExternalLink,
  Radio,
  Calendar,
  RefreshCw,
} from 'lucide-react';

export default function PodcastPage({
  podcastSettings = null,
  onBack,
}) {
  const [episodes, setEpisodes] = useState([]);
  const [activeVideo, setActiveVideo] = useState(null);
  const [channelUrl, setChannelUrl] = useState(podcastSettings?.youtubeChannelUrl || '');
  const [loading, setLoading] = useState(false);

  const title = podcastSettings?.title || 'پادکست خبری لینک شو';
  const subtitle = podcastSettings?.subtitle || 'تازه‌ترین گزارش‌ها و پادکست‌های خبری فارسی‌زبانان اروپا';

  const loadFeed = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/public?action=get_podcast_feed');
      if (res.ok) {
        const json = await res.json();
        if (json?.ok) {
          const list = Array.isArray(json.episodes) ? json.episodes : [];
          setEpisodes(list);
          if (list.length > 0) setActiveVideo((prev) => prev || list[0]);
          if (json.settings?.youtubeChannelUrl) {
            setChannelUrl(json.settings.youtubeChannelUrl);
          }
          setLoading(false);
          return;
        }
      }
    } catch {}

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
    if (fallbackList.length > 0) setActiveVideo((prev) => prev || fallbackList[0]);
    setLoading(false);
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    loadFeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleSelectEpisode = (ep) => {
    setActiveVideo(ep);
    if (window.innerWidth < 1024) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6 font-vazir min-h-[70vh]" dir="rtl">
      {/* Top Page Header Bar */}
      <div className="rounded-3xl bg-white border border-[#E5E5EA] p-4 sm:p-6 shadow-[0_2px_12px_rgba(29,29,31,0.04)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="h-10 px-3.5 rounded-full bg-[#F5F5F7] hover:bg-[#ECECEF] text-[#1D1D1F] text-xs font-bold inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
          >
            <ArrowRight size={15} />
            <span>بازگشت</span>
          </button>

          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-rose-500 to-rose-600 text-white flex items-center justify-center shrink-0 shadow-[0_6px_16px_rgba(225,29,72,0.22)]">
            <Headphones size={20} strokeWidth={2} />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-xl font-black text-[#1D1D1F] tracking-tight truncate">
                {title}
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200/80 text-[10px] font-bold">
                <Radio size={10} />
                <span>فید خبری</span>
              </span>
            </div>
            <p className="text-xs text-[#6E6E73] mt-0.5 truncate">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <button
            type="button"
            onClick={loadFeed}
            className="h-9 px-3 rounded-full border border-[#E5E5EA] bg-[#FBFBFC] hover:bg-[#F5F5F7] text-[#1D1D1F] text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            title="بروزرسانی فید"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-[#0066CC]' : 'text-[#6E6E73]'} />
            <span className="hidden sm:inline">بروزرسانی</span>
          </button>
          {channelUrl && (
            <a
              href={channelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 px-4 rounded-full bg-[#FF0000] hover:bg-[#DC0000] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <span>کانال یوتیوب</span>
              <ExternalLink size={13} />
            </a>
          )}
        </div>
      </div>

      {/* Main Content */}
      {loading && episodes.length === 0 ? (
        <div className="rounded-3xl border border-[#E5E5EA] bg-white py-20 flex flex-col items-center justify-center gap-3 text-center">
          <div className="h-10 w-10 rounded-full border-2 border-[#0066CC]/20 border-t-[#0066CC] animate-spin" />
          <p className="text-xs font-bold text-[#6E6E73]">در حال دریافت تازه‌ترین قسمت‌های پادکست خبری...</p>
        </div>
      ) : episodes.length === 0 ? (
        <div className="rounded-3xl border border-[#E5E5EA] bg-white py-16 px-4 text-center space-y-3">
          <div className="h-14 w-14 mx-auto rounded-2xl bg-[#F5F5F7] text-[#6E6E73] flex items-center justify-center">
            <Headphones size={26} />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-black text-[#1D1D1F]">هنوز پادکستی منتشر نشده است</h2>
            <p className="text-xs text-[#6E6E73] max-w-md mx-auto leading-relaxed">
              لینک کانال یوتیوب یا قسمت‌های پادکست خبری از طریق پنل مدیریت تنظیم می‌شوند و بلافاصله در این صفحه نمایش داده خواهند شد.
            </p>
          </div>
          {channelUrl && (
            <a
              href={channelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-10 px-5 rounded-full bg-[#FF0000] hover:bg-[#DC0000] text-white text-xs font-bold transition-colors"
            >
              <span>مشاهده کانال یوتیوب</span>
              <ExternalLink size={13} />
            </a>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Primary Video Player Column */}
          <div className="lg:col-span-7 xl:col-span-8">
            {activeVideo && (
              <div className="rounded-3xl border border-[#E5E5EA] bg-white overflow-hidden shadow-[0_6px_28px_rgba(29,29,31,0.06)]">
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
                <div className="p-5 sm:p-6 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-base sm:text-lg font-black text-[#1D1D1F] leading-snug">
                      {activeVideo.title}
                    </h2>
                    <a
                      href={activeVideo.watchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F5F5F7] hover:bg-[#ECECEF] text-[#1D1D1F] text-xs font-bold transition-colors"
                    >
                      <span>یوتیوب</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                  {activeVideo.publishedAt && (
                    <div className="flex items-center gap-1.5 text-xs text-[#6E6E73]">
                      <Calendar size={13} />
                      <span>{formatDate(activeVideo.publishedAt)}</span>
                    </div>
                  )}
                  {activeVideo.description && (
                    <p className="text-xs sm:text-[13px] text-[#515154] leading-relaxed whitespace-pre-line pt-1 border-t border-[#F0F0F2]">
                      {activeVideo.description}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Episodes Feed Column */}
          <div className="lg:col-span-5 xl:col-span-4 rounded-3xl border border-[#E5E5EA] bg-white p-4 sm:p-5 space-y-3.5 shadow-[0_2px_12px_rgba(29,29,31,0.04)]">
            <div className="flex items-center justify-between border-b border-[#F0F0F2] pb-3">
              <h3 className="text-sm font-black text-[#1D1D1F]">
                تازه‌ترین قسمت‌ها ({episodes.length})
              </h3>
              <span className="text-[11px] text-[#6E6E73]">انتخاب برای پخش</span>
            </div>

            <div className="space-y-2.5 lg:max-h-[560px] lg:overflow-y-auto no-scrollbar">
              {episodes.map((ep) => {
                const isPlaying = activeVideo?.videoId === ep.videoId;
                return (
                  <button
                    key={ep.videoId}
                    type="button"
                    onClick={() => handleSelectEpisode(ep)}
                    className={`w-full group flex items-center gap-3 p-2.5 rounded-2xl border text-right transition-all cursor-pointer ${
                      isPlaying
                        ? 'bg-rose-50/70 border-rose-300 shadow-xs'
                        : 'bg-[#FBFBFC] border-[#E5E5EA] hover:border-[#0066CC]/50 hover:bg-[#F5F5F7]'
                    }`}
                  >
                    <div className="relative w-28 aspect-video rounded-xl overflow-hidden bg-stone-900 shrink-0">
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
                          <Play size={13} className="fill-current ms-0.5" />
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
        </div>
      )}
    </main>
  );
}
