# Kịch bản video demo 10 phút — StockSense VN

**Ký hiệu:** 🎙 lời thoại (đọc tự nhiên, không cần đúng từng chữ) · 🖱 thao tác · ⏱ mốc thời gian.

**Mạch câu chuyện:** dùng **một tài khoản mới đăng ký ngay khi quay** đi xuyên suốt video. Tài khoản bắt đầu là Nhà đầu tư cá nhân, tự nâng lên Nhà giao dịch, rồi được Admin duyệt lên Chuyên viên phân tích. Người xem thấy trọn vòng đời đăng ký và phân quyền, và dữ liệu demo sạch vì là tài khoản mới.

---

## CHUẨN BỊ TRƯỚC KHI QUAY

**1. Khởi động hệ thống** (4 terminal):

```sh
docker compose up -d db
npm run dev:api                    # để cửa sổ này hiện được: cần lấy link xác thực email
npm run dev:web
npm run worker:admin-jobs:watch
```

Chạy thêm một lần trước khi quay: `npm run worker:market:sync` và `npm run worker:news:sync` để có giá và tin mới nhất.

**2. Email đăng ký:** mỗi lần quay dùng một email chưa đăng ký, ví dụ `demo.hoidong1@gmail.com`, `demo.hoidong2@gmail.com`… Mật khẩu: `Demo@2026`.

**3. File CSV** `giao_dich_demo.csv` để ở Desktop:

```
symbol,side,quantity,unit_price,executed_at,fee,note
FPT,buy,500,104200,2026-09-15,78150,
HPG,buy,3000,25800,2026-09-18,116100,
VCB,buy,200,56000,2026-10-01,16800,
HPG,buy,3000,25800,2026-09-18,116100,
ABC,buy,100,12000,2026-10-02,0,
```

**4. Trình duyệt:** cửa sổ ẩn danh, zoom 100%, mở sẵn `http://localhost:5173`. Đặt cửa sổ trình duyệt và terminal `dev:api` cạnh nhau, hoặc chuẩn bị sẵn phím Alt+Tab, để lấy link xác thực cho nhanh.

**5. Slide:** chuẩn bị sẵn 2 slide: sơ đồ kiến trúc và bảng kết quả (xem nội dung ở Phần 1 và Phần 8).

---

## ⏱ 0:00 – 1:00 · Phần 1 — Giới thiệu, kiến trúc, công nghệ

🎙 *"Xin chào thầy cô. Nhóm em trình bày **StockSense VN**: hệ thống hỗ trợ ra quyết định đầu tư cổ phiếu trên HOSE, HNX và UPCOM. Hệ thống gom vào một nơi các việc: theo dõi thị trường, quản lý danh mục, lập kế hoạch giao dịch, ghi nhật ký và nhận cảnh báo."*

🖱 Chiếu slide kiến trúc:

```
React (trình duyệt) → API Fastify (kiểm tra quyền RBAC) → PostgreSQL ← Worker
                                                          (giá SSI, tin tức, cảnh báo,
                                                           gửi Email/Telegram, lịch 15:30)
```

🎙 *"Giao diện viết bằng React 19 và Vite, API viết bằng Node.js 22 và Fastify, dữ liệu lưu trong PostgreSQL 17. Một worker riêng lấy giá từ SSI, tin từ CafeF và VnExpress, tạo cảnh báo, và tự chạy sau 15:30 mỗi ngày giao dịch. Quy tắc phân quyền và công thức tính toán viết một lần, dùng chung cho giao diện và API."*

---

## ⏱ 1:00 – 2:45 · Phần 2 — Đăng ký, xác thực email, nâng cấp vai trò

🖱 Thao tác:
1. Màn hình đăng nhập → **Chưa có tài khoản? Đăng ký**.
2. Nhập email mới, họ tên, mật khẩu `12345678` → tích 3 ô xác nhận → **Đăng ký**. Form báo lỗi chính sách mật khẩu.
3. Đổi mật khẩu thành `Demo@2026` (nhập cả ô xác nhận) → **Đăng ký** → thông báo đã gửi email xác thực.
4. Thử đăng nhập ngay bằng tài khoản này → bị từ chối "Vui lòng xác thực email".
5. Chuyển sang terminal `dev:api` → copy link `verify_url` → dán vào trình duyệt → **Xác thực thành công** → đăng nhập.
6. Chỉ góc dưới sidebar: vai trò **Nhà đầu tư cá nhân**. Mở nhanh **Trade Plan**: ô Khối lượng tối đa ghi "Dành cho Trader, Analyst".
7. **Cài đặt → Tài khoản & vai trò** → chọn kinh nghiệm, mục đích, tích xác nhận trách nhiệm → **Nâng cấp lên Trader** → hệ thống tự đăng xuất → đăng nhập lại → sidebar hiện **Nhà giao dịch**.

