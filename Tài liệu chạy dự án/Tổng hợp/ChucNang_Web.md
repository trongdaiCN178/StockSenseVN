# StockSense VN (IDSS) – Chức năng web đã có

Cập nhật: 31/10/2026. Tổng hợp những gì web đang làm được, theo module của PRD v0.0.4 và theo vai trò. Chi tiết chấm điểm từng yêu cầu ở `tiendo.md`; cấu trúc CSDL ở `CSDL_StockSenseVN.sql`; luồng xử lý ở `UseCase_BieuDoTuanTu.md`.

## 1. Tóm tắt

- **Mức hoàn thành so với PRD:** 67/115 yêu cầu chức năng ≈ 58% (không tính app mobile: 67/110 ≈ 61%). Mọi chức năng không cần mô hình AI đã chạy; phần còn lại chờ mô hình dự báo, mô hình cảm xúc tin, mô hình ngôn ngữ cho Chat, hoặc app mobile (GĐ3).
- **Dữ liệu thật trong CSDL:**
  - 15 mã HOSE do nhóm mô hình chốt: FPT, VNM, STB, ACB, SSI, VIC, HPG, VCB, MSN, MBB, GAS, MWG, VPB, VRE, TCB.
  - Giá ngày 5 năm (27/10/2021 → 30/10/2026), 1.249 phiên mỗi mã, gồm giá khớp và giá đã điều chỉnh (chia cổ tức bằng cổ phiếu, thưởng, tách).
  - Chỉ số VN-Index, VN30 (1.249 phiên), HNX-Index (1.246 phiên; nguồn SSI thiếu 3 phiên).
  - 11.233 bài tin từ 01/01/2021 (CafeF theo mã, CafeF chuyên mục, VnExpress): tiêu đề, thời gian, link bài gốc.
  - 60 ngày nghỉ của sàn 2022–2027.
- **Dữ liệu còn là mẫu:** dự báo T+2/T+5 và tỷ lệ nhãn (chờ mô hình); sắc thái tin (đang để "trung tính").
- **Công nghệ:** React 19 + Vite (web), Node.js 22 + Fastify 5 (API), Node.js worker (đồng bộ dữ liệu, thông báo), PostgreSQL 17, TradingView Lightweight Charts (biểu đồ nến), pdfkit (PDF), nodemailer + Gmail SMTP, Telegram Bot. 98 kiểm thử tự động.

## 2. Chức năng theo module

Ký hiệu: ✅ chạy đầy đủ · 🟡 chạy một phần · ❌ chưa có.

### M0. Tài khoản, đăng ký, đăng nhập

| Chức năng | Mức |
| --- | --- |
| Đăng nhập, đăng xuất; phiên 24 giờ (cookie HttpOnly, token lưu băm) | ✅ |
| Khóa tạm 15 phút sau 5 lần sai mật khẩu; thông báo lỗi chung | ✅ |
| Đổi mật khẩu; quên mật khẩu qua email (liên kết 30 phút); Admin cấp mật khẩu tạm, bắt đổi lần đầu | ✅ |
| Chính sách mật khẩu 8–64 ký tự, có chữ, số, ký tự đặc biệt | ✅ |
| Tự đăng ký tài khoản retail: 3 ô đồng ý (đủ 18 tuổi, điều khoản, xử lý dữ liệu), không lộ email đã tồn tại, giới hạn 5 lần/giờ | ✅ |
| Xác thực email bằng liên kết 24 giờ (gửi thật qua Gmail); gửi lại thư; xóa tài khoản không xác thực sau 7 ngày | ✅ |
| Tự nâng cấp Trader / hạ về Retail; gửi yêu cầu quyền Analyst, Admin duyệt hoặc từ chối có lý do | ✅ |
| Xem lịch sử đồng ý; tự xóa tài khoản (nhập lại mật khẩu) | ✅ |
| Tạo Admin đầu tiên bằng lệnh bootstrap; luôn giữ ít nhất 1 Admin | ✅ |
| Đồng ý lại khi đổi phiên bản điều khoản; TOTP cho Admin; captcha; xác nhận email cơ quan | ❌ |

### M1. Tổng quan thị trường

