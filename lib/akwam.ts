import * as cheerio from 'cheerio';

const PRIMARY_BASE_URL = 'https://ak.sv';
const FALLBACK_DOMAINS = ['ak.sv', 'akwam.cx', 'akwam.ss', 'akwam.to'];

const REQUEST_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept':
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
  'Referer': `${PRIMARY_BASE_URL}/`,
};

const PAGE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const LINK_CACHE_TTL = 90 * 1000;     // 90 seconds for fresh tokens

interface CacheEntry<T> {
  value: T;
  expires: number;
}

const pageCache = new Map<string, CacheEntry<string>>();
const linkCache = new Map<string, CacheEntry<VideoLink[]>>();

export interface MediaItem {
  title: string;
  url: string;
  image: string;
  rating?: string;
  quality?: string;
  year?: string;
  category?: string;
  story?: string;
  type?: 'movie' | 'series' | 'episode';
}

export interface VideoLink {
  quality: string;
  url: string;
  streamUrl?: string;
  isM3u8?: boolean;
}

export interface SubtitleTrack {
  label: string;
  lang: string;
  src: string;
}

export interface MediaDetails {
  title: string;
  image: string;
  story?: string;
  rating?: string;
  quality?: string;
  year?: string;
  duration?: string;
  genres?: string[];
  links: VideoLink[];
  subtitles?: SubtitleTrack[];
}

function cacheGet<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expires) {
    cache.delete(key);
    return null;
  }
  return item.value;
}

function cacheSet<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  value: T,
  ttl: number
) {
  if (cache.size > 300) {
    const first = cache.keys().next().value;
    if (first) {
      cache.delete(first);
    }
  }
  cache.set(key, {
    value,
    expires: Date.now() + ttl,
  });
}

export function isAkwamUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return (
      hostname === 'ak.sv' ||
      hostname.endsWith('.ak.sv') ||
      hostname === 'akwam.cx' ||
      hostname.endsWith('.akwam.cx') ||
      hostname === 'akwam.ss' ||
      hostname.endsWith('.akwam.ss') ||
      hostname === 'akwam.to' ||
      hostname.endsWith('.akwam.to') ||
      hostname.includes('akwam')
    );
  } catch {
    return false;
  }
}

export function normalizeUrl(value: string): string {
  let url = value.trim();
  if (!url) return '';

  if (url.startsWith('//')) {
    return `https:${url}`;
  }

  if (url.startsWith('/')) {
    return `${PRIMARY_BASE_URL}${url}`;
  }

  try {
    return new URL(url, PRIMARY_BASE_URL).href;
  } catch {
    return url;
  }
}