🎙 *"Người dùng tự đăng ký. Mật khẩu phải dài 8 đến 64 ký tự, có chữ, số và ký tự đặc biệt, được kiểm tra ở cả giao diện lẫn máy chủ. Đăng ký xong phải xác thực email mới đăng nhập được; máy phát triển chưa cấu hình SMTP nên liên kết được in ra log, khi triển khai thật liên kết sẽ gửi tới hộp thư. Tài khoản mới là Nhà đầu tư cá nhân với quyền cơ bản. Người dùng tự nâng lên Nhà giao dịch sau khi khai kinh nghiệm và xác nhận trách nhiệm. Khi vai trò thay đổi, mọi phiên cũ bị thu hồi để quyền mới có hiệu lực ngay."*

---

## ⏱ 2:45 – 3:30 · Phần 3 — Tổng quan và chi tiết mã

🖱 Thao tác:
1. **Tổng quan**: chỉ thanh trên cùng (ngày dữ liệu, ô tìm mã, chuông) → bấm **HOSE** → chọn ngành **Ngân hàng** → bấm ☆ một mã để thêm vào watchlist.
2. Gõ `fpt` vào ô tìm → Enter → chỉ hai thẻ **T+2 / T+5** có ngày đáo hạn, biểu đồ giá và khối lượng → bấm **Xuất PDF**.

🎙 *"Trang tổng quan lọc được theo sàn, ngành, thanh khoản. Screener có thêm bộ lọc chi tiết và lưu được bộ lọc riêng. Giá lấy thật từ SSI; nhãn dự báo hiện là dữ liệu mẫu và được ghi rõ trên màn hình. Báo cáo PDF hỗ trợ tiếng Việt. Watchlist có quy tắc cảnh báo giá: khi giá chạm ngưỡng hoặc chạm mức của Trade Plan, chuông báo trong ứng dụng, kèm email hoặc Telegram nếu đã bật."*

---

## ⏱ 3:30 – 4:30 · Phần 4 — Portfolio (quyền Trader)

🖱 Thao tác:
1. **Portfolio** → **Import CSV** (nút chỉ có từ vai trò Trader) → chọn `giao_dich_demo.csv` → **Xác nhận ghi**.
2. Dừng 2 giây ở kết quả: **ghi 3 dòng, bỏ 2 dòng** (dòng trùng, mã ABC không tồn tại) → Đóng.
3. Chỉ: 4 ô thống kê, tỷ trọng từng vị thế, **phân bổ theo ngành**, biểu đồ giá trị danh mục.

🎙 *"Danh mục tính theo giá vốn bình quân. Import CSV kiểm tra từng dòng: dòng hợp lệ được ghi, dòng lỗi hoặc trùng bị bỏ qua và báo lý do. Danh mục chỉ chủ tài khoản xem được."*

---

## ⏱ 4:30 – 6:15 · Phần 5 — Trade Plan và Journal ⭐ trọng tâm

🖱 Thao tác:
1. Vào chi tiết **FPT** → **Lập Trade Plan** (mã được điền sẵn).
2. Nhập vùng vào **56.000–57.000**, cắt lỗ **53.000**, mục tiêu **65.000**, Vốn **100.000.000**, Rủi ro **1%**. Chỉ ô tính toán: **R:R, khoảng cách %, khối lượng tối đa làm tròn lô 100**. Ô này có được là nhờ vừa nâng lên Trader.
3. **Lưu nháp** → sửa mục tiêu thành **66.000** → **Lưu** → chỉ dòng lịch sử chỉnh sửa.
4. **Chuyển sang Chờ vào** → **Đã vào lệnh** (thẻ chạy qua các cột kanban).
5. **Đóng kế hoạch** → lý do **Chạm mục tiêu** → **Đóng và ghi Journal**.
6. **Journal**: bản ghi vừa tạo có kế hoạch gốc, kết quả theo R → nhập Bài học → **Lưu** → bấm **Tuần / Tháng** ở khung thống kê.

🎙 *"Kế hoạch đi theo đúng quy trình Nháp, Chờ vào, Đang mở, Đã đóng. Người dùng tự nhập mọi mức giá; hệ thống chỉ tính R:R và khối lượng theo mức rủi ro. Mỗi lần sửa đều lưu lịch sử. Khi đóng, nhật ký được ghi trong cùng một giao dịch cơ sở dữ liệu. Phần kết quả trong Journal không sửa được, người dùng chỉ ghi thêm bài học rồi xem lại thống kê theo kỳ."*

---

## ⏱ 6:15 – 6:45 · Phần 6 — Gửi yêu cầu quyền Analyst

🖱 Thao tác:
1. **Cài đặt → Tài khoản & vai trò → Yêu cầu quyền Analyst**: nhập tổ chức, chức danh, email cơ quan, mục đích → **Gửi**.
2. Chỉ trạng thái **Đang chờ Admin duyệt**, và mục **Đồng ý đã lưu** (lịch sử đồng ý điều khoản lúc đăng ký và lúc nâng cấp).
3. **Đăng xuất**.

