// FR-M12 Chat without a language model (SDD 5.3 fallback): input guard -> intent -> fixed retrieval ->
// template answer with citations -> output filter. Every number in an answer comes from retrieved records.
import { hasCapability } from '@stocksense/core/access';
import { getForecastLabel } from '@stocksense/core/labels';
import { buildBoardQuote } from '@stocksense/core/price-board';
import { changeOver, sma, rsi, macd } from '@stocksense/core/indicators';

export const CHAT_ENGINE = 'rule-based-1';
export const NO_DATA = 'Hệ thống không có dữ liệu này.';
export const REFUSAL = 'Mình không thể đưa lệnh, khuyến nghị mua/bán, giá mục tiêu hay tư vấn đầu tư cá nhân. '
  + 'Bạn có thể hỏi về giá, dự báo T+2/T+5, tin tức của một mã, hoặc xem lại Trade Plan do chính bạn lập để tự đánh giá R:R. '
  + 'Mọi thông tin chỉ mang tính tham khảo, không phải tư vấn đầu tư.';
const OTHER_USER = 'Mình chỉ truy cập được dữ liệu của chính tài khoản đang đăng nhập, không xem được danh mục, kế hoạch hay nhật ký của người khác.';
const HELP = 'Mình trả lời dựa trên dữ liệu của StockSense VN, ví dụ:\n'
  + '• Giá và biến động: "Giá FPT hôm nay?", "HPG tuần này biến động thế nào?"\n'
  + '• Dự báo: "Dự báo T+5 của VCB?"\n'
  + '• Tin tức: "Tin mới về SSI"\n'
  + '• Chỉ báo kỹ thuật: "RSI của MWG?"\n'
  + '• Thị trường: "VN-Index hôm nay?"\n'
  + '• Dữ liệu của bạn: "Danh mục của tôi", "Trade Plan của tôi", "Nhật ký của tôi", "Watchlist của tôi"\n'
  + '• Thuật ngữ: "R:R là gì?", "Giá trần là gì?"';

const vnd = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const dec = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
const pct = (value) => (value == null ? '—' : `${value > 0 ? '+' : value < 0 ? '−' : ''}${dec.format(Math.abs(value))}%`);
const day = (iso) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('vi-VN', { timeZone: 'UTC' }) : '—');
// Period returns and indicators use back-adjusted closes so stock dividends and splits are not read as drops.
const adjusted = (bars) => bars.map((bar) => ({ ...bar, close: bar.adjClose ?? bar.close }));
const billions = (value) => (value == null ? '—' : `${dec.format(value / 1e9)} tỷ đ`);

// Lowercase without Vietnamese diacritics, so "giá" and "gia" match the same patterns.
export function normalize(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, ' ').trim();
}

// FR-M12-03: requests for orders, buy/sell advice, price targets or personal advice.
const ORDER_PATTERNS = [
  /\bnen (mua|ban|vao|chot|cat|gom|om|giu|nam giu|xuong tien|bat day|dau tu)\b/,
  /\bco nen\b/,
  /\b(mua|ban) (hay|hoac) (ban|mua|giu)\b/,
  /\bdat lenh\b|\blenh (mua|ban)\b|\bvao lenh\b/,
  /\bgia muc tieu\b|\btarget\b|\bkhuyen nghi\b|\btu van\b|\brecommend/,
  /\b(mua|ban) (bao nhieu|o gia|luc nao|khi nao)\b|\bkhi nao (nen )?(mua|ban)\b|\bdiem (mua|ban)\b/,
  /\ball[ -]?in\b|\bx2 tai khoan\b|\bchac chan (tang|len|lai)\b/,
  /\b(ma|co phieu) nao\b.*\b(tang|len|lai|mua|tot nhat|manh nhat)\b/,
];
const OTHER_USER_PATTERNS = [/@/, /\bnguoi (khac|dung khac)\b/, /\btai khoan (khac|cua)\b/, /\bcua (anh|chi|ban|user|nguoi dung) [a-z]/];
const PERSONAL_INTENTS = new Set(['portfolio', 'plans', 'journal', 'watchlist']);

