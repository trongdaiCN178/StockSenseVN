# StockSense VN (IDSS) – Use case và biểu đồ tuần tự

Cập nhật: 31/10/2026. Dùng để vẽ lại trên Visual Paradigm. Mã UC-01..UC-29 giữ đúng như PRD v0.0.4; UC-30, UC-31 là chức năng bổ sung (bảng giá, biểu đồ nến). Biểu đồ tuần tự mô tả đúng luồng đang chạy trong code (đường dẫn API, bảng CSDL); SD-16 là luồng thiết kế cho mô hình AI.

Cột "Hiện trạng": **Đạt** = chạy đầy đủ; **Một phần** = chạy nhưng phần dự báo/giải thích còn dữ liệu mẫu hoặc chờ mô hình; **Chưa** = chưa làm.

---

## 1. Tác nhân (actor)

Hệ thống phân quyền theo **4 vai trò**: Retail, Trader, Analyst, Admin. Các tác nhân còn lại trên sơ đồ use case không phải vai trò: "Khách" là người chưa đăng nhập, "Hệ thống" là lịch chạy tự động, còn SSI, CafeF, SMTP, Telegram là hệ thống bên ngoài.

| Tác nhân | Loại | Mô tả |
| --- | --- | --- |
| Khách | Người chưa đăng nhập (không phải vai trò) | Chưa có tài khoản; chỉ đăng ký (tạo tài khoản Retail), xác thực email, quên mật khẩu |
| Nhà đầu tư cá nhân (Retail) | Người | Xem thị trường, dự báo, tin, watchlist, cảnh báo, Portfolio, Trade Plan rút gọn, Journal, Chat, PDF |
| Trader | Người | Kế thừa Retail; thêm lưu bộ lọc, import CSV, vốn và % rủi ro, Journal thủ công và thống kê |
| Analyst | Người | Kế thừa Trader; thêm xuất CSV lịch sử, xem nhật ký Chat, (sau) audit/tái lập dự báo, đánh giá mô hình |
| Admin | Người | Quản trị người dùng, duyệt nâng quyền, job dữ liệu, nhật ký quản trị, nhật ký thông báo, nhật ký Chat |
| Hệ thống (lịch 15:30) | Thời gian | Worker tự chạy pipeline dữ liệu sau phiên các ngày giao dịch |
| SSI iBoard | Hệ thống ngoài | Giá ngày (giá khớp + giá điều chỉnh) của 15 mã và chỉ số VN-Index, HNX-Index, VN30 |
| CafeF, VnExpress | Hệ thống ngoài | Tin theo chuyên mục và tin theo từng mã |
| Máy chủ SMTP (Gmail) | Hệ thống ngoài | Gửi thư xác thực, đặt lại mật khẩu, mã xác minh, cảnh báo |
| Telegram Bot API | Hệ thống ngoài | Liên kết tài khoản Telegram, gửi cảnh báo |

**Quan hệ tổng quát hóa (generalization):** Trader → Retail; Analyst → Trader. Admin không kế thừa vai trò người dùng cuối.

---

## 2. Danh sách use case

