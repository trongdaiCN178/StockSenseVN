import { useEffect, useState } from 'react';
import { api } from '../../api/index.js';

const dateTime = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' });
const statusLabels = { queued: 'Đang chờ', running: 'Đang chạy', succeeded: 'Thành công', partial: 'Một phần', failed: 'Thất bại' };
const statusClass = { queued: 'info', running: 'hold', succeeded: 'up', partial: 'hold', failed: 'down' };

export function AdminJobsPage() {
  const [items, setItems] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [runs, setRuns] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');

  async function refresh() {
    const [jobData, ingestionData] = await Promise.all([api.admin.jobs(), api.admin.ingestionRuns()]);
    setJobs(jobData.jobs); setRuns(jobData.runs); setWorkers(jobData.workers ?? []); setItems(ingestionData.items);
  }

  useEffect(() => {
    let active = true;
    refresh().catch((requestError) => { if (active) setError(requestError.message || 'Không tải được lịch sử đồng bộ.'); })
      .finally(() => { if (active) setLoading(false); });
    const timer = window.setInterval(() => refresh().catch(() => {}), 10_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  async function enqueue(jobKey) {
    setBusy(jobKey); setError(''); setNotice('');
    try {
      const run = await api.admin.enqueueJob(jobKey);
      setNotice(`${run.job_key} đã được thêm vào hàng chờ. Một worker sẽ xử lý tác vụ này độc lập với yêu cầu API.`);
      await refresh();
    } catch (requestError) { setError(requestError.message || 'Không xếp được tác vụ vào hàng chờ.'); }
    finally { setBusy(''); }
  }

  const activeJobKeys = new Set(runs.filter((run) => ['queued', 'running'].includes(run.status)).map((run) => run.job_key));

  return <section className="content admin-users-page">
    <header className="pagehead">
      <div><span className="eyebrow">QUẢN TRỊ · VẬN HÀNH</span><h1>Đồng bộ dữ liệu</h1>
        <p>Theo dõi và xếp hàng các tác vụ worker được cho phép.</p></div>
      <span className="chip info">WORKER</span>
    </header>
    <div className="note info">API chỉ xếp tác vụ vào hàng chờ. Một worker riêng sẽ xử lý chúng; việc nạp dữ liệu thô không tạo lô dự báo hay kết quả AI.</div>
    <section className="card">
      <div className="card-h"><div><h2>Trạng thái worker</h2><p className="small muted">Worker được coi là online khi nhận được heartbeat trong vòng 45 giây.</p></div></div>
      {!workers.length ? <p className="small muted">Chưa ghi nhận heartbeat của worker. Chạy `npm run worker:admin-jobs:watch` sau khi áp dụng migration 017.</p> : <div className="admin-job-list">{workers.map((worker) => <article className="admin-job-row" key={worker.worker_id}>
        <div><b>{worker.online ? 'Đang hoạt động' : worker.stopped_at ? 'Đã dừng' : 'Heartbeat đã hết hạn'}</b>
          <p className="small muted">Chế độ: {worker.mode} · Heartbeat gần nhất: {dateTime.format(new Date(worker.heartbeat_at))}{worker.active_job_key ? ` · Đang chạy: ${worker.active_job_key}` : ''}</p></div>
        <span className={`chip ${worker.online ? 'up' : 'neutral'}`}>{worker.online ? 'ONLINE' : 'OFFLINE'}</span>
      </article>)}</div>}
    </section>
    {error && <div className="note bad" role="alert">{error}</div>}
    {notice && <div className="note info" role="status">{notice}</div>}
    <section className="card">
      <div className="card-h"><div><h2>Tác vụ worker</h2><p className="small muted">Chỉ các tác vụ dữ liệu và thông báo được cho phép mới khả dụng. Khi worker chạy ở chế độ watch, pipeline tự xếp hàng sau 15:30 các ngày giao dịch (T2–T6); tác vụ lỗi được thử lại tối đa 3 lần rồi báo cho Admin.</p></div></div>
      {loading ? <p className="loading-card">Đang tải tác vụ...</p> : <div className="admin-job-list">{jobs.map((job) => <article className="admin-job-row" key={job.key}>
        <div><b>{job.label}</b><p className="small muted">{job.description}</p></div>
        <button className="btn sm pri" type="button" disabled={busy !== '' || activeJobKeys.has(job.key)} onClick={() => enqueue(job.key)}>
          {busy === job.key ? 'Đang gửi...' : activeJobKeys.has(job.key) ? 'Đang chờ/chạy' : 'Chạy lại'}
        </button>
      </article>)}</div>}
      {!!runs.length && <div className="tw"><table><thead><tr><th>Tác vụ</th><th>Nguồn kích hoạt</th><th>Trạng thái</th><th>Thời điểm xếp hàng</th><th>Số lần thử</th><th>Lỗi</th></tr></thead><tbody>{runs.map((run) => <tr key={run.id}>
        <td>{jobs.find((job) => job.key === run.job_key)?.label ?? run.job_key}</td>
        <td>{run.trigger === 'schedule' ? `Lịch tự động ${run.scheduled_for ?? ''}` : 'Admin chạy tay'}</td>
        <td><span className={`chip ${statusClass[run.status] ?? 'neutral'}`}>{statusLabels[run.status] ?? run.status}</span></td>
        <td>{dateTime.format(new Date(run.queued_at))}</td><td>{run.attempt_count}</td><td>{run.error_code ?? '-'}</td>
      </tr>)}</tbody></table></div>}
    </section>
    <section className="card">
      <div className="card-h"><div><h2>Lịch sử nạp dữ liệu</h2><p className="small muted">50 lượt nạp dữ liệu gần nhất.</p></div></div>
      {loading ? <p className="loading-card">Đang tải lịch sử...</p> : <div className="tw"><table className="admin-ingestion-table"><thead><tr>
        <th>Thời gian</th><th>Nguồn / tập dữ liệu</th><th>Trạng thái</th><th>Khoảng thời gian</th><th>Đơn vị thành công</th><th>Số dòng</th><th>Lỗi</th>
      </tr></thead><tbody>{items.map((run) => <tr key={run.id}>
        <td>{dateTime.format(new Date(run.started_at))}</td><td>{run.source} / {run.dataset}</td>
        <td><span className={`chip ${statusClass[run.status] ?? 'neutral'}`}>{statusLabels[run.status] ?? run.status}</span></td>
        <td>{run.range_start} - {run.range_end}</td>
        <td>{run.symbols_succeeded}/{run.symbols_total} {run.units_label === 'categories' ? 'danh mục' : 'mã'}</td>
        <td>{run.rows_upserted}</td><td className="ingestion-error">{run.error_message || '-'}</td>
      </tr>)}{!items.length && <tr><td colSpan="7" className="empty-row">Chưa có lượt nạp dữ liệu nào.</td></tr>}</tbody></table></div>}
    </section>
  </section>;
}
