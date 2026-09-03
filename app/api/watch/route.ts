import { NextResponse } from 'next/server';
import { getDetails, getCleanLink } from '@/lib/akwam';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pageUrl = searchParams.get('url')?.trim();

  if (!pageUrl) {
    return NextResponse.json(
      {
        success: false,
        error: 'رابط صفحة المحتوى مطلوب (?url=)',
      },
      { status: 400 }
    );
  }

  try {
    // Try to get complete details including subtitles and story
    let details;
    try {
      details = await getDetails(pageUrl);
    } catch {
      // Fallback to getCleanLink directly
      const links = await getCleanLink(pageUrl);
      details = {
        title: '',
        image: '',
        links,
        subtitles: [],
      };
    }

    if (!details.links || details.links.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'لم يتم العثور على روابط تشغيل لهذا المحتوى حالياً',
        },
        { status: 404 }
      );
    }

    const origin = new URL(request.url).origin;

    const formattedLinks = details.links.map((link) => {
      const stream = new URL('/api/stream', origin);
      stream.searchParams.set('url', link.url);

      return {
        quality: link.quality,
        url: link.url,
        isM3u8: Boolean(link.isM3u8),
        streamUrl: stream.toString(),
      };
    });

    return NextResponse.json(
      {
        success: true,
        source: 'ak.sv',
        title: details.title,
        image: details.image,
        story: details.story,
        rating: details.rating,
        quality: details.quality,
        year: details.year,
        duration: details.duration,
        genres: details.genres,
        subtitles: details.subtitles || [],
        data: formattedLinks,
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error: any) {
    console.error('Watch extraction error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'فشل استخراج رابط الفيديو',
      },
      { status: 502 }
    );
  }
}