// FR-M12-04: phrases an answer must never contain.
const OUTPUT_BLOCKLIST = [/\b(MUA|BÁN)\b/, /\bnên (mua|bán)\b/i, /khuyến nghị (mua|bán)/i, /giá mục tiêu (của|cho) [A-Z0-9]{3}/i];

// Capitalised 3-letter words that are not tickers.
const ACRONYMS = new Set(['RSI', 'EMA', 'SMA', 'ROE', 'ROA', 'EPS', 'NAV', 'ROI', 'ETF', 'IPO', 'ESG', 'CEO', 'GDP', 'CPI', 'FDI', 'VND', 'USD', 'HNX', 'API', 'PDF', 'CSV', 'ATM', 'TMCP']);
const AMBIGUOUS_TERMS = new Set(['tran', 'san', 'rr', 'tham chieu', 'khoi luong', 'nhat ky', 'xac suat']);
const GLOSSARY = [
  [['ty le loi nhuan rui ro', 'r:r', 'rr'], 'R:R (tỷ lệ lợi nhuận/rủi ro) = (giá mục tiêu − giá vào) / (giá vào − giá cắt lỗ) trong Trade Plan do bạn tự lập. Ví dụ vào 56.000, cắt lỗ 53.000, mục tiêu 62.000 thì R:R = 6.000 / 3.000 = 2.'],
  [['cat lo', 'stop loss'], 'Giá cắt lỗ là mức giá bạn tự đặt trong Trade Plan để giới hạn khoản lỗ tối đa. Khoảng cách từ giá vào tới giá cắt lỗ là "rủi ro 1R" dùng để tính R:R và khối lượng.'],
  [['gia tham chieu', 'tham chieu'], 'Giá tham chiếu (TC) là mốc tính biên độ trong phiên: HOSE và HNX lấy giá đóng cửa phiên trước, UPCoM lấy giá bình quân phiên trước. Trên bảng giá, TC màu vàng.'],
  [['gia tran', 'tran'], 'Giá trần là mức giá cao nhất được đặt trong phiên: tham chiếu × (1 + biên độ), làm tròn theo bước giá. Trên bảng giá, giá trần màu tím.'],
  [['gia san', 'san'], 'Giá sàn là mức giá thấp nhất được đặt trong phiên: tham chiếu × (1 − biên độ), làm tròn theo bước giá. Trên bảng giá, giá sàn màu xanh lam.'],
  [['bien do'], 'Biên độ dao động giá trong ngày: HOSE ±7%, HNX ±10%, UPCoM ±15% so với giá tham chiếu.'],
  [['buoc gia'], 'Bước giá trên HOSE: 10 đ (giá dưới 10.000), 50 đ (10.000–49.950), 100 đ (từ 50.000). HNX và UPCoM: 100 đ.'],
  [['lo chan', 'lo 100', 'lo giao dich'], 'Cổ phiếu HOSE/HNX giao dịch theo lô 100 cổ phiếu, nên khối lượng tối đa trong Trade Plan được làm tròn xuống bội số của 100.'],
  [['rsi'], 'RSI(14) là chỉ báo động lượng thang 0–100 tính từ mức tăng và giảm trung bình 14 phiên. Theo quy ước, trên 70 thường gọi là vùng quá mua, dưới 30 là vùng quá bán; đây chỉ là mô tả kỹ thuật, không phải tín hiệu giao dịch.'],
  [['macd'], 'MACD = EMA12 − EMA26 của giá đóng cửa; đường tín hiệu là EMA9 của MACD; histogram là MACD − tín hiệu. Dùng để mô tả xu hướng và động lượng.'],
  [['ma20', 'ma50', 'duong trung binh', 'trung binh dong'], 'MA20 và MA50 là trung bình giá đóng cửa 20 và 50 phiên gần nhất, giúp nhìn xu hướng ngắn và trung hạn trên biểu đồ nến.'],
  [['khoi luong'], 'Khối lượng là tổng số cổ phiếu khớp lệnh trong phiên.'],
  [['gtgd', 'gia tri giao dich'], 'Giá trị giao dịch (GTGD) là tổng tiền khớp lệnh trong phiên; GTGD bình quân 20 phiên dùng để đánh giá thanh khoản.'],
  [['t+2', 't+5', 'ky han'], 'T+2 và T+5 là dự báo xu hướng sau 2 và 5 phiên giao dịch kể từ ngày dữ liệu T (bỏ qua cuối tuần và ngày nghỉ lễ).'],
  [['di ngang'], '"Đi ngang" là nhãn dự báo khi biến động dự kiến nằm trong ngưỡng nhỏ quanh giá hiện tại, giữa hai nhãn Tăng và Giảm.'],
  [['xac suat'], 'Mỗi dự báo có xác suất cho 3 nhãn Tăng / Đi ngang / Giảm, tổng bằng 100%; nhãn hiển thị là nhãn có xác suất cao nhất.'],
  [['do tin cay'], 'Độ tin cậy (Thấp / Trung bình / Cao) dựa trên xác suất của nhãn cao nhất và việc dữ liệu có đầy đủ hay không.'],
  [['hit rate', 'ty le dung'], 'Hit rate là tỷ lệ dự báo đúng trên các dự báo đã đến hạn, luôn hiển thị kèm số mẫu.'],
  [['trade plan', 'ke hoach giao dich'], 'Trade Plan là kế hoạch do bạn tự lập: mã, vùng giá vào, giá cắt lỗ, giá kỳ vọng và lý do. Hệ thống chỉ tính R:R, khoảng cách % và khối lượng theo mức rủi ro bạn chọn, không tự đặt lệnh.'],
  [['journal', 'nhat ky'], 'Journal là nhật ký quyết định: tự tạo khi bạn đóng Trade Plan, hoặc ghi thủ công; có ghi chú, thẻ, bài học và thống kê theo kỳ.'],
  [['watchlist'], 'Watchlist là danh sách tối đa 10 mã bạn theo dõi, kèm cảnh báo theo mốc giá.'],
  [['screener'], 'Screener là công cụ sàng lọc mã theo sàn, ngành, giá, % thay đổi và thanh khoản; kết quả là danh sách sàng lọc, không phải bảng xếp hạng nên mua.'],
  [['gia von binh quan', 'gia von'], 'Giá vốn bình quân gia quyền = tổng tiền mua (kèm phí) / tổng khối lượng đang nắm; dùng để tính lãi/lỗ tạm tính trong Portfolio.'],
  [['do rong thi truong', 'do rong'], 'Độ rộng thị trường là số mã tăng, đứng giá và giảm trong phiên; trên StockSense tính trên các mã đang theo dõi.'],
];

