# StockSense VN

Workspace JavaScript cho web app StockSense VN, API Node.js và worker dữ liệu thị trường.

## Chạy web app

```sh
npm install
npm run dev:web
```

Màn hình đầu tiên dùng mock API cục bộ. Mật khẩu demo theo quy tắc `{vai trò}12345678` (ví dụ: `admin12345678`, `retail12345678`, `trader12345678`, `analyst12345678`). Chọn một trong bốn vai trò demo ở màn hình đăng nhập. Đăng nhập mock này chỉ phục vụ phát triển UI, không bảo mật dữ liệu thật.

## Chạy API (bootstrap)

```sh
npm run dev:api
```

Để dùng API từ browser, copy `apps/web/.env.real.example` sang `apps/web/.env.local` và chạy `npm run dev:web` ở terminal khác. Vite sẽ proxy request API sang port 3000. Tài khoản phát triển và các hạn chế quan trọng có trong [apps/api/README.md](apps/api/README.md).

## Chạy với PostgreSQL

```sh
Copy-Item .env.example .env
docker compose up -d db
npm run db:migrate
npm run db:seed:demo
npm run dev:api
```

Ở terminal khác, copy `apps/web/.env.real.example` sang `apps/web/.env.local` và chạy `npm run dev:web`. Ở chế độ database, endpoint thị trường và tài khoản demo được đọc từ PostgreSQL; seed demo cố tình chèn dữ liệu mẫu. Nếu không có `DATABASE_URL`, API tiếp tục dùng fixture trong bộ nhớ.

Để import giá OHLCV theo ngày gần nhất cho các mã demo đã bật, chạy `npm run worker:market:sync` sau khi migrate và seed demo. Worker này chạy một lần (one-shot); hãy lên lịch chạy sau giờ đóng cửa thị trường nếu muốn import định kỳ. Xem [apps/worker/README.md](apps/worker/README.md) để biết tuỳ chọn khoảng ngày và hạn chế của nguồn SSI.

Import tin tức gần đây bằng `npm run worker:news:sync` sau migration `004_news_symbols.sql`. Tin tức được gán vào mã cổ phiếu đã bật dựa trên tiêu đề và tóm tắt; sentiment giữ ở mức trung tính cho tới khi có bước suy luận sentiment.

Watchlist cá nhân và UI cảnh báo giá có tại `/watchlist` và `/alerts` sau khi áp migration `005_watchlist_alerts.sql`. Cảnh báo giá chỉ được tạo cho các mốc giá đóng cửa SSI; cảnh báo dựa trên dự báo (forecast) chưa có cho tới khi mô hình AI sẵn sàng.

Screener tại `/screener` lọc các mã đã bật theo sàn, giá, % thay đổi theo ngày và thanh khoản trung bình 20 phiên. Query PostgreSQL dùng trực tiếp giá hàng ngày, không cần forecast. Tài khoản Trader và Analyst có thể lưu tối đa 20 bộ lọc cá nhân sau migration `006_saved_screener_filters.sql`; ở chế độ fixture, bộ lọc đã lưu chỉ giữ trong bộ nhớ cho phiên phát triển hiện tại.

Portfolio có tại `/portfolio` sau migration `007_portfolio_ledger.sql`. Portfolio ghi lại giao dịch mua/bán của người dùng, tính vị thế theo giá vốn trung bình, và hỗ trợ import CSV nguyên tử (atomic) cho vai trò có quyền `portfolio.import.self`. Lãi/lỗ chưa thực hiện (Unrealized P/L) dùng giá đóng cửa hàng ngày mới nhất đã lưu; nếu không có giá sẽ hiển thị là không khả dụng.

Trade Plan có tại `/plans` sau migration `008_trade_plans_journal.sql`. Plan dùng giá người dùng tự nhập, snapshot thị trường bất biến, và công thức tính R:R chung. Snapshot forecast chưa khả dụng cho tới khi có mô hình AI. Đóng một plan đang active sẽ ghi entry Journal trong cùng transaction database.

Journal có tại `/journal` sau migration `009_journal_fields.sql`. Entry chỉ riêng tư cho chủ sở hữu; các trường có thể sửa chỉ gồm ghi chú, tag và bài học, còn snapshot và kết quả đã thực hiện (realized) thì bất biến. Entry thủ công và thống kê hiệu suất chỉ dành cho quyền Trader và Analyst.

Investment Profile có tại `/settings/investment` sau migration `010_investment_profiles.sql`. Trader và Analyst có thể lưu vốn riêng và hạn mức rủi ro theo từng plan; Retail và Admin không có quyền này. Trade Plan chỉ dùng giá trị đã lưu khi người dùng chủ động chọn profile. Hợp đồng endpoint được ghi trong `openapi.yaml` ở mục `/me/profile`.

Chat có tại `/chat` sau migration `011_chat_sessions.sql`. Session thuộc riêng từng chủ sở hữu, có thể list, tạo và xoá bởi user Retail, Trader hoặc Analyst. Gửi prompt sẽ trả về `503 CHAT_MODEL_NOT_READY` và không lưu nội dung prompt cho tới khi pipeline suy luận ONNX và an toàn được cấu hình; UI hiển thị rõ trạng thái này.

