import { NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// GET /api/download?url=...
// Proxies image downloads from kakaocdn to bypass CORS restrictions.
// ---------------------------------------------------------------------------
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return NextResponse.json(
      { error: 'Missing "url" query parameter' },
      { status: 400 }
    );
  }

  // Only allow kakaocdn.net URLs for security
  try {
    const parsed = new URL(imageUrl);
    if (!parsed.hostname.endsWith('kakaocdn.net')) {
      return NextResponse.json(
        { error: 'Only kakaocdn.net URLs are allowed' },
        { status: 403 }
      );
    }
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  try {
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        Referer: 'https://pf.kakao.com/',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch image: ${response.status}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = await response.arrayBuffer();

    // Extract filename from URL
    const urlPath = new URL(imageUrl).pathname;
    const filename = `menu_${Date.now()}.jpg`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'public, max-age=86400', // cache for 1 day
      },
    });
  } catch (error) {
    console.error('[api/download] Error:', error.message);
    return NextResponse.json(
      { error: 'Failed to download image' },
      { status: 500 }
    );
  }
}
