import * as cheerio from 'cheerio';

const PRIMARY_BASE_URL = 'https://ak.sv';

const FALLBACK_DOMAINS = [
  'akwam.cx',
  'akwam.ss',
  'akwam.to',
];

const REQUEST_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/128.0.0.0 Safari/537.36',

  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,' +
    'image/avif,image/webp,image/apng,*/*;q=0.8',

  'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',

  Referer: `${PRIMARY_BASE_URL}/`,
};

const PAGE_CACHE_TTL = 5 * 60 * 1000;
const LINK_CACHE_TTL = 90 * 1000;

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

/* =========================================================
   CACHE
========================================================= */

function cacheGet<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string
): T | null {
  const item = cache.get(key);

  if (!item) {
    return null;
  }

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

/* =========================================================
   URL HELPERS
========================================================= */

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
  let url = String(value || '').trim();

  if (!url) {
    return '';
  }

  // //example.com/file
  if (url.startsWith('//')) {
    return `https:${url}`;
  }

  // /movie/123
  if (url.startsWith('/')) {
    return `${PRIMARY_BASE_URL}${url}`;
  }

  try {
    return new URL(url, PRIMARY_BASE_URL).href;
  } catch {
    return url;
  }
}

/* =========================================================
   FETCH HTML
========================================================= */

async function fetchHtml(
  url: string,
  timeoutMs = 25000
): Promise<string> {
  const target = normalizeUrl(url);

  if (!target) {
    throw new Error('الرابط غير صالح');
  }

  const cached = cacheGet(pageCache, target);

  if (cached) {
    return cached;
  }

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(target, {
      method: 'GET',
      headers: REQUEST_HEADERS,
      redirect: 'follow',
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Akwam HTTP ${response.status}: ${response.statusText}`
      );
    }

    const html = await response.text();

    if (!html || html.length < 100) {
      throw new Error('الصفحة التي تم جلبها فارغة أو غير مكتملة');
    }

    cacheSet(
      pageCache,
      target,
      html,
      PAGE_CACHE_TTL
    );

    return html;
  } catch (error: any) {
    /*
     * تجربة النطاقات الاحتياطية فقط إذا كان الطلب الأصلي
     * على ak.sv وفشل.
     */
    if (target.includes('ak.sv')) {
      for (const fallback of FALLBACK_DOMAINS) {
        try {
          const fallbackTarget = target.replace(
            'ak.sv',
            fallback
          );

          const fallbackResponse = await fetch(
            fallbackTarget,
            {
              method: 'GET',

              headers: {
                ...REQUEST_HEADERS,
                Referer: `https://${fallback}/`,
              },

              redirect: 'follow',
              cache: 'no-store',
              signal: controller.signal,
            }
          );

          if (!fallbackResponse.ok) {
            continue;
          }

          const fallbackHtml =
            await fallbackResponse.text();

          if (!fallbackHtml || fallbackHtml.length < 100) {
            continue;
          }

          /*
           * نخزن النتيجة باستخدام target الأصلي حتى تستفيد
           * بقية الطلبات من cache.
           */
          cacheSet(
            pageCache,
            target,
            fallbackHtml,
            PAGE_CACHE_TTL
          );

          return fallbackHtml;
        } catch {
          // تجربة النطاق التالي
        }
      }
    }

    const message =
      error?.name === 'AbortError'
        ? 'انتهت مهلة الاتصال بالمصدر'
        : error?.message || 'تعذر الاتصال بالمصدر';

    throw new Error(
      `فشل في جلب الصفحة: ${message}`
    );
  } finally {
    clearTimeout(timeout);
  }
}

/* =========================================================
   GENERAL HTML HELPERS
========================================================= */

function extractImage(
  $: cheerio.CheerioAPI,
  element: any
): string {
  const img = $(element)
    .find('img')
    .first();

  const value =
    img.attr('data-src') ||
    img.attr('data-original') ||
    img.attr('data-lazy-src') ||
    img.attr('data-lazy') ||
    img.attr('src') ||
    '';

  return normalizeUrl(value);
}

function detectType(
  url: string
): MediaItem['type'] {
  const value = url.toLowerCase();

  if (value.includes('/episode/')) {
    return 'episode';
  }

  if (
    value.includes('/series/') ||
    value.includes('/show/')
  ) {
    return 'series';
  }

  if (value.includes('/movie/')) {
    return 'movie';
  }

  return 'movie';
}

