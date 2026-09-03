"use client";

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Play, AlertCircle, RefreshCw, Settings, Check } from 'lucide-react';
import VideoPlayer from '@/components/VideoPlayer';

interface VideoQuality {
  quality: string;
  url: string;
  streamUrl?: string;
}

function EmbedPlayerContent() {
  const searchParams = useSearchParams();
  const rawSrc = searchParams.get('src') || '';
  const rawUrl = searchParams.get('url') || '';
  const rawTitle = searchParams.get('title') || '';
  const autoplay = searchParams.get('autoplay') === '1' || searchParams.get('autoplay') === 'true';
  const muted = searchParams.get('muted') === '1' || searchParams.get('muted') === 'true';
  const poster = searchParams.get('poster') || '';
  const paramMode = searchParams.get('mode') || 'proxy';

  const [streamMode, setStreamMode] = useState<'direct' | 'proxy'>(
    paramMode === 'direct' ? 'direct' : 'proxy'
  );
  const [videoSrc, setVideoSrc] = useState<string>(rawSrc);
  const [qualities, setQualities] = useState<VideoQuality[]>(
    rawSrc ? [{ quality: 'HD', url: rawSrc }] : []
  );
  const [selectedQualityIdx, setSelectedQualityIdx] = useState<number>(0);
  const [title] = useState<string>(rawTitle);
  const [loading, setLoading] = useState<boolean>(!rawSrc && Boolean(rawUrl));
  const [error, setError] = useState<string>('');
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // If a page URL (e.g. Akwam link) is passed instead of a direct src, fetch the video link
  useEffect(() => {
    let isCancelled = false;
    if (!rawSrc && rawUrl) {
      fetch(`/api/get-link?url=${encodeURIComponent(rawUrl)}`)
        .then((res) => res.json())
        .then((data) => {
          if (!isCancelled) {
            if (data.success && Array.isArray(data.data) && data.data.length > 0) {
              setQualities(data.data);
              setSelectedQualityIdx(0);
              setVideoSrc(data.data[0].url);
            } else {
              setError(data.error || 'تعذر استخراج رابط الفيديو');
            }
          }
        })
        .catch(() => {
          if (!isCancelled) {
            setError('فشل في جلب رابط الفيديو من الخادم');
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
  }, [rawSrc, rawUrl]);

  const handleQualityChange = (idx: number) => {
    if (!qualities[idx]) return;
    setSelectedQualityIdx(idx);
    setVideoSrc(qualities[idx].url);
    setShowSettings(false);
  };

  const activeQuality = qualities[selectedQualityIdx];
  const effectiveStreamUrl = activeQuality
    ? streamMode === 'direct'
      ? activeQuality.url
      : activeQuality.streamUrl || `/api/stream?url=${encodeURIComponent(activeQuality.url)}`
    : videoSrc
    ? streamMode === 'direct'
      ? videoSrc
      : videoSrc.startsWith('/api/stream')
      ? videoSrc
      : `/api/stream?url=${encodeURIComponent(videoSrc)}`
    : '';

  return (
    <div
      id="embed-player-wrapper"
      className="relative w-full h-screen bg-black overflow-hidden flex items-center justify-center select-none font-sans"
      dir="rtl"
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 text-white">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium text-gray-300">جاري تجهيز البث...</span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center p-6 text-center max-w-md bg-gray-900/90 border border-gray-800 rounded-2xl m-4">
          <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
          <p className="text-white text-base font-semibold mb-2">{error}</p>
          <p className="text-gray-400 text-xs mb-4">
            {streamMode === 'direct'
              ? 'قد يكون الرابط المباشر مقيداً بـ CORS أو منتهي الصلاحية.'
              : 'تأكد من صحة الرابط أو صلاحية البث المباشر.'}
          </p>
          <div className="flex items-center gap-2">
            {streamMode === 'direct' ? (
              <button
                onClick={() => {
                  setStreamMode('proxy');
                  setError('');
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all"
              >
                التبديل إلى الوسيط (Proxy)
              </button>
            ) : (
              <button
                onClick={() => {
                  setStreamMode('direct');
                  setError('');
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all"
              >
                تجربة الرابط المباشر
              </button>
            )}
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-xs font-bold transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" /> إعادة المحاولة
            </button>
          </div>
        </div>
      ) : effectiveStreamUrl ? (
        <div className="relative w-full h-full flex items-center justify-center">
          <VideoPlayer
            key={`${streamMode}-${effectiveStreamUrl}`}
            streamUrl={effectiveStreamUrl}
            title={title}
            poster={poster}
            autoplay={autoplay}
            muted={muted}
            onError={() => {
              setError(
                streamMode === 'direct'
                  ? 'تعذر تشغيل الرابط المباشر (قيود CORS أو الصيغة).'
                  : 'تعذر تشغيل الفيديو داخل المشغل المضمن'
              );
            }}
            className="w-full h-full max-h-screen"
          />

          {/* Top Title Overlay */}
          {title && (
            <div className="absolute top-0 inset-x-0 bg-gradient-to-b from-black/80 via-black/40 to-transparent p-4 flex items-center justify-between text-white pointer-events-none z-10">
              <span className="text-sm md:text-base font-bold truncate drop-shadow-md">
                {title}
              </span>
            </div>
          )}

          {/* Quality Selector Overlay */}
          {qualities.length > 1 && (
            <div className="absolute top-4 left-4 z-20">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 bg-black/60 hover:bg-black/90 backdrop-blur-md rounded-lg text-white text-xs flex items-center gap-1.5 border border-white/10 transition-all"
                title="تغيير الجودة"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>{qualities[selectedQualityIdx]?.quality || 'الجودة'}</span>
              </button>

              {showSettings && (
                <div className="absolute left-0 mt-2 bg-gray-900/95 border border-gray-700/80 rounded-xl p-2 shadow-2xl backdrop-blur-md min-w-[120px] flex flex-col gap-1 z-30 animate-in fade-in">
                  <span className="text-[11px] text-gray-400 font-semibold px-2 py-1 border-b border-gray-800">
                    اختر الجودة:
                  </span>
                  {qualities.map((q, idx) => (
                    <button
                      key={`embed-q-${idx}`}
                      onClick={() => handleQualityChange(idx)}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        selectedQualityIdx === idx
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                      }`}
                    >
                      <span>{q.quality}</span>
                      {selectedQualityIdx === idx && <Check className="w-3 h-3 ml-1" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-6 text-center text-gray-400">
          <Play className="w-12 h-12 text-gray-600 mb-3" />
          <p className="text-sm font-medium">يرجى تزويد رابط الفيديو عبر المعامل ?src= أو ?url=</p>
          <code className="text-xs bg-gray-800 text-blue-400 p-2 rounded mt-3 dir-ltr">
            /embed?src=https://example.com/video.mp4
          </code>
        </div>
      )}
    </div>
  );
}

export default function EmbedPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full h-screen bg-black flex items-center justify-center text-white">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <EmbedPlayerContent />
    </Suspense>
  );
}

