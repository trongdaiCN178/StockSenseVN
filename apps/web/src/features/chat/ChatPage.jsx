import { useEffect, useState } from 'react';
import { api } from '../../api/index.js';

const suggestions = ['Tóm tắt diễn biến thị trường hôm nay', 'Giải thích các chỉ số trong trang mã cổ phiếu', 'Tôi nên đánh giá rủi ro của một kế hoạch thế nào?'];

export function ChatPage() {
  const [sessions, setSessions] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function refreshSessions(preferredId = '') {
    const result = await api.chat.sessions();
    setSessions(result.items);
    const nextId = preferredId || (result.items.some((item) => item.id === selectedId) ? selectedId : result.items[0]?.id) || '';
    setSelectedId(nextId);
    return nextId;
  }

  useEffect(() => {
    refreshSessions().catch((e) => setError(e.message || 'Không tải được phiên chat.')).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) { setMessages([]); return; }
    let current = true;
    api.chat.messages(selectedId).then((result) => { if (current) setMessages(result.items); })
      .catch((e) => { if (current) setError(e.message || 'Không tải được lịch sử chat.'); });
    return () => { current = false; };
  }, [selectedId]);

  async function createSession() {
    setBusy(true); setError('');
    try {
      const result = await api.chat.createSession();
      await refreshSessions(result.session.id);
    } catch (e) { setError(e.message || 'Không tạo được phiên chat.'); }
    finally { setBusy(false); }
  }

  async function send(event) {
    event.preventDefault();
    if (!selectedId || !draft.trim()) return;
    setBusy(true); setError('');
    try {
      await api.chat.sendMessage(selectedId, draft.trim());
      setDraft('');
      const [history] = await Promise.all([api.chat.messages(selectedId), refreshSessions(selectedId)]);
      setMessages(history.items);
    } catch (e) { setError(e.message || 'Chat hiện chưa khả dụng.'); }
    finally { setBusy(false); }
  }

  async function removeSession(id) {
    setBusy(true); setError('');
    try { await api.chat.deleteSession(id); await refreshSessions(selectedId === id ? '' : selectedId); }
    catch (e) { setError(e.message || 'Không xóa được phiên chat.'); }
    finally { setBusy(false); }
  }

  if (loading) return <section className="content"><div className="card loading-card">Đang tải trò chuyện…</div></section>;
  const active = sessions.find((session) => session.id === selectedId);
  return <section className="content chat-page">
    <header className="pagehead"><div><span className="eyebrow">HỖ TRỢ NGHIÊN CỨU</span><h1>Trò chuyện</h1><p>Hỏi đáp tham khảo dựa trên dữ liệu và tài liệu được phép của StockSense VN.</p></div><span className="chip neutral">Mô hình chưa sẵn sàng</span></header>
    <div className="note warn chat-disclaimer"><strong>Lưu ý:</strong> Chat chưa kết nối mô hình ONNX hoặc pipeline an toàn. Yêu cầu hiện chưa được gửi hay lưu; đây không phải tư vấn mua bán chứng khoán.</div>
    {error && <div className="note bad" role="alert">{error}</div>}
    <div className="chat-layout">
      <aside className="card chat-sessions"><div className="card-h"><div><h2>Phiên chat</h2><p className="small muted">Riêng tư theo tài khoản</p></div><button className="btn sm pri" type="button" onClick={createSession} disabled={busy}>Mới</button></div>
        {sessions.length ? <div className="chat-session-list">{sessions.map((session) => <div className={`chat-session ${session.id === selectedId ? 'selected' : ''}`} key={session.id}>
          <button type="button" className="chat-session-select" onClick={() => { setSelectedId(session.id); setError(''); }}><b>{session.title}</b><small>{new Date(session.updated_at).toLocaleDateString('vi-VN')} · {session.message_count} tin nhắn</small></button>
          <button type="button" className="text-button chat-session-delete" aria-label={`Xóa phiên ${session.title}`} disabled={busy} onClick={() => removeSession(session.id)}>×</button>
        </div>)}</div> : <p className="empty-row">Chưa có phiên chat.</p>}
      </aside>
      <section className="card chat-conversation" aria-label="Nội dung hội thoại">
        <div className="card-h"><div><h2>{active?.title ?? 'Bắt đầu cuộc trò chuyện'}</h2><p className="small muted">{active ? 'Lịch sử chỉ hiển thị với chủ tài khoản.' : 'Tạo phiên chat để chuẩn bị cho lần tích hợp mô hình.'}</p></div></div>
        <div className="chat-messages" aria-live="polite">
          {messages.map((message) => <article key={message.id} className={`chat-message ${message.role === 'user' ? 'from-user' : 'from-assistant'}`}><span>{message.role === 'user' ? 'Bạn' : 'StockSense'}</span><p>{message.content}</p></article>)}
          {!messages.length && <div className="chat-empty"><span className="chat-empty-icon" aria-hidden="true">◌</span><h3>{active ? 'Phiên này chưa có tin nhắn' : 'Không gian hỏi đáp của bạn'}</h3><p>Mô hình ONNX chưa được tích hợp. Câu hỏi chỉ có thể gửi sau khi hoàn tất mô hình và các kiểm soát an toàn.</p>
            <div className="chat-suggestions">{suggestions.map((question) => <button type="button" key={question} onClick={() => setDraft(question)}>{question}</button>)}</div>
          </div>}
        </div>
        <form className="chat-composer" onSubmit={send}><label className="sr-only" htmlFor="chat-message">Nội dung câu hỏi</label><textarea id="chat-message" maxLength={8000} rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={active ? 'Nhập câu hỏi (tối đa 8.000 ký tự)…' : 'Tạo phiên chat trước khi nhập câu hỏi'} disabled={!active || busy} />
          <div className="chat-composer-footer"><small>{draft.length}/8000 · Chưa gửi cho đến khi mô hình sẵn sàng</small><button className="btn pri" type="submit" disabled={!active || !draft.trim() || busy}>Gửi câu hỏi</button></div>
        </form>
      </section>
    </div>
  </section>;
}