| UC | Tên | Tác nhân chính | Hiện trạng |
| --- | --- | --- | --- |
| UC-01 | Xem tín hiệu các mã trên trang tổng quan | Retail, Trader, Analyst | Một phần (dự báo mẫu; giá, chỉ số, độ rộng thật) |
| UC-02 | Xem thẻ dự báo và lý do dự báo của một mã | Retail, Trader, Analyst | Một phần (thẻ dự báo mẫu; chưa có lý do) |
| UC-03 | Xem tin mới và sắc thái tin của một mã | Retail, Trader, Analyst | Một phần (tin thật từ 2021; sắc thái chờ mô hình) |
| UC-04 | Thêm mã vào watchlist | Retail, Trader, Analyst | Đạt |
| UC-05 | Đặt ngưỡng và nhận cảnh báo trong ứng dụng | Retail, Trader, Analyst | Một phần (cảnh báo giá, Trade Plan; ngưỡng xác suất chờ mô hình) |
| UC-06 | So sánh dự báo T+2 với T+5 | Trader | Một phần (dữ liệu mẫu) |
| UC-07 | Lọc, sắp xếp, tìm kiếm danh sách mã | Trader | Một phần (thiếu lọc/sắp theo dự báo) |
| UC-08 | Xem lịch sử dự báo và hit rate | Trader | Chưa |
| UC-09 | Xem đóng góp của từng đặc trưng | Analyst | Chưa |
| UC-10 | Xem dữ liệu đầu vào và tái lập dự báo | Analyst | Chưa |
| UC-11 | So sánh mô hình baseline với đa phương thức | Analyst, Admin | Chưa |
| UC-12 | Quản lý tài khoản và vai trò | Admin | Đạt |
| UC-13 | Xem nguồn dữ liệu và chạy lại job | Admin | Đạt |
| UC-14 | Chọn phiên bản mô hình, quay lại bản trước | Admin | Chưa |
| UC-15 | Sàng lọc cổ phiếu bằng Screener | Retail, Trader, Analyst | Một phần (thiếu điều kiện theo dự báo) |
| UC-16 | Ghi giao dịch và xem danh mục | Retail, Trader, Analyst | Đạt (trừ tín hiệu cạnh vị thế) |
| UC-17 | Lập và theo dõi Trade Plan | Retail, Trader, Analyst | Đạt (trừ snapshot dự báo) |
| UC-18 | Xem và ghi Journal | Retail, Trader, Analyst | Đạt (trừ so sánh với dự báo) |
| UC-19 | Hỏi đáp bằng Chat | Retail, Trader, Analyst | Một phần (trả lời theo dữ liệu, chưa dùng mô hình ngôn ngữ) |
| UC-20 | Xuất báo cáo PDF | Retail, Trader, Analyst | Một phần (chưa có giải thích, hit rate) |
| UC-21 | Nhận thông báo qua email và Telegram | Retail, Trader, Analyst, Admin | Đạt |
| UC-22 | Dùng ứng dụng trên điện thoại | Retail, Trader, Analyst | Chưa (GĐ3) |
| UC-23 | Đăng nhập, đăng xuất, đổi/quên mật khẩu | Mọi người dùng | Đạt |
| UC-24 | Chạy pipeline tự động sau mỗi phiên | Hệ thống | Một phần (giá, chỉ số, tin, cảnh báo, thông báo; bước dự báo chờ mô hình) |
| UC-25 | Xem nhật ký hành động quản trị | Admin | Đạt |
| UC-26 | Tự đăng ký và xác thực email | Khách | Đạt |
| UC-27 | Nâng cấp Trader, yêu cầu quyền Analyst | Retail, Trader | Đạt |
| UC-28 | Duyệt hoặc từ chối yêu cầu nâng quyền | Admin | Đạt |
| UC-29 | Tạo Admin, xem đồng ý, xóa tài khoản | Admin, Retail, Trader, Analyst | Đạt |
| UC-30 | Xem bảng giá cuối ngày (bổ sung) | Retail, Trader, Analyst | Đạt |
| UC-31 | Xem biểu đồ nến và chỉ báo kỹ thuật (bổ sung) | Retail, Trader, Analyst | Đạt |

### 2.1 Quan hệ giữa các use case (vẽ trên sơ đồ)

