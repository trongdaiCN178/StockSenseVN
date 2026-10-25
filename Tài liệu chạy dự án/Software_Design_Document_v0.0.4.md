# Software Design Document for IDSS

| CODE | CAPSTONE_SDD |
| --- | --- |
| VERSION | 0.0.4 |
| STATUS | DRAFT UPDATED |
| AUTHOR | HOANG MINH TUAN |
| VERIFY | HOANG MINH TUAN |
| UPDATE | 13/10/2026 |
| RELATED DOCUMENT |  |

| Mã tài liệu | Phiên bản | Trạng thái | Tác giả | Ngày cập nhật |
| --- | --- | --- | --- | --- |
| CAPSTONE_SDD | 0.0.1 | Nháp | Hoàng Minh Tuấn | 08/10/2026 |
| CAPSTONE_SDD | 0.0.2 | Test | Hoàng Minh Tuấn | 08/10/2026 |
| CAPSTONE_SDD | 0.0.3 | Test | Trần Trọng Đại | 09/10/2026 |
| CAPSTONE_SDD | 0.0.4 | Test | Trần Trọng Đại | 13/10/2026 |

**MỤC LỤC**

## 1. Giới thiệu

Tài liệu này mô tả cách xây dựng hệ thống IDSS (tên thương mại tạm: StockSense VN) để đáp ứng toàn bộ yêu cầu Must-have và Should-have trong PRD v0.0.3 của ba giai đoạn (GĐ1 lõi dự báo, GĐ2 vòng quyết định, GĐ3 mobile), trên nền mã nguồn sẵn có trong DATN_2026.

### 1.1 Mục đích

Chuyển các yêu cầu chức năng FR-M0 đến FR-M14 và NFR-01 đến NFR-17 thành kiến trúc, thành phần, lược đồ dữ liệu, API và thiết kế mô hình cụ thể.

Làm căn cứ để lập trình, kiểm thử và viết chương thiết kế trong báo cáo đồ án.

### 1.2 Phạm vi

Hệ thống dự báo xác suất Tăng / Đi ngang / Giảm sau 2 và 5 phiên (T+2, T+5) cho tối thiểu 15 mã thanh khoản cao thuộc VN30 và HNX30, cập nhật mỗi ngày sau phiên, hiển thị trên web responsive và ứng dụng mobile (GĐ3). Từ GĐ2, hệ thống thêm Screener, Portfolio, Trade Plan, Journal, Chat hỏi đáp dựa trên dữ liệu hệ thống, báo cáo PDF và thông báo qua email/Telegram. Ngoài phạm vi: đặt lệnh tự động và kết nối API công ty chứng khoán, tư vấn đầu tư (kể cả chatbot đưa khuyến nghị mua/bán), UPCoM và phái sinh, dữ liệu tick.

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
| Hàng đợi thông báo (outbox) | Bảng notification: mỗi cảnh báo trên mỗi kênh là một dòng có khóa chống gửi trùng; notifier lấy các dòng chờ gửi |

### 1.4 Tài liệu tham chiếu

Project Brief CAPSTONE_PB v0.0.3 (09/10/2026).

Product Requirements Document CAPSTONE_PRD v0.0.3 (09/10/2026).