Kênh thông báo có tại `/settings/notifications` sau migration `012_notification_preferences.sql` và `013_notification_channels.sql`. Xác minh email và gửi thử cần cấu hình SMTP trong `.env`; liên kết Telegram cần bot token, username, webhook secret và webhook API có thể truy cập công khai. Mã xác minh được lưu dưới dạng hash SHA-256, hết hạn sau 10 phút, và bị giới hạn tần suất (rate limit). Bật một kênh yêu cầu xác minh; bỏ liên kết sẽ tắt preference của kênh đó. Migration `014_notification_outbox.sql` thêm hàng đợi gửi cảnh báo; lên lịch chạy `npm run worker:notifications:deliver` sau khi sync thị trường để gửi cảnh báo.

Khôi phục mật khẩu tự phục vụ dùng các migration tới `015_password_reset.sql`. Để bật tính năng này, cấu hình SMTP, đặt `PUBLIC_APP_URL` là origin của web, tạo secret ít nhất 32 ký tự ngẫu nhiên cho `AUTH_RATE_LIMIT_SECRET`, sau đó đặt `PASSWORD_RESET_ENABLED=true` và `VITE_PASSWORD_RESET_ENABLED=true`. Browser sẽ ẩn link khôi phục khi flag đang tắt; API tự kiểm tra flag và cấu hình SMTP độc lập. Link reset hết hạn sau 30 phút và sẽ hủy các session đang hoạt động khi được dùng.

Chức năng quản trị worker yêu cầu migration `016_admin_job_queue.sql` và `017_admin_worker_heartbeat.sql`. API chỉ đưa vào hàng đợi các tác vụ sync dữ liệu và thông báo đã được allowlist; API không bao giờ chạy trực tiếp các tác vụ này trong request HTTP. Để chạy một lần, dùng `npm run worker:admin-jobs:run`; để chạy worker dài hạn, poll mỗi 10 giây khi idle, dùng `npm run worker:admin-jobs:watch`. Trang Admin báo cáo worker đang online dựa trên heartbeat mỗi 15 giây và đánh dấu offline sau 45 giây không heartbeat. Các job Forecast/ONNX vẫn chưa khả dụng cho tới khi có mô hình và pipeline suy luận.

Migration `020_non_ai_completion.sql` hoàn thiện các yêu cầu PRD không phụ thuộc mô hình AI:
- **Thị trường:** cột ngành (`symbols.industry`), lọc ngành/thanh khoản và sắp xếp ở Tổng quan và Screener, bộ lọc có sẵn.
- **Trade Plan:** trạng thái Nháp → Chờ vào → Đang mở → Đã đóng, vùng giá vào, ngày hết hạn, lý do đóng, sửa kế hoạch có lưu lịch sử. Khối lượng tối đa được làm tròn theo lô 100.
- **Cảnh báo:** cảnh báo khi giá chạm vùng vào/cắt lỗ/mục tiêu của Trade Plan, chuông thông báo, lịch sử cảnh báo giữ 90 ngày.
- **Portfolio:** sửa giao dịch, import CSV bỏ qua dòng lỗi/trùng kèm báo cáo, tỷ trọng và phân bổ theo ngành, giá trị danh mục theo thời gian, xóa toàn bộ.
- **Journal:** lọc theo mã/ngày/thẻ/kết quả/từ khóa, thống kê theo tuần/tháng/quý, PDF theo kỳ.
- **Admin:** lọc audit theo thời gian/người thực hiện/đối tượng.

Chính sách mật khẩu tự đặt là 8-64 ký tự, gồm chữ, số và ít nhất 1 ký tự đặc biệt. Chính sách này dùng chung qua `@stocksense/core/password`.

Khi chạy `npm run worker:admin-jobs:watch`, worker tự xếp hàng pipeline hằng ngày (đồng bộ giá SSI → tin tức → gửi thông báo) sau 15:30 giờ Việt Nam các ngày T2-T6.
- Đổi giờ chạy bằng `ADMIN_JOBS_SCHEDULE_TIME=HH:MM`; tắt lịch bằng `ADMIN_JOBS_SCHEDULE=off`.
- Job lỗi được thử lại tối đa 3 lần. Nếu vẫn lỗi, mọi Admin nhận cảnh báo trong app, kèm email/Telegram nếu đã liên kết.
- Gửi thông báo cho người dùng: gửi lần đầu, rồi thử lại tối đa 3 lần.

Hợp đồng API dạng máy đọc được ở [openapi.yaml](openapi.yaml); lý do thiết kế kiến trúc và quy tắc vai trò ở [docs/web.md](docs/web.md). Khi đã cấu hình PostgreSQL, danh tính demo dùng hash mật khẩu và session lưu trong DB (có thể revoke). Ở chế độ fixture, danh tính/session chỉ lưu trong bộ nhớ. Forecast, tổng hợp chỉ số và tin tức vẫn là dữ liệu mẫu; giá hàng ngày theo từng mã có thể được import bởi worker SSI. Hệ thống này chưa sẵn sàng cho production.
