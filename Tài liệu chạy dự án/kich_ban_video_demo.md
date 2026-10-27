# Kịch bản video demo 10 phút — StockSense VN

**Cách đọc:**
- 🎙 **Lời thoại:** đọc tự nhiên, không cần đúng từng chữ.
- 🖱 **Thao tác:** làm theo thứ tự.
- 👁 **Màn hình hiện:** kết quả sẽ thấy (đã chạy thử ngày 27/10/2026), để biết mình đang đi đúng.
- ⏱ **Mốc thời gian:** cộng dồn, tổng 10 phút.

**Mạch câu chuyện:** một tài khoản mới đăng ký ngay khi quay và đi xuyên suốt video. Tài khoản bắt đầu là **Nhà đầu tư cá nhân**, tự nâng lên **Nhà giao dịch**, rồi được Admin duyệt lên **Chuyên viên phân tích**. Người xem thấy trọn vòng đời tài khoản và phân quyền, và dữ liệu hiện trên màn hình luôn sạch.

---

## PHẦN CHUẨN BỊ (làm trước khi bấm quay)

### 1. Khởi động hệ thống (4 cửa sổ terminal, đều mở ở thư mục gốc dự án)

| # | Lệnh | Ghi chú |
|---|---|---|
| 1 | `docker compose up -d db` | Cơ sở dữ liệu PostgreSQL |
| 2 | `npm run dev:api` | API, cổng 3000. Nếu vừa sửa `.env` thì phải tắt và chạy lại lệnh này |
| 3 | `npm run dev:web` | Giao diện, cổng 5173 |
| 4 | `npm run worker:admin-jobs:watch` | **Bắt buộc**, để nút "Chạy lại" ở Phần 7 hoạt động |

Chạy thêm một lần trước khi quay để giá và tin là mới nhất:

```sh
npm run worker:market:sync
npm run worker:news:sync
```

### 2. Kiểm tra nhanh 30 giây
- Mở `http://localhost:5173`, đăng nhập `admin@stocksense.vn` / `admin12345678` → **Quản trị → Nguồn dữ liệu & job**: có worker **ONLINE**. Đăng xuất.
- Gmail của bạn mở được bình thường.

### 3. Tài khoản dùng khi quay

| Tài khoản | Mật khẩu | Dùng ở |
|---|---|---|
| **Tài khoản mới:** `tengmail+demo1@gmail.com` (thay `tengmail` bằng Gmail đã cấu hình SMTP) | `Demo@2026` | Phần 2 → 6 và Phần 8 |
| `admin@stocksense.vn` | `admin12345678` | Phần 7 |

- Địa chỉ `+demo1`: thư vẫn về hộp Gmail của bạn, nhưng hệ thống coi đây là một tài khoản mới.
- **Mỗi lần quay lại Phần 2 thì tăng số** (`+demo2`, `+demo3`…).
- **Hệ thống chỉ cho đăng ký tối đa 5 lần mỗi giờ trên một máy.** Từ lần thứ 6, form vẫn báo đã gửi nhưng không có thư.

### 4. File CSV mẫu
Lưu thành file `giao_dich_demo.csv` ở Desktop, mã hóa UTF-8:

```
symbol,side,quantity,unit_price,executed_at,fee,note
FPT,buy,500,55000,2026-10-01,41250,Mua đợt 1
HPG,buy,3000,20500,2026-10-02,92250,
VCB,buy,200,55500,2026-10-05,16650,
HPG,buy,3000,20500,2026-10-02,92250,
ABC,buy,100,12000,2026-10-06,0,
```

Dòng 5 cố ý trùng dòng 3, dòng 6 là mã không tồn tại. Hai dòng này để minh họa việc hệ thống tự bỏ qua dòng lỗi.

### 5. Trình duyệt
- Dùng **cửa sổ ẩn danh** (Ctrl+Shift+N), zoom 100%, ẩn thanh bookmark.
- Tab 1: `http://localhost:5173`. Tab 2: Gmail.

### 6. Slide
Chuẩn bị 2 slide: **sơ đồ kiến trúc** (Phần 1) và **bảng kết quả** (Phần 9).