async function fetchHtml(url: string, timeoutMs = 25000): Promise<string> {
  const target = normalizeUrl(url);

  const cached = cacheGet(pageCache, target);
  if (cached) {
    return cached;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(target, {
      method: 'GET',
      headers: REQUEST_HEADERS,
      redirect: 'follow',
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Akwam HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    cacheSet(pageCache, target, html, PAGE_CACHE_TTL);
    return html;
  } catch (error: any) {
    // If primary failed and was ak.sv, attempt fallback domain
    if (target.includes('ak.sv')) {
      for (const fallback of FALLBACK_DOMAINS.filter((d) => d !== 'ak.sv')) {
        try {
          const fallbackTarget = target.replace('ak.sv', fallback);
          const fbResponse = await fetch(fallbackTarget, {
            method: 'GET',
            headers: {
              ...REQUEST_HEADERS,
              Referer: `https://${fallback}/`,
            },
            redirect: 'follow',
            cache: 'no-store',
            signal: controller.signal,
          });
          if (fbResponse.ok) {
            const html = await fbResponse.text();
            cacheSet(pageCache, target, html, PAGE_CACHE_TTL);
            return html;
          }
        } catch {
          // continue fallback loop
        }
      }
    }
    throw new Error(`فشل في جلب الصفحة من الخادم: ${error?.message || 'تعذر الاتصال'}`);
  } finally {
    clearTimeout(timeout);
  }
}

function extractImage($: cheerio.CheerioAPI, element: any): string {
  const img = $(element).find('img').first();
  const value =
    img.attr('data-src') ||
    img.attr('data-original') ||
    img.attr('data-lazy-src') ||
    img.attr('src') ||
    '';

  return normalizeUrl(value);
}

function detectType(url: string): MediaItem['type'] {
  const value = url.toLowerCase();
  if (value.includes('/episode/')) return 'episode';
  if (value.includes('/series/') || value.includes('/show/')) return 'series';
  return 'movie';
}

function parseMediaCards(html: string): MediaItem[] {
  const $ = cheerio.load(html);
  const results: MediaItem[] = [];
  const seen = new Set<string>();

  const selectors = [
    'div.entry-box',
    'div.col-lg-auto',
    'div.col-md-4',
    'div.col-sm-6',
    'div.col-6',
    '.widget-body .row > div',
    'article',
  ];

  $(selectors.join(',')).each((_, element) => {
    const el = $(element);
    const link = el
      .find(
        'a[href*="/movie/"],' +
          'a[href*="/series/"],' +
          'a[href*="/episode/"],' +
          'a[href*="/show/"]'
      )
      .first();

    let url = link.attr('href') || el.find('a').attr('href') || '';
    const title =
      link.text().replace(/\s+/g, ' ').trim() ||
      el
        .find('h3.entry-title, .entry-title, h3, h4')
        .first()
        .text()
        .replace(/\s+/g, ' ')
        .trim();

    if (!url || !title || url.startsWith('#') || url.startsWith('javascript:')) {
      return;
    }

    url = normalizeUrl(url);

    if (seen.has(url)) {
      return;
    }
    seen.add(url);

    const rating = el
      .find('.rating, [class*="rating"]')
      .first()
      .text()
      .replace(/[^0-9.]/g, '')
      .trim();

    const quality = el
      .find('.quality, [class*="quality"], .badge')
      .first()
      .text()
      .replace(/\s+/g, ' ')
      .trim();

    const year = el
      .find('.year, [class*="year"], .badge-secondary')
      .first()
      .text()
      .replace(/\s+/g, ' ')
      .trim();

    results.push({
      title,
      url,
      image: extractImage($, element),
      rating: rating || undefined,
      quality: quality || undefined,
      year: year || undefined,
      type: detectType(url),
    });
  });

  return results;
}

export async function search(keyword: string, page = 1): Promise<MediaItem[]> {
  const query = keyword.trim();
  if (!query) return [];

  const url = `${PRIMARY_BASE_URL}/search?q=${encodeURIComponent(query)}&page=${Math.max(1, page)}`;
  const html = await fetchHtml(url);
  return parseMediaCards(html);
}

export async function getMovies(page = 1): Promise<MediaItem[]> {
  const html = await fetchHtml(`${PRIMARY_BASE_URL}/movies?page=${Math.max(1, page)}`);
  return parseMediaCards(html);
}

export async function getSeries(page = 1): Promise<MediaItem[]> {
  const html = await fetchHtml(`${PRIMARY_BASE_URL}/series?page=${Math.max(1, page)}`);
  return parseMediaCards(html);
}

export async function getSeriesEpisodes(seriesUrl: string): Promise<MediaItem[]> {
  const target = normalizeUrl(seriesUrl);
  const html = await fetchHtml(target);
  const $ = cheerio.load(html);

  const episodes: MediaItem[] = [];
  const seen = new Set<string>();

  $('a[href*="/episode/"]').each((_, element) => {
    const anchor = $(element);
    let url = anchor.attr('href') || '';
    if (!url) return;

    url = normalizeUrl(url);
    if (seen.has(url)) return;

    let title = anchor.text().replace(/\s+/g, ' ').trim();
    if (!title) {
      title = anchor.parent().text().replace(/\s+/g, ' ').trim();
    }

    if (!title) return;
    seen.add(url);

    episodes.push({
      title,
      url,
      image: '',
      type: 'episode',
    });
  });

  return episodes;
}

function isVideoUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const value = url.toLowerCase();

  // Exclude image assets
  if (
    value.includes('img.downet.net') ||
    value.endsWith('.jpg') ||
    value.endsWith('.jpeg') ||
    value.endsWith('.png') ||
    value.endsWith('.webp') ||
    value.endsWith('.svg')
  ) {
    return false;
  }

  return (
    value.includes('.mp4') ||
    value.includes('.m3u8') ||
    value.includes('.webm') ||
    value.includes('.mkv') ||
    value.includes('downet.net/download/')
  );
}

function cleanVideoUrl(value: string): string {
  let url = value.trim();

  if (url.startsWith('intent:')) {
    url = url.replace(/^intent:\/\//i, '').split('#Intent;')[0];
  }

  url = url
    .replace(/^https?:\/\/ak\.svvlc:\/\//i, '')
    .replace(/^https?:\/\/akwam[^/]+vlc:\/\//i, '')
    .replace(/^vlc:\/\//i, '');

  return url.trim();
}

function qualityFromUrl(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('2160') || lower.includes('4k')) return '4K';
  const match = lower.match(/(1080|720|480|360)p?/);
  if (match) return `${match[1]}p`;
  return 'HD';
}

function qualityRank(quality: string): number {
  if (quality === '4K' || quality.includes('2160')) return 2160;
  const match = quality.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function addVideoLink(
  links: VideoLink[],
  seen: Set<string>,
  rawUrl: string,
  quality = ''
) {
  const cleaned = cleanVideoUrl(rawUrl);
  if (!cleaned || !isVideoUrl(cleaned)) return;
  if (!/^https?:\/\//i.test(cleaned)) return;

  if (seen.has(cleaned)) return;
  seen.add(cleaned);

  const lower = cleaned.toLowerCase();
  const rawQ = quality.replace(/\s+/g, ' ').trim();
  const digitMatch = rawQ.match(/\d+/);
  const finalQuality = rawQ
    ? digitMatch
      ? `${digitMatch[0]}p`
      : rawQ
    : qualityFromUrl(cleaned);

  links.push({
    url: cleaned,
    quality: finalQuality,
    isM3u8: lower.includes('.m3u8'),
  });
}

export async function getCleanLink(pageUrl: string): Promise<VideoLink[]> {
  const target = normalizeUrl(pageUrl);

  const cached = cacheGet(linkCache, target);
  if (cached && cached.length > 0) {
    return cached;
  }

  const html = await fetchHtml(target, 25000);
  const $ = cheerio.load(html);

  const links: VideoLink[] = [];
  const seen = new Set<string>();

  // 1. Direct <video source="...">
  $('video source, source').each((_, element) => {
    const source = $(element);
    const url = source.attr('src') || source.attr('data-src') || '';
    const quality =
      source.attr('data-quality') ||
      source.attr('size') ||
      source.attr('title') ||
      '';
    addVideoLink(links, seen, url, quality);
  });

  // 2. Direct anchor links pointing to videos
  $('a[href]').each((_, element) => {
    const anchor = $(element);
    const href = anchor.attr('href') || '';
    if (!isVideoUrl(href)) return;
    const text = anchor.text().replace(/\s+/g, ' ').trim();
    addVideoLink(links, seen, href, text);
  });

  // 3. Sub watch & download pages
  if (links.length === 0) {
    const targets: { url: string; label: string }[] = [];
    const seenUrls = new Set<string>();

    $('a[href*="/watch/"], a[href*="/download/"]').each((_, element) => {
      let href = $(element).attr('href') || '';
      if (!href) return;
      href = normalizeUrl(href);
      if (!seenUrls.has(href)) {
        seenUrls.add(href);
        const text = $(element).text().replace(/\s+/g, ' ').trim();
        const parentCard = $(element).closest('.download-item, .col-lg-auto, tr, li, div');
        const badge = parentCard.find('.badge, .quality, [class*="quality"]').text().trim();
        targets.push({ url: href, label: badge || text || 'HD' });
      }
    });

    const limitedTargets = targets.slice(0, 6);
    const pages = await Promise.allSettled(
      limitedTargets.map((t) => fetchHtml(t.url, 15000))
    );

    pages.forEach((result, idx) => {
      if (result.status !== 'fulfilled') return;
      const sub$ = cheerio.load(result.value);
      const meta = limitedTargets[idx];

      sub$('video source, source').each((_, el) => {
        const source = sub$(el);
        const url = source.attr('src') || source.attr('data-src') || '';
        const q = source.attr('data-quality') || source.attr('size') || meta.label;
        addVideoLink(links, seen, url, q);
      });

      sub$('a[href]').each((_, el) => {
        const href = sub$(el).attr('href') || '';
        if (!isVideoUrl(href)) return;
        addVideoLink(links, seen, href, meta.label || sub$(el).text().trim());
      });
    });
  }

  links.sort((a, b) => qualityRank(b.quality) - qualityRank(a.quality));

  // Deduplicate and label mirrors cleanly
  const finalLinks: VideoLink[] = [];
  const qualityCount = new Map<string, number>();

  for (const link of links) {
    const baseQ = link.quality;
    const count = (qualityCount.get(baseQ) || 0) + 1;
    qualityCount.set(baseQ, count);

    if (count === 1) {
      finalLinks.push(link);
    } else if (count === 2) {
      finalLinks.push({
        ...link,
        quality: `${baseQ} (سيرفر 2)`,
      });
    }
  }

  if (finalLinks.length > 0) {
    cacheSet(linkCache, target, finalLinks, LINK_CACHE_TTL);
  }

  return finalLinks;
}

export async function getDetails(pageUrl: string): Promise<MediaDetails> {
  const target = normalizeUrl(pageUrl);
  const html = await fetchHtml(target);
  const $ = cheerio.load(html);

  const title =
    $('h1').first().text().trim() ||
    $('title').text().trim() ||
    'بدون عنوان';

  const image = normalizeUrl(
    $('meta[property="og:image"]').attr('content') ||
      $('img').first().attr('src') ||
      ''
  );

  const story = $(
    '[class*="story"], [class*="description"], .description, p.text-muted'
  )
    .first()
    .text()
    .replace(/\s+/g, ' ')
    .trim();

  const rating = $('.rating, [class*="rating"]')
    .first()
    .text()
    .replace(/[^0-9.]/g, '')
    .trim();

  const duration = $('[class*="duration"]')
    .first()
    .text()
    .replace(/\s+/g, ' ')
    .trim();

  const quality = $('.quality, [class*="quality"], .badge')
    .first()
    .text()
    .replace(/\s+/g, ' ')
    .trim();

  const year = $('.year, [class*="year"]')
    .first()
    .text()
    .replace(/\s+/g, ' ')
    .trim();

  const genres: string[] = [];
  $('.genre, .genres a, [class*="genre"] a').each((_, element) => {
    const genre = $(element).text().replace(/\s+/g, ' ').trim();
    if (genre && !genres.includes(genre)) {
      genres.push(genre);
    }
  });

  const subtitles: SubtitleTrack[] = [];
  $('track').each((_, element) => {
    const track = $(element);
    const src = normalizeUrl(track.attr('src') || '');
    if (!src) return;

    subtitles.push({
      label: track.attr('label') || 'العربية',
      lang: track.attr('srclang') || 'ar',
      src,
    });
  });

  const links = await getCleanLink(target);

  return {
    title,
    image,
    story: story || undefined,
    rating: rating || undefined,
    quality: quality || undefined,
    year: year || undefined,
    duration: duration || undefined,
    genres,
    links,
    subtitles,
  };
}



