import { NextResponse } from 'next/server';
import { getSeries } from '@/lib/akwam';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));

  try {
    const series = await getSeries(page);
    return NextResponse.json({
      success: true,
      page,
      count: series.length,
      data: series,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'تعذر جلب قائمة المسلسلات' },
      { status: 500 }
    );
  }
}