function cleanText(value: string): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractYear(text: string): string | undefined {
  const match = text.match(
    /\b(19|20)\d{2}\b/
  );

  return match
    ? match[0]
    : undefined;
}

function extractQuality(
  text: string
): string | undefined {
  const match = text.match(
    /\b(4K|2160p|1080p|720p|480p|360p|WEB-DL|WEBRip|BluRay|HDRip|HDTV|CAM)\b/i
  );

  return match
    ? match[1]
    : undefined;
}

function extractRating(
  text: string
): string | undefined {
  const match = text.match(
    /\b(10(?:\.\d+)?|[0-9](?:\.\d+)?)\b/
  );

  return match
    ? match[1]
    : undefined;
}

/* =========================================================
   MEDIA CARD PARSER
========================================================= */

function parseMediaCards(
  html: string
): MediaItem[] {
  const $ = cheerio.load(html);

  const results: MediaItem[] = [];
  const seen = new Set<string>();

  /*
   * لا نعتمد على class واحد لأن تصميم المصدر
   * قد يتغير.
   *
   * نبحث أولًا عن روابط المحتوى.
   */
  $('a[href]').each((_, element) => {
    const anchor = $(element);

    let href =
      anchor.attr('href') || '';

    if (!href) {
      return;
    }

    href = normalizeUrl(href);

    if (!href) {
      return;
    }

    const type = detectType(href);

    /*
     * نريد الأفلام والمسلسلات فقط هنا.
     */
    if (
      type !== 'movie' &&
      type !== 'series'
    ) {
      return;
    }

    /*
     * منع التكرار.
     */
    if (seen.has(href)) {
      return;
    }

    /*
     * العثور على العنصر الأب الذي يمثل البطاقة.
     */
    let container = anchor;

    for (let i = 0; i < 7; i++) {
      const parent = container.parent();

      if (!parent || !parent.length) {
        break;
      }

      container = parent;

      const hasImage =
        container.find('img').length > 0;

      const hasTitle =
        container.find(
          'h1,h2,h3,h4,h5,h6,.title,.name,.entry-title'
        ).length > 0;

      if (
        hasImage ||
        hasTitle
      ) {
        break;
      }
    }

    /*
     * النص الكامل للبطاقة.
     */
    const cardText = cleanText(
      container.text()
    );

    /*
     * استخراج العنوان.
     */
    let title =
      anchor.attr('title') ||
      anchor.attr('aria-label') ||
      '';

    if (!title) {
      title = cleanText(
        anchor
          .find(
            'h1,h2,h3,h4,h5,h6,.title,.name,.entry-title'
          )
          .first()
          .text()
      );
    }

    if (!title) {
      title = cleanText(
        container
          .find(
            'h1,h2,h3,h4,h5,h6,.title,.name,.entry-title'
          )
          .first()
          .text()
      );
    }

    /*
     * إذا لم يوجد عنوان في heading،
     * نستخدم نص الرابط.
     */
    if (!title) {
      title = cleanText(
        anchor.text()
      );
    }

    /*
     * تجاهل روابط الأزرار.
     */
    const invalidTitles = [
      'مشاهدة',
      'تحميل',
      'شاهد',
      'شاهد الآن',
      'تحميل الآن',
      'play',
      'watch',
      'download',
    ];

    if (
      invalidTitles.includes(
        title.toLowerCase()
      )
    ) {
      return;
    }

    /*
     * عنوان قصير جدًا غالبًا ليس عنوان فيلم.
     */
    if (title.length < 2) {
      return;
    }

    /*
     * الصورة.
     */
    const image =
      extractImage(
        $,
        container
      );

    /*
     * التقييم.
     */
    let rating = cleanText(
      container
        .find(
          '.rating,[class*="rating"]'
        )
        .first()
        .text()
    );

    rating =
      rating.replace(
        /[^0-9.]/g,
        ''
      );

    if (!rating) {
      rating =
        extractRating(
          cardText
        ) || '';
    }

    /*
     * الجودة.
     */
    let quality =
      cleanText(
        container
          .find(
            '.quality,[class*="quality"],.badge'
          )
          .first()
          .text()
      );

    if (!quality) {
      quality =
        extractQuality(
          cardText
        ) || '';
    }

    /*
     * السنة.
     */
    let year =
      cleanText(
        container
          .find(
            '.year,[class*="year"],.badge-secondary'
          )
          .first()
          .text()
      );

    if (!year) {
      year =
        extractYear(
          cardText
        ) || '';
    }

    seen.add(href);

    results.push({
      title,
      url: href,
      image,
      rating:
        rating || undefined,
      quality:
        quality || undefined,
      year:
        year || undefined,
      type,
    });
  });

  return results;
}

