# StockSense VN — kiến trúc web và ranh giới backend

**Trạng thái:** bản thiết kế đề xuất, đối chiếu PRD v0.0.3, Project Brief v0.0.3, SDD v0.0.4 và prototype hiện có.  
**Phạm vi:** web responsive GĐ1–GĐ2; mobile React Native GĐ3 dùng chung API và `packages/core`.

## 1. Các quyết định kiến trúc

1. Toàn bộ ứng dụng chạy JavaScript trên Node.js: web React + Vite, API Node.js, worker Node.js và inference ONNX bằng ONNX Runtime JS. PostgreSQL là nguồn dữ liệu bền vững. Trình duyệt không gọi worker, notifier hay CSDL trực tiếp.
2. REST JSON có tiền tố `/api/v1`. Web dùng JWT trong cookie `HttpOnly`; mobile dùng Bearer token theo SDD. API quyết định quyền truy cập cuối cùng. Route guard ở web chỉ phục vụ điều hướng và trải nghiệm.
3. Phân chia theo **miền nghiệp vụ** trong web, không theo mốc M0–M14. Mã M chỉ dùng làm tham chiếu truy vết yêu cầu và bật tính năng theo giai đoạn.
4. `packages/core` chỉ chứa schema/contract dùng chung, enum/nhãn nghiệp vụ, hàm tính thuần và validation. JavaScript dùng JSDoc và JSON Schema để giữ contract rõ ràng; không chứa React, router, fetch, endpoint, menu hay chính sách bảo mật có thể thay thế kiểm tra ở server.
5. Hợp đồng API được ghi ở `docs/api-contract.md`, bám endpoint trong SDD. OpenAPI là nguồn contract request/response cho frontend và tài liệu backend; không duy trì hai danh sách endpoint độc lập trong từng feature.
6. Dữ liệu cá nhân luôn được truy vấn theo danh tính xác thực ở server, áp dụng ownership/RLS như SDD. Admin không được đọc nội dung Portfolio, Trade Plan, Journal của người dùng.

## 2. Sơ đồ hệ thống

```text
Browser (React web) ── HTTPS /api/v1 ── Node.js API ── PostgreSQL
                                             │              ▲
                                             └─ Chat (GĐ2)  │
                                                            │
Node.js worker / scheduler ─────────────────────────────────┘
       ├─ ETL + batch orchestration
       ├─ ONNX Runtime JS inference
       └─ notifier (GĐ2) ── SMTP / Telegram

React Native (GĐ3) ─────── HTTPS /api/v1 (cùng hợp đồng)
```

Web/API không chạy suy luận mô hình theo request. API đọc dự báo đã lưu. Tác vụ chạy lại từ Admin được xếp hàng qua PostgreSQL và worker xử lý. Worker nạp model `.onnx` bằng ONNX Runtime JS, lưu kèm phiên bản, checksum, tokenizer/scaler hoặc tài nguyên tiền xử lý cần thiết. Thay đổi model serving có hiệu lực từ batch kế tiếp theo SDD.

**Ranh giới ONNX:** ONNX Runtime JS thực thi inference, không thay thế quy trình huấn luyện và xuất model. Pipeline nhận artifact ONNX đã được tạo và kiểm tra tương thích; phiên bản model, cấu hình tiền xử lý, vocab/tokenizer, checksum và ngưỡng sai số phải được đóng gói cùng artifact. Nếu yêu cầu huấn luyện cũng phải chạy JavaScript, cần chọn riêng framework hỗ trợ kiến trúc và phép toán của mô hình; không giả định ONNX Runtime JS tự huấn luyện mô hình.

## 3. Cấu trúc repository đề xuất

```text
idss/
├─ apps/
│  ├─ web/                          # React + JavaScript + Vite
│  │  ├─ src/
│  │  │  ├─ app/                    # bootstrap, providers, router, shell, route guards
│  │  │  ├─ api/                    # HTTP client, auth transport, OpenAPI contract client
│  │  │  ├─ auth/                   # AuthProvider, session hooks, capability helpers
│  │  │  ├─ components/             # primitives và component dùng bởi nhiều feature
│  │  │  ├─ features/               # module theo miền nghiệp vụ (mục 4)
│  │  │  ├─ hooks/                  # hook tổng quát, ví dụ useDebounce
│  │  │  ├─ lib/                    # env, date/time, query client, logger
│  │  │  ├─ styles/                 # CSS port nguyên bản prototype, sau đó chuẩn hóa
│  │  │  └─ main.jsx
│  │  ├─ public/                    # logo, favicon, tài nguyên tĩnh
│  │  └─ vite.config.js
│  ├─ api/                          # Node.js API (Fastify), auth/domain services
│  ├─ worker/                       # Node.js scheduler, ETL, ONNX inference, hậu xử lý
│  ├─ notifier/                     # GĐ2; Node.js email/Telegram delivery
│  └─ mobile/                       # GĐ3; React Native/Expo, cùng core và API
├─ packages/
│  └─ core/src/
│     ├─ domain/                    # JSDoc/JSON Schema: forecast, market, plan, portfolio...
│     ├─ labels/                    # nhãn nội bộ ↔ nhãn tiếng Việt
│     ├─ access/                    # capability constants/route metadata thuần
│     ├─ calculations/              # R:R, khối lượng, confidence nếu cùng định nghĩa
│     ├─ filters/                   # lọc/tổng hợp thuần, không phụ thuộc UI
│     └─ format/                    # format thuần có locale rõ ràng
├─ ml-artifacts/                    # model ONNX + manifest; registry nếu artifact lớn
├─ db/{migrations,seeds}/
├─ mocks/                           # fixtures theo response API, không trộn trong UI
├─ prototype/                       # bản HTML chuẩn giao diện, chỉ tham khảo
├─ docs/{api-contract.md,web-architecture.md}
├─ openapi.yaml                     # hợp đồng máy đọc, sinh/kiểm tra client contract
├─ docker-compose.yml
└─ package.json                     # workspace scripts và cấu hình lint/typecheck
```

Nếu cần giữ các thư mục SDD hiện tại (`web/`, `ml/`, `etl/`), có thể giữ tên cấp cao nhưng chuyển ETL/worker sang JavaScript và inference sang ONNX Runtime JS. Hiện workspace cung cấp có HTML prototype, chưa thấy repository mã nguồn ứng dụng; cấu trúc này là đích triển khai chứ không khẳng định các thư mục đã tồn tại.

## 4. Cấu trúc feature web

Mỗi feature sở hữu trang, thành phần chỉ dùng trong feature, hook và truy vấn của miền đó. Không đặt một `api.js` liệt kê lại endpoint; đặt query/mutation theo use-case, gọi API client theo OpenAPI contract.

```text
features/
├─ auth/                   # login, logout, change/forgot/reset password
├─ market-overview/        # market strip, changed today, symbol table, filters
├─ symbols/                # symbol detail + forecast/news/history/audit tabs
├─ watchlist/              # symbols, alert rules/history, in-app notifications
├─ screener/               # filters, saved screens
├─ portfolio/              # transactions, CSV preview/import, overview
├─ plans/                  # create/calc/status/close; immutable forecast snapshot
├─ journal/                # entries, filters, stats
├─ chat/                   # sessions, messages, citations, safety states
├─ model-evaluation/       # summary, confusion matrix, reliability, ablation
├─ administration/         # users, jobs, models, audit, ops, notification/chat logs
├─ reports/                # PDF download flows
└─ settings/               # profile, channels, password
```

Mỗi feature có thể dùng cấu trúc:

```text
<feature>/
  pages/                   # route-level composition, lazy loaded
  components/              # chỉ dùng trong feature
  queries.js               # query keys + GET calls/useQuery
  mutations.js             # write calls + invalidation
  model.js                 # UI view-model/adapters; JSDoc cho public shape
  index.js                 # public exports được phép dùng ngoài feature
```

