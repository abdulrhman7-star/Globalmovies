import { NextResponse } from 'next/server';
import { getCleanLink } from '@/lib/akwam';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url')?.trim();

  if (!url) {
    return NextResponse.json(
      { success: false, error: 'الرابط مطلوب (?url=)' },
      { status: 400 }
    );
  }

  try {
    const links = await getCleanLink(url);
    const origin = new URL(request.url).origin;

    const data = links.map((link) => {
      const stream = new URL('/api/stream', origin);
      stream.searchParams.set('url', link.url);

      return {
        quality: link.quality,
        url: link.url,
        isM3u8: Boolean(link.isM3u8),
        streamUrl: stream.toString(),
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'تعذر استخراج روابط الفيديو' },
      { status: 500 }
    );
  }
}

