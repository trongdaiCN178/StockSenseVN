# Software Design Document for IDSS

| CODE | CAPSTONE_SDD |
| --- | --- |
| VERSION | 0.0.5 |
| STATUS | DRAFT UPDATED |
| AUTHOR | HOANG MINH TUAN |
| VERIFY | HOANG MINH TUAN |
| UPDATE | 30/10/2026 |
| RELATED DOCUMENT | PRD CAPSTONE_PRD v0.0.4; Project Brief CAPSTONE_PB v0.0.4 |

| Mã tài liệu | Phiên bản | Trạng thái | Tác giả | Ngày cập nhật |
| --- | --- | --- | --- | --- |
| CAPSTONE_SDD | 0.0.1 | Nháp | Hoàng Minh Tuấn | 08/10/2026 |
| CAPSTONE_SDD | 0.0.2 | Test | Hoàng Minh Tuấn | 08/10/2026 |
| CAPSTONE_SDD | 0.0.3 | Test | Trần Trọng Đại | 09/10/2026 |
| CAPSTONE_SDD | 0.0.4 | Test | Trần Trọng Đại | 13/10/2026 |
| CAPSTONE_SDD | 0.0.5 | Test | Trần Trọng Đại | 29/10/2026 |

Thay đổi 0.0.5: bổ sung thiết kế luồng đăng ký và vòng đời tài khoản (FR-M0-08..15, UC-26..29, AC-31..39) theo PRD v0.0.4 (§7.2 C6, §9.2.6): mục 2.1, 5.2 (M0), 6.1, 6.2, 8.1, 8.2, 10, 11, 12.4. Ghi nhận băm mật khẩu triển khai bằng scrypt.

Rà soát 30/10/2026 (cùng phiên bản 0.0.5): đồng bộ thiết kế với mã nguồn đã triển khai. Ngăn xếp thực tế là Node.js (Fastify) cho API và worker, React + Vite cho web, PostgreSQL 17, không phải Go như bản nháp; phiên đăng nhập là token ngẫu nhiên lưu băm, không dùng JWT; Telegram dùng webhook. Sửa các mục 1, 2, 3.2, 4, 5, 6, 8, 9, 10, 12; phần thiết kế mô hình (mục 7) và các chức năng cần AI giữ là thiết kế cho giai đoạn sau, ghi rõ "chưa triển khai".

**MỤC LỤC**

## 1. Giới thiệu

Tài liệu này mô tả cách xây dựng hệ thống IDSS (tên thương mại tạm: StockSense VN) để đáp ứng toàn bộ yêu cầu Must-have và Should-have trong PRD v0.0.4 của ba giai đoạn (GĐ1 lõi dự báo, GĐ2 vòng quyết định, GĐ3 mobile). Từ bản 0.0.5, tài liệu mô tả kiến trúc đã triển khai trong mã nguồn StockSenseVN (monorepo Node.js); các phần phụ thuộc mô hình AI (dự báo thật, giải thích, sentiment, Chat, tái lập) là thiết kế cho giai đoạn sau và được ghi rõ "chưa triển khai".

### 1.1 Mục đích

Chuyển các yêu cầu chức năng FR-M0 đến FR-M14 và NFR-01 đến NFR-18 thành kiến trúc, thành phần, lược đồ dữ liệu, API và thiết kế mô hình cụ thể.

Làm căn cứ để lập trình, kiểm thử và viết chương thiết kế trong báo cáo đồ án.

### 1.2 Phạm vi

Hệ thống dự báo xác suất Tăng / Đi ngang / Giảm sau 2 và 5 phiên (T+2, T+5) cho tối thiểu 15 mã thanh khoản cao (hiện có 17 mã: 10 HOSE (ACB, FPT, GAS, HPG, MBB, MWG, SSI, VCB, VIC, VNM), 4 HNX (HUT, IDC, PVS, SHS) và 3 UPCoM (BSR, QNS, VGT)), cập nhật mỗi ngày sau phiên, hiển thị trên web responsive và ứng dụng mobile (GĐ3). Từ GĐ2, hệ thống thêm Screener, Portfolio, Trade Plan, Journal, Chat hỏi đáp dựa trên dữ liệu hệ thống, báo cáo PDF và thông báo qua email/Telegram. Ngoài phạm vi: đặt lệnh tự động và kết nối API công ty chứng khoán, tư vấn đầu tư (kể cả chatbot đưa khuyến nghị mua/bán), toàn sàn UPCoM (chỉ chọn một số mã thanh khoản cao), phái sinh, dữ liệu tick.

### 1.3 Thuật ngữ

| Thuật ngữ | Nghĩa trong tài liệu này |
| --- | --- |
| T, T+2, T+5 | T là ngày dữ liệu cơ sở; T+h là phiên giao dịch thứ h sau T |
| Cut-off 15:00 | Tin đăng sau 15:00 ngày T chỉ được dùng từ dự báo ngày T+1 |
| Point-in-time | Chỉ dùng dữ liệu đã công bố tại thời điểm dự báo |
| Snapshot | Bản ghi cố định của tensor đầu vào một dự báo, định danh bằng SHA-256 |
| Phiên bản mô hình đang phục vụ | Phiên bản mà batch dự báo hằng ngày đang dùng, do admin chọn |
| Batch ngày | Chuỗi job chạy sau 15:30: nạp dữ liệu, chấm cảm xúc, sinh dự báo, tạo cảnh báo, đánh dấu kế hoạch chạm điểm, tính lại danh mục, xếp hàng thông báo |
| RBAC | Phân quyền theo 4 vai trò: retail, trader, analyst, admin |
| Đi ngang | Tên hiển thị của nhãn hold; mã hold chỉ dùng trong CSDL và API nội bộ, người dùng không thấy chữ "Giữ" |
| Trade Plan, Journal | Kế hoạch giao dịch do người dùng tự nhập, gắn snapshot dự báo lúc lập; nhật ký quyết định tự tạo khi đóng kế hoạch |
| Hàng đợi thông báo (outbox) | Bảng notification_outbox: mỗi cảnh báo trên mỗi kênh là một dòng có khóa chống gửi trùng; worker lấy các dòng chờ gửi |

### 1.4 Tài liệu tham chiếu

Project Brief CAPSTONE_PB v0.0.4 (29/10/2026).

Product Requirements Document CAPSTONE_PRD v0.0.4 (29/10/2026).

Mã nguồn StockSenseVN: db/migrations/001–020 (lược đồ có hiệu lực), openapi.yaml (hợp đồng API), README.md (cách chạy), apps/api, apps/web, apps/worker, packages/core. Bản nháp trước dựa trên mã DATN_2026 (Go, Python ETL); thiết kế đó đã được thay bằng ngăn xếp Node.js ở mục 3.2.

Khi tài liệu này khác bản thiết kế nháp trước đó (kỳ hạn h = 1, 3, 5 và năm nhóm người dùng), tài liệu này và PRD là bản có hiệu lực.

## 2. Tổng quan hệ thống

Hệ thống gồm ba tiến trình Node.js dùng chung một CSDL PostgreSQL: api (Fastify, REST /api/v1, sinh PDF, nhận webhook Telegram), worker (đồng bộ giá SSI và tin tức, tạo cảnh báo, gửi thông báo, chạy pipeline hằng ngày theo lịch) và web (React, build tĩnh bằng Vite). Các tiến trình chỉ trao đổi qua PostgreSQL: Admin chạy lại job bằng cách ghi một dòng vào hàng đợi admin_job_runs, worker lấy và thực hiện (D3). Phần mô hình AI (sentiment, dự báo, giải thích) sẽ là một worker Python riêng ghi kết quả vào bảng forecasts; API luôn đọc dự báo đã tính sẵn, không chờ mô hình. Hiện bảng forecasts chứa dữ liệu dự báo mẫu do lệnh seed tạo.

### 2.1 Người dùng và vai trò

| Vai trò hệ thống | Persona (PRD mục 4) | Thấy được gì |
| --- | --- | --- |
| retail | P1, nhà đầu tư cá nhân | Tổng quan, forecast card T+2 và T+5 cạnh nhau, 3 câu giải thích đơn giản, tin tức, watchlist, cảnh báo (đổi nhãn, ngưỡng xác suất), lịch sử dự báo. GĐ2: Screener với bộ lọc có sẵn, Portfolio nhập tay, Trade Plan 4 trường, Journal ghi chú, Chat, xuất PDF, cảnh báo qua email/Telegram |
| trader | P2, swing trader; môi giới; quản lý danh mục | Như retail, thêm đóng góp theo nhóm yếu tố và trọng số tin. GĐ2: lưu bộ lọc Screener, Portfolio import CSV, Trade Plan đầy đủ (R:R, khối lượng theo mức rủi ro), Journal có thống kê nhìn lại, PDF Journal |
| analyst | P3, analyst/quant; môi giới | Như trader, thêm top 15 đặc trưng, tab Audit, trang Đánh giá mô hình đầy đủ (retail và trader chỉ thấy bản tóm tắt), xuất CSV, xem nhật ký Chat đã che nội dung cá nhân |
| admin | Quản trị viên | Quản lý người dùng, nguồn dữ liệu, lần chạy job, phiên bản mô hình, audit log, nhật ký gửi thông báo và nhật ký Chat đã che nội dung cá nhân; không đọc được nội dung Portfolio, Trade Plan, Journal của người dùng |
| (tài khoản demo dùng chung) | Hội đồng chấm | Xem demo bằng tài khoản demo tạo sẵn trước buổi bảo vệ (app_user.is_demo), chứa dữ liệu mẫu, không có dữ liệu cá nhân thật; hoặc tự đăng ký tài khoản mới |

Cách có tài khoản (FR-M0-08..14, PRD §4.2, §9.2.6): retail tự đăng ký công khai và xác thực email; trader do retail tự nâng cấp (tự hạ cấp được); analyst do retail/trader gửi yêu cầu và Admin duyệt; admin không đăng ký công khai — Admin đầu tiên tạo bằng lệnh bootstrap (npm run db:bootstrap-admin) khi chưa có Admin nào, Admin tiếp theo do Admin hiện có tạo. Mọi đổi vai trò thu hồi phiên của tài khoản đó.

### 2.2 Bối cảnh và hệ thống bên ngoài

| Hệ thống ngoài | Vai trò | Cách kết nối |
| --- | --- | --- |
| SSI iBoard | Giá OHLCV ngày theo mã | HTTP JSON; apps/worker/src/providers/ssi.js, lệnh worker:market:sync (đã triển khai). Chỉ số VN-Index, HNX-Index hiện là dữ liệu mẫu |
| CafeF, VnExpress | Danh sách tin theo chuyên mục, gán vào mã theo tiêu đề và tóm tắt | HTML/RSS; apps/worker/src/providers/news.js, lệnh worker:news:sync (đã triển khai); sentiment để trung tính đến khi có mô hình |
| vnstock (hoặc nguồn tương đương) | Báo cáo tài chính quý kèm ngày công bố | Thư viện Python trong worker AI (chưa triển khai) |
| Google Colab / Kaggle | GPU để tinh chỉnh PhoBERT và huấn luyện mô hình | Notebook chạy mã trong ml/, checkpoint tải về và đăng ký phiên bản |
| Nhà cung cấp mô hình ngôn ngữ (API) hoặc máy chủ LLM cục bộ | Diễn đạt câu trả lời của Chat từ dữ liệu đã truy xuất | HTTPS tới API nhà cung cấp hoặc máy chủ cục bộ tương thích OpenAI (chưa triển khai; API trả 503 CHAT_MODEL_NOT_READY) |
| Telegram Bot API | Kênh thông báo và liên kết tài khoản Telegram | HTTPS; bot nhận mã liên kết qua webhook POST /notify/telegram/webhook có secret, nên cần địa chỉ HTTPS công khai |
| Máy chủ SMTP | Gửi thư xác thực đăng ký, đặt lại mật khẩu, xác minh kênh email và cảnh báo | nodemailer qua SMTP; bản demo dùng Gmail với App Password (khoảng 500 người nhận/ngày) |
| TestFlight, bản cài trực tiếp Android | Phân phối thử nghiệm ứng dụng mobile (PRD A9) | Build React Native ngoài Docker Compose |
| Trình duyệt và ứng dụng mobile của người dùng | Giao diện web, ứng dụng iOS/Android (GĐ3) | Web gọi /api/v1 bằng cookie phiên HttpOnly; khi phát triển, Vite proxy /api sang cổng 3000; mobile dùng Bearer token (GĐ3, chưa triển khai) |

### 2.3 Luồng nghiệp vụ chính

Sau 15:30 các ngày thứ Hai đến thứ Sáu, worker xếp hàng pipeline hằng ngày: đồng bộ giá SSI → đồng bộ tin → tạo cảnh báo giá và cảnh báo Trade Plan → gửi thông báo (đã triển khai). Khi có mô hình, pipeline thêm các bước chấm cảm xúc, sinh dự báo T+2/T+5 kèm giải thích và ghi vào CSDL trước 20:00.

Người dùng mở trang tổng quan hoặc Screener, lọc và chọn mã, xem forecast card, giải thích, tin tức và lịch sử đúng/sai.

Khi dự báo đủ 2 hoặc 5 phiên, batch tự điền nhãn thực tế và cập nhật hit rate.

Từ một dự báo, người dùng tự lập Trade Plan (hệ thống chụp snapshot dự báo lúc đó), tự giao dịch tại công ty chứng khoán, ghi giao dịch vào Portfolio và đóng kế hoạch; hệ thống tạo bản ghi Journal so sánh quyết định với dự báo.

Khi có sự kiện (đổi nhãn, vượt ngưỡng, kế hoạch chạm điểm), cảnh báo xuất hiện trong ứng dụng và worker gửi qua email/Telegram trong 5 phút, mỗi sự kiện một lần trên mỗi kênh.

Người dùng hỏi Chat bằng tiếng Việt; chat chỉ truy xuất dữ liệu đã lưu của hệ thống và của chính người dùng, trả lời kèm trích dẫn và từ chối yêu cầu đưa lệnh.

Admin theo dõi job và chọn phiên bản mô hình; mô hình mới được huấn luyện ngoài hệ thống và chỉ được phục vụ khi đạt điều kiện demo (PRD mục 12.6).

## 3. Ràng buộc, giả định và quyết định thiết kế

Thiết kế ưu tiên dùng lại mã sẵn có và hạ tầng miễn phí; ràng buộc chặt nhất là thời gian (GĐ1 là 12 tuần, khoảng 28 tuần cho ba giai đoạn) do một sinh viên thực hiện (PRD C1) và chi phí hạ tầng phát sinh từ GĐ2 (PRD C2).

### 3.1 Ràng buộc và giả định kế thừa từ PRD

**Ràng buộc:** GĐ1 12 tuần, GĐ2 dự kiến tuần 13–20 và GĐ3 dự kiến tuần 21–28, một người; lộ trình đến tuần 28 cần được giảng viên hướng dẫn chấp thuận (C1); chi phí gần 0 đồng ở GĐ1, GĐ2–GĐ3 có thể phát sinh chi phí mô hình ngôn ngữ (nếu dùng API), hosting và tài khoản nhà phát triển Apple, ngân sách trần chốt ở PRD mục 16.1 (C2); chỉ hiển thị tiêu đề, tóm tắt, URL và điểm cảm xúc của tin (C3); kế thừa nguồn dữ liệu SSI, CafeF của DATN_2026 nhưng viết lại bằng Node.js (C4); mọi màn hình dự báo, Trade Plan, cửa sổ Chat và báo cáo PDF có tuyên bố tham khảo (C5).

**Giả định:** tin CafeF theo mã còn đủ 3 năm (A1, chưa kiểm chứng); lấy được giá điều chỉnh và BCTC quý miễn phí (A2); tự gán nhãn được 2.000–3.000 tin (A3); cập nhật một lần mỗi ngày là đủ (A4); huấn luyện bằng GPU miễn phí, suy luận trên CPU (A5); mô hình ngôn ngữ cho Chat chạy cục bộ hoặc gọi API, chưa chốt (A6); Telegram Bot API và SMTP miễn phí đủ cho bản demo (A7, A8); mobile phát hành thử nghiệm qua TestFlight và bản cài trực tiếp Android (A9); dữ liệu cá nhân trong demo là dữ liệu mẫu hoặc do người thử tự nhập (A10).

### 3.2 Quyết định thiết kế