Quy tắc import: feature có thể dùng `components/`, `packages/core` và API client; feature không import file nội bộ của feature khác. Nếu cần chia sẻ use-case/data, trích xuất hàm ở tầng API/domain phù hợp. Component chung chỉ chứa trình bày; không tự gọi endpoint ngầm.

## 5. Routes và điều hướng

`PageId` và menu không nên đặt cùng một cấu hình trong `core`: route là trách nhiệm web, còn `core/access` chỉ cung cấp role/capability trung lập. Web định nghĩa route registry với `path`, `pageId`, `lazy component`, `requiredCapability`, `phase` và `shell`. Router sinh từ registry này; menu lọc cùng registry nhưng server vẫn xác minh quyền.

| Nhóm | Route gợi ý | Quyền chính |
|---|---|---|
| Xác thực | `/login`, `/forgot-password`, `/reset-password`, `/change-password` | Công khai hoặc phiên hợp lệ theo flow |
| Tổng quan | `/overview` | retail, trader, analyst |
| Mã cổ phiếu | `/symbols/:symbol`, tab `forecast/news/history/audit` | retail/trader; analyst audit/inputs/replay |
| Theo dõi | `/watchlist`, `/alerts` | retail, trader, analyst |
| Đánh giá mô hình | `/evaluation` | analyst, admin; phần summary dùng chung theo API |
| Screener | `/screener` | GĐ2; lưu bộ lọc trader/analyst |
| Danh mục | `/portfolio` | GĐ2; overview nâng cao trader/analyst |
| Trade Plan | `/plans`, `/plans/:id` | GĐ2; retail form rút gọn |
| Journal | `/journal`, `/journal/:id` | GĐ2; thống kê/ghi thủ công theo SDD |
| Chat và báo cáo | `/chat`, `/reports` | GĐ2; quyền từng báo cáo theo endpoint |
| Quản trị | `/admin/users`, `/admin/jobs`, `/admin/models`, `/admin/audit`, `/admin/notifications`, `/admin/chat-log` | admin; log chat analyst/admin với che dữ liệu cá nhân |
| Cài đặt | `/settings/investment`, `/settings/notifications`, `/settings/password` | phiên hiện tại; field/kênh theo role và giai đoạn |

Guard chung: `PublicOnly`, `Authenticated`, `MustChangePassword`, `RequireCapability`, `FeaturePhase`. Loading session không được nhầm với unauthenticated; 401 xóa trạng thái phiên và đưa về login, 403 hiển thị trang không đủ quyền, 404 riêng. Trạng thái giai đoạn chỉ ẩn/chặn UI; backend phải bật/tắt endpoint tương ứng.

## 6. Ranh giới API và sở hữu dữ liệu

Client dùng một lớp HTTP duy nhất. `client.js` chịu trách nhiệm base URL, cookie credentials, timeout, parse response, chuẩn hóa lỗi và xử lý 401 một lần. Không retry mutation tự động. API Node.js kiểm tra request/response bằng JSON Schema; chọn mock/thật tại adapter/provider theo cấu hình môi trường, không rải `if (mock)` trong component.

| Miền web | Endpoint SDD chủ yếu | Nguồn dữ liệu/ghi |
|---|---|---|
| Auth/session | `/auth/*`, `/me` | Node.js auth service; session/token bảo vệ riêng |
| Market/symbols | `/market/*`, `/symbols*` | Read model `v_overview`, prices, forecast, news, sentiment |
| History/evaluation | `/symbols/{sym}/history*`, `/models/*`, `/forecasts/{id}/audit|inputs|replays` | forecast immutable, model_run, replay; analyst/admin có giới hạn |
| Watchlist/alerts | `/watchlist*`, `/alert-rules*`, `/alerts*` | dữ liệu user theo owner; cảnh báo tạo bởi worker |
| Screener | `/screener*` | `v_screener`; saved screens theo user |
| Portfolio | `/portfolio*` | `portfolio_tx`; API tính position/P&L, ownership + RLS |
| Plans | `/plans*` | `trade_plan`; snapshot forecast bất biến, close tạo journal transactionally |
| Journal | `/journal*` | `journal_entry`; chỉ chủ sở hữu, trừu tượng hóa không cho admin đọc |
| Chat | `/chat/*`, `/admin/chat-log` | API gọi chat nội bộ; log cá nhân được che |
| Notifications/settings | `/notify/*`, `/me/profile` | channels, notification và profile theo user |
| Admin/operations | `/admin/*`, `/admin/ops-events` | admin-only; audit append-only; không trả nội dung dữ liệu cá nhân |
| Reports | `/reports/*` | tái dùng truy vấn màn hình; user_id lấy từ phiên |

Mẫu response thống nhất: `{ data, meta? }`; lỗi: `{ error: { code, message, fields?, request_id } }`. Phân biệt `401` (không có phiên/phiên hết hạn), `403` (đã xác thực nhưng thiếu quyền), `404`, `409` (xung đột/giới hạn), `422` (validation), `429`, `5xx`. Không đưa stack trace hoặc secrets vào trình duyệt.

Contract cho lát cắt đầu tiên (được mock trong `mocks/market.js`; ngày giờ truyền bằng ISO-8601, frontend hiển thị `Asia/Ho_Chi_Minh`):

Hợp đồng máy đọc được cho lát cắt này nằm tại `openapi.yaml`; không tạo contract endpoint thứ hai trong API package.

### Trạng thái backend và PostgreSQL

API bootstrap tại `apps/api/src/server.js` dùng repository interface: fixture khi không có `DATABASE_URL`, PostgreSQL khi có `DATABASE_URL`. Migration ban đầu ở `db/migrations/001_initial_schema.sql`; runner tại `db/migrate.js` ghi checksum để migration đã áp dụng không bị sửa âm thầm. `db/seed-demo.js` nạp dữ liệu minh họa có thể chạy lặp lại. Các endpoint market, symbols, prices và news đọc repository PostgreSQL khi cấu hình DB. Cùng chế độ đó, login kiểm tra hash mật khẩu trong `users`, tạo session ngẫu nhiên và chỉ lưu SHA-256 token hash trong `auth_sessions`; fixture mode vẫn dùng user/session trong bộ nhớ.

Các bảng nền gồm `users`, `auth_sessions`, `symbols`, `market_batches`, `market_indices`, `market_summary`, `forecasts`, `daily_prices`, `news_items`; migration `003_ingestion_runs.sql` thêm nhật ký đồng bộ nguồn. Auth dùng `scrypt`, khóa đăng nhập sau 8 lần sai trong 15 phút, session hết hạn sau 8 giờ và logout thu hồi session. Worker JavaScript tại `apps/worker` port luồng OHLCV SSI trong ETL của web cũ, upsert `daily_prices` cho symbols bật trong DB và ghi trạng thái từng lần chạy vào `data_ingestion_runs`. CafeF intraday feed không được dùng thay cho OHLCV ngày. Self-service khôi phục mật khẩu có feature flag; email verification hiện chỉ áp dụng cho kênh thông báo. Forecast vẫn được nạp bằng demo seeder tới khi feature generation và ONNX inference được triển khai. API từ chối `NODE_ENV=production` khi còn demo accounts/data.

Quản trị tài khoản được nối qua `GET/POST /admin/users`, `PATCH /admin/users/{userId}`, `POST /admin/users/{userId}/reset-password|revoke-sessions`, và `GET /admin/audit`. API chặn tự khóa/tự đổi vai trò, không cho vô hiệu hóa quản trị viên hoạt động cuối, thu hồi session sau đổi vai trò/trạng thái, và ghi audit trong cùng transaction. Tạo mới/reset trả mật khẩu tạm một lần; user bị chặn khỏi route nghiệp vụ đến khi đổi mật khẩu tại `/auth/change-password`. Trang web có `/admin/users` và `/settings/password`.