---

## ⏱ 0:00 – 1:00 · Phần 1 — Giới thiệu, kiến trúc, công nghệ

🖱 Mở đầu ở màn hình đăng nhập, sau đó chiếu slide kiến trúc:

```
 Trình duyệt (React 19 + Vite)
          │  JSON qua HTTPS, cookie phiên HttpOnly
          ▼
 API Node.js 22 + Fastify 5  ── kiểm tra quyền theo vai trò ở mọi endpoint
          │
          ▼
 PostgreSQL 17  ◄── Worker Node.js: giá SSI · tin CafeF/VnExpress · cảnh báo
                                    · gửi Email/Telegram · lịch tự chạy 15:30
```

🎙 *"Xin chào thầy cô. Nhóm em trình bày **StockSense VN**: hệ thống hỗ trợ ra quyết định đầu tư cổ phiếu trên HOSE, HNX và UPCOM. Hệ thống gom vào một nơi các việc mà nhà đầu tư cá nhân hay phải làm rời rạc: theo dõi thị trường, quản lý danh mục, lập kế hoạch giao dịch, ghi nhật ký và nhận cảnh báo.*

*Về kiến trúc: giao diện viết bằng React, API bằng Node.js và Fastify, dữ liệu lưu trong PostgreSQL. API kiểm tra quyền ở máy chủ cho từng endpoint. Một worker riêng lấy giá từ SSI, lấy tin tức, tạo cảnh báo, gửi email, và tự chạy sau 15:30 mỗi ngày giao dịch. Quy tắc phân quyền và công thức tính toán được viết một lần, dùng chung cho giao diện và API."*

---

## ⏱ 1:00 – 3:00 · Phần 2 — Đăng ký, xác thực email, nâng cấp vai trò

🖱 **Bước 1 — Đăng ký bằng mật khẩu yếu**
1. Ở màn hình đăng nhập → bấm **Chưa có tài khoản? Đăng ký**.
2. **Email:** `tengmail+demo1@gmail.com` · **Tên hiển thị:** `Nguyễn Văn Demo` · **Mật khẩu** và **Nhập lại mật khẩu:** `12345678`.
3. Tích 3 ô: *đủ 18 tuổi*, *đồng ý Điều khoản sử dụng*, *đã đọc Thông báo xử lý dữ liệu cá nhân* → bấm **Đăng ký**.

👁 Báo đỏ: **"Mật khẩu dài 8-64 ký tự, gồm chữ, số và ít nhất 1 ký tự đặc biệt."**

🖱 **Bước 2 — Đăng ký lại đúng chính sách**
4. Sửa cả 2 ô mật khẩu thành `Demo@2026` → **Đăng ký**.

👁 **"Nếu email hợp lệ, chúng tôi đã gửi email xác thực tài khoản."**

🖱 **Bước 3 — Thử đăng nhập khi chưa xác thực**
5. Bấm **Quay lại đăng nhập** → đăng nhập ngay bằng tài khoản vừa tạo.

👁 Bị chặn: **"Vui lòng xác thực email trước khi đăng nhập…"**

🖱 **Bước 4 — Xác thực email**
6. Sang tab **Gmail** → mở thư **"Xác thực tài khoản StockSense VN"** (đến sau vài giây; không thấy thì xem mục Spam) → bấm liên kết trong thư.

👁 **"Email đã được xác thực. Bạn có thể đăng nhập ngay."**

7. Bấm **Đến đăng nhập** → đăng nhập.

👁 Vào trang Tổng quan; góc dưới sidebar: **Nguyễn Văn Demo · Nhà đầu tư cá nhân**.

🖱 **Bước 5 — Xem giới hạn của vai trò Nhà đầu tư cá nhân**
8. Bấm **Trade Plan** ở sidebar.

👁 Ô cuối của khung tính toán ghi **"Khối lượng tối đa: Dành cho Trader, Analyst"**.

