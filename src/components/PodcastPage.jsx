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
import { isSafeHttpUrl } from '../lib/urlUtils';

const INITIAL_VISIBLE = 5;
const LOAD_STEP = 5;
const YT_VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;
const FA_PODCAST_DATE_FMT = new Intl.DateTimeFormat('fa-IR', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});
const FA_NUM_FMT = new Intl.NumberFormat('fa-IR');

const PODCAST_SESSION_CACHE_TTL_MS = 5 * 60 * 1000;
let cachedPodcastFeed = null;
let cachedPodcastFeedAt = 0;

function sanitizeEpisode(v) {
  if (!v || !YT_VIDEO_ID_RE.test(String(v.videoId || ''))) return null;
  const videoId = String(v.videoId);
  const rawWatch = String(v.watchUrl || v.url || '').trim();
  const watchUrl = isSafeHttpUrl(rawWatch) ? rawWatch : `https://www.youtube.com/watch?v=${videoId}`;
  const rawThumb = String(v.thumbnail || '').trim();
  const thumbnail = isSafeHttpUrl(rawThumb) ? rawThumb : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  return {
    videoId,
    title: v.title || 'پادکست خبری',
    publishedAt: v.publishedAt || v.addedAt || '',
    description: v.description || '',
    thumbnail,
    watchUrl,
  };
}