Self-service quên và đặt lại mật khẩu có `POST /auth/forgot-password` và `POST /auth/reset-password`, bật bằng `PASSWORD_RESET_ENABLED=true` sau khi cấu hình SMTP, `PUBLIC_APP_URL` (origin HTTPS trong production), `AUTH_RATE_LIMIT_SECRET` (ít nhất 32 ký tự ngẫu nhiên) và `VITE_PASSWORD_RESET_ENABLED=true`. Phản hồi quên mật khẩu luôn chung cho email có/không có tài khoản. Token nằm trong URL fragment, chỉ lưu dạng hash trong DB, hết hạn 30 phút và dùng một lần; giới hạn 3 yêu cầu/email và 10 yêu cầu/IP mỗi giờ. Đổi mật khẩu thu hồi mọi session và ghi audit event không chứa token. Migration `015_password_reset.sql` tạo bảng token và rate-limit.

```text
GET  /api/v1/me
  data: { user: { id, email, role, must_change_password } }

POST /api/v1/auth/login { email, password }
  data: { user: { id, email, role, must_change_password } }

POST /api/v1/auth/logout
  204 hoặc data rỗng

GET /api/v1/market/status
  data: { dataDate, batchCompletedAt, modelVersion, state, sourceStatus }

GET /api/v1/market/summary
  data: { indices: [{ code, label, value, changePoints, changePercent }],
          breadth: { advances, nochanges, declines },
          labelDistribution: { up, hold, down } }

GET /api/v1/symbols
  data: { total, items: [{ symbol, name, exchange, closePrice, changePercent,
          averageTurnover20d, dataStatus,
          forecasts: { t2, t5 } }] }
  t2/t5: { label: 'up'|'hold'|'down',
           probabilities: { up, hold, down }, confidence: 'low'|'mid'|'high' }
```

`GET /symbols` chỉ được gọi nếu capability `symbols.read` có mặt; Admin ở lát cắt đầu chỉ lấy status và summary. Đây là contract web cho khởi tạo; endpoint nghiệp vụ còn lại vẫn theo SDD và cần được bổ sung vào OpenAPI khi implement.

#### Contract cho trang chi tiết mã (lát cắt tiếp theo)

```text
GET /api/v1/symbols/{symbol}
  capability: symbols.read
  data: { symbol, name, exchange, closePrice, changePercent, averageTurnover20d,
          dataStatus, forecasts: { t2, t5 } }

GET /api/v1/symbols/{symbol}/prices?range=3m
  capability: history.read
  data: { symbol, currency: 'VND', interval: '1d', items: [{ date: 'YYYY-MM-DD', close }] }

GET /api/v1/symbols/{symbol}/news
  capability: news.read
  data: { items: [{ id, title, summary, source, publishedAt, sentiment, url }] }
  url có thể null nếu là bản ghi preview; publishedAt dùng ISO-8601.
```

Web hiện bật hai tab Dự báo và Tin tức; Lịch sử và Phân tích mô hình đang để trạng thái sắp có. UI gọi ba resource chi tiết từ API client; backend phải tự kiểm tra capability `symbols.read`, `history.read`, `news.read`. Guard phía web chỉ hỗ trợ điều hướng, không thay kiểm tra quyền trên API.

Mock phải có cùng shape/nhãn/trạng thái rỗng/lỗi với API thật và đọc fixture ở `mocks/`. Các thao tác cá nhân giả lập trong memory chỉ phục vụ demo; không mô phỏng mock như lưu bền vững.

### 6.1 API đọc được từ web cũ

ZIP `Web mẫu để lấy API.zip` chứa ứng dụng `DATN_2026-main`. API hiện tại được đăng ký trong `cmd/server/main.go`; đây là Go server cũ. Khi chuyển sang kiến trúc JavaScript, **port hành vi và adapter nguồn dữ liệu cần dùng**, không kết nối web mới vào Go server cũ và không đưa endpoint cũ vào `/api/v1` nguyên trạng. Các endpoint đích dưới đây được phục vụ bởi Node.js.

| API cũ | Request và response đã quan sát | Cách dùng trong web mới |
|---|---|---|
| `GET /api/groups` | Không tham số. Trả object map tên nhóm (`HOSE`, `HNX`, `UPCOM`, `VN30`, `VN100`, `HNX30`) sang `{ center, syms? }`. `center` là mã feed CafeF (`1`, `2`, `9`); `syms` là danh sách mã rổ. | Port danh sách sàn/rổ sang cấu hình server-side hoặc `GET /api/v1/market/groups` nếu giao diện cần chọn rổ. Không để UI phụ thuộc mã feed CafeF. Kiểm tra và cập nhật thành viên rổ trước khi dùng vì source ghi rõ rổ được cập nhật thủ công và có thể thiếu mã. |
| `GET /api/index?id=VNINDEX\|VN30\|HNX\|HNX30\|UPCOM` | Mặc định `VNINDEX`; id không biết trả 400. Response `{ snap, c }`. `snap`: `label`, `indexValue`, `prevIndexValue`, `change`, `changePercent`, `allQty`, `allValue`, `advances`, `nochanges`, `declines`, `ceiling`, `floor`. `c` là mảng giá intraday hôm nay. Cache in-memory khoảng 5 giây cho chỉ số, 3 giây cho feed; upstream CafeF + EnTrade. | Dùng làm nguồn đầu vào cho `GET /api/v1/market/summary` (dải chỉ số/thị trường) hoặc một endpoint chỉ số nếu cần phân trang/cập nhật độc lập. API Node chuẩn hóa thời điểm và lỗi nguồn; giữ cache theo feed để tránh 5 thẻ nhân số request. Đây là dữ liệu thị trường trực tiếp, không phải forecast. |
| Bảng giá trong `web/board.js` | **Không gọi endpoint `/api/board`**. Browser gọi thẳng `https://banggia.cafef.vn/stockhandler.ashx?center=...`, poll trực tiếp, tự lọc rổ, tính breadth và dựng bảng. | Không giữ luồng browser → CafeF trong web mới. Tạo adapter Node phía server lấy feed, cache, kiểm tra schema và trả DTO nội bộ. Chỉ hiển thị giá/khối lượng nguồn cũ như dữ liệu thị trường; forecast phải đọc endpoint forecast của hệ thống. |
| `GET /api/news?cat=CHUNG-KHOAN` | `cat` mặc định `CHUNG-KHOAN`; whitelist: `CHUNG-KHOAN`, `BAT-DONG-SAN`, `DOANH-NGHIEP`, `NGAN-HANG`, `VI-MO`, `HANG-HOA`, `QUOC-TE`. Trả mảng `{ url, title, img, time, sapo, cat, syms[] }`; CafeF scrape + một số RSS VnExpress; cache 1 phút. `?sym=FPT` trả tin đã gắn mã qua title/sapo, loại trùng URL; lỗi từng category được bỏ qua. | Port parser/source adapter sang `apps/worker` hoặc một server-side news service. Dùng API đích `GET /api/v1/symbols/{sym}/news` như SDD, map `img` nếu UI cần; sentiment và confidence phải lấy từ dữ liệu ML của hệ thống, không tự suy diễn từ tag mã. Whitelist category và validate symbol ở API. |
| `GET /api/article?p=...` | Nhận `p` là path CafeF hoặc URL VnExpress theo regex cho phép; trả `{ title, author, date, sapo, content, source }`; HTML content đã sanitize; cache 1 giờ. Path sai trả 400, nguồn lỗi/layout đổi trả 502. | Chỉ port nếu giao diện mới cần trang đọc nội dung đầy đủ. Ưu tiên trả metadata và URL nguồn; nếu proxy nội dung, sanitize HTML ở server và whitelist host/path để tránh SSRF. Đây là endpoint proxy nội dung, không phải API dự báo. |
| `GET /api/docs/terms?type=BCTC` | `type` mặc định `BCTC`; loại: `BCTC`, `GIAI-TRINH`, `QUAN-TRI`, `THUONG-NIEN`, `NGHI-QUYET`, `DHCD`. Trả `[{ year, id, name }]`, cache 6 giờ; Node adapter cần giữ phiên cookie + anti-forgery token upstream Vietstock. | Chức năng bổ sung ngoài màn hình cốt lõi PRD. Nếu giữ, dùng endpoint `/api/v1/symbols/{sym}/documents/terms?type=...` hoặc `/api/v1/documents/terms`; không nhầm với tài chính đã dùng làm input model. |
| `GET /api/docs?type=BCTC&ex=HOSE&sym=HPG&year=2026&term=3&page=1` | `type` như trên; `ex` là rỗng/`HOSE`/`HNX`/`UPCOM`/`OTC`; `sym` tùy chọn, regex 3 ký tự; page giới hạn 1–1000; 20 mục/trang. Trả `{ term, page, per, total, items, terms }`; item `{ sym, exchange, company, title, url, ext, time }`. Lấy từ Vietstock, tự chọn kỳ gần nhất nếu thiếu year/term. | Chỉ triển khai khi đã quyết định đưa thư viện tài liệu lên roadmap. Cache, validate query, giữ credential/token Vietstock ở server và có timeout/rate limit. Không đưa cookie upstream ra browser. |

