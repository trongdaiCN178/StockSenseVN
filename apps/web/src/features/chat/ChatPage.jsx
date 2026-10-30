import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/index.js';
import { navigate } from '../../app/navigation.js';
import { Disclaimer } from '../../app/icons.jsx';

const suggestions = ['Giá FPT hôm nay?', 'Dự báo T+5 của VCB', 'Tin mới về HPG', 'VN-Index hôm nay thế nào?', 'Danh mục của tôi', 'R:R là gì?'];
const time = new Intl.DateTimeFormat('vi-VN', { timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' });

// FR-M12: chat answers built from StockSense data with citations; order/advice requests are refused.
export function ChatPage() {
  const [sessions, setSessions] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);

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

  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'end' }); }, [messages]);

  async function createSession() {
    setBusy(true); setError('');
    try {
      const result = await api.chat.createSession();
      await refreshSessions(result.session.id);
      return result.session.id;
    } catch (e) { setError(e.message || 'Không tạo được phiên chat.'); return ''; }
    finally { setBusy(false); }
  }

  async function send(event, text = draft) {
    event?.preventDefault();
    const question = text.trim();
    if (!question) return;
    setBusy(true); setError('');
    try {
      const sessionId = selectedId || (await api.chat.createSession()).session.id;
      await api.chat.sendMessage(sessionId, question);
      setDraft('');
      const [history] = await Promise.all([api.chat.messages(sessionId), refreshSessions(sessionId)]);
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
    <header className="pagehead"><div><span className="eyebrow">HỖ TRỢ NGHIÊN CỨU</span><h1>Chat hỏi đáp</h1><p>Trả lời từ dữ liệu của StockSense VN: giá, dự báo, tin tức, thị trường, thuật ngữ và dữ liệu của chính bạn. Mỗi câu trả lời kèm nguồn.</p></div><span className="chip info">Trả lời theo dữ liệu, chưa dùng mô hình ngôn ngữ</span></header>
    {error && <div className="note bad" role="alert">{error}</div>}
    <div className="chat-layout">
      <aside className="card chat-sessions"><div className="card-h"><div><h2>Phiên chat</h2><p className="small muted">Riêng tư theo tài khoản</p></div><button className="btn sm pri" type="button" onClick={createSession} disabled={busy}>Mới</button></div>
        {sessions.length ? <div className="chat-session-list">{sessions.map((session) => <div className={`chat-session ${session.id === selectedId ? 'selected' : ''}`} key={session.id}>
          <button type="button" className="chat-session-select" onClick={() => { setSelectedId(session.id); setError(''); }}><b>{session.title}</b><small>{new Date(session.updated_at).toLocaleDateString('vi-VN')} · {session.message_count} tin nhắn</small></button>
          <button type="button" className="text-button chat-session-delete" aria-label={`Xóa phiên ${session.title}`} disabled={busy} onClick={() => removeSession(session.id)}>×</button>
        </div>)}</div> : <p className="empty-row">Chưa có phiên chat. Gửi câu hỏi đầu tiên để tạo phiên.</p>}
      </aside>
      <section className="card chat-conversation" aria-label="Nội dung hội thoại">
        <div className="card-h"><div><h2>{active?.title ?? 'Bắt đầu cuộc trò chuyện'}</h2><p className="small muted">Lịch sử chỉ hiển thị với chủ tài khoản.</p></div></div>
        <div className="chat-messages" aria-live="polite">
          {messages.map((message) => <article key={message.id} className={`chat-message ${message.role === 'user' ? 'from-user' : 'from-assistant'} ${message.status === 'blocked' ? 'blocked' : ''}`}>
            <span>{message.role === 'user' ? 'Bạn' : 'StockSense'} · {time.format(new Date(message.created_at))}{message.status === 'blocked' ? ' · đã từ chối' : ''}</span>
            <p>{message.content}</p>
            {message.citations?.length > 0 && <div className="chat-citations"><b>Nguồn:</b>{message.citations.map((citation, index) => <Citation key={index} citation={citation} />)}</div>}
          </article>)}
          {!messages.length && <div className="chat-empty"><span className="chat-empty-icon" aria-hidden="true">◌</span><h3>Hỏi về dữ liệu của StockSense</h3><p>Ví dụ giá và biến động của một mã, dự báo T+2/T+5, tin mới, chỉ số thị trường, thuật ngữ, hoặc danh mục và Trade Plan của chính bạn. Chat không đưa lệnh hay khuyến nghị mua/bán.</p>
            <div className="chat-suggestions">{suggestions.map((question) => <button type="button" key={question} disabled={busy} onClick={() => send(null, question)}>{question}</button>)}</div>
          </div>}
          <div ref={endRef} />
        </div>
        <form className="chat-composer" onSubmit={send}><label className="sr-only" htmlFor="chat-message">Nội dung câu hỏi</label><textarea id="chat-message" maxLength={8000} rows={3} value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e); } }} placeholder="Nhập câu hỏi, ví dụ: Giá FPT hôm nay? (Enter để gửi, Shift+Enter xuống dòng)" disabled={busy} />
          <div className="chat-composer-footer"><small>{draft.length}/8000</small><button className="btn pri" type="submit" disabled={!draft.trim() || busy}>{busy ? 'Đang trả lời…' : 'Gửi câu hỏi'}</button></div>
        </form>
        <Disclaimer>Chat chỉ trả lời từ dữ liệu của hệ thống và mang tính tham khảo, không phải tư vấn đầu tư.</Disclaimer>
      </section>
    </div>
  </section>;
}

function Citation({ citation }) {
  const date = citation.date ? ` · ${new Date(`${citation.date.slice(0, 10)}T00:00:00Z`).toLocaleDateString('vi-VN', { timeZone: 'UTC' })}` : '';
  if (citation.url) return <a href={citation.url} target="_blank" rel="noopener noreferrer">{citation.label} ↗</a>;
  if (citation.path) return <button type="button" className="text-button" onClick={() => navigate(citation.path)}>{citation.label}</button>;
  return <span>{citation.label}{date}</span>;
}