| Quan hệ | Từ | Tới | Ý nghĩa |
| --- | --- | --- | --- |
| «include» | Mọi UC của người dùng đã đăng nhập (trừ UC-26) | UC-23 Đăng nhập | Phải có phiên đăng nhập hợp lệ |
| «extend» | UC-04 Thêm watchlist | UC-01, UC-30, UC-31 | Nút thêm watchlist trên tổng quan, bảng giá, trang mã |
| «extend» | UC-17 Lập Trade Plan | UC-31 (trang mã), UC-15 | Lập kế hoạch từ trang mã hoặc kết quả Screener |
| «extend» | UC-18 Journal | UC-17 | Đóng Trade Plan tự tạo bản ghi Journal |
| «extend» | UC-21 Thông báo ngoài app | UC-05 | Cảnh báo được gửi thêm qua email/Telegram nếu bật kênh |
| «extend» | UC-20 Xuất PDF | UC-31, UC-16, UC-17, UC-18 | Nút xuất PDF trên từng màn hình |
| «include» | UC-24 Pipeline | UC-05 | Pipeline tạo cảnh báo giá và cảnh báo Trade Plan |
| «include» | UC-27 Yêu cầu Analyst | UC-28 | Yêu cầu chỉ có hiệu lực khi Admin duyệt |
| Liên kết | UC-24 | SSI iBoard, CafeF/VnExpress | Nguồn dữ liệu ngoài |
| Liên kết | UC-21, UC-26, UC-23 (quên mật khẩu) | Máy chủ SMTP, Telegram Bot API | Kênh gửi thư/tin nhắn |

### 2.2 Đặc tả ngắn các use case bổ sung

**UC-30. Xem bảng giá cuối ngày**

| Mục | Nội dung |
| --- | --- |
| Tác nhân | Retail, Trader, Analyst |
| Điều kiện trước | Đã đăng nhập |
| Luồng chính | 1. Người dùng mở "Bảng giá". 2. Hệ thống trả 15 mã với tham chiếu, trần, sàn, đóng cửa, +/−, %, mở/cao/thấp, khối lượng, giá trị, dự báo T+2/T+5; tô màu tím trần, xanh lam sàn, vàng tham chiếu, xanh tăng, đỏ giảm. 3. Người dùng lọc theo sàn/ngành, tìm mã, lọc watchlist, sắp xếp. 4. Bấm một mã để mở UC-31. |
| Quy tắc | Tham chiếu = giá đóng cửa phiên trước (UPCoM: giá bình quân); ngày giao dịch không hưởng quyền dùng giá đã điều chỉnh; trần/sàn theo biên độ ±7% (HOSE), ±10% (HNX), ±15% (UPCoM), làm tròn theo bước giá. Dữ liệu cuối ngày, không đặt lệnh. |

**UC-31. Xem biểu đồ nến và chỉ báo kỹ thuật**

| Mục | Nội dung |
| --- | --- |
| Tác nhân | Retail, Trader, Analyst |
| Điều kiện trước | Đã đăng nhập, mã nằm trong 15 mã theo dõi |
| Luồng chính | 1. Người dùng mở trang mã (tab "Giao dịch"). 2. Hệ thống hiển thị khối giá (tham chiếu/trần/sàn, % 1 tuần/1 tháng/3 tháng/từ đầu năm, cao/thấp 52 tuần, trạng thái dữ liệu), biểu đồ nến 5 năm theo giá điều chỉnh kèm khối lượng, và thẻ dự báo T+2/T+5. 3. Người dùng chọn khung Ngày/Tuần/Tháng, khoảng 1T–3N–Tất cả, bật/tắt MA20, MA50, đánh dấu tin, RSI(14), MACD. 4. Rê chuột để xem O/H/L/C và khối lượng của phiên. |
| Mở rộng | Thêm watchlist (UC-04), lập Trade Plan (UC-17), xuất PDF (UC-20), xuất CSV (Analyst). |

---

## 3. Thành phần trên biểu đồ tuần tự

| Lifeline | Thực tế trong code |
| --- | --- |
| Người dùng | Trình duyệt của người dùng |
| Web | React + Vite (`apps/web`) |
| API | Node.js + Fastify (`apps/api`), REST `/api/v1`, phiên bằng cookie HttpOnly |
| CSDL | PostgreSQL 17 |
| Worker | Node.js (`apps/worker`): `admin-jobs:watch`, `market:sync`, `news:sync`, `notifications:deliver` |
| SSI, CafeF, SMTP, Telegram | Hệ thống ngoài |

