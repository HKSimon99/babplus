import chromium from '@sparticuz/chromium';
import puppeteerCore from 'puppeteer-core';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const CHANNEL_URL = 'https://pf.kakao.com/_xmbxnGG/posts';
const TITLE_PATTERN = /(\d{1,2})\/(\d{1,2})\((.)\)\s*중식메뉴/;
const PAGE_TIMEOUT = 45_000; // 45 seconds
const MAX_RETRIES = 2;

// ---------------------------------------------------------------------------
// Browser launcher — works both locally (with installed Chrome) and on Vercel
// ---------------------------------------------------------------------------
async function launchBrowser() {
  const isVercel = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
  console.log(`[scraper] Launching browser (isVercel: ${isVercel})...`);

  if (isVercel) {
    try {
      chromium.setGraphicsMode = false;
      
      let execPath;
      try {
        execPath = await chromium.executablePath();
      } catch (pathErr) {
        console.warn('[scraper] Default executablePath failed, trying release pack fallback:', pathErr.message);
        execPath = await chromium.executablePath(
          'https://github.com/sparticuz/chromium/releases/download/v122.0.0/chromium-v122.0.0-pack.tar'
        );
      }

      console.log(`[scraper] Vercel Chromium path acquired: ${execPath}`);

      return await puppeteerCore.launch({
        args: [
          ...chromium.args,
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-zygote',
          '--single-process',
        ],
        defaultViewport: chromium.defaultViewport,
        executablePath: execPath,
        headless: chromium.headless,
      });
    } catch (err) {
      console.error('[scraper] Failed to launch Vercel Chromium:', err.message, err.stack);
      throw new Error(`Chromium Launch Error: ${err.message}`);
    }
  }

  // Local development — try common Chrome paths on Windows
  const localPaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.CHROME_PATH,
  ].filter(Boolean);

  let executablePath = null;
  for (const p of localPaths) {
    try {
      const { accessSync } = await import('fs');
      accessSync(p);
      executablePath = p;
      break;
    } catch {
      // continue
    }
  }

  if (!executablePath) {
    throw new Error(
      'Chrome not found. Set CHROME_PATH env variable or install Google Chrome.'
    );
  }

  console.log(`[scraper] Local Chrome path acquired: ${executablePath}`);
  return puppeteerCore.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    defaultViewport: { width: 1280, height: 900 },
    executablePath,
    headless: true,
  });
}

// ---------------------------------------------------------------------------
// Parse date from post title  e.g. "7/27(월) 중식메뉴"
// ---------------------------------------------------------------------------
function parseDateFromTitle(title) {
  const match = title.match(TITLE_PATTERN);
  if (!match) return null;

  const month = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);
  const dayOfWeek = match[3]; // 월,화,수,목,금,토,일

  // Determine year — assume current year; handle Dec→Jan boundary
  const now = new Date();
  let year = now.getFullYear();
  if (now.getMonth() === 0 && month === 12) {
    year -= 1; // January looking at December post
  }

  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { dateStr, month, day, dayOfWeek };
}

// ---------------------------------------------------------------------------
// Check if a date string is today (KST)
// ---------------------------------------------------------------------------
function isToday(dateStr) {
  const now = new Date();
  // Convert to KST (UTC+9)
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const todayStr = kst.toISOString().slice(0, 10);
  return dateStr === todayStr;
}

// ---------------------------------------------------------------------------
// Strategy 1: Intercept internal API responses for structured data
// ---------------------------------------------------------------------------
async function scrapeViaNetworkIntercept(page) {
  const posts = [];

  return new Promise((resolve) => {
    let resolved = false;
    const capturedResponses = [];

    page.on('response', async (response) => {
      try {
        const url = response.url();
        // Look for internal API calls that contain post/feed data
        if (
          (url.includes('/api/') || url.includes('/posts') || url.includes('/feed')) &&
          response.headers()['content-type']?.includes('application/json')
        ) {
          const json = await response.json().catch(() => null);
          if (json) {
            capturedResponses.push({ url, data: json });
          }
        }
      } catch {
        // ignore response parsing errors
      }
    });

    page.goto(CHANNEL_URL, { waitUntil: 'networkidle2', timeout: PAGE_TIMEOUT })
      .then(async () => {
        // Wait a bit more for any late API calls
        await new Promise((r) => setTimeout(r, 3000));

        // Try to extract posts from captured API responses
        for (const { data } of capturedResponses) {
          const extracted = extractPostsFromApiData(data);
          if (extracted.length > 0) {
            posts.push(...extracted);
          }
        }

        if (!resolved) {
          resolved = true;
          resolve(posts);
        }
      })
      .catch(() => {
        if (!resolved) {
          resolved = true;
          resolve([]);
        }
      });

    // Safety timeout
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(posts);
      }
    }, PAGE_TIMEOUT + 5000);
  });
}