/* =========================================================
   MOVIES
========================================================= */

export async function getMovies(
  page = 1
): Promise<MediaItem[]> {
  const currentPage =
    Math.max(
      1,
      Number.isFinite(page)
        ? page
        : 1
    );

  const url =
    `${PRIMARY_BASE_URL}/movies` +
    `?category=0` +
    `&formats=0` +
    `&language=0` +
    `&quality=0` +
    `&rating=0` +
    `&section=0` +
    `&year=0` +
    `&page=${currentPage}`;

  const html =
    await fetchHtml(url);

  return parseMediaCards(
    html
  );
}

/* =========================================================
   SERIES
========================================================= */

export async function getSeries(
  page = 1
): Promise<MediaItem[]> {
  const currentPage =
    Math.max(
      1,
      Number.isFinite(page)
        ? page
        : 1
    );

  const url =
    `${PRIMARY_BASE_URL}/series` +
    `?category=0` +
    `&formats=0` +
    `&language=0` +
    `&quality=0` +
    `&rating=0` +
    `&section=0` +
    `&year=0` +
    `&page=${currentPage}`;

  const html =
    await fetchHtml(url);

  return parseMediaCards(
    html
  );
}

/* =========================================================
   SEARCH
========================================================= */

export async function search(
  keyword: string,
  page = 1
): Promise<MediaItem[]> {
  const query =
    String(keyword || '').trim();

  if (!query) {
    return [];
  }

  const currentPage =
    Math.max(
      1,
      Number.isFinite(page)
        ? page
        : 1
    );

  /*
   * تجربة المسار الأساسي للبحث.
   */
  const url =
    `${PRIMARY_BASE_URL}/search` +
    `?q=${encodeURIComponent(query)}` +
    `&page=${currentPage}`;

  const html =
    await fetchHtml(url);

  return parseMediaCards(
    html
  );
}

/* =========================================================
   SERIES EPISODES
========================================================= */

export async function getSeriesEpisodes(
  seriesUrl: string
): Promise<MediaItem[]> {
  const target =
    normalizeUrl(seriesUrl);

  if (!target) {
    return [];
  }

  const html =
    await fetchHtml(target);

  const $ =
    cheerio.load(html);

  const episodes: MediaItem[] = [];
  const seen = new Set<string>();

  $('a[href]').each(
    (_, element) => {
      const anchor =
        $(element);

      let url =
        anchor.attr('href') ||
        '';

      if (!url) {
        return;
      }

      url =
        normalizeUrl(url);

      if (
        !url ||
        !url.toLowerCase().includes(
          '/episode/'
        )
      ) {
        return;
      }

      if (seen.has(url)) {
        return;
      }

      let title =
        cleanText(
          anchor.attr('title') ||
          anchor.text()
        );

      if (!title) {
        title =
          cleanText(
            anchor
              .parent()
              .text()
          );
      }

      if (!title) {
        return;
      }

      seen.add(url);

      const parent =
        anchor.parent();

      const image =
        extractImage(
          $,
          parent
        );

      episodes.push({
        title,
        url,
        image,
        type: 'episode',
      });
    }
  );

  return episodes;
}

/* =========================================================
   VIDEO URL HELPERS
========================================================= */

function isVideoUrl(
  url: string
): boolean {
  if (
    !url ||
    typeof url !== 'string'
  ) {
    return false;
  }

  const value =
    url.toLowerCase();

  /*
   * الصور ليست فيديو.
   */
  if (
    value.includes(
      'img.downet.net'
    ) ||
    value.endsWith('.jpg') ||
    value.endsWith('.jpeg') ||
    value.endsWith('.png') ||
    value.endsWith('.webp') ||
    value.endsWith('.svg') ||
    value.endsWith('.gif')
  ) {
    return false;
  }

  return (
    value.includes('.mp4') ||
    value.includes('.m3u8') ||
    value.includes('.webm') ||
    value.includes('.mkv') ||
    value.includes(
      'downet.net/download/'
    )
  );
}

