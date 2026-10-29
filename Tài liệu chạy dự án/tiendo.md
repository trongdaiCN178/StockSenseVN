# Báo cáo tiến độ: StockSense VN so với PRD v0.0.4 / SDD v0.0.5

Ngày lập: 25/10/2026 · **Cập nhật lần cuối: 29/10/2026 (PRD v0.0.4 bổ sung 8 FR luồng đăng ký FR-M0-08..15, tổng FR tăng từ 107 lên 115).**

Phạm vi: đối chiếu toàn bộ **115 yêu cầu chức năng (FR-M0 → FR-M14)** trong `PRODUCT_REQUIREMENTS_DOCUMENT_v0.0.4.md` với code trong `apps/` và `packages/`. Yêu cầu phi chức năng (NFR), kiến trúc trong SDD và các tài liệu đề xuất bổ sung không được tính vào tỷ lệ phần trăm.

## 1. Kết quả tổng hợp

Cách chấm từng FR: **Đạt = 1 điểm**, **Một phần = 0,5 điểm**, **Chưa làm = 0 điểm**. Chức năng có giao diện nhưng chạy trên dữ liệu dự báo mẫu (seed) được chấm là **Một phần**, vì PRD yêu cầu dự báo thật.

| Chỉ số | Trước (25/10, PRD 0.0.3) | 26/10 (PRD 0.0.3) | **Hiện tại (29/10, PRD 0.0.4)** |
| --- | --- | --- | --- |
| **Mức hoàn thành toàn bộ PRD (M0–M14)** | 41 / 107 ≈ 38% | 54 / 107 ≈ 50% | **60,5 / 115 ≈ 53%** |
| Không tính app mobile M14 (giai đoạn 3) | 41 / 102 ≈ 40% | 54 / 102 ≈ 53% | **60,5 / 110 ≈ 55%** |
| Số FR đạt đầy đủ | 21 | 43 | **49** |
| Số FR làm một phần | 40 | 22 | **23** |
| Số FR chưa làm | 46 | 42 | **43** |

Luồng đăng ký đã được code từ trước nhưng chưa có trong PRD 0.0.3; khi đưa vào PRD 0.0.4 thành FR-M0-08..15 thì 6 FR đạt, FR-M0-10 một phần (chưa có đồng ý lại khi đổi phiên bản văn bản), FR-M0-15 (Should: TOTP, xác nhận email cơ quan, captcha…) chưa làm.

**Kết luận chính:** mọi FR **không phụ thuộc mô hình AI** (trừ app mobile và phần tăng cường bảo mật đăng ký FR-M0-10/15) đã đạt. Ngoài FR-M0-10 và FR-M0-15, toàn bộ FR "một phần" và "chưa làm" còn lại đều thuộc một trong ba nhóm:
- cần mô hình dự báo, sentiment, giải thích hoặc chat;
- là app mobile M14;
- là phần dự báo nằm bên trong một FR mà phần còn lại đã làm xong.