// ---------------------------------------------------------------------------
// Extract posts from various possible API response structures
// ---------------------------------------------------------------------------
function extractPostsFromApiData(data) {
  const results = [];

  // Try to find an array of posts in the data
  const possibleArrays = findArraysInObject(data, 3);

  for (const arr of possibleArrays) {
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue;

      // Look for title/content fields
      const title =
        item.title || item.content?.title || item.post?.title || item.name || '';

      if (!TITLE_PATTERN.test(title)) continue;

      // Look for image fields
      const images = extractImagesFromItem(item);
      if (images.length === 0) continue;

      const dateInfo = parseDateFromTitle(title);
      if (!dateInfo) continue;

      // Get second-to-last image
      const targetImage =
        images.length >= 2 ? images[images.length - 2] : images[0];

      results.push({
        date: dateInfo.dateStr,
        title,
        imageUrl: targetImage,
        allImages: images,
        isToday: isToday(dateInfo.dateStr),
        source: 'api',
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Recursively find arrays in an object (up to maxDepth)
// ---------------------------------------------------------------------------
function findArraysInObject(obj, maxDepth, depth = 0) {
  const arrays = [];
  if (depth > maxDepth || !obj || typeof obj !== 'object') return arrays;

  if (Array.isArray(obj)) {
    if (obj.length > 0 && typeof obj[0] === 'object') {
      arrays.push(obj);
    }
    for (const item of obj) {
      arrays.push(...findArraysInObject(item, maxDepth, depth + 1));
    }
  } else {
    for (const value of Object.values(obj)) {
      arrays.push(...findArraysInObject(value, maxDepth, depth + 1));
    }
  }

  return arrays;
}

// ---------------------------------------------------------------------------
// Extract image URLs from various possible item structures
// ---------------------------------------------------------------------------
function extractImagesFromItem(item) {
  const images = [];
  const seen = new Set();

  function addImage(url) {
    if (!url || typeof url !== 'string') return;
    // Normalize to xl size and ensure https
    const normalized = url
      .replace(/^http:\/\//, 'https://')
      .replace(/^\/\//, 'https://')
      .replace(/img_[a-z]+\.jpg/, 'img_xl.jpg')
      .replace(/img_[a-z]+\.png/, 'img_xl.png');
    if (!seen.has(normalized)) {
      seen.add(normalized);
      images.push(normalized);
    }
  }

  // Common image field patterns
  if (item.images) {
    for (const img of [].concat(item.images)) {
      addImage(typeof img === 'string' ? img : img?.url || img?.original || img?.xlarge);
    }
  }
  if (item.media) {
    for (const m of [].concat(item.media)) {
      addImage(typeof m === 'string' ? m : m?.url || m?.original);
    }
  }
  if (item.photos) {
    for (const p of [].concat(item.photos)) {
      addImage(typeof p === 'string' ? p : p?.url || p?.original || p?.xlarge);
    }
  }
  if (item.attachments) {
    for (const a of [].concat(item.attachments)) {
      if (a?.images) {
        for (const img of [].concat(a.images)) {
          addImage(typeof img === 'string' ? img : img?.url || img?.original);
        }
      }
    }
  }
  // Deep search for kakaocdn URLs
  const jsonStr = JSON.stringify(item);
  const cdnMatches = jsonStr.match(/https?:\/\/k\.kakaocdn\.net\/dn\/[^"\\]+/g);
  if (cdnMatches) {
    for (const url of cdnMatches) {
      addImage(url);
    }
  }

  return images;
}

// ---------------------------------------------------------------------------
// Strategy 2 (fallback): DOM scraping
// ---------------------------------------------------------------------------
async function scrapeViaDom(page) {
  // Make sure we're on the page
  const currentUrl = page.url();
  if (!currentUrl.includes('_xmbxnGG')) {
    await page.goto(CHANNEL_URL, { waitUntil: 'networkidle2', timeout: PAGE_TIMEOUT });
  }

  // Wait for post list to render
  await page.waitForSelector('[class*="post"], [class*="feed"], article, [data-testid]', {
    timeout: 15_000,
  }).catch(() => {});

  // Extra wait for dynamic content
  await new Promise((r) => setTimeout(r, 2000));

  // Extract post data from the DOM
  const posts = await page.evaluate((patternStr) => {
    const pattern = new RegExp(patternStr);
    const results = [];

    // Strategy: find all text nodes that match the title pattern,
    // then find their parent post container and extract images
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null
    );

    const matchedElements = [];
    let node;
    while ((node = walker.nextNode())) {
      if (pattern.test(node.textContent.trim())) {
        matchedElements.push(node.parentElement);
      }
    }

    for (const el of matchedElements) {
      // Walk up to find the post container
      let container = el;
      for (let i = 0; i < 10; i++) {
        if (!container.parentElement) break;
        container = container.parentElement;
        // Check if this is likely a post container
        const rect = container.getBoundingClientRect();
        if (rect.width > 200 && rect.height > 200) break;
      }

      // Find all images in the container
      const imgs = container.querySelectorAll('img');
      const imageUrls = [];
      for (const img of imgs) {
        const src = img.src || img.dataset?.src || '';
        if (src && src.includes('kakaocdn.net')) {
          imageUrls.push(src.replace(/img_[a-z]+\./, 'img_xl.'));
        }
      }

      // Find title text
      let title = '';
      const titleMatch = container.textContent.match(
        /\d{1,2}\/\d{1,2}\(.\)\s*중식메뉴/
      );
      if (titleMatch) {
        title = titleMatch[0];
      }

      if (title && imageUrls.length > 0) {
        results.push({ title, images: imageUrls });
      }
    }

    return results;
  }, TITLE_PATTERN.source);

  // Process DOM results
  return posts
    .map((post) => {
      const dateInfo = parseDateFromTitle(post.title);
      if (!dateInfo) return null;

      const targetImage =
        post.images.length >= 2
          ? post.images[post.images.length - 2]
          : post.images[0];

      return {
        date: dateInfo.dateStr,
        title: post.title,
        imageUrl: targetImage,
        allImages: post.images,
        isToday: isToday(dateInfo.dateStr),
        source: 'dom',
      };
    })
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Strategy 3 (extra fallback): Click into each post for detail images
// ---------------------------------------------------------------------------
async function scrapeViaPostDetail(page) {
  // Find clickable post elements on the listing page
  const postLinks = await page.evaluate((patternStr) => {
    const pattern = new RegExp(patternStr);
    const links = [];
    // Find all links/clickable elements
    const allLinks = document.querySelectorAll('a[href*="posts/"], a[href*="post/"]');
    for (const link of allLinks) {
      const text = link.textContent || '';
      if (pattern.test(text)) {
        links.push({
          href: link.href,
          title: text.match(/\d{1,2}\/\d{1,2}\(.\)\s*중식메뉴/)?.[0] || '',
        });
      }
    }
    return links;
  }, TITLE_PATTERN.source);

  const results = [];

  // Visit each post detail page (limit to recent 5)
  for (const postLink of postLinks.slice(0, 5)) {
    try {
      await page.goto(postLink.href, { waitUntil: 'networkidle2', timeout: 20_000 });
      await new Promise((r) => setTimeout(r, 2000));

      // Extract all images from the detail page
      const images = await page.evaluate(() => {
        const imgs = document.querySelectorAll('img');
        const urls = [];
        for (const img of imgs) {
          const src = img.src || '';
          if (src.includes('kakaocdn.net') && !src.includes('profile')) {
            urls.push(src.replace(/img_[a-z]+\./, 'img_xl.'));
          }
        }
        return [...new Set(urls)];
      });

      if (images.length > 0 && postLink.title) {
        const dateInfo = parseDateFromTitle(postLink.title);
        if (dateInfo) {
          const targetImage =
            images.length >= 2 ? images[images.length - 2] : images[0];

          results.push({
            date: dateInfo.dateStr,
            title: postLink.title,
            imageUrl: targetImage,
            allImages: images,
            isToday: isToday(dateInfo.dateStr),
            source: 'detail',
          });
        }
      }
    } catch {
      // skip this post on error
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Main scraping function — tries all strategies with retries
// ---------------------------------------------------------------------------
export async function scrapeMenus() {
  let browser = null;
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      browser = await launchBrowser();
      const page = await browser.newPage();

      // Set a realistic user agent
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
      );

      // Strategy 1: Network interception
      console.log(`[scraper] Attempt ${attempt + 1}: trying network interception...`);
      const apiResults = await scrapeViaNetworkIntercept(page);
      if (apiResults.length > 0) {
        console.log(`[scraper] Found ${apiResults.length} menus via API interception`);
        return deduplicateAndSort(apiResults);
      }

      // Strategy 2: DOM scraping
      console.log('[scraper] Network interception found nothing, trying DOM scraping...');
      const domResults = await scrapeViaDom(page);
      if (domResults.length > 0) {
        console.log(`[scraper] Found ${domResults.length} menus via DOM scraping`);
        return deduplicateAndSort(domResults);
      }

      // Strategy 3: Post detail pages
      console.log('[scraper] DOM scraping found nothing, trying post detail pages...');
      const detailResults = await scrapeViaPostDetail(page);
      if (detailResults.length > 0) {
        console.log(`[scraper] Found ${detailResults.length} menus via post details`);
        return deduplicateAndSort(detailResults);
      }

      console.log('[scraper] All strategies found nothing on this attempt.');
      lastError = new Error('No menu posts found');
    } catch (err) {
      console.error(`[scraper] Attempt ${attempt + 1} failed:`, err.message);
      lastError = err;
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
        browser = null;
      }
    }
  }

  console.error('[scraper] All attempts failed:', lastError?.message);
  return [];
}

// ---------------------------------------------------------------------------
// Deduplicate by date and sort (newest first)
// ---------------------------------------------------------------------------
function deduplicateAndSort(posts) {
  const byDate = new Map();
  for (const post of posts) {
    if (!byDate.has(post.date)) {
      byDate.set(post.date, post);
    }
  }
  return Array.from(byDate.values()).sort((a, b) => b.date.localeCompare(a.date));
}