/* =========================================================
   CLEAN VIDEO URL
========================================================= */

function cleanVideoUrl(
  value: string
): string {
  let url =
    String(value || '').trim();

  if (!url) {
    return '';
  }

  /*
   * intent://
   */
  if (
    url.startsWith(
      'intent:'
    )
  ) {
    url =
      url
        .replace(
          /^intent:\/\//i,
          ''
        )
        .split(
          '#Intent;'
        )[0];
  }

  /*
   * أخطاء الروابط القديمة مثل:
   *
   * https://ak.svvlc://https://...
   */
  url =
    url
      .replace(
        /^https?:\/\/ak\.svvlc:\/\//i,
        ''
      )
      .replace(
        /^https?:\/\/akwam[^/]+vlc:\/\//i,
        ''
      )
      .replace(
        /^vlc:\/\//i,
        ''
      )
      .trim();

  /*
   * بعض المصادر قد تعطي //cdn...
   */
  if (
    url.startsWith('//')
  ) {
    url =
      `https:${url}`;
  }

  return url;
}

/* =========================================================
   QUALITY
========================================================= */

function qualityFromUrl(
  url: string
): string {
  const lower =
    url.toLowerCase();

  if (
    lower.includes('2160') ||
    lower.includes('4k')
  ) {
    return '4K';
  }

  const match =
    lower.match(
      /(1080|720|480|360)p?/
    );

  if (match) {
    return `${match[1]}p`;
  }

  return 'HD';
}

function qualityRank(
  quality: string
): number {
  if (
    quality === '4K' ||
    quality.includes('2160')
  ) {
    return 2160;
  }

  const match =
    quality.match(
      /(\d+)/
    );

  return match
    ? Number(match[1])
    : 0;
}

/* =========================================================
   ADD VIDEO LINK
========================================================= */

function addVideoLink(
  links: VideoLink[],
  seen: Set<string>,
  rawUrl: string,
  quality = ''
) {
  const cleaned =
    cleanVideoUrl(rawUrl);

  if (
    !cleaned ||
    !isVideoUrl(cleaned)
  ) {
    return;
  }

  if (
    !/^https?:\/\//i.test(
      cleaned
    )
  ) {
    return;
  }

  if (
    seen.has(cleaned)
  ) {
    return;
  }

  seen.add(cleaned);

  const lower =
    cleaned.toLowerCase();

  const rawQuality =
    cleanText(quality);

  const digitMatch =
    rawQuality.match(
      /\d+/
    );

  const finalQuality =
    rawQuality
      ? digitMatch
        ? `${digitMatch[0]}p`
        : rawQuality
      : qualityFromUrl(
          cleaned
        );

  links.push({
    url: cleaned,
    quality:
      finalQuality,
    isM3u8:
      lower.includes(
        '.m3u8'
      ),
  });
}

/* =========================================================
   GET CLEAN VIDEO LINKS
========================================================= */

