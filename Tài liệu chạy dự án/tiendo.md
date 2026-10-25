# Báo cáo tiến độ: StockSense VN so với PRD v0.0.3 / SDD v0.0.4

Ngày lập: 25/10/2026 · Phạm vi: rà soát toàn bộ chức năng web hiện có trong code, đối chiếu với `PRODUCT_REQUIREMENTS_DOCUMENT_v0.0.3.md`, `Software_Design_Document_v0.0.4.md`, và tài liệu đề xuất bổ sung `Quy_dinh_va_nghiep_vu_luong_dang_ky_IDSS.md`.

## Phát hiện quan trọng nhất (đọc trước)

**Toàn bộ lõi AI/mô hình dự báo mô tả ở PRD mục 12 (mô hình đa phương thức, SHAP/attention, chấm cảm xúc tin tức PhoBERT, huấn luyện/đánh giá, walk-forward) KHÔNG TỒN TẠI trong code.** Dự báo hiển thị trên toàn bộ web (Market overview, Forecast card, Screener, Portfolio, Trade Plan, PDF...) là **dữ liệu mẫu nạp một lần qua `db/seed-demo.js`**, không được một mô hình nào tính ra và không tự cập nhật sau mỗi phiên như FR-M7-07 yêu cầu. Đây không phải là một module thiếu — đây là **giá trị cốt lõi của sản phẩm theo PRD mục 5**, nên kéo theo một loạt module khác (M3, M6, phần "đổi nhãn" của M1/M5/M9) chỉ còn là khung rỗng hoặc dùng sai loại dữ liệu.

---

## M0. Xác thực và tài khoản

**Trạng thái: Đã làm đầy đủ, bao gồm toàn bộ phần mở rộng từ tài liệu "Quy định đăng ký IDSS" (cập nhật 26/10/2026).**

Có: đăng nhập/đăng xuất, đổi mật khẩu, khóa tài khoản sau đăng nhập sai, quên/đặt lại mật khẩu qua email, quản lý tài khoản bởi Admin — đều hoạt động thật trên PostgreSQL (`apps/api/src/auth/postgres-repository.js`, `apps/api/src/admin/users-repository.js`).

Sai lệch so với PRD/SDD đã được **sửa trong phiên 26/10/2026**:
- FR-M0-04: khóa sau 5 lần sai (trước đây là 8) — `MAX_FAILED_LOGINS = 5`.
- SDD/NFR-07: phiên đăng nhập 24 giờ (trước đây là 8 giờ) — `TOKEN_TTL_MS`.
- FR-M0-06: mật khẩu tự đặt (đăng ký, đổi mật khẩu, đặt lại mật khẩu) giờ bắt buộc có chữ + số + ký tự đặc biệt, 12-128 ký tự (`isStrongPassword()` trong `server.js`).
- Vẫn dùng scrypt thay bcrypt cost 12 — an toàn tương đương, giữ nguyên vì không phải lỗi.

**Đăng ký + xác thực email** (đã làm trước đó): đăng ký tự phục vụ cho retail + xác thực email một lần 24h + chống dò tài khoản + giới hạn tần suất + tự xóa tài khoản `pending` sau 7 ngày.

