"use client";

import { useState, useEffect } from 'react';
import { 
  Code2, 
  Copy, 
  Check, 
  X, 
  Smartphone, 
  Tablet, 
  Monitor, 
  Layers, 
  Settings2, 
  Play, 
  ExternalLink,
  Sparkles,
  ShieldCheck
} from 'lucide-react';

interface EmbedModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultVideoUrl?: string;
  defaultTitle?: string;
}

export default function EmbedModal({
  isOpen,
  onClose,
  defaultVideoUrl = '',
  defaultTitle = 'فيديو متجاوب'
}: EmbedModalProps) {
  const [customVideoUrl, setCustomVideoUrl] = useState<string | null>(null);
  const [customVideoTitle, setCustomVideoTitle] = useState<string | null>(null);
  const [formatType, setFormatType] = useState<'modern' | 'classic' | 'tailwind' | 'directVideo'>('modern');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [autoplay, setAutoplay] = useState(false);
  const [muted, setMuted] = useState(false);
  const [roundedCorners, setRoundedCorners] = useState(true);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const videoUrl = customVideoUrl !== null ? customVideoUrl : defaultVideoUrl;
  const videoTitle = customVideoTitle !== null ? customVideoTitle : defaultTitle;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  // Build the embed iframe source URL
  const embedBase = origin ? `${origin}/embed` : '/embed';
  const targetEmbedSrc = `${embedBase}?src=${encodeURIComponent(videoUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4')}${videoTitle ? `&title=${encodeURIComponent(videoTitle)}` : ''}${autoplay ? '&autoplay=1' : ''}${muted ? '&muted=1' : ''}`;
  const directStreamUrl = origin && videoUrl ? `${origin}/api/stream?url=${encodeURIComponent(videoUrl)}` : videoUrl;

  // Generated code snippets
  const getEmbedCode = () => {
    const br = roundedCorners ? '12px' : '0px';

    if (formatType === 'modern') {
      return `<!-- كود تضمين فيديو متجاوب (Modern CSS - الأسهل والأحدث) -->
<div style="position: relative; width: 100%; max-width: 100%; aspect-ratio: 16 / 9; background: #000; border-radius: ${br}; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
  <iframe 
    src="${targetEmbedSrc}" 
    title="${videoTitle}"
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" 
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" 
    allowfullscreen>
  </iframe>
</div>`;
    }

    if (formatType === 'classic') {
      return `<!-- كود تضمين متوافق 100% مع جميع المنصات (WordPress, Blogger, HTML5) -->
<div style="position: relative; width: 100%; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: ${br}; background: #000;">
  <iframe 
    src="${targetEmbedSrc}" 
    title="${videoTitle}"
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" 
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" 
    allowfullscreen>
  </iframe>
</div>`;
    }

    if (formatType === 'tailwind') {
      return `<!-- كود تضمين متجاوب باستخدام Tailwind CSS -->
<div class="relative w-full aspect-video ${roundedCorners ? 'rounded-2xl' : ''} overflow-hidden shadow-2xl bg-black border border-gray-800">
  <iframe 
    src="${targetEmbedSrc}" 
    title="${videoTitle}"
    class="absolute inset-0 w-full h-full border-0" 
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" 
    allowfullscreen>
  </iframe>
</div>`;
    }

    // Direct Video Tag (HTML5 responsive 16:9)
    return `<!-- وسم فيديو HTML5 مباشر ومتجاوب (16:9 Direct Responsive Video) -->
<div style="position: relative; width: 100%; max-width: 900px; margin: 0 auto; aspect-ratio: 16 / 9; background: #000; border-radius: ${br}; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.35);">
  <video 
    controls 
    playsinline 
    preload="metadata"
    ${autoplay ? 'autoplay ' : ''}${muted ? 'muted ' : ''}
    style="width: 100%; height: 100%; object-fit: contain; display: block;"
  >
    <source src="${videoUrl || 'https://example.com/video.mp4'}" type="video/mp4">
    <source src="${videoUrl || 'https://example.com/video.mkv'}" type="video/x-matroska">
    متصفحك لا يدعم تشغيل الفيديو المباشر.
  </video>
</div>`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getEmbedCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-4xl max-h-[90vh] bg-gray-900 border border-gray-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-right"
        dir="rtl"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900/90 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                <span>تضمين الفيديو في موقعك (Responsive Embed)</span>
                <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-medium hidden sm:inline">
                  متجاوب 100%
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                انسخ كود الـ iframe الجاهز وضعه في أي موقع أو صفحة ويب ليعمل بسلاسة على الهواتف والشاشات.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* 1. URL & Title Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-800/50 p-4 rounded-xl border border-gray-700/50">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                رابط الفيديو أو البث (SRC):
              </label>
              <input
                type="text"
                value={videoUrl}
                onChange={(e) => setCustomVideoUrl(e.target.value)}
                placeholder="https://example.com/video.mp4"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3.5 py-2 text-sm text-white focus:border-blue-500 outline-none dir-ltr font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                عنوان الفيديو (Title):
              </label>
              <input
                type="text"
                value={videoTitle}
                onChange={(e) => setCustomVideoTitle(e.target.value)}
                placeholder="اسم الفيلم أو الحلقة"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3.5 py-2 text-sm text-white focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {/* 2. Format selector & toggles */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-800 pb-4">
            {/* Format Tabs */}
            <div className="flex items-center gap-1.5 bg-gray-800/80 p-1 rounded-xl border border-gray-700/60 flex-wrap">
              <button
                onClick={() => setFormatType('modern')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  formatType === 'modern' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                Modern CSS (16:9)
              </button>
              <button
                onClick={() => setFormatType('classic')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  formatType === 'classic' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                Classic Responsive (WordPress)
              </button>
              <button
                onClick={() => setFormatType('tailwind')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  formatType === 'tailwind' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                Tailwind CSS
              </button>
              <button
                onClick={() => setFormatType('directVideo')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  formatType === 'directVideo' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                وسم &lt;video&gt; مباشر
              </button>
            </div>

            {/* Options Toggles */}
            <div className="flex items-center gap-4 text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-gray-300 hover:text-white select-none">
                <input
                  type="checkbox"
                  checked={autoplay}
                  onChange={(e) => setAutoplay(e.target.checked)}
                  className="rounded bg-gray-800 border-gray-700 text-blue-600 focus:ring-0"
                />
                <span>تشغيل تلقائي</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-gray-300 hover:text-white select-none">
                <input
                  type="checkbox"
                  checked={muted}
                  onChange={(e) => setMuted(e.target.checked)}
                  className="rounded bg-gray-800 border-gray-700 text-blue-600 focus:ring-0"
                />
                <span>كتم الصوت</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-gray-300 hover:text-white select-none">
                <input
                  type="checkbox"
                  checked={roundedCorners}
                  onChange={(e) => setRoundedCorners(e.target.checked)}
                  className="rounded bg-gray-800 border-gray-700 text-blue-600 focus:ring-0"
                />
                <span>حواف دائرية</span>
              </label>
            </div>
          </div>

          {/* 3. Generated Code Box with Copy Button */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                الكود الجاهز للنسخ واللصق:
              </span>
              <button
                onClick={handleCopy}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  copied
                    ? 'bg-green-600 text-white shadow-lg shadow-green-600/30'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>تم النسخ بنجاح!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>نسخ الكود بالكامل</span>
                  </>
                )}
              </button>
            </div>

            <div className="relative group">
              <pre className="bg-gray-950 border border-gray-800 p-4 rounded-xl text-xs text-blue-300 font-mono overflow-x-auto dir-ltr max-h-44 leading-relaxed custom-scrollbar selection:bg-blue-900 selection:text-white">
                {getEmbedCode()}
              </pre>
            </div>
          </div>

          {/* 4. Live Responsive Preview Section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5 text-blue-400" />
                معاينة حية للمشغل المتجاوب:
              </span>

              {/* Device Selector */}
              <div className="flex items-center gap-1 bg-gray-800 p-1 rounded-lg border border-gray-700">
                <button
                  onClick={() => setPreviewDevice('desktop')}
                  className={`p-1.5 rounded-md text-xs flex items-center gap-1 transition-colors ${
                    previewDevice === 'desktop' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                  title="شاشة سطح المكتب (100%)"
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">كمبيوتر</span>
                </button>
                <button
                  onClick={() => setPreviewDevice('tablet')}
                  className={`p-1.5 rounded-md text-xs flex items-center gap-1 transition-colors ${
                    previewDevice === 'tablet' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                  title="شاشة تابلت (600px)"
                >
                  <Tablet className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">تابلت</span>
                </button>
                <button
                  onClick={() => setPreviewDevice('mobile')}
                  className={`p-1.5 rounded-md text-xs flex items-center gap-1 transition-colors ${
                    previewDevice === 'mobile' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                  title="شاشة هاتف (375px)"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">هاتف</span>
                </button>
              </div>
            </div>

            {/* Live responsive container box */}
            <div className="bg-gray-950 p-4 sm:p-6 rounded-2xl border border-gray-800 flex items-center justify-center overflow-hidden min-h-[260px]">
              <div
                className="transition-all duration-300 mx-auto"
                style={{
                  width:
                    previewDevice === 'mobile'
                      ? '340px'
                      : previewDevice === 'tablet'
                      ? '540px'
                      : '100%',
                  maxWidth: '100%'
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '16 / 9',
                    background: '#000',
                    borderRadius: roundedCorners ? '12px' : '0px',
                    overflow: 'hidden',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                  }}
                >
                  <iframe
                    src={targetEmbedSrc}
                    title={videoTitle}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      border: 0
                    }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                    allowFullScreen
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800 bg-gray-900/90">
          <div className="flex items-center gap-2 text-xs text-green-400">
            <ShieldCheck className="w-4 h-4 text-green-400" />
            <span>متوافق مع الهواتف الذكية، الحواسيب، والـ CMS.</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-semibold transition-colors"
            >
              إغلاق
            </button>
            <button
              onClick={handleCopy}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-500/20 flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>نسخ الكود</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