| Chức năng | Mức |
| --- | --- |
| Danh sách 15 mã: giá đóng cửa, % thay đổi, ngành, GTGD bình quân 20 phiên; lọc sàn/ngành/thanh khoản; sắp xếp; tìm kiếm | ✅ |
| Dải thị trường: VN-Index, HNX-Index thật từ SSI; độ rộng tăng/đứng/giảm trên 15 mã | ✅ |
| Ngày dữ liệu giá và ngày dự báo ở đầu trang | ✅ |
| Cột dự báo T+2/T+5, tỷ lệ nhãn, lọc/sắp theo dự báo, khối "tín hiệu đổi hôm nay" | 🟡 dữ liệu mẫu / ❌ |

### Bảng giá cuối ngày (bổ sung)

| Chức năng | Mức |
| --- | --- |
| 15 mã với tham chiếu, trần, sàn, đóng cửa, +/−, %, mở/cao/thấp, tổng khối lượng, giá trị, dự báo T+2/T+5 | ✅ |
| Màu theo quy ước: tím trần, xanh lam sàn, vàng tham chiếu, xanh tăng, đỏ giảm; tổng số mã trần/tăng/đứng/giảm/sàn | ✅ |
| Trần/sàn theo biên độ và bước giá từng sàn; tham chiếu đúng cả ngày giao dịch không hưởng quyền | ✅ |
| Lọc sàn, ngành, tìm mã, chỉ watchlist, sắp xếp; bấm mã mở trang chi tiết | ✅ |
| Dữ liệu trong phiên, sổ lệnh, khối ngoại, đặt lệnh | ❌ (ngoài phạm vi) |

### M2. Trang chi tiết mã

| Chức năng | Mức |
| --- | --- |
| Khối giá: tham chiếu/trần/sàn, mở cửa, cao, thấp, khối lượng, giá trị, trung bình 20 phiên, % 1 tuần/1 tháng/3 tháng/từ đầu năm, cao/thấp 52 tuần | ✅ |
| Biểu đồ nến 5 năm theo giá điều chỉnh (TradingView Lightweight Charts): khối lượng, MA20, MA50, RSI(14), MACD; khung ngày/tuần/tháng; khoảng 1T–3N–Tất cả; đánh dấu phiên có tin | ✅ |
| Trạng thái dữ liệu (đầy đủ / dữ liệu cũ / thiếu tin) | ✅ |
| Bảng lịch sử giá theo phiên (5 năm) | ✅ |
| Thẻ dự báo T+2/T+5 cạnh nhau, xác suất 3 lớp, mức tin cậy, ngày đáo hạn theo lịch giao dịch (bỏ ngày nghỉ) | 🟡 dữ liệu mẫu |
| "Vì sao?", "Điều gì có thể làm dự báo sai" | ❌ cần mô hình |
| Thêm watchlist, lập Trade Plan, xuất PDF, xuất CSV (Analyst) từ trang mã | ✅ |

### M3. Giải thích dự báo — ❌ cần mô hình (tỷ trọng nhóm yếu tố, top 15 đặc trưng, câu giải thích).

### M4. Tin tức

| Chức năng | Mức |
| --- | --- |
| Thu thập tin CafeF (chuyên mục + trang tin theo mã), VnExpress; gắn mã; loại trùng; lịch sử từ 2021 | ✅ |
| Tab Tin tức: mới nhất trước, lọc theo ngày, mở bài gốc | ✅ |
| Nhãn sắc thái, lọc theo sắc thái, biểu đồ cảm xúc, mức ảnh hưởng tin | ❌ cần mô hình |

### M5. Watchlist và cảnh báo

| Chức năng | Mức |
| --- | --- |
| Watchlist tối đa 10 mã, ghi chú; thêm từ tổng quan, bảng giá, trang mã | ✅ |
| Cảnh báo theo mốc giá đóng cửa; cảnh báo Trade Plan (chạm vùng vào/cắt lỗ/mục tiêu, hết hạn) | ✅ |
| Chuông thông báo, đếm chưa đọc, đánh dấu đã đọc, lịch sử 90 ngày | ✅ |
| Gửi cảnh báo qua email (Gmail) và Telegram; liên kết/xác minh kênh, gửi thử, bật/tắt; chống gửi trùng, thử lại 3 lần | ✅ |
| Cảnh báo đổi nhãn dự báo, vượt ngưỡng xác suất | ❌ cần mô hình |

