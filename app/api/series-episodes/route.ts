import { NextResponse } from 'next/server';
import { getSeriesEpisodes } from '@/lib/akwam';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ success: false, error: 'رابط المسلسل مطلوب' }, { status: 400 });
  }

  try {
    const episodes = await getSeriesEpisodes(url);
    return NextResponse.json({ success: true, data: episodes });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