🎙 *"Quyền Chuyên viên phân tích không tự nâng được mà phải chờ Admin duyệt. Mỗi người chỉ có một yêu cầu đang chờ; bị từ chối thì phải chờ 7 ngày mới gửi lại. Hệ thống lưu lại mọi lần người dùng đồng ý điều khoản."*

---

## ⏱ 6:45 – 8:30 · Phần 7 — Quản trị

🖱 Thao tác:
1. Đăng nhập `admin@stocksense.vn` / `admin12345678` → tự vào trang **Quản trị**. Chỉ sidebar: Admin không có Tổng quan, Danh mục hay Journal.
2. Tab **Yêu cầu nâng quyền** → thấy yêu cầu vừa gửi → **Duyệt**.
3. Tab **Người dùng & audit**: tài khoản mới nằm trong danh sách với vai trò **Chuyên viên phân tích** → lọc audit theo ngày hôm nay → thấy chuỗi sự kiện: xác thực email, tự nâng cấp Trader, duyệt quyền Analyst.
4. Tab **Nguồn dữ liệu & job** → bấm **Chạy lại** "Sync SSI market data" → trạng thái chạy qua Đang chờ → Đang chạy. Chỉ worker ONLINE.
5. Gõ thẳng địa chỉ `/portfolio` → trang **403**.

🎙 *"Admin duyệt yêu cầu, quản lý vai trò, khóa tài khoản hoặc thu hồi phiên. Mọi bước trong vòng đời tài khoản đều có trong nhật ký audit. Admin chỉ xếp hàng job; worker xử lý, thử lại tối đa 3 lần, vẫn lỗi thì báo cho Admin. Admin không đọc được danh mục hay nhật ký của người dùng; quyền này được chặn ở API chứ không chỉ ẩn trên giao diện."*

---

## ⏱ 8:30 – 9:00 · Phần 8 — Kết quả nâng quyền và mobile

🖱 Thao tác:
1. Đăng xuất → đăng nhập lại tài khoản demo → sidebar hiện **Chuyên viên phân tích** → mở chi tiết một mã → có thêm nút **CSV giá**.
2. F12 → chế độ thiết bị (iPhone) → điều hướng chuyển thành thanh tab dưới đáy.

🎙 *"Sau khi được duyệt, người dùng có thêm quyền xuất dữ liệu lịch sử. Giao diện cũng dùng được trên điện thoại."*

---

## ⏱ 9:00 – 10:00 · Phần 9 — Kết quả và hướng phát triển

🖱 Chiếu slide:

| Chỉ số | Kết quả |
|---|---|
| Yêu cầu chức năng PRD đạt | 54/107 điểm ≈ **50%** |
| Chức năng không phụ thuộc AI | **Hoàn thành** (trừ app mobile) |
| Unit test / API end-to-end | 37/37 · 107/107 pass |
| Kiểm thử giao diện | 4 vai trò, 19 trang, 25 kịch bản thao tác pass |

🎙 *"Toàn bộ chức năng không phụ thuộc AI đã hoàn thiện và chạy thật với dữ liệu SSI, từ đăng ký, phân quyền đến quản trị. Phần còn thiếu là lõi AI: dự báo đang là dữ liệu mẫu, chưa có giải thích, chưa chấm sentiment tin tức, và Chat chưa trả lời. Hạ tầng hiển thị, cảnh báo, báo cáo và lịch chạy đã sẵn sàng để nhận dự báo thật. Bước tiếp theo là mô hình baseline XGBoost, giải thích bằng SHAP, sentiment bằng PhoBERT và ứng dụng mobile. Em xin cảm ơn thầy cô đã theo dõi."*

---

## Mẹo nhỏ

- Quay từng phần thành clip riêng rồi ghép lại. Mỗi lần quay lại Phần 2 thì dùng một email mới.
- Nếu bị quá giờ, có thể cắt theo thứ tự: bước 3 Phần 5 (sửa mục tiêu) → bước 2 Phần 8 (mobile) → bước 4 Phần 7 (chạy job).
- Không thấy link xác thực: xem đúng terminal `dev:api`, tìm chữ `verify_url`.
- Hệ thống báo "thao tác quá nhiều lần" khi đăng ký: giới hạn 5 lần đăng ký mỗi phút, chờ 1 phút.
- Job đứng mãi ở "Đang chờ": kiểm tra terminal `worker:admin-jobs:watch` còn chạy không.
- Bị khóa do nhập sai mật khẩu tài khoản demo: chạy `npm run db:seed:demo` để mở khóa.
- Tài khoản demo đăng ký trong các lần quay thử sẽ còn trong hệ thống. Nhờ tôi dọn trước lần quay chính thức.
