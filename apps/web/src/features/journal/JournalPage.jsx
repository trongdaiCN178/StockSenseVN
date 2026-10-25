import { useEffect, useState } from 'react';
import { api } from '../../api/index.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { hasCapability } from '@stocksense/core/access';

const money = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const blankManual = { symbol: '', title: '', decision_date: today, body: '', tags: '', lesson: '' };
const blankFilters = { symbol: '', from: '', to: '', tag: '', result: '', q: '' };
const PERIOD_LABELS = { week: 'Tuần', month: 'Tháng', quarter: 'Quý' };
const RESULT_LABELS = { '': 'Mọi kết quả', win: 'Có lãi', loss: 'Thua lỗ', breakeven: 'Hòa vốn', none: 'Chưa có kết quả' };
const CLOSE_REASONS = { target_hit: 'Chạm mục tiêu', stop_hit: 'Chạm cắt lỗ', expired: 'Hết hạn', manual: 'Đóng thủ công' };

function formatPeriod(start, period) {
  const date = new Date(`${start}T00:00:00`);
  if (period === 'quarter') return `Q${Math.floor(date.getMonth() / 3) + 1}/${date.getFullYear()}`;
  if (period === 'month') return `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  return `Tuần từ ${date.toLocaleDateString('vi-VN')}`;
}

export function JournalPage() {
  const { user } = useAuth();
  const canManual = hasCapability(user.role, 'journal.manual.create.self');
  const canStats = hasCapability(user.role, 'journal.stats.read.self');
  const canExport = hasCapability(user.role, 'reports.journal.export.self');
  const [entries, setEntries] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [stats, setStats] = useState(null);
  const [period, setPeriod] = useState('month');
  const [filters, setFilters] = useState(blankFilters);
  const [manual, setManual] = useState(blankManual);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadEntries(nextFilters = filters) {
    const list = await api.journal.list(nextFilters);
    setEntries(list.items);
    setDrafts(Object.fromEntries(list.items.map((entry) => [entry.id, { body: entry.body ?? '', lesson: entry.lesson ?? '', tags: (entry.tags ?? []).join(', ') }])));
  }
  async function loadStats(nextPeriod = period) { if (canStats) setStats(await api.journal.stats(nextPeriod)); }
  async function refresh() { await Promise.all([loadEntries(), loadStats()]); }
  useEffect(() => { refresh().catch((e) => setError(e.message || 'Không tải được nhật ký.')).finally(() => setLoading(false)); }, [user.role]);

  async function applyFilters(event) {
    event?.preventDefault(); setError('');
    try { await loadEntries(filters); } catch (e) { setError(e.message || 'Không lọc được nhật ký.'); }
  }
  async function resetFilters() { setFilters(blankFilters); try { await loadEntries(blankFilters); } catch (e) { setError(e.message); } }
  async function changePeriod(next) { setPeriod(next); try { await loadStats(next); } catch (e) { setError(e.message); } }
  async function saveEntry(entry) {
    const draft = drafts[entry.id] ?? {};
    setBusyId(entry.id); setError(''); setNotice('');
    try {
      await api.journal.update(entry.id, { body: draft.body, lesson: draft.lesson, tags: draft.tags.split(',').map((tag) => tag.trim()).filter(Boolean) });
      await refresh(); setNotice('Đã lưu ghi chú nhật ký. Ảnh chụp và kết quả giao dịch không thay đổi.');
    } catch (e) { setError(e.message || 'Không lưu được mục nhật ký.'); }
    finally { setBusyId(''); }
  }
  async function createManual(event) {
    event.preventDefault(); setBusyId('manual'); setError(''); setNotice('');
    try {
      await api.journal.createManual({ ...manual, symbol: manual.symbol.trim().toUpperCase(), decision_date: manual.decision_date || null, tags: manual.tags.split(',').map((tag) => tag.trim()).filter(Boolean) });
      setManual(blankManual); await refresh(); setNotice('Đã tạo mục nhật ký.');
    } catch (e) { setError(e.message || 'Không tạo được mục nhật ký.'); }
    finally { setBusyId(''); }
  }
  function exportPdf() {
    api.reports.journal({ from: filters.from, to: filters.to }).catch((e) => setError(e.message));
  }

  if (loading) return <section className="content"><div className="card loading-card">Đang tải nhật ký…</div></section>;
  const allTags = [...new Set(entries.flatMap((entry) => entry.tags ?? []))].sort();
  return <section className="content journal-page">
    <header className="pagehead"><div><span className="eyebrow">NHẬT KÝ CỦA BẠN</span><h1>Nhật ký giao dịch</h1><p>Ghi chú, tags và bài học riêng tư. Chỉ chủ sở hữu mới xem được nội dung.</p></div><div className="pagehead-actions"><span className="chip acc">{entries.length} mục</span>{canExport && <button className="btn sm" type="button" onClick={exportPdf} title="Xuất theo khoảng ngày đang lọc">Xuất PDF{filters.from || filters.to ? ' theo kỳ' : ''}</button>}</div></header>
    {error && <div className="note bad" role="alert">{error}</div>}{notice && <div className="note info" role="status">{notice}</div>}
    {stats && <section className="journal-stats">
      <article className="card"><span className="small muted">Số mục nhật ký</span><b>{stats.entries}</b></article>
      <article className="card"><span className="small muted">Kế hoạch đã đóng</span><b>{stats.closed_plans}</b></article>
      <article className="card"><span className="small muted">Thắng / hòa / lỗ</span><b>{stats.wins} / {stats.breakeven} / {stats.losses}</b></article>
      <article className="card"><span className="small muted">Lãi/lỗ đã thực hiện</span><b className={stats.realized_pnl >= 0 ? 'positive' : 'negative'}>{money.format(stats.realized_pnl)} ₫</b></article>
    </section>}
    {stats && <section className="card"><div className="card-h"><div><h2>Thống kê nhìn lại</h2><p className="small muted">Theo ngày đóng kế hoạch. Tỷ lệ làm theo tín hiệu sẽ có khi mô hình dự báo sẵn sàng.</p></div>
      <div className="seg" role="group" aria-label="Chu kỳ thống kê">{Object.entries(PERIOD_LABELS).map(([value, label]) => <button key={value} type="button" className={period === value ? 'on' : ''} onClick={() => changePeriod(value)}>{label}</button>)}</div></div>
      <div className="tw"><table><thead><tr><th>Kỳ</th><th className="r">Kế hoạch đóng</th><th className="r">Chạm mục tiêu</th><th className="r">Chạm cắt lỗ</th><th className="r">Thắng / thua</th><th className="r">R:R kế hoạch TB</th><th className="r">R thực tế TB</th><th className="r">Lãi/lỗ</th></tr></thead><tbody>
        {stats.periods?.items.map((item) => <tr key={item.period_start}><td>{formatPeriod(item.period_start, period)}</td><td className="r num">{item.closed_plans}</td><td className="r num">{item.target_hit_rate ?? 0}%</td><td className="r num">{item.stop_hit_rate ?? 0}%</td><td className="r num">{item.wins} / {item.losses}</td><td className="r num">{item.average_planned_r == null ? '—' : decimal.format(item.average_planned_r)}</td><td className="r num">{item.average_realized_r == null ? '—' : decimal.format(item.average_realized_r)}</td><td className={`r num ${item.realized_pnl >= 0 ? 'positive' : 'negative'}`}>{money.format(item.realized_pnl)} ₫</td></tr>)}
        {!stats.periods?.items.length && <tr><td colSpan="8" className="empty-row">Chưa có kế hoạch nào được đóng.</td></tr>}
      </tbody></table></div>
    </section>}
    <section className="card"><div className="card-h"><div><h2>Lọc và tìm kiếm</h2><p className="small muted">Theo mã, khoảng ngày, thẻ, kết quả hoặc từ khóa trong tiêu đề/ghi chú/bài học.</p></div></div>
      <form className="journal-filter-form" onSubmit={applyFilters}>
        <label className="field"><span>Mã</span><input maxLength="12" value={filters.symbol} onChange={(e) => setFilters({ ...filters, symbol: e.target.value.toUpperCase() })} placeholder="FPT" /></label>
        <label className="field"><span>Từ ngày</span><input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} /></label>
        <label className="field"><span>Đến ngày</span><input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} /></label>
        <label className="field"><span>Thẻ</span><input list="journal-tags" maxLength="24" value={filters.tag} onChange={(e) => setFilters({ ...filters, tag: e.target.value })} /><datalist id="journal-tags">{allTags.map((tag) => <option key={tag} value={tag} />)}</datalist></label>
        <label className="field"><span>Kết quả</span><select value={filters.result} onChange={(e) => setFilters({ ...filters, result: e.target.value })}>{Object.entries(RESULT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="field"><span>Từ khóa</span><input maxLength="100" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} /></label>
        <div className="watchlist-actions"><button className="btn pri" type="submit">Lọc</button><button className="btn" type="button" onClick={resetFilters}>Bỏ lọc</button></div>
      </form>
    </section>
    {canManual && <section className="card"><div className="card-h"><div><h2>Ghi nhật ký thủ công</h2><p className="small muted">Ghi lại quyết định không có Trade Plan, ví dụ bỏ qua một tín hiệu.</p></div></div>
      <form className="journal-manual-form" onSubmit={createManual}>
        <label className="field"><span>Mã cổ phiếu</span><input required maxLength="12" pattern="[A-Za-z0-9.-]+" value={manual.symbol} onChange={(e) => setManual({ ...manual, symbol: e.target.value.toUpperCase() })} placeholder="FPT" /></label>
        <label className="field"><span>Ngày quyết định</span><input type="date" value={manual.decision_date} onChange={(e) => setManual({ ...manual, decision_date: e.target.value })} /></label>
        <label className="field"><span>Tiêu đề</span><input required maxLength="160" value={manual.title} onChange={(e) => setManual({ ...manual, title: e.target.value })} /></label>
        <label className="field"><span>Tags, cách nhau bằng dấu phẩy</span><input value={manual.tags} onChange={(e) => setManual({ ...manual, tags: e.target.value })} placeholder="kỷ luật, breakout" /></label>
        <label className="field"><span>Ghi chú</span><textarea maxLength="4000" value={manual.body} onChange={(e) => setManual({ ...manual, body: e.target.value })} /></label>
        <label className="field"><span>Bài học</span><textarea maxLength="3000" value={manual.lesson} onChange={(e) => setManual({ ...manual, lesson: e.target.value })} /></label>
        <button className="btn pri" disabled={busyId === 'manual'} type="submit">Tạo mục nhật ký</button>
      </form>
    </section>}
    <section className="journal-list">{entries.map((entry) => {
      const draft = drafts[entry.id] ?? { body: '', tags: '', lesson: '' };
      const snapshot = entry.snapshot ?? {};
      const plan = snapshot.plan;
      return <article className="card journal-entry" key={entry.id}>
        <header className="journal-entry-head"><div><span className="chip acc">{entry.symbol}</span><span className="chip neutral">{entry.kind === 'plan_close' ? 'Đóng kế hoạch giao dịch' : 'Ghi thủ công'}</span><h2>{entry.title}</h2></div><time>{entry.decision_date ? new Date(`${entry.decision_date}T00:00:00`).toLocaleDateString('vi-VN') : new Date(entry.created_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</time></header>
        {entry.realized_pnl != null && <p className={`journal-result ${entry.realized_pnl >= 0 ? 'positive' : 'negative'}`}>Kết quả đã ghi nhận: {money.format(entry.realized_pnl)} ₫{snapshot.realized_r != null ? ` · ${decimal.format(snapshot.realized_r)}R` : ''}</p>}
        {entry.plan_id && <details className="journal-snapshot"><summary>Kế hoạch gốc và ảnh chụp (chỉ đọc)</summary>
          {plan ? <ul className="journal-plan-summary">
            <li>Hướng: {plan.side === 'long' ? 'Mua' : 'Bán'} · Vào {money.format(plan.entry_price)}{plan.entry_price_max ? ` – ${money.format(plan.entry_price_max)}` : ''} ₫ · Cắt lỗ {money.format(plan.stop_price)} ₫ · Mục tiêu {money.format(plan.target_price)} ₫</li>
            <li>Thoát {money.format(snapshot.exit_price)} ₫ · {CLOSE_REASONS[snapshot.close_reason] ?? 'Đóng thủ công'}</li>
            <li>Giá lúc lập: {snapshot.plan_snapshot?.market_price == null ? 'Chưa có' : `${money.format(snapshot.plan_snapshot.market_price)} ₫ (${snapshot.plan_snapshot.price_date})`} · Dự báo lúc lập: chưa khả dụng</li>
            {plan.note && <li>Lý do khi lập: {plan.note}</li>}
            {snapshot.revisions?.length > 0 && <li>Kế hoạch đã được sửa {snapshot.revisions.length} lần trước khi đóng.</li>}
          </ul> : <pre>{JSON.stringify(snapshot.plan_snapshot ?? snapshot, null, 2)}</pre>}
        </details>}
        <div className="journal-edit-grid">
          <label className="field"><span>Ghi chú</span><textarea maxLength="4000" value={draft.body} onChange={(e) => setDrafts({ ...drafts, [entry.id]: { ...draft, body: e.target.value } })} /></label>
          <label className="field"><span>Tags, cách nhau bằng dấu phẩy</span><input value={draft.tags} onChange={(e) => setDrafts({ ...drafts, [entry.id]: { ...draft, tags: e.target.value } })} /></label>
          <label className="field"><span>Bài học</span><textarea maxLength="3000" value={draft.lesson} onChange={(e) => setDrafts({ ...drafts, [entry.id]: { ...draft, lesson: e.target.value } })} /></label>
        </div>
        <footer className="journal-entry-foot"><div className="journal-tags">{entry.tags?.map((tag) => <button type="button" className="chip neutral" key={tag} onClick={() => { const next = { ...filters, tag }; setFilters(next); loadEntries(next).catch((e) => setError(e.message)); }}>{tag}</button>)}</div><button className="btn sm" type="button" disabled={busyId === entry.id} onClick={() => saveEntry(entry)}>Lưu chỉnh sửa</button></footer>
      </article>;
    })}{!entries.length && <div className="card empty-row">{Object.values(filters).some(Boolean) ? 'Không có mục nhật ký phù hợp với bộ lọc.' : 'Nhật ký đang trống. Khi đóng kế hoạch giao dịch, nhật ký được tạo tự động.'}</div>}</section>
  </section>;
}
