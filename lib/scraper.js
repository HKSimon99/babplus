// ---------------------------------------------------------------------------
// Pure HTTP Fetch Scraper for Kakao Channel Posts
// Does NOT require Puppeteer or Chromium. Fast (~0.1s), stable & 100% Vercel compatible.
// ---------------------------------------------------------------------------

const CHANNEL_API_URL = 'https://pf.kakao.com/rocket-web/web/profiles/_xmbxnGG/posts';
const TITLE_PATTERN = /(\d{1,2})\/(\d{1,2})\((.)\)\s*(중식메뉴|중식|메뉴)/;

/**
 * Parse date from post title e.g. "7/27(월) 중식메뉴" or "7/28(화) 메뉴"
 */
function parseDateFromTitle(title) {
  if (title.includes('석식')) return null;

  const match = title.match(TITLE_PATTERN);
  if (!match) return null;

  const month = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);
  const dayOfWeek = match[3];

  const now = new Date();
  let year = now.getFullYear();
  if (now.getMonth() === 0 && month === 12) {
    year -= 1; // January looking at December post
  }

  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { dateStr, month, day, dayOfWeek };
}

/**
 * Check if a date string matches today in KST (UTC+9)
 */
function isToday(dateStr) {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const todayStr = kst.toISOString().slice(0, 10);
  return dateStr === todayStr;
}

/**
 * Main scraper function — fetches posts directly from Kakao's web API
 */
export async function scrapeMenus() {
  console.log('[scraper] Fetching posts via Kakao Web API...');

  try {
    const response = await fetch(CHANNEL_API_URL, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://pf.kakao.com/_xmbxnGG/posts',
      },
      next: { revalidate: 0 }, // bypass next fetch cache if any
    });

    if (!response.ok) {
      throw new Error(`Kakao API responded with status ${response.status}`);
    }

    const data = await response.json();
    const items = data.items || [];
    console.log(`[scraper] Kakao API returned ${items.length} items.`);

    const menus = [];

    for (const item of items) {
      const title = item.title || '';
      if (title.includes('석식')) continue; // Skip evening/dinner posts
      if (!TITLE_PATTERN.test(title)) continue;

      const dateInfo = parseDateFromTitle(title);
      if (!dateInfo) continue;

      // Extract image URLs from media array
      const rawMedia = item.media || [];
      const images = rawMedia
        .map((m) => m.xlarge_url || m.url || m.large_url)
        .filter(Boolean)
        .map((url) =>
          url
            .replace(/^http:\/\//, 'https://')
            .replace(/^\/\//, 'https://')
            .replace(/img_[a-z]+\.jpg/, 'img_xl.jpg')
            .replace(/img_[a-z]+\.png/, 'img_xl.png')
        );

      if (images.length === 0) continue;

      // Rule: Second-to-last image (images[length - 2]), fallback to first if only 1 image
      const targetImage =
        images.length >= 2 ? images[images.length - 2] : images[0];

      menus.push({
        date: dateInfo.dateStr,
        title: title.trim(),
        imageUrl: targetImage,
        allImages: images,
        isToday: isToday(dateInfo.dateStr),
        source: 'kakao_web_api',
      });
    }

    console.log(`[scraper] Successfully parsed ${menus.length} lunch menus.`);
    return deduplicateAndSort(menus);
  } catch (error) {
    console.error('[scraper] Error fetching Kakao Web API:', error.message);
    return [];
  }
}

/**
 * Deduplicate by date and sort newest first
 */
function deduplicateAndSort(posts) {
  const byDate = new Map();
  for (const post of posts) {
    if (!byDate.has(post.date)) {
      byDate.set(post.date, post);
    }
  }
  return Array.from(byDate.values()).sort((a, b) => b.date.localeCompare(a.date));
}
