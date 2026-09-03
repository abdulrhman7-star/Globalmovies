import { NextResponse } from 'next/server';
import { getMovies } from '@/lib/akwam';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));

  try {
    const movies = await getMovies(page);
    return NextResponse.json({
      success: true,
      page,
      count: movies.length,
      data: movies,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'تعذر جلب قائمة الأفلام' },
      { status: 500 }
    );
  }
}