| Module | Số FR | Điểm trước | **Điểm hiện tại** | Phần còn thiếu (đều cần AI hoặc mobile) |
| --- | ---: | ---: | ---: | --- |
| M0. Xác thực, đăng ký & tài khoản | 15 | 6,5 / 7 | **13,5 (90%)** | Đồng ý lại khi đổi phiên bản (FR-M0-10); TOTP, xác nhận email cơ quan, captcha, thư kết quả duyệt (FR-M0-15) |
| M1. Market overview | 7 | 3,5 | **4 (57%)** | Lọc/sắp xếp theo dự báo, tỷ lệ nhãn, "tín hiệu đổi hôm nay" |
| M2. Forecast card & chi tiết mã | 9 | 3 | **3 (33%)** | Toàn bộ phần dự báo |
| M3. Explainability | 4 | 0 | **0** | Toàn bộ |
| M4. Tin tức & sentiment | 6 | 1,5 | **1,5 (25%)** | Chấm sentiment, biểu đồ cảm xúc, attention, cut-off |
| M5. Watchlist & cảnh báo | 8 | 3,5 | **5,5 (69%)** | Cảnh báo đổi nhãn / ngưỡng xác suất |
| M6. Lịch sử dự báo / đánh giá | 7 | 0 | **0** | Toàn bộ |
| M7. Admin / model ops | 11 | 4,5 | **5,5 (50%)** | Phiên bản mô hình, audit/inputs/replay dự báo |
| M8. Screener | 7 | 3 | **4,5 (64%)** | Điều kiện theo nhãn/xác suất/hit rate |
| M9. Portfolio | 6 | 3 | **5 (83%)** | Tín hiệu T+2/T+5 cạnh vị thế |
| M10. Trade Plan | 9 | 4,5 | **8 (89%)** | Snapshot dự báo, cảnh báo nhãn ngược |
| M11. Journal | 7 | 3,5 | **4,5 (64%)** | So sánh quyết định với dự báo |
| M12. Chat | 8 | 1 | **1 (13%)** | Mô hình ngôn ngữ và pipeline an toàn |
| M13. Báo cáo PDF | 6 | 3,5 | **4,5 (75%)** | Dự báo, giải thích, hit rate trong PDF |
| M14. App mobile | 5 | 0 | **0** | Toàn bộ (giai đoạn 3) |
| **Tổng** | **115** | **41 / 107** | **60,5 (≈ 53%)** | |

## 2. Những gì đã làm trong đợt 26/10/2026

Migration mới: `db/migrations/020_non_ai_completion.sql`.

- **M0:** chính sách mật khẩu đúng PRD (8–64 ký tự, chữ + số + ký tự đặc biệt), dùng chung web/API qua `@stocksense/core/password`. Giới hạn tần suất tính theo người dùng đã đăng nhập (300 request/phút), không còn chung một giới hạn cho cả IP. Giao diện không đẩy người dùng về màn hình đăng nhập khi gặp lỗi 429. Analyst đã vào được trang Tài khoản (tự xóa tài khoản, xem lịch sử đồng ý).
- **M1:** thêm cột ngành và GTGD trung bình 20 phiên, lọc theo ngành và thanh khoản, sắp xếp theo mã/giá/% thay đổi/thanh khoản, nút ☆ thêm/bỏ watchlist ngay trên bảng.
- **M2 / M4:** biểu đồ 1/3/6 tháng có khối lượng, chỉ dùng giá SSI khi đã có (không trộn với dữ liệu mẫu), lọc tin theo khoảng ngày. Trang chi tiết có nút watchlist và nút "Lập kế hoạch giao dịch".
- **M5:**
  - chuông thông báo có số chưa đọc, trang `/alerts`, nút "đánh dấu tất cả đã đọc";
  - lịch sử cảnh báo giữ 90 ngày (worker tự dọn);
  - gửi thông báo: lần đầu + tối đa 3 lần thử lại;
  - cảnh báo theo mức giá của Trade Plan gửi qua cả app, email và Telegram.
- **M7:**
  - lọc nhật ký quản trị theo khoảng ngày, người thực hiện, đối tượng và loại sự kiện;
  - thao tác chạy job của Admin được ghi vào audit;
  - worker ở chế độ watch tự xếp hàng pipeline sau 15:30 các ngày T2–T6;
  - job lỗi được thử lại tối đa 3 lần rồi báo cho mọi Admin (cảnh báo trong app, kèm email/Telegram nếu đã liên kết).
- **M8:** lọc theo ngành, sắp xếp, 4 bộ lọc có sẵn, tuyên bố "không phải xếp hạng mã nên mua". Từ kết quả có thể thêm vào watchlist hoặc lập Trade Plan.
- **M9:**
  - sửa giao dịch;
  - import CSV bỏ qua dòng lỗi/trùng/bán vượt và báo lý do theo số dòng;
  - tỷ trọng từng vị thế, phân bổ theo mã và theo ngành, biểu đồ giá trị danh mục 180 ngày;
  - xóa toàn bộ danh mục (phải gõ cụm xác nhận).
