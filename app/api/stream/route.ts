import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_HOSTS = new Set([
  'ak.sv',
  'www.ak.sv',
  'downet.net',
  'akwam.cx',
  'akwam.ss',
  'akwam.to',
]);

function isAllowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    ALLOWED_HOSTS.has(host) ||
    host.endsWith('.downet.net') ||
    host.endsWith('.ak.sv') ||
    host.endsWith('.akwam.cx') ||
    host.endsWith('.akwam.ss') ||
    host.endsWith('.akwam.to') ||
    host.includes('akwam')
  );
}

function getMimeType(url: string, upstream?: string | null): string {
  const lower = url.toLowerCase();

  if (lower.includes('.m3u8')) {
    return 'application/vnd.apple.mpegurl';
  }
  if (lower.includes('.webm')) {
    return 'video/webm';
  }
  if (lower.includes('.mp4')) {
    return 'video/mp4';
  }
  if (lower.includes('.mkv')) {
    return 'video/mp4';
  }
  if (upstream && upstream !== 'application/octet-stream') {
    return upstream;
  }
  return 'video/mp4';
}

function buildStreamUrl(request: Request, url: string): string {
  const result = new URL('/api/stream', request.url);
  result.searchParams.set('url', url);
  return result.toString();
}

function rewriteHlsPlaylist(playlist: string, baseUrl: string, request: Request): string {
  return playlist
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      // HLS tags/comments
      if (trimmed.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/g, (_, uri) => {
          try {
            const absolute = new URL(uri, baseUrl).href;
            return `URI="${buildStreamUrl(request, absolute)}"`;
          } catch {
            return `URI="${uri}"`;
          }
        });
      }

      // Segment URL lines
      try {
        const absolute = new URL(trimmed, baseUrl).href;
        return buildStreamUrl(request, absolute);
      } catch {
        return line;
      }
    })
    .join('\n');
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get('url');

  if (!rawUrl) {
    return NextResponse.json({ success: false, error: 'رابط الفيديو مطلوب' }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return NextResponse.json({ success: false, error: 'رابط الفيديو غير صالح' }, { status: 400 });
  }

  if (target.protocol !== 'https:' && target.protocol !== 'http:') {
    return NextResponse.json({ success: false, error: 'بروتوكول الرابط غير صالح' }, { status: 400 });
  }

  if (!isAllowedHost(target.hostname)) {
    return NextResponse.json({ success: false, error: 'نطاق الفيديو غير مسموح به' }, { status: 403 });
  }

  const range = request.headers.get('range');
  const upstreamHeaders = new Headers();

  upstreamHeaders.set(
    'User-Agent',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
  );
  upstreamHeaders.set('Accept', '*/*');
  upstreamHeaders.set('Referer', `${target.protocol}//${target.hostname}/`);

  if (range) {
    upstreamHeaders.set('Range', range);
  }

  try {
    const upstream = await fetch(target.href, {
      method: 'GET',
      headers: upstreamHeaders,
      redirect: 'follow',
      cache: 'no-store',
    });

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json(
        {
          success: false,
          error: `مصدر الفيديو أعاد HTTP ${upstream.status}`,
          upstreamStatus: upstream.status,
          expired: upstream.status === 403 || upstream.status === 404 || upstream.status === 500,
        },
        {
          status: upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502,
        }
      );
    }

    const upstreamType = upstream.headers.get('content-type');
    const isHls =
      target.pathname.toLowerCase().includes('.m3u8') ||
      Boolean(upstreamType?.includes('mpegurl')) ||
      Boolean(upstreamType?.includes('x-mpegurl'));

    if (isHls) {
      const playlist = await upstream.text();
      const rewritten = rewriteHlsPlaylist(playlist, target.href, request);

      return new Response(rewritten, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'no-store, max-age=0',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Range, Content-Type',
          'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
          'Accept-Ranges': 'bytes',
        },
      });
    }

    const headers = new Headers();
    headers.set('Content-Type', getMimeType(target.href, upstreamType));
    headers.set('Content-Disposition', 'inline');
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Headers', 'Range, Content-Type');
    headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

    const contentLength = upstream.headers.get('content-length');
    const contentRange = upstream.headers.get('content-range');

    if (contentLength) {
      headers.set('Content-Length', contentLength);
    }
    if (contentRange) {
      headers.set('Content-Range', contentRange);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    console.error('Stream proxy error:', error);
    return NextResponse.json(
      { success: false, error: 'تعذر الاتصال بمصدر الفيديو' },
      { status: 502 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}