export function createChatAssistant(deps) {
  let symbolCache = null;
  async function symbols() {
    if (!symbolCache || Date.now() - symbolCache.at > 60_000) {
      const board = await deps.market.board();
      symbolCache = { at: Date.now(), board, set: new Map(board.items.map((item) => [item.symbol, item])) };
    }
    return symbolCache;
  }

  async function answer({ user, question }) {
    const text = String(question ?? '').trim();
    const norm = normalize(text);
    const result = (intent, content, citations = [], extra = {}) => ({ intent, content, citations, status: 'complete', filterResult: 'pass', personal: PERSONAL_INTENTS.has(intent), engine: CHAT_ENGINE, ...extra });

    if (ORDER_PATTERNS.some((pattern) => pattern.test(norm))) {
      return result('advice_request', REFUSAL, [], { status: 'blocked', filterResult: 'input_blocked' });
    }
    if (OTHER_USER_PATTERNS.some((pattern) => pattern.test(norm))) {
      return result('other_user', OTHER_USER, [], { status: 'blocked', filterResult: 'input_blocked' });
    }

    const { board, set } = await symbols();
    const tokens = [...new Set((text.toUpperCase().match(/\b[A-Z0-9]{3}\b/g) ?? []))];
    const found = tokens.filter((token) => set.has(token));
    // A ticker the user names but StockSense does not track: "mã XYZ", or a capitalised 3-letter code.
    const unknown = text.match(/\bm[ãa] ([A-Za-z0-9]{3,5})\b/i)?.[1]?.toUpperCase()
      ?? (text.match(/\b[A-Z]{3}\b/g) ?? []).find((token) => !set.has(token) && !ACRONYMS.has(token));

    const has = (re) => re.test(norm);
    let outcome;
    if (has(/\b(ban (la ai|lam duoc gi|co the lam gi|giup duoc gi)|huong dan|tro giup|help)\b/)) outcome = result('help', HELP);
    else if (unknown && !set.has(unknown) && !found.length) outcome = result('unknown_symbol', `${NO_DATA} Mã ${unknown} không nằm trong ${board.items.length} mã StockSense đang theo dõi (${board.items.map((item) => item.symbol).join(', ')}).`);
    else if (has(/\b(danh muc|portfolio|vi the|lai lo|loi lo|tai san cua toi)\b/)) outcome = await portfolio(user, result);
    else if (has(/\b(trade plan|ke hoach)\b/) && has(/\b(toi|cua minh|minh)\b/)) outcome = await planList(user, result);
    else if (has(/\b(nhat ky|journal)\b/) && has(/\b(toi|cua minh|minh)\b/)) outcome = await journalSummary(user, result);
    else if (has(/\b(watchlist|danh sach theo doi|dang theo doi)\b/) && has(/\b(toi|cua minh|minh)\b/)) outcome = await watchlistList(user, result);
    else if (found.length) outcome = await aboutSymbol(found[0], norm, result);
    else if (has(/\b(thi truong|vn-?index|vnindex|hnx|vn30|chi so)\b/) && !glossaryTerm(norm)?.explicit) outcome = await marketSummary(result);
    else {
      const term = glossaryTerm(norm);
      outcome = term ? result('glossary', term.text, [{ type: 'glossary', label: 'Thuật ngữ trong StockSense VN', path: null }])
        : result('no_data', `${NO_DATA} Mình chỉ trả lời về giá, dự báo, tin tức của ${board.items.length} mã đang theo dõi, thị trường, thuật ngữ và dữ liệu của chính bạn. Gõ "hướng dẫn" để xem ví dụ câu hỏi.`);
    }
    return filterOutput(outcome);
  }

  function glossaryTerm(norm) {
    const asksDefinition = /\b(la gi|nghia la|y nghia|giai thich|hieu the nao|dinh nghia|cach tinh)\b/.test(norm);
    let best = null;
    for (const [keys, definition] of GLOSSARY) {
      for (const key of keys) {
        const pattern = new RegExp(`(^|[^a-z0-9])${key.replace(/[+:]/g, (c) => `\\${c}`)}([^a-z0-9]|$)`);
        if (pattern.test(norm) && (!best || key.length > best.key.length)) best = { key, text: definition, explicit: asksDefinition };
      }
    }
    // Everyday words such as "tran"/"san" only count when the user explicitly asks for a definition.
    if (best && AMBIGUOUS_TERMS.has(best.key) && !asksDefinition) return null;
    return best;
  }

  async function aboutSymbol(symbol, norm, result) {
    const has = (re) => re.test(norm);
    if (has(/\b(vi sao|tai sao|ly do|giai thich|nguyen nhan)\b/) && has(/\b(du bao|nhan|tang|giam|di ngang)\b/)) {
      return result('forecast_reason', `${NO_DATA} Hệ thống chưa có dữ liệu giải thích cho dự báo của ${symbol} (phần giải thích cần mô hình dự báo). Bạn có thể xem xác suất T+2/T+5 và tin tức của mã.`, [{ type: 'symbol', label: `Trang ${symbol}`, path: `/symbols/${symbol}` }]);
    }
    if (has(/\b(hit rate|lich su du bao|do chinh xac|dung sai|ty le dung)\b/)) {
      return result('forecast_history', `${NO_DATA} Chưa có lịch sử dự báo đã đến hạn cho ${symbol}, nên chưa tính được hit rate.`);
    }
    if (has(/\b(du bao|xu huong|t\+?2|t\+?5|nhan|tang hay giam|se tang|se giam)\b/)) return forecast(symbol, result);
    if (has(/\b(tin|tin tuc|bai bao|thong tin moi)\b/)) return news(symbol, result);
    if (has(/\b(rsi|macd|ma20|ma50|ky thuat|chi bao|trung binh)\b/)) return technical(symbol, result);
    return price(symbol, result);
  }

  async function price(symbol, result) {
    const [{ set }, prices] = await Promise.all([symbols(), deps.market.prices(symbol, '3m')]);
    const info = set.get(symbol);
    const bars = prices?.items ?? [];
    if (!bars.length) return result('price', `${NO_DATA} Chưa có giá của ${symbol}.`);
    const quote = buildBoardQuote(info.exchange, bars.at(-1), bars.at(-2));
    const move = quote.change > 0 ? `tăng ${vnd.format(quote.change)} đ (${pct(quote.changePercent)})` : quote.change < 0 ? `giảm ${vnd.format(-quote.change)} đ (${pct(quote.changePercent)})` : 'đứng giá tham chiếu (0%)';
    const content = `${symbol} (${info.exchange}${info.industry ? `, ${info.industry}` : ''}) phiên ${day(quote.date)}: đóng cửa ${vnd.format(quote.close)} đ, ${move} so với tham chiếu ${vnd.format(quote.reference)}. `
      + `Mở cửa ${vnd.format(quote.open)}, cao nhất ${vnd.format(quote.high)}, thấp nhất ${vnd.format(quote.low)}; khối lượng ${vnd.format(quote.volume ?? 0)} cp, giá trị ${billions(quote.turnover)}. `
      + `Trần ${vnd.format(quote.ceiling)}, sàn ${vnd.format(quote.floor)}. Thay đổi 1 tuần ${pct(changeOver(adjusted(bars), 5))}, 1 tháng ${pct(changeOver(adjusted(bars), 21))} (giá điều chỉnh). `
      + 'Dữ liệu cuối ngày từ SSI.';
    return result('price', content, [{ type: 'price', label: `Giá ${symbol} phiên ${day(quote.date)} (SSI)`, date: quote.date, path: `/symbols/${symbol}` }]);
  }

  async function technical(symbol, result) {
    const prices = await deps.market.prices(symbol, '6m');
    const bars = prices?.items ?? [];
    if (bars.length < 35) return result('technical', `${NO_DATA} Chưa đủ lịch sử giá của ${symbol} để tính chỉ báo.`);
    const closes = adjusted(bars).map((bar) => bar.close);
    const last = closes.at(-1);
    const r = rsi(closes, 14).at(-1);
    const ma20 = sma(closes, 20).at(-1);
    const ma50 = bars.length >= 50 ? sma(closes, 50).at(-1) : null;
    const m = macd(closes);
    const line = m.macd.at(-1); const signal = m.signal.at(-1);
    const position = (ma) => (ma == null ? 'chưa đủ dữ liệu' : `${vnd.format(Math.round(ma))} (giá đóng cửa ${last >= ma ? 'trên' : 'dưới'} đường này)`);
    const content = `Chỉ báo kỹ thuật của ${symbol} tính đến phiên ${day(bars.at(-1).date)}: RSI(14) = ${dec.format(r)}`
      + `${r >= 70 ? ' (trên 70, vùng quá mua theo quy ước)' : r <= 30 ? ' (dưới 30, vùng quá bán theo quy ước)' : ''}; `
      + `MA20 = ${position(ma20)}; MA50 = ${position(ma50)}; MACD = ${dec.format(line)}, đường tín hiệu = ${dec.format(signal)} (MACD ${line >= signal ? 'trên' : 'dưới'} đường tín hiệu). `
      + 'Đây là mô tả kỹ thuật từ giá lịch sử, không phải tín hiệu giao dịch.';
    return result('technical', content, [{ type: 'price', label: `Giá ${symbol} 6 tháng (SSI), biểu đồ nến`, date: bars.at(-1).date, path: `/symbols/${symbol}` }]);
  }

  async function forecast(symbol, result) {
    const [detail, status] = await Promise.all([deps.market.symbol(symbol), deps.market.status()]);
    const t2 = detail?.forecasts?.t2; const t5 = detail?.forecasts?.t5;
    if (!t2?.label && !t5?.label) return result('forecast', `${NO_DATA} Chưa có dự báo cho ${symbol}.`);
    const describe = (name, f) => {
      if (!f?.label) return `${name}: chưa có`;
      const p = f.probabilities ?? {};
      const share = (key) => `${Math.round((p[key] ?? 0) * 100)}%`;
      const conf = { low: 'thấp', mid: 'trung bình', high: 'cao' }[f.confidence] ?? 'chưa có';
      return `${name}: ${getForecastLabel(f.label).text} (Tăng ${share('up')}, Đi ngang ${share('hold')}, Giảm ${share('down')}; độ tin cậy ${conf})`;
    };
    const demo = status?.state === 'demo' ? ' Lưu ý: đây là dữ liệu dự báo mẫu vì mô hình chưa được triển khai.' : '';
    const content = `Dự báo xu hướng của ${symbol} với ngày dữ liệu ${day(status?.dataDate)}: ${describe('T+2', t2)}; ${describe('T+5', t5)}.${demo} Dự báo chỉ mang tính tham khảo, không phải khuyến nghị đầu tư.`;
    return result('forecast', content, [{ type: 'forecast', label: `Dự báo ${symbol} ngày ${day(status?.dataDate)}${status?.modelVersion ? ` · mô hình ${status.modelVersion}` : ''}`, date: status?.dataDate, path: `/symbols/${symbol}` }]);
  }

  async function news(symbol, result) {
    const list = await deps.market.news(symbol);
    const items = (list?.items ?? []).slice(0, 3);
    if (!items.length) return result('news', `${NO_DATA} Chưa có tin tức nào gắn với ${symbol}.`);
    const date = (iso) => new Date(iso).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    const content = `${items.length} tin mới nhất về ${symbol}:\n${items.map((item, i) => `${i + 1}. ${item.title} (${item.source}, ${date(item.publishedAt)})`).join('\n')}\nBấm nguồn bên dưới để đọc bài gốc.`;
    return result('news', content, items.map((item) => ({ type: 'news', label: `${item.source}: ${item.title}`, date: item.publishedAt.slice(0, 10), url: item.url, path: item.url ? null : `/symbols/${symbol}` })));
  }

  async function marketSummary(result) {
    const summary = await deps.market.summary();
    if (!summary?.indices?.length) return result('market', `${NO_DATA} Chưa có dữ liệu chỉ số thị trường.`);
    const order = ['VNINDEX', 'HNX', 'VN30'];
    const indices = [...summary.indices].sort((a, b) => order.indexOf(a.code) - order.indexOf(b.code));
    const date = indices[0].date;
    const lines = indices.map((item) => `${item.label} ${dec.format(item.value)} điểm (${item.changePoints >= 0 ? '+' : '−'}${dec.format(Math.abs(item.changePoints))} điểm, ${pct(item.changePercent)})`);
    const b = summary.breadth;
    const breadth = b?.scope === 'tracked' ? ` Trong ${b.total} mã đang theo dõi: ${b.advances} mã tăng, ${b.nochanges} mã đứng giá, ${b.declines} mã giảm.` : '';
    const source = indices[0].source === 'ssi' ? ' Nguồn SSI, dữ liệu cuối ngày.' : ' (dữ liệu mẫu).';
    return result('market', `Thị trường phiên ${day(date)}: ${lines.join('; ')}.${breadth}${source}`,
      [{ type: 'market', label: `Chỉ số thị trường phiên ${day(date)}`, date, path: '/overview' }, { type: 'board', label: 'Bảng giá cuối ngày', date: b?.date, path: '/board' }]);
  }

  async function portfolio(user, result) {
    if (!hasCapability(user.role, 'portfolio.manage.self') || !deps.portfolios) return result('portfolio', `${NO_DATA} Vai trò của bạn không có Portfolio.`);
    const snap = await deps.portfolios.snapshot(user.id);
    if (!snap.positions.length) return result('portfolio', 'Danh mục của bạn hiện chưa có vị thế nào đang nắm giữ. Bạn có thể nhập giao dịch ở trang Portfolio.', [{ type: 'portfolio', label: 'Portfolio của bạn', path: '/portfolio' }]);
    const s = snap.summary;
    const top = [...snap.positions].sort((a, b) => b.weight_pct - a.weight_pct).slice(0, 5)
      .map((item) => `${item.symbol} ${vnd.format(item.quantity)} cp, giá vốn ${vnd.format(item.average_cost)}, giá hiện tại ${item.market_price == null ? '—' : vnd.format(item.market_price)}, lãi/lỗ tạm tính ${item.unrealized_pnl == null ? '—' : `${item.unrealized_pnl >= 0 ? '+' : '−'}${vnd.format(Math.abs(item.unrealized_pnl))} đ`}, tỷ trọng ${dec.format(item.weight_pct)}%`);
    const content = `Danh mục của bạn có ${snap.positions.length} mã đang nắm giữ. Giá trị thị trường ${s.market_value == null ? '—' : `${vnd.format(s.market_value)} đ`}, giá vốn ${vnd.format(s.cost_basis)} đ, `
      + `lãi/lỗ tạm tính ${s.unrealized_pnl == null ? '—' : `${s.unrealized_pnl >= 0 ? '+' : '−'}${vnd.format(Math.abs(s.unrealized_pnl))} đ`}, lãi/lỗ đã thực hiện ${s.realized_pnl >= 0 ? '+' : '−'}${vnd.format(Math.abs(s.realized_pnl))} đ.\n`
      + top.map((line) => `• ${line}`).join('\n');
    return result('portfolio', content, [{ type: 'portfolio', label: 'Portfolio của bạn (giá đóng cửa gần nhất)', path: '/portfolio' }]);
  }

  async function planList(user, result) {
    if (!hasCapability(user.role, 'plans.manage.self') || !deps.plans) return result('plans', `${NO_DATA} Vai trò của bạn không có Trade Plan.`);
    const { items } = await deps.plans.list(user.id);
    if (!items.length) return result('plans', 'Bạn chưa có Trade Plan nào. Bạn có thể tự lập kế hoạch ở trang Trade Plan.', [{ type: 'plans', label: 'Trade Plan của bạn', path: '/plans' }]);
    const labels = { draft: 'nháp', planned: 'chờ vào', active: 'đang mở', closed: 'đã đóng', cancelled: 'đã hủy' };
    const counts = Object.entries(items.reduce((acc, item) => ({ ...acc, [item.status]: (acc[item.status] ?? 0) + 1 }), {})).map(([key, count]) => `${count} ${labels[key] ?? key}`);
    const open = items.filter((item) => ['draft', 'planned', 'active'].includes(item.status)).slice(0, 5).map((item) => {
      const entry = item.entry_price_max ?? item.entry_price;
      const rr = entry > item.stop_price ? (item.target_price - entry) / (entry - item.stop_price) : null;
      return `${item.symbol} (${labels[item.status]}): vào ${vnd.format(item.entry_price)}${item.entry_price_max ? `–${vnd.format(item.entry_price_max)}` : ''}, cắt lỗ ${vnd.format(item.stop_price)}, kỳ vọng ${vnd.format(item.target_price)}${rr == null ? '' : `, R:R ${dec.format(rr)}`}`;
    });
    const content = `Bạn có ${items.length} Trade Plan (${counts.join(', ')}).${open.length ? `\nKế hoạch chưa đóng:\n${open.map((line) => `• ${line}`).join('\n')}` : ''}\nTrade Plan do bạn tự lập và tự chịu trách nhiệm.`;
    return result('plans', content, [{ type: 'plans', label: 'Trade Plan của bạn', path: '/plans' }]);
  }

  async function journalSummary(user, result) {
    if (!hasCapability(user.role, 'journal.read.self') || !deps.journal) return result('journal', `${NO_DATA} Vai trò của bạn không có Journal.`);
    const { items } = await deps.journal.list(user.id, { limit: 5 });
    if (!items.length) return result('journal', 'Nhật ký của bạn chưa có bản ghi nào. Bản ghi được tạo khi bạn đóng một Trade Plan.', [{ type: 'journal', label: 'Journal của bạn', path: '/journal' }]);
    let stats = '';
    if (hasCapability(user.role, 'journal.stats.read.self')) {
      const s = await deps.journal.stats(user.id);
      stats = ` Tổng ${s.entries} bản ghi, ${s.closed_plans} kế hoạch đã đóng: ${s.wins} có lãi, ${s.losses} lỗ, ${s.breakeven} hòa vốn; lãi/lỗ đã thực hiện ${Number(s.realized_pnl) >= 0 ? '+' : '−'}${vnd.format(Math.abs(Number(s.realized_pnl)))} đ.`;
    }
    const recent = items.slice(0, 3).map((item) => `${item.symbol ?? '—'} · ${item.title}${item.realized_pnl == null ? '' : ` (${item.realized_pnl >= 0 ? '+' : '−'}${vnd.format(Math.abs(item.realized_pnl))} đ)`}`);
    return result('journal', `Nhật ký của bạn.${stats}\nGần nhất:\n${recent.map((line) => `• ${line}`).join('\n')}`, [{ type: 'journal', label: 'Journal của bạn', path: '/journal' }]);
  }

  async function watchlistList(user, result) {
    if (!hasCapability(user.role, 'watchlist.manage.self') || !deps.watchlist) return result('watchlist', `${NO_DATA} Vai trò của bạn không có Watchlist.`);
    const { items } = await deps.watchlist.list(user.id);
    if (!items.length) return result('watchlist', 'Watchlist của bạn đang trống.', [{ type: 'watchlist', label: 'Watchlist của bạn', path: '/watchlist' }]);
    return result('watchlist', `Watchlist của bạn có ${items.length} mã: ${items.map((item) => `${item.symbol}${item.close == null ? '' : ` ${vnd.format(item.close)}`}`).join(', ')}.`, [{ type: 'watchlist', label: 'Watchlist của bạn (giá đóng cửa gần nhất)', path: '/watchlist' }]);
  }

  return { answer };
}

// FR-M12-04: an answer containing buy/sell wording or a price target is replaced by the refusal.
export function filterOutput(outcome) {
  if (outcome.status === 'blocked') return outcome;
  if (OUTPUT_BLOCKLIST.some((pattern) => pattern.test(outcome.content))) {
    return { ...outcome, content: REFUSAL, citations: [], status: 'blocked', filterResult: 'output_blocked' };
  }
  return outcome;
}
