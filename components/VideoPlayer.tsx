"use client";

import { useEffect, useRef } from 'react';
import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';

export interface SubtitleTrack {
  label: string;
  lang: string;
  src: string;
}

interface VideoPlayerProps {
  streamUrl: string;
  title?: string;
  poster?: string;
  subtitles?: SubtitleTrack[];
  autoplay?: boolean;
  muted?: boolean;
  onError?: () => void;
  className?: string;
}

export default function VideoPlayer({
  streamUrl,
  title = '',
  poster = '',
  subtitles = [],
  autoplay = false,
  muted = false,
  onError,
  className = '',
}: VideoPlayerProps) {
  const videoNodeRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<Player | null>(null);

  useEffect(() => {
    if (!streamUrl || !videoNodeRef.current) {
      return;
    }

    // Clean up previous instance
    if (playerRef.current) {
      try {
        playerRef.current.dispose();
      } catch {}
      playerRef.current = null;
    }

    const isHls =
      streamUrl.toLowerCase().includes('.m3u8') ||
      streamUrl.toLowerCase().includes('m3u8');

    const player = videojs(videoNodeRef.current, {
      controls: true,
      responsive: true,
      fluid: true,
      preload: 'metadata',
      autoplay,
      muted,
      poster: poster || undefined,
      playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
      sources: [
        {
          src: streamUrl,
          type: isHls ? 'application/x-mpegURL' : 'video/mp4',
        },
      ],
      controlBar: {
        children: [
          'playToggle',
          'volumePanel',
          'currentTimeDisplay',
          'timeDivider',
          'durationDisplay',
          'progressControl',
          'playbackRateMenuButton',
          'subsCapsButton',
          'pictureInPictureToggle',
          'fullscreenToggle',
        ],
      },
    });

    playerRef.current = player;

    // Attach subtitles
    if (Array.isArray(subtitles)) {
      subtitles.forEach((sub) => {
        if (!sub?.src) return;
        player.addRemoteTextTrack(
          {
            kind: 'subtitles',
            src: sub.src,
            srclang: sub.lang || 'ar',
            label: sub.label || 'العربية',
            default: sub.lang === 'ar',
          },
          false
        );
      });
    }

    const errorHandler = () => {
      const err = player.error();
      if (err) {
        console.warn('Video.js player error code:', err.code, err.message);
        onError?.();
      }
    };

    player.on('error', errorHandler);

    // Progress persistence in localStorage
    const storageKey = `watch_pos:${encodeURIComponent(streamUrl.slice(0, 120))}`;
    try {
      const saved = Number(localStorage.getItem(storageKey) || '0');
      if (Number.isFinite(saved) && saved > 5) {
        player.one('loadedmetadata', () => {
          try {
            player.currentTime(saved);
          } catch {}
        });
      }
    } catch {}

    const saveTime = () => {
      try {
        const cur = player.currentTime();
        if (typeof cur === 'number' && cur > 5) {
          localStorage.setItem(storageKey, String(cur));
        }
      } catch {}
    };

    player.on('timeupdate', saveTime);

    return () => {
      try {
        player.off('error', errorHandler);
        player.off('timeupdate', saveTime);
        player.dispose();
      } catch {}
      playerRef.current = null;
    };
  }, [streamUrl, autoplay, muted, poster, subtitles, onError]);

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl bg-black ${className}`}
      style={{ aspectRatio: '16 / 9' }}
      dir="ltr"
    >
      <div data-vjs-player className="w-full h-full">
        <video
          ref={videoNodeRef}
          className="video-js vjs-big-play-centered w-full h-full"
          playsInline
          aria-label={title || 'مشغل الفيديو'}
        />
      </div>
    </div>
  );
}