| Mã | Quyết định | Lý do | Phương án đã loại |
| --- | --- | --- | --- |
| D1 | Backend API viết bằng Node.js 22 + Fastify 5 (apps/api), REST JSON tại /api/v1; truy cập PostgreSQL bằng pg với câu lệnh SQL tham số hóa, không dùng ORM | Một ngôn ngữ JavaScript cho API, worker, web và packages/core, nên một người làm được cả hệ thống và dùng chung hàm tính, bảng quyền; Fastify nhanh, có sẵn plugin cookie, CORS, helmet, rate limit; API chỉ đọc dữ liệu đã tính nên đạt NFR-02 | Go mở rộng từ DATN_2026 (bản nháp 0.0.1–0.0.4): thêm một ngôn ngữ, không dùng chung code với web. FastAPI: cũng thêm ngôn ngữ cho phần web |
| D2 | Worker dữ liệu viết bằng Node.js (apps/worker): đồng bộ giá, tin, cảnh báo, gửi thông báo, pipeline theo lịch. Phần huấn luyện và suy luận mô hình (sentiment, dự báo, giải thích) sẽ là worker Python riêng (chưa triển khai) | Phần ETL và thông báo không cần thư viện học máy nên viết chung ngôn ngữ với API; mô hình cần PyTorch, Transformers, Captum nên để Python | Viết toàn bộ worker bằng Python: hai ngôn ngữ cho cả phần không cần học máy |
| D3 | Các tiến trình chỉ giao tiếp qua PostgreSQL: Admin chạy lại job bằng một dòng admin_job_runs trạng thái queued, worker lấy dòng, ghi heartbeat vào admin_worker_instances; API không bao giờ chạy job trong request HTTP | Một nguồn sự thật, không cần message broker, dễ truy vết | Redis/BullMQ: thêm một dịch vụ phải vận hành |
| D4 | Dự báo tính theo lô mỗi ngày và lưu sẵn, kèm giải thích. Chat không suy luận dự báo, chỉ đọc dự báo đã lưu | Đáp ứng NFR-01/02 và A4; giải thích bằng IG tốn thời gian, không nên tính theo yêu cầu; mô hình ngôn ngữ chỉ diễn đạt dữ liệu đã truy xuất (PRD A6) | Suy luận trực tuyến mỗi lần mở trang |
| D5 | Lược đồ kế thừa db/schema.sql (3 tầng thô / xử lý / đặc trưng, point-in-time 15:00) và bổ sung bảng ứng dụng ở GĐ1, bảng dữ liệu cá nhân và thông báo ở GĐ2 | Lược đồ hiện có đã khớp PRD về cut-off và BCTC theo ngày công bố | Thiết kế lại từ đầu |
| D6 | Giao diện web viết bằng React 19 + JavaScript (JSX), đóng gói bằng Vite thành file tĩnh; biểu đồ giá vẽ bằng SVG tự viết; bảng quyền, chính sách mật khẩu, hàm R:R/khối lượng và nhãn dự báo nằm trong packages/core dùng chung giữa web và API | Nhiều trang nghiệp vụ, biểu mẫu và trạng thái; không cần thư viện biểu đồ nặng cho đường giá đóng cửa 6 tháng; một hàm tính dùng chung nên số trên biểu mẫu khớp số lưu | TypeScript: an toàn kiểu hơn nhưng thêm bước build, chưa cần ở quy mô này. TradingView Lightweight Charts: thêm phụ thuộc, để dành khi cần biểu đồ nến |
| D7 | Mobile là ứng dụng React Native một codebase cho iOS và Android, dùng chung API REST /api/v1 và packages/core với web; web responsive từ 375 px (có thể thêm PWA) là phương án dự phòng. Xác thực: web giữ cookie phiên HttpOnly, mobile (GĐ3) gửi Authorization: Bearer với token lưu trong Keychain/Keystore, middleware chấp nhận cả hai; kênh thông báo đẩy được chừa sẵn (mục 8.3). Đăng xuất trên mobile gọi POST /auth/logout để thu hồi phiên rồi mới xóa token trong Keychain/Keystore; khi nhận 401 thì xóa token và chuyển về màn hình đăng nhập. | Theo PRD 6.1 (M14, Must-have GĐ3), FR-M14-01..05 và NFR-17; Project Brief 0.0.2 nêu "nhận thông báo" trong chức năng cốt lõi của mobile | Chỉ web responsive (quyết định ở bản 0.0.1): không đáp ứng M14. Hai codebase native riêng hoặc Flutter: thêm ngôn ngữ và không dùng chung được với web |
| D8 | Một mô hình đa phương thức với hai đầu ra T+2 và T+5; embedding PhoBERT tính một lần và lưu lại | Theo PRD 12.4 và RK-10; suy luận trên CPU đủ nhanh | Hai mô hình riêng cho từng kỳ hạn |
| D9 | Môi trường demo: PostgreSQL 17 chạy bằng Docker Compose; api, worker và web chạy bằng npm trên cùng máy. Triển khai công khai: thêm container cho api, worker và reverse proxy HTTPS (chưa làm) | Đơn giản nhất cho một người phát triển và demo; NFR-11 yêu cầu Docker Compose khi triển khai công khai | Kubernetes: thừa cho quy mô demo |
| D10 | Báo cáo PDF sinh đồng bộ trong api bằng pdfkit với font Unicode (REPORT_FONT_PATH, mặc định Arial của hệ điều hành); số liệu lấy từ cùng hàm truy vấn với màn hình | NFR-16: số liệu khớp màn hình, dưới 10 giây; không thêm container | Container Chromium từ HTML: dàn trang đẹp hơn nhưng nặng thêm khoảng 500 MB RAM |
| D11 | Chat chạy trong dịch vụ chat riêng: bộ chặn lệnh, truy xuất bằng truy vấn cố định, mô hình ngôn ngữ diễn đạt, bộ kiểm tra đầu ra (số liệu, trích dẫn, từ cấm); mô hình ngôn ngữ nằm sau giao diện LLMClient có hai bộ nối (API, cục bộ) | FR-M12-02..05 và NFR-14: mọi số liệu phải có nguồn; lỗi hoặc chậm của mô hình ngôn ngữ không ảnh hưởng trang dự báo; đổi bộ nối không đổi mã nghiệp vụ vì PRD A6 chưa chốt | Agent tự gọi công cụ và sinh SQL: khó bảo đảm cách ly dữ liệu cá nhân và kiểm tra bịa. Cơ sở dữ liệu vectơ cho toàn bộ tin: không cần, dữ liệu chủ yếu có cấu trúc |
| D12 | Thông báo ngoài app qua bảng notification_outbox làm hàng đợi; worker (worker:notifications:deliver) gửi email/Telegram, khóa duy nhất theo (cảnh báo, kênh) chống gửi trùng; Telegram nhận mã liên kết qua webhook có secret | NFR-15: tối đa 1 lần mỗi kênh dù pipeline chạy lại; retry và nhật ký gửi không phụ thuộc request | Gửi trực tiếp trong request: lỗi kênh làm chậm API. Long polling: cần tiến trình chạy liên tục riêng |
| D13 | Dữ liệu cá nhân (watchlist, Portfolio, Trade Plan, Journal, Chat, kênh thông báo, bộ lọc đã lưu) gắn user_id; mọi hàm repository nhận userId từ phiên và đặt điều kiện user_id trong SQL; trigger CSDL chặn sửa snapshot Trade Plan, snapshot và kết quả Journal, và chặn chat_message gắn sai chủ | NFR-07/08 và AC-26: admin không có route đọc nội dung; id của người khác trả 404 | Row-Level Security (thiết kế bản nháp): an toàn hơn khi quên điều kiện nhưng phức tạp khi dùng một pool kết nối; có thể bổ sung khi triển khai công khai |
| D14 | Phiên đăng nhập là token ngẫu nhiên trong cookie HttpOnly (SameSite=Lax, path /api/v1), CSDL chỉ lưu SHA-256 trong auth_sessions, hết hạn 24 giờ. Mỗi request tra phiên còn hiệu lực, is_active, locked_until và vai trò hiện tại trong users. Khóa, đổi vai trò, đổi hoặc đặt lại mật khẩu thu hồi phiên trong cùng transaction | FR-M0-01–07; AC-27, AC-29, AC-30. Thu hồi ngay, không cần danh sách đen như JWT | JWT HS256 (bản nháp): vẫn phải tra phiên để thu hồi ngay nên không có lợi thêm. Redis: thêm dịch vụ |
| D15 | Tái lập dự báo (chưa triển khai, cần mô hình): API ghi một yêu cầu replay trạng thái queued, worker Python chạy đúng phiên bản mô hình và snapshot, ghi kết quả riêng, không ghi đè dự báo gốc | FR-M7-10 và AC-14; giữ nguyên D3 | Gọi Python trực tiếp qua HTTP từ API: thêm ngoại lệ cho D3 |
| D16 | Nhật ký quản trị admin_audit_log chỉ thêm: API không có route sửa/xóa; sự kiện thành công ghi cùng transaction với thay đổi; details lưu before/after đã lọc bí mật | FR-M7-05, FR-M7-11, NFR-09, UC-25, AC-29 | Ghi log ra tệp: khó lọc và phân trang. Trigger CSDL chặn UPDATE/DELETE và ghi kết quả từ chối/lỗi: chưa làm, nên bổ sung |
| D17 | Đăng ký công khai chỉ tạo retail và xác thực email bằng liên kết một lần 24 giờ; phản hồi đăng ký luôn cùng thông điệp; trader tự nâng cấp có xác nhận; analyst do Admin duyệt; Admin do bootstrap hoặc Admin hiện có tạo, chặn mất Admin cuối; băm mật khẩu bằng scrypt | FR-M0-08..14, PRD §9.2.6: mở rộng được cho retail mà không lộ dữ liệu nhạy cảm; trader chỉ mở công cụ cho dữ liệu của chính mình nên tự phục vụ được; analyst xem dữ liệu truy vết nội bộ nên cần duyệt; scrypt có sẵn trong Node.js, không cần thư viện native, không giới hạn 72 byte | Chỉ Admin tạo tài khoản: an toàn nhưng không mở rộng được. Admin duyệt mọi nâng cấp trader: tăng việc cho Admin. Mã OTP 6 số: dễ dùng trên mobile nhưng dễ bị đoán nếu không giới hạn thử. Báo thẳng "email đã tồn tại": cho phép dò tài khoản. Hai người xác nhận + TOTP khi tạo Admin: an toàn hơn nhưng phức tạp, để FR-M0-15 |

## 4. Kiến trúc tổng thể

Kiến trúc có ba tiến trình Node.js và một CSDL PostgreSQL; không tiến trình nào gọi trực tiếp tiến trình khác (D3).

- **web** (apps/web): React build tĩnh; gọi /api/v1 bằng cookie phiên. Khi phát triển, Vite chạy cổng 5173 và proxy /api sang api.
- **api** (apps/api): Fastify cổng 3000; xác thực, phân quyền theo capability, đọc dữ liệu thị trường và dự báo đã lưu, ghi dữ liệu người dùng, sinh PDF, xếp hàng job quản trị, nhận webhook Telegram. Nếu không có DATABASE_URL, api chạy bằng dữ liệu mẫu trong bộ nhớ để phát triển giao diện.
- **worker** (apps/worker): các lệnh chạy một lần (market:sync, news:sync, notifications:deliver, admin-jobs:run) và chế độ chạy liên tục admin-jobs:watch: poll hàng đợi mỗi 10 giây, ghi heartbeat mỗi 15 giây, tự xếp hàng pipeline hằng ngày sau 15:30 các ngày thứ Hai–thứ Sáu, retry tối đa 3 lần, báo cho Admin khi hết retry.
- **db**: PostgreSQL 17 trong Docker Compose; lược đồ do db/migrations quản lý (npm run db:migrate).

Thành phần cho giai đoạn sau (chưa triển khai): worker Python cho sentiment, dự báo, giải thích và tái lập, ghi vào forecasts và các bảng giải thích; dịch vụ mô hình ngôn ngữ cho Chat; ứng dụng mobile React Native gọi cùng /api/v1.

## 5. Thiết kế chi tiết các mô-đun

Hệ thống có 12 thành phần kỹ thuật (C1–C12); mười bốn mô-đun nghiệp vụ M0–M14 của PRD là các lát cắt qua API (C6), giao diện web và mobile (C7, C12) và các thành phần C9–C11, dùng dữ liệu do C1–C5 tạo ra.

### 5.1 Thành phần kỹ thuật

| Mã | Thành phần | Ngôn ngữ, vị trí | Trách nhiệm | Hiện trạng |
| --- | --- | --- | --- | --- |
| C1 | ETL dữ liệu | Node.js, apps/worker/src/jobs, providers | Nạp giá SSI, tin CafeF/VnExpress, gán tin vào mã; ghi data_ingestion_runs | Đã có giá và tin; chưa có chỉ số thật, BCTC |
| C2 | NLP cảm xúc | Python, worker AI | Chấm cảm xúc 3 lớp kèm độ tin cậy, embedding PhoBERT | Chưa có; tin để sentiment trung tính |
| C3 | Đặc trưng và nhãn | Python + SQL, worker AI | Chỉ báo kỹ thuật, BCTC point-in-time, nhãn T+2/T+5 | Chưa có |
| C4 | Suy luận và giải thích | Python, worker AI | Xác suất, IG, attention, câu giải thích, snapshot | Chưa có; forecasts chứa dữ liệu mẫu |
| C5 | Hậu xử lý | Node.js (cảnh báo) + Python (nhãn thực tế, hit rate, drift) | Cảnh báo giá, cảnh báo Trade Plan, hết hạn kế hoạch, dọn cảnh báo 90 ngày; khi có mô hình: nhãn thực tế, hit rate, cảnh báo đổi nhãn | Đã có phần cảnh báo giá và Trade Plan |
| C6 | API | Node.js + Fastify, apps/api/src | REST JSON, phiên cookie, phân quyền capability, kiểm quyền sở hữu, giới hạn tần suất, đăng ký và vòng đời tài khoản, dữ liệu người dùng, admin, PDF | Đã có |
| C7 | Giao diện web | React 19 + Vite, apps/web/src | Các trang ở mục 8.2 | Đã có (trừ trang Đánh giá mô hình) |
| C8 | Bộ lập lịch | Node.js, apps/worker/src/admin-jobs-cli.js | Pipeline sau 15:30 thứ Hai–thứ Sáu, hàng đợi job Admin, retry 3 lần, heartbeat | Đã có; chưa có lịch nghỉ lễ |
| C9 | Thông báo | Node.js, apps/worker (notification-delivery) và api (webhook Telegram) | Gửi email (nodemailer) và Telegram từ notification_outbox, retry, nhật ký gửi | Đã có |
| C10 | Báo cáo PDF | Node.js + pdfkit, trong api | PDF mã, danh mục, Trade Plan, Journal theo kỳ | Đã có (chưa có phần dự báo thật) |
| C11 | Chat hỏi đáp | Node.js (phiên, lưu tin nhắn) + mô hình ngôn ngữ | Quản lý phiên hội thoại; khi có mô hình: chặn lệnh, truy xuất, kiểm tra đầu ra (mục 5.3) | Có phiên và lịch sử; gửi câu hỏi trả 503 CHAT_MODEL_NOT_READY |
| C12 | Ứng dụng mobile | React Native, mobile/ | Ứng dụng iOS/Android dùng chung API và packages/core (mục 8.3) | Chưa có (GĐ3) |
| — | Thư viện dùng chung | JavaScript, packages/core | Bảng vai trò và capability, chính sách mật khẩu, R:R và khối lượng theo lô 100, nhãn dự báo tiếng Việt | Đã có, có kiểm thử vitest |

### 5.2 Thiết kế theo mô-đun nghiệp vụ

**M0. Xác thực và phiên**. Đăng nhập bằng email chuẩn hóa và mật khẩu băm bằng hàm băm chậm có salt (thiết kế ban đầu bcrypt cost 12; bản triển khai dùng scrypt của Node, định dạng scrypt$salt$key, không có giới hạn 72 byte). Chính sách FR-M0-06: 8–64 ký tự, có chữ, số và ký tự đặc biệt, kiểm ở cả giao diện và máy chủ. Tài khoản tự đăng ký phải có email_verified_at mới được đăng nhập (FR-M0-09). Mật khẩu mới phải khác mật khẩu hiện tại (AC-30). Đăng nhập thành công tạo một dòng auth_sessions (lưu SHA-256 của token) và đặt cookie phiên HttpOnly, hạn 24 giờ (D14). preHandler kiểm tra phiên, is_active, locked_until và vai trò trong CSDL ở mỗi request. Token sai, hết hạn hoặc bị thu hồi trả 401; thiếu quyền trả 403. Email không tồn tại, sai mật khẩu, bị khóa đều trả thông báo chung (FR-M0-01, 03).

Kiểm soát đăng nhập sai (FR-M0-04): khóa hàng users khi cập nhật failed_login_count để các request đồng thời không vượt qua bộ đếm. Lần sai đầu mở cửa sổ 15 phút; lần sai thứ 5 trong cửa sổ đặt locked_until = thời điểm hiện tại + 15 phút. Trong thời gian khóa tạm, kể cả đúng mật khẩu cũng bị từ chối; sau cửa sổ hết hạn mở bộ đếm mới. Đăng nhập thành công đặt bộ đếm về 0. Ghi security_event cho từng lần sai, khóa tạm và đăng nhập thành công, không ghi mật khẩu/token; email không tồn tại chỉ ghi thông tin an toàn và áp dụng giới hạn request.

Đăng xuất thu hồi phiên hiện tại trước khi xóa cookie hoặc token mobile. Người dùng đổi mật khẩu bằng mật khẩu hiện tại và mật khẩu mới: cập nhật hash và thu hồi mọi phiên khác trong cùng transaction, giữ phiên hiện tại nếu không phải đặt lại bắt buộc (FR-M0-02, 05). Admin đặt mật khẩu tạm đạt chính sách, đặt must_change_password, thu hồi tất cả phiên; phiên đăng nhập tiếp theo chỉ gọi /auth/change-password, /auth/logout hoặc /me để hiển thị trạng thái bắt buộc đổi. Đổi xong phát hành phiên mới, không kéo dài phiên cũ (FR-M0-07, AC-30).

**Đăng ký và vòng đời vai trò (FR-M0-08..15).** POST /auth/register nhận email, mật khẩu, tên hiển thị và 3 cờ đồng ý (age_confirmed, accept_terms, accept_privacy); bỏ qua mọi trường vai trò. Giới hạn tần suất 5 lần/giờ theo IP và theo email, khóa đếm lưu dạng HMAC-SHA256 (AUTH_RATE_LIMIT_SECRET) trong registration_requests, không lưu IP thô. Luôn trả 202 với cùng thông điệp. Email mới: trong một transaction tạo app_user (role retail, created_via self_register, email_verified_at NULL, age_confirmed_at), 2 bản ghi user_consent (terms_of_service, privacy_notice, phiên bản CONSENT_VERSION, kênh web), token xác thực (lưu SHA-256, hết hạn 24 giờ) và thư trong auth_mail_outbox. Email đã tồn tại: chỉ xếp thư "Bạn đã có tài khoản". POST /auth/verify-email khóa token, kiểm hạn và used_at, đặt email_verified_at, ghi security_event. POST /auth/resend-verification giới hạn 5 lần/ngày theo email, 10 lần/ngày theo IP, cách nhau 60 giây, vô hiệu token cũ. Tài khoản tự đăng ký chưa xác thực quá 7 ngày, token đã dùng hoặc hết hạn quá 24 giờ và bản ghi đếm tần suất quá 24 giờ được dọn ngay đầu mỗi lượt POST /auth/register.

Nâng cấp Trader (POST /me/upgrade/trader) yêu cầu kinh nghiệm, mục đích và cờ xác nhận trách nhiệm; trong một transaction đổi role, lưu user_consent trader_terms, ghi audit_log (user.self_upgrade) và thu hồi mọi phiên. Hạ cấp (POST /me/downgrade/retail) tương tự (user.self_downgrade), giữ dữ liệu. Yêu cầu Analyst (POST /me/role-requests) lưu role_requests trạng thái pending_review; chỉ một yêu cầu đang chờ mỗi người (unique index một phần), bị từ chối thì chặn 7 ngày. Admin duyệt/từ chối qua /admin/role-requests/{id}/approve|reject: khóa hàng yêu cầu, chặn tự duyệt (SELF_APPROVAL_BLOCKED), từ chối bắt buộc lý do, duyệt thì đổi role và thu hồi phiên; mọi quyết định ghi audit_log. GET /me/consents trả lịch sử đồng ý. DELETE /me nhập lại mật khẩu, xóa tài khoản và dữ liệu cá nhân theo ON DELETE CASCADE, audit_log giữ với actor NULL; Admin không tự xóa. Bootstrap Admin là lệnh CLI đọc BOOTSTRAP_ADMIN_EMAIL/PASSWORD, chỉ chạy khi chưa có Admin, ghi audit created_via bootstrap; không có endpoint công khai tạo admin. Chưa triển khai (FR-M0-15, Should): xác nhận email cơ quan bằng thư, TOTP và nhập lại mật khẩu cho Admin, captcha, đồng ý lại khi đổi phiên bản văn bản, thư báo kết quả duyệt.

Tự đặt lại qua email (Should, FR-M0-07): /auth/forgot-password luôn trả cùng thông điệp, không tiết lộ tài khoản tồn tại. Tạo token ngẫu nhiên, chỉ lưu SHA-256 trong password_reset_token, hết hạn 30 phút; email được xếp hàng trong auth_mail_outbox GĐ1, worker gửi SMTP độc lập với giao dịch API. /auth/reset-password khóa bản ghi token, kiểm tra hạn và used_at, mật khẩu mới đạt chính sách và khác mật khẩu cũ; cập nhật hash, đánh dấu token đã dùng, vô hiệu các token còn lại và thu hồi mọi phiên trong cùng transaction. Hai request dùng cùng token chỉ một request được chấp nhận. Sau đó người dùng đăng nhập lại. Không lưu token hoặc liên kết đặt lại trong log.

**M1. Tổng quan thị trường.** Bản triển khai: GET /symbols truy vấn trực tiếp symbols, daily_prices (giá SSI) và forecasts, hỗ trợ lọc sàn/ngành/thanh khoản và sắp xếp ở máy chủ; GET /market/status trả ngày giá SSI mới nhất (latestPriceDate) và ngày dự báo. Thiết kế đầy đủ: API GET /symbols trả một dòng mỗi mã từ view v_overview (giá đóng cửa, % thay đổi, GTGD bình quân 20 phiên, dự báo T+2 và T+5 mới nhất của phiên bản đang phục vụ). Lọc, sắp xếp và tìm kiếm làm ở phía client vì chỉ có 15–60 mã; phần đầu trang lấy ngày dữ liệu và giờ hoàn tất batch từ job_run (FR-M1-05). Từ GĐ2, dải thị trường (VN-Index, HNX-Index, độ rộng thị trường, tỷ lệ mã theo nhãn) lấy từ view v_market_summary làm mới cuối batch (FR-M1-06); khối "Tín hiệu đổi hôm nay" lấy các dòng v_overview có changed_t2 hoặc changed_t5 (FR-M1-07).