export async function getCleanLink(
  pageUrl: string
): Promise<VideoLink[]> {
  const target =
    normalizeUrl(pageUrl);

  if (!target) {
    return [];
  }

  const cached =
    cacheGet(
      linkCache,
      target
    );

  if (
    cached &&
    cached.length > 0
  ) {
    return cached;
  }

  const html =
    await fetchHtml(
      target,
      25000
    );

  const $ =
    cheerio.load(html);

  const links: VideoLink[] = [];
  const seen =
    new Set<string>();

  /* ---------------------------------------------------------
     1. video/source
  --------------------------------------------------------- */

  $(
    'video source, video[src], source'
  ).each(
    (_, element) => {
      const source =
        $(element);

      const url =
        source.attr('src') ||
        source.attr('data-src') ||
        source.attr('data-url') ||
        '';

      const quality =
        source.attr(
          'data-quality'
        ) ||
        source.attr('size') ||
        source.attr('title') ||
        '';

      addVideoLink(
        links,
        seen,
        url,
        quality
      );
    }
  );

  /* ---------------------------------------------------------
     2. روابط الفيديو المباشرة
  --------------------------------------------------------- */

  $('a[href]').each(
    (_, element) => {
      const anchor =
        $(element);

      const href =
        anchor.attr('href') ||
        '';

      if (
        !isVideoUrl(href)
      ) {
        return;
      }

      const text =
        cleanText(
          anchor.text()
        );

      addVideoLink(
        links,
        seen,
        href,
        text
      );
    }
  );

  /* ---------------------------------------------------------
     3. صفحات watch/download
  --------------------------------------------------------- */

  if (
    links.length === 0
  ) {
    const targets: {
      url: string;
      label: string;
    }[] = [];

    const seenUrls =
      new Set<string>();

    $(
      'a[href*="/watch/"],' +
        'a[href*="/download/"]'
    ).each(
      (_, element) => {
        const anchor =
          $(element);

        let href =
          anchor.attr(
            'href'
          ) || '';

        if (!href) {
          return;
        }

        href =
          normalizeUrl(
            href
          );

        if (
          !href ||
          seenUrls.has(
            href
          )
        ) {
          return;
        }

        seenUrls.add(
          href
        );

        const text =
          cleanText(
            anchor.text()
          );

        const parentCard =
          anchor.closest(
            '.download-item,' +
              '.col-lg-auto,' +
              'tr,' +
              'li,' +
              'div'
          );

        const badge =
          cleanText(
            parentCard
              .find(
                '.badge,' +
                  '.quality,' +
                  '[class*="quality"]'
              )
              .first()
              .text()
          );

        targets.push({
          url: href,
          label:
            badge ||
            text ||
            'HD',
        });
      }
    );

    /*
     * لا نرسل عددًا كبيرًا من الطلبات.
     */
    const limitedTargets =
      targets.slice(
        0,
        6
      );

    const pages =
      await Promise.allSettled(
        limitedTargets.map(
          (item) =>
            fetchHtml(
              item.url,
              15000
            )
        )
      );

    pages.forEach(
      (result, index) => {
        if (
          result.status !==
          'fulfilled'
        ) {
          return;
        }

        const sub$ =
          cheerio.load(
            result.value
          );

        const meta =
          limitedTargets[
            index
          ];

        /*
         * video/source
         */
        sub$(
          'video source,' +
            'video[src],' +
            'source'
        ).each(
          (_, element) => {
            const source =
              sub$(element);

            const url =
              source.attr(
                'src'
              ) ||
              source.attr(
                'data-src'
              ) ||
              source.attr(
                'data-url'
              ) ||
              '';

            const quality =
              source.attr(
                'data-quality'
              ) ||
              source.attr(
                'size'
              ) ||
              meta.label;

            addVideoLink(
              links,
              seen,
              url,
              quality
            );
          }
        );

        /*
         * روابط مباشرة
         */
        sub$(
          'a[href]'
        ).each(
          (_, element) => {
            const anchor =
              sub$(element);

            const href =
              anchor.attr(
                'href'
              ) || '';

            if (
              !isVideoUrl(
                href
              )
            ) {
              return;
            }

            addVideoLink(
              links,
              seen,
              href,
              meta.label ||
                cleanText(
                  anchor.text()
                )
            );
          }
        );
      }
    );
  }

  /*
   * ترتيب الجودة.
   */
  links.sort(
    (a, b) =>
      qualityRank(
        b.quality
      ) -
      qualityRank(
        a.quality
      )
  );

  /* ---------------------------------------------------------
     Deduplicate quality mirrors
  --------------------------------------------------------- */

  const finalLinks:
    VideoLink[] = [];

  const qualityCount =
    new Map<
      string,
      number
    >();

  for (
    const link of links
  ) {
    const baseQuality =
      link.quality;

    const count =
      (qualityCount.get(
        baseQuality
      ) || 0) + 1;

    qualityCount.set(
      baseQuality,
      count
    );

    if (
      count === 1
    ) {
      finalLinks.push(
        link
      );
    } else if (
      count === 2
    ) {
      finalLinks.push({
        ...link,
        quality:
          `${baseQuality} (سيرفر 2)`,
      });
    }
  }

  if (
    finalLinks.length > 0
  ) {
    cacheSet(
      linkCache,
      target,
      finalLinks,
      LINK_CACHE_TTL
    );
  }

  return finalLinks;
}

