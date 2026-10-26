import { useEffect, useState } from 'react';
import { api } from '../../api/index.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { hasCapability } from '@stocksense/core/access';
import { Icon } from '../../app/icons.jsx';
import { Modal } from '../../app/Modal.jsx';

const money = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const blankManual = { symbol: '', title: '', decision_date: today, body: '', tags: '', lesson: '' };
const blankFilters = { symbol: '', from: '', to: '', tag: '', result: '', q: '' };
const PERIOD_LABELS = { week: 'Tuần', month: 'Tháng', quarter: 'Quý' };
const RESULT_LABELS = { '': 'Mọi kết quả', win: 'Có lãi', loss: 'Thua lỗ', breakeven: 'Hòa vốn', none: 'Chưa có kết quả' };
const CLOSE_REASONS = { target_hit: 'Chạm mục tiêu', stop_hit: 'Chạm cắt lỗ', expired: 'Hết hạn', manual: 'Đóng thủ công' };
const signed = (value) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${money.format(Math.abs(value))}`;
const dateOf = (entry) => new Date(entry.decision_date ? `${entry.decision_date}T00:00:00` : entry.created_at).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

function formatPeriod(start, period) {
  const date = new Date(`${start}T00:00:00`);
  if (period === 'quarter') return `Q${Math.floor(date.getMonth() / 3) + 1}/${date.getFullYear()}`;
  if (period === 'month') return `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  return `Tuần ${date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`;
}
function resultChip(entry) {
  if (entry.realized_pnl == null) return <span className="chip neutral">{entry.kind === 'manual' ? 'Ghi thủ công' : 'Chưa có'}</span>;
  return <span className={`chip ${entry.realized_pnl > 0 ? 'up' : entry.realized_pnl < 0 ? 'down' : 'hold'}`}>{entry.realized_pnl > 0 ? 'Có lãi' : entry.realized_pnl < 0 ? 'Thua lỗ' : 'Hòa vốn'}</span>;
}