Mã nguồn DATN_2026: db/schema.sql, etl/prices.py, etl/news.py, Go web service (cmd/server, internal/*).

Khi tài liệu này khác bản thiết kế nháp trước đó (kỳ hạn h = 1, 3, 5 và năm nhóm người dùng), tài liệu này và PRD là bản có hiệu lực.

## 2. Tổng quan hệ thống

Hệ thống gồm một phần chạy theo lịch (nạp dữ liệu, chấm cảm xúc, sinh dự báo bằng Python) và một phần phục vụ người dùng (API và web bằng Go). Hai phần chỉ trao đổi qua PostgreSQL, nên API luôn trả dự báo đã tính sẵn và không chờ mô hình. Từ GĐ2 có thêm hai dịch vụ phụ: chat (Go) trả lời hỏi đáp và notifier (Python) gửi email/Telegram; cả hai cũng làm việc qua PostgreSQL, riêng api gọi chat qua HTTP nội bộ (D3).

### 2.1 Người dùng và vai trò

| Vai trò hệ thống | Persona (PRD mục 4) | Thấy được gì |
| --- | --- | --- |
| retail | P1, nhà đầu tư cá nhân | Tổng quan, forecast card T+2 và T+5 cạnh nhau, 3 câu giải thích đơn giản, tin tức, watchlist, cảnh báo (đổi nhãn, ngưỡng xác suất), lịch sử dự báo. GĐ2: Screener với bộ lọc có sẵn, Portfolio nhập tay, Trade Plan 4 trường, Journal ghi chú, Chat, xuất PDF, cảnh báo qua email/Telegram |
| trader | P2, swing trader; môi giới; quản lý danh mục | Như retail, thêm đóng góp theo nhóm yếu tố và trọng số tin. GĐ2: lưu bộ lọc Screener, Portfolio import CSV, Trade Plan đầy đủ (R:R, khối lượng theo mức rủi ro), Journal có thống kê nhìn lại, PDF Journal |
| analyst | P3, analyst/quant; môi giới | Như trader, thêm top 15 đặc trưng, tab Audit, trang Đánh giá mô hình đầy đủ (retail và trader chỉ thấy bản tóm tắt), xuất CSV, xem nhật ký Chat đã che nội dung cá nhân |
| admin | Quản trị viên | Quản lý người dùng, nguồn dữ liệu, lần chạy job, phiên bản mô hình, audit log, nhật ký gửi thông báo và nhật ký Chat đã che nội dung cá nhân; không đọc được nội dung Portfolio, Trade Plan, Journal của người dùng |
| (tài khoản demo dùng chung) | Hội đồng chấm | Xem demo bằng tài khoản analyst dùng chung (app_user.is_demo) do admin tạo trước buổi bảo vệ, chứa dữ liệu mẫu, không có dữ liệu cá nhân thật |

### 2.2 Bối cảnh và hệ thống bên ngoài

| Hệ thống ngoài | Vai trò | Cách kết nối |
| --- | --- | --- |
| SSI iBoard | Giá OHLCV ngày (thô và điều chỉnh), chỉ số VN-Index, VN30, HNX-Index, HNX30, danh sách rổ | HTTP JSON, etl/prices.py đã có cho VN30 |
| CafeF | Danh sách tin theo mã và trang bài viết | HTML, etl/news.py đã có |
| vnstock (hoặc nguồn tương đương) | Báo cáo tài chính quý kèm ngày công bố | Thư viện Python, ETL mới etl/financials.py |
| Google Colab / Kaggle | GPU để tinh chỉnh PhoBERT và huấn luyện mô hình | Notebook chạy mã trong ml/, checkpoint tải về và đăng ký phiên bản |
| Nhà cung cấp mô hình ngôn ngữ (API) hoặc máy chủ LLM cục bộ | Diễn đạt câu trả lời của Chat từ dữ liệu đã truy xuất | HTTPS tới API nhà cung cấp, hoặc LM Studio/llama.cpp qua giao diện tương thích OpenAI (chọn ở mục 12.4) |
| Telegram Bot API | Kênh thông báo và liên kết tài khoản Telegram | HTTPS, notifier dùng long polling nên không cần địa chỉ công khai |
| Máy chủ SMTP | Gửi email thông báo và xác thực email | SMTP với STARTTLS, hạn mức theo nhà cung cấp |
| TestFlight, bản cài trực tiếp Android | Phân phối thử nghiệm ứng dụng mobile (PRD A9) | Build React Native ngoài Docker Compose |
| Trình duyệt và ứng dụng mobile của người dùng | Giao diện web, ứng dụng iOS/Android | HTTPS qua reverse proxy; web dùng cookie, mobile dùng Bearer token |

### 2.3 Luồng nghiệp vụ chính

Sau 15:30 mỗi ngày giao dịch, batch ngày nạp giá, tin và BCTC mới, chấm cảm xúc tin mới, sinh dự báo T+2/T+5 cho toàn bộ mã và ghi vào CSDL trước 20:00; sau đó đánh dấu kế hoạch chạm điểm, tính lại danh mục và xếp hàng thông báo.

Người dùng mở trang tổng quan hoặc Screener, lọc và chọn mã, xem forecast card, giải thích, tin tức và lịch sử đúng/sai.

Khi dự báo đủ 2 hoặc 5 phiên, batch tự điền nhãn thực tế và cập nhật hit rate.

Từ một dự báo, người dùng tự lập Trade Plan (hệ thống chụp snapshot dự báo lúc đó), tự giao dịch tại công ty chứng khoán, ghi giao dịch vào Portfolio và đóng kế hoạch; hệ thống tạo bản ghi Journal so sánh quyết định với dự báo.

Khi có sự kiện (đổi nhãn, vượt ngưỡng, kế hoạch chạm điểm), cảnh báo xuất hiện trong ứng dụng và notifier gửi qua email/Telegram trong 5 phút, mỗi sự kiện một lần trên mỗi kênh.

Người dùng hỏi Chat bằng tiếng Việt; chat chỉ truy xuất dữ liệu đã lưu của hệ thống và của chính người dùng, trả lời kèm trích dẫn và từ chối yêu cầu đưa lệnh.

Admin theo dõi job và chọn phiên bản mô hình; mô hình mới được huấn luyện ngoài hệ thống và chỉ được phục vụ khi đạt điều kiện demo (PRD mục 12.6).

## 3. Ràng buộc, giả định và quyết định thiết kế

Thiết kế ưu tiên dùng lại mã sẵn có và hạ tầng miễn phí; ràng buộc chặt nhất là thời gian (GĐ1 là 12 tuần, khoảng 28 tuần cho ba giai đoạn) do một sinh viên thực hiện (PRD C1) và chi phí hạ tầng phát sinh từ GĐ2 (PRD C2).

### 3.1 Ràng buộc và giả định kế thừa từ PRD

**Ràng buộc:** GĐ1 12 tuần, GĐ2 dự kiến tuần 13–20 và GĐ3 dự kiến tuần 21–28, một người; lộ trình đến tuần 28 cần được giảng viên hướng dẫn chấp thuận (C1); chi phí gần 0 đồng ở GĐ1, GĐ2–GĐ3 có thể phát sinh chi phí mô hình ngôn ngữ (nếu dùng API), hosting và tài khoản nhà phát triển Apple, ngân sách trần chốt ở PRD mục 16.1 (C2); chỉ hiển thị tiêu đề, tóm tắt, URL và điểm cảm xúc của tin (C3); dùng lại DATN_2026 (C4); mọi màn hình dự báo, Trade Plan, cửa sổ Chat và báo cáo PDF có tuyên bố tham khảo (C5).

**Giả định:** tin CafeF theo mã còn đủ 3 năm (A1, chưa kiểm chứng); lấy được giá điều chỉnh và BCTC quý miễn phí (A2); tự gán nhãn được 2.000–3.000 tin (A3); cập nhật một lần mỗi ngày là đủ (A4); huấn luyện bằng GPU miễn phí, suy luận trên CPU (A5); mô hình ngôn ngữ cho Chat chạy cục bộ hoặc gọi API, chưa chốt (A6); Telegram Bot API và SMTP miễn phí đủ cho bản demo (A7, A8); mobile phát hành thử nghiệm qua TestFlight và bản cài trực tiếp Android (A9); dữ liệu cá nhân trong demo là dữ liệu mẫu hoặc do người thử tự nhập (A10).

### 3.2 Quyết định thiết kế

| Mã | Quyết định | Lý do | Phương án đã loại |
| --- | --- | --- | --- |
| D1 | Backend API và web viết bằng Go, mở rộng từ cmd/server của DATN_2026; dịch vụ Chat (cmd/chat) cũng viết bằng Go | Đã có proxy tin, bảng giá, httpx và Dockerfile; Go đáp ứng dễ API dưới 300 ms (NFR-02); cmd/chat dùng lại auth, store và internal/ai | Viết lại bằng FastAPI: tốn thời gian, bỏ phần đã chạy |
| D2 | ETL, NLP, huấn luyện và suy luận viết bằng Python trong một worker riêng; notifier (gửi email/Telegram) cũng viết bằng Python | Hệ sinh thái PyTorch, Transformers, Captum; ETL Python đã có | Gọi mô hình từ Go qua ONNX: phức tạp, không cần vì dự báo tính theo lô |
| D3 | Go và Python chỉ giao tiếp qua PostgreSQL; lệnh chạy lại job là một dòng job_run trạng thái queued. Ngoại lệ duy nhất: api gọi dịch vụ chat qua HTTP nội bộ | Một nguồn sự thật, không cần message broker, dễ truy vết. Chat cần trả lời trong vài giây; hàng đợi job_run thêm chu kỳ poll và khó giữ p95 dưới 10 giây (NFR-14). api chỉ chuyển user_id đã xác thực, chat không nhận danh tính từ trình duyệt | Redis/Celery: thêm một dịch vụ phải vận hành. Chat qua hàng đợi job_run: thêm độ trễ poll, khó hiển thị trạng thái chờ |
| D4 | Dự báo tính theo lô mỗi ngày và lưu sẵn, kèm giải thích. Chat không suy luận dự báo, chỉ đọc dự báo đã lưu | Đáp ứng NFR-01/02 và A4; giải thích bằng IG tốn thời gian, không nên tính theo yêu cầu; mô hình ngôn ngữ chỉ diễn đạt dữ liệu đã truy xuất (PRD A6) | Suy luận trực tuyến mỗi lần mở trang |
| D5 | Lược đồ kế thừa db/schema.sql (3 tầng thô / xử lý / đặc trưng, point-in-time 15:00) và bổ sung bảng ứng dụng ở GĐ1, bảng dữ liệu cá nhân và thông báo ở GĐ2 | Lược đồ hiện có đã khớp PRD về cut-off và BCTC theo ngày công bố | Thiết kế lại từ đầu |
| D6 | Giao diện web viết bằng React + TypeScript, đóng gói bằng Vite thành file tĩnh do Go phục vụ; biểu đồ nến bằng TradingView Lightweight Charts; kiểu dữ liệu API, client và hàm tính R:R/khối lượng nằm trong packages/core dùng chung với mobile | Nhiều trang nghiệp vụ, biểu mẫu (Trade Plan, Portfolio, bộ lọc) và Chat cần quản lý trạng thái và kiểm tra nhập liệu; cùng React với React Native (D7) nên một người học một bộ công cụ cho cả hai; build chạy trong Docker, không thêm container. Trang tin và bảng giá có sẵn được chuyển sang khi bắt đầu dashboard (tuần 4) | HTML/CSS/JS thuần (quyết định ở bản 0.0.1, đủ cho khoảng 8 màn hình): với nhiều trang phải tự viết định tuyến, trạng thái và kiểm tra biểu mẫu, không dùng chung được với mobile. Vue hoặc Svelte: không dùng chung được với React Native |
| D7 | Mobile là ứng dụng React Native một codebase cho iOS và Android, dùng chung API REST /api/v1 và packages/core với web; web responsive từ 375 px (có thể thêm PWA) là phương án dự phòng. Xác thực: web giữ cookie JWT HttpOnly, mobile gửi Authorization: Bearer với token lưu trong Keychain/Keystore, middleware chấp nhận cả hai; kênh thông báo đẩy được chừa sẵn (mục 8.3). Đăng xuất trên mobile gọi POST /auth/logout để thu hồi phiên rồi mới xóa token trong Keychain/Keystore; khi nhận 401 thì xóa token và chuyển về màn hình đăng nhập. | Theo PRD 6.1 (M14, Must-have GĐ3), FR-M14-01..05 và NFR-17; Project Brief 0.0.2 nêu "nhận thông báo" trong chức năng cốt lõi của mobile | Chỉ web responsive (quyết định ở bản 0.0.1): không đáp ứng M14. Hai codebase native riêng hoặc Flutter: thêm ngôn ngữ và không dùng chung được với web |
| D8 | Một mô hình đa phương thức với hai đầu ra T+2 và T+5; embedding PhoBERT tính một lần và lưu lại | Theo PRD 12.4 và RK-10; suy luận trên CPU đủ nhanh | Hai mô hình riêng cho từng kỳ hạn |
| D9 | Triển khai bằng Docker Compose trên một máy từ 8 GB RAM (VPS hoặc máy cá nhân) gồm 6 container: db, api, worker, chat, notifier, proxy. Mô hình ngôn ngữ cho Chat mặc định gọi API có trần số lượt; chạy cục bộ chỉ khi có máy đủ RAM (mục 12.4) | Theo NFR-11. Tổng RAM ước tính 3,7–5,7 GB cho 6 container (mục 10.1), không còn vừa VPS 4 GB; mô hình ngôn ngữ cục bộ cỡ vài tỷ tham số cần thêm nhiều GB RAM và chạy CPU chậm, khó giữ NFR-14 (dưới 10 giây) | VPS 4 GB (bản 0.0.1): không đủ. Kubernetes: thừa cho quy mô demo. Mô hình ngôn ngữ cục bộ làm mặc định: cần nâng cấu hình máy |
| D10 | Báo cáo PDF sinh đồng bộ trong api bằng thư viện Go (go-pdf/fpdf) với font Unicode nhúng; số liệu lấy từ cùng hàm truy vấn với màn hình | NFR-16: số liệu khớp màn hình, dưới 10 giây với tối đa 10 mã; không thêm container; đủ cho bảng, thanh xác suất và tuyên bố | Container riêng chạy Chromium từ HTML: dàn trang đẹp hơn nhưng thêm khoảng 500 MB RAM (ước tính); sẽ chuyển sang nếu bản thử GĐ2 dàn trang không đạt. Sinh PDF qua job_run: thêm độ trễ poll |
| D11 | Chat chạy trong dịch vụ chat riêng: bộ chặn lệnh, truy xuất bằng truy vấn cố định, mô hình ngôn ngữ diễn đạt, bộ kiểm tra đầu ra (số liệu, trích dẫn, từ cấm); mô hình ngôn ngữ nằm sau giao diện LLMClient có hai bộ nối (API, cục bộ) | FR-M12-02..05 và NFR-14: mọi số liệu phải có nguồn; lỗi hoặc chậm của mô hình ngôn ngữ không ảnh hưởng trang dự báo; đổi bộ nối không đổi mã nghiệp vụ vì PRD A6 chưa chốt | Agent tự gọi công cụ và sinh SQL: khó bảo đảm cách ly dữ liệu cá nhân và kiểm tra bịa. Cơ sở dữ liệu vectơ cho toàn bộ tin: không cần, dữ liệu chủ yếu có cấu trúc |
| D12 | Thông báo ngoài app qua bảng notification làm hàng đợi (outbox) và dịch vụ notifier riêng gửi email/Telegram; khóa duy nhất (kênh, cảnh báo) chống gửi trùng | NFR-15: tối đa 1 lần mỗi kênh dù batch chạy lại; retry và nhật ký gửi không phụ thuộc batch; Telegram dùng long polling nên chạy được trên máy không có địa chỉ công khai | Gửi trực tiếp trong batch: lỗi kênh làm chậm cả quy trình, khó retry. Webhook Telegram: cần HTTPS công khai |
| D13 | Dữ liệu cá nhân (Portfolio, Trade Plan, Journal, Chat) gắn user_id và bật Row-Level Security cho role của api và chat; mọi hàm truy cập dữ liệu cá nhân trong store bắt buộc nhận userID | NFR-07/08 và AC-26: admin không đọc được nội dung; một truy vấn quên điều kiện user_id không làm lộ dữ liệu | Chỉ kiểm quyền trong mã Go: một truy vấn thiếu điều kiện là lộ dữ liệu. Mã hóa từng cột: phức tạp, không cần cho demo |
| D14 | JWT HS256 có uid và sid; sid trỏ tới auth_session. Mỗi request kiểm tra phiên còn hiệu lực tối đa 24 giờ, trạng thái khóa và vai trò hiện tại trong app_user. Khóa hoặc đổi vai trò thu hồi mọi phiên ngay trong transaction. | FR-M0-01–07; AC-27, AC-29, AC-30. Cùng cơ chế thu hồi cho web và mobile; vai trò trong JWT nếu có chỉ là thông tin tham khảo. | JWT không tra phiên: không thu hồi ngay. Redis: thêm dịch vụ vận hành. |
| D15 | Tái lập dự báo chạy qua hàng đợi CSDL: API ghi một dòng forecast_replay trạng thái queued, worker Python lấy dòng, chạy ml/replay.py và ghi kết quả. Replay không ghi đè dự báo gốc. | FR-M7-10 và AC-14; giữ nguyên D3 (Go và Python chỉ giao tiếp qua PostgreSQL). Replay là thao tác hiếm, độ trễ poll chấp nhận được. | Go gọi trực tiếp Python qua HTTP: thêm ngoại lệ cho D3. Chạy replay đồng bộ trong api: kéo PyTorch vào tiến trình Go. |
| D16 | audit_log chỉ thêm, không sửa/xóa. Thành công được ghi cùng transaction với thay đổi quản trị; kết quả từ chối hoặc lỗi được ghi bằng transaction riêng sau rollback, không kèm bí mật. | FR-M7-05, FR-M7-11, NFR-09, US-25/UC-25 và AC-29; ghi được trước/sau và kết quả. | Chỉ ghi log ra tệp hoặc ghi sau commit: khó truy vấn và có thể thiếu sự kiện. |

## 4. Kiến trúc tổng thể

Kiến trúc có hai khối xử lý độc lập, worker Python và api Go, cùng dùng một CSDL PostgreSQL; không khối nào gọi trực tiếp khối kia. Từ GĐ2 có thêm hai dịch vụ phụ là chat (Go) và notifier (Python); chỉ api gọi chat qua HTTP nội bộ, đó là ngoại lệ duy nhất của nguyên tắc "chỉ qua PostgreSQL" (D3).

kiến trúc triển khai · 6 container, 7 dịch vụ ngoài

Worker chạy tuần tự các bước batch (C1 đến C5) mỗi ngày và ghi kết quả vào CSDL; api chỉ đọc kết quả đó và ghi dữ liệu của người dùng (watchlist, giao dịch, kế hoạch, nhật ký). Lệnh chạy lại job từ trang Quản trị cũng đi qua CSDL dưới dạng một dòng job_run chờ xử lý (D3). notifier lấy các dòng notification chờ gửi và gửi email/Telegram độc lập với batch (D12). chat nhận từ api câu hỏi cùng user_id đã xác thực, chỉ đọc dữ liệu bằng role CSDL chỉ đọc có RLS và không bao giờ suy luận dự báo (D11). Mô hình được huấn luyện bên ngoài, chỉ checkpoint đã qua cổng đánh giá mới được đưa vào worker. Ứng dụng mobile (C12) không phải container: nó gọi cùng API /api/v1 qua proxy như trình duyệt.

## 5. Thiết kế chi tiết các mô-đun

Hệ thống có 12 thành phần kỹ thuật (C1–C12); mười bốn mô-đun nghiệp vụ M0–M14 của PRD là các lát cắt qua API (C6), giao diện web và mobile (C7, C12) và các thành phần C9–C11, dùng dữ liệu do C1–C5 tạo ra.

### 5.1 Thành phần kỹ thuật

| Mã | Thành phần | Ngôn ngữ, vị trí | Trách nhiệm | Hiện trạng trong DATN_2026 |
| --- | --- | --- | --- | --- |
| C1 | ETL dữ liệu | Python, etl/ | Nạp giá, chỉ số, tin, BCTC; kiểm tra schema nguồn; retry 3 lần | Có prices.py (VN30), news.py; thiếu HNX30, HNX-Index, financials.py |
| C2 | NLP cảm xúc | Python, ml/sentiment/ | Tách từ, chấm cảm xúc 3 lớp kèm độ tin cậy, tính và lưu embedding PhoBERT | Chưa có; bảng nlp_model, sentiment đã có |
| C3 | Đặc trưng và nhãn | SQL + Python, ml/features/ | Chỉ báo kỹ thuật, ghép BCTC point-in-time, gộp cảm xúc theo phiên, tạo nhãn T+2/T+5 | Có view feature_daily, sentiment_daily |
| C4 | Suy luận và giải thích | Python, ml/serve/ | Chạy phiên bản mô hình đang phục vụ, tính xác suất, IG, attention, câu giải thích, snapshot | Chưa có |
| C5 | Hậu xử lý | Python, ml/post/ | Điền nhãn thực tế khi đáo hạn, tính hit rate, tạo cảnh báo (đổi nhãn, ngưỡng, kế hoạch chạm điểm), tính lại danh mục, xếp hàng thông báo, theo dõi drift | Chưa có |
| C6 | API | Go, internal/api/ | REST JSON, xác thực JWT (cookie hoặc Bearer), RBAC, kiểm quyền sở hữu dữ liệu cá nhân; đọc dự báo lưu sẵn; ghi watchlist, giao dịch, kế hoạch, nhật ký, bộ lọc, cảnh báo, admin; sinh PDF (C10); chuyển hỏi đáp tới chat (C11) | Có server, httpx, news, market; chưa có auth |
| C7 | Giao diện web | React + TypeScript (Vite), web/ | Các trang nghiệp vụ và màn hình xác thực ở mục 8.2 | Có trang tin và bảng giá (HTML thuần, sẽ chuyển sang React) |
| C8 | Bộ lập lịch | Python (APScheduler) trong worker | Chạy batch ngày 12 bước sau 15:30, nhận job queued từ admin, ghi job_run | Chưa có |
| C9 | Thông báo | Python, notifier/ | Lấy dòng notification chờ gửi, gửi email (SMTP) và Telegram, retry 3 lần, ghi nhật ký gửi; xử lý liên kết Telegram bằng long polling | Chưa có |
| C10 | Báo cáo PDF | Go, internal/report/ | Sinh PDF mã, danh mục, Trade Plan, Journal từ cùng truy vấn với màn hình; tuyên bố, thời điểm dữ liệu, phiên bản mô hình, số trang | Chưa có |
| C11 | Chat hỏi đáp | Go, cmd/chat, internal/chat/, internal/ai/ | Bộ chặn lệnh, truy xuất, gọi mô hình ngôn ngữ qua LLMClient, kiểm tra đầu ra, trích dẫn, ghi log (mục 5.3) | Có internal/ai gọi LM Studio (thay đổi chưa commit, cần kiểm tra mã); chưa có phần còn lại |
| C12 | Ứng dụng mobile | React Native + TypeScript, mobile/ | Ứng dụng iOS/Android dùng chung API và packages/core với web (mục 8.3) | Chưa có |

### 5.2 Thiết kế theo mô-đun nghiệp vụ

**M0. Xác thực và phiên**. Đăng nhập bằng email chuẩn hóa và mật khẩu bcrypt cost 12. Chính sách FR-M0-06: 8–64 ký tự, có chữ, số và ký tự đặc biệt; kiểm tra không quá 72 byte UTF-8 trước bcrypt, không cắt ngầm. Mật khẩu mới phải khác mật khẩu hiện tại (AC-30). Đăng nhập thành công tạo auth_session và JWT uid/sid với hạn tối đa 24 giờ. Middleware kiểm tra phiên, locked, locked_until và vai trò trong CSDL ở mỗi request. Token sai, hết hạn hoặc bị thu hồi trả 401; thiếu quyền trả 403. Email không tồn tại, sai mật khẩu, bị khóa đều trả thông báo chung (FR-M0-01, 03).

Kiểm soát đăng nhập sai (FR-M0-04): khóa hàng app_user khi cập nhật fail_count và fail_window_started_at để các request đồng thời không vượt qua bộ đếm. Lần sai đầu mở cửa sổ 15 phút; lần sai thứ 5 trong cửa sổ đặt locked_until = thời điểm hiện tại + 15 phút. Trong thời gian khóa tạm, kể cả đúng mật khẩu cũng bị từ chối; sau cửa sổ hết hạn mở bộ đếm mới. Đăng nhập thành công đặt bộ đếm về 0. Ghi security_event cho từng lần sai, khóa tạm và đăng nhập thành công, không ghi mật khẩu/token; email không tồn tại chỉ ghi thông tin an toàn và áp dụng giới hạn request.

Đăng xuất thu hồi phiên hiện tại trước khi xóa cookie hoặc token mobile. Người dùng đổi mật khẩu bằng mật khẩu hiện tại và mật khẩu mới: cập nhật hash và thu hồi mọi phiên khác trong cùng transaction, giữ phiên hiện tại nếu không phải đặt lại bắt buộc (FR-M0-02, 05). Admin đặt mật khẩu tạm đạt chính sách, đặt must_change_password, thu hồi tất cả phiên; phiên đăng nhập tiếp theo chỉ gọi /auth/change-password, /auth/logout hoặc /me để hiển thị trạng thái bắt buộc đổi. Đổi xong phát hành phiên mới, không kéo dài phiên cũ (FR-M0-07, AC-30).

Tự đặt lại qua email (Should, FR-M0-07): /auth/forgot-password luôn trả cùng thông điệp, không tiết lộ tài khoản tồn tại. Tạo token ngẫu nhiên, chỉ lưu SHA-256 trong password_reset_token, hết hạn 30 phút; email được xếp hàng trong auth_mail_outbox GĐ1, worker gửi SMTP độc lập với giao dịch API. /auth/reset-password khóa bản ghi token, kiểm tra hạn và used_at, mật khẩu mới đạt chính sách và khác mật khẩu cũ; cập nhật hash, đánh dấu token đã dùng, vô hiệu các token còn lại và thu hồi mọi phiên trong cùng transaction. Hai request dùng cùng token chỉ một request được chấp nhận. Sau đó người dùng đăng nhập lại. Không lưu token hoặc liên kết đặt lại trong log.

**M1. Tổng**** quan thị trường.** API GET /symbols trả một dòng mỗi mã từ view v_overview (giá đóng cửa, % thay đổi, GTGD bình quân 20 phiên, dự báo T+2 và T+5 mới nhất của phiên bản đang phục vụ). Lọc, sắp xếp và tìm kiếm làm ở phía client vì chỉ có 15–60 mã; phần đầu trang lấy ngày dữ liệu và giờ hoàn tất batch từ job_run (FR-M1-05). Từ GĐ2, dải thị trường (VN-Index, HNX-Index, độ rộng thị trường, tỷ lệ mã theo nhãn) lấy từ view v_market_summary làm mới cuối batch (FR-M1-06); khối "Tín hiệu đổi hôm nay" lấy các dòng v_overview có changed_t2 hoặc changed_t5 (FR-M1-07).

**M2. Forecast card và trang chi tiết.** Mỗi bản ghi forecast chứa ba xác suất (tổng bằng 1 sau softmax, làm tròn hiển thị sao cho tổng 100% ± 0,1), nhãn, ngày T, ngày đáo hạn tính từ bảng trading_calendar, cờ trạng thái dữ liệu và cờ "độ tin cậy thấp" khi xác suất cao nhất dưới 45% (RK-06). T+2 và T+5 được đánh dấu mâu thuẫn khi một bên Tăng và bên kia Giảm (FR-M2-05). Nhãn nội bộ up/hold/down được hiển thị là Tăng/Đi ngang/Giảm: API trả cả label và label_vi, giao diện, PDF và Chat chỉ dùng label_vi. Hai forecast card T+2 và T+5 đặt cạnh nhau là bố cục chính của trang (mục 8.2). Từ GĐ2, mức tin cậy 3 bậc (FR-M2-08) được tính trong batch từ xác suất lớp cao nhất (dưới 45% là thấp, 45–55% trung bình, trên 55% cao; ngưỡng cần xác nhận), hạ một bậc khi T+2 và T+5 mâu thuẫn hoặc data_status không rỗng, và lưu ở forecast.confidence. Khối "Điều gì có thể làm dự báo sai" (FR-M2-09) là 2–3 câu sinh từ quy tắc cấu hình (sắp đến lịch công bố BCTC, thiếu tin, thanh khoản thấp, T+2 và T+5 mâu thuẫn, hit rate gần đây thấp), lưu ở forecast_explanation.risk_notes, không dùng từ MUA/BÁN.

**M3. Giải thích.** C4 lưu cho mỗi dự báo: tỷ trọng 3 nhóm (tài chính, kỹ thuật, tin tức), top 15 đặc trưng kèm giá trị thô và chiều đóng góp, trọng số attention từng tin, và 3 câu tiếng Việt sinh từ mẫu. API cắt phần trả về theo vai trò ở phía server (retail: 3 câu; trader: thêm tỷ trọng nhóm; analyst: toàn bộ). Nhóm bị thiếu dữ liệu không có dòng giải thích mà thay bằng thông báo trạng thái (FR-M3-04).

**M4. Tin tức và cảm xúc.** Tin được loại trùng bằng content_hash và khóa (source, url); giao diện chỉ hiển thị tiêu đề, sapo, nguồn, thời gian, link gốc (C3 của PRD), nội dung đầy đủ chỉ dùng nội bộ cho NLP. Biểu đồ cảm xúc 30 phiên lấy từ sentiment_daily. Cut-off 15:00 được thực thi một chỗ duy nhất trong view này (FR-M4-06).

M5. Watchlist và cảnh báo. Giới hạn 10 mã/người được kiểm tra tại API và trigger CSDL; mã thứ 11 trả 409 kèm thông báo. PUT thêm cùng mã là idempotent; trigger khóa hàng app_user trước khi đếm để chặn hai request đồng thời vượt giới hạn. Ghi chú watchlist.note thuộc phần mở rộng GĐ2. Cảnh báo trong app FR-M5-02–05 là Must GĐ1 theo bảng FR: mọi R/T/A có thể đặt ngưỡng theo mã/kỳ hạn, xem đổi nhãn và lịch sử 90 ngày. C5 lưu last_state; chỉ tạo cảnh báo khi từ dưới lên đạt ngưỡng, không lặp khi còn trên ngưỡng, chỉ tái kích hoạt sau khi đã xuống dưới. event_key duy nhất theo user bảo đảm chạy lại không trùng. Giao diện poll 60 giây để hiển thị trong 5 phút sau forecast. GĐ2 thêm plan_touch và các kênh email/Telegram đã xác thực; notifier poll 30 giây, lần gửi đầu ngay, tối đa 3 lần retry sau 30, 60 và 120 giây để hỗ trợ mục tiêu 5 phút. Hết retry ghi failed; cảnh báo trong app vẫn tồn tại. Liên kết Telegram và xác thực email dùng mã một lần (FR-M5-06–08).

**M6. Lịch sử dự báo và đánh giá.** C5 điền actual_label cho dự báo đã đủ 2 hoặc 5 phiên bằng cùng quy tắc gán nhãn với lúc huấn luyện; dự báo chưa đáo hạn có actual_label rỗng và hiển thị "Đang chờ". Hit rate, precision, recall theo lớp trong cửa sổ 30/90 phiên tính bằng SQL khi gọi API. Trang Đánh giá mô hình đọc model_run.metrics của các lần huấn luyện, gồm baseline và 3 cấu hình ablation. Mỗi hit rate trả kèm n (số dự báo đã đáo hạn trong cửa sổ), cờ small_sample khi n dưới 50 và hit rate của baseline "lớp phổ biến nhất" trong cùng cửa sổ; giao diện ghi chú T+5 chồng lấn nên số mẫu độc lập ít hơn n (FR-M6-06). Retail và trader xem bản tóm tắt qua GET /models/summary (phiên bản đang phục vụ, ngày huấn luyện, hit rate tổng 30/90 phiên kèm n và baseline); confusion matrix, ablation và hiệu chỉnh chỉ dành cho analyst và admin. Từ GĐ2, evaluate.py thêm Brier score, ECE và dữ liệu reliability diagram vào model_run.metrics.calibration (FR-M6-07).

M7. Quản trị và vận hành mô hình. Admin tạo tài khoản với email hợp lệ, chưa tồn tại và mật khẩu đạt FR-M0-06; khóa/mở khóa, đổi vai trò, đặt lại mật khẩu và thu hồi phiên. Khóa hoặc đổi vai trò thu hồi tất cả phiên cùng transaction, request tiếp theo nhận 401; lần đăng nhập mới dùng vai trò mới (AC-27/29). Khóa hàng quản trị trước khi đếm Admin đang hoạt động, chặn khóa hoặc hạ quyền nếu làm mất Admin hoạt động cuối cùng (UC-12). Không có endpoint Admin đọc Portfolio, Trade Plan hay Journal của người dùng.

Nguồn dữ liệu và pipeline (US-13/UC-13, US-24/UC-24): Admin xem nguồn, mã job, thời điểm, trạng thái, số bản ghi và lỗi; chạy lại ghi job_run queued. Scheduler chạy sau 15:30 theo Asia/Ho_Chi_Minh và trading_calendar. Worker dùng khóa advisory theo batch ngày hoặc job/ngày, không chạy trùng; GET trạng thái không trực tiếp khởi chạy mô hình. Ghim model_version lúc bắt đầu batch; đổi hoặc rollback chỉ có hiệu lực từ batch kế tiếp (AC-16). Mỗi bước ghi job_run và liên kết parent_job_id; lỗi giá sau retry giữ forecast cũ và báo stale, không sinh mới (AC-28). FR-M7-08 bổ sung thông báo vận hành bằng ops_event; không ghi chung với cảnh báo tài chính của người dùng.

Audit đầu vào và tái lập (US-10/UC-10, FR-M7-09/10): Analyst/Admin đọc giá, đặc trưng kỹ thuật, BCTC và metadata tin đã dùng từ snapshot cố định; không đọc từ các view hiện tại để thay thế. API tạo forecast_replay queued, worker chạy đúng model_version và snapshot, ghi xác suất chạy lại, sai số tuyệt đối lớn nhất và kết quả pass khi < 1e-4. Thiếu snapshot, embedding hoặc checkpoint trả not_reproducible và ghi log. Không ghi đè forecast, không sinh cảnh báo hay làm mới view từ replay.

Nhật ký quản trị (US-25/UC-25, FR-M7-05/11): mỗi sự kiện gồm thời điểm, actor, action, target, before/after đã lọc bí mật và outcome success/denied/failed. Ghi nhật ký tạo tài khoản, khóa/mở khóa, đổi vai trò, đặt lại mật khẩu, thu hồi phiên, chạy lại job, chọn/rollback mô hình. API Admin lọc theo thời gian, người thực hiện, action và target, sắp mới nhất trước, có phân trang; vai trò khác trả 403, không có API sửa/xóa. Trigger CSDL từ chối UPDATE/DELETE; giữ tối thiểu 90 ngày. Log gửi và Chat chỉ hiển thị phần được phép; tài khoản demo chứa dữ liệu mẫu do Admin tạo.

**M8. Screener (GĐ2).** GET /screener lọc trên view v_screener (materialized view làm mới cuối batch, gộp v_overview với mức tin cậy, hit rate 90 phiên kèm n, cờ đổi nhãn và data_status) bằng truy vấn tham số hóa, chỉ nhận các cột và toán tử trong danh sách trắng (FR-M8-01, 02, 05). Bộ lọc có sẵn cho retail là hằng số trong mã (FR-M8-03); trader và analyst lưu bộ lọc có tên vào saved_screen, tối đa 20 mỗi người (FR-M8-04). Thứ tự mặc định là thanh khoản giảm dần chứ không phải xác suất, và trang luôn hiển thị tuyên bố, để kết quả là danh sách sàng lọc chứ không phải bảng xếp hạng "nên mua" (FR-M8-07). Mỗi dòng có liên kết thêm watchlist, mở chi tiết mã và lập Trade Plan với mã đã chọn (FR-M8-06). Kiểm thử đối chiếu API với truy vấn SQL viết tay trên 5 bộ lọc mẫu (AC-17).

M9. Portfolio (GĐ2). Giao dịch lưu trong portfolio_tx (mua/bán, khối lượng, giá, phí, nguồn manual hoặc csv); vị thế không lưu mà được tính khi gọi API theo giá vốn bình quân gia quyền, lãi/lỗ đã thực hiện khi bán và lãi/lỗ tạm tính theo giá đóng cửa gần nhất trong price_daily (FR-M9-03); dùng thống nhất theo FR-M9-03; việc ghi giao dịch điều chỉnh còn cần chốt (mục 12.4). API từ chối giao dịch bán vượt khối lượng đang nắm tại ngày đó. Import CSV (trader, analyst) gồm hai bước: POST /portfolio/import?dry_run=1 đọc tệp và trả bản xem trước với số dòng hợp lệ, danh sách dòng lỗi kèm lý do và dòng trùng (so với dedup_key đã có); bước xác nhận chỉ ghi các dòng hợp lệ trong một transaction (FR-M9-02, AC-18). Mỗi vị thế kèm nhãn T+2/T+5 hiện tại và dấu đổi nhãn lấy từ v_overview, không kèm khuyến nghị (FR-M9-04). Tổng quan danh mục và giá trị theo thời gian (FR-M9-05) tính theo yêu cầu từ giao dịch và price_daily. Chia tách và cổ tức bằng cổ phiếu chưa được tự điều chỉnh; người dùng nhập giao dịch điều chỉnh (mục 12.1). DELETE /portfolio xóa toàn bộ giao dịch của người dùng và chỉ ghi audit_log hành động, không ghi nội dung (FR-M9-06). Không có mã nào gọi API công ty chứng khoán.

M10. Trade Plan (GĐ2). Kế hoạch lưu ở trade_plan; giá vào, cắt lỗ, mục tiêu do người dùng nhập và biểu mẫu không điền sẵn các giá trị này (FR-M10-01). Chỉ hỗ trợ kế hoạch mua vì cổ phiếu cơ sở không bán khống: cắt lỗ thấp hơn vùng vào, vùng vào thấp hơn mục tiêu, API kiểm tra và ràng buộc CHECK trong CSDL. Khi lưu, API sao chép nhãn và xác suất T+2/T+5, phiên bản mô hình và snapshot_hash của dự báo mới nhất vào cột snapshot (kèm forecast_id_t2, forecast_id_t5); trigger từ chối UPDATE các cột này và role api không có quyền DELETE trên trade_plan (FR-M10-02, AC-19). R:R = (mục tiêu − giá vào) / (giá vào − cắt lỗ) với giá vào tham chiếu là trung điểm vùng vào; khối lượng tối đa = vốn × mức rủi ro % / (giá vào − cắt lỗ), làm tròn xuống theo lô 100 (FR-M10-03, 04; ví dụ AC-19: 100 triệu, 1%, giá vào 25.000, cắt lỗ 23.500 cho 600 cổ phiếu, R:R 2,0). Hàm tính được viết một lần trong Go (nguồn chính, dùng số thập phân, không dùng số thực) và một lần trong packages/core cho bản xem trước trên biểu mẫu; hai bản dùng chung một bộ ca kiểm thử. Bản rút gọn của retail chỉ khác ở biểu mẫu và quyền: API từ chối capital_vnd và risk_pct từ retail, POST /plans/calc cho retail tính R:R và khoảng cách %, chỉ trader và analyst tính thêm khối lượng. Trạng thái nháp → chờ vào → đang mở → đã đóng; chỉ người dùng xác nhận chuyển trạng thái, C5 chỉ ghi gợi ý vào suggested khi giá đóng cửa chạm mốc (FR-M10-05). Cảnh báo kế hoạch (FR-M10-06) là quy tắc alert_rule loại plan_touch, được bước plans của batch đánh giá (chạm vùng vào, cắt lỗ, mục tiêu, hoặc nhãn dự báo hiện tại ngược snapshot) và đi qua cùng cơ chế thông báo của M5. Khi đóng, người dùng nhập giá thoát và ghi chú; API đóng kế hoạch và tạo Journal trong cùng một transaction (FR-M10-07). Lịch sử chỉnh sửa nằm ở cột history (jsonb, chỉ thêm) (FR-M10-09); tuyên bố "Trade Plan do bạn tự lập" hiện trên trang và trong PDF (FR-M10-08).

**M11. Journal (GĐ2).** Bản ghi journal_entry được API tạo trong cùng transaction với việc đóng Trade Plan; ràng buộc UNIQUE (plan_id) cùng INSERT ... ON CONFLICT DO NOTHING bảo đảm đóng lại lần hai không tạo bản ghi trùng (FR-M11-01, AC-20). Bản ghi sao chép snapshot và kế hoạch gốc (không sửa được), kèm giá thoát, lãi/lỗ % và số phiên nắm giữ; nhãn thực tế T+2/T+5 tương ứng được C5 điền ở bước resolve khi đáo hạn. Cột alignment so sánh quyết định với dự báo theo quy tắc đề xuất (cần xác nhận): with khi có ít nhất một kỳ hạn Tăng và không kỳ hạn nào Giảm, against khi có ít nhất một kỳ hạn Giảm và không kỳ hạn nào Tăng, mixed khi một kỳ hạn Tăng và một kỳ hạn Giảm, neutral khi cả hai Đi ngang (FR-M11-03). Người dùng sửa ghi chú, thẻ và bài học nhưng không sửa snapshot và kết quả (FR-M11-02). Ghi thủ công không có kế hoạch (kind = manual, FR-M11-04) được gắn dự báo của ngày đó. Thống kê nhìn lại theo tuần, tháng, quý tính bằng SQL kèm số mẫu và cờ small_sample (FR-M11-06). Chỉ chủ sở hữu đọc được nhật ký; admin không có endpoint đọc nội dung (FR-M11-07).

**M12. Chat hỏi đáp (GĐ2).** POST /chat/sessions/{id}/messages được api chuyển tới dịch vụ chat (C11) kèm user_id đã xác thực; quy trình và các lớp bảo vệ nằm ở mục 5.3. Hội thoại lưu ở chat_session và chat_message, giữ 90 ngày (FR-M12-07); lượt hỏi về dữ liệu cá nhân được đánh dấu personal để che nội dung khi analyst hoặc admin xem log.

**M13. Báo cáo và xuất PDF (GĐ2).** Các endpoint /reports/... (mục 8.1) gọi chính các hàm truy vấn và tính toán của màn hình tương ứng rồi dàn trang bằng internal/report (C10), nên số liệu trong PDF khớp màn hình (FR-M13-06, AC-23). Mỗi PDF có tuyên bố "không phải tư vấn đầu tư", thời điểm tạo, ngày dữ liệu, phiên bản mô hình và số trang (FR-M13-05); font Unicode được nhúng để hiển thị tiếng Việt, thanh xác suất vẽ bằng nét vẽ của thư viện, không cần trình duyệt. Báo cáo cá nhân (danh mục, Trade Plan, Journal) lấy user_id từ JWT. Việc sinh PDF chạy đồng bộ, tối đa 2 yêu cầu song song, hết hạn sau 10 giây (NFR-16) và không lưu tệp trên máy chủ.

**M14. Ứng dụng mobile (GĐ3).** C12 gọi cùng /api/v1 như web; điểm khác duy nhất ở API là đăng nhập trả token trong thân phản hồi cho client=mobile. Màn hình cốt lõi, xác thực và phân phối nằm ở mục 8.3.

### 5.3 Thiết kế Chat hỏi đáp (C11)

Chat là thành phần duy nhất gọi mô hình ngôn ngữ theo yêu cầu của người dùng, nên thiết kế xoay quanh một nguyên tắc: mô hình chỉ diễn đạt dữ liệu đã truy xuất, và mọi số liệu trong câu trả lời phải đối chiếu được với dữ liệu đó.

**Nhận câu hỏi:** api kiểm tra JWT, vai trò và hạn mức, rồi gọi POST /ask của chat trong mạng nội bộ Docker với user_id, session_id, câu hỏi và 6 lượt hội thoại gần nhất; chat không nhận danh tính từ trình duyệt.

**Bộ chặn đầu vào:** quy tắc từ khóa và mẫu câu (nên mua, bán, đặt lệnh, giá mục tiêu, mua bao nhiêu...) nhận ra yêu cầu lệnh hoặc tư vấn cá nhân hóa và trả thông điệp cố định kèm gợi ý xem dự báo, giải thích hoặc Trade Plan của chính người dùng, không gọi mô hình ngôn ngữ (FR-M12-03).

**Truy xuất:** nhận diện mã (trong company.in_universe), kỳ hạn, ngày và nhóm ý định (dự báo, lý do, tin tức, lịch sử/hit rate, thuật ngữ, dữ liệu cá nhân); mỗi nhóm ứng với một hàm truy vấn tham số hóa chạy bằng role CSDL chỉ đọc có RLS và user_id của phiên. Kết quả là các bản ghi dữ kiện có mã tham chiếu (ví dụ forecast:18342, news:5521). Không có dữ liệu thì trả lời "Hệ thống không có dữ liệu này" mà không gọi mô hình ngôn ngữ (FR-M12-02).

**Diễn đạt:** LLMClient nhận dữ kiện cùng chỉ dẫn hệ thống (chỉ dùng dữ kiện, mỗi câu có số liệu phải ghi mã tham chiếu, không nêu giá mục tiêu hay khuyến nghị) và trả câu trả lời kèm danh sách tham chiếu. Hạn gọi 6 giây; quá hạn hoặc lỗi thì dùng câu trả lời mẫu dựng thẳng từ dữ kiện, như câu giải thích cho retail ở mục 7.6.

**Kiểm tra đầu ra:** mọi số, ngày và nhãn trong câu trả lời phải có trong dữ kiện đã truy xuất; mỗi câu có số liệu phải có tham chiếu hợp lệ; quét từ cấm (MUA, BÁN, khuyến nghị, giá mục tiêu do mô hình nêu). Vi phạm thì bỏ câu trả lời, dùng bản mẫu hoặc thông điệp từ chối và ghi sự kiện bị chặn vào chat_message.blocked (FR-M12-04). Nhãn hiển thị là "Đi ngang", không phải "Giữ".

**Trích dẫn và tuyên bố:** mã tham chiếu được đổi thành liên kết tới màn hình tương ứng (tab Dự báo của mã, bài tin gốc, Trade Plan của chính người dùng) kèm ngày dữ liệu; khung chat luôn hiện tuyên bố "không phải tư vấn đầu tư" (FR-M12-06).

**Dữ liệu cá nhân:** chỉ nạp khi ý định là dữ liệu cá nhân, và ngữ cảnh gửi mô hình ngôn ngữ không có email hay tên. Khi dùng API ngoài, câu hỏi cá nhân mặc định được trả lời bằng bản mẫu, không qua mô hình ngôn ngữ (cờ cấu hình chat.personal_via_llm = false) cho đến khi chốt chính sách ở mục 12.4 (FR-M12-05).

**Chi phí và log:** trần số lượt gọi theo người dùng và theo ngày; câu trả lời không cá nhân được cache theo (ý định, mã, ngày dữ liệu, phiên bản mô hình). Mỗi lượt ghi vào chat_message (câu hỏi, tham chiếu, kết quả lọc, tên mô hình, độ trễ); analyst và admin xem được log nhưng nội dung lượt hỏi cá nhân bị che, và job dọn dẹp xóa sau 90 ngày (FR-M12-07).

**Bộ kiểm thử chống bịa:** tệp YAML tối thiểu 50 câu hỏi có đáp án đối chiếu với CSDL mẫu và 20 câu bẫy (đòi lệnh, mã ngoài phạm vi, dữ liệu không tồn tại, dữ liệu của người khác); chạy tự động với mô hình thật và mô hình giả, ghi báo cáo trước mỗi lần phát hành (FR-M12-08, AC-21, AC-22).

## 6. Thiết kế dữ liệu

CSDL là PostgreSQL 14+, môi trường triển khai mẫu dùng PostgreSQL 16. Các bảng/view kế thừa db/schema.sql được liệt kê ở mục 6.1 và cần đối chiếu với mã nguồn khi triển khai; hai file yêu cầu và thiết kế không đủ để xác nhận số lượng vật lý hiện có. GĐ1 bổ sung dữ liệu dự báo, xác thực, replay và vận hành; GĐ2 bổ sung vòng quyết định, thông báo và Chat. Mọi timestamp dùng timestamptz và hiển thị Asia/Ho_Chi_Minh; lược đồ dưới đây là thiết kế bổ sung, không phải migration đã chạy kiểm chứng trên repo.

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

password_hash text NOT NULL,     -- bcrypt

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

GĐ1 bổ sung các bảng phục vụ FR-M0-01–07 và FR-M7-07–11. auth_mail_outbox hỗ trợ đặt lại email khi FR-M0-07 được triển khai, độc lập với notifier cảnh báo GĐ2. Schema dưới đây lưu hash token; token thô chỉ tồn tại trong thư chờ gửi được bảo vệ và bị xóa ngay sau khi gửi. Các role không được truy vấn bảng phiên, token hoặc outbox từ API nghiệp vụ.

CREATE TABLE auth_session (

sid uuid PRIMARY KEY,  -- ngẫu nhiên, JWT mang uid và sid

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

Quyền CSDL: role API không phải owner, không có BYPASSRLS; role Chat chỉ đọc dữ liệu được phép. Quyền phiên, hash mật khẩu và token chỉ cấp cho store xác thực, không cho endpoint chung. REVOKE UPDATE/DELETE/TRUNCATE log áp dụng cả các role worker/chat/notifier; chủ CSDL giữ quyền bảo trì và không dùng để phục vụ request. Truy vấn RLS dùng current_setting('app.user_id', true), trường hợp không có user_id trả 0 dòng; SET LOCAL chỉ đặt sau khi middleware xác thực và trong transaction riêng để không rò ngữ cảnh giữa kết nối pool. Việc thu hồi phiên và đổi tài khoản khóa hàng app_user để tránh đua với đăng nhập.

Các thay đổi của GĐ2 nằm trong migration riêng của db/migrations, chạy sau các bảng GĐ1. Mỗi giao dịch của api đặt SET LOCAL app.user_id từ JWT để RLS có hiệu lực; worker và notifier dùng role riêng không dùng cho truy vấn nội dung cá nhân.

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

API là REST JSON tại /api/v1. Web xác thực bằng JWT trong cookie HttpOnly, mobile bằng header Authorization: Bearer (D7); middleware kiểm tra vai trò cho từng route và, với dữ liệu cá nhân, kiểm tra quyền sở hữu (NFR-08). Vai trò không đủ quyền nhận 403. Cột "Vai trò" dùng R = retail, T = trader, A = analyst, Ad = admin; chú thích trong ngoặc là giới hạn riêng của một chức năng. Các route của M8–M13 thuộc GĐ2.

### 8.1 Danh sách endpoint

| Phương thức và đường dẫn | Mô-đun | Vai trò | Mô tả |
| --- | --- | --- | --- |
| POST /auth/login; POST /auth/logout; GET /me | M0 | Tất cả | Phiên JWT uid/sid tối đa 24 giờ; mỗi request đối chiếu phiên và tài khoản; logout thu hồi phiên, web xóa cookie/mobile xóa token. GET /me trả vai trò hiện tại và must_change_password. |
| GET /market/status | M1 | Tất cả | Ngày dữ liệu, giờ hoàn tất batch, phiên bản mô hình đang phục vụ |
| GET /market/summary | M1 | Tất cả | Dải thị trường: VN-Index, HNX-Index, độ rộng, tỷ lệ mã theo nhãn (từ v_market_summary) |
| GET /symbols | M1 | R, T, A | Danh sách mã kèm giá, GTGD 20 phiên, dự báo T+2/T+5 mới nhất, mức tin cậy và cờ đổi nhãn; changed=1 chỉ lấy mã đổi nhãn so với phiên trước (khối "Tín hiệu đổi hôm nay") |
| GET /symbols/{sym}/forecast?horizon=2\|5 | M2, M3 | R, T, A | Dự báo mới nhất kèm label_vi, confidence; phần giải thích (kể cả risk_notes) cắt theo vai trò |
| GET /symbols/{sym}/prices?range=6m | M2 | R, T, A | OHLCV và các ngày có tin mạnh |
| GET /symbols/{sym}/news?sentiment=&from=&to= | M4 | R, T, A | Tin mới nhất trước: tiêu đề, sapo, nguồn, thời gian, URL, nhãn, độ tin cậy |
| GET /symbols/{sym}/sentiment?days=30 | M4 | R, T, A | Chỉ số cảm xúc theo phiên |
| GET /symbols/{sym}/history?horizon=&window=30\|90 | M6 | R, T, A | Lịch sử dự báo, đúng/sai, hit rate kèm n, cờ small_sample và baseline "lớp phổ biến nhất", precision và recall theo lớp |
| GET /symbols/{sym}/history.csv | M6 | A | Xuất CSV |
| GET /forecasts/{id}/audit | M7 | A, Ad | Timestamp, phiên bản mô hình, snapshot, job kích hoạt |
| GET, PUT, PATCH, DELETE /watchlist[/{sym}] | M5 | R, T, A | Tối đa 10 mã; mã thứ 11 trả 409; PATCH sửa ghi chú của mã |
| GET, POST, DELETE /alert-rules[/{id}] | M5 | R, T, A | GĐ1: label_change, prob_threshold; GĐ2: plan_touch. Không nhận concentration/screen_match ngoài PRD. |
| GET /alerts, PATCH /alerts/{id} | M5 | R, T, A | Cảnh báo 90 ngày, đánh dấu đã đọc |
| GET /notify/channels; PUT, DELETE /notify/channels/{kind}; POST /notify/telegram/link, /notify/email/verify, /notify/channels/{kind}/test | M5 | R, T, A | Xem và bật/tắt kênh email, Telegram; lấy mã liên kết Telegram dùng một lần; xác thực email; gửi thử; hủy liên kết |
| GET, PUT /me/profile | M10 | T, A (R: 403) | Hồ sơ đầu tư: vốn và mức rủi ro tối đa, do người dùng tự nhập |
| GET /screener; GET, POST, DELETE /screener/saved[/{id}] | M8 | R, T, A (lưu bộ lọc: T, A) | Lọc trên v_screener bằng tham số trong danh sách trắng; bộ lọc có sẵn cho retail; bộ lọc có tên tối đa 20 mỗi người |
| GET, POST, PATCH, DELETE /portfolio/tx[/{id}]; POST /portfolio/import[?dry_run=1] | M9 | R, T, A (import: T, A) | Nhập, sửa, xóa giao dịch; import CSV hai bước (xem trước rồi xác nhận) |
| GET /portfolio; GET /portfolio/overview; DELETE /portfolio | M9 | R, T, A (overview: T, A) | Vị thế, giá vốn, lãi/lỗ, tỷ trọng kèm tín hiệu hiện tại; tổng quan và giá trị theo thời gian; xóa toàn bộ giao dịch |
| GET, POST /plans; GET, PATCH /plans/{id}; POST /plans/{id}/close; POST /plans/calc | M10 | R, T, A | Mọi vai trò tính R:R và khoảng cách %. Chỉ T/A nhận vốn, % rủi ro và tính khối lượng; đóng tạo Journal cùng transaction. |
| GET, POST /journal; GET, PATCH /journal/{id}; GET /journal/stats | M11 | R, T, A (ghi thủ công, stats: T, A) | Danh sách lọc theo mã, thời gian, thẻ, kết quả; sửa ghi chú, thẻ, bài học; thống kê nhìn lại |
| POST /chat/sessions; GET /chat/sessions/{id}; POST /chat/sessions/{id}/messages | M12 | R, T, A | api chuyển câu hỏi cùng user_id tới dịch vụ chat (mục 5.3); trả lời kèm trích dẫn |
| GET /reports/symbols/{sym}.pdf, /reports/portfolio.pdf, /reports/plans/{id}.pdf, /reports/journal.pdf?from=&to= | M13 | R, T, A (journal: T, A) | PDF từ cùng truy vấn với màn hình; chỉ xuất dữ liệu của chính người dùng |
| GET /models/evaluation | M6 | A, Ad | Metrics, confusion matrix, ablation và hiệu chỉnh (Brier, ECE) của các lần huấn luyện |
| GET /models/summary | M6 | R, T, A, Ad | Bản tóm tắt cho mọi vai trò: phiên bản đang phục vụ, ngày huấn luyện, hit rate tổng 30/90 phiên kèm n và baseline |
| GET, POST /admin/users; PATCH /admin/users/{id} | M7 | Ad | Tạo, khóa, đổi vai trò; tạo tài khoản demo (is_demo) |
| GET /admin/jobs, POST /admin/jobs/{job}/run | M7 | Ad | Trạng thái nguồn dữ liệu; xếp hàng chạy lại một job |
| GET /admin/models; POST /admin/models/{id}/serve | M7 | Ad | Danh sách quản trị; đổi hoặc rollback chỉ bản qua gate và còn checkpoint. Analyst xem qua GET /model-versions. |
| GET /admin/audit?from=&to=&actor=&action=&target=&page=&page_size= | M7 | Ad | Mới nhất trước, phân trang (mặc định 20, tối đa 100); thời điểm, actor, target, before/after, outcome đã lọc bí mật. Không có sửa/xóa. |
| GET /admin/notifications | M5, M7 | Ad | Nhật ký gửi tổng hợp theo kênh và trạng thái, không kèm nội dung |
| GET /admin/chat-log | M12, M7 | A, Ad | Nhật ký Chat: nội dung lượt hỏi cá nhân đã che, kèm kết quả lọc và độ trễ |
| POST /auth/change-password | M0 | Tất cả đã xác thực | current_password, new_password; kiểm tra chính sách, mật khẩu mới khác cũ; thu hồi mọi phiên khác. Với đổi bắt buộc sau reset: phát hành phiên mới. |
| POST /auth/forgot-password; POST /auth/reset-password | M0 | Chưa cần phiên | Should GĐ1; trả thông báo chung; token một lần 30 phút. Reset thu hồi mọi phiên; không ghi token vào log. |
| POST /admin/users/{id}/reset-password; POST /admin/users/{id}/revoke-sessions | M0, M7 | Ad | Đặt mật khẩu tạm, buộc đổi ở lần đăng nhập tiếp theo; thu hồi phiên; audit có outcome, không chứa mật khẩu/token. |
| GET /forecasts/{id}/inputs | M7 | A, Ad | Giá, đặc trưng, BCTC, metadata tin và cut-off từ manifest snapshot đã dùng; không từ view hiện tại. |
| POST /forecasts/{id}/replays; GET /forecasts/{id}/replays/{replay_id} | M7 | A, Ad | Xếp hàng 202 và poll kết quả; so sai số < 1e-4; thiếu đầu vào báo not_reproducible; không ghi đè forecast gốc. |
| GET /model-versions | M7 | A, Ad | Danh sách chỉ đọc gồm mã, ngày huấn luyện, khoảng dữ liệu, metrics; thao tác serve/rollback chỉ qua Admin. |
| GET /admin/ops-events | M7 | Ad | Lỗi pipeline sau retry và drift; trạng thái thông báo vận hành, không chứa dữ liệu Portfolio/Plan/Journal. |

Dữ liệu cá nhân (Portfolio, Trade Plan, Journal, Chat, kênh thông báo, bộ lọc đã lưu) chỉ truy cập được bằng id của chính người dùng: id của người khác trả 404, admin gọi các route này nhận 403 (AC-26). Route ghi dữ liệu cá nhân không nhận user_id từ thân yêu cầu; user_id luôn lấy từ JWT. Mọi nhãn hiển thị cho người dùng lấy từ label_vi.

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
| Đăng nhập | M0 | Email, mật khẩu |
| Tổng quan thị trường (trang chủ) | M1 | Dải thị trường (VN-Index, HNX-Index, độ rộng, tỷ lệ nhãn), khối "Tín hiệu đổi hôm nay", bảng mã với nhãn Tăng / Đi ngang / Giảm kèm biểu tượng ▲ ● ▼ cho T+2 và T+5, bộ lọc sàn/ngành/thanh khoản/xu hướng, tìm kiếm, ngày dữ liệu |
| Chi tiết mã, tab Dự báo | M2, M3, M10, M13 | Forecast card T+2 và T+5 cạnh nhau, thanh xác suất, mức tin cậy, khối "Vì sao?" và "Điều gì có thể làm dự báo sai", biểu đồ nến 6 tháng, trạng thái dữ liệu, tuyên bố tham khảo; nút thêm watchlist, lập Trade Plan, xuất PDF |
| Chi tiết mã, tab Tin tức | M4 | Danh sách tin có nhãn sắc thái, bộ lọc, biểu đồ cảm xúc 30 phiên cạnh giá |
| Chi tiết mã, tab Lịch sử | M6 | Bảng dự báo cũ, đúng/sai, "Đang chờ", hit rate 30/90 phiên kèm n, cảnh báo "mẫu nhỏ", baseline và ghi chú T+5 chồng lấn |
| Chi tiết mã, tab Analyst và Audit | M3, M7 | Analyst: top 15 đặc trưng/trọng số tin; Analyst/Admin: audit, manifest dữ liệu đầu vào với cut-off, nút replay và kết quả sai số hoặc không tái lập được. Nội dung chi tiết tuân thủ FR-M3-02. |
| Watchlist và chuông thông báo | M5 | Mã đang theo dõi kèm ghi chú, dấu đổi tín hiệu, quy tắc cảnh báo (mọi vai trò), lịch sử cảnh báo |
| Screener | M8 | Bộ lọc kỳ hạn, nhãn, xác suất tối thiểu, sàn, ngành, thanh khoản (điều kiện nâng cao cho trader, analyst); bộ lọc có sẵn và bộ lọc đã lưu; bảng kết quả kèm nhãn, xác suất, mức tin cậy, trạng thái và ngày dữ liệu; thêm watchlist, mở chi tiết, lập Trade Plan; tuyên bố "danh sách sàng lọc, không phải xếp hạng nên mua" |
| Portfolio | M9 | Bảng vị thế (khối lượng, giá vốn bình quân, giá đóng cửa, lãi/lỗ tạm tính và đã thực hiện, tỷ trọng, tín hiệu T+2/T+5 kèm dấu đổi nhãn); biểu mẫu nhập giao dịch; import CSV có xem trước; tổng quan và giá trị theo thời gian (trader, analyst); xóa toàn bộ; ghi chú "chỉ để người dùng tự theo dõi"; xuất PDF |
| Trade Plan | M10 | Danh sách kế hoạch theo trạng thái; biểu mẫu mã, vùng vào, cắt lỗ, mục tiêu, lý do (vốn và % rủi ro cho trader, analyst); R:R, khoảng cách %, khối lượng tối đa; snapshot dự báo lúc lập (chỉ đọc), lịch sử chỉnh sửa; xác nhận chuyển trạng thái; đóng kế hoạch với giá thoát và ghi chú; tuyên bố "Trade Plan do bạn tự lập" |
| Journal | M11 | Danh sách bản ghi lọc theo mã, thời gian, thẻ, kết quả; chi tiết gồm dự báo lúc quyết định, kế hoạch gốc, kết quả, nhãn thực tế, làm theo hay ngược tín hiệu; sửa ghi chú, thẻ, bài học; ghi thủ công và thống kê nhìn lại (trader, analyst); xuất PDF |
| Chat hỏi đáp | M12 | Khung hội thoại, câu hỏi gợi ý, trích dẫn bấm được tới màn hình hoặc bài tin, tuyên bố "không phải tư vấn đầu tư" luôn hiển thị, nút bắt đầu phiên mới |
| Cài đặt | M5, M10 | Kênh thông báo (liên kết Telegram, xác thực email, bật/tắt từng kênh, gửi thử, hủy liên kết); hồ sơ đầu tư (vốn, rủi ro tối đa; trader, analyst) |
| Đánh giá mô hình | M6 | Analyst, admin: metrics T+2/T+5, confusion matrix, bảng baseline và ablation, reliability diagram, Brier, ECE. Retail, trader: bản tóm tắt hit rate tổng kèm n và baseline |
| Quản trị | M7 | Người dùng và tài khoản demo, nguồn dữ liệu và job, phiên bản mô hình, audit log, nhật ký gửi thông báo, nhật ký Chat đã che; khóa/mở khóa, đổi vai trò, reset mật khẩu, thu hồi phiên; chặn làm mất Admin cuối; audit lọc và phân trang, before/after/outcome; sự kiện vận hành. |
| Đổi và đặt lại mật khẩu | M0 | Đổi bằng mật khẩu hiện tại; màn hình bắt buộc đổi sau reset Admin; quên mật khẩu và token email 30 phút; trạng thái hết hạn/đã dùng. |

Giao diện web gồm các trang nghiệp vụ, bốn tab chi tiết mã và màn hình xác thực ở bảng trên; màn hình Should chỉ bật theo giai đoạn. Giao diện tiếng Việt, tối ưu 1366–1920 px và một cột từ 375 px (NFR-10). Menu theo vai trò; bắt buộc đổi mật khẩu chặn điều hướng nghiệp vụ. “MUA”/“BÁN” chỉ dùng trong biểu mẫu giao dịch do người dùng tự nhập, không ở nhãn tín hiệu, dự báo, gợi ý hoặc Chat (NFR-13).

### 8.3 Ứng dụng mobile (C12)

Ứng dụng mobile (GĐ3) là một lớp giao diện thứ hai trên cùng API; không có logic nghiệp vụ riêng, nên phần lớn thiết kế nằm ở cách đóng gói, xác thực và phân phối.

**Một codebase:** mobile/ viết bằng React Native và TypeScript, dựng bằng Expo để build iOS và Android từ cùng mã. Dùng chung với web qua packages/core: kiểu dữ liệu API, client gọi API, hàm R:R và khối lượng tối đa (bản xem trước), định dạng số và ngày; thành phần giao diện không dùng chung vì web chạy trên DOM (FR-M14-01).

Xác thực: POST /auth/login với client=mobile trả token trong thân phản hồi; ứng dụng lưu token trong Keychain (iOS) hoặc Keystore (Android) và gửi Authorization: Bearer. Middleware ưu tiên cookie, nếu không có thì đọc Bearer, cùng một bộ kiểm tra vai trò và quyền sở hữu. Token hết hạn sau 24 giờ thì ứng dụng yêu cầu đăng nhập lại (bản đầu chưa có refresh token); đăng xuất gọi POST /auth/logout để thu hồi phiên, sau đó xóa token cục bộ (FR-M0-02, FR-M14-04); nhận 401 cũng xóa token và chuyển về đăng nhập. Request dùng Bearer không cần chống CSRF vì không dựa vào cookie.

**Màn hình:** điều hướng tab ở đáy gồm Tổng quan, Watchlist, Portfolio, Trade Plan và Thêm (Journal, Chat, Thông báo, Cài đặt); chi tiết mã có forecast card và giải thích (FR-M14-02). Screener và xem/chia sẻ PDF qua menu chia sẻ của hệ điều hành là mức Should (FR-M14-03). Tuyên bố trách nhiệm và thời điểm cập nhật dữ liệu dùng cùng thành phần và cùng chuỗi văn bản với web (FR-M14-05).

Thông báo: mobile hiển thị danh sách cảnh báo trong ứng dụng (FR-M14-02) và nhận email/Telegram như web. Thông báo đẩy (FCM, APNs) chưa nằm trong PRD; lược đồ hiện hành chỉ nhận email/Telegram; push được xem là hướng mở rộng ở mục 12.4.

**Phân phối:** bản build kiểm thử qua TestFlight (iOS, cần tài khoản Apple Developer, ước tính 99 USD mỗi năm) và tệp APK cài trực tiếp (Android); build iOS cần máy macOS hoặc dịch vụ build đám mây của Expo (cần xác nhận, mục 12.4). Nếu build iOS chậm, web responsive từ 375 px, có thể thêm PWA, là phương án dự phòng để vẫn có bản chạy được trên điện thoại.

**Hiệu năng và kiểm thử:** màn hình dự báo chỉ gọi hai request nhỏ (forecast cho T+2 và T+5) và cache kết quả theo d để hiển thị dưới 3 giây (p95) trên 4G (NFR-17). Kiểm thử đơn vị cho packages/core chạy chung với web; AC-25 kiểm bằng kịch bản thủ công trên một thiết bị hoặc máy ảo mỗi nền tảng.

## 9. Yêu cầu phi chức năng và cách đáp ứng

Các NFR về tốc độ được đáp ứng chủ yếu nhờ tính dự báo trước (D4); các NFR về giải thích và truy vết nhờ các bảng forecast_explanation, forecast_input và audit_log; các NFR về dữ liệu cá nhân nhờ Row-Level Security (D13), về Chat nhờ bộ kiểm tra đầu ra (D11) và về thông báo nhờ hàng đợi notification (D12).

| NFR | Cách thiết kế đáp ứng |
| --- | --- |
| NFR-01 Hiệu năng trang | Trang web là file tĩnh React đã build do Go phục vụ với header cache; tách mã theo trang, thư viện biểu đồ nạp trễ ở trang chi tiết; dữ liệu qua 2–3 request JSON nhỏ |
| NFR-02 API < 300 ms, batch < 15 phút | API chỉ đọc bảng có index (symbol, d, horizon); v_overview, v_market_summary, v_screener là materialized view làm mới cuối bước forecast; batch chạy CPU trên embedding đã lưu, không chạy lại PhoBERT cho tin cũ. Các bước plans, portfolio, notify của GĐ2 chạy sau bước forecast nên không tính vào 15 phút sinh dự báo; thời gian từng bước ghi ở job_run để đo (mục 10.2) |
| NFR-03 Pipeline tự động, retry | APScheduler chạy 15:30 các ngày trading_calendar.is_trading; mỗi job retry 3 lần cách 5/10/20 phút, mỗi lần một dòng job_run |
| NFR-04 Fallback | Thiếu tin 5 phiên: che nhánh tin, gắn missing_newsstale |
| NFR-05 Giải thích | Batch không commit dự báo thiếu bản ghi giải thích (cùng một transaction); test tự động quét toàn bộ dự báo một ngày |
| NFR-06 Truy vết | snapshot_hash = SHA-256 của tensor đầu vào; tensor lưu trong forecast_input; lệnh ml/replay.py <forecast_id> chạy lại trên CPU ở chế độ xác định và so sai số < 1e-4 API /inputs đọc manifest snapshot; /replays chạy bất đồng bộ qua forecast_replay và lưu kết quả riêng. Snapshot/model thiếu thì ghi not_reproducible. |
| NFR-07 Bảo mật | bcrypt cost 12; JWT HS256 hết hạn 24 giờ, cookie HttpOnly, Secure, SameSite=Lax cho web và Bearer cho mobile; HTTPS qua Caddy; khóa bí mật, token Telegram và thông tin SMTP qua biến môi trường. Dữ liệu cá nhân gắn user_id và bật RLS (D13); không lưu thông tin tài khoản chứng khoán hay ngân hàng; DELETE /portfolio xóa toàn bộ giao dịch theo yêu cầu; bản sao lưu pg_dump có dữ liệu cá nhân nên lưu trên volume riêng, không đưa lên kho mã nguồn JWT thống nhất uid/sid (D14); tra auth_session và app_user ở mỗi request. Thu hồi phiên, khóa tạm, chính sách mật khẩu và token reset theo M0. Với request cookie thay đổi dữ liệu, kiểm Origin và token CSRF; Bearer không dùng cookie không cần CSRF. |
| NFR-08 Phân quyền | Middleware requireRole(...) gắn trên từng route; mọi route dữ liệu cá nhân lấy user_id từ JWT và kiểm tra quyền sở hữu; admin không có route đọc nội dung Portfolio, Trade Plan, Journal. Test gọi mọi route với mọi vai trò và so với bảng quyền ở mục 8.1; test hai người dùng A, B cho AC-26 (A gọi id của B nhận 404, admin nhận 403, Chat không lộ dữ liệu của B) |
| NFR-09 Nhật ký | Go dùng log/slog JSON, Python dùng structlog; ghi ra volume logs/, xoay vòng, giữ tối thiểu 90 ngày; bộ lọc loại trường password, token. Log không chứa nội dung Portfolio, Trade Plan, Journal; nội dung Chat chỉ nằm trong chat_message (giữ tối thiểu 90 ngày, che nội dung lượt hỏi cá nhân khi analyst, admin xem) audit_log có before/after và outcome, append-only bằng trigger; security_event ghi mọi lần sai và khóa tạm. Giữ tối thiểu 90 ngày; không xóa log Chat trước khi đủ 90 ngày. |
| NFR-10 Giao diện | CSS responsive trên React, một cột từ 375 px; màu tăng/giảm luôn kèm biểu tượng ▲ ● ▼; mobile dùng cùng quy ước (mục 8.3) |
| NFR-11 Khả dụng | Docker Compose 6 container với restart: unless-stopped và healthcheck (db, api, chat, notifier); Uptime Kuma hoặc dịch vụ uptime miễn phí theo dõi /healthz; lỗi của chat hoặc notifier không làm api ngừng phục vụ dự báo |
| NFR-12 Tái lập | Seed cố định, requirements.lock, cấu hình YAML lưu trong model_version.config |
| NFR-13 Tuân thủ | Forecast card, khung Chat, trang Trade Plan và đầu trang PDF luôn kèm tuyên bố; kiểm tra tự động từ cấm trong web/, mobile/ và các mẫu câu, loại trừ lựa chọn loại giao dịch trong biểu mẫu do người dùng tự nhập; đầu ra Chat qua bộ quét từ cấm (mục 5.3) |
| NFR-14 Chat | Mỗi câu có số liệu qua bộ kiểm tra số và trích dẫn (mục 5.3); bộ chống bịa chạy tự động trước mỗi lần phát hành (AC-22); truy xuất bằng truy vấn cố định với role chỉ đọc và RLS nên không lộ dữ liệu người khác. p95 dưới 10 giây nhờ hạn gọi 6 giây cho mô hình ngôn ngữ và câu trả lời mẫu dự phòng, đo bằng chat_message.latency_ms (ngưỡng cần xác nhận). Trần số lượt hỏi mỗi người mỗi ngày (mặc định 30, đề xuất) và cache câu trả lời không cá nhân để kiểm soát chi phí API |
| NFR-15 Thông báo ngoài app | Khóa duy nhất (channel_id, alert_id) trên notification chống gửi trùng khi batch chạy lại; notifier quét mỗi 30 giây nên tin tới trong vài phút sau bước notify; lần đầu gửi ngay, tối đa 3 retry sau 30, 60, 120 giây rồi đánh dấu failed. Hạn mức: Telegram gửi tuần tự cách nhau 50 ms (dưới giới hạn khoảng 30 tin/giây của một bot); SMTP tối đa 100 tin mỗi giờ và 20 tin mỗi người mỗi ngày (đề xuất, chỉnh theo nhà cung cấp email). Vượt hạn mức thì dòng giữ trạng thái pending sang lần quét sau, ghi vào notification.error và hiện ở trang Quản trị. Test AC-24: chạy batch hai lần và đếm tin ở bộ nhận giả |
| NFR-16 Báo cáo PDF | Sinh đồng bộ trong api, tối đa 2 yêu cầu song song, hết hạn sau 10 giây (mục tiêu p95 dưới 10 giây với 10 mã); dùng chung hàm truy vấn với màn hình nên số liệu khớp (AC-23); không lưu tệp PDF trên máy chủ |
| NFR-17 Mobile | Dùng chung API và RBAC với web; token trong Keychain/Keystore; màn hình dự báo gọi hai request nhỏ và cache theo ngày dữ liệu để dưới 3 giây (p95) trên 4G; kiểm thử trên hai phiên bản hệ điều hành chính gần nhất bằng thiết bị thật hoặc máy ảo (AC-25) |

## 10. Triển khai, vận hành và kiểm thử

Toàn bộ hệ thống chạy bằng Docker Compose gồm 6 container trên một máy từ 8 GB RAM; huấn luyện là việc ngoài hệ thống trên GPU miễn phí, và ứng dụng mobile là gói cài đặt riêng, không phải container.

### 10.1 Triển khai

| Container | Ảnh | Vai trò | Tài nguyên ước tính |
| --- | --- | --- | --- |
| db | postgres:16 | CSDL, volume pgdata, RLS cho dữ liệu cá nhân, sao lưu pg_dump hằng ngày | 1 GB RAM |
| api | Dockerfile sẵn có của DATN_2026 | Go API, file tĩnh web/dist, sinh PDF (C10) | 256 MB RAM |
| worker | python:3.11-slim + PyTorch CPU | C8 lập lịch, chạy C1–C5; mount models/, logs/ | 2–4 GB RAM |
| chat | Dockerfile Go (cmd/chat) | C11; kết nối db bằng role chỉ đọc có RLS; gọi mô hình ngôn ngữ qua API ngoài (mặc định) | 256 MB RAM |
| notifier | python:3.11-slim | C9; gửi SMTP và Telegram, Telegram nhận mã liên kết bằng long polling | 128 MB RAM |
| proxy | caddy:2 | HTTPS tự động, chuyển /api và trang tĩnh tới api | 64 MB RAM |

Tổng ước tính 3,7–5,7 GB RAM cho 6 container, nên môi trường demo cần máy từ 8 GB (VPS hoặc máy cá nhân); VPS 4 GB của bản 0.0.1 không còn đủ. Mô hình ngôn ngữ chạy cục bộ cỡ vài tỷ tham số cần thêm khoảng 4–8 GB RAM hoặc GPU (ước tính) và trả lời chậm trên CPU, khó giữ NFR-14; vì vậy Chat mặc định gọi API ngoài có trần số lượt, còn chạy cục bộ chỉ khi có máy đủ cấu hình (mục 12.4). fly.toml có sẵn chỉ triển khai được container api, nên không dùng cho toàn bộ hệ thống.

### 10.2 Batch ngày

15:30: prices nạp OHLCV và chỉ số của phiên T; kiểm tra đủ mã so với lịch phiên.

news nạp tin mới theo từng mã (chỉ tải URL chưa có).

financials kiểm tra BCTC mới công bố (hằng ngày trong mùa BCTC, hằng tuần ngoài mùa).

sentiment chấm cảm xúc và tính embedding cho tin mới bằng mô hình cảm xúc của phiên bản đang phục vụ.

features làm mới feature_daily, sentiment_daily, label_daily.

resolve điền nhãn thực tế cho dự báo đã đáo hạn và cho các journal_entry tương ứng.

forecast sinh dự báo T+2/T+5 cho toàn bộ mã, kèm mức tin cậy, giải thích, risk_notes và snapshot, trong một transaction; làm mới v_overview, v_market_summary, v_screener.

alerts đánh giá quy tắc đổi nhãn và ngưỡng xác suất (GĐ1); mỗi cảnh báo có event_key nên chạy lại không tạo cảnh báo trùng.

plans đánh giá Trade Plan chưa đóng với giá đóng cửa và nhãn dự báo mới (chạm vùng vào, cắt lỗ, mục tiêu, nhãn ngược snapshot): ghi gợi ý vào trade_plan.suggested và tạo cảnh báo plan_touch; người dùng vẫn là người xác nhận đổi trạng thái.

portfolio tính lại vị thế từ portfolio_tx với giá đóng cửa mới; tỷ trọng dùng để hiển thị, không tạo cảnh báo concentration ngoài PRD.

notify tạo dòng notification cho mỗi cảnh báo mới trên mỗi kênh đang bật; notifier gửi độc lập với batch.

drift tính Macro F1 30 phiên; tạo cảnh báo admin nếu giảm hơn 10 điểm so với lúc đăng ký mô hình (RK-04).

Mỗi job ghi lần chạy và tối đa 3 retry theo NFR-03. Giá ngày T lỗi hoặc thiếu sau retry thì dừng các bước phụ thuộc, không ghi forecast mới, trả forecast gần nhất kèm stale và lỗi cho Admin (AC-06/28). Tin hoặc sentiment lỗi vẫn sinh từ nhánh định lượng, gắn missing_news và bỏ giải thích tin; BCTC thiếu gắn missing_fin. Các bước plans/portfolio/notify ở GĐ2 độc lập sau forecast. Scheduler dùng khóa theo ngày/job, ghim phiên bản mô hình đầu batch; chạy lại dùng khóa duy nhất forecast và event_key nên không trùng dự báo/cảnh báo. Hoàn tất forecast trước 20:00; thời gian sinh forecast < 15 phút đo riêng, còn in-app/email/Telegram đo trong 5 phút từ commit forecast. ops_event thông báo Admin khi pipeline hết retry (Should FR-M7-08), retry gửi không chặn pipeline. Nhãn stale tính theo phiên gần nhất dự kiến, không chỉ theo ngày dương lịch.

GĐ1 chạy các bước prices–alerts và drift; GĐ2 bật thêm plans, portfolio và notify. Phần enqueue cảnh báo thực hiện ngay sau forecast; lỗi enqueue phải được job phục hồi quét theo event_key để không mất sự kiện khi chạy lại. Worker cũng xử lý auth_mail_outbox GĐ1 và forecast_replay bằng khóa hàng SKIP LOCKED; mail đặt lại hết hạn không gửi, lỗi mail không ảnh hưởng forecast. Chạy lại cùng batch ngày sử dụng model_version đã ghim của batch gốc dù Admin vừa đổi serving; mô hình mới chỉ dùng cho batch của phiên kế tiếp. Không tự tạo bộ dự báo thứ hai cho cùng batch khi chạy lại (AC-28).

### 10.3 Cấu trúc mã nguồn

DATN_2026/

cmd/

server/                # Go: khởi động API + file tĩnh web/dist (có sẵn)

chat/                  # mới (GĐ2): dịch vụ Chat C11

internal/

api/                   # mới: router /api/v1, handler M1–M13

auth/                  # mới: bcrypt, JWT (cookie và Bearer), middleware RBAC

store/                 # mới: truy vấn PostgreSQL (pgx); dữ liệu cá nhân bắt buộc nhận userID

report/                # mới (GĐ2): sinh PDF C10

chat/                  # mới (GĐ2): guard, retrieve, validate, cache

ai/                    # có sẵn (gọi LM Studio): mở rộng thành LLMClient (API, cục bộ)

news/ market/ httpx/   # có sẵn

web/                     # React + TypeScript (Vite); chuyển trang tin và bảng giá có sẵn sang

mobile/                  # mới (GĐ3): React Native (Expo)

packages/core/           # mới: kiểu API, client, hàm R:R và khối lượng, dùng chung web và mobile

db/

schema.sql             # có sẵn

migrations/            # mới: các thay đổi ở mục 6.2, đánh số tuần tự, GĐ2 tách riêng

seed_demo.sql          # mới (GĐ2): dữ liệu mẫu cho tài khoản demo

etl/                     # prices.py, news.py (có sẵn), financials.py (mới)

ml/

sentiment/             # tinh chỉnh và suy luận PhoBERT

features/              # đặc trưng, nhãn, dataset

models/                # baseline, encoder, fusion

train.py evaluate.py gate.py replay.py

serve/ post/           # C4, C5

worker/scheduler.py      # C8

notifier/                # mới (GĐ2): C9 (email, Telegram, hàng đợi)

eval/chat/               # mới (GĐ2): bộ kiểm thử chống bịa (YAML) và báo cáo

docker-compose.yml

### 10.4 Kiểm thử

| Mức | Nội dung | Liên kết |
| --- | --- | --- |
| Unit | Bộ tách bài CafeF (etl/test_news.py có sẵn), tính chỉ báo, gán nhãn, sinh câu giải thích, giới hạn watchlist, mức tin cậy, giá vốn bình quân; hàm R:R và khối lượng chạy chung một bộ ca (ví dụ AC-19) ở Go và packages/core | FR-M4-01, FR-M3-03, FR-M5-01, FR-M2-08, FR-M9-03, FR-M10-03, 04 |
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
| Admin và audit | Tạo/khóa/mở khóa/đổi vai trò/reset/thu hồi phiên/run job/serve/rollback có before/after và outcome; chặn mất Admin cuối; lọc/phân trang; role khác 403; UPDATE/DELETE/TRUNCATE log bị từ chối. | FR-M7-01, 05, 11; UC-12/25; AC-15/29 |
| Batch idempotent | Theo lịch 15:30, không chạy ngày nghỉ; ghim model; chạy lại hai lần không trùng forecast/cảnh báo; không chạy đồng thời cùng job/ngày; lỗi giá giữ stale; ghi số bản ghi và mã job; ops_event lỗi sau retry. | FR-M7-07/08, US-24/UC-24, AC-28 |
| Audit và replay API | A/Ad đọc đúng manifest và cut-off; R/T 403; 10 dự báo sai số < 1e-4; thiếu tensor/embedding/model báo không tái lập được; dữ liệu forecast gốc và cảnh báo không đổi. | FR-M7-09/10, AC-14 |

## 11. Ma trận truy vết yêu cầu

Ma trận dưới đây truy vết yêu cầu chức năng của PRD v0.0.3 từ FR-M0 đến FR-M14 tới US và UC tương ứng, thành phần, dữ liệu, API và AC-01–AC-30. UC có cùng số với US trong PRD mục 9.2. Dấu “–” nghĩa là PRD chưa đặt AC riêng; phần kiểm thử vẫn phải kiểm tra yêu cầu đó.

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
| Ba ngôn ngữ (Go, Python, TypeScript) cho một người làm | Tốn thời gian chuyển ngữ cảnh | Go chỉ đọc/ghi CSDL và kiểm quyền; mọi logic dữ liệu và mô hình nằm ở Python hoặc SQL; TypeScript dùng chung giữa web và mobile qua packages/core |
| SSI hoặc CafeF đổi API/HTML | ETL lỗi | Kiểm schema mỗi lần ETL, lưu raw, báo lỗi lên trang Quản trị (RK-09) |
| Ngày đáo hạn sai khi có nghỉ lễ bất thường | FR-M2-03 hiển thị sai | trading_calendar nhập tay lịch nghỉ công bố đầu năm; C5 tính lại due_on khi lịch đổi |
| Chat bịa số liệu, nêu khuyến nghị hoặc giá mục tiêu | Vi phạm NFR-13, KPI P8, rủi ro pháp lý | Mô hình chỉ diễn đạt dữ kiện đã truy xuất; kiểm tra số và trích dẫn, quét từ cấm; câu trả lời mẫu thay thế khi vi phạm; bộ chống bịa chặn phát hành |
| Dữ liệu cá nhân bị gửi sang API mô hình ngôn ngữ bên ngoài | Lộ thông tin danh mục | Cờ chat.personal_via_llm = false theo mặc định: câu hỏi cá nhân trả lời bằng bản mẫu; ngữ cảnh gửi đi không có email, tên; chốt chính sách ở mục 12.4 |
| Hạn mức hoặc chi phí API mô hình ngôn ngữ, email, Telegram bị vượt | Chat hoặc thông báo ngừng giữa buổi demo | Trần lượt hỏi theo người dùng và theo ngày, cache; chat tự hạ về câu trả lời mẫu; hàng đợi notification giữ dòng pending, retry, và cảnh báo vẫn có trong app |
| Chia tách, cổ tức bằng cổ phiếu làm giá vốn và khối lượng lệch | Lãi/lỗ tạm tính sai | Không tự điều chỉnh; người dùng nhập giao dịch điều chỉnh; ghi chú trên trang Portfolio; bình quân gia quyền đã chốt theo FR-M9-03; cách điều chỉnh còn cần xác nhận |
| Hàm R:R và khối lượng tối đa viết ở hai nơi (Go và TypeScript) | Số trên biểu mẫu khác số lưu | Go là nguồn chính (số thập phân); TypeScript chỉ để xem trước; hai bản chạy chung một bộ ca kiểm thử |
| Build iOS cần Apple Developer và macOS | Trễ GĐ3 | Dùng dịch vụ build đám mây, làm Android trước, web responsive hoặc PWA làm phương án dự phòng (RK-14) |
| Thêm bước plans, portfolio, notify làm batch vượt 20:00 hoặc thông báo trễ quá 5 phút | Vi phạm P5, NFR-15 | Mỗi bước ghi thời gian vào job_run; bước chạy theo truy vấn tập hợp, không lặp từng người; đo sớm trên dữ liệu mẫu |

### 12.2 Điểm lệch giữa Project Brief và PRD

Project Brief 0.0.2 đã thống nhất với PRD về ứng dụng mobile, 4 vai trò, số mã tối thiểu (15), độ dài lịch sử và người dùng mở rộng, nên các dòng đó đã bỏ khỏi bảng. Các điểm còn lệch:

| Chủ đề | Project Brief | PRD | Thiết kế này đang theo |
| --- | --- | --- | --- |
| Tên nhãn dự báo | tăng / giữ / giảm | Tăng / Đi ngang / Giảm | PRD; mã nội bộ vẫn là hold; cần sửa Brief |
| Thông báo trên mobile | "Nhận thông báo" là chức năng cốt lõi, không nêu kênh | Danh sách thông báo trong app (FR-M14-02), email và Telegram (FR-M5-06); không có thông báo đẩy | PRD; thông báo đẩy chừa sẵn, chờ quyết định (mục 12.4) |
| Bộ lọc đã lưu của Screener | Lưu và dùng lại được bộ lọc, không nêu vai trò | Chỉ trader, analyst lưu; retail dùng bộ lọc có sẵn (FR-M8-03, 04) | PRD |
| Liên kết của Journal | Liên kết với Trade Plan hoặc Portfolio và với dự báo lúc quyết định | Tạo từ Trade Plan đã đóng hoặc ghi thủ công theo mã (FR-M11-01, 04); không liên kết giao dịch Portfolio | PRD; journal_entry chỉ có plan_id |
| Xuất PDF Journal | Có PDF cho Trade Plan và Journal | PDF Journal là Should, chỉ trader, analyst (FR-M13-04) | PRD |

### 12.3 Quy tắc đối chiếu với PRD

Nguồn đối chiếu là PRD v0.0.3 đính kèm. Khi bảng ưu tiên tổng quát, user story hoặc ví dụ persona khác bảng FR mục 10, SDD áp dụng vai trò và mức ưu tiên của từng FR; các mâu thuẫn của nguồn được ghi dưới đây để xác nhận, không tự sửa PRD.

FR-M5-02–FR-M5-05 trong mục 10 là Must, áp dụng R/T/A; bảng 6.1 và US-05 vẫn ghi Should. SDD thiết kế đầy đủ cảnh báo trong app ở GĐ1, kiểm thử AC-10/AC-11; email và Telegram vẫn ở GĐ2. Giới hạn 10 chỉ là số mã trong watchlist mỗi người, không thay mục tiêu dữ liệu tối thiểu 15 mã của R5 và mục 12.1.

FR-M7-09 và FR-M7-10 được ghi Should nhưng US-10 và AC-14 yêu cầu xem đầu vào và tái lập. SDD giữ hai chức năng trong thiết kế GĐ1 và kiểm thử AC-14. FR-M0-07 là Should nhưng AC-30 bao gồm đặt lại qua Admin và email; bản kiểm thử đầy đủ AC-30 phải bật chức năng này. Không diễn giải Should thành việc được bỏ qua AC đã chọn.

FR-M0-06 ghi “mật khẩu là duy nhất cho 1 tài khoản” nhưng chưa định nghĩa duy nhất giữa tài khoản hay không tái dùng. Thiết kế hiện tại yêu cầu mật khẩu mới khác mật khẩu hiện tại theo AC-30, không so mật khẩu giữa các tài khoản; ý nghĩa còn lại cần chủ tài liệu xác nhận. Mức tin cậy 55% và alignment Journal vẫn là đề xuất thiết kế cần xác nhận. FR-M9-03 đã chốt giá vốn bình quân gia quyền; FIFO không còn là câu hỏi thay thế trong SDD.

### 12.4 Câu hỏi mở

Chốt danh sách 15 mã và mốc bắt đầu lịch sử sau khi chạy thử etl/news.py --from 2021-01-01.

Chốt các ngưỡng đang "cần xác nhận" trong PRD: +3 điểm Macro F1, Macro F1 ≥ 0,40, AUC ≥ 0,60, k = 0,5, SUS ≥ 68; ngưỡng 45% đã có FR-M2-08; mức cao 55% còn là đề xuất, số mẫu nhỏ 50, bộ chống bịa 50 + 20 câu, p95 Chat 10 giây, KPI P7–P9.

internal/ai đang gọi LM Studio (có thay đổi chưa commit, chưa kiểm tra mã) và Chat cần một mô hình ngôn ngữ. Chọn một: giữ làm bộ nối cục bộ của LLMClient (cần máy lớn hơn, mục 10.1); thay bằng API ngoài làm mặc định và chỉ giữ LM Studio để thử; hoặc bỏ. Thiết kế mặc định chọn phương án thứ hai và tắt tính năng tóm tắt bài trong bản demo.

Nơi chạy demo: VPS hoặc máy cá nhân từ 8 GB; có cần tên miền và HTTPS công khai không (mobile ngoài mạng nội bộ và cookie Secure cần HTTPS).

Nguồn BCTC: vnstock hay nguồn khác.

Chọn nhà cung cấp API mô hình ngôn ngữ, ngân sách trần và chính sách có gửi câu hỏi về dữ liệu cá nhân qua API ngoài hay không (mặc định không; PRD C2, A6, mục 16.1).

Chốt cách ghi giao dịch điều chỉnh khi chia tách, cổ tức bằng cổ phiếu và phí/thuế mặc định. Giá vốn dùng bình quân gia quyền theo FR-M9-03; không tự chuyển sang FIFO.

Thông báo đẩy FCM/APNs chỉ là hướng mở rộng ngoài PRD; GĐ3 hiện dùng danh sách trong app cùng email/Telegram, không triển khai kênh push trong lược đồ hiện hành.

Build iOS: tài khoản Apple Developer, máy macOS hay dịch vụ build đám mây; phát hành qua TestFlight hay cài trực tiếp (RK-14).

Cảnh báo concentration, screen_match và push không thuộc phạm vi triển khai theo PRD v0.0.3. Chỉ xem xét sau khi có yêu cầu và tiêu chí nghiệm thu mới được chấp thuận.

Đối chiếu số bảng/view có sẵn của db/schema.sql với mục 6.1 (bản 0.0.1 ghi 15, mục 6.1 liệt kê 14).


> Ghi chú: Tài liệu Word gốc có 3 ảnh/đối tượng hình ảnh nhúng; nội dung văn bản và bảng đã được chuyển đổi, hình ảnh không được nhúng trực tiếp vào Markdown.
