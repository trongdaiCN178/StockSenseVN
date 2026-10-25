import { useEffect, useState } from 'react';
import { api } from '../../api/index.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { hasCapability } from '@stocksense/core/access';

const money = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const blankManual = { symbol: '', title: '', body: '', tags: '', lesson: '' };

export function JournalPage() {
  const { user } = useAuth();
  const canManual = hasCapability(user.role, 'journal.manual.create.self');
  const canStats = hasCapability(user.role, 'journal.stats.read.self');
  const canExport = hasCapability(user.role, 'reports.journal.export.self');
  const [entries, setEntries] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [stats, setStats] = useState(null);
  const [manual, setManual] = useState(blankManual);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function refresh() {
    const [list, statData] = await Promise.all([api.journal.list(), canStats ? api.journal.stats() : Promise.resolve(null)]);
    setEntries(list.items); setStats(statData);
    setDrafts(Object.fromEntries(list.items.map((entry) => [entry.id, { body: entry.body ?? '', lesson: entry.lesson ?? '', tags: (entry.tags ?? []).join(', ') }])));
  }
  useEffect(() => { refresh().catch((e) => setError(e.message || 'Không tải được nhật ký.')).finally(() => setLoading(false)); }, [user.role]);

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
      await api.journal.createManual({ ...manual, symbol: manual.symbol.trim().toUpperCase(), tags: manual.tags.split(',').map((tag) => tag.trim()).filter(Boolean) });
      setManual(blankManual); await refresh(); setNotice('Đã tạo mục nhật ký.');
    } catch (e) { setError(e.message || 'Không tạo được mục nhật ký.'); }
    finally { setBusyId(''); }
  }

  if (loading) return <section className="content"><div className="card loading-card">Đang tải nhật ký…</div></section>;
  return <section className="content journal-page">
    <header className="pagehead"><div><span className="eyebrow">NHẬT KÝ CỦA BẠN</span><h1>Nhật ký giao dịch</h1><p>Ghi chú, tags và bài học riêng tư. Chỉ chủ sở hữu mới xem được nội dung.</p></div><div className="pagehead-actions"><span className="chip acc">{entries.length} mục</span>{canExport && <button className="btn sm" type="button" onClick={() => api.reports.journal().catch((e) => setError(e.message))}>Xuất PDF</button>}</div></header>
    {error && <div className="note bad" role="alert">{error}</div>}{notice && <div className="note info" role="status">{notice}</div>}
    {stats && <section className="journal-stats">
      <article className="card"><span className="small muted">Số mục nhật ký</span><b>{stats.entries}</b></article>
      <article className="card"><span className="small muted">Kế hoạch đã đóng</span><b>{stats.closed_plans}</b></article>
      <article className="card"><span className="small muted">Thắng / hòa / lỗ</span><b>{stats.wins} / {stats.breakeven} / {stats.losses}</b></article>
      <article className="card"><span className="small muted">Lãi/lỗ đã thực hiện</span><b className={stats.realized_pnl >= 0 ? 'positive' : 'negative'}>{money.format(stats.realized_pnl)} ₫</b></article>
    </section>}
    {canManual && <section className="card"><div className="card-h"><div><h2>Ghi nhật ký thủ công</h2><p className="small muted">Tính năng nhập thủ công dành cho Trader và Analyst.</p></div></div>
      <form className="journal-manual-form" onSubmit={createManual}>
        <label className="field"><span>Mã cổ phiếu</span><input required maxLength="12" pattern="[A-Za-z0-9.-]+" value={manual.symbol} onChange={(e) => setManual({ ...manual, symbol: e.target.value.toUpperCase() })} placeholder="FPT" /></label>
        <label className="field"><span>Tiêu đề</span><input required maxLength="160" value={manual.title} onChange={(e) => setManual({ ...manual, title: e.target.value })} /></label>
        <label className="field"><span>Tags, cách nhau bằng dấu phẩy</span><input value={manual.tags} onChange={(e) => setManual({ ...manual, tags: e.target.value })} placeholder="kỷ luật, breakout" /></label>
        <label className="field"><span>Ghi chú</span><textarea maxLength="4000" value={manual.body} onChange={(e) => setManual({ ...manual, body: e.target.value })} /></label>
        <label className="field"><span>Bài học</span><textarea maxLength="3000" value={manual.lesson} onChange={(e) => setManual({ ...manual, lesson: e.target.value })} /></label>
        <button className="btn pri" disabled={busyId === 'manual'} type="submit">Tạo mục nhật ký</button>
      </form>
    </section>}
    <section className="journal-list">{entries.map((entry) => {
      const draft = drafts[entry.id] ?? { body: '', tags: '', lesson: '' };
      const immutable = entry.snapshot ?? {};
      return <article className="card journal-entry" key={entry.id}>
        <header className="journal-entry-head"><div><span className="chip acc">{entry.symbol}</span><span className="chip neutral">{entry.kind === 'plan_close' ? 'Đóng kế hoạch giao dịch' : 'Ghi thủ công'}</span><h2>{entry.title}</h2></div><time>{new Date(entry.created_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</time></header>
        {entry.realized_pnl != null && <p className={`journal-result ${entry.realized_pnl >= 0 ? 'positive' : 'negative'}`}>Kết quả đã ghi nhận: {money.format(entry.realized_pnl)} ₫</p>}
        {entry.plan_id && <details className="journal-snapshot"><summary>Ảnh chụp giao dịch (chỉ đọc)</summary><pre>{JSON.stringify(immutable.plan_snapshot ?? immutable, null, 2)}</pre></details>}
        <div className="journal-edit-grid">
          <label className="field"><span>Ghi chú</span><textarea maxLength="4000" value={draft.body} onChange={(e) => setDrafts({ ...drafts, [entry.id]: { ...draft, body: e.target.value } })} /></label>
          <label className="field"><span>Tags, cách nhau bằng dấu phẩy</span><input value={draft.tags} onChange={(e) => setDrafts({ ...drafts, [entry.id]: { ...draft, tags: e.target.value } })} /></label>
          <label className="field"><span>Bài học</span><textarea maxLength="3000" value={draft.lesson} onChange={(e) => setDrafts({ ...drafts, [entry.id]: { ...draft, lesson: e.target.value } })} /></label>
        </div>
        <footer className="journal-entry-foot"><div className="journal-tags">{entry.tags?.map((tag) => <span className="chip neutral" key={tag}>{tag}</span>)}</div><button className="btn sm" type="button" disabled={busyId === entry.id} onClick={() => saveEntry(entry)}>Lưu chỉnh sửa</button></footer>
      </article>;
    })}{!entries.length && <div className="card empty-row">Nhật ký đang trống. Khi đóng kế hoạch giao dịch, nhật ký được tạo tự động.</div>}</section>
  </section>;
}