🖱 **Bước 6 — Tự nâng cấp lên Nhà giao dịch**
9. **Cài đặt** → tab **Tài khoản & vai trò** → ở thẻ **Nâng cấp lên Trader**: chọn *Kinh nghiệm giao dịch*, *Mục đích sử dụng*, tích ô xác nhận trách nhiệm → bấm **Nâng cấp lên Trader**.

👁 **"Đã nâng cấp lên Trader. Bạn sẽ cần đăng nhập lại để tiếp tục."** Sau khoảng 2 giây, màn hình đăng nhập tự hiện.

10. Đăng nhập lại.

👁 Sidebar: **Nhà giao dịch**.

🎙 *"Người dùng tự đăng ký. Mật khẩu phải dài 8 đến 64 ký tự, có chữ, số và ký tự đặc biệt, được kiểm tra ở cả giao diện lẫn máy chủ. Hệ thống gửi email xác thực thật; liên kết chỉ dùng được một lần trong 24 giờ, và cơ sở dữ liệu chỉ lưu bản băm của mã. Chưa xác thực thì không đăng nhập được.*

*Tài khoản mới là Nhà đầu tư cá nhân với quyền cơ bản, ví dụ chưa được tính khối lượng theo vốn. Người dùng tự nâng lên Nhà giao dịch sau khi khai kinh nghiệm và xác nhận trách nhiệm. Khi vai trò thay đổi, mọi phiên đăng nhập cũ bị thu hồi để quyền mới có hiệu lực ngay."*

---

## ⏱ 3:00 – 3:45 · Phần 3 — Tổng quan và chi tiết mã

🖱 Thao tác:
1. Bấm **Tổng quan**. Chỉ chuột vào thanh trên cùng: **"Giá SSI đến … · dự báo mẫu ngày … · mô hình …"**, ô tìm mã, chuông cảnh báo.
2. Trong bảng **Danh sách mã**: bấm **HOSE** → chọn **Ngân hàng** ở ô "Mọi ngành" (👁 còn 3 mã) → bấm ☆ ở dòng đầu (👁 ngôi sao chuyển màu vàng).
3. Gõ `fpt` vào ô tìm kiếm trên cùng → **Enter**.
4. Chỉ hai thẻ dự báo **T+2** và **T+5** (có xác suất 3 lớp và ngày đáo hạn) → kéo xuống biểu đồ **Giá và khối lượng** → bấm **1 tháng** rồi **6 tháng**.
5. Kéo lên, bấm **Xuất PDF** → mở nhanh file `stocksense-FPT.pdf` rồi đóng.

🎙 *"Thanh trên cùng luôn cho biết giá đang cập nhật đến ngày nào và dự báo thuộc lô nào. Trang tổng quan lọc được theo sàn, ngành, thanh khoản, sắp xếp theo từng cột, và có nút ngôi sao để thêm nhanh vào watchlist. Giá lấy thật từ SSI; nhãn dự báo hiện là dữ liệu mẫu, và hệ thống ghi rõ điều đó trên màn hình. Báo cáo PDF hỗ trợ tiếng Việt."*

---

## ⏱ 3:45 – 4:45 · Phần 4 — Portfolio (quyền Nhà giao dịch)

🖱 Thao tác:
1. Bấm **Portfolio** → bấm **Import CSV**. Nút này chỉ có từ vai trò Nhà giao dịch.
2. **Chọn tệp** → `giao_dich_demo.csv`.

👁 Bảng xem trước 5 dòng.

3. Bấm **Xác nhận ghi 5 dòng**.

👁 **"Đã ghi 3 dòng, bỏ qua 2 dòng."** kèm lý do:
- **Dòng 5:** Trùng với giao dịch đã có.
- **Dòng 6:** Mã ABC không có trong hệ thống.

4. Dừng 2 giây cho người xem đọc → **Đóng**.
5. Chỉ lần lượt: 4 ô thống kê → biểu đồ **Giá trị danh mục** → bảng **Vị thế** (cột Tỷ trọng) → **Phân bổ theo ngành / theo mã**.