**M2. Forecast card và trang chi tiết.** Mỗi bản ghi forecast chứa ba xác suất (tổng bằng 1 sau softmax, làm tròn hiển thị sao cho tổng 100% ± 0,1), nhãn, ngày T, ngày đáo hạn tính từ bảng trading_calendar, cờ trạng thái dữ liệu và cờ "độ tin cậy thấp" khi xác suất cao nhất dưới 45% (RK-06). T+2 và T+5 được đánh dấu mâu thuẫn khi một bên Tăng và bên kia Giảm (FR-M2-05). Nhãn nội bộ up/hold/down được hiển thị là Tăng/Đi ngang/Giảm: API trả cả label và label_vi, giao diện, PDF và Chat chỉ dùng label_vi. Hai forecast card T+2 và T+5 đặt cạnh nhau là bố cục chính của trang (mục 8.2). Từ GĐ2, mức tin cậy 3 bậc (FR-M2-08) được tính trong batch từ xác suất lớp cao nhất (dưới 45% là thấp, 45–55% trung bình, trên 55% cao; ngưỡng cần xác nhận), hạ một bậc khi T+2 và T+5 mâu thuẫn hoặc data_status không rỗng, và lưu ở forecast.confidence. Khối "Điều gì có thể làm dự báo sai" (FR-M2-09) là 2–3 câu sinh từ quy tắc cấu hình (sắp đến lịch công bố BCTC, thiếu tin, thanh khoản thấp, T+2 và T+5 mâu thuẫn, hit rate gần đây thấp), lưu ở forecast_explanation.risk_notes, không dùng từ MUA/BÁN.

**M3. Giải thích.** C4 lưu cho mỗi dự báo: tỷ trọng 3 nhóm (tài chính, kỹ thuật, tin tức), top 15 đặc trưng kèm giá trị thô và chiều đóng góp, trọng số attention từng tin, và 3 câu tiếng Việt sinh từ mẫu. API cắt phần trả về theo vai trò ở phía server (retail: 3 câu; trader: thêm tỷ trọng nhóm; analyst: toàn bộ). Nhóm bị thiếu dữ liệu không có dòng giải thích mà thay bằng thông báo trạng thái (FR-M3-04).

**M4. Tin tức và cảm xúc.** Tin được loại trùng bằng content_hash và khóa (source, url); giao diện chỉ hiển thị tiêu đề, sapo, nguồn, thời gian, link gốc (C3 của PRD), nội dung đầy đủ chỉ dùng nội bộ cho NLP. Biểu đồ cảm xúc 30 phiên lấy từ sentiment_daily. Cut-off 15:00 được thực thi một chỗ duy nhất trong view này (FR-M4-06).

**M5. Watchlist và cảnh báo.** Giới hạn 10 mã/người được kiểm tra trong transaction của API: khóa hàng users (SELECT … FOR UPDATE) trước khi đếm để hai request đồng thời không vượt giới hạn; mã thứ 11 trả 409 WATCHLIST_LIMIT_REACHED. PUT thêm cùng mã là idempotent. Bản triển khai có cảnh báo theo mốc giá đóng cửa và cảnh báo Trade Plan, chuông thông báo (đếm chưa đọc, đánh dấu đã đọc tất cả), lịch sử 90 ngày; cảnh báo đổi nhãn và ngưỡng xác suất chờ mô hình. Ghi chú watchlist.note thuộc phần mở rộng GĐ2. Cảnh báo trong app FR-M5-02–05 là Must GĐ1 theo bảng FR: mọi R/T/A có thể đặt ngưỡng theo mã/kỳ hạn, xem đổi nhãn và lịch sử 90 ngày. C5 lưu last_state; chỉ tạo cảnh báo khi từ dưới lên đạt ngưỡng, không lặp khi còn trên ngưỡng, chỉ tái kích hoạt sau khi đã xuống dưới. event_key duy nhất theo user bảo đảm chạy lại không trùng. Giao diện poll 60 giây để hiển thị trong 5 phút sau forecast. GĐ2 thêm plan_touch và các kênh email/Telegram đã xác thực; notifier poll 30 giây, lần gửi đầu ngay, tối đa 3 lần retry sau 30, 60 và 120 giây để hỗ trợ mục tiêu 5 phút. Hết retry ghi failed; cảnh báo trong app vẫn tồn tại. Liên kết Telegram và xác thực email dùng mã một lần (FR-M5-06–08).

**M6. Lịch sử dự báo và đánh giá.** C5 điền actual_label cho dự báo đã đủ 2 hoặc 5 phiên bằng cùng quy tắc gán nhãn với lúc huấn luyện; dự báo chưa đáo hạn có actual_label rỗng và hiển thị "Đang chờ". Hit rate, precision, recall theo lớp trong cửa sổ 30/90 phiên tính bằng SQL khi gọi API. Trang Đánh giá mô hình đọc model_run.metrics của các lần huấn luyện, gồm baseline và 3 cấu hình ablation. Mỗi hit rate trả kèm n (số dự báo đã đáo hạn trong cửa sổ), cờ small_sample khi n dưới 50 và hit rate của baseline "lớp phổ biến nhất" trong cùng cửa sổ; giao diện ghi chú T+5 chồng lấn nên số mẫu độc lập ít hơn n (FR-M6-06). Retail và trader xem bản tóm tắt qua GET /models/summary (phiên bản đang phục vụ, ngày huấn luyện, hit rate tổng 30/90 phiên kèm n và baseline); confusion matrix, ablation và hiệu chỉnh chỉ dành cho analyst và admin. Từ GĐ2, evaluate.py thêm Brier score, ECE và dữ liệu reliability diagram vào model_run.metrics.calibration (FR-M6-07).

M7. Quản trị và vận hành mô hình. Admin tạo tài khoản với email hợp lệ, chưa tồn tại và mật khẩu đạt FR-M0-06; khóa/mở khóa, đổi vai trò, đặt lại mật khẩu và thu hồi phiên. Khóa hoặc đổi vai trò thu hồi tất cả phiên cùng transaction, request tiếp theo nhận 401; lần đăng nhập mới dùng vai trò mới (AC-27/29). Khóa hàng quản trị trước khi đếm Admin đang hoạt động, chặn khóa hoặc hạ quyền nếu làm mất Admin hoạt động cuối cùng (UC-12). Không có endpoint Admin đọc Portfolio, Trade Plan hay Journal của người dùng.

Nguồn dữ liệu và pipeline (US-13/UC-13, US-24/UC-24): Admin xem nguồn, mã job, thời điểm, trạng thái, số bản ghi và lỗi; chạy lại ghi job_run queued. Scheduler chạy sau 15:30 theo Asia/Ho_Chi_Minh và trading_calendar. Worker dùng khóa advisory theo batch ngày hoặc job/ngày, không chạy trùng; GET trạng thái không trực tiếp khởi chạy mô hình. Ghim model_version lúc bắt đầu batch; đổi hoặc rollback chỉ có hiệu lực từ batch kế tiếp (AC-16). Mỗi bước ghi job_run và liên kết parent_job_id; lỗi giá sau retry giữ forecast cũ và báo stale, không sinh mới (AC-28). FR-M7-08 bổ sung thông báo vận hành bằng ops_event; không ghi chung với cảnh báo tài chính của người dùng.

Audit đầu vào và tái lập (US-10/UC-10, FR-M7-09/10): Analyst/Admin đọc giá, đặc trưng kỹ thuật, BCTC và metadata tin đã dùng từ snapshot cố định; không đọc từ các view hiện tại để thay thế. API tạo forecast_replay queued, worker chạy đúng model_version và snapshot, ghi xác suất chạy lại, sai số tuyệt đối lớn nhất và kết quả pass khi < 1e-4. Thiếu snapshot, embedding hoặc checkpoint trả not_reproducible và ghi log. Không ghi đè forecast, không sinh cảnh báo hay làm mới view từ replay.

Nhật ký quản trị (US-25/UC-25, FR-M7-05/11): mỗi sự kiện gồm thời điểm, actor, action, target, before/after đã lọc bí mật và outcome success/denied/failed. Ghi nhật ký tạo tài khoản, khóa/mở khóa, đổi vai trò, đặt lại mật khẩu, thu hồi phiên, chạy lại job, chọn/rollback mô hình. API Admin lọc theo thời gian, người thực hiện, action và target, sắp mới nhất trước, có phân trang; vai trò khác trả 403, không có API sửa/xóa. Trigger CSDL từ chối UPDATE/DELETE; giữ tối thiểu 90 ngày. Log gửi và Chat chỉ hiển thị phần được phép; tài khoản demo chứa dữ liệu mẫu do Admin tạo.

**M8. Screener (GĐ2).** Bản triển khai: GET /screener lọc trực tiếp trên symbols và daily_prices theo sàn, ngành, giá, % thay đổi, thanh khoản 20 phiên; điều kiện theo nhãn, xác suất, hit rate chờ mô hình. Thiết kế đầy đủ: GET /screener lọc trên view v_screener (materialized view làm mới cuối batch, gộp v_overview với mức tin cậy, hit rate 90 phiên kèm n, cờ đổi nhãn và data_status) bằng truy vấn tham số hóa, chỉ nhận các cột và toán tử trong danh sách trắng (FR-M8-01, 02, 05). Bộ lọc có sẵn cho retail là hằng số trong mã (FR-M8-03); trader và analyst lưu bộ lọc có tên vào saved_screen, tối đa 20 mỗi người (FR-M8-04). Thứ tự mặc định là thanh khoản giảm dần chứ không phải xác suất, và trang luôn hiển thị tuyên bố, để kết quả là danh sách sàng lọc chứ không phải bảng xếp hạng "nên mua" (FR-M8-07). Mỗi dòng có liên kết thêm watchlist, mở chi tiết mã và lập Trade Plan với mã đã chọn (FR-M8-06). Kiểm thử đối chiếu API với truy vấn SQL viết tay trên 5 bộ lọc mẫu (AC-17).

**M9. Portfolio (GĐ2).** Giao dịch lưu trong portfolio_transactions (mua/bán, khối lượng, giá, phí, nguồn manual hoặc csv); vị thế không lưu mà được tính khi gọi API theo giá vốn bình quân gia quyền, lãi/lỗ đã thực hiện khi bán và lãi/lỗ tạm tính theo giá đóng cửa gần nhất trong price_daily (FR-M9-03); dùng thống nhất theo FR-M9-03; việc ghi giao dịch điều chỉnh còn cần chốt (mục 12.4). API từ chối giao dịch bán vượt khối lượng đang nắm tại ngày đó. Import CSV (trader, analyst) gồm hai bước: giao diện đọc tệp và hiển thị bản xem trước; khi người dùng xác nhận, POST /portfolio/transactions/import ghi các dòng hợp lệ trong một transaction và trả danh sách dòng bị bỏ qua (lỗi hoặc trùng) kèm số dòng và lý do (FR-M9-02, AC-18). Mỗi vị thế kèm nhãn T+2/T+5 hiện tại và dấu đổi nhãn lấy từ v_overview, không kèm khuyến nghị (FR-M9-04). Tổng quan danh mục và giá trị theo thời gian (FR-M9-05) tính theo yêu cầu từ giao dịch và price_daily. Chia tách và cổ tức bằng cổ phiếu chưa được tự điều chỉnh; người dùng nhập giao dịch điều chỉnh (mục 12.1). DELETE /portfolio xóa toàn bộ giao dịch của người dùng và chỉ ghi audit_log hành động, không ghi nội dung (FR-M9-06). Không có mã nào gọi API công ty chứng khoán.

**M10. Trade Plan (GĐ2).** Kế hoạch lưu ở trade_plans, lịch sử sửa ở trade_plan_revisions; giá vào, cắt lỗ, mục tiêu do người dùng nhập và biểu mẫu không điền sẵn các giá trị này (FR-M10-01). Giao diện chỉ tạo kế hoạch mua (long) vì cổ phiếu cơ sở không bán khống; cột side và hàm tính vẫn hỗ trợ short cho mở rộng. Toàn bộ vùng vào phải nằm giữa cắt lỗ và mục tiêu, API kiểm tra trước khi lưu. Khi lưu, API sao chép nhãn và xác suất T+2/T+5, phiên bản mô hình và snapshot_hash của dự báo mới nhất vào cột snapshot (kèm forecast_id_t2, forecast_id_t5); trigger từ chối UPDATE các cột này và role api không có quyền DELETE trên trade_plan (FR-M10-02, AC-19). R:R = (mục tiêu − giá vào) / (giá vào − cắt lỗ) với giá vào tham chiếu là cận bất lợi của vùng vào (cận trên với lệnh mua), để R:R và khối lượng không bị đánh giá quá lạc quan; khối lượng tối đa = vốn × mức rủi ro % / (giá vào − cắt lỗ), không vượt vốn / giá vào, làm tròn xuống theo lô 100 (FR-M10-03, 04; ví dụ AC-19: 100 triệu, 1%, giá vào 25.000, cắt lỗ 23.500 cho 600 cổ phiếu, R:R 2,0). Hàm tính viết một lần trong packages/core (calculateRiskReward, tính bằng số nguyên theo bước giá để tránh sai số số thực) và được dùng chung cho biểu mẫu web và API, nên số xem trước khớp số lưu. Bản rút gọn của retail chỉ khác ở biểu mẫu và quyền: API từ chối capital_vnd và risk_pct từ retail, POST /plans/calc cho retail tính R:R và khoảng cách %, chỉ trader và analyst tính thêm khối lượng. Trạng thái nháp → chờ vào → đang mở → đã đóng; chỉ người dùng xác nhận chuyển trạng thái, C5 chỉ ghi gợi ý vào suggested khi giá đóng cửa chạm mốc (FR-M10-05). Cảnh báo kế hoạch (FR-M10-06) là quy tắc alert_rule loại plan_touch, được bước plans của batch đánh giá (chạm vùng vào, cắt lỗ, mục tiêu, hoặc nhãn dự báo hiện tại ngược snapshot) và đi qua cùng cơ chế thông báo của M5. Khi đóng, người dùng nhập giá thoát và ghi chú; API đóng kế hoạch và tạo Journal trong cùng một transaction (FR-M10-07). Lịch sử chỉnh sửa nằm ở bảng trade_plan_revisions, chỉ thêm (FR-M10-09); tuyên bố "Trade Plan do bạn tự lập" hiện trên trang và trong PDF (FR-M10-08).

**M11. Journal (GĐ2).** Bản ghi journal_entry được API tạo trong cùng transaction với việc đóng Trade Plan; ràng buộc UNIQUE (plan_id) cùng INSERT ... ON CONFLICT DO NOTHING bảo đảm đóng lại lần hai không tạo bản ghi trùng (FR-M11-01, AC-20). Bản ghi sao chép snapshot và kế hoạch gốc (không sửa được), kèm giá thoát, lãi/lỗ % và số phiên nắm giữ; nhãn thực tế T+2/T+5 tương ứng được C5 điền ở bước resolve khi đáo hạn. Cột alignment so sánh quyết định với dự báo theo quy tắc đề xuất (cần xác nhận): with khi có ít nhất một kỳ hạn Tăng và không kỳ hạn nào Giảm, against khi có ít nhất một kỳ hạn Giảm và không kỳ hạn nào Tăng, mixed khi một kỳ hạn Tăng và một kỳ hạn Giảm, neutral khi cả hai Đi ngang (FR-M11-03). Người dùng sửa ghi chú, thẻ và bài học nhưng không sửa snapshot và kết quả (FR-M11-02). Ghi thủ công không có kế hoạch (kind = manual, FR-M11-04) được gắn dự báo của ngày đó. Thống kê nhìn lại theo tuần, tháng, quý tính bằng SQL kèm số mẫu và cờ small_sample (FR-M11-06). Chỉ chủ sở hữu đọc được nhật ký; admin không có endpoint đọc nội dung (FR-M11-07).

**M12. Chat hỏi đáp (GĐ2).** Bản triển khai: tạo, liệt kê, xóa phiên và xem tin nhắn đã có; gửi câu hỏi trả 503 CHAT_MODEL_NOT_READY và không lưu nội dung cho đến khi có mô hình. Thiết kế đầy đủ: POST /chat/sessions/{id}/messages được api chuyển tới dịch vụ chat (C11) kèm user_id đã xác thực; quy trình và các lớp bảo vệ nằm ở mục 5.3. Hội thoại lưu ở chat_session và chat_message, giữ 90 ngày (FR-M12-07); lượt hỏi về dữ liệu cá nhân được đánh dấu personal để che nội dung khi analyst hoặc admin xem log.

**M13. Báo cáo và xuất PDF (GĐ2).** Các endpoint /reports/... (mục 8.1) gọi chính các hàm truy vấn và tính toán của màn hình tương ứng rồi dàn trang bằng pdfkit (C10), nên số liệu trong PDF khớp màn hình (FR-M13-06, AC-23). Mỗi PDF có tuyên bố "không phải tư vấn đầu tư", thời điểm tạo, ngày dữ liệu, phiên bản mô hình và số trang (FR-M13-05); font Unicode được nhúng để hiển thị tiếng Việt, thanh xác suất vẽ bằng nét vẽ của thư viện, không cần trình duyệt. Báo cáo cá nhân (danh mục, Trade Plan, Journal) lấy user_id từ phiên đăng nhập. Việc sinh PDF chạy đồng bộ, tối đa 2 yêu cầu song song, hết hạn sau 10 giây (NFR-16) và không lưu tệp trên máy chủ.

**M14. Ứng dụng mobile (GĐ3).** C12 gọi cùng /api/v1 như web; điểm khác duy nhất ở API là đăng nhập trả token trong thân phản hồi cho client=mobile. Màn hình cốt lõi, xác thực và phân phối nằm ở mục 8.3.

### 5.3 Thiết kế Chat hỏi đáp (C11)

Mục này là thiết kế cho giai đoạn sau (chưa triển khai). Chat là thành phần duy nhất gọi mô hình ngôn ngữ theo yêu cầu của người dùng, nên thiết kế xoay quanh một nguyên tắc: mô hình chỉ diễn đạt dữ liệu đã truy xuất, và mọi số liệu trong câu trả lời phải đối chiếu được với dữ liệu đó.

**Nhận câu hỏi:** api kiểm tra phiên, vai trò và hạn mức, rồi gọi POST /ask của chat trong mạng nội bộ Docker với user_id, session_id, câu hỏi và 6 lượt hội thoại gần nhất; chat không nhận danh tính từ trình duyệt.

**Bộ chặn đầu vào:** quy tắc từ khóa và mẫu câu (nên mua, bán, đặt lệnh, giá mục tiêu, mua bao nhiêu...) nhận ra yêu cầu lệnh hoặc tư vấn cá nhân hóa và trả thông điệp cố định kèm gợi ý xem dự báo, giải thích hoặc Trade Plan của chính người dùng, không gọi mô hình ngôn ngữ (FR-M12-03).

**Truy xuất:** nhận diện mã (trong company.in_universe), kỳ hạn, ngày và nhóm ý định (dự báo, lý do, tin tức, lịch sử/hit rate, thuật ngữ, dữ liệu cá nhân); mỗi nhóm ứng với một hàm truy vấn tham số hóa chạy bằng role CSDL chỉ đọc có RLS và user_id của phiên. Kết quả là các bản ghi dữ kiện có mã tham chiếu (ví dụ forecast:18342, news:5521). Không có dữ liệu thì trả lời "Hệ thống không có dữ liệu này" mà không gọi mô hình ngôn ngữ (FR-M12-02).

**Diễn đạt:** LLMClient nhận dữ kiện cùng chỉ dẫn hệ thống (chỉ dùng dữ kiện, mỗi câu có số liệu phải ghi mã tham chiếu, không nêu giá mục tiêu hay khuyến nghị) và trả câu trả lời kèm danh sách tham chiếu. Hạn gọi 6 giây; quá hạn hoặc lỗi thì dùng câu trả lời mẫu dựng thẳng từ dữ kiện, như câu giải thích cho retail ở mục 7.6.

**Kiểm tra đầu ra:** mọi số, ngày và nhãn trong câu trả lời phải có trong dữ kiện đã truy xuất; mỗi câu có số liệu phải có tham chiếu hợp lệ; quét từ cấm (MUA, BÁN, khuyến nghị, giá mục tiêu do mô hình nêu). Vi phạm thì bỏ câu trả lời, dùng bản mẫu hoặc thông điệp từ chối và ghi sự kiện bị chặn vào chat_message.blocked (FR-M12-04). Nhãn hiển thị là "Đi ngang", không phải "Giữ".