- **M10:**
  - trạng thái Nháp → Chờ vào → Đang mở → Đã đóng/Đã hủy/Hết hạn;
  - vùng giá vào (từ–đến), ngày hết hạn (tự chuyển "Hết hạn" kèm cảnh báo);
  - lý do đóng (chạm mục tiêu/chạm cắt lỗ/hết hạn/thủ công);
  - sửa kế hoạch có lưu lịch sử chỉnh sửa;
  - khoảng cách % tới cắt lỗ/mục tiêu, khối lượng tối đa làm tròn lô 100;
  - lập kế hoạch từ trang chi tiết mã hoặc Screener;
  - cảnh báo khi giá chạm vùng vào, cắt lỗ hoặc mục tiêu.
- **M11:** lọc/tìm kiếm theo mã, khoảng ngày, thẻ, kết quả, từ khóa. Thống kê theo tuần/tháng/quý gồm số kế hoạch, tỷ lệ chạm mục tiêu/cắt lỗ, R:R kế hoạch, R thực tế và lãi/lỗ. Nhật ký thủ công có ngày quyết định. Journal lưu cả kế hoạch gốc và lịch sử sửa.
- **M13:**
  - mọi PDF in ngày dữ liệu và phiên bản mô hình;
  - PDF danh mục có tỷ trọng và phân bổ ngành;
  - PDF Trade Plan có vùng giá, % khoảng cách, R:R, kết quả và lịch sử sửa;
  - PDF Journal xuất theo kỳ (từ ngày – đến ngày).
- **Sửa lỗi vận hành:**
  - API và web không khởi động sau khi đổi tên thư mục: chạy lại `npm install`;
  - PDF lỗi 503 do đường dẫn font tương đối.

## 3. Kiểm thử ngày 26/10/2026

Chạy thật trên PostgreSQL, API và web qua proxy Vite, không dùng mock:

- Unit test: **37/37 pass**, thêm test cho chính sách mật khẩu, làm tròn lô 100 và khoảng cách %. `npm run build:web` thành công.
- Kịch bản API (cookie phiên thật, 4 vai trò, vòng đời tài khoản đầy đủ): **107/107 bước pass**.
- Giao diện trên Chrome: 4 vai trò mở toàn bộ 19 route, không có lỗi JavaScript và lỗi 5xx. Ngoài ra có **24/24 kịch bản tương tác pass**, gồm:
  - lọc ngành, sắp xếp, ☆ watchlist ở Tổng quan;
  - biểu đồ khối lượng và đổi khoảng thời gian;
  - lọc tin theo ngày;
  - nút lập kế hoạch tự điền mã;
  - Nháp → sửa → Chờ vào → Đang mở → đóng "Chạm mục tiêu";
  - thống kê theo tuần, lọc nhật ký, PDF theo kỳ;
  - import CSV bỏ 3 dòng lỗi, sửa giao dịch;
  - bộ lọc có sẵn ở Screener;
  - lọc audit;
  - trang job hiển thị nguồn kích hoạt.
- Worker:
  - lịch tự động đã xếp hàng và chạy thành công đồng bộ giá SSI và tin tức;
  - cảnh báo chạm cắt lỗ của Trade Plan được tạo đúng và không bị trùng;
  - plan quá hạn tự chuyển "Hết hạn";
  - job lỗi được thử lại 3 lần rồi gửi cảnh báo cho Admin.

**Cấu hình còn thiếu (không phải lỗi code):** `.env` chưa có SMTP/Telegram thật, nên job gửi thông báo kết thúc ở trạng thái `partial` ("chờ nhà cung cấp"), và quên mật khẩu/xác thực email chưa gửi được mail thật.

## 4. Chấm điểm chi tiết từng FR

