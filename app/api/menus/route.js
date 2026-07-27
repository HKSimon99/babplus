import { NextResponse } from 'next/server';
import { scrapeMenus } from '@/lib/scraper';

// ---------------------------------------------------------------------------
// In-memory cache with stale check
// Persists across warm invocations on Vercel; re-fetches on cold start
// ---------------------------------------------------------------------------
let cachedData = null;
let lastFetchTime = 0;
let isFetching = false;

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours (하루에 1번)
const KEEP_DAYS = 7; // 7일 지난 메뉴 삭제

function filterRecentMenus(menus) {
  if (!Array.isArray(menus)) return [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - KEEP_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  return menus.filter((m) => m.date >= cutoffStr);
}

// ---------------------------------------------------------------------------
// GET /api/menus
// Returns cached menu data. If stale (>24h), triggers a fresh scrape.
// Query params:
//   ?force=true  — skip cache, force re-scrape
// ---------------------------------------------------------------------------
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const force = searchParams.get('force') === 'true';

  const now = Date.now();
  const cacheAge = now - lastFetchTime;
  const isCacheValid = cachedData && cacheAge < CACHE_DURATION && !force;

  // Return cached data immediately if valid (filtered to last 7 days)
  if (isCacheValid) {
    return NextResponse.json({
      menus: filterRecentMenus(cachedData),
      lastChecked: new Date(lastFetchTime).toISOString(),
      cacheAge: Math.round(cacheAge / 1000),
      status: 'cached',
    });
  }

  // Prevent concurrent scraping
  if (isFetching) {
    return NextResponse.json({
      menus: filterRecentMenus(cachedData || []),
      lastChecked: lastFetchTime ? new Date(lastFetchTime).toISOString() : null,
      status: 'fetching',
      message: '메뉴를 확인하는 중입니다. 잠시 후 다시 시도해주세요.',
    });
  }

  // Scrape fresh data
  try {
    isFetching = true;
    console.log('[api/menus] Starting fresh scrape...');

    const menus = await scrapeMenus();
    const filtered = filterRecentMenus(menus);

    // Only update cache if we got results (don't overwrite good cache with empty)
    if (filtered.length > 0) {
      cachedData = filtered;
      lastFetchTime = Date.now();
    } else if (!cachedData) {
      cachedData = [];
      lastFetchTime = Date.now();
    }

    console.log(`[api/menus] Scrape complete. Found ${filtered.length} valid menus (within 7 days).`);

    return NextResponse.json({
      menus: filterRecentMenus(cachedData),
      lastChecked: new Date(lastFetchTime).toISOString(),
      cacheAge: 0,
      status: cachedData.length > 0 ? 'success' : 'empty',
    });
  } catch (error) {
    console.error('[api/menus] Scrape error:', error.message);

    // Return stale cache if available
    if (cachedData) {
      return NextResponse.json({
        menus: filterRecentMenus(cachedData),
        lastChecked: lastFetchTime ? new Date(lastFetchTime).toISOString() : null,
        status: 'error_with_cache',
        error: error.message,
      });
    }

    return NextResponse.json(
      {
        menus: [],
        status: 'error',
        error: error.message,
      },
      { status: 500 }
    );
  } finally {
    isFetching = false;
  }
}