**Mở rộng vòng đời vai trò — đã làm đầy đủ trong phiên 26/10/2026** (đã kiểm thử thật trên PostgreSQL qua HTTP, không dùng mock):
- `POST /me/upgrade/trader` — retail tự nâng cấp lên Trader (khai kinh nghiệm + mục đích + xác nhận trách nhiệm), thu hồi toàn bộ phiên, ghi `user_consent` + `admin_audit_log`.
- `POST /me/downgrade/retail` — trader tự hạ cấp về retail, giữ dữ liệu đã nhập, thu hồi phiên.
- `POST /me/role-requests`, `GET /me/role-requests` — retail/trader gửi yêu cầu quyền Analyst (tổ chức, chức danh, email cơ quan, mục đích); tối đa 1 yêu cầu chờ xử lý (ràng buộc unique index); bị từ chối thì khóa nộp lại 7 ngày.
- `GET /admin/role-requests`, `POST /admin/role-requests/:id/approve`, `/reject` — Admin duyệt/từ chối (bắt buộc lý do khi từ chối), không tự duyệt được yêu cầu của chính mình, duyệt xong đổi vai trò + thu hồi phiên người yêu cầu. Có trang quản trị riêng "Yêu cầu nâng quyền".
- `db/bootstrap-admin.js` (`npm run db:bootstrap-admin`) — tạo Admin đầu tiên qua CLI, đọc email/mật khẩu từ biến môi trường, tự chặn nếu đã có Admin, không có endpoint công khai nào tạo được admin (đã kiểm thử: chạy khi đã có admin bị từ chối đúng như thiết kế).
- `DELETE /me` — người dùng tự xóa tài khoản (xác nhận lại mật khẩu), chặn với tài khoản admin, xóa toàn bộ dữ liệu liên quan (watchlist, portfolio, trade plan, journal, chat, kênh thông báo) qua cascade DB, giữ lại nhật ký bảo mật dạng ẩn danh (`admin_audit_log` với `actor_user_id`/`target_user_id` tự chuyển NULL).
- `GET /me/consents` — xem lại lịch sử đồng ý điều khoản/chính sách dữ liệu đã lưu lúc đăng ký/nâng cấp.
- Màn hình mới: "Tài khoản & vai trò" (`/settings/account`) cho người dùng tự phục vụ; "Yêu cầu nâng quyền" (`/admin/role-requests`) cho Admin.

**Chưa làm (cố ý bỏ qua, theo đúng mục 11 của tài liệu gốc — đây là các điểm mà tài liệu tự ghi "cần bạn quyết định", không phải yêu cầu Must-have chắc chắn):** xác thực hai lớp (TOTP) cho Admin, quy tắc "hai người xác nhận" khi tạo thêm Admin — tài liệu gốc tự liệt kê phương án đơn giản hơn (một Admin tự tạo) là phù hợp hơn cho quy mô đồ án, nên đã chọn phương án đó.

---

## M1. Market overview

**Trạng thái: Đã làm một phần.**

Có: danh sách mã (mã, tên, sàn, giá, %, GTGD), lọc/sắp xếp/tìm kiếm, dải VN-Index/HNX-Index + độ rộng thị trường, ngày dữ liệu/giờ batch (`apps/api/src/market/repository.js`).

Thiếu: khối **"Tín hiệu đổi hôm nay"** (FR-M1-07) — không có vì không có gì tính "đổi nhãn so với phiên trước" (hệ quả của việc không có pipeline dự báo).

---

## M2. Forecast card & trang chi tiết mã

**Trạng thái: Đã làm một phần — chỉ có khung hiển thị, dữ liệu là mẫu tĩnh.**

Có: hai thẻ T+2/T+5 cạnh nhau, xác suất 3 lớp, timestamp, ngày đáo hạn, tuyên bố tham khảo, biểu đồ giá 6 tháng (`SymbolDetailPage.jsx`, `market/repository.js`).

Thiếu/giả: số liệu dự báo đến từ `db/seed-demo.js`, không có batch sinh lại mỗi ngày; cột "độ tin cậy 3 bậc" tồn tại trong schema nhưng không được một quy tắc batch nào tính; khối **"Điều gì có thể làm dự báo sai"** (FR-M2-09) không tồn tại trong code hay UI.

---

## M3. Explainability (Giải thích dự báo)

**Trạng thái: Chưa làm — không có gì, kể cả khung UI.**

Không có bảng `forecast_explanation`/cột tương đương trong bất kỳ migration nào. Không có SHAP/attention, không có 3 câu giải thích retail, không có top-15 đặc trưng cho analyst. Tab **"Phân tích mô hình"** trên trang chi tiết mã bị khoá với nhãn "Sắp có" (`apps/web/src/features/symbol-detail/SymbolDetailPage.jsx:49`) — tức chính code đã tự đánh dấu là chưa làm.

**Mức độ: chặn một phần demo** — US-02, US-09 (giải thích dự báo) không thể hiện diện.

---

## M4. News & sentiment

**Trạng thái: Đã làm một phần, có phần giả.**

Có (thật): thu thập tin từ CafeF + VnExpress, loại trùng, gắn theo mã, hiển thị mới nhất trước, lọc theo ngày, mở bài gốc (`apps/worker/src/jobs/sync-news.js`, `apps/worker/src/providers/news.js`).