**Trích dẫn và tuyên bố:** mã tham chiếu được đổi thành liên kết tới màn hình tương ứng (tab Dự báo của mã, bài tin gốc, Trade Plan của chính người dùng) kèm ngày dữ liệu; khung chat luôn hiện tuyên bố "không phải tư vấn đầu tư" (FR-M12-06).

**Dữ liệu cá nhân:** chỉ nạp khi ý định là dữ liệu cá nhân, và ngữ cảnh gửi mô hình ngôn ngữ không có email hay tên. Khi dùng API ngoài, câu hỏi cá nhân mặc định được trả lời bằng bản mẫu, không qua mô hình ngôn ngữ (cờ cấu hình chat.personal_via_llm = false) cho đến khi chốt chính sách ở mục 12.4 (FR-M12-05).

**Chi phí và log:** trần số lượt gọi theo người dùng và theo ngày; câu trả lời không cá nhân được cache theo (ý định, mã, ngày dữ liệu, phiên bản mô hình). Mỗi lượt ghi vào chat_message (câu hỏi, tham chiếu, kết quả lọc, tên mô hình, độ trễ); analyst và admin xem được log nhưng nội dung lượt hỏi cá nhân bị che, và job dọn dẹp xóa sau 90 ngày (FR-M12-07).

**Bộ kiểm thử chống bịa:** tệp YAML tối thiểu 50 câu hỏi có đáp án đối chiếu với CSDL mẫu và 20 câu bẫy (đòi lệnh, mã ngoài phạm vi, dữ liệu không tồn tại, dữ liệu của người khác); chạy tự động với mô hình thật và mô hình giả, ghi báo cáo trước mỗi lần phát hành (FR-M12-08, AC-21, AC-22).

## 6. Thiết kế dữ liệu

CSDL là PostgreSQL 17 (image postgres:17-alpine). Lược đồ có hiệu lực là db/migrations/001–020, chạy bằng npm run db:migrate; khóa chính của bảng người dùng và dữ liệu cá nhân là uuid. Mọi timestamp dùng timestamptz và hiển thị Asia/Ho_Chi_Minh. Mục 6.1 và 6.2 giữ thiết kế logic ban đầu (gồm các bảng cho mô hình AI chưa triển khai); bảng dưới đây ánh xạ tên thiết kế sang tên bảng thật.

| Tên trong thiết kế | Bảng triển khai | Migration |
| --- | --- | --- |
| app_user, auth_session | users, auth_sessions | 001 |
| company, price_daily | symbols (thêm industry ở 020), daily_prices | 001, 020 |
| index_daily, v_market_summary | market_batches, market_indices, market_summary (dữ liệu mẫu) | 001 |
| forecast | forecasts (dữ liệu mẫu đến khi có mô hình) | 001 |
| document, document_symbol | news_items, news_item_symbols | 001, 004 |
| audit_log | admin_audit_log (event_type, details jsonb) | 002 |
| job_run | data_ingestion_runs (lần nạp dữ liệu), admin_job_runs (hàng đợi job), admin_worker_instances (heartbeat) | 003, 016, 017 |
| watchlist, alert_rule, alert | watchlist_items, alert_rules, user_alerts | 005, 020 |
| saved_screen | saved_screener_filters | 006 |
| portfolio_tx | portfolio_transactions | 007 |
| trade_plan, journal_entry | trade_plans, trade_plan_revisions, journal_entries | 008, 009, 020 |
| hồ sơ đầu tư trên app_user | investment_profiles | 010 |
| chat_session, chat_message | chat_sessions, chat_messages | 011 |
| notify_channel, notification | notification_preferences, notification_channels, notification_outbox | 012–014 |
| password_reset_token | password_reset_tokens, password_reset_requests | 015 |
| (đăng ký) | email_verification_tokens, registration_requests, user_consent, role_requests | 018, 019 |
| security_event, auth_mail_outbox, ops_event | chưa có bảng riêng: sự kiện bảo mật ghi vào admin_audit_log và log Fastify; thư xác thực gửi trực tiếp qua SMTP; lỗi job báo Admin bằng user_alerts kèm email/Telegram | — |
| trading_calendar, financial_*, sentiment, feature_daily, model_version, forecast_explanation, forecast_input, forecast_replay | chưa triển khai (cần mô hình AI) | — |

### 6.1 Nhóm bảng

| Nhóm | Bảng / view | Nguồn | Ghi chú |
| --- | --- | --- | --- |
| Danh mục | company, trading_calendar (mới) | Có sẵn | Thêm cột company.in_universe; lịch nghỉ lễ để tính ngày đáo hạn T+2/T+5 |
| Thị trường | price_daily, index_daily | Có sẵn | Thêm mã chỉ số HNX, HNX30 |
| Báo cáo tài chính | financial_report, financial_item, financial_ratio | Có sẵn | published_at là mốc point-in-time |
| Văn bản | document, document_symbol | Có sẵn | raw giữ HTML gốc để trích xuất lại |
| NLP | nlp_model, sentiment, doc_embedding (mới) | Có sẵn + mới | Thêm cột sentiment.label; nhãn tay là model human |
| Đặc trưng | feature_daily, sentiment_daily, label_daily (mới) | Materialized view | Làm mới sau mỗi batch |
| Thí nghiệm | dataset, model_run, model_version (mới) | Có sẵn + mới | model_version là bản đã đăng ký để phục vụ |
| Dự báo | forecast, forecast_explanation, forecast_input (mới) | Mới | Chỉ thêm, không sửa xác suất sau khi ghi |
| Ứng dụng | app_user, watchlist, alert_rule, alert (mới) | Mới | GĐ2 thêm cột hồ sơ đầu tư và is_demo vào app_user, note vào watchlist, loại quy tắc mới vào alert_rule (mục 6.2); alert.event_key chống tạo trùng |
| Vận hành | job_run, audit_log | Mới | Mã job, quan hệ batch/bước; before/after, outcome và log quản trị chỉ thêm |
| Tổng hợp (view) | v_overview (mới, GĐ1); v_market_summary, v_screener (mới, GĐ2) | Materialized view | Làm mới cuối batch ở bước forecast |
| Danh mục và kế hoạch (GĐ2) | portfolio_tx, trade_plan, journal_entry (mới) | Mới | Dữ liệu cá nhân, bật RLS theo user_id; snapshot của trade_plan không sửa được |
| Bộ lọc và thông báo (GĐ2) | saved_screen, notify_channel, notification (mới) | Mới | notification vừa là hàng đợi gửi vừa là nhật ký gửi |
| Chat (GĐ2) | chat_session, chat_message (mới) | Mới | Giữ 90 ngày; nội dung lượt hỏi cá nhân bị che khi analyst, admin xem log |
| Xác thực GĐ1 | auth_session, password_reset_token, security_event, auth_mail_outbox | Mới | Thu hồi phiên, khóa tạm, đặt lại email, log bảo mật; mail outbox cho FR-M0-07 |
| Đăng ký và vai trò GĐ1 | email_verification_tokens, registration_requests, user_consent, role_requests; cột mới của app_user (full_name, email_verified_at, age_confirmed_at, created_via) | Mới (migration 018, 019) | Xác thực email, giới hạn tần suất đăng ký, bằng chứng đồng ý, yêu cầu nâng quyền Analyst (FR-M0-08..14) |
| Tái lập và vận hành GĐ1 | forecast_replay, ops_event | Mới | Kết quả replay tách forecast gốc; thông báo lỗi job cho Admin |

### 6.2 Lược đồ bổ sung

ALTER TABLE company   ADD COLUMN in_universe boolean NOT NULL DEFAULT false;

ALTER TABLE sentiment ADD COLUMN label text CHECK (label IN ('pos', 'neu', 'neg'));

CREATE TABLE trading_calendar (d date PRIMARY KEY, is_trading boolean NOT NULL);

CREATE TABLE doc_embedding (

doc_id   bigint REFERENCES document ON DELETE CASCADE,

model_id int REFERENCES nlp_model,

vec      bytea NOT NULL,              -- float16 x 768

PRIMARY KEY (doc_id, model_id)

);

CREATE TABLE model_version (

id             int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

model_run_id   int NOT NULL REFERENCES model_run,

code           text NOT NULL UNIQUE,  -- 'mm-2026.11.02-a'

sentiment_model_id int REFERENCES nlp_model,

checkpoint_uri text NOT NULL,

config         jsonb NOT NULL,        -- cấu hình, seed, phiên bản thư viện

is_serving     boolean NOT NULL DEFAULT false,

registered_at  timestamptz NOT NULL DEFAULT now()

);

CREATE UNIQUE INDEX ON model_version (is_serving) WHERE is_serving;

CREATE TABLE forecast (

id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

symbol        text NOT NULL REFERENCES company,

d             date NOT NULL,           -- ngày dữ liệu T

horizon       smallint NOT NULL CHECK (horizon IN (2, 5)),

due_on        date NOT NULL,           -- T+h theo trading_calendar

model_version_id int NOT NULL REFERENCES model_version,

p_up real NOT NULL, p_hold real NOT NULL, p_down real NOT NULL,

label         text NOT NULL CHECK (label IN ('up', 'hold', 'down')),          -- hold hiển thị là "Đi ngang"

low_confidence boolean NOT NULL,       -- max(p) < 0.45

data_status   text[] NOT NULL DEFAULT '{}',  -- 'missing_news', 'missing_fin', 'stale'

snapshot_hash bytea NOT NULL,          -- sha256 tensor đầu vào

job_run_id    bigint,                  -- FK tới job_run, thêm bằng ALTER sau khi tạo job_run

created_at    timestamptz NOT NULL DEFAULT now(),

actual_return real,                    -- C5 điền khi đáo hạn

actual_label  text CHECK (actual_label IN ('up', 'hold', 'down')),

UNIQUE (symbol, d, horizon, model_version_id)

);

CREATE TABLE forecast_explanation (

forecast_id    bigint PRIMARY KEY REFERENCES forecast ON DELETE CASCADE,

group_share    jsonb NOT NULL,  -- {"fin": .2, "tech": .5, "news": .3}

top_features   jsonb NOT NULL,  -- [{"name","group","value","contrib"}] x 15

news_attention jsonb,           -- [{"doc_id", "weight"}]

retail_text    text[] NOT NULL  -- 3 câu sinh từ mẫu

);

CREATE TABLE forecast_input (

snapshot_hash bytea PRIMARY KEY,

tensors       bytea NOT NULL     -- npz nén: đủ để chạy lại (NFR-06)

);

CREATE TABLE app_user (

id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

email         text NOT NULL UNIQUE,

password_hash text NOT NULL,     -- scrypt$salt$key (thiết kế ban đầu: bcrypt)

role          text NOT NULL CHECK (role IN ('retail', 'trader', 'analyst', 'admin')),

locked        boolean NOT NULL DEFAULT false,

must_change_password boolean NOT NULL DEFAULT false,

fail_count smallint NOT NULL DEFAULT 0 CHECK (fail_count >= 0),

fail_window_started_at timestamptz,

locked_until timestamptz,

password_changed_at timestamptz,

created_at    timestamptz NOT NULL DEFAULT now()

);

CREATE TABLE watchlist (

user_id  bigint REFERENCES app_user ON DELETE CASCADE,

symbol   text REFERENCES company,

added_at timestamptz NOT NULL DEFAULT now(),

PRIMARY KEY (user_id, symbol)

);                                 -- trigger chặn dòng thứ 11

CREATE TABLE alert_rule (

id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

user_id    bigint NOT NULL REFERENCES app_user ON DELETE CASCADE,

symbol     text NOT NULL REFERENCES company,

horizon    smallint NOT NULL CHECK (horizon IN (2, 5)),

kind       text NOT NULL CHECK (kind IN ('label_change', 'prob_threshold')),

cls        text CHECK (cls IN ('up', 'hold', 'down')),

threshold  real CHECK (threshold BETWEEN 0 AND 1),

last_state boolean NOT NULL DEFAULT false  -- đang trên ngưỡng?

);

CREATE TABLE alert (

id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

user_id     bigint NOT NULL REFERENCES app_user ON DELETE CASCADE,

rule_id     bigint REFERENCES alert_rule ON DELETE SET NULL,

event_key   text NOT NULL,      -- 'label_change:42:2026-10-07': duy nhất theo người dùng

forecast_id bigint NOT NULL REFERENCES forecast,

message     text NOT NULL,      -- 'FPT T+2: Đi ngang → Tăng'

created_at  timestamptz NOT NULL DEFAULT now(),

read_at     timestamptz,

UNIQUE (user_id, event_key)

);                                  -- xóa sau 90 ngày

CREATE TABLE job_run (

id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

job          text NOT NULL,     -- 'prices', 'news', 'financials', 'sentiment', 'forecast', ...

status       text NOT NULL CHECK (status IN ('queued', 'running', 'ok', 'failed')),

attempt      smallint NOT NULL DEFAULT 1,

parent_job_id bigint REFERENCES job_run,

business_date date,

model_version_id int REFERENCES model_version,

triggered_by text NOT NULL,     -- 'schedule' hoặc 'user:<id>'

started_at   timestamptz, finished_at timestamptz,

rows_written int, error text

);

CREATE TABLE audit_log (

id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

at       timestamptz NOT NULL DEFAULT now(),

actor    text NOT NULL,         -- 'user:<id>' hoặc 'job:<job_run_id>'

action   text NOT NULL,         -- 'set_role', 'serve_model', 'forecast_batch', ...

target   text,

before_value jsonb NOT NULL DEFAULT '{}',

after_value jsonb NOT NULL DEFAULT '{}',

outcome text NOT NULL CHECK (outcome IN ('success', 'denied', 'failed')),

detail   jsonb NOT NULL DEFAULT '{}'

);

CREATE INDEX ON audit_log (at DESC, id DESC);

CREATE INDEX ON audit_log (actor, at DESC);

CREATE INDEX ON audit_log (action, at DESC);

Đăng ký và vòng đời vai trò (FR-M0-08..14). Lược đồ dưới đây chép theo bản triển khai db/migrations/018_self_registration.sql và 019_role_management.sql; trong mã, bảng app_user tên là users, khóa chính kiểu uuid, nhật ký quản trị là admin_audit_log.

ALTER TABLE users
  ADD COLUMN full_name text,
  ADD COLUMN email_verified_at timestamptz,          -- NULL = chưa xác thực; tài khoản cũ, do Admin, seed hoặc bootstrap tạo được đặt sẵn
  ADD COLUMN age_confirmed_at timestamptz,
  ADD COLUMN created_via text NOT NULL DEFAULT 'admin';  -- giá trị dùng: self_register, admin, bootstrap