Ký hiệu: ✅ Đạt · 🟡 Một phần · ❌ Chưa làm. Cột "Ghi chú" ghi rõ phần còn thiếu.

### M0. Xác thực, đăng ký và tài khoản — 13,5/15
| FR | Mức | Ghi chú |
| --- | --- | --- |
| M0-01 → M0-05, M0-07 | ✅ | Đăng nhập, phiên 24h, khóa 15 phút sau 5 lần sai, đổi mật khẩu, mật khẩu tạm do Admin cấp |
| M0-06 Chính sách mật khẩu 8–64 ký tự | ✅ | Sửa từ 12–128 về đúng PRD |
| M0-08 Tự đăng ký retail | ✅ | 3 ô đồng ý, thông điệp chung, thư "Bạn đã có tài khoản", bỏ qua trường role, 5 lần/giờ theo IP và email (migration 018) |
| M0-09 Xác thực email | ✅ | Liên kết 24h dùng một lần, gửi lại 5/ngày cách 60 giây, xóa tài khoản chưa xác thực sau 7 ngày; gửi bằng Gmail SMTP thật |
| M0-10 Ghi nhận đồng ý | 🟡 | Lưu và xem lịch sử đồng ý; chưa yêu cầu đồng ý lại khi đổi phiên bản, chưa ghi đồng ý Điều khoản Analyst |
| M0-11 Nâng/hạ cấp Trader, yêu cầu Analyst | ✅ | Thu hồi phiên, audit, 1 yêu cầu chờ, chặn 7 ngày sau từ chối (migration 019) |
| M0-12 Admin duyệt yêu cầu | ✅ | Bắt buộc lý do khi từ chối, chặn tự duyệt |
| M0-13 Tự xóa tài khoản | ✅ | Nhập lại mật khẩu, Admin bị chặn |
| M0-14 Bootstrap Admin | ✅ | `npm run db:bootstrap-admin`, chặn khi đã có Admin, giữ ít nhất 1 Admin |
| M0-15 Tăng cường bảo vệ (Should) | ❌ | TOTP, nhập lại mật khẩu khi tạo Admin, xác nhận email cơ quan, captcha, thư kết quả duyệt |

### M1. Market overview — 4/7
| FR | Mức | Ghi chú |
| --- | --- | --- |
| M1-01 Danh sách mã có ngành, GTGD 20 phiên | ✅ | |
| M1-02 Lọc sàn, ngành, thanh khoản, xu hướng, kỳ hạn | 🟡 | Thiếu lọc theo xu hướng dự báo (cần AI) |
| M1-03 Tín hiệu T+2/T+5 | 🟡 | Dữ liệu dự báo mẫu |
| M1-04 Sắp xếp + tìm kiếm | 🟡 | Đã sắp xếp theo thanh khoản, %, giá; thiếu sắp xếp theo xác suất (cần AI) |
| M1-05 Ngày dữ liệu, giờ cập nhật | ✅ | |
| M1-06 Dải chỉ số, độ rộng, tỷ lệ theo nhãn | 🟡 | Tỷ lệ theo nhãn cần AI |
| M1-07 Tín hiệu đổi hôm nay | ❌ | Cần AI |

### M2. Forecast card & chi tiết mã — 3/9
| FR | Mức | Ghi chú |
| --- | --- | --- |
| M2-01, M2-02 | 🟡 | Dữ liệu dự báo mẫu |
| M2-03, M2-05, M2-08, M2-09 | ❌ | Phụ thuộc dự báo thật (ngày đáo hạn, T+5, tin cậy, rủi ro sai) |
| M2-04 Tuyên bố tham khảo | ✅ | |
| M2-06 Biểu đồ 6 tháng có khối lượng | 🟡 | Đã có giá + khối lượng; đánh dấu "tin mạnh" cần sentiment |
| M2-07 Trạng thái dữ liệu, độ tin cậy | 🟡 | Độ tin cậy cần AI |