API cũ trả lỗi qua `{ error: "..." }` và một số lỗi upstream có thể chứa chi tiết nội bộ. API mới cần chuyển thành error envelope thống nhất, log nguyên nhân ở server cùng `request_id`, chỉ trả thông điệp an toàn. Cache cũ là in-memory theo process: khi chạy nhiều replica sẽ không chia sẻ; bản mới nên bắt đầu bằng cache adapter có TTL + stale-if-error, sau đó chuyển Redis nếu cần scale. Không xem dữ liệu crawl là nguồn đảm bảo SLA; API trả freshness/source status để UI biểu thị nguồn cũ hoặc stale.

### 6.2 Chuyển đổi hợp đồng sang API mới

| Contract đích | Nguồn cũ/tình trạng | Ghi chú triển khai |
|---|---|---|
| `GET /api/v1/market/status` | Chưa có tương đương chính xác | Trả ngày dữ liệu forecast, thời điểm batch và model version theo SDD; không lấy giờ poll CafeF làm giờ batch dự báo. |
| `GET /api/v1/market/summary` | Ghép một phần từ `/api/index?id=...` | Trả index snapshots + breadth. Giữ DTO mới, không cho client biết cấu trúc CafeF/EnTrade. SDD có VN-Index/HNX-Index; có thể bổ sung UPCOM/VN30 khi UI yêu cầu. |
| `GET /api/v1/market/groups` | Port `/api/groups` (cần xác nhận có UI dùng) | Chỉ danh sách mã/rổ/sàn đã chuẩn hóa; bỏ `center` nội bộ upstream khỏi response công khai. |
| `GET /api/v1/symbols` | Một phần có thể lấy mã từ `Symbols()`/feed CafeF; contract forecast chưa tồn tại | Universe cho dashboard phải đọc company/universe được cấu hình trong DB (tối thiểu 15 mã theo SDD/PRD), sau đó join forecast mới nhất. Không lấy toàn bộ tickers CafeF thành vũ trụ dự báo. |
| `GET /api/v1/symbols/{sym}/prices` | Có dữ liệu bảng giá intraday qua browser; chưa có API OHLCV lịch sử phù hợp | Cần xây adapter/cache và lưu daily history vào DB qua worker; endpoint chart đọc lịch sử chuẩn hóa. Không dùng trường `c` intraday thay cho OHLCV lịch sử. |
| `GET /api/v1/symbols/{sym}/news` | Port `/api/news?sym=...` | Gắn thêm sentiment từ bảng `sentiment`/`sentiment_daily` và freshness, theo SDD. |
| `GET /api/v1/symbols/{sym}/documents` | Port tùy chọn `/api/docs*` | Tách khỏi news; chức năng tài liệu Vietstock chưa được liệt kê rõ trong màn hình/endpoint SDD nên phải xác nhận scope trước khi triển khai. |
| Forecast, auth, watchlist, alerts, portfolio, plans, journal, evaluation, admin, chat, reports | Chưa có trong ZIP | Đây là API mới theo endpoint inventory và schema trong SDD; phải xây trong Node.js, không giả lập rằng ZIP đã cung cấp. |

Adapter upstream nên implement interface theo nguồn, ví dụ `MarketFeedProvider`, `NewsProvider`, `CompanyDocumentsProvider`; service nghiệp vụ chuyển provider data thành DTO nội bộ. UI và domain handlers chỉ phụ thuộc DTO, không phụ thuộc HTML CafeF, tên trường một chữ cái (`a`, `c`, `k`) hay cookie Vietstock. Đặt timeout, retry có giới hạn, concurrency cap, cache, schema validation và telemetry ở adapter. Không để retry lặp ngoài adapter và API cùng lúc.

## 7. UI shared components và quy tắc dữ liệu

Component dùng nhiều feature: `ForecastLabel`, `ProbabilityBars`, `ConfidenceMeter`, `DataStatus`, `Disclaimer`, `EmptyState`, `ErrorState`, `LoadingSkeleton`, `Pagination`, `DateRange`, `ConfirmDialog`. Chart components nằm dưới `components/charts/`, nhận props theo contract chung và không tự fetch. `ForecastCard`, `ReasonsList`, `RiskNotes`, `FeatureContribution`, `ReplayPanel` thuộc feature `symbols` vì chỉ phục vụ chi tiết mã.

- Dùng nhãn hiển thị **Tăng / Đi ngang / Giảm**; không hiển thị `hold` thành “Giữ”.
- Hiện ngày dữ liệu, thời điểm batch và model version khi API cung cấp; trạng thái stale/missing phải là trạng thái rõ, không thay bằng số giả.
- Xác suất được render từ response; không tự tính lại nhãn dự báo trong trình duyệt.
- R:R có thể preview từ `packages/core`, nhưng Node.js API là nguồn xác nhận cuối; dùng decimal library hoặc biểu diễn số nguyên phù hợp tiền/tick, không dựa vào phép tính floating point không kiểm soát.
- Disclaimer hiển thị trên các vùng forecast, Trade Plan, Chat, PDF theo yêu cầu sản phẩm.
- Ngày giờ API lưu UTC; giao diện hiển thị theo `Asia/Ho_Chi_Minh`.
- Không hard-code danh sách mã 17 mẫu như dữ liệu thật: PRD/SDD đặt universe tối thiểu 15 mã và watchlist tối đa 10 mã/người. Fixture mẫu phải ghi rõ nguồn và trạng thái demo.

## 8. Vai trò và quyền

Backend Node.js là nguồn chân lý của RBAC và ownership. Frontend dùng capability map để menu/route/form tương ứng, ví dụ `evaluation.read`, `forecast.audit`, `portfolio.import`, `plans.calculate_quantity`, `admin.users.manage`. Quyền không đồng nhất với vai trò nếu sau này có ngoại lệ. Không gửi `user_id` từ client để xác định chủ sở hữu; API lấy từ session/JWT. Analyst/Admin có thể xem audit đầu vào dự báo theo SDD nhưng không có quyền đọc nội dung danh mục/kế hoạch/nhật ký của user. Ma trận route, field và endpoint chi tiết nằm trong mục 12.

## 9. Giai đoạn và thứ tự triển khai

**GĐ1:** auth, overview, symbol detail (forecast/explanation/news/history), watchlist/in-app alerts, model summary/evaluation, audit/admin jobs/models, batch status. Chốt mock/API contract và migrations trước khi nối dữ liệu thật.