CREATE TABLE email_verification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,                -- SHA-256, không lưu token thô
  expires_at timestamptz NOT NULL,                    -- tạo + 24 giờ
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE registration_requests (                  -- đếm tần suất đăng ký và gửi lại, giữ 24 giờ
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email_key char(64) NOT NULL,                        -- HMAC-SHA256 của email chuẩn hóa
  ip_key char(64) NOT NULL,                           -- HMAC-SHA256 của IP
  kind text NOT NULL CHECK (kind IN ('register', 'resend')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_consent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doc_type text NOT NULL,                             -- terms_of_service, privacy_notice, trader_terms
  version text NOT NULL,                              -- CONSENT_VERSION, hiện '2026-10-23'
  channel text NOT NULL,                              -- 'web'
  accepted_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE role_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_role text NOT NULL CHECK (requested_role = 'analyst'),
  organization text NOT NULL,
  position text NOT NULL,
  work_email text NOT NULL,
  purpose text NOT NULL,
  status text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected')),
  decided_by uuid REFERENCES users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  note text,                                          -- lý do từ chối hoặc ghi chú duyệt
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX role_requests_one_pending_idx ON role_requests(user_id) WHERE status = 'pending_review';

Mọi bảng dữ liệu cá nhân tham chiếu users(id) ON DELETE CASCADE, còn admin_audit_log và admin job tham chiếu ON DELETE SET NULL; vì vậy DELETE /me xóa dữ liệu cá nhân và giữ nhật ký ở dạng ẩn danh (FR-M0-13).

Chưa triển khai so với PRD (FR-M0-15, BR-R13): không có trạng thái awaiting_email (chưa xác nhận email cơ quan bằng thư) và chưa ghi đồng ý Điều khoản Analyst thành bản ghi riêng (FR-M0-15).

GĐ1 bổ sung các bảng phục vụ FR-M0-01–07 và FR-M7-07–11. auth_mail_outbox hỗ trợ đặt lại email khi FR-M0-07 được triển khai, độc lập với notifier cảnh báo GĐ2. Schema dưới đây lưu hash token; token thô chỉ tồn tại trong thư chờ gửi được bảo vệ và bị xóa ngay sau khi gửi. Các role không được truy vấn bảng phiên, token hoặc outbox từ API nghiệp vụ.

CREATE TABLE auth_session (

sid uuid PRIMARY KEY,  -- bản triển khai: auth_sessions lưu token_hash (SHA-256), không dùng JWT

user_id bigint NOT NULL REFERENCES app_user ON DELETE CASCADE,

created_at timestamptz NOT NULL DEFAULT now(),

expires_at timestamptz NOT NULL,

revoked_at timestamptz,

revoke_reason text,

CHECK (expires_at > created_at),

CHECK (expires_at <= created_at + interval '24 hours')

);

CREATE INDEX ON auth_session (user_id) WHERE revoked_at IS NULL;

CREATE TABLE password_reset_token (

token_hash bytea PRIMARY KEY,

user_id bigint NOT NULL REFERENCES app_user ON DELETE CASCADE,

created_at timestamptz NOT NULL DEFAULT now(),

expires_at timestamptz NOT NULL,

used_at timestamptz,

CHECK (expires_at > created_at),

CHECK (expires_at <= created_at + interval '30 minutes')

);

CREATE TABLE security_event (

id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

at timestamptz NOT NULL DEFAULT now(),

user_id bigint REFERENCES app_user ON DELETE SET NULL,

action text NOT NULL,

outcome text NOT NULL,

request_id text,

detail jsonb NOT NULL DEFAULT '{}'  -- không mật khẩu/token

);

CREATE TABLE auth_mail_outbox (

id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

reset_token_hash bytea NOT NULL REFERENCES password_reset_token,

recipient text NOT NULL,

encrypted_payload bytea,  -- AES-GCM; khóa ngoài CSDL

status text NOT NULL DEFAULT 'pending'

CHECK (status IN ('pending', 'sent', 'failed', 'expired')),

attempts smallint NOT NULL DEFAULT 0,

next_try_at timestamptz NOT NULL DEFAULT now(),

created_at timestamptz NOT NULL DEFAULT now(),

sent_at timestamptz,

UNIQUE (reset_token_hash)

);

CREATE TABLE forecast_replay (

id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

forecast_id bigint NOT NULL REFERENCES forecast,

requested_by bigint NOT NULL REFERENCES app_user,

requested_at timestamptz NOT NULL DEFAULT now(),

status text NOT NULL DEFAULT 'queued'

CHECK (status IN ('queued', 'running', 'done', 'failed', 'not_reproducible')),

model_version_id int NOT NULL REFERENCES model_version,

snapshot_hash bytea NOT NULL,

replay_probs jsonb,

max_abs_error double precision,

passed boolean,

error_code text,

finished_at timestamptz

);

CREATE TABLE ops_event (

id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

job_run_id bigint REFERENCES job_run,

event_key text NOT NULL UNIQUE,

kind text NOT NULL,  -- pipeline_failed, model_drift

message text NOT NULL,  -- thông tin vận hành đã lọc bí mật

created_at timestamptz NOT NULL DEFAULT now(),

notify_status text NOT NULL DEFAULT 'pending'

CHECK (notify_status IN ('pending', 'sent', 'failed')),

attempts smallint NOT NULL DEFAULT 0,

next_try_at timestamptz NOT NULL DEFAULT now()

);

ALTER TABLE forecast ADD CONSTRAINT forecast_job_fk

FOREIGN KEY (job_run_id) REFERENCES job_run;

ALTER TABLE forecast ADD CONSTRAINT forecast_probs_valid CHECK (

p_up BETWEEN 0 AND 1 AND p_hold BETWEEN 0 AND 1

AND p_down BETWEEN 0 AND 1

AND abs(p_up + p_hold + p_down - 1) < 0.0001);

ALTER TABLE forecast ADD CONSTRAINT forecast_input_fk

FOREIGN KEY (snapshot_hash) REFERENCES forecast_input;

CREATE FUNCTION reject_log_mutation() RETURNS trigger

LANGUAGE plpgsql AS $$

BEGIN

RAISE EXCEPTION 'append-only log';

END;

$$;

CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON audit_log

FOR EACH ROW EXECUTE FUNCTION reject_log_mutation();

CREATE TRIGGER security_append_only BEFORE UPDATE OR DELETE ON security_event

FOR EACH ROW EXECUTE FUNCTION reject_log_mutation();

REVOKE UPDATE, DELETE, TRUNCATE ON audit_log, security_event FROM app_api;

CREATE FUNCTION enforce_watchlist_limit() RETURNS trigger

LANGUAGE plpgsql AS $$

BEGIN

PERFORM 1 FROM app_user WHERE id = NEW.user_id FOR UPDATE;

IF NOT EXISTS (SELECT 1 FROM watchlist

WHERE user_id = NEW.user_id AND symbol = NEW.symbol)

AND (SELECT count(*) FROM watchlist WHERE user_id = NEW.user_id) >= 10

THEN

RAISE EXCEPTION 'watchlist_limit_10';

END IF;

RETURN NEW;

END;

$$;

CREATE TRIGGER watchlist_limit BEFORE INSERT ON watchlist

FOR EACH ROW EXECUTE FUNCTION enforce_watchlist_limit();

-- app_api không được UPDATE user_id/symbol của watchlist.

-- Thêm mã dùng INSERT ON CONFLICT DO NOTHING, xóa rồi thêm khi đổi mã.

Quyền CSDL (thiết kế RLS, chưa áp dụng ở bản triển khai — xem D13): role API không phải owner, không có BYPASSRLS; role Chat chỉ đọc dữ liệu được phép. Quyền phiên, hash mật khẩu và token chỉ cấp cho store xác thực, không cho endpoint chung. REVOKE UPDATE/DELETE/TRUNCATE log áp dụng cả các role worker/chat/notifier; chủ CSDL giữ quyền bảo trì và không dùng để phục vụ request. Truy vấn RLS dùng current_setting('app.user_id', true), trường hợp không có user_id trả 0 dòng; SET LOCAL chỉ đặt sau khi middleware xác thực và trong transaction riêng để không rò ngữ cảnh giữa kết nối pool. Việc thu hồi phiên và đổi tài khoản khóa hàng app_user để tránh đua với đăng nhập.

Các thay đổi của GĐ2 nằm trong migration riêng của db/migrations, chạy sau các bảng GĐ1. Khi bật RLS, mỗi giao dịch của api đặt SET LOCAL app.user_id từ phiên; worker và notifier dùng role riêng không dùng cho truy vấn nội dung cá nhân.

-- GĐ2: migration riêng, chạy sau các bảng GĐ1

ALTER TABLE app_user

ADD COLUMN capital_vnd  bigint CHECK (capital_vnd > 0),          -- hồ sơ đầu tư, người dùng tự nhập

ADD COLUMN max_risk_pct real CHECK (max_risk_pct > 0 AND max_risk_pct <= 100),

ADD COLUMN is_demo      boolean NOT NULL DEFAULT false;          -- tài khoản demo dùng chung

ALTER TABLE watchlist ADD COLUMN note text;

ALTER TABLE forecast ADD COLUMN confidence text CHECK (confidence IN ('low', 'mid', 'high'));

ALTER TABLE forecast_explanation ADD COLUMN risk_notes text[] NOT NULL DEFAULT '{}';  -- "điều gì có thể làm dự báo sai"

CREATE TABLE saved_screen (

id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

user_id bigint NOT NULL REFERENCES app_user ON DELETE CASCADE,

name    text NOT NULL,

params  jsonb NOT NULL,          -- {"horizon": 2, "label": "up", "p_min": 0.6, "exchange": "HOSE"}

UNIQUE (user_id, name)

);                                 -- trigger chặn dòng thứ 21 của mỗi người

CREATE TABLE portfolio_tx (

id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

user_id   bigint NOT NULL REFERENCES app_user ON DELETE CASCADE,

symbol    text NOT NULL REFERENCES company,

traded_on date NOT NULL,

side      text NOT NULL CHECK (side IN ('buy', 'sell')),

qty       integer NOT NULL CHECK (qty > 0),

price     numeric(14,2) NOT NULL CHECK (price > 0),

fee       numeric(14,2) NOT NULL DEFAULT 0 CHECK (fee >= 0),

source    text NOT NULL CHECK (source IN ('manual', 'csv')),

dedup_key bytea NOT NULL         -- sha256(ngày, mã, loại, khối lượng, giá); import bỏ dòng trùng

);

CREATE INDEX ON portfolio_tx (user_id, dedup_key);

CREATE INDEX ON portfolio_tx (user_id, symbol, traded_on);

CREATE TABLE trade_plan (

id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

user_id        bigint NOT NULL REFERENCES app_user ON DELETE CASCADE,

symbol         text NOT NULL REFERENCES company,

status         text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'open', 'closed')),

closed_reason  text CHECK (closed_reason IN ('target', 'stop', 'expired', 'cancelled')),

entry_low      numeric(14,2) NOT NULL,   -- vùng vào; bằng entry_high nếu nhập một giá

entry_high     numeric(14,2) NOT NULL,

stop_price     numeric(14,2) NOT NULL,

target_price   numeric(14,2) NOT NULL,

reason         text NOT NULL,

capital_vnd    bigint,                   -- chỉ trader, analyst

risk_pct       real,

qty_max        integer,                  -- khối lượng tối đa, làm tròn xuống theo lô 100

expires_on     date,

forecast_id_t2 bigint REFERENCES forecast,

forecast_id_t5 bigint REFERENCES forecast,

snapshot       jsonb NOT NULL,           -- nhãn, xác suất T+2/T+5, phiên bản mô hình, snapshot_hash của dự báo

snapshot_hash  bytea NOT NULL,           -- sha256 của snapshot; trigger chặn UPDATE snapshot*, forecast_id_*

history        jsonb NOT NULL DEFAULT '[]',  -- chỉ thêm: thời điểm, giá trị cũ và mới

suggested      text,                     -- gợi ý của C5 khi giá chạm mốc; người dùng xác nhận mới đổi status

exit_price     numeric(14,2),

exit_note      text,

created_at     timestamptz NOT NULL DEFAULT now(),

closed_at      timestamptz,

CHECK (stop_price < entry_low AND entry_low <= entry_high AND entry_high < target_price)

);

CREATE INDEX ON trade_plan (user_id, status);

CREATE INDEX ON trade_plan (status) WHERE status IN ('pending', 'open');   -- cho bước plans của batch

CREATE TABLE journal_entry (

id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

user_id          bigint NOT NULL REFERENCES app_user ON DELETE CASCADE,

plan_id          bigint UNIQUE REFERENCES trade_plan,   -- NULL với ghi thủ công; UNIQUE chống bản ghi trùng

kind             text NOT NULL CHECK (kind IN ('plan_closed', 'manual')),

symbol           text NOT NULL REFERENCES company,

decided_on       date NOT NULL,

snapshot         jsonb NOT NULL,          -- sao chép từ kế hoạch hoặc dự báo của ngày ghi; không sửa

plan_copy        jsonb,                   -- kế hoạch gốc lúc đóng

pnl_pct          real,

holding_sessions smallint,

actual_t2        text CHECK (actual_t2 IN ('up', 'hold', 'down')),   -- C5 điền khi đáo hạn

actual_t5        text CHECK (actual_t5 IN ('up', 'hold', 'down')),

alignment        text CHECK (alignment IN ('with', 'against', 'mixed', 'neutral')),

note             text,

tags             text[] NOT NULL DEFAULT '{}',

lesson           text,

created_at       timestamptz NOT NULL DEFAULT now()

);

ALTER TABLE alert_rule

ALTER COLUMN symbol DROP NOT NULL,

ALTER COLUMN horizon DROP NOT NULL,

DROP CONSTRAINT alert_rule_kind_check,

ADD COLUMN plan_id   bigint REFERENCES trade_plan ON DELETE CASCADE,

ADD CONSTRAINT alert_rule_kind_check CHECK (kind IN

('label_change', 'prob_threshold', 'plan_touch')),

ADD CONSTRAINT alert_rule_shape CHECK (

(kind IN ('label_change', 'prob_threshold') AND symbol IS NOT NULL AND horizon IS NOT NULL)

OR (kind = 'plan_touch' AND plan_id IS NOT NULL));

ALTER TABLE alert

ADD COLUMN plan_id bigint REFERENCES trade_plan ON DELETE SET NULL,

ALTER COLUMN forecast_id DROP NOT NULL;

CREATE TABLE notify_channel (

id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

user_id     bigint NOT NULL REFERENCES app_user ON DELETE CASCADE,

kind        text NOT NULL CHECK (kind IN ('email', 'telegram')),

address     text,                    -- email, chat_id Telegram hoặc token thiết bị; NULL tới khi liên kết xong

enabled     boolean NOT NULL DEFAULT true,

verified_at timestamptz,

link_code   bytea,                   -- băm của mã liên kết dùng một lần

link_expires_at timestamptz

);                                     -- hủy liên kết: enabled = false, xóa address, giữ dòng để còn nhật ký

CREATE UNIQUE INDEX ON notify_channel (user_id, kind);

CREATE TABLE notification (

id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

user_id     bigint NOT NULL REFERENCES app_user ON DELETE CASCADE,

channel_id  bigint NOT NULL REFERENCES notify_channel,

alert_id    bigint REFERENCES alert ON DELETE SET NULL,   -- NULL với tin gửi thử

body        text NOT NULL,

status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),

attempts    smallint NOT NULL DEFAULT 0,

next_try_at timestamptz NOT NULL DEFAULT now(),

sent_at     timestamptz,

error       text,

created_at  timestamptz NOT NULL DEFAULT now(),

UNIQUE (channel_id, alert_id)       -- chống gửi trùng khi batch chạy lại

);

CREATE TABLE chat_session (

id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

user_id    bigint NOT NULL REFERENCES app_user ON DELETE CASCADE,

created_at timestamptz NOT NULL DEFAULT now()

);

CREATE TABLE chat_message (

id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

session_id bigint NOT NULL REFERENCES chat_session ON DELETE CASCADE,

role       text NOT NULL CHECK (role IN ('user', 'assistant')),

content    text NOT NULL,

intent     text,                    -- 'forecast', 'why', 'news', 'history', 'glossary', 'personal', 'refused'

personal   boolean NOT NULL DEFAULT false,   -- che nội dung khi analyst, admin xem log

citations  jsonb NOT NULL DEFAULT '[]',      -- [{"ref": "forecast:18342", "url": "/symbols/FPT?tab=forecast"}]

blocked    text,                    -- 'order_request', 'banned_word', 'number_mismatch', ...

llm        text,                    -- tên mô hình hoặc 'template'

latency_ms integer,

created_at timestamptz NOT NULL DEFAULT now()

);                                    -- job dọn dẹp xóa sau 90 ngày

-- v_market_summary, v_screener: materialized view, làm mới cuối bước forecast

-- RLS: ENABLE ROW LEVEL SECURITY và policy user_id = current_setting('app.user_id')::bigint trên portfolio_tx,

--      trade_plan, journal_entry, saved_screen, notify_channel, notification, chat_session (chat_message qua chat_session)

REVOKE DELETE ON trade_plan, journal_entry FROM app_api;

### 6.3 Quy tắc point-in-time và nhãn

**Tin tức:** tin có published_at sau 15:00 ngày T hoặc vào ngày nghỉ được tính cho phiên giao dịch kế tiếp (đã cài trong sentiment_daily).

**BCTC:** đặc trưng ngày T chỉ dùng bản BCTC có published_at trước 15:00 ngày T (đã cài trong feature_daily).

**Nhãn:** label_daily tính theo PRD mục 12.3 trên adj_close, với σ là độ lệch chuẩn lợi suất ngày 20 phiên kết thúc tại T và k đọc từ cấu hình dataset:

∈ {2, 5}

**Chuẩn hóa:** thống kê chuẩn hóa chỉ tính trên tập huấn luyện và lưu cùng checkpoint.

**Kiểm thử rò rỉ:** bộ test tự động chèn một tin lúc 15:30 ngày T và kiểm tra nó không có trong đầu vào dự báo ngày T (AC-08).

**Snapshot kế hoạch:** khi lưu Trade Plan, nhãn, xác suất T+2/T+5, phiên bản mô hình và snapshot_hash của dự báo mới nhất được sao chép vào trade_plan.snapshot; snapshot không đổi dù dự báo sau đó được điền actual_label (FR-M10-02, AC-19).

Snapshot dự báo còn lưu manifest bất biến: giá thô/điều chỉnh và giá trị đặc trưng đã dùng, mốc BCTC, tin với doc_id/model_id và bản sao tiêu đề/nguồn/published_at, cut_off_at, cấu hình chuẩn hóa và nhãn. Tensors NPZ nén trong forecast_input phải đủ để tái lập; nếu chỉ tham chiếu embedding thì doc_embedding và checkpoint phải bất biến và được giữ suốt thời gian forecast còn có hiệu lực audit. FR-M7-09 đọc manifest này, không ghép lại metadata có thể thay đổi. Worker dùng ON CONFLICT DO NOTHING trên khóa forecast khi chạy lại cùng ngày/model; không sửa xác suất, model, snapshot hoặc timestamp cũ. Chỉ actual_return, actual_label và due_on khi sửa lịch được cập nhật theo quyền hậu xử lý; stale tính ở API theo ngày dữ liệu, không sửa tensor.

## 7. Thiết kế mô hình dự báo và phân tích tin tức (ACPS)

Hệ thống sử dụng kiến trúc Automatic Crawling and Prediction System (ACPS). Cốt lõi của kiến trúc này là quy trình sinh và chọn lọc tính năng (Feature Selection Pipeline) chuyên sâu từ dữ liệu giá, kết hợp với xử lý cảm xúc tin tức bằng phương pháp lai (Hybrid). Đầu ra được quyết định bởi một hệ thống Học kết hợp (Ensemble Learning).

Mô hình kết hợp · 2 nhánh, 1 khối hợp nhất, 2 đầu ra

### 7.1 Mô hình cảm xúc tin tức (C2)

**Mô hình:** PhoBERT-base-v2 tinh chỉnh 3 lớp Tích cực / Trung tính / Tiêu cực trên 2.000–3.000 tin tự gán nhãn (tiêu đề + sapo, tối đa 256 token, tách từ bằng VnCoreNLP).

**Tập gán nhãn:** lưu như một model human trong nlp_model + sentiment; hai lượt gán trên 300 tin để đo Cohen's kappa; chia 80/10/10 theo thời gian.

**Đầu ra mỗi tin:** label, confidence = xác suất lớn nhất, scoredoc_embedding.

**So sánh:** TF-IDF + Logistic Regression; chỉ số chính Macro F1.

### 7.2 Đầu vào mô hình dự báo

| Nhánh | Đặc trưng | Kích thước |
| --- | --- | --- |
| Giá và bối cảnh | Dữ liệu được thu thập sau khi chốt phiên trong ngày (Open, High, Low, Close, Volume (OHLCV)), sử dụng thư viện tính toán kỹ thuật để sinh các chỉ số MACD, ROC, RSI, …. | Từ 6 - 64 đặc trưng |
| Tin tức, báo cáo tài chính | ROE, ROA, EPS TTM, P/E, P/B, nợ/vốn, tăng trưởng doanh thu và lợi nhuận, số ngày từ lần công bố gần nhất. Embedding tối đa 8 tin mỗi phiên (ưu tiên độ tin cậy cảm xúc cao), điểm cảm xúc trung bình, số tin, tỷ lệ tin tiêu cực; mask cho phiên không có tin | 30 phiên × 8 × 768, kèm 30 × 3 |

### 7.3 Kiến trúc

**Encoder giá:** Loại bỏ phương sai thấp (Low Variance Filter): Chuẩn hóa dữ liệu bằng Z-Score và loại bỏ các chỉ số tĩnh, có phương sai (variance) dưới ngưỡng 0.8.

- Chuẩn hóa L1 (L1 Regularization): Sử dụng hồi quy tuyến tính với hàm L1. Đặc tính của L1 sẽ thu hẹp và ép trọng số của các tính năng không liên quan về mức 0, giữ lại các tính năng có trọng số khác 0.

- Xếp hạng theo Gini (Model-Based Ranking): Đưa tập tính năng vượt qua bước 2 vào Random Forest. Tính toán độ quan trọng Gini (Gini importance) và chỉ giữ lại những tính năng có điểm quan trọng trên ngưỡng 0.01.

**Bộ phân loại cơ sở (Base Estimators**): Quyết định tăng/giữ/giảm được tính toán độc lập bởi các mô hình: Decision Tree (DT), K-Nearest Neighbors (KNN), Logistic Regression (LR), Naive Bayes (NB), Random Forest (RF), Support Vector Machine (SVM), Artificial Neural Network (ANN) và LSTM.

- Lấy kết quả bỏ phiếu đa số từ các mô hình trên khi chỉ sử dụng tập đặc trưng kỹ thuật đã qua Pipeline Chọn lọc.

**Encoder tin tức:** attention pooling gom các tin trong một phiên, GRU qua 30 phiên có mask, ra chuỗi 128 chiều. Phiên không có tin dùng vectơ "không có tin" học được.

**Hợp nhất:** Hợp nhất kết quả từ nhánh Giá và giá trị cảm xúc của nhánh Tin tức. Quyết định dự báo tỷ lệ Tăng/Giữ/Giảm cuối cùng được kết xuất tại đây. Vectơ giá làm query cross-attention lên chuỗi tin; được cân trọng số 2 nhánh trước khi ghép.

**Đầu ra:** hai đầu softmax 3 lớp (T+2, T+5); hàm mất mát là tổng cross-entropy có trọng số lớp (hoặc focal loss) của hai đầu.

### 7.4 Cấu hình so sánh

| Cấu hình | Nhánh dùng | Vai trò |
| --- | --- | --- |
| Lớp phổ biến nhất | Không | Mức sàn (Nhánh 1) |
| All features | Đặc trưng định lượng dạng bảng | Baseline định lượng (Dùng toàn bộ các đặc trưng ở Nhánh 1) |
| Base Estimators chỉ giá | Giá | Baseline học sâu (Dùng ML cho đặc trưng đã lọc ở Nhánh 1) |
| Chỉ văn bản/cảm xúc | Tin tức | Baseline học sâu (Nhánh 2) |
| Kết hợp (mô hình đề xuất) | Cả hai | Baseline học sâu (2 nhánh) |
| Lớp phổ biến nhất | Không | Mức sàn (Nhánh 1) |

### 7.5 Huấn luyện và đánh giá

**Chia tập theo thời gian:** train 2021 - 2024, validation 2025 H1, test 2025 H2 - 2026.

**Hệ số k:** chọn trên tập train sao cho mỗi lớp chiếm 30 - 45%, khởi đầu k = 0,5.

**Tối ưu:** AdamW, early stopping theo Macro F1 validation, 5 seed, cấu hình và seed lưu cùng checkpoint.

**Chỉ số:** Accuracy, Macro F1, Precision và Recall theo lớp, AUC-ROC one-vs-rest, confusion matrix, khoảng tin cậy 85 - 95%; phân tích lỗi theo pha thị trường và ngành.

**Nơi chạy:** notebook gọi mã trong ml/; kết quả ghi model_run, checkpoint đưa về thư mục models/ của máy chủ rồi đăng ký model_version.

### 7.6 Giải thích dự báo

**Đặc trưng số:** Top các chỉ số có ảnh hưởng cao nhất tới dự báo được lấy trực tiếp từ điểm Gini Importance của Random Forest, hoặc từ hệ số trọng lượng của Logistic Regression trong tập kết hơp.