### M3. Explainability — 0/4
M3-01 → M3-04: ❌, cần mô hình và SHAP/attention.

### M4. Tin tức & sentiment — 1,5/6
| FR | Mức | Ghi chú |
| --- | --- | --- |
| M4-01 Thu thập, gắn mã, loại trùng | ✅ | |
| M4-02, M4-04, M4-05, M4-06 | ❌ | Cần mô hình sentiment / pipeline dự báo |
| M4-03 Danh sách, lọc, mở tab mới | 🟡 | Đã lọc theo ngày; nhãn/lọc sắc thái cần AI |

### M5. Watchlist & cảnh báo — 5,5/8
| FR | Mức | Ghi chú |
| --- | --- | --- |
| M5-01 Thêm/xóa từ overview/chi tiết, tối đa 10 | ✅ | |
| M5-02, M5-03 Cảnh báo đổi nhãn / ngưỡng xác suất | ❌ | Cần AI (đang có cảnh báo giá và cảnh báo Trade Plan) |
| M5-04 Lịch sử 90 ngày | ✅ | |
| M5-05 Chuông + danh sách | ✅ | |
| M5-06 Email/Telegram cho M5-02/03, M10-06 | 🟡 | Đã gửi cho cảnh báo giá và Trade Plan; M5-02/03 cần AI |
| M5-07 Liên kết Telegram, xác thực email | ✅ | |
| M5-08 Chống trùng, retry 3 lần, log | ✅ | |

### M6. Lịch sử dự báo / đánh giá mô hình — 0/7
M6-01 → M6-07: ❌, cần dự báo thật.

### M7. Admin / model ops — 5,5/11
| FR | Mức | Ghi chú |
| --- | --- | --- |
| M7-01, M7-02, M7-05 | ✅ | Quản lý user, nguồn dữ liệu/job, log hành động Admin (cả chạy job) |
| M7-03, M7-04, M7-06, M7-09, M7-10 | ❌ | Cần mô hình (phiên bản, audit/inputs/replay dự báo) |
| M7-07 Pipeline tự chạy sau 15:30 | 🟡 | Đã tự chạy giá, tin, cảnh báo; bước sentiment/đặc trưng/dự báo cần AI |
| M7-08 Báo Admin khi lỗi sau 3 lần | ✅ | |
| M7-11 Nhật ký có lọc + phân trang | ✅ | |

### M8. Screener — 4,5/7
| FR | Mức | Ghi chú |
| --- | --- | --- |
| M8-01 Lọc kỳ hạn/nhãn/xác suất/sàn/ngành/thanh khoản | 🟡 | Đã có sàn, ngành, thanh khoản, giá, %; điều kiện dự báo cần AI |
| M8-02 Kết quả kèm nhãn, xác suất, tin cậy; sắp xếp | 🟡 | Đã sắp xếp, có ngày dữ liệu; nhãn/xác suất cần AI |
| M8-03 Bộ lọc có sẵn cho retail | 🟡 | Có 4 bộ lọc giá/thanh khoản; bộ lọc theo tín hiệu cần AI |
| M8-04 Lưu bộ lọc có tên | ✅ | |
| M8-05 Điều kiện nâng cao | ❌ | Đổi nhãn, hit rate cần AI |
| M8-06 Watchlist / chi tiết / Trade Plan từ kết quả | ✅ | |
| M8-07 Không xếp hạng, có tuyên bố | ✅ | |

### M9. Portfolio — 5/6
| FR | Mức | Ghi chú |
| --- | --- | --- |
| M9-01 Nhập, sửa, xóa | ✅ | |
| M9-02 CSV xem trước, bỏ dòng lỗi, loại trùng | ✅ | |
| M9-03 Vị thế, giá vốn, lãi/lỗ, tỷ trọng | ✅ | |
| M9-04 Tín hiệu cạnh vị thế | ❌ | Cần AI |
| M9-05 Tổng quan, phân bổ mã/ngành, giá trị theo thời gian | ✅ | |
| M9-06 Riêng tư, xóa toàn bộ | ✅ | |