🎙 *"Danh mục được tính từ sổ giao dịch theo giá vốn bình quân. Import CSV kiểm tra từng dòng: dòng hợp lệ được ghi, dòng lỗi hoặc trùng bị bỏ qua và báo rõ lý do theo số dòng. Người dùng sửa, xóa được từng giao dịch. Danh mục chỉ chủ tài khoản xem được."*

---

## ⏱ 4:45 – 6:30 · Phần 5 — Trade Plan và Journal ⭐ trọng tâm

🖱 **Bước 1 — Lập kế hoạch**
1. Gõ `fpt` vào ô tìm → **Enter** → bấm **Lập Trade Plan**.

👁 Form **Lập kế hoạch mới**, ô Mã đã điền sẵn **FPT**.

2. Nhập:

| Ô | Giá trị |
|---|---|
| Vùng vào từ | `56000` |
| đến | `57000` |
| Cắt lỗ | `53000` |
| Mục tiêu | `65000` |
| Vốn (đồng) | `100000000` |
| Rủi ro tối đa | `1` |
| Lý do | `Breakout khỏi nền giá` |

👁 Khung tính toán cập nhật ngay khi gõ:
- **Giá vào tham chiếu:** 57.000
- **R:R:** 2
- **Khoảng cách:** −7,02% / +14,04%
- **Khối lượng tối đa:** 200 cp (làm tròn lô 100)

🖱 **Bước 2 — Lưu nháp và sửa**
3. Bấm **Lưu nháp**.

👁 Thẻ FPT xuất hiện ở cột **Nháp** của kanban.

4. Sửa **Mục tiêu** thành `66000` → bấm **Lưu**.

👁 Khung **Lịch sử chỉnh sửa** có thêm dòng **"Sửa Mục tiêu 65000 → 66000"**.

🖱 **Bước 3 — Chuyển trạng thái**
5. Bấm **Chuyển sang Chờ vào**, rồi **Đã vào lệnh**.

👁 Thẻ chạy qua các cột **Chờ vào → Đang mở**.

🖱 **Bước 4 — Đóng kế hoạch**
6. Bấm **Đóng kế hoạch** → **Lý do đóng:** *Chạm mục tiêu* (👁 Giá thoát tự điền **66000**) → ghi chú `Chạm mục tiêu, chốt toàn bộ` → **Đóng và ghi Journal**.

👁 Thẻ nằm ở cột **Đã đóng** với chip **"Chạm mục tiêu"** và **+17,9%**.

🖱 **Bước 5 — Journal**
7. Bấm **Journal** ở sidebar.

👁 Khung chi tiết bên phải hiện:
- Kế hoạch gốc: vào 56.000–57.000 · CL 53.000 · MT 66.000
- Thoát 66.000 · Chạm mục tiêu
- Kết quả: **+2.000.000 đ · 3,33R**
- Chỉnh sửa trước khi đóng: 1 lần

8. Nhập **Bài học** `Giữ đúng mục tiêu khi kế hoạch đã rõ ràng` → **Lưu** → kéo xuống khung **Thống kê nhìn lại** → bấm **Tuần** rồi **Tháng**.

🎙 *"Kế hoạch đi theo đúng quy trình Nháp, Chờ vào, Đang mở, Đã đóng. Người dùng tự nhập mọi mức giá; hệ thống chỉ tính R:R, khoảng cách phần trăm và khối lượng tối đa theo mức rủi ro trên vốn, làm tròn theo lô 100 cổ phiếu. Mỗi lần sửa đều lưu lịch sử. Khi đóng, hệ thống ghi nhật ký trong cùng một giao dịch cơ sở dữ liệu, nên không thể có kế hoạch đã đóng mà thiếu nhật ký.*

*Phần kết quả trong Journal không sửa được, có trigger cơ sở dữ liệu bảo vệ. Người dùng chỉ ghi thêm bài học, thẻ, rồi xem lại thống kê theo tuần, tháng, quý."*

---

## ⏱ 6:30 – 7:00 · Phần 6 — Gửi yêu cầu quyền Chuyên viên phân tích

🖱 Thao tác:
1. **Cài đặt** → tab **Tài khoản & vai trò** → thẻ **Yêu cầu quyền Analyst**. Nhập:

| Ô | Giá trị |
|---|---|
| Tổ chức | `Trường Đại học ABC` |
| Chức danh | `Sinh viên nghiên cứu` |
| Email cơ quan | `nghiencuu@abc.edu.vn` |
| Mục đích sử dụng | `Phân tích dữ liệu cho đồ án` |

2. Tích ô đồng ý điều khoản → **Gửi yêu cầu**.

👁 **"Đã gửi yêu cầu quyền Analyst. Admin sẽ xem xét và phản hồi."** Bảng yêu cầu hiện trạng thái *Đang chờ*.

3. Kéo xuống thẻ **Đồng ý đã lưu**.

👁 3 bản ghi: 2 lúc đăng ký, 1 lúc nâng cấp Trader.

4. Bấm **Đăng xuất**.

🎙 *"Quyền Chuyên viên phân tích không tự nâng được mà phải chờ Admin duyệt. Mỗi người chỉ có một yêu cầu đang chờ; bị từ chối thì phải chờ 7 ngày mới gửi lại. Hệ thống lưu lại mọi lần người dùng đồng ý điều khoản."*

---

## ⏱ 7:00 – 8:45 · Phần 7 — Quản trị

🖱 **Bước 1 — Đăng nhập Admin**
1. Đăng nhập `admin@stocksense.vn` / `admin12345678`.

👁 Tự vào trang **Quản trị**. Sidebar chỉ có **Đánh giá mô hình (Sắp có), Quản trị, Cài đặt**, không có Tổng quan, Portfolio hay Journal.

🖱 **Bước 2 — Duyệt yêu cầu**
2. Tab **Yêu cầu nâng quyền** → dòng của `+demo1` → **Duyệt** → hộp xác nhận của trình duyệt hiện ra → bấm **OK**.

👁 **"Đã duyệt yêu cầu."**

🖱 **Bước 3 — Danh sách người dùng và audit**
3. Tab **Người dùng & audit**.

👁 Tài khoản `+demo1` có vai trò **Chuyên viên phân tích**.

4. Ở khung **Audit gần đây**: ô **Từ ngày** chọn hôm nay → **Lọc audit**.

👁 Chuỗi sự kiện của tài khoản mới: **Xác thực email đăng ký → Tự nâng cấp Trader → Duyệt quyền Analyst**.

🖱 **Bước 4 — Chạy job đồng bộ dữ liệu**
5. Tab **Nguồn dữ liệu & job**.

👁 Thẻ worker **ONLINE**.

6. Bấm **Chạy lại** ở dòng **Sync SSI market data**.

👁 Bảng lịch sử thêm dòng *Admin chạy tay · Đang chờ*. Trang tự làm mới mỗi 10 giây, nên sau khoảng **10–20 giây** trạng thái chuyển **Đang chạy → Thành công**. Trong lúc chờ thì đọc lời thoại.

🖱 **Bước 5 — Thử vào trang cá nhân**
7. Sửa thanh địa chỉ thành `localhost:5173/portfolio` → **Enter**.

👁 Trang **403: "Vai trò Quản trị viên không mở được trang này"**.

8. **Đăng xuất**.

🎙 *"Admin duyệt yêu cầu, quản lý vai trò, khóa tài khoản và thu hồi phiên. Mọi bước trong vòng đời tài khoản đều có trong nhật ký audit, lọc được theo thời gian, người thực hiện và đối tượng.*

*Admin không chạy tác vụ nặng trực tiếp mà chỉ xếp hàng job; worker xử lý, thử lại tối đa 3 lần, vẫn lỗi thì gửi cảnh báo cho Admin. Ngoài ra pipeline tự chạy sau 15:30 mỗi ngày giao dịch. Admin quản trị hệ thống nhưng không đọc được danh mục hay nhật ký của người dùng, và quyền này được chặn ở API chứ không chỉ ẩn trên giao diện."*

---

## ⏱ 8:45 – 9:15 · Phần 8 — Kết quả nâng quyền và giao diện mobile

🖱 Thao tác:
1. Đăng nhập lại `tengmail+demo1@gmail.com` / `Demo@2026`.