**GĐ2:** screener, portfolio, plans, journal, chat an toàn, PDF, email/Telegram, confidence/risk notes và market strip theo PRD. Bật từng miền khi endpoint và schema tương ứng đã triển khai.

**GĐ3:** React Native dùng cùng API và core; không đưa logic route hoặc UI web vào core.

Thứ tự phụ thuộc để backend dễ xây: (1) OpenAPI + error/auth conventions, (2) schema/migrations + seed demo, (3) read-only market/forecast endpoints, (4) auth/RBAC/ownership và watchlist, (5) admin/job visibility, (6) các transaction GĐ2 (portfolio → plan close+journal), (7) integrations chat/notifier/PDF, (8) mobile client.

## 10. Các điểm cần xử lý giữa tài liệu trước khi đóng hợp đồng

1. SDD ghi labels Tăng/Đi ngang/Giảm theo PRD; Brief cũ còn tăng/giữ/giảm. Dùng PRD/SDD làm chuẩn và cập nhật Brief.
2. PRD phần ưu tiên gộp một số chức năng M6/M7, còn bản đồ feature frontend đặt `evaluation` và `admin` riêng. Đây là cách tổ chức hợp lý theo miền; cần giữ ID M trong ma trận truy vết, không tạo feature trùng.
3. Tài liệu có chỗ khác nhau về Must/Should của alert trong app và replay/inputs; SDD mục 12.3 nêu cách đang diễn giải. Khi viết OpenAPI cần chốt phạm vi release, nhưng không thay đổi quyền/chính sách dữ liệu.
4. Chốt các điểm đang được SDD đánh dấu cần xác nhận: ngưỡng confidence 55%, quy tắc alignment Journal, chính sách khôi phục mật khẩu email và việc bật Chat/API LLM ngoài. Có thể triển khai endpoint theo schema nhưng cấu hình hành vi phải rõ trước khi phát hành.
5. SDD là thiết kế, không phải bằng chứng schema/migration đã chạy. Đối chiếu `db/schema.sql` và mã hiện hữu trước khi áp dụng migration, đặc biệt RLS, trigger bất biến snapshot, role DB và seed demo.

## 11. Kết luận áp dụng cho cấu trúc frontend ban đầu

Giữ các miền `auth`, `overview`, `symbol-detail`, `watchlist`, `screener`, `portfolio`, `plans`, `journal`, `chat`, `evaluation`, `admin`, `settings`; bổ sung `reports`, tách tên `market-overview` và `symbols` nếu cần rõ sở hữu; chuyển endpoint thành API client trung tâm được kiểm tra bằng contract; chuyển `roles (menu + RBAC + giai đoạn)` thành metadata route/capability ở web và capability thuần ở core. `PAGES` trong core chỉ nên là ID/metadata trung lập nếu web/mobile thực sự cần chia sẻ, không sinh component route từ core. Đây là cấu trúc để frontend có thể phát triển độc lập với backend mà vẫn giữ hợp đồng và quyền nhất quán.

## 12. Ma trận phân quyền web

**Nguồn đối chiếu:** PRD v0.0.3, SDD v0.0.4 (ưu tiên bảng FR mục 10, endpoint mục 8.1 và màn hình mục 8.2), Project Brief v0.0.3.  
**Dùng cho:** route registry, menu, nút/form, trạng thái read-only và xử lý 401/403 ở web. Đây là ma trận UI; API Node.js vẫn là nơi thực thi quyền cuối cùng.

### 12.1 Quy tắc nền

- Có bốn role: `retail`, `trader`, `analyst`, `admin`. Không tạo vai trò hệ thống thứ năm cho hội đồng chấm đồ án; họ dùng tài khoản demo có role `analyst`.
- Không giả định role là cấp bậc kế thừa. `admin` có quyền quản trị vận hành nhưng **không** mặc nhiên có quyền đọc dữ liệu riêng của người dùng.
- Mỗi người chỉ đọc/sửa dữ liệu cá nhân của chính mình: watchlist, alert rules, notifications, profile, portfolio, plans, journal, chat. `userId` luôn lấy từ phiên trên server, không lấy từ params/body do browser gửi.
- User đã đăng nhập nhưng thiếu quyền: API trả `403`. Khi user A đoán ID tài nguyên riêng của user B, API trả `404` để không tiết lộ tài nguyên tồn tại; kiểm tra riêng theo AC-26/NFR-08. Admin truy cập dữ liệu portfolio/plan/journal của user phải bị từ chối (`403`).
- Phân quyền trên web chỉ quyết định route/menu/nút/field và cải thiện UX. Ẩn nút hoặc chặn route không thay thế middleware kiểm quyền, kiểm owner, hoặc RLS.
- Trạng thái tài khoản bị khóa, phiên hết hạn/thu hồi hoặc tài khoản đổi role phải làm phiên hiện tại mất hiệu lực như SDD. Web gọi `GET /me` khi khởi động và xử lý mọi response 401/403 theo quy tắc ở mục 6.

### 12.2 Ma trận màn hình và thao tác

Ký hiệu: **Xem** = mở trang/đọc; **Sửa** = thao tác dữ liệu cá nhân của chính user; **Hạn chế** = chỉ các thao tác/chi tiết nêu ở cột ghi chú; `—` = không hiển thị/không gọi endpoint. Mốc GĐ2/GĐ3 vẫn phải được feature flag bật.