Giả: mọi tin thật nhập vào đều được gán cứng `sentiment = 'neutral'` (`sync-news.js:87`) — **không có mô hình PhoBERT hay NLP nào chấm cảm xúc**. Vì vậy nhãn sắc thái và biểu đồ cảm xúc 30 phiên hiển thị trên UI không phản ánh nội dung tin thật. Cut-off 15:00 (FR-M4-06) không có ý nghĩa vì không có pipeline dự báo nào tiêu thụ tin.

---

## M5. Watchlist & cảnh báo

**Trạng thái: Đã làm một phần, loại cảnh báo khác với PRD.**

Có (thật): watchlist tối đa 10 mã, cảnh báo trong app + lịch sử 90 ngày, liên kết và gửi thật qua Email (SMTP)/Telegram qua hàng đợi `notification_outbox` + worker retry 3 lần (`apps/worker/src/jobs/notification-delivery.js`).

Sai lệch quan trọng: FR-M5-02/03 yêu cầu cảnh báo khi **nhãn dự báo đổi** hoặc **xác suất vượt ngưỡng**; thực tế hệ thống chỉ hỗ trợ cảnh báo **giá đóng cửa vượt ngưỡng trên/dưới** (`price_above`/`price_below`, lấy từ SSI) — vì không có pipeline dự báo để theo dõi đổi nhãn. Đây là tính năng khác, không phải tính năng PRD yêu cầu, dù hạ tầng gửi thông báo là thật.

---

## M6. Backtest / lịch sử dự báo / đánh giá mô hình

**Trạng thái: Chưa làm.**

Không có endpoint lịch sử dự báo đúng/sai, không tính hit rate/precision/recall, không tự điền `actual_label` khi đáo hạn. Mục menu **"Đánh giá mô hình"** không có `path` (`apps/web/src/app/AppShell.jsx:14`) — bấm vào không có trang nào mở ra. `/models/evaluation`, `/models/summary` không tồn tại trong `server.js`. Endpoint `history.csv` tồn tại nhưng **chỉ xuất giá đóng cửa (OHLC)**, không phải lịch sử độ chính xác dự báo như FR-M6-05 mô tả — trùng tên nhưng khác nội dung.

---

## M7. Admin / model ops

**Trạng thái: Đã làm một phần.**

Có: quản lý tài khoản (tạo/khóa/đổi vai trò), nhật ký audit có lọc + phân trang (chỉ thêm, không sửa/xóa), quản lý nguồn dữ liệu/job (`admin/jobs`, `admin/ingestion-runs`), sự kiện vận hành (`admin/ops-events`), nhật ký gửi thông báo (`admin/notifications`).

Chưa làm (vì không có mô hình thật để quản lý): theo dõi phiên bản mô hình, chọn/rollback phiên bản (FR-M7-06), audit một dự báo cụ thể (FR-M7-04 phần forecast, `/forecasts/{id}/audit`), xem dữ liệu đầu vào một dự báo (FR-M7-09, `/forecasts/{id}/inputs`), chạy lại để tái lập dự báo (FR-M7-10, `/forecasts/{id}/replays`). Không có route nào trong số này tồn tại trong `server.js`.

---

## M8. Screener

**Trạng thái: Đã làm đầy đủ về cấu trúc.** Lọc theo kỳ hạn/nhãn/xác suất/sàn/ngành, bộ lọc có sẵn, lưu bộ lọc, liên kết watchlist/Trade Plan (`apps/api/src/screener/repository.js`). Vận hành đúng thiết kế, nhưng do M2 chỉ có dữ liệu mẫu, kết quả lọc không phản ánh một mô hình dự báo thật.

## M9. Portfolio

**Trạng thái: Đã làm đầy đủ.** Nhập/sửa/xóa giao dịch, import CSV 2 bước (xem trước + xác nhận), tính vị thế/giá vốn bình quân/lãi lỗ/tỷ trọng, xóa toàn bộ, không gọi API công ty chứng khoán (`apps/api/src/portfolio/repository.js`).

## M10. Trade Plan

