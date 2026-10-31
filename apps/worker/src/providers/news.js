const CATEGORIES = Object.freeze({
  'CHUNG-KHOAN': { cafef: 'thi-truong-chung-khoan' },
  'BAT-DONG-SAN': { cafef: 'bat-dong-san', vnexpress: 'bat-dong-san' },
  'DOANH-NGHIEP': { cafef: 'doanh-nghiep', vnexpress: 'kinh-doanh' },
  'NGAN-HANG': { cafef: 'tai-chinh-ngan-hang' },
  'VI-MO': { cafef: 'vi-mo-dau-tu' },
  'HANG-HOA': { cafef: 'hang-hoa-nguyen-lieu' },
  'QUOC-TE': { cafef: 'tai-chinh-quoc-te' },
});

const CAFEF = 'https://cafef.vn';
const VNEXPRESS = 'https://vnexpress.net';
export const SYMBOL_PAGE_SIZE = 30;

export function createNewsProvider({ fetchImpl = fetch, timeoutMs = 20_000 } = {}) {
  return { categories: Object.keys(CATEGORIES), fetchCategory, fetchSymbolPage };

  // CafeF's per-symbol news list (company news and disclosures), newest first, 30 per page, going back many years.
  async function fetchSymbolPage(symbol, page) {
    const url = `${CAFEF}/du-lieu/Ajax/Events_RelatedNews_New.aspx?symbol=${encodeURIComponent(symbol)}&floorID=0&configID=0&PageIndex=${page}&PageSize=${SYMBOL_PAGE_SIZE}&Type=2`;
    // A long backfill makes hundreds of requests; retry transient network errors twice before giving up.
    for (let attempt = 1; ; attempt += 1) {
      try {
        return parseCafeFSymbolList(await fetchText(url, { fetchImpl, timeoutMs }), symbol);
      } catch (error) {
        if (attempt >= 3) throw error;
        await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
      }
    }
  }

  async function fetchCategory(category) {
    const config = CATEGORIES[category];
    if (!config) throw new Error(`Unsupported news category: ${category}.`);
    const sources = [];
    const errors = [];

    try {
      const html = await fetchText(`${CAFEF}/${config.cafef}.chn`, { fetchImpl, timeoutMs });
      sources.push({ source: 'CafeF', articles: parseCafeFList(html, category) });
    } catch (error) { errors.push(error); }

    if (config.vnexpress) {
      try {
        const xml = await fetchText(`${VNEXPRESS}/rss/${config.vnexpress}.rss`, { fetchImpl, timeoutMs });
        sources.push({ source: 'VnExpress', articles: parseRss(xml, category) });
      } catch (error) { errors.push(error); }
    }

    if (!sources.length) throw new Error(errors.map((error) => error.message).join(' | ') || 'News sources unavailable.');
    return sources;
  }
}

export function tagSymbols(text, symbols) {
  const normalized = text.toLocaleUpperCase('vi-VN');
  return symbols.filter(({ symbol }) => {
    const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^A-Z0-9])${escaped}($|[^A-Z0-9])`).test(normalized);
  }).map(({ symbol }) => symbol);
}

function parseCafeFList(html, category) {
  const articles = [];
  const seen = new Set();
  const chunks = html.split(/role="article"/i).slice(1);
  for (const chunk of chunks) {
    const link = /href="(\/[^"?#]+\.chn)"[^>]*>\s*([^<]+?)\s*<\/a>/i.exec(chunk);
    if (!link || seen.has(link[1])) continue;
    const publishedAt = cafeFTime(chunk, link[1]);
    if (!publishedAt) continue;
    seen.add(link[1]);
    articles.push({
      externalId: `${CAFEF}${link[1]}`,
      title: cleanHtml(link[2]),
      summary: cleanHtml(/class="sapo[^"]*"[^>]*>\s*([^<]+?)\s*</i.exec(chunk)?.[1] ?? ''),
      publishedAt,
      url: `${CAFEF}${link[1]}`,
      category,
    });
  }
  return articles;
}

// Items look like: <span class="timeTitle">28/10/2026 18:03</span> ... <a class='docnhanhTitle' href="/..." title="...">.
export function parseCafeFSymbolList(html, symbol) {
  const articles = [];
  for (const item of html.split(/<li\b/i).slice(1)) {
    const time = /class="timeTitle">\s*(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/.exec(item);
    const link = /class=['"]docnhanhTitle['"][^>]*href="([^"]+)"[^>]*title="([^"]*)"/i.exec(item)
      ?? /href="([^"]+)"[^>]*class=['"]docnhanhTitle['"][^>]*title="([^"]*)"/i.exec(item);
    if (!time || !link) continue;
    const path = link[1].split(/[?#]/)[0];
    if (!/\.chn$/i.test(path)) continue;
    const url = path.startsWith('http') ? path : `${CAFEF}${path}`;
    articles.push({
      externalId: url,
      title: decodeEntities(link[2].trim()),
      summary: '',
      publishedAt: `${time[3]}-${time[2]}-${time[1]}T${time[4]}:${time[5]}:00+07:00`,
      url,
      category: `SYMBOL:${symbol}`,
    });
  }
  return articles;
}

function cafeFTime(chunk, path) {
  const iso = /title="(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})"/.exec(chunk)?.[1];
  if (iso) return `${iso}+07:00`;
  const dmy = /data-time="\d?(\d{2})\/(\d{2})\/(\d{4}) - (\d{2}):(\d{2})/.exec(chunk);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}T${dmy[4]}:${dmy[5]}:00+07:00`;
  const id = path.slice(path.lastIndexOf('-') + 1).replace(/\.chn$/i, '');
  if (/^\d{15,}$/.test(id)) return `20${id.slice(3, 5)}-${id.slice(5, 7)}-${id.slice(7, 9)}T${id.slice(9, 11)}:${id.slice(11, 13)}:${id.slice(13, 15)}+07:00`;
  return null;
}

function parseRss(xml, category) {
  const items = [];
  for (const item of xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) ?? []) {
    const title = xmlTag(item, 'title');
    const url = xmlTag(item, 'link');
    const publishedText = xmlTag(item, 'pubDate');
    const published = publishedText ? new Date(publishedText) : null;
    if (!title || !url || !published || Number.isNaN(published.valueOf()) || !/^https:\/\/vnexpress\.net\/[a-z0-9-]+-\d+\.html$/i.test(url)) continue;
    items.push({
      externalId: url,
      title,
      summary: cleanHtml(xmlTag(item, 'description')),
      publishedAt: published.toISOString(),
      url,
      category,
    });
  }
  return items;
}

async function fetchText(url, { fetchImpl, timeoutMs }) {
  const response = await fetchImpl(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 StockSenseNewsWorker/1.0', Accept: 'text/html,application/rss+xml,application/xml' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`News source returned HTTP ${response.status}.`);
  return response.text();
}

function xmlTag(xml, tag) {
  const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(xml);
  if (!match) return '';
  return decodeEntities(match[1].replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/i, '$1').trim());
}

function cleanHtml(value) {
  return decodeEntities(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function decodeEntities(value) {
  return value
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}
