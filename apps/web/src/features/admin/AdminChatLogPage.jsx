import { useEffect, useState } from 'react';
import { api } from '../../api/index.js';

const dateTime = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'Asia/Ho_Chi_Minh' });
const FILTER_LABELS = { pass: 'Đạt', input_blocked: 'Chặn đầu vào', output_blocked: 'Chặn đầu ra' };

// FR-M12-07: chat log for analysts and admins; personal questions and answers arrive already masked.
export function AdminChatLogPage() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.admin.chatLog({ status })
      .then((result) => { if (active) { setItems(result.items); setError(''); } })
      .catch((requestError) => { if (active) setError(requestError.message || 'Không tải được nhật ký Chat.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [status]);

  const blocked = items.filter((item) => item.role === 'assistant' && item.status === 'blocked').length;

  return <section className="content admin-users-page">
    <header className="pagehead"><div><span className="eyebrow">QUẢN TRỊ | CHAT</span><h1>Nhật ký Chat</h1>
      <p>Mỗi lượt hỏi đáp kèm ý định, cách tạo câu trả lời và kết quả lọc an toàn.</p></div>
      <span className="chip info">ĐÃ CHE DỮ LIỆU CÁ NHÂN</span></header>
    <div className="note info">Câu hỏi và câu trả lời liên quan Portfolio, Trade Plan, Journal, Watchlist của người dùng được che nội dung. Email người dùng chỉ hiện 2 ký tự đầu.</div>
    {error && <div className="note bad" role="alert">{error}</div>}
    <section className="card">
      <div className="card-h"><div><h2>Lượt hỏi đáp gần đây</h2><p className="small muted">{items.length} tin nhắn · {blocked} câu trả lời bị chặn</p></div>
        <div className="seg">{[['', 'Tất cả'], ['blocked', 'Bị chặn'], ['complete', 'Hoàn tất']].map(([value, label]) => <button key={label} type="button" className={status === value ? 'on' : ''} onClick={() => setStatus(value)}>{label}</button>)}</div></div>
      {loading ? <p className="loading-card">Đang tải nhật ký…</p> : <div className="tw"><table><thead><tr>
        <th>Thời gian</th><th>Người dùng</th><th>Vai trò tin</th><th>Ý định</th><th>Lọc</th><th>Bộ trả lời</th><th>Nội dung</th>
      </tr></thead><tbody>{items.map((item) => <tr key={item.id}>
        <td className="num">{dateTime.format(new Date(item.created_at))}</td>
        <td>{item.user}<br /><span className="small muted">{item.user_role}</span></td>
        <td>{item.role === 'user' ? 'Câu hỏi' : 'Trả lời'}</td>
        <td>{item.intent ?? '—'}{item.personal && <> <span className="chip hold">cá nhân</span></>}</td>
        <td>{item.role === 'assistant' ? <span className={`chip ${item.status === 'blocked' ? 'down' : 'up'}`}>{FILTER_LABELS[item.filter_result] ?? item.filter_result ?? '—'}</span> : '—'}</td>
        <td className="small">{item.engine ?? '—'}</td>
        <td className="small" style={{ whiteSpace: 'pre-wrap', minWidth: 280, maxWidth: 520 }}>{item.content}</td>
      </tr>)}{!items.length && <tr><td colSpan="7" className="empty-row">Chưa có lượt hỏi đáp nào.</td></tr>}
      </tbody></table></div>}
    </section>
  </section>;
}