| Màn hình / chức năng | Retail | Trader | Analyst | Admin | Giai đoạn và giới hạn |
|---|---:|---:|---:|---:|---|
| Đăng nhập, đăng xuất, `/me`, đổi mật khẩu | X | X | X | X | GĐ1. Forgot/reset qua email theo FR-M0-07/AC-30; flow reset Admin bắt đổi mật khẩu. |
| Tổng quan thị trường: status, market summary | X | X | X | X | Status/summary endpoint ghi “tất cả”. Admin có thể vào trang tổng quan rút gọn. |
| Danh sách mã, bộ lọc tổng quan, tín hiệu đổi | X | X | X | — | `GET /symbols` và `/symbols?changed=1` chỉ R/T/A theo SDD. |
| Chi tiết mã: dự báo, chart, giá, ngày dữ liệu, disclaimer | X | X | X | — | GĐ1; forecast T+2/T+5 cùng API, server cắt phần giải thích theo role. |
| Giải thích dự báo | Bản đơn giản | Bản thường + hit rate | Chi tiết | — | Retail nhận 3 câu dễ hiểu; Trader thêm thông tin theo FR/SDD; Analyst xem top 15 đặc trưng, giá trị và attention. Không expose trường analyst bằng cách chỉ ẩn CSS. |
| Tin và cảm xúc theo mã | X | X | X | — | GĐ1; mức ảnh hưởng tương đối của tin là phần bổ sung Trader/Analyst khi có dữ liệu. |
| Lịch sử dự báo theo mã, hit rate | X | X | X | — | Endpoint lịch sử R/T/A; mọi hit rate đi cùng `n`, baseline và cờ mẫu nhỏ. |
| Xuất CSV lịch sử dự báo | — | — | Có thể bật | — | `GET /symbols/{sym}/history.csv` Analyst; Should theo PRD, bật đúng release flag. |
| Audit dự báo / đầu vào snapshot / replay | — | — | Xem + yêu cầu replay | Xem + yêu cầu replay | GĐ1 theo SDD. Analyst/Admin được phép; replay async 202/poll, không sửa forecast gốc. |
| Watchlist | Xem/sửa của mình | Xem/sửa của mình | Xem/sửa của mình | — | Tối đa 10 mã mỗi user; ghi chú theo SDD. Admin không thao tác thay user. |
| Cảnh báo trong app: rules, lịch sử, đã đọc | Xem/sửa của mình | Xem/sửa của mình | Xem/sửa của mình | — | SDD/FR table cho R/T/A (Must GĐ1 theo cách SDD giải quyết mâu thuẫn). Chỉ thấy cảnh báo của chính mình. |
| Kênh email/Telegram | Xem/sửa lựa chọn của mình | Xem/sửa lựa chọn của mình | Xem/sửa lựa chọn của mình | — | GĐ2; preferences `012`, verification `013`, outbox `014`; dispatch qua notifier worker, chỉ kênh đã bật/xác minh. |
| Screener: dùng bộ lọc có sẵn | X | X | X | — | GĐ2. Retail không lưu bộ lọc riêng. |
| Screener: lọc nâng cao / lưu bộ lọc | — | X | X | — | GĐ2; tối đa 20 bộ lọc đã lưu/user. Quyền lưu theo FR-M8-04/SDD. |
| Portfolio: giao dịch, vị thế, P&L | Xem/sửa của mình | Xem/sửa của mình | Xem/sửa của mình | — | GĐ2. Xóa toàn bộ chỉ dữ liệu của chính user; xác nhận mạnh trước destructive action. |
| Portfolio: import CSV | — | Xem trước + import | Xem trước + import | — | GĐ2; CSV hai bước, validate từng dòng, chỉ T/A. |
| Portfolio: overview nâng cao/giá trị theo thời gian | — | Xem của mình | Xem của mình | — | GĐ2 theo endpoint và FR-M9-05 (Should). |
| Trade Plan | Form rút gọn, dữ liệu của mình | Đầy đủ, dữ liệu của mình | Đầy đủ, dữ liệu của mình | — | GĐ2. Mọi user tự nhập thông số và xem R:R; retail không được nhập vốn/rủi ro hay nhận khối lượng tối đa. Snapshot dự báo chỉ đọc. |
| Trade Plan: cảnh báo/chuyển trạng thái/đóng | Sửa của mình | Sửa của mình | Sửa của mình | — | GĐ2. User xác nhận đổi trạng thái; đóng yêu cầu giá thoát/ghi chú và tạo Journal cùng transaction. Không có delete plan theo SDD. |
| Investment profile (vốn, mức rủi ro) | — | Xem/sửa của mình | Xem/sửa của mình | — | GĐ2; UI `/settings/investment`, API `GET/PUT /me/profile`; Retail và Admin nhận 403 nếu gọi API. Plan chỉ dùng profile khi user chủ động chọn. |
| Journal: xem/sửa ghi chú, tags, lessons | Xem/sửa của mình | Xem/sửa của mình | Xem/sửa của mình | — | GĐ2; snapshot/kết quả không sửa được; admin tuyệt đối không đọc nội dung. |
| Journal: ghi thủ công | — | Có thể bật | Có thể bật | — | GĐ2 theo FR-M11-04/SDD (Should). Tài liệu màn hình SDD gộp “ghi thủ công” với phần Trader/Analyst; mặc định khóa cho Retail đến khi chủ sản phẩm chốt. |
| Journal: thống kê / PDF Journal | — | Xem/xuất của mình | Xem/xuất của mình | — | GĐ2; Should theo FR-M11-06 và FR-M13-04. |
| Chat hỏi đáp | Dùng phiên của mình | Dùng phiên của mình | Dùng phiên của mình | — | GĐ2; UI `/chat`, API `/chat/sessions*`; session/message chỉ theo owner. Không tư vấn mua/bán. Khi model hoặc safety pipeline chưa sẵn sàng, trả 503 và không lưu prompt. |
| Chat log | — | — | Xem log đã che | Xem log đã che | GĐ2. Analyst/Admin không được xem nội dung lượt hỏi gắn dữ liệu cá nhân; log có retention theo policy. |
| PDF báo cáo mã | Xem/xuất | Xem/xuất | Xem/xuất | — | GĐ2; chỉ dữ liệu công khai/forecast của mã. |
| PDF Portfolio / Trade Plan | Xem/xuất của mình | Xem/xuất của mình | Xem/xuất của mình | — | GĐ2; lấy owner từ session. |
| PDF Journal | — | Xem/xuất của mình | Xem/xuất của mình | — | GĐ2, Should; theo SDD/API. |
| Model summary (bản tóm tắt) | Xem | Xem | Xem | Xem | SDD endpoint cho mọi role. |
| Model evaluation chi tiết | — | — | Xem | Xem | GĐ1 cho metrics/confusion/ablation; reliability/Brier/ECE GĐ2 theo SDD. |
| Model versions (read-only) | — | — | Xem | Xem | Analyst chỉ xem danh sách; không serve/rollback. |
| Admin: users/roles/lock/reset/revoke | — | — | — | Xem/sửa | GĐ1; chặn khóa/hạ quyền Admin hoạt động cuối; mọi thay đổi audit. |
| Admin: jobs/sources/re-run | — | — | — | Xem/yêu cầu chạy | GĐ1; chạy lại chỉ enqueue job, không chạy model đồng bộ trong request. |
| Admin: serve/rollback model | — | — | — | Xem/thao tác | Should theo PRD; chỉ model qua gate và còn checkpoint. Có hiệu lực batch kế tiếp. |
| Admin audit log | — | — | — | Xem | GĐ1; append-only, phân trang/lọc; UI không có sửa/xóa. |
| Admin notification delivery log | — | — | — | Xem | Tổng hợp trạng thái/kênh, không có nội dung thông báo. |
| Admin ops events | — | — | — | Xem | Lỗi pipeline/drift; không trả dữ liệu Portfolio/Plan/Journal. |
| Mobile app | Theo quyền web của role | Theo quyền web của role | Theo quyền web của role | Theo quyền web của role | GĐ3; cùng API và ma trận; mobile không tạo quyền khác. |

#### Nguyên tắc diễn giải

- `Tất cả` trong endpoint xác thực/mật khẩu/summary có nghĩa tất cả role phù hợp, không có nghĩa endpoint dữ liệu người dùng được mở cho Admin.
- Trong endpoint private, role cho phép chỉ là điều kiện đầu tiên; bắt buộc kiểm tra quyền sở hữu. Không dùng quyền Admin để vượt owner check.
- Với endpoint có ghi chú giới hạn, UI phải khớp chính xác: ẩn controls không được phép, disable khi đang loading, và xử lý `403` nếu phiên bản frontend bị cũ hoặc có request trực tiếp.
- `Admin` được vào summary/evaluation vì SDD cấp quyền, nhưng không có endpoint `/symbols` trong bảng SDD; do đó không hiện menu mã/dự báo chung cho Admin theo ma trận này.

### 12.3 Capability map cho frontend JavaScript

Không dùng phép so sánh kiểu `role >= analyst`. Dùng capability rõ ràng. Mảng role trong web là để hiển thị/điều hướng; backend vẫn map quyền và kiểm tra từng endpoint.