### M10. Trade Plan — 8/9
| FR | Mức | Ghi chú |
| --- | --- | --- |
| M10-01 Tạo từ chi tiết mã / trang Trade Plan, vùng giá, lý do | ✅ | |
| M10-02 Snapshot dự báo | 🟡 | Đang lưu snapshot giá; phần dự báo cần AI |
| M10-03 R:R + khoảng cách % | ✅ | |
| M10-04 Khối lượng theo lô 100 | ✅ | |
| M10-05 Nháp/Chờ vào/Đang mở/Đã đóng (lý do) | ✅ | |
| M10-06 Cảnh báo chạm vùng vào/cắt lỗ/mục tiêu, nhãn ngược | 🟡 | Phần giá đã xong; "nhãn ngược" cần AI |
| M10-07 Đóng → Journal | ✅ | |
| M10-08 Tuyên bố trên trang và PDF | ✅ | |
| M10-09 Sửa + lịch sử chỉnh sửa | ✅ | |

### M11. Journal — 4,5/7
| FR | Mức | Ghi chú |
| --- | --- | --- |
| M11-01 Tự tạo khi đóng plan | 🟡 | Có kế hoạch gốc, kết quả, R thực tế; snapshot dự báo cần AI |
| M11-02, M11-05, M11-07 | ✅ | Ghi chú/thẻ/bài học, lọc & tìm kiếm, riêng tư |
| M11-03 So sánh với dự báo | ❌ | Cần AI |
| M11-04 Nhật ký thủ công | 🟡 | Có ngày quyết định; gắn dự báo ngày đó cần AI |
| M11-06 Thống kê tuần/tháng/quý | 🟡 | Đủ các chỉ số trừ "tỷ lệ làm theo tín hiệu" (cần AI) |

### M12. Chat — 1/8
M12-06 (tuyên bố) ✅. Các FR còn lại ❌, cần mô hình ngôn ngữ và pipeline an toàn.

### M13. Báo cáo PDF — 4,5/6
| FR | Mức | Ghi chú |
| --- | --- | --- |
| M13-01 PDF mã | 🟡 | Dự báo, giải thích, hit rate cần AI |
| M13-02 PDF danh mục | 🟡 | Đã có tỷ trọng/phân bổ; tín hiệu cần AI |
| M13-03 PDF Trade Plan | 🟡 | Snapshot dự báo cần AI |
| M13-04 PDF Journal theo kỳ | ✅ | |
| M13-05 Tuyên bố, thời điểm, ngày dữ liệu, phiên bản mô hình, số trang | ✅ | |
| M13-06 Cùng nguồn, chỉ dữ liệu của mình | ✅ | |

### M14. App mobile — 0/5
❌, thuộc giai đoạn 3.

## 5. Ưu tiên tiếp theo

1. **Pipeline dự báo tối thiểu** (baseline Logistic Regression/XGBoost) ghi vào bảng `forecasts` và chạy trong lịch 15:30 đã có. Riêng bước này mở khóa khoảng 25 FR đang ở mức "một phần" hoặc "chưa làm" (M1, M2, M5-02/03, M8, M9-04, M10-02/06, M11, M13). Hạ tầng hiển thị, cảnh báo và PDF đã sẵn sàng nhận dự báo thật.
2. **M6** lịch sử dự báo và hit rate (cần bước 1).
3. **M3** giải thích tối thiểu: tỷ trọng 3 nhóm + 3 câu mẫu.
4. **Sentiment thật** cho M4.
5. **M12 Chat**: cần chọn mô hình ngôn ngữ trước.
6. **Cấu hình vận hành:** SMTP/Telegram thật trong `.env`, chạy `npm run worker:admin-jobs:watch` thường trực để pipeline 15:30 tự chạy.