Mọi request sau khi đăng nhập đều qua bước kiểm tra phiên: API băm token trong cookie, tra `auth_sessions` + `users` (còn hạn, chưa thu hồi, tài khoản hoạt động), rồi kiểm tra quyền (capability) của vai trò. Bước này không vẽ lặp lại trong từng biểu đồ.

---

## 4. Biểu đồ tuần tự

### SD-01. Tự đăng ký và xác thực email (UC-26)

```mermaid
sequenceDiagram
  actor U as Khách
  participant W as Web
  participant A as API
  participant D as CSDL
  participant M as SMTP (Gmail)
  U->>W: Điền email, mật khẩu, 3 ô đồng ý
  W->>W: Kiểm tra chính sách mật khẩu
  W->>A: POST /auth/register
  A->>D: Đếm lượt đăng ký theo IP/email (registration_requests, HMAC)
  alt Vượt 5 lần/giờ
    A-->>W: 202 "Nếu email hợp lệ, chúng tôi đã gửi email xác thực"
  else Email chưa có
    A->>D: INSERT users (retail, chưa xác thực), user_consent ×2, email_verification_tokens (SHA-256, 24 giờ)
    A-->>W: 202 (cùng thông điệp)
    A->>M: Gửi thư có liên kết xác thực (chạy nền sau khi trả 202)
  else Email đã có
    A-->>W: 202 (cùng thông điệp)
    A->>M: Gửi thư "Bạn đã có tài khoản"
  end
  U->>W: Bấm liên kết trong thư (/verify-email)
  W->>A: POST /auth/verify-email {token}
  A->>D: Kiểm tra token còn hạn, chưa dùng, UPDATE users.email_verified_at, token.consumed_at
  A-->>W: 200 Xác thực thành công
  W-->>U: Mời đăng nhập
```

### SD-02. Đăng nhập, khóa tạm khi sai nhiều lần (UC-23)

```mermaid
sequenceDiagram
  actor U as Người dùng
  participant W as Web
  participant A as API
  participant D as CSDL
  U->>W: Nhập email, mật khẩu
  W->>A: POST /auth/login
  A->>D: SELECT users theo email (khóa hàng)
  alt Tài khoản bị khóa tạm hoặc ngưng hoạt động
    A-->>W: 401 "Email hoặc mật khẩu không đúng"
  else Sai mật khẩu (so bản băm scrypt)
    A->>D: failed_login_count + 1, lần thứ 5 đặt locked_until = now + 15 phút
    A-->>W: 401 (thông báo chung)
  else Chưa xác thực email
    A-->>W: 403 EMAIL_NOT_VERIFIED
  else Đúng
    A->>D: Đặt lại bộ đếm, INSERT auth_sessions (băm token, hết hạn 24 giờ)
    A-->>W: 200 + Set-Cookie (HttpOnly)
    W->>A: GET /me
    A-->>W: Vai trò, must_change_password
    W-->>U: Vào trang chính theo vai trò
  end
```

### SD-03. Quên mật khẩu (UC-23)

```mermaid
sequenceDiagram
  actor U as Người dùng
  participant W as Web
  participant A as API
  participant D as CSDL
  participant M as SMTP (Gmail)
  U->>W: Nhập email ở "Quên mật khẩu"
  W->>A: POST /auth/forgot-password
  A->>D: Giới hạn tần suất (password_reset_requests), nếu có tài khoản: INSERT password_reset_tokens (SHA-256, 30 phút)
  A-->>W: 202 thông điệp chung
  A->>M: Gửi thư có liên kết đặt lại
  U->>W: Mở liên kết, nhập mật khẩu mới
  W->>A: POST /auth/reset-password {token, mật khẩu}
  A->>D: Kiểm tra token, cập nhật password_hash, đánh dấu token đã dùng, thu hồi mọi auth_sessions
  A-->>W: 200, đăng nhập lại
```