export function JournalPage() {
  const { user } = useAuth();
  const canManual = hasCapability(user.role, 'journal.manual.create.self');
  const canStats = hasCapability(user.role, 'journal.stats.read.self');
  const canExport = hasCapability(user.role, 'reports.journal.export.self');
  const [entries, setEntries] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState({ body: '', lesson: '', tags: '' });
  const [stats, setStats] = useState(null);
  const [period, setPeriod] = useState('month');
  const [filters, setFilters] = useState(blankFilters);
  const [manual, setManual] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function select(entry) {
    setSelectedId(entry?.id ?? null);
    setDraft({ body: entry?.body ?? '', lesson: entry?.lesson ?? '', tags: (entry?.tags ?? []).join(', ') });
  }
  async function loadEntries(nextFilters = filters, keepId = selectedId) {
    const list = await api.journal.list(nextFilters);
    setEntries(list.items);
    select(list.items.find((entry) => entry.id === keepId) ?? list.items[0]);
  }
  async function loadStats(nextPeriod = period) { if (canStats) setStats(await api.journal.stats(nextPeriod)); }
  useEffect(() => {
    Promise.all([loadEntries(blankFilters, null), loadStats()]).catch((e) => setError(e.message || 'Không tải được nhật ký.')).finally(() => setLoading(false));
  }, [user.role]);

  async function applyFilters(event) {
    event?.preventDefault(); setError('');
    try { await loadEntries(filters); } catch (e) { setError(e.message || 'Không lọc được nhật ký.'); }
  }
  async function resetFilters() { setFilters(blankFilters); try { await loadEntries(blankFilters); } catch (e) { setError(e.message); } }
  async function changePeriod(next) { setPeriod(next); try { await loadStats(next); } catch (e) { setError(e.message); } }
  async function saveEntry() {
    setBusy(true); setError(''); setNotice('');
    try {
      await api.journal.update(selectedId, { body: draft.body, lesson: draft.lesson, tags: draft.tags.split(',').map((tag) => tag.trim()).filter(Boolean) });
      await loadEntries(); setNotice('Đã lưu. Snapshot và kết quả giao dịch không thay đổi.');
    } catch (e) { setError(e.message || 'Không lưu được bản ghi.'); }
    finally { setBusy(false); }
  }
  async function createManual(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const created = await api.journal.createManual({ ...manual, symbol: manual.symbol.trim().toUpperCase(), decision_date: manual.decision_date || null, tags: manual.tags.split(',').map((tag) => tag.trim()).filter(Boolean) });
      setManual(null); await Promise.all([loadEntries(filters, created.id), loadStats()]); setNotice('Đã tạo bản ghi thủ công.');
    } catch (e) { setError(e.message || 'Không tạo được bản ghi.'); }
    finally { setBusy(false); }
  }

  if (loading) return <main className="content"><div className="card muted">Đang tải nhật ký…</div></main>;
  const entry = entries.find((item) => item.id === selectedId);
  const snapshot = entry?.snapshot ?? {};
  const plan = snapshot.plan;
  const allTags = [...new Set(entries.flatMap((item) => item.tags ?? []))].sort();
  const lastPeriods = stats?.periods?.items ?? [];

  return <main className="content">
    <div className="pagehead"><div><h1>Journal</h1><p>Nhật ký quyết định được tạo tự động khi bạn đóng Trade Plan, kèm kế hoạch gốc và kết quả thực tế. Chỉ bạn xem được nội dung.</p></div>
      <div className="actions">{canManual && <button className="btn" type="button" onClick={() => setManual(blankManual)}><Icon name="plus" />Ghi thủ công</button>}
        {canExport && <button className="btn" type="button" title="Xuất theo khoảng ngày đang lọc" onClick={() => api.reports.journal({ from: filters.from, to: filters.to }).catch((e) => setError(e.message))}><Icon name="pdf" />PDF{filters.from || filters.to ? ' theo kỳ' : ''}</button>}</div></div>
    {error && <div className="note bad" role="alert">{error}</div>}
    {notice && <div className="note info" role="status">{notice}</div>}
    {stats && <>
      <div className="grid g4">
        <div className="card stat"><div className="k">Tỷ lệ có lãi</div><div className="v num">{stats.closed_plans ? `${Math.round(stats.wins / stats.closed_plans * 100)}%` : '—'}</div><div className="s muted">n = {stats.closed_plans} lệnh đã đóng</div></div>
        <div className="card stat"><div className="k">Thắng / hòa / thua</div><div className="v num">{stats.wins} / {stats.breakeven} / {stats.losses}</div><div className="s muted">{stats.entries} bản ghi</div></div>
        <div className="card stat"><div className="k">Lãi/lỗ đã thực hiện</div><div className={`v num ${stats.realized_pnl >= 0 ? 'c-up' : 'c-down'}`}>{signed(stats.realized_pnl)}</div><div className="s muted">đồng</div></div>
        <div className="card stat"><div className="k">R thực tế TB · {PERIOD_LABELS[period].toLowerCase()} gần nhất</div><div className="v num">{lastPeriods[0]?.average_realized_r == null ? '—' : `${decimal.format(lastPeriods[0].average_realized_r)}R`}</div><div className="s muted">R:R kế hoạch {lastPeriods[0]?.average_planned_r == null ? '—' : decimal.format(lastPeriods[0].average_planned_r)}</div></div>
      </div>
      {stats.closed_plans > 0 && stats.closed_plans < 30 && <div className="note warn"><b>Mẫu nhỏ.</b> Thống kê dựa trên dưới 30 lệnh, chỉ nên dùng để tự nhìn lại.</div>}
    </>}

    <div className="grid g-main">
      <section className="card"><div className="card-h"><h2>Bản ghi <span className="tag">{entries.length}</span></h2></div>
        <form className="frow" onSubmit={applyFilters} style={{ marginBottom: 12 }}>
          <div className="field"><label htmlFor="jf-s">Mã</label><input id="jf-s" maxLength="12" value={filters.symbol} onChange={(e) => setFilters({ ...filters, symbol: e.target.value.toUpperCase() })} placeholder="FPT" /></div>
          <div className="field"><label htmlFor="jf-from">Từ ngày</label><input id="jf-from" type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} /></div>
          <div className="field"><label htmlFor="jf-to">Đến ngày</label><input id="jf-to" type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} /></div>
          <div className="field"><label htmlFor="jf-tag">Thẻ</label><input id="jf-tag" list="journal-tags" maxLength="24" value={filters.tag} onChange={(e) => setFilters({ ...filters, tag: e.target.value })} /><datalist id="journal-tags">{allTags.map((tag) => <option key={tag} value={tag} />)}</datalist></div>
          <div className="field"><label htmlFor="jf-r">Kết quả</label><select id="jf-r" value={filters.result} onChange={(e) => setFilters({ ...filters, result: e.target.value })}>{Object.entries(RESULT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <div className="field"><label htmlFor="jf-q">Từ khóa</label><input id="jf-q" maxLength="100" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} /></div>
          <div className="field" style={{ justifyContent: 'flex-end' }}><div className="actions"><button className="btn pri" type="submit">Lọc</button><button className="btn" type="button" onClick={resetFilters}>Bỏ lọc</button></div></div>
        </form>
        <div className="tw"><table><thead><tr><th>Mã</th><th>Ngày</th><th>Nguồn</th><th className="r">Lãi/lỗ</th><th>Kết quả</th></tr></thead>
          <tbody>{entries.map((item) => <tr key={item.id} className="click" onClick={() => select(item)} style={item.id === selectedId ? { background: 'var(--accent-soft)' } : undefined}>
            <td className="sym">{item.symbol}</td><td className="num">{dateOf(item)}</td><td className="muted">{item.kind === 'plan_close' ? 'Trade Plan' : 'Ghi thủ công'}</td>
            <td className={`r num ${item.realized_pnl == null ? '' : item.realized_pnl >= 0 ? 'c-up' : 'c-down'}`}>{item.realized_pnl == null ? '—' : signed(item.realized_pnl)}</td><td>{resultChip(item)}</td></tr>)}
          {!entries.length && <tr><td colSpan="5" className="muted">{Object.values(filters).some(Boolean) ? 'Không có bản ghi khớp bộ lọc.' : 'Chưa có bản ghi. Đóng một Trade Plan để tạo bản ghi đầu tiên.'}</td></tr>}</tbody></table></div>
      </section>
      <section className="card">{entry ? <>
        <div className="card-h"><h2>{entry.symbol} · {entry.title}</h2></div>
        <dl className="kv">
          <dt>Ngày</dt><dd className="num">{dateOf(entry)}</dd>
          {plan && <><dt>Kế hoạch gốc</dt><dd className="num">{plan.side === 'long' ? 'Mua' : 'Bán'} · vào {money.format(plan.entry_price)}{plan.entry_price_max ? `–${money.format(plan.entry_price_max)}` : ''} · CL {money.format(plan.stop_price)} · MT {money.format(plan.target_price)}</dd></>}
          {snapshot.exit_price != null && <><dt>Thoát</dt><dd className="num">{money.format(snapshot.exit_price)} · {CLOSE_REASONS[snapshot.close_reason] ?? 'Đóng thủ công'}</dd></>}
          {entry.realized_pnl != null && <><dt>Kết quả</dt><dd className={`num ${entry.realized_pnl >= 0 ? 'c-up' : 'c-down'}`}>{signed(entry.realized_pnl)} đ{snapshot.realized_r != null ? ` · ${decimal.format(snapshot.realized_r)}R` : ''}</dd></>}
          {snapshot.plan_snapshot && <><dt>Giá lúc lập</dt><dd className="num">{snapshot.plan_snapshot.market_price == null ? '—' : `${money.format(snapshot.plan_snapshot.market_price)} (${snapshot.plan_snapshot.price_date})`}</dd></>}
          {snapshot.revisions?.length > 0 && <><dt>Chỉnh sửa trước khi đóng</dt><dd>{snapshot.revisions.length} lần</dd></>}
          <dt>Dự báo lúc quyết định</dt><dd className="muted">Chưa khả dụng</dd>
        </dl>
        {plan?.note && <div className="small muted" style={{ marginTop: 10 }}>Lý do khi lập: {plan.note}</div>}
        <div className="field" style={{ marginTop: 14 }}><label htmlFor="j-note">Ghi chú</label><textarea id="j-note" maxLength="4000" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} /></div>
        <div className="field" style={{ marginTop: 10 }}><label htmlFor="j-les">Bài học</label><textarea id="j-les" maxLength="3000" placeholder="Điều bạn rút ra từ quyết định này" value={draft.lesson} onChange={(e) => setDraft({ ...draft, lesson: e.target.value })} /></div>
        <div className="field" style={{ marginTop: 10 }}><label htmlFor="j-tags">Thẻ</label><input id="j-tags" placeholder="kỷ luật, fomo" value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} /><span className="hint">cách nhau bằng dấu phẩy</span></div>
        <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>{(entry.tags ?? []).map((tag) => <button key={tag} type="button" className="chip neutral chip-link" onClick={() => { const next = { ...filters, tag }; setFilters(next); loadEntries(next).catch((e) => setError(e.message)); }}>#{tag}</button>)}</div>
        <div className="actions" style={{ marginTop: 12 }}><button className="btn pri" type="button" disabled={busy} onClick={saveEntry}>Lưu</button></div>
        <div className="small muted" style={{ marginTop: 10 }}>Snapshot và kết quả không sửa được.</div>
      </> : <p className="muted">Chọn một bản ghi để xem chi tiết.</p>}</section>
    </div>

    {stats && <section className="card"><div className="card-h"><h2>Thống kê nhìn lại</h2><div className="seg">{Object.entries(PERIOD_LABELS).map(([value, label]) => <button key={value} type="button" className={period === value ? 'on' : ''} onClick={() => changePeriod(value)}>{label}</button>)}</div></div>
      <div className="tw"><table><thead><tr><th>Kỳ</th><th className="r">Kế hoạch đóng</th><th className="r">Chạm mục tiêu</th><th className="r">Chạm cắt lỗ</th><th className="r">Thắng / thua</th><th className="r">R:R kế hoạch</th><th className="r">R thực tế</th><th className="r">Lãi/lỗ</th></tr></thead><tbody>
        {lastPeriods.map((item) => <tr key={item.period_start}><td>{formatPeriod(item.period_start, period)}</td><td className="r num">{item.closed_plans}</td><td className="r num">{item.target_hit_rate ?? 0}%</td><td className="r num">{item.stop_hit_rate ?? 0}%</td><td className="r num">{item.wins} / {item.losses}</td>
          <td className="r num">{item.average_planned_r == null ? '—' : decimal.format(item.average_planned_r)}</td><td className="r num">{item.average_realized_r == null ? '—' : decimal.format(item.average_realized_r)}</td><td className={`r num ${item.realized_pnl >= 0 ? 'c-up' : 'c-down'}`}>{signed(item.realized_pnl)}</td></tr>)}
        {!lastPeriods.length && <tr><td colSpan="8" className="muted">Chưa có kế hoạch nào được đóng.</td></tr>}
      </tbody></table></div>
      <div className="small muted" style={{ marginTop: 8 }}>Theo ngày đóng kế hoạch. Tỷ lệ làm theo tín hiệu sẽ có khi mô hình dự báo sẵn sàng.</div>
    </section>}

    {manual && <Modal title="Ghi nhật ký thủ công" onClose={() => setManual(null)}>
      <form onSubmit={createManual} style={{ display: 'grid', gap: 12 }}>
        <div className="frow">
          <div className="field"><label htmlFor="m-s">Mã</label><input id="m-s" required maxLength="12" pattern="[A-Za-z0-9.-]+" value={manual.symbol} onChange={(e) => setManual({ ...manual, symbol: e.target.value.toUpperCase() })} placeholder="FPT" /></div>
          <div className="field"><label htmlFor="m-d">Ngày quyết định</label><input id="m-d" type="date" value={manual.decision_date} onChange={(e) => setManual({ ...manual, decision_date: e.target.value })} /></div>
        </div>
        <div className="field"><label htmlFor="m-t">Tiêu đề</label><input id="m-t" required maxLength="160" value={manual.title} onChange={(e) => setManual({ ...manual, title: e.target.value })} placeholder="Ví dụ: Không vào lệnh, chờ thêm tín hiệu" /></div>
        <div className="field"><label htmlFor="m-b">Ghi chú</label><textarea id="m-b" maxLength="4000" value={manual.body} onChange={(e) => setManual({ ...manual, body: e.target.value })} /></div>
        <div className="field"><label htmlFor="m-l">Bài học</label><textarea id="m-l" maxLength="3000" value={manual.lesson} onChange={(e) => setManual({ ...manual, lesson: e.target.value })} /></div>
        <div className="field"><label htmlFor="m-g">Thẻ</label><input id="m-g" value={manual.tags} onChange={(e) => setManual({ ...manual, tags: e.target.value })} placeholder="kỷ luật, breakout" /></div>
        <div className="actions"><button className="btn pri" type="submit" disabled={busy}>Tạo bản ghi</button><button className="btn" type="button" onClick={() => setManual(null)}>Hủy</button></div>
      </form>
    </Modal>}
  </main>;
}