### M6. Lịch sử dự báo và đánh giá mô hình — ❌ cần dự báo thật (hit rate, confusion matrix, ablation, hiệu chỉnh).

### M7. Quản trị và vận hành

| Chức năng | Mức |
| --- | --- |
| Quản lý người dùng: tạo, khóa/mở, đổi vai trò, cấp mật khẩu tạm, thu hồi phiên | ✅ |
| Duyệt yêu cầu nâng quyền Analyst | ✅ |
| Nguồn dữ liệu và job: trạng thái worker (heartbeat), lịch sử các lần nạp, chạy lại job | ✅ |
| Pipeline tự động 15:30 các ngày giao dịch (bỏ ngày nghỉ): giá + chỉ số SSI → tin → cảnh báo → gửi thông báo; thử lại 3 lần; báo Admin khi lỗi | ✅ |
| Tự nạp lại lịch sử khi SSI điều chỉnh giá (chia cổ tức, thưởng cổ phiếu) | ✅ |
| Nhật ký quản trị có lọc thời gian/người/hành động, phân trang; nhật ký gửi thông báo; sự kiện vận hành | ✅ |
| Nhật ký Chat (che nội dung cá nhân) cho Admin và Analyst | ✅ |
| Phiên bản mô hình, chọn/rollback, xem đầu vào và tái lập dự báo | ❌ cần mô hình |

### M8. Screener

| Chức năng | Mức |
| --- | --- |
| Lọc theo sàn, ngành, giá, % thay đổi, thanh khoản; sắp xếp; bộ lọc có sẵn | ✅ |
| Lưu bộ lọc có tên (Trader, Analyst) | ✅ |
| Thêm watchlist, mở chi tiết, lập Trade Plan từ kết quả; tuyên bố "không phải xếp hạng nên mua" | ✅ |
| Điều kiện theo nhãn, xác suất, hit rate | ❌ cần mô hình |

### M9. Portfolio

| Chức năng | Mức |
| --- | --- |
| Nhập, sửa, xóa giao dịch; xóa toàn bộ | ✅ |
| Import CSV có xem trước, bỏ dòng lỗi/trùng kèm lý do (Trader, Analyst) | ✅ |
| Vị thế, giá vốn bình quân, lãi/lỗ tạm tính và đã thực hiện, tỷ trọng, phân bổ ngành, giá trị theo thời gian | ✅ |
| Tín hiệu dự báo cạnh từng vị thế | ❌ cần mô hình |

### M10. Trade Plan

| Chức năng | Mức |
| --- | --- |
| Lập kế hoạch: vùng giá vào, cắt lỗ, mục tiêu, lý do, ngày hết hạn | ✅ |
| Tính R:R, khoảng cách %, khối lượng tối đa theo vốn và % rủi ro (lô 100) | ✅ |
| Trạng thái Nháp → Chờ vào → Đang mở → Đã đóng/Hủy; sửa có lịch sử; đóng kèm lý do | ✅ |
| Cảnh báo chạm vùng giá; đóng tự tạo Journal; tuyên bố "Trade Plan do bạn tự lập" | ✅ |
| Snapshot dự báo lúc lập, cảnh báo nhãn ngược | 🟡 cần mô hình |

### M11. Journal

| Chức năng | Mức |
| --- | --- |
| Tự tạo khi đóng Trade Plan (kế hoạch gốc, kết quả, R thực tế); ghi thủ công | ✅ |
| Sửa ghi chú, thẻ, bài học; lọc theo mã/ngày/thẻ/kết quả/từ khóa | ✅ |
| Thống kê tuần/tháng/quý (Trader, Analyst) | ✅ |
| So sánh quyết định với dự báo, tỷ lệ làm theo tín hiệu | ❌ cần mô hình |

### M12. Chat hỏi đáp