### SD-04. Nâng cấp Trader, yêu cầu Analyst và Admin duyệt (UC-27, UC-28)

```mermaid
sequenceDiagram
  actor R as Retail
  actor Ad as Admin
  participant W as Web
  participant A as API
  participant D as CSDL
  R->>W: Cài đặt → Tài khoản & vai trò → Nâng cấp lên Trader
  W->>A: POST /me/upgrade/trader {kinh nghiệm, mục đích, xác nhận}
  A->>D: Transaction: users.role = trader, user_consent (trader_terms), admin_audit_log (user.self_upgrade), thu hồi auth_sessions
  A-->>W: 200 → Web đăng xuất, người dùng đăng nhập lại
  R->>W: Gửi yêu cầu quyền Analyst
  W->>A: POST /me/role-requests {tổ chức, chức danh, email cơ quan, mục đích}
  A->>D: Kiểm tra không có yêu cầu đang chờ, không bị từ chối trong 7 ngày, INSERT role_requests (pending_review)
  A-->>W: 201
  Ad->>W: Quản trị → Yêu cầu nâng quyền
  W->>A: GET /admin/role-requests
  A-->>W: Danh sách yêu cầu
  alt Duyệt
    W->>A: POST /admin/role-requests/{id}/approve
    A->>D: Chặn tự duyệt, users.role = analyst, thu hồi phiên người yêu cầu, admin_audit_log
  else Từ chối
    W->>A: POST /admin/role-requests/{id}/reject {lý do}
    A->>D: role_requests = rejected, lưu lý do, admin_audit_log
  end
  A-->>W: 200
```

### SD-05. Xem bảng giá (UC-30)

```mermaid
sequenceDiagram
  actor U as Người dùng
  participant W as Web
  participant A as API
  participant D as CSDL
  U->>W: Mở "Bảng giá"
  W->>A: GET /market/board
  A->>D: symbols đang bật + 2 phiên gần nhất trong daily_prices (giá khớp, giá điều chỉnh) + forecasts của lô mới nhất
  A->>A: Tính tham chiếu/trần/sàn, +/−, %, màu từng ô (packages/core/price-board)
  A-->>W: 15 dòng bảng giá
  W-->>U: Hiển thị, lọc sàn/ngành, tìm mã, sắp xếp
  U->>W: Bấm một mã
  W-->>U: Chuyển tới trang mã (SD-06)
```

### SD-06. Xem trang mã, biểu đồ nến và chỉ báo (UC-31, UC-02, UC-03)

```mermaid
sequenceDiagram
  actor U as Người dùng
  participant W as Web
  participant A as API
  participant D as CSDL
  U->>W: Mở /symbols/FPT
  par Tải song song
    W->>A: GET /symbols/FPT
    A->>D: symbols + giá mới nhất + forecasts, cờ dữ liệu cũ / thiếu tin 7 ngày
    A-->>W: Thông tin mã, dự báo, trạng thái dữ liệu
  and
    W->>A: GET /symbols/FPT/prices?range=all
    A->>D: daily_prices 5 năm (giá khớp + giá điều chỉnh)
    A-->>W: ~1.249 phiên
  and
    W->>A: GET /symbols/FPT/news
    A->>D: news_items qua news_item_symbols (50 tin mới nhất)
    A-->>W: Danh sách tin
  and
    W->>A: GET /market/status
    A-->>W: Ngày dữ liệu, ngày nghỉ sắp tới
  end
  W->>W: Tính tham chiếu/trần/sàn, % theo kỳ, cao/thấp 52 tuần, MA, RSI, MACD, ngày đáo hạn bỏ ngày nghỉ
  W-->>U: Khối giá, biểu đồ nến (TradingView Lightweight Charts), đánh dấu ngày có tin, thẻ dự báo T+2/T+5
```

### SD-07. Thêm watchlist và đặt cảnh báo giá (UC-04, UC-05)

