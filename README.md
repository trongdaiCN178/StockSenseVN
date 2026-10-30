# StockSense VN (IDSS)

Hệ thống hỗ trợ quyết định đầu tư cổ phiếu (Investment Decision Support System) cho thị trường Việt Nam: xem tín hiệu dự báo T+2/T+5, theo dõi watchlist và cảnh báo, sàng lọc cổ phiếu, tự lập Trade Plan, ghi Portfolio và Journal, xuất báo cáo PDF, nhận thông báo qua email/Telegram.

> Dự báo, tín hiệu, Trade Plan và nội dung Chat chỉ mang tính tham khảo, **không phải tư vấn đầu tư**. Hệ thống không đặt lệnh giao dịch.

Hiện trạng: các chức năng không phụ thuộc mô hình AI đã chạy với dữ liệu thật (giá SSI, tin CafeF/VnExpress). Dự báo, chỉ số thị trường và tỷ lệ nhãn vẫn là **dữ liệu mẫu** cho đến khi có mô hình; Chat trả `503 CHAT_MODEL_NOT_READY`. Chưa sẵn sàng cho production.

## Công nghệ

| Phần | Công nghệ |
| --- | --- |
| Web | React 19, Vite 8 (`apps/web`) |
| API | Node.js 22, Fastify 5, pg, pdfkit, nodemailer (`apps/api`) |
| Worker | Node.js: đồng bộ giá SSI, tin tức, cảnh báo, gửi thông báo, pipeline hằng ngày (`apps/worker`) |
| Thư viện dùng chung | Vai trò và quyền, chính sách mật khẩu, tính R:R và khối lượng (`packages/core`) |
| CSDL | PostgreSQL 17 qua Docker Compose; migration ở `db/migrations` (001–020) |

```text
apps/api        REST API /api/v1
apps/web        giao diện web
apps/worker     tác vụ nền
packages/core   code dùng chung web và API
db/             migrate.js, seed-demo.js, bootstrap-admin.js, migrations/
openapi.yaml    hợp đồng API
Tài liệu chạy dự án/   Project Brief, PRD, SDD, báo cáo tiến độ
```

## Yêu cầu

- Node.js ≥ 22.12
- Docker Desktop (để chạy PostgreSQL)

## Cài đặt lần đầu

```sh
npm install
cp .env.example .env                                   # PowerShell: Copy-Item .env.example .env
cp apps/web/.env.real.example apps/web/.env.local      # web gọi API thật
docker compose up -d db
npm run db:migrate
npm run db:seed:demo
```

`db:seed:demo` nạp 17 mã (10 HOSE, 4 HNX, 3 UPCoM), dự báo mẫu và 4 tài khoản demo. Chạy lại lệnh này sẽ đặt lại mật khẩu và mở khóa các tài khoản demo.

Trong `.env`, đặt `AUTH_RATE_LIMIT_SECRET` là một chuỗi ngẫu nhiên ít nhất 32 ký tự (bắt buộc cho đăng ký và quên mật khẩu).

## Chạy

Mở ba terminal:

```sh
npm run dev:api                    # API tại http://127.0.0.1:3000
npm run dev:web                    # Web tại http://localhost:5173 (proxy /api sang cổng 3000)
npm run worker:admin-jobs:watch    # worker chạy liên tục: hàng đợi job Admin và pipeline 15:30
```

Nạp dữ liệu thật ngay (không cần chờ lịch):

```sh
npm run worker:market:sync         # giá OHLCV ngày từ SSI
npm run worker:news:sync           # tin CafeF, VnExpress
npm run worker:notifications:deliver
```

Worker ở chế độ `watch` tự xếp hàng pipeline hằng ngày (giá → tin → cảnh báo → gửi thông báo) sau 15:30 giờ Việt Nam, thứ Hai đến thứ Sáu. Đổi giờ bằng `ADMIN_JOBS_SCHEDULE_TIME=HH:MM`, tắt bằng `ADMIN_JOBS_SCHEDULE=off`. Job lỗi được thử lại tối đa 3 lần; nếu vẫn lỗi, mọi Admin nhận cảnh báo ở chuông thông báo, kèm email/Telegram nếu Admin đã liên kết kênh trong Cài đặt → Kênh thông báo.

## Tài khoản

Tài khoản demo (do `db:seed:demo` tạo, mật khẩu theo mẫu `{vai trò}12345678`):

| Email | Vai trò | Mật khẩu |
| --- | --- | --- |
| `retail@stocksense.vn` | Nhà đầu tư cá nhân | `retail12345678` |
| `trader@stocksense.vn` | Trader | `trader12345678` |
| `analyst@stocksense.vn` | Analyst | `analyst12345678` |
| `admin@stocksense.vn` | Admin | `admin12345678` |

Cách có tài khoản khác:

- **Retail:** tự đăng ký ở trang Đăng ký, bấm liên kết xác thực trong email rồi đăng nhập.
- **Trader:** tài khoản retail tự nâng cấp trong Cài đặt → Tài khoản & vai trò.
- **Analyst:** gửi yêu cầu trong Cài đặt; Admin duyệt ở Quản trị → Yêu cầu nâng quyền.
- **Admin:** không đăng ký công khai. Admin đầu tiên trên CSDL mới (chưa seed demo) tạo bằng lệnh:

  ```sh
  BOOTSTRAP_ADMIN_EMAIL=you@example.com BOOTSTRAP_ADMIN_PASSWORD='Mat-khau-manh-1' npm run db:bootstrap-admin
  ```

  Có thể điền hai biến này vào `.env` thay vì gõ trên dòng lệnh; nên xóa mật khẩu khỏi `.env` sau khi chạy. Tài khoản tạo ra phải đổi mật khẩu ở lần đăng nhập đầu. Lệnh chỉ chạy khi chưa có Admin nào; Admin tiếp theo do Admin hiện có tạo trong Quản trị.

## Cấu hình email (SMTP)

Email cần cho xác thực đăng ký, quên mật khẩu, xác minh kênh email và gửi cảnh báo. Với Gmail, tạo App Password (cần bật xác minh 2 bước) rồi điền vào `.env`:

```ini
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=ten-ban@gmail.com
SMTP_PASS=<app password 16 ký tự>
SMTP_FROM=StockSense VN <ten-ban@gmail.com>
PUBLIC_APP_URL=http://localhost:5173
```

Thư được gửi từ tài khoản Gmail này tới bất kỳ địa chỉ email nào người dùng đăng ký. Gmail giới hạn khoảng 500 người nhận mỗi ngày, nên chỉ dùng cho demo. Khi chưa cấu hình SMTP, liên kết xác thực được ghi vào log của `dev:api`.

Bật quên mật khẩu: `PASSWORD_RESET_ENABLED=true` và `VITE_PASSWORD_RESET_ENABLED=true` (cần SMTP, `PUBLIC_APP_URL`, `AUTH_RATE_LIMIT_SECRET`).

## Cấu hình khác

| Biến | Tác dụng |
| --- | --- |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET` | Kênh Telegram; webhook trỏ tới `/api/v1/notify/telegram/webhook`, cần địa chỉ HTTPS công khai |
| `REPORT_FONT_PATH` | Bắt buộc để xuất PDF tiếng Việt: `apps/api/assets/fonts/NotoSans-Regular.ttf` (thiếu thì API trả 503 `REPORT_FONT_NOT_CONFIGURED`) |
| `COOKIE_SECURE` | Đặt `true` khi chạy sau HTTPS |
| `HISTORY_CSV_EXPORT_ENABLED`, `VITE_HISTORY_CSV_EXPORT_ENABLED` | Bật xuất CSV lịch sử giá cho Analyst |

Không đưa tệp `.env` lên kho mã.

## Chức năng theo vai trò

| Chức năng | Retail | Trader | Analyst | Admin |
| --- | :-: | :-: | :-: | :-: |
| Tổng quan, chi tiết mã, tin tức | ✓ | ✓ | ✓ | |
| Watchlist (tối đa 10 mã), cảnh báo giá, chuông thông báo | ✓ | ✓ | ✓ | |
| Screener, bộ lọc mẫu | ✓ | ✓ | ✓ | |
| Lưu bộ lọc Screener | | ✓ | ✓ | |
| Portfolio nhập tay, PDF danh mục | ✓ | ✓ | ✓ | |
| Import CSV, tổng quan và phân bổ danh mục | | ✓ | ✓ | |
| Trade Plan: R:R, khoảng cách % | ✓ | ✓ | ✓ | |
| Trade Plan: vốn, % rủi ro, khối lượng theo lô 100 | | ✓ | ✓ | |
| Journal từ Trade Plan đã đóng (xem, sửa ghi chú) | ✓ | ✓ | ✓ | |
| Journal ghi thủ công, thống kê, PDF theo kỳ | | ✓ | ✓ | |
| Kênh thông báo email/Telegram | ✓ | ✓ | ✓ | ✓ |
| Quản trị: người dùng, yêu cầu nâng quyền, job, audit, nhật ký gửi | | | | ✓ |

Admin không đọc được Portfolio, Trade Plan, Journal của người dùng.

## Kiểm thử

```sh
npm test            # vitest cho packages/core, API và worker
npm run build:web   # kiểm tra build giao diện
```

## Chế độ không cần CSDL

Nếu bỏ `DATABASE_URL`, API chạy bằng dữ liệu mẫu trong bộ nhớ (phiên cũng chỉ lưu trong bộ nhớ). Nếu đặt `VITE_API_MODE=mock` trong `apps/web/.env.local` (xem `apps/web/.env.example`), web dùng API giả trong trình duyệt. Hai chế độ này chỉ để phát triển giao diện; đăng ký, email và worker cần PostgreSQL.

## Tài liệu

- `Tài liệu chạy dự án/PROJECT_BRIEF_v0.0.4.md`: mục tiêu và phạm vi
- `Tài liệu chạy dự án/PRODUCT_REQUIREMENTS_DOCUMENT_v0.0.4.md`: yêu cầu (FR, NFR, use case, tiêu chí nghiệm thu)
- `Tài liệu chạy dự án/Software_Design_Document_v0.0.5.md`: kiến trúc, dữ liệu, API
- `Tài liệu chạy dự án/tiendo.md`: mức hoàn thành so với PRD
- `openapi.yaml`: hợp đồng API; `docs/web.md`: quy tắc vai trò ở giao diện
- `apps/worker/README.md`: tùy chọn đồng bộ dữ liệu và hạn chế của nguồn SSI
