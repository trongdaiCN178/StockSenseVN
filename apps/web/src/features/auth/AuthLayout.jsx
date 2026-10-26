// Two-column public layout from the HTML prototype: brand panel on the left, form on the right.
export function AuthLayout({ children }) {
  return <div className="login">
    <div className="login-l">
      <div className="brand"><div className="brand-mark" style={{ background: 'var(--accent-ink)', color: 'var(--accent)' }}>SS</div><div><b>StockSense VN</b></div></div>
      <div>
        <h1>Dự báo xu hướng T+2 và T+5 cho cổ phiếu HOSE, HNX</h1>
        <p style={{ marginTop: 12, opacity: 0.85, maxWidth: '44ch' }}>Kết hợp chỉ báo tài chính, kỹ thuật và cảm xúc tin tức. Cập nhật mỗi ngày sau 15:30, kèm giải thích cho từng dự báo.</p>
      </div>
      <div className="small" style={{ opacity: 0.8 }}>Dự báo chỉ mang tính tham khảo, không phải khuyến nghị đầu tư.</div>
    </div>
    <div className="login-r">{children}</div>
  </div>;
}