```mermaid
sequenceDiagram
  actor U as Người dùng
  participant W as Web
  participant A as API
  participant D as CSDL
  U->>W: Bấm "Thêm watchlist"
  W->>A: PUT /watchlist/FPT
  A->>D: Transaction: khóa hàng users, đếm watchlist_items
  alt Đã có 10 mã
    A-->>W: 409 WATCHLIST_LIMIT_REACHED
  else
    A->>D: INSERT watchlist_items (bỏ qua nếu đã có)
    A-->>W: 200
  end
  U->>W: Đặt cảnh báo "giá đóng cửa ≥ 60.000"
  W->>A: POST /alert-rules
  A->>D: INSERT alert_rules
  A-->>W: 201
```

### SD-08. Pipeline dữ liệu sau phiên 15:30 (UC-24, UC-05, UC-21)

```mermaid
sequenceDiagram
  participant S as Worker (admin-jobs:watch)
  participant D as CSDL
  participant MS as Worker market:sync
  participant NS as Worker news:sync
  participant ND as Worker notifications:deliver
  participant SSI as SSI iBoard
  participant CF as CafeF / VnExpress
  participant M as SMTP / Telegram
  S->>D: 15:30, thứ Hai–Sáu, không phải ngày nghỉ (market_holidays)?
  S->>D: INSERT admin_job_runs: market.sync, news.sync, notifications.deliver
  S->>MS: Chạy job 1
  MS->>D: data_ingestion_runs (running)
  loop 15 mã
    MS->>SSI: Giá ngày 5 ngày gần nhất
    MS->>D: UPSERT daily_prices (giá khớp + giá điều chỉnh)
    MS->>SSI: Lấy lại phiên cũ nhất đang lưu
    opt Giá điều chỉnh đã đổi (chia cổ tức/thưởng cổ phiếu)
      MS->>SSI: Lấy lại toàn bộ lịch sử
      MS->>D: UPSERT lịch sử
    end
    MS->>D: Tạo user_alerts + notification_outbox (cảnh báo giá, Trade Plan)
  end
  MS->>SSI: VN-Index, HNX-Index, VN30
  MS->>D: UPSERT market_index_daily, hết hạn Trade Plan, xóa cảnh báo > 90 ngày, cập nhật data_ingestion_runs
  S->>NS: Chạy job 2
  NS->>CF: Tin chuyên mục + trang tin theo mã
  NS->>D: UPSERT news_items, news_item_symbols (bỏ trùng theo tiêu đề và ngày)
  S->>ND: Chạy job 3
  ND->>D: Nhận các dòng notification_outbox chờ gửi (SKIP LOCKED)
  ND->>M: Gửi email / Telegram tới kênh đã xác minh
  ND->>D: Cập nhật sent / retry / failed
  opt Job lỗi sau 3 lần thử
    S->>D: user_alerts (job_failed) cho mọi Admin + notification_outbox
  end
```

### SD-09. Liên kết kênh thông báo email và Telegram (UC-21)

```mermaid
sequenceDiagram
  actor U as Người dùng
  participant W as Web
  participant A as API
  participant D as CSDL
  participant M as SMTP (Gmail)
  participant T as Telegram
  U->>W: Cài đặt → Kênh thông báo → Liên kết email
  W->>A: POST /notify/email/link {email}
  A->>D: notification_channels: lưu mã xác minh (băm, 10 phút)
  A->>M: Gửi mã xác minh
  U->>W: Nhập mã
  W->>A: POST /notify/email/verify {mã}
  A->>D: Kiểm tra mã, đặt verified_at
  U->>W: Liên kết Telegram
  W->>A: POST /notify/telegram/link
  A->>D: Lưu mã liên kết
  A-->>W: Mã + tên bot
  U->>T: Gửi mã cho bot
  T->>A: POST /notify/telegram/webhook (có secret)
  A->>D: Gắn chat id, đặt verified_at
  U->>W: Bật kênh, gửi thử
  W->>A: PUT /me/notification-preferences, POST /notify/channels/{kênh}/test
```

