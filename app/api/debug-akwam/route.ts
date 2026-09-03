import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const url =
    'https://ak.sv/movies?category=0&formats=0&language=0&quality=0&rating=0&section=0&year=0&page=1';

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      cache: 'no-store',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36',

        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',

        'Accept-Language':
          'ar,en-US;q=0.9,en;q=0.8',

        Referer:
          'https://ak.sv/',
      },
    });

    const html = await response.text();

    return NextResponse.json({
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,

      requestedUrl: url,

      finalUrl: response.url,

      contentType:
        response.headers.get('content-type'),

      contentLength:
        html.length,

      first1000:
        html.substring(0, 1000),

      movieLinks:
        (html.match(/\/movie\//gi) || []).length,

      seriesLinks:
        (html.match(/\/series\//gi) || []).length,

      episodeLinks:
        (html.match(/\/episode\//gi) || []).length,

      hasCloudflare:
        /cloudflare|checking your browser|just a moment/i.test(
          html
        ),

      hasAkwam:
        /akwam|ak\.sv/i.test(html),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          String(error),
      },
      { status: 500 }
    );
  }
}