```js
export const ROLE = Object.freeze({
  RETAIL: 'retail',
  TRADER: 'trader',
  ANALYST: 'analyst',
  ADMIN: 'admin',
});

export const ROLE_CAPABILITIES = Object.freeze({
  retail: [
    'market.read', 'symbols.read', 'forecast.read', 'forecast.explanation.basic',
    'news.read', 'history.read', 'watchlist.manage', 'alerts.manage',
    'screener.read', 'portfolio.manage.self', 'plans.manage.self',
    'plans.calculate.rr', 'journal.read.self', 'journal.update.self',
    'chat.use.self', 'reports.symbol.export', 'reports.portfolio.export',
    'reports.plan.export', 'models.summary.read', 'notifications.channels.manage.self',
  ],
  trader: [
    // Cộng capability của retail trong hàm getCapabilities() hoặc liệt kê đầy đủ.
    'forecast.hit-rate.read', 'news.impact.read', 'screener.advanced',
    'screener.saved.manage.self', 'portfolio.import.self', 'portfolio.overview.self',
    'plans.calculate.quantity', 'profile.investment.manage.self',
    'journal.manual.create.self', 'journal.stats.read.self',
    'reports.journal.export.self',
  ],
  analyst: [
    // Cộng capability đọc thông thường, không kế thừa capability admin.
    'forecast.explanation.full', 'forecast.audit.read', 'forecast.inputs.read',
    'forecast.replay.create', 'history.csv.export', 'models.evaluation.read',
    'models.versions.read', 'admin.chat-log.read.redacted',
  ],
  admin: [
    'market.read', 'models.summary.read', 'models.evaluation.read',
    'models.versions.read', 'forecast.audit.read', 'forecast.inputs.read', 'forecast.replay.create',
    'admin.users.manage', 'admin.jobs.read', 'admin.jobs.enqueue',
    'admin.models.manage', 'admin.audit.read', 'admin.notifications.read',
    'admin.ops-events.read', 'admin.chat-log.read.redacted',
  ],
});

export function hasCapability(role, capability) {
  const caps = new Set(ROLE_CAPABILITIES[role] ?? []);
  // Role bundles được hợp nhất có chủ ý; tuyệt đối không gộp admin vào analyst.
  if (role === ROLE.TRADER) {
    for (const cap of ROLE_CAPABILITIES.retail) caps.add(cap);
  }
  if (role === ROLE.ANALYST) {
    for (const cap of ROLE_CAPABILITIES.retail) caps.add(cap);
    for (const cap of ROLE_CAPABILITIES.trader) caps.add(cap);
  }
  return caps.has(capability);
}
```

Danh sách trên là gợi ý khởi tạo; để tránh capability bundle khó kiểm soát, nên chuẩn hóa thành bảng role→capability hoàn chỉnh trong `packages/core/access/roles.js` và có một nguồn duy nhất cho route/menu. Đoạn minh họa không phải cơ chế bảo mật server.

#### Bản đồ route gợi ý

```js
export const ROUTES = [
  // Admin chỉ thấy market status/summary; không mount danh sách mã do /symbols không cấp cho Ad.
  { id: 'overview', path: '/overview', page: 'OverviewPage', roles: ['retail', 'trader', 'analyst', 'admin'], capability: 'market.read', phase: 1 },
  { id: 'symbols', path: '/symbols/:symbol', page: 'SymbolDetailPage', roles: ['retail', 'trader', 'analyst'], capability: 'symbols.read', phase: 1 },
  { id: 'evaluation', path: '/evaluation', page: 'EvaluationPage', roles: ['retail', 'trader', 'analyst', 'admin'], phase: 1 },
  { id: 'screener', path: '/screener', page: 'ScreenerPage', roles: ['retail', 'trader', 'analyst'], capability: 'screener.read', phase: 2 },
  { id: 'portfolio', path: '/portfolio', page: 'PortfolioPage', roles: ['retail', 'trader', 'analyst'], capability: 'portfolio.manage.self', phase: 2 },
  { id: 'plans', path: '/plans', page: 'PlansPage', roles: ['retail', 'trader', 'analyst'], capability: 'plans.manage.self', phase: 2 },
  { id: 'journal', path: '/journal', page: 'JournalPage', roles: ['retail', 'trader', 'analyst'], capability: 'journal.read.self', phase: 2 },
  { id: 'admin', path: '/admin/*', page: 'AdminRoutes', roles: ['admin'], phase: 1 },
];
```

Trong code thật, tách capability theo từng tab/action của Admin và Evaluation thay vì một capability rộng như ví dụ. Route Registry điều khiển lazy load, menu và guard đồng bộ; route con Admin có capability riêng.

### 12.4 Field-level access và giao diện

- `retail`: giải thích ba câu giản dị; screener dùng preset; Portfolio nhập tay, không import/overview nâng cao; Trade Plan ẩn vốn, % rủi ro và khối lượng tối đa; Journal không có thống kê/ghi thủ công ở bản đầu.
- `trader`: xem hit rate; screener nâng cao và lưu filter; import/overview Portfolio; hồ sơ vốn/rủi ro; tính khối lượng Trade Plan; thống kê Journal và PDF Journal.
- `analyst`: các capability trader cộng analyst mode (top 15 feature, raw values/attention), audit/input/replay, model evaluation chi tiết, lịch sử CSV và chat log đã che.
- `admin`: màn hình vận hành/quản trị; có model evaluation và model summary. Không hiển thị tab analyst của mã qua endpoint bị giới hạn; không truy cập dữ liệu tài chính cá nhân.
- Tất cả: nhãn dự báo chỉ `Tăng`, `Đi ngang`, `Giảm`; disclaimer; trạng thái thiếu/stale; không hiển thị từ “MUA/BÁN” như một khuyến nghị. Những từ này chỉ được phép trong form nhập giao dịch người dùng.

Không chỉ ẩn field sau khi nhận toàn bộ payload. Endpoint forecast phải trả payload đã cắt theo role như FR-M3; form và API mutation cũng validate server-side. Với retail gửi `capital_vnd`/`risk_pct` tới endpoint tính plan, API phải từ chối theo SDD.

### 12.5 Session và guards cần code

1. Khởi động app: gọi `GET /api/v1/me`; trạng thái session gồm `loading | authenticated | anonymous | error`, `user.id`, `user.role`, `must_change_password`.
2. `PublicOnly`: login/forgot/reset; nếu đã xác thực thì chuyển tới landing route theo role.
3. `RequireAuth`: chưa xác thực hoặc 401 → xóa session cache và chuyển login (giữ `returnTo` an toàn nội bộ).
4. `MustChangePassword`: nếu flag bật, chỉ cho `/change-password`, `/me`, logout và tài nguyên tối thiểu cần cho flow; không mount menu/routes nghiệp vụ.
5. `RequireCapability`: nếu role thiếu capability thì trang 403. Không redirect về overview, vì sẽ che lỗi cấu hình/quyền.
6. `PhaseGate`: phase chưa bật → 404/feature unavailable theo cấu hình deploy. Đây không phải authorization.
7. API response 403 → hiển thị trang/inline “Bạn không có quyền thực hiện thao tác này”; 404 → “Không tìm thấy dữ liệu”; không tự thử lại. Với thao tác destructive, giữ modal xác nhận nhưng server vẫn enforce.
8. Đổi role/khóa tài khoản/reset password có thể thu hồi phiên ngay; frontend nhận 401 ở request sau và logout. Không tin role lưu vĩnh viễn trong localStorage; cache role chỉ hợp lệ trong vòng đời session và phải cập nhật từ `/me`.

### 12.6 Endpoint guard matrix cho frontend

Mọi path dưới đây có prefix `/api/v1`. `R/T/A/Ad` lần lượt là retail/trader/analyst/admin. Với endpoint private, “role allowed” không bỏ qua kiểm tra owner.

