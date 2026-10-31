import { describe, it, expect } from 'vitest';
import { parseCafeFSymbolList, tagSymbols } from './news.js';

const SAMPLE = `<div id="divEvents"><ul class="News_Title_Link">
  <li style="list-style-type: none;">
    <span class="timeTitle">28/10/2026 18:03</span>
    <img alt="" src="https://cafefnew.mediacdn.vn/static/images/red_bull.gif">
    <a class='docnhanhTitle' href="/du-lieu/FPT-3009003/fpt-nghi-quyet-hdqt-so-02102026-ngay-27102026.chn?utm_source=du-lieu.chn" title="FPT: Nghị quyết HĐQT số 02.10-2026 ngày 27/10/2026">FPT: Nghị quyết HĐQT</a>
  </li>
  <li style="list-style-type: none;">
    <span class="timeTitle">05/11/2021 09:15</span>
    <a class='docnhanhTitle' href="/FPT-2001/fpt-va-vnm-hop-tac-&amp;-mo-rong.chn" title="FPT &amp; VNM hợp tác mở rộng">FPT &amp; VNM</a>
  </li>
  <li style="list-style-type: none;"><span class="timeTitle">01/01/2021 00:00</span><a class='docnhanhTitle' href="/not-an-article" title="x">x</a></li>
</ul></div>`;

describe('CafeF per-symbol news list', () => {
  it('parses time, title and canonical URL without tracking parameters', () => {
    const items = parseCafeFSymbolList(SAMPLE, 'FPT');
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      externalId: 'https://cafef.vn/du-lieu/FPT-3009003/fpt-nghi-quyet-hdqt-so-02102026-ngay-27102026.chn',
      url: 'https://cafef.vn/du-lieu/FPT-3009003/fpt-nghi-quyet-hdqt-so-02102026-ngay-27102026.chn',
      title: 'FPT: Nghị quyết HĐQT số 02.10-2026 ngày 27/10/2026',
      summary: '',
      publishedAt: '2026-10-28T18:03:00+07:00',
      category: 'SYMBOL:FPT',
    });
    expect(items[1].title).toBe('FPT & VNM hợp tác mở rộng');
    expect(items[1].publishedAt).toBe('2021-11-05T09:15:00+07:00');
  });

  it('tags other tracked symbols mentioned in the title', () => {
    expect(tagSymbols('FPT & VNM hợp tác mở rộng', [{ symbol: 'FPT' }, { symbol: 'VNM' }, { symbol: 'ACB' }])).toEqual(['FPT', 'VNM']);
  });
});