### SD-10. Ghi giao dịch và import CSV vào Portfolio (UC-16)

```mermaid
sequenceDiagram
  actor U as Trader
  participant W as Web
  participant A as API
  participant D as CSDL
  U->>W: Nhập giao dịch mua/bán
  W->>A: POST /portfolio/transactions
  A->>D: Tính vị thế, từ chối bán quá số đang nắm, INSERT portfolio_transactions
  A-->>W: 201
  U->>W: Chọn tệp CSV
  W->>W: Đọc tệp, hiển thị xem trước
  U->>W: Xác nhận
  W->>A: POST /portfolio/transactions/import
  A->>D: Transaction: ghi dòng hợp lệ, bỏ dòng lỗi/trùng
  A-->>W: Số dòng đã ghi + danh sách dòng bị bỏ (số dòng, lý do)
  W->>A: GET /portfolio
  A->>D: Giao dịch + giá đóng cửa mới nhất
  A-->>W: Vị thế, giá vốn bình quân, lãi/lỗ, tỷ trọng, phân bổ ngành, giá trị theo thời gian
```

### SD-11. Trade Plan: lập, cảnh báo, đóng và tạo Journal (UC-17, UC-18)

```mermaid
sequenceDiagram
  actor U as Trader
  participant W as Web
  participant A as API
  participant D as CSDL
  participant K as Worker market:sync
  U->>W: Nhập vùng giá vào, cắt lỗ, mục tiêu, vốn, % rủi ro
  W->>A: POST /plans/calc
  A-->>W: R:R, khoảng cách %, khối lượng tối đa theo lô 100 (packages/core/calc)
  U->>W: Lưu kế hoạch
  W->>A: POST /plans
  A->>D: INSERT trade_plans (snapshot giá lúc lập)
  K->>D: Sau phiên: giá chạm vùng vào / cắt lỗ / mục tiêu → user_alerts + notification_outbox
  U->>W: Sửa kế hoạch
  W->>A: PATCH /plans/{id}
  A->>D: UPDATE trade_plans + INSERT trade_plan_revisions
  U->>W: Đóng kế hoạch (giá thoát, lý do)
  W->>A: POST /plans/{id}/close
  A->>D: Transaction: trade_plans = closed, lãi/lỗ thực tế, INSERT journal_entries (một bản ghi cho mỗi kế hoạch)
  A-->>W: 200
  U->>W: Mở Journal, thêm ghi chú/thẻ/bài học, xem thống kê theo kỳ
```

### SD-12. Chat hỏi đáp theo dữ liệu (UC-19)

```mermaid
sequenceDiagram
  actor U as Người dùng
  participant W as Web
  participant A as API
  participant C as Bộ trả lời Chat (trong API)
  participant D as CSDL
  U->>W: Nhập câu hỏi
  W->>A: POST /chat/sessions/{id}/messages
  A->>D: Kiểm tra phiên chat thuộc người dùng
  A->>C: answer(user, question)
  alt Đòi lệnh / khuyến nghị / giá mục tiêu / dữ liệu người khác
    C-->>A: Thông điệp từ chối cố định (input_blocked)
  else Hỏi về giá, dự báo, tin, chỉ báo, thị trường, dữ liệu cá nhân, thuật ngữ
    C->>D: Truy xuất qua repository (dữ liệu cá nhân lọc theo user_id và quyền)
    C->>C: Dựng câu trả lời từ mẫu + trích dẫn nguồn
    C->>C: Lọc đầu ra (MUA/BÁN, giá mục tiêu)
    C-->>A: Câu trả lời + nguồn
  else Không có dữ liệu
    C-->>A: "Hệ thống không có dữ liệu này."
  end
  A->>D: INSERT chat_messages ×2 (intent, engine, filter_result, personal), đặt tên phiên
  A-->>W: Câu trả lời + nguồn bấm được
```