export default function PodcastPage({
  podcastSettings = null,
  onBack,
}) {
  const [episodes, setEpisodes] = useState(() => cachedPodcastFeed?.episodes || []);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [activeVideo, setActiveVideo] = useState(() => cachedPodcastFeed?.episodes?.[0] || null);
  const [playerActive, setPlayerActive] = useState(false);
  const [channelUrl, setChannelUrl] = useState(() => {
    const raw = cachedPodcastFeed?.channelUrl || podcastSettings?.youtubeChannelUrl || '';
    return isSafeHttpUrl(raw) ? raw : '';
  });
  const [loading, setLoading] = useState(false);

  const listScrollRef = useRef(null);
  const loadMoreSentinelRef = useRef(null);

  const title = podcastSettings?.title || 'پادکست خبری لینک شو';
  const subtitle = podcastSettings?.subtitle || 'گزارش‌ها و پادکست‌های خبری فارسی‌زبانان اروپا';

  const loadFeed = async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && cachedPodcastFeed && now - cachedPodcastFeedAt < PODCAST_SESSION_CACHE_TTL_MS) {
      setEpisodes(cachedPodcastFeed.episodes);
      if (cachedPodcastFeed.episodes.length > 0) {
        setActiveVideo((prev) => prev || cachedPodcastFeed.episodes[0]);
      }
      if (cachedPodcastFeed.channelUrl) setChannelUrl(cachedPodcastFeed.channelUrl);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/public?action=get_podcast_feed');
      if (res.ok) {
        const json = await res.json();
        if (json?.ok) {
          const list = (Array.isArray(json.episodes) ? json.episodes : [])
            .map(sanitizeEpisode)
            .filter(Boolean);
          const nextChUrl = isSafeHttpUrl(json.settings?.youtubeChannelUrl)
            ? json.settings.youtubeChannelUrl
            : '';
          cachedPodcastFeed = { episodes: list, channelUrl: nextChUrl };
          cachedPodcastFeedAt = Date.now();
          setEpisodes(list);
          setVisibleCount(INITIAL_VISIBLE);
          if (list.length > 0) setActiveVideo((prev) => prev || list[0]);
          if (nextChUrl) setChannelUrl(nextChUrl);
          setLoading(false);
          return;
        }
      }
    } catch {}

    const fallbackList = Array.isArray(podcastSettings?.manualVideos)
      ? podcastSettings.manualVideos.map(sanitizeEpisode).filter(Boolean)
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
      const ts = Date.parse(iso);
      return Number.isFinite(ts) ? FA_PODCAST_DATE_FMT.format(new Date(ts)) : '';
    } catch {
      return '';
    }
  };

  const handleSelectEpisode = (ep) => {
    setActiveVideo(ep);
    setPlayerActive(true);
    if (window.innerWidth < 1024) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const visibleEpisodes = episodes.slice(0, visibleCount);
  const hasMore = visibleCount < episodes.length;

  return (
    <div className="min-h-screen bg-[#FBFBFC] dark:bg-[#121317] text-[#1D1D1F] dark:text-[#F5F5F7] pb-20 font-vazir" dir="rtl">
      {/* Inline Quiet Breadcrumb Navigation (Matches AdDetailPage) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 sm:pt-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 leading-none">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 -ms-1 px-1.5 h-10 sm:h-8 text-[13px] font-semibold leading-none text-[#0066CC] hover:text-[#0055AA] transition-colors active:opacity-60 cursor-pointer shrink-0"
          >
            <ArrowRight size={15} strokeWidth={2} className="block shrink-0" />
            <span className="leading-none">بازگشت</span>
          </button>

          <div className="hidden sm:flex items-center gap-1.5 text-xs leading-none text-[#86868B] truncate">
            <span>/</span>
            <span>خانه</span>
            <span>/</span>
            <span className="text-[#1D1D1F] dark:text-[#F5F5F7] font-semibold">پادکست خبری</span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => loadFeed(true)}
            className="inline-flex items-center gap-1.5 px-1.5 h-10 sm:h-8 text-[13px] font-semibold leading-none text-[#6E6E73] hover:text-[#1D1D1F] dark:text-[#98989F] dark:hover:text-white transition-colors active:opacity-60 cursor-pointer"
            title="بروزرسانی فید"
          >
            <RefreshCw size={14} strokeWidth={2} className={loading ? 'block shrink-0 animate-spin text-[#0066CC]' : 'block shrink-0'} />
            <span className="hidden sm:inline leading-none">بروزرسانی</span>
          </button>

          {channelUrl && (
            <a
              href={channelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 sm:h-8 px-3.5 rounded-full bg-[#FBFBFC] dark:bg-[#171920] hover:bg-[#ECECEF] border border-[#ECEFF4] dark:border-white/[0.06] text-[#1D1D1F] dark:text-[#F5F5F7] text-xs font-semibold leading-none inline-flex items-center gap-1.5 transition-colors"
            >
              <span className="leading-none">کانال یوتیوب</span>
              <ExternalLink size={12} className="block shrink-0" />
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
          <div className="rounded-2xl sm:rounded-3xl border border-[#ECEFF4] dark:border-white/[0.06] bg-[#FBFBFC] dark:bg-[#171920] py-20 flex flex-col items-center justify-center gap-3 text-center">
            <div className="h-9 w-9 rounded-full border-2 border-[#0066CC]/20 border-t-[#0066CC] animate-spin" />
            <p className="text-xs font-semibold text-[#6E6E73]">در حال بارگذاری پادکست‌ها...</p>
          </div>
        ) : episodes.length === 0 ? (
          <div className="rounded-2xl sm:rounded-3xl border border-[#ECEFF4] dark:border-white/[0.06] bg-[#FBFBFC] dark:bg-[#171920] py-16 px-4 text-center space-y-3.5">
            <div className="h-12 w-12 mx-auto rounded-2xl bg-[#F5F5F7] dark:bg-white/[0.06] text-[#6E6E73] flex items-center justify-center">
              <Headphones size={22} className="block" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-black text-[#1D1D1F]">هنوز پادکستی منتشر نشده است</h2>
              <p className="text-xs text-[#6E6E73] max-w-md mx-auto leading-relaxed">
                قسمت‌های جدید پادکست خبری به‌زودی در این بخش منتشر می‌شوند.
              </p>
            </div>
            {channelUrl && (
              <a
                href={channelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 h-10 px-5 rounded-full bg-[#0066CC] hover:bg-[#0055AA] text-white text-xs font-bold leading-none transition-colors"
              >
                <span className="leading-none">مشاهده کانال یوتیوب</span>
                <ExternalLink size={13} className="block shrink-0" />
              </a>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            {/* Primary Video Player Column (8 cols on Desktop, matches AdDetailPage) */}
            <main className="lg:col-span-8 space-y-5">
              {activeVideo && (
                <>
                  {/* Frameless Video Stage with Lightweight Click-to-Play Facade */}
                  <div className="relative aspect-video w-full rounded-2xl sm:rounded-3xl overflow-hidden bg-[#1D1D1F] border border-[#ECEFF4] dark:border-white/[0.06]">
                    {playerActive ? (
                      <iframe
                        key={activeVideo.videoId}
                        src={`https://www.youtube-nocookie.com/embed/${activeVideo.videoId}?rel=0&autoplay=1`}
                        title={activeVideo.title}
                        className="w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPlayerActive(true)}
                        aria-label={`پخش ${activeVideo.title}`}
                        className="group relative w-full h-full block cursor-pointer"
                      >
                        <img
                          src={activeVideo.thumbnail}
                          alt={activeVideo.title}
                          width="960"
                          height="540"
                          fetchPriority="high"
                          decoding="async"
                          className="w-full h-full object-cover opacity-90 group-hover:scale-[1.015] transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-black/25 flex items-center justify-center">
                          <span className="h-16 w-16 rounded-full bg-[#0066CC] group-hover:bg-[#0055AA] text-white shadow-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-105">
                            <Play size={26} className="fill-current ms-1 block" />
                          </span>
                        </div>
                      </button>
                    )}
                  </div>

                  {/* Video Details Card */}
                  <div className="bg-[#FBFBFC] dark:bg-[#171920] rounded-2xl sm:rounded-3xl border border-[#ECEFF4] dark:border-white/[0.06] p-5 sm:p-7 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-2 min-w-0">
                        <h2 className="text-lg sm:text-xl font-black text-[#1D1D1F] leading-snug">
                          {activeVideo.title}
                        </h2>
                        {activeVideo.publishedAt && (
                          <div className="inline-flex items-center gap-1.5 text-xs leading-none text-[#6E6E73]">
                            <Calendar size={14} strokeWidth={2} className="block text-[#86868B] shrink-0" />
                            <span className="leading-none">{formatDate(activeVideo.publishedAt)}</span>
                          </div>
                        )}
                      </div>

                      <a
                        href={activeVideo.watchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 self-start h-10 sm:h-9 px-4 rounded-full bg-[#F5F5F7] hover:bg-[#ECECEF] border border-[#ECEFF4] dark:border-white/[0.06] text-[#1D1D1F] text-xs font-semibold leading-none inline-flex items-center gap-1.5 transition-colors"
                      >
                        <span className="leading-none">مشاهده در یوتیوب</span>
                        <ExternalLink size={12} className="block shrink-0" />
                      </a>
                    </div>

                    {activeVideo.description && (
                      <p className="text-xs sm:text-[13.5px] text-[#515154] leading-relaxed whitespace-pre-line pt-4 border-t border-[#ECEFF4] dark:border-white/[0.06]">
                        {activeVideo.description}
                      </p>
                    )}
                  </div>
                </>
              )}
            </main>

            {/* Hairline-Divided Episodes Sidebar (4 cols on Desktop, sticky) */}
            <aside className="lg:col-span-4 lg:sticky lg:top-20 rounded-2xl sm:rounded-3xl border border-[#ECEFF4] dark:border-white/[0.06] bg-[#FBFBFC] dark:bg-[#171920] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#ECEFF4] dark:border-white/[0.06] flex items-center justify-between">
                <h3 className="text-sm font-black text-[#1D1D1F]">تازه‌ترین قسمت‌ها</h3>
                <span className="text-[11px] font-semibold text-[#86868B] tabular-nums">
                  {FA_NUM_FMT.format(visibleEpisodes.length)} از {FA_NUM_FMT.format(episodes.length)}
                </span>
              </div>

              <div
                ref={listScrollRef}
                className="divide-y divide-[#ECEFF4] dark:divide-white/[0.038] lg:max-h-[580px] lg:overflow-y-auto no-scrollbar"
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
                          ? 'bg-[#0066CC]/[0.06] dark:bg-[#0A84FF]/[0.15]'
                          : 'hover:bg-[#F5F5F7]/75'
                      }`}
                    >
                      <div className="relative w-28 aspect-video rounded-xl overflow-hidden bg-[#1D1D1F] shrink-0">
                        <img
                          src={ep.thumbnail}
                          alt={ep.title}
                          width="160"
                          height="90"
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
                            <Play size={12} className="fill-current ms-0.5 block" />
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
                      className="w-full h-10 rounded-full bg-[#F5F5F7] hover:bg-[#ECECEF] border border-[#ECEFF4] dark:border-white/[0.06] text-[#1D1D1F] text-xs font-semibold leading-none inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <ChevronDown size={14} className="block shrink-0" />
                      <span className="leading-none">قسمت‌های بیشتر ({FA_NUM_FMT.format(episodes.length - visibleEpisodes.length)})</span>
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
