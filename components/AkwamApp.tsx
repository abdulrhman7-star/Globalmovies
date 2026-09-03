/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  Play,
  Download,
  Film,
  Tv,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Code2,
  Share2,
  Sparkles,
  Zap,
  Shield,
  Clock,
  Star,
  ChevronLeft,
  ChevronRight,
  X,
  Layers,
} from 'lucide-react';
import VideoPlayer, { SubtitleTrack } from './VideoPlayer';
import EmbedModal from './EmbedModal';

export interface MediaItem {
  title: string;
  url: string;
  image: string;
  rating?: string;
  quality?: string;
  year?: string;
  type?: 'movie' | 'series' | 'episode';
}

export interface VideoLink {
  quality: string;
  url: string;
  streamUrl?: string;
  isM3u8?: boolean;
}

export default function AkwamApp() {
  const [view, setView] = useState<'home' | 'search' | 'series' | 'watch'>('home');
  const [homeTab, setHomeTab] = useState<'all' | 'movies' | 'series'>('all');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MediaItem[]>([]);
  const [movies, setMovies] = useState<MediaItem[]>([]);
  const [series, setSeries] = useState<MediaItem[]>([]);
  const [moviesPage, setMoviesPage] = useState(1);
  const [seriesPage, setSeriesPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Media & Watch details
  const [currentMedia, setCurrentMedia] = useState<MediaItem | null>(null);
  const [mediaStory, setMediaStory] = useState<string>('');
  const [mediaSubtitles, setMediaSubtitles] = useState<SubtitleTrack[]>([]);
  const [episodes, setEpisodes] = useState<MediaItem[]>([]);
  const [episodeSearch, setEpisodeSearch] = useState('');
  const [videoLinks, setVideoLinks] = useState<VideoLink[]>([]);
  const [selectedQualityIdx, setSelectedQualityIdx] = useState<number>(0);
  const [videoError, setVideoError] = useState(false);
  const [streamMode, setStreamMode] = useState<'proxy' | 'direct'>('proxy');

  // Embed Modal State
  const [isEmbedOpen, setIsEmbedOpen] = useState<boolean>(false);
  const [embedVideoUrl, setEmbedVideoUrl] = useState<string>('');
  const [embedTitle, setEmbedTitle] = useState<string>('');

  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch initial home content
  const fetchHomeData = useCallback(async (mPage = 1, sPage = 1) => {
    setLoading(true);
    setError('');

    try {
      const [moviesRes, seriesRes] = await Promise.all([
        fetch(`/api/movies?page=${mPage}`).then((res) => res.json()),
        fetch(`/api/series?page=${sPage}`).then((res) => res.json()),
      ]);

      if (moviesRes.success && Array.isArray(moviesRes.data)) {
        setMovies(moviesRes.data);
      }
      if (seriesRes.success && Array.isArray(seriesRes.data)) {
        setSeries(seriesRes.data);
      }

      if (!moviesRes.success && !seriesRes.success) {
        setError(moviesRes.error || seriesRes.error || 'تعذر جلب البيانات من المصدر');
      }
    } catch (e: any) {
      console.error(e);
      setError('حدث خطأ أثناء جلب البيانات من الخادم');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;

    if (view === 'home' && movies.length === 0 && series.length === 0) {
      Promise.all([
        fetch(`/api/movies?page=1`).then((res) => res.json()),
        fetch(`/api/series?page=1`).then((res) => res.json()),
      ])
        .then(([moviesRes, seriesRes]) => {
          if (isCancelled) return;
          if (moviesRes.success && Array.isArray(moviesRes.data)) {
            setMovies(moviesRes.data);
          }
          if (seriesRes.success && Array.isArray(seriesRes.data)) {
            setSeries(seriesRes.data);
          }
          if (!moviesRes.success && !seriesRes.success) {
            setError(moviesRes.error || seriesRes.error || 'تعذر جلب البيانات من المصدر');
          }
        })
        .catch(() => {
          if (!isCancelled) {
            setError('حدث خطأ أثناء جلب البيانات من الخادم');
          }
        })
        .finally(() => {
          if (!isCancelled) {
            setLoading(false);
          }
        });
    }

    return () => {
      isCancelled = true;
    };
  }, [view, movies.length, series.length]);

  // Execute Search
  const executeSearch = async (searchTerm: string) => {
    const q = searchTerm.trim();
    if (!q) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError('');
    setView('search');

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();

      if (data.success && Array.isArray(data.data)) {
        setResults(data.data);
      } else {
        setResults([]);
        setError(data.error || 'لم يتم العثور على نتائج تطابق بحثك');
      }
    } catch {
      setError('فشل في إجراء البحث');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    executeSearch(query);
  };

  // Debounced typing search
  useEffect(() => {
    if (!query.trim()) return;

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(() => {
      executeSearch(query);
    }, 450);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [query]);

  // Handle clicking on a movie or series card
  const handleMediaClick = async (item: MediaItem) => {
    setCurrentMedia(item);
    setError('');
    setVideoError(false);
    setMediaStory('');
    setMediaSubtitles([]);

    const isSeries =
      item.type === 'series' ||
      item.url.includes('/series/') ||
      item.url.includes('/show/');

    if (isSeries) {
      setView('series');
      setLoading(true);
      setEpisodeSearch('');

      try {
        const res = await fetch(`/api/series-episodes?url=${encodeURIComponent(item.url)}`);
        const data = await res.json();

        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setEpisodes(data.data);
        } else {
          setError(data.error || 'لم يتم العثور على حلقات لهذا المسلسل');
        }
      } catch {
        setError('فشل في جلب الحلقات من الخادم');
      } finally {
        setLoading(false);
      }
    } else {
      // Movie
      fetchVideoLinks(item.url);
    }
  };

  // Fetch clean stream links for watch view
  const fetchVideoLinks = async (url: string) => {
    setView('watch');
    setLoading(true);
    setError('');
    setVideoLinks([]);
    setSelectedQualityIdx(0);
    setVideoError(false);

    try {
      const res = await fetch(`/api/watch?url=${encodeURIComponent(url)}`);
      const data = await res.json();

      if (data.success && Array.isArray(data.data) && data.data.length > 0) {
        setVideoLinks(data.data);
        if (data.story) setMediaStory(data.story);
        if (Array.isArray(data.subtitles)) setMediaSubtitles(data.subtitles);
      } else {
        // Fallback to get-link
        const fbRes = await fetch(`/api/get-link?url=${encodeURIComponent(url)}`);
        const fbData = await fbRes.json();
        if (fbData.success && Array.isArray(fbData.data) && fbData.data.length > 0) {
          setVideoLinks(fbData.data);
        } else {
          setError(data.error || fbData.error || 'تعذر استخراج رابط الفيديو المباشر');
        }
      }
    } catch {
      setError('حدث خطأ أثناء استخراج روابط المشاهدة');
    } finally {
      setLoading(false);
    }
  };

  const activeLink = videoLinks[selectedQualityIdx] || videoLinks[0];
  const activeStreamUrl = activeLink
    ? streamMode === 'direct'
      ? activeLink.url
      : activeLink.streamUrl || `/api/stream?url=${encodeURIComponent(activeLink.url)}`
    : '';

  const filteredEpisodes = episodes.filter((ep) =>
    ep.title.toLowerCase().includes(episodeSearch.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 min-h-screen font-sans" dir="rtl">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 border-b border-gray-800 pb-6">
        <div
          id="app-logo-btn"
          className="text-2xl font-black text-blue-500 cursor-pointer flex items-center gap-3 select-none"
          onClick={() => {
            setView('home');
            setQuery('');
            setError('');
          }}
        >
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-700 to-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/25 border border-blue-400/30">
            <Play className="w-5 h-5 fill-white text-white ml-0.5" />
          </div>

          <div className="flex flex-col">
            <span className="text-xl tracking-tight text-white font-black">
              Akwam <span className="text-blue-500">Stream IO</span>
            </span>
            <span className="text-xs text-gray-400 font-medium">
              محرك المشاهدة والبث فائق السرعة
            </span>
          </div>
        </div>

        {/* Global Search Bar */}
        <form
          onSubmit={handleSearchSubmit}
          className="w-full md:w-1/2 max-w-xl flex shadow-2xl shadow-black/40"
        >
          <input
            id="search-input"
            type="text"
            placeholder="ابحث عن فيلم أو مسلسل..."
            className="flex-1 bg-gray-800/90 border border-gray-700 border-l-0 rounded-r-xl px-5 py-3.5 text-white placeholder-gray-400 focus:border-blue-500 focus:bg-gray-800 outline-none transition-all text-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <button
            id="search-submit-btn"
            type="submit"
            className="bg-blue-600 hover:bg-blue-500 px-6 py-3.5 rounded-l-xl transition-colors flex items-center justify-center font-bold gap-2 text-white text-sm shrink-0"
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">بحث</span>
          </button>
        </form>
      </header>

      {/* Tabs navigation in Home */}
      {view === 'home' && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8 border-b border-gray-800 pb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="tab-all"
              onClick={() => setHomeTab('all')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                homeTab === 'all'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
            >
              الكل
            </button>

            <button
              id="tab-movies"
              onClick={() => setHomeTab('movies')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
                homeTab === 'movies'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
            >
              <Film className="w-4 h-4" />
              الأفلام
            </button>

            <button
              id="tab-series"
              onClick={() => setHomeTab('series')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
                homeTab === 'series'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
            >
              <Tv className="w-4 h-4" />
              المسلسلات
            </button>
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-2 flex-wrap">
            <a
              id="allmovies-html-btn"
              href="/allmovies.html"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-purple-600/80 to-pink-600/80 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-500/10 border border-purple-500/30"
              title="عرض صفحة جميع الأفلام"
            >
              <ExternalLink className="w-3.5 h-3.5 text-white" />
              <span>All Movies</span>
            </a>

            <button
              id="open-embed-generator-btn"
              onClick={() => {
                setEmbedVideoUrl(
                  movies[0]?.url ||
                    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
                );
                setEmbedTitle('فيديو متجاوب جاهز للتضمين');
                setIsEmbedOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-blue-600/80 to-cyan-600/80 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-cyan-500/10 border border-cyan-500/30"
            >
              <Code2 className="w-3.5 h-3.5 text-cyan-200" />
              <span>كود التضمين (Embed)</span>
            </button>
          </div>
        </div>
      )}

      {/* Global Loading Spinner */}
      {loading && (
        <div className="flex flex-col justify-center items-center py-20 gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin shadow-lg shadow-blue-500/20"></div>
          <p className="text-gray-400 text-sm font-medium">جاري معالجة واستخراج البيانات...</p>
        </div>
      )}

      {/* Error Banner */}
      {error && !loading && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-5 rounded-2xl text-center font-medium my-6 flex flex-col items-center gap-3 max-w-lg mx-auto shadow-xl">
          <AlertCircle className="w-8 h-8 text-red-400" />
          <p className="text-sm">{error}</p>
          <button
            onClick={() => {
              if (view === 'home') {
                fetchHomeData(moviesPage, seriesPage);
              } else if (view === 'search') {
                executeSearch(query);
              } else if (view === 'watch' && currentMedia) {
                fetchVideoLinks(currentMedia.url);
              } else if (view === 'series' && currentMedia) {
                handleMediaClick(currentMedia);
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-red-600/30 hover:bg-red-600/50 text-red-200 rounded-xl text-xs font-bold transition-colors mt-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* Search View */}
      {!loading && view === 'search' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex items-center justify-between border-b border-gray-800 pb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setView('home')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-semibold transition-colors"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                الرئيسية
              </button>
              <h2 className="text-lg md:text-xl font-bold text-white">
                نتائج البحث عن: <span className="text-blue-400">&ldquo;{query}&rdquo;</span>
              </h2>
            </div>
            <span className="text-xs text-gray-400 bg-gray-800 px-2.5 py-1 rounded-full font-mono">
              {results.length} عنصر
            </span>
          </div>

          {results.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {results.map((item, idx) => (
                <MediaCard key={`search-${idx}-${item.url}`} item={item} onClick={handleMediaClick} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-gray-900/60 rounded-2xl border border-gray-800">
              <Film className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">لم يتم العثور على نتائج لـ &ldquo;{query}&rdquo;</p>
            </div>
          )}
        </div>
      )}

      {/* Main Home Content */}
      {!loading && view === 'home' && (
        <div className="space-y-12 animate-in fade-in duration-300">
          {/* Movies Section */}
          {(homeTab === 'all' || homeTab === 'movies') && (
            <section id="movies-section" className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/20">
                    <Film className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-white">أحدث الأفلام</h2>
                </div>

                {homeTab === 'movies' && (
                  <div className="flex items-center gap-2">
                    <button
                      disabled={moviesPage <= 1}
                      onClick={() => {
                        const next = Math.max(1, moviesPage - 1);
                        setMoviesPage(next);
                        fetchHomeData(next, seriesPage);
                      }}
                      className="p-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 rounded-lg text-white"
                      title="الصفحة السابقة"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-gray-400 font-mono px-2">صفحة {moviesPage}</span>
                    <button
                      onClick={() => {
                        const next = moviesPage + 1;
                        setMoviesPage(next);
                        fetchHomeData(next, seriesPage);
                      }}
                      className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white"
                      title="الصفحة التالية"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {movies.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {movies.map((m, i) => (
                    <MediaCard key={`movie-${i}-${m.url}`} item={m} onClick={handleMediaClick} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-900/60 rounded-2xl border border-gray-800 text-gray-400 text-sm">
                  لا توجد أفلام متاحة حالياً.
                </div>
              )}
            </section>
          )}

          {/* Series Section */}
          {(homeTab === 'all' || homeTab === 'series') && (
            <section id="series-section" className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-purple-500/10 rounded-xl text-purple-400 border border-purple-500/20">
                    <Tv className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-white">أحدث المسلسلات</h2>
                </div>

                {homeTab === 'series' && (
                  <div className="flex items-center gap-2">
                    <button
                      disabled={seriesPage <= 1}
                      onClick={() => {
                        const next = Math.max(1, seriesPage - 1);
                        setSeriesPage(next);
                        fetchHomeData(moviesPage, next);
                      }}
                      className="p-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 rounded-lg text-white"
                      title="الصفحة السابقة"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-gray-400 font-mono px-2">صفحة {seriesPage}</span>
                    <button
                      onClick={() => {
                        const next = seriesPage + 1;
                        setSeriesPage(next);
                        fetchHomeData(moviesPage, next);
                      }}
                      className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white"
                      title="الصفحة التالية"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {series.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {series.map((s, i) => (
                    <MediaCard key={`series-${i}-${s.url}`} item={s} onClick={handleMediaClick} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-900/60 rounded-2xl border border-gray-800 text-gray-400 text-sm">
                  لا توجد مسلسلات متاحة حالياً.
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* Series Episodes View */}
      {!loading && view === 'series' && currentMedia && (
        <div className="animate-in fade-in duration-300 space-y-6">
          <button
            onClick={() => setView('home')}
            className="flex items-center gap-2 text-gray-300 hover:text-white bg-gray-800/80 hover:bg-gray-800 px-4 py-2 rounded-xl transition-colors border border-gray-700/50 text-sm font-semibold"
          >
            <ArrowRight className="w-4 h-4" />
            عودة للقائمة الرئيسية
          </button>

          {/* Series Hero Banner */}
          <div className="bg-gray-800/60 border border-gray-700/50 rounded-2xl p-6 flex flex-col md:flex-row gap-6 items-center md:items-start">
            {currentMedia.image && (
              <img
                src={currentMedia.image}
                alt={currentMedia.title}
                className="w-40 md:w-48 aspect-[2/3] object-cover rounded-xl shadow-2xl border border-gray-700"
                referrerPolicy="no-referrer"
              />
            )}

            <div className="flex-1 text-center md:text-right space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-500/20 text-purple-300 rounded-lg text-xs font-bold">
                <Tv className="w-3.5 h-3.5" />
                مسلسل
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white">{currentMedia.title}</h1>
              {currentMedia.rating && (
                <div className="inline-flex items-center gap-1 bg-yellow-500/20 text-yellow-300 px-2.5 py-1 rounded-md text-xs font-bold">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <span>{currentMedia.rating}</span>
                </div>
              )}
              <p className="text-gray-400 text-sm leading-relaxed max-w-2xl">
                اختر الحلقة المطلوبة لتشغيلها عبر المشغل المتطور فوراً بدون إعلانات مزعجة.
              </p>
            </div>
          </div>

          {/* Episode search & filter */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>قائمة الحلقات</span>
              <span className="text-xs bg-gray-800 text-gray-400 px-2.5 py-0.5 rounded-full border border-gray-700">
                {episodes.length} حلقة
              </span>
            </h2>

            <input
              type="text"
              placeholder="تصفية الحلقات بالرقم أو العنوان..."
              value={episodeSearch}
              onChange={(e) => setEpisodeSearch(e.target.value)}
              className="w-full sm:w-72 bg-gray-800/80 border border-gray-700 rounded-xl px-4 py-2 text-xs text-white placeholder-gray-400 outline-none focus:border-blue-500"
            />
          </div>

          {filteredEpisodes.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredEpisodes.map((ep, idx) => (
                <div
                  key={`ep-${idx}-${ep.url}`}
                  className="bg-gray-800/80 hover:bg-blue-600/20 border border-gray-700/60 hover:border-blue-500/60 p-4 rounded-xl flex justify-between items-center cursor-pointer transition-all group"
                  onClick={() => {
                    setCurrentMedia({
                      ...currentMedia,
                      title: `${currentMedia.title} - ${ep.title}`,
                    });
                    fetchVideoLinks(ep.url);
                  }}
                >
                  <span className="font-semibold text-sm text-gray-200 group-hover:text-white truncate">
                    {ep.title}
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-gray-700/80 group-hover:bg-blue-600 flex items-center justify-center transition-colors shrink-0 mr-2">
                    <Play className="w-4 h-4 text-gray-300 group-hover:text-white fill-current ml-0.5" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-900/60 rounded-2xl border border-gray-800 text-gray-400 text-sm">
              لا توجد حلقات تطابق بحثك.
            </div>
          )}
        </div>
      )}

      {/* Watch & Player View */}
      {!loading && view === 'watch' && currentMedia && (
        <div className="animate-in fade-in duration-300 max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() =>
                currentMedia.url.includes('series') || episodes.length > 0
                  ? setView('series')
                  : setView('home')
              }
              className="flex items-center gap-2 text-gray-300 hover:text-white bg-gray-800/80 hover:bg-gray-800 px-4 py-2 rounded-xl transition-colors border border-gray-700/50 text-sm font-semibold"
            >
              <ArrowRight className="w-4 h-4" />
              عودة
            </button>

            <h1 className="text-lg md:text-2xl font-black text-white truncate max-w-xl text-left">
              {currentMedia.title}
            </h1>
          </div>

          {videoLinks.length > 0 && activeStreamUrl ? (
            <div className="space-y-5">
              {/* Video.js Modern Player */}
              <div className="rounded-2xl overflow-hidden shadow-2xl border border-gray-800 bg-black">
                <VideoPlayer
                  key={`${streamMode}-${activeStreamUrl}`}
                  streamUrl={activeStreamUrl}
                  title={currentMedia.title}
                  poster={currentMedia.image}
                  subtitles={mediaSubtitles}
                  autoplay={true}
                  onError={() => setVideoError(true)}
                />
              </div>

              {/* Streaming Mode Switcher Banner */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-900/90 border border-gray-800 p-3.5 rounded-2xl">
                <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-300">
                  <span className="font-semibold text-gray-400">وضع البث:</span>
                  <div className="flex items-center bg-gray-800 p-1 rounded-xl border border-gray-700/60">
                    <button
                      onClick={() => {
                        setStreamMode('proxy');
                        setVideoError(false);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        streamMode === 'proxy'
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                          : 'text-gray-400 hover:text-white'
                      }`}
                      title="تشغيل الفيديو عبر وسيط البروكسي الداخلي لدعم HLS وتخطي قيود CORS"
                    >
                      <Shield className="w-3.5 h-3.5 text-cyan-300" />
                      <span>عبر الوسيط (Proxy + Range)</span>
                    </button>

                    <button
                      onClick={() => {
                        setStreamMode('direct');
                        setVideoError(false);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        streamMode === 'direct'
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                          : 'text-gray-400 hover:text-white'
                      }`}
                      title="تشغيل رابط المصدر المباشر"
                    >
                      <Zap className="w-3.5 h-3.5 text-yellow-300" />
                      <span>رابط المصدر (Direct)</span>
                    </button>
                  </div>
                </div>

                <div className="text-xs text-gray-400 font-mono dir-ltr truncate max-w-xs md:max-w-md">
                  {streamMode === 'proxy'
                    ? '🛡️ Proxied Range & HLS Engine (/api/stream)'
                    : '⚡ Direct Source URL'}
                </div>
              </div>

              {/* Video Error Warning Banner */}
              {videoError && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 p-4 rounded-xl text-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-right">
                    <p className="font-semibold">
                      {streamMode === 'direct'
                        ? 'تعذر التشغيل المباشر من المصدر (قد يمنع خادم الفيديو طلبات CORS أو النطاق العريض).'
                        : 'قد يكون رابط البث المباشر قد انتهت صلاحيته من المصدر أو يتطلب تحديثاً.'}
                    </p>
                    <p className="text-xs text-yellow-400/80 mt-1">
                      {streamMode === 'direct'
                        ? 'يمكنك التبديل إلى "عبر الوسيط (Proxy)" أو فتح الرابط في نافذة جديدة.'
                        : 'انقر على "تحديث الرابط" لإعادة توليد رابط فيديو طازج.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setStreamMode(streamMode === 'proxy' ? 'direct' : 'proxy');
                        setVideoError(false);
                      }}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs transition-colors"
                    >
                      تبديل الوضع
                    </button>
                    <button
                      onClick={() => fetchVideoLinks(currentMedia.url)}
                      className="px-3.5 py-1.5 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg flex items-center gap-1 text-xs transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      تحديث الرابط
                    </button>
                  </div>
                </div>
              )}

              {/* Quality Selector and Actions */}
              <div className="bg-gray-800/90 border border-gray-700/60 p-5 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between shadow-xl">
                <div className="flex items-center gap-2 flex-wrap justify-center md:justify-start">
                  <span className="text-gray-400 text-sm font-medium ml-2">الجودة:</span>
                  {videoLinks.map((link, idx) => (
                    <button
                      key={`quality-${idx}-${link.url}`}
                      onClick={() => setSelectedQualityIdx(idx)}
                      className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                        selectedQualityIdx === idx
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-105'
                          : 'bg-gray-700/80 text-gray-300 hover:bg-gray-700 hover:text-white'
                      }`}
                    >
                      {link.quality}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2.5 flex-wrap justify-center md:justify-end">
                  {/* Refresh Video Link Button */}
                  <button
                    onClick={() => fetchVideoLinks(currentMedia.url)}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-xl text-xs sm:text-sm font-semibold transition-colors"
                    title="إعادة استخراج وتوليد رابط جديد"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>تحديث الرابط</span>
                  </button>

                  {/* Embed Video Button */}
                  <button
                    onClick={() => {
                      setEmbedVideoUrl(activeLink.url);
                      setEmbedTitle(currentMedia.title);
                      setIsEmbedOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md shadow-blue-500/20"
                    title="الحصول على كود تضمين متجاوب للموقع"
                  >
                    <Code2 className="w-4 h-4" />
                    <span>تضمين (Embed)</span>
                  </button>

                  {/* Direct Download Button */}
                  <a
                    href={`/api/download?url=${encodeURIComponent(activeLink.url)}&title=${encodeURIComponent(currentMedia.title)}`}
                    download
                    className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-500 rounded-xl font-bold text-white text-xs sm:text-sm transition-all shadow-lg shadow-green-600/20"
                  >
                    <Download className="w-4 h-4" />
                    تحميل ({activeLink.quality})
                  </a>
                </div>
              </div>

              {/* Story / Description if available */}
              {mediaStory && (
                <div className="bg-gray-900/60 border border-gray-800 p-5 rounded-2xl text-gray-300 text-sm leading-relaxed">
                  <h3 className="font-bold text-white mb-2 text-base">قصة العمل:</h3>
                  <p className="text-gray-400">{mediaStory}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-20 bg-gray-900/60 border border-gray-800 rounded-2xl">
              <AlertCircle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-lg text-gray-300 font-medium">لم يتم العثور على روابط تشغيل لهذا العنصر.</p>
              <p className="text-sm text-gray-500 mt-1">قد يكون المحتوى قيد التحديث في المصدر.</p>
            </div>
          )}
        </div>
      )}

      {/* Embed Code Modal */}
      <EmbedModal
        isOpen={isEmbedOpen}
        onClose={() => setIsEmbedOpen(false)}
        defaultVideoUrl={embedVideoUrl}
        defaultTitle={embedTitle}
      />
    </div>
  );
}

// Subcomponent for Media Card
function MediaCard({
  item,
  onClick,
}: {
  item: MediaItem;
  onClick: (item: MediaItem) => void;
}) {
  return (
    <div
      className="group bg-gray-800/90 hover:bg-gray-800 border border-gray-700/50 hover:border-blue-500/80 rounded-2xl overflow-hidden shadow-lg cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-blue-500/10 flex flex-col"
      onClick={() => onClick(item)}
    >
      <div className="relative aspect-[2/3] w-full bg-gray-900 overflow-hidden">
        {item.image ? (
          <img
            src={item.image}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full bg-gray-800 flex items-center justify-center">
            <Film className="w-10 h-10 text-gray-600" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-gray-950/90 via-transparent to-transparent opacity-60 group-hover:opacity-30 transition-opacity" />

        {item.quality && (
          <div className="absolute top-2 right-2 bg-blue-600/90 backdrop-blur-sm text-white text-[10px] sm:text-[11px] px-2 py-0.5 rounded-md font-bold shadow-md">
            {item.quality}
          </div>
        )}

        {item.rating && (
          <div className="absolute bottom-2 left-2 bg-gray-950/80 backdrop-blur-sm text-yellow-400 text-xs px-2 py-0.5 rounded-md font-bold flex items-center gap-1 shadow-md">
            <span>★</span>
            <span>{item.rating}</span>
          </div>
        )}

        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
          <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg transform scale-75 group-hover:scale-100 transition-transform">
            <Play className="w-6 h-6 fill-white ml-0.5" />
          </div>
        </div>
      </div>

      <div className="p-3 flex-1 flex flex-col justify-between">
        <h3 className="text-xs sm:text-sm font-semibold text-gray-200 group-hover:text-blue-400 line-clamp-2 transition-colors">
          {item.title}
        </h3>
        {item.year && <span className="text-[11px] text-gray-500 mt-1">{item.year}</span>}
      </div>
    </div>
  );
}