| Chức năng | Mức |
| --- | --- |
| Phiên chat riêng tư; tự đặt tên phiên theo câu hỏi đầu | ✅ |
| Trả lời từ dữ liệu thật: giá, biến động, RSI/MACD/MA, dự báo (mẫu), tin mới, thị trường, thuật ngữ, danh mục/Trade Plan/Journal/watchlist của chính người hỏi; mỗi câu trả lời kèm nguồn bấm được | ✅ |
| Từ chối đưa lệnh, khuyến nghị mua/bán, giá mục tiêu, dữ liệu người khác; lọc đầu ra; "Hệ thống không có dữ liệu này" khi không có dữ liệu | ✅ |
| Log mỗi lượt (ý định, bộ trả lời, kết quả lọc), che nội dung cá nhân khi Admin/Analyst xem | ✅ |
| Bộ kiểm thử chống bịa (45 câu tự động) | 🟡 PRD yêu cầu 50 + 20 câu với mô hình thật |
| Trả lời "vì sao dự báo…", hit rate; diễn đạt tự nhiên bằng mô hình ngôn ngữ | ❌ cần mô hình |

### M13. Báo cáo PDF

| Chức năng | Mức |
| --- | --- |
| PDF mã, danh mục, Trade Plan, Journal theo kỳ; tiếng Việt; tuyên bố, thời điểm, ngày dữ liệu, số trang | ✅ |
| Dự báo thật, giải thích, hit rate trong PDF | 🟡 cần mô hình |

### M14. App mobile — ❌ giai đoạn 3 (web đã dùng được trên điện thoại từ 375 px).

## 3. Chức năng theo vai trò

Hệ thống có 4 vai trò: Retail (nhà đầu tư cá nhân), Trader, Analyst, Admin. Người chưa đăng nhập không có vai trò; họ chỉ dùng được đăng ký tài khoản (tạo ra tài khoản Retail), xác thực email và quên mật khẩu.

| Chức năng | Retail | Trader | Analyst | Admin |
| --- | :-: | :-: | :-: | :-: |
| Tổng quan, bảng giá, trang mã, biểu đồ nến, tin tức | ✓ | ✓ | ✓ | |
| Watchlist, cảnh báo giá, chuông thông báo | ✓ | ✓ | ✓ | |
| Screener, bộ lọc có sẵn | ✓ | ✓ | ✓ | |
| Lưu bộ lọc Screener | | ✓ | ✓ | |
| Portfolio nhập tay, PDF danh mục | ✓ | ✓ | ✓ | |
| Import CSV, tổng quan và phân bổ danh mục | | ✓ | ✓ | |
| Trade Plan: R:R, khoảng cách % | ✓ | ✓ | ✓ | |
| Trade Plan: vốn, % rủi ro, khối lượng; hồ sơ đầu tư | | ✓ | ✓ | |
| Journal từ Trade Plan (xem, sửa ghi chú) | ✓ | ✓ | ✓ | |
| Journal thủ công, thống kê, PDF theo kỳ | | ✓ | ✓ | |
| Chat hỏi đáp | ✓ | ✓ | ✓ | |
| Kênh thông báo email/Telegram | ✓ | ✓ | ✓ | ✓ |
| Nâng cấp Trader / hạ cấp | ✓ | ✓ | | |
| Yêu cầu quyền Analyst | ✓ | ✓ | | |
| Xuất CSV lịch sử giá | | | ✓ | |
| Nhật ký Chat (đã che dữ liệu cá nhân) | | | ✓ | ✓ |
| Quản trị: người dùng, duyệt nâng quyền, job dữ liệu, audit, nhật ký thông báo, sự kiện vận hành | | | | ✓ |

Admin không đọc được Portfolio, Trade Plan, Journal của người dùng.

## 4. Những gì còn chờ

| Việc | Phụ thuộc |
| --- | --- |
| Dự báo T+2/T+5 thật, mức tin cậy, ngày đáo hạn, giải thích (M2, M3) | Mô hình dự báo |
| Sắc thái tin, biểu đồ cảm xúc (M4) | Mô hình cảm xúc |
| Lịch sử dự báo, hit rate, trang Đánh giá mô hình (M6) | Dự báo thật tích lũy theo thời gian |
| Phiên bản mô hình, tái lập dự báo (M7) | Mô hình + bảng ở phần B của `CSDL_StockSenseVN.sql` |
| Cảnh báo đổi nhãn/ngưỡng xác suất; điều kiện Screener theo dự báo; tín hiệu cạnh vị thế; so sánh Journal với dự báo | Dự báo thật |
| Chat diễn đạt tự nhiên, trả lời "vì sao" | Mô hình ngôn ngữ (API hoặc chạy trên máy) |
| Báo cáo tài chính (P/E, EPS, ROE…) | Nguồn BCTC |
| App iOS/Android | Giai đoạn 3 |