/* =========================================================
   DETAILS
========================================================= */

export async function getDetails(
  pageUrl: string
): Promise<MediaDetails> {
  const target =
    normalizeUrl(pageUrl);

  if (!target) {
    throw new Error(
      'رابط المحتوى غير صالح'
    );
  }

  const html =
    await fetchHtml(
      target
    );

  const $ =
    cheerio.load(html);

  /* ---------------------------------------------------------
     TITLE
  --------------------------------------------------------- */

  let title =
    cleanText(
      $('h1')
        .first()
        .text()
    );

  if (!title) {
    title =
      cleanText(
        $('meta[property="og:title"]')
          .attr('content') ||
          ''
      );
  }

  if (!title) {
    title =
      cleanText(
        $('title')
          .first()
          .text()
      );
  }

  if (!title) {
    title =
      'بدون عنوان';
  }

  /* ---------------------------------------------------------
     IMAGE
  --------------------------------------------------------- */

  let image =
    normalizeUrl(
      $(
        'meta[property="og:image"]'
      ).attr(
        'content'
      ) || ''
    );

  if (!image) {
    image =
      extractImage(
        $,
        $('body')
      );
  }

  /* ---------------------------------------------------------
     STORY
  --------------------------------------------------------- */

  const story =
    cleanText(
      $(
        '[class*="story"],' +
          '[class*="description"],' +
          '.description,' +
          '.story,' +
          'p.text-muted'
      )
        .first()
        .text()
    );

  /* ---------------------------------------------------------
     RATING
  --------------------------------------------------------- */

  let rating =
    cleanText(
      $(
        '.rating,' +
          '[class*="rating"]'
      )
        .first()
        .text()
    );

  rating =
    rating
      .replace(
        /[^0-9.]/g,
        ''
      );

  /* ---------------------------------------------------------
     DURATION
  --------------------------------------------------------- */

  const duration =
    cleanText(
      $(
        '[class*="duration"],' +
          '.duration'
      )
        .first()
        .text()
    );

  /* ---------------------------------------------------------
     QUALITY
  --------------------------------------------------------- */

  let quality =
    cleanText(
      $(
        '.quality,' +
          '[class*="quality"],' +
          '.badge'
      )
        .first()
        .text()
    );

  if (!quality) {
    quality =
      extractQuality(
        cleanText(
          $('body').text()
        )
      ) || '';
  }

  /* ---------------------------------------------------------
     YEAR
  --------------------------------------------------------- */

  let year =
    cleanText(
      $(
        '.year,' +
          '[class*="year"],' +
          '.badge-secondary'
      )
        .first()
        .text()
    );

  if (!year) {
    year =
      extractYear(
        cleanText(
          $('body').text()
        )
      ) || '';
  }

  /* ---------------------------------------------------------
     GENRES
  --------------------------------------------------------- */

  const genres:
    string[] = [];

  $(
    '.genre,' +
      '.genres a,' +
      '[class*="genre"] a'
  ).each(
    (_, element) => {
      const genre =
        cleanText(
          $(element).text()
        );

      if (
        genre &&
        !genres.includes(
          genre
        )
      ) {
        genres.push(
          genre
        );
      }
    }
  );

  /* ---------------------------------------------------------
     SUBTITLES
  --------------------------------------------------------- */

  const subtitles:
    SubtitleTrack[] = [];

  $('track').each(
    (_, element) => {
      const track =
        $(element);

      const src =
        normalizeUrl(
          track.attr(
            'src'
          ) || ''
        );

      if (!src) {
        return;
      }

      subtitles.push({
        label:
          track.attr(
            'label'
          ) ||
          'العربية',

        lang:
          track.attr(
            'srclang'
          ) ||
          'ar',

        src,
      });
    }
  );

  /* ---------------------------------------------------------
     VIDEO LINKS
  --------------------------------------------------------- */

  const links =
    await getCleanLink(
      target
    );

  return {
    title,
    image,

    story:
      story ||
      undefined,

    rating:
      rating ||
      undefined,

    quality:
      quality ||
      undefined,

    year:
      year ||
      undefined,

    duration:
      duration ||
      undefined,

    genres,

    links,

    subtitles,
  };
}
