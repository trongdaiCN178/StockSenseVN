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

export function createNewsProvider({ fetchImpl = fetch, timeoutMs = 20_000 } = {}) {
  return { categories: Object.keys(CATEGORIES), fetchCategory };

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
