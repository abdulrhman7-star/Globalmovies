import { NextResponse } from 'next/server';
import { Agent } from 'undici';

export const dynamic = 'force-dynamic';

const downloadAgent = new Agent({
  connect: {
    rejectUnauthorized: false
  }
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get('url');
  const filename = searchParams.get('title') || 'downloaded_video.mp4';

  if (!videoUrl) {
    return NextResponse.json({ success: false, error: 'رابط الفيديو مطلوب' }, { status: 400 });
  }

  try {
    const headers: Record<string, string> = {
      'Referer': 'https://akwam.ss/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    };

    const response = await fetch(videoUrl, {
      dispatcher: downloadAgent,
      headers,
      redirect: 'follow',
      cache: 'no-store'
    } as any);

    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.statusText}`);
    }

    const safeFilename = encodeURIComponent(filename.replace(/[/\\?%*:|"<>]/g, '_'));

    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
    responseHeaders.set('Content-Disposition', `attachment; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`);
    
    if (response.headers.has('content-length')) {
      responseHeaders.set('Content-Length', response.headers.get('content-length') as string);
    }

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });

  } catch (error: any) {
    console.error('Download error:', error);
    return new Response('فشل في تحميل الفيديو', { status: 500 });
  }
}