**Tin tức:** trọng số cross-attention của từng tin.

**Tỷ trọng 2 nhóm:** tổng trị tuyệt đối đóng góp của mỗi nhóm chia cho tổng chung.

**Câu cho retail:** 3 yếu tố có đóng góp lớn nhất được điền vào mẫu câu theo từng đặc trưng, ví dụ "Giá đã tăng 6% trong 5 phiên gần nhất, đẩy dự báo lên" hoặc "Tin tức 3 ngày qua nghiêng về tiêu cực, kéo dự báo xuống". Không dùng tên chỉ báo khi không có chú thích (FR-M3-03). Với nhãn Đi ngang, mẫu câu dùng cụm "đi ngang", ví dụ "Giá dao động hẹp trong 5 phiên gần nhất, nghiêng về đi ngang"; mã hold không xuất hiện trong bất kỳ câu nào.

### 7.7 Cổng đưa mô hình vào phục vụ

Script ml/gate.py kiểm tra tự động 5 điều kiện của PRD mục 12.6 (vượt baseline, recall mọi lớp từ 0,20, kiểm tra rò rỉ đạt, đủ checkpoint/cấu hình/seed, giải thích sinh được cho 100% dự báo test) và ghi kết quả vào model_run.metrics.gate. API từ chối đặt is_serving cho phiên bản chưa qua cổng.

## 8. Thiết kế API và giao diện

API là REST JSON tại /api/v1, hợp đồng chi tiết ở openapi.yaml. Web xác thực bằng cookie phiên HttpOnly (D14); mobile (GĐ3) sẽ dùng Authorization: Bearer. preHandler requireCapability kiểm tra capability của vai trò cho từng route và, với dữ liệu cá nhân, kiểm tra quyền sở hữu (NFR-08). Vai trò không đủ quyền nhận 403. Cột "Vai trò" dùng R = retail, T = trader, A = analyst, Ad = admin; chú thích trong ngoặc là giới hạn riêng của một chức năng. Các route của M8–M13 thuộc GĐ2.

### 8.1 Danh sách endpoint

| Phương thức và đường dẫn | Mô-đun | Vai trò | Mô tả |
| --- | --- | --- | --- |
| POST /auth/login; POST /auth/logout; GET /me | M0 | Tất cả | Phiên token ngẫu nhiên (lưu băm) tối đa 24 giờ; mỗi request đối chiếu phiên và tài khoản; logout thu hồi phiên, web xóa cookie/mobile xóa token. GET /me trả vai trò hiện tại và must_change_password. |
| POST /auth/register | M0 | Khách | Tự đăng ký retail (FR-M0-08): email, mật khẩu, full_name, age_confirmed, accept_terms, accept_privacy; luôn 202 cùng thông điệp; bỏ qua trường role; giới hạn 5/giờ theo IP và email. |
| POST /auth/verify-email; POST /auth/resend-verification | M0 | Khách | Xác thực token một lần hạn 24 giờ; gửi lại tối đa 5/ngày, cách 60 giây, luôn trả thông điệp chung (FR-M0-09). Đăng nhập khi chưa xác thực trả 403 EMAIL_NOT_VERIFIED. |
| POST /me/upgrade/trader; POST /me/downgrade/retail | M0 | R; T | Tự nâng cấp (kinh nghiệm, mục đích, xác nhận trách nhiệm, lưu consent trader_terms) hoặc hạ cấp; thu hồi mọi phiên, ghi audit (FR-M0-11). |
| GET /me/role-requests; POST /me/role-requests | M0 | R, T | Xem và gửi yêu cầu Analyst; 409 ROLE_REQUEST_PENDING khi đã có yêu cầu chờ, 409 ROLE_REQUEST_COOLDOWN khi bị từ chối trong 7 ngày (FR-M0-11). |
| GET /me/consents; DELETE /me | M0 | R, T, A | Lịch sử đồng ý (FR-M0-10); tự xóa tài khoản sau khi nhập lại mật khẩu, Admin bị chặn (FR-M0-13). |
| GET /admin/role-requests; POST /admin/role-requests/{id}/approve; POST /admin/role-requests/{id}/reject | M0, M7 | Ad | Lọc theo trạng thái; duyệt đổi role và thu hồi phiên; từ chối bắt buộc lý do; chặn tự duyệt; audit (FR-M0-12). |
| GET /market/status | M1 | Tất cả | Ngày giá SSI mới nhất, ngày dữ liệu dự báo, giờ hoàn tất batch, phiên bản mô hình |
| GET /industries | M1 | R, T, A | Danh sách ngành cho bộ lọc |
| GET /market/summary | M1 | Tất cả | Dải thị trường: VN-Index, HNX-Index, độ rộng, tỷ lệ mã theo nhãn (từ v_market_summary) |
| GET /symbols | M1 | R, T, A | Danh sách mã kèm giá, GTGD 20 phiên, dự báo T+2/T+5 mới nhất, mức tin cậy và cờ đổi nhãn; changed=1 chỉ lấy mã đổi nhãn so với phiên trước (khối "Tín hiệu đổi hôm nay") |
| GET /symbols/{sym} (đã có, kèm dự báo mẫu); GET /symbols/{sym}/forecast?horizon=2\|5 (chưa có) | M2, M3 | R, T, A | Dự báo mới nhất kèm label_vi, confidence; phần giải thích (kể cả risk_notes) cắt theo vai trò |
| GET /symbols/{sym}/prices?range=6m | M2 | R, T, A | OHLCV và các ngày có tin mạnh |
| GET /symbols/{sym}/news?sentiment=&from=&to= | M4 | R, T, A | Tin mới nhất trước: tiêu đề, sapo, nguồn, thời gian, URL, nhãn, độ tin cậy |
| GET /symbols/{sym}/sentiment?days=30 | M4 | R, T, A | Chỉ số cảm xúc theo phiên |
| GET /symbols/{sym}/history?horizon=&window=30\|90 | M6 | R, T, A | Lịch sử dự báo, đúng/sai, hit rate kèm n, cờ small_sample và baseline "lớp phổ biến nhất", precision và recall theo lớp |
| GET /symbols/{sym}/history.csv | M6 | A | Xuất CSV |
| GET /forecasts/{id}/audit | M7 | A, Ad | Timestamp, phiên bản mô hình, snapshot, job kích hoạt |
| GET /watchlist; PUT, PATCH, DELETE /watchlist/{sym} | M5 | R, T, A | Tối đa 10 mã; mã thứ 11 trả 409; PATCH sửa ghi chú của mã |
| GET, POST /alert-rules; PATCH, DELETE /alert-rules/{id} | M5 | R, T, A | Đã có: cảnh báo theo mốc giá; cảnh báo Trade Plan tạo tự động. Chờ mô hình: label_change, prob_threshold. Không nhận concentration/screen_match ngoài PRD. |
| GET /alerts; GET /alerts/unread-count; PATCH /alerts/{id}; POST /alerts/read-all | M5 | R, T, A | Cảnh báo 90 ngày, số chưa đọc cho chuông, đánh dấu đã đọc |
| GET /notify/channels; DELETE /notify/channels/{channel}; POST /notify/email/link, /notify/email/verify, /notify/telegram/link, /notify/channels/{channel}/test; GET, PUT /me/notification-preferences; POST /notify/telegram/webhook | M5 | R, T, A, Ad (Ad dùng để nhận thông báo lỗi pipeline, FR-M7-08; webhook: Telegram, có secret) | Liên kết và xác minh email bằng mã 10 phút; lấy mã liên kết Telegram; gửi thử; hủy liên kết; bật/tắt từng kênh |
| GET, PUT /me/profile | M10 | T, A (R: 403) | Hồ sơ đầu tư: vốn và mức rủi ro tối đa, do người dùng tự nhập |
| GET /screener; GET, POST /screener/saved-filters; DELETE /screener/saved-filters/{id} | M8 | R, T, A (lưu bộ lọc: T, A) | Lọc trên v_screener bằng tham số trong danh sách trắng; bộ lọc có sẵn cho retail; bộ lọc có tên tối đa 20 mỗi người |
| POST /portfolio/transactions; PATCH, DELETE /portfolio/transactions/{id}; POST /portfolio/transactions/import | M9 | R, T, A (import: T, A) | Nhập, sửa, xóa giao dịch; import CSV (giao diện xem trước, máy chủ ghi dòng hợp lệ và trả dòng bị bỏ qua) |
| GET /portfolio; DELETE /portfolio | M9 | R, T, A (tổng quan, phân bổ ngành, giá trị theo thời gian: T, A) | Vị thế, giá vốn, lãi/lỗ, tỷ trọng kèm tín hiệu hiện tại; tổng quan và giá trị theo thời gian; xóa toàn bộ giao dịch |
| GET, POST /plans; PATCH /plans/{id}; POST /plans/{id}/close; POST /plans/calc | M10 | R, T, A | Mọi vai trò tính R:R và khoảng cách %. Chỉ T/A nhận vốn, % rủi ro và tính khối lượng; đóng tạo Journal cùng transaction. |
| GET, POST /journal; PATCH /journal/{id}; GET /journal/stats | M11 | R, T, A (ghi thủ công, stats: T, A) | Danh sách lọc theo mã, thời gian, thẻ, kết quả; sửa ghi chú, thẻ, bài học; thống kê nhìn lại |
| GET, POST /chat/sessions; DELETE /chat/sessions/{id}; GET, POST /chat/sessions/{id}/messages | M12 | R, T, A | Quản lý phiên; gửi câu hỏi hiện trả 503 CHAT_MODEL_NOT_READY; khi có mô hình, api chuyển câu hỏi cùng user_id tới dịch vụ chat (mục 5.3) |
| GET /reports/symbols/{sym}.pdf, /reports/portfolio.pdf, /reports/plans/{id}.pdf, /reports/journal.pdf?from=&to= | M13 | R, T, A (journal: T, A) | PDF từ cùng truy vấn với màn hình; chỉ xuất dữ liệu của chính người dùng |
| GET /models/evaluation | M6 | A, Ad | Metrics, confusion matrix, ablation và hiệu chỉnh (Brier, ECE) của các lần huấn luyện |
| GET /models/summary | M6 | R, T, A, Ad | Bản tóm tắt cho mọi vai trò: phiên bản đang phục vụ, ngày huấn luyện, hit rate tổng 30/90 phiên kèm n và baseline |
| GET, POST /admin/users; PATCH /admin/users/{id} | M7 | Ad | Tạo, khóa, đổi vai trò; tạo tài khoản demo (is_demo) |
| GET /admin/jobs, POST /admin/jobs/{job}/run; GET /admin/ingestion-runs | M7 | Ad | Trạng thái worker và nguồn dữ liệu; xếp hàng chạy lại một job trong danh sách cho phép |
| GET /admin/models; POST /admin/models/{id}/serve | M7 | Ad | Danh sách quản trị; đổi hoặc rollback chỉ bản qua gate và còn checkpoint. Analyst xem qua GET /model-versions. |
| GET /admin/audit?from=&to=&actor=&action=&target=&page=&page_size= | M7 | Ad | Mới nhất trước, phân trang; thời điểm, actor, target, details (before/after đã lọc bí mật). Không có sửa/xóa. |
| GET /admin/notifications | M5, M7 | Ad | Nhật ký gửi tổng hợp theo kênh và trạng thái, không kèm nội dung |
| GET /admin/chat-log | M12, M7 | A, Ad | Nhật ký Chat: nội dung lượt hỏi cá nhân đã che, kèm kết quả lọc và độ trễ |
| POST /auth/change-password | M0 | Tất cả đã xác thực | current_password, new_password; kiểm tra chính sách, mật khẩu mới khác cũ; thu hồi mọi phiên khác. Với đổi bắt buộc sau reset: phát hành phiên mới. |
| POST /auth/forgot-password; POST /auth/reset-password | M0 | Chưa cần phiên | Should GĐ1; trả thông báo chung; token một lần 30 phút. Reset thu hồi mọi phiên; không ghi token vào log. |
| POST /admin/users/{id}/reset-password; POST /admin/users/{id}/revoke-sessions | M0, M7 | Ad | Đặt mật khẩu tạm, buộc đổi ở lần đăng nhập tiếp theo; thu hồi phiên; audit có outcome, không chứa mật khẩu/token. |
| GET /forecasts/{id}/inputs | M7 | A, Ad | Giá, đặc trưng, BCTC, metadata tin và cut-off từ manifest snapshot đã dùng; không từ view hiện tại. |
| POST /forecasts/{id}/replays; GET /forecasts/{id}/replays/{replay_id} | M7 | A, Ad | Xếp hàng 202 và poll kết quả; so sai số < 1e-4; thiếu đầu vào báo not_reproducible; không ghi đè forecast gốc. |
| GET /model-versions | M7 | A, Ad | Danh sách chỉ đọc gồm mã, ngày huấn luyện, khoảng dữ liệu, metrics; thao tác serve/rollback chỉ qua Admin. |
| GET /admin/ops-events | M7 | Ad | Lỗi pipeline sau retry và drift; trạng thái thông báo vận hành, không chứa dữ liệu Portfolio/Plan/Journal. |

Dữ liệu cá nhân (Portfolio, Trade Plan, Journal, Chat, kênh thông báo, bộ lọc đã lưu) chỉ truy cập được bằng id của chính người dùng: id của người khác trả 404, admin gọi các route này nhận 403 (AC-26). Route ghi dữ liệu cá nhân không nhận user_id từ thân yêu cầu; user_id luôn lấy từ phiên. Mọi nhãn hiển thị cho người dùng lấy từ label_vi.

Giới hạn tần suất: 300 request/phút cho mỗi người dùng đã đăng nhập, 100 request/phút cho mỗi IP chưa đăng nhập; riêng đăng nhập, đăng ký, quên mật khẩu có giới hạn chặt hơn (5–20 request/phút). Vượt giới hạn trả 429 kèm thời gian chờ bằng tiếng Việt.

Trạng thái triển khai: các route ở bảng trên đã có, trừ những route cần mô hình AI: /symbols/{sym}/forecast, /sentiment, /history, /forecasts/{id}/audit, /inputs, /replays, /models/evaluation, /models/summary, /model-versions, /admin/models, /admin/chat-log. /symbols/{sym}/history.csv đã có, bật bằng HISTORY_CSV_EXPORT_ENABLED.

Ví dụ phản hồi GET /symbols/FPT/forecast?horizon=2 cho vai trò trader, với nhãn Đi ngang (label là mã nội bộ, label_vi là chữ hiển thị):

{

"symbol": "FPT", "horizon": 2, "d": "2026-10-07", "due_on": "2026-10-09",

"label": "hold", "label_vi": "Đi ngang",

"probs": {"up": 0.31, "hold": 0.52, "down": 0.17},

"confidence": "mid", "low_confidence": false, "data_status": [],

"model_version": "mm-2026.10.01-a", "created_at": "2026-10-07T16:42:10+07:00",

"explanation": {

"group_share": {"tech": 0.48, "news": 0.33, "fin": 0.19},

"reasons": ["...", "...", "..."],

"risk_notes": ["..."]

},

"disclaimer": "Dự báo chỉ mang tính tham khảo, không phải khuyến nghị đầu tư."

}

### 8.2 Màn hình

| Màn hình | Mô-đun | Nội dung chính |
| --- | --- | --- |
| Đăng nhập | M0 | Email, mật khẩu; liên kết Đăng ký và Quên mật khẩu; khi chưa xác thực email hiện hướng dẫn gửi lại thư |
| Đăng ký | M0 | Email, tên hiển thị (tùy chọn), mật khẩu và nhập lại (kiểm chính sách tại chỗ), 3 ô đồng ý tách riêng không chọn sẵn (đủ 18 tuổi, Điều khoản sử dụng, Thông báo xử lý dữ liệu); sau khi gửi hiện thông điệp chung |
| Xác thực email | M0 | Trang mở từ liên kết trong thư; báo thành công hoặc liên kết hết hạn, ô gửi lại thư |
| Tổng quan thị trường (trang chủ) | M1 | Dải thị trường (VN-Index, HNX-Index, độ rộng, tỷ lệ nhãn), khối "Tín hiệu đổi hôm nay", bảng mã với nhãn Tăng / Đi ngang / Giảm kèm biểu tượng ▲ ● ▼ cho T+2 và T+5, bộ lọc sàn/ngành/thanh khoản/xu hướng, tìm kiếm, ngày dữ liệu |
| Chi tiết mã, tab Dự báo | M2, M3, M10, M13 | Forecast card T+2 và T+5 cạnh nhau, thanh xác suất, mức tin cậy, khối "Vì sao?" và "Điều gì có thể làm dự báo sai", biểu đồ giá đóng cửa 6 tháng (SVG; biểu đồ nến khi cần), trạng thái dữ liệu, tuyên bố tham khảo; nút thêm watchlist, lập Trade Plan, xuất PDF |
| Chi tiết mã, tab Tin tức | M4 | Danh sách tin có nhãn sắc thái, bộ lọc, biểu đồ cảm xúc 30 phiên cạnh giá |
| Chi tiết mã, tab Lịch sử | M6 | Bảng dự báo cũ, đúng/sai, "Đang chờ", hit rate 30/90 phiên kèm n, cảnh báo "mẫu nhỏ", baseline và ghi chú T+5 chồng lấn |
| Chi tiết mã, tab Analyst và Audit | M3, M7 | Analyst: top 15 đặc trưng/trọng số tin; Analyst/Admin: audit, manifest dữ liệu đầu vào với cut-off, nút replay và kết quả sai số hoặc không tái lập được. Nội dung chi tiết tuân thủ FR-M3-02. |
| Watchlist và chuông thông báo | M5 | Mã đang theo dõi kèm ghi chú, dấu đổi tín hiệu, quy tắc cảnh báo (mọi vai trò), lịch sử cảnh báo |
| Screener | M8 | Bộ lọc kỳ hạn, nhãn, xác suất tối thiểu, sàn, ngành, thanh khoản (điều kiện nâng cao cho trader, analyst); bộ lọc có sẵn và bộ lọc đã lưu; bảng kết quả kèm nhãn, xác suất, mức tin cậy, trạng thái và ngày dữ liệu; thêm watchlist, mở chi tiết, lập Trade Plan; tuyên bố "danh sách sàng lọc, không phải xếp hạng nên mua" |
| Portfolio | M9 | Bảng vị thế (khối lượng, giá vốn bình quân, giá đóng cửa, lãi/lỗ tạm tính và đã thực hiện, tỷ trọng, tín hiệu T+2/T+5 kèm dấu đổi nhãn); biểu mẫu nhập giao dịch; import CSV có xem trước; tổng quan và giá trị theo thời gian (trader, analyst); xóa toàn bộ; ghi chú "chỉ để người dùng tự theo dõi"; xuất PDF |
| Trade Plan | M10 | Danh sách kế hoạch theo trạng thái; biểu mẫu mã, vùng vào, cắt lỗ, mục tiêu, lý do (vốn và % rủi ro cho trader, analyst); R:R, khoảng cách %, khối lượng tối đa; snapshot dự báo lúc lập (chỉ đọc), lịch sử chỉnh sửa; xác nhận chuyển trạng thái; đóng kế hoạch với giá thoát và ghi chú; tuyên bố "Trade Plan do bạn tự lập" |
| Journal | M11 | Danh sách bản ghi lọc theo mã, thời gian, thẻ, kết quả; chi tiết gồm dự báo lúc quyết định, kế hoạch gốc, kết quả, nhãn thực tế, làm theo hay ngược tín hiệu; sửa ghi chú, thẻ, bài học; ghi thủ công và thống kê nhìn lại (trader, analyst); xuất PDF |
| Chat hỏi đáp | M12 | Khung hội thoại, câu hỏi gợi ý, trích dẫn bấm được tới màn hình hoặc bài tin, tuyên bố "không phải tư vấn đầu tư" luôn hiển thị, nút bắt đầu phiên mới |
| Cài đặt | M0, M5, M10 | Tài khoản & vai trò (vai trò hiện tại, nâng cấp Trader, hạ cấp, gửi yêu cầu Analyst và xem trạng thái, bảng đồng ý đã lưu, đổi mật khẩu, xóa tài khoản); kênh thông báo (liên kết Telegram, xác thực email, bật/tắt từng kênh, gửi thử, hủy liên kết); hồ sơ đầu tư (vốn, rủi ro tối đa; trader, analyst) |
| Đánh giá mô hình | M6 | Analyst, admin: metrics T+2/T+5, confusion matrix, bảng baseline và ablation, reliability diagram, Brier, ECE. Retail, trader: bản tóm tắt hit rate tổng kèm n và baseline |
| Quản trị | M0, M7 | Yêu cầu nâng quyền (lọc trạng thái, duyệt, từ chối kèm lý do); người dùng và tài khoản demo, nguồn dữ liệu và job, phiên bản mô hình, audit log, nhật ký gửi thông báo, nhật ký Chat đã che; khóa/mở khóa, đổi vai trò, reset mật khẩu, thu hồi phiên; chặn làm mất Admin cuối; audit lọc và phân trang, before/after/outcome; sự kiện vận hành. |
| Đổi và đặt lại mật khẩu | M0 | Đổi bằng mật khẩu hiện tại; màn hình bắt buộc đổi sau reset Admin; quên mật khẩu và token email 30 phút; trạng thái hết hạn/đã dùng. |