👁 Sidebar: **Chuyên viên phân tích**.

2. Gõ `hpg` vào ô tìm → **Enter**.

👁 Có thêm nút **CSV giá** cạnh Xuất PDF.

3. Nhấn **F12** → bật chế độ thiết bị (Ctrl+Shift+M) → chọn iPhone.

👁 Sidebar chuyển thành thanh tab ở đáy: **Tổng quan · Watchlist · Portfolio · Trade Plan · Thêm**. Bấm qua 2 tab.

🎙 *"Sau khi được duyệt, người dùng có thêm quyền xuất dữ liệu lịch sử giá. Giao diện responsive, trên điện thoại điều hướng chuyển thành thanh tab ở đáy màn hình."*

---

## ⏱ 9:15 – 10:00 · Phần 9 — Kết quả và hướng phát triển

🖱 Chiếu slide:

| Chỉ số | Kết quả |
|---|---|
| Yêu cầu chức năng PRD đạt | 54/107 điểm ≈ **50%** |
| Chức năng không phụ thuộc AI | **Hoàn thành** (trừ app mobile) |
| Unit test | 37/37 pass |
| Kiểm thử API end-to-end | 107/107 bước pass |
| Chạy thử kịch bản demo trên Chrome | 23/23 bước pass |

🎙 *"Toàn bộ chức năng không phụ thuộc AI đã hoàn thiện và chạy thật với dữ liệu SSI và email thật: từ đăng ký, phân quyền, danh mục, kế hoạch, nhật ký đến quản trị. Phần còn thiếu là lõi AI: dự báo đang là dữ liệu mẫu, chưa có giải thích, chưa chấm sentiment tin tức, và Chat chưa trả lời. Hạ tầng hiển thị, cảnh báo, báo cáo và lịch chạy đã sẵn sàng để nhận dự báo thật. Bước tiếp theo là mô hình baseline XGBoost, giải thích bằng SHAP, sentiment bằng PhoBERT và ứng dụng mobile. Em xin cảm ơn thầy cô đã theo dõi."*

---

## XỬ LÝ SỰ CỐ KHI QUAY

| Tình huống | Cách xử lý |
|---|---|
| Không thấy thư xác thực | Xem mục **Spam / Quảng cáo**. Hoặc trên trang xác thực, nhập email → **Gửi lại email xác thực** (chờ 60 giây giữa các lần) |
| Bấm link trong thư nhưng vào trang Tổng quan của tài khoản khác | Đang dùng cửa sổ thường có sẵn phiên đăng nhập. Hãy quay bằng **cửa sổ ẩn danh** |
| Đăng ký báo đã gửi nhưng không có thư | Đã vượt **5 lần đăng ký/giờ** trên máy này. Đợi hoặc nhờ dọn bộ đếm |
| Bấm **Lưu nháp** không có phản ứng | Có ô nhập sai định dạng; trình duyệt sẽ khoanh đỏ ô đó |
| Job đứng mãi ở "Đang chờ" | Terminal `worker:admin-jobs:watch` đã tắt; chạy lại lệnh |
| Báo "thao tác quá nhiều lần" | Giới hạn tần suất; chờ khoảng 1 phút |
| Tài khoản demo bị khóa do sai mật khẩu | `npm run db:seed:demo` |
| Giá FPT biến động mạnh so với ngày chạy thử | Các số R:R, % và khối lượng ở Phần 5 không đổi vì chỉ phụ thuộc số bạn nhập. Chỉ % lãi ở chip "Đã đóng" là tính theo giá vào |

**Mẹo dựng video:**
- Quay từng phần thành clip riêng rồi ghép. Phần nào lỗi chỉ cần quay lại phần đó; Phần 2 nhớ đổi sang `+demo2`.
- Nếu quá 10 phút, cắt theo thứ tự: Bước 4 Phần 5 (Tuần/Tháng) → bước mobile ở Phần 8 → Bước 4 Phần 7 (chạy job).
- Sau các lần quay thử, nhờ dọn tài khoản `+demo…` trước khi quay chính thức.