**Trạng thái: Đã làm đầy đủ.** Snapshot dự báo lúc lập kế hoạch (không sửa được), R:R, khối lượng theo lô 100, trạng thái Nháp→Chờ vào→Đang mở→Đã đóng, đóng kế hoạch tự tạo Journal (`apps/api/src/plans/repository.js`). Lưu ý: snapshot dự báo gắn vào kế hoạch cũng là dữ liệu mẫu, không phải dự báo thật.

## M11. Journal

**Trạng thái: Đã làm đầy đủ.** Tự tạo khi đóng Trade Plan, ghi chú/thẻ/bài học, thống kê nhìn lại, chỉ chủ sở hữu xem được (`apps/api/src/journal/repository.js`).

---

## M12. Chat hỏi đáp

**Trạng thái: Đã làm một phần — chỉ có khung, không có trả lời thật.**

Có: tạo/xóa session, lưu lịch sử hội thoại, giao diện cửa sổ chat.

Chưa làm: gửi tin nhắn luôn trả lỗi 503 "Chat inference is unavailable until the approved ONNX model and safety pipeline are configured" (`apps/api/src/server.js:394` vùng chat); giao diện tự hiển thị chip **"Mô hình chưa sẵn sàng"** (`apps/web/src/features/chat/ChatPage.jsx:67`). Không có bộ chặn đầu vào/đầu ra, không có bộ kiểm thử chống bịa (FR-M12-08).

---

## M13. Báo cáo PDF

**Trạng thái: Đã làm đầy đủ cho Portfolio/Trade Plan/Journal/Symbol** — endpoint thật, dùng cùng truy vấn với màn hình, có tuyên bố + thời điểm + phiên bản (`apps/api/src/reports/pdf.js`). Báo cáo mã sẽ thiếu phần "giải thích" vì M3 chưa có.

## M14. Ứng dụng mobile

**Trạng thái: Chưa làm** (đúng theo kế hoạch GĐ3, chưa đến giai đoạn). Không có thư mục `mobile/` nào trong repo.

---

## Tổng kết

| Trạng thái | Số module (trên 15, M0–M14) |
| --- | --- |
| Đã làm đầy đủ | M0, M8, M9, M10, M11, M13 (6) |
| Đã làm một phần (có phần giả/thiếu — gốc rễ: thiếu mô hình AI thật) | M1, M2, M4, M5, M7, M12 (6) |
| Chưa làm | M3, M6, M14 (3) |

**Cập nhật 26/10/2026:** mọi module KHÔNG phụ thuộc mô hình AI đã được hoàn thiện end-to-end trên dữ liệu thật (PostgreSQL), gồm toàn bộ M0 (đăng ký, xác thực email, nâng cấp Trader, yêu cầu/duyệt Analyst, bootstrap Admin, tự xóa tài khoản) và các sai lệch chính sách (khóa đăng nhập, thời hạn phiên, độ phức tạp mật khẩu). Toàn bộ đã kiểm thử thật qua HTTP trên PostgreSQL, không dùng mock.

**Gốc rễ của phần lớn mục "một phần" còn lại: không có mô hình dự báo/NLP thật.** Đây là việc duy nhất ảnh hưởng tới nhiều module nhất cùng lúc (M2, M3, M4 phần sentiment, M5 loại cảnh báo đúng, M6 toàn bộ) — không thể giải quyết bằng công việc "không liên quan AI" nữa, vì bản chất các module này LÀ phần AI.

**Ưu tiên nếu làm tiếp (theo mức ảnh hưởng tới bảo vệ đồ án):**
1. Pipeline dự báo thật tối thiểu (dù là baseline Logistic Regression/XGBoost) + cập nhật tự động — đây là yêu cầu Must-have GĐ1 cốt lõi nhất (FR-M7-07) và đang là khoảng trống lớn nhất.
2. M3 Explainability — chỉ cần tỷ trọng 3 nhóm + 3 câu mẫu cho retail đã đạt Must-have tối thiểu.
3. M6 lịch sử dự báo/hit rate — cần có trước khi có pipeline dự báo thật (bước 1).
4. Sentiment thật (dù bằng mô hình nhỏ/rule-based) thay cho `'neutral'` cứng.
5. M12 Chat — cần quyết định mô hình ngôn ngữ (cục bộ hay API) trước khi làm, vì đây là quyết định kiến trúc, không chỉ là code.