Giao diện web gồm các trang nghiệp vụ, bốn tab chi tiết mã và màn hình xác thực ở bảng trên; màn hình Should chỉ bật theo giai đoạn. Giao diện tiếng Việt, tối ưu 1366–1920 px và một cột từ 375 px (NFR-10). Menu theo vai trò; bắt buộc đổi mật khẩu chặn điều hướng nghiệp vụ. “MUA”/“BÁN” chỉ dùng trong biểu mẫu giao dịch do người dùng tự nhập, không ở nhãn tín hiệu, dự báo, gợi ý hoặc Chat (NFR-13).

### 8.3 Ứng dụng mobile (C12)

Ứng dụng mobile (GĐ3, chưa triển khai) là một lớp giao diện thứ hai trên cùng API; API hiện chỉ nhận cookie, cần bổ sung Bearer token trước khi làm mobile; không có logic nghiệp vụ riêng, nên phần lớn thiết kế nằm ở cách đóng gói, xác thực và phân phối.

**Một codebase:** mobile/ viết bằng React Native và TypeScript, dựng bằng Expo để build iOS và Android từ cùng mã. Dùng chung với web qua packages/core: kiểu dữ liệu API, client gọi API, hàm R:R và khối lượng tối đa (bản xem trước), định dạng số và ngày; thành phần giao diện không dùng chung vì web chạy trên DOM (FR-M14-01).

Xác thực: POST /auth/login với client=mobile trả token trong thân phản hồi; ứng dụng lưu token trong Keychain (iOS) hoặc Keystore (Android) và gửi Authorization: Bearer. Middleware ưu tiên cookie, nếu không có thì đọc Bearer, cùng một bộ kiểm tra vai trò và quyền sở hữu. Token hết hạn sau 24 giờ thì ứng dụng yêu cầu đăng nhập lại (bản đầu chưa có refresh token); đăng xuất gọi POST /auth/logout để thu hồi phiên, sau đó xóa token cục bộ (FR-M0-02, FR-M14-04); nhận 401 cũng xóa token và chuyển về đăng nhập. Request dùng Bearer không cần chống CSRF vì không dựa vào cookie.

**Màn hình:** điều hướng tab ở đáy gồm Tổng quan, Watchlist, Portfolio, Trade Plan và Thêm (Journal, Chat, Thông báo, Cài đặt); chi tiết mã có forecast card và giải thích (FR-M14-02). Screener và xem/chia sẻ PDF qua menu chia sẻ của hệ điều hành là mức Should (FR-M14-03). Tuyên bố trách nhiệm và thời điểm cập nhật dữ liệu dùng cùng thành phần và cùng chuỗi văn bản với web (FR-M14-05).

Thông báo: mobile hiển thị danh sách cảnh báo trong ứng dụng (FR-M14-02) và nhận email/Telegram như web. Thông báo đẩy (FCM, APNs) chưa nằm trong PRD; lược đồ hiện hành chỉ nhận email/Telegram; push được xem là hướng mở rộng ở mục 12.4.

**Phân phối:** bản build kiểm thử qua TestFlight (iOS, cần tài khoản Apple Developer, ước tính 99 USD mỗi năm) và tệp APK cài trực tiếp (Android); build iOS cần máy macOS hoặc dịch vụ build đám mây của Expo (cần xác nhận, mục 12.4). Nếu build iOS chậm, web responsive từ 375 px, có thể thêm PWA, là phương án dự phòng để vẫn có bản chạy được trên điện thoại.

**Hiệu năng và kiểm thử:** màn hình dự báo chỉ gọi hai request nhỏ (forecast cho T+2 và T+5) và cache kết quả theo d để hiển thị dưới 3 giây (p95) trên 4G (NFR-17). Kiểm thử đơn vị cho packages/core chạy chung với web; AC-25 kiểm bằng kịch bản thủ công trên một thiết bị hoặc máy ảo mỗi nền tảng.

## 9. Yêu cầu phi chức năng và cách đáp ứng

Các NFR về tốc độ được đáp ứng chủ yếu nhờ tính dự báo trước (D4); các NFR về giải thích và truy vết nhờ các bảng giải thích, snapshot và admin_audit_log; các NFR về dữ liệu cá nhân nhờ điều kiện user_id bắt buộc ở repository và trigger bảo vệ snapshot (D13), về Chat nhờ bộ kiểm tra đầu ra (D11) và về thông báo nhờ hàng đợi notification_outbox (D12). NFR-04, 05, 06, 12, 14, 17 cần mô hình AI hoặc mobile nên chưa đo được.

| NFR | Cách thiết kế đáp ứng |
| --- | --- |
| NFR-01 Hiệu năng trang | Web là file tĩnh React do Vite build (tách mã, nén); mỗi trang gọi 2–3 request JSON nhỏ; biểu đồ giá là SVG nhẹ, không nạp thư viện biểu đồ |
| NFR-02 API < 300 ms, batch < 15 phút | API chỉ đọc bảng có index (symbol, d, horizon); v_overview, v_market_summary, v_screener là materialized view làm mới cuối bước forecast; batch chạy CPU trên embedding đã lưu, không chạy lại PhoBERT cho tin cũ. Các bước plans, portfolio, notify của GĐ2 chạy sau bước forecast nên không tính vào 15 phút sinh dự báo; thời gian từng bước ghi ở job_run để đo (mục 10.2) |
| NFR-03 Pipeline tự động, retry | worker admin-jobs:watch tự xếp hàng pipeline sau 15:30 thứ Hai–thứ Sáu theo giờ Asia/Ho_Chi_Minh (đổi bằng ADMIN_JOBS_SCHEDULE_TIME); mỗi job retry tối đa 3 lần, mỗi lần một dòng admin_job_runs; hết retry thì báo Admin trong app và qua email/Telegram. Chưa có lịch nghỉ lễ (trading_calendar) |
| NFR-04 Fallback | Thiếu tin 5 phiên: che nhánh tin, gắn missing_newsstale |
| NFR-05 Giải thích | Batch không commit dự báo thiếu bản ghi giải thích (cùng một transaction); test tự động quét toàn bộ dự báo một ngày |
| NFR-06 Truy vết | snapshot_hash = SHA-256 của tensor đầu vào; tensor lưu trong forecast_input; lệnh ml/replay.py <forecast_id> chạy lại trên CPU ở chế độ xác định và so sai số < 1e-4 API /inputs đọc manifest snapshot; /replays chạy bất đồng bộ qua forecast_replay và lưu kết quả riêng. Snapshot/model thiếu thì ghi not_reproducible. |
| NFR-07 Bảo mật | Băm mật khẩu bằng scrypt có salt; token phiên, xác thực email, đặt lại mật khẩu chỉ lưu SHA-256; khóa đếm tần suất đăng ký dùng HMAC, không lưu IP thô; cookie phiên HttpOnly, SameSite=Lax, Secure khi COOKIE_SECURE=true, hết hạn 24 giờ (D14); @fastify/helmet đặt header bảo mật; giới hạn tần suất theo người dùng và IP; HTTPS khi triển khai công khai (reverse proxy, chưa làm); bí mật SMTP, Telegram, AUTH_RATE_LIMIT_SECRET qua .env không đưa lên kho mã. Dữ liệu cá nhân gắn user_id (D13); không lưu thông tin tài khoản chứng khoán hay ngân hàng; DELETE /portfolio xóa toàn bộ giao dịch. Thu hồi phiên, khóa tạm, chính sách mật khẩu và token reset theo M0. |
| NFR-08 Phân quyền | Bảng vai trò → capability ở packages/core/src/access/roles.js dùng chung cho API (requireCapability trên từng route) và web (ẩn menu, RequireCapability); mọi route dữ liệu cá nhân lấy user_id từ phiên; admin không có route đọc nội dung Portfolio, Trade Plan, Journal. Kịch bản kiểm thử gọi route với 4 vai trò và hai người dùng A, B cho AC-26 |
| NFR-09 Nhật ký | Fastify ghi log JSON (pino) kèm mã request; không ghi mật khẩu, token. admin_audit_log ghi hành động quản trị và đổi vai trò (actor, target, details before/after), API không có route sửa/xóa. Lưu log tệp 90 ngày và trigger chặn sửa/xóa audit là việc cần làm khi triển khai công khai |
| NFR-10 Giao diện | CSS responsive trên React, một cột từ 375 px; màu tăng/giảm luôn kèm biểu tượng ▲ ● ▼; mobile dùng cùng quy ước (mục 8.3) |
| NFR-11 Khả dụng | Hiện tại: PostgreSQL trong Docker Compose (restart: unless-stopped, healthcheck pg_isready), api/worker/web chạy bằng npm. Triển khai công khai: đóng gói api, worker, web tĩnh và reverse proxy HTTPS vào Docker Compose, theo dõi uptime; lỗi worker không làm api ngừng phục vụ |
| NFR-12 Tái lập | Seed cố định, requirements.lock, cấu hình YAML lưu trong model_version.config |
| NFR-13 Tuân thủ | Forecast card, khung Chat, trang Trade Plan và đầu trang PDF luôn kèm tuyên bố; kiểm tra tự động từ cấm trong web/, mobile/ và các mẫu câu, loại trừ lựa chọn loại giao dịch trong biểu mẫu do người dùng tự nhập; đầu ra Chat qua bộ quét từ cấm (mục 5.3) |
| NFR-14 Chat | Mỗi câu có số liệu qua bộ kiểm tra số và trích dẫn (mục 5.3); bộ chống bịa chạy tự động trước mỗi lần phát hành (AC-22); truy xuất bằng truy vấn cố định với role chỉ đọc và RLS nên không lộ dữ liệu người khác. p95 dưới 10 giây nhờ hạn gọi 6 giây cho mô hình ngôn ngữ và câu trả lời mẫu dự phòng, đo bằng chat_message.latency_ms (ngưỡng cần xác nhận). Trần số lượt hỏi mỗi người mỗi ngày (mặc định 30, đề xuất) và cache câu trả lời không cá nhân để kiểm soát chi phí API |
| NFR-15 Thông báo ngoài app | Khóa duy nhất theo (cảnh báo, kênh) trên notification_outbox chống gửi trùng khi pipeline chạy lại; worker gửi lần đầu rồi thử lại tối đa 3 lần, dòng kẹt ở processing quá 10 phút được nhận lại; hết lượt ghi failed, cảnh báo vẫn còn trong app. Nhật ký gửi xem ở Quản trị (GET /admin/notifications). Gmail giới hạn khoảng 500 người nhận/ngày |
| NFR-16 Báo cáo PDF | Sinh đồng bộ trong api, tối đa 2 yêu cầu song song, hết hạn sau 10 giây (mục tiêu p95 dưới 10 giây với 10 mã); dùng chung hàm truy vấn với màn hình nên số liệu khớp (AC-23); không lưu tệp PDF trên máy chủ |
| NFR-17 Mobile | Dùng chung API và RBAC với web; token trong Keychain/Keystore; màn hình dự báo gọi hai request nhỏ và cache theo ngày dữ liệu để dưới 3 giây (p95) trên 4G; kiểm thử trên hai phiên bản hệ điều hành chính gần nhất bằng thiết bị thật hoặc máy ảo (AC-25) |
| NFR-18 Dữ liệu cá nhân | Form đăng ký chỉ thu email, mật khẩu, tên hiển thị tùy chọn và cờ đủ 18 tuổi (age_confirmed_at, không lưu ngày sinh); user_consent lưu loại văn bản, phiên bản, thời điểm, kênh; đếm tần suất bằng HMAC, không lưu IP thô; DELETE /me xóa theo CASCADE, nhật ký quản trị SET NULL; phản hồi đăng ký và gửi lại luôn cùng thông điệp. Quy trình báo sự cố 72 giờ là quy trình vận hành, chưa xây dựng (PRD BR-R20). |

## 10. Triển khai, vận hành và kiểm thử

### 10.1 Triển khai

| Thành phần | Cách chạy | Vai trò |
| --- | --- | --- |
| db | Docker Compose, postgres:17-alpine, volume stocksense_pgdata, chỉ mở cổng 127.0.0.1:5432 | CSDL; npm run db:migrate tạo lược đồ, db:seed:demo nạp dữ liệu mẫu và 4 tài khoản demo, db:bootstrap-admin tạo Admin đầu tiên |
| api | npm run dev:api (Node.js ≥ 22.12, cổng 3000) | REST /api/v1, PDF, webhook Telegram |
| web | npm run dev:web (Vite, cổng 5173, proxy /api) hoặc build:web ra file tĩnh | Giao diện |
| worker | npm run worker:admin-jobs:watch (chạy liên tục) hoặc các lệnh một lần worker:market:sync, worker:news:sync, worker:notifications:deliver | Pipeline hằng ngày, hàng đợi job Admin, gửi thông báo |
| worker AI (sau) | Python, đọc/ghi cùng CSDL | Sentiment, dự báo, giải thích, tái lập |

Cấu hình qua tệp .env (không đưa lên kho mã): DATABASE_URL, SMTP_*, TELEGRAM_*, AUTH_RATE_LIMIT_SECRET, PUBLIC_APP_URL, PASSWORD_RESET_ENABLED, COOKIE_SECURE, REPORT_FONT_PATH, HISTORY_CSV_EXPORT_ENABLED. Khi triển khai công khai cần thêm reverse proxy HTTPS (ví dụ Caddy), đặt COOKIE_SECURE=true và đóng gói api, worker vào Docker Compose (NFR-11).

### 10.2 Batch ngày

Pipeline đã triển khai, do worker xếp hàng sau 15:30 thứ Hai–thứ Sáu: market.sync (giá OHLCV SSI của các mã đang bật, ghi data_ingestion_runs) → news.sync (tin CafeF/VnExpress, gán mã) → cảnh báo giá theo alert_rules và cảnh báo Trade Plan (chạm vùng vào, cắt lỗ, mục tiêu; kế hoạch quá hạn) → notifications.deliver (gửi email/Telegram). Mỗi job ghi admin_job_runs, retry tối đa 3 lần, hết retry báo Admin.

Các bước bổ sung khi có mô hình (thiết kế, chưa triển khai): financials kiểm tra BCTC mới; sentiment chấm cảm xúc tin mới; features làm mới đặc trưng và nhãn; resolve điền nhãn thực tế cho dự báo và Journal đã đáo hạn; forecast sinh dự báo T+2/T+5 kèm mức tin cậy, giải thích, risk_notes và snapshot trong một transaction; alerts tạo cảnh báo đổi nhãn, ngưỡng xác suất; drift tính Macro F1 30 phiên và báo Admin khi giảm hơn 10 điểm (RK-04).

Quy tắc: giá ngày T lỗi sau retry thì không sinh dự báo mới, giữ dự báo cũ kèm nhãn dữ liệu cũ (AC-06/28); tin lỗi vẫn dự báo bằng nhánh định lượng và gắn missing_news; chạy lại cùng ngày không tạo trùng dự báo hay cảnh báo; dự báo hoàn tất trước 20:00, sinh dự báo dưới 15 phút.

### 10.3 Cấu trúc mã nguồn

```text
StockSenseVN/
  apps/
    api/            # Fastify: server.js (route), auth/, admin/, market/, watchlist/, portfolio/, plans/, journal/, screener/, profile/, notifications/, chat/, reports/, db/
    web/            # React + Vite: src/app (khung, điều hướng), src/features/<module>, src/api (client thật và mock), src/auth
    worker/         # src/jobs (sync giá, tin, cảnh báo, gửi thông báo), src/providers (SSI, tin, email/Telegram), admin-jobs-cli.js
  packages/core/    # access (vai trò, capability), auth (chính sách mật khẩu), calc (R:R, khối lượng), labels
  db/
    migrations/     # 001–020, chạy tuần tự
    migrate.js, seed-demo.js, bootstrap-admin.js
  openapi.yaml      # hợp đồng API
  docker-compose.yml  # PostgreSQL
  (sau) ml/, mobile/  # worker AI Python và ứng dụng React Native
```

### 10.4 Kiểm thử