| Capability | Endpoint | Role | Giai đoạn |
|---|---|---|---|
| `auth.session` | `POST /auth/login`, `POST /auth/logout`, `GET /me`, `POST /auth/change-password` | Tất cả | GĐ1 |
| `auth.reset` | `POST /auth/forgot-password`, `POST /auth/reset-password` | Public token flow | Feature flag GĐ1; AC-30 |
| `market.read` | `GET /market/status`, `GET /market/summary` | Tất cả | GĐ1 / summary mở rộng theo PRD |
| `symbols.read` | `GET /symbols`, `GET /symbols/{sym}/forecast`, `/prices`, `/news`, `/sentiment`, `/history` | R/T/A | GĐ1 |
| `history.csv.export` | `GET /symbols/{sym}/history.csv` | A | Should GĐ1 |
| `watchlist.manage.self` | `GET/PUT/PATCH/DELETE /watchlist[/{sym}]` | R/T/A + owner | GĐ1 |
| `alerts.manage.self` | `/alert-rules`, `/alerts` read/update | R/T/A + owner | In-app GĐ1; `plan_touch` và kênh ngoài GĐ2 |
| `forecast.audit.read` | `GET /forecasts/{id}/audit`, `/inputs` | A/Ad | GĐ1 theo SDD |
| `forecast.replay.create` | `POST /forecasts/{id}/replays`; poll replay | A/Ad | GĐ1 theo SDD/AC-14 |
| `models.summary.read` | `GET /models/summary` | R/T/A/Ad | GĐ1 |
| `models.evaluation.read` | `GET /models/evaluation` | A/Ad | GĐ1; calibration GĐ2 |
| `models.versions.read` | `GET /model-versions` | A/Ad | GĐ1 |
| `admin.users.manage` | `/admin/users*`, reset password, revoke sessions | Ad | GĐ1 |
| `admin.jobs.*` | `GET /admin/jobs`, `POST /admin/jobs/{job}/run` | Ad | GĐ1; API enqueue only, worker consumes queue |
| `admin.models.manage` | `GET /admin/models`, `POST /admin/models/{id}/serve` | Ad | Should GĐ1 |
| `admin.audit.read` | `GET /admin/audit` | Ad | GĐ1; read-only |
| `admin.notifications.read` / `admin.ops-events.read` | `GET /admin/notifications`, `/admin/ops-events` | Ad | GĐ1/GĐ2 theo chức năng |
| `screener.read` | `GET /screener` | R/T/A | GĐ2 |
| `screener.saved.manage.self` | `/screener/saved*` | T/A + owner | GĐ2 |
| `portfolio.manage.self` | `/portfolio`, `/portfolio/tx*`, `DELETE /portfolio` | R/T/A + owner | GĐ2 |
| `portfolio.import.self` | `POST /portfolio/import` | T/A + owner | GĐ2 |
| `portfolio.overview.self` | `GET /portfolio/overview` | T/A + owner | Should GĐ2 |
| `plans.manage.self` | `/plans*`, `POST /plans/{id}/close` | R/T/A + owner | GĐ2 |
| `plans.calculate.rr` | `POST /plans/calc` basic R:R/distance | R/T/A | GĐ2 |
| `plans.calculate.quantity` | `POST /plans/calc` with capital/risk/quantity | T/A | GĐ2 |
| `profile.investment.manage.self` | `GET/PUT /me/profile` | T/A + owner; R=403 | GĐ2 |
| `notifications.channels.manage.self` | `/me/notification-preferences`, `/notify/channels*` | R/T/A + owner; Admin=403 | GĐ2; verification/test + queued dispatch worker |
| `journal.manage.self` | `/journal*` | R/T/A + owner | GĐ2; manual create/stats only T/A |
| `chat.use.self` | `/chat/sessions*` | R/T/A + owner | GĐ2 |
| `admin.chat-log.read.redacted` | `GET /admin/chat-log` | A/Ad; personal prompts masked | GĐ2 |
| `reports.symbol.export` | `GET /reports/symbols/{sym}.pdf` | R/T/A | GĐ2 |
| `reports.portfolio.export.self`, `reports.plan.export.self` | `GET /reports/portfolio.pdf`, `/reports/plans/{id}.pdf` | R/T/A + owner | GĐ2 |
| `reports.journal.export.self` | `GET /reports/journal.pdf` | T/A + owner | Should GĐ2 |

Xuất CSV lịch sử đóng cửa đã có API và nút Analyst nhưng mặc định tắt theo `HISTORY_CSV_EXPORT_ENABLED` ở API và `VITE_HISTORY_CSV_EXPORT_ENABLED` ở web. Chỉ bật đồng thời hai biến sau khi release chốt Should này; dữ liệu CSV lấy từ cùng repository lịch sử giá, giới hạn khoảng 1/3/6 tháng, kèm nguồn và currency.

Các endpoint báo cáo xuất PDF trực tiếp và lấy `user_id` từ phiên đăng nhập cho Portfolio, Trade Plan và Journal. PDF cần `REPORT_FONT_PATH` trỏ tới font TrueType có hỗ trợ tiếng Việt; API trả `503 REPORT_FONT_NOT_CONFIGURED` hoặc `REPORT_FONT_UNAVAILABLE` nếu cấu hình thiếu/sai. Báo cáo mã chỉ gồm dữ liệu giá công khai và ghi rõ dự báo chưa khả dụng khi model AI chưa sẵn sàng. Báo cáo cá nhân đặt `Cache-Control: private, no-store`.

`GET /admin/ops-events` currently derives its read-only feed from failed or partial ingestion runs, terminal worker jobs, and terminal notification failures. It exposes allowlisted context and sanitized error codes only; raw error messages, recipients, alert text, and user-owned records are excluded. Drift events remain unavailable until model and monitoring metrics exist.

### 12.7 Điểm mâu thuẫn / quyết định bảo thủ

1. PRD Use Case UC-05/06/07/08 mô tả một số màn hình cho Trader, trong khi FR và endpoint SDD cấp quyền watchlist alert, so sánh forecast, filtering và history cho R/T/A. Bản này theo **FR + SDD endpoint** (nguồn truy vết chi tiết); giữ cho ba role.
2. PRD mô tả Retail có screener theo bộ lọc sẵn, portfolio nhập tay, Trade Plan rút gọn, Chat và Journal; SDD endpoint cho phép R/T/A nhưng ghi chú giới hạn nâng cao. Bản này áp dụng khác biệt ở capability/field, không tạo API riêng theo role.
3. FR-M11-04 (ghi Journal thủ công) và FR-M11-06 (thống kê) chỉ T/A, dù bảng endpoint tổng ghi `POST /journal` R/T/A. Tạm khóa manual-create cho Retail theo FR cụ thể; API cần phân biệt `kind=manual` với entry sinh từ close plan. Retail vẫn đọc/sửa notes/tags trên entry của mình theo FR-M11-02.
4. PRD ghi Analyst/Admin audit, nhưng Use Case một số chỗ chỉ Analyst. SDD endpoint `/forecasts/{id}/audit`, `/inputs`, replay ghi A/Ad; theo SDD ở đây. Admin không được truy cập dữ liệu cá nhân chỉ vì có quyền audit forecast.
5. M5 alert trong PRD có mâu thuẫn Must/Should ở bảng ưu tiên và US-05; SDD mục 12.3 giải quyết theo FR-M5-02..05 là Must cho R/T/A GĐ1. Email/Telegram vẫn GĐ2.
6. Các chỗ nên chốt trước release: Should được bật hay không cho CSV/replay/email reset/calibration/manual Journal/stats/PDF Journal/model rollback; mức tin cậy 55%; trạng thái Must-change flow. Trong lúc chưa chốt, giữ endpoint/UI sau feature flag, không tự cấp thêm role.

### 12.8 Checklist để nối route và backend

- Mỗi route có `id`, `path`, lazy page, `requiredCapability`, `phase`, `shell`; route con có capability riêng.
- Mỗi menu item dùng cùng route registry và không tự tạo ma trận quyền lần thứ hai.
- Mỗi query/mutation gắn capability trong UI và map tới một API endpoint trong OpenAPI.
- API auth middleware xác minh session/role; service private lấy owner từ session; DB áp RLS; test cross-user và Admin-denial theo AC-26/NFR-08.
- Response `GET /me` có tối thiểu `{ id, email, role, must_change_password }`; role đổi phải được phản ánh sau khi session bị thu hồi. Capability list từ server có thể thêm sau, nhưng không thay server enforcement.
- Payload forecast do server cắt theo role; không tải dữ liệu Analyst vào client Retail.
- Không cho Admin xem portfolio, plan, journal; không log payload cá nhân vào console/error tracker.
- Trạng thái disabled/403/404/401, account locked và session revoked đều có UI rõ, không rơi vào màn hình trắng.
- Feature flag phase và role permission là hai lớp độc lập; bật GĐ2 không tự cấp role mới.


