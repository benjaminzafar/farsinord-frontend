import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowRight,
  Headphones,
  Play,
  ExternalLink,
  Calendar,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';

const INITIAL_VISIBLE = 5;
const LOAD_STEP = 5;

export default function PodcastPage({
  podcastSettings = null,
  onBack,
}) {
  const [episodes, setEpisodes] = useState([]);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [activeVideo, setActiveVideo] = useState(null);
  const [channelUrl, setChannelUrl] = useState(podcastSettings?.youtubeChannelUrl || '');
  const [loading, setLoading] = useState(false);

  const listScrollRef = useRef(null);
  const loadMoreSentinelRef = useRef(null);

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
          setVisibleCount(INITIAL_VISIBLE);
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
    setVisibleCount(INITIAL_VISIBLE);
    if (fallbackList.length > 0) setActiveVideo((prev) => prev || fallbackList[0]);
    setLoading(false);
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    loadFeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Progressive Infinite Scroll: renders only top 5 initially, loads +5 on scroll
  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || visibleCount >= episodes.length) return;

    const rootEl = window.innerWidth >= 1024 ? listScrollRef.current : null;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + LOAD_STEP, episodes.length));
        }
      },
      { root: rootEl, rootMargin: '120px', threshold: 0.05 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visibleCount, episodes.length]);

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

  const visibleEpisodes = episodes.slice(0, visibleCount);
  const hasMore = visibleCount < episodes.length;

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] pb-20 font-vazir" dir="rtl">
      {/* Inline Quiet Breadcrumb Navigation (Matches AdDetailPage) */}
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
            <span className="text-[#1D1D1F] font-semibold">پادکست خبری</span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={loadFeed}
            className="inline-flex items-center gap-1.5 px-1 h-8 text-[13px] font-semibold leading-none text-[#6E6E73] hover:text-[#1D1D1F] transition-colors active:opacity-60 cursor-pointer"
            title="بروزرسانی فید"
          >
            <RefreshCw size={14} strokeWidth={2} className={loading ? 'animate-spin text-[#0066CC]' : 'block shrink-0'} />
            <span className="hidden sm:inline leading-none">بروزرسانی</span>
          </button>

          {channelUrl && (
            <a
              href={channelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-8 px-3.5 rounded-full bg-[#FBFBFC] hover:bg-[#ECECEF] border border-[#E5E5EA] text-[#1D1D1F] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              <span>کانال یوتیوب</span>
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-6 sm:pt-5 sm:pb-8 space-y-5">
        {/* Clean Editorial Page Heading (No Box-in-Box) */}
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-black text-[#1D1D1F] tracking-tight">
            {title}
          </h1>
          <p className="text-xs sm:text-[13px] text-[#6E6E73]">
            {subtitle}
          </p>
        </div>

        {loading && episodes.length === 0 ? (
          <div className="rounded-2xl sm:rounded-3xl border border-[#E5E5EA] bg-[#FBFBFC] py-20 flex flex-col items-center justify-center gap-3 text-center">
            <div className="h-9 w-9 rounded-full border-2 border-[#0066CC]/20 border-t-[#0066CC] animate-spin" />
            <p className="text-xs font-semibold text-[#6E6E73]">در حال دریافت تازه‌ترین قسمت‌های پادکست خبری...</p>
          </div>
        ) : episodes.length === 0 ? (
          <div className="rounded-2xl sm:rounded-3xl border border-[#E5E5EA] bg-[#FBFBFC] py-16 px-4 text-center space-y-3">
            <div className="h-12 w-12 mx-auto rounded-2xl bg-[#F5F5F7] text-[#6E6E73] flex items-center justify-center">
              <Headphones size={22} />
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
                className="inline-flex items-center gap-1.5 h-10 px-5 rounded-full bg-[#0066CC] hover:bg-[#0055AA] text-white text-xs font-bold transition-colors"
              >
                <span>مشاهده کانال یوتیوب</span>
                <ExternalLink size={13} />
              </a>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            {/* Primary Video Player Column (8 cols on Desktop, matches AdDetailPage) */}
            <main className="lg:col-span-8 space-y-5">
              {activeVideo && (
                <>
                  {/* Frameless Video Stage */}
                  <div className="relative aspect-video w-full rounded-2xl sm:rounded-3xl overflow-hidden bg-[#1D1D1F] border border-[#E5E5EA]">
                    <iframe
                      key={activeVideo.videoId}
                      src={`https://www.youtube-nocookie.com/embed/${activeVideo.videoId}?rel=0`}
                      title={activeVideo.title}
                      loading="lazy"
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>

                  {/* Video Details Card */}
                  <div className="bg-[#FBFBFC] rounded-2xl sm:rounded-3xl border border-[#E5E5EA] p-5 sm:p-7 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-2 min-w-0">
                        <h2 className="text-lg sm:text-xl font-black text-[#1D1D1F] leading-snug">
                          {activeVideo.title}
                        </h2>
                        {activeVideo.publishedAt && (
                          <div className="flex items-center gap-1.5 text-xs text-[#6E6E73]">
                            <Calendar size={14} strokeWidth={2} className="text-[#86868B] shrink-0" />
                            <span>{formatDate(activeVideo.publishedAt)}</span>
                          </div>
                        )}
                      </div>

                      <a
                        href={activeVideo.watchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 self-start h-9 px-4 rounded-full bg-[#F5F5F7] hover:bg-[#ECECEF] border border-[#E5E5EA] text-[#1D1D1F] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                      >
                        <span>مشاهده در یوتیوب</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>

                    {activeVideo.description && (
                      <p className="text-xs sm:text-[13.5px] text-[#515154] leading-relaxed whitespace-pre-line pt-4 border-t border-[#E5E5EA]">
                        {activeVideo.description}
                      </p>
                    )}
                  </div>
                </>
              )}
            </main>

            {/* Hairline-Divided Episodes Sidebar (4 cols on Desktop, sticky) */}
            <aside className="lg:col-span-4 lg:sticky lg:top-20 rounded-2xl sm:rounded-3xl border border-[#E5E5EA] bg-[#FBFBFC] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E5E5EA] flex items-center justify-between">
                <h3 className="text-sm font-black text-[#1D1D1F]">تازه‌ترین قسمت‌ها</h3>
                <span className="text-[11px] font-semibold text-[#86868B] tabular-nums">
                  {visibleEpisodes.length} از {episodes.length}
                </span>
              </div>

              <div
                ref={listScrollRef}
                className="divide-y divide-[#E5E5EA] lg:max-h-[580px] lg:overflow-y-auto no-scrollbar"
              >
                {visibleEpisodes.map((ep, idx) => {
                  const isPlaying = activeVideo?.videoId === ep.videoId;
                  return (
                    <button
                      key={ep.videoId}
                      type="button"
                      onClick={() => handleSelectEpisode(ep)}
                      className={`w-full group flex items-center gap-3 p-3.5 text-right transition-colors cursor-pointer ${
                        isPlaying
                          ? 'bg-[#0066CC]/[0.06]'
                          : 'hover:bg-[#F5F5F7]/75'
                      }`}
                    >
                      <div className="relative w-28 aspect-video rounded-xl overflow-hidden bg-[#1D1D1F] shrink-0">
                        <img
                          src={ep.thumbnail}
                          alt={ep.title}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                          <div
                            className={`h-7 w-7 rounded-full flex items-center justify-center transition-transform ${
                              isPlaying
                                ? 'bg-[#0066CC] text-white scale-105'
                                : 'bg-white/90 text-[#1D1D1F] group-hover:scale-110'
                            }`}
                          >
                            <Play size={12} className="fill-current ms-0.5" />
                          </div>
                        </div>
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isPlaying ? (
                            <span className="text-[10.5px] font-bold text-[#0066CC]">
                              در حال پخش
                            </span>
                          ) : idx === 0 ? (
                            <span className="text-[10.5px] font-bold text-[#0066CC]">
                              جدیدترین
                            </span>
                          ) : null}
                          {ep.publishedAt && (
                            <span className="text-[10.5px] text-[#86868B]">
                              {formatDate(ep.publishedAt)}
                            </span>
                          )}
                        </div>
                        <p className={`text-xs font-bold line-clamp-2 leading-snug ${isPlaying ? 'text-[#0066CC]' : 'text-[#1D1D1F]'}`}>
                          {ep.title}
                        </p>
                      </div>
                    </button>
                  );
                })}

                {/* Scroll Sentinel + Fallback Load More Button */}
                {hasMore && (
                  <div ref={loadMoreSentinelRef} className="p-3">
                    <button
                      type="button"
                      onClick={() => setVisibleCount((prev) => Math.min(prev + LOAD_STEP, episodes.length))}
                      className="w-full h-9 rounded-full bg-[#F5F5F7] hover:bg-[#ECECEF] border border-[#E5E5EA] text-[#1D1D1F] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <ChevronDown size={14} />
                      <span>نمایش قسمت‌های بیشتر ({episodes.length - visibleEpisodes.length} باقیمانده)</span>
                    </button>
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