| Mức | Nội dung | Liên kết |
| --- | --- | --- |
| Unit | Bộ tách bài CafeF (etl/test_news.py có sẵn), tính chỉ báo, gán nhãn, sinh câu giải thích, giới hạn watchlist, mức tin cậy, giá vốn bình quân; hàm R:R và khối lượng trong packages/core (ví dụ AC-19), chạy bằng vitest | FR-M4-01, FR-M3-03, FR-M5-01, FR-M2-08, FR-M9-03, FR-M10-03, 04 |
| Dữ liệu | Tỷ lệ thiếu < 5%, không trùng, đủ phiên so với VN-Index, kiểm tra cut-off 15:00 và BCTC point-in-time | R0, AC-08 |
| Tích hợp | Chạy batch 12 bước trên CSDL mẫu 3 mã × 60 phiên; xóa có chủ đích tin hoặc giá để kiểm tra fallback; chạy lại batch hai lần để kiểm tra không có cảnh báo và thông báo trùng | AC-05, AC-06, AC-10–AC-12, AC-24 |
| API | Gọi mọi route với mọi vai trò; kiểm tra 403 và phần giải thích cắt theo vai trò; Screener so với truy vấn SQL viết tay trên 5 bộ lọc mẫu; import CSV có 2 dòng lỗi; đóng Trade Plan hai lần chỉ có một Journal; thử sửa snapshot | AC-04, AC-15–AC-20 |
| Cách ly dữ liệu | Hai người dùng A, B: A gọi id của B, admin mở dữ liệu của A, A hỏi Chat về danh mục của B; truy vấn trực tiếp bằng role api khi chưa đặt app.user_id phải trả 0 dòng | AC-26, NFR-08 |
| Chat | Bộ chống bịa tối thiểu 50 câu hỏi và 20 câu bẫy, chạy với mô hình ngôn ngữ thật và mô hình giả; kiểm tra từ cấm và số liệu không có trong dữ kiện | AC-21, AC-22, NFR-14 |
| PDF | Xuất PDF mã và danh mục 10 vị thế, đối chiếu 10 mẫu với màn hình; đo thời gian sinh | AC-23, NFR-16 |
| Mobile | Kịch bản đăng nhập, xem forecast card, thêm watchlist, tạo Trade Plan, xem Portfolio trên iOS và Android | AC-25, NFR-17 |
| Tái lập | replay.py trên 10 dự báo ngẫu nhiên, sai số < 1e-4 | AC-14, NFR-06 |
| Tải | k6 với 20 người dùng đồng thời; Lighthouse cho trang chủ và trang chi tiết; đo p95 của Chat với mô hình ngôn ngữ giả | NFR-01, NFR-02, NFR-14 |
| Mô hình | gate.py theo PRD 12.6 | R1–R4 |
| Người dùng | 8–10 người thử, câu hỏi hiểu dự báo sau 2 phút, bảng hỏi SUS; thêm luồng dự báo → Trade Plan → đóng → Journal trong 10 phút (GĐ2) | P3, P6, P7 |
| Xác thực và phiên | Đúng/sai mật khẩu, thông báo chung; sai 5 lần trong 15 phút, khóa 15 phút kể cả đúng; reset bộ đếm; logout; khóa/đổi vai trò thu hồi phiên ngay; mật khẩu 8/64 ký tự và byte UTF-8; đổi thu hồi các phiên khác. | FR-M0-01–06, AC-27, AC-29 |
| Đặt lại mật khẩu | Admin cấp mật khẩu tạm, bắt buộc đổi; email token hết hạn 30 phút, dùng một lần, hai request đồng thời; mật khẩu mới khác cũ và đạt chính sách; phiên cũ 401; outbox lỗi không cản pipeline. | FR-M0-07, AC-30 |
| Watchlist đồng thời | Thêm 10 mã, từ chối mã thứ 11; thêm trùng không đếm tăng; hai request khi có 9 mã chỉ một mã được thêm; xóa rồi thêm lại; còn dữ liệu sau đăng nhập. | FR-M5-01, AC-09 |
| Đăng ký và vai trò | Đăng ký trả cùng thông điệp cho email mới và đã có; trường role bị bỏ qua; vượt 5 lần/giờ không tạo tài khoản; chưa xác thực không đăng nhập được; token dùng 2 lần hoặc quá hạn bị từ chối; nâng cấp Trader thu hồi phiên; yêu cầu Analyst trùng bị 409; tự duyệt bị chặn; từ chối thiếu lý do bị 422; bootstrap khi đã có Admin bị từ chối; DELETE /me sai mật khẩu không xóa. | FR-M0-08..14; UC-26..29; AC-31..39 |
| Admin và audit | Tạo/khóa/mở khóa/đổi vai trò/reset/thu hồi phiên/run job/serve/rollback có before/after và outcome; chặn mất Admin cuối; lọc/phân trang; role khác 403; UPDATE/DELETE/TRUNCATE log bị từ chối. | FR-M7-01, 05, 11; UC-12/25; AC-15/29 |
| Batch idempotent | Theo lịch 15:30, không chạy ngày nghỉ; ghim model; chạy lại hai lần không trùng forecast/cảnh báo; không chạy đồng thời cùng job/ngày; lỗi giá giữ stale; ghi số bản ghi và mã job; ops_event lỗi sau retry. | FR-M7-07/08, US-24/UC-24, AC-28 |
| Audit và replay API | A/Ad đọc đúng manifest và cut-off; R/T 403; 10 dự báo sai số < 1e-4; thiếu tensor/embedding/model báo không tái lập được; dữ liệu forecast gốc và cảnh báo không đổi. | FR-M7-09/10, AC-14 |

## 11. Ma trận truy vết yêu cầu

Ma trận dưới đây truy vết yêu cầu chức năng của PRD v0.0.4 từ FR-M0 đến FR-M14 tới US và UC tương ứng, thành phần, dữ liệu, API và AC-01–AC-39. UC có cùng số với US trong PRD mục 9.2. Dấu “–” nghĩa là PRD chưa đặt AC riêng; phần kiểm thử vẫn phải kiểm tra yêu cầu đó.

| Yêu cầu | User story | Thành phần | Dữ liệu | API | Nghiệm thu |
| --- | --- | --- | --- | --- | --- |
| FR-M1-01..05 | US-01, US-07 / UC-01, UC-07 | C6, C7 | v_overview, job_run | /symbols, /market/status | AC-01, AC-02 |
| FR-M1-06, 07 | US-01, US-07 / UC-01, UC-07 | C5, C6, C7 | v_market_summary, v_overview | /market/summary, /symbols?changed=1 | AC-01 |
| FR-M2-01..04, 06, 07 | US-01 / UC-01 | C4, C6, C7 | forecast, trading_calendar, price_daily | /symbols/{sym}/forecast, /prices | AC-03 |
| FR-M2-05 | US-06 / UC-06 | C7 | forecast | /symbols/{sym}/forecast | AC-03 |
| FR-M2-08, 09 | US-01, US-06 / UC-01, UC-06 | C5, C6, C7 | forecast.confidence, forecast_explanation.risk_notes | /symbols/{sym}/forecast | AC-03 |
| FR-M3-01, 03, 04 | US-02 / UC-02 | C4, C6 | forecast_explanation | /symbols/{sym}/forecast | AC-04, AC-05 |
| FR-M3-02 | US-09 / UC-09 | C4, C6 | forecast_explanation | /symbols/{sym}/forecast (analyst) | AC-04 |
| FR-M4-01 | US-03 / UC-03 | C1 | document, document_symbol | /symbols/{sym}/news | AC-07 |
| FR-M4-02 | US-03 / UC-03 | C2 | sentiment | /symbols/{sym}/news | AC-07 |
| FR-M4-03, 04 | US-03 / UC-03 | C6, C7 | sentiment_daily | /news, /sentiment | AC-07 |
| FR-M4-05 | US-09 / UC-09 | C4 | forecast_explanation.news_attention | /news | – |
| FR-M4-06 | US-24 / UC-24 | C3 | sentiment_daily | – | AC-08 |
| FR-M5-01 | US-04 / UC-04 | C6 | watchlist | /watchlist | AC-09 |
| FR-M5-02..05 | US-05 / UC-05 | C5, C6 | alert_rule, alert | /alert-rules, /alerts | AC-10, AC-11 |
| FR-M5-06..08 | US-21 / UC-21 | C5, C9, C6 | notify_channel, notification | /notify/..., /admin/notifications | AC-24 |
| FR-M6-01..03 | US-08 / UC-08 | C5, C6 | forecast.actual_label | /symbols/{sym}/history | AC-12 |
| FR-M6-04 | US-11 / UC-11 | C6 | model_run.metrics | /models/evaluation | AC-13 |
| FR-M6-05 | US-11 / UC-11 | C6 | forecast | /history.csv | – |
| FR-M6-06 | US-08 / UC-08 | C5, C6, C7 | forecast.actual_label | /symbols/{sym}/history | AC-12 |
| FR-M6-07 | US-11 / UC-11 | C5, C6 | model_run.metrics.calibration | /models/evaluation | AC-13 |
| FR-M7-01 | US-12 / UC-12 | C6, C7 | app_user, auth_session, audit_log | /admin/users[/{id}], /admin/users/{id}/revoke-sessions | AC-15, AC-27, AC-29 |
| FR-M7-02 | US-13 / UC-13 | C6, C8 | job_run | /admin/jobs | AC-06 |
| FR-M7-03, 06 | US-10, US-14 / UC-10, UC-14 | C6, C4 | model_version | /admin/models | AC-16 |
| FR-M7-04 | US-10 / UC-10 | C4 | forecast, forecast_input | /forecasts/{id}/audit | AC-14 |
| FR-M7-05 | US-12, US-14, US-25 / UC-12, UC-14, UC-25 | C6 | audit_log append-only | /admin/audit | AC-16, AC-29 |
| FR-M8-01..07 | US-15 / UC-15 | C6, C7 | v_screener, saved_screen | /screener, /screener/saved | AC-17 |
| FR-M9-01..06 | US-16 / UC-16 | C6, C7 | portfolio_tx, price_daily, v_overview | /portfolio/..., DELETE /portfolio | AC-18, AC-26 |
| FR-M10-01..09 | US-17, US-21 / UC-17, UC-21 | C5, C6, C7 | trade_plan, alert_rule, alert | /plans/..., /me/profile | AC-19 |
| FR-M11-01..07 | US-18 / UC-18 | C5, C6, C7 | journal_entry | /journal/... | AC-20, AC-26 |
| FR-M12-01..07 | US-19 / UC-19 | C11, C6, C7 | chat_session, chat_message, forecast, forecast_explanation, document | /chat/sessions/... | AC-21, AC-22, AC-26 |
| FR-M12-08 | US-19 / UC-19 | C11 | eval/chat | – | AC-22 |
| FR-M13-01..06 | US-20 / UC-20 | C10, C6 | các bảng của màn hình tương ứng | /reports/... | AC-23 |
| FR-M14-01..05 | US-22 / UC-22 | C12, C6 | dùng chung với web | /api/v1 | AC-25 |
| FR-M0-01..04 | US-23 / UC-23 | C6, C7, C12 | app_user, auth_session, security_event | /auth/login, /auth/logout, /me | AC-27, AC-15 |
| FR-M0-05, 06 | US-23 / UC-23 | C6, C7, C12 | app_user, auth_session, security_event | /auth/change-password | AC-30; kiểm thử chính sách và phiên khác |
| FR-M0-07 | US-23, US-12 / UC-23, UC-12 | C6, C7, C8 | password_reset_token, auth_mail_outbox, auth_session | /auth/forgot-password, /auth/reset-password, /admin/users/{id}/reset-password | AC-30 |
| FR-M0-08, 09 | US-26 / UC-26 | C6, C7, C8 | app_user, email_verification_tokens, registration_requests, auth_mail_outbox | /auth/register, /auth/verify-email, /auth/resend-verification | AC-31, AC-32, AC-33, AC-34 |
| FR-M0-10 | US-26, US-29 / UC-26, UC-29 | C6, C7 | user_consent | /auth/register, /me/upgrade/trader, /me/consents | AC-38 |
| FR-M0-11 | US-27 / UC-27 | C6, C7 | app_user, role_requests, user_consent, audit_log, auth_session | /me/upgrade/trader, /me/downgrade/retail, /me/role-requests | AC-35, AC-36 |
| FR-M0-12 | US-28 / UC-28 | C6, C7 | role_requests, app_user, audit_log, auth_session | /admin/role-requests/... | AC-36 |
| FR-M0-13 | US-29 / UC-29 | C6, C7 | app_user và mọi bảng dữ liệu cá nhân (CASCADE), audit_log | DELETE /me | AC-39 |
| FR-M0-14 | US-28 / UC-29, UC-12 | C7, CLI | app_user, audit_log | npm run db:bootstrap-admin; /admin/users | AC-37 |
| FR-M0-15 (Should, chưa làm) | US-28 / UC-28, UC-29 | C6, C7 | – | – | – |
| FR-M7-07, 08 | US-24 / UC-24 | C1–C5, C8 | job_run, forecast, ops_event | /admin/jobs, /admin/ops-events | AC-28, AC-05/06, AC-24 |
| FR-M7-09, 10 | US-10 / UC-10 | C4, C6, C8 | forecast_input manifest, model_version, forecast_replay | /forecasts/{id}/inputs, /forecasts/{id}/replays | AC-14 |
| FR-M7-11 | US-25 / UC-25 | C6, C7 | audit_log | /admin/audit với bộ lọc và phân trang | AC-29, AC-15 |

## 12. Rủi ro thiết kế và câu hỏi mở

Rủi ro nghiệp vụ đã có trong PRD mục 14; mục này chỉ nêu rủi ro riêng của thiết kế, các điểm Project Brief và PRD còn lệch và các câu hỏi mở.

### 12.1 Rủi ro thiết kế

| Rủi ro | Ảnh hưởng | Cách giảm |
| --- | --- | --- |
| Integrated Gradients cho 15+ mã × 2 kỳ hạn trên CPU vượt 15 phút | Batch trễ, vi phạm NFR-02 | Giảm số bước tích phân (32), chạy song song theo mã; đo thời gian ngay khi có mô hình alpha |
| forecast_input phình to (8 tin × 768 × 30 phiên mỗi dự báo) | CSDL lớn dần | Lưu embedding dạng tham chiếu doc_id thay vì giá trị, còn phần đặc trưng số lưu nguyên giá trị; vẫn tái lập được vì doc_embedding không đổi |
| Hai ngôn ngữ (JavaScript cho ứng dụng, Python cho mô hình) | Tốn thời gian chuyển ngữ cảnh | API, worker, web dùng chung JavaScript và packages/core; Python chỉ cho worker AI, giao tiếp qua bảng CSDL |
| SSI hoặc CafeF đổi API/HTML | ETL lỗi | Kiểm schema mỗi lần ETL, lưu raw, báo lỗi lên trang Quản trị (RK-09) |
| Ngày đáo hạn sai khi có nghỉ lễ bất thường | FR-M2-03 hiển thị sai | trading_calendar nhập tay lịch nghỉ công bố đầu năm; C5 tính lại due_on khi lịch đổi |
| Chat bịa số liệu, nêu khuyến nghị hoặc giá mục tiêu | Vi phạm NFR-13, KPI P8, rủi ro pháp lý | Mô hình chỉ diễn đạt dữ kiện đã truy xuất; kiểm tra số và trích dẫn, quét từ cấm; câu trả lời mẫu thay thế khi vi phạm; bộ chống bịa chặn phát hành |
| Dữ liệu cá nhân bị gửi sang API mô hình ngôn ngữ bên ngoài | Lộ thông tin danh mục | Cờ chat.personal_via_llm = false theo mặc định: câu hỏi cá nhân trả lời bằng bản mẫu; ngữ cảnh gửi đi không có email, tên; chốt chính sách ở mục 12.4 |
| Hạn mức hoặc chi phí API mô hình ngôn ngữ, email, Telegram bị vượt | Chat hoặc thông báo ngừng giữa buổi demo | Trần lượt hỏi theo người dùng và theo ngày, cache; chat tự hạ về câu trả lời mẫu; hàng đợi notification giữ dòng pending, retry, và cảnh báo vẫn có trong app |
| Chia tách, cổ tức bằng cổ phiếu làm giá vốn và khối lượng lệch | Lãi/lỗ tạm tính sai | Không tự điều chỉnh; người dùng nhập giao dịch điều chỉnh; ghi chú trên trang Portfolio; bình quân gia quyền đã chốt theo FR-M9-03; cách điều chỉnh còn cần xác nhận |
| Thiếu RLS và trigger chặn sửa audit | Một truy vấn quên điều kiện user_id có thể lộ dữ liệu; audit có thể bị sửa bằng quyền CSDL | Mọi repository nhận userId bắt buộc, kiểm thử cách ly A/B; bổ sung RLS và trigger append-only trước khi mở cho người dùng thật |
| Build iOS cần Apple Developer và macOS | Trễ GĐ3 | Dùng dịch vụ build đám mây, làm Android trước, web responsive hoặc PWA làm phương án dự phòng (RK-14) |
| Thêm bước plans, portfolio, notify làm batch vượt 20:00 hoặc thông báo trễ quá 5 phút | Vi phạm P5, NFR-15 | Mỗi bước ghi thời gian vào job_run; bước chạy theo truy vấn tập hợp, không lặp từng người; đo sớm trên dữ liệu mẫu |

### 12.2 Điểm lệch giữa Project Brief và PRD

Project Brief 0.0.4 đã được sửa theo PRD về tên nhãn (Tăng / Đi ngang / Giảm), thông báo trên mobile, vai trò lưu bộ lọc Screener, liên kết Journal và PDF Journal; không còn điểm lệch cần theo dõi.

### 12.3 Quy tắc đối chiếu với PRD

Nguồn đối chiếu là PRD v0.0.4 đính kèm. Khi bảng ưu tiên tổng quát, user story hoặc ví dụ persona khác bảng FR mục 10, SDD áp dụng vai trò và mức ưu tiên của từng FR; các mâu thuẫn của nguồn được ghi dưới đây để xác nhận, không tự sửa PRD.

FR-M5-02–FR-M5-05 là Must; PRD 0.0.4 đã sửa bảng 6.1 và US-05 thành Must cho khớp. Email và Telegram vẫn ở GĐ2. Giới hạn 10 chỉ là số mã trong watchlist mỗi người, không thay mục tiêu dữ liệu tối thiểu 15 mã của R5 và mục 12.1.

FR-M7-09 và FR-M7-10 đã được PRD 0.0.4 nâng thành Must cho khớp US-10 và AC-14; cả hai cần mô hình nên chưa triển khai. FR-M0-07 là Should nhưng AC-30 bao gồm đặt lại qua Admin và email; bản kiểm thử đầy đủ AC-30 phải bật chức năng này. Không diễn giải Should thành việc được bỏ qua AC đã chọn.

FR-M0-06 đã được PRD 0.0.4 viết lại: mật khẩu mới phải khác mật khẩu hiện tại (AC-30), không so mật khẩu giữa các tài khoản. Mức tin cậy 55% và alignment Journal vẫn là đề xuất thiết kế cần xác nhận. FR-M9-03 đã chốt giá vốn bình quân gia quyền; FIFO không còn là câu hỏi thay thế trong SDD.

### 12.4 Câu hỏi mở

Danh sách mã đã chốt: 17 mã: 10 HOSE (ACB, FPT, GAS, HPG, MBB, MWG, SSI, VCB, VIC, VNM), 4 HNX (HUT, IDC, PVS, SHS) và 3 UPCoM (BSR, QNS, VGT), giá SSI từ 13/04/2026; PRD 0.0.4 và Brief 0.0.4 đã đưa một số mã UPCoM thanh khoản cao vào phạm vi. Mốc lịch sử 3 năm cho huấn luyện chốt khi làm worker AI.

Chốt các ngưỡng đang "cần xác nhận" trong PRD: +3 điểm Macro F1, Macro F1 ≥ 0,40, AUC ≥ 0,60, k = 0,5, SUS ≥ 68; ngưỡng 45% đã có FR-M2-08; mức cao 55% còn là đề xuất, số mẫu nhỏ 50, bộ chống bịa 50 + 20 câu, p95 Chat 10 giây, KPI P7–P9.

Chat cần một mô hình ngôn ngữ: API ngoài có trần số lượt (mặc định đề xuất) hay máy chủ cục bộ tương thích OpenAI (cần máy lớn hơn).

Nơi chạy demo: hiện chạy trên máy cá nhân; có cần tên miền và HTTPS công khai không (webhook Telegram, mobile ngoài mạng nội bộ và cookie Secure cần HTTPS).

Nguồn BCTC: vnstock hay nguồn khác.

Chọn nhà cung cấp API mô hình ngôn ngữ, ngân sách trần và chính sách có gửi câu hỏi về dữ liệu cá nhân qua API ngoài hay không (mặc định không; PRD C2, A6, mục 16.1).

Chốt cách ghi giao dịch điều chỉnh khi chia tách, cổ tức bằng cổ phiếu và phí/thuế mặc định. Giá vốn dùng bình quân gia quyền theo FR-M9-03; không tự chuyển sang FIFO.

Thông báo đẩy FCM/APNs chỉ là hướng mở rộng ngoài PRD; GĐ3 hiện dùng danh sách trong app cùng email/Telegram, không triển khai kênh push trong lược đồ hiện hành.

Build iOS: tài khoản Apple Developer, máy macOS hay dịch vụ build đám mây; phát hành qua TestFlight hay cài trực tiếp (RK-14).

Cảnh báo concentration, screen_match và push không thuộc phạm vi triển khai theo PRD v0.0.4. Chỉ xem xét sau khi có yêu cầu và tiêu chí nghiệm thu mới được chấp thuận.

Đăng ký: khi nào bổ sung FR-M0-15 (TOTP và nguyên tắc hai người khi tạo Admin, xác nhận email cơ quan bằng thư, captcha, đồng ý lại khi đổi phiên bản); thời hạn lưu dữ liệu sau khi xóa tài khoản và đầu mối bảo vệ dữ liệu cá nhân; pháp chế xác nhận các điểm ở PRD §7.2 (C6) trước khi mở cho người dùng thật. Gmail SMTP (App Password) chỉ dùng cho demo, giới hạn khoảng 500 người nhận/ngày; triển khai thật cần dịch vụ gửi thư có tên miền riêng.

Đối chiếu số bảng/view có sẵn của db/schema.sql với mục 6.1 (bản 0.0.1 ghi 15, mục 6.1 liệt kê 14).


> Ghi chú: Tài liệu Word gốc có 3 ảnh/đối tượng hình ảnh nhúng; nội dung văn bản và bảng đã được chuyển đổi, hình ảnh không được nhúng trực tiếp vào Markdown.
