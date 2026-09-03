import { NextResponse } from 'next/server';
import { search } from '@/lib/akwam';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() || '';
  const page = Math.max(1, Number(searchParams.get('page') || 1));

  if (!q) {
    return NextResponse.json(
      {
        success: false,
        error: 'كلمة البحث مطلوبة (?q=)',
      },
      { status: 400 }
    );
  }

  if (q.length > 100) {
    return NextResponse.json(
      {
        success: false,
        error: 'عبارة البحث طويلة جداً',
      },
      { status: 400 }
    );
  }

  try {
    const data = await search(q, page);
    return NextResponse.json(
      {
        success: true,
        source: 'ak.sv',
        query: q,
        page,
        count: data.length,
        data,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (error: any) {
    console.error('Akwam search error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'فشل البحث',
      },
      { status: 502 }
    );
  }
}