### SD-13. Xuất báo cáo PDF (UC-20)

```mermaid
sequenceDiagram
  actor U as Người dùng
  participant W as Web
  participant A as API
  participant D as CSDL
  U->>W: Bấm "Xuất PDF" (mã / danh mục / Trade Plan / Journal)
  W->>A: GET /reports/symbols/FPT.pdf (hoặc portfolio.pdf, plans/{id}.pdf, journal.pdf)
  A->>D: Cùng truy vấn với màn hình (chỉ dữ liệu của chính người dùng)
  A->>A: Dàn trang bằng pdfkit (font Unicode, tuyên bố, ngày dữ liệu, số trang)
  A-->>W: Tệp PDF
  W-->>U: Tải xuống
```

### SD-14. Admin xem nguồn dữ liệu và chạy lại job (UC-13, UC-25)

```mermaid
sequenceDiagram
  actor Ad as Admin
  participant W as Web
  participant A as API
  participant D as CSDL
  participant S as Worker (admin-jobs:watch)
  Ad->>W: Quản trị → Nguồn dữ liệu & job
  W->>A: GET /admin/jobs, GET /admin/ingestion-runs
  A->>D: admin_job_runs, admin_worker_instances (heartbeat), data_ingestion_runs
  A-->>W: Trạng thái worker, các lần chạy
  Ad->>W: Bấm "Chạy lại" market.sync
  W->>A: POST /admin/jobs/market.sync/run
  A->>D: INSERT admin_job_runs (queued) + admin_audit_log (job.enqueued)
  A-->>W: 202
  S->>D: Nhận job (khóa, lease 45 phút), chạy, cập nhật kết quả
  Ad->>W: Quản trị → Người dùng & audit
  W->>A: GET /admin/audit?from=&actor=&action=&page=
  A->>D: admin_audit_log (lọc, phân trang)
  A-->>W: Nhật ký quản trị
```

### SD-15. Tự xóa tài khoản (UC-29)

```mermaid
sequenceDiagram
  actor U as Người dùng
  participant W as Web
  participant A as API
  participant D as CSDL
  U->>W: Cài đặt → Xóa tài khoản, nhập lại mật khẩu
  W->>A: DELETE /me {mật khẩu}
  alt Tài khoản Admin
    A-->>W: 409 ADMIN_SELF_DELETE_BLOCKED, không xóa gì
  else Sai mật khẩu
    A-->>W: 422 CURRENT_PASSWORD_INVALID, không xóa gì
  else
    A->>D: DELETE users (dữ liệu cá nhân xóa theo khóa ngoại CASCADE, admin_audit_log giữ, actor = NULL)
    A-->>W: 200 + xóa cookie phiên
  end
```

### SD-16. Sinh dự báo hằng ngày – thiết kế cho mô hình AI (UC-24, chưa triển khai)

Dùng các bảng ở phần B của `CSDL_StockSenseVN.sql`.

```mermaid
sequenceDiagram
  participant S as Worker (lịch 15:30)
  participant AI as Worker mô hình (Python)
  participant D as CSDL
  S->>D: Sau market.sync và news.sync: xếp hàng bước dự báo
  AI->>D: Đọc model_versions (bản đang phục vụ), daily_prices (adj_*), news_items mới, financial_reports
  AI->>AI: Chấm cảm xúc tin mới, tính embedding
  AI->>D: INSERT news_sentiments, news_embeddings
  AI->>AI: Tạo đặc trưng (cut-off 15:00), suy luận T+2/T+5, giải thích (IG, attention)
  AI->>D: Transaction: market_batches (ghim model_version_id), forecasts (xác suất, nhãn, due_on, data_status, snapshot_hash), forecast_explanations, forecast_inputs
  AI->>D: Điền actual_label cho dự báo đã đáo hạn
  S->>D: Tạo cảnh báo đổi nhãn / vượt ngưỡng xác suất → user_alerts + notification_outbox
```
